export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SmartLinksV2 } from '@gitroom/frontend/components/features/smartlinks/smartlinks.v2';
import { isUiV2Request } from '@gitroom/frontend/components/new-layout/v2/ui.flag.server';
import { readFeatureFlags } from '@gitroom/frontend/components/features/feature.flags.server';

export const metadata: Metadata = {
  title: 'PostDelegate SmartLinks',
};

// link-in-bio page editor and click stats (PD_FF_SMARTLINKS, v2 layout only)
export default async function Page() {
  if (!(await isUiV2Request()) || !(await readFeatureFlags()).smartlinks) {
    notFound();
  }
  return <SmartLinksV2 />;
}
