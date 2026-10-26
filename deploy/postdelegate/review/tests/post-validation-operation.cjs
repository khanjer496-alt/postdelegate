/* Isolated dependency-image test: mount the checkout at /review and run this
 * file with node. Real PostsService, ValidationPipe and settings DTO validators
 * execute; database, workflow, media and unrelated provider boundaries are mocked.
 */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const dependencyRequire = Module.createRequire('/app/package.json');
const ts = dependencyRequire('typescript');
dependencyRequire('reflect-metadata');
const root = path.resolve(__dirname, '../../../..');
const sourceRoot = path.join(root, 'libraries/nestjs-libraries/src');
const aliases = '@gitroom/nestjs-libraries/';
const realSources = new Set([
  'database/prisma/posts/posts.service',
  'dtos/posts/create.post.dto',
  'dtos/posts/providers-settings/tiktok.dto',
  'dtos/media/media.dto',
]);
const noop = () => {};
const infrastructure = {
  '@gitroom/nestjs-libraries/upload/upload.factory': { UploadFactory: { createStorage: () => ({}) } },
  '@gitroom/nestjs-libraries/redis/redis.service': { ioRedis: {} },
  '@gitroom/helpers/utils/valid.images': { ValidContent: class { validate() { return true; } } },
  '@gitroom/helpers/utils/sanitize.post.content': { sanitizePostContent: (text) => text, postContentPlainText: (text) => text },
  '@gitroom/helpers/utils/strip.html.validation': { stripHtmlValidation: (_editor, text) => text },
  '@gitroom/helpers/utils/count.length': { countLength: (_provider, text) => text.length },
  '@sentry/nestjs': { metrics: { count: noop } },
  sharp: noop,
};
const cache = new Map();
function loadSource(relative) {
  const filename = path.join(sourceRoot, relative + '.ts');
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module);
  cache.set(filename, mod);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths('/app');
  mod.require = (id) => {
    if (infrastructure[id]) return infrastructure[id];
    if (id === aliases + 'dtos/posts/providers-settings/all.providers.settings') {
      const { TikTokDto } = loadSource('dtos/posts/providers-settings/tiktok.dto');
      return { EmptySettings: class {}, allProviders: () => [{ name: 'tiktok', value: TikTokDto }] };
    }
    if (id.startsWith(aliases) && realSources.has(id.slice(aliases.length))) return loadSource(id.slice(aliases.length));
    if (id.startsWith('@gitroom/')) return new Proxy({}, { get: (_target, key) => key === '__esModule' ? true : class {} });
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
const { PostsService } = loadSource('database/prisma/posts/posts.service');
const { TikTokDto } = loadSource('dtos/posts/providers-settings/tiktok.dto');
const settings = (overrides = {}) => ({
  __type: 'tiktok', content_posting_method: 'DIRECT_POST', privacy_level: 'SELF_ONLY',
  duet: false, stitch: false, comment: false, autoAddMusic: 'no',
  brand_content_toggle: false, brand_organic_toggle: false,
  // A previously saved post has none of the new publication acknowledgements.
  ...overrides,
});
const post = (overrides = {}, settingOverrides = {}) => ({
  integration: { id: 'review-channel' },
  value: [{ content: 'Original review content', image: [] }],
  settings: settings(settingOverrides), ...overrides,
});
const body = (operation, posts = [post()]) => ({
  type: operation, shortLink: false, date: '2026-12-01T12:00:00Z', tags: [], posts,
});
function service() {
  const instance = Object.create(PostsService.prototype);
  instance._integrationService = { getIntegrationById: async () => ({ id: 'review-channel', providerIdentifier: 'tiktok', additionalSettings: '[]', name: 'Review channel' }) };
  instance._integrationManager = { getSocialIntegration: () => ({ dto: TikTokDto, checkValidity: async () => true, maxLength: () => 2000 }) };
  return instance;
}

test('published-post updates preserve standard settings validation without fresh publishing acknowledgements', async () => {
  const instance = service();
  const [valid] = await instance.validatePosts('org', [post()], 'update');
  assert.equal(valid.valid, true, valid.settingsError);
  const [invalid] = await instance.validatePosts('org', [post({}, { comment: 'invalid' })], 'update');
  assert.equal(invalid.valid, false);
  assert.match(invalid.settingsError, /comment/i);
});

test('scheduled and immediate publications still require music and creator acknowledgements', async () => {
  for (const operation of ['schedule', 'now']) {
    const [result] = await service().validatePosts('org', [post({}, { disclose: false })], operation);
    assert.equal(result.valid, false);
    assert.match(result.settingsError, /commercial|Music|TikTok account/i);
  }
});

test('forged raw operation context and child update cannot bypass actual immediate publication validation', async () => {
  const [result] = await service().validatePosts('org', [post({ type: 'update' }, { disclose: false, __validationOperation: 'update' })], 'now');
  assert.equal(result.valid, false);
});

test('raw provider discriminators cannot bypass either actual or preview validation', async () => {
  for (const preview of [false, true]) {
    const [result] = await service().validatePosts('org', [post({}, { __type: 'tiktok-business', disclose: false })], 'now', preview);
    assert.equal(result.valid, false);
    assert.match(result.settingsError, /Music|TikTok account/i);
  }
});

test('internal callers without an operation default to publication validation', async () => {
  const [result] = await service().validatePosts('org', [post({}, { disclose: false, __validationOperation: 'update' })]);
  assert.equal(result.valid, false);
});

test('mixed-channel preview uses effective child operation only when explicitly enabled', async () => {
  const [update, publishing] = await service().validatePosts('org', [post({ type: 'update' }), post({ type: 'schedule' })], 'schedule', true);
  assert.equal(update.valid, true, update.settingsError);
  assert.equal(publishing.valid, false);
});

test('update validation still applies provider media and content limits', async () => {
  const instance = service();
  instance._integrationManager.getSocialIntegration = () => ({ dto: TikTokDto, checkValidity: async () => 'Invalid video dimensions', maxLength: () => 4 });
  const [result] = await instance.validatePosts('org', [post()], 'update');
  assert.equal(result.valid, true);
  assert.equal(result.errors, 'Invalid video dimensions');
  assert.equal(result.tooLong, true);
});

test('mapper validates updates without fresh acknowledgements and removes ephemeral context', async () => {
  const output = await service().mapTypeToPost(body('update'), 'org');
  assert.equal(output.posts[0].settings.__validationOperation, undefined);
  assert.equal(output.posts[0].type, 'update');
});

test('mapper refuses forged child draft and raw context on a publishing request', async () => {
  await assert.rejects(service().mapTypeToPost(body('now', [post({ type: 'draft' }, { __validationOperation: 'update' })]), 'org'));
});

test('public mapper can preserve full standard validation while using actual update operation', async () => {
  const output = await service().mapTypeToPost(body('update'), 'org', true, 'update');
  assert.equal(output.type, 'schedule');
  assert.equal(output.posts[0].settings.__validationOperation, undefined);
  await assert.rejects(service().mapTypeToPost(body('update', [post({}, { privacy_level: 'invalid' })]), 'org', true, 'update'));
});

test('draft and update skip only publication-specific commercial constraints', async () => {
  for (const operation of ['draft', 'update']) {
    const [result] = await service().validatePosts('org', [post({}, { brand_content_toggle: true, disclose: true })], operation);
    assert.equal(result.valid, true, result.settingsError);
    const [invalid] = await service().validatePosts('org', [post({}, { privacy_level: 'invalid' })], operation);
    assert.equal(invalid.valid, false);
  }
});

test('ephemeral operation context is never passed to persistence', async () => {
  const instance = service();
  let savedSettings;
  instance._postRepository = { createOrUpdatePost: async (_type, _org, _date, value) => {
    savedSettings = value.settings;
    return { posts: [{ id: 'post-1', state: 'PUBLISHED' }] };
  } };
  instance.detachStaleAnchors = async () => {};
  await instance.createPost('org', body('update', [post({}, { __validationOperation: 'update' })]), 'WEB');
  assert.equal(Object.hasOwn(savedSettings, '__validationOperation'), false);
});

test('settings-only updates on queued posts use update validation while keeping the workflow intact', async () => {
  const instance = service();
  instance.getPostsRecursively = async () => [{
    id: 'post-1', state: 'QUEUE', publishDate: new Date('2026-12-01T12:00:00Z'),
    content: 'Original review content', image: '[]', settings: JSON.stringify(settings()), group: 'review-group',
    integration: { id: 'review-channel', providerIdentifier: 'tiktok' },
  }];
  let saved;
  instance.createPost = async (_org, value) => { saved = value; return [{ postId: 'post-1' }]; };
  const output = await instance.updatePostSettings('org', 'post-1', { comment: true }, 'API');
  assert.equal(output.postId, 'post-1');
  assert.equal(saved.type, 'update');
  assert.equal(saved.posts[0].settings.comment, true);
});
