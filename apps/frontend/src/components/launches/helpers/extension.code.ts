// Channel credentials and extension cookies use this tab's sessionStorage
// handoff, never URLs (history, logs, referrers). Storage can be blocked, so
// writes are verified and every caller must fail closed.
const extensionCodeKey = (state: string) => `extension-code:${state}`;

// False when storage is blocked or a write cannot be read back. Never use a URL fallback.
export const putExtensionCode = (state: string, code: string) => {
  if (typeof state !== 'string' || !state || typeof code !== 'string' || !code)
    return false;
  try {
    sessionStorage.setItem(extensionCodeKey(state), code);
    return sessionStorage.getItem(extensionCodeKey(state)) === code;
  } catch (e) {
    return false;
  }
};

export const readExtensionCode = (state?: string) => {
  if (!state || typeof window === 'undefined') {
    return undefined;
  }
  try {
    return sessionStorage.getItem(extensionCodeKey(state)) || undefined;
  } catch (e) {
    return undefined;
  }
};

// Consume when the callback reads it; pending confirmation stays in memory only.
export const clearExtensionCode = (state?: string) => {
  if (!state || typeof window === 'undefined') {
    return;
  }
  try {
    sessionStorage.removeItem(extensionCodeKey(state));
  } catch (e) {
    // storage blocked, nothing was stored
  }
};

// All local credential providers (including Web3 and extension cookies) use the
// same nonce-keyed handoff. Only the nonce and onboarding flag enter navigation.
export const handoffConnectCode = (
  identifier: string,
  state: string,
  code: string,
  onboarding = false
) => {
  if (!/^[a-z0-9-]+$/.test(identifier) || !putExtensionCode(state, code))
    return undefined;
  const params = new URLSearchParams({
    state,
    ...(onboarding ? { onboarding: 'true' } : {}),
  });
  return `/integrations/social/${identifier}?${params.toString()}`;
};

// The page already captured the callback parameters for its POST body. Remove
// legacy secrets and one-time OAuth codes before any fetch or error state, and
// preserve Next's existing history state. This cannot erase older synced entries.
export const stripConnectCodeFromHistory = () => {
  if (typeof window === 'undefined') return false;
  try {
    const url = new URL(window.location.href);
    const sensitive =
      /^(code|auth_code|oauth_token|oauth_verifier|loginRequestToken|access_token|refresh_token)$/i;
    let changed = false;
    const keys: string[] = [];
    url.searchParams.forEach((_value, key) => keys.push(key));
    for (const key of keys) {
      if (sensitive.test(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    // MeWe returns loginRequestToken in a parameter-style URL fragment.
    // Preserve non-sensitive fragment state while removing callback credentials.
    const hashParams = new URLSearchParams(url.hash.substring(1));
    const hashKeys: string[] = [];
    hashParams.forEach((_value, key) => hashKeys.push(key));
    let hashChanged = false;
    for (const key of hashKeys) {
      if (sensitive.test(key)) {
        hashParams.delete(key);
        hashChanged = true;
      }
    }
    if (hashChanged) {
      url.hash = hashParams.toString();
      changed = true;
    }
    if (changed)
      window.history.replaceState(
        window.history.state,
        '',
        url.pathname + url.search + url.hash
      );
    return true;
  } catch {
    return false;
  }
};
