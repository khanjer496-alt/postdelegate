/* Disposable dependency-image tests: mount checkout at /review. Executes the
 * real YouTube provider; Google SDK transport boundaries are controlled fakes.
 * No app bootstrap, live OAuth revocation, database or publishing requests.
 */
const assert = require('node:assert/strict');
const { test, beforeEach } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const dependencyRequire = Module.createRequire('/app/package.json');
const ts = dependencyRequire('typescript');
const root = path.resolve(__dirname, '../../../..');
const sourceRoot = path.join(root, 'libraries/nestjs-libraries/src');
const clientId = '325521386136-review.apps.googleusercontent.com';
const required = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
];
const connection = () => ({ accessToken: 'old-access', refreshToken: 'refresh-secret', internalId: 'UC_channel', rootInternalId: 'google-subject' });
const error = (status, code) => Object.assign(new Error('SDK request failed'), { response: { status, data: { error: code } } });
let tokenInfo;
let refresh;
let channelRead;
let revoke;
let refreshCalls;
let requests;
class OAuth2Client {
  constructor() { this.transporter = { request: async (options) => { requests.push(options); return revoke(options); } }; }
  setCredentials(credentials) { this.credentials = credentials; }
  async getTokenInfo(token) { return tokenInfo(token); }
  async refreshAccessToken() { refreshCalls++; return refresh(this.credentials); }
}
const infrastructure = {
  googleapis: { google: {
    auth: { OAuth2: OAuth2Client },
    youtube: () => ({ channels: { list: async (options) => channelRead(options) } }),
    oauth2: () => ({}), youtubeAnalytics: () => ({}),
  } },
  '@gitroom/nestjs-libraries/integrations/social.abstract': { SocialAbstract: class {}, BadBody: class extends Error {}, PublishedWithError: class extends Error {}, RefreshToken: class extends Error {}, stripQuery: (value) => value },
  '@gitroom/nestjs-libraries/services/make.secure.id': { makeSecureId: () => 'test-state' },
  '@gitroom/nestjs-libraries/dtos/posts/providers-settings/youtube.settings.dto': { YoutubeSettingsDto: class {} },
  '@gitroom/nestjs-libraries/dtos/webhooks/ssrf.safe.dispatcher': { getSsrfSafeDispatcher: () => { throw new Error('Unexpected media request'); } },
  '@gitroom/nestjs-libraries/temporal/temporal.heartbeat': { setHeartbeatDetails() {} },
  '@gitroom/nestjs-libraries/chat/rules.description.decorator': { Rules: () => () => {} },
  '@gitroom/nestjs-libraries/integrations/dashboard.function.decorator': { DashboardFunction: () => () => {} },
};
const filename = path.join(sourceRoot, 'integrations/social/youtube.provider.ts');
const mod = new Module(filename, module);
mod.filename = filename;
mod.paths = Module._nodeModulePaths('/app');
mod.require = (id) => infrastructure[id] || dependencyRequire(id);
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true, esModuleInterop: true } }).outputText, filename);
const { YoutubeProvider } = mod.exports;
beforeEach(() => {
  process.env.YOUTUBE_CLIENT_ID = clientId;
  process.env.YOUTUBE_CLIENT_SECRET = 'configured-secret';
  tokenInfo = async () => ({ aud: clientId, user_id: 'google-subject', scopes: required, expiry_date: Date.now() + 3600000 });
  refresh = async () => ({ credentials: { access_token: 'fresh-access', refresh_token: 'rotated-refresh', expiry_date: Date.now() + 3600000 } });
  channelRead = async () => ({ data: { items: [{ id: 'UC_channel', snippet: { title: 'Current channel', customUrl: '@current', thumbnails: { default: { url: 'https://yt.example/avatar.jpg' } } } }] } });
  revoke = async () => ({ status: 200, data: {} });
  refreshCalls = 0;
  requests = [];
});

test('periodic authorization check returns private refreshed credentials and selected channel metadata', async () => {
  const provider = new YoutubeProvider();
  assert.equal(typeof provider.checkAuthorization, 'function');
  const result = await provider.checkAuthorization(connection());
  assert.equal(result.status, 'valid');
  assert.equal(result.credentials.accessToken, 'fresh-access');
  assert.equal(result.credentials.refreshToken, 'rotated-refresh');
  assert.ok(result.credentials.expiresIn > 3500);
  assert.deepEqual(result.identity, { name: 'Current channel', profile: '@current', picture: 'https://yt.example/avatar.jpg' });
  assert.deepEqual(result.grant, { realm: 'google-project:325521386136', subject: 'google-subject' });
});

test('OIDC profile and email aliases satisfy required identity scopes', async () => {
  tokenInfo = async () => ({ aud: clientId, sub: 'google-subject', scopes: ['openid', 'email', 'profile', ...required.slice(2)], expiry_date: Date.now() + 3600000 });
  const result = await new YoutubeProvider().checkAuthorization(connection());
  assert.equal(result.status, 'valid');
});

test('missing required YouTube authorization is classified revoked', async () => {
  tokenInfo = async () => ({ aud: clientId, user_id: 'google-subject', scopes: required.filter((scope) => !scope.includes('youtube.upload')) });
  assert.equal((await new YoutubeProvider().checkAuthorization(connection())).status, 'revoked');
});

test('expired access token refreshes privately and validates the refreshed grant', async () => {
  tokenInfo = async (token) => {
    if (token === 'old-access') throw error(400, 'invalid_token');
    return { aud: clientId, sub: 'google-subject', scopes: required, expiry_date: Date.now() + 3600000 };
  };
  const result = await new YoutubeProvider().checkAuthorization(connection());
  assert.equal(result.status, 'valid');
  assert.equal(result.credentials.accessToken, 'fresh-access');
});

test('confirmed invalid_grant revocation is distinguished from outages and client configuration errors', async () => {
  for (const [status, code, expected] of [[400, 'invalid_grant', 'revoked'], [400, 'invalid_client', 'unknown'], [429, 'rate_limit_exceeded', 'unknown'], [503, 'unavailable', 'unknown']]) {
    refresh = async () => { throw error(status, code); };
    const result = await new YoutubeProvider().checkAuthorization(connection());
    assert.equal(result.status, expected);
    assert.equal(result.credentials, undefined);
  }
});

test('network errors leave authorization unknown and retain credentials', async () => {
  tokenInfo = async () => { throw new TypeError('Network unavailable'); };
  assert.deepEqual(await new YoutubeProvider().checkAuthorization(connection()), { status: 'unknown' });
});

test('token audience or root subject mismatch is unknown and never refreshes another grant', async () => {
  for (const info of [
    { aud: '790268112731-other.apps.googleusercontent.com', user_id: 'google-subject', scopes: required },
    { aud: clientId, user_id: 'different-subject', scopes: required },
  ]) {
    tokenInfo = async () => info;
    assert.deepEqual(await new YoutubeProvider().checkAuthorization(connection()), { status: 'unknown' });
    assert.equal(refreshCalls, 0);
  }
});

test('grant grouping requires verified audience and subject and never falls back to root identity', async () => {
  const provider = new YoutubeProvider();
  assert.deepEqual(await provider.getAuthorizationGrant(connection()), { realm: 'google-project:325521386136', subject: 'google-subject' });
  for (const info of [{ aud: clientId, scopes: required }, { user_id: 'google-subject', scopes: required }, { aud: 'unknown-client', user_id: 'google-subject', scopes: required }]) {
    tokenInfo = async () => info;
    assert.equal(await provider.getAuthorizationGrant(connection()), undefined);
  }
  tokenInfo = async () => { throw error(400, 'invalid_token'); };
  assert.equal(await provider.getAuthorizationGrant(connection()), undefined);
});

test('verified clients in the same project share a grant realm without refreshing with the wrong client', async () => {
  tokenInfo = async () => ({ aud: '325521386136-another.apps.googleusercontent.com', user_id: 'google-subject', scopes: required });
  const provider = new YoutubeProvider();
  assert.deepEqual(await provider.getAuthorizationGrant(connection()), { realm: 'google-project:325521386136', subject: 'google-subject' });
  assert.deepEqual(await provider.checkAuthorization(connection()), { status: 'unknown' });
  assert.equal(refreshCalls, 0);
});

test('malformed or conflicting subject claims never permit cross-organization grouping', async () => {
  const provider = new YoutubeProvider();
  for (const info of [
    { aud: clientId, sub: 'google-subject', user_id: 'other-subject' },
    { aud: '325521386136.invalid.apps.googleusercontent.com', sub: 'google-subject' },
  ]) {
    tokenInfo = async () => info;
    assert.equal(await provider.getAuthorizationGrant(connection()), undefined);
    assert.deepEqual(await provider.checkAuthorization(connection()), { status: 'unknown' });
  }
});

test('a rotated token cannot remove required scopes or change the verified grant', async () => {
  tokenInfo = async (token) => ({ aud: clientId, sub: token === 'old-access' ? 'google-subject' : 'different-subject', scopes: required });
  assert.deepEqual(await new YoutubeProvider().checkAuthorization(connection()), { status: 'unknown' });
  tokenInfo = async (token) => ({ aud: clientId, sub: 'google-subject', scopes: token === 'old-access' ? required : required.slice(0, 3) });
  assert.deepEqual(await new YoutubeProvider().checkAuthorization(connection()), { status: 'revoked' });
});

test('inaccessible or malformed selected channel metadata stays unknown without leaking SDK errors', async () => {
  for (const read of [async () => ({ data: { items: [] } }), async () => { throw error(503, 'backendError'); }]) {
    channelRead = read;
    const result = await new YoutubeProvider().checkAuthorization(connection());
    assert.deepEqual(result, { status: 'unknown' });
  }
});

test('revocation sends refresh token in a POST form body, never a URL or Authorization header', async () => {
  const provider = new YoutubeProvider();
  assert.deepEqual(await provider.revokeAuthorization(connection()), { status: 'revoked' });
  const request = requests[0];
  assert.equal(request.url, 'https://oauth2.googleapis.com/revoke');
  assert.equal(request.method, 'POST');
  assert.equal(request.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.equal(new URLSearchParams(request.data).get('token'), 'refresh-secret');
  assert.equal(request.headers.Authorization, undefined);
});

test('revocation falls back to access token only when no refresh token is stored', async () => {
  assert.equal((await new YoutubeProvider().revokeAuthorization({ ...connection(), refreshToken: null })).status, 'revoked');
  assert.equal(new URLSearchParams(requests[0].data).get('token'), 'old-access');
});

test('already invalid revocation is complete but transient and invalid_client responses remain unknown', async () => {
  for (const [status, code, expected] of [[400, 'invalid_token', 'revoked'], [400, 'invalid_client', 'unknown'], [429, 'rate_limit_exceeded', 'unknown'], [500, 'backendError', 'unknown']]) {
    revoke = async () => { throw error(status, code); };
    assert.deepEqual(await new YoutubeProvider().revokeAuthorization(connection()), { status: expected });
  }
});

test('missing OAuth client configuration or revocation credentials never reports deletion-safe revocation', async () => {
  delete process.env.YOUTUBE_CLIENT_ID;
  assert.deepEqual(await new YoutubeProvider().checkAuthorization(connection()), { status: 'unknown' });
  assert.deepEqual(await new YoutubeProvider().revokeAuthorization({ ...connection(), accessToken: '', refreshToken: null }), { status: 'unknown' });
});

test('public policy warns about shared Google project grants and keeps avatars remote', () => {
  const policy = new YoutubeProvider().authorizationPolicy;
  assert.equal(policy.authorizationRealm, 'google-project:325521386136');
  assert.equal(policy.useRemoteAvatar, true);
  assert.match(policy.deletionNotice, /Google project/);
  assert.match(policy.deletionNotice, /sign.in/i);
  assert.match(policy.deletionNotice, /videos.*remain|does not delete.*videos/i);
});
