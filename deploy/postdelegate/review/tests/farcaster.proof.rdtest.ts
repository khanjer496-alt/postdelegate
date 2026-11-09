// Real Redis, ONLY in an explicitly enabled isolated local CI test service.
import 'reflect-metadata';
import { createHash } from 'crypto';
const mockLookup = jest.fn();
jest.mock('@neynar/nodejs-sdk', () => ({
  NeynarAPIClient: class {
    lookupSigner(input: any) {
      return mockLookup(input);
    }
  },
}));
jest.mock(
  '@gitroom/nestjs-libraries/integrations/social/farcaster.provider',
  () => ({
    FarcasterProvider: class {
      async createSigner() {
        return {
          signerUuid: 'EXAMPLE-signer',
          approvalUrl: 'https://example.test/approve',
          qrCode: 'example',
        };
      }
    },
  })
);
const url = new URL(process.env.REDIS_URL || 'http://invalid');
if (
  process.env.FARCASTER_PROOF_TEST_REDIS !== '1' ||
  !['localhost', '127.0.0.1'].includes(url.hostname) ||
  url.port !== '6391'
)
  throw new Error(
    'Use the isolated Redis test service on localhost:6391 only.'
  );
// Require only AFTER the safety check; never connect a client to an arbitrary URL.
const { ioRedis } = require('@gitroom/nestjs-libraries/redis/redis.service');
const {
  FarcasterProvider,
} = require('@gitroom/backend/services/auth/providers/farcaster.provider');
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const ownedKeys = new Set<string>();
const remember = (stage: string, code: string) => {
  ownedKeys.add(`farcaster-auth:${stage}:${hash(code)}`);
  return code;
};
const nonce = 'c'.repeat(64);
beforeEach(() => {
  process.env.NEYNAR_SECRET_KEY = 'EXAMPLE-test-key';
  mockLookup.mockReset();
  mockLookup.mockResolvedValue({ status: 'approved', fid: 42 });
});
afterEach(async () => {
  if (ownedKeys.size) await ioRedis.del(...ownedKeys);
  ownedKeys.clear();
});
afterAll(() => ioRedis.disconnect());
const approved = async () => {
  const provider = new FarcasterProvider();
  const flow = await provider.startLogin(nonce);
  remember('flow', flow.state);
  const proof = await provider.loginStatus(flow.state, nonce);
  remember('proof', proof.code);
  return {
    provider,
    flow,
    proof,
    context: { state: flow.state, browserNonce: nonce, purpose: 'login' },
  };
};
it('atomically permits exactly one simultaneous proof redemption in real Redis', async () => {
  const { provider, proof, context } = await approved();
  const result = await Promise.allSettled([
    provider.getToken(proof.code, undefined, context),
    provider.getToken(proof.code, undefined, context),
  ]);
  expect(result.filter((r: any) => r.status === 'fulfilled')).toHaveLength(1);
  expect(result.filter((r: any) => r.status === 'rejected')).toHaveLength(1);
  for (const r of result)
    if (r.status === 'fulfilled') remember('login', r.value);
});
it('wrong binding cannot consume the legitimate Redis record', async () => {
  const { provider, proof, context } = await approved();
  await expect(
    provider.getToken(proof.code, undefined, {
      ...context,
      browserNonce: 'd'.repeat(64),
    })
  ).rejects.toThrow();
  remember('login', await provider.getToken(proof.code, undefined, context));
});
it('the Lua consume checks actual expiry even if it changes after the first read', async () => {
  const { provider, proof, context } = await approved();
  const key = `farcaster-auth:proof:${hash(proof.code)}`;
  mockLookup.mockImplementation(async () => {
    const raw = JSON.parse(await ioRedis.get(key));
    await ioRedis.set(
      key,
      JSON.stringify({ ...raw, expiresAt: Date.now() - 1000 }),
      'EX',
      60
    );
    return { status: 'approved', fid: 42 };
  });
  await expect(
    provider.getToken(proof.code, undefined, context)
  ).rejects.toThrow();
});
it('registration continuation is separately bound and consumed exactly once', async () => {
  const { provider, proof, context } = await approved();
  const ticket = remember(
    'login',
    await provider.getToken(proof.code, undefined, context)
  );
  const identity = await provider.getUser(ticket, context);
  remember('register', identity.registrationToken);
  await expect(
    provider.getUser(identity.registrationToken, {
      ...context,
      purpose: 'register',
      browserNonce: 'd'.repeat(64),
    })
  ).rejects.toThrow();
  await expect(
    provider.getUser(identity.registrationToken, {
      ...context,
      purpose: 'register',
    })
  ).resolves.toEqual({ id: 'farcaster_42', email: 'farcaster_42' });
  await expect(
    provider.getUser(identity.registrationToken, {
      ...context,
      purpose: 'register',
    })
  ).rejects.toThrow();
});
