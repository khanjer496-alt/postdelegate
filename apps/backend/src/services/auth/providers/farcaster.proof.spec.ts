import 'reflect-metadata';
const values = new Map<string, string>();
const lookup = jest.fn();
const createSigner = jest.fn();
jest.mock('@neynar/nodejs-sdk', () => ({
  NeynarAPIClient: class {
    lookupSigner(input: any) {
      return lookup(input);
    }
  },
}));
jest.mock(
  '@gitroom/nestjs-libraries/integrations/social/farcaster.provider',
  () => ({
    FarcasterProvider: class {
      createSigner() {
        return createSigner();
      }
    },
  })
);
jest.mock('@gitroom/nestjs-libraries/redis/redis.service', () => ({
  ioRedis: {
    get: async (key: string) => values.get(key) || null,
    set: async (key: string, value: string, ...options: any[]) => {
      if (options.includes('NX') && values.has(key)) return null;
      values.set(key, value);
      return 'OK';
    },
    eval: async (
      _script: string,
      _keys: number,
      key: string,
      binding: string,
      state: string,
      purpose: string
    ) => {
      const raw = values.get(key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (
        data.nonceHash !== binding ||
        data.state !== state ||
        data.purpose !== purpose ||
        data.expiresAt <= Date.now()
      )
        return null;
      values.delete(key);
      return raw;
    },
  },
}));
import { FarcasterProvider } from './farcaster.provider';
const nonce = 'a'.repeat(64);
const originalEnv = { ...process.env };
const context = (state: string, purpose = 'login', browserNonce = nonce) => ({
  state,
  browserNonce,
  purpose,
});
beforeEach(() => {
  values.clear();
  lookup.mockReset();
  createSigner.mockReset();
  process.env.NEYNAR_SECRET_KEY = 'EXAMPLE-key';
  process.env.FARCASTER_LOGIN_ENABLED = 'true';
  createSigner.mockResolvedValue({
    signerUuid: 'server-created-signer',
    approvalUrl: 'https://example.test/approve',
    qrCode: 'data:example',
  });
  lookup.mockResolvedValue({ status: 'approved', fid: 42 });
});
afterEach(() => {
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});
const approve = async () => {
  const provider = new FarcasterProvider() as any;
  const flow = await provider.startLogin(nonce);
  return {
    provider,
    flow,
    proof: await provider.loginStatus(flow.state, nonce),
  };
};
it('rejects bare approved signer UUID codes before Neynar lookup', async () => {
  const code = Buffer.from(
    JSON.stringify({ signer_uuid: 'stolen-approved-signer' })
  ).toString('base64');
  await expect(new FarcasterProvider().getToken(code)).rejects.toThrow();
  expect(lookup).not.toHaveBeenCalled();
});
it('binds the signer at creation and never accepts a client-supplied signer substitution', async () => {
  const { flow, proof } = await approve();
  expect(flow.signerUuid).toBeUndefined();
  expect(proof.code).toMatch(/^fcp_[a-f0-9]{64}$/);
  expect(JSON.stringify(proof)).not.toContain('server-created-signer');
  expect(lookup).toHaveBeenCalledWith({ signerUuid: 'server-created-signer' });
});
it('rejects another browser without consuming the legitimate proof', async () => {
  const { provider, flow, proof } = await approve();
  await expect(
    provider.getToken(
      proof.code,
      undefined,
      context(flow.state, 'login', 'b'.repeat(64))
    )
  ).rejects.toThrow();
  const ticket = await provider.getToken(
    proof.code,
    undefined,
    context(flow.state)
  );
  expect(ticket).toMatch(/^fcl_[a-f0-9]{64}$/);
  await expect(
    provider.getToken(proof.code, undefined, context(flow.state))
  ).rejects.toThrow();
});
it('requires private binding even on a cookie-less redirect_uri request', async () => {
  const { provider, proof, flow } = await approve();
  await expect(
    provider.getToken(proof.code, 'app://callback', { state: flow.state })
  ).rejects.toThrow();
});
it('permits only one of two concurrent redemptions', async () => {
  const { provider, proof, flow } = await approve();
  const results = await Promise.allSettled([
    provider.getToken(proof.code, undefined, context(flow.state)),
    provider.getToken(proof.code, undefined, context(flow.state)),
  ]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
});
it('expires proofs and does not redeem a revoked signer', async () => {
  const { provider, proof, flow } = await approve();
  const now = Date.now();
  jest.spyOn(Date, 'now').mockReturnValue(now + 61000);
  await expect(
    provider.getToken(proof.code, undefined, context(flow.state))
  ).rejects.toThrow();
  jest.restoreAllMocks();
  const next = await approve();
  lookup.mockResolvedValue({ status: 'revoked', fid: 42 });
  await expect(
    next.provider.getToken(next.proof.code, undefined, context(next.flow.state))
  ).rejects.toThrow();
});
it('makes login and registration continuation purpose-separated and single-use', async () => {
  const { provider, proof, flow } = await approve();
  const ticket = await provider.getToken(
    proof.code,
    undefined,
    context(flow.state)
  );
  await expect(
    provider.getUser(ticket, context(flow.state, 'register'))
  ).rejects.toThrow();
  const user = await provider.getUser(ticket, context(flow.state));
  expect([...values.values()].join(' ')).not.toContain('server-created-signer');
  expect(user.id).toBe('farcaster_42');
  expect(user.registrationToken).toMatch(/^fcr_[a-f0-9]{64}$/);
  await expect(provider.getUser(ticket, context(flow.state))).rejects.toThrow();
  await expect(
    provider.getUser(user.registrationToken, context(flow.state, 'register'))
  ).resolves.toEqual({ id: 'farcaster_42', email: 'farcaster_42' });
  await expect(
    provider.getUser(user.registrationToken, context(flow.state, 'register'))
  ).rejects.toThrow();
});
it("cannot poll/approve somebody else's state and issues only one proof per approval", async () => {
  const provider = new FarcasterProvider() as any;
  const flow = await provider.startLogin(nonce);
  await expect(
    provider.loginStatus(flow.state, 'b'.repeat(64))
  ).rejects.toThrow();
  expect(lookup).not.toHaveBeenCalled();
  await provider.loginStatus(flow.state, nonce);
  await expect(provider.loginStatus(flow.state, nonce)).rejects.toThrow();
});

it('requires auth-specific enablement even if channel credentials are configured', async () => {
  delete process.env.FARCASTER_LOGIN_ENABLED;
  await expect(
    (new FarcasterProvider() as any).startLogin(nonce)
  ).rejects.toThrow();
  expect(createSigner).not.toHaveBeenCalled();
  const active = await (async () => {
    process.env.FARCASTER_LOGIN_ENABLED = 'true';
    return approve();
  })();
  delete process.env.FARCASTER_LOGIN_ENABLED;
  await expect(
    active.provider.getToken(
      active.proof.code,
      undefined,
      context(active.flow.state)
    )
  ).rejects.toThrow();
});
