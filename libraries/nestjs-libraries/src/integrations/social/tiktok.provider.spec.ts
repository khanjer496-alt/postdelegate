jest.mock('@gitroom/nestjs-libraries/dtos/webhooks/webhook.url.validator', () => ({
  isSafePublicHttpsUrl: jest.fn(async () => true),
}));
// the local test server below is not a public address
jest.mock('@gitroom/nestjs-libraries/dtos/webhooks/ssrf.safe.dispatcher', () => ({
  getSsrfSafeDispatcher: () => undefined,
}));

import 'reflect-metadata';
import { validateSync } from 'class-validator';
import {
  TiktokProvider,
  TIKTOK_DAILY_APP_LIMIT_MESSAGE,
} from '@gitroom/nestjs-libraries/integrations/social/tiktok.provider';
import { BadBody } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import { TikTokDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/tiktok.dto';
import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';

const creator = {
  creator_username: 'review_account',
  creator_nickname: 'Review Account',
  privacy_level_options: ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'],
  comment_disabled: false,
  duet_disabled: false,
  stitch_disabled: false,
  max_video_post_duration_sec: 60,
};

const settings = (overrides: Record<string, unknown> = {}) => ({
  __type: 'tiktok',
  content_posting_method: 'DIRECT_POST',
  privacy_level: 'PUBLIC_TO_EVERYONE',
  duet: false,
  stitch: false,
  comment: false,
  autoAddMusic: 'no',
  brand_content_toggle: false,
  brand_organic_toggle: false,
  disclose: false,
  music_usage_consent: true,
  creator_info_verified: true,
  ...overrides,
});

const post = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'post-1',
    message: 'Review clip',
    settings: settings(overrides),
    media: [{ type: 'video', path: 'https://media.example/review.mp4' }],
  } as any);

// Only the TikTok HTTP calls are replaced, the provider logic runs as is.
const provider = (creatorResponse: any, videoSeconds?: number) => {
  const instance = new TiktokProvider();
  const urls: string[] = [];
  // the length ffprobe would read from the stored video
  const probe = jest
    .spyOn(instance as any, 'videoDurationSeconds')
    .mockResolvedValue(videoSeconds);
  instance.fetch = jest.fn(async (url: string) => {
    urls.push(url);
    if (typeof creatorResponse === 'function' && url.includes('creator_info')) {
      return creatorResponse();
    }
    return {
      json: async () =>
        url.includes('creator_info')
          ? creatorResponse
          : { data: { publish_id: 'v_pub_review' }, error: { code: 'ok' } },
    } as any;
  }) as any;
  const publish = (value: any) =>
    instance.postPending('channel', 'test-token', [value], {
      profile: 'review_account',
    } as any);
  return { instance, urls, publish, probe };
};

const initCalls = (urls: string[]) =>
  urls.filter((url) => url.includes('/init/')).length;

const dtoErrors = (overrides: Record<string, unknown>) =>
  validateSync(Object.assign(new TikTokDto(), settings(overrides))).flatMap(
    (error) => Object.values(error.constraints || {})
  );

describe('TiktokProvider creator_info gate', () => {
  it('stops publishing when creator_info says the creator cannot post right now', async () => {
    const { urls, publish } = provider({
      data: {},
      error: { code: 'spam_risk_too_many_posts', message: 'limit' },
    });

    await expect(publish(post())).rejects.toThrow(/Try again later/);
    expect(initCalls(urls)).toBe(0);
  });

  it('keeps the account status message for a creator banned from posting', async () => {
    const { urls, publish } = provider({
      data: {},
      error: { code: 'spam_risk_user_banned_from_posting' },
    });

    await expect(publish(post())).rejects.toThrow(/Account banned from posting/);
    expect(initCalls(urls)).toBe(0);
  });

  it('stops publishing when the creator_info request itself is rejected', async () => {
    const { urls, publish } = provider(() => {
      throw new BadBody(
        'tiktok',
        JSON.stringify({ error: { code: 'spam_risk_too_many_posts' } }),
        '{}',
        'TikTok says your daily post limit reached, please try again tomorrow'
      );
    });

    await expect(publish(post())).rejects.toThrow(/try again tomorrow/);
    expect(initCalls(urls)).toBe(0);
  });

  it("stops with a try-again-later message when the app's daily creator cap is reached", async () => {
    const { urls, publish } = provider({
      data: {},
      error: { code: 'reached_active_user_cap', message: 'cap' },
    });

    await expect(publish(post())).rejects.toThrow(TIKTOK_DAILY_APP_LIMIT_MESSAGE);
    expect(initCalls(urls)).toBe(0);
  });

  it('keeps the channel connected when TikTok rejects a post for the daily creator cap', () => {
    const result = new TiktokProvider().handleErrors(
      JSON.stringify({ error: { code: 'reached_active_user_cap' } })
    );

    expect(result).toEqual({
      type: 'bad-body',
      value: "TikTok's daily posting limit for this app has been reached. Try again later.",
    });
  });

  it('refuses a Direct Post without the authorization checkbox', async () => {
    const { urls, publish } = provider({ data: creator, error: { code: 'ok' } });

    await expect(publish(post({ music_usage_consent: false }))).rejects.toThrow(
      'Confirm that PostDelegate can upload and publish this content to TikTok.'
    );
    expect(initCalls(urls)).toBe(0);
  });

  it('starts the publish when creator_info allows the selected settings', async () => {
    const { urls, publish } = provider({ data: creator, error: { code: 'ok' } });

    const [result] = await publish(post());

    expect(result.status).toBe('pending');
    expect(initCalls(urls)).toBe(1);
  });

  it('refuses commercial disclosure without a brand choice', async () => {
    const { urls, publish } = provider({ data: creator, error: { code: 'ok' } });

    await expect(publish(post({ disclose: true }))).rejects.toThrow(
      'You need to indicate if your content promotes yourself, a third party, or both.'
    );
    expect(initCalls(urls)).toBe(0);
  });

  it('refuses private branded content', async () => {
    const { urls, publish } = provider({ data: creator, error: { code: 'ok' } });

    await expect(
      publish(
        post({
          disclose: true,
          brand_content_toggle: true,
          privacy_level: 'SELF_ONLY',
        })
      )
    ).rejects.toThrow('Branded content visibility cannot be set to private.');
    expect(initCalls(urls)).toBe(0);
  });
});

describe('TiktokProvider video length at publish time', () => {
  const ok = { data: creator, error: { code: 'ok' } };

  it('refuses a scheduled Direct Post longer than creator_info allows now', async () => {
    const { urls, publish, probe } = provider(ok, 61.5);
    await expect(publish(post())).rejects.toThrow(
      'This video is too long for this TikTok account. Choose a video no longer than 60 seconds.'
    );
    expect(probe).toHaveBeenCalledWith('https://media.example/review.mp4');
    expect(initCalls(urls)).toBe(0);
  });

  it('publishes a video within the limit', async () => {
    const { urls, publish } = provider(ok, 59.9);
    await publish(post());
    expect(initCalls(urls)).toBe(1);
  });

  it('leaves an unreadable length to TikTok instead of failing the post', async () => {
    const { urls, publish } = provider(ok, undefined);
    await publish(post());
    expect(initCalls(urls)).toBe(1);
  });

  it('does not read the length of an inbox upload or a photo', async () => {
    const upload = provider(ok, 999);
    await upload.publish(post({ content_posting_method: 'UPLOAD' }));
    expect(upload.probe).not.toHaveBeenCalled();
    expect(initCalls(upload.urls)).toBe(1);

    const photo = provider(ok, 999);
    await photo.publish({
      ...post(),
      media: [{ type: 'image', path: 'https://media.example/review.jpg' }],
    });
    expect(photo.probe).not.toHaveBeenCalled();
  });
});

// ffprobe ships in the release image; a machine without ffmpeg skips this
const hasFfmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

(hasFfmpeg ? describe : describe.skip)('TiktokProvider reads the video length with ffprobe', () => {
  let dir: string;
  let server: Server;
  let base: string;
  const previousUploads = process.env.UPLOAD_DIRECTORY;
  const read = (path: string) =>
    (new TiktokProvider() as any).videoDurationSeconds(path);

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'tiktok-length-'));
    // 3 seconds, the moov atom at the end like a camera file
    execFileSync('ffmpeg', [
      '-v', 'error', '-y', '-f', 'lavfi',
      '-i', 'testsrc=duration=3:size=64x64:rate=10',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(dir, 'clip.mp4'),
    ]);
    const bytes = readFileSync(join(dir, 'clip.mp4'));
    server = createServer((req, res) => {
      if (req.url === '/clip.mp4') {
        res.writeHead(200, { 'content-type': 'video/mp4' });
        res.end(bytes);
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    process.env.UPLOAD_DIRECTORY = dir;
  });

  afterAll(async () => {
    process.env.UPLOAD_DIRECTORY = previousUploads;
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  });

  it('reads a stored file', async () => {
    expect(Math.round(await read(join(dir, 'clip.mp4')))).toBe(3);
  });

  it('reads a hosted file through the fetch', async () => {
    expect(Math.round(await read(`${base}/clip.mp4`))).toBe(3);
  });

  it('answers undefined for what it cannot read', async () => {
    expect(await read(`${base}/missing.mp4`)).toBeUndefined();
    expect(await read(join(dir, 'missing.mp4'))).toBeUndefined();
    // outside UPLOAD_DIRECTORY nothing is opened
    expect(await read('/etc/hostname')).toBeUndefined();
  });
});

describe('TiktokProvider outside the composer', () => {
  const instance = new TiktokProvider();

  it('refuses an explicit Direct Post with a readable reason', () => {
    const result = instance.settingsOutsideComposer(settings());
    expect(result).toEqual({
      error: expect.stringContaining(
        'TikTok Direct Post is only available in the PostDelegate composer'
      ),
    });
  });

  it('sends everything else to the TikTok inbox without the composer acknowledgements', () => {
    expect(
      instance.settingsOutsideComposer(
        settings({ content_posting_method: undefined })
      )
    ).toEqual({
      settings: {
        __type: 'tiktok',
        content_posting_method: 'UPLOAD',
        privacy_level: 'PUBLIC_TO_EVERYONE',
        duet: false,
        stitch: false,
        comment: false,
        autoAddMusic: 'no',
        brand_content_toggle: false,
        brand_organic_toggle: false,
        disclose: false,
      },
    });
    expect(instance.settingsOutsideComposer(undefined)).toEqual({
      settings: { content_posting_method: 'UPLOAD' },
    });
  });

  it('keeps an inbox upload as it is', () => {
    expect(
      instance.settingsOutsideComposer({
        __type: 'tiktok',
        content_posting_method: 'UPLOAD',
        title: 'Photo title',
      })
    ).toEqual({
      settings: {
        __type: 'tiktok',
        content_posting_method: 'UPLOAD',
        title: 'Photo title',
      },
    });
  });

  it('settings it returns from the documented API example pass the DTO of a scheduled post', () => {
    const result = instance.settingsOutsideComposer({
      __type: 'tiktok',
      duet: false,
      stitch: false,
      comment: false,
      autoAddMusic: 'no',
      brand_content_toggle: false,
      brand_organic_toggle: false,
      video_made_with_ai: false,
    }) as { settings: any };
    const errors = validateSync(
      Object.assign(new TikTokDto(), result.settings)
    ).flatMap((error) => Object.values(error.constraints || {}));
    expect(errors).toEqual([]);
  });

  it('takes no auto post (RSS) channel', () => {
    expect(instance.autoPostUnsupported).toBe(true);
  });
});

describe('TikTokDto commercial content rules', () => {
  it('rejects disclosure with neither Your brand nor Branded content', () => {
    expect(dtoErrors({ disclose: true })).toContain(
      'You need to indicate if your content promotes yourself, a third party, or both.'
    );
  });

  it('rejects branded content set to private', () => {
    expect(
      dtoErrors({
        disclose: true,
        brand_content_toggle: true,
        privacy_level: 'SELF_ONLY',
      })
    ).toContain('Branded content visibility cannot be set to private.');
  });

  it('accepts each valid disclosure choice', () => {
    expect(dtoErrors({ disclose: true, brand_organic_toggle: true })).toEqual(
      []
    );
    expect(
      dtoErrors({
        disclose: true,
        brand_organic_toggle: true,
        privacy_level: 'SELF_ONLY',
      })
    ).toEqual([]);
    expect(dtoErrors({ disclose: true, brand_content_toggle: true })).toEqual(
      []
    );
  });

  it('keeps inbox uploads free of the direct post rules', () => {
    expect(
      dtoErrors({
        content_posting_method: 'UPLOAD',
        disclose: true,
        privacy_level: undefined,
      })
    ).toEqual([]);
  });
});

describe('TiktokProvider recentPosts', () => {
  const listing = (response: any) => {
    const instance = new TiktokProvider();
    const calls: Array<{ url: string; options: any }> = [];
    instance.fetch = jest.fn(async (url: string, options: any) => {
      calls.push({ url, options });
      return { json: async () => response } as any;
    }) as any;
    return { instance, calls };
  };

  it('asks video/list for the stats fields and maps them to the generic type', async () => {
    const { instance, calls } = listing({
      data: {
        videos: [
          {
            id: 7301,
            title: '',
            video_description: '  Behind the scenes  ',
            cover_image_url: 'https://p16.tiktokcdn.com/cover.jpeg?x-expires=1',
            share_url:
              'https://www.tiktok.com/@review_account/video/7301?utm_source=x&client_key=secret',
            create_time: 1761900000,
            view_count: 1520,
            like_count: 87,
            comment_count: 0,
            share_count: 4,
          },
        ],
        has_more: false,
      },
      error: { code: 'ok' },
    });

    const posts = await instance.recentPosts('open-id', 'token', 20);

    expect(calls[0].url).toBe(
      'https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,cover_image_url,share_url,create_time,view_count,like_count,comment_count,share_count'
    );
    expect(calls[0].options.method).toBe('POST');
    expect(calls[0].options.headers.Authorization).toBe('Bearer token');
    expect(JSON.parse(calls[0].options.body)).toEqual({ max_count: 20 });
    expect(posts).toEqual([
      {
        id: '7301',
        title: 'Behind the scenes',
        thumbnailUrl: 'https://p16.tiktokcdn.com/cover.jpeg?x-expires=1',
        url: 'https://www.tiktok.com/@review_account/video/7301',
        publishedAt: new Date(1761900000 * 1000).toISOString(),
        views: 1520,
        likes: 87,
        comments: 0,
        shares: 4,
      },
    ]);
  });

  it('prefers the title, leaves out unreported counts and unsafe links', async () => {
    const { instance } = listing({
      data: {
        videos: [
          {
            id: '1',
            title: 'Launch day',
            video_description: 'long description',
            cover_image_url: 'http://insecure.example/cover.jpeg',
            share_url: 'javascript:alert(1)',
            create_time: 1761900000,
          },
          { title: 'no id is skipped' },
        ],
      },
      error: { code: 'ok' },
    });

    const [post, ...rest] = await instance.recentPosts('open-id', 'token', 20);

    expect(rest).toEqual([]);
    expect(post.title).toBe('Launch day');
    expect(post.thumbnailUrl).toBeUndefined();
    expect(post.url).toBeUndefined();
    expect(post.views).toBeUndefined();
    expect(post.likes).toBeUndefined();
    expect(post.comments).toBeUndefined();
    expect(post.shares).toBeUndefined();
  });

  it('leaves the date empty instead of 1970 when create_time is missing', async () => {
    const { instance } = listing({
      data: { videos: [{ id: '2', title: 'No date' }] },
      error: { code: 'ok' },
    });

    const [post] = await instance.recentPosts('open-id', 'token', 20);

    expect(post.publishedAt).toBe('');
  });

  it('caps the page size at the 20 videos TikTok allows', async () => {
    const { instance, calls } = listing({ data: { videos: [] }, error: { code: 'ok' } });

    expect(await instance.recentPosts('open-id', 'token', 50)).toEqual([]);
    expect(JSON.parse(calls[0].options.body)).toEqual({ max_count: 20 });
  });

  it('throws on a TikTok error instead of reporting an empty account', async () => {
    const { instance } = listing({
      data: {},
      error: { code: 'scope_not_authorized', message: 'video.list' },
    });

    await expect(
      instance.recentPosts('open-id', 'token', 20)
    ).rejects.toBeInstanceOf(BadBody);
  });
});

describe('TiktokProvider.publishedLabel', () => {
  it('labels an inbox upload instead of calling it published', () => {
    const instance = new TiktokProvider();
    expect(instance.publishedLabel({ content_posting_method: 'UPLOAD' })).toBe(
      'Sent to TikTok inbox'
    );
    expect(
      instance.publishedLabel({ content_posting_method: 'DIRECT_POST' })
    ).toBeUndefined();
    expect(instance.publishedLabel({})).toBeUndefined();
  });
});

describe('TiktokProvider.publishedLinkLabel', () => {
  it('names the link to an inbox upload', () => {
    const instance = new TiktokProvider();
    expect(
      instance.publishedLinkLabel({ content_posting_method: 'UPLOAD' })
    ).toBe('Open TikTok inbox');
    expect(
      instance.publishedLinkLabel({ content_posting_method: 'DIRECT_POST' })
    ).toBeUndefined();
  });
});

describe('TiktokProvider.profileInfo (user.info.profile)', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });
  const reply = (body: any) => {
    const mock = jest.fn(async () => ({ json: async () => body }) as any);
    global.fetch = mock as any;
    return mock;
  };

  it('reads the profile link, username, bio and verified badge', async () => {
    const mock = reply({
      data: {
        user: {
          username: 'review_account',
          profile_deep_link: 'https://vm.tiktok.com/ZMexample/',
          bio_description: ' Weekend baker ',
          is_verified: false,
        },
      },
      error: { code: 'ok' },
    });

    await expect(new TiktokProvider().profileInfo('token')).resolves.toEqual({
      username: 'review_account',
      profileUrl: 'https://vm.tiktok.com/ZMexample/',
      bioDescription: 'Weekend baker',
      isVerified: false,
    });
    const [url, options] = mock.mock.calls[0] as any;
    expect(url).toBe(
      'https://open.tiktokapis.com/v2/user/info/?fields=username,profile_deep_link,bio_description,is_verified'
    );
    expect(options.headers.Authorization).toBe('Bearer token');
  });

  it('drops a profile link that does not open on TikTok', async () => {
    reply({
      data: { user: { profile_deep_link: 'https://evil.example/tiktok.com' } },
      error: { code: 'ok' },
    });
    await expect(new TiktokProvider().profileInfo('token')).resolves.toEqual({});
  });

  it('shows nothing (and never fails) without the scope or on errors', async () => {
    reply({ data: {}, error: { code: 'scope_not_authorized' } });
    await expect(new TiktokProvider().profileInfo('token')).resolves.toEqual({});

    global.fetch = jest.fn(async () => {
      throw new Error('network');
    }) as any;
    await expect(new TiktokProvider().profileInfo('token')).resolves.toEqual({});
  });

  it('can be called from the composer', () => {
    expect(
      Reflect.getMetadata(
        'custom:dashboard_function',
        TiktokProvider.prototype,
        'profileInfo'
      )
    ).toBe(true);
  });
});

describe('TiktokProvider.generateAuthUrl', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it("always shows TikTok's consent page with all requested scopes", async () => {
    process.env.TIKTOK_CLIENT_ID = 'client-key';
    process.env.FRONTEND_URL = 'https://app.example.com';
    const instance = new TiktokProvider();
    const { url, state } = await instance.generateAuthUrl();
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe('https://www.tiktok.com/v2/auth/authorize/');
    expect(parsed.searchParams.get('disable_auto_auth')).toBe('1');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('state')).toBe(state);
    expect(parsed.searchParams.get('redirect_uri')).toBe(
      'https://app.example.com/integrations/social/tiktok'
    );
    expect(parsed.searchParams.get('scope')!.split(',')).toEqual(instance.scopes);
  });
});
