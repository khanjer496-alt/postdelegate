// Layout v2 switch. Server env PD_UI_V2 decides who sees the new shell:
//   off    (default) everyone gets the classic layout, the cookie is ignored
//   optin  only browsers with the cookie pd_ui=v2 get the new layout
//   on     everyone gets the new layout, pd_ui=v1 opts back to classic
// The env is read per request (the app layout is force-dynamic), so flipping
// it needs a restart of the frontend, not a rebuild.
export const UI_FLAG_ENV = 'PD_UI_V2';
export const UI_FLAG_COOKIE = 'pd_ui';
export const UI_FLAG_QUERY = 'pd_ui';

export type UiFlagMode = 'off' | 'optin' | 'on';

export const normalizeUiFlagMode = (value?: string | null): UiFlagMode => {
  const v = (value || '').trim().toLowerCase();
  if (v === 'on' || v === 'true' || v === '1') {
    return 'on';
  }
  if (v === 'optin' || v === 'opt-in') {
    return 'optin';
  }
  return 'off';
};

export const resolveUiV2 = (
  mode: UiFlagMode,
  cookie?: string | null
): boolean => {
  if (mode === 'on') {
    return cookie !== 'v1';
  }
  if (mode === 'optin') {
    return cookie === 'v2';
  }
  return false;
};
