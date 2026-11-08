const { test } = require('node:test');
const assert = require('node:assert/strict');
const { seedReviewer } = require('../seed-reviewer.cjs');
const config = { orgId: 'pd-review-meta', userId: 'pd-review-meta-user', email: 'review@example.test' };
test('rejects ordinary workspace identifiers before any DB operation', async () => {
  await assert.rejects(() => seedReviewer({}, { ...config, orgId: 'customer-org' }, 'hash'), /pd-review-/);
});
test('refuses an existing email without changing any record', async () => {
  const tx = { user: { findFirst: async () => ({ id: 'existing' }) } };
  await assert.rejects(() => seedReviewer({ $transaction: fn => fn(tx) }, config, 'hash'), /already exists/);
});
test('creates only one isolated reviewer and membership with safe projections', async () => {
  const writes = [];
  const tx = Object.fromEntries(['user','organization','userOrganization','subscription'].map(model => [model, {
    findFirst: async () => null,
    create: async args => { assert.deepEqual(args.select, { id: true }); writes.push([model, args.data]); return { id: args.data.id }; },
  }]));
  const result = await seedReviewer({ $transaction: fn => fn(tx) }, config, 'hash');
  assert.equal(result.orgId, config.orgId);
  assert.equal(writes.length, 4);
  const user = writes.find(([m]) => m === 'user')[1];
  assert.equal(user.isSuperAdmin, false);
  assert.equal(user.sendOnboardingEmails, false);
  assert.equal(writes.find(([m]) => m === 'userOrganization')[1].organizationId, config.orgId);
  assert.equal(writes.find(([m]) => m === 'subscription')[1].totalChannels, 10);
});
