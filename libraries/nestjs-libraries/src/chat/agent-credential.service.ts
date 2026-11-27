import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { AgentCredentialRepository } from '../database/prisma/agent-credentials/agent.credential.repository';
import { CreateAgentCredentialDto } from '../dtos/settings/agent.credential.dto';
import { getContext } from './async.storage';
import { ApprovalPolicyService } from '../database/prisma/approvals/approval.policy.service';
import { AgentPrincipal } from './agent-credential.policy';

const digest = (secret: string) =>
  createHash('sha256').update(secret).digest('hex');
const denied = () =>
  new ForbiddenException('This agent credential cannot perform this action.');
const reads = new Set([
  'integrationList',
  'integrationSchema',
  'postsListTool',
  'analyticsMetricsTool',
  'analyticsTopPostsTool',
  'bestTimeToPostTool',
  'channelAnalyticsTool',
  'postPreflightTool',
  'resultsToReviewedDraftsTool',
]);
const drafts = new Set([
  'integrationSchedulePostTool',
  'schedulePostTool',
  'createPostForReviewTool',
  'sendPostForReviewTool',
  'postUpdateTool',
  'postSettingsTool',
]);
const publisher = new Set([
  'deletePostTool',
  'postUnscheduleTool',
  'postResumeTool',
  'triggerTool',
  'uploadFromUrlTool',
]);
@Injectable()
export class AgentCredentialService {
  constructor(
    private repo: AgentCredentialRepository,
    private policy: ApprovalPolicyService
  ) {}
  list(orgId: string) {
    return this.repo.list(orgId);
  }
  revoke(orgId: string, id: string) {
    return this.repo.revoke(orgId, id);
  }
  async create(orgId: string, body: CreateAgentCredentialDto) {
    if (
      !body.name?.trim() ||
      body.name.length > 80 ||
      (body.role !== undefined &&
        !['ANALYST', 'DRAFT_ONLY', 'PUBLISHER'].includes(body.role)) ||
      (body.expiry !== undefined &&
        !['DEFAULT', 'CUSTOM', 'NEVER'].includes(body.expiry))
    )
      throw new BadRequestException('Invalid credential settings.');
    const expiresAt =
      body.expiry === 'NEVER'
        ? null
        : body.expiry === 'CUSTOM'
        ? new Date(body.expiresAt || '')
        : new Date(Date.now() + 30 * 86400000);
    if (expiresAt && (!Number.isFinite(+expiresAt) || +expiresAt <= Date.now()))
      throw new BadRequestException('Choose a future expiry.');
    if (body.channelIds === null)
      throw new BadRequestException(
        'Choose explicit channels or omit the restriction.'
      );
    const channelIds = body.channelIds === undefined ? null : body.channelIds;
    if (
      channelIds !== null &&
      (!Array.isArray(channelIds) ||
        channelIds.some((id) => typeof id !== 'string') ||
        channelIds.length > 200 ||
        (await this.repo.channels(orgId, [...new Set(channelIds)])).length !==
          new Set(channelIds).size)
    )
      throw new BadRequestException('Choose channels from this workspace.');
    const secret = 'mca_' + randomBytes(32).toString('hex');
    const credential = await this.repo.create({
      organizationId: orgId,
      name: body.name.trim(),
      role: body.role || 'DRAFT_ONLY',
      expiresAt,
      secretHash: digest(secret),
      ...(channelIds === null ? {} : { channelIds }),
    });
    return { credential, secret };
  }
  private active(row: any) {
    return (
      !!row &&
      !row.revokedAt &&
      (!row.expiresAt || +new Date(row.expiresAt) > Date.now())
    );
  }
  async resolve(secret: string) {
    if (!/^mca_[a-f0-9]{64}$/.test(secret)) return null;
    const row = await this.repo.byHash(digest(secret));
    return this.active(row) && !row.organization.deletedAt
      ? { organization: row.organization, credentialId: row.id }
      : null;
  }
  async principal(): Promise<AgentPrincipal | undefined> {
    const ctx = getContext();
    if (ctx?.authKind === 'agent' && !ctx.agentCredentialId) throw denied();
    if (!ctx?.agentCredentialId) return undefined;
    const row = await this.repo.byId(ctx.agentCredentialId);
    if (
      !this.active(row) ||
      row.organizationId !== ctx.auth?.id ||
      row.organization?.deletedAt
    )
      throw denied();
    const ids = row.channelIds;
    if (
      ids !== null &&
      (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string'))
    )
      throw denied();
    const principal = {
      id: row.id,
      organizationId: row.organizationId,
      role: row.role,
      channelIds: ids as string[] | null,
    };
    ctx.agentPrincipal = principal;
    return principal;
  }
  async authorizeTool(name: string, input: any) {
    const p = await this.principal();
    if (!p) return input;
    if (name === 'ask_postdelegate') return input; // nested tools re-enter this boundary
    if (
      !reads.has(name) &&
      !(p.role !== 'ANALYST' && drafts.has(name)) &&
      !(p.role === 'PUBLISHER' && publisher.has(name))
    )
      throw denied();
    if (
      p.role === 'DRAFT_ONLY' &&
      ['integrationSchedulePostTool', 'schedulePostTool'].includes(name) &&
      (!input.socialPost?.length ||
        input.socialPost.some((post: any) => post.type !== 'draft'))
    )
      throw denied();
    const ids: string[] = [
      ...(input.integrationIds || []),
      ...(input.integrationId ? [input.integrationId] : []),
      ...(input.socialPost || []).map((post: any) => post.integrationId),
    ];
    if (
      [
        'postUpdateTool',
        'postSettingsTool',
        'sendPostForReviewTool',
        'deletePostTool',
        'postUnscheduleTool',
        'postResumeTool',
        'channelAnalyticsTool',
      ].includes(name) &&
      (input.id || input.postId)
    ) {
      const post = await this.repo.post(
        p.organizationId,
        input.id || input.postId
      );
      if (
        !post ||
        (!reads.has(name) && post.parentPostId) ||
        (p.role === 'DRAFT_ONLY' &&
          drafts.has(name) &&
          (post.state !== 'DRAFT' || post.releaseId))
      )
        throw denied();
      ids.push(post.integrationId);
    }
    if (
      ids.some((id) => typeof id !== 'string') ||
      (ids.length &&
        (await this.repo.channels(p.organizationId, [...new Set(ids)]))
          .length !== new Set(ids).size)
    )
      throw denied();
    if (p.channelIds !== null && ids.some((id) => !p.channelIds!.includes(id)))
      throw denied();
    if (!reads.has(name)) {
      await this.policy.assertAgentGuardrails(
        p.organizationId,
        { type: 'agent', source: 'MCP agent' },
        ids,
        { countsTowardLimit: false }
      );
    }
    if (p.channelIds !== null) {
      // Workspace totals cannot be faithfully filtered after aggregation.
      if (name === 'analyticsMetricsTool') throw denied();
      if (['analyticsTopPostsTool', 'bestTimeToPostTool'].includes(name)) {
        if (!p.channelIds.length) throw denied();
        return {
          ...input,
          integrationIds: input.integrationIds?.length
            ? input.integrationIds
            : p.channelIds,
        };
      }
    }
    return input;
  }
  wrapTool(name: string, tool: any) {
    const execute = tool.execute.bind(tool);
    tool.execute = async (input: any, context: any) => {
      const ctx = getContext();
      if (
        !ctx &&
        (context?.mcp || context?.requestContext?.get('mcpAgentCredential'))
      )
        throw denied();
      if (ctx?.agentCredentialId)
        context?.requestContext?.set('mcpAgentCredential', true);
      const checked = await this.authorizeTool(name, input);
      if (getContext()?.agentPrincipal && name === 'channelAnalyticsTool') {
        // Legacy live analytics may refresh/persist credentials or provider
        // results. A credential READ must never enter that mutation path.
        return {
          output: {
            status: 'UNKNOWN',
            reason:
              'Live network analytics are unavailable for agent credentials because this path may refresh credentials or persist provider data. Use analyticsMetricsTool, analyticsTopPostsTool or bestTimeToPostTool for stored history.',
          },
        };
      }
      const result = await execute(checked, context);
      const p = getContext()?.agentPrincipal;
      if (
        p?.channelIds !== null &&
        p?.channelIds &&
        ['integrationList', 'postsListTool'].includes(name) &&
        Array.isArray(result?.output)
      ) {
        return {
          ...result,
          output: result.output.filter((item: any) =>
            p.channelIds!.includes(
              name === 'integrationList' ? item.id : item.integrationId
            )
          ),
        };
      }
      if (
        p?.channelIds !== null &&
        p?.channelIds &&
        name === 'postsListTool' &&
        Array.isArray(result?.output?.posts)
      ) {
        return {
          ...result,
          output: {
            ...result.output,
            posts: result.output.posts.filter((post: any) =>
              p.channelIds!.includes(post.integrationId)
            ),
          },
        };
      }
      return result;
    };
    return tool;
  }
}
