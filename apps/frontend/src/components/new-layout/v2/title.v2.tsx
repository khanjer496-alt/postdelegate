'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { useMenuItem } from '@gitroom/frontend/components/layout/top.menu';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

// page title plus a one-line hint under it
export const TitleV2 = () => {
  const path = usePathname();
  const t = useT();
  const { all: menuItems } = useMenuItem();
  const { title, subtitle } = useMemo(() => {
    if (path.startsWith('/channels')) {
      return {
        title: t('channels', 'Channels'),
        subtitle: t('channels_subtitle', 'Connected accounts, grouped by customer'),
      };
    }
    const name = menuItems.find((item) => path.indexOf(item.path) > -1)?.name;
    const subtitles: Record<string, string> = {
      '/launches': t('calendar_subtitle', 'Plan, review and schedule every channel'),
    };
    const key = Object.keys(subtitles).find((k) => path.startsWith(k));
    return { title: name, subtitle: key ? subtitles[key] : '' };
  }, [path, menuItems, t]);

  return (
    <div className="min-w-0 flex flex-col justify-center">
      <h1 className="truncate leading-[1.3]">{title}</h1>
      {!!subtitle && (
        <div className="text-[11.5px] font-[500] tracking-normal text-pdInk3 truncate mobile:hidden">
          {subtitle}
        </div>
      )}
    </div>
  );
};
