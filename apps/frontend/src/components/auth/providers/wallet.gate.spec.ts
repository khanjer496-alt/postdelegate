import '../../../../../../test/dom';
import React from 'react';
import { renderToString } from 'react-dom/server';
const mockVariables: { walletLoginEnabled?: boolean } = {};
const mockAdapter = jest.fn();
jest.mock('@gitroom/react/helpers/variable.context', () => ({
  useVariables: () => mockVariables,
}));
jest.mock('@solana/wallet-adapter-react', () => ({
  ConnectionProvider: ({ children }: any) => children,
  WalletProvider: () =>
    React.createElement('span', { 'data-wallet-enabled': '' }),
  useWallet: jest.fn(),
}));
jest.mock('@solana/wallet-adapter-base-ui', () => ({
  useWalletMultiButton: jest.fn(),
}));
jest.mock('@solana/wallet-adapter-base', () => ({
  WalletAdapterNetwork: { Mainnet: 'mainnet-beta' },
}));
jest.mock('@solana/wallet-adapter-react-ui', () => ({
  WalletModalProvider: () => null,
  useWalletModal: jest.fn(),
}));
jest.mock('@solana/wallet-adapter-react-ui/styles.css', () => ({}));
jest.mock('@solana/web3.js', () => ({
  clusterApiUrl: () => 'https://example.test',
}));
jest.mock(
  '@postiz/wallets',
  () =>
    Object.fromEntries(
      'Torus Bitget Clover Coin98 Fractal HyperPay Keystone Krystal Ledger Math Nightly Nufi Onto Particle Phantom SafePal Saifu Salmon Solflare Tokenary Trust XDEFI TokenPocket'
        .split(' ')
        .map((name) => [
          name === 'Particle' ? 'ParticleAdapter' : `${name}WalletAdapter`,
          mockAdapter,
        ])
    ),
  { virtual: true }
);
jest.mock('@gitroom/helpers/utils/custom.fetch', () => ({
  useFetch: jest.fn(),
}));
jest.mock(
  '@gitroom/frontend/components/auth/providers/placeholder/wallet.ui.provider',
  () => ({ WalletUiProvider: () => null })
);
import WalletProvider, { ButtonCaster } from './wallet.provider';
afterEach(() => {
  delete mockVariables.walletLoginEnabled;
  mockAdapter.mockClear();
});
it.each([undefined, false])(
  'hides both wallet entry points without creating adapters when disabled (%s)',
  (enabled) => {
    mockVariables.walletLoginEnabled = enabled;
    expect(renderToString(React.createElement(WalletProvider))).toBe('');
    expect(
      renderToString(React.createElement(ButtonCaster, { login: jest.fn() }))
    ).toBe('');
    expect(mockAdapter).not.toHaveBeenCalled();
  }
);
it('mounts the wallet connection only with the auth flag', () => {
  mockVariables.walletLoginEnabled = true;
  expect(renderToString(React.createElement(WalletProvider))).toContain(
    'data-wallet-enabled'
  );
  expect(mockAdapter).toHaveBeenCalled();
});
