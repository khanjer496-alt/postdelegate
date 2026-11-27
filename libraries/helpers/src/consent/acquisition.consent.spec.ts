import {
  acquisitionQuery,
  permittedAcquisition,
  privacySignalOptOut,
} from './acquisition.consent';

afterEach(() => {
  jest.restoreAllMocks();
  delete (global as any).document;
  delete (global as any).navigator;
  delete (global as any).location;
  delete (global as any).window;
});
const browser = (cookie: string, signals = {}) => {
  Object.defineProperty(global, 'document', {
    configurable: true,
    value: { cookie },
  });
  Object.defineProperty(global, 'navigator', {
    configurable: true,
    value: signals,
  });
  Object.defineProperty(global, 'location', {
    configurable: true,
    value: { search: '?pd_touch=signed.token' },
  });
};
it.each([
  '',
  'pd_consent=v1|ref:0|analytics:0',
  'pd_consent=v1|ref:0|analytics:1',
])('keeps rejected or unknown attribution unmatched: %s', (cookie) => {
  browser(cookie);
  expect(permittedAcquisition('signed.token')).toBeUndefined();
  expect(acquisitionQuery()).toBe('');
});
it('allows referral consent without analytics storage, then rechecks rejection at submission', () => {
  browser('pd_consent=v1|ref:1|analytics:0');
  expect(permittedAcquisition('signed.token')).toBe('signed.token');
  expect(acquisitionQuery()).toBe('?acquisition=signed.token');
  document.cookie = 'pd_consent=v1|ref:0|analytics:0';
  expect(permittedAcquisition('oauth.continuation')).toBeUndefined();
});
it.each([{ globalPrivacyControl: true }, { doNotTrack: '1' }])(
  'privacy signals override consent and copied URLs: %p',
  (signal) => {
    browser('pd_consent=v1|ref:1|analytics:1', signal);
    expect(privacySignalOptOut()).toBe(true);
    expect(permittedAcquisition('signed.token')).toBeUndefined();
    expect(acquisitionQuery()).toBe('');
  }
);

it('honors window-only DNT for copied touch URLs even with referral consent', () => {
  browser('pd_consent=v1|ref:1|analytics:1');
  Object.defineProperty(global, 'window', {
    configurable: true,
    value: { doNotTrack: '1' },
  });
  expect(permittedAcquisition('signed.token')).toBeUndefined();
  expect(acquisitionQuery()).toBe('');
});
