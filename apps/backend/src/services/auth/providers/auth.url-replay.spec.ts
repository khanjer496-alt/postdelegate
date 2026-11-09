// Characterizes the existing auth providers using synthetic signatures/signers.
// Farcaster acceptance here records an unresolved replay risk, not a security gate.
import 'reflect-metadata';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const mockValues = new Map<string, string>();
const mockLookup = jest.fn();
jest.mock('@neynar/nodejs-sdk', () => ({
  NeynarAPIClient: class { lookupSigner(input: unknown) { return mockLookup(input); } },
}));
jest.mock('@gitroom/nestjs-libraries/redis/redis.service', () => ({
  ioRedis: {
    get: async (key: string) => mockValues.get(key) || null,
    set: async (key: string, value: string, ...options: unknown[]) => {
      if (options.includes('NX') && mockValues.has(key)) return null;
      mockValues.set(key, value); return 'OK';
    },
    del: async (key: string) => Number(mockValues.delete(key)),
  },
}));
import { WalletProvider } from './wallet.provider';
import { FarcasterProvider } from './farcaster.provider';

beforeEach(() => { mockValues.clear(); mockLookup.mockReset(); });

it('rejects a wallet signed challenge after its first successful exchange', async () => {
  const wallet = new WalletProvider();
  const pair = nacl.sign.keyPair();
  const publicKey = bs58.encode(pair.publicKey);
  const challenge = await wallet.generateLink({ publicKey });
  const signature = Buffer.from(nacl.sign.detached(new TextEncoder().encode(challenge), pair.secretKey)).toString('hex');
  const code = Buffer.from(JSON.stringify({ publicKey, challenge, signature })).toString('base64');
  const token = await wallet.getToken(code);
  expect(token).toBeTruthy();
  await expect(wallet.getUser(token)).resolves.toMatchObject({ id: `wallet_${publicKey}` });
  await expect(wallet.getToken(code)).resolves.toBe('');
});

it('rejects the legacy approved signer UUID login code even when configured', async () => {
  const old = process.env.FARCASTER_LOGIN_ENABLED;
  process.env.FARCASTER_LOGIN_ENABLED='true';
  const farcaster = new FarcasterProvider();
  mockLookup.mockResolvedValue({ status: 'approved', fid: 123 });
  const code = Buffer.from(JSON.stringify({ signer_uuid: 'EXAMPLE-signer-uuid' })).toString('base64');
  await expect(farcaster.getToken(code)).rejects.toThrow();
  expect(mockLookup).not.toHaveBeenCalled();
  if (old === undefined) delete process.env.FARCASTER_LOGIN_ENABLED; else process.env.FARCASTER_LOGIN_ENABLED=old;
});
