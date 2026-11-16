import {
  nextFeatureCookie,
  normalizeFeatureMode,
  parseFeatureCookie,
  resolveFeatureFlags,
} from './feature.flags';

describe('parity feature flags', () => {
  it('defaults every flag to off', () => {
    const flags = resolveFeatureFlags({});
    expect(Object.values(flags).every((on) => on === false)).toBe(true);
  });
  it('reads off, on and optin', () => {
    expect(normalizeFeatureMode(undefined)).toBe('off');
    expect(normalizeFeatureMode('nope')).toBe('off');
    expect(normalizeFeatureMode(' ON ')).toBe('on');
    expect(normalizeFeatureMode('true')).toBe('on');
    expect(normalizeFeatureMode('opt-in')).toBe('optin');
  });
  it('turns a flag on from its own env var only', () => {
    const flags = resolveFeatureFlags({ PD_FF_BEST_TIMES: 'on' });
    expect(flags.best_times).toBe(true);
    expect(flags.analytics_v2).toBe(false);
    expect(flags.free_plan).toBe(false);
  });
  it('optin needs the key in the cookie', () => {
    const env = { PD_FF_BEST_TIMES: 'optin', PD_FF_CAMPAIGNS: 'optin' };
    expect(resolveFeatureFlags(env).best_times).toBe(false);
    const flags = resolveFeatureFlags(env, 'best_times, unknown');
    expect(flags.best_times).toBe(true);
    expect(flags.campaigns).toBe(false);
  });
  it('ignores unknown cookie keys', () => {
    expect([...parseFeatureCookie('x,best_times,,y')]).toEqual(['best_times']);
  });
  it('adds link keys to the cookie and clears it with off', () => {
    expect(nextFeatureCookie(undefined, 'best_times')).toBe('best_times');
    expect(nextFeatureCookie('best_times', 'campaigns,bogus')).toBe(
      'best_times,campaigns'
    );
    expect(nextFeatureCookie('best_times', 'off')).toBe('');
  });
});
