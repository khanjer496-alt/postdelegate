import { PrismaClient } from '@prisma/client';
import { AgentCredentialRepository } from '../database/prisma/agent-credentials/agent.credential.repository';
import { AgentCredentialService } from './agent-credential.service';
import { runWithContext } from './async.storage';

// Dedicated CI database/schema only. Never falls back to DATABASE_URL.
const url = process.env.AGENT_CREDENTIAL_TEST_DATABASE_URL;
const pg = url ? describe : describe.skip;
pg('agent credentials PostgreSQL lifecycle', () => {
  let db: PrismaClient;
  let service: AgentCredentialService;
  let orgId: string;
  let otherId: string;
  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url } } });
    service = new AgentCredentialService(
      new AgentCredentialRepository(db as any)
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
