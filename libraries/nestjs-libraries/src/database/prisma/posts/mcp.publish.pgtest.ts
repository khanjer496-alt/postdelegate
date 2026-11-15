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
    await repo.finishMcpSegment(org, parent.id, receipt);
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
});
