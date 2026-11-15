import { ForbiddenException } from '@nestjs/common';
import { getContext } from './async.storage';

export type AgentRole = 'ANALYST' | 'DRAFT_ONLY' | 'PUBLISHER';
export type AgentPrincipal = {
  id: string;
  organizationId: string;
  role: AgentRole;
  channelIds: string[] | null;
};
export const agentDraftOnly = () =>
  getContext()?.agentPrincipal?.role === 'DRAFT_ONLY';
export function assertAgentPostWrite(
  orgId: string,
  channelId: string,
  type: string
) {
  const principal = getContext()?.agentPrincipal;
  if (!principal) return;
  if (
    principal.organizationId !== orgId ||
    principal.role === 'ANALYST' ||
    (principal.channelIds !== null &&
      !principal.channelIds.includes(channelId)) ||
    (principal.role === 'DRAFT_ONLY' && !['draft', 'update'].includes(type))
  ) {
    throw new ForbiddenException(
      'This agent credential cannot perform this action.'
    );
  }
}
