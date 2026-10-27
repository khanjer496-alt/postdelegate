/* Dependency-image tests: no application bootstrap, credentials, live provider
 * requests, Temporal server, account deletion or production datastore access. */
const assert = require('node:assert/strict');
const { test, afterEach } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const dependencyRequire = Module.createRequire('/app/package.json');
const ts = dependencyRequire('typescript');
dependencyRequire('reflect-metadata');
const root = path.resolve(__dirname, '../../../..');
const flag = 'INTEGRATION_AUTHORIZATION_LIFECYCLE_ENABLED';
const priorFlag = process.env[flag];
const priorCron = process.env.RUN_CRON;
afterEach(() => {
  if (priorFlag === undefined) delete process.env[flag]; else process.env[flag] = priorFlag;
  if (priorCron === undefined) delete process.env.RUN_CRON; else process.env.RUN_CRON = priorCron;
});
function loadSource(relative, infrastructure = {}) {
  const filename = path.join(root, relative);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths('/app');
  mod.require = (id) => infrastructure[id] || dependencyRequire(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
      experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}
const lifecyclePath = '@gitroom/nestjs-libraries/integrations/integration.authorization.lifecycle.service';
const activityPath = 'apps/orchestrator/src/activities/integration.authorization.maintenance.activity.ts';
const activityInfrastructure = { [lifecyclePath]: { IntegrationAuthorizationLifecycleService: class {} } };

// Fails until the new activity exists; subsequent assertions exercise only the
// real wrappers' safety boundaries, independent from provider implementations.
test('maintenance activities default OFF and never call a lifecycle operation', async () => {
  delete process.env[flag];
  const { IntegrationAuthorizationMaintenanceActivity } = loadSource(activityPath, activityInfrastructure);
  let touched = 0;
  const instance = new IntegrationAuthorizationMaintenanceActivity({
    processDeletion: async () => { touched++; throw new Error('must not run'); },
    checkAuthorizationsPage: async () => { touched++; throw new Error('must not run'); },
  });
  assert.deepEqual(await instance.processIntegrationDataDeletionV1('org-local', 'channel-local'), { completed: 0 });
  assert.deepEqual(await instance.checkIntegrationAuthorizationsPageV1(), { enabled: 0, checked: 0, pending: 0 });
  assert.equal(touched, 0);
  process.env[flag] = 'false';
  assert.deepEqual(await instance.checkIntegrationAuthorizationsPageV1(), { enabled: 0, checked: 0, pending: 0 });
  assert.equal(touched, 0);
});

test('activity results and failures cannot put credentials or provider payloads into workflow history', async () => {
  process.env[flag] = 'true';
  const { IntegrationAuthorizationMaintenanceActivity } = loadSource(activityPath, activityInfrastructure);
  const instance = new IntegrationAuthorizationMaintenanceActivity({
    processDeletion: async () => ({ status: 'complete', token: 'private-provider-fixture' }),
    checkAuthorizationsPage: async () => ({ cursor: 'channel-local', checked: 10, pending: 2, token: 'private-provider-fixture' }),
  });
  assert.deepEqual(await instance.processIntegrationDataDeletionV1('org-local', 'channel-local'), { completed: 1 });
  assert.deepEqual(await instance.checkIntegrationAuthorizationsPageV1(), { enabled: 1, cursor: 'channel-local', checked: 10, pending: 2 });
  instance._lifecycle.processDeletion = async () => { throw new Error('private-provider-fixture'); };
  await assert.rejects(instance.processIntegrationDataDeletionV1('org-local', 'channel-local'), (error) => {
    assert.equal(error.message, 'Integration data deletion is temporarily unavailable.');
    assert.equal(error.cause, undefined);
    return true;
  });
  instance._lifecycle.checkAuthorizationsPage = async () => ({ checked: 'private-provider-fixture', pending: 0 });
  await assert.rejects(instance.checkIntegrationAuthorizationsPageV1(), (error) => {
    assert.equal(error.message, 'Integration authorization maintenance is temporarily unavailable.');
    return true;
  });
});

function workflow(relative, activities, limits = {}) {
  const state = { sleeps: [], continuations: [], attempts: 0 };
  const boundary = {
    proxyActivities: () => activities,
    isCancellation: (error) => error?.cancelled === true,
    sleep: async (duration) => { state.sleeps.push(duration); if (limits.cancelSleep) throw Object.assign(new Error('cancelled'), { cancelled: true }); },
    continueAsNew: async (...args) => { state.continuations.push(args); throw Object.assign(new Error('continued'), { continued: true }); },
  };
  return { state, exports: loadSource(relative, { '@temporalio/workflow': boundary }) };
}

test('new deletion workflow retries unknown outcomes instead of claiming data was deleted', async () => {
  const calls = [];
  const { exports, state } = workflow('apps/orchestrator/src/workflows/integration.data.deletion.workflow.v1.ts', {
    processIntegrationDataDeletionV1: async (org, id) => {
      calls.push([org, id]);
      if (calls.length === 1) throw new Error('temporary activity error');
      return { completed: calls.length === 2 ? 0 : 1 };
    },
  });
  assert.deepEqual(await exports.integrationDataDeletionWorkflowV1({ organizationId: 'org-local', integrationId: 'channel-local' }), { completed: 1 });
  assert.deepEqual(calls, [['org-local', 'channel-local'], ['org-local', 'channel-local'], ['org-local', 'channel-local']]);
  assert.deepEqual(state.sleeps, ['15 minutes', '15 minutes']);
});

test('deletion workflow bounds retry history with the same local identifiers and respects cancellation', async () => {
  const args = { organizationId: 'org-local', integrationId: 'channel-local' };
  const { exports, state } = workflow('apps/orchestrator/src/workflows/integration.data.deletion.workflow.v1.ts', {
    processIntegrationDataDeletionV1: async () => ({ completed: 0 }),
  });
  await assert.rejects(exports.integrationDataDeletionWorkflowV1(args), (error) => error.continued === true);
  assert.deepEqual(state.continuations, [[args]]);
  assert.equal(state.sleeps.length, 96);
  const cancelled = workflow('apps/orchestrator/src/workflows/integration.data.deletion.workflow.v1.ts', {
    processIntegrationDataDeletionV1: async () => { throw Object.assign(new Error('stop'), { cancelled: true }); },
  });
  await assert.rejects(cancelled.exports.integrationDataDeletionWorkflowV1(args), (error) => error.cancelled === true);
  assert.deepEqual(cancelled.state.sleeps, []);
});

test('maintenance pages the full local-ID cursor before waiting a day and restarting with bounded history', async () => {
  const cursors = [];
  const { exports, state } = workflow('apps/orchestrator/src/workflows/integration.authorization.maintenance.workflow.v1.ts', {
    checkIntegrationAuthorizationsPageV1: async (cursor) => {
      cursors.push(cursor);
      return cursor ? { enabled: 1, checked: 5, pending: 0 } : { enabled: 1, cursor: 'channel-local', checked: 10, pending: 1 };
    },
  });
  await assert.rejects(exports.integrationAuthorizationMaintenanceWorkflowV1(), (error) => error.continued === true);
  assert.deepEqual(cursors, [undefined, 'channel-local']);
  assert.deepEqual(state.sleeps, ['24 hours']);
  assert.deepEqual(state.continuations, [[{}]]);
});

test('maintenance stops while disabled and retains its cursor after an activity failure', async () => {
  const disabled = workflow('apps/orchestrator/src/workflows/integration.authorization.maintenance.workflow.v1.ts', {
    checkIntegrationAuthorizationsPageV1: async () => ({ enabled: 0, checked: 0, pending: 0 }),
  });
  assert.deepEqual(await disabled.exports.integrationAuthorizationMaintenanceWorkflowV1(), { checked: 0, pending: 0 });
  assert.deepEqual(disabled.state.sleeps, []);
  const failed = workflow('apps/orchestrator/src/workflows/integration.authorization.maintenance.workflow.v1.ts', {
    checkIntegrationAuthorizationsPageV1: async () => { throw new Error('temporary'); },
  });
  await assert.rejects(failed.exports.integrationAuthorizationMaintenanceWorkflowV1({ cursor: 'channel-local' }), (error) => error.continued === true);
  assert.deepEqual(failed.state.continuations, [[{ cursor: 'channel-local' }]]);
  assert.deepEqual(failed.state.sleeps, ['15 minutes']);
});

const userInfrastructure = Object.fromEntries([
  '@gitroom/nestjs-libraries/database/prisma/users/users.repository',
  '@gitroom/nestjs-libraries/database/prisma/organizations/organization.repository',
  '@gitroom/nestjs-libraries/database/prisma/integrations/integration.repository',
  '@gitroom/nestjs-libraries/database/prisma/notifications/notification.service',
  lifecyclePath,
].map((id) => [id, new Proxy({}, { get: () => class {} })]));
function accountService({ owned = true, remainingOwner = false, failRequest = false } = {}) {
  const events = [];
  const org = { id: 'org-local', users: [{ role: owned ? 'SUPERADMIN' : 'USER' }] };
  const organizations = {
    getOrgsByUserId: async () => [org],
    getTeam: async () => ({ users: remainingOwner ? [{ user: { id: 'other-local' }, role: 'SUPERADMIN' }] : [] }),
    deleteTeamMember: async (id, user) => { events.push(['membership', id, user]); },
    deleteOrganization: async (id) => { events.push(['organization', id]); },
  };
  const integrations = { deleteIntegrationsForAccount: async (id, skip) => { events.push(['hash', id, skip]); } };
  const lifecycle = { requestOrganizationDeletion: async (id) => {
    if (failRequest) throw new Error('request unavailable');
    events.push(['request', id]); return ['channel-local'];
  } };
  const { UsersService } = loadSource('libraries/nestjs-libraries/src/database/prisma/users/users.service.ts', userInfrastructure);
  const instance = new UsersService({ deleteAccount: async (id) => { events.push(['user', id]); } }, organizations, integrations, {}, lifecycle);
  return { instance, events };
}

test('account deletion preserves lifecycle-owned credentials until durable cleanup is requested', async () => {
  const { instance, events } = accountService();
  await instance.deleteAccount('user-local');
  assert.deepEqual(events, [
    ['request', 'org-local'], ['hash', 'org-local', ['channel-local']],
    ['organization', 'org-local'], ['user', 'user-local'],
  ]);
});

test('shared organizations keep their channels when another owner remains or the departing member is not owner', async () => {
  for (const options of [{ owned: false }, { remainingOwner: true }]) {
    const { instance, events } = accountService(options);
    await instance.deleteAccount('user-local');
    assert.deepEqual(events, [['membership', 'org-local', 'user-local'], ['user', 'user-local']]);
  }
});

test('failed lifecycle deletion requests stop before legacy hashing or removing any account data', async () => {
  const { instance, events } = accountService({ failRequest: true });
  await assert.rejects(instance.deleteAccount('user-local'), /request unavailable/);
  assert.deepEqual(events, []);
});

test('bootstrap starts the new maintenance singleton only behind the exact enabled flag', async () => {
  const { InfiniteWorkflowRegister } = loadSource('libraries/nestjs-libraries/src/temporal/infinite.workflow.register.ts');
  const starts = [];
  const instance = new InfiniteWorkflowRegister({ client: { getRawClient: () => ({ workflow: { start: async (name, options) => starts.push([name, options]) } }) } });
  delete process.env.RUN_CRON;
  delete process.env[flag];
  await instance.onModuleInit();
  assert.deepEqual(starts, []);
  process.env[flag] = 'false';
  await instance.onModuleInit();
  assert.deepEqual(starts, []);
  process.env[flag] = 'true';
  await instance.onModuleInit();
  assert.deepEqual(starts, [['integrationAuthorizationMaintenanceWorkflowV1', { workflowId: 'integration-authorization-maintenance-v1', taskQueue: 'main' }]]);
});
