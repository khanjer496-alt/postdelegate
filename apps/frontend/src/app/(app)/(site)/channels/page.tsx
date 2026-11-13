export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import { ChannelsComponentV2 } from '@gitroom/frontend/components/launches/v2/channels.v2.component';
import { isUiV2Request } from '@gitroom/frontend/components/new-layout/v2/ui.flag.server';
export const metadata: Metadata = {
  title: 'PostDelegate Channels',
};
// the classic layout keeps its channels in the calendar's side column
export default async function Index() {
  if (!(await isUiV2Request())) {
    redirect('/launches');
  }
  return <ChannelsComponentV2 />;
}
