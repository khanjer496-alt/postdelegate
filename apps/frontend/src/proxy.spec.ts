import { NextRequest } from 'next/server';
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
});
