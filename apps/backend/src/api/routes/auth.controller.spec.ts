jest.mock('@gitroom/backend/services/auth/auth.service', () => ({ AuthService: class {} }));
jest.mock('@gitroom/nestjs-libraries/services/email.service', () => ({ EmailService: class {} }));
jest.mock('@gitroom/nestjs-libraries/integrations/social/farcaster.provider', () => ({ FarcasterProvider: class {} }));
jest.mock('@sentry/nestjs', () => ({ metrics: { count: jest.fn() } }));
jest.mock('@gitroom/nestjs-libraries/database/prisma/users/users.service', () => ({ UsersService: class {} }));
jest.mock('@gitroom/backend/services/auth/auth.middleware', () => ({ getSessionUser: jest.fn(async () => null) }));

import { ThrottlerRealIpGuard } from '@gitroom/nestjs-libraries/throttler/throttler.provider';
import { AuthController } from './auth.controller';
import { getSessionUser } from '@gitroom/backend/services/auth/auth.middleware';

// MeasurementService never throws; these flows only need it to answer
const measurement = {
  signupAttempt: jest.fn(async () => undefined),
  rememberHandoff: jest.fn(async () => undefined),
  handoff: jest.fn(async () => undefined),
};

const proto: any = AuthController.prototype;

const limitOf = (name: string) => ({
  guards: Reflect.getMetadata('__guards__', proto[name]) || [],
  limit: Reflect.getMetadata('THROTTLER:LIMITdefault', proto[name]),
  ttl: Reflect.getMetadata('THROTTLER:TTLdefault', proto[name]),
});

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

describe('AuthController rate limits', () => {
  it.each([
    ['login', 10, MINUTE],
    ['register', 10, HOUR],
    ['forgot', 5, HOUR],
    ['forgotReturn', 10, HOUR],
    ['activate', 20, HOUR],
    ['resendActivation', 5, HOUR],
    ['oauthExists', 30, 10 * MINUTE],
    ['oauthLink', 60, MINUTE],
  ])('%s is limited per client address', (name, limit, ttl) => {
    const found = limitOf(name);
    expect(found.guards).toContain(ThrottlerRealIpGuard);
    expect(found.limit).toBe(limit);
    expect(found.ttl).toBe(ttl);
  });
});

describe('AuthController account enumeration', () => {
  const make = (service: object) =>
    new AuthController(
      service as any,
      {} as any,
      {} as any,
      measurement as any
    );

  it('answers /forgot the same for every outcome', async () => {
    for (const forgot of [
      jest.fn().mockResolvedValue(true),
      jest.fn().mockResolvedValue(false),
      jest.fn().mockRejectedValue(new Error('smtp down')),
    ]) {
      expect(await make({ forgot }).forgot({ email: 'a@b.c' } as any)).toEqual({
        forgot: true,
      });
    }
  });

  it('answers /resend-activation the same for every outcome', async () => {
    for (const resendActivationEmail of [
      jest.fn().mockResolvedValue(true),
      jest.fn().mockResolvedValue(false),
      jest.fn().mockRejectedValue(new Error('User not found')),
    ]) {
      expect(
        await make({ resendActivationEmail }).resendActivation({
          email: 'a@b.c',
        } as any)
      ).toEqual({ success: true });
    }
  });
});

describe('AuthController referral cookie', () => {
  const response = () => {
    const res: any = {
      header: jest.fn(),
      cookie: jest.fn(),
      status: jest.fn(() => res),
      json: jest.fn(),
      send: jest.fn(),
    };
    return res;
  };

  it.each(['register', 'login'] as const)(
    '%s hands the referral cookie to the auth service',
    async (name) => {
      const routeAuth = jest
        .fn()
        .mockResolvedValue({ jwt: 'jwt', addedOrg: false });
      const controller = new AuthController(
        {
          routeAuth,
          getOrgFromCookie: jest.fn().mockReturnValue(false),
        } as any,
        { hasProvider: () => false } as any,
        {} as any,
        measurement as any
      );

      await (controller as any)[name](
        { cookies: { pd_ref: 'friend.1790000000000' } },
        { provider: 'LOCAL', email: 'a@b.c', password: 'secret' },
        response(),
        '1.1.1.1',
        'agent'
      );

      expect(routeAuth).toHaveBeenCalledWith(
        'LOCAL',
        expect.anything(),
        '1.1.1.1',
        'agent',
        false,
        'friend.1790000000000'
      );
    }
  );
});

describe('AuthController invite cookie', () => {
  const response = () => {
    const res: any = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
      header: jest.fn(),
      json: jest.fn(),
      send: jest.fn(),
    };
    res.status = jest.fn(() => res);
    return res;
  };
  const login = (addedOrg: unknown) =>
    new AuthController(
      {
        getOrgFromCookie: jest.fn(() => ({ id: 'i1', orgId: 'o1', role: 'USER' })),
        routeAuth: jest.fn(async () => ({ jwt: 'jwt', addedOrg })),
      } as any,
      {} as any,
      {} as any,
      measurement as any
    );

  it.each([
    ['joined', { organizationId: 'o1' }],
    ['already a member', { failed: 'already_member' }],
    ['refused', { failed: 'wrong_email' }],
  ])('spends the invite cookie on a sign in that %s', async (_, addedOrg) => {
    const res = response();
    await login(addedOrg).login(
      { cookies: { org: 'invite-token' } } as any,
      { provider: 'LOCAL' } as any,
      res,
      '1.1.1.1',
      'agent'
    );
    expect(res.clearCookie).toHaveBeenCalledWith('org', expect.objectContaining({ path: '/' }));
  });

  it('does not warn a member that their accepted invite was used', async () => {
    const res = response();
    await login({ failed: 'already_member' }).login(
      { cookies: { org: 'invite-token' } } as any,
      { provider: 'LOCAL' } as any,
      res,
      '1.1.1.1',
      'agent'
    );
    expect(res.cookie).not.toHaveBeenCalledWith('invite_error', expect.anything(), expect.anything());
  });
});

describe('AuthController activate does not switch another signed-in account', () => {
  const response = () => {
    const res: any = { cookie: jest.fn(), header: jest.fn(), json: jest.fn() };
    res.status = jest.fn(() => res);
    return res;
  };
  const make = (result: object) =>
    new AuthController(
      { activate: jest.fn(async () => result) } as any,
      {} as any,
      {} as any,
      measurement as any
    );
  const live = getSessionUser as jest.Mock;
  beforeEach(() => live.mockReset().mockResolvedValue(null));

  it('signs the activated user in when there is no cookie', async () => {
    const res = response();
    await make({ jwt: 'new-jwt', userId: 'u-new' }).activate({ cookies: {} } as any, 'code', 'v', res);
    expect(res.cookie).toHaveBeenCalledWith('auth', 'new-jwt', expect.anything());
    expect(res.header).toHaveBeenCalledWith('onboarding', 'true');
    expect(res.json).toHaveBeenCalledWith({ can: true });
  });

  it('replaces a stale or invalid cookie (not a live session)', async () => {
    const res = response();
    await make({ jwt: 'new-jwt', userId: 'u-new' }).activate(
      { cookies: { auth: 'stale' } } as any, 'code', 'v', res
    );
    expect(live).toHaveBeenCalledTimes(1);
    expect(res.cookie).toHaveBeenCalledWith('auth', 'new-jwt', expect.anything());
    expect(res.json).toHaveBeenCalledWith({ can: true });
  });

  it('activates but keeps the session of a different live account', async () => {
    live.mockResolvedValue({ id: 'u-other' });
    const res = response();
    await make({ jwt: 'new-jwt', userId: 'u-new' }).activate(
      { cookies: { auth: 'live-other' } } as any, 'code', 'v', res
    );
    expect(res.cookie).not.toHaveBeenCalled();
    expect(res.header).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ can: true, signedInElsewhere: true });
  });

  it('keeps answering a failed activation the same way', async () => {
    const res = response();
    await make({ failed: 'expired' }).activate({ cookies: { auth: 'x' } } as any, 'code', 'v', res);
    expect(live).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ can: false, reason: 'expired' });
  });
});
