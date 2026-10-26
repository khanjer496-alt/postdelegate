/* Isolated dependency-image integration test. See tiktok-backend.cjs for the
 * Docker invocation; mount the checkout at /review and run this file instead.
 * Real React Hook Form, DTO validation, SWR and native inputs execute together.
 * Only provider transport, translation and unrelated preview/music UI are replaced.
 */
const assert = require('node:assert/strict');
const { test, afterEach, after } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const dependencyRequire = Module.createRequire('/app/package.json');
const { JSDOM } = dependencyRequire('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://app.example.test' });
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.HTMLInputElement = dom.window.HTMLInputElement;
global.Event = dom.window.Event;
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = dependencyRequire('react');
const { render, screen, fireEvent, waitFor, cleanup, act } = dependencyRequire('@testing-library/react');
const { useForm, useFormContext, FormProvider } = dependencyRequire('react-hook-form');
const { classValidatorResolver } = dependencyRequire('@hookform/resolvers/class-validator');
const { SWRConfig } = dependencyRequire('swr');
const ts = dependencyRequire('typescript');
dependencyRequire('reflect-metadata');
const root = path.resolve(__dirname, '../../../..');
const Context = React.createContext({});
const t = (_key, fallback) => fallback;
const infrastructure = {
  '@gitroom/frontend/components/layout/set.timezone': { newDayjs: (...args) => dependencyRequire('dayjs')(...args) },
  '@gitroom/frontend/components/new-launch/providers/high.order.provider': {
    PostComment: { COMMENT: 'comment' }, withProvider: (config) => config.SettingsComponent,
  },
  '@gitroom/frontend/components/launches/helpers/use.values': { useSettings: useFormContext },
  '@gitroom/frontend/components/launches/helpers/use.integration': { useIntegration: () => React.useContext(Context) },
  '@gitroom/frontend/components/launches/helpers/use.custom.provider.function': {
    useCustomProviderFunction: () => ({ get: React.useContext(Context).request }),
  },
  '@gitroom/react/translation/get.transation.service.client': { useT: () => t },
  '@gitroom/frontend/components/new-launch/providers/tiktok/tiktok.preview': { TiktokPreview: () => null },
  '@gitroom/frontend/components/new-launch/providers/tiktok/tiktok.music': { TikTokMusicSelector: () => null },
  '@gitroom/frontend/components/new-launch/providers/tiktok/tiktok.location': { TikTokLocationSelector: () => null },
};
const aliases = {
  '@gitroom/frontend/': 'apps/frontend/src/',
  '@gitroom/react/': 'libraries/react-shared-libraries/src/',
  '@gitroom/nestjs-libraries/': 'libraries/nestjs-libraries/src/',
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
    let source;
    for (const [alias, directory] of Object.entries(aliases)) {
      if (id.startsWith(alias)) source = path.join(root, directory, id.slice(alias.length));
    }
    if (id.startsWith('.')) source = path.resolve(path.dirname(filename), id);
    if (source === path.join(root, 'libraries/react-shared-libraries/src/translation/get.transation.service.client')) return { useT: () => t };
    if (source) return loadSource(['.ts', '.tsx', ''].map((ext) => source + ext).find(fs.existsSync));
    return dependencyRequire(id);
  };
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX, experimentalDecorators: true,
      emitDecoratorMetadata: true, esModuleInterop: true,
    },
  }).outputText;
  mod._compile(output, filename);
  return mod.exports;
}
const Settings = loadSource(path.join(root, 'apps/frontend/src/components/new-launch/providers/tiktok/tiktok.provider.tsx')).default;
const { TikTokDto } = loadSource(path.join(root, 'libraries/nestjs-libraries/src/dtos/posts/providers-settings/tiktok.dto.ts'));
const { useLaunchStore } = loadSource(path.join(root, 'apps/frontend/src/components/new-launch/store.ts'));
const creator = {
  creatorUsername: 'review_creator', creatorNickname: 'Review creator',
  privacyLevelOptions: ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'],
  commentDisabled: true, duetDisabled: false, stitchDisabled: true,
  maxDurationSeconds: 60,
};
let form;
function mount({ request = async () => creator, identifier = 'tiktok', media = 'https://media.example/photo.jpg', initial = {} } = {}) {
  const context = {
    integration: { id: 'review-channel', identifier },
    value: [{ image: [{ path: media, id: 'review-media' }], content: 'Original review content' }],
    request,
  };
  function Harness() {
    form = useForm({ resolver: classValidatorResolver(TikTokDto), defaultValues: initial, mode: 'all' });
    return React.createElement(FormProvider, form, React.createElement(Settings));
  }
  return render(React.createElement(SWRConfig, { value: { provider: () => new Map() } },
    React.createElement(Context.Provider, { value: context }, React.createElement(Harness))));
}
const field = (name) => document.querySelector(`[name="${name}"]`);
async function ready() { await screen.findByText('Review creator'); }
async function validate() {
  let valid;
  await act(async () => { valid = await form.trigger(); });
  return valid;
}
afterEach(cleanup);
after(() => dom.window.close());

test('real composer requires explicit privacy and consent, and creator-disabled interactions stay locked', async () => {
  mount();
  await ready();
  assert.equal(field('privacy_level').value, '');
  assert.deepEqual(Array.from(field('privacy_level').options).map((option) => option.value), ['', 'PUBLIC_TO_EVERYONE', 'SELF_ONLY']);
  assert.equal(field('comment').checked, false);
  assert.equal(field('comment').disabled, true);
  assert.equal(field('duet').type, 'hidden');
  assert.equal(screen.queryByRole('checkbox', { name: 'Allow Duet' }), null);
  assert.equal(field('music_usage_consent').checked, false);
  assert.equal(useLaunchStore.getState().publishBlocked['review-channel'], true);
  assert.equal(await validate(), false);
  fireEvent.change(field('privacy_level'), { target: { value: 'SELF_ONLY' } });
  fireEvent.click(field('music_usage_consent'));
  await waitFor(() => assert.equal(form.getValues('creator_info_verified'), true));
  assert.equal(await validate(), true);
  assert.equal(useLaunchStore.getState().publishBlocked['review-channel'], false);
});

test('failed creator checks block direct publishing and retry loads fresh capabilities', async () => {
  let fail = true;
  mount({ request: async () => { if (fail) throw new Error('Provider unavailable'); return creator; } });
  await screen.findByRole('button', { name: 'Retry account check' });
  assert.equal(form.getValues('creator_info_verified'), false);
  assert.equal(await validate(), false);
  assert.equal(useLaunchStore.getState().publishBlocked['review-channel'], true);
  fail = false;
  fireEvent.click(screen.getByRole('button', { name: 'Retry account check' }));
  await ready();
  await waitFor(() => assert.equal(form.getValues('creator_info_verified'), true));
});

test('commercial choices enforce disclosure and private branded content restrictions in the form', async () => {
  mount();
  await ready();
  fireEvent.change(field('privacy_level'), { target: { value: 'SELF_ONLY' } });
  fireEvent.click(field('disclose'));
  assert.equal(field('brand_content_toggle').disabled, true);
  fireEvent.click(field('music_usage_consent'));
  assert.equal(await validate(), false);
  fireEvent.click(field('brand_organic_toggle'));
  await screen.findByText(/will be labeled “Promotional content”/);
  assert.equal(await validate(), true);
  assert.equal(useLaunchStore.getState().publishBlocked['review-channel'], false);
  fireEvent.change(field('privacy_level'), { target: { value: 'PUBLIC_TO_EVERYONE' } });
  fireEvent.click(field('brand_content_toggle'));
  await screen.findByText(/will be labeled “Paid partnership”/);
  assert.equal(field('music_usage_consent').checked, false);
  assert.equal(Array.from(field('privacy_level').options).find((option) => option.value === 'SELF_ONLY').disabled, true);
  assert.equal(await validate(), false);
  fireEvent.click(field('music_usage_consent'));
  assert.equal(await validate(), true);
  fireEvent.click(field('disclose'));
  await waitFor(() => assert.equal(form.getValues('brand_content_toggle'), false));
  assert.equal(form.getValues('brand_organic_toggle'), false);
});

test('UPLOAD hides direct settings and accepts a draft without direct-post privacy or consent', async () => {
  mount({ initial: { content_posting_method: 'UPLOAD' } });
  await screen.findByText(/uploading here does not publish the post/);
  assert.equal(document.querySelector('fieldset').hidden, true);
  assert.equal(field('music_usage_consent').checked, false);
  assert.equal(await validate(), true);
});

test('Business API keeps its prior default settings without the legacy creator or consent gate', async () => {
  mount({ identifier: 'tiktok-business' });
  await waitFor(() => assert.equal(form.getValues('__type'), 'tiktok-business'));
  assert.equal(field('privacy_level').value, 'PUBLIC_TO_EVERYONE');
  assert.equal(field('comment').checked, true);
  assert.equal(field('music_usage_consent'), null);
  assert.equal(await validate(), true);
});

test('a saved draft does not silently reuse a past public default or old upload consent', async () => {
  mount({ initial: { privacy_level: 'PUBLIC_TO_EVERYONE', comment: true, duet: true, stitch: true, music_usage_consent: true } });
  await ready();
  assert.equal(field('privacy_level').value, '');
  assert.equal(field('comment').checked, false);
  assert.equal(field('music_usage_consent').checked, false);
  assert.equal(await validate(), false);
});

test('video metadata exceeding the creator limit blocks publishing until a permitted duration is available', async () => {
  const createElement = document.createElement.bind(document);
  let video;
  let duration = 61;
  document.createElement = (tag, options) => {
    const element = createElement(tag, options);
    if (tag === 'video') {
      video = element;
      element.load = () => {};
      Object.defineProperty(element, 'duration', { get: () => duration });
      queueMicrotask(() => element.dispatchEvent(new Event('loadedmetadata')));
    }
    return element;
  };
  try {
    mount({ media: 'https://media.example/clip.MOV?signature=example' });
    await ready();
    await screen.findByText(/This video is too long/);
    assert.equal(form.getValues('creator_info_verified'), false);
    assert.equal(useLaunchStore.getState().publishBlocked['review-channel'], true);
    assert.equal(field('duet').disabled, false);
    assert.equal(field('stitch').disabled, true);
    duration = 60;
    await act(async () => { video.dispatchEvent(new Event('loadedmetadata')); });
    await waitFor(() => assert.equal(form.getValues('creator_info_verified'), true));
    fireEvent.change(field('privacy_level'), { target: { value: 'SELF_ONLY' } });
    fireEvent.click(field('music_usage_consent'));
    assert.equal(await validate(), true);
    assert.equal(useLaunchStore.getState().publishBlocked['review-channel'], false);
  } finally {
    document.createElement = createElement;
  }
});
