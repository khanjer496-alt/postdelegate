/* Run with dependency image and checkout mounted at /review. Uses the real
 * Zustand store, composer, and mobile action buttons. Only unrelated editor,
 * provider rendering, and transport boundaries are replaced. No app bootstrap.
 */
const assert = require('node:assert/strict');
const { test, beforeEach, afterEach, after } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const dependencyRequire = Module.createRequire('/app/package.json');
const ts = dependencyRequire('typescript');
const { JSDOM } = dependencyRequire('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://app.example.test' });
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = dependencyRequire('react');
const { render, screen, fireEvent, act, cleanup, waitFor } = dependencyRequire('@testing-library/react');
const dayjs = dependencyRequire('dayjs');
dayjs.extend(dependencyRequire('dayjs/plugin/utc'));
const root = path.resolve(__dirname, '../../../..');
const sourceRoot = path.join(root, 'apps/frontend/src');
const prefix = '@gitroom/frontend/';
const noop = () => null;
const calls = [];
let store;
let capturedActions;
let existingData = {};
let settingsValidById = {};
let malformedSettingsById = {};
const dialogs = new Map();
const toasts = [];
let providerMeta = {};
const t = (_key, fallback) => fallback;
const infrastructure = {
  '@gitroom/frontend/components/layout/set.timezone': { newDayjs: () => dayjs() },
  '@gitroom/frontend/components/launches/helpers/use.existing.data': { useExistingData: () => existingData },
  '@gitroom/frontend/components/new-launch/providers/high.order.provider': { getProviderSettingsMeta: () => providerMeta },
  '@gitroom/frontend/components/new-launch/providers/show.all.providers': {
    Providers: [],
    ShowAllProviders: React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => ({ getAllValues: async () => store.getState().selectedIntegrations.map(({ integration }) => ({ id: integration.id, settings: {}, values: [{ content: 'Original review content', media: [] }] })) }));
      return null;
    }),
  },
  '@gitroom/react/translation/get.transation.service.client': { useT: () => t },
  '@gitroom/react/toaster/toaster': { useToaster: () => ({ show: (text) => toasts.push(text) }) },
  '@gitroom/react/helpers/delete.dialog': { deleteDialog: async () => false },
  '@gitroom/helpers/utils/custom.fetch': { useFetch: () => async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push({ url, body });
    return { ok: true, json: async () => url === '/posts/valid' ? body.posts.map((post) => {
      const integration = store.getState().integrations.find((integration) => integration.id === post.integration.id) || { id: post.integration.id, identifier: 'generic-channel', name: 'Review Channel' };
      return { id: integration.id, identifier: integration.identifier, name: integration.name, valid: !malformedSettingsById[integration.id] && (settingsValidById[integration.id] !== false || ['update', 'draft'].includes(post.type)), errors: true };
    }) : {} };
  } },
  '@gitroom/nestjs-libraries/services/make.is': { makeId: () => 'test-group' },
  '@gitroom/frontend/components/layout/new-modal': { useModals: () => ({
    closeAll() {},
    openModal: (props) => dialogs.set(props.id, render(props.children)),
    closeById: (id) => { dialogs.get(id)?.unmount(); dialogs.delete(id); },
  }) },
  '@gitroom/frontend/components/settings/shortlink-preference.component': { useShortlinkPreference: () => ({ data: { shortlink: 'NO' } }) },
  '@gitroom/frontend/components/new-launch/media.settings.section': { MediaSettingsSection: noop, useMediaSettingsValues: () => [] },
  '@gitroom/frontend/components/ui/is.scroll.hook': { useHasScroll: () => false },
  '@mantine/hooks': { useClickOutside: () => React.useRef(null) },
  '@copilotkit/react-ui': { CopilotPopup: noop },
};
const cache = new Map();
function loadSource(filename) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module);
  cache.set(filename, mod);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths('/app');
  mod.require = (id) => {
    if (infrastructure[id]) return infrastructure[id];
    if (id === prefix + 'components/new-launch/store') return loadSource(path.join(sourceRoot, 'components/new-launch/store.ts'));
    if (id === prefix + 'components/new-launch/providers/post-comment.enum') return loadSource(path.join(sourceRoot, 'components/new-launch/providers/post-comment.enum.ts'));
    if (id === '@gitroom/react/form/button') return loadSource(path.join(root, 'libraries/react-shared-libraries/src/form/button.tsx'));
    if (id === prefix + 'components/new-launch/mobile.top.bar') {
      const { MobileTopBar } = loadSource(path.join(sourceRoot, 'components/new-launch/mobile.top.bar.tsx'));
      return { MobileTopBar: (props) => { capturedActions = props.actions; return React.createElement(MobileTopBar, props); } };
    }
    if (id.startsWith('@gitroom/')) return new Proxy({}, { get: (_target, key) => key === '__esModule' ? true : noop });
    return dependencyRequire(id);
  };
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  mod._compile(output, filename);
  return mod.exports;
}
store = loadSource(path.join(sourceRoot, 'components/new-launch/store.ts')).useLaunchStore;
const { ManageModal } = loadSource(path.join(sourceRoot, 'components/new-launch/manage.modal.tsx'));
beforeEach(() => {
  calls.length = 0;
  toasts.length = 0;
  providerMeta = {};
  existingData = {};
  settingsValidById = {};
  malformedSettingsById = {};
  dialogs.clear();
  store.getState().reset();
  store.getState().setSelectedIntegrations([{ selectedIntegrations: { id: 'selected', name: 'Review Channel', identifier: 'generic-channel' }, settings: {} }]);
});
afterEach(cleanup);
after(() => dom.window.close());
const mount = () => render(React.createElement(ManageModal, { mutate() {} }));
function editing({ rootState = 'DRAFT', siblingState = 'DRAFT', blocked = 'blocked' } = {}) {
  existingData = { integration: 'selected', group: 'group-selected', posts: [{ state: rootState }], siblings: [{ integration: 'blocked', group: 'group-blocked', posts: [{ state: siblingState }] }] };
  const integrations = [{ id: 'selected', name: 'Review Channel', identifier: 'generic-channel' }, { id: 'blocked', name: 'Blocked Channel', identifier: 'generic-channel' }];
  store.getState().setAllIntegrations(integrations);
  store.getState().setSelectedIntegrations(integrations.map((selectedIntegrations) => ({ selectedIntegrations, settings: {} })));
  store.getState().setDate(dayjs().add(1, 'day'));
  store.getState().setCurrent('selected');
  store.setState({ publishBlocked: { [blocked]: true } });
}

test('per-channel publish blockers deduplicate unchanged values and reset cleanly', () => {
  assert.equal(typeof store.getState().setPublishBlocked, 'function');
  assert.deepEqual(store.getState().publishBlocked, {});
  const initial = store.getState();
  store.getState().setPublishBlocked('selected', false);
  assert.equal(store.getState(), initial);
  store.getState().setPublishBlocked('selected', true);
  const blocked = store.getState();
  assert.equal(blocked.publishBlocked.selected, true);
  store.getState().setPublishBlocked('selected', true);
  assert.equal(store.getState(), blocked);
  store.getState().reset();
  assert.deepEqual(store.getState().publishBlocked, {});
});

test('a blocking reason is stored per channel and shown on the disabled desktop action', () => {
  store.getState().setPublishBlocked('selected', true, 'Choose a disclosure option.');
  assert.equal(store.getState().publishBlockedReason.selected, 'Choose a disclosure option.');
  const { container } = mount();
  const anchor = container.querySelector('[data-tooltip-id="tooltip"][data-tooltip-content="Choose a disclosure option."]');
  assert.ok(anchor);
  assert.equal(anchor.querySelector('button').disabled, true);
  act(() => { store.getState().setPublishBlocked('selected', false, 'ignored'); });
  assert.equal(store.getState().publishBlockedReason.selected, undefined);
  assert.equal(container.querySelector('[data-tooltip-content="Choose a disclosure option."]'), null);
});

test('a provider post submit message follows the saved toast only for posts sent out now', async () => {
  providerMeta = { postSubmitMessage: (settings) => settings.mode === 'inbox' ? undefined : 'The platform may take a few minutes.' };
  mount();
  await act(async () => { await capturedActions.find((action) => action.label === 'Post Now').onClick(); });
  await waitFor(() => assert.deepEqual(toasts, ['Added successfully. The platform may take a few minutes.']));
  toasts.length = 0;
  await act(async () => { await capturedActions.find((action) => action.label === 'Save as Draft').onClick(); });
  await waitFor(() => assert.deepEqual(toasts, ['Added successfully']));
  // a schedule for later sends nothing yet
  toasts.length = 0;
  act(() => { store.getState().setDate(dayjs().add(1, 'day')); });
  await act(async () => { await capturedActions.find((action) => action.label === 'Add to calendar').onClick(); });
  await waitFor(() => assert.deepEqual(toasts, ['Added successfully']));
  assert.equal(calls.some((request) => request.url === '/posts' && request.body.type === 'schedule'), true);
});

test('desktop and mobile publishing actions are disabled while drafts remain available', async () => {
  store.setState({ publishBlocked: { selected: true } });
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Post', exact: true }));
  assert.equal(screen.getAllByRole('button', { name: 'Add to calendar', exact: true }).length, 2);
  for (const button of screen.getAllByRole('button', { name: /^(Add to calendar|Post Now)$/ })) assert.equal(button.disabled, true);
  for (const button of screen.getAllByRole('button', { name: 'Save as Draft', exact: true })) assert.equal(button.disabled, false);
});

test('publishing handlers recheck fresh blockers even when invoked from an earlier render', async () => {
  store.setState({ publishBlocked: {} });
  mount();
  const earlierActions = capturedActions;
  await act(async () => { store.setState({ publishBlocked: { selected: true } }); });
  await act(async () => {
    await earlierActions.find((action) => action.label === 'Add to calendar').onClick();
    await earlierActions.find((action) => action.label === 'Post Now').onClick();
  });
  assert.deepEqual(calls, []);
});

test('a blocker on an unselected channel does not prevent other channels from publishing', async () => {
  store.setState({ publishBlocked: { other: true } });
  mount();
  for (const button of screen.getAllByRole('button', { name: 'Add to calendar', exact: true })) assert.equal(button.disabled, false);
  await act(async () => { await capturedActions.find((action) => action.label === 'Post Now').onClick(); });
  assert.equal(calls.some((request) => request.url === '/posts' && request.body.type === 'now'), true);
});

test('draft save remains callable while a selected channel is blocked', async () => {
  store.setState({ publishBlocked: { selected: true } });
  mount();
  await act(async () => { await capturedActions.find((action) => action.label === 'Save as Draft').onClick(); });
  await waitFor(() => assert.equal(calls.some((request) => request.url === '/posts' && request.body.type === 'draft'), true));
});

test('editing can publish only the current channel while a blocked sibling stays draft', async () => {
  editing();
  settingsValidById.blocked = false;
  mount();
  assert.equal(screen.getByRole('button', { name: 'Schedule', exact: true }).disabled, false);
  let completion;
  await act(async () => { completion = capturedActions.find((action) => action.label === 'Schedule').onClick(); });
  assert.equal(screen.getByRole('button', { name: 'Schedule all channels', exact: true }).disabled, true);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Only Review Channel', exact: true })); await completion; });
  assert.deepEqual(calls.filter((request) => request.url === '/posts').map((request) => [request.body.type, request.body.posts.map((post) => post.integration.id)]), [['schedule', ['selected']], ['draft', ['blocked']]]);
});

test('published blocked sibling can keep its state while another channel publishes', async () => {
  editing({ siblingState: 'PUBLISHED' });
  settingsValidById.blocked = false;
  mount();
  let completion;
  await act(async () => { completion = capturedActions.find((action) => action.label === 'Schedule').onClick(); });
  assert.equal(screen.getByRole('button', { name: 'Republish the post', exact: true }).disabled, true);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Just update the post details', exact: true })); await completion; });
  assert.deepEqual(calls.filter((request) => request.url === '/posts').map((request) => [request.body.type, request.body.posts.map((post) => post.integration.id)]), [['update', ['blocked']], ['schedule', ['selected']]]);
});

test('an already published blocked channel still permits update-only editing', async () => {
  editing({ rootState: 'PUBLISHED', siblingState: 'PUBLISHED', blocked: 'selected' });
  settingsValidById.selected = false;
  mount();
  assert.equal(screen.getByRole('button', { name: 'Update', exact: true }).disabled, false);
  let completion;
  await act(async () => { completion = capturedActions.find((action) => action.label === 'Update').onClick(); });
  assert.equal(screen.getByRole('button', { name: 'Republish the post', exact: true }).disabled, true);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Just update the post details', exact: true })); await completion; });
  assert.deepEqual(calls.filter((request) => request.url === '/posts').map((request) => request.body.type), ['update']);
  assert.equal(calls.some((request) => request.url === '/posts' && request.body.republish), false);
});

test('update-only editing still refuses ordinary invalid settings', async () => {
  editing({ rootState: 'PUBLISHED', siblingState: 'PUBLISHED', blocked: 'selected' });
  malformedSettingsById.selected = true;
  mount();
  let completion;
  await act(async () => { completion = capturedActions.find((action) => action.label === 'Update').onClick(); });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Just update the post details', exact: true })); await completion; });
  assert.equal(calls.some((request) => request.url === '/posts'), false);
  assert.equal(calls.find((request) => request.url === '/posts/valid').body.posts.find((post) => post.integration.id === 'selected').type, 'update');
});
