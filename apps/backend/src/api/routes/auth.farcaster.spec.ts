jest.mock('@gitroom/backend/services/auth/auth.service', () => ({
  AuthService: class {},
}));
jest.mock('@gitroom/nestjs-libraries/services/email.service', () => ({
  EmailService: class {},
}));
jest.mock(
  '@gitroom/nestjs-libraries/integrations/social/farcaster.provider',
  () => ({ FarcasterProvider: class {} })
);
const mockStart = jest.fn();
const mockStatus = jest.fn();
jest.mock(
  '@gitroom/backend/services/auth/providers/farcaster.provider',
  () => ({
    FARCASTER_AUTH_COOKIE_TTL: 1320,
    FarcasterProvider: class {
      startLogin(nonce: string) {
        return mockStart(nonce);
      }
      loginStatus(state: string, nonce: string) {
        return mockStatus(state, nonce);
      }
    },
  })
);
jest.mock('@sentry/nestjs', () => ({ metrics: { count: jest.fn() } }));
import { AuthController } from './auth.controller';
import { providerNonceCookie } from '@gitroom/backend/services/auth/provider.binding';
const state = 'c'.repeat(64);
const nonce = 'd'.repeat(64);
const env = { ...process.env };
beforeEach(() => {
  jest.clearAllMocks();
  process.env.FRONTEND_URL = 'https://app.example.test';
  process.env.NEXT_PUBLIC_BACKEND_URL = 'https://app.example.test/api';
  delete process.env.NOT_SECURED;
});
afterEach(() => {
  process.env = { ...env };
});
it('sets only a private host-only HttpOnly flow cookie and never returns its nonce', async () => {
  mockStart.mockResolvedValue({
    state,
    approvalUrl: 'https://example.test/approve',
    qrCode: 'example',
  });
  const response = { cookie: jest.fn() };
  const result = await new AuthController(
    {} as any,
    {} as any
  ).farcasterLoginStart(
    { headers: { 'content-type': 'application/json' } } as any,
    response as any
  );
  expect(mockStart.mock.calls[0][0]).toMatch(/^[a-f0-9]{64}$/);
  expect(response.cookie).toHaveBeenCalledTimes(1);
  const [name, secret, options] = response.cookie.mock.calls[0];
  expect(name).toMatch(/^__Host-auth_provider_/);
  expect(name).toBe(providerNonceCookie(state));
  expect(options).toMatchObject({
    httpOnly: true,
    secure: true,
    path: '/',
    sameSite: 'lax',
  });
  expect(options.domain).toBeUndefined();
  expect(JSON.stringify(result)).not.toContain(secret);
});
it('uses only the matching private cookie for status, ignoring nonce or signer input in JSON', async () => {
  const controller = new AuthController({} as any, {} as any);
  mockStatus.mockResolvedValue({ status: 'pending' });
  await controller.farcasterLoginStatus(
    {
      headers: { 'content-type': 'application/json' },
      cookies: { [providerNonceCookie(state)]: nonce },
    } as any,
    { state, browserNonce: 'forged', signerUuid: 'stolen' } as any
  );
  expect(mockStatus).toHaveBeenCalledWith(state, nonce);
  mockStatus.mockClear();
  await expect(
    controller.farcasterLoginStatus(
      { headers: { 'content-type': 'application/json' }, cookies: {} } as any,
      { state, browserNonce: nonce } as any
    )
  ).rejects.toThrow();
  expect(mockStatus).not.toHaveBeenCalled();
});
it('rejects cross-site form-style starts before provider activity', async () => {
  await expect(
    new AuthController({} as any, {} as any).farcasterLoginStart(
      { headers: { 'content-type': 'text/plain' } } as any,
      { cookie: jest.fn() } as any
    )
  ).rejects.toThrow();
  expect(mockStart).not.toHaveBeenCalled();
});

it('forwards private context and clears its cookie after successful existing-user login', async () => {
  const checkExists = jest.fn(async () => ({
    jwt: 'EXAMPLE-session',
    addedOrg: false,
  }));
  const controller = new AuthController(
    { checkExists, getOrgFromCookie: () => false } as any,
    {} as any
  );
  const response: any = {
    json: jest.fn(),
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    header: jest.fn(),
  };
  response.status = jest.fn(() => response);
  await controller.oauthExists(
    {
      headers: { 'content-type': 'application/json' },
      cookies: { [providerNonceCookie(state)]: nonce },
    } as any,
    'fcp_EXAMPLE',
    undefined,
    state,
    'FARCASTER',
    response
  );
  expect(checkExists.mock.calls[0][6]).toEqual({ state, browserNonce: nonce });
  expect(response.clearCookie).toHaveBeenCalledWith(
    providerNonceCookie(state),
    expect.objectContaining({ path: '/', secure: true, httpOnly: true })
  );
  expect(response.clearCookie.mock.calls[0][1].domain).toBeUndefined();
});

it.each([
  'farcasterLoginStart',
  'farcasterLoginStatus',
  'oauthExists',
  'register',
])('prevents caching of %s credential responses', (method) => {
  expect(
    Reflect.getMetadata(
      '__headers__',
      (AuthController.prototype as any)[method]
    )
  ).toContainEqual({ name: 'Cache-Control', value: 'no-store' });
});
