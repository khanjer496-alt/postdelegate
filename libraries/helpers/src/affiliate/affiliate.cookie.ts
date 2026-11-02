// The first-party cookie that carries the referral code from the landing page
// to the registration. Written by the frontend, read by the backend.
export const AFFILIATE_COOKIE_NAME = 'pd_ref';
export const DEFAULT_AFFILIATE_COOKIE_DAYS = 60;

// 3 to 24 characters, lowercase letters, digits and hyphens, no leading hyphen
export const AFFILIATE_CODE_REGEX = /^[a-z0-9][a-z0-9-]{2,23}$/;

const DAY = 24 * 60 * 60 * 1000;

// The value is "<code>.<unix ms>", the time lets the server enforce the
// attribution window on its own instead of trusting the browser expiry
export const buildAffiliateCookieValue = (code: string, now = Date.now()) =>
  `${code.toLowerCase()}.${now}`;

export const parseAffiliateCookieValue = (
  value: string | undefined | null,
  maxAgeDays: number,
  now = Date.now()
): string | undefined => {
  if (!value || typeof value !== 'string') {
    return undefined;
  }

  const separator = value.lastIndexOf('.');
  if (separator < 1) {
    return undefined;
  }

  const code = value.slice(0, separator);
  const issuedAt = Number(value.slice(separator + 1));
  if (
    !AFFILIATE_CODE_REGEX.test(code) ||
    !Number.isFinite(issuedAt) ||
    issuedAt > now + DAY ||
    now - issuedAt > maxAgeDays * DAY
  ) {
    return undefined;
  }

  return code;
};

// The ?ref= code of an affiliate link, or undefined when it is not one
export const parseReferralCode = (value: string | undefined | null) => {
  const code = value?.trim().toLowerCase();
  return code && AFFILIATE_CODE_REGEX.test(code) ? code : undefined;
};

// The visitor's answer to the referral prompt. pd_ref and the saved campaign
// source are only stored after a "yes". This cookie only remembers the answer,
// which makes it strictly necessary, and it is kept for 6 months (CNIL) so a
// "no" is not asked again on every visit. Shared with the marketing site.
export const REFERRAL_CONSENT_COOKIE_NAME = 'pd_consent';
export const REFERRAL_CONSENT_DAYS = 180;

export type ReferralConsent = 'yes' | 'no';

export const parseReferralConsent = (
  value: string | undefined | null
): ReferralConsent | undefined =>
  value === 'yes' || value === 'no' ? value : undefined;

// One value out of a document.cookie string
export const readCookieValue = (cookies: string, name: string) =>
  cookies
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.slice(name.length + 1);

export const hasReferralConsent = (cookies: string) =>
  parseReferralConsent(
    readCookieValue(cookies, REFERRAL_CONSENT_COOKIE_NAME)
  ) === 'yes';
