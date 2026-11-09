import { FacebookProvider } from './facebook.provider';
import { InstagramProvider } from './instagram.provider';
import { InstagramStandaloneProvider } from './instagram.standalone.provider';
import { ThreadsProvider } from './threads.provider';
import { LinkedinPageProvider } from './linkedin.page.provider';
import { TiktokProvider } from './tiktok.provider';
import { SocialAbstract, NotEnoughScopes } from '../social.abstract';

const cases = [
  [
    FacebookProvider,
    ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement'],
  ],
  [
    InstagramProvider,
    [
      'instagram_basic',
      'pages_show_list',
      'pages_read_engagement',
      'instagram_content_publish',
    ],
  ],
  [
    InstagramStandaloneProvider,
    ['instagram_business_basic', 'instagram_business_content_publish'],
  ],
  [ThreadsProvider, ['threads_basic', 'threads_content_publish']],
  [TiktokProvider, ['user.info.basic', 'video.publish', 'video.upload']],
  [
    LinkedinPageProvider,
    ['r_basicprofile', 'rw_organization_admin', 'w_organization_social'],
  ],
] as const;

describe('review scope policy', () => {
  const original = process.env;
  beforeEach(() => {
    process.env = { ...original };
  });
  afterEach(() => {
    process.env = original;
  });
  it.each(cases)(
    '%p requests publishing minimum by default',
    (Provider, minimum) => {
      const p = new Provider();
      delete process.env[
        p.identifier.toUpperCase().replace(/-/g, '_') + '_OPTIONAL_SCOPES'
      ];
      expect(p.scopes).toEqual(minimum);
      expect(p.checkScopes(p.scopes, [...minimum, 'future_grant'])).toBe(true);
      expect(() => p.checkScopes(p.scopes, minimum.slice(1))).toThrow(
        NotEnoughScopes
      );
    }
  );
  it('enables only allowlisted optional grants, and permits a partial optional consent', () => {
    process.env.FACEBOOK_OPTIONAL_SCOPES =
      'read_insights,unknown_permission,read_insights';
    const p = new FacebookProvider();
    expect(p.scopes).toEqual([
      'pages_show_list',
      'pages_manage_posts',
      'pages_read_engagement',
      'read_insights',
    ]);
    expect(
      p.checkScopes(
        p.scopes,
        'pages_show_list, pages_manage_posts pages_read_engagement'
      )
    ).toBe(true);
    expect(
      p.scopeWarnings(
        'pages_show_list pages_manage_posts pages_read_engagement'
      )
    ).toEqual([
      'Connected for publishing. Optional permission read_insights was not granted; features that need it are unavailable.',
    ]);
  });
  it('accepts encoded grants and rejects an absent or malformed grant without leaking a URI error', () => {
    const p = new TiktokProvider();
    expect(
      p.checkScopes(p.scopes, 'user.info.basic%20video.publish%2Cvideo.upload')
    ).toBe(true);
    expect(() => p.checkScopes(p.scopes, undefined as any)).toThrow(
      NotEnoughScopes
    );
    expect(() => p.checkScopes(p.scopes, '%broken')).toThrow(NotEnoughScopes);
  });
  it.each([
    new FacebookProvider(),
    new InstagramProvider(),
    new InstagramStandaloneProvider(),
    new ThreadsProvider(),
    new TiktokProvider(),
  ])('disables optional analytics and automation by default for %p', (p) => {
    expect(p.analyticsAvailable).toBe(false);
    if (p.identifier !== 'tiktok') expect(p.plugsAvailable).toBe(false);
  });
  it.each([
    new FacebookProvider(),
    new InstagramProvider(),
    new InstagramStandaloneProvider(),
    new ThreadsProvider(),
  ])(
    'publishes an existing scheduled reply with its broad-grant token while defaults are off for %p',
    async (p) => {
      const transport = jest.spyOn(SocialAbstract.prototype, 'fetch').mockResolvedValue({
        json: async () => ({ id: 'network-reply', status: 'FINISHED', permalink: 'https://network.test/reply', permalink_url: 'https://network.test/reply' }),
      } as any);
      try {
        const result = await p.comment('review', 'main-post', undefined, 'EXAMPLE-broad-grant-token', [
          { id: 'saved-reply', message: 'Scheduled reply', media: [], settings: {} },
        ] as any, {} as any);
        expect(p.plugsAvailable).toBe(false);
        expect(result).toEqual([{ id: 'saved-reply', postId: 'network-reply', releaseURL: 'https://network.test/reply', status: 'success' }]);
        expect(JSON.stringify(transport.mock.calls)).toContain('EXAMPLE-broad-grant-token');
      } finally {
        transport.mockRestore();
      }
    }
  );
  it('connects the Pages-only LinkedIn app without requesting a separate OpenID product', async () => {
    const p = new LinkedinPageProvider();
    const requests: string[] = [];
    const transport = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (url: any) => {
        requests.push(String(url));
        return {
          ok: true,
          json: async () =>
            String(url).includes('/v2/me?')
              ? {
                  id: 'member-review',
                  localizedFirstName: 'Review',
                  localizedLastName: 'Member',
                }
              : {
                  access_token: 'test',
                  refresh_token: 'refresh',
                  scope:
                    'r_basicprofile,rw_organization_admin,w_organization_social',
                  expires_in: 3600,
                },
        } as any;
      });
    try {
      expect(
        await p.authenticate({ code: 'code', codeVerifier: 'state' })
      ).toMatchObject({ id: 'linkedin-page_member-review' });
      await p.refreshToken('refresh');
      expect(requests.some((u) => u.includes('userinfo'))).toBe(false);
    } finally {
      transport.mockRestore();
    }
  });
  it.each(['spam_risk_too_many_posts', 'invalid creator info'])('connects TikTok when creator info fails: %s', async (message) => {
    const p = new TiktokProvider();
    const creator = jest.spyOn(p, 'creatorInfo').mockRejectedValue(new Error(message));
    const transport = jest.spyOn(global, 'fetch').mockResolvedValue({
      json: async () => ({
        access_token: 'test', refresh_token: 'refresh', scope: p.scopes.join(','),
        data: { user: { open_id: 'review', display_name: 'Reviewer', avatar_url: '' } },
      }),
    } as any);
    try {
      await expect(p.authenticate({ code: 'code', codeVerifier: 'state' })).resolves.toMatchObject({ id: 'review', username: '' });
    } finally { creator.mockRestore(); transport.mockRestore(); }
  });
  it('resolves a missing TikTok handle after publication, without blocking a completed post on creator errors', async () => {
    const p = new TiktokProvider();
    jest.spyOn(p, 'fetch').mockResolvedValue({ text: async () => JSON.stringify({ data: { status: 'PUBLISH_COMPLETE', publicaly_available_post_id: ['123'] } }) } as any);
    const creator = jest.spyOn(p, 'creatorInfo').mockResolvedValue({ creatorUsername: 'later_handle' } as any);
    await expect(p.checkPostStatus('test', { publishId: 'v_pub_review' }, { profile: '' } as any)).resolves.toMatchObject({ status: 'completed', releaseURL: 'https://www.tiktok.com/@later_handle/video/123' });
    creator.mockRejectedValue(new Error('still unavailable'));
    await expect(p.checkPostStatus('test', { publishId: 'v_pub_review' }, { profile: '' } as any)).resolves.toMatchObject({ status: 'completed', releaseURL: 'https://www.tiktok.com' });
  });
  it('connects TikTok using only basic profile fields, then refreshes the same grant', async () => {
    const p = new TiktokProvider();
    const requests: string[] = [];
    const transport = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (url: any) => {
        requests.push(String(url));
        return {
          status: 200,
          json: async () =>
            String(url).includes('creator_info')
              ? {
                  data: {
                    creator_username: 'review_account',
                    privacy_level_options: ['SELF_ONLY'],
                    comment_disabled: false,
                    duet_disabled: false,
                    stitch_disabled: false,
                    max_video_post_duration_sec: 60,
                  },
                  error: { code: 'ok' },
                }
              : String(url).includes('/oauth/token/')
              ? {
                  access_token: 'test',
                  refresh_token: 'test-refresh',
                  scope: p.scopes.join(','),
                }
              : {
                  data: {
                    user: {
                      open_id: 'test-user',
                      display_name: 'Reviewer',
                      avatar_url: '',
                    },
                  },
                },
        } as any;
      });
    try {
      expect(
        await p.authenticate({ code: 'code', codeVerifier: 'state' })
      ).toMatchObject({
        id: 'testuser',
        name: 'Reviewer',
        username: 'review_account',
      });
      await p.refreshToken('test-refresh');
      expect(
        requests
          .filter((u) => u.includes('/user/info/'))
          .every((u) => !u.includes('username'))
      ).toBe(true);
    } finally {
      transport.mockRestore();
    }
  });
});
