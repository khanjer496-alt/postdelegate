jest.mock('@gitroom/helpers/utils/internal.fetch', () => ({
  internalFetch: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { internalFetch } from '@gitroom/helpers/utils/internal.fetch';
import { proxy } from './proxy';

const run = async (url: string, cookie?: string) => {
  const request = new NextRequest(url, {
    headers: cookie ? { cookie } : {},
  });
  const response = await proxy(request);
  return response.headers.get('location');
};

describe('proxy (signed out)', () => {
  it('sends an email link to the login page and back to it after', async () => {
    const location = new URL(
      (await run('https://app.test/settings?tab=team'))!
    );
    expect(location.pathname).toBe('/auth/login');
    expect(location.searchParams.get('returnUrl')).toBe('/settings?tab=team');
    expect(location.searchParams.get('provider')).toBeNull();
  });

  it('keeps the provider on a sign-in callback with a code', async () => {
    const location = new URL(
      (await run('https://app.test/settings?code=abc&state=xyz'))!
    );
    expect(location.pathname).toBe('/auth');
    expect(location.searchParams.get('code')).toBe('abc');
    expect(location.searchParams.get('provider')).toBe(
      process.env.POSTIZ_GENERIC_OAUTH ? 'GENERIC' : 'GITHUB'
    );
  });

  it('keeps sending a workspace invite to the sign up page', async () => {
    const location = new URL((await run('https://app.test/?org=invite'))!);
    expect(location.pathname).toBe('/auth');
    expect(location.searchParams.get('org')).toBe('invite');
  });

  it('keeps the bare root on the sign up page', async () => {
    const location = new URL((await run('https://app.test/'))!);
    expect(location.pathname).toBe('/auth');
  });

  it('does not come back to a cancelled provider sign-in', async () => {
    const location = new URL(
      (await run(
        'https://app.test/integrations/social/youtube?state=login&error=access_denied'
      ))!
    );
    expect(location.pathname).toBe('/auth/login');
    expect(location.searchParams.get('returnUrl')).toBeNull();
  });

  it('spends the invite cookie after joining a workspace', async () => {
    (internalFetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ id: null, error: 'wrong_email' }))
    );
    const response = await proxy(
      new NextRequest('https://app.test/?org=invite', {
        headers: { cookie: 'auth=token; org=invite' },
      })
    );
    const cookies = response.headers.get('set-cookie') || '';
    expect(cookies).toMatch(/org=;/);
    expect(cookies).toContain('invite_error=wrong_email');
  });
});

describe('proxy (a session cookie is already present)', () => {
  const withCookie = (url: string) => run(url, 'auth=stale-or-other-account');

  it.each([
    ['activation', 'https://app.test/auth/activate/one-time-code'],
    ['activation with a trailing slash', 'https://app.test/auth/activate/one-time-code/'],
    ['password reset', 'https://app.test/auth/forgot/one-time-token'],
  ])('lets the emailed %s link open instead of redirecting to the app', async (_name, url) => {
    expect(await withCookie(url)).toBeNull();
  });

  it.each([
    'https://app.test/auth/login',
    'https://app.test/auth',
    'https://app.test/auth/activate',
    'https://app.test/auth/forgot',
    'https://app.test/auth/activate/code/extra',
  ])('still sends a signed-in visitor away from %s', async (url) => {
    const location = new URL((await withCookie(url))!);
    expect(location.pathname).toBe('/');
  });

  it('is unchanged for the same link without a cookie', async () => {
    expect(await run('https://app.test/auth/activate/one-time-code')).toBeNull();
  });
});

describe('proxy (?pd_ui layout links)', () => {
  const previous = process.env.PD_UI_V2;
  afterEach(() => {
    if (previous === undefined) delete process.env.PD_UI_V2;
    else process.env.PD_UI_V2 = previous;
  });
  const signedIn = (url: string) =>
    proxy(new NextRequest(url, { headers: { cookie: 'auth=token' } }));

  // The cookie used to be set client-side after the server had rendered the
  // shell, so the switch showed one load late. It must be on the redirect,
  // before the page that reads it is requested.
  it.each(['v2', 'v1'])(
    'stores pd_ui=%s on a redirect that drops only the param',
    async (value) => {
      process.env.PD_UI_V2 = 'optin';
      const response = await signedIn(
        `https://app.test/launches?pd_ui=${value}&week=12`
      );
      const location = new URL(response.headers.get('location')!);
      expect(location.pathname).toBe('/launches');
      expect(location.searchParams.get('pd_ui')).toBeNull();
      expect(location.searchParams.get('week')).toBe('12');
      const cookie = response.headers.get('set-cookie') || '';
      expect(cookie).toContain(`pd_ui=${value}`);
      expect(cookie).toMatch(/Path=\//i);
      expect(cookie).toMatch(/Max-Age=31536000/i);
      // the in-app switch rewrites it through document.cookie
      expect(cookie).not.toMatch(/HttpOnly/i);
      expect(cookie).not.toMatch(/Domain=/i);
    }
  );

  it('keeps the layout link through the root redirect', async () => {
    process.env.PD_UI_V2 = 'on';
    const response = await signedIn('https://app.test/?pd_ui=v1');
    expect(new URL(response.headers.get('location')!).pathname).toBe('/');
    expect(response.headers.get('set-cookie') || '').toContain('pd_ui=v1');
  });

  it.each([
    ['the flag is off', 'off', 'https://app.test/launches?pd_ui=v2'],
    ['the value is unknown', 'optin', 'https://app.test/launches?pd_ui=v3'],
  ])('does nothing when %s', async (_name, mode, url) => {
    process.env.PD_UI_V2 = mode;
    const response = await signedIn(url);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('set-cookie') || '').not.toContain('pd_ui=');
  });
});
