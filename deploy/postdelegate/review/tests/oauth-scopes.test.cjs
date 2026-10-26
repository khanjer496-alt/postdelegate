/* Run in the dependency image with source mounted at /review:
 * docker run --rm --entrypoint node -v "$PWD:/review:ro" IMAGE \
 *   /review/deploy/postdelegate/review/tests/oauth-scopes.test.cjs
 * No app bootstrap, credentials, network requests, or publishing workers.
 */
const assert = require('node:assert/strict');
const { test, afterEach } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const dependencyRequire = Module.createRequire(process.env.POSTDELEGATE_DEPENDENCY_ROOT || '/app/package.json');
const ts = dependencyRequire('typescript');
const root = path.resolve(__dirname, '../../../..');
const sourceRoot = path.join(root, 'libraries/nestjs-libraries/src');
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

// The provider methods and the inherited granted-scope validation run from
// production source. Only SDK/transport and unrelated media boundaries are
// replaced; an unexpected network request fails instead of contacting an API.
let grantedYoutubeScopes = [];
let googleAuthOptions;
let googleClientOptions;
let identityReads = 0;
class OAuth2Client {
  constructor(options) { googleClientOptions = options; }
  generateAuthUrl(options) { googleAuthOptions = options; return 'https://accounts.google.com/o/oauth2/v2/auth'; }
  async getToken() { return { tokens: { access_token: 'test-token', refresh_token: 'test-refresh', expiry_date: Date.now() + 3600000 } }; }
  setCredentials() {}
  async getTokenInfo() { return { scopes: grantedYoutubeScopes }; }
}
const infrastructure = {
  googleapis: { google: {
    auth: { OAuth2: OAuth2Client },
    oauth2: () => ({ userinfo: { get: async () => {
      identityReads++;
      return { data: { id: 'review-google-account', name: 'Review account', picture: '' } };
    } } }),
  } },
  '@temporalio/activity': { ApplicationFailure: class extends Error {} },
  '@gitroom/nestjs-libraries/services/make.secure.id': { makeSecureId: () => 'test-state' },
  '@gitroom/nestjs-libraries/chat/rules.description.decorator': { Rules: () => () => {} },
  '@gitroom/nestjs-libraries/integrations/dashboard.function.decorator': { DashboardFunction: () => () => {} },
  '@gitroom/nestjs-libraries/integrations/tool.decorator': { Tool: () => () => {} },
  '@gitroom/nestjs-libraries/dtos/posts/providers-settings/youtube.settings.dto': { YoutubeSettingsDto: class {} },
  '@gitroom/nestjs-libraries/dtos/posts/providers-settings/pinterest.dto': { PinterestSettingsDto: class {} },
  '@gitroom/nestjs-libraries/temporal/temporal.heartbeat': { setHeartbeatDetails: () => {} },
  '@gitroom/nestjs-libraries/dtos/webhooks/ssrf.safe.dispatcher': {
    getSsrfSafeDispatcher: () => { throw new Error('Unexpected media request'); },
    getSsrfSafeAxios: () => { throw new Error('Unexpected media request'); },
  },
  '@gitroom/helpers/utils/timer': { timer: async () => {} },
  '@gitroom/helpers/utils/has.extension': { hasExtension: () => false },
  sharp: () => { throw new Error('Unexpected image operation'); },
};
const cache = new Map();
function loadSource(filename) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module);
  cache.set(filename, mod);
  mod.filename = filename;
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
      experimentalDecorators: true, emitDecoratorMetadata: false, esModuleInterop: true,
    },
  }).outputText;
  mod._compile(output, filename);
  return mod.exports;
}
const { YoutubeProvider } = loadSource(path.join(sourceRoot, 'integrations/social/youtube.provider.ts'));
const { PinterestProvider } = loadSource(path.join(sourceRoot, 'integrations/social/pinterest.provider.ts'));
const { NotEnoughScopes } = loadSource(path.join(sourceRoot, 'integrations/social.abstract.ts'));
const youtubeScopes = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
];
const pinterestScopes = ['boards:read', 'boards:write', 'pins:read', 'pins:write', 'user_accounts:read'];
const authenticateParams = { code: 'test-code', codeVerifier: 'test-verifier', refresh: '' };
const jsonResponse = (value) => ({ json: async () => value });

test('YouTube requests only identity, uploads, channel reads and analytics', async () => {
  const provider = new YoutubeProvider();
  await provider.generateAuthUrl();
  assert.deepEqual(googleAuthOptions.scope, youtubeScopes);
  assert.equal(googleAuthOptions.access_type, 'offline');
  assert.equal(googleClientOptions.redirectUri, `${process.env.FRONTEND_URL}/integrations/social/youtube`);
  assert.equal(googleClientOptions.clientId, process.env.YOUTUBE_CLIENT_ID);
  assert.equal(googleClientOptions.clientSecret, process.env.YOUTUBE_CLIENT_SECRET);
});

test('YouTube accepts the narrowed grant without broad account or partner permissions', async () => {
  grantedYoutubeScopes = youtubeScopes.slice();
  const identity = await new YoutubeProvider().authenticate(authenticateParams);
  assert.equal(identity.id, 'review-google-account');
});

test('YouTube rejects an incomplete grant before reading account identity', async () => {
  grantedYoutubeScopes = youtubeScopes.filter((scope) => !scope.endsWith('/youtube.upload'));
  const readsBefore = identityReads;
  await assert.rejects(new YoutubeProvider().authenticate(authenticateParams), (error) => error instanceof NotEnoughScopes);
  assert.equal(identityReads, readsBefore);
});

test('Pinterest authorizes the same scope list used by validation and refresh', async () => {
  const provider = new PinterestProvider();
  assert.deepEqual(provider.scopes, pinterestScopes);
  // Exercise a future list change to catch a hard-coded authorization URL.
  provider.scopes = [...provider.scopes, 'pins:read_secret'];
  const result = await provider.generateAuthUrl();
  assert.deepEqual(new URL(result.url).searchParams.get('scope').split(','), provider.scopes);
});

test('Pinterest accepts all permissions required for existing-board Pin creation', async () => {
  global.fetch = async (url) => jsonResponse(url.endsWith('/oauth/token')
    ? { access_token: 'test-token', refresh_token: 'test-refresh', expires_in: 3600, scope: pinterestScopes.join(',') }
    : { id: 'review-pinterest-account', username: 'review-account', profile_image: '' });
  const identity = await new PinterestProvider().authenticate(authenticateParams);
  assert.equal(identity.id, 'review-pinterest-account');
});

test('Pinterest rejects a grant missing boards:write required by POST /pins', async () => {
  let accountReads = 0;
  global.fetch = async (url) => {
    if (!url.endsWith('/oauth/token')) accountReads++;
    return jsonResponse({ access_token: 'test-token', scope: pinterestScopes.filter((scope) => scope !== 'boards:write').join(',') });
  };
  await assert.rejects(new PinterestProvider().authenticate(authenticateParams), (error) => error instanceof NotEnoughScopes);
  assert.equal(accountReads, 0);
});

test('Pinterest refresh retains the same required scopes and callback', async () => {
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    return jsonResponse(url.endsWith('/oauth/token')
      ? { access_token: 'test-token', expires_in: 3600 }
      : { id: 'review-pinterest-account', username: 'review-account', profile_image: '' });
  };
  const provider = new PinterestProvider();
  const identity = await provider.refreshToken('test-refresh');
  const body = requests[0].options.body;
  assert.deepEqual(body.get('scope').split(','), provider.scopes);
  assert.equal(body.get('redirect_uri'), `${process.env.FRONTEND_URL}/integrations/social/pinterest`);
  assert.equal(identity.refreshToken, 'test-refresh');
});
