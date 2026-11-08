// Explicit CI-only integration suite. Normal Jest runs do not match .pgtest.ts.
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { SubscriptionRepository } from './subscription.repository';

const url = process.env.PAYMENT_LEDGER_TEST_DATABASE_URL;
if (!process.env.CI || !url || new URL(url).pathname !== '/pd_security_ledger_test') {
  throw new Error('Requires CI and the dedicated pd_security_ledger_test database');
}
// A single connection proves the handler does not reserve the pool connection.
const client = new PrismaClient({ datasources: { db: { url: `${url}?connection_limit=1` } } });
const repo = new SubscriptionRepository({} as any, {} as any, {} as any, {} as any, {} as any,
  { model: client } as any);

beforeAll(async () => {
  await client.$executeRawUnsafe(readFileSync('deploy/postdelegate/payment-webhook-events.sql', 'utf8'));
});
beforeEach(async () => { await client.$executeRaw`DELETE FROM "PaymentWebhookEvent"`; });
afterAll(async () => { await client.$disconnect(); });

it('serializes duplicate deliveries and allows handler queries with a one-connection pool', async () => {
  const handler = jest.fn(async () => {
    await client.$queryRaw`SELECT 1`;
    await new Promise(resolve => setTimeout(resolve, 25));
    return { ok: true };
  });
  const results = await Promise.all([
    repo.processPaymentEvent('stripe', 'evt_duplicate', handler),
    repo.processPaymentEvent('stripe', 'evt_duplicate', handler),
  ]);
  expect(handler).toHaveBeenCalledTimes(1);
  expect(results).toContainEqual({ ok: true });
  await expect(repo.processPaymentEvent('stripe', 'evt_duplicate', handler)).resolves.toEqual({ ok: true });
  expect(handler).toHaveBeenCalledTimes(1);
});

it('reclaims an expired worker lease', async () => {
  await client.$executeRaw`INSERT INTO "PaymentWebhookEvent" ("provider", "eventId", "claimToken", "claimUntil")
    VALUES ('stripe', 'evt_expired', 'dead-worker', NOW() - INTERVAL '1 minute')`;
  const handler = jest.fn(async () => ({ ok: true }));
  await repo.processPaymentEvent('stripe', 'evt_expired', handler);
  expect(handler).toHaveBeenCalledTimes(1);
  const rows = await client.$queryRaw<Array<{ processedAt: Date }>>`SELECT "processedAt" FROM "PaymentWebhookEvent"`;
  expect(rows[0].processedAt).toBeInstanceOf(Date);
});

it('releases retryable failures instead of marking them complete', async () => {
  const handler = jest.fn().mockResolvedValueOnce({ retry: true }).mockResolvedValueOnce({ ok: true });
  await repo.processPaymentEvent('stripe', 'evt_retry', handler);
  await repo.processPaymentEvent('stripe', 'evt_retry', handler);
  expect(handler).toHaveBeenCalledTimes(2);
});
