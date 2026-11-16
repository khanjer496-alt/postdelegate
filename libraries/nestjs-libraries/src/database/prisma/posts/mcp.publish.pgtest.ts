import { ApprovalsRepository } from '../approvals/approvals.repository';
import { AgentSaveRecovered } from './agent-admission.context';
import { agentAdmissionContext } from './agent-admission.context';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PostsRepository } from './posts.repository';

// Explicit disposable CI schema only: no DATABASE_URL fallback and no app DB.
const url = process.env.MCP_PUBLICATION_TEST_DATABASE_URL;
if (
  url &&
  (new URL(url).searchParams.get('schema') !== 'mcp_publication' ||
    new URL(url).pathname !== '/pd_security_ledger_test')
)
  throw new Error('Dedicated MCP publication test schema required.');
const pg = url ? describe : describe.skip;
pg('MCP durable publication fence (PostgreSQL)', () => {
  let db: PrismaClient;
  let repo: PostsRepository;
  let org: string;
  let integration: string;
  let root: string;
  let child: string;
  const revision = 'a'.repeat(64);
  const finish = async (organizationId: string, id: string, receipt: any) => {
    await repo.bindMcpProviderPayload(
      organizationId,
      id,
      receipt.map((r: any) => ({
        id: r.id,
        message: 'controlled fixture payload',
      }))
    );
    await repo.finishMcpSegment(organizationId, id, receipt);
  };
  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url } } });
    repo = new PostsRepository(
      { model: db } as any,
      {} as any,
      {} as any,
      { model: db } as any,
      { model: db } as any,
      {} as any,
      { model: db } as any,
      {} as any
    );
    org = (
      await db.organization.create({
        data: { name: 'Disposable MCP publication fixture' },
      })
    ).id;
    integration = (
      await db.integration.create({
        data: {
          organizationId: org,
          internalId: randomUUID(),
          name: 'No-egress fixture',
          providerIdentifier: 'fixture',
          type: 'social',
          token: 'not-a-provider-credential',
        },
      })
    ).id;
  });
  beforeEach(async () => {
    root = randomUUID();
    child = randomUUID();
    await db.post.create({
      data: {
        id: root,
        organizationId: org,
        integrationId: integration,
        content: 'parent',
        group: root,
        publishDate: new Date('2030-01-01T00:00:00Z'),
        state: 'QUEUE',
        approvalStatus: 'APPROVED',
        mcpWorkflowVersion: 114,
      },
    });
    await db.post.create({
      data: {
        id: child,
        parentPostId: root,
        organizationId: org,
        integrationId: integration,
        content: 'child',
        group: root,
        publishDate: new Date('2030-01-01T00:00:00Z'),
        state: 'QUEUE',
      },
    });
    await repo.registerMcpFence(org, root, integration, revision);
  });
  afterAll(async () => {
    if (db) {
      if (org) {
        await db.mcpPublishAttempt.deleteMany({
          where: { organizationId: org },
        });
        await db.mcpPublishFence.deleteMany({ where: { organizationId: org } });
        await db.mcpAgentAdmission.deleteMany({
          where: { organizationId: org },
        });
        await db.post.deleteMany({ where: { organizationId: org } });
        await db.organization.delete({ where: { id: org } });
      }
      await db.$disconnect();
    }
  });
  it('admission and cancel serialize: never both STARTED and cancellation success', async () => {
    const results = await Promise.allSettled([
      repo.claimMcpSegment(org, root, root, revision, 0),
      repo.unscheduleMcp(org, root),
    ]);
    const attempts = await repo.mcpAttempts(org, root);
    const cancelled =
      results[1].status === 'fulfilled' &&
      results[1].value.status === 'UNSCHEDULED';
    expect(cancelled && attempts.some((a) => a.status === 'STARTED')).toBe(
      false
    );
    expect(attempts.length).toBeLessThanOrEqual(1);
  });
  it('two workers cannot both acquire the same segment', async () => {
    const results = await Promise.allSettled([
      repo.claimMcpSegment(org, root, root, revision, 0),
      repo.claimMcpSegment(org, root, root, revision, 0),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await repo.mcpAttempts(org, root)).toHaveLength(1);
  });
  it('crash after provider acceptance with no stored receipt blocks every later replay', async () => {
    await repo.claimMcpSegment(org, root, root, revision, 0); // simulate accepted request, process dies here
    await expect(
      repo.claimMcpSegment(org, root, root, revision, 0)
    ).rejects.toThrow('OUTCOME_UNKNOWN');
    expect(await repo.unscheduleMcp(org, root)).toMatchObject({
      status: 'OUTCOME_UNKNOWN',
    });
    expect(await repo.resumeMcp(org, root, revision)).toMatchObject({
      status: 'OUTCOME_UNKNOWN',
    });
  });
  it('published parent receipt is reused and only adapter-confirmed unpublished child gets a new attempt', async () => {
    const parent = await repo.claimMcpSegment(org, root, root, revision, 0);
    const receipt = [
      {
        id: root,
        postId: 'remote-parent',
        releaseURL: 'https://fixture/parent',
        status: 'published',
      },
    ];
    await finish(org, parent.id, receipt);
    await db.post.update({
      where: { id: root },
      data: {
        state: 'PUBLISHED',
        releaseId: 'remote-parent',
        releaseURL: 'https://fixture/parent',
      },
    });
    const failedChild = await repo.claimMcpSegment(
      org,
      root,
      child,
      revision,
      0
    );
    await repo.markMcpUnknown(org, failedChild.id);
    // Only terminal provider-adapter evidence may invoke this repository transition.
    await repo.reconcileMcpAttempt(org, failedChild.id, 'FAILED');
    expect(await repo.resumeMcp(org, root, revision)).toMatchObject({
      status: 'RESUMED',
    });
    expect(
      await repo.claimMcpSegment(org, root, root, revision, 1)
    ).toMatchObject({ replay: true, receipt });
    expect(
      await repo.claimMcpSegment(org, root, child, revision, 1)
    ).toMatchObject({ replay: false });
    expect(
      (await db.post.findUniqueOrThrow({ where: { id: root } })).releaseId
    ).toBe('remote-parent');
  });
  it('different payload, generation and foreign tenant cannot use an attempt identity', async () => {
    await expect(
      repo.claimMcpSegment(org, root, root, 'b'.repeat(64), 0)
    ).rejects.toThrow();
    await expect(
      repo.claimMcpSegment(org, root, root, revision, 1)
    ).rejects.toThrow();
    await expect(
      repo.claimMcpSegment('foreign', root, root, revision, 0)
    ).rejects.toThrow();
    expect(await repo.mcpAttempts(org, root)).toEqual([]);
  });
  it('cancel is idempotent, keeps content and blocks stale generation admission', async () => {
    expect(await repo.unscheduleMcp(org, root)).toMatchObject({
      status: 'UNSCHEDULED',
    });
    expect(await repo.unscheduleMcp(org, root)).toMatchObject({
      status: 'UNSCHEDULED',
    });
    expect(
      await db.post.findUniqueOrThrow({ where: { id: root } })
    ).toMatchObject({
      state: 'DRAFT',
      content: 'parent',
      approvalStatus: 'IN_REVIEW',
    });
    await expect(
      repo.claimMcpSegment(org, root, root, revision, 0)
    ).rejects.toThrow();
  });
  it('an old generation cannot overwrite the state of a later revision', async () => {
    await db.mcpPublishFence.update({
      where: { postId: root },
      data: { generation: 1 },
    });
    await repo.failMcpSegment(org, root, root, 0, revision);
    expect(
      (await db.post.findUniqueOrThrow({ where: { id: root } })).state
    ).toBe('QUEUE');
  });

  it('legacy job cannot gain cancellation success without a fence', async () => {
    expect(await repo.unscheduleMcp(org, randomUUID())).toMatchObject({
      status: 'BLOCKED',
    });
  });
  it('organization admission has one owner, is reentrant only in service, and cannot be stolen by another owner', async () => {
    const attempts = await Promise.allSettled([
      repo.acquireAgentAdmission(org, 'a'),
      repo.acquireAgentAdmission(org, 'b'),
    ]);
    expect(attempts.filter((a) => a.status === 'fulfilled')).toHaveLength(1);
    const owner = (
      await db.mcpAgentAdmission.findUniqueOrThrow({
        where: { organizationId: org },
      })
    ).owner;
    expect(await repo.releaseAgentAdmission(org, 'stranger')).toMatchObject({
      count: 0,
    });
    expect(await repo.releaseAgentAdmission(org, owner)).toMatchObject({
      count: 1,
    });
  });
  it('a crashed owner can be fenced and reconciled without expiry or deleting saved posts', async () => {
    await repo.acquireAgentAdmission(org, 'crashed-owner', {
      instanceId: 'instance',
      host: 'fixture',
      processId: 7,
    });
    const draft = {
      integration: { id: integration },
      settings: { __type: 'fixture' },
      value: [{ content: 'saved before crash', image: [] }],
    } as any;
    const save = () =>
      agentAdmissionContext.run(
        { orgId: org, owner: 'crashed-owner', persistedIds: [] },
        () =>
          repo.createOrUpdatePost(
            'draft',
            org,
            '2030-01-01T00:00:00Z',
            draft,
            [],
            'MCP'
          )
      );
    const saved = await save();
    const before = await db.post.count({ where: { organizationId: org } });
    const recovered = await repo.recoverAgentAdmission(
      org,
      'crashed-owner',
      'admin-fixture'
    );
    expect(recovered.persistedPosts).toContainEqual(
      expect.objectContaining({ id: saved.posts[0].id })
    );
    await expect(save()).rejects.toThrow('recovered');
    expect(await db.post.count({ where: { organizationId: org } })).toBe(
      before
    );
    expect(
      await db.mcpAgentAdmissionRecovery.count({
        where: { organizationId: org, owner: 'crashed-owner' },
      })
    ).toBe(1);
    await repo.acquireAgentAdmission(org, 'replacement-owner');
    await repo.releaseAgentAdmission(org, 'replacement-owner');
  });

  it('receipt and published state are one transaction; cancel cannot claim to undo that segment', async () => {
    const admission = await repo.claimMcpSegment(org, root, root, revision, 0);
    const receipt = [
      {
        id: root,
        postId: 'remote-confirmed',
        releaseURL: 'https://fixture/confirmed',
        status: 'published',
      },
    ];
    await finish(org, admission.id, receipt);
    const result = await repo.unscheduleMcp(org, root);
    expect(result).toMatchObject({
      status: 'PARTIALLY_UNSCHEDULED',
      publishedSegmentIds: [root],
    });
    expect(
      await db.post.findUniqueOrThrow({ where: { id: root } })
    ).toMatchObject({ state: 'PUBLISHED', releaseId: 'remote-confirmed' });
    expect(
      await db.post.findUniqueOrThrow({ where: { id: child } })
    ).toMatchObject({ state: 'DRAFT' });
  });

  it('new queued MCP source and its version/fence commit atomically before a sweep can observe it', async () => {
    const saved = await repo.createOrUpdatePost(
      'schedule',
      org,
      '2030-01-01T00:00:00Z',
      {
        integration: { id: integration },
        settings: { __type: 'fixture' },
        value: [{ content: 'new MCP source', image: [] }],
      } as any,
      [],
      'MCP'
    );
    const post = await db.post.findUniqueOrThrow({
      where: { id: saved.posts[0].id },
    });
    expect(post).toMatchObject({ state: 'QUEUE', mcpWorkflowVersion: 114 });
    expect(await repo.mcpFence(org, post.id)).toMatchObject({
      revisionHash: expect.any(String),
      state: 'ACTIVE',
    });
    // Simulated process death before the service's redundant registration does not erase either record.
  });

  it('a terminal generation with no admitted attempts can recover, while stale closure proof cannot restart its successor', async () => {
    await db.post.update({ where: { id: root }, data: { state: 'ERROR' } });
    expect(await repo.resumeMcp(org, root, revision, 0)).toMatchObject({
      status: 'RESUMED',
    });
    expect(await repo.resumeMcp(org, root, revision, 0)).toMatchObject({
      status: 'ALREADY_ACTIVE',
    });
    expect((await repo.mcpFence(org, root))!.generation).toBe(1);
  });

  it('partial cancel holds the remaining revision until a human-approved transaction and keeps the published parent', async () => {
    const attempt = await repo.claimMcpSegment(org, root, root, revision, 0);
    await finish(org, attempt.id, [
      {
        id: root,
        postId: 'parent-receipt',
        releaseURL: 'https://fixture/parent',
        status: 'published',
      },
    ]);
    expect(await repo.unscheduleMcp(org, root)).toMatchObject({
      status: 'PARTIALLY_UNSCHEDULED',
    });
    const held = await db.post.findUniqueOrThrow({ where: { id: root } });
    expect(held).toMatchObject({
      state: 'PUBLISHED',
      approvalStatus: 'IN_REVIEW',
      releaseId: 'parent-receipt',
    });
    expect(await repo.resumeMcp(org, root, revision, 0)).toMatchObject({
      status: 'BLOCKED',
    });
    await repo.approveRemainingMcp(org, root, held.updatedAt);
    expect(
      await db.post.findUniqueOrThrow({ where: { id: child } })
    ).toMatchObject({ state: 'QUEUE', approvalStatus: 'APPROVED' });
    expect(
      await repo.claimMcpSegment(org, root, root, revision, 1)
    ).toMatchObject({ replay: true });
    expect(
      await repo.claimMcpSegment(org, root, child, revision, 1)
    ).toMatchObject({ replay: false });
  });

  it('deletion cannot bypass an uncertain publication fence and retains confirmed receipt history', async () => {
    const attempt = await repo.claimMcpSegment(org, root, root, revision, 0);
    await expect(repo.deletePost(org, root)).rejects.toThrow(
      'active or uncertain'
    );
    expect(
      (await db.post.findUniqueOrThrow({ where: { id: root } })).deletedAt
    ).toBeNull();
    await finish(org, attempt.id, [
      {
        id: root,
        postId: 'confirmed-before-local-delete',
        releaseURL: 'https://fixture/confirmed',
        status: 'published',
      },
    ]);
    await repo.deletePost(org, root);
    expect(
      (await db.post.findUniqueOrThrow({ where: { id: root } })).deletedAt
    ).not.toBeNull();
    expect((await repo.mcpAttempts(org, root))[0]).toMatchObject({
      status: 'CONFIRMED',
    });
    expect((await repo.mcpFence(org, root))!.state).toBe('CANCELLED');
  });

  it('a failed release keeps exact-owner write outcomes recoverable instead of permitting stale writes', async () => {
    await repo.acquireAgentAdmission(org, 'release-fault-owner');
    const draft = {
      integration: { id: integration },
      settings: { __type: 'fixture' },
      value: [{ content: 'release fault draft', image: [] }],
    } as any;
    const saved = await agentAdmissionContext.run(
      { orgId: org, owner: 'release-fault-owner', persistedIds: [] },
      () =>
        repo.createOrUpdatePost(
          'draft',
          org,
          '2030-01-01T00:00:00Z',
          draft,
          [],
          'MCP'
        )
    );
    const transaction = {
      model: {
        $transaction: (fn: any, options: any) =>
          db.$transaction(
            (tx) =>
              fn(
                new Proxy(tx, {
                  get: (target: any, key) =>
                    key === 'mcpAgentAdmission'
                      ? new Proxy(target[key], {
                          get: (model: any, method) =>
                            method === 'deleteMany'
                              ? async () => {
                                  throw new Error('owned release fault');
                                }
                              : typeof model[method] === 'function'
                              ? model[method].bind(model)
                              : model[method],
                        })
                      : typeof target[key] === 'function'
                      ? target[key].bind(target)
                      : target[key],
                })
              ),
            options
          ),
      },
    };
    const faultRepo = new PostsRepository(
      { model: db } as any,
      {} as any,
      {} as any,
      { model: db } as any,
      { model: db } as any,
      {} as any,
      transaction as any,
      {} as any
    );
    await expect(
      faultRepo.releaseAgentAdmission(org, 'release-fault-owner')
    ).rejects.toThrow('owned release fault');
    expect(await repo.agentAdmissionStatus(org)).toMatchObject({
      owner: 'release-fault-owner',
      writtenPostIds: expect.arrayContaining([saved.posts[0].id]),
    });
    expect(
      await repo.recoverAgentAdmission(
        org,
        'release-fault-owner',
        'fixture-admin'
      )
    ).toMatchObject({ status: 'RECOVERED' });
    await expect(
      agentAdmissionContext.run(
        { orgId: org, owner: 'release-fault-owner', persistedIds: [] },
        () =>
          repo.createOrUpdatePost(
            'draft',
            org,
            '2030-01-01T00:00:00Z',
            draft,
            [],
            'MCP'
          )
      )
    ).rejects.toThrow('recovered');
  });
  it('known-live follow-up warnings commit with receipt and published state and remain separate from publication failure', async () => {
    const attempt = await repo.claimMcpSegment(org, root, root, revision, 0);
    const receipt = [
      {
        id: root,
        postId: 'known-live-video',
        releaseURL: 'https://fixture/video',
        status: 'published',
        warning: 'Published successfully; thumbnail needs attention.',
      },
    ];
    await finish(org, attempt.id, receipt);
    expect((await repo.mcpAttempts(org, root))[0]).toMatchObject({
      status: 'CONFIRMED',
      followUpWarning: receipt[0].warning,
      receipt,
    });
    expect(
      await db.post.findUniqueOrThrow({ where: { id: root } })
    ).toMatchObject({
      state: 'PUBLISHED',
      releaseId: 'known-live-video',
      error: null,
    });
    expect(await repo.mcpWarnings(org, [root])).toEqual([
      { segmentPostId: root, followUpWarning: receipt[0].warning },
    ]);
    expect(await repo.mcpWarnings('foreign', [root])).toEqual([]);
  });

  it('a recovered Publisher save cannot submit review over a new schedule, while new-owner and standalone human controls remain valid', async () => {
    await db.post.updateMany({
      where: { organizationId: org, group: root },
      data: { state: 'DRAFT', approvalStatus: 'NONE' },
    });
    await repo.acquireAgentAdmission(org, 'review-old');
    await repo.recoverAgentAdmission(org, 'review-old', 'fixture-admin');
    expect(await repo.resumeMcp(org, root, revision, 0)).toMatchObject({
      status: 'RESUMED',
    });
    const approvalRepo = new ApprovalsRepository(
      { model: db } as any,
      { model: db } as any,
      { model: db } as any,
      { model: db } as any,
      { model: db } as any,
      { model: db } as any,
      { model: db } as any
    );
    const before = await db.post.findUniqueOrThrow({ where: { id: root } });
    const fence = await repo.mcpFence(org, root);
    const target = { id: root, group: root, mcpWorkflowVersion: 114 };
    await expect(
      agentAdmissionContext.run(
        { orgId: org, owner: 'review-old', persistedIds: [root] },
        () =>
          approvalRepo.transitionGroup(
            org,
            target,
            {},
            { state: 'DRAFT', approvalStatus: 'IN_REVIEW' }
          )
      )
    ).rejects.toBeInstanceOf(AgentSaveRecovered);
    expect(
      await db.post.findUniqueOrThrow({ where: { id: root } })
    ).toMatchObject({
      state: before.state,
      approvalStatus: before.approvalStatus,
      updatedAt: before.updatedAt,
    });
    expect(await repo.mcpFence(org, root)).toMatchObject({
      state: fence!.state,
      generation: fence!.generation,
      revisionHash: fence!.revisionHash,
    });
    await repo.acquireAgentAdmission(org, 'review-new');
    expect(
      await agentAdmissionContext.run(
        { orgId: org, owner: 'review-new', persistedIds: [] },
        () =>
          approvalRepo.transitionGroup(
            org,
            target,
            {},
            { state: 'DRAFT', approvalStatus: 'IN_REVIEW' }
          )
      )
    ).toBe(true);
    expect((await repo.agentAdmissionStatus(org))!.writtenPostIds).toEqual(
      expect.arrayContaining([root, child])
    );
    await repo.releaseAgentAdmission(org, 'review-new');
    expect(
      await approvalRepo.transitionGroup(
        org,
        target,
        { state: 'DRAFT' },
        { state: 'QUEUE', approvalStatus: 'APPROVED' }
      )
    ).toBe(true);
  });

  it('recovery waits for an already-admitted review transaction and reconciles its committed outcomes without stale follow-up authority', async () => {
    await db.post.updateMany({
      where: { organizationId: org, group: root },
      data: { state: 'DRAFT', approvalStatus: 'NONE' },
    });
    await repo.acquireAgentAdmission(org, 'held-review');
    let entered!: () => void;
    let release!: () => void;
    let recoveryEntered!: () => void;
    const observed = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const recoveryObserved = new Promise<void>((resolve) => {
      recoveryEntered = resolve;
    });
    const reviewTx = {
      model: {
        $transaction: (fn: any) =>
          db.$transaction((tx) =>
            fn(
              new Proxy(tx, {
                get: (target: any, key) =>
                  key === 'mcpPublishFence'
                    ? new Proxy(target[key], {
                        get: (model: any, method) =>
                          method === 'findFirst'
                            ? async (args: any) => {
                                const result = await model.findFirst(args);
                                entered();
                                await held;
                                return result;
                              }
                            : typeof model[method] === 'function'
                            ? model[method].bind(model)
                            : model[method],
                      })
                    : typeof target[key] === 'function'
                    ? target[key].bind(target)
                    : target[key],
              })
            )
          ),
      },
    };
    const approvalRepo = new ApprovalsRepository(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      reviewTx as any
    );
    const recoveryTx = {
      model: {
        $transaction: (fn: any, options: any) =>
          db.$transaction(
            (tx) =>
              fn(
                new Proxy(tx, {
                  get: (target: any, key) =>
                    key === 'mcpAgentAdmission'
                      ? new Proxy(target[key], {
                          get: (model: any, method) =>
                            method === 'updateMany'
                              ? async (args: any) => {
                                  recoveryEntered();
                                  return model.updateMany(args);
                                }
                              : typeof model[method] === 'function'
                              ? model[method].bind(model)
                              : model[method],
                        })
                      : typeof target[key] === 'function'
                      ? target[key].bind(target)
                      : target[key],
                })
              ),
            options
          ),
      },
    };
    const recovering = new PostsRepository(
      { model: db } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      recoveryTx as any,
      {} as any
    );
    const transition = agentAdmissionContext.run(
      { orgId: org, owner: 'held-review', persistedIds: [root] },
      () =>
        approvalRepo.transitionGroup(
          org,
          { id: root, group: root, mcpWorkflowVersion: 114 },
          { state: 'DRAFT' },
          { state: 'DRAFT', approvalStatus: 'IN_REVIEW' }
        )
    );
    await observed;
    let settled = false;
    const recovery = recovering
      .recoverAgentAdmission(org, 'held-review', 'fixture-admin')
      .then(
        (result) => {
          settled = true;
          return { result };
        },
        (error) => ({ error })
      );
    try {
      await recoveryObserved;
      expect(settled).toBe(false);
    } finally {
      release();
    }
    expect(await transition).toBe(true);
    const outcome = await recovery;
    // A Serializable loser is blocked, then retried only after the admitted
    // transaction has authoritatively completed, with a fresh DB snapshot.
    if ('error' in outcome) expect((outcome.error as any).code).toBe('P2034');
    const result =
      'error' in outcome
        ? await repo.recoverAgentAdmission(org, 'held-review', 'fixture-admin')
        : outcome.result;
    expect(result).toMatchObject({
      status: 'RECOVERED',
      persistedPosts: expect.arrayContaining([
        expect.objectContaining({ id: root, state: 'DRAFT' }),
      ]),
    });
    expect(await repo.agentAdmissionStatus(org)).toBeNull();
  });
});
