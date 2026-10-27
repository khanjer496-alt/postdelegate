// Real notification service/repository, synthetic Prisma rows and Temporal
// activity context. No application bootstrap, network, emails or live data.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const dependencyRequire = Module.createRequire('/app/package.json');
const ts = dependencyRequire('typescript');
dependencyRequire('reflect-metadata');
const root = path.resolve(__dirname, '../../../..');
let workflowId;
const stubClass = class {};
const infrastructure = {
  '@temporalio/activity': { Context: { current: () => {
    if (!workflowId) throw new Error('Not in an activity');
    return { info: { workflowExecution: { workflowId } } };
  } } },
  '@gitroom/nestjs-libraries/database/prisma/prisma.service': { PrismaRepository: stubClass, PrismaTransaction: stubClass },
  '@gitroom/nestjs-libraries/services/email.service': { EmailService: stubClass },
  '@gitroom/nestjs-libraries/database/prisma/organizations/organization.repository': { OrganizationRepository: stubClass },
  '@gitroom/nestjs-libraries/integrations/integration.manager': { IntegrationManager: stubClass },
  '@gitroom/nestjs-libraries/temporal/temporal.search.attribute': { organizationId: { name: 'organizationId' } },
  '@temporalio/common': { TypedSearchAttributes: stubClass },
};
const cache = new Map();
function loadSource(relative) {
  const filename = path.join(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module); cache.set(filename, mod);
  mod.filename = filename; mod.paths = Module._nodeModulePaths('/app');
  mod.require = (id) => {
    if (infrastructure[id]) return infrastructure[id];
    if (id.startsWith('@gitroom/nestjs-libraries/')) return loadSource('libraries/nestjs-libraries/src/' + id.slice('@gitroom/nestjs-libraries/'.length) + '.ts');
    return dependencyRequire(id);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}
const { NotificationsRepository } = loadSource('libraries/nestjs-libraries/src/database/prisma/notifications/notifications.repository.ts');
const { NotificationService } = loadSource('libraries/nestjs-libraries/src/database/prisma/notifications/notification.service.ts');
function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some((clause) => matches(row, clause));
    if (key === 'AND') return value.every((clause) => matches(row, clause));
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('in' in value) return value.in.includes(row[key]);
      if ('notIn' in value) return !value.notIn.includes(row[key]);
      if ('not' in value) return row[key] !== value.not;
      if ('startsWith' in value) return typeof row[key] === 'string' && row[key].startsWith(value.startsWith);
      return matches(row[key] || {}, value);
    }
    return row[key] === value;
  });
}
function setup() {
  const integrations = [
    { id: 'channel-1', organizationId: 'org-1', providerIdentifier: 'youtube', name: 'Channel One', deletedAt: null },
    { id: 'channel-2', organizationId: 'org-1', providerIdentifier: 'youtube', name: 'Channel Two', deletedAt: null },
    { id: 'channel-3', organizationId: 'org-1', providerIdentifier: 'other', name: 'Other channel', deletedAt: null },
  ];
  const posts = [
    { id: 'post-1', integrationId: 'channel-1', organizationId: 'org-1', deletedAt: null, releaseURL: 'https://www.youtube.com/watch?v=fixture-one' },
    { id: 'post-2', integrationId: 'channel-2', organizationId: 'org-1', deletedAt: null, releaseURL: 'https://www.youtube.com/watch?v=fixture-two' },
    { id: 'post-3', integrationId: 'channel-3', organizationId: 'org-1', deletedAt: null, releaseURL: 'https://other.example/post' },
  ];
  const notifications = [];
  const events = [];
  let beforeIntegrationLock;
  const withIntegration = (row) => row && ({ ...row, integration: integrations.find((integration) => integration.id === row.integrationId) });
  const tx = {
    integration: {
      findFirst: async ({ where }) => integrations.find((row) => matches(row, where)),
      updateMany: async ({ where, data }) => {
        if (beforeIntegrationLock) { beforeIntegrationLock(); beforeIntegrationLock = undefined; }
        const rows = integrations.filter((row) => matches(row, where));
        rows.forEach((row) => Object.assign(row, data));
        events.push('integration-lock'); return { count: rows.length };
      },
    },
    post: {
      findFirst: async ({ where }) => withIntegration(posts.find((row) => matches(withIntegration(row), where))),
      findMany: async ({ where, take }) => posts.filter((row) => matches(withIntegration(row), where)).slice(0, take).map(withIntegration),
      updateMany: async ({ where, data }) => {
        const rows = posts.filter((row) => matches(row, where));
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      },
    },
    notifications: {
      create: async ({ data }) => { notifications.push({ id: `notice-${notifications.length}`, link: null, deletedAt: null, ...data }); events.push('notification-create'); },
      findMany: async ({ where, take }) => notifications.filter((row) => matches(row, where)).slice(0, take),
      deleteMany: async ({ where }) => {
        const removed = notifications.filter((row) => matches(row, where));
        for (const row of removed) notifications.splice(notifications.indexOf(row), 1);
        return { count: removed.length };
      },
    },
  };
  const transaction = { model: { $transaction: async (callback) => callback(tx) } };
  const repository = new NotificationsRepository({ model: { notifications: tx.notifications } }, {}, { model: { post: tx.post } }, transaction);
  const deliveries = [];
  const service = new NotificationService(repository,
    { sendEmail: async (...args) => deliveries.push({ kind: 'email', args }) },
    { getAllUsersOrgs: async () => ({ users: [{ user: { email: 'fixture@example.test', sendSuccessEmails: true, sendFailureEmails: true } }] }) },
    { client: { getRawClient: () => ({ workflow: { signalWithStart: async (_name, args) => deliveries.push({ kind: 'digest', args }) } }) } },
    { getSocialIntegration: (identifier) => ({ authorizationPolicy: identifier === 'youtube' ? {} : undefined }) });
  return { repository, service, notifications, deliveries, integrations, posts, events, race: (callback) => { beforeIntegrationLock = callback; } };
}

test('managed post notifications store and queue only product status, never provider API data', async () => {
  workflowId = 'post_post-1'; const fixture = setup();
  await fixture.service.inAppNotification('org-1', 'Channel One provider result', 'Your post has been published on Youtube at https://www.youtube.com/watch?v=fixture-one', true, true);
  assert.equal(fixture.notifications.length, 1);
  const notification = fixture.notifications[0];
  assert.match(notification.content, /calendar/i);
  assert.equal(notification.content.includes('fixture-one'), false);
  assert.equal(notification.content.includes('Channel One'), false);
  assert.equal(notification.link, '/launches?postId=post-1&notification=publishing');
  assert.equal(fixture.deliveries.length, 1);
  assert.equal(JSON.stringify(fixture.deliveries).includes('fixture-one'), false);
  assert.equal(JSON.stringify(fixture.deliveries).includes('Channel One'), false);
});

test('a deletion winning the notification-write race prevents both storage and delivery', async () => {
  workflowId = 'post_post-1_repeat'; const fixture = setup();
  fixture.race(() => { fixture.integrations[0].deletedAt = new Date(); });
  await fixture.service.inAppNotification('org-1', 'Private result', 'Channel One and fixture-one', true, true);
  assert.equal(fixture.notifications.length, 0);
  assert.equal(fixture.deliveries.length, 0);
});

test('unknown or wrong-organization posting context never falls back to storing unscoped API text', async () => {
  for (const [id, org] of [['post_unknown', 'org-1'], ['post_post-1', 'org-other']]) {
    workflowId = id; const fixture = setup();
    await fixture.service.inAppNotification(org, 'Private result', 'fixture-one', true);
    assert.equal(fixture.notifications.length, 0);
    assert.equal(fixture.deliveries.length, 0);
  }
});

test('explicit integration notices use the same deletion fence without changing any activity signature', async () => {
  workflowId = undefined; const fixture = setup();
  await fixture.service.inAppNotification('org-1', 'Private error', 'Channel One: provider payload', true, false, 'info', { integrationId: 'channel-1' });
  assert.equal(fixture.notifications[0].link, '/launches?integrationId=channel-1&notification=connection');
  assert.equal(fixture.notifications[0].content.includes('Channel One'), false);
  fixture.integrations[0].deletedAt = new Date();
  await fixture.service.inAppNotification('org-1', 'Private error', 'provider payload', true, false, 'info', { integrationId: 'channel-1' });
  assert.equal(fixture.notifications.length, 1);
  assert.equal(fixture.deliveries.length, 1);
});

test('unrelated non-post notifications and ordinary providers retain their original message', async () => {
  const fixture = setup(); workflowId = undefined;
  await fixture.service.inAppNotification('org-1', 'Meeting', 'A user-authored unrelated message');
  workflowId = 'post_post-3';
  await fixture.service.inAppNotification('org-1', 'Other provider', 'Other provider result');
  assert.deepEqual(fixture.notifications.map((row) => row.content), ['A user-authored unrelated message', 'Other provider result']);
});

test('historical purge removes only affected tagged or exact-success notices and reports ambiguous text', async () => {
  const fixture = setup(); workflowId = undefined;
  fixture.integrations[0].deletedAt = new Date();
  const notice = (id, content, link = null, organizationId = 'org-1') => ({ id, content, link, organizationId, deletedAt: null });
  fixture.notifications.push(
    notice('exact-target', 'Your post has been published on Youtube at https://www.youtube.com/watch?v=fixture-one'),
    notice('tagged-target', 'Your post was published.', '/launches?postId=post-1&notification=publishing'),
    notice('connection-target', 'Connection needs attention.', '/launches?integrationId=channel-1&notification=connection'),
    notice('user-authored', 'I saved https://www.youtube.com/watch?v=fixture-one for later'),
    notice('user-link', 'A user-authored comment', '/launches?postId=post-1'),
    notice('other-channel', 'Your post has been published on Youtube at https://www.youtube.com/watch?v=fixture-two'),
    notice('ambiguous', "We couldn't post to youtube for Old Channel because you need to reconnect it. Please enable it and try again."),
    notice('other-org', 'Your post has been published on Youtube at https://www.youtube.com/watch?v=fixture-one', null, 'org-other')
  );
  assert.deepEqual(await fixture.repository.purgeAuthorizationNotifications('org-1', 'channel-1'), { deleted: 3, unattributed: 1 });
  assert.deepEqual(fixture.notifications.map((row) => row.id), ['user-authored', 'user-link', 'other-channel', 'ambiguous', 'other-org']);
});

test('historical purge cannot remove notifications for an active or foreign connection', async () => {
  const fixture = setup();
  fixture.notifications.push({ id: 'keep', organizationId: 'org-1', content: 'Your post has been published on Youtube at https://www.youtube.com/watch?v=fixture-one', link: null });
  assert.deepEqual(await fixture.repository.purgeAuthorizationNotifications('org-1', 'channel-1'), { deleted: 0, unattributed: 0 });
  assert.deepEqual(await fixture.repository.purgeAuthorizationNotifications('org-other', 'channel-1'), { deleted: 0, unattributed: 0 });
  assert.equal(fixture.notifications.length, 1);
});

test('a truncated post inventory cannot prove unique ownership of legacy text', async () => {
  const fixture = setup();
  fixture.integrations[0].deletedAt = new Date();
  for (let i = 0; i < 999; i++) fixture.posts.push({
    id: `other-${i}`, integrationId: 'channel-2', organizationId: 'org-1', deletedAt: null,
    releaseURL: i === 998 ? fixture.posts[0].releaseURL : `https://www.youtube.com/watch?v=other-${i}`,
  });
  fixture.notifications.push({ id: 'ambiguous-ownership', organizationId: 'org-1', link: null,
    content: 'Your post has been published on Youtube at https://www.youtube.com/watch?v=fixture-one' });
  const result = await fixture.repository.purgeAuthorizationNotifications('org-1', 'channel-1');
  assert.equal(result.deleted, 0);
  assert.ok(result.unattributed > 0);
  assert.equal(fixture.notifications.length, 1);
});

test('legacy refresh errors remain intact but block automatic completion when channel attribution is missing', async () => {
  const fixture = setup();
  fixture.integrations[0].deletedAt = new Date();
  fixture.notifications.push({ id: 'legacy-refresh', organizationId: 'org-1', link: null,
    content: 'Could not refresh your youtube channel provider response. Please go back to the system and connect it again https://app.example.test/launches' });
  assert.deepEqual(await fixture.repository.purgeAuthorizationNotifications('org-1', 'channel-1'), { deleted: 0, unattributed: 1 });
  assert.equal(fixture.notifications.length, 1);
});
