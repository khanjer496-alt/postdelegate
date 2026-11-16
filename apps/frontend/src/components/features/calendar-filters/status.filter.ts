// Status chips of the v2 calendar and the feed grid (PD_FF_CALENDAR_FILTERS)

export type StatusFilter = 'all' | 'scheduled' | 'review' | 'draft' | 'published' | 'failed';
export const STATUS_FILTERS: StatusFilter[] = ['all', 'scheduled', 'review', 'draft', 'published', 'failed'];

// the same buckets the v2 cards are colored by (calendar.tsx pdStatus)
export const statusOf = (post: { state?: string; approvalStatus?: string | null }) =>
  post.state === 'ERROR'
    ? 'failed'
    : post.state === 'PUBLISHED'
    ? 'published'
    : post.state === 'DRAFT' &&
      (post.approvalStatus === 'IN_REVIEW' || post.approvalStatus === 'CHANGES_REQUESTED')
    ? 'review'
    : post.state === 'DRAFT'
    ? 'draft'
    : 'scheduled';

export const filterByStatus = <T extends { state?: string; approvalStatus?: string | null }>(
  posts: T[],
  status: StatusFilter
) => (status === 'all' ? posts : posts.filter((post) => statusOf(post) === status));

export const countByStatus = (posts: Array<{ state?: string; approvalStatus?: string | null }>) => {
  const counts: Record<StatusFilter, number> = {
    all: posts.length,
    scheduled: 0,
    review: 0,
    draft: 0,
    published: 0,
    failed: 0,
  };
  for (const post of posts) {
    counts[statusOf(post)]++;
  }
  return counts;
};

// networks whose profile is a grid of pictures or videos
export const VISUAL_NETWORKS = [
  'instagram',
  'instagram-standalone',
  'pinterest',
  'tiktok',
  'youtube',
  'threads',
];

export const isVisualNetwork = (identifier?: string) =>
  !!identifier && VISUAL_NETWORKS.includes(identifier);

// the first picture of a post's media JSON (videos show their thumbnail)
export const firstPicture = (image?: string | null) => {
  try {
    const media = JSON.parse(image || '[]');
    if (!Array.isArray(media)) return null;
    for (const item of media) {
      const path: string = item?.thumbnail || item?.path || '';
      if (/^(https?:\/\/|\/)/i.test(path)) {
        return { path, video: /\.(mp4|mov|webm|m4v)(\?|$)/i.test(item?.path || '') && !item?.thumbnail };
      }
    }
  } catch {
    return null;
  }
  return null;
};

// the feed as followers will see it: newest first, upcoming posts on top,
// failed and draft posts left out unless asked for
export const feedOrder = <T extends { publishDate: string; state?: string }>(
  posts: T[],
  includeDrafts = false
) =>
  posts
    .filter((post) => post.state !== 'ERROR' && (includeDrafts || post.state !== 'DRAFT'))
    .sort((a, b) => new Date(b.publishDate).valueOf() - new Date(a.publishDate).valueOf());
