export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { PlatformAnalytics } from '@gitroom/frontend/components/platform-analytics/platform.analytics';
import { AnalyticsOverview } from '@gitroom/frontend/components/platform-analytics/analytics.overview';
import { AnalyticsV2 } from '@gitroom/frontend/components/features/analytics-v2/analytics.v2';
import { isUiV2Request } from '@gitroom/frontend/components/new-layout/v2/ui.flag.server';
import { readFeatureFlags } from '@gitroom/frontend/components/features/feature.flags.server';
export const metadata: Metadata = {
  title: `PostDelegate Analytics`,
};
export default async function Index() {
  // the v2 dashboard (PD_FF_ANALYTICS_V2) needs the v2 layout
  if ((await isUiV2Request()) && (await readFeatureFlags()).analytics_v2) {
    return <AnalyticsV2 />;
  }
  return (
    <div className="flex flex-1 min-w-0 flex-col gap-[1px]">
      <AnalyticsOverview />
      <div className="flex flex-1 min-w-0 gap-[1px] mobile:flex-col">
        <PlatformAnalytics />
      </div>
    </div>
  );
}
