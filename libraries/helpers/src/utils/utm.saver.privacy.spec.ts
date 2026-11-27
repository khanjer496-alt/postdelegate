jest.mock('react', () => ({ useEffect: (effect: () => void) => effect() }));
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('pulse_vid=' + 'a'.repeat(32)),
}));
jest.mock('@mantine/hooks', () => ({
  useLocalStorage: () => ['b'.repeat(32)],
}));
jest.mock('@gitroom/helpers/utils/use.fire.events', () => ({
  useFireEvents: () => jest.fn(),
}));
jest.mock('@gitroom/helpers/consent/use.consent', () => ({
  useConsent: () => ({ ref: true }),
}));
import { usePulseVisitor } from './utm.saver';
afterEach(() => {
  delete (global as any).navigator;
  delete (global as any).localStorage;
  delete (global as any).window;
});
it.each([{ globalPrivacyControl: true }, { doNotTrack: '1' }])(
  'suppresses both copied and saved visitor IDs and removes the saved ID under %p',
  (signal) => {
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: signal,
    });
    const removeItem = jest.fn();
    Object.defineProperty(global, 'localStorage', {
      configurable: true,
      value: { removeItem },
    });
    expect(usePulseVisitor()).toBe('');
    expect(removeItem).toHaveBeenCalledWith('pulse_vid');
  }
);
it('preserves existing visitor behavior without an opt-out signal', () => {
  Object.defineProperty(global, 'navigator', { configurable: true, value: {} });
  expect(usePulseVisitor()).toBe('b'.repeat(32));
});

it('clears saved ID and suppresses both saved and copied fallbacks for window-only DNT', () => {
  Object.defineProperty(global, 'navigator', { configurable: true, value: {} });
  Object.defineProperty(global, 'window', {
    configurable: true,
    value: { doNotTrack: '1' },
  });
  const removeItem = jest.fn();
  Object.defineProperty(global, 'localStorage', {
    configurable: true,
    value: { removeItem },
  });
  expect(usePulseVisitor()).toBe('');
  expect(removeItem).toHaveBeenCalledWith('pulse_vid');
});
