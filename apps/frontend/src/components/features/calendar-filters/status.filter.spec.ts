import {
  countByStatus,
  feedOrder,
  filterByStatus,
  firstPicture,
  isVisualNetwork,
  statusOf,
} from './status.filter';

const p = (state: string, approvalStatus: string | null = null, publishDate = '2026-11-10T10:00:00Z') => ({
  state,
  approvalStatus,
  publishDate,
});

describe('calendar status chips', () => {
  it('buckets posts like the v2 cards', () => {
    expect(statusOf(p('QUEUE'))).toBe('scheduled');
    expect(statusOf(p('QUEUE', 'APPROVED'))).toBe('scheduled');
    expect(statusOf(p('DRAFT', 'IN_REVIEW'))).toBe('review');
    expect(statusOf(p('DRAFT', 'CHANGES_REQUESTED'))).toBe('review');
    expect(statusOf(p('DRAFT'))).toBe('draft');
    expect(statusOf(p('PUBLISHED'))).toBe('published');
    expect(statusOf(p('ERROR'))).toBe('failed');
  });
  it('filters and counts', () => {
    const posts = [p('QUEUE'), p('DRAFT'), p('DRAFT', 'IN_REVIEW'), p('ERROR'), p('QUEUE')];
    expect(filterByStatus(posts, 'all')).toHaveLength(5);
    expect(filterByStatus(posts, 'scheduled')).toHaveLength(2);
    expect(countByStatus(posts)).toEqual({ all: 5, scheduled: 2, review: 1, draft: 1, published: 0, failed: 1 });
  });
});

describe('feed grid', () => {
  it('knows the visual networks', () => {
    expect(isVisualNetwork('instagram')).toBe(true);
    expect(isVisualNetwork('x')).toBe(false);
    expect(isVisualNetwork(undefined)).toBe(false);
  });
  it('reads the first picture safely', () => {
    expect(firstPicture(JSON.stringify([{ path: 'https://a/b.jpg' }]))).toEqual({ path: 'https://a/b.jpg', video: false });
    expect(firstPicture(JSON.stringify([{ path: 'https://a/v.mp4' }]))).toEqual({ path: 'https://a/v.mp4', video: true });
    expect(firstPicture(JSON.stringify([{ path: 'https://a/v.mp4', thumbnail: 'https://a/t.jpg' }]))?.path).toBe('https://a/t.jpg');
    expect(firstPicture(JSON.stringify([{ path: 'javascript:x' }]))).toBeNull();
    expect(firstPicture('oops')).toBeNull();
  });
  it('orders the feed newest first without failed posts', () => {
    const posts = [
      p('PUBLISHED', null, '2026-11-01T00:00:00Z'),
      p('QUEUE', null, '2026-11-20T00:00:00Z'),
      p('ERROR', null, '2026-11-15T00:00:00Z'),
      p('DRAFT', null, '2026-11-25T00:00:00Z'),
    ];
    expect(feedOrder(posts).map((x) => x.publishDate)).toEqual(['2026-11-20T00:00:00Z', '2026-11-01T00:00:00Z']);
    expect(feedOrder(posts, true)).toHaveLength(3);
  });
});
