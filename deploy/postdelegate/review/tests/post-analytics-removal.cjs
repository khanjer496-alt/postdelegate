// Actual service method bodies, with only provider/database/cache boundaries
// controlled. No application bootstrap, credentials or network access.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const dependencyRequire = Module.createRequire('/app/package.json');
const ts = dependencyRequire('typescript');
const sourcePath = path.resolve(__dirname, '../../../../libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts');
const source = ts.createSourceFile(sourcePath, fs.readFileSync(sourcePath, 'utf8'), ts.ScriptTarget.Latest, true);
const names = new Set(['checkPostAnalytics', 'getReleaseURL', 'resolveRelease', 'canReturnProviderData']);
const methods = [];
const visit = (node) => {
  if (ts.isMethodDeclaration(node) && names.has(node.name.getText(source))) methods.push(node.getText(source));
  ts.forEachChild(node, visit);
};
visit(source);
const compiled = ts.transpileModule(`return class Subject {${methods.join('\n')}}`, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
class RefreshToken extends Error {}
function fixture({ managed = true } = {}) {
  const cache = [];
  const current = { id: 'post', integrationId: 'channel', deletedAt: null, releaseId: 'video', releaseURL: 'https://youtube.test/video', settings: '{}', integration: { id: 'channel', token: 'generation-a', tokenExpiration: new Date('2099-01-01'), internalId: 'UC_test', providerIdentifier: 'youtube', deletedAt: null, disabled: false, inBetweenSteps: false, refreshNeeded: false } };
  const report = [{ label: 'Views', data: [{ total: '1', date: '2026-10-27' }], percentageChange: 0 }];
  let calls = 0;
  const provider = { authorizationPolicy: managed ? { bypassAnalyticsCache: true } : undefined, postAnalytics: async () => { calls++; return report; } };
  const Subject = new Function('dayjs', 'ioRedis', 'RefreshToken', 'timer', compiled)(dependencyRequire('dayjs'), { set: async (...args) => cache.push(args) }, RefreshToken, async () => {});
  const service = new Subject();
  service._postRepository = { getPostById: async () => structuredClone(current), updateResolvedRelease: async () => ({ id: 'post' }) };
  service._integrationManager = { getSocialIntegration: () => provider };
  service._refreshIntegrationService = { refresh: async () => { throw new Error('Unexpected refresh'); } };
  return { service, current, provider, report, cache, calls: () => calls };
}
test('active analytics retains the report and existing cache behavior for other providers', async () => {
  const f = fixture({ managed: false });
  assert.deepEqual(await f.service.checkPostAnalytics('org', 'post', 30), f.report);
  assert.equal(f.cache.length, 1);
});
test('managed analytics does not create persistent cache data', async () => {
  const f = fixture();
  assert.deepEqual(await f.service.checkPostAnalytics('org', 'post', 30), f.report);
  assert.equal(f.cache.length, 0);
});
test('an already removed connection cannot request post analytics', async () => {
  const f = fixture();
  f.current.integration.deletedAt = new Date();
  assert.deepEqual(await f.service.checkPostAnalytics('org', 'post', 30), []);
  assert.equal(f.calls(), 0);
});
for (const [reason, mutate] of [
  ['connection deletion', (post) => { post.integration.deletedAt = new Date(); }],
  ['post deletion', (post) => { post.deletedAt = new Date(); }],
  ['reconnection', (post) => { post.integration.token = 'generation-b'; }],
  ['channel reassignment', (post) => { post.integrationId = post.integration.id = 'another-channel'; }],
]) {
  test(`analytics completed after ${reason} cannot return or cache stale API data`, async () => {
    const f = fixture();
    f.provider.postAnalytics = async () => { mutate(f.current); return f.report; };
    assert.deepEqual(await f.service.checkPostAnalytics('org', 'post', 30), []);
    assert.equal(f.cache.length, 0);
  });
}
test('deletion during release resolution prevents the subsequent analytics call', async () => {
  const f = fixture();
  f.provider.resolveReleaseId = async () => { f.current.integration.deletedAt = new Date(); return undefined; };
  assert.deepEqual(await f.service.checkPostAnalytics('org', 'post', 30), []);
  assert.equal(f.calls(), 0);
});
test('a release URL resolved after deletion is unavailable to the caller', async () => {
  const f = fixture();
  f.provider.resolveReleaseId = async () => { f.current.deletedAt = new Date(); return undefined; };
  assert.deepEqual(await f.service.getReleaseURL('org', 'post'), { releaseURL: '', unavailable: true });
});
