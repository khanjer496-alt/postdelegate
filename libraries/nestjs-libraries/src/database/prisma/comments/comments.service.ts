import {
  BadRequestException,
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import dayjs from 'dayjs';
import { Integration } from '@prisma/client';
import { TemporalService } from 'nestjs-temporal-core';
import { TypedSearchAttributes } from '@temporalio/common';
import { CommentsRepository } from '@gitroom/nestjs-libraries/database/prisma/comments/comments.repository';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { RefreshIntegrationService } from '@gitroom/nestjs-libraries/integrations/refresh.integration.service';
import { isChannelReady } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.state';
import { organizationId } from '@gitroom/nestjs-libraries/temporal/temporal.search.attribute';
import { PostComment } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';

export const commentsEnabled = () =>
  ['on', 'optin'].includes((process.env.PD_FF_COMMENTS || '').trim().toLowerCase());

export const COMMENT_POSTS_LIMIT = 12;
// a burst of matching comments is answered over several runs
const MAX_AUTO_REPLIES_PER_RUN = 10;
// older comments are never auto-answered, so a poller that was stopped for a
// while (channel off, flag off) never sends a backlog of replies
export const MAX_COMMENT_AGE_MS = 60 * 60 * 1000;
// a poller whose channel token stays expired this long stops
const STALE_TOKEN_MS = 24 * 60 * 60 * 1000;
// the poller checks every 10 seconds for this long after a rule is saved,
// then every minute (see commentRulesWorkflowV1)
const FAST_POLLING_MS = 2 * 60 * 60 * 1000;

interface RuleLike {
  id: string;
  postId: string;
  keyword: string;
  active: boolean;
  createdAt: Date;
  activeSince?: Date | null;
}

// The rule a comment triggers: on the rule's post, written after the rule
// was last turned on (Instagram timestamps have no milliseconds) and within
// the last hour, not by the channel itself, and containing the keyword in
// any case
export const matchingRule = <T extends RuleLike>(
  rules: T[],
  postId: string,
  comment: PostComment,
  now = Date.now()
) => {
  if (comment.own) return undefined;
  const text = (comment.text || '').toLowerCase();
  const written = new Date(comment.createdAt).getTime();
  if (!(written >= now - MAX_COMMENT_AGE_MS)) return undefined;
  return rules.find((rule) => {
    const keyword = rule.keyword.trim().toLowerCase();
    return (
      rule.active &&
      rule.postId === postId &&
      !!keyword &&
      written >= dayjs(rule.activeSince || rule.createdAt).startOf('second').valueOf() &&
      text.includes(keyword)
    );
  });
};

// The comments view and keyword auto-replies (PD_FF_COMMENTS). The platform
// calls go through the channel's provider (commentPosts, postComments,
// replyToComment, commentReply, hideComment, deleteComment), so any provider
// that implements them gets the view.
@Injectable()
export class CommentsService {
  constructor(
    private _commentsRepository: CommentsRepository,
    @Inject(forwardRef(() => IntegrationService))
    private _integrationService: IntegrationService,
    private _integrationManager: IntegrationManager,
    @Inject(forwardRef(() => RefreshIntegrationService))
    private _refreshIntegrationService: RefreshIntegrationService,
    private _temporalService: TemporalService
  ) {}

  private provider(integration: Integration) {
    if (integration.type !== 'social') return undefined;
    const provider = this._integrationManager.getSocialIntegration(
      integration.providerIdentifier
    );
    return provider?.postComments &&
      provider?.replyToComment &&
      provider.commentsAvailable !== false
      ? provider
      : undefined;
  }

  // the channel, its provider and a current token; a token that can't be
  // refreshed leaves the channel as it is, the view only shows an error
  private async channel(orgId: string, integrationId: string) {
    const integration = await this._integrationService.getIntegrationById(
      orgId,
      integrationId
    );
    const provider = integration && isChannelReady(integration)
      ? this.provider(integration)
      : undefined;
    if (!integration || !provider) {
      throw new NotFoundException('Channel not found');
    }
    if (dayjs(integration.tokenExpiration).isBefore(dayjs())) {
      const data = await this._refreshIntegrationService.refresh(
        integration,
        '',
        true
      );
      if (!data || !data.accessToken) {
        throw new HttpException(
          'Reconnect the channel to read its comments',
          HttpStatus.CONFLICT
        );
      }
      integration.token = data.accessToken;
    }
    return { integration, provider };
  }

  async channels(orgId: string) {
    const list = await this._integrationService.getIntegrationsList(orgId);
    return list
      .filter((integration) => isChannelReady(integration) && this.provider(integration))
      .map((integration) => ({
        id: integration.id,
        name: integration.name,
        picture: integration.picture,
        identifier: integration.providerIdentifier,
      }));
  }

  async posts(orgId: string, integrationId: string) {
    const { integration, provider } = await this.channel(orgId, integrationId);
    if (!provider.commentPosts) return [];
    return provider.commentPosts(
      integration.internalId,
      integration.token,
      COMMENT_POSTS_LIMIT
    );
  }

  // the post's comments, newest first, with its rules and what they answered.
  // Rules run on what was just read, so an open view answers right away too.
  async comments(orgId: string, integrationId: string, postId: string) {
    const { integration, provider } = await this.channel(orgId, integrationId);
    const comments = await provider.postComments!(
      integration.internalId,
      integration.token,
      postId
    );
    const rules = await this._commentsRepository.rules(orgId, integrationId, postId);
    await this.answer(integration, provider, rules, postId, comments);
    const answered = await this._commentsRepository.answered(
      integrationId,
      comments.map((comment) => comment.id)
    );
    return {
      comments: [...comments].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
      rules,
      autoReplies: Object.fromEntries(
        answered.map((row) => [row.commentId, row.status])
      ),
    };
  }

  async reply(orgId: string, integrationId: string, commentId: string, message: string) {
    const text = (message || '').trim();
    if (!text) throw new BadRequestException('Write a reply first');
    const { integration, provider } = await this.channel(orgId, integrationId);
    return provider.replyToComment!(
      integration.internalId,
      integration.token,
      commentId,
      text
    );
  }

  async hide(orgId: string, integrationId: string, commentId: string, hide: boolean) {
    const { integration, provider } = await this.channel(orgId, integrationId);
    if (!provider.hideComment) throw new BadRequestException('Not supported');
    await provider.hideComment(integration.internalId, integration.token, commentId, hide);
    return { hidden: hide };
  }

  async remove(orgId: string, integrationId: string, commentId: string) {
    const { integration, provider } = await this.channel(orgId, integrationId);
    if (!provider.deleteComment) throw new BadRequestException('Not supported');
    await provider.deleteComment(integration.internalId, integration.token, commentId);
    return { deleted: true };
  }

  async createRule(
    orgId: string,
    integrationId: string,
    postId: string,
    body: { keyword: string; reply: string }
  ) {
    const keyword = (body.keyword || '').trim();
    const reply = (body.reply || '').trim();
    if (!keyword || !reply) {
      throw new BadRequestException('A rule needs a keyword and a reply');
    }
    const integration = await this._integrationService.getIntegrationById(orgId, integrationId);
    if (!integration || !isChannelReady(integration) || !this.provider(integration)) {
      throw new NotFoundException('Channel not found');
    }
    const rule = await this._commentsRepository.createRule(orgId, {
      integrationId,
      postId,
      keyword,
      reply,
    });
    await this.startPoller(orgId, integrationId);
    return rule;
  }

  async setRuleActive(orgId: string, id: string, active: boolean) {
    const rule = await this._commentsRepository.getRule(orgId, id);
    if (!rule) throw new NotFoundException('Rule not found');
    await this._commentsRepository.updateRule(orgId, id, {
      active,
      ...(active ? { activeSince: new Date(Date.now()) } : {}),
    });
    if (active) await this.startPoller(orgId, rule.integrationId);
    return { ...rule, active };
  }

  // the poller stops by itself once the channel has no active rule left
  async deleteRule(orgId: string, id: string) {
    await this._commentsRepository.deleteRule(orgId, id);
    return { deleted: true };
  }

  // One poll of a channel (commentRulesWorkflowV1). False stops the poller:
  // no active rule left, or the channel is gone, off or needs a reconnect.
  async runRules(integrationId: string) {
    // turning the flag off stops the pollers too, not only the view and the
    // API; saving or re-enabling a rule starts one again
    if (!commentsEnabled()) return false;
    const rules = await this._commentsRepository.activeRules(integrationId);
    if (!rules.length) return false;
    let channel: Awaited<ReturnType<CommentsService['channel']>>;
    try {
      channel = await this.channel(rules[0].organizationId, integrationId);
    } catch (err) {
      // gone, off or waiting for a reconnect: saving a rule starts it again.
      // A token refresh that failed (409) may be a passing outage, so the
      // poller keeps going, until the token has been expired for a day.
      if (err instanceof NotFoundException) return false;
      const stored = await this._integrationService.getIntegrationById(
        rules[0].organizationId,
        integrationId
      );
      return (
        !!stored &&
        dayjs(stored.tokenExpiration).valueOf() > Date.now() - STALE_TOKEN_MS
      );
    }
    const { integration, provider } = channel;
    let budget = MAX_AUTO_REPLIES_PER_RUN;
    for (const postId of [...new Set(rules.map((rule) => rule.postId))]) {
      if (budget <= 0) break;
      try {
        const comments = await provider.postComments!(
          integration.internalId,
          integration.token,
          postId
        );
        budget -= await this.answer(integration, provider, rules, postId, comments, budget);
      } catch (err) {
        console.error('comment rules: reading comments failed', integrationId, postId);
      }
    }
    return true;
  }

  // claims each new matching comment before replying, so a comment is
  // answered once however many runs see it; returns how many it answered
  private async answer(
    integration: Integration,
    provider: NonNullable<ReturnType<CommentsService['provider']>>,
    rules: Awaited<ReturnType<CommentsRepository['rules']>>,
    postId: string,
    comments: PostComment[],
    budget = MAX_AUTO_REPLIES_PER_RUN
  ) {
    let answered = 0;
    for (const comment of comments) {
      if (answered >= budget) break;
      const rule = matchingRule(rules, postId, comment);
      if (!rule) continue;
      const claim = await this._commentsRepository.claim(
        integration.organizationId,
        integration.id,
        rule.id,
        comment.id
      );
      if (!claim) continue;
      answered++;
      try {
        const { id } = await provider.replyToComment!(
          integration.internalId,
          integration.token,
          comment.id,
          rule.reply
        );
        await this._commentsRepository.finish(claim.id, 'replied', id || null);
      } catch (err) {
        console.error('comment rules: reply failed', integration.id, comment.id);
        // a reply that failed may still have gone out (a 5xx or a dropped
        // connection after the platform created it), so it is recorded as
        // replied when the channel's reply is there
        const sent = await this.sentReply(integration, provider, comment.id, rule.reply);
        await this._commentsRepository.finish(
          claim.id,
          sent ? 'replied' : 'failed',
          sent?.id || null
        );
      }
    }
    return answered;
  }

  // the channel's own reply with this text under the comment, when the
  // provider can look it up; a failed lookup counts as no reply
  private async sentReply(
    integration: Integration,
    provider: NonNullable<ReturnType<CommentsService['provider']>>,
    commentId: string,
    message: string
  ) {
    if (!provider.commentReply) return undefined;
    try {
      return await provider.commentReply(
        integration.internalId,
        integration.token,
        commentId,
        message
      );
    } catch (err) {
      return undefined;
    }
  }

  // A channel that is back (reconnected, or turned on again) polls its active
  // rules again: a poller stops for good while its channel is off or needs a
  // reconnect. A poller that is still running is kept as it is, so a repeated
  // reconnect never starts a second one. Runs after the channel was saved,
  // also from billing webhooks, so it never throws.
  async restartPollers(orgId: string, integrationId?: string) {
    if (!commentsEnabled()) return;
    try {
      const channels = await this._commentsRepository.activeRuleChannels(
        orgId,
        integrationId
      );
      for (const channel of channels) {
        await this.startPoller(orgId, channel.integrationId, true);
      }
    } catch (err) {
      console.error('comment rules: could not restart the pollers', orgId);
    }
  }

  // a fresh poller with a new fast-polling window; the old one, if any, is
  // replaced. `restart` keeps a running poller (USE_EXISTING) and polls every
  // minute, saving a rule is what opens the fast window.
  async startPoller(orgId: string, integrationId: string, restart = false) {
    try {
      await this._temporalService.client
        .getRawClient()
        ?.workflow.start('commentRulesWorkflowV1', {
          workflowId: `comment-rules-${integrationId}`,
          taskQueue: 'main',
          args: [
            {
              integrationId,
              fastUntil: restart ? Date.now() : Date.now() + FAST_POLLING_MS,
            },
          ],
          workflowIdConflictPolicy: restart ? 'USE_EXISTING' : 'TERMINATE_EXISTING',
          typedSearchAttributes: new TypedSearchAttributes([
            { key: organizationId, value: orgId },
          ]),
        });
      return true;
    } catch (err) {
      // the open comments view still answers while it polls
      console.error('comment rules: could not start the poller', integrationId);
      return false;
    }
  }
}
