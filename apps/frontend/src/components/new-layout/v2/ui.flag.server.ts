import { cookies } from 'next/headers';
import {
  normalizeUiFlagMode,
  resolveUiV2,
  UI_FLAG_COOKIE,
  UI_FLAG_ENV,
} from './ui.flag';

// true when this request should get the v2 layout (see ui.flag.ts)
export const isUiV2Request = async () => {
  const mode = normalizeUiFlagMode(process.env[UI_FLAG_ENV]);
  if (mode === 'off') {
    return false;
  }
  return resolveUiV2(mode, (await cookies()).get(UI_FLAG_COOKIE)?.value);
};
