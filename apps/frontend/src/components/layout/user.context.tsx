'use client';

import { createContext, FC, ReactNode, useContext } from 'react';
import { User } from '@prisma/client';
import {
  FREE_PLAN_LIMITS,
  pricing,
  PricingInnerInterface,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';
export const UserContext = createContext<
  | undefined
  | (User & {
      orgId: string;
      tier: PricingInnerInterface;
      aiAvailable: boolean;
      publicApi: string;
      role: 'USER' | 'ADMIN' | 'SUPERADMIN';
      totalChannels: number;
      isLifetime?: boolean;
      impersonate: boolean;
      allowTrial: boolean;
      isTrailing: boolean;
      streakSince: string | null;
      // PD_FF_FREE_PLAN: no plan, the free plan's limits apply
      freePlan?: boolean;
    })
>(undefined);
export const ContextWrapper: FC<{
  user: User & {
    orgId: string;
    tier: 'FREE' | 'STANDARD' | 'PRO' | 'ULTIMATE' | 'TEAM';
    role: 'USER' | 'ADMIN' | 'SUPERADMIN';
    publicApi: string;
    totalChannels: number;
    freePlan?: boolean;
  };
  children: ReactNode;
}> = ({ user, children }) => {
  const values = user
    ? {
        ...user,
        tier: user.freePlan
          ? {
              ...pricing.FREE,
              channel: FREE_PLAN_LIMITS.channel,
              posts_per_month: FREE_PLAN_LIMITS.posts_per_month,
            }
          : pricing[user.tier],
      }
    : ({} as any);
  return <UserContext.Provider value={values}>{children}</UserContext.Provider>;
};
export const useUser = () => useContext(UserContext);
