// the real integration service pulls in every social provider
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service',
  () => ({ IntegrationService: class {} })
);

import {
  AdminUsersService,
  contentPreviewOf,
  lastActiveOf,
  planStateOf,
  userMatchesFilter,
  WorkspaceSignals,
  workspaceNeedsAttention,
} from '@gitroom/nestjs-libraries/database/prisma/admin-users/admin-users.service';

const now = new Date('2026-11-28T12:00:00Z');
const inDays = (days: number) => new Date(now.getTime() + days * 86400000);

const subscription = (over: object = {}) => ({
  identifier: 'sub_123',
  status: 'active',
  trialEndsAt: null,
  cancelAt: null,
  isLifetime: false,
  deletedAt: null,
  ...over,
});

const workspace = (over: object = {}) => ({
  isTrailing: false,
  allowTrial: false,
  subscription: subscription(),
  ...over,
});

describe('planStateOf', () => {
  it('reads a workspace that never subscribed as no plan', () => {
    expect(
      planStateOf(
        { isTrailing: true, allowTrial: true, subscription: null },
        now
      )
    ).toBe('no_plan');
  });

  it('reads a workspace whose subscription is gone as ended', () => {
    // ended subscriptions are deleted rows, allowTrial is off once one existed
    expect(planStateOf(workspace({ subscription: null }), now)).toBe('ended');
    expect(
      planStateOf(
        workspace({
          allowTrial: true,
          subscription: subscription({ deletedAt: inDays(-1) }),
        }),
        now
      )
    ).toBe('ended');
  });

  it('reads lifetime before anything else on the plan', () => {
    expect(
      planStateOf(
        workspace({
          subscription: subscription({
            isLifetime: true,
            cancelAt: inDays(3),
            status: null,
          }),
        }),
        now
      )
    ).toBe('lifetime');
  });

  it('reads a plan with a cancel date as cancelling, even in its trial', () => {
    expect(
      planStateOf(
        workspace({
          isTrailing: true,
          subscription: subscription({
            status: 'trialing',
            cancelAt: inDays(3),
          }),
        }),
        now
      )
    ).toBe('cancelling');
  });

  it('reads a trial like billing does', () => {
    expect(
      planStateOf(
        workspace({ subscription: subscription({ status: 'trialing' }) }),
        now
      )
    ).toBe('trialing');
    // a trial end still ahead
    expect(
      planStateOf(
        workspace({
          subscription: subscription({ status: null, trialEndsAt: inDays(2) }),
        }),
        now
      )
    ).toBe('trialing');
    // the first charge after the trial being retried
    expect(
      planStateOf(
        workspace({
          isTrailing: true,
          subscription: subscription({ status: 'past_due' }),
        }),
        now
      )
    ).toBe('trialing');
    // a row stored before the provider status existed
    expect(
      planStateOf(
        workspace({
          isTrailing: true,
          subscription: subscription({ status: null }),
        }),
        now
      )
    ).toBe('trialing');
  });

  it('reads a plan an admin set as comped, not paying', () => {
    expect(
      planStateOf(
        workspace({
          subscription: subscription({ identifier: 'admin_ab12c', status: null }),
        }),
        now
      )
    ).toBe('comped');
  });

  it('reads a subscription that grants nothing as unpaid', () => {
    for (const status of ['incomplete', 'unpaid', 'paused', 'canceled']) {
      expect(
        planStateOf(workspace({ subscription: subscription({ status }) }), now)
      ).toBe('unpaid');
    }
  });

  it('reads an active plan as paying, even with a trial flag lagging behind', () => {
    expect(planStateOf(workspace(), now)).toBe('paying');
    expect(planStateOf(workspace({ isTrailing: true }), now)).toBe('paying');
    expect(
      planStateOf(
        workspace({ subscription: subscription({ trialEndsAt: inDays(2) }) }),
        now
      )
    ).toBe('paying');
    // a renewal being retried is still a paying customer
    expect(
      planStateOf(workspace({ subscription: subscription({ status: 'past_due' }) }), now)
    ).toBe('paying');
    // a row from before the provider status was stored
    expect(
      planStateOf(workspace({ subscription: subscription({ status: null }) }), now)
    ).toBe('paying');
    expect(
      planStateOf(
        workspace({
          subscription: subscription({ trialEndsAt: inDays(-1) }),
        }),
        now
      )
    ).toBe('paying');
  });
});

const signals = (over: Partial<WorkspaceSignals> = {}): WorkspaceSignals => ({
  deleted: false,
  owner: true,
  plan: 'paying',
  status: 'active',
  trialEndsAt: null,
  channelIssues: false,
  failedRecently: false,
  ...over,
});

describe('workspaceNeedsAttention', () => {
  it('flags a channel to fix, a recent failed post and a trial about to end', () => {
    expect(workspaceNeedsAttention(signals(), now)).toBe(false);
    expect(workspaceNeedsAttention(signals({ channelIssues: true }), now)).toBe(
      true
    );
    expect(
      workspaceNeedsAttention(signals({ failedRecently: true }), now)
    ).toBe(true);
    expect(
      workspaceNeedsAttention(
        signals({ plan: 'trialing', trialEndsAt: inDays(1.5) }),
        now
      )
    ).toBe(true);
    expect(
      workspaceNeedsAttention(
        signals({ plan: 'trialing', trialEndsAt: inDays(5) }),
        now
      )
    ).toBe(false);
  });

  it('flags a failed payment', () => {
    expect(workspaceNeedsAttention(signals({ status: 'past_due' }), now)).toBe(
      true
    );
    expect(
      workspaceNeedsAttention(signals({ plan: 'unpaid', status: 'unpaid' }), now)
    ).toBe(true);
  });

  it('never flags a deleted workspace', () => {
    expect(
      workspaceNeedsAttention(
        signals({ deleted: true, channelIssues: true, failedRecently: true }),
        now
      )
    ).toBe(false);
  });
});

describe('userMatchesFilter', () => {
  it('matches a user when one of their live workspaces matches', () => {
    const workspaces = [signals({ plan: 'no_plan' }), signals({ plan: 'trialing' })];
    expect(userMatchesFilter(workspaces, 'trialing', now)).toBe(true);
    expect(userMatchesFilter(workspaces, 'paying', now)).toBe(false);
    expect(userMatchesFilter(workspaces, 'all', now)).toBe(true);
  });

  it('counts a workspace for its owner only, not for its team', () => {
    const member = [signals({ plan: 'paying', owner: false })];
    expect(userMatchesFilter(member, 'paying', now)).toBe(false);
    expect(userMatchesFilter(member, 'no_plan', now)).toBe(true);
    expect(
      userMatchesFilter(
        [signals({ owner: false, channelIssues: true })],
        'needs_attention',
        now
      )
    ).toBe(false);
  });

  it('leaves deleted workspaces out', () => {
    const workspaces = [signals({ plan: 'paying', deleted: true })];
    expect(userMatchesFilter(workspaces, 'paying', now)).toBe(false);
    expect(userMatchesFilter(workspaces, 'no_plan', now)).toBe(true);
  });

  it('reads no plan as no live workspace with a plan', () => {
    expect(userMatchesFilter([], 'no_plan', now)).toBe(true);
    expect(
      userMatchesFilter(
        [signals({ plan: 'ended' }), signals({ plan: 'no_plan' })],
        'no_plan',
        now
      )
    ).toBe(true);
    expect(
      userMatchesFilter(
        [signals({ plan: 'no_plan' }), signals({ plan: 'lifetime' })],
        'no_plan',
        now
      )
    ).toBe(false);
    expect(
      userMatchesFilter([signals({ plan: 'comped' })], 'no_plan', now)
    ).toBe(false);
  });

  it('matches needs attention on any live workspace', () => {
    expect(
      userMatchesFilter(
        [signals(), signals({ channelIssues: true })],
        'needs_attention',
        now
      )
    ).toBe(true);
    expect(userMatchesFilter([signals()], 'needs_attention', now)).toBe(false);
  });
});

describe('lastActiveOf and contentPreviewOf', () => {
  it('reads a last activity still at the sign-up time as never seen', () => {
    const createdAt = new Date('2026-11-01T10:00:00Z');
    expect(
      lastActiveOf({ createdAt, lastOnline: new Date('2026-11-01T10:00:00.400Z') })
    ).toBeNull();
    const later = new Date('2026-11-20T08:00:00Z');
    expect(lastActiveOf({ createdAt, lastOnline: later })).toBe(later);
  });

  it('previews a post as one line of plain text', () => {
    expect(contentPreviewOf('<p>Hello&nbsp;<strong>world</strong></p>\n<p>again</p>')).toBe(
      'Hello world again'
    );
    const preview = contentPreviewOf(`<p>${'a'.repeat(300)}</p>`);
    expect(preview).toHaveLength(140);
    expect(preview.endsWith('…')).toBe(true);
  });
});

describe('AdminUsersService.list', () => {
  const candidate = (
    id: string,
    organizationId: string,
    plan: {
      allowTrial?: boolean;
      subscription?: object | null;
      role?: string;
    } = {}
  ) => ({
    id,
    organizations: [
      {
        organizationId,
        role: plan.role || 'SUPERADMIN',
        disabled: false,
        organization: {
          id: organizationId,
          name: organizationId,
          deletedAt: null,
          isTrailing: false,
          allowTrial: !!plan.allowTrial,
          subscription:
            plan.subscription === null
              ? null
              : {
                  subscriptionTier: 'PRO',
                  period: 'MONTHLY',
                  currentPeriodEnd: null,
                  ...subscription(plan.subscription || {}),
                },
        },
      },
    ],
  });

  const channelGroup = (over: object) => ({
    organizationId: 'org-b',
    disabled: false,
    refreshNeeded: false,
    inBetweenSteps: false,
    ...over,
  });

  const makeService = (candidates: any[]) => {
    const repository = {
      findCandidates: jest.fn().mockResolvedValue(candidates),
      getUsersByIds: jest.fn(async (ids: string[]) =>
        ids.map((id) => ({
          id,
          name: id,
          lastName: null,
          email: `${id}@example.com`,
          providerName: 'LOCAL',
          activated: true,
          createdAt: now,
          lastOnline: now,
          isSuperAdmin: false,
          deletedAt: null,
          organizations: candidates
            .find((c) => c.id === id)
            .organizations.map((member: any) => ({
              id: `uo-${id}`,
              createdAt: now,
              ...member,
            })),
        }))
      ),
      getWorkspacesWithChannelIssues: jest.fn().mockResolvedValue(['org-b']),
      getRecentFailures: jest.fn().mockResolvedValue([]),
      getChannelCounts: jest.fn().mockResolvedValue([
        channelGroup({ count: 2 }),
        channelGroup({ refreshNeeded: true, count: 1 }),
        channelGroup({ inBetweenSteps: true, disabled: true, count: 1 }),
        channelGroup({ disabled: true, count: 3 }),
      ]),
      getPostCounts: jest.fn().mockResolvedValue([
        { organizationId: 'org-b', state: 'QUEUE', count: 4 },
        { organizationId: 'org-b', state: 'ERROR', count: 1 },
      ]),
    };
    return {
      service: new AdminUsersService(repository as any, {} as any),
      repository,
    };
  };

  it('filters on the derived plan and pages the matches', async () => {
    const { service, repository } = makeService([
      candidate('u-a', 'org-a', { subscription: { status: 'trialing' } }),
      candidate('u-b', 'org-b'),
      candidate('u-c', 'org-c', { subscription: { status: 'trialing' } }),
    ]);

    const result = await service.list({ filter: 'trialing', page: 2, limit: 1 });

    expect(result).toMatchObject({ total: 2, page: 2, limit: 1, hasMore: false });
    expect(result.items.map((item) => item.id)).toEqual(['u-c']);
    // only needs attention reads channels and failures for the filter
    expect(repository.getWorkspacesWithChannelIssues).not.toHaveBeenCalled();
  });

  it('finds the users that need attention, with their counts', async () => {
    const { service } = makeService([
      candidate('u-a', 'org-a'),
      candidate('u-b', 'org-b'),
    ]);

    const result = await service.list({ filter: 'needs_attention' });

    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe('u-b');
    expect(result.items[0].lastActive).toBeNull();
    expect(result.items[0].workspaces[0]).toMatchObject({
      userOrganizationId: 'uo-u-b',
      plan: { state: 'paying', tier: 'PRO', period: 'MONTHLY' },
      channels: { active: 2, needsAttention: 2, disabled: 3 },
      posts: { scheduled: 4, published: 0, failed: 1, failedLast7d: 0 },
    });
  });

  it('counts each filter for the summary, a team member is not a customer', async () => {
    const { service, repository } = makeService([
      candidate('u-a', 'org-a', { subscription: { status: 'trialing' } }),
      candidate('u-b', 'org-b'),
      candidate('u-c', 'org-c', { allowTrial: true, subscription: null }),
      candidate('u-d', 'org-b', { role: 'USER' }),
    ]);

    expect(await service.summary()).toEqual({
      total: 4,
      trialing: 1,
      paying: 1,
      cancelling: 0,
      noPlan: 2,
      needsAttention: 1,
    });
    // the attention signals are read for every workspace, without a list
    expect(repository.getRecentFailures.mock.calls[0]).toHaveLength(1);
  });
});
