import { dashboardInsights } from './analytics.v2.logic';

const group = (key: string, score: number | null, posts = 3) => ({
  key,
  label: key,
  posts,
  score,
});

describe('v2 analytics insights', () => {
  it('is empty without data', () => {
    expect(dashboardInsights(undefined, undefined)).toEqual([]);
    expect(
      dashboardInsights(
        { posts: 0, contentTypes: [], lengths: [], hashtags: [], tags: [] },
        { basis: 'publish_count', bestDays: [{ weekday: 2, score: 3, posts: 9 }], bestHours: [] }
      )
    ).toEqual([]);
  });

  it('keeps the best group of each kind that beats a typical post', () => {
    const result = dashboardInsights(
      {
        posts: 30,
        contentTypes: [group('image', 1.2), group('carousel', 1.9), group('video', 4, 1)],
        lengths: [group('short', 0.8)],
        hashtags: [group('launch', 1.4)],
        tags: [],
      },
      {
        basis: 'engagement',
        bestDays: [{ weekday: 2, score: 1.6, posts: 5 }],
        bestHours: [{ hour: 9, score: 0.9, posts: 5 }],
      }
    );
    expect(result.map((r) => [r.kind, r.key])).toEqual([
      ['content_type', 'carousel'],
      ['day', 2],
      ['hashtag', 'launch'],
    ]);
  });

  it('caps the list', () => {
    const result = dashboardInsights(
      {
        posts: 30,
        contentTypes: [group('image', 2)],
        lengths: [group('short', 2)],
        hashtags: [group('a', 2)],
        tags: [group('t', 2)],
      },
      { basis: 'engagement', bestDays: [{ weekday: 1, score: 2, posts: 3 }], bestHours: [] },
      3
    );
    expect(result).toHaveLength(3);
  });
});
