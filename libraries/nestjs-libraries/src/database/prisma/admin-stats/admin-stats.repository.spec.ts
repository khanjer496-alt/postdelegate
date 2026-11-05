import { AdminStatsRepository } from '@gitroom/nestjs-libraries/database/prisma/admin-stats/admin-stats.repository';

describe('AdminStatsRepository growth', () => {
  const makeRepo = () => {
    const user = { findMany: jest.fn().mockResolvedValue([]) };
    const subscription = { count: jest.fn().mockResolvedValue(0) };
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

  it('counts the lifetime and hand-set plans of live organizations', async () => {
    const { repo, subscription } = makeRepo();
    subscription.count.mockResolvedValue(4);

    expect(await repo.getCompedSubscriptions()).toBe(4);
    expect(subscription.count.mock.calls[0][0]).toEqual({
      where: {
        deletedAt: null,
        organization: { deletedAt: null },
        OR: [{ isLifetime: true }, { provider: 'manual' }],
      },
    });
  });
});
