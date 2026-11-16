'use client';

import { FC, useCallback } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import {
  FreePlanUsage,
  freePlanState,
} from '@gitroom/frontend/components/features/free-plan/free.plan';

// A thin line above the app for a workspace on the free plan
// (PD_FF_FREE_PLAN): what is left this month and a way to upgrade.
export const FreePlanBanner: FC = () => {
  const t = useT();
  const fetch = useFetch();
  const load = useCallback(async (path: string) => {
    const response = await fetch(path);
    return response.ok ? ((await response.json()) as FreePlanUsage) : null;
  }, []);
  const { data } = useSWR('/user/free-plan', load, { revalidateOnFocus: true });
  const state = freePlanState(data);
  if (!state) {
    return null;
  }
  return (
    <div
      role="status"
      className={clsx(
        'flex flex-wrap items-center gap-x-[14px] gap-y-[4px] px-[16px] py-[7px] text-[12.5px] border-b',
        state.tone === 'limit'
          ? 'bg-[#ff5a5f1a] border-[#ff5a5f55]'
          : state.tone === 'low'
          ? 'bg-[#ffb5471a] border-[#ffb54755]'
          : 'bg-pdSurface border-pdLine'
      )}
    >
      <span className="inline-flex items-center h-[20px] px-[8px] rounded-full bg-[#c8ff4d] text-[#0b0f05] text-[11px] font-[800]">
        {t('free_plan_badge', 'Free plan')}
      </span>
      <span className="tabular-nums">
        {t('free_plan_posts', '{{used}} of {{limit}} posts this month', {
          used: state.posts,
          limit: state.postsLimit,
        })}
      </span>
      <span className="tabular-nums text-pdInk3">
        {t('free_plan_channels', '{{used}} of {{limit}} channels', {
          used: state.channels,
          limit: state.channelsLimit,
        })}
      </span>
      <span className="flex-1" />
      <Link
        href="/billing"
        className="font-[700] text-[#b39aff] hover:underline"
      >
        {state.tone === 'limit'
          ? t('free_plan_upgrade_limit', 'Limit reached, upgrade to keep posting')
          : t('free_plan_upgrade', 'Upgrade for more')}
      </Link>
    </div>
  );
};
