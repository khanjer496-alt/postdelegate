jest.mock('../database/prisma/approvals/approval.policy.service', () => ({
  ApprovalPolicyService: class {},
}));
import { PrismaClient } from '@prisma/client';
import { AgentCredentialRepository } from '../database/prisma/agent-credentials/agent.credential.repository';
import { AgentCredentialService } from './agent-credential.service';
import { runWithContext } from './async.storage';

// Dedicated CI database/schema only. Never falls back to DATABASE_URL.
const url = process.env.AGENT_CREDENTIAL_TEST_DATABASE_URL;
const pg = url ? describe : describe.skip;
// Keep the real Prisma transaction and every additive model delegate. Only
// the selected post update is intercepted by deterministic fault/barrier tests.
const withPostUpdate = (tx: any, update: (args: any) => Promise<any>) =>
  new Proxy(tx, {
    get(target, key) {
      if (key === 'post')
        return new Proxy(target.post, {
          get(post, operation) {
            if (operation === 'update') return update;
            const value = Reflect.get(post, operation);
            return typeof value === 'function' ? value.bind(post) : value;
          },
        });
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

pg('agent credentials PostgreSQL lifecycle', () => {
  let db: PrismaClient;
  let service: AgentCredentialService;
  let orgId: string;
  let otherId: string;
  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url } } });
    service = new AgentCredentialService(
      new AgentCredentialRepository(db as any),
      { assertAgentGuardrails: async () => undefined } as any
    );
    orgId = (
      await db.organization.create({
        data: { name: 'Disposable agent fixture' },
      })
    ).id;
    otherId = (
      await db.organization.create({
        data: { name: 'Disposable foreign tenant' },
      })
    ).id;
  });
  afterAll(async () => {
    if (db) {
      if (orgId && otherId)
        await db.organization.deleteMany({
          where: { id: { in: [orgId, otherId] } },
        });
      await db.$disconnect();
    }
  });
  it('stores only verifier/metadata, scopes revocation by tenant and rejects the next open-session call', async () => {
    const { credential, secret } = await service.create(orgId, {
      name: 'One assistant',
    });
    const stored = await db.agentCredential.findUniqueOrThrow({
      where: { id: credential.id },
    });
    expect(JSON.stringify(stored)).not.toContain(secret);
    expect(stored.secretHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.role).toBe('DRAFT_ONLY');
    expect(stored.expiresAt!.getTime() - Date.now()).toBeGreaterThan(
      29.99 * 86400000
    );
    expect(JSON.stringify(await service.list(orgId))).not.toMatch(
      /secretHash|mca_/
    );
    expect(await service.list(otherId)).toEqual([]);
    expect((await service.revoke(otherId, credential.id)).count).toBe(0);
    expect(await service.resolve(secret)).toMatchObject({
      credentialId: credential.id,
    });
    await runWithContext(
      {
        requestId: 'pg',
        auth: { id: orgId },
        agentCredentialId: credential.id,
      },
      async () => {
        await expect(
          service.authorizeTool('integrationList', {})
        ).resolves.toEqual({});
        await service.revoke(orgId, credential.id);
        await expect(
          service.authorizeTool('integrationList', {})
        ).rejects.toThrow();
      }
    );
    expect(await service.resolve(secret)).toBeNull();
    expect((await service.revoke(orgId, credential.id)).count).toBe(0);
  });
  it('honors expiry with a real stored timestamp and preserves explicit empty channel policy', async () => {
    const { credential, secret } = await service.create(orgId, {
      name: 'Expiring',
      channelIds: [],
    });
    expect(credential.channelIds).toEqual([]);
    await db.agentCredential.update({
      where: { id: credential.id },
      data: { expiresAt: new Date(0) },
    });
    expect(await service.resolve(secret)).toBeNull();
  });
});

pg('Draft-only PostgreSQL whole-thread claims', () => {
  let db: PrismaClient;
  let orgId: string;
  let channelId: string;
  const fixture = async () => {
    const root = await db.post.create({
      data: {
        organizationId: orgId,
        integrationId: channelId,
        group: 'thread-' + Math.random(),
        content: 'original root',
        image: '[]',
        state: 'DRAFT',
        publishDate: new Date('2026-12-01T10:00:00Z'),
      },
    });
    const child = await db.post.create({
      data: {
        organizationId: orgId,
        integrationId: channelId,
        group: root.group,
        parentPostId: root.id,
        content: 'original child',
        image: '[]',
        state: 'DRAFT',
        publishDate: root.publishDate,
      },
    });
    return [root, child];
  };
  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url } } });
    orgId = (
      await db.organization.create({
        data: { name: 'Disposable draft-race fixture' },
      })
    ).id;
    channelId = (
      await db.integration.create({
        data: {
          organizationId: orgId,
          internalId: 'fixture',
          name: 'Fixture',
          type: 'social',
          providerIdentifier: 'fixture',
          token: 'nonfunctional-fixture',
        },
      })
    ).id;
  });
  afterAll(async () => {
    if (db) {
      if (orgId) {
        await db.post.deleteMany({ where: { organizationId: orgId } });
        await db.integration.deleteMany({ where: { organizationId: orgId } });
        await db.organization.delete({ where: { id: orgId } });
      }
      await db.$disconnect();
    }
  });
  const edit = async (posts: any[], transactionModel: any = db) => {
    const { PostsRepository } = await import(
      '../database/prisma/posts/posts.repository'
    );
    const model = { model: db } as any;
    const repo = new PostsRepository(
      model,
      model,
      model,
      model,
      model,
      model,
      { model: transactionModel } as any,
      model
    );
    return runWithContext(
      {
        requestId: 'pg-edit',
        auth: { id: orgId },
        agentCredentialId: 'fixture',
        agentPrincipal: {
          id: 'fixture',
          organizationId: orgId,
          role: 'DRAFT_ONLY',
          channelIds: [channelId],
        },
      },
      () =>
        repo.createOrUpdatePost(
          'update',
          orgId,
          '2026-12-01T11:00:00Z',
          {
            integration: { id: channelId },
            group: posts[0].group,
            settings: {},
            value: posts.map((post) => ({
              id: post.id,
              content: 'edited ' + post.content,
              image: [],
            })),
          } as any,
          [],
          'MCP',
          undefined,
          true,
          undefined,
          {
            requireExistingDraft: true,
            expectedDraftUpdatedAt: posts[0].updatedAt,
          }
        )
    );
  };
  it.each(['QUEUE', 'PUBLISHED'] as const)(
    'conflicts if the authorized DRAFT became %s without creating or deleting any row',
    async (state) => {
      const posts = await fixture();
      await db.post.update({ where: { id: posts[0].id }, data: { state } });
      const before = await db.post.findMany({
        where: { group: posts[0].group },
        orderBy: { id: 'asc' },
      });
      await expect(edit(posts)).rejects.toThrow('draft changed');
      expect(
        await db.post.findMany({
          where: { group: posts[0].group },
          orderBy: { id: 'asc' },
        })
      ).toEqual(before);
    }
  );
  it('rolls back the root when a child loses its conditional state claim', async () => {
    const posts = await fixture();
    const before = await db.post.findMany({
      where: { group: posts[0].group },
      orderBy: { id: 'asc' },
    });
    const transactionModel = {
      $transaction: (fn: any, options: any) =>
        db.$transaction(
          async (tx) =>
            fn(
              withPostUpdate(tx, async (args: any) => {
                if (args.where.id === posts[1].id)
                  await tx.post.update({
                    where: { id: posts[1].id },
                    data: { state: 'PUBLISHED' },
                  });
                return tx.post.update(args);
              })
            ),
          options
        ),
    };
    await expect(edit(posts, transactionModel)).rejects.toThrow(
      'draft changed'
    );
    expect(
      await db.post.findMany({
        where: { group: posts[0].group },
        orderBy: { id: 'asc' },
      })
    ).toEqual(before);
  });
  it('edits the complete eligible thread in one commit and invalidates prior approval', async () => {
    const posts = await fixture();
    posts[0] = await db.post.update({
      where: { id: posts[0].id },
      data: { approvalStatus: 'APPROVED' },
    });
    const result = await edit(posts);
    expect(result.posts.map((post) => post.id)).toEqual(
      posts.map((post) => post.id)
    );
    expect(
      result.posts.every(
        (post) =>
          post.state === 'DRAFT' &&
          post.approvalStatus === 'IN_REVIEW' &&
          post.content.startsWith('edited')
      )
    ).toBe(true);
  });
  it('serializes a stale approval behind the root claim until the whole payload commits', async () => {
    const posts = await fixture();
    posts[0] = await db.post.update({
      where: { id: posts[0].id },
      data: { updatedAt: new Date('2000-01-01') },
    });
    let claimed!: () => void;
    let release!: () => void;
    const rootClaimed = new Promise<void>((resolve) => {
      claimed = resolve;
    });
    const continueEdit = new Promise<void>((resolve) => {
      release = resolve;
    });
    const transactionModel = {
      $transaction: (fn: any, options: any) =>
        db.$transaction(
          async (tx) =>
            fn(
              withPostUpdate(tx, async (args: any) => {
                const updated = await tx.post.update(args);
                if (args.where.id === posts[0].id) {
                  claimed();
                  await continueEdit;
                }
                return updated;
              })
            ),
          options
        ),
    };
    const editing = edit(posts, transactionModel);
    await Promise.race([
      rootClaimed,
      editing.then(() => {
        throw new Error('The edit completed before the root barrier.');
      }),
    ]);
    const staleApproval = db.post.updateMany({
      where: { id: posts[0].id, updatedAt: posts[0].updatedAt, state: 'DRAFT' },
      data: { state: 'QUEUE', approvalStatus: 'APPROVED' },
    });
    // Start the competing query while the edit owns the root row lock.
    const approval = staleApproval.then((result) => result);
    await new Promise((resolve) => setTimeout(resolve, 25));
    release();
    await editing;
    expect((await approval).count).toBe(0);
    const saved = await db.post.findMany({ where: { group: posts[0].group } });
    expect(
      saved.every(
        (post) => post.state === 'DRAFT' && post.content.startsWith('edited')
      )
    ).toBe(true);
  });
  it('still creates a new DRAFT through the positive creation path', async () => {
    const { PostsRepository } = await import(
      '../database/prisma/posts/posts.repository'
    );
    const model = { model: db } as any;
    const repo = new PostsRepository(
      model,
      model,
      model,
      model,
      model,
      model,
      model,
      model
    );
    const result = await runWithContext(
      {
        requestId: 'pg-new',
        auth: { id: orgId },
        agentCredentialId: 'fixture',
        agentPrincipal: {
          id: 'fixture',
          organizationId: orgId,
          role: 'DRAFT_ONLY',
          channelIds: [channelId],
        },
      },
      () =>
        repo.createOrUpdatePost(
          'draft',
          orgId,
          '2026-12-01T11:00:00Z',
          {
            integration: { id: channelId },
            settings: {},
            value: [{ content: 'new fixture draft', image: [] }],
          } as any,
          [],
          'MCP'
        )
    );
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0].state).toBe('DRAFT');
  });
});
