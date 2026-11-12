'use client';

import { FC } from 'react';
import Link from 'next/link';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useRenewal, trialDaysLeft } from '@gitroom/frontend/components/billing/trial.banner';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Icon } from './icons.v2';

// the top bar's trial reminder, a quiet pill instead of a banner
export const TrialPillV2: FC = () => {
  const t = useT();
  const { billingEnabled } = useVariables();
  const { data: renewal } = useRenewal();
  if (!billingEnabled || !renewal?.trialing || !renewal.renewsAt) {
    return null;
  }
  const days = trialDaysLeft(renewal.renewsAt);
  return (
    <Link
      href="/billing"
      className="flex items-center gap-[6px] h-[32px] px-[10px] rounded-[8px] bg-pdSurface border border-pdLine text-[12px] font-[600] text-newTextColor whitespace-nowrap hover:border-pdLine2"
    >
      <Icon name="hourglass" size={14} className="text-[#b39aff]" />
      {days === 0
        ? t('trial_countdown_today', 'Your trial ends today')
        : t('trial_days_left_short', 'Trial · {{days}} days left', { days })}
    </Link>
  );
};
