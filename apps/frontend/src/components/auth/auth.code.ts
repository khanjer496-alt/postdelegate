// Auth-only nonce handoff. Never fall back to putting a proof in the URL.
export { stripConnectCodeFromHistory as stripAuthCodeFromHistory } from '../launches/helpers/extension.code';
const valid = (provider?: string, state?: string) =>
  /^[A-Z][A-Z0-9_]{0,31}$/.test(provider || '') &&
  /^[a-f0-9]{64}$/.test(state || '');
const key = (provider: string, state: string) =>
  `auth-code:${provider}:${state}`;
export const readAuthCode = (provider?: string, state?: string) => {
  if (!valid(provider, state) || typeof window === 'undefined')
    return undefined;
  try {
    return sessionStorage.getItem(key(provider!, state!)) || undefined;
  } catch {
    return undefined;
  }
};
export const clearAuthCode = (provider?: string, state?: string) => {
  if (!valid(provider, state) || typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(key(provider!, state!));
  } catch {}
};
export const handoffAuthCode = (
  provider: string,
  state: string,
  code: string
) => {
  if (!valid(provider, state) || typeof code !== 'string' || !code)
    return undefined;
  try {
    sessionStorage.setItem(key(provider, state), code);
    if (readAuthCode(provider, state) !== code) {
      clearAuthCode(provider, state);
      return undefined;
    }
    return `/auth?${new URLSearchParams({ provider, state, handoff: 'true' })}`;
  } catch {
    clearAuthCode(provider, state);
    return undefined;
  }
};
