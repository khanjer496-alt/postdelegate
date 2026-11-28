import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

// What a workspace needs for its plan state (planStateOf), on every read
const workspacePlanSelect = {
  id: true,
  name: true,
  deletedAt: true,
  isTrailing: true,
  allowTrial: true,
  // older admin plans: a member's id as the paymentId (planStateOf)
  paymentId: true,
  users: { select: { userId: true } },
  subscription: {
    select: {
      subscriptionTier: true,
      period: true,
      provider: true,
      identifier: true,
      status: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      cancelAt: true,
      isLifetime: true,
      deletedAt: true,
    },
  },
} satisfies Prisma.OrganizationSelect;

const userSummarySelect = {
  id: true,
  name: true,
  lastName: true,
  email: true,
  providerName: true,
  activated: true,
  createdAt: true,
  lastOnline: true,
  isSuperAdmin: true,
  deletedAt: true,
  organizations: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      organizationId: true,
      role: true,
      disabled: true,
      createdAt: true,
      organization: { select: workspacePlanSelect },
    },
  },
} satisfies Prisma.UserSelect;

export type AdminUserRow = Prisma.UserGetPayload<{
  select: typeof userSummarySelect;
}>;

export type AdminUserCandidate = Prisma.UserGetPayload<{
  select: {
    id: true;
    organizations: {
      select: {
        organizationId: true;
        role: true;
        disabled: true;
        organization: { select: typeof workspacePlanSelect };
      };
    };
  };
}>;

// A channel the customer has to act on: its login expired, or its
// connection never finished. One turned off (by the customer or a plan
// limit) is a choice, not a problem
const channelIssue: Prisma.IntegrationWhereInput = {
  deletedAt: null,
  OR: [{ refreshNeeded: true }, { inBetweenSteps: true }],
};

// Posts as the customer counts them: not deleted, no thread or comment parts
const countedPosts: Prisma.PostWhereInput = {
  deletedAt: null,
  parentPostId: null,
};

@Injectable()
export class AdminUsersRepository {
  constructor(
    private _user: PrismaRepository<'user'>,
    private _organization: PrismaRepository<'organization'>,
    private _userOrganization: PrismaRepository<'userOrganization'>,
    private _integration: PrismaRepository<'integration'>,
    private _post: PrismaRepository<'post'>,
    private _errors: PrismaRepository<'errors'>,
    private _measurementEvent: PrismaRepository<'measurementEvent'>
  ) {}

  // Name or email contains the text (any case), workspace name too, and the
  // ids the owner may paste: user, membership, workspace, Stripe customer,
  // subscription. Deleted users are kept, the list tags them
  private searchWhere(search?: string): Prisma.UserWhereInput {
    const text = search?.trim();
    if (!text) {
      return {};
    }

    return {
      OR: [
        { name: { contains: text, mode: 'insensitive' } },
        { lastName: { contains: text, mode: 'insensitive' } },
        { email: { contains: text, mode: 'insensitive' } },
        { id: text },
        {
          organizations: {
            some: {
              OR: [
                { id: text },
                {
                  organization: {
                    OR: [
                      { name: { contains: text, mode: 'insensitive' } },
                      { id: text },
                      { paymentId: text },
                      { subscription: { is: { identifier: text } } },
                    ],
                  },
                },
              ],
            },
          },
        },
      ],
    };
  }

  // One page of the matching users, newest sign-up first, for the list
  // without a plan filter
  async getUserIdsPage(search: string | undefined, skip: number, take: number) {
    const users = await this._user.model.user.findMany({
      where: this.searchWhere(search),
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip,
      take,
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  countUsers(search?: string) {
    return this._user.model.user.count({ where: this.searchWhere(search) });
  }

  // Every matching user with only what the plan filters read, newest sign-up
  // first. The page itself is loaded with getUsersByIds
  findCandidates(
    search?: string,
    withoutDeleted = false
  ): Promise<AdminUserCandidate[]> {
    return this._user.model.user.findMany({
      where: {
        ...this.searchWhere(search),
        ...(withoutDeleted ? { deletedAt: null } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        organizations: {
          select: {
            organizationId: true,
            role: true,
            disabled: true,
            organization: { select: workspacePlanSelect },
          },
        },
      },
    });
  }

  getUsersByIds(ids: string[]): Promise<AdminUserRow[]> {
    if (!ids.length) {
      return Promise.resolve([]);
    }
    return this._user.model.user.findMany({
      where: { id: { in: ids } },
      select: userSummarySelect,
    });
  }

  getUser(id: string): Promise<AdminUserRow | null> {
    return this._user.model.user.findUnique({
      where: { id },
      select: userSummarySelect,
    });
  }

  // Workspaces with a channel that needs the customer (only a few have one)
  async getWorkspacesWithChannelIssues() {
    const groups = await this._integration.model.integration.groupBy({
      by: ['organizationId'],
      where: channelIssue,
      _count: { _all: true },
    });
    return groups.map((group) => group.organizationId);
  }

  // Failed posts per workspace that were due since the date, of the given
  // workspaces or of every workspace. A post fails when it is due
  async getRecentFailures(since: Date, organizationIds?: string[]) {
    if (organizationIds && !organizationIds.length) {
      return [];
    }
    const groups = await this._post.model.post.groupBy({
      by: ['organizationId'],
      where: {
        ...(organizationIds ? { organizationId: { in: organizationIds } } : {}),
        ...countedPosts,
        state: 'ERROR',
        publishDate: { gte: since },
      },
      _count: { _all: true },
    });
    return groups.map((group) => ({
      organizationId: group.organizationId,
      count: group._count._all,
    }));
  }

  // Live channels per workspace, split by the flags of their status
  async getChannelCounts(organizationIds: string[]) {
    if (!organizationIds.length) {
      return [];
    }
    const groups = await this._integration.model.integration.groupBy({
      by: ['organizationId', 'disabled', 'refreshNeeded', 'inBetweenSteps'],
      where: { organizationId: { in: organizationIds }, deletedAt: null },
      _count: { _all: true },
    });
    return groups.map((group) => ({
      organizationId: group.organizationId,
      disabled: group.disabled,
      refreshNeeded: group.refreshNeeded,
      inBetweenSteps: group.inBetweenSteps,
      count: group._count._all,
    }));
  }

  async getPostCounts(organizationIds: string[]) {
    if (!organizationIds.length) {
      return [];
    }
    const groups = await this._post.model.post.groupBy({
      by: ['organizationId', 'state'],
      where: { organizationId: { in: organizationIds }, ...countedPosts },
      _count: { _all: true },
      _max: { createdAt: true },
    });
    return groups.map((group) => ({
      organizationId: group.organizationId,
      state: group.state,
      count: group._count._all,
      lastCreatedAt: group._max.createdAt,
    }));
  }

  // The parts of a workspace only the user page shows
  getWorkspaceExtra(organizationId: string) {
    return this._organization.model.organization.findUnique({
      where: { id: organizationId },
      select: {
        createdAt: true,
        paymentId: true,
        subscription: {
          select: {
            provider: true,
            totalChannels: true,
            createdAt: true,
          },
        },
      },
    });
  }

  getChannelPictures(organizationId: string) {
    return this._integration.model.integration.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true, picture: true, customName: true },
    });
  }

  getRecentPosts(organizationId: string, take: number) {
    return this._post.model.post.findMany({
      where: { organizationId, ...countedPosts },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        state: true,
        publishDate: true,
        createdAt: true,
        content: true,
        error: true,
        releaseURL: true,
        integration: {
          select: {
            name: true,
            providerIdentifier: true,
            picture: true,
          },
        },
      },
    });
  }

  getRecentErrors(organizationId: string, take: number) {
    return this._errors.model.errors.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        message: true,
        platform: true,
        createdAt: true,
        postId: true,
      },
    });
  }

  getTeamMembers(organizationId: string) {
    return this._userOrganization.model.userOrganization.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
      select: {
        role: true,
        disabled: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            lastName: true,
            email: true,
            deletedAt: true,
          },
        },
      },
    });
  }

  // The workspace's measured milestones, one row per kind, network and
  // failure category (a kind like publication is recorded once per post),
  // and where the workspace came
  // from: every event carries the workspace's first touch, the first one
  // stands for them all
  async getJourney(organizationId: string) {
    const [kinds, first] = await Promise.all([
      this._measurementEvent.model.measurementEvent.groupBy({
        by: ['kind', 'provider', 'reason'],
        where: { organizationId },
        _min: { occurredAt: true },
        _max: { occurredAt: true },
        _count: { _all: true },
      }),
      this._measurementEvent.model.measurementEvent.findFirst({
        where: { organizationId },
        orderBy: { occurredAt: 'asc' },
        select: {
          source: true,
          medium: true,
          campaign: true,
          internalOrTest: true,
        },
      }),
    ]);
    return {
      first,
      kinds: kinds.map((group) => ({
        kind: group.kind,
        provider: group.provider,
        reason: group.reason,
        firstAt: group._min.occurredAt,
        lastAt: group._max.occurredAt,
        count: group._count._all,
      })),
    };
  }
}
