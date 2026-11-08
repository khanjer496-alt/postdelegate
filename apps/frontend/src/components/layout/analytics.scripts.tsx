'use client';

import { FC, ReactNode } from 'react';
import Script from 'next/script';
import PlausibleProvider from 'next-plausible';
import { useConsent } from '@gitroom/helpers/consent/use.consent';
import { usePathname } from 'next/navigation';
import { isSensitiveTelemetryPath } from '@gitroom/helpers/utils/redact.url';

// Analytics scripts load only after the analytics choice in the cookie banner

export const DataFastScript: FC<{ websiteId?: string; domain: string }> = ({
  websiteId,
  domain,
}) => {
  const consent = useConsent();
  const sensitive = isSensitiveTelemetryPath(usePathname());
  if (sensitive || !websiteId || !consent?.analytics) {
    return null;
  }
  return (
    <Script
      data-website-id={websiteId}
      data-domain={domain}
      src="https://datafa.st/js/script.js"
      strategy="afterInteractive"
    />
  );
};

// The provider stays mounted so the app below it never remounts, only its
// script waits for consent
export const ConsentPlausible: FC<{ domain: string; children: ReactNode }> = ({
  domain,
  children,
}) => {
  const consent = useConsent();
  const sensitive = isSensitiveTelemetryPath(usePathname());
  return (
    <PlausibleProvider
      domain={domain}
      enabled={!sensitive && !!consent?.analytics && process.env.NODE_ENV === 'production'}
    >
      {children}
    </PlausibleProvider>
  );
};
