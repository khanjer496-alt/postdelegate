import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { AuthProviderAbstract } from '../providers.interface';
import { AuthProviderManager } from './providers.manager';

const originalEnv = process.env;
const originalMetadata = Reflect.getMetadata(
  'auth-provider',
  AuthProviderAbstract
);
const targets: Record<string, unknown> = {
  WALLET: class Wallet {},
  FARCASTER: class Farcaster {},
  GOOGLE: class Google {},
  GITHUB: class Github {},
};
const instance = {
  generateLink: jest.fn(),
  getToken: jest.fn(),
  getUser: jest.fn(),
};
const resolve = jest.fn(() => instance);
const manager = new AuthProviderManager({ get: resolve } as any);

beforeEach(() => {
  process.env = { ...originalEnv };
  delete process.env.AUTH_WALLET_LOGIN_ENABLED;
  delete process.env.WALLET_LOGIN_ENABLED;
  delete process.env.FARCASTER_LOGIN_ENABLED;
  // Channel credentials alone must never enable authentication.
  process.env.NEYNAR_SECRET_KEY = 'example-channel-key';
  Reflect.defineMetadata(
    'auth-provider',
    Object.entries(targets).map(([provider, target]) => ({ provider, target })),
    AuthProviderAbstract
  );
  resolve.mockClear();
});
afterAll(() => {
  process.env = originalEnv;
  Reflect.defineMetadata(
    'auth-provider',
    originalMetadata,
    AuthProviderAbstract
  );
});

describe.each([
  ['WALLET', 'AUTH_WALLET_LOGIN_ENABLED'],
  ['FARCASTER', 'FARCASTER_LOGIN_ENABLED'],
])('%s auth enable flag', (provider, enableFlag) => {
  it.each([undefined, '', 'false', 'TRUE', '1', ' true '])(
    'refuses before provider resolution when the flag is %s',
    (flag) => {
      if (flag !== undefined) process.env[enableFlag] = flag;
      expect(() => manager.getProvider(provider)).toThrow(BadRequestException);
      expect(resolve).not.toHaveBeenCalled();
    }
  );
  it('requires its own flag even when the other provider is enabled', () => {
    process.env[
      provider === 'WALLET'
        ? 'FARCASTER_LOGIN_ENABLED'
        : 'AUTH_WALLET_LOGIN_ENABLED'
    ] = 'true';
    expect(() => manager.getProvider(provider)).toThrow(BadRequestException);
    expect(resolve).not.toHaveBeenCalled();
  });
  it('resolves only with its explicit true flag, and refuses again if switched off', () => {
    process.env[enableFlag] = 'true';
    expect(manager.getProvider(provider)).toBe(instance);
    expect(resolve).toHaveBeenCalledWith(targets[provider], { strict: false });
    process.env[enableFlag] = 'false';
    resolve.mockClear();
    expect(() => manager.getProvider(provider)).toThrow(BadRequestException);
    expect(resolve).not.toHaveBeenCalled();
  });
});
it.each(['GOOGLE', 'GITHUB'])(
  'keeps %s available without the flags',
  (provider) => {
    expect(manager.getProvider(provider)).toBe(instance);
    expect(resolve).toHaveBeenCalledWith(targets[provider], { strict: false });
  }
);
it('does not enable wallet auth with the superseded WALLET_LOGIN_ENABLED name', () => {
  process.env.WALLET_LOGIN_ENABLED = 'true';
  expect(() => manager.getProvider('WALLET')).toThrow(BadRequestException);
  expect(resolve).not.toHaveBeenCalled();
});
it('still rejects an unregistered provider', () => {
  expect(() => manager.getProvider('not-a-provider')).toThrow('not found');
  expect(resolve).not.toHaveBeenCalled();
});
