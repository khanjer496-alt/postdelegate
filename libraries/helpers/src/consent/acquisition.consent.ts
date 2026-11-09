import { hasConsent } from './consent.cookie';

export const privacySignalOptOut = () =>
  typeof navigator !== 'undefined' &&
  ((navigator as Navigator & { globalPrivacyControl?: boolean })
    .globalPrivacyControl === true ||
    navigator.doNotTrack === '1');

// Recheck at submission time, including OAuth continuations and copied URLs.
export const permittedAcquisition = (token: string | null | undefined) =>
  !privacySignalOptOut() && hasConsent('ref') ? token || undefined : undefined;

export const acquisitionQuery = () => {
  const token = permittedAcquisition(
    new URLSearchParams(location.search).get('pd_touch')
  );
  return token ? '?acquisition=' + encodeURIComponent(token) : '';
};
