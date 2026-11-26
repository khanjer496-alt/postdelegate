export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CommentsV2 } from '@gitroom/frontend/components/features/comments/comments.v2';
import { isUiV2Request } from '@gitroom/frontend/components/new-layout/v2/ui.flag.server';
import { readFeatureFlags } from '@gitroom/frontend/components/features/feature.flags.server';

export const metadata: Metadata = {
  title: 'PostDelegate Comments',
};

// comments of a channel's posts, replies and keyword auto-replies
// (PD_FF_COMMENTS, v2 layout only)
export default async function Page() {
  if (!(await isUiV2Request()) || !(await readFeatureFlags()).comments) {
    notFound();
  }
  return <CommentsV2 />;
}
