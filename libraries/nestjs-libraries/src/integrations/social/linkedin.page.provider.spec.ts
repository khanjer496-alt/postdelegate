import { LinkedinPageProvider } from './linkedin.page.provider';
import { NotEnoughScopes } from '../social.abstract';

const originalFetch = global.fetch;
const originalEnv = { ...process.env };
const scopes =
  'r_basicprofile rw_organization_admin w_organization_social';
let calls: Array<{ url: string; init: any }>;
beforeEach(() => {
  delete process.env.LINKEDIN_PAGE_OPTIONAL_SCOPES;
  process.env.FRONTEND_URL = 'http://localhost:4200';
  process.env.LINKEDIN_CLIENT_ID = 'personal-id';
  process.env.LINKEDIN_CLIENT_SECRET = 'personal-secret';
  process.env.LINKEDIN_PAGE_CLIENT_ID = 'page-id';
  process.env.LINKEDIN_PAGE_CLIENT_SECRET = 'page-secret';
  calls = [];
  global.fetch = jest.fn(async (url: string, init: any) => {
    calls.push({ url, init });
    return {
      ok: true,
      json: async () =>
        url.includes('/accessToken')
          ? {
              access_token: 'access',
              expires_in: 3600,
              refresh_token: 'refresh',
              scope: scopes,
            }
          : {
              id: 'member-1',
              localizedFirstName: 'Test',
              localizedLastName: 'Admin',
            },
    };
  }) as any;
});
afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
});

it('requests CMA permissions with the Pages app and callback', async () => {
  const url = new URL((await new LinkedinPageProvider().generateAuthUrl()).url);
  expect(url.searchParams.get('scope')).toBe(scopes);
  expect(url.searchParams.get('client_id')).toBe('page-id');
  expect(url.searchParams.get('redirect_uri')).toBe(
    'http://localhost:4200/integrations/social/linkedin-page'
  );
});
it('authenticates without OIDC and keeps the temporary identity namespaced', async () => {
  const result = await new LinkedinPageProvider().authenticate({
    code: 'code',
    codeVerifier: '',
  });
  expect(result).toMatchObject({
    id: 'linkedin-page_member-1',
    name: 'Test Admin',
    picture: '',
  });
  expect(calls[0].init.body.get('client_id')).toBe('page-id');
  expect(calls[0].init.body.get('client_secret')).toBe('page-secret');
  expect(calls[0].init.body.get('redirect_uri')).toBe(
    'http://localhost:4200/integrations/social/linkedin-page'
  );
  expect(calls[1].url).toContain('/v2/me?');
});
it('refreshes with the Pages app without looking up or replacing identity', async () => {
  const result = await new LinkedinPageProvider().refreshToken('old-refresh');
  expect(result).toMatchObject({
    id: '', name: '', picture: '', username: '',
    accessToken: 'access',
    refreshToken: 'refresh',
  });
  expect(calls[0].init.body.get('client_id')).toBe('page-id');
  expect(calls).toHaveLength(1);
});
it('rejects missing grants before fetching the member', async () => {
  global.fetch = jest.fn(async () => ({
    json: async () => ({ scope: 'r_basicprofile', access_token: 'access' }),
  })) as any;
  await expect(
    new LinkedinPageProvider().authenticate({ code: 'code', codeVerifier: '' })
  ).rejects.toBeInstanceOf(NotEnoughScopes);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
it('rejects a partial Pages credential pair instead of mixing apps', async () => {
  delete process.env.LINKEDIN_PAGE_CLIENT_SECRET;
  await expect(new LinkedinPageProvider().generateAuthUrl()).rejects.toThrow(
    'Set both LINKEDIN_PAGE'
  );
});
it('preserves legacy single-app credentials when both Pages settings are absent', async () => {
  delete process.env.LINKEDIN_PAGE_CLIENT_ID;
  delete process.env.LINKEDIN_PAGE_CLIENT_SECRET;
  expect(
    new URL(
      (await new LinkedinPageProvider().generateAuthUrl()).url
    ).searchParams.get('client_id')
  ).toBe('personal-id');
});
it('rejects identity lookup failures instead of storing an undefined member', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({
      json: async () => ({ scope: scopes, access_token: 'access' }),
    })
    .mockResolvedValueOnce({ ok: false });
  await expect(
    new LinkedinPageProvider().authenticate({ code: 'code', codeVerifier: '' })
  ).rejects.toThrow('member lookup failed');
});
it('rejects a successful member response without an id', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({
      json: async () => ({ scope: scopes, access_token: 'access' }),
    })
    .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
  await expect(
    new LinkedinPageProvider().authenticate({ code: 'code', codeVerifier: '' })
  ).rejects.toThrow('no identity');
});
it('maps the largest returned profile picture rendition', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({
      json: async () => ({ scope: scopes, access_token: 'access' }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'member-1',
        profilePicture: {
          'displayImage~': {
            elements: [
              { identifiers: [{ identifier: 'small' }] },
              { identifiers: [{ identifier: 'large' }] },
            ],
          },
        },
      }),
    });
  expect(
    await new LinkedinPageProvider().authenticate({
      code: 'code',
      codeVerifier: '',
    })
  ).toMatchObject({ picture: 'large' });
});

it('keeps declined optional analytics consent from blocking publishing', async () => {
  process.env.LINKEDIN_PAGE_OPTIONAL_SCOPES = 'r_organization_social';
  const result = await new LinkedinPageProvider().authenticate({ code: 'code', codeVerifier: '' });
  expect(result.id).toBe('linkedin-page_member-1');
  expect(result.scopeWarnings).toEqual([
    'Connected for publishing. Optional permission r_organization_social was not granted; features that need it are unavailable.',
  ]);
});

it.each([429, 503, 401])('preserves refreshed tokens when member lookup would return %s', async (status) => {
  const requests: string[] = [];
  global.fetch = jest.fn(async (url: string) => {
    requests.push(url);
    return url.includes('/accessToken')
      ? { ok: true, json: async () => ({ access_token: 'new-access', refresh_token: 'rotated-refresh', expires_in: 3600 }) }
      : { ok: false, status, json: async () => ({ message: 'profile unavailable' }) };
  }) as any;
  await expect(new LinkedinPageProvider().refreshToken('old-refresh')).resolves.toEqual({
    id: '', name: '', picture: '', username: '', accessToken: 'new-access', refreshToken: 'rotated-refresh', expiresIn: 3600,
  });
  expect(requests).toEqual(['https://www.linkedin.com/oauth/v2/accessToken']);
});
