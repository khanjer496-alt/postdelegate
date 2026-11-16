'use client';

import { createContext, FC, ReactNode, useContext } from 'react';
import type { FeatureFlags, FeatureKey } from './feature.flags';

const FeatureFlagsContext = createContext<FeatureFlags>({});

export const FeatureFlagsProvider: FC<{
  flags: FeatureFlags;
  children: ReactNode;
}> = ({ flags, children }) => (
  <FeatureFlagsContext.Provider value={flags}>
    {children}
  </FeatureFlagsContext.Provider>
);

// true when the parity feature is on for this request
export const useFeature = (key: FeatureKey) =>
  !!useContext(FeatureFlagsContext)[key];
