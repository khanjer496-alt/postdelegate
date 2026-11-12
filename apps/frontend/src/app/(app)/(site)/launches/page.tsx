export const dynamic = 'force-dynamic';
import { LaunchesComponent } from '@gitroom/frontend/components/launches/launches.component';
import { LaunchesComponentV2 } from '@gitroom/frontend/components/launches/v2/launches.v2.component';
import { isUiV2Request } from '@gitroom/frontend/components/new-layout/v2/ui.flag.server';
import { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'PostDelegate Calendar',
};
export default async function Index() {
  return (await isUiV2Request()) ? <LaunchesComponentV2 /> : <LaunchesComponent />;
}
