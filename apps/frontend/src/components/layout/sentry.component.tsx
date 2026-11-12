'use client';

import { FC, ReactNode, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { initializeSentryClient } from '@gitroom/react/sentry/initialize.sentry.client';

export const SentryComponent: FC<{ children: ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const { sentryDsn: dsn, environment } = useVariables();

  useEffect(() => {
    if (!dsn) {
      return;
    }

    initializeSentryClient(environment, dsn);
  }, [dsn, environment, pathname]);

  // Always render children - don't block the app
  return <>{children}</>;
};
