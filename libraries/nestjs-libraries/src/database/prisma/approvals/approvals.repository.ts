import { agentAdmissionContext, AgentSaveRecovered } from '../posts/agent-admission.context';
import { BadRequestException, Injectable } from '@nestjs/common';
import { mcpPayloadRevision } from '../posts/posts.repository';
import { ApprovalStatus, Prisma, Role, State } from '@prisma/client';
import {
  PrismaRepository,
  PrismaTransaction,
} from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

export interface ApprovalSettingsData {
  requireApproval: boolean;
  approverIds: string[];
  requireAgentApproval: boolean;
  requireApiApproval: boolean;
  agentIntegrationIds: string[];
  agentMaxPostsPerDay: number | null;
}

// the statuses that keep a post in the review queue
export const REVIEW_QUEUE: ApprovalStatus[] = ['IN_REVIEW', 'CHANGES_REQUESTED'];

@Injectable()
export class ApprovalsRepository {
  constructor(
    private _settings: PrismaRepository<'approvalSettings'>,
    private _links: PrismaRepository<'approvalLink'>,
    private _post: PrismaRepository<'post'>,
    private _userOrg: PrismaRepository<'userOrganization'>,
    private _integration: PrismaRepository<'integration'>,
    private _organization: PrismaRepository<'organization'>,
    private _transaction: PrismaTransaction
  ) {}

  getSettings(organizationId: string) {
    return this._settings.model.approvalSettings.findUnique({
      where: { organizationId },
    });
  }

  upsertSettings(organizationId: string, data: ApprovalSettingsData) {
    return this._settings.model.approvalSettings.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    });
  }

  getMembers(organizationId: string) {
    return this._userOrg.model.userOrganization.findMany({
      where: {
        organizationId,
        disabled: false,
        user: { deletedAt: null },
      },
      select: {
        role: true,
        user: {
          select: { id: true, email: true, name: true, lastName: true },
        },
      },
    });
  }

  getMember(organizationId: string, userId: string) {
    return this._userOrg.model.userOrganization.findFirst({
      where: {
        organizationId,
        userId,
        disabled: false,
        user: { deletedAt: null },
      },
      select: {
        role: true,
        user: {
          select: { id: true, email: true, name: true, lastName: true },
        },
      },
    });
  }

  // Admins always approve, plus the members picked in the settings
  getApprovers(organizationId: string, approverIds: string[]) {
    return this._userOrg.model.userOrganization.findMany({
      where: {
        organizationId,
        disabled: false,
        user: { deletedAt: null },
        OR: [
          { role: { in: [Role.SUPERADMIN, Role.ADMIN] } },
          ...(approverIds.length ? [{ userId: { in: approverIds } }] : []),
        ],
      },
      select: {
        user: { select: { id: true, email: true } },
      },
    });
  }

  getRootPost(organizationId: string, postId: string) {
    return this._post.model.post.findFirst({
      where: {
        id: postId,
        organizationId,
        deletedAt: null,
        parentPostId: null,
        integration: { deletedAt: null },
      },
      select: {
        id: true,
        mcpWorkflowVersion: true,
        group: true,
        state: true,
        releaseId: true,
        approvalStatus: true,
        publishDate: true,
        content: true,
        agentSource: true,
        organizationId: true,
        // what the approver saw, an approval is bound to it
        updatedAt: true,
        integration: {
          select: {
            id: true,
            name: true,
            providerIdentifier: true,
            // whether it can publish now, see integration.state.ts
            disabled: true,
            inBetweenSteps: true,
            refreshNeeded: true,
          },
        },
      },
    });
  }

  private async orderedTrackedThread(tx: Prisma.TransactionClient, organizationId: string, post: { id: string; group: string }, integrationId: string) {
    const rows = await tx.post.findMany({
      where: { organizationId, integrationId, group: post.group, deletedAt: null },
      select: { id: true, integrationId: true, content: true, settings: true, image: true, delay: true, publishDate: true, parentPostId: true, mcpWorkflowVersion: true },
    });
    const root = rows.find(row => row.id === post.id && row.parentPostId === null && row.mcpWorkflowVersion === 114);
    if (!root) throw new BadRequestException('The tracked revision changed. Refresh before reviewing.');
    const ordered = [root];
    const seen = new Set([root.id]);
    let current = root;
    while (true) {
      const children = rows.filter(row => row.parentPostId === current.id);
      if (!children.length) break;
      if (children.length !== 1 || seen.has(children[0].id)) throw new BadRequestException('The tracked revision has an invalid thread.');
      current = children[0]; ordered.push(current); seen.add(current.id);
    }
    if (ordered.length !== rows.length) throw new BadRequestException('The tracked revision has an incomplete thread.');
    return ordered;
  }

  // A post and its comments move together, they share the group. The main
  // post is claimed first, only when it still matches `expected`, so two
  // people acting at once can't both approve (and publish) it. Both writes
  // are one transaction: comments never stay behind in the old state.
  async transitionGroup(
    organizationId: string,
    post: { id: string; group: string; mcpWorkflowVersion?: number | null },
    expected: Prisma.PostWhereInput,
    data: { state: State; approvalStatus: ApprovalStatus; publishDate?: Date }
  ) {
    const write = {
      ...data,
      // queued again: the error and the release of an earlier attempt no
      // longer describe it, like PostsRepository.changeDate on a reschedule
      ...(data.state === 'QUEUE'
        ? { error: null, releaseId: null, releaseURL: null }
        : {}),
    };
    return this._transaction.model.$transaction(async (tx) => {
      const admission = agentAdmissionContext.getStore();
      if (admission) {
        if (admission.orgId !== organizationId || typeof admission.owner !== 'string' || !admission.owner) throw new AgentSaveRecovered();
        const owned = await tx.mcpAgentAdmission.updateMany({ where: { organizationId, owner: admission.owner }, data: { owner: admission.owner } });
        if (!owned.count) throw new AgentSaveRecovered();
      }
      let previousFence: { state: string; revisionHash: string; integrationId: string } | undefined;
      if (post.mcpWorkflowVersion === 114) {
        const existing = await tx.mcpPublishFence.findFirst({ where: { postId: post.id, organizationId } });
        if (!existing) return false;
        // Use the row returned after acquiring the write lock, not a state/hash
        // snapshot read before a concurrent cancellation or edit completed.
        const fence = await tx.mcpPublishFence.update({ where: { postId: post.id }, data: { updatedAt: new Date() } });
        if (await tx.mcpPublishAttempt.count({ where: { rootPostId: post.id, status: { in: ['STARTED', 'UNKNOWN', 'PENDING', 'CONFIRMED'] } } })) return false;
        const stored = await this.orderedTrackedThread(tx, organizationId, post, fence.integrationId);
        if (mcpPayloadRevision(stored) !== fence.revisionHash) throw new BadRequestException('The tracked revision changed. Refresh before reviewing.');
        previousFence = fence;
      }
      const claimed = await tx.post.updateMany({
        where: {
          AND: [expected, { id: post.id, organizationId, deletedAt: null }],
        },
        data: write,
      });
      if (!claimed.count) {
        return false;
      }
      await tx.post.updateMany({
        where: {
          organizationId,
          group: post.group,
          ...(previousFence ? { integrationId: previousFence.integrationId } : {}),
          deletedAt: null,
          id: { not: post.id },
        },
        data: write,
      });
      if (admission) {
        const current = await tx.mcpAgentAdmission.findUniqueOrThrow({ where: { organizationId } });
        const entries = await tx.post.findMany({ where: { organizationId, group: post.group, ...(previousFence ? { integrationId: previousFence.integrationId } : {}), deletedAt: null }, select: { id: true } });
        await tx.mcpAgentAdmission.update({ where: { organizationId, owner: admission.owner }, data: { writtenPostIds: [...new Set([...(current.writtenPostIds as string[]), ...entries.map(entry => entry.id)])] } });
      }
      if (previousFence) {
        // Approval may move an overdue schedule to now. Hash the actual final
        // ordered rows under this same fence transaction, never a later registration.
        const finalRows = await this.orderedTrackedThread(tx, organizationId, post, previousFence.integrationId);
        const revisionHash = mcpPayloadRevision(finalRows);
        // Preserve registerMcpFence's existing immutable-attempt rule even for
        // terminal-unpublished attempts: approval must not silently rebind them.
        if (revisionHash !== previousFence.revisionHash && await tx.mcpPublishAttempt.count({ where: { rootPostId: post.id } })) throw new BadRequestException('Publication attempts exist; changing their revision is blocked.');
        await tx.mcpPublishFence.update({ where: { postId: post.id }, data: {
          revisionHash,
          state: data.state === 'QUEUE' ? 'ACTIVE' : 'CANCELLED',
          dispatchState: data.state === 'QUEUE' ? 'PENDING' : 'CANCELLED',
          dispatchNotBefore: new Date(), dispatchConfirmedAt: null, dispatchErrorCode: null,
          ...(data.state === 'QUEUE' && (previousFence.state === 'CANCELLED' || previousFence.revisionHash !== revisionHash) ? { generation: { increment: 1 } } : {}),
        } });
      }
      return true;
    });
  }

  getReviewQueue(organizationId: string, agentOnly: boolean) {
    return this._post.model.post.findMany({
      where: {
        organizationId,
        deletedAt: null,
        parentPostId: null,
        approvalStatus: { in: REVIEW_QUEUE },
        integration: { deletedAt: null },
        ...(agentOnly ? { agentSource: { not: null } } : {}),
      },
      orderBy: { publishDate: 'asc' },
      take: 200,
      select: {
        id: true,
        state: true,
        mcpWorkflowVersion: true,
        group: true,
        content: true,
        image: true,
        publishDate: true,
        approvalStatus: true,
        agentSource: true,
        creationMethod: true,
        createdAt: true,
        // sent back with an approval, so it approves the version shown
        updatedAt: true,
        integration: {
          select: {
            id: true,
            name: true,
            picture: true,
            providerIdentifier: true,
          },
        },
      },
    });
  }

  countReviewQueue(organizationId: string) {
    return this._post.model.post.count({
      where: {
        organizationId,
        deletedAt: null,
        parentPostId: null,
        approvalStatus: 'IN_REVIEW',
        integration: { deletedAt: null },
      },
    });
  }

  // Deleted posts count too, deleting must not hand an agent its quota back
  countAgentPostsSince(organizationId: string, since: Date) {
    return this._post.model.post.count({
      where: {
        organizationId,
        parentPostId: null,
        agentSource: { not: null },
        createdAt: { gte: since },
      },
    });
  }

  getIntegrationNames(organizationId: string, ids: string[]) {
    return this._integration.model.integration.findMany({
      where: { organizationId, id: { in: ids }, deletedAt: null },
      select: { id: true, name: true },
    });
  }

  createLink(data: {
    organizationId: string;
    tokenHash: string;
    postIds: string[];
    createdById: string;
    expiresAt: Date;
  }) {
    return this._links.model.approvalLink.create({
      data,
      select: { id: true, expiresAt: true, postIds: true, createdAt: true },
    });
  }

  listLinks(organizationId: string) {
    return this._links.model.approvalLink.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        postIds: true,
        expiresAt: true,
        revokedAt: true,
        lastViewedAt: true,
        createdAt: true,
      },
    });
  }

  revokeLink(organizationId: string, id: string) {
    return this._links.model.approvalLink.updateMany({
      where: { organizationId, id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  getLinkByHash(tokenHash: string) {
    return this._links.model.approvalLink.findUnique({
      where: { tokenHash },
    });
  }

  touchLink(id: string) {
    return this._links.model.approvalLink.update({
      where: { id },
      data: { lastViewedAt: new Date() },
      select: { id: true },
    });
  }

  getOrganizationName(organizationId: string) {
    return this._organization.model.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
  }
}
