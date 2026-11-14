import 'reflect-metadata';
// nostr-tools ships ESM only; the manager just needs a provider instance
jest.mock('@gitroom/nestjs-libraries/integrations/social/nostr.provider', () => ({
  NostrProvider: class {
    identifier = 'nostr';
    name = 'Nostr';
  },
}));
import { RedditOwnKeyProvider } from '@gitroom/nestjs-libraries/integrations/social/reddit.own.key.provider';
import { RedditProvider } from '@gitroom/nestjs-libraries/integrations/social/reddit.provider';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';

const answer = (data: unknown) => ({ json: async () => data }) as any;
const basic = (id: string, secret: string) =>
  `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`;

const app = {
  client_id: 'own_client-ID1',
  client_secret: 'own-secret_value123',
  instanceUrl: '',
};

const recording = () => {
  const provider = new RedditOwnKeyProvider();
  const calls: { url: string; headers: Record<string, string>; body: string }[] =
    [];
  provider.fetch = jest.fn(async (url: string, options: any = {}) => {
    calls.push({
      url,
      headers: options.headers || {},
      body: String(options.body || ''),
    });
    if (url.includes('/api/v1/access_token')) {
      return answer({
        access_token: 'at',
        refresh_token: '123-refresh_tok',
        expires_in: 3600,
        scope: 'read identity submit flair',
      });
    }
    return answer({ name: 'poster', id: 'u1', icon_img: '' });
  }) as any;
  return { provider, calls };
};

describe('RedditOwnKeyProvider', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.REDDIT_CLIENT_ID = 'shared-id';
    process.env.REDDIT_CLIENT_SECRET = 'shared-secret';
    process.env.FRONTEND_URL = 'https://app.example.com';
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it('is its own provider in the add-channel list, with the form fields', async () => {
    const list = await new IntegrationManager().getAllIntegrations();
    const own = list.social.find((p) => p.identifier === 'reddit-own-key');
    expect(own).toMatchObject({ isOwnApp: true, isExternal: false });
    expect(own?.customFields?.map((f) => f.key)).toEqual([
      'clientId',
      'clientSecret',
    ]);
    expect(
      list.social.find((p) => p.identifier === 'reddit')?.isOwnApp
    ).toBe(false);
  });

  it('can be hidden on its own, independent of the shared reddit app', async () => {
    process.env.HIDDEN_PROVIDERS = 'reddit';
    const ids = (await new IntegrationManager().getAllIntegrations()).social.map(
      (p) => p.identifier
    );
    expect(ids).toContain('reddit-own-key');
    expect(ids).not.toContain('reddit');
  });

  it('accepts only url-safe app keys', () => {
    const p = new RedditOwnKeyProvider();
    expect(
      p.ownAppCredentials({ clientId: ' own_client-ID1 ', clientSecret: 'own-secret_value123' })
    ).toEqual(app);
    expect(typeof p.ownAppCredentials({ clientId: 'a:b:cdefghij', clientSecret: 'own-secret_value123' })).toBe('string');
    expect(typeof p.ownAppCredentials({ clientId: 'own_client-ID1' })).toBe('string');
  });

  it('sends the user to Reddit with their own client id and its redirect uri', async () => {
    const { url, state } = await new RedditOwnKeyProvider().generateAuthUrl(app);
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://www.reddit.com/api/v1/authorize');
    expect(parsed.searchParams.get('client_id')).toBe('own_client-ID1');
    expect(parsed.searchParams.get('redirect_uri')).toBe(
      'https://app.example.com/integrations/social/reddit-own-key'
    );
    expect(parsed.searchParams.get('state')).toBe(state);
    expect(parsed.searchParams.get('duration')).toBe('permanent');
    expect(url).not.toContain('shared-id');
    expect(url).not.toContain(app.client_secret);
  });

  it('refuses to start without the app', async () => {
    await expect(new RedditOwnKeyProvider().generateAuthUrl()).rejects.toThrow();
  });

  it('exchanges the code with the own app and keeps it with the refresh token', async () => {
    const { provider, calls } = recording();
    const auth = await provider.authenticate({ code: 'c', codeVerifier: 'v' }, app);
    expect(calls[0].headers.Authorization).toBe(basic(app.client_id, app.client_secret));
    expect(calls[0].body).toContain(
      encodeURIComponent('https://app.example.com/integrations/social/reddit-own-key')
    );
    expect(auth).toMatchObject({
      id: 'u1',
      accessToken: 'at',
      refreshToken: 'own_client-ID1:own-secret_value123:123-refresh_tok',
    });
  });

  it('fails the connect when the app details are gone', async () => {
    const { provider, calls } = recording();
    expect(typeof (await provider.authenticate({ code: 'c', codeVerifier: 'v' }))).toBe('string');
    expect(calls).toHaveLength(0);
  });

  it('refreshes with the stored own app and the bare refresh token', async () => {
    const { provider, calls } = recording();
    const stored = 'own_client-ID1:own-secret_value123:123-refresh_tok';
    const refreshed = await provider.refreshToken(stored);
    expect(calls[0].headers.Authorization).toBe(basic(app.client_id, app.client_secret));
    expect(calls[0].body).toBe('grant_type=refresh_token&refresh_token=123-refresh_tok');
    expect(refreshed.refreshToken).toBe(stored);
  });

  it('never refreshes an own-app channel with the shared app', async () => {
    const { provider, calls } = recording();
    await expect(provider.refreshToken('legacy-token')).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it('revokes with the own app, and skips when there is none', async () => {
    const requests: any[] = [];
    global.fetch = jest.fn(async (url: string, options: any) => {
      requests.push({ url, options });
      return { status: 204 } as any;
    }) as any;
    const p = new RedditOwnKeyProvider();
    expect(
      await p.revokeAuthorization({
        accessToken: 'at',
        refreshToken: 'own_client-ID1:own-secret_value123:rt',
        internalId: 'u1',
      })
    ).toEqual({ status: 'revoked' });
    expect(requests.map((r) => String(r.options.body))).toEqual([
      'token=rt&token_type_hint=refresh_token',
      'token=at&token_type_hint=access_token',
    ]);
    expect(requests[0].options.headers.Authorization).toBe(
      basic(app.client_id, app.client_secret)
    );
    requests.length = 0;
    expect(
      await p.revokeAuthorization({ accessToken: 'at', internalId: 'u1' })
    ).toEqual({ status: 'unknown' });
    expect(requests).toHaveLength(0);
  });

  it('leaves the shared reddit provider on the environment app', async () => {
    const { url } = await new RedditProvider().generateAuthUrl();
    const parsed = new URL(url);
    expect(parsed.searchParams.get('client_id')).toBe('shared-id');
    expect(parsed.searchParams.get('redirect_uri')).toBe(
      'https://app.example.com/integrations/social/reddit'
    );
  });
});
