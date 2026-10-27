/* Run in the pinned dependency image with the checkout mounted at /review.
 * Actual lifecycle, repository and refresh service source; isolated database,
 * provider, storage, Redis and Temporal boundaries. Never uses live credentials.
 */
const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const dependencyRequire = Module.createRequire('/app/package.json');
const ts = dependencyRequire('typescript');
const root = path.resolve(__dirname, '../../../..');
const sourceRoot = path.join(root, 'libraries/nestjs-libraries/src');
const removedObjects = [];
const redis = { async scan() { return ['0', []]; }, async del() {}, async get() { return null; }, async set() {} };
const infrastructure = {
  '@gitroom/nestjs-libraries/services/make.is': { makeId: () => 'test-generation' },
  '@gitroom/nestjs-libraries/upload/upload.factory': { UploadFactory: { createStorage: () => ({ removeFile: async (key) => { removedObjects.push(key); } }) } },
  '@gitroom/nestjs-libraries/redis/redis.service': { ioRedis: redis },
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
    if (id === '@gitroom/nestjs-libraries/database/prisma/integrations/integration.repository') return loadSource('database/prisma/integrations/integration.repository');
    if (id.startsWith('@gitroom/')) return new Proxy({}, { get: (_target, key) => key === '__esModule' ? true : class {} });
    return dependencyRequire(id);
  };
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true },
  }).outputText;
  mod._compile(output, filename);
  return mod.exports;
}
const lifecyclePath = 'integrations/integration.authorization.lifecycle.service';
const Lifecycle = fs.existsSync(path.join(sourceRoot, lifecyclePath + '.ts'))
  ? loadSource(lifecyclePath).IntegrationAuthorizationLifecycleService : undefined;
const { IntegrationRepository } = loadSource('database/prisma/integrations/integration.repository');
const { RefreshIntegrationService } = loadSource('integrations/refresh.integration.service');
const { IntegrationService } = loadSource('database/prisma/integrations/integration.service');
const row = (overrides = {}) => ({
  id: 'channel-1', organizationId: 'org-1', providerIdentifier: 'review-provider',
  token: 'private-access', refreshToken: 'private-refresh', internalId: 'remote-channel',
  rootInternalId: 'remote-principal', name: 'Remote channel', profile: 'remote-profile',
  picture: null, disabled: false, inBetweenSteps: false, deletedAt: null,
  refreshNeeded: !!overrides.deletedAt, updatedAt: new Date(),
  ...overrides,
});
const originalFlag = process.env.INTEGRATION_AUTHORIZATION_LIFECYCLE_ENABLED;
const originalBucket = process.env.CLOUDFLARE_BUCKET_URL;
const originalHistory = process.env.INTEGRATION_AUTHORIZATION_HISTORY_RETENTION_HOURS;
beforeEach(() => {
  process.env.INTEGRATION_AUTHORIZATION_LIFECYCLE_ENABLED = 'true';
  process.env.CLOUDFLARE_BUCKET_URL = 'https://media.example.test';
  process.env.INTEGRATION_AUTHORIZATION_HISTORY_RETENTION_HOURS = '24';
  removedObjects.length = 0;
});
afterEach(() => {
  if (originalFlag === undefined) delete process.env.INTEGRATION_AUTHORIZATION_LIFECYCLE_ENABLED;
  else process.env.INTEGRATION_AUTHORIZATION_LIFECYCLE_ENABLED = originalFlag;
  if (originalBucket === undefined) delete process.env.CLOUDFLARE_BUCKET_URL;
  else process.env.CLOUDFLARE_BUCKET_URL = originalBucket;
  if (originalHistory === undefined) delete process.env.INTEGRATION_AUTHORIZATION_HISTORY_RETENTION_HOURS;
  else process.env.INTEGRATION_AUTHORIZATION_HISTORY_RETENTION_HOURS = originalHistory;
});
function fixture(initial = row()) {
  const state = { current: initial, events: [], starts: [], scrubbed: false, closed: new Set(), check: { status: 'unknown' }, revoke: { status: 'revoked' } };
  const provider = {
    authorizationPolicy: { deletionNotice: 'Provider grant is removed.', authorizationRealm: 'review-project', useRemoteAvatar: true },
    checkAuthorization: async () => state.check,
    revokeAuthorization: async () => { state.events.push('revoke'); return state.revoke; },
    getAuthorizationGrant: async () => undefined,
  };
  const repository = {
    getIntegrationForCleanup: async () => state.current,
    getAuthorizationIntegrationsForOrganization: async () => [state.current],
    getAuthorizationIntegrationsPage: async () => [state.current],
    findAuthorizationGrantCandidates: async () => [],
    markAuthorizationDeletionRequested: async () => {
      state.events.push('tombstone');
      state.current = { ...state.current, disabled: true, deletedAt: new Date('2026-10-27T00:00:00Z') };
      return { matched: true };
    },
    getAuthorizationPostIds: async () => ['post-1'],
    hasAvatarReferences: async () => false,
    scrubAuthorizationData: async () => { state.events.push('scrub'); state.scrubbed = true; state.current = { ...state.current, token: '', refreshToken: null, internalId: `erased_${state.current.id}`, updatedAt: new Date() }; },
    updateAuthorizationIfActive: async () => { state.events.push('refresh'); return { count: 1 }; },
    touchAuthorizationHistoryWait: async () => { state.events.push('history-reset'); state.current.updatedAt = new Date(); },
    purgeAuthorizationNotifications: async () => ({ deleted: 0, unattributed: 0 }),
  };
  const manager = { getSocialIntegration: () => provider };
  const temporal = { client: { getRawClient: () => ({ workflow: {
    start: async (...args) => { state.events.push('start'); state.starts.push(args); },
    list: async function* () {},
    getHandle: (id) => ({ describe: async () => {
      if (id.startsWith('digest_email_')) { const error = new Error('Not found'); error.name = 'WorkflowNotFoundError'; throw error; }
      return { status: { name: state.closed.has(id) ? 'TERMINATED' : 'RUNNING' } };
    }, terminate: async () => { state.events.push('terminate'); state.closed.add(id); } }),
  } }) } };
  const instance = Lifecycle ? new Lifecycle(repository, manager, temporal) : undefined;
  return { instance, state, provider, repository };
}

test('managed deletion fails closed while rollout is disabled', async () => {
  assert.equal(typeof Lifecycle, 'function');
  process.env.INTEGRATION_AUTHORIZATION_LIFECYCLE_ENABLED = 'false';
  const { instance, state } = fixture();
  await assert.rejects(instance.requestDeletion('org-1', 'channel-1'));
  await assert.rejects(instance.requestOrganizationDeletion('org-1'));
  assert.deepEqual(state.events, []);
});

test('deletion blocks the connection before enqueueing an identifier-only durable job', async () => {
  const { instance, state } = fixture();
  assert.deepEqual(await instance.requestDeletion('org-1', 'channel-1'), { id: 'channel-1' });
  assert.deepEqual(state.events.slice(0, 2), ['tombstone', 'start']);
  assert.equal(state.current.disabled, true);
  assert.ok(state.current.deletedAt);
  assert.deepEqual(state.starts[0][1].args, [{ organizationId: 'org-1', integrationId: 'channel-1' }]);
  assert.equal(JSON.stringify(state.starts).includes('private-'), false);
});

test('a transient revocation failure retains retry credentials and does not erase API data', async () => {
  const { instance, state } = fixture(row({ deletedAt: new Date(), disabled: true }));
  state.revoke = { status: 'unknown' };
  assert.deepEqual(await instance.processDeletion('org-1', 'channel-1'), { status: 'pending' });
  assert.equal(state.scrubbed, false);
  assert.equal(state.current.refreshToken, 'private-refresh');
});

test('confirmed revocation terminates posting work and clears API data without touching uploaded content', async () => {
  const { instance, state } = fixture(row({ deletedAt: new Date(), disabled: true }));
  assert.deepEqual(await instance.processDeletion('org-1', 'channel-1'), { status: 'pending' });
  assert.equal(state.scrubbed, true);
  assert.ok(state.events.indexOf('revoke') < state.events.indexOf('scrub'));
  assert.equal(state.events.filter((event) => event === 'terminate').length, 2);
  assert.deepEqual(removedObjects, []);
  state.current.updatedAt = new Date(Date.now() - 26 * 60 * 60 * 1000);
  assert.deepEqual(await instance.processDeletion('org-1', 'channel-1'), { status: 'complete' });
});

test('cleanup cannot erase a newly reconnected active generation', async () => {
  const { instance, state } = fixture(row());
  assert.deepEqual(await instance.processDeletion('org-1', 'channel-1'), { status: 'complete' });
  assert.deepEqual(state.events, []);
});

test('owned unreferenced avatars are removed, while external and shared media are preserved', async () => {
  for (const [picture, shared, expected] of [
    ['https://media.example.test/avatar123.jpg', false, 1],
    ['https://other.example/avatar123.jpg', false, 0],
    ['https://media.example.test/avatar123.jpg', true, 0],
  ]) {
    removedObjects.length = 0;
    const { instance, repository } = fixture(row({ deletedAt: new Date(), disabled: true, picture }));
    repository.hasAvatarReferences = async () => shared;
    await instance.processDeletion('org-1', 'channel-1');
    assert.equal(removedObjects.length, expected);
  }
});

test('maintenance never erases on unknown authorization and queues confirmed external revocation', async () => {
  const first = fixture();
  await first.instance.checkAuthorizationsPage();
  assert.deepEqual(first.state.events, []);
  const second = fixture();
  second.state.check = { status: 'revoked' };
  await second.instance.checkAuthorizationsPage();
  assert.deepEqual(second.state.events.slice(0, 2), ['tombstone', 'start']);
});

test('maintenance saves refreshed authorization only through an active-row conditional update', async () => {
  const { instance, state } = fixture();
  state.check = { status: 'valid', credentials: { accessToken: 'rotated-private' }, identity: { name: 'Current channel' } };
  await instance.checkAuthorizationsPage();
  assert.deepEqual(state.events, ['refresh']);
});

test('repository deletion scrubs API-derived fields transactionally and preserves authored post fields', async () => {
  const writes = [];
  const tx = Object.fromEntries(['integration', 'post', 'errors', 'exisingPlugData', 'plugs'].map((model) => [model, {
    updateMany: async (args) => { writes.push({ model, action: 'updateMany', ...args }); return { count: 1 }; },
    deleteMany: async (args) => { writes.push({ model, action: 'deleteMany', ...args }); return { count: 1 }; },
  }]));
  tx.integration.findFirst = async () => row({ deletedAt: new Date(), disabled: true });
  const repository = Object.create(IntegrationRepository.prototype);
  repository._transaction = { model: { $transaction: async (callback) => callback(tx) } };
  assert.equal(typeof repository.scrubAuthorizationData, 'function');
  await repository.scrubAuthorizationData('org-1', 'channel-1');
  const identity = writes.find((write) => write.model === 'integration').data;
  assert.equal(identity.token, '');
  assert.equal(identity.refreshToken, null);
  assert.equal(identity.rootInternalId, null);
  const postWrite = writes.find((write) => write.model === 'post').data;
  assert.equal(postWrite.releaseId, null);
  assert.equal(postWrite.releaseURL, null);
  for (const key of ['content', 'image', 'settings', 'title', 'description']) assert.equal(Object.hasOwn(postWrite, key), false);
});

test('refresh cannot persist credentials after deletion while provider refresh was in flight', async () => {
  let active = row();
  let upserts = 0;
  const integrationService = {
    getActiveIntegrationById: async () => active,
    persistRefreshedAuthorization: async () => ({ count: active ? 1 : 0 }),
    createOrUpdateIntegration: async () => { upserts++; },
  };
  const manager = { getSocialIntegration: () => ({ refreshToken: async () => { active = null; return { accessToken: 'rotated-private', refreshToken: 'refresh-private', expiresIn: 3600 }; } }) };
  const instance = new RefreshIntegrationService(manager, integrationService, {});
  assert.equal(await instance.refresh(row()), false);
  assert.equal(upserts, 0);
});

test('soft-deleted intermediate OAuth rows are not mistaken for explicit deletion requests', async () => {
  const { instance, state } = fixture(row({ deletedAt: new Date(), disabled: false, refreshNeeded: false }));
  await instance.checkAuthorizationsPage();
  assert.deepEqual(await instance.processDeletion('org-1', 'channel-1'), { status: 'pending' });
  assert.deepEqual(state.events, []);
});

test('cleanup completion waits for explicitly verified history retention', async () => {
  const { instance, state } = fixture(row({ deletedAt: new Date(), disabled: true, token: '', refreshToken: null, internalId: 'erased_channel-1', updatedAt: new Date(Date.now() - 26 * 3600000) }));
  state.closed.add('post_post-1'); state.closed.add('refresh_channel-1');
  delete process.env.INTEGRATION_AUTHORIZATION_HISTORY_RETENTION_HOURS;
  assert.deepEqual(await instance.processDeletion('org-1', 'channel-1'), { status: 'pending' });
  process.env.INTEGRATION_AUTHORIZATION_HISTORY_RETENTION_HOURS = '24';
  assert.deepEqual(await instance.processDeletion('org-1', 'channel-1'), { status: 'complete' });
});

test('ordinary integration lookups exclude deleted rows while operation lookups reject disabled channels', async () => {
  let query;
  const repository = Object.create(IntegrationRepository.prototype);
  repository._integration = { model: { integration: { findFirst: async (value) => { query = value; return null; } } } };
  await repository.getIntegrationById('org-1', 'channel-1');
  assert.equal(query.where.deletedAt, null);
  const service = Object.create(IntegrationService.prototype);
  service._integrationRepository = { getIntegrationById: async () => row({ disabled: true }) };
  assert.equal(await service.getActiveIntegrationById('org-1', 'channel-1'), null);
});

test('managed remote avatars and already-owned images never create another storage copy', async () => {
  for (const [policy, picture] of [
    [{ authorizationRealm: 'review-project', useRemoteAvatar: true }, 'https://provider.example.test/avatar.jpg'],
    [undefined, 'https://media.example.test/avatar123.jpg'],
  ]) {
    let copied = 0;
    const service = Object.create(IntegrationService.prototype);
    service.storage = { uploadSimple: async () => { copied++; return 'https://media.example.test/new.jpg'; } };
    service._integrationManager = { getSocialIntegration: () => ({ authorizationPolicy: policy }) };
    service._integrationRepository = { createOrUpdateIntegration: async () => ({ id: 'new-connection' }) };
    await service.createOrUpdateIntegration(undefined, false, 'org-1', 'Name', picture, 'social', 'remote', 'review-provider', 'private-access');
    assert.equal(copied, 0);
  }
});

test('reconnecting a deleted managed channel retires the old generation before creating the new one', async () => {
  const events = [];
  const repository = Object.create(IntegrationRepository.prototype);
  repository._integration = { model: { integration: {
    findFirst: async () => null,
    findUnique: async () => ({ id: 'old-generation', deletedAt: new Date() }),
    update: async () => { events.push('retire'); return { id: 'old-generation' }; },
    upsert: async () => { events.push('new-generation'); return { id: 'new-generation' }; },
    create: async () => { events.push('new-generation'); return { id: 'new-generation' }; },
    updateMany: async () => ({ count: 1 }),
  } } };
  repository._transaction = { model: { $transaction: async (callback) => callback(repository._integration.model) } };
  const result = await repository.createOrUpdateIntegration(undefined, false, 'org-1', 'Name', undefined, 'social', 'remote-channel', 'review-provider', 'private-access', '', 3600, undefined, false, undefined, undefined, undefined, true);
  assert.equal(result.id, 'new-generation');
  assert.deepEqual(events, ['retire', 'new-generation']);
});

test('reconnect is blocked while a matching grant is still awaiting remote revocation', async () => {
  let created = false;
  const repository = Object.create(IntegrationRepository.prototype);
  repository._integration = { model: { integration: {
    findFirst: async () => ({ id: 'pending-disconnect' }),
    findUnique: async () => null,
    upsert: async () => { created = true; return { id: 'new-generation' }; },
    create: async () => { created = true; return { id: 'new-generation' }; },
    updateMany: async () => ({ count: 1 }),
  } } };
  repository._transaction = { model: { $transaction: async (callback) => callback(repository._integration.model) } };
  await assert.rejects(repository.createOrUpdateIntegration(undefined, false, 'org-1', 'Name', undefined, 'social', 'remote-principal', 'review-provider', 'private-access', '', 3600, undefined, false, undefined, undefined, undefined, true), /disconnect|removal|revocation/i);
  assert.equal(created, false);
});

test('single-use token refresh keeps matching active siblings in sync without reviving deleted rows', async () => {
  const writes = [];
  const tx = { integration: {
    findFirst: async () => ({ rootInternalId: 'shared-principal' }),
    updateMany: async (value) => { writes.push(value); return { count: 1 }; },
  } };
  const repository = Object.create(IntegrationRepository.prototype);
  repository._transaction = { model: { $transaction: async (callback) => callback(tx) } };
  await repository.updateAuthorizationIfActive('org-1', 'channel-1', { accessToken: 'new-private', refreshToken: 'new-refresh' }, undefined, 'old-private', true);
  assert.equal(writes.length, 2);
  assert.equal(writes[1].where.token, 'old-private');
  assert.equal(writes[1].where.deletedAt, null);
  assert.equal(writes[1].data.refreshToken, 'new-refresh');
});

test('closed workflows count as stopped, while transient workflow lookup failures prevent cleanup', async () => {
  for (const [name, expected] of [['COMPLETED', true], ['NOT_FOUND', true], ['TRANSIENT', false]]) {
    const { instance, state } = fixture(row({ deletedAt: new Date(), disabled: true }));
    instance._temporalService = { client: { getRawClient: () => ({ workflow: { list: async function* () {}, getHandle: () => ({
      describe: async () => {
        if (name === 'NOT_FOUND') { const error = new Error('Not found'); error.name = 'WorkflowNotFoundError'; throw error; }
        if (name === 'TRANSIENT') throw new Error('Temporary unavailable');
        return { status: { name } };
      },
      terminate: async () => { throw new Error('Closed workflow must not be terminated'); },
    }) } }) } };
    await instance.processDeletion('org-1', 'channel-1');
    assert.equal(state.scrubbed, expected);
  }
});

test('repeating deletion on a tombstone preserves the history-expiry timestamp', async () => {
  let writes = 0;
  const repository = Object.create(IntegrationRepository.prototype);
  repository._integration = { model: { integration: {
    findFirst: async () => ({ deletedAt: new Date(), disabled: true, refreshNeeded: true }),
    updateMany: async () => { writes++; },
  } } };
  repository._transaction = { model: { $transaction: async (callback) => callback(repository._integration.model) } };
  await repository.markAuthorizationDeletionRequested('org-1', 'channel-1');
  assert.equal(writes, 0);
});

test('missing credentials alone are not proof that provider identity and API references were scrubbed', async () => {
  const { instance } = fixture(row({ deletedAt: new Date(), disabled: true, token: '', refreshToken: null, updatedAt: new Date(Date.now() - 26 * 3600000) }));
  assert.deepEqual(await instance.processDeletion('org-1', 'channel-1'), { status: 'pending' });
});

test('managed analytics bypass cache and discard a report completed after deletion', async () => {
  const service = Object.create(IntegrationService.prototype);
  let current = row({ type: 'social', tokenExpiration: new Date(Date.now() + 3600000) });
  service._integrationRepository = { getIntegrationById: async () => current };
  service._integrationManager = { getSocialIntegration: () => ({ authorizationPolicy: { bypassAnalyticsCache: true }, analytics: async () => {
    current = null; return [{ label: 'Views', data: [{ date: 'today', total: 1 }] }];
  } }) };
  let cached = 0;
  redis.set = async () => { cached++; };
  assert.deepEqual(await service.checkAnalytics({ id: 'org-1' }, 'channel-1', '7'), []);
  assert.equal(cached, 0);
});

test('recurring children are closed and late discovery resets the history expiry clock', async () => {
  const { instance, state } = fixture(row({ deletedAt: new Date(), disabled: true, token: '', refreshToken: null, internalId: 'erased_channel-1', updatedAt: new Date(Date.now() - 26 * 3600000) }));
  state.closed.add('post_post-1'); state.closed.add('refresh_channel-1');
  instance._temporalService.client.getRawClient = () => ({ workflow: {
    list: async function* () { yield { workflowId: 'post_post-1_abandoned-child', runId: 'child-run' }; },
    getHandle: (id) => ({
      describe: async () => ({ status: { name: state.closed.has(id) ? 'TERMINATED' : 'RUNNING' } }),
      terminate: async () => { state.closed.add(id); },
    }),
  } });
  assert.deepEqual(await instance.processDeletion('org-1', 'channel-1'), { status: 'pending' });
  assert.ok(state.closed.has('post_post-1_abandoned-child'));
  assert.ok(state.events.includes('history-reset'));
});

test('visibility failure cannot claim cleanup or history expiry is complete', async () => {
  const { instance, state } = fixture(row({ deletedAt: new Date(), disabled: true }));
  instance._temporalService.client.getRawClient = () => ({ workflow: {
    list: async function* () { throw new Error('Unavailable'); },
    getHandle: () => ({ describe: async () => ({ status: { name: 'RUNNING' } }), terminate: async () => {} }),
  } });
  assert.deepEqual(await instance.processDeletion('org-1', 'channel-1'), { status: 'pending' });
  assert.equal(state.scrubbed, false);
});

test('a stale revoked decision cannot remove a freshly reconnected credential generation', async () => {
  const { instance, state, provider, repository } = fixture();
  provider.checkAuthorization = async () => { state.current = { ...state.current, token: 'new-private' }; return { status: 'revoked' }; };
  repository.markAuthorizationDeletionRequested = async (_org, _id, expectedToken) => ({ matched: expectedToken === state.current.token });
  await instance.checkAuthorizationsPage();
  assert.equal(state.starts.length, 0);
  assert.equal(state.current.deletedAt, null);
});

test('unattributable notifications preserve their API-reference context and remain pending', async () => {
  const { instance, state, repository } = fixture(row({ deletedAt: new Date(), disabled: true }));
  repository.purgeAuthorizationNotifications = async () => ({ deleted: 0, unattributed: 1 });
  assert.deepEqual(await instance.processDeletion('org-1', 'channel-1'), { status: 'pending' });
  assert.equal(state.scrubbed, false);
  assert.equal(state.current.internalId, 'remote-channel');
});

test('an unresolved shared digest still blocks completion after application credentials are scrubbed', async () => {
  const { instance, state } = fixture(row({ deletedAt: new Date(), disabled: true, token: '', refreshToken: null, internalId: 'erased_channel-1', updatedAt: new Date(Date.now() - 26 * 3600000) }));
  state.closed.add('post_post-1'); state.closed.add('refresh_channel-1');
  instance._temporalService.client.getRawClient = () => ({ workflow: {
    list: async function* () {},
    getHandle: (id) => ({
      describe: async () => ({ status: { name: id.startsWith('digest_email_') ? 'RUNNING' : 'COMPLETED' } }),
      terminate: async () => { throw new Error('Shared digest must not be terminated'); },
    }),
  } });
  assert.deepEqual(await instance.processDeletion('org-1', 'channel-1'), { status: 'pending' });
});

test('late refresh failures do not flag or notify a removed credential generation', async () => {
  let writes = 0;
  const instance = new RefreshIntegrationService({}, {
    getActiveIntegrationById: async () => null,
    setBetweenRefreshSteps: async () => { writes++; return { count: 1 }; },
    informAboutRefreshError: async () => { writes++; },
  }, {});
  await instance.setBetweenSteps(row(), 'Late failure');
  assert.equal(writes, 0);
});
