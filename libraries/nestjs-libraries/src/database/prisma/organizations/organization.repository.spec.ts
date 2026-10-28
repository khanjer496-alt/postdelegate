import { OrganizationRepository } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.repository';

const makeRepo = () => {
  const user = {
    findUnique: jest.fn().mockResolvedValue({ email: 'Invited@Example.com' }),
    findFirst: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockReturnValue('user-update'),
  };
  const userOrganization = {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockReturnValue('membership-create'),
  };
  const organization = {
    findFirst: jest.fn().mockResolvedValue({ subscription: null }),
  };
  const $transaction = jest.fn().mockResolvedValue([{ id: 'membership' }, {}]);
  const repo = new OrganizationRepository(
    { model: { organization } } as any,
    { model: { userOrganization } } as any,
    { model: { user } } as any,
    { model: { $transaction } } as any
  );
  return { repo, user, userOrganization, $transaction };
};

describe('OrganizationRepository.addUserToOrg invites', () => {
  it('accepts the invite for the invited email regardless of case', async () => {
    const { repo, $transaction } = makeRepo();

    const result = await repo.addUserToOrg(
      'user-1',
      'inv-1',
      'org-A',
      'USER',
      'invited@example.com'
    );

    expect(result).toEqual({ id: 'membership' });
    expect($transaction).toHaveBeenCalledWith([
      'membership-create',
      'user-update',
    ]);
  });

  it('rejects an account whose email differs from the invited one', async () => {
    const { repo, $transaction, userOrganization } = makeRepo();

    await expect(
      repo.addUserToOrg('user-1', 'inv-1', 'org-A', 'USER', 'other@example.com')
    ).resolves.toBe(false);

    expect(userOrganization.create).not.toHaveBeenCalled();
    expect($transaction).not.toHaveBeenCalled();
  });

  it('rejects an invite token without an email', async () => {
    const { repo, $transaction } = makeRepo();

    await expect(
      repo.addUserToOrg('user-1', 'inv-1', 'org-A', 'USER', '')
    ).resolves.toBe(false);
    expect($transaction).not.toHaveBeenCalled();
  });

  it('does not let an invite id that was already used join again', async () => {
    const { repo, user, $transaction } = makeRepo();
    user.findFirst.mockResolvedValue({ id: 'someone' });

    await expect(
      repo.addUserToOrg('user-1', 'inv-1', 'org-A', 'USER', 'invited@example.com')
    ).resolves.toBe(false);
    expect($transaction).not.toHaveBeenCalled();
  });

  it('does not add a user that is already a member', async () => {
    const { repo, userOrganization, $transaction } = makeRepo();
    userOrganization.findFirst.mockResolvedValue({ id: 'm-1' });

    await expect(
      repo.addUserToOrg('user-1', 'inv-1', 'org-A', 'USER', 'invited@example.com')
    ).resolves.toBe(false);
    expect($transaction).not.toHaveBeenCalled();
  });

  it('keeps admin-initiated adds (no invite email) working', async () => {
    const { repo, user, $transaction } = makeRepo();

    await repo.addUserToOrg('user-1', 'generated', 'org-A', 'USER');

    expect(user.findUnique).not.toHaveBeenCalled();
    expect($transaction).toHaveBeenCalledTimes(1);
  });
});

describe('OrganizationRepository.getLastPublishDate', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = new Date('2026-11-02T10:00:00Z').getTime();

  const makeStreakRepo = (
    posts: { publishDate: Date }[],
    recurring: Record<string, unknown>[]
  ) => {
    const organization = {
      findUnique: jest
        .fn()
        .mockResolvedValueOnce({ post: posts })
        .mockResolvedValueOnce({ post: recurring }),
    };
    return new OrganizationRepository(
      { model: { organization } } as any,
      {} as any,
      {} as any,
      {} as any
    );
  };

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(now);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('counts the latest share of a plain repeating post', async () => {
    const repo = makeStreakRepo(
      [],
      [
        {
          publishDate: new Date(now - 10 * DAY + 60 * 1000),
          state: 'PUBLISHED',
          intervalInDays: 1,
          evergreenMaxShares: null,
          evergreenUntil: null,
        },
      ]
    );

    expect(await repo.getLastPublishDate('org-A')).toBe(now);
  });

  it('stops counting an evergreen post once it used its shares', async () => {
    const anchor = now - 10 * DAY;
    const repo = makeStreakRepo(
      [],
      [
        {
          publishDate: new Date(anchor),
          state: 'PUBLISHED',
          intervalInDays: 1,
          evergreenMaxShares: 3,
          evergreenUntil: null,
        },
      ]
    );

    expect(await repo.getLastPublishDate('org-A')).toBe(anchor + 3 * DAY);
  });

  it('stops counting a stopped evergreen post at its end date', async () => {
    const anchor = now - 10 * DAY;
    const repo = makeStreakRepo(
      [],
      [
        {
          publishDate: new Date(anchor),
          state: 'PUBLISHED',
          intervalInDays: 2,
          evergreenMaxShares: null,
          evergreenUntil: new Date(anchor + 5 * DAY),
        },
      ]
    );

    expect(await repo.getLastPublishDate('org-A')).toBe(anchor + 4 * DAY);
  });

  it('counts a queued repeating post only on its own date', async () => {
    const queued = now - 3 * DAY;
    const repo = makeStreakRepo(
      [{ publishDate: new Date(now - 5 * DAY) }],
      [
        {
          publishDate: new Date(queued),
          state: 'QUEUE',
          intervalInDays: 1,
          evergreenMaxShares: null,
          evergreenUntil: null,
        },
      ]
    );

    expect(await repo.getLastPublishDate('org-A')).toBe(queued);
  });

  it('never returns a date in the future', async () => {
    const repo = makeStreakRepo([{ publishDate: new Date(now + 60 * 1000) }], []);

    expect(await repo.getLastPublishDate('org-A')).toBe(now);
  });
});
