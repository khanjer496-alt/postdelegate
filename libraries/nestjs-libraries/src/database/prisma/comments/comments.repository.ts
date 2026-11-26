import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

// Keyword auto-reply rules of the comments view (PD_FF_COMMENTS). Every owner
// query is scoped to one organization; the poller reads by channel id.
@Injectable()
export class CommentsRepository {
  constructor(
    private _rule: PrismaRepository<'commentReplyRule'>,
    private _autoReply: PrismaRepository<'commentAutoReply'>
  ) {}

  rules(orgId: string, integrationId: string, postId?: string) {
    return this._rule.model.commentReplyRule.findMany({
      where: {
        organizationId: orgId,
        integrationId,
        ...(postId ? { postId } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  activeRules(integrationId: string) {
    return this._rule.model.commentReplyRule.findMany({
      where: {
        integrationId,
        active: true,
        integration: { deletedAt: null },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  getRule(orgId: string, id: string) {
    return this._rule.model.commentReplyRule.findFirst({
      where: { id, organizationId: orgId },
    });
  }

  createRule(
    orgId: string,
    data: { integrationId: string; postId: string; keyword: string; reply: string }
  ) {
    return this._rule.model.commentReplyRule.create({
      data: { organizationId: orgId, ...data },
    });
  }

  updateRule(orgId: string, id: string, data: { active: boolean }) {
    return this._rule.model.commentReplyRule.updateMany({
      where: { id, organizationId: orgId },
      data,
    });
  }

  deleteRule(orgId: string, id: string) {
    return this._rule.model.commentReplyRule.deleteMany({
      where: { id, organizationId: orgId },
    });
  }

  answered(integrationId: string, commentIds: string[]) {
    return this._autoReply.model.commentAutoReply.findMany({
      where: { integrationId, commentId: { in: commentIds } },
      select: { commentId: true, status: true },
    });
  }

  // null when another run already claimed the comment
  async claim(integrationId: string, ruleId: string, commentId: string) {
    try {
      return await this._autoReply.model.commentAutoReply.create({
        data: { integrationId, ruleId, commentId },
        select: { id: true },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return null;
      }
      throw err;
    }
  }

  finish(id: string, status: 'replied' | 'failed', replyId: string | null) {
    return this._autoReply.model.commentAutoReply.update({
      where: { id },
      data: { status, replyId },
      select: { id: true },
    });
  }
}
