export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CampaignsV2 } from '@gitroom/frontend/components/features/campaigns/campaigns.v2';
import { isUiV2Request } from '@gitroom/frontend/components/new-layout/v2/ui.flag.server';
import { readFeatureFlags } from '@gitroom/frontend/components/features/feature.flags.server';

export const metadata: Metadata = {
  title: 'PostDelegate Campaigns',
};

// campaign dashboards from post tags (PD_FF_CAMPAIGNS, v2 layout only)
export default async function Page() {
  if (!(await isUiV2Request()) || !(await readFeatureFlags()).campaigns) {
    notFound();
  }
  return <CampaignsV2 />;
}
