import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import {
  AdminUserCandidate,
  AdminUserRow,
  AdminUsersRepository,
} from '@gitroom/nestjs-libraries/database/prisma/admin-users/admin-users.repository';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { PaymentService } from '@gitroom/nestjs-libraries/services/payment/payment.service';
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
  | 'comped'
  | 'unpaid'
  | 'no_plan'
  | 'ended';

interface PlanSource {
  isTrailing: boolean;
  allowTrial: boolean;
  paymentId?: string | null;
  users?: { userId: string }[];
  subscription: {
    provider?: string;
    identifier: string | null;
    status: string | null;
    trialEndsAt: Date | null;
    cancelAt: Date | null;
    isLifetime: boolean;
    deletedAt: Date | null;
  } | null;
}

// Provider statuses of a subscription that grants no paid plan right now
const NOT_PAID = ['incomplete', 'incomplete_expired', 'unpaid', 'paused', 'canceled'];

// The plan state of a workspace in words the admin pages show, the only
// place it is derived. Ended subscriptions are deleted rows, so a workspace
// without one that has allowTrial off had a plan once: only a stored
// subscription turns allowTrial off (see endedTrialFlags in the
// subscription repository). A plan a super admin set has an `admin_`
// identifier and nobody pays for it (addSubscription); older ones are
// stored under the web provider (`adminProvider`) with a member's id as the
// workspace's paymentId, like getCompedSubscriptions reads them. In a trial like
// billing reads it: the provider has it trialing, or it is not active yet
// and its trial is still running or the workspace is flagged trialing (the
// first charge after the trial being retried). A trial with a cancel date
// is still a trial, the cancel date shows next to it. A plan with no
// provider status yet (rows from before it was stored) is read as paying
export const planStateOf = (
  workspace: PlanSource,
  now = new Date(),
  adminProvider?: string
): PlanState => {
  const subscription = workspace.subscription;
  if (!subscription || subscription.deletedAt) {
    return subscription || !workspace.allowTrial ? 'ended' : 'no_plan';
  }
  if (subscription.isLifetime) {
    return 'lifetime';
  }
  if (
    subscription.identifier?.startsWith('admin_') ||
    (!!adminProvider &&
      subscription.provider === adminProvider &&
      !!workspace.paymentId &&
      !!workspace.users?.some((user) => user.userId === workspace.paymentId))
  ) {
    return 'comped';
  }
  if (
    subscription.status === 'trialing' ||
    (subscription.status !== 'active' &&
      ((!!subscription.trialEndsAt && subscription.trialEndsAt > now) ||
        workspace.isTrailing))
  ) {
    return 'trialing';
  }
  if (subscription.cancelAt) {
    return 'cancelling';
  }
  if (subscription.status && NOT_PAID.includes(subscription.status)) {
    return 'unpaid';
  }
  return 'paying';
};

// A plan someone has right now
const LIVE_PLANS: PlanState[] = [
  'trialing',
  'paying',
  'cancelling',
  'lifetime',
  'comped',
];

export interface WorkspaceSignals {
  deleted: boolean;
  // the user owns it (and still has access): a team member is not the
  // customer, so their workspaces never count for them in the filters
  owner: boolean;
  plan: PlanState;
  status: string | null;
  trialEndsAt: Date | null;
  channelIssues: boolean;
  failedRecently: boolean;
}

export const isOwnerOf = (member: { role: string; disabled: boolean }) =>
  member.role === 'SUPERADMIN' && !member.disabled;

export const TRIAL_ENDING_DAYS = 2;
export const RECENT_FAILURE_DAYS = 7;

// Something the admin should look at: a channel to reconnect, a post that
// failed this week, a payment that failed, or a trial about to end.
// Deleted workspaces never do
export const workspaceNeedsAttention = (
  workspace: WorkspaceSignals,
  now = new Date()
) =>
  !workspace.deleted &&
  (workspace.channelIssues ||
    workspace.failedRecently ||
    workspace.plan === 'unpaid' ||
    workspace.status === 'past_due' ||
    (workspace.plan === 'trialing' &&
      !!workspace.trialEndsAt &&
      workspace.trialEndsAt <=
        dayjs(now).add(TRIAL_ENDING_DAYS, 'day').toDate()));

// A user matches when one of the live workspaces they own does, so a paying
// workspace counts once, for its owner. "No plan" is the other way round:
// none of them has a plan right now (team members only are there too)
export const userMatchesFilter = (
  workspaces: WorkspaceSignals[],
  filter: AdminUserFilter,
  now = new Date()
) => {
  const live = workspaces.filter(
    (workspace) => !workspace.deleted && workspace.owner
  );
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
// (UsersService.updateLastOnline). Still within a minute of the sign-up:
// never seen since
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

// Before lastOnline was written (or for a user not seen since), the newest
// post created in a live workspace they own stands in for their activity
export const lastPostOf = (
  memberships: {
    organizationId: string;
    role: string;
    disabled: boolean;
    organization: { deletedAt: Date | null };
  }[],
  posts: { organizationId: string; lastCreatedAt: Date | null }[]
) => {
  const owned = new Set(
    memberships
      .filter(
        (member) => isOwnerOf(member) && !member.organization.deletedAt
      )
      .map((member) => member.organizationId)
  );
  return posts.reduce<Date | null>(
    (latest, group) =>
      owned.has(group.organizationId) &&
      group.lastCreatedAt &&
      (!latest || group.lastCreatedAt > latest)
        ? group.lastCreatedAt
        : latest,
    null
  );
};

const shorten = (value: string | null, length: number) =>
  value && value.length > length ? `${value.slice(0, length - 1)}…` : value;

// The readable part of a stored error (often a serialized error object),
// cut to `length`
export const errorTextOf = (message: string | null, length: number) => {
  if (!message) {
    return null;
  }
  let text = message;
  try {
    const parsed = JSON.parse(message);
    if (typeof parsed === 'string') text = parsed;
    else if (typeof parsed?.message === 'string') text = parsed.message;
    else if (typeof parsed?.error === 'string') text = parsed.error;
  } catch {
    // not JSON, kept as stored
  }
  return shorten(text, length);
};

// Where a channel stands, what the customer has to fix first
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
// workspaces of the user page read at the same time
const WORKSPACE_BATCH = 3;

const fullName = (user: { name: string | null; lastName: string | null }) =>
  [user.name, user.lastName].filter(Boolean).join(' ') || null;

const planOf = (
  organization: AdminUserRow['organizations'][number]['organization'],
  now: Date,
  adminProvider: string
) => ({
  state: planStateOf(organization, now, adminProvider),
  tier: organization.subscription?.subscriptionTier || null,
  period: organization.subscription?.period || null,
  status: organization.subscription?.status || null,
  trialEndsAt: organization.subscription?.trialEndsAt || null,
  currentPeriodEnd: organization.subscription?.currentPeriodEnd || null,
  cancelAt: organization.subscription?.cancelAt || null,
});

type WorkspaceSummary = Awaited<
  ReturnType<AdminUsersService['summaries']>
>[number]['workspaces'][number];

@Injectable()
export class AdminUsersService {
  constructor(
    private _adminUsersRepository: AdminUsersRepository,
    private _integrationService: IntegrationService,
    private _paymentService: PaymentService
  ) {}

  // the provider admin plans are stored under (add-subscription)
  private adminProvider() {
    return this._paymentService.getDefaultProviderName('web');
  }

  // The workspaces that need attention for a reason only the database knows
  // (channels, failed posts), read for all workspaces: only a few have one.
  // The plan's reasons are in the plan
  private async attentionSignals(now: Date) {
    const since = dayjs(now).subtract(RECENT_FAILURE_DAYS, 'day').toDate();
    const [channelIssues, failures] = await Promise.all([
      this._adminUsersRepository.getWorkspacesWithChannelIssues(),
      this._adminUsersRepository.getRecentFailures(since),
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
        ({ organizationId, organization, ...member }) => ({
          deleted: !!organization.deletedAt,
          owner: isOwnerOf(member),
          plan: planStateOf(organization, now, this.adminProvider()),
          status: organization.subscription?.status || null,
          trialEndsAt: organization.subscription?.trialEndsAt || null,
          channelIssues: !!attention?.channelIssues.has(organizationId),
          failedRecently: !!attention?.failedRecently.has(organizationId),
        })
      ),
    }));
  }

  async list(query: AdminUsersListDto) {
    const now = new Date();
    const filter = query.filter || 'all';
    const page = query.page || 1;
    const limit = query.limit || 25;

    // no plan filter: the database pages the list
    if (filter === 'all') {
      const [ids, total] = await Promise.all([
        this._adminUsersRepository.getUserIdsPage(
          query.search,
          (page - 1) * limit,
          limit
        ),
        this._adminUsersRepository.countUsers(query.search),
      ]);
      return {
        items: await this.summaries(ids, now),
        total,
        page,
        limit,
        hasMore: page * limit < total,
      };
    }

    // a plan filter reads the state derived from each plan, in memory
    const candidates = await this._adminUsersRepository.findCandidates(
      query.search
    );
    const attention =
      filter === 'needs_attention'
        ? await this.attentionSignals(now)
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

  // The number of users behind each filter, with no search. Deleted users
  // are left out (the list still finds them, tagged)
  async summary() {
    const now = new Date();
    const candidates = await this._adminUsersRepository.findCandidates(
      undefined,
      true
    );
    const attention = await this.attentionSignals(now);
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
  async summaries(ids: string[], now: Date) {
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
    const adminProvider = this.adminProvider();
    const [channels, posts, failures] = await Promise.all([
      this._adminUsersRepository.getChannelCounts(organizationIds),
      this._adminUsersRepository.getPostCounts(organizationIds),
      this._adminUsersRepository.getRecentFailures(since, organizationIds),
    ]);

    const channelsOf = (organizationId: string) => {
      const groups = channels.filter(
        (group) => group.organizationId === organizationId
      );
      const total = (...statuses: string[]) =>
        groups
          .filter((group) => statuses.includes(channelStatusOf(group)))
          .reduce((sum, group) => sum + group.count, 0);
      return {
        active: total('connected'),
        needsAttention: total('needs_reconnect', 'setup_unfinished'),
        disabled: total('disabled'),
      };
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
      lastActive:
        lastActiveOf(user) || lastPostOf(user.organizations, posts),
      isSuperAdmin: user.isSuperAdmin,
      deletedAt: user.deletedAt,
      // live workspaces first, the ones they own first, then in the order
      // the user joined
      workspaces: [...user.organizations]
        .sort(
          (a, b) =>
            Number(!!a.organization.deletedAt) -
              Number(!!b.organization.deletedAt) ||
            Number(!isOwnerOf(a)) - Number(!isOwnerOf(b))
        )
        .map((member) => ({
          userOrganizationId: member.id,
          organizationId: member.organizationId,
          name: member.organization.name,
          role: member.role,
          disabled: member.disabled,
          deletedAt: member.organization.deletedAt,
          plan: planOf(member.organization, now, adminProvider),
          channels: channelsOf(member.organizationId),
          posts: postsOf(member.organizationId),
        })),
    }));
  }

  // Everything about one workspace the user owns, for the user page
  private async workspaceDetail(workspace: WorkspaceSummary) {
    const organizationId = workspace.organizationId;
    const [extra, health, pictures, posts, errors, team, journey] =
      await Promise.all([
        this._adminUsersRepository.getWorkspaceExtra(organizationId),
        this._integrationService.getChannelHealth(organizationId),
        this._adminUsersRepository.getChannelPictures(organizationId),
        this._adminUsersRepository.getRecentPosts(organizationId, RECENT_POSTS),
        this._adminUsersRepository.getRecentErrors(
          organizationId,
          RECENT_ERRORS
        ),
        this._adminUsersRepository.getTeamMembers(organizationId),
        this._adminUsersRepository.getJourney(organizationId),
      ]);
    const pictureOf = new Map(pictures.map((item) => [item.id, item]));

    return {
      ...workspace,
      full: true as const,
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
          lastError: errorTextOf(channel.lastError, 300),
        })),
      recentPosts: posts.map((post) => ({
        id: post.id,
        state: post.state,
        publishDate: post.publishDate,
        createdAt: post.createdAt,
        preview: contentPreviewOf(post.content),
        error: errorTextOf(post.error, 300),
        url: post.releaseURL,
        channel: post.integration,
      })),
      recentErrors: errors.map((error) => ({
        ...error,
        message: errorTextOf(error.message, 500),
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
      journey: {
        from: journey.first
          ? {
              source: journey.first.source,
              medium: journey.first.medium,
              campaign: journey.first.campaign,
            }
          : null,
        internalOrTest: !!journey.first?.internalOrTest,
        // in the order each milestone first happened
        events: [...journey.kinds].sort(
          (a, b) =>
            (a.firstAt?.getTime() || 0) - (b.firstAt?.getTime() || 0)
        ),
      },
    };
  }

  // Everything about one user, null when there is no such user. Only the
  // live workspaces the user owns are read in full, a few at a time: the
  // others (deleted, or where they are a team member) keep their summary
  async getUser(id: string) {
    const now = new Date();
    const [summary] = await this.summaries([id], now);
    if (!summary) {
      return null;
    }

    const workspaces = [];
    for (let i = 0; i < summary.workspaces.length; i += WORKSPACE_BATCH) {
      workspaces.push(
        ...(await Promise.all(
          summary.workspaces
            .slice(i, i + WORKSPACE_BATCH)
            .map((workspace) =>
              !workspace.deletedAt && isOwnerOf(workspace)
                ? this.workspaceDetail(workspace)
                : Promise.resolve({ ...workspace, full: false as const })
            )
        ))
      );
    }

    return { ...summary, workspaces };
  }
}
