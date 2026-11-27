import { Injectable } from '@nestjs/common';
import {
  ADMIN_USERS_PAGE_SIZE,
  AdminStatsRepository,
  GrowthParams,
  ListUsersParams,
  OrgActivityParams,
  StatsParams,
} from '@gitroom/nestjs-libraries/database/prisma/admin-stats/admin-stats.repository';
import { PaymentService } from '@gitroom/nestjs-libraries/services/payment/payment.service';
import {
  WebsiteStatsParams,
  WebsiteStatsService,
} from '@gitroom/nestjs-libraries/services/website.stats.service';

// trialing, a plan someone pays for, a plan an admin gave, a lifetime deal,
// a plan that ended, or never had one
export type AdminUserPlanState =
  | 'trial'
  | 'paying'
  | 'comped'
  | 'lifetime'
  | 'expired'
  | 'none';

export interface AdminUserPlan {
  state: AdminUserPlanState;
  tier: string | null;
  period: string | null;
  // the provider's own status (past_due, ...) of a paying plan
  status: string | null;
  trialDaysLeft: number | null;
  cancelAt: string | null;
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  // LOCAL is email and password, GOOGLE, ...
  signInMethod: string;
  activated: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
  // the newest of: the user row changing (opening the notifications, the
  // settings, a password or email change) and a post created in the workspace
  lastActiveAt: string;
  workspace: {
    // the UserOrganization id, what impersonation takes
    membershipId: string;
    id: string;
    name: string;
    role: string;
    plan: AdminUserPlan;
    channels: number;
    postsScheduled: number;
    postsPublished: number;
  } | null;
  otherWorkspaces: number;
}

export interface AdminUsersResponse {
  items: AdminUserRow[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

type ListedUser = Awaited<
  ReturnType<AdminStatsRepository['listUsers']>
>['users'][number];
type ListedOrganization = ListedUser['organizations'][number]['organization'];

@Injectable()
export class AdminStatsService {
  constructor(
    private _adminStatsRepository: AdminStatsRepository,
    private _paymentService: PaymentService,
    private _websiteStatsService: WebsiteStatsService
  ) {}

  getStats(params: StatsParams) {
    return this._adminStatsRepository.getStats(params);
  }

  getOrgActivity(params: OrgActivityParams) {
    return this._adminStatsRepository.getOrgActivity(params);
  }

  // Sign-ups from our database, trials and revenue from the billing
  // providers, comped plans from our subscriptions (admin set ones are
  // stored under the web provider, like add-subscription does)
  async getGrowth(params: GrowthParams) {
    const [signUps, comped, billing] = await Promise.all([
      this._adminStatsRepository.getSignUps(params),
      this._adminStatsRepository.getCompedSubscriptions(
        this._paymentService.getDefaultProviderName('web')
      ),
      this._paymentService.getGrowthStats(params.from, params.to),
    ]);

    return {
      from: params.from.toISOString(),
      to: params.to.toISOString(),
      signUps,
      comped,
      billing,
    };
  }

  // Visitors of the marketing site from Cloudflare, search from Google
  // Search Console. Each source answers on its own, one that is not set up
  // or can't be reached never hides the other
  async getWebsite(params: WebsiteStatsParams) {
    const [visitors, search] = await Promise.all([
      this._websiteStatsService.getVisitors(params),
      this._websiteStatsService.getSearch(params),
    ]);

    return {
      from: params.from.toISOString(),
      to: params.to.toISOString(),
      visitors,
      search,
    };
  }

  async listUsers(params: ListUsersParams): Promise<AdminUsersResponse> {
    const { users, total } = await this._adminStatsRepository.listUsers(
      params
    );
    const organizationIds = [
      ...new Set(
        users
          .map((user) => user.organizations[0]?.organization.id)
          .filter((id): id is string => !!id)
      ),
    ];
    const posts = await this._adminStatsRepository.getPostsPerState(
      organizationIds
    );
    const adminProvider = this._paymentService.getDefaultProviderName('web');
    const now = Date.now();

    const items = users.map((user): AdminUserRow => {
      const [membership, ...others] = user.organizations;
      const organization = membership?.organization;
      const orgPosts = organization
        ? posts.filter((row) => row.organizationId === organization.id)
        : [];
      const count = (state: string) =>
        orgPosts
          .filter((row) => row.state === state)
          .reduce((sum, row) => sum + row._count._all, 0);
      const lastActive = orgPosts.reduce(
        (latest, row) =>
          row._max.createdAt && row._max.createdAt > latest
            ? row._max.createdAt
            : latest,
        user.updatedAt
      );

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        signInMethod: user.providerName,
        activated: user.activated,
        isSuperAdmin: user.isSuperAdmin,
        createdAt: user.createdAt.toISOString(),
        lastActiveAt: lastActive.toISOString(),
        workspace: organization
          ? {
              membershipId: membership.id,
              id: organization.id,
              name: organization.name,
              role: membership.role,
              plan: this.planOf(organization, adminProvider, now),
              channels: organization._count.Integration,
              postsScheduled: count('QUEUE'),
              postsPublished: count('PUBLISHED'),
            }
          : null,
        otherWorkspaces: others.length,
      };
    });

    return {
      items,
      total,
      page: params.page,
      limit: ADMIN_USERS_PAGE_SIZE,
      hasMore: (params.page + 1) * ADMIN_USERS_PAGE_SIZE < total,
    };
  }

  // Same reading of a workspace as the rest of billing: in a trial while the
  // subscription is trialing (or the flag says its first charge is being
  // retried), an admin plan is stored under the web provider with a member's
  // id as the paymentId, and an ended plan's row is deleted, which also turns
  // allowTrial off (a workspace that never subscribed keeps it)
  private planOf(
    organization: ListedOrganization,
    adminProvider: string,
    now: number
  ): AdminUserPlan {
    const subscription =
      organization.subscription && !organization.subscription.deletedAt
        ? organization.subscription
        : null;
    const plan: AdminUserPlan = {
      state: 'none',
      tier: subscription?.subscriptionTier || null,
      period: subscription?.period || null,
      status: null,
      trialDaysLeft: null,
      cancelAt: subscription?.cancelAt?.toISOString() || null,
    };

    if (!subscription) {
      return {
        ...plan,
        state: organization.allowTrial ? 'none' : 'expired',
      };
    }
    if (subscription.isLifetime) {
      return { ...plan, state: 'lifetime' };
    }
    if (subscription.status === 'trialing' || organization.isTrailing) {
      return {
        ...plan,
        state: 'trial',
        trialDaysLeft: subscription.trialEndsAt
          ? Math.max(
              Math.ceil(
                (subscription.trialEndsAt.getTime() - now) / 86400000
              ),
              0
            )
          : null,
      };
    }
    if (
      subscription.provider === adminProvider &&
      organization.users.some((user) => user.userId === organization.paymentId)
    ) {
      return { ...plan, state: 'comped' };
    }
    return { ...plan, state: 'paying', status: subscription.status };
  }
}
