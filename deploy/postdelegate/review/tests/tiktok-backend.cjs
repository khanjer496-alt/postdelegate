/* Run in the dependency image, with repository source mounted at /review:
 * docker run --rm --entrypoint node -v "$PWD:/review:ro" IMAGE \
 *   /review/deploy/postdelegate/review/tests/tiktok-backend.cjs
 * No application bootstrap, credentials, live requests, or publishing workers.
 */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const dependencyRequire = Module.createRequire('/app/package.json');
const ts = dependencyRequire('typescript');
const root = path.resolve(__dirname, '../../../..');
const sourceRoot = path.join(root, 'libraries/nestjs-libraries/src');
dependencyRequire('reflect-metadata');

// Only external infrastructure is replaced. The provider, DTO, and existing
// public-HTTPS validator below execute the checked-out production source.
class BadBody extends Error {
  constructor(_id, _json, _body, message) { super(message); }
}
class SocialAbstract {
  assetBoolean(value) { return value === true || value === 'true'; }
  async mediaSize() { return 12345; }
}
const infrastructure = {
  '@gitroom/nestjs-libraries/integrations/social.abstract': {
    SocialAbstract, BadBody, RefreshToken: class extends Error {}, Disconnect: class extends Error {},
  },
  '@gitroom/helpers/utils/has.extension': {
    hasExtension: (value, extension) => new RegExp(`\\.${extension}(?:[?#]|$)`, 'i').test(value || ''),
  },
  '@gitroom/helpers/utils/timer': { timer: async () => {} },
  '@gitroom/nestjs-libraries/services/make.secure.id': { makeSecureId: () => 'test-id' },
  '@gitroom/nestjs-libraries/chat/rules.description.decorator': { Rules: () => () => {} },
  '@gitroom/nestjs-libraries/dtos/webhooks/ssrf.safe.dispatcher': { getSsrfSafeDispatcher: () => undefined },
};
const cache = new Map();
function loadSource(filename) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module);
  cache.set(filename, mod);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths('/app');
  mod.require = (id) => {
    if (infrastructure[id]) return infrastructure[id];
    if (id.startsWith('@gitroom/nestjs-libraries/')) {
      return loadSource(path.join(sourceRoot, id.slice('@gitroom/nestjs-libraries/'.length) + '.ts'));
    }
    return dependencyRequire(id);
  };
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
      experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true,
    },
  }).outputText;
  mod._compile(output, filename);
  return mod.exports;
}
const { TiktokProvider } = loadSource(path.join(sourceRoot, 'integrations/social/tiktok.provider.ts'));
const { TikTokDto } = loadSource(path.join(sourceRoot, 'dtos/posts/providers-settings/tiktok.dto.ts'));
const { validateSync } = dependencyRequire('class-validator');
const creator = {
  creator_username: 'review_account', creator_nickname: 'Review Account',
  privacy_level_options: ['SELF_ONLY', 'MUTUAL_FOLLOW_FRIENDS'],
  comment_disabled: false, duet_disabled: false, stitch_disabled: true,
  max_video_post_duration_sec: 60,
};
const settings = (overrides = {}) => ({
  __type: 'tiktok', content_posting_method: 'DIRECT_POST', privacy_level: 'SELF_ONLY',
  duet: false, stitch: false, comment: false, autoAddMusic: 'no',
  brand_content_toggle: false, brand_organic_toggle: false, disclose: false,
  music_usage_consent: true, creator_info_verified: true, ...overrides,
});
const post = (overrides = {}, mediaPath = 'https://93.184.216.34/review.mp4') => ({
  id: 'post-1', message: 'Original PostDelegate review clip', settings: settings(overrides),
  media: [{ type: 'video', path: mediaPath }],
});
function provider(response = creator) {
  const instance = new TiktokProvider();
  const requests = [];
  instance.fetch = async (url, options) => {
    requests.push({ url, options, body: options.body ? JSON.parse(options.body) : undefined });
    return { json: async () => url.includes('creator_info')
      ? { data: response, error: { code: 'ok' } }
      : { data: { publish_id: 'v_pub_review' }, error: { code: 'ok' } } };
  };
  return { instance, requests };
}
const publish = (instance, value) => instance.postPending('channel', 'test-token', [value], { profile: 'review_account' });

test('creatorInfo returns the current account capabilities used by the composer', async () => {
  const { instance } = provider();
  assert.equal(typeof instance.creatorInfo, 'function');
  assert.deepEqual(await instance.creatorInfo('test-token'), {
    creatorUsername: 'review_account', creatorNickname: 'Review Account',
    privacyLevelOptions: ['SELF_ONLY', 'MUTUAL_FOLLOW_FRIENDS'],
    commentDisabled: false, duetDisabled: false, stitchDisabled: true, maxDurationSeconds: 60,
  });
  assert.equal(Reflect.getMetadata('custom:dashboard_function', TiktokProvider.prototype, 'creatorInfo'), true);
});

test('direct posting refuses a missing privacy choice rather than publishing publicly', async () => {
  const { instance, requests } = provider();
  await assert.rejects(publish(instance, post({ privacy_level: undefined })), /privacy/i);
  assert.equal(requests.filter((r) => r.url.includes('/video/init/')).length, 0);
});

test('direct posting checks fresh creator privacy options', async () => {
  const { instance } = provider();
  await assert.rejects(publish(instance, post({ privacy_level: 'PUBLIC_TO_EVERYONE' })), /privacy/i);
});

test('direct posting requires explicit music usage consent', async () => {
  const { instance } = provider();
  await assert.rejects(publish(instance, post({ music_usage_consent: false })), /music|consent/i);
});

test('direct posting refuses interactions disabled by the creator', async () => {
  const { instance } = provider();
  await assert.rejects(publish(instance, post({ stitch: true })), /stitch/i);
});

test('commercial disclosure requires a brand selection', async () => {
  const { instance } = provider();
  await assert.rejects(publish(instance, post({ disclose: true })), /promotes yourself, a third party, or both/);
});

test('branded content cannot be private', async () => {
  const { instance } = provider();
  await assert.rejects(publish(instance, post({ disclose: true, brand_content_toggle: true })), /private|privacy/i);
});

test('hosted videos use URL transfer without reading or uploading the bytes', async () => {
  const { instance, requests } = provider();
  instance.mediaSize = async () => { throw new Error('Must not HEAD hosted videos'); };
  const result = await publish(instance, post());
  const init = requests.find((r) => r.url.includes('/video/init/'));
  assert.deepEqual(init.body.source_info, { source: 'PULL_FROM_URL', video_url: 'https://93.184.216.34/review.mp4' });
  assert.equal(init.body.post_info.privacy_level, 'SELF_ONLY');
  assert.equal(init.body.post_info.disable_comment, true);
  assert.equal(result[0].status, 'pending');
  assert.equal(result[0].pendingData.publishId, 'v_pub_review');
});

test('hosted transfer rejects non-HTTPS and private-network media', async () => {
  for (const url of ['http://93.184.216.34/review.mp4', 'https://127.0.0.1/review.mp4', 'https://name:password@93.184.216.34/review.mp4']) {
    const { instance } = provider();
    await assert.rejects(publish(instance, post({}, url)), /https|public|media/i);
  }
});

test('video UPLOAD sends only source_info without direct-post settings or unsupported captions', async () => {
  const { instance, requests } = provider();
  await publish(instance, post({ content_posting_method: 'UPLOAD', privacy_level: undefined, music_usage_consent: false }));
  assert.equal(requests.some((r) => r.url.includes('creator_info')), false);
  const init = requests.find((r) => r.url.includes('/inbox/video/init/'));
  assert.deepEqual(init.body, {
    source_info: { source: 'PULL_FROM_URL', video_url: 'https://93.184.216.34/review.mp4' },
  });
});

test('photo UPLOAD preserves supported title and description in MEDIA_UPLOAD', async () => {
  const { instance, requests } = provider();
  await publish(instance, post({ content_posting_method: 'UPLOAD', title: 'Original photo title', privacy_level: undefined, music_usage_consent: false }, 'https://93.184.216.34/review.jpg'));
  assert.equal(requests.some((r) => r.url.includes('creator_info')), false);
  const init = requests.find((r) => r.url.includes('/content/init/'));
  assert.deepEqual(init.body, {
    post_info: { title: 'Original photo title', description: 'Original PostDelegate review clip' },
    post_mode: 'MEDIA_UPLOAD',
    media_type: 'PHOTO',
    source_info: { source: 'PULL_FROM_URL', photo_cover_index: 0, photo_images: ['https://93.184.216.34/review.jpg'] },
  });
});

test('DTO blocks legacy direct publishing without loaded creator data or consent', () => {
  const value = Object.assign(new TikTokDto(), settings({ creator_info_verified: false, music_usage_consent: false }));
  const errors = validateSync(value).map((error) => error.property);
  assert.ok(errors.includes('creator_info_verified'));
  assert.ok(errors.includes('music_usage_consent'));
});

test('DTO preserves Business compatibility and permits legacy inbox uploads without direct-post acknowledgements', () => {
  for (const overrides of [
    { __type: 'tiktok-business', creator_info_verified: undefined, music_usage_consent: undefined, disclose: undefined },
    { content_posting_method: 'UPLOAD', privacy_level: undefined, creator_info_verified: undefined, music_usage_consent: undefined, disclose: undefined },
  ]) {
    const value = Object.assign(new TikTokDto(), settings(overrides));
    assert.deepEqual(validateSync(value).map((error) => error.property), []);
  }
});

test('malformed creator permissions fail closed before starting a publish', async () => {
  const { instance, requests } = provider({ ...creator, comment_disabled: undefined });
  await assert.rejects(publish(instance, post()), /permissions|creator/i);
  assert.equal(requests.filter((r) => r.url.includes('/video/init/')).length, 0);
});

test('photo posts ignore video-only interaction and AI flags', async () => {
  const { instance, requests } = provider({ ...creator, duet_disabled: true, stitch_disabled: true });
  await publish(instance, post({ duet: true, stitch: true, video_made_with_ai: true }, 'https://93.184.216.34/review.jpg'));
  const init = requests.find((r) => r.url.includes('/content/init/'));
  assert.equal(init.body.media_type, 'PHOTO');
  assert.equal(init.body.post_info.disable_duet, undefined);
  assert.equal(init.body.post_info.disable_stitch, undefined);
  assert.equal(init.body.post_info.is_aigc, undefined);
});

test('MOV and WebM videos retain the video endpoint and original content type', async () => {
  for (const [extension, contentType] of [['mov', 'video/quicktime'], ['webm', 'video/webm']]) {
    const { instance, requests } = provider();
    const uploads = [];
    instance.uploadTikTokVideoBytes = async (...args) => { uploads.push(args); };
    const originalFetch = instance.fetch;
    instance.fetch = async (url, options) => {
      if (url.includes('/video/init/')) {
        await originalFetch(url, options);
        return { json: async () => ({ data: { publish_id: 'v_pub_local', upload_url: 'https://open-upload.tiktokapis.com/test' }, error: { code: 'ok' } }) };
      }
      return originalFetch(url, options);
    };
    await publish(instance, post({}, `/uploads/original.${extension}`));
    const init = requests.find((r) => r.url.includes('/video/init/'));
    assert.equal(init.body.source_info.source, 'FILE_UPLOAD');
    assert.equal(uploads[0][3], contentType);
  }
});

test('pending checks preserve TikTok post IDs larger than JavaScript safe integers', async () => {
  const { instance } = provider();
  instance.fetch = async () => ({ text: async () => '{"data":{"status":"PUBLISH_COMPLETE","publicaly_available_post_id":[7558564526789012345]},"error":{"code":"ok"}}' });
  const result = await instance.checkPostStatus('test-token', { publishId: 'v_pub_review' }, { profile: 'review_account' });
  assert.equal(result.status, 'completed');
  assert.equal(result.postId, '7558564526789012345');
  assert.equal(result.releaseURL, 'https://www.tiktok.com/@review_account/video/7558564526789012345');
});
