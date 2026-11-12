import { normalizeUiFlagMode, resolveUiV2 } from './ui.flag';

describe('layout v2 flag', () => {
  it('defaults to off for missing or unknown values', () => {
    expect(normalizeUiFlagMode(undefined)).toBe('off');
    expect(normalizeUiFlagMode('')).toBe('off');
    expect(normalizeUiFlagMode('maybe')).toBe('off');
  });
  it('reads on and optin', () => {
    expect(normalizeUiFlagMode('on')).toBe('on');
    expect(normalizeUiFlagMode(' TRUE ')).toBe('on');
    expect(normalizeUiFlagMode('optin')).toBe('optin');
    expect(normalizeUiFlagMode('opt-in')).toBe('optin');
  });
  it('off ignores the cookie', () => {
    expect(resolveUiV2('off', 'v2')).toBe(false);
    expect(resolveUiV2('off', undefined)).toBe(false);
  });
  it('optin needs the v2 cookie', () => {
    expect(resolveUiV2('optin', undefined)).toBe(false);
    expect(resolveUiV2('optin', 'v1')).toBe(false);
    expect(resolveUiV2('optin', 'v2')).toBe(true);
  });
  it('on can be opted out with v1', () => {
    expect(resolveUiV2('on', undefined)).toBe(true);
    expect(resolveUiV2('on', 'v2')).toBe(true);
    expect(resolveUiV2('on', 'v1')).toBe(false);
  });
});
