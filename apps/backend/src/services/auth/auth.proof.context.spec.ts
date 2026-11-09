jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/users/users.service',
  () => ({ UsersService: class {} })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service',
  () => ({ OrganizationService: class {} })
);
jest.mock('@gitroom/nestjs-libraries/services/email.service', () => ({
  EmailService: class {},
  emailButton: jest.fn(),
}));
jest.mock('@gitroom/backend/services/auth/providers/providers.manager', () => ({
  AuthProviderManager: class {},
}));
jest.mock('@gitroom/nestjs-libraries/newsletter/newsletter.service', () => ({
  NewsletterService: { register: jest.fn() },
}));
import { AuthService } from './auth.service';
const state = 'a'.repeat(64);
const context = { state, browserNonce: 'b'.repeat(64) };
const env = { ...process.env };
beforeEach(() => {
  process.env.JWT_SECRET = 'EXAMPLE-test-secret';
  delete process.env.NOT_SECURED;
});
afterEach(() => {
  process.env = { ...env };
});
const make = (existing: boolean, bound = true) => {
  const provider = {
    requiresBrowserContext: bound,
    getToken: jest.fn(async () => 'internal-login-ticket'),
    getUser: jest.fn(async () => ({
      id: 'farcaster_42',
      email: 'farcaster_42',
      registrationToken: 'signup-continuation',
    })),
  };
  const user = { id: 'user-1', password: '', sessionVersion: 0 };
  const users = {
    getUserByProvider: jest.fn(async () => (existing ? user : null)),
    getUserByEmail: jest.fn(async () => null),
    getUserById: jest.fn(async () => user),
  };
  return {
    provider,
    users,
    service: new AuthService(
      users as any,
      {} as any,
      {} as any,
      { getProvider: () => provider } as any,
      {} as any,
      {} as any
    ),
  };
};
it('returns a distinct signup continuation and passes only server context to the bound provider', async () => {
  const { service, provider } = make(false);
  await expect(
    service.checkExists(
      'FARCASTER',
      'proof',
      undefined,
      state,
      undefined,
      undefined,
      context
    )
  ).resolves.toEqual({ token: 'signup-continuation' });
  expect(provider.getToken).toHaveBeenCalledWith('proof', undefined, {
    ...context,
    purpose: 'login',
  });
  expect(provider.getUser).toHaveBeenCalledWith('internal-login-ticket', {
    ...context,
    purpose: 'login',
  });
});
it('does not return the registration credential on existing-user login', async () => {
  const { service } = make(true);
  const result = await service.checkExists(
    'FARCASTER',
    'proof',
    undefined,
    state,
    undefined,
    undefined,
    context
  );
  expect(result.jwt).toBeTruthy();
  expect(result.token).toBeUndefined();
});
it('cannot bypass private browser context with redirect_uri or NOT_SECURED', async () => {
  process.env.NOT_SECURED = 'true';
  const { service, provider } = make(false);
  await expect(
    service.checkExists('FARCASTER', 'proof', 'app://callback', state)
  ).rejects.toThrow('Invalid state');
  expect(provider.getToken).not.toHaveBeenCalled();
});
it('retains legacy OAuth state-cookie checks for unbound providers', async () => {
  const { service, provider } = make(false, false);
  await expect(
    service.checkExists(
      'GOOGLE',
      'code',
      undefined,
      'state',
      'wrong',
      undefined,
      context
    )
  ).rejects.toThrow('Invalid state');
  expect(provider.getToken).not.toHaveBeenCalled();
});
it('passes registration purpose and never uses client email as provider identity', async () => {
  const { service, provider, users } = make(true);
  const body = {
    provider: 'FARCASTER',
    providerToken: 'signup-continuation',
    email: 'client@example.test',
  } as any;
  await service.routeAuth(
    'FARCASTER' as any,
    body,
    '127.0.0.1',
    'test',
    undefined,
    undefined,
    context
  );
  expect(provider.getUser).toHaveBeenCalledWith('signup-continuation', {
    ...context,
    purpose: 'register',
  });
  expect(users.getUserByProvider).toHaveBeenCalledWith(
    'farcaster_42',
    'FARCASTER'
  );
});
