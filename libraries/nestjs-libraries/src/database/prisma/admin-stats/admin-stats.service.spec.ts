// the real services pull in the billing providers, the spec only needs the shape
jest.mock('@gitroom/nestjs-libraries/services/payment/payment.service', () => ({ PaymentService: class {} }));
jest.mock('@gitroom/nestjs-libraries/services/website.stats.service', () => ({ WebsiteStatsService: class {} }));

import { AdminStatsService } from '@gitroom/nestjs-libraries/database/prisma/admin-stats/admin-stats.service';

const day = 86400000;
const now = new Date('2026-11-20T12:00:00Z').getTime();

const organization = (overrides: any = {}) => ({
  id: 'o1',
  name: 'Acme',
  isTrailing: false,
  allowTrial: true,
  paymentId: 'cus_1',
  subscription: null,
  users: [{ userId: 'u1' }],
  _count: { Integration: 3 },
  ...overrides,
});

const subscription = (overrides: any = {}) => ({
  subscriptionTier: 'PRO',
  period: 'MONTHLY',
  provider: 'stripe',
  isLifetime: false,
  status: 'active',
  trialEndsAt: null,
  cancelAt: null,
  deletedAt: null,
  ...overrides,
});

const user = (org: any, overrides: any = {}) => ({
  id: 'u1',
  email: 'sam@acme.com',
  name: 'Sam',
  providerName: 'GOOGLE',
  activated: true,
  isSuperAdmin: false,
  createdAt: new Date('2026-11-01T00:00:00Z'),
  updatedAt: new Date('2026-11-10T00:00:00Z'),
  organizations: org ? [{ id: 'm1', role: 'SUPERADMIN', organization: org }] : [],
  ...overrides,
});

describe('AdminStatsService users', () => {
  const makeService = (users: any[], posts: any[] = [], total = users.length) => {
    const repository = {
      listUsers: jest.fn().mockResolvedValue({ users, total }),
      getPostsPerState: jest.fn().mockResolvedValue(posts),
    };
    const payment = { getDefaultProviderName: jest.fn().mockReturnValue('stripe') };
    const service = new AdminStatsService(
      repository as any,
      payment as any,
      {} as any
    );
    return { service, repository, payment };
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
  });
  afterEach(() => jest.useRealTimers());

  const planOf = async (org: any) => {
    const { service } = makeService([user(org)]);
    return (await service.listUsers({ page: 0 })).items[0].workspace!.plan;
  };

  it('reads each plan state', async () => {
    expect(
      await planOf(
        organization({
          subscription: subscription({
            status: 'trialing',
            trialEndsAt: new Date(now + 2.5 * day),
          }),
        })
      )
    ).toMatchObject({ state: 'trial', tier: 'PRO', trialDaysLeft: 3 });

    // the first charge after the trial is being retried
    expect(
      await planOf(
        organization({
          isTrailing: true,
          subscription: subscription({ status: 'past_due' }),
        })
      )
    ).toMatchObject({ state: 'trial', trialDaysLeft: null });

    expect(
      await planOf(organization({ subscription: subscription() }))
    ).toEqual({
      state: 'paying',
      tier: 'PRO',
      period: 'MONTHLY',
      status: 'active',
      trialDaysLeft: null,
      cancelAt: null,
    });

    expect(
      await planOf(
        organization({ subscription: subscription({ isLifetime: true }) })
      )
    ).toMatchObject({ state: 'lifetime', tier: 'PRO' });

    // add-subscription: a member's user id as the paymentId
    expect(
      await planOf(
        organization({
          paymentId: 'u1',
          subscription: subscription({ status: null }),
        })
      )
    ).toMatchObject({ state: 'comped', tier: 'PRO' });

    // an ended plan's row is gone and allowTrial is off
    expect(await planOf(organization({ allowTrial: false }))).toMatchObject({
      state: 'expired',
      tier: null,
    });

    expect(await planOf(organization())).toMatchObject({ state: 'none' });

    expect(
      await planOf(
        organization({ subscription: subscription({ deletedAt: new Date() }) })
      )
    ).toMatchObject({ state: 'none' });
  });

  it('counts the posts of the first workspace and takes the newest activity', async () => {
    const { service, repository } = makeService(
      [
        user(organization(), {
          organizations: [
            { id: 'm1', role: 'SUPERADMIN', organization: organization() },
            {
              id: 'm2',
              role: 'USER',
              organization: organization({ id: 'o2', name: 'Other' }),
            },
          ],
        }),
        user(null, { id: 'u2', email: 'new@x.com' }),
      ],
      [
        { organizationId: 'o1', state: 'QUEUE', _count: { _all: 4 }, _max: { createdAt: new Date('2026-11-18T00:00:00Z') } },
        { organizationId: 'o1', state: 'PUBLISHED', _count: { _all: 9 }, _max: { createdAt: new Date('2026-11-05T00:00:00Z') } },
        { organizationId: 'o1', state: 'ERROR', _count: { _all: 1 }, _max: { createdAt: null } },
      ],
      120
    );

    const result = await service.listUsers({ page: 1, q: 'acme' });

    expect(repository.listUsers).toHaveBeenCalledWith({ page: 1, q: 'acme' });
    expect(repository.getPostsPerState).toHaveBeenCalledWith(['o1']);
    expect(result).toMatchObject({ total: 120, page: 1, limit: 50, hasMore: true });
    expect(result.items[0]).toMatchObject({
      email: 'sam@acme.com',
      signInMethod: 'GOOGLE',
      lastActiveAt: '2026-11-18T00:00:00.000Z',
      otherWorkspaces: 1,
      workspace: {
        membershipId: 'm1',
        name: 'Acme',
        channels: 3,
        postsScheduled: 4,
        postsPublished: 9,
      },
    });
    // no workspace: the user row is the last activity
    expect(result.items[1]).toMatchObject({
      workspace: null,
      otherWorkspaces: 0,
      lastActiveAt: '2026-11-10T00:00:00.000Z',
    });
  });

  it('has no more pages on the last one', async () => {
    const { service } = makeService([user(organization())], [], 101);
    expect((await service.listUsers({ page: 2 })).hasMore).toBe(false);
  });

  it('answers only the fields the page shows', async () => {
    const { service } = makeService([
      user(organization({ subscription: subscription() }), {
        password: 'hash',
        providerId: 'google-id',
      }),
    ]);

    const [row] = (await service.listUsers({ page: 0 })).items;

    expect(Object.keys(row).sort()).toEqual(
      [
        'activated',
        'createdAt',
        'email',
        'id',
        'isSuperAdmin',
        'lastActiveAt',
        'name',
        'otherWorkspaces',
        'signInMethod',
        'workspace',
      ].sort()
    );
    expect(Object.keys(row.workspace!).sort()).toEqual(
      [
        'channels',
        'id',
        'membershipId',
        'name',
        'plan',
        'postsPublished',
        'postsScheduled',
        'role',
      ].sort()
    );
    const json = JSON.stringify(row);
    for (const secret of ['hash', 'google-id', 'cus_1', 'paymentId', 'password']) {
      expect(json).not.toContain(secret);
    }
  });
});
