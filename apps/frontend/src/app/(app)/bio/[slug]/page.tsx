export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { internalFetch } from '@gitroom/helpers/utils/internal.fetch';
import { SmartLinkPublic } from '@gitroom/frontend/components/features/smartlinks/smartlink.public';
import { PublicSmartLinkPage } from '@gitroom/frontend/components/features/smartlinks/smartlinks.types';

// The public link-in-bio page (PD_FF_SMARTLINKS). The backend answers 404
// when the flag is off or the page is not published.
const load = async (slug: string): Promise<PublicSmartLinkPage | null> => {
  if (!/^[a-z0-9-]{3,40}$/i.test(slug)) {
    return null;
  }
  try {
    const response = await internalFetch(`/public/smartlinks/${encodeURIComponent(slug)}`);
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
};

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const page = await load(slug);
  if (!page) {
    return { title: 'Page not found', robots: { index: false } };
  }
  return {
    title: page.title,
    description: page.bio || `Links from ${page.title}`,
    openGraph: {
      title: page.title,
      description: page.bio || `Links from ${page.title}`,
      ...(page.avatarUrl ? { images: [page.avatarUrl] } : {}),
    },
  };
}

export default async function BioPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const page = await load(slug);
  if (!page) {
    notFound();
  }
  return <SmartLinkPublic page={page} />;
}
