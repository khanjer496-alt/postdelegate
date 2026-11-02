import {
  AFFILIATE_CODE_REGEX,
  buildAffiliateCookieValue,
  hasReferralConsent,
  parseAffiliateCookieValue,
  parseReferralCode,
  parseReferralConsent,
  readCookieValue,
  REFERRAL_CONSENT_COOKIE_NAME,
  REFERRAL_CONSENT_DAYS,
} from './affiliate.cookie';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 30, 12);

describe('affiliate cookie', () => {
  it('reads back the code it wrote', () => {
    const value = buildAffiliateCookieValue('Friend-1', NOW);
    expect(value).toBe(`friend-1.${NOW}`);
    expect(parseAffiliateCookieValue(value, 60, NOW + DAY)).toBe('friend-1');
  });

  it('accepts a cookie right before the window ends', () => {
    const value = buildAffiliateCookieValue('abc23', NOW);
    expect(parseAffiliateCookieValue(value, 60, NOW + 60 * DAY)).toBe('abc23');
  });

  it('rejects an expired cookie', () => {
    const value = buildAffiliateCookieValue('abc23', NOW);
    expect(
      parseAffiliateCookieValue(value, 60, NOW + 60 * DAY + 1)
    ).toBeUndefined();
  });

  it('follows the configured number of days', () => {
    const value = buildAffiliateCookieValue('abc23', NOW);
    expect(parseAffiliateCookieValue(value, 7, NOW + 8 * DAY)).toBeUndefined();
    expect(parseAffiliateCookieValue(value, 90, NOW + 80 * DAY)).toBe('abc23');
  });

  it.each([
    undefined,
    '',
    'abc23',
    '.123',
    'abc23.',
    'abc23.notanumber',
    'a.1',
    'UPPER.1',
    '-bad.1',
    'bad code.1',
  ])('rejects the malformed value %p', (value) => {
    expect(parseAffiliateCookieValue(value as any, 60, NOW)).toBeUndefined();
  });

  it('rejects a timestamp from the future', () => {
    expect(
      parseAffiliateCookieValue(`abc23.${NOW + 5 * DAY}`, 60, NOW)
    ).toBeUndefined();
  });

  it('defines the code shape', () => {
    expect(AFFILIATE_CODE_REGEX.test('abc')).toBe(true);
    expect(AFFILIATE_CODE_REGEX.test('ab')).toBe(false);
    expect(AFFILIATE_CODE_REGEX.test('a'.repeat(24))).toBe(true);
    expect(AFFILIATE_CODE_REGEX.test('a'.repeat(25))).toBe(false);
    expect(AFFILIATE_CODE_REGEX.test('my-code')).toBe(true);
    expect(AFFILIATE_CODE_REGEX.test('My-code')).toBe(false);
    expect(AFFILIATE_CODE_REGEX.test('my_code')).toBe(false);
  });
});

describe('referral code from the link', () => {
  it('normalises a valid code', () => {
    expect(parseReferralCode(' Friend-1 ')).toBe('friend-1');
  });

  it.each([undefined, null, '', 'ab', 'bad code', '-nope', 'my_code', 'x'.repeat(25)])(
    'rejects %p',
    (value) => {
      expect(parseReferralCode(value as any)).toBeUndefined();
    }
  );
});

describe('referral consent cookie', () => {
  it('remembers the answer for at most 6 months', () => {
    expect(REFERRAL_CONSENT_COOKIE_NAME).toBe('pd_consent');
    expect(REFERRAL_CONSENT_DAYS).toBeLessThanOrEqual(183);
  });

  it('only knows yes and no', () => {
    expect(parseReferralConsent('yes')).toBe('yes');
    expect(parseReferralConsent('no')).toBe('no');
    expect(parseReferralConsent('YES')).toBeUndefined();
    expect(parseReferralConsent('1')).toBeUndefined();
    expect(parseReferralConsent(undefined)).toBeUndefined();
  });

  it('reads one cookie out of document.cookie', () => {
    const cookies = 'showorg=o1; pd_ref=friend.1; pd_consent=no';
    expect(readCookieValue(cookies, 'pd_ref')).toBe('friend.1');
    expect(readCookieValue(cookies, 'pd_consent')).toBe('no');
    expect(readCookieValue(cookies, 'missing')).toBeUndefined();
    expect(readCookieValue('xpd_ref=1', 'pd_ref')).toBeUndefined();
  });

  it('stores nothing until the visitor said yes', () => {
    expect(hasReferralConsent('')).toBe(false);
    expect(hasReferralConsent('pd_consent=no')).toBe(false);
    expect(hasReferralConsent('a=1; pd_consent=yes')).toBe(true);
  });
});
