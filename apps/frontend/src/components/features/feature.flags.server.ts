import { cookies } from 'next/headers';
import { FEATURE_COOKIE, resolveFeatureFlags } from './feature.flags';

// the parity feature flags for this request (see feature.flags.ts)
export const readFeatureFlags = async () =>
  resolveFeatureFlags(
    process.env,
    (await cookies()).get(FEATURE_COOKIE)?.value
  );
