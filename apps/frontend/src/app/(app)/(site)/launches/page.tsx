export const dynamic = 'force-dynamic';
import { LaunchesComponent } from '@gitroom/frontend/components/launches/launches.component';
import { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'PostDelegate Calendar',
  description: '',
};
export default async function Index() {
  return <LaunchesComponent />;
}
