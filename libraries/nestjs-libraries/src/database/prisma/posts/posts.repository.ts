import { agentAdmissionContext, AgentSaveRecovered } from './agent-admission.context';
import { createHash } from 'crypto';
import { agentDraftOnly, assertAgentPostWrite } from '../../../chat/agent-credential.policy';
import { PrismaRepository, PrismaTransaction } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Post as PostBody } from '@gitroom/nestjs-libraries/dtos/posts/create.post.dto';
import {
  APPROVED_SUBMIT_FOR_ORDER,
  ApprovalStatus,
  CreationMethod,
  Post,
  Prisma,
  State,
} from '@prisma/client';
import { GetPostsDto } from '@gitroom/nestjs-libraries/dtos/posts/get.posts.dto';
import { GetPostsListDto } from '@gitroom/nestjs-libraries/dtos/posts/get.posts.list.dto';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import utc from 'dayjs/plugin/utc';
import { v4 as uuidv4 } from 'uuid';
import { CreateTagDto } from '@gitroom/nestjs-libraries/dtos/posts/create.tag.dto';
import { decryptIntegrationOf } from '@gitroom/nestjs-libraries/database/prisma/integrations/token.encryption';
import { evergreenOccurrences } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.evergreen.schedule';
import { curatedPostError } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.curated.error';
import { auditErrorBody } from '@gitroom/nestjs-libraries/database/prisma/errors/errors.audit.body';
import { CHANNEL_READY } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.state';

dayjs.extend(isoWeek);
dayjs.extend(weekOfYear);

// An agent save that holds its workspace admission longer than this is taken
// to be abandoned (its process died mid-save). A later save takes it over;
// the old owner's remaining writes are fenced out like after a recovery.
export const AGENT_ADMISSION_LEASE_MS = 10 * 60 * 1000;
dayjs.extend(utc);

// Who a post read is for. A real organization id scopes the read to that
// tenant; PUBLIC_PREVIEW is the one deliberate exception - the shared preview
// page, which anyone holding the link may open. It is a visible argument rather
// than an omitted one, so a reader of any call site can tell which it is, and
// `grep PUBLIC_PREVIEW` lists every cross-tenant read in the codebase.
//
// The literal can never collide with a real organization id, which is a uuid.
export const PUBLIC_PREVIEW = '__public_preview__' as const;
export type OrgScope = string | typeof PUBLIC_PREVIEW;

export const orgFilter = (scope: OrgScope) =>
  scope === PUBLIC_PREVIEW ? {} : { organizationId: scope };

export const mcpPayloadRevision = (posts: Array<any>) => createHash('sha256').update(JSON.stringify(posts.map(p => ({
  id: p.id, integrationId: p.integrationId, content: p.content, settings: p.settings,
  image: p.image, delay: p.delay, publishDate: new Date(p.publishDate).toISOString(), parentPostId: p.parentPostId,
})))).digest('hex');

@Injectable()
export class PostsRepository {
  constructor(
    private _post: PrismaRepository<'post'>,
    private _popularPosts: PrismaRepository<'popularPosts'>,
    private _comments: PrismaRepository<'comments'>,
    private _tags: PrismaRepository<'tags'>,
    private _tagsPosts: PrismaRepository<'tagsPosts'>,
    private _errors: PrismaRepository<'errors'>,
    private _transaction: PrismaTransaction,
    private _providerPostUsage: PrismaRepository<'providerPostUsage'>
  ) {}

  private async updateActivePost(
    id: string,
    data: Prisma.PostUpdateManyMutationInput,
    conditions: Prisma.PostWhereInput = {},
    includeProvider = false,
    audit?: { message: string; body: string }
  ) {
    return this._transaction.model.$transaction(async (tx) => {
      const post = await tx.post.findUnique({
        where: { id },
        select: { integrationId: true },
      });
      if (!post) throw new BadRequestException('Post is no longer available.');

      // Lock the active connection for this short transaction. Deletion uses
      // the same integration row, so it either precedes this write (no match)
      // or follows the committed result and removes it during cleanup.
      const connection = await tx.integration.updateMany({
        where: { id: post.integrationId, deletedAt: null },
        data: { deletedAt: null },
      });
      if (!connection.count) {
        throw new BadRequestException('Post is no longer available.');
      }
      const changed = await tx.post.updateMany({
        where: {
          id,
          AND: [conditions, { integrationId: post.integrationId }],
          deletedAt: null,
          integration: { deletedAt: null },
        },
        data,
      });
      if (!changed.count) {
        throw new BadRequestException('Post is no longer available.');
      }

      const updated = await tx.post.findUnique({ where: { id } });
      if (!includeProvider) return updated;
      const integration = await tx.integration.findUnique({
        where: { id: post.integrationId },
        select: { providerIdentifier: true },
      });
      if (audit) {
        await tx.errors.create({
          data: {
            ...audit,
            organizationId: updated!.organizationId,
            platform: integration!.providerIdentifier,
            postId: id,
          },
        });
      }
      return { ...updated!, integration };
    });
  }

  private async assertSaveAdmission(tx: Prisma.TransactionClient, orgId: string) {
    const admission = agentAdmissionContext.getStore();
    if (!admission) return;
    if (admission.orgId !== orgId || typeof admission.owner !== 'string' || !admission.owner) throw new AgentSaveRecovered();
    const owned = await tx.mcpAgentAdmission.updateMany({ where: { organizationId: orgId, owner: admission.owner }, data: { owner: admission.owner } });
    if (!owned.count) throw new AgentSaveRecovered();
  }

  // PostgreSQL aborts a Serializable transaction that raced another one with
  // P2034. It rolled back entirely, so running it again is safe.
  private async retrySerializable<T>(run: () => Promise<T>, attempts = 3): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await run();
      } catch (error) {
        if ((error as any)?.code !== 'P2034' || attempt >= attempts) throw error;
        await new Promise((resolve) => setTimeout(resolve, 25 * attempt));
      }
    }
  }

  // Fences an abandoned owner out like recoverAgentAdmission: its saved post
  // IDs stay readable through the recovery row, its later writes throw.
  private async expireAgentAdmission(tx: Prisma.TransactionClient, orgId: string, owner: string, where: Prisma.McpAgentAdmissionWhereInput, reason: string) {
    const locked = await tx.mcpAgentAdmission.updateMany({ where: { ...where, organizationId: orgId, owner }, data: { owner } });
    if (!locked.count) return false;
    const admission = await tx.mcpAgentAdmission.findUniqueOrThrow({ where: { organizationId: orgId } });
    const ids = admission.writtenPostIds as string[];
    const audit = await tx.activityLog.create({ data: { organizationId: orgId, action: 'GUARDRAIL_BLOCKED', actorType: 'SYSTEM', comment: `${reason} ${owner}; preserved post IDs: ${ids.join(', ') || 'none'}.` }, select: { id: true } });
    await tx.mcpAgentAdmissionRecovery.create({ data: { organizationId: orgId, owner, auditId: audit.id, writtenPostIds: ids } });
    await tx.mcpAgentAdmission.delete({ where: { organizationId: orgId, owner } });
    return true;
  }

  async acquireAgentAdmission(orgId: string, owner: string, metadata: { instanceId: string; host: string; processId: number } = { instanceId: 'unknown', host: 'unknown', processId: 0 }) {
    // a second live save still fails with the unique violation (P2002)
    return this.retrySerializable(() => this._transaction.model.$transaction(async tx => {
      const held = await tx.mcpAgentAdmission.findUnique({ where: { organizationId: orgId }, select: { owner: true } });
      if (held) await this.expireAgentAdmission(tx, orgId, held.owner, { createdAt: { lt: new Date(Date.now() - AGENT_ADMISSION_LEASE_MS) } }, 'Expired agent save after its 10 minute lease');
      return tx.mcpAgentAdmission.create({ data: { organizationId: orgId, owner, ...metadata } });
    }, { isolationLevel: 'Serializable' }));
  }

  // Admissions taken by another backend process, which a restart or a deploy
  // ended mid-save. See PostsService.releaseAbandonedAgentAdmissions for why
  // this is only safe at backend boot.
  async releaseAgentAdmissionsOfOtherInstances(instanceId: string) {
    const stale = await this._transaction.model.$transaction(tx => tx.mcpAgentAdmission.findMany({ where: { instanceId: { not: instanceId } }, select: { organizationId: true, owner: true } }));
    let released = 0;
    for (const row of stale) {
      const expired = await this.retrySerializable(() => this._transaction.model.$transaction(
        tx => this.expireAgentAdmission(tx, row.organizationId, row.owner, { instanceId: { not: instanceId } }, 'Released agent save of a stopped server'),
        { isolationLevel: 'Serializable' }
      ));
      if (expired) released++;
    }
    return released;
  }
  async agentAdmissionStatus(orgId: string) {
    return this._transaction.model.$transaction(tx => tx.mcpAgentAdmission.findUnique({ where: { organizationId: orgId }, select: { owner: true, instanceId: true, host: true, processId: true, writtenPostIds: true, createdAt: true } }));
  }

  // Recovery fences every later write by this exact owner: PostgreSQL
  // establishes quiescence. Admins can do it at once; the lease
  // (AGENT_ADMISSION_LEASE_MS) and the backend boot do it on their own.
  async recoverAgentAdmission(orgId: string, expectedOwner: string, actorId: string) {
    return this._transaction.model.$transaction(async tx => {
      const locked = await tx.mcpAgentAdmission.updateMany({ where: { organizationId: orgId, owner: expectedOwner }, data: { owner: expectedOwner } });
      if (!locked.count) throw new BadRequestException('The active save changed. Refresh before recovering it.');
      const admission = await tx.mcpAgentAdmission.findUniqueOrThrow({ where: { organizationId: orgId } });
      const ids = admission.writtenPostIds as string[];
      const persisted = await tx.post.findMany({ where: { organizationId: orgId, id: { in: ids } }, select: { id: true, state: true } });
      const audit = await tx.activityLog.create({ data: { organizationId: orgId, action: 'GUARDRAIL_BLOCKED', actorType: 'USER', actorUserId: actorId, comment: `Recovered agent save ${expectedOwner}; preserved post IDs: ${ids.join(', ') || 'none'}.` }, select: { id: true } });
      await tx.mcpAgentAdmissionRecovery.create({ data: { organizationId: orgId, owner: expectedOwner, auditId: audit.id, writtenPostIds: ids } });
      await tx.mcpAgentAdmission.delete({ where: { organizationId: orgId, owner: expectedOwner } });
      return { status: 'RECOVERED', persistedPosts: persisted, missingPostIds: ids.filter(id => !persisted.some(p => p.id === id)) };
    }, { isolationLevel: 'Serializable' });
  }

  private async recordAgentWrites(tx: Prisma.TransactionClient, orgId: string, owner: string | undefined, posts: Post[]) {
    if (!owner) return;
    const admission = await tx.mcpAgentAdmission.findFirst({ where: { organizationId: orgId, owner } });
    if (!admission) throw new AgentSaveRecovered();
    const ids = [...new Set([...(admission.writtenPostIds as string[]), ...posts.map(p => p.id)])];
    await tx.mcpAgentAdmission.update({ where: { organizationId: orgId, owner }, data: { writtenPostIds: ids } });
  }

  // refused: the save failed on an ordinary refusal (validation, plan), which
  // is recorded as a stopped save only when it already wrote posts
  async releaseAgentAdmission(orgId: string, owner: string, failed = false, refused = false) {
    // a release lost to a serialization race would leave the workspace locked
    return this.retrySerializable(() => this._transaction.model.$transaction(async tx => {
      const locked = await tx.mcpAgentAdmission.updateMany({ where: { organizationId: orgId, owner }, data: { owner } });
      if (!locked.count) {
        const recovered = await tx.mcpAgentAdmissionRecovery.findFirst({ where: { organizationId: orgId, owner }, orderBy: { createdAt: 'desc' } });
        return { count: 0, writtenPostIds: (recovered?.writtenPostIds || []) as string[] };
      }
      const admission = await tx.mcpAgentAdmission.findUniqueOrThrow({ where: { organizationId: orgId } });
      const writtenPostIds = admission.writtenPostIds as string[];
      if (failed && (!refused || writtenPostIds.length)) {
        const audit = await tx.activityLog.create({ data: { organizationId: orgId, action: 'GUARDRAIL_BLOCKED', actorType: 'SYSTEM', comment: `Stopped failed agent save ${owner}; preserved post IDs: ${writtenPostIds.join(', ') || 'none'}.` }, select: { id: true } });
        await tx.mcpAgentAdmissionRecovery.create({ data: { organizationId: orgId, owner, auditId: audit.id, writtenPostIds } });
      }
      const result = await tx.mcpAgentAdmission.deleteMany({ where: { organizationId: orgId, owner } });
      return { ...result, writtenPostIds };
    }, { isolationLevel: 'Serializable' }));
  }

  async holdRemainingMcp(orgId: string, rootId: string, status: 'CHANGES_REQUESTED' | 'REJECTED', updatedAt: Date) {
    return this._transaction.model.$transaction(async tx => {
      await this.assertSaveAdmission(tx, orgId);
      const locked = await tx.mcpPublishFence.updateMany({ where: { postId: rootId, organizationId: orgId }, data: { updatedAt: new Date() } });
      if (!locked.count || await tx.mcpPublishAttempt.count({ where: { rootPostId: rootId, status: { in: ['STARTED', 'UNKNOWN', 'PENDING'] } } })) throw new BadRequestException('The remaining thread is publishing or uncertain.');
      const root = await tx.post.findFirst({ where: { id: rootId, organizationId: orgId, state: 'PUBLISHED', mcpWorkflowVersion: 114, updatedAt, deletedAt: null } });
      if (!root) throw new BadRequestException('The remaining thread changed. Refresh before reviewing.');
      await tx.mcpPublishFence.update({ where: { postId: rootId }, data: { state: 'CANCELLED', dispatchState: 'CANCELLED' } });
      await tx.post.update({ where: { id: rootId }, data: { approvalStatus: status } });
      await tx.post.updateMany({ where: { organizationId: orgId, integrationId: root.integrationId, group: root.group, state: { not: 'PUBLISHED' }, deletedAt: null, releaseId: null, releaseURL: null }, data: { state: 'DRAFT', approvalStatus: status } });
      return { id: rootId, state: 'PUBLISHED', approvalStatus: status, remainingHeld: true };
    }, { isolationLevel: 'Serializable' });
  }

  async approveRemainingMcp(orgId: string, rootId: string, updatedAt: Date) {
    return this._transaction.model.$transaction(async tx => {
      await this.assertSaveAdmission(tx, orgId);
      const fence = await tx.mcpPublishFence.updateMany({ where: { postId: rootId, organizationId: orgId, state: 'CANCELLED' }, data: { updatedAt: new Date() } });
      if (!fence.count) throw new BadRequestException('The remaining thread changed. Refresh before approving.');
      const root = await tx.post.findFirst({ where: { id: rootId, organizationId: orgId, state: 'PUBLISHED', mcpWorkflowVersion: 114, approvalStatus: { in: ['IN_REVIEW', 'CHANGES_REQUESTED', 'REJECTED'] }, updatedAt, deletedAt: null } });
      if (!root || await tx.mcpPublishAttempt.count({ where: { rootPostId: rootId, status: { in: ['STARTED', 'UNKNOWN', 'PENDING'] } } })) throw new BadRequestException('The remaining thread changed or has an uncertain attempt.');
      await tx.post.update({ where: { id: rootId }, data: { approvalStatus: 'APPROVED' } });
      await tx.post.updateMany({ where: { organizationId: orgId, integrationId: root.integrationId, group: root.group, deletedAt: null, state: 'DRAFT', releaseId: null, releaseURL: null }, data: { state: 'QUEUE', approvalStatus: 'APPROVED' } });
      await tx.mcpPublishFence.update({ where: { postId: rootId }, data: { state: 'ACTIVE', generation: { increment: 1 }, dispatchState: 'PENDING', dispatchNotBefore: new Date(), dispatchConfirmedAt: null, dispatchErrorCode: null } });
      return { id: rootId, state: 'PUBLISHED', approvalStatus: 'APPROVED', remainingScheduled: true };
    }, { isolationLevel: 'Serializable' });
  }

  async activateApprovedMcp(orgId: string, postId: string) {
    return this._transaction.model.$transaction(async tx => {
      await this.assertSaveAdmission(tx, orgId);
      const root = await tx.post.findFirst({ where: { id: postId, organizationId: orgId, state: 'QUEUE', approvalStatus: 'APPROVED', deletedAt: null } });
      if (!root) throw new BadRequestException('Approved revision is no longer queued.');
      await tx.mcpPublishFence.updateMany({ where: { postId, organizationId: orgId, state: 'CANCELLED' }, data: { state: 'ACTIVE', generation: { increment: 1 }, dispatchState: 'PENDING', dispatchNotBefore: new Date(), dispatchConfirmedAt: null, dispatchErrorCode: null } });
    }, { isolationLevel: 'Serializable' });
  }
  async mcpFence(orgId: string, rootId: string) {
    return this._transaction.model.$transaction(tx => tx.mcpPublishFence.findFirst({ where: { postId: rootId, organizationId: orgId } }));
  }
  async failMcpSegment(orgId: string, rootId: string, segmentId: string, generation: number, revisionHash: string) {
    return this._transaction.model.$transaction(async tx => {
      const current = await tx.mcpPublishFence.updateMany({ where: { postId: rootId, organizationId: orgId, generation, revisionHash, state: 'ACTIVE' }, data: { updatedAt: new Date() } });
      if (!current.count) return;
      await tx.post.updateMany({ where: { id: segmentId, organizationId: orgId, state: 'QUEUE', deletedAt: null }, data: { state: 'ERROR', error: 'Publication outcome needs reconciliation before retry.' } });
    }, { isolationLevel: 'Serializable' });
  }
  async mcpWarnings(orgId: string, postIds: string[]) {
    if (!postIds.length) return [];
    return this._transaction.model.$transaction(tx => tx.mcpPublishAttempt.findMany({ where: { organizationId: orgId, segmentPostId: { in: postIds }, status: 'CONFIRMED', followUpWarning: { not: null } }, select: { segmentPostId: true, followUpWarning: true } }));
  }

  async mcpDispatchStatuses(orgId: string, postIds: string[]) {
    if (!postIds.length) return [];
    return this._transaction.model.$transaction(tx => tx.mcpPublishFence.findMany({ where: { organizationId: orgId, postId: { in: postIds } }, select: { postId: true, generation: true, dispatchState: true, dispatchErrorCode: true } }));
  }

  async mcpAttempts(orgId: string, rootId: string) {
    return this._transaction.model.$transaction(tx => tx.mcpPublishAttempt.findMany({ where: { organizationId: orgId, rootPostId: rootId }, orderBy: { generation: 'asc' } }));
  }
  async reconcileMcpAttempt(orgId: string, id: string, outcome: 'FAILED' | 'CONFIRMED', receipt?: any) {
    return this._transaction.model.$transaction(async tx => {
      const attempt = await tx.mcpPublishAttempt.findFirst({ where: { id, organizationId: orgId, status: { in: ['STARTED', 'UNKNOWN'] } } });
      if (!attempt) return { count: 0 };
      const locked = await tx.mcpPublishFence.updateMany({ where: { postId: attempt.rootPostId, organizationId: orgId, state: 'ACTIVE', generation: attempt.generation, revisionHash: attempt.revisionHash }, data: { updatedAt: new Date() } });
      if (!locked.count) throw new BadRequestException('The attempt fence changed.');
      if (outcome === 'CONFIRMED') {
        if (!attempt.providerPayloadHash || !receipt?.[0]?.postId || receipt[0].id !== attempt.segmentPostId) throw new BadRequestException('Receipt identity mismatch.');
        await tx.post.update({ where: { id: attempt.segmentPostId, organizationId: orgId, deletedAt: null }, data: { state: 'PUBLISHED', releaseId: String(receipt[0].postId), releaseURL: String(receipt[0].releaseURL || ''), error: null } });
      }
      return tx.mcpPublishAttempt.updateMany({ where: { id, organizationId: orgId, status: { in: ['STARTED', 'UNKNOWN'] } }, data: { status: outcome, ...(receipt ? { receipt } : {}) } });
    }, { isolationLevel: 'Serializable' });
  }

  async resumeMcp(orgId: string, rootId: string, revisionHash: string, closedGeneration?: number) {
    return this._transaction.model.$transaction(async tx => {
      await this.assertSaveAdmission(tx, orgId);
      const fence = await tx.mcpPublishFence.findUnique({ where: { postId: rootId } });
      if (!fence || fence.organizationId !== orgId || fence.revisionHash !== revisionHash) throw new BadRequestException('Legacy or changed revision cannot resume.');
      await tx.mcpPublishFence.update({ where: { postId: rootId }, data: { updatedAt: new Date() } });
      const attempts = await tx.mcpPublishAttempt.findMany({ where: { rootPostId: rootId } });
      if (attempts.some(a => !['FAILED', 'CONFIRMED'].includes(a.status))) return { status: 'OUTCOME_UNKNOWN' };
      if (fence.state === 'ACTIVE' && !attempts.some(a => a.status === 'FAILED' && a.generation === fence.generation) && closedGeneration !== fence.generation) return { status: 'ALREADY_ACTIVE' };
      const root = await tx.post.findFirst({ where: { id: rootId, organizationId: orgId, deletedAt: null } });
      if (!root || ['IN_REVIEW', 'REJECTED', 'CHANGES_REQUESTED'].includes(root.approvalStatus)) return { status: 'BLOCKED', reason: 'Human review is required.' };
      const remaining = await tx.post.count({ where: { organizationId: orgId, integrationId: root.integrationId, group: root.group, deletedAt: null, state: { not: 'PUBLISHED' } } });
      if (!remaining) return { status: 'ALREADY_PUBLISHED' };
      await tx.mcpPublishFence.update({ where: { postId: rootId }, data: { generation: { increment: 1 }, state: 'ACTIVE', dispatchState: 'PENDING', dispatchNotBefore: new Date(), dispatchConfirmedAt: null, dispatchErrorCode: null } });
      await tx.post.updateMany({ where: { organizationId: orgId, integrationId: root.integrationId, group: root.group, deletedAt: null, releaseId: null, releaseURL: null, state: { not: 'PUBLISHED' } }, data: { state: 'QUEUE' } });
      return { status: 'RESUMED' };
    }, { isolationLevel: 'Serializable' }).catch(error => { if (error instanceof AgentSaveRecovered) throw error; return ({ status: error instanceof BadRequestException || (error as any)?.code === 'P2034' ? 'BLOCKED' : 'OUTCOME_UNKNOWN', reason: 'The publication state changed or could not be confirmed. Inspect the post before retrying.' }); });
  }

  async pendingMcpDispatches(limit = 16) {
    return this._transaction.model.$transaction(tx => tx.mcpPublishFence.findMany({ where: { state: 'ACTIVE', dispatchState: { in: ['PENDING', 'UNKNOWN'] }, dispatchNotBefore: { lte: new Date() } }, orderBy: [{ dispatchNotBefore: 'asc' }, { createdAt: 'asc' }], take: Math.max(1, Math.min(limit, 16)) }));
  }

  async recordMcpDispatch(orgId: string, rootId: string, generation: number, revisionHash: string, status: 'CONFIRMED' | 'UNKNOWN' | 'HELD' | 'NONE', code: string | null = null, sent = false) {
    return this._transaction.model.$transaction(async tx => {
      await this.assertSaveAdmission(tx, orgId);
      return tx.mcpPublishFence.updateMany({ where: { postId: rootId, organizationId: orgId, state: 'ACTIVE', generation, revisionHash }, data: { dispatchState: status, dispatchErrorCode: code, dispatchNotBefore: new Date(Date.now() + 30000), ...(sent ? { dispatchAttempts: { increment: 1 } } : {}), ...(status === 'CONFIRMED' ? { dispatchConfirmedAt: new Date() } : {}) } });
    });
  }

  async mcpWorkflowVersion(orgId: string, postId: string) {
    return (await this._post.model.post.findFirst({ where: { id: postId, organizationId: orgId }, select: { mcpWorkflowVersion: true } }))?.mcpWorkflowVersion;
  }

  // The transaction locks the same fence for API transitions and worker admission.
  // STARTED is durable before external I/O; an interrupted caller cannot infer failure.
  private async writeMcpFence(tx: Prisma.TransactionClient, orgId: string, posts: Post[]) {
    const root = posts[0];
    if (!root || root.mcpWorkflowVersion !== 114) return;
    const revisionHash = mcpPayloadRevision(posts);
    const previous = await tx.mcpPublishFence.findUnique({ where: { postId: root.id } });
    await tx.mcpPublishFence.upsert({ where: { postId: root.id }, create: { postId: root.id, organizationId: orgId, integrationId: root.integrationId, revisionHash, dispatchState: root.state === 'QUEUE' ? 'PENDING' : 'NONE' }, update: {
      revisionHash, dispatchState: root.state === 'QUEUE' ? 'PENDING' : 'NONE', dispatchNotBefore: new Date(), dispatchConfirmedAt: null, dispatchErrorCode: null,
      ...(previous && previous.revisionHash !== revisionHash ? { generation: { increment: 1 } } : {}),
      ...(previous?.state === 'EDITING' ? { state: 'ACTIVE' } : {}),
    } });
  }

  async registerMcpFence(orgId: string, postId: string, integrationId: string, revisionHash: string) {
    return this._transaction.model.$transaction(async tx => {
      await this.assertSaveAdmission(tx, orgId);
      const existing = await tx.mcpPublishFence.findUnique({ where: { postId } });
      if (existing && (existing.organizationId !== orgId || existing.revisionHash !== revisionHash)) {
        const attempts = await tx.mcpPublishAttempt.count({ where: { rootPostId: postId } });
        if (attempts) throw new BadRequestException('Publication attempts exist; changing their payload is blocked.');
      }
      await tx.mcpPublishFence.upsert({ where: { postId }, create: { postId, organizationId: orgId, integrationId, revisionHash }, update: { revisionHash, ...(existing?.revisionHash !== revisionHash ? { generation: { increment: 1 }, dispatchState: 'PENDING', dispatchNotBefore: new Date(), dispatchConfirmedAt: null, dispatchErrorCode: null } : {}), ...(existing?.state === 'EDITING' ? { state: 'ACTIVE' } : {}) } });
      await tx.post.update({ where: { id: postId, organizationId: orgId }, data: { mcpWorkflowVersion: 114 } });
    }, { isolationLevel: 'Serializable' });
  }

  async claimMcpSegment(orgId: string, rootPostId: string, segmentPostId: string, revisionHash: string, generation: number) {
    return this._transaction.model.$transaction(async tx => {
      const fence = await tx.mcpPublishFence.findUnique({ where: { postId: rootPostId } });
      if (!fence || fence.organizationId !== orgId || fence.revisionHash !== revisionHash || fence.generation !== generation || fence.state !== 'ACTIVE') throw new BadRequestException('Publication fence is not active for this revision.');
      // A write takes the shared lock, so a simultaneous cancellation cannot pass.
      const locked = await tx.mcpPublishFence.updateMany({ where: { postId: rootPostId, organizationId: orgId, state: 'ACTIVE', revisionHash, generation: fence.generation }, data: { updatedAt: new Date() } });
      if (!locked.count) throw new BadRequestException('Publication fence changed.');
      const prior = await tx.mcpPublishAttempt.findMany({ where: { rootPostId, segmentPostId }, orderBy: { generation: 'desc' } });
      if (prior.some(a => a.revisionHash !== revisionHash)) throw new BadRequestException('Attempt identity has a different payload.');
      const confirmed = prior.find(a => a.status === 'CONFIRMED');
      if (confirmed) return { replay: true as const, receipt: confirmed.receipt, id: confirmed.id };
      if (prior.some(a => a.status !== 'FAILED')) throw new BadRequestException('OUTCOME_UNKNOWN: reconcile the earlier attempt before retry.');
      const segment = await tx.post.findFirst({ where: { id: segmentPostId, organizationId: orgId, state: 'QUEUE', deletedAt: null, releaseId: null, releaseURL: null, integration: { deletedAt: null, disabled: false } } });
      if (!segment) throw new BadRequestException('Segment is not eligible for a new publication.');
      const row = await tx.mcpPublishAttempt.create({ data: { rootPostId, segmentPostId, organizationId: orgId, revisionHash, generation: fence.generation, status: 'STARTED' } });
      return { replay: false as const, receipt: null, id: row.id };
    }, { isolationLevel: 'Serializable' });
  }

  async bindMcpProviderPayload(orgId: string, attemptId: string, payload: any) {
    const providerPayloadHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    return this._transaction.model.$transaction(async tx => {
      const attempt = await tx.mcpPublishAttempt.findFirst({ where: { id: attemptId, organizationId: orgId, status: 'STARTED' } });
      if (!attempt) throw new BadRequestException('Publication attempt is not admitted.');
      const fence = await tx.mcpPublishFence.updateMany({ where: { postId: attempt.rootPostId, organizationId: orgId, revisionHash: attempt.revisionHash, generation: attempt.generation, state: 'ACTIVE' }, data: { updatedAt: new Date() } });
      if (!fence.count || (attempt.providerPayloadHash && attempt.providerPayloadHash !== providerPayloadHash)) throw new BadRequestException('The immutable provider payload changed.');
      await tx.mcpPublishAttempt.update({ where: { id: attemptId }, data: { providerPayloadHash, providerPayload: payload } });
    }, { isolationLevel: 'Serializable' });
  }

  async finishMcpSegment(orgId: string, id: string, receipt: any) {
    return this._transaction.model.$transaction(async tx => {
      const row = await tx.mcpPublishAttempt.findFirst({ where: { id, organizationId: orgId, status: 'STARTED' } });
      if (!row) throw new BadRequestException('OUTCOME_UNKNOWN: attempt ownership lost.');
      const fence = await tx.mcpPublishFence.updateMany({ where: { postId: row.rootPostId, organizationId: orgId, revisionHash: row.revisionHash, generation: row.generation, state: 'ACTIVE' }, data: { updatedAt: new Date() } });
      if (!fence.count || !row.providerPayloadHash || !receipt?.[0]?.postId || receipt[0].id !== row.segmentPostId) throw new BadRequestException('OUTCOME_UNKNOWN: receipt/fence mismatch.');
      await tx.post.update({ where: { id: row.segmentPostId, organizationId: orgId, deletedAt: null }, data: { state: 'PUBLISHED', releaseId: String(receipt[0].postId), releaseURL: String(receipt[0].releaseURL || ''), error: null } });
      await tx.mcpPublishAttempt.update({ where: { id }, data: { status: 'CONFIRMED', receipt, followUpWarning: receipt[0].warning || null } });
    }, { isolationLevel: 'Serializable' });
  }

  // The activity binds the provider payload right before it calls the
  // provider, so an attempt that stopped with no bound payload sent nothing:
  // it FAILED and may be retried. With a bound payload it may have been
  // published, so its outcome is UNKNOWN until it is reconciled.
  async markMcpUnfinished(orgId: string, id: string): Promise<'FAILED' | 'UNKNOWN' | null> {
    return this._transaction.model.$transaction(async tx => {
      const failed = await tx.mcpPublishAttempt.updateMany({ where: { id, organizationId: orgId, status: 'STARTED', providerPayloadHash: null }, data: { status: 'FAILED' } });
      if (failed.count) return 'FAILED';
      const unknown = await tx.mcpPublishAttempt.updateMany({ where: { id, organizationId: orgId, status: 'STARTED' }, data: { status: 'UNKNOWN' } });
      return unknown.count ? 'UNKNOWN' : null;
    }, { isolationLevel: 'Serializable' });
  }

  async unscheduleMcp(orgId: string, rootPostId: string, preserveApproval = false, requireReview = false) {
    return this._transaction.model.$transaction(async tx => {
      await this.assertSaveAdmission(tx, orgId);
      const fence = await tx.mcpPublishFence.findUnique({ where: { postId: rootPostId } });
      if (!fence || fence.organizationId !== orgId) return { status: 'BLOCKED', reason: 'Legacy job has no shared publication fence.' };
      await tx.mcpPublishFence.update({ where: { postId: rootPostId }, data: { updatedAt: new Date() } });
      const attempts = await tx.mcpPublishAttempt.findMany({ where: { rootPostId } });
      if (attempts.some(a => ['STARTED', 'UNKNOWN', 'PENDING'].includes(a.status))) return { status: 'OUTCOME_UNKNOWN', reason: 'An admitted attempt must be reconciled before cancellation.' };
      const root = await tx.post.findFirst({ where: { id: rootPostId, organizationId: orgId, deletedAt: null, parentPostId: null } });
      if (!root) throw new BadRequestException('Post not found.');
      await tx.mcpPublishFence.update({ where: { postId: rootPostId }, data: { state: 'CANCELLED', dispatchState: 'CANCELLED' } });
      const remaining = await tx.post.count({ where: { organizationId: orgId, integrationId: root.integrationId, group: root.group, state: { not: 'PUBLISHED' }, deletedAt: null } });
      if (remaining && root.state === 'PUBLISHED' && (requireReview || ['APPROVED', 'IN_REVIEW'].includes(root.approvalStatus))) await tx.post.update({ where: { id: rootPostId }, data: { approvalStatus: 'IN_REVIEW' } });
      await tx.post.updateMany({ where: { organizationId: orgId, integrationId: root.integrationId, group: root.group, state: { in: ['QUEUE', 'DRAFT', 'ERROR'] }, deletedAt: null, releaseId: null, releaseURL: null }, data: { state: 'DRAFT', ...(preserveApproval ? {} : { approvalStatus: (requireReview || ['APPROVED', 'IN_REVIEW'].includes(root.approvalStatus)) ? 'IN_REVIEW' : 'NONE' }) } });
      const published = attempts.filter(a => a.status === 'CONFIRMED').map(a => a.segmentPostId);
      return { status: published.length ? (remaining ? 'PARTIALLY_UNSCHEDULED' : 'ALREADY_PUBLISHED') : 'UNSCHEDULED', postId: rootPostId, publishedSegmentIds: published };
    }, { isolationLevel: 'Serializable' }).catch(error => { if (error instanceof AgentSaveRecovered) throw error; return ({ status: error instanceof BadRequestException || (error as any)?.code === 'P2034' ? 'BLOCKED' : 'OUTCOME_UNKNOWN', reason: 'The publication state changed or could not be confirmed. Inspect the post before retrying.' }); });
  }

  searchForMissingThreeHoursPosts() {
    return this._post.model.post.findMany({
      where: {
        integration: { ...CHANNEL_READY },
        publishDate: {
          gte: dayjs.utc().subtract(2, 'day').toDate(),
          lt: dayjs.utc().toDate(),
        },
        state: 'QUEUE',
        deletedAt: null,
        parentPostId: null,
      },
      select: {
        id: true,
        organizationId: true,
        integration: {
          select: {
            providerIdentifier: true,
          },
        },
        publishDate: true,
      },
    });
  }

  getOldPosts(orgId: string, date: string) {
    return this._post.model.post.findMany({
      where: {
        // this one used to leave out deletedAt, so it returned the old posts
        // of channels the customer had already removed
        integration: { ...CHANNEL_READY },
        organizationId: orgId,
        publishDate: {
          lte: dayjs(date).toDate(),
        },
        deletedAt: null,
        parentPostId: null,
      },
      orderBy: {
        publishDate: 'desc',
      },
      select: {
        id: true,
        content: true,
        publishDate: true,
        releaseURL: true,
        state: true,
        integration: {
          select: {
            id: true,
            name: true,
            providerIdentifier: true,
            picture: true,
            type: true,
          },
        },
      },
    });
  }

  updateImages(id: string, images: string) {
    return this.updateActivePost(id, { image: images });
  }

  getPostUrls(orgId: string, ids: string[]) {
    return this._post.model.post.findMany({
      where: {
        organizationId: orgId,
        id: {
          in: ids,
        },
      },
      select: {
        id: true,
        releaseURL: true,
      },
    });
  }

  // withPreview adds the media of the posts, for the calendar preview
  async getPosts(orgId: string, query: GetPostsDto, withPreview = false) {
    // Use the provided start and end dates directly
    const startDate = dayjs.utc(query.startDate).toDate();
    const endDate = dayjs.utc(query.endDate).toDate();

    const list = await this._post.model.post.findMany({
      where: {
        AND: [
          {
            OR: [
              {
                organizationId: orgId,
              },
            ],
          },
          {
            OR: [
              {
                publishDate: {
                  gte: startDate,
                  lte: endDate,
                },
              },
              {
                intervalInDays: {
                  not: null,
                },
              },
            ],
          },
        ],
        integration: {
          deletedAt: null,
          organizationId: orgId,
          ...(query.customer ? { customerId: query.customer } : {}),
        },
        deletedAt: null,
        parentPostId: null,
      },
      select: {
        id: true,
        content: true,
        image: withPreview,
        publishDate: true,
        releaseURL: true,
        releaseId: true,
        state: true,
        error: true,
        intervalInDays: true,
        evergreenMaxShares: true,
        evergreenUntil: true,
        group: true,
        creationMethod: true,
        approvalStatus: true,
        agentSource: true,
        settings: true,
        tags: {
          where: {
            tag: {
              deletedAt: null,
            },
          },
          select: {
            tag: true,
          },
        },
        integration: {
          select: {
            id: true,
            providerIdentifier: true,
            name: true,
            picture: true,
          },
        },
      },
    });

    // This runs on the request thread, so keep it linear: push into one array
    // (spreading the accumulator on every post was quadratic and blocked the
    // event loop for seconds on large orgs), and expand repeating posts only
    // inside [startDate, endDate] instead of from their first publish date.
    const result: any[] = [];

    for (const row of list) {
      const post = { ...row, error: curatedPostError(row.error) };
      if (!post.intervalInDays || post.intervalInDays < 1) {
        result.push(post);
        continue;
      }

      // evergreenOccurrences stops after the post's last share, which the
      // plain interval walk upstream uses does not know about, and takes the
      // same rangeStart skip so nothing before the window is built at all
      for (const date of evergreenOccurrences(
        post.publishDate,
        post,
        endDate,
        startDate
      )) {
        result.push({
          ...post,
          publishDate: date,
          actualDate: post.publishDate,
        });
      }
    }

    return result;
  }

  async getPostsList(orgId: string, query: GetPostsListDto) {
    const page = query.page || 0;
    const limit = query.limit || 20;
    const skip = page * limit;

    const stateFilter = query.state || 'all';
    const stateAndDate =
      stateFilter === 'scheduled'
        ? {
            state: State.QUEUE,
          }
        : stateFilter === 'draft'
        ? { state: State.DRAFT }
        : stateFilter === 'published'
        ? { state: State.PUBLISHED }
        : {
            state: {
              in: [State.QUEUE, State.DRAFT, State.PUBLISHED, State.ERROR],
            },
          };

    const orderDirection: 'asc' | 'desc' =
      stateFilter === 'published' ? 'desc' : 'asc';

    const where = {
      AND: [
        {
          OR: [
            {
              organizationId: orgId,
            },
          ],
        },
      ],
      ...stateAndDate,
      // Published posts were already posted (publishDate in the past), so fetch
      // all of them; everything else stays upcoming. Ordering handles the rest.
      ...(stateFilter === 'published'
        ? {}
        : { publishDate: { gte: dayjs.utc().toDate() } }),
      deletedAt: null as Date | null,
      parentPostId: null as string | null,
      intervalInDays: null as number | null,

      integration: {
        deletedAt: null as any,
        organizationId: orgId,
        ...(query.customer
          ? {
              customerId: query.customer,
            }
          : {}),
        ...(query.integrations
          ? {
              id: { in: query.integrations },
            }
          : {}),
      },
      ...(query.tags?.length
        ? {
            tags: {
              some: {
                tagId: { in: query.tags },
                tag: { orgId, deletedAt: null as Date | null },
              },
            },
          }
        : {}),
    };

    const [posts, total] = await Promise.all([
      this._post.model.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          publishDate: orderDirection,
        },
        select: {
          id: true,
          content: true,
          image: true,
          publishDate: true,
          releaseURL: true,
          releaseId: true,
          state: true,
          intervalInDays: true,
          group: true,
          creationMethod: true,
          approvalStatus: true,
          agentSource: true,
          tags: {
            where: {
              tag: {
                deletedAt: null,
              },
            },
            select: {
              tag: true,
            },
          },
          integration: {
            select: {
              id: true,
              providerIdentifier: true,
              name: true,
              picture: true,
            },
          },
        },
      }),
      this._post.model.post.count({ where }),
    ]);

    return {
      posts,
      total,
      page,
      limit,
      hasMore: skip + posts.length < total,
    };
  }

  // failedRootIds: tracked roots a person may delete although an attempt is
  // uncertain, because they failed and no workflow runs for them (see
  // PostsService.deletePost). They must still be in ERROR here.
  async deletePost(orgId: string, group: string, failedRootIds: string[] = []) {
    const tracked = await this._post.model.post.findMany({ where: { organizationId: orgId, group, parentPostId: null, mcpWorkflowVersion: 114, deletedAt: null }, select: { id: true } });
    if (tracked.length) return this._transaction.model.$transaction(async tx => {
      for (const root of [...tracked].sort((a, b) => a.id.localeCompare(b.id))) {
        const fence = await tx.mcpPublishFence.updateMany({ where: { postId: root.id, organizationId: orgId }, data: { updatedAt: new Date() } });
        const uncertain = await tx.mcpPublishAttempt.count({ where: { rootPostId: root.id, status: { in: ['STARTED', 'UNKNOWN', 'PENDING'] } } });
        const failedByPerson = failedRootIds.includes(root.id) && !!(await tx.post.findFirst({ where: { id: root.id, organizationId: orgId, state: 'ERROR', deletedAt: null }, select: { id: true } }));
        if (!fence.count || (uncertain && !failedByPerson)) throw new BadRequestException('This publication is active or uncertain. Reconcile it before deleting; deletion cannot prove it was cancelled.');
        await tx.mcpPublishFence.update({ where: { postId: root.id }, data: { state: 'CANCELLED', dispatchState: 'CANCELLED' } });
      }
      await tx.post.updateMany({ where: { organizationId: orgId, group, deletedAt: null }, data: { deletedAt: new Date() } });
      return { id: tracked[0].id };
    }, { isolationLevel: 'Serializable' });
    await this._post.model.post.updateMany({
      where: {
        organizationId: orgId,
        group,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return this._post.model.post.findFirst({
      where: {
        organizationId: orgId,
        group,
        parentPostId: null,
      },
      select: {
        id: true,
      },
    });
  }

  async getPostsByGroup(orgId: string, group: string) {
    const posts = await this._post.model.post.findMany({
      where: {
        group,
        ...(orgId ? { organizationId: orgId } : {}),
        deletedAt: null,
      },
      include: {
        integration: true,
        tags: {
          where: {
            tag: {
              deletedAt: null,
            },
          },
          select: {
            tag: true,
          },
        },
      },
    });
    return posts.map((post) => decryptIntegrationOf(post));
  }

  // the posts of the other channels in the batch, without the given group
  getPostsByBatch(orgId: string, batchId: string, exceptGroup: string) {
    return this._post.model.post.findMany({
      where: {
        organizationId: orgId,
        batchId,
        group: {
          not: exceptGroup,
        },
        deletedAt: null,
        integration: {
          deletedAt: null,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  // The organization is required, not optional: it is the tenant boundary, and
  // an optional security parameter is one a future caller forgets. A read that
  // deliberately crosses tenants passes PUBLIC_PREVIEW, so it says so at the
  // call site instead of omitting an argument.
  async getPost(
    id: string,
    includeIntegration = false,
    orgId: OrgScope,
    isFirst?: boolean
  ) {
    const post = await this._post.model.post.findUnique({
      where: {
        id,
        ...orgFilter(orgId),
        deletedAt: null,
      },
      include: {
        ...(includeIntegration
          ? {
              integration: true,
              tags: {
                where: {
                  tag: {
                    deletedAt: null,
                  },
                },
                select: {
                  tag: true,
                },
              },
            }
          : {}),
        childrenPost: true,
      },
    });
    return post ? decryptIntegrationOf(post) : post;
  }

  updatePost(id: string, postId: string, releaseURL: string, expectedIntegrationId?: string) {
    return this.updateActivePost(
      id,
      // a post published on a retry must not keep the earlier attempt's error
      { state: 'PUBLISHED', releaseURL, releaseId: postId, error: null },
      expectedIntegrationId ? { integrationId: expectedIntegrationId } : {}
    );
  }

  updateReleaseId(
    id: string,
    orgId: string,
    releaseId: string,
    releaseURL?: string,
    expectedIntegrationId?: string
  ) {
    return this.updateActivePost(
      id,
      {
        releaseId: String(releaseId),
        ...(releaseURL ? { releaseURL } : {}),
      },
      {
        organizationId: orgId,
        releaseId: 'missing',
        ...(expectedIntegrationId ? { integrationId: expectedIntegrationId } : {}),
      }
    );
  }

  updateResolvedRelease(
    id: string,
    orgId: string,
    releaseId: string,
    releaseURL: string,
    expectedIntegrationId?: string
  ) {
    return this.updateActivePost(
      id,
      { releaseId, releaseURL },
      {
        organizationId: orgId,
        ...(expectedIntegrationId ? { integrationId: expectedIntegrationId } : {}),
      }
    );
  }

  changeState(id: string, state: State, err?: any, body?: any) {
    return this.writeState(id, state, err, body);
  }

  async getErrorsByPostIds(postIds: string[]) {
    const errors = await this._errors.model.errors.findMany({
      where: {
        postId: { in: postIds },
      },
      select: {
        message: true,
        platform: true,
        body: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    // rows written before the allowlist can still hold whole post rows
    return errors.map((error) => ({
      ...error,
      body: auditErrorBody(error.body),
    }));
  }

  async changeDate(
    orgId: string,
    id: string,
    date: string,
    isDraft: boolean,
    action: 'schedule' | 'update' = 'schedule'
  ) {
    const data = {
      publishDate: dayjs(date).toDate(),
      // schedule: set state to QUEUE (or DRAFT if it was a draft), the
      // error and release of an earlier attempt no longer describe it
      // update: don't change the state
      ...(action === 'schedule'
        ? {
            state: isDraft ? ('DRAFT' as const) : ('QUEUE' as const),
            error: null,
            releaseId: null,
            releaseURL: null,
          }
        : {}),
    };
    return this._transaction.model.$transaction(async (tx) => {
      const updated = await tx.post.update({
        where: {
          organizationId: orgId,
          id,
        },
        data,
      });
      // the comments of a thread share the main post's date and state, like
      // createOrUpdatePost stores them
      await tx.post.updateMany({
        where: {
          organizationId: orgId,
          group: updated.group,
          integrationId: updated.integrationId,
          deletedAt: null,
          id: { not: id },
        },
        data,
      });
      return updated;
    });
  }

  // Moves a post and its comments to a state together, the comments of a
  // thread publish with the main post. Leaving ERROR clears its error; queued
  // again, the release of an earlier attempt is cleared too, like changeDate.
  // Without `republish` a post published since it was read is left alone.
  async changeGroupState(
    orgId: string,
    post: { group: string; integrationId: string },
    state: 'DRAFT' | 'QUEUE',
    republish = false
  ) {
    const changed = await this._post.model.post.updateMany({
      where: {
        organizationId: orgId,
        group: post.group,
        integrationId: post.integrationId,
        deletedAt: null,
        integration: { deletedAt: null },
        ...(republish ? {} : { state: { not: 'PUBLISHED' as const } }),
      },
      data: {
        state,
        error: null,
        ...(state === 'QUEUE' ? { releaseId: null, releaseURL: null } : {}),
      },
    });
    if (!changed.count) {
      throw new BadRequestException('Post is no longer available.');
    }
    return changed;
  }

  countPostsFromDay(orgId: string, date: Date) {
    return this._post.model.post.count({
      where: {
        organizationId: orgId,
        publishDate: {
          gte: date,
        },
        OR: [
          {
            deletedAt: null,
            state: {
              in: ['QUEUE'],
            },
          },
          {
            state: 'PUBLISHED',
          },
        ],
      },
    });
  }

  // Posts published to one network in a plan month, what its cap counts
  countProviderUsage(
    orgId: string,
    providerIdentifier: string,
    from: Date,
    until: Date
  ) {
    return this._providerPostUsage.model.providerPostUsage.count({
      where: {
        organizationId: orgId,
        providerIdentifier,
        createdAt: {
          gte: from,
          lt: until,
        },
      },
    });
  }

  recordProviderUsage(
    orgId: string,
    providerIdentifier: string,
    postIds: string[]
  ) {
    return this._providerPostUsage.model.providerPostUsage.createMany({
      data: postIds.map((postId) => ({
        organizationId: orgId,
        providerIdentifier,
        postId,
      })),
    });
  }

  // Posts waiting to publish to one network in a plan month, leaving out the
  // posts that are being saved again
  countQueuedProviderPosts(
    orgId: string,
    providerIdentifier: string,
    from: Date,
    until: Date,
    excludeIds: string[] = []
  ) {
    return this._post.model.post.count({
      where: {
        organizationId: orgId,
        deletedAt: null,
        state: 'QUEUE',
        integration: {
          providerIdentifier,
          deletedAt: null,
        },
        publishDate: {
          gte: from,
          lt: until,
        },
        ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
      },
    });
  }

  // Publish dates of one connected account's posts (a network account can be
  // connected in several workspaces), what a provider's postingLimits count:
  // the published posts and, with includeQueued, the queued ones. Comments
  // are not counted, a post deleted after it went out still is
  async getAccountPostingDates(
    providerIdentifier: string,
    internalId: string,
    from: Date,
    until: Date,
    includeQueued: boolean,
    excludeIds: string[] = []
  ) {
    return (
      await this._post.model.post.findMany({
        where: {
          parentPostId: null,
          publishDate: {
            gte: from,
            lt: until,
          },
          integration: {
            providerIdentifier,
            internalId,
          },
          OR: [
            { state: 'PUBLISHED' },
            ...(includeQueued
              ? [{ state: 'QUEUE' as const, deletedAt: null }]
              : []),
          ],
          ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
        },
        select: {
          publishDate: true,
        },
        orderBy: {
          publishDate: 'asc',
        },
      })
    ).map((post) => post.publishDate);
  }

  getPostsState(orgId: string, ids: string[]) {
    if (!ids.length) {
      return Promise.resolve([]);
    }
    return this._post.model.post.findMany({
      where: {
        organizationId: orgId,
        id: { in: ids },
      },
      select: {
        id: true,
        state: true,
        publishDate: true,
        deletedAt: true,
      },
    });
  }

  // Existing draft threads never use upsert: a missed conditional update
  // must conflict, rather than create a new default-QUEUE replacement.
  private async updateAgentDraftThread(tx: Prisma.TransactionClient, orgId: string, date: string, body: PostBody, approvalStatus?: ApprovalStatus, expectedDraftUpdatedAt?: Date) {
      const root = await tx.post.findFirst({ where: {
        id: body.value[0]?.id || '', organizationId: orgId, integrationId: body.integration.id,
        parentPostId: null, deletedAt: null, state: 'DRAFT', releaseId: null,
        ...(expectedDraftUpdatedAt ? { updatedAt: expectedDraftUpdatedAt } : {}),
      } });
      if (!root) throw new BadRequestException('The draft changed. Refresh before editing.');
      const thread = await tx.post.findMany({ where: { organizationId: orgId, integrationId: body.integration.id, group: root.group, deletedAt: null } });
      const ids = body.value.map(value => value.id);
      if (new Set(ids).size !== ids.length || thread.length !== ids.length ||
          thread.some(post => !ids.includes(post.id) || post.state !== 'DRAFT' || post.releaseId)) {
        throw new BadRequestException('The draft thread changed. Refresh before editing.');
      }
      const posts: Post[] = [];
      for (const [index, value] of body.value.entries()) {
        const stored = thread.find(post => post.id === value.id);
        if (!stored || stored.parentPostId !== (index ? body.value[index - 1].id : null)) {
          throw new BadRequestException('The draft thread changed. Refresh before editing.');
        }
        // Updating the root first claims its version and locks it until the
        // entire thread commits. A concurrent approval/schedule cannot cover
        // a partially edited payload; any child failure rolls everything back.
        posts.push(await tx.post.update({ where: {
          id: stored.id, organizationId: orgId, integrationId: body.integration.id,
          deletedAt: null, state: 'DRAFT', releaseId: null, updatedAt: stored.updatedAt,
          parentPostId: stored.parentPostId,
        }, data: {
          publishDate: dayjs(date).toDate(), content: value.content, delay: value.delay || 0,
          image: JSON.stringify(value.image), settings: JSON.stringify(body.settings),
          approvalStatus: ['APPROVED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'REJECTED'].includes(root.approvalStatus)
            ? 'IN_REVIEW' : approvalStatus || root.approvalStatus,
        } }));
      }
      // In-place edits retain the exact stored thread membership and tags.
      // There is no group sweep that could delete an independently scheduled row.
      await this.writeMcpFence(tx, orgId, posts);
      return { previousPost: root.id, posts };
  }

  async createOrUpdatePost(
    state: 'draft' | 'schedule' | 'now' | 'update',
    orgId: string,
    date: string,
    body: PostBody,
    tags: { value: string; label: string }[],
    creationMethod: CreationMethod,
    inter?: number,
    // Keep the existing group instead of rotating it, so open clients
    // (calendar) holding the group stay valid. Used by out-of-band updates
    // (agent / MCP / public API); the dashboard keeps the rotate-and-sweep.
    keepGroup = false,
    // Shared by the posts saved together for several channels, so opening one
    // of them in the editor brings the others.
    batchId?: string,
    // the review state to store (undefined keeps it) and, on create, the
    // agent that created the post
    approval: { approvalStatus?: ApprovalStatus; agentSource?: string; requireExistingDraft?: boolean; expectedDraftUpdatedAt?: Date } = {}
  ) {
    assertAgentPostWrite(orgId, body.integration.id, state);
    const admissionOwner = agentAdmissionContext.getStore()?.orgId === orgId ? agentAdmissionContext.getStore()!.owner : undefined;
    // Serializable only where an agent admission or an MCP publication fence
    // is involved (a fence exists from a tracked post's first save on).
    // Every other save (web, autopost, import, bulk, public API) keeps the
    // default isolation, so it never fails on a serialization race.
    const editedId = body.value?.[0]?.id;
    const serializable = !!admissionOwner || creationMethod === 'MCP' ||
      (!!editedId && !!(await this._transaction.model.$transaction(tx => tx.mcpPublishFence.findUnique({ where: { postId: editedId }, select: { postId: true } }))));
    return this.retrySerializable(() => this._transaction.model.$transaction(async tx => {
      await this.assertSaveAdmission(tx, orgId);
      if (admissionOwner) {
        const live = await tx.mcpAgentAdmission.updateMany({ where: { organizationId: orgId, owner: admissionOwner }, data: { owner: admissionOwner } });
        if (!live.count) throw new AgentSaveRecovered();
      }
      const rootId = body.value?.[0]?.id;
      if (rootId) {
        const fence = await tx.mcpPublishFence.findUnique({ where: { postId: rootId } });
        if (fence) {
          if (fence.organizationId !== orgId) throw new BadRequestException('Post not found.');
          const current = await tx.post.findFirst({ where: { id: rootId, organizationId: orgId }, select: { state: true } });
          if (!current || !['DRAFT', 'QUEUE'].includes(current.state)) throw new BadRequestException('This tracked MCP revision cannot be edited.');
          await tx.mcpPublishFence.update({ where: { postId: rootId }, data: { state: 'EDITING' } });
          if (await tx.mcpPublishAttempt.count({ where: { rootPostId: rootId } })) throw new BadRequestException('A publication attempt exists. Preserve this revision and prepare a new reviewed draft instead.');
        }
      }
    if (agentDraftOnly() && (state === 'update' || approval.requireExistingDraft)) {
      const result = await this.updateAgentDraftThread(tx, orgId, date, body, approval.approvalStatus, approval.expectedDraftUpdatedAt);
      await this.recordAgentWrites(tx, orgId, admissionOwner, result.posts);
      return result;
    }
    const posts: Post[] = [];
    const uuid = uuidv4();
    // keepGroup reuses the client-supplied group only when it already belongs
    // to this organization, so a foreign group id can never be adopted
    const ownsGroup =
      keepGroup && body.group
        ? !!(await tx.post.findFirst({
            where: {
              group: body.group,
              organizationId: orgId,
            },
            select: {
              id: true,
            },
          }))
        : false;
    const group = ownsGroup ? body.group : uuid;

    // an edited post stays in the batch it was created in, even when it is
    // saved on its own or with a group that was rotated since
    const ids = body.value.map((value) => value.id).filter(Boolean);
    const existingBatchId =
      body.group || ids.length
        ? (
            await tx.post.findFirst({
              where: {
                organizationId: orgId,
                deletedAt: null,
                batchId: {
                  not: null,
                },
                OR: [
                  ...(body.group ? [{ group: body.group }] : []),
                  ...(ids.length ? [{ id: { in: ids } }] : []),
                ],
              },
              select: {
                batchId: true,
              },
            })
          )?.batchId
        : undefined;

    for (const value of body.value) {
      const updateData = (type: 'create' | 'update') => ({
        publishDate: dayjs(date).toDate(),
        integration: {
          connect: {
            id: body.integration.id,
            organizationId: orgId,
          },
        },
        ...(posts?.[posts.length - 1]?.id
          ? {
              parentPost: {
                connect: {
                  id: posts[posts.length - 1]?.id,
                },
              },
            }
          : type === 'update'
          ? {
              parentPost: {
                disconnect: true,
              },
            }
          : {}),
        content: value.content,
        delay: value.delay || 0,
        group,
        batchId: existingBatchId || batchId,
        intervalInDays: inter ? +inter : null,
        approvedSubmitForOrder: APPROVED_SUBMIT_FOR_ORDER.NO,
        ...(type === 'create' ? { creationMethod, ...(creationMethod === 'MCP' ? { mcpWorkflowVersion: 114 } : {}) } : {}),
        ...(approval.approvalStatus
          ? { approvalStatus: approval.approvalStatus }
          : {}),
        ...(type === 'create' && approval.agentSource
          ? { agentSource: approval.agentSource }
          : {}),
        ...(state === 'update'
          ? {}
          : {
              state:
                state === 'draft' ? ('DRAFT' as const) : ('QUEUE' as const),
              // no longer failed: the error of an earlier attempt goes
              error: null,
              // queued again: so does the release of an earlier publish,
              // like changeDate on a reschedule
              ...(state === 'draft'
                ? {}
                : { releaseId: null, releaseURL: null }),
            }),
        image: JSON.stringify(value.image),
        settings: JSON.stringify(body.settings),
        organization: {
          connect: {
            id: orgId,
          },
        },
      });

      posts.push(
        await tx.post.upsert({
          where: {
            id: value.id || uuidv4(),
            organizationId: orgId,
            integrationId: body.integration.id,
          },
          create: { ...updateData('create') },
          update: {
            ...updateData('update'),
            lastMessage: {
              disconnect: true,
            },
            submittedForOrder: {
              disconnect: true,
            },
          },
        })
      );

      if (posts.length === 1) {
        await tx.tagsPosts.deleteMany({
          where: {
            post: {
              id: posts[0].id,
            },
          },
        });

        if (tags.length) {
          const tagsList = await tx.tags.findMany({
            where: {
              orgId: orgId,
              deletedAt: null,
              name: {
                in: tags.map((tag) => tag.label).filter((f) => f),
              },
            },
          });

          if (tagsList.length) {
            await tx.post.update({
              where: {
                id: posts[posts.length - 1].id,
              },
              data: {
                tags: {
                  createMany: {
                    data: tagsList.map((tag) => ({
                      tagId: tag.id,
                    })),
                  },
                },
              },
            });
          }
        }
      }
    }

    const previousPost = body.group
      ? (
          await tx.post.findFirst({
            where: {
              group: body.group,
              organizationId: orgId,
              deletedAt: null,
              parentPostId: null,
            },
            select: {
              id: true,
            },
          })
        )?.id!
      : undefined;

    if (body.group && !keepGroup) {
      await tx.post.updateMany({
        where: {
          group: body.group,
          organizationId: orgId,
          deletedAt: null,
        },
        data: {
          parentPostId: null,
          deletedAt: new Date(),
        },
      });
    }

    // keepGroup: the updated rows still carry the old group, so sweep only the
    // rows dropped from it (removed comments) by id instead of by group.
    if (body.group && keepGroup) {
      await tx.post.updateMany({
        where: {
          group: body.group,
          organizationId: orgId,
          deletedAt: null,
          id: {
            notIn: posts.map((p) => p.id),
          },
        },
        data: {
          parentPostId: null,
          deletedAt: new Date(),
        },
      });
    }

    await this.writeMcpFence(tx, orgId, posts);
    await this.recordAgentWrites(tx, orgId, admissionOwner, posts);
    return { previousPost, posts };
    }, serializable ? { isolationLevel: 'Serializable' } : undefined)).catch(error => {
      if (agentDraftOnly() && (state === 'update' || approval.requireExistingDraft) && ['P2025', 'P2034'].includes((error as any)?.code)) throw new BadRequestException('The draft changed. Refresh before editing.');
      throw error;
    });
  }
  // Keeps a post and its comments as a draft until an approver approves it.
  // A failed post held this way is no longer failed, its old error goes.
  holdForReview(orgId: string, group: string) {
    return this._post.model.post.updateMany({
      where: { organizationId: orgId, group, deletedAt: null },
      data: { state: 'DRAFT', approvalStatus: 'IN_REVIEW', error: null },
    });
  }

  async submit(id: string, order: string, buyerOrganizationId: string) {
    return this._post.model.post.update({
      where: {
        id,
      },
      data: {
        submittedForOrderId: order,
        approvedSubmitForOrder: 'WAITING_CONFIRMATION',
        submittedForOrganizationId: buyerOrganizationId,
      },
      select: {
        id: true,
        description: true,
        submittedForOrder: {
          select: {
            messageGroupId: true,
          },
        },
      },
    });
  }

  updateMessage(id: string, messageId: string) {
    return this._post.model.post.update({
      where: {
        id,
      },
      data: {
        lastMessageId: messageId,
      },
    });
  }

  // Optional-feature defaults must not reject an edit of an already saved
  // sequence. Derive its group server-side; caller IDs cannot admit new replies.
  async isExistingPostSequence(orgId: string, integrationId: string, entryIds: string[]) {
    if (entryIds.length < 2 || new Set(entryIds).size !== entryIds.length || entryIds.some(id => !id)) return false;
    const root = await this._post.model.post.findFirst({
      where: { id: entryIds[0], organizationId: orgId, integrationId, parentPostId: null, deletedAt: null },
      select: { group: true },
    });
    if (!root) return false;
    return await this._post.model.post.count({
      where: { organizationId: orgId, integrationId, group: root.group, deletedAt: null, id: { in: entryIds } },
    }) === entryIds.length;
  }

  // The organization is required: see getPost above.
  async getPostById(id: string, org: OrgScope) {
    const post = await this._post.model.post.findUnique({
      where: {
        id,
        ...orgFilter(org),
      },
      include: {
        integration: true,
        submittedForOrder: {
          include: {
            posts: {
              where: {
                state: 'PUBLISHED',
              },
            },
            ordersItems: true,
            seller: {
              select: {
                id: true,
                account: true,
              },
            },
          },
        },
      },
    });
    return post ? decryptIntegrationOf(post) : post;
  }

  private get postTimelineSelect() {
    return {
      id: true,
      state: true,
      publishDate: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      releaseId: true,
      releaseURL: true,
      error: true,
      creationMethod: true,
      group: true,
      parentPostId: true,
    } as const;
  }

  async getPostTimeline(id: string, org: string) {
    const timeline = await this._post.model.post.findFirst({
      where: {
        id,
        organizationId: org,
      },
      select: {
        ...this.postTimelineSelect,
        integration: {
          select: {
            id: true,
            name: true,
            providerIdentifier: true,
            disabled: true,
            refreshNeeded: true,
            deletedAt: true,
          },
        },
        childrenPost: {
          select: this.postTimelineSelect,
          orderBy: { publishDate: 'asc' as const },
        },
        errors: {
          select: {
            id: true,
            platform: true,
            message: true,
            body: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' as const },
        },
      },
    });
    if (!timeline) {
      return timeline;
    }
    // rows written before the allowlist can still hold whole post rows
    return {
      ...timeline,
      errors: timeline.errors.map((error) => ({
        ...error,
        body: auditErrorBody(error.body),
      })),
    };
  }

  findAllExistingCategories() {
    return this._popularPosts.model.popularPosts.findMany({
      select: {
        category: true,
      },
      distinct: ['category'],
    });
  }

  findAllExistingTopicsOfCategory(category: string) {
    return this._popularPosts.model.popularPosts.findMany({
      where: {
        category,
      },
      select: {
        topic: true,
      },
      distinct: ['topic'],
    });
  }

  findPopularPosts(category: string, topic?: string) {
    return this._popularPosts.model.popularPosts.findMany({
      where: {
        category,
        ...(topic ? { topic } : {}),
      },
      select: {
        content: true,
        hook: true,
      },
    });
  }

  createPopularPosts(post: {
    category: string;
    topic: string;
    content: string;
    hook: string;
  }) {
    return this._popularPosts.model.popularPosts.create({
      data: {
        category: 'category',
        topic: 'topic',
        content: 'content',
        hook: 'hook',
      },
    });
  }

  async getPostsCountsByDates(
    orgId: string,
    times: number[],
    date: dayjs.Dayjs
  ) {
    const dates = await this._post.model.post.findMany({
      where: {
        deletedAt: null,
        organizationId: orgId,
        publishDate: {
          in: times.map((time) => {
            return date.clone().add(time, 'minutes').toDate();
          }),
        },
      },
    });

    return times.filter(
      (time) =>
        date.clone().add(time, 'minutes').isAfter(dayjs.utc()) &&
        !dates.find((dateFind) => {
          return (
            dayjs
              .utc(dateFind.publishDate)
              .diff(date.clone().startOf('day'), 'minutes') == time
          );
        })
    );
  }

  // the dates channels already post at, so a bulk schedule skips the time
  // slots that have a post
  getPublishDatesOfIntegrations(
    orgId: string,
    integrationIds: string[],
    from: Date,
    until: Date
  ) {
    return this._post.model.post.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        parentPostId: null,
        integrationId: { in: integrationIds },
        publishDate: { gte: from, lt: until },
      },
      select: {
        integrationId: true,
        publishDate: true,
      },
    });
  }

  getCommentsForPosts(postIds: string[]) {
    return this._comments.model.comments.findMany({
      where: {
        postId: {
          in: postIds,
        },
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            name: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  getCommentById(id: string) {
    return this._comments.model.comments.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        post: {
          select: {
            id: true,
            organizationId: true,
          },
        },
      },
    });
  }

  setCommentResolved(id: string, resolvedAt: Date | null) {
    return this._comments.model.comments.update({
      where: {
        id,
      },
      data: {
        resolvedAt,
      },
    });
  }

  getAnchoredCommentsForPost(postId: string) {
    return this._comments.model.comments.findMany({
      where: {
        postId,
        deletedAt: null,
        anchorStart: {
          not: null,
        },
      },
    });
  }

  detachAnchorsForPost(postId: string, ids: string[]) {
    return this._comments.model.comments.updateMany({
      where: {
        postId,
        id: {
          in: ids,
        },
      },
      data: {
        anchorStart: null,
        anchorEnd: null,
      },
    });
  }

  async getTags(orgId: string) {
    return this._tags.model.tags.findMany({
      where: {
        orgId,
        deletedAt: null,
      },
    });
  }

  createTag(orgId: string, body: CreateTagDto) {
    return this._tags.model.tags.create({
      data: {
        orgId,
        name: body.name,
        color: body.color,
        ...(body.kind ? { kind: body.kind } : {}),
        ...(body.description !== undefined
          ? { description: body.description }
          : {}),
      },
    });
  }

  editTag(id: string, orgId: string, body: CreateTagDto) {
    return this._tags.model.tags.update({
      where: {
        id,
        orgId,
      },
      data: {
        name: body.name,
        color: body.color,
        ...(body.kind ? { kind: body.kind } : {}),
        ...(body.description !== undefined
          ? { description: body.description }
          : {}),
      },
    });
  }

  async deleteTag(id: string, orgId: string) {
    const tag = await this._tags.model.tags.update({
      where: {
        id,
        orgId,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    await this._tagsPosts.model.tagsPosts.deleteMany({
      where: {
        tagId: tag.id,
      },
    });

    return tag;
  }

  createComment(
    orgId: string,
    userId: string | null,
    postId: string,
    content: string,
    extra: {
      displayName?: string;
      parentId?: string;
      anchorStart?: number;
      anchorEnd?: number;
      anchorQuote?: string;
    } = {}
  ) {
    return this._comments.model.comments.create({
      data: {
        organizationId: orgId,
        userId,
        postId,
        content,
        displayName: extra.displayName ?? null,
        parentId: extra.parentId ?? null,
        anchorStart: extra.anchorStart ?? null,
        anchorEnd: extra.anchorEnd ?? null,
        anchorQuote: extra.anchorQuote ?? null,
      },
    });
  }

  async getPostByForWebhookId(postId: string, integrationId: string) {
    const select = {
      id: true,
      content: true,
      publishDate: true,
      releaseURL: true,
      state: true,
      integration: {
        select: {
          id: true,
          name: true,
          providerIdentifier: true,
          picture: true,
          type: true,
        },
      },
    };

    const posts = await this._post.model.post.findMany({
      where: {
        id: postId,
        deletedAt: null,
        parentPostId: null,
      },
      select,
    });

    if (posts.length) {
      return posts;
    }

    // The running workflows pass the platform's post id, which updatePost
    // already stored on the row as releaseId before the webhook is sent.
    return this._post.model.post.findMany({
      where: {
        releaseId: postId,
        integrationId,
        deletedAt: null,
        parentPostId: null,
      },
      orderBy: {
        updatedAt: 'desc' as const,
      },
      take: 1,
      select,
    });
  }

  async getPostsSince(orgId: string, since: string) {
    return this._post.model.post.findMany({
      where: {
        organizationId: orgId,
        publishDate: {
          gte: new Date(since),
        },
        deletedAt: null,
        parentPostId: null,
      },
      select: {
        id: true,
        content: true,
        publishDate: true,
        releaseURL: true,
        state: true,
        integration: {
          select: {
            id: true,
            name: true,
            providerIdentifier: true,
            picture: true,
            type: true,
          },
        },
      },
    });
  }

  // Like changeState, but only while the post is still in one of the expected
  // states: the state check and the write are one conditional updateMany (see
  // updateActivePost), so a run racing another writer - the user, the
  // missing-posts sweep, another run - can never overwrite what that one
  // recorded. A post that is gone or no longer in those states is not a
  // failure, there is just nothing to write: it returns null.
  // A retried activity whose earlier attempt committed but never reported
  // finds the row already in the target state with the same error: that is
  // this write, so it reports it as written (without writing again).
  async changeStateIf(
    id: string,
    expectedStates: State[],
    state: State,
    err?: any,
    body?: any,
    release?: { releaseId: string; releaseURL?: string }
  ) {
    try {
      return await this.writeState(
        id,
        state,
        err,
        body,
        { state: { in: expectedStates } },
        release
      );
    } catch (e) {
      if (!(e instanceof BadRequestException)) {
        throw e;
      }

      return this._post.model.post.findFirst({
        where: {
          id,
          state,
          ...(err
            ? { error: typeof err === 'string' ? err : JSON.stringify(err) }
            : {}),
          deletedAt: null,
          integration: { deletedAt: null },
        },
        select: { id: true },
      });
    }
  }

  private async writeState(
    id: string,
    state: State,
    err?: any,
    body?: any,
    conditions: Prisma.PostWhereInput = {},
    release?: { releaseId: string; releaseURL?: string }
  ) {
    const updated = await this.updateActivePost(
      id,
      {
        state,
        ...(err
          ? { error: typeof err === 'string' ? err : JSON.stringify(err) }
          : // queued again or back to draft: the last failure no longer applies
          state === 'QUEUE' || state === 'DRAFT'
          ? { error: null }
          : {}),
        // a post that went out and then failed keeps where it went out
        ...(release
          ? {
              releaseId: String(release.releaseId),
              ...(release.releaseURL ? { releaseURL: release.releaseURL } : {}),
            }
          : {}),
      },
      conditions,
      true
    );
    if (state === 'ERROR' && err && body) {
      try {
        // Audit logging remains best-effort, but this second transaction must
        // lock and recheck the original channel/post before retaining payloads.
        await this.updateActivePost(
          id,
          { deletedAt: null },
          { integrationId: updated!.integrationId },
          true,
          {
            message: typeof err === 'string' ? err : JSON.stringify(err),
            body: auditErrorBody(body),
          }
        );
      } catch {
        // The state transition committed independently of audit availability.
      }
    }
    return updated;
  }
}
