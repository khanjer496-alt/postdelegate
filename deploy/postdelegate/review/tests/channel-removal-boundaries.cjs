// Exercises the actual controller methods and menu callback bodies. Transport,
// persistence and dialogs are boundaries; no app bootstrap or network is used.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = Module.createRequire('/app/package.json')('typescript');
const root = path.resolve(__dirname, '../../../..');
const parse = (file) => ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const compile = (text, context) => {
  const js = ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  return new Function('context', js)(context);
};
const bodyOfMethod = (file, name) => {
  const tree = parse(file);
  let body;
  const visit = (node) => {
    if (ts.isMethodDeclaration(node) && node.name.getText(tree) === name) body = node.body.getText(tree);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.ok(body, `${name} method exists in ${file}`);
  return body;
};
const cases = [
  ['web', 'apps/backend/src/api/routes/integrations.controller.ts'],
  ['public', 'apps/backend/src/public-api/routes/v1/public.integrations.controller.ts'],
  ['enterprise', 'apps/backend/src/api/routes/enterprise.controller.ts'],
];
for (const [kind, file] of cases) {
  const parameters = kind === 'enterprise' ? 'params' : 'org, id';
  const Controller = compile(`const Sentry=context.Sentry; return class Subject {async deleteChannel(${parameters}) ${bodyOfMethod(file, 'deleteChannel')}}`, { Sentry: { metrics: { count() {} } } });
  const setup = (blocked) => {
    const calls = [];
    const controller = new Controller();
    controller._integrationService = {
      deleteChannel: async () => { calls.push('lifecycle'); if (blocked) throw new Error('Lifecycle unavailable'); return { id: 'channel' }; },
      getPostsForChannel: async () => { calls.push('read-posts'); return [{ group: 'post-group' }]; },
    };
    controller._postService = controller._postsService = { deletePost: async () => { calls.push('delete-post'); } };
    controller.verifyEnterpriseToken = () => ({ id: 'channel', apiKey: 'test-key' });
    controller._organizationService = { getOrgByApiKey: async () => ({ id: 'org' }) };
    return { controller, calls };
  };
  test(`${kind} deletion cannot mutate posts before lifecycle acceptance`, async () => {
    const { controller, calls } = setup(true);
    const operation = kind === 'enterprise' ? controller.deleteChannel('test') : controller.deleteChannel({ id: 'org' }, 'channel');
    if (kind === 'enterprise') assert.deepEqual(await operation, { success: false });
    else await assert.rejects(operation, /Lifecycle unavailable/);
    assert.deepEqual(calls, ['lifecycle']);
  });
  test(`${kind} deletion proceeds after lifecycle acceptance and returns a narrow result`, async () => {
    const { controller, calls } = setup(false);
    const result = kind === 'enterprise' ? await controller.deleteChannel('test') : await controller.deleteChannel({ id: 'org' }, 'channel');
    assert.deepEqual(calls, ['lifecycle', 'read-posts', 'delete-post']);
    assert.deepEqual(result, kind === 'enterprise' ? { success: true } : { id: 'channel' });
  });
}

const menuTree = parse('apps/frontend/src/components/launches/menu/menu.tsx');
let callbackBody;
const findCallback = (node) => {
  if (ts.isVariableDeclaration(node) && node.name.getText(menuTree) === 'deleteChannel' && ts.isCallExpression(node.initializer)) {
    callbackBody = node.initializer.arguments[0].body.getText(menuTree);
  }
  ts.forEachChild(node, findCallback);
};
findCallback(menuTree);
assert.ok(callbackBody);
const executeRemoval = (context) => compile(`return async()=>{const {t,deleteDialog,fetch,toast,setShow,onChange,extensionId,id,findIntegration}=context; ${callbackBody.slice(1, -1)}}`, context)();
const menuContext = ({ approve = true, ok = true } = {}) => {
  const events = [];
  return {
    events, id: 'channel', extensionId: undefined,
    findIntegration: { dataDeletionNotice: 'This grant also affects other connections. Uploaded source files and remote videos are preserved.' },
    t: (_key, fallback) => fallback,
    deleteDialog: async (message) => { events.push(['dialog', message]); return approve; },
    fetch: async () => { events.push(['delete']); return { ok, status: ok ? 200 : 503, json: async () => ({ message: 'Cleanup unavailable' }) }; },
    toast: { show: (message, type) => events.push(['toast', message, type]) },
    setShow: () => events.push(['hide']),
    onChange: () => events.push(['changed']),
  };
};
test('channel deletion confirmation includes the provider grant and data-removal notice', async () => {
  const context = menuContext({ approve: false });
  await executeRemoval(context);
  assert.match(context.events[0][1], /also affects other connections/);
  assert.equal(context.events.length, 1);
});
test('failed channel removal shows a warning and never claims deletion succeeded', async () => {
  const context = menuContext({ ok: false });
  await executeRemoval(context);
  assert.deepEqual(context.events.filter((event) => event[0] === 'toast'), [['toast', 'Cleanup unavailable', 'warning']]);
  assert.equal(context.events.some((event) => event[0] === 'changed'), false);
});
test('accepted channel removal updates the visible channel list', async () => {
  const context = menuContext();
  await executeRemoval(context);
  assert.equal(context.events.some((event) => event[0] === 'changed'), true);
  assert.equal(context.events.find((event) => event[0] === 'toast')[2], 'success');
  assert.match(context.events.find((event) => event[0] === 'toast')[1], /cleanup.*in progress/);
});
