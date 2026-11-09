import '../../../../../../test/dom';
import React from 'react';
import { render, waitFor, cleanup } from '@testing-library/react';
const mockFetch = jest.fn();
jest.mock('@gitroom/helpers/utils/custom.fetch', () => ({
  useFetch: () => mockFetch,
}));
jest.mock('@gitroom/frontend/components/layout/new-modal', () => ({
  useModals: () => ({ openModal: jest.fn() }),
}));
jest.mock('@gitroom/react/toaster/toaster', () => ({
  useToaster: () => ({ show: jest.fn() }),
}));
jest.mock('@gitroom/react/translation/get.transation.service.client', () => ({
  useT: () => (_key: string, text: string) => text,
}));
jest.mock('@gitroom/frontend/components/layout/loading', () => ({
  __esModule: true,
  default: () => null,
}));
import { FarcasterApproval } from './farcaster.provider';
const state = 'a'.repeat(64);
const code = 'fcp_' + 'b'.repeat(64);
beforeEach(() => {
  jest.clearAllMocks();
});
afterEach(() => cleanup());
it('uses auth-only start/status and returns an opaque proof with its flow state', async () => {
  mockFetch.mockImplementation(async (url: string) => ({
    json: async () =>
      url.endsWith('/start')
        ? {
            state,
            approvalUrl: 'https://example.test/approve',
            qrCode: 'example',
          }
        : { status: 'approved', code, state },
  }));
  const login = jest.fn();
  render(
    React.createElement(
      React.StrictMode,
      {},
      React.createElement(FarcasterApproval, {
        authentication: true,
        login,
        onFail: jest.fn(),
      })
    )
  );
  await waitFor(() => expect(login).toHaveBeenCalledWith(code, state));
  expect(mockFetch.mock.calls.map((c) => c[0])).toEqual([
    '/auth/farcaster/login/start',
    '/auth/farcaster/login/status',
  ]);
  expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toEqual({ state });
  expect(mockFetch.mock.calls.some((c) => c[0].includes(code))).toBe(false);
});
it('keeps the old channel signer flow separate and unchanged by default', async () => {
  mockFetch.mockImplementation(async (_url: string, options?: any) => ({
    json: async () =>
      options?.method === 'POST'
        ? {
            signerUuid: 'EXAMPLE-channel-signer',
            approvalUrl: 'https://example.test/approve',
            qrCode: 'example',
          }
        : { status: 'approved', code: 'EXAMPLE-channel-code' },
  }));
  const login = jest.fn();
  render(React.createElement(FarcasterApproval, { login, onFail: jest.fn() }));
  await waitFor(() =>
    expect(login).toHaveBeenCalledWith('EXAMPLE-channel-code')
  );
  expect(mockFetch.mock.calls[0][0]).toBe('/auth/farcaster/signer');
  expect(mockFetch.mock.calls[1][0]).toContain(
    'signerUuid=EXAMPLE-channel-signer'
  );
});
