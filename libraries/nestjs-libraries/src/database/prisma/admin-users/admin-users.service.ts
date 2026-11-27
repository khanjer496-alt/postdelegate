import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import {
  AdminUserCandidate,
  AdminUserRow,
  AdminUsersRepository,
} from '@gitroom/nestjs-libraries/database/prisma/admin-users/admin-users.repository';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { stripHtmlValidation } from '@gitroom/helpers/utils/strip.html.validation';
import {
  AdminUserFilter,
  AdminUsersListDto,
} from '@gitroom/nestjs-libraries/dtos/admin-users/admin.users.list.dto';

export type PlanState =
  | 'trialing'
  | 'paying'
  | 'cancelling'
  | 'lifetime'
  | 'no_plan'
  | 'ended';

interface PlanSource {
  isTrailing: boolean;
  allowTrial: boolean;
  subscription: {
    status: string | null;
    trialEndsAt: Date | null;
    cancelAt: Date | null;
    isLifetime: boolean;
    deletedAt: Date | null;
  } | null;
}

// The plan state of a workspace in words the admin pages show, the only
// place it is derived. Ended subscriptions are deleted rows, so a workspace
// without one that has allowTrial off had a plan once: only a stored
// subscription turns allowTrial off (see endedTrialFlags in the
// subscription repository). In a trial like billing reads it: the provider
// has it trialing, its trial is still running, or the workspace is flagged
// trialing (the first charge after the trial being retried) and the
// provider does not have it active
export const planStateOf = (
  workspace: PlanSource,
  now = new Date()
): PlanState => {
  const subscription = workspace.subscription;
  if (!subscription || subscription.deletedAt) {
    return subscription || !workspace.allowTrial ? 'ended' : 'no_plan';
  }
  if (subscription.isLifetime) {
    return 'lifetime';
  }
  if (subscription.cancelAt) {
    return 'cancelling';
  }
  if (
    subscription.status === 'trialing' ||
    (!!subscription.trialEndsAt && subscription.trialEndsAt > now) ||
    (workspace.isTrailing && subscription.status !== 'active')
  ) {
    return 'trialing';
  }
  return 'paying';
};

// A plan someone has right now
const LIVE_PLANS: PlanState[] = ['trialing', 'paying', 'cancelling', 'lifetime'];

export interface WorkspaceSignals {
  deleted: boolean;
  plan: PlanState;
  trialEndsAt: Date | null;
  channelIssues: boolean;
  failedRecently: boolean;
}

export const TRIAL_ENDING_DAYS = 2;
export const RECENT_FAILURE_DAYS = 7;

// Something the admin should look at: a channel to reconnect, a post that
// failed this week, or a trial about to end. Deleted workspaces never do
export const workspaceNeedsAttention = (
  workspace: WorkspaceSignals,
  now = new Date()
) =>
  !workspace.deleted &&
  (workspace.channelIssues ||
    workspace.failedRecently ||
    (workspace.plan === 'trialing' &&
      !!workspace.trialEndsAt &&
      workspace.trialEndsAt <=
        dayjs(now).add(TRIAL_ENDING_DAYS, 'day').toDate()));

// A user matches when one of their live workspaces does. "No plan" is the
// other way round: none of their live workspaces has a plan right now
export const userMatchesFilter = (
  workspaces: WorkspaceSignals[],
  filter: AdminUserFilter,
  now = new Date()
) => {
  const live = workspaces.filter((workspace) => !workspace.deleted);
  switch (filter) {
    case 'trialing':
    case 'paying':
    case 'cancelling':
      return live.some((workspace) => workspace.plan === filter);
    case 'no_plan':
      return !live.some((workspace) => LIVE_PLANS.includes(workspace.plan));
    case 'needs_attention':
      return live.some((workspace) => workspaceNeedsAttention(workspace, now));
    default:
      return true;
  }
};

// lastOnline starts at the sign-up time and is bumped by the app's requests
// (UsersService.updateLastOnline). Still at its sign-up value: never seen
export const lastActiveOf = (user: { createdAt: Date; lastOnline: Date }) =>
  Math.abs(user.lastOnline.getTime() - user.createdAt.getTime()) < 60000
    ? null
    : user.lastOnline;

// Plain text of a post for a one-line preview
export const contentPreviewOf = (content: string, length = 140) => {
  const text = stripHtmlValidation('none', content || '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
};

const shorten = (value: string | null, length: number) =>
  value && value.length > length ? `${value.slice(0, length - 1)}…` : value;

// Where a channel stands, the first thing the customer has to fix first
export const channelStatusOf = (channel: {
  disabled: boolean;
  refreshNeeded: boolean;
  inBetweenSteps: boolean;
}) =>
  channel.inBetweenSteps
    ? 'setup_unfinished'
    : channel.refreshNeeded
    ? 'needs_reconnect'
    : channel.disabled
    ? 'disabled'
    : 'connected';

const RECENT_POSTS = 10;
const RECENT_ERRORS = 10;
const JOURNEY_EVENTS = 200;

const fullName = (user: { name: string | null; lastName: string | null }) =>
  [user.name, user.lastName].filter(Boolean).join(' ') || null;

const planOf = (
  organization: AdminUserRow['organizations'][number]['organization'],
  now: Date
) => ({
  state: planStateOf(organization, now),
  tier: organization.subscription?.subscriptionTier || null,
  period: organization.subscription?.period || null,
  status: organization.subscription?.status || null,
  trialEndsAt: organization.subscription?.trialEndsAt || null,
  currentPeriodEnd: organization.subscription?.currentPeriodEnd || null,
  cancelAt: organization.subscription?.cancelAt || null,
});

@Injectable()
export class AdminUsersService {
  constructor(
    private _adminUsersRepository: AdminUsersRepository,
    private _integrationService: IntegrationService
  ) {}

  // The workspaces of these users that need attention for a reason only the
  // database knows (channels, failed posts). The trial end is in the plan
  private async attentionSignals(organizationIds: string[], now: Date) {
    const since = dayjs(now).subtract(RECENT_FAILURE_DAYS, 'day').toDate();
    const [channelIssues, failures] = await Promise.all([
      this._adminUsersRepository.getWorkspacesWithChannelIssues(
        organizationIds
      ),
      this._adminUsersRepository.getRecentFailures(organizationIds, since),
    ]);
    return {
      channelIssues: new Set(channelIssues),
      failedRecently: new Set(failures.map((failure) => failure.organizationId)),
    };
  }

  private signalsOf(
    candidates: AdminUserCandidate[],
    now: Date,
    attention?: { channelIssues: Set<string>; failedRecently: Set<string> }
  ) {
    return candidates.map((candidate) => ({
      id: candidate.id,
      workspaces: candidate.organizations.map(
        ({ organizationId, organization }) => ({
          deleted: !!organization.deletedAt,
          plan: planStateOf(organization, now),
          trialEndsAt: organization.subscription?.trialEndsAt || null,
          channelIssues: !!attention?.channelIssues.has(organizationId),
          failedRecently: !!attention?.failedRecently.has(organizationId),
        })
      ),
    }));
  }

  private organizationIdsOf(candidates: AdminUserCandidate[]) {
    return [
      ...new Set(
        candidates.flatMap((candidate) =>
          candidate.organizations.map((member) => member.organizationId)
        )
      ),
    ];
  }

  async list(query: AdminUsersListDto) {
    const now = new Date();
    const filter = query.filter || 'all';
    const page = query.page || 1;
    const limit = query.limit || 25;

    const candidates = await this._adminUsersRepository.findCandidates(
      query.search
    );
    const attention =
      filter === 'needs_attention'
        ? await this.attentionSignals(this.organizationIdsOf(candidates), now)
        : undefined;
    const matched = this.signalsOf(candidates, now, attention).filter((user) =>
      userMatchesFilter(user.workspaces, filter, now)
    );

    const ids = matched
      .slice((page - 1) * limit, page * limit)
      .map((user) => user.id);

    return {
      items: await this.summaries(ids, now),
      total: matched.length,
      page,
      limit,
      hasMore: page * limit < matched.length,
    };
  }

  // The number of users behind each filter, with no search
  async summary() {
    const now = new Date();
    const candidates = await this._adminUsersRepository.findCandidates();
    const attention = await this.attentionSignals(
      this.organizationIdsOf(candidates),
      now
    );
    const users = this.signalsOf(candidates, now, attention);
    const count = (filter: AdminUserFilter) =>
      users.filter((user) => userMatchesFilter(user.workspaces, filter, now))
        .length;

    return {
      total: users.length,
      trialing: count('trialing'),
      paying: count('paying'),
      cancelling: count('cancelling'),
      noPlan: count('no_plan'),
      needsAttention: count('needs_attention'),
    };
  }

  // One row per user, in the order of the ids, with the counts of each of
  // their workspaces read in a few grouped queries for the whole page
  private async summaries(ids: string[], now: Date) {
    const users = await this._adminUsersRepository.getUsersByIds(ids);
    const byId = new Map(users.map((user) => [user.id, user]));
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((user): user is AdminUserRow => !!user);

    const organizationIds = [
      ...new Set(
        ordered.flatMap((user) =>
          user.organizations.map((member) => member.organizationId)
        )
      ),
    ];
    const since = dayjs(now).subtract(RECENT_FAILURE_DAYS, 'day').toDate();
    const [channels, posts, failures] = await Promise.all([
      this._adminUsersRepository.getChannelCounts(organizationIds),
      this._adminUsersRepository.getPostCounts(organizationIds),
      this._adminUsersRepository.getRecentFailures(organizationIds, since),
    ]);

    const channelsOf = (organizationId: string) => {
      const groups = channels.filter(
        (group) => group.organizationId === organizationId
      );
      const total = (needsAttention: boolean) =>
        groups
          .filter((group) => group.needsAttention === needsAttention)
          .reduce((sum, group) => sum + group.count, 0);
      return { active: total(false), needsAttention: total(true) };
    };
    const postsOf = (organizationId: string) => {
      const total = (state: string) =>
        posts.find(
          (group) =>
            group.organizationId === organizationId && group.state === state
        )?.count || 0;
      return {
        scheduled: total('QUEUE'),
        published: total('PUBLISHED'),
        failed: total('ERROR'),
        failedLast7d:
          failures.find((group) => group.organizationId === organizationId)
            ?.count || 0,
      };
    };

    return ordered.map((user) => ({
      id: user.id,
      name: fullName(user),
      email: user.email,
      providerName: user.providerName,
      activated: user.activated,
      createdAt: user.createdAt,
      lastActive: lastActiveOf(user),
      isSuperAdmin: user.isSuperAdmin,
      deletedAt: user.deletedAt,
      // live workspaces first, each group in the order the user joined
      workspaces: [...user.organizations]
        .sort(
          (a, b) =>
            Number(!!a.organization.deletedAt) -
            Number(!!b.organization.deletedAt)
        )
        .map((member) => ({
          userOrganizationId: member.id,
          organizationId: member.organizationId,
          name: member.organization.name,
          role: member.role,
          disabled: member.disabled,
          deletedAt: member.organization.deletedAt,
          plan: planOf(member.organization, now),
          channels: channelsOf(member.organizationId),
          posts: postsOf(member.organizationId),
        })),
    }));
  }

  // Everything about one user, null when there is no such user
  async getUser(id: string) {
    const now = new Date();
    const [summary] = await this.summaries([id], now);
    if (!summary) {
      return null;
    }

    const workspaces = await Promise.all(
      summary.workspaces.map(async (workspace) => {
        const [extra, health, pictures, posts, errors, team, journey] =
          await Promise.all([
            this._adminUsersRepository.getWorkspaceExtra(
              workspace.organizationId
            ),
            this._integrationService.getChannelHealth(workspace.organizationId),
            this._adminUsersRepository.getChannelPictures(
              workspace.organizationId
            ),
            this._adminUsersRepository.getRecentPosts(
              workspace.organizationId,
              RECENT_POSTS
            ),
            this._adminUsersRepository.getRecentErrors(
              workspace.organizationId,
              RECENT_ERRORS
            ),
            this._adminUsersRepository.getTeamMembers(workspace.organizationId),
            this._adminUsersRepository.getJourney(
              workspace.organizationId,
              JOURNEY_EVENTS
            ),
          ]);
        const pictureOf = new Map(pictures.map((item) => [item.id, item]));

        return {
          ...workspace,
          createdAt: extra?.createdAt || null,
          stripeCustomerId: extra?.paymentId || null,
          subscription: extra?.subscription
            ? {
                ...workspace.plan,
                provider: extra.subscription.provider,
                totalChannels: extra.subscription.totalChannels,
                createdAt: extra.subscription.createdAt,
              }
            : null,
          channelList: health
            .filter((channel) => !channel.deletedAt)
            .map((channel) => ({
              id: channel.id,
              name: pictureOf.get(channel.id)?.customName || channel.name,
              providerIdentifier: channel.providerIdentifier,
              picture: pictureOf.get(channel.id)?.picture || null,
              status: channelStatusOf(channel),
              tokenExpiration: channel.tokenExpiration,
              createdAt: channel.createdAt,
              lastPublishedAt: channel.lastPublishedAt,
              lastPublishedUrl: channel.lastPublishedUrl,
              lastErrorAt: channel.lastErrorAt,
              lastError: shorten(channel.lastError, 300),
            })),
          recentPosts: posts.map((post) => ({
            id: post.id,
            state: post.state,
            publishDate: post.publishDate,
            createdAt: post.createdAt,
            preview: contentPreviewOf(post.content),
            error: shorten(post.error, 300),
            url: post.releaseURL,
            channel: post.integration,
          })),
          recentErrors: errors.map((error) => ({
            ...error,
            message: shorten(error.message, 500),
          })),
          team: team.map((member) => ({
            userId: member.user.id,
            name: fullName(member.user),
            email: member.user.email,
            role: member.role,
            disabled: member.disabled,
            deletedAt: member.user.deletedAt,
            joinedAt: member.createdAt,
          })),
          journey,
        };
      })
    );

    return { ...summary, workspaces };
  }
}
