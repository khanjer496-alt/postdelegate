/* Real PostRepository and existing activity bodies, controlled database/provider
 * boundaries. No database, workers, Google requests, or live publishing.
 */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const dependencyRequire = Module.createRequire('/app/package.json');
const ts = dependencyRequire('typescript');
const root = path.resolve(__dirname, '../../../..');
class BadBody extends Error { constructor(_id, _json, _body, message) { super(message); } }
const noop = () => {};
const infrastructure = {
  '@nestjs/common': { Injectable: () => noop, BadRequestException: class extends Error {} },
  'nestjs-temporal-core': { Activity: () => noop, ActivityMethod: () => noop },
  '@temporalio/common': { TypedSearchAttributes: class {} },
  '@gitroom/nestjs-libraries/temporal/temporal.heartbeat': { withHeartbeat: (callback) => callback(), setHeartbeatDetails() {} },
  '@gitroom/helpers/utils/strip.html.validation': { stripHtmlValidation: (_editor, text) => text },
  '@gitroom/nestjs-libraries/integrations/social.abstract': { BadBody, Disconnect: class extends Error {}, PublishedWithError: class extends Error {} },
};
function loadSource(relative) {
  const filename = path.join(root, relative);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths('/app');
  mod.require = (id) => infrastructure[id] || (id.startsWith('@gitroom/') ? new Proxy({}, { get: (_target, key) => key === '__esModule' ? true : class {} }) : dependencyRequire(id));
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const { PostsRepository } = loadSource('libraries/nestjs-libraries/src/database/prisma/posts/posts.repository.ts');
const { PostActivity } = loadSource('apps/orchestrator/src/activities/post.activity.ts');
const { IntegrationsActivity } = loadSource('apps/orchestrator/src/activities/integrations.activity.ts');
function database({ postDeleted = false, channelDeleted = false, deleteAfterPostWrite = false, auditFailure = false, reassignAfterPostWrite = false } = {}) {
  const integration = { id: 'channel', deletedAt: channelDeleted ? new Date() : null, providerIdentifier: 'youtube' };
  const row = { id: 'post', organizationId: 'org', integrationId: 'channel', deletedAt: postDeleted ? new Date() : null, state: 'QUEUE', releaseId: 'missing', releaseURL: null, error: null, image: '[]' };
  const errors = [];
  let inTransaction = false;
  let locked = false;
  let pendingDelete = false;
  const tombstone = () => { integration.deletedAt = new Date(); row.releaseId = null; row.releaseURL = null; row.error = null; errors.length = 0; };
  const matches = (where) => (!where.AND || where.AND.every(matches)) &&
    (!Object.hasOwn(where, 'deletedAt') || where.deletedAt !== null || row.deletedAt === null) &&
    (!where.integration || where.integration.deletedAt !== null || integration.deletedAt === null) &&
    (!where.integrationId || where.integrationId === row.integrationId) &&
    (!where.organizationId || where.organizationId === row.organizationId) &&
    (!where.releaseId || row.releaseId === where.releaseId);
  const post = {
    findUnique: async () => ({ ...row, integration: { ...integration } }),
    findFirst: async ({ where }) => matches(where) ? { ...row, integration: { ...integration } } : null,
    update: async ({ where, data }) => {
      if (!matches(where)) throw new Error('Post unavailable');
      Object.assign(row, data);
      if (deleteAfterPostWrite) { if (inTransaction && locked) pendingDelete = true; else tombstone(); }
      return { ...row, integration: { ...integration } };
    },
    updateMany: async ({ where, data }) => {
      if (!matches(where)) return { count: 0 };
      Object.assign(row, data);
      if (deleteAfterPostWrite) { if (inTransaction && locked) pendingDelete = true; else tombstone(); }
      return { count: 1 };
    },
  };
  const model = { post, errors: { create: async ({ data }) => { if (auditFailure) throw new Error('Audit storage unavailable'); errors.push(data); return data; } }, integration: { findUnique: async () => ({ ...integration }), updateMany: async ({ where }) => {
    if (where.deletedAt === null && integration.deletedAt) return { count: 0 };
    locked = true;
    return { count: 1 };
  } } };
  const repository = Object.create(PostsRepository.prototype);
  repository._post = { model };
  repository._errors = { model };
  repository._transaction = { model: { $transaction: async (callback) => {
    inTransaction = true;
    try { return await callback(model); }
    finally { inTransaction = false; locked = false; if (pendingDelete) tombstone(); if (reassignAfterPostWrite) row.integrationId = 'another-channel'; }
  } } };
  return { repository, row, integration, errors };
}
test('active post publication preserves its existing return shape and stored provider result', async () => {
  const { repository, row } = database();
  const result = await repository.updatePost('post', 'video-id', 'https://youtube.test/video-id');
  assert.equal(result.id, 'post');
  assert.equal(result.state, 'PUBLISHED');
  assert.equal(row.releaseId, 'video-id');
  assert.equal(row.releaseURL, 'https://youtube.test/video-id');
});
test('late publication, release resolution and image completion cannot write into tombstoned posts or channels', async () => {
  for (const state of [{ postDeleted: true }, { channelDeleted: true }]) {
    for (const call of [
      (repository) => repository.updatePost('post', 'video-id', 'https://youtube.test/video-id'),
      (repository) => repository.updateResolvedRelease('post', 'org', 'video-id', 'https://youtube.test/video-id'),
      (repository) => repository.updateReleaseId('post', 'org', 'video-id', 'https://youtube.test/video-id'),
      (repository) => repository.updateImages('post', '[{"path":"https://media.test/late.jpg"}]'),
    ]) {
      const { repository, row } = database(state);
      await assert.rejects(call(repository), /unavailable|no longer available|removed|not found/i);
      assert.equal(row.releaseURL, null);
      assert.equal(row.releaseId, 'missing');
      assert.equal(row.image, '[]');
    }
  }
});
test('active errors retain the audit payload atomically with the state update', async () => {
  const { repository, errors, row } = database();
  const result = await repository.changeState('post', 'ERROR', 'Provider failure', { value: 'provider response' });
  assert.equal(result.id, 'post');
  assert.equal(row.state, 'ERROR');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].message, 'Provider failure');
  assert.equal(errors[0].body, '{"value":"provider response"}');
});
test('a late error cannot recreate error details after channel deletion has scrubbed them', async () => {
  const { repository, errors, row } = database({ deleteAfterPostWrite: true });
  await repository.changeState('post', 'ERROR', 'Late provider failure', { value: 'late provider response' });
  assert.equal(row.error, null);
  assert.equal(errors.length, 0);
});
function activityState() {
  let active = true;
  let providerCalls = 0;
  const integration = { id: 'channel', organizationId: 'org', providerIdentifier: 'youtube', internalId: 'UC_channel', token: 'private-test-token', deletedAt: null, disabled: false, inBetweenSteps: false, refreshNeeded: false };
  const post = { id: 'post', integrationId: 'channel', state: 'QUEUE', content: 'Original content', settings: '{}', image: '[]', deletedAt: null, integration };
  const output = [{ id: 'post', postId: 'video-id', releaseURL: 'https://youtube.test/video-id', status: 'success' }];
  const provider = { editor: 'normal', postPending: async () => { providerCalls++; return output; }, checkPostStatus: async () => { providerCalls++; return { status: 'completed', postId: 'video-id', releaseURL: 'https://youtube.test/video-id' }; }, finalizePost: async () => { providerCalls++; return { status: 'completed', postId: 'video-id', releaseURL: 'https://youtube.test/video-id' }; } };
  const activity = Object.create(PostActivity.prototype);
  activity._integrationService = { getIntegrationById: async () => active ? integration : null };
  activity._postService = { getPostById: async () => active ? post : null, updateTags: async () => [post], updateMedia: async () => [] };
  activity._integrationManager = { getSocialIntegration: () => provider };
  activity._temporalService = { client: { getRawClient: () => ({ workflow: { start: async () => {} } }) } };
  return { activity, integration, post, provider, output, deactivate: () => { active = false; }, calls: () => providerCalls };
}
test('a stale publishing activity never calls the provider after a channel tombstone', async () => {
  const fixture = activityState();
  fixture.deactivate();
  await assert.rejects(fixture.activity.postSocialPending(fixture.integration, [fixture.post]), /available|removed/i);
  assert.equal(fixture.calls(), 0);
});
test('normal active publishing retains the provider result for the existing workflow', async () => {
  const fixture = activityState();
  assert.deepEqual(await fixture.activity.postSocialPending(fixture.integration, [fixture.post]), fixture.output);
  assert.equal(fixture.calls(), 1);
});
test('a provider completion after tombstone cannot return fresh API data into workflow history', async () => {
  const fixture = activityState();
  fixture.provider.postPending = async () => { fixture.deactivate(); return fixture.output; };
  await assert.rejects(fixture.activity.postSocialPending(fixture.integration, [fixture.post]), /available|removed/i);
});
test('status and finalize activities recheck the current connection before making provider requests', async () => {
  for (const method of ['checkPostStatus', 'finalizePost']) {
    const fixture = activityState();
    fixture.deactivate();
    await assert.rejects(fixture.activity[method](fixture.integration, {}), /available|removed/i);
    assert.equal(fixture.calls(), 0);
  }
});
test('integration refresh completion after a tombstone cannot return credentials to an existing workflow', async () => {
  const fixture = activityState();
  const activity = Object.create(IntegrationsActivity.prototype);
  activity._integrationService = fixture.activity._integrationService;
  activity._refreshIntegrationService = { refresh: async () => { fixture.deactivate(); return { accessToken: 'late-secret' }; } };
  assert.equal(await activity.refreshToken(fixture.integration), false);
});

test('active release and media updates keep their existing stored values and response shape', async () => {
  const { repository, row } = database();
  assert.equal((await repository.updateReleaseId('post', 'org', 'first-video', 'https://youtube.test/first-video')).id, 'post');
  assert.equal(row.releaseId, 'first-video');
  assert.equal((await repository.updateResolvedRelease('post', 'org', 'resolved-video', 'https://youtube.test/resolved-video')).id, 'post');
  assert.equal(row.releaseId, 'resolved-video');
  assert.equal((await repository.updateImages('post', '[{"path":"https://media.test/current.jpg"}]')).id, 'post');
  assert.equal(row.image, '[{"path":"https://media.test/current.jpg"}]');
});

test('an individually deleted post cannot publish on an otherwise active channel', async () => {
  const fixture = activityState();
  fixture.post.deletedAt = new Date();
  await assert.rejects(fixture.activity.postSocialPending(fixture.integration, [fixture.post]), /available/i);
  assert.equal(fixture.calls(), 0);
});

test('late comments, status checks and finalization cannot return provider data after a tombstone', async () => {
  for (const method of ['postComment', 'checkPostStatus', 'finalizePost']) {
    const fixture = activityState();
    const complete = async () => { fixture.deactivate(); return fixture.output; };
    if (method === 'postComment') {
      fixture.provider.comment = complete;
      await assert.rejects(fixture.activity.postComment('remote-post', undefined, fixture.integration, [fixture.post]), /available/i);
    } else {
      fixture.provider[method] = complete;
      await assert.rejects(fixture.activity[method](fixture.integration, {}), /available/i);
    }
  }
});

test('both legacy PostActivity refresh methods discard late credentials after a tombstone', async () => {
  for (const method of ['refreshToken', 'refreshTokenWithCause']) {
    const fixture = activityState();
    fixture.activity._refreshIntegrationService = { refresh: async () => { fixture.deactivate(); return { accessToken: 'late-secret' }; } };
    assert.equal(await fixture.activity[method](fixture.integration, 'test-cause'), false);
  }
});

test('stale activities cannot publish posts moved to draft or reassigned to another channel', async () => {
  for (const changes of [{ state: 'DRAFT' }, { state: 'ERROR' }, { integrationId: 'another-channel' }]) {
    const fixture = activityState();
    Object.assign(fixture.post, changes);
    await assert.rejects(fixture.activity.postSocialPending(fixture.integration, [fixture.post]), /available/i);
    assert.equal(fixture.calls(), 0);
  }
});

test('recurring active posts remain publishable after their previous published occurrence', async () => {
  const fixture = activityState();
  fixture.post.state = 'PUBLISHED';
  assert.deepEqual(await fixture.activity.postSocialPending(fixture.integration, [fixture.post]), fixture.output);
});

test('accepted publication survives ordinary readiness and post-state changes', async () => {
  for (const changes of [{ disabled: true }, { refreshNeeded: true }, { inBetweenSteps: true }]) {
    const fixture = activityState();
    fixture.provider.postPending = async () => { Object.assign(fixture.integration, changes); fixture.post.state = 'ERROR'; return fixture.output; };
    assert.deepEqual(await fixture.activity.postSocialPending(fixture.integration, [fixture.post]), fixture.output);
  }
});

test('accepted publication cannot follow a post reassigned to another connection', async () => {
  const fixture = activityState();
  fixture.provider.postPending = async () => { fixture.post.integrationId = 'another-channel'; return fixture.output; };
  await assert.rejects(fixture.activity.postSocialPending(fixture.integration, [fixture.post]), /available/i);
});

test('audit failure does not roll back a valid error state transition', async () => {
  const { repository, row, errors } = database({ auditFailure: true });
  const result = await repository.changeState('post', 'ERROR', 'Provider failure', { value: 'provider response' });
  assert.equal(result.state, 'ERROR');
  assert.equal(row.state, 'ERROR');
  assert.equal(row.error, 'Provider failure');
  assert.equal(errors.length, 0);
});

test('audit completion is fenced to the original connection when the post changes association', async () => {
  const { repository, errors } = database({ reassignAfterPostWrite: true });
  await repository.changeState('post', 'ERROR', 'Original provider failure', { value: 'original provider response' });
  assert.equal(errors.length, 0);
});

test('release methods reject a result from a different expected connection', async () => {
  for (const call of [
    (repository) => repository.updatePost('post', 'video', 'https://youtube.test/video', 'old-channel'),
    (repository) => repository.updateReleaseId('post', 'org', 'video', 'https://youtube.test/video', 'old-channel'),
    (repository) => repository.updateResolvedRelease('post', 'org', 'video', 'https://youtube.test/video', 'old-channel'),
  ]) {
    const { repository, row } = database();
    await assert.rejects(call(repository), /available/i);
    assert.equal(row.releaseURL, null);
  }
});

test('copying an existing post to another channel creates a new row and preserves its original association', async () => {
  const original = { id: 'existing-post', organizationId: 'org', integrationId: 'original-channel', content: 'Original text' };
  const repository = Object.create(PostsRepository.prototype);
  repository._post = { model: { post: {
    findFirst: async () => null,
    upsert: async ({ where, create, update }) => {
      const existing = where.id === original.id && (!where.organizationId || where.organizationId === original.organizationId) && (!where.integrationId || where.integrationId === original.integrationId);
      if (existing) { Object.assign(original, update, { integrationId: update.integration.connect.id }); return original; }
      return { ...create, id: 'new-post', integrationId: create.integration.connect.id };
    },
  } } };
  repository._tagsPosts = { model: { tagsPosts: { deleteMany: async () => ({ count: 0 }) } } };
  const output = await repository.createOrUpdatePost('schedule', 'org', '2026-12-01T12:00:00Z', { integration: { id: 'target-channel' }, value: [{ id: original.id, content: 'Copied text', image: [] }], settings: {} }, [], 'WEB');
  assert.equal(output.posts[0].id, 'new-post');
  assert.equal(output.posts[0].integrationId, 'target-channel');
  assert.equal(original.integrationId, 'original-channel');
  assert.equal(original.content, 'Original text');
});
