'use client';

import { UI_FLAG_COOKIE, UI_FLAG_COOKIE_MAX_AGE } from './ui.flag';

// The in-app "switch to classic layout" control; it reloads right after, so
// the server reads the new cookie. ?pd_ui=v1/v2 links are handled server-side
// in proxy.ts, before the layout renders.
export const setUiLayoutCookie = (value: 'v1' | 'v2') => {
  document.cookie = `${UI_FLAG_COOKIE}=${value}; path=/; max-age=${UI_FLAG_COOKIE_MAX_AGE}; samesite=lax`;
};

// The v2 shell marks <body> with this class: the v2 colors hang off it and
// shared components (the composer modal) can check it.
export const UI_V2_BODY_CLASS = 'pd-v2';
export const isUiV2Client = () =>
  typeof document !== 'undefined' &&
  document.body.classList.contains(UI_V2_BODY_CLASS);
