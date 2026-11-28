import { AdminStatsRepository } from '@gitroom/nestjs-libraries/database/prisma/admin-stats/admin-stats.repository';

describe('AdminStatsRepository growth', () => {
  const makeRepo = () => {
    const user = { findMany: jest.fn().mockResolvedValue([]) };
    const subscription = {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    };
    const repo = new AdminStatsRepository(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { model: { user } } as any,
      { model: { subscription } } as any
    );
    return { repo, user, subscription };
  };

  const from = new Date(2026, 10, 1);
  const to = new Date(2026, 10, 3, 23, 59, 59, 999);

  it('reads the sign-ups of the range, without deleted users', async () => {
    const { repo, user } = makeRepo();

    await repo.getSignUps({ from, to });

    expect(user.findMany.mock.calls[0][0]).toEqual({
      where: { deletedAt: null, createdAt: { gte: from, lte: to } },
      select: { createdAt: true, providerName: true, activated: true },
    });
  });

  it('splits the sign-ups per method and per day', async () => {
    const { repo, user } = makeRepo();
    user.findMany.mockResolvedValue([
      {
        createdAt: new Date(2026, 10, 1, 9),
        providerName: 'LOCAL',
        activated: false,
      },
      {
        createdAt: new Date(2026, 10, 1, 18),
        providerName: 'GOOGLE',
        activated: true,
      },
      {
        createdAt: new Date(2026, 10, 3, 12),
        providerName: 'LOCAL',
        activated: true,
      },
    ]);

    const signUps = await repo.getSignUps({ from, to });

    expect(signUps.total).toBe(3);
    expect(signUps.activated).toBe(2);
    expect(signUps.perMethod).toEqual({
      total: 3,
      perSocial: [
        { provider: 'LOCAL', count: 2 },
        { provider: 'GOOGLE', count: 1 },
      ],
    });
    // the day without sign-ups is still a bar of the chart
    expect(signUps.perDay).toEqual([
      { date: '2026-11-01', count: 2 },
      { date: '2026-11-02', count: 0 },
      { date: '2026-11-03', count: 1 },
    ]);
  });

  it('counts lifetime deals and the plans an admin set', async () => {
    const { repo, subscription } = makeRepo();
    subscription.count.mockResolvedValue(4);
    subscription.findMany.mockResolvedValue([
      // add-subscription: the paymentId is a member's user id
      {
        organization: {
          paymentId: 'user_1',
          users: [{ userId: 'user_2' }, { userId: 'user_1' }],
        },
      },
      // a real customer of the provider
      {
        organization: { paymentId: 'cus_1', users: [{ userId: 'user_3' }] },
      },
    ]);

    expect(await repo.getCompedSubscriptions('stripe')).toEqual({
      lifetime: 4,
      setByAdmin: 1,
    });
    expect(subscription.count.mock.calls[0][0]).toEqual({
      where: {
        deletedAt: null,
        organization: { deletedAt: null },
        isLifetime: true,
      },
    });
    expect(subscription.findMany.mock.calls[0][0].where).toEqual({
      deletedAt: null,
      isLifetime: false,
      provider: 'stripe',
      organization: { deletedAt: null, paymentId: { not: null } },
    });
  });
});

describe('AdminStatsRepository users', () => {
  const makeRepo = () => {
    const user = {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };
    const post = { groupBy: jest.fn().mockResolvedValue([]) };
    const repo = new AdminStatsRepository(
      { model: { post } } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { model: { user } } as any,
      {} as any
    );
    return { repo, user, post };
  };

  // every key of a Prisma select, nested selects included
  const keysOf = (select: any): string[] =>
    Object.entries(select || {}).flatMap(([key, value]: [string, any]) => [
      key,
      ...(value && typeof value === 'object'
        ? keysOf(value.select || {})
        : []),
    ]);

  it('reads the newest users first, 50 a page, without deleted users', async () => {
    const { repo, user } = makeRepo();
    user.count.mockResolvedValue(120);

    expect(await repo.listUsers({ page: 2 })).toEqual({ users: [], total: 120 });

    const args = user.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ deletedAt: null });
    expect(args.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    expect(args.skip).toBe(100);
    expect(args.take).toBe(50);
    expect(user.count.mock.calls[0][0]).toEqual({ where: { deletedAt: null } });
  });

  it('filters by email or workspace name, ignoring case', async () => {
    const { repo, user } = makeRepo();

    await repo.listUsers({ page: 0, q: '  Acme ' });

    const where = {
      deletedAt: null,
      OR: [
        { email: { contains: 'Acme', mode: 'insensitive' } },
        {
          organizations: {
            some: {
              disabled: false,
              organization: {
                deletedAt: null,
                name: { contains: 'Acme', mode: 'insensitive' },
              },
            },
          },
        },
      ],
    };
    expect(user.findMany.mock.calls[0][0].where).toEqual(where);
    expect(user.count.mock.calls[0][0]).toEqual({ where });
  });

  it('never selects a password, a token, a key or a provider id', async () => {
    const { repo, user } = makeRepo();

    await repo.listUsers({ page: 0 });

    const keys = keysOf(user.findMany.mock.calls[0][0].select);
    expect(keys).toEqual(expect.arrayContaining(['email', 'organizations']));
    for (const secret of [
      'password',
      'providerId',
      'apiKey',
      'apiKeyHash',
      'token',
      'refreshToken',
      'ip',
      'agent',
      'sessionVersion',
    ]) {
      expect(keys).not.toContain(secret);
    }
    // the channels counted are the connected ones only
    const organization =
      user.findMany.mock.calls[0][0].select.organizations.select.organization;
    expect(organization.select._count.select.Integration.where).toEqual({
      deletedAt: null,
      disabled: false,
      inBetweenSteps: false,
    });
  });

  it('counts the top-level posts of the workspaces per state', async () => {
    const { repo, post } = makeRepo();

    expect(await repo.getPostsPerState([])).toEqual([]);
    expect(post.groupBy).not.toHaveBeenCalled();

    await repo.getPostsPerState(['o1', 'o2']);
    expect(post.groupBy.mock.calls[0][0]).toEqual({
      by: ['organizationId', 'state'],
      where: {
        organizationId: { in: ['o1', 'o2'] },
        parentPostId: null,
        deletedAt: null,
      },
      _count: { _all: true },
      _max: { createdAt: true },
    });
  });
});
