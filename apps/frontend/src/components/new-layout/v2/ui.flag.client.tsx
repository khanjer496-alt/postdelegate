'use client';

import { FC, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { UI_FLAG_COOKIE, UI_FLAG_QUERY } from './ui.flag';

const ONE_YEAR = 60 * 60 * 24 * 365;

export const setUiLayoutCookie = (value: 'v1' | 'v2') => {
  document.cookie = `${UI_FLAG_COOKIE}=${value}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
};

// ?pd_ui=v2 (or v1) stores the choice in a cookie, drops the param and
// re-renders the server layout. Only mounted when PD_UI_V2 is not "off".
export const UiFlagQuerySync: FC = () => {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const value = params.get(UI_FLAG_QUERY);

  useEffect(() => {
    if (value !== 'v1' && value !== 'v2') {
      return;
    }
    setUiLayoutCookie(value);
    const next = new URLSearchParams(params.toString());
    next.delete(UI_FLAG_QUERY);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
    router.refresh();
  }, [value, params, pathname, router]);

  return null;
};
