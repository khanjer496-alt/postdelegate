// Feature flags for the Metricool parity work (wave 1). Each feature reads
// its own server env var, so it can be turned on for staging and stay off on
// production. Values: off (default), on, or optin (only browsers that opened
// a ?pd_ff=<key> link, which sets the pd_ff cookie). Like PD_UI_V2, the env is
// read per request, so flipping one needs a frontend restart, not a rebuild.
// The features render inside the v2 layout only.
export const FEATURE_FLAGS = {
  best_times: 'PD_FF_BEST_TIMES',
  analytics_v2: 'PD_FF_ANALYTICS_V2',
  onboarding_v2: 'PD_FF_ONBOARDING_V2',
  calendar_filters: 'PD_FF_CALENDAR_FILTERS',
  campaigns: 'PD_FF_CAMPAIGNS',
  report_templates: 'PD_FF_REPORT_TEMPLATES',
  smartlinks: 'PD_FF_SMARTLINKS',
  free_plan: 'PD_FF_FREE_PLAN',
  comments: 'PD_FF_COMMENTS',
} as const;

export type FeatureKey = keyof typeof FEATURE_FLAGS;
export type FeatureFlags = Partial<Record<FeatureKey, boolean>>;
export type FeatureMode = 'off' | 'optin' | 'on';

export const FEATURE_COOKIE = 'pd_ff';
export const FEATURE_QUERY = 'pd_ff';

export const normalizeFeatureMode = (value?: string | null): FeatureMode => {
  const v = (value || '').trim().toLowerCase();
  if (v === 'on' || v === 'true' || v === '1') {
    return 'on';
  }
  if (v === 'optin' || v === 'opt-in') {
    return 'optin';
  }
  return 'off';
};

// the keys a pd_ff cookie (comma separated) opts into
export const parseFeatureCookie = (cookie?: string | null) =>
  new Set(
    (cookie || '')
      .split(',')
      .map((key) => key.trim())
      .filter((key): key is FeatureKey => key in FEATURE_FLAGS)
  );

export const resolveFeatureFlags = (
  env: Record<string, string | undefined>,
  cookie?: string | null
): FeatureFlags => {
  const optedIn = parseFeatureCookie(cookie);
  const flags: FeatureFlags = {};
  for (const key of Object.keys(FEATURE_FLAGS) as FeatureKey[]) {
    const mode = normalizeFeatureMode(env[FEATURE_FLAGS[key]]);
    flags[key] = mode === 'on' || (mode === 'optin' && optedIn.has(key));
  }
  return flags;
};

// the pd_ff cookie after a ?pd_ff= link: "off" clears it, otherwise the
// known keys in the link are added to the ones already there
export const nextFeatureCookie = (cookie: string | undefined, query: string) => {
  if (query.trim().toLowerCase() === 'off') {
    return '';
  }
  const keys = parseFeatureCookie(cookie);
  parseFeatureCookie(query).forEach((key) => keys.add(key));
  return [...keys].join(',');
};
