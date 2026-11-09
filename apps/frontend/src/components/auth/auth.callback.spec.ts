import '../../../../../test/dom';
import React from 'react';
import { render, waitFor, cleanup, fireEvent } from '@testing-library/react';
const mockFetch = jest.fn();
let mockQuery = new URLSearchParams();
jest.mock('@gitroom/helpers/utils/custom.fetch', () => ({
  useFetch: () => mockFetch,
}));
jest.mock('@gitroom/react/translation/get.transation.service.client', () => ({
  useT: () => (_key: string, text: string) => text,
}));
jest.mock('@gitroom/react/translation/translated-label', () => ({
  TranslatedLabel: ({ label }: any) => label,
}));
jest.mock('@gitroom/react/helpers/variable.context', () => ({
  useVariables: () => ({ isGeneral: true }),
}));
jest.mock('@gitroom/helpers/utils/use.fire.events', () => ({
  useFireEvents: () => jest.fn(),
}));
jest.mock('@gitroom/react/helpers/use.track', () => ({
  useTrack: () => jest.fn(),
}));
jest.mock('@hookform/resolvers/class-validator', () => ({
  classValidatorResolver: () => async (values: any) => ({ values, errors: {} }),
}));
jest.mock('react-use-cookie', () => ({
  __esModule: true,
  default: () => [''],
}));
jest.mock('next/navigation', () => ({
  useSearchParams: () => mockQuery,
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) =>
    React.createElement('a', props, children),
}));
jest.mock('./providers/google.provider', () => ({
  GoogleProvider: () => null,
}));
jest.mock('./providers/apple.provider', () => ({ AppleProvider: () => null }));
jest.mock('./providers/github.provider', () => ({
  GithubProvider: () => null,
}));
jest.mock('./providers/oauth.provider', () => ({ OauthProvider: () => null }));
jest.mock('./providers/farcaster.provider', () => ({
  FarcasterProvider: () => null,
}));
jest.mock('@gitroom/frontend/components/layout/loading', () => ({
  LoadingComponent: () => React.createElement('span', {}, 'Loading'),
}));
import { Register, RegisterAfter } from './register';
import { renderToString } from 'react-dom/server';
import { handoffAuthCode } from './auth.code';
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: window.sessionStorage,
});
const state = 'e'.repeat(64);
const proof = 'fcp_' + 'f'.repeat(64);
beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  window.history.replaceState({ router: 'keep' }, '', '/');
  mockQuery = new URLSearchParams();
});
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});
it('posts a stored proof once in StrictMode, consuming it and keeping it out of URL history', async () => {
  const target = handoffAuthCode('FARCASTER', state, proof)!;
  expect(target).not.toContain(proof);
  window.history.replaceState({ router: 'keep' }, '', target);
  mockQuery = new URLSearchParams(window.location.search);
  const snapshots: any[] = [];
  mockFetch.mockImplementation(async (_url, options) => {
    snapshots.push({
      body: JSON.parse(options.body),
      href: window.location.href,
      state: window.history.state,
      stored: sessionStorage.length,
    });
    return { status: 401, ok: false, json: async () => ({}) };
  });
  render(
    React.createElement(React.StrictMode, {}, React.createElement(Register))
  );
  await waitFor(() => expect(snapshots).toHaveLength(1));
  expect(snapshots[0].body).toMatchObject({ code: proof, state });
  expect(snapshots[0].href).not.toContain(proof);
  expect(snapshots[0].state).toEqual({ router: 'keep' });
  expect(snapshots[0].stored).toBe(0);
});
it('captures a legacy wallet code and strips it before POST even on failure', async () => {
  window.history.replaceState(
    { router: 'keep' },
    '',
    '/auth?provider=WALLET&code=EXAMPLE-legacy&state=public-state&ref=safe'
  );
  mockQuery = new URLSearchParams(window.location.search);
  const snapshots: any[] = [];
  mockFetch.mockImplementation(async (_url, options) => {
    snapshots.push({
      body: JSON.parse(options.body),
      href: window.location.href,
    });
    return { status: 401, ok: false, json: async () => ({}) };
  });
  render(React.createElement(Register));
  await waitFor(() => expect(snapshots).toHaveLength(1));
  expect(snapshots[0].body.code).toBe('EXAMPLE-legacy');
  expect(snapshots[0].href).not.toContain('code=');
  expect(window.location.search).toContain('ref=safe');
});
it('fails closed when a nonce handoff has no proof', async () => {
  mockQuery = new URLSearchParams({
    provider: 'FARCASTER',
    state,
    handoff: 'true',
  });
  const view = render(React.createElement(Register));
  await waitFor(() =>
    expect(view.getByRole('alert').textContent).toMatch(/expired/)
  );
  expect(mockFetch).not.toHaveBeenCalled();
});
it('never falls back to a proof URL when storage is blocked', () => {
  jest.spyOn(window.Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  expect(handoffAuthCode('FARCASTER', state, proof)).toBeUndefined();
  expect(window.location.href).not.toContain(proof);
});

it('server-rendered handoff stays loading without consuming browser storage', () => {
  const target = handoffAuthCode('FARCASTER', state, proof)!;
  mockQuery = new URLSearchParams(target.split('?')[1]);
  const html = renderToString(React.createElement(Register));
  expect(html).toContain('Loading');
  expect(html).not.toContain('Create Account');
  expect(sessionStorage.length).toBe(1);
  expect(mockFetch).not.toHaveBeenCalled();
});
it('shows expired registration continuation errors and preserves the flow state in POST', async () => {
  mockFetch.mockResolvedValue({
    status: 400,
    text: async () => 'This sign-in expired. Start again.',
  });
  const view = render(
    React.createElement(RegisterAfter, {
      token: 'fcr_EXAMPLE',
      provider: 'FARCASTER',
      state,
    })
  );
  fireEvent.change(view.getByLabelText('Company'), {
    target: { value: 'Test workspace' },
  });
  fireEvent.submit(view.container.querySelector('form')!);
  await waitFor(() =>
    expect(view.getByRole('alert').textContent).toContain('expired')
  );
  const body = JSON.parse(mockFetch.mock.calls[0][1].body);
  expect(body).toMatchObject({
    providerToken: 'fcr_EXAMPLE',
    providerState: state,
  });
});
