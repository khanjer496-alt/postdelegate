import '../../../../../test/dom';
import React, { act } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { fireEvent } from '@testing-library/react';

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
  useVariables: () => mockVariables,
}));
jest.mock('@hookform/resolvers/class-validator', () => ({
  classValidatorResolver: () => async (values: any) => ({ values, errors: {} }),
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@gitroom/helpers/utils/use.fire.events', () => ({
  useFireEvents: () => jest.fn(),
}));
jest.mock('@gitroom/react/helpers/use.track', () => ({
  useTrack: () => jest.fn(),
}));
jest.mock('react-use-cookie', () => ({
  __esModule: true,
  default: () => [''],
}));
jest.mock(
  '@gitroom/frontend/components/launches/import/import.posts.modal',
  () => ({ errorMessage: async () => 'Try again' })
);
jest.mock(
  '@gitroom/frontend/components/auth/providers/google.provider',
  () => ({ GoogleProvider: () => null })
);
jest.mock('@gitroom/frontend/components/auth/providers/apple.provider', () => ({
  AppleProvider: () => null,
}));
jest.mock(
  '@gitroom/frontend/components/auth/providers/github.provider',
  () => ({ GithubProvider: () => null })
);
jest.mock('@gitroom/frontend/components/auth/providers/oauth.provider', () => ({
  OauthProvider: () => null,
}));
jest.mock(
  '@gitroom/frontend/components/auth/providers/farcaster.provider',
  () => ({ FarcasterProvider: () => React.createElement('button', { type: 'button', 'data-farcaster-login': '' }, 'Farcaster') })
);
jest.mock('@gitroom/frontend/components/layout/loading', () => ({
  LoadingComponent: () => null,
}));

import { Login } from './login';
import { RegisterAfter } from './register';
import { Forgot } from './forgot';
import { ForgotReturn } from './forgot-return';
import { Activate } from './activate';

const mockFetch = jest.fn();
const cases = [
  ['login', Login, {}, '/auth/login'],
  ['register', RegisterAfter, { token: '', provider: 'LOCAL' }, '/auth'],
  ['forgot', Forgot, {}, '/auth/forgot'],
  ['reset', ForgotReturn, { token: 'example-reset-token' }, '/auth/forgot'],
  ['activate', Activate, {}, '/auth/activate'],
] as const;

beforeAll(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});
beforeEach(() => {
  mockFetch.mockReset();
});

describe.each(cases)(
  '%s credentials before hydration',
  (_name, Component, props, action) => {
    it('renders a POST form with a fixed local action and a disabled submit button', () => {
      const container = document.createElement('div');
      container.innerHTML = renderToString(
        React.createElement(Component as any, props)
      );
      const form = container.querySelector('form')!;
      // Read browser properties: missing method defaults to GET (the reported leak).
      expect(form.method).toBe('post');
      expect(form.getAttribute('action')).toBe(action);
      expect(
        container.querySelector<HTMLButtonElement>('button[type="submit"]')!
          .disabled
      ).toBe(true);
      expect(form.action).not.toContain('example-reset-token');
    });

    it('enables submission after hydration and prevents native URL navigation', async () => {
      const element = React.createElement(Component as any, props);
      const container = document.createElement('div');
      document.body.appendChild(container);
      container.innerHTML = renderToString(element);
      let root: ReturnType<typeof hydrateRoot>;
      await act(async () => {
        root = hydrateRoot(container, element);
      });
      const button = container.querySelector<HTMLButtonElement>(
        'button[type="submit"]'
      )!;
      expect(button.disabled).toBe(false);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Try again',
        json: async () => ({ message: 'Try again' }),
      });
      for (const input of container.querySelectorAll<HTMLInputElement>(
        'input'
      )) {
        fireEvent.change(input, {
          target: {
            value:
              input.type === 'email'
                ? 'example@example.test'
                : 'example-password',
          },
        });
      }
      const event = new Event('submit', { bubbles: true, cancelable: true });
      await act(async () => {
        container.querySelector('form')!.dispatchEvent(event);
      });
      expect(event.defaultPrevented).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/^\/auth\//),
        expect.objectContaining({ method: 'POST' })
      );
      expect(button.disabled).toBe(false);
      await act(async () => {
        root!.unmount();
      });
      container.remove();
    });
  }
);

const mockVariables: Record<string, any> = { isGeneral: true };
describe.each([['Login', Login, {}], ['Register', RegisterAfter, { token: '', provider: '' }]])('%s provider visibility', (_name, Component, props) => {
  afterEach(() => { delete mockVariables.farcasterLoginEnabled; delete mockVariables.neynarClientId; });
  it.each([undefined, false])('hides Farcaster with a client id and an absent/false auth flag (%s)', enabled => {
    mockVariables.neynarClientId = 'example-client-id';
    mockVariables.farcasterLoginEnabled = enabled;
    expect(renderToString(React.createElement(Component as any, props))).not.toContain('data-farcaster-login');
  });
  it('shows Farcaster only when enabled with its client id', () => {
    mockVariables.neynarClientId = 'example-client-id';
    mockVariables.farcasterLoginEnabled = true;
    expect(renderToString(React.createElement(Component as any, props))).toContain('data-farcaster-login');
  });
});
