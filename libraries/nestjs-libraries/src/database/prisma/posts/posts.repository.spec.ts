import { PostsRepository } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.repository';
import { curatedPostError } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.curated.error';

const makeRepo = () => {
  const post = {
    findFirst: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockImplementation(async ({ where }: any) => ({
      id: where.id,
    })),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    update: jest.fn(),
  };
  const tags = { update: jest.fn().mockResolvedValue({}) };
  const repo = new PostsRepository(
    { model: { post } } as any,
    {} as any,
    {} as any,
    { model: { tags } } as any,
    { model: { tagsPosts: { deleteMany: jest.fn() } } } as any,
    {} as any,
    { model: { $transaction: (action: any) => action({ post, tags, tagsPosts: { deleteMany: jest.fn() }, mcpPublishFence: { findUnique: jest.fn().mockResolvedValue(null) } }) } } as any
  );
  return { repo, post, tags };
};

const body = (extra: Record<string, any> = {}) =>
  ({
    integration: { id: 'int-1' },
    settings: {},
    value: [{ id: 'p-1', content: 'hello', image: [] }],
    ...extra,
  } as any);

describe('PostsRepository.createOrUpdatePost tenant scoping', () => {
  it('scopes the previous post lookup and the group sweep to the organization', async () => {
    const { repo, post } = makeRepo();

    await repo.createOrUpdatePost(
      'schedule',
      'org-A',
      '2026-01-01T00:00:00',
      body({ group: 'victim-group' }),
      [],
      'API' as any
    );

    const lookup = post.findFirst.mock.calls.find(
      ([args]: any) => args.where.parentPostId === null
    )![0];
    expect(lookup.where).toMatchObject({
      group: 'victim-group',
      organizationId: 'org-A',
    });

    expect(post.updateMany).toHaveBeenCalledTimes(1);
    expect(post.updateMany.mock.calls[0][0].where).toMatchObject({
      group: 'victim-group',
      organizationId: 'org-A',
      deletedAt: null,
    });
  });

  it('scopes the keepGroup sweep to the organization', async () => {
    const { repo, post } = makeRepo();
    // the group already belongs to the caller's organization
    post.findFirst.mockResolvedValue({ id: 'own' });

    await repo.createOrUpdatePost(
      'update',
      'org-A',
      '2026-01-01T00:00:00',
      body({ group: 'own-group' }),
      [],
      'API' as any,
      undefined,
      true
    );

    expect(post.updateMany).toHaveBeenCalledTimes(1);
    expect(post.updateMany.mock.calls[0][0].where).toMatchObject({
      group: 'own-group',
      organizationId: 'org-A',
      id: { notIn: ['p-1'] },
    });
  });

  it('does not adopt a group of another organization with keepGroup', async () => {
    const { repo, post } = makeRepo();
    // nothing in org-A carries the supplied group
    post.findFirst.mockResolvedValue(null);

    await repo.createOrUpdatePost(
      'update',
      'org-A',
      '2026-01-01T00:00:00',
      body({ group: 'victim-group' }),
      [],
      'API' as any,
      undefined,
      true
    );

    const upsert = post.upsert.mock.calls[0][0];
    expect(upsert.create.group).not.toBe('victim-group');
    expect(upsert.update.group).not.toBe('victim-group');
    for (const [args] of post.updateMany.mock.calls) {
      expect(args.where.organizationId).toBe('org-A');
    }
  });
});

describe('PostsRepository.editTag', () => {
  it('only edits a tag of the caller organization', async () => {
    const { repo, tags } = makeRepo();

    await repo.editTag('tag-1', 'org-A', { name: 'n', color: '#fff' } as any);

    expect(tags.update.mock.calls[0][0].where).toEqual({
      id: 'tag-1',
      orgId: 'org-A',
    });
  });
});

describe('PostsRepository integration credentials', () => {
  const { randomBytes } = require('crypto');
  const {
    TokenEncryption,
  } = require('@gitroom/nestjs-libraries/database/prisma/integrations/token.encryption');
  const env = { ...process.env };

  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    TokenEncryption.reset();
  });
  afterAll(() => {
    process.env = env;
    TokenEncryption.reset();
  });

  const withIntegration = () => ({
    id: 'p-1',
    integration: {
      id: 'int-1',
      token: TokenEncryption.encrypt('access'),
      refreshToken: TokenEncryption.encrypt('refresh'),
    },
  });
  const makePostRepo = (post: any) => {
    const model = {
      findUnique: jest.fn().mockResolvedValue(post),
      findMany: jest.fn().mockResolvedValue([post]),
    };
    return new PostsRepository(
      { model: { post: model } } as any,
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any
    );
  };

  it('getPostById returns the integration with plaintext tokens', async () => {
    const post: any = await makePostRepo(withIntegration()).getPostById('p-1', 'org');
    expect(post.integration).toMatchObject({ token: 'access', refreshToken: 'refresh' });
  });

  it('getPost with the integration returns plaintext tokens', async () => {
    const post: any = await makePostRepo(withIntegration()).getPost('p-1', true, 'org');
    expect(post.integration).toMatchObject({ token: 'access', refreshToken: 'refresh' });
  });

  it('getPostsByGroup returns plaintext tokens', async () => {
    const posts: any[] = await makePostRepo(withIntegration()).getPostsByGroup('org', 'g');
    expect(posts[0].integration).toMatchObject({ token: 'access', refreshToken: 'refresh' });
  });

  it('a missing post stays missing and legacy plaintext is untouched', async () => {
    expect(await makePostRepo(null).getPostById('x')).toBeNull();
    const legacy = { id: 'p', integration: { token: 'plain', refreshToken: null } };
    const post: any = await makePostRepo(legacy).getPostById('p');
    expect(post.integration.token).toBe('plain');
  });
});

describe('PostsRepository.getAccountPostingDates', () => {
  it('reads the published (and queued) top-level posts of one network account', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValue([{ publishDate: new Date('2026-11-02T10:00:00Z') }]);
    const repo = new PostsRepository(
      { model: { post: { findMany } } } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
    const from = new Date('2026-11-01T12:00:00Z');
    const until = new Date('2026-11-03T12:00:00Z');

    await expect(
      repo.getAccountPostingDates('reddit', 'u1', from, until, true, ['p-1'])
    ).resolves.toEqual([new Date('2026-11-02T10:00:00Z')]);
    expect(findMany.mock.calls[0][0]).toEqual({
      where: {
        parentPostId: null,
        publishDate: { gte: from, lt: until },
        integration: { providerIdentifier: 'reddit', internalId: 'u1' },
        OR: [{ state: 'PUBLISHED' }, { state: 'QUEUE', deletedAt: null }],
        id: { notIn: ['p-1'] },
      },
      select: { publishDate: true },
      orderBy: { publishDate: 'asc' },
    });

    await repo.getAccountPostingDates('reddit', 'u1', from, until, false);
    expect(findMany.mock.calls[1][0].where.OR).toEqual([
      { state: 'PUBLISHED' },
    ]);
    expect(findMany.mock.calls[1][0].where.id).toBeUndefined();
  });
});

describe('PostsRepository channel-state scoping', () => {
  const makeFindMany = () => {
    const post = { findMany: jest.fn().mockResolvedValue([]) };
    const repo = new PostsRepository(
      { model: { post } } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
    return { repo, post };
  };

  const ready = {
    deletedAt: null,
    disabled: false,
    inBetweenSteps: false,
    refreshNeeded: false,
  };

  it('only looks at channels a post can still go out on', async () => {
    const { repo, post } = makeFindMany();
    await repo.searchForMissingThreeHoursPosts();
    expect(post.findMany.mock.calls[0][0].where.integration).toEqual(ready);
  });

  // this one used to leave deletedAt out, so it returned the old posts of
  // channels the customer had already removed
  it('leaves out the old posts of a removed channel', async () => {
    const { repo, post } = makeFindMany();
    await repo.getOldPosts('org-1', '2026-01-01');
    expect(post.findMany.mock.calls[0][0].where.integration).toEqual(ready);
  });
});

describe('PostsRepository state writes', () => {
  const makeStateRepo = (matched = 1) => {
    const row = {
      id: 'p-1',
      integrationId: 'int-1',
      organizationId: 'org-1',
      state: 'QUEUE',
    };
    const tx = {
      post: {
        findUnique: jest.fn().mockResolvedValue(row),
        updateMany: jest.fn().mockResolvedValue({ count: matched }),
      },
      integration: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ providerIdentifier: 'x' }),
      },
      errors: { create: jest.fn().mockResolvedValue({}) },
    };
    const transaction = {
      model: { $transaction: jest.fn((cb: any) => cb(tx)) },
    };
    const post = { findFirst: jest.fn().mockResolvedValue(null) };
    const repo = new PostsRepository(
      { model: { post } } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      transaction as any,
      {} as any
    );
    return { repo, tx, post };
  };

  it('changeStateIf writes only while the post is in an expected state', async () => {
    const { repo, tx } = makeStateRepo();

    await expect(
      repo.changeStateIf('p-1', ['QUEUE'], 'ERROR', 'boom')
    ).resolves.toMatchObject({ id: 'p-1' });

    const [args] = tx.post.updateMany.mock.calls[0];
    expect(args.where).toMatchObject({
      id: 'p-1',
      AND: [{ state: { in: ['QUEUE'] } }, { integrationId: 'int-1' }],
      deletedAt: null,
    });
    expect(args.data).toEqual({ state: 'ERROR', error: 'boom' });
  });

  it('changeStateIf is a no-op for a post that moved on or is gone', async () => {
    const { repo, tx } = makeStateRepo(0);

    await expect(
      repo.changeStateIf('p-1', ['QUEUE'], 'ERROR', 'boom', [{ id: 'p-1' }])
    ).resolves.toBeNull();
    expect(tx.errors.create).not.toHaveBeenCalled();
  });

  it('changeStateIf reports a retried write that already landed, without writing again', async () => {
    const { repo, tx, post } = makeStateRepo(0);
    post.findFirst.mockResolvedValue({ id: 'p-1' });

    await expect(
      repo.changeStateIf('p-1', ['QUEUE'], 'ERROR', 'boom')
    ).resolves.toEqual({ id: 'p-1' });
    expect(post.findFirst.mock.calls[0][0].where).toEqual({
      id: 'p-1',
      state: 'ERROR',
      error: 'boom',
      deletedAt: null,
      integration: { deletedAt: null },
    });
    expect(tx.errors.create).not.toHaveBeenCalled();
  });

  it('changeStateIf lets a database failure through, so the activity retries', async () => {
    const { repo, tx } = makeStateRepo();
    tx.post.updateMany.mockRejectedValue(new Error('db down'));

    await expect(
      repo.changeStateIf('p-1', ['QUEUE'], 'ERROR', 'boom')
    ).rejects.toThrow('db down');
  });

  it('changeStateIf keeps the release of a post that went out', async () => {
    const { repo, tx } = makeStateRepo();

    await repo.changeStateIf('p-1', ['QUEUE'], 'ERROR', 'unconfirmed', undefined, {
      releaseId: 'x-1',
      releaseURL: 'https://x.com/1',
    });

    expect(tx.post.updateMany.mock.calls[0][0].data).toEqual({
      state: 'ERROR',
      error: 'unconfirmed',
      releaseId: 'x-1',
      releaseURL: 'https://x.com/1',
    });
  });

  it('never stores the integration credentials in the error log', async () => {
    const { repo, tx } = makeStateRepo();

    await repo.changeState('p-1', 'ERROR', 'boom', [
      {
        id: 'p-1',
        content: 'hello',
        accessToken: 'leak',
        submittedForOrder: { id: 'o-1', seller: { apiKey: 'order-secret' } },
        integration: {
          id: 'int-1',
          name: 'X account',
          providerIdentifier: 'x',
          token: 'access-secret',
          refreshToken: 'refresh-secret',
          customInstanceDetails: 'client-secret',
        },
      },
    ]);

    const { body } = tx.errors.create.mock.calls[0][0].data;
    expect(JSON.parse(body)).toEqual([
      {
        id: 'p-1',
        content: 'hello',
        integration: { id: 'int-1', name: 'X account', providerIdentifier: 'x' },
      },
    ]);
    expect(body).not.toContain('secret');
    expect(body).not.toContain('leak');
  });

  it('applies the same allowlist to the child posts of a thread', async () => {
    const { repo, tx } = makeStateRepo();

    await repo.changeState('p-1', 'ERROR', 'boom', [
      {
        id: 'p-1',
        content: 'first',
        childrenPost: [
          {
            id: 'p-2',
            content: 'second',
            parentPostId: 'p-1',
            integration: { id: 'int-1', token: 'child-secret' },
          },
        ],
      },
    ]);

    const { body } = tx.errors.create.mock.calls[0][0].data;
    expect(JSON.parse(body)).toEqual([
      {
        id: 'p-1',
        content: 'first',
        childrenPost: [
          {
            id: 'p-2',
            parentPostId: 'p-1',
            content: 'second',
            integration: { id: 'int-1' },
          },
        ],
      },
    ]);
  });

  it('allowlists a body handed over as a JSON string, and drops one it cannot read', async () => {
    const { repo, tx } = makeStateRepo();

    await repo.changeState(
      'p-1',
      'ERROR',
      'boom',
      JSON.stringify([{ id: 'p-1', integration: { token: 'string-secret' } }])
    );
    await repo.changeState('p-1', 'ERROR', 'boom', 'token=not-json-secret');

    const [first, second] = tx.errors.create.mock.calls.map(
      ([args]: any) => args.data.body
    );
    expect(JSON.parse(first)).toEqual([{ id: 'p-1', integration: {} }]);
    expect(second).toBe('{}');
  });

  it('allowlists the stored bodies the debug export reads', async () => {
    const errors = {
      findMany: jest.fn().mockResolvedValue([
        {
          message: 'boom',
          platform: 'x',
          body: JSON.stringify([
            { id: 'p-1', integration: { id: 'int-1', token: 'old-secret' } },
          ]),
          createdAt: new Date(0),
        },
      ]),
    };
    const repo = new PostsRepository(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { model: { errors } } as any,
      {} as any,
      {} as any
    );

    const [row] = await repo.getErrorsByPostIds(['p-1']);

    expect(errors.findMany.mock.calls[0][0].select).toEqual({
      message: true,
      platform: true,
      body: true,
      createdAt: true,
    });
    expect(JSON.parse(row.body)).toEqual([
      { id: 'p-1', integration: { id: 'int-1' } },
    ]);
  });

  it('allowlists the stored bodies the debug timeline reads', async () => {
    const { repo, post } = makeStateRepo();
    post.findFirst.mockResolvedValue({
      id: 'p-1',
      errors: [
        {
          id: 'e-1',
          body: JSON.stringify([{ id: 'p-1', integration: { token: 'old-secret' } }]),
        },
      ],
    });

    const timeline = await repo.getPostTimeline('p-1', 'org-1');

    expect(timeline!.errors[0].body).not.toContain('secret');
    expect(JSON.parse(timeline!.errors[0].body)).toEqual([
      { id: 'p-1', integration: {} },
    ]);
  });

  it('clears the last error when a post is queued again or moved to draft', async () => {
    const { repo, tx } = makeStateRepo();

    await repo.changeState('p-1', 'QUEUE');
    await repo.changeState('p-1', 'DRAFT');
    await repo.changeState('p-1', 'ERROR');

    expect(tx.post.updateMany.mock.calls.map(([args]: any) => args.data)).toEqual([
      { state: 'QUEUE', error: null },
      { state: 'DRAFT', error: null },
      { state: 'ERROR' },
    ]);
  });

  it('updatePost clears the error of an earlier attempt', async () => {
    const { repo, tx } = makeStateRepo();

    await repo.updatePost('p-1', 'x-1', 'https://x.com/1');

    expect(tx.post.updateMany.mock.calls[0][0].data).toEqual({
      state: 'PUBLISHED',
      releaseURL: 'https://x.com/1',
      releaseId: 'x-1',
      error: null,
    });
  });
});

describe('PostsRepository state and date of a thread', () => {
  const makeThreadRepo = () => {
    const post = {
      findFirst: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockImplementation(async ({ where }: any) => ({
        id: where.id,
      })),
      update: jest.fn().mockResolvedValue({
        id: 'p-1',
        group: 'g-1',
        integrationId: 'int-1',
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    };
    const transaction = {
      model: { $transaction: jest.fn((run: any) => run({ post, mcpPublishFence: { findUnique: jest.fn().mockResolvedValue(null) }, tagsPosts: { deleteMany: jest.fn() }, tags: { findMany: jest.fn() } })) },
    };
    const repo = new PostsRepository(
      { model: { post } } as any,
      {} as any,
      {} as any,
      { model: { tags: { findMany: jest.fn() } } } as any,
      { model: { tagsPosts: { deleteMany: jest.fn() } } } as any,
      {} as any,
      transaction as any,
      {} as any
    );
    return { repo, post, transaction };
  };

  it('a reschedule moves the comments with the main post and clears the old attempt', async () => {
    const { repo, post, transaction } = makeThreadRepo();
    await repo.changeDate('org-1', 'p-1', '2030-01-01T10:00:00', false, 'schedule');

    expect(transaction.model.$transaction).toHaveBeenCalledTimes(1);
    const [{ where, data }] = post.update.mock.calls[0];
    expect(where).toEqual({ organizationId: 'org-1', id: 'p-1' });
    expect(data).toMatchObject({
      state: 'QUEUE',
      error: null,
      releaseId: null,
      releaseURL: null,
    });
    const [{ where: comments, data: commentData }] = post.updateMany.mock.calls[0];
    expect(comments).toEqual({
      organizationId: 'org-1',
      group: 'g-1',
      integrationId: 'int-1',
      deletedAt: null,
      id: { not: 'p-1' },
    });
    expect(commentData).toEqual(data);
  });

  it('moving the date only keeps the state, the release and the error', async () => {
    const { repo, post } = makeThreadRepo();
    await repo.changeDate('org-1', 'p-1', '2030-01-01T10:00:00', false, 'update');
    const [{ data }] = post.update.mock.calls[0];
    expect(Object.keys(data)).toEqual(['publishDate']);
    expect(post.updateMany.mock.calls[0][0].data).toEqual(data);
  });

  it('a status change moves the whole thread of the channel', async () => {
    const { repo, post } = makeThreadRepo();
    await repo.changeGroupState(
      'org-1',
      { group: 'g-1', integrationId: 'int-1' },
      'QUEUE'
    );
    expect(post.updateMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        group: 'g-1',
        integrationId: 'int-1',
        deletedAt: null,
        integration: { deletedAt: null },
        // published since it was read: left alone
        state: { not: 'PUBLISHED' },
      },
      data: { state: 'QUEUE', error: null, releaseId: null, releaseURL: null },
    });

    await repo.changeGroupState(
      'org-1',
      { group: 'g-1', integrationId: 'int-1' },
      'DRAFT'
    );
    expect(post.updateMany.mock.calls[1][0].data).toEqual({
      state: 'DRAFT',
      error: null,
    });

    // republish: a published post is what is meant
    await repo.changeGroupState(
      'org-1',
      { group: 'g-1', integrationId: 'int-1' },
      'QUEUE',
      true
    );
    expect(post.updateMany.mock.calls[2][0].where).not.toHaveProperty('state');
  });

  it('a status change of a post that is gone fails', async () => {
    const { repo, post } = makeThreadRepo();
    post.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      repo.changeGroupState('org-1', { group: 'g-1', integrationId: 'int-1' }, 'QUEUE')
    ).rejects.toThrow('Post is no longer available.');
  });

  it('a save that queues a post again clears the old attempt, an update keeps it', async () => {
    const { repo, post } = makeThreadRepo();
    await repo.createOrUpdatePost(
      'schedule',
      'org-1',
      '2030-01-01T10:00:00',
      body(),
      [],
      'API' as any
    );
    expect(post.upsert.mock.calls[0][0].update).toMatchObject({
      state: 'QUEUE',
      error: null,
      releaseId: null,
      releaseURL: null,
    });

    await repo.createOrUpdatePost(
      'draft',
      'org-1',
      '2030-01-01T10:00:00',
      body(),
      [],
      'API' as any
    );
    const draft = post.upsert.mock.calls[1][0].update;
    expect(draft).toMatchObject({ state: 'DRAFT', error: null });
    expect(draft).not.toHaveProperty('releaseURL');

    await repo.createOrUpdatePost(
      'update',
      'org-1',
      '2030-01-01T10:00:00',
      body(),
      [],
      'API' as any
    );
    const update = post.upsert.mock.calls[2][0].update;
    expect(update).not.toHaveProperty('state');
    expect(update).not.toHaveProperty('error');
    expect(update).not.toHaveProperty('releaseURL');
  });
});


describe('saved sequence permission compatibility boundary', () => {
  it('accepts only stored IDs in the same organization/channel/root group', async () => {
    const { repo, post } = makeRepo();
    post.findFirst.mockResolvedValue({ group: 'saved-group' });
    (post as any).count = jest.fn().mockResolvedValue(3);
    await expect((repo as any).isExistingPostSequence('org-A', 'int-1', ['p-1', 'p-2', 'p-3'])).resolves.toBe(true);
    expect(post.findFirst).toHaveBeenCalledWith({ where: { id: 'p-1', organizationId: 'org-A', integrationId: 'int-1', parentPostId: null, deletedAt: null }, select: { group: true } });
    expect((post as any).count).toHaveBeenCalledWith({ where: { organizationId: 'org-A', integrationId: 'int-1', group: 'saved-group', deletedAt: null, id: { in: ['p-1', 'p-2', 'p-3'] } } });
  });
  it('rejects a missing/foreign root and duplicate IDs without accepting a new sequence', async () => {
    const { repo, post } = makeRepo();
    (post as any).count = jest.fn();
    await expect((repo as any).isExistingPostSequence('org-B', 'int-1', ['p-1', 'p-2'])).resolves.toBe(false);
    await expect((repo as any).isExistingPostSequence('org-A', 'int-1', ['p-1', 'p-1'])).resolves.toBe(false);
    expect((post as any).count).not.toHaveBeenCalled();
  });
  it('rejects newly added or deleted entries absent from the stored sequence', async () => {
    const { repo, post } = makeRepo();
    post.findFirst.mockResolvedValue({ group: 'saved-group' });
    (post as any).count = jest.fn().mockResolvedValue(1);
    await expect((repo as any).isExistingPostSequence('org-A', 'int-1', ['p-1', 'new-entry'])).resolves.toBe(false);
  });
});

describe('MCP version stamp before enqueue', () => {
  it('stores the new workflow version atomically with new MCP rows, leaving existing update data unstamped', async () => {
    const { repo, post } = makeRepo();
    await repo.createOrUpdatePost('schedule', 'org', '2030-01-01T00:00:00Z', body(), [], 'MCP');
    const args = post.upsert.mock.calls[0][0];
    expect(args.create).toMatchObject({ creationMethod: 'MCP', mcpWorkflowVersion: 114 });
    expect(args.update).not.toHaveProperty('mcpWorkflowVersion');
  });
});

describe('agent save admission lease, release retry and boot release', () => {
  type Row = { organizationId: string; owner: string; instanceId: string; writtenPostIds: string[]; createdAt: Date };
  // the admission table, one row per workspace, with the filters it is read by
  const makeAdmissions = (rows: Row[]) => {
    const matches = (row: Row, where: any = {}) =>
      (where.organizationId === undefined || row.organizationId === where.organizationId) &&
      (where.owner === undefined || row.owner === where.owner) &&
      (where.createdAt?.lt === undefined || row.createdAt < where.createdAt.lt) &&
      (where.instanceId?.not === undefined || row.instanceId !== where.instanceId.not);
    const recoveries: any[] = [];
    const audits: any[] = [];
    const tx = {
      mcpAgentAdmission: {
        findUnique: jest.fn(async ({ where }: any) => rows.find((r) => matches(r, where)) || null),
        findUniqueOrThrow: jest.fn(async ({ where }: any) => rows.find((r) => matches(r, where))!),
        findFirst: jest.fn(async ({ where }: any) => rows.find((r) => matches(r, where)) || null),
        findMany: jest.fn(async ({ where }: any) => rows.filter((r) => matches(r, where))),
        updateMany: jest.fn(async ({ where }: any) => ({ count: rows.filter((r) => matches(r, where)).length })),
        create: jest.fn(async ({ data }: any) => {
          if (rows.some((r) => r.organizationId === data.organizationId)) throw Object.assign(new Error('unique'), { code: 'P2002' });
          const row = { writtenPostIds: [], createdAt: new Date(), ...data };
          rows.push(row);
          return row;
        }),
        delete: jest.fn(async ({ where }: any) => rows.splice(rows.findIndex((r) => matches(r, where)), 1)[0]),
        deleteMany: jest.fn(async ({ where }: any) => {
          const before = rows.length;
          for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i], where)) rows.splice(i, 1);
          return { count: before - rows.length };
        }),
      },
      mcpAgentAdmissionRecovery: {
        create: jest.fn(async ({ data }: any) => recoveries.push(data)),
        findFirst: jest.fn(async ({ where }: any) => recoveries.find((r) => r.owner === where.owner) || null),
      },
      activityLog: { create: jest.fn(async ({ data }: any) => (audits.push(data), { id: `audit-${audits.length}` })) },
    };
    const $transaction = jest.fn((run: any) => run(tx));
    const repo = new PostsRepository({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, { model: { $transaction } } as any, {} as any);
    return { repo, rows, recoveries, audits, $transaction };
  };
  const minutesAgo = (n: number) => new Date(Date.now() - n * 60 * 1000);

  it('takes over an admission older than the 10 minute lease and keeps its saved post IDs', async () => {
    const { repo, rows, recoveries, audits } = makeAdmissions([
      { organizationId: 'org', owner: 'stale', instanceId: 'old', writtenPostIds: ['p-1'], createdAt: minutesAgo(11) },
    ]);
    await repo.acquireAgentAdmission('org', 'next', { instanceId: 'now', host: 'h', processId: 1 });
    expect(rows).toEqual([expect.objectContaining({ organizationId: 'org', owner: 'next' })]);
    expect(recoveries).toEqual([expect.objectContaining({ organizationId: 'org', owner: 'stale', writtenPostIds: ['p-1'] })]);
    expect(audits[0].comment).toContain('p-1');
    // the old owner learns its save was stopped, with what it had saved
    await expect(repo.releaseAgentAdmission('org', 'stale')).resolves.toEqual({ count: 0, writtenPostIds: ['p-1'] });
  });

  it('still refuses a second save while a live admission is within its lease', async () => {
    const { repo, rows, recoveries } = makeAdmissions([
      { organizationId: 'org', owner: 'live', instanceId: 'now', writtenPostIds: [], createdAt: minutesAgo(9) },
    ]);
    await expect(repo.acquireAgentAdmission('org', 'next')).rejects.toMatchObject({ code: 'P2002' });
    expect(rows.map((r) => r.owner)).toEqual(['live']);
    expect(recoveries).toHaveLength(0);
  });

  it('retries a release that lost a serialization race instead of leaving the workspace locked', async () => {
    const { repo, rows, $transaction } = makeAdmissions([
      { organizationId: 'org', owner: 'mine', instanceId: 'now', writtenPostIds: [], createdAt: new Date() },
    ]);
    $transaction.mockImplementationOnce(async () => { throw Object.assign(new Error('serialization'), { code: 'P2034' }); });
    await expect(repo.releaseAgentAdmission('org', 'mine')).resolves.toMatchObject({ count: 1 });
    expect(rows).toHaveLength(0);
    expect($transaction).toHaveBeenCalledTimes(2);
  });

  it('gives up a release after three serialization failures', async () => {
    const { repo, $transaction } = makeAdmissions([]);
    $transaction.mockImplementation(async () => { throw Object.assign(new Error('serialization'), { code: 'P2034' }); });
    await expect(repo.releaseAgentAdmission('org', 'mine')).rejects.toMatchObject({ code: 'P2034' });
    expect($transaction).toHaveBeenCalledTimes(3);
  });

  it('records no stopped save for a plain refusal that wrote nothing', async () => {
    const { repo, rows, recoveries, audits } = makeAdmissions([
      { organizationId: 'org', owner: 'mine', instanceId: 'now', writtenPostIds: [], createdAt: new Date() },
    ]);
    await repo.releaseAgentAdmission('org', 'mine', true, true);
    expect(rows).toHaveLength(0);
    expect(recoveries).toHaveLength(0);
    expect(audits).toHaveLength(0);
  });

  it('still records a refused save that had written posts, and any other failure', async () => {
    const written = makeAdmissions([{ organizationId: 'org', owner: 'mine', instanceId: 'now', writtenPostIds: ['p-1'], createdAt: new Date() }]);
    await written.repo.releaseAgentAdmission('org', 'mine', true, true);
    expect(written.recoveries).toEqual([expect.objectContaining({ writtenPostIds: ['p-1'] })]);
    const crashed = makeAdmissions([{ organizationId: 'org', owner: 'mine', instanceId: 'now', writtenPostIds: [], createdAt: new Date() }]);
    await crashed.repo.releaseAgentAdmission('org', 'mine', true);
    expect(crashed.audits).toHaveLength(1);
  });

  it('at boot releases the admissions of other server instances only', async () => {
    const { repo, rows, recoveries } = makeAdmissions([
      { organizationId: 'org-a', owner: 'gone', instanceId: 'previous-boot', writtenPostIds: ['p-9'], createdAt: new Date() },
      { organizationId: 'org-b', owner: 'mine', instanceId: 'this-boot', writtenPostIds: [], createdAt: new Date() },
    ]);
    await expect(repo.releaseAgentAdmissionsOfOtherInstances('this-boot')).resolves.toBe(1);
    expect(rows.map((r) => r.owner)).toEqual(['mine']);
    expect(recoveries).toEqual([expect.objectContaining({ organizationId: 'org-a', owner: 'gone', writtenPostIds: ['p-9'] })]);
  });
});

describe('PostsRepository.createOrUpdatePost transaction isolation and retry', () => {
  const make = (fence: any = null) => {
    const post = {
      findFirst: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockImplementation(async ({ where }: any) => ({ id: where.id })),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    };
    const tx = { post, tags: { findMany: jest.fn() }, tagsPosts: { deleteMany: jest.fn() }, mcpPublishFence: { findUnique: jest.fn().mockResolvedValue(fence), update: jest.fn(), upsert: jest.fn() }, mcpPublishAttempt: { count: jest.fn().mockResolvedValue(0) } };
    const $transaction = jest.fn((run: any) => run(tx));
    const repo = new PostsRepository({ model: { post } } as any, {} as any, {} as any, {} as any, {} as any, {} as any, { model: { $transaction } } as any, {} as any);
    return { repo, $transaction, post };
  };

  it('saves a web, import or public API post with the default isolation, as before', async () => {
    const { repo, $transaction } = make();
    await repo.createOrUpdatePost('schedule', 'org-A', '2030-01-01T00:00:00', body(), [], 'API' as any);
    const options = $transaction.mock.calls.map(([, options]: any[]) => options);
    expect(options.every((o: any) => o?.isolationLevel !== 'Serializable')).toBe(true);
  });

  it('keeps Serializable for MCP saves and edits of a fenced post', async () => {
    const mcp = make();
    await mcp.repo.createOrUpdatePost('schedule', 'org-A', '2030-01-01T00:00:00', body(), [], 'MCP' as any);
    expect(mcp.$transaction.mock.calls.at(-1)![1]).toEqual({ timeout: 15000, isolationLevel: 'Serializable' });

    const fenced = make({ postId: 'p-1', organizationId: 'org-A' });
    fenced.post.findFirst.mockResolvedValue({ state: 'QUEUE' });
    await fenced.repo.createOrUpdatePost('update', 'org-A', '2030-01-01T00:00:00', body(), [], 'API' as any);
    expect(fenced.$transaction.mock.calls.at(-1)![1]).toEqual({ timeout: 15000, isolationLevel: 'Serializable' });
  });

  it('gives every save 15s instead of the 5s Prisma default', async () => {
    const { repo, $transaction } = make();
    await repo.createOrUpdatePost('schedule', 'org-A', '2030-01-01T00:00:00', body(), [], 'API' as any);
    expect($transaction.mock.calls.at(-1)![1]).toEqual({ timeout: 15000 });
  });

  it('runs a save again after a serialization failure instead of failing it', async () => {
    const { repo, $transaction, post } = make();
    let failed = false;
    post.upsert.mockImplementation(async ({ where }: any) => {
      if (!failed) { failed = true; throw Object.assign(new Error('could not serialize'), { code: 'P2034' }); }
      return { id: where.id };
    });
    await expect(repo.createOrUpdatePost('schedule', 'org-A', '2030-01-01T00:00:00', body(), [], 'API' as any)).resolves.toMatchObject({ posts: [{ id: 'p-1' }] });
    expect(post.upsert).toHaveBeenCalledTimes(2);
    expect($transaction).toHaveBeenCalledTimes(3); // the fence lookup, then two save attempts
  });
});

describe('PostsRepository.deletePost of a failed tracked MCP thread', () => {
  const make = (errorRow: any) => {
    const post = {
      findMany: jest.fn().mockResolvedValue([{ id: 'root', integrationId: 'channel' }]),
      findFirst: jest.fn().mockResolvedValue(errorRow),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    };
    const tx = {
      post,
      mcpPublishFence: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn() },
      // the root went out, its comment's attempt stayed uncertain
      mcpPublishAttempt: { count: jest.fn().mockResolvedValue(1) },
    };
    const repo = new PostsRepository({ model: { post } } as any, {} as any, {} as any, {} as any, {} as any, {} as any, { model: { $transaction: (run: any) => run(tx) } } as any, {} as any);
    return { repo, post, tx };
  };

  it('deletes it when a comment of the thread failed, not only the root', async () => {
    const { repo, post } = make({ id: 'child' });
    await expect(repo.deletePost('org', 'group', ['root'])).resolves.toEqual({ id: 'root' });
    expect(post.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org', group: 'group', integrationId: 'channel', state: 'ERROR', deletedAt: null } }));
    expect(post.updateMany).toHaveBeenCalled();
  });

  it('still refuses while no row of the thread failed', async () => {
    const { repo, post } = make(null);
    await expect(repo.deletePost('org', 'group', ['root'])).rejects.toThrow('active or uncertain');
    expect(post.updateMany).not.toHaveBeenCalled();
  });
});

describe('PostsRepository.failMcpSegment error', () => {
  const make = () => {
    const tx = { mcpPublishFence: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) }, post: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    const repo = new PostsRepository({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, { model: { $transaction: (run: any) => run(tx) } } as any, {} as any);
    const stored = () => curatedPostError(tx.post.updateMany.mock.calls[0][0].data.error);
    return { repo, stored };
  };
  // the activity failure as the workflow passes it on
  const failure = (type: string, message: string) => ({ cause: { type, failure: { message } } });

  it('keeps the reconciliation note and adds what the platform said', async () => {
    const { repo, stored } = make();
    await repo.failMcpSegment('org', 'root', 'child', 1, 'hash', failure('bad_body', 'Your video is longer than 60 seconds'));
    expect(stored()).toBe('Publication outcome needs reconciliation before retry. Your video is longer than 60 seconds');
  });

  it('shows only the note for one of our own failures', async () => {
    const { repo, stored } = make();
    await repo.failMcpSegment('org', 'root', 'child', 1, 'hash', failure('BadRequestException', 'Invalid `prisma.post.update()` invocation: https://db.internal/?password=x'));
    expect(stored()).toBe('Publication outcome needs reconciliation before retry.');
  });
});
