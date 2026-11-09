/** @jest-environment node */
import React from 'react';
// These form tests do not render canvas; the optional native canvas addon is
// deliberately excluded so the test also works with a pure-JS dependency install.
jest.mock('canvas', () => null);
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://app.postdelegate.test',
});
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  sessionStorage: { configurable: true, value: dom.window.sessionStorage },
  HTMLElement: { configurable: true, value: dom.window.HTMLElement },
});
const {
  render,
  fireEvent,
  waitFor,
  cleanup,
} = require('@testing-library/react');
import { Buffer } from 'buffer';

const mockFetch = jest.fn();
const mockModal = {
  closeAll: jest.fn(),
  closeCurrent: jest.fn(),
  openModal: jest.fn(),
};
const mockToast = { show: jest.fn() };
const mockRouter = { push: jest.fn() };
const fixture = 'EXAMPLE-credential-DO-NOT-USE';
const mockVariables = {
  extensionId: 'EXAMPLE-extension',
  backendUrl: '',
  isGeneral: false,
  dub: true,
};
jest.mock('@gitroom/frontend/components/layout/new-modal', () => ({
  useModals: () => mockModal,
}));
jest.mock('@gitroom/helpers/utils/custom.fetch', () => ({
  useFetch: () => mockFetch,
}));
jest.mock('@gitroom/react/form/input', () => ({
  Input: (props: any) => {
    const { register } = require('react-hook-form').useFormContext();
    return require('react').createElement('input', {
      'aria-label': props.label,
      type: props.type,
      ...register(props.name),
    });
  },
}));
jest.mock('@gitroom/react/form/button', () => ({
  Button: ({ children, secondary, ...props }: any) =>
    require('react').createElement('button', props, children),
}));
jest.mock('@hookform/resolvers/class-validator', () => ({
  classValidatorResolver: () => () => ({ values: {}, errors: {} }),
}));
jest.mock('@gitroom/nestjs-libraries/dtos/integrations/api.key.dto', () => ({
  ApiKeyDto: class {},
}));
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/integrations/social/moltbook',
}));
jest.mock(
  '@gitroom/frontend/components/launches/helpers/top.title.component',
  () => ({ TopTitle: () => null })
);
jest.mock('@gitroom/react/helpers/variable.context', () => ({
  useVariables: () => mockVariables,
}));
jest.mock('@gitroom/react/toaster/toaster', () => ({
  useToaster: () => mockToast,
}));
jest.mock('@gitroom/react/translation/get.transation.service.client', () => ({
  useT: () => (_key: string, text: string) => text,
}));
jest.mock('@gitroom/frontend/components/launches/web3/web3.list', () => ({
  web3List: [{ identifier: 'moltbook', component: () => null }],
}));
jest.mock('@gitroom/frontend/components/layout/redirect', () => ({
  Redirect: () => null,
}));
jest.mock(
  '@gitroom/frontend/components/new-launch/providers/continue-provider/list',
  () => ({ continueProviderList: {} })
);
jest.mock(
  '@gitroom/frontend/components/launches/helpers/use.integration',
  () => ({ IntegrationContext: require('react').createContext({}) })
);
jest.mock('@gitroom/frontend/components/layout/set.timezone', () => ({
  newDayjs: () => ({ utcOffset: () => 0 }),
}));
jest.mock('@gitroom/frontend/app/(app)/auth/return.url.component', () => ({
  sameOriginUrl: () => null,
}));
jest.mock(
  '@gitroom/frontend/components/launches/import/import.posts.modal',
  () => ({ errorMessage: async () => '' })
);

import {
  CustomVariables,
  AddProviderComponent,
} from './add.provider.component';
import { ContinueIntegration } from './continue.integration';

const custom = [
  'nostr',
  'bluesky',
  'lemmy',
  'listmonk',
  'wordpress',
  'devto',
  'hashnode',
  'medium',
  'x-own-key',
];
const variables = [
  {
    key: 'credential',
    label: 'Credential',
    type: 'password' as const,
    validation: '/.+/',
  },
];
const originalLocation = window.location;
const initialNodeEnv = process.env.NODE_ENV;
const navigate = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  window.history.replaceState({ routerState: 'preserve' }, '', '/');
  mockFetch.mockResolvedValue({
    status: 200,
    ok: true,
    json: async () => ({ url: 'review-state' }),
  });
});
afterEach(() => {
  cleanup();
  process.env.NODE_ENV = initialNodeEnv;
});

it.each(custom)(
  '%s never puts its form credential in a navigation or request URL',
  async (identifier) => {
    const view = render(
      React.createElement(CustomVariables, {
        identifier,
        variables,
        gotoUrl: navigate,
        onboarding: true,
      })
    );
    fireEvent.change(view.getByLabelText('Credential'), {
      target: { value: fixture },
    });
    fireEvent.submit(view.container.querySelector('form')!);
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    const url = new URL(navigate.mock.calls[0][0], window.location.origin);
    expect(url.searchParams.has('code')).toBe(false);
    expect(url.searchParams.get('state')).toBe('review-state');
    expect(url.searchParams.get('onboarding')).toBe('true');
    expect(sessionStorage.getItem('extension-code:review-state')).toBe(
      Buffer.from(JSON.stringify({ credential: fixture })).toString('base64')
    );
    for (const address of [...navigate.mock.calls, ...mockFetch.mock.calls].map(
      (c) => c[0]
    )) {
      expect(address).not.toContain(fixture);
      expect(address).not.toContain(
        Buffer.from(JSON.stringify({ credential: fixture })).toString('base64')
      );
    }
  }
);

it('fails closed when custom-form sessionStorage is blocked', async () => {
  const blocked = jest
    .spyOn(window.Storage.prototype, 'setItem')
    .mockImplementation(() => {
      throw new Error('blocked');
    });
  try {
    const view = render(
      React.createElement(CustomVariables, {
        identifier: 'nostr',
        variables,
        gotoUrl: navigate,
      })
    );
    fireEvent.change(view.getByLabelText('Credential'), {
      target: { value: fixture },
    });
    fireEvent.submit(view.container.querySelector('form')!);
    await waitFor(() => expect(mockToast.show).toHaveBeenCalled());
    expect(navigate).not.toHaveBeenCalled();
    expect(mockModal.closeAll).not.toHaveBeenCalled();
  } finally {
    blocked.mockRestore();
  }
});

it('Moltbook stores its raw API key in the handoff, never the callback URL', async () => {
  const view = render(
    React.createElement(AddProviderComponent, {
      social: [
        {
          identifier: 'moltbook',
          name: 'Moltbook',
          isExternal: false,
          isWeb3: true,
        },
      ],
      article: [],
      invite: false,
    })
  );
  fireEvent.click(view.getByRole('button', { name: /moltbook/i }));
  await waitFor(() => expect(mockModal.openModal).toHaveBeenCalled());
  const child = mockModal.openModal.mock.calls[0][0].children.props.children;
  // Replace only the navigation surface; the real completion callback runs.
  const savedWindow = window;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { origin: originalLocation.origin, href: '' } },
  });
  try {
    child.props.onComplete(fixture, 'review-state');
    expect(sessionStorage.getItem('extension-code:review-state')).toBe(fixture);
    expect(window.location.href).not.toContain(fixture);
    expect(
      new URL(window.location.href, originalLocation.origin).searchParams.has(
        'code'
      )
    ).toBe(false);
  } finally {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: savedWindow,
    });
  }
});

it('removes legacy callback codes from history before POST, preserving the body and router state', async () => {
  window.history.replaceState(
    { routerState: 'preserve' },
    '',
    '/integrations/social/wordpress?state=review-state&code=EXAMPLE-legacy-code&onboarding=true'
  );
  mockFetch.mockImplementation(async (_url: string, options: any) => {
    expect(window.location.search).not.toContain('code=');
    expect(window.history.state).toEqual({ routerState: 'preserve' });
    expect(JSON.parse(options.body).code).toBe('EXAMPLE-legacy-code');
    return { status: 401, ok: false, json: async () => ({}) };
  });
  render(
    React.createElement(ContinueIntegration, {
      provider: 'wordpress',
      logged: false,
      searchParams: {
        state: 'review-state',
        code: 'EXAMPLE-legacy-code',
        onboarding: 'true',
      },
    })
  );
  await waitFor(() => expect(mockFetch).toHaveBeenCalled());
  expect(window.location.search).toBe('?state=review-state&onboarding=true');
});

jest.mock('next/script', () => ({
  __esModule: true,
  default: () =>
    require('react').createElement('script', { 'data-tracker': 'script' }),
}));
jest.mock('@gitroom/helpers/consent/use.consent', () => ({
  useConsent: () => ({ analytics: true }),
}));
const mockPlausible = jest.fn(({ children }: any) => children);
jest.mock('next-plausible', () => ({
  __esModule: true,
  default: (props: any) => mockPlausible(props),
}));
jest.mock('@dub/analytics/react', () => ({
  Analytics: () =>
    require('react').createElement('span', { 'data-tracker': 'dub' }),
}));
import { DataFastScript, ConsentPlausible } from '../layout/analytics.scripts';
import { GoogleTagManagerComponent } from '../layout/gtm.component';
import { FacebookComponent } from '../layout/facebook.component';
import { DubAnalytics } from '../layout/dubAnalytics';

it('does not load marketing trackers on the callback even with analytics consent', () => {
  process.env.NODE_ENV = 'production';
  process.env.NEXT_PUBLIC_FACEBOOK_PIXEL = 'EXAMPLE-pixel';
  const view = render(
    React.createElement(
      React.Fragment,
      {},
      React.createElement(DataFastScript, {
        websiteId: 'EXAMPLE',
        domain: 'app.postdelegate.test',
      }),
      React.createElement(GoogleTagManagerComponent, { gtmId: 'EXAMPLE-gtm' }),
      React.createElement(FacebookComponent),
      React.createElement(DubAnalytics),
      React.createElement(ConsentPlausible, {
        domain: 'app.postdelegate.test',
        children: React.createElement('div', {}, 'App content'),
      })
    )
  );
  expect(view.container.querySelector('[data-tracker]')).toBe(null);
  expect(mockPlausible.mock.calls[0][0].enabled).toBe(false);
  expect(view.getByText('App content')).toBeTruthy();
  delete process.env.NEXT_PUBLIC_FACEBOOK_PIXEL;
});

afterAll(() => dom.window.close());

it('sends stored credentials only in the POST body and consumes the handoff after a response', async () => {
  const encoded = Buffer.from(JSON.stringify({ password: fixture })).toString(
    'base64'
  );
  sessionStorage.setItem('extension-code:review-state', encoded);
  window.history.replaceState(
    {},
    '',
    '/integrations/social/wordpress?state=review-state'
  );
  mockFetch.mockImplementation(async (url: string, options: any) => {
    expect(url).not.toContain(fixture);
    expect(url).not.toContain(encoded);
    expect(JSON.parse(options.body).code).toBe(encoded);
    return { status: 401, ok: false, json: async () => ({}) };
  });
  render(
    React.createElement(ContinueIntegration, {
      provider: 'wordpress',
      logged: false,
      searchParams: { state: 'review-state' },
    })
  );
  await waitFor(() => expect(mockFetch).toHaveBeenCalled());
  await waitFor(() =>
    expect(sessionStorage.getItem('extension-code:review-state')).toBe(null)
  );
  expect(window.location.href).not.toContain(encoded);
});

it('fails closed for extension cookies instead of using the old query fallback', async () => {
  const blocked = jest
    .spyOn(window.Storage.prototype, 'setItem')
    .mockImplementation(() => {
      throw new Error('blocked');
    });
  (globalThis as any).chrome = {
    runtime: {
      sendMessage: (_id: string, msg: any, callback: any) =>
        callback(
          msg.type === 'PING'
            ? { status: true }
            : { success: true, cookies: [{ value: fixture }] }
        ),
    },
  };
  try {
    const view = render(
      React.createElement(AddProviderComponent, {
        social: [
          {
            identifier: 'example-extension',
            name: 'Extension',
            isExternal: false,
            isWeb3: false,
            isChromeExtension: true,
          },
        ],
        article: [],
        invite: false,
      })
    );
    fireEvent.click(view.getByRole('button', { name: /extension/i }));
    mockModal.openModal.mock.calls[0][0].children.props.onConfirm();
    await waitFor(() => expect(mockToast.show).toHaveBeenCalled());
    expect(mockToast.show.mock.calls[0][0]).toMatch(/secure connection/);
    expect(window.location.href).not.toContain(fixture);
    expect(window.location.search).not.toContain('code=');
    expect(mockModal.closeAll).not.toHaveBeenCalled();
  } finally {
    blocked.mockRestore();
    delete (globalThis as any).chrome;
  }
});


it.each(['missing', 'failed'])('does not misdiagnose a %s custom-provider URL as blocked storage', async (kind) => {
  mockFetch.mockResolvedValue({ status: kind === 'failed' ? 500 : 200, ok: kind !== 'failed', json: async () => ({}) });
  const view = render(React.createElement(CustomVariables, { identifier: 'nostr', variables, gotoUrl: navigate }));
  fireEvent.change(view.getByLabelText('Credential'), { target: { value: fixture } });
  fireEvent.submit(view.container.querySelector('form')!);
  await waitFor(() => expect(mockFetch).toHaveBeenCalled());
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(mockToast.show.mock.calls.flat().join(' ')).not.toMatch(/session storage/i);
  expect(navigate).not.toHaveBeenCalled();
});

it.each(['initial', 'confirmed'])('clears the handoff when the %s connect request fails on the network', async (stage) => {
  sessionStorage.setItem('extension-code:review-state', fixture);
  mockFetch.mockImplementation(async () => {
    if (stage === 'confirmed' && mockFetch.mock.calls.length === 1) return { status: 200, ok: true, clone() { return this; }, json: async () => ({ needsConfirmation: true }) };
    throw new Error('offline');
  });
  const view = render(React.createElement(ContinueIntegration, { provider: 'wordpress', logged: false, searchParams: { state: 'review-state' } }));
  if (stage === 'confirmed') fireEvent.click(await view.findByRole('button', { name: 'Connect' }));
  await waitFor(() => expect(mockFetch.mock.calls.length).toBe(stage === 'confirmed' ? 2 : 1));
  await waitFor(() => expect(sessionStorage.getItem('extension-code:review-state')).toBe(null));
});

it.each(['cancel', 'abandon', 'confirm'])('consumes the handoff while a shared connection waits for %s', async (action) => {
  sessionStorage.setItem('extension-code:review-state', fixture);
  mockFetch.mockImplementation(async (_url, options) => {
    if (mockFetch.mock.calls.length === 1) return { status: 200, ok: true, clone() { return this; }, json: async () => ({ needsConfirmation: true }) };
    if (action === 'confirm') expect(JSON.parse(options.body).code).toBe(fixture);
    return { status: 401, ok: false, json: async () => ({}) };
  });
  const view = render(React.createElement(ContinueIntegration, { provider: 'wordpress', logged: false, searchParams: { state: 'review-state' } }));
  await view.findByRole('button', { name: 'Connect' });
  if (action === 'cancel') fireEvent.click(view.getByRole('button', { name: 'Cancel' }));
  if (action === 'confirm') { fireEvent.click(view.getByRole('button', { name: 'Connect' })); await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2)); }
  if (action === 'abandon') view.unmount();
  await waitFor(() => expect(sessionStorage.getItem('extension-code:review-state')).toBe(null));
});
