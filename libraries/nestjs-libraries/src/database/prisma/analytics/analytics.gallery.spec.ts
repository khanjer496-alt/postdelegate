// the service pulls in heavy provider modules that are not under test
jest.mock('@gitroom/nestjs-libraries/integrations/integration.manager', () => ({
  IntegrationManager: class {},
}));
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service',
  () => ({ IntegrationService: class {} })
);

import {
  AnalyticsService,
  csvCell,
  periodChange,
  toCsv,
} from '@gitroom/nestjs-libraries/database/prisma/analytics/analytics.service';

const channel = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `Channel ${id}`,
  customName: null as string | null,
  picture: null as string | null,
  providerIdentifier: 'x',
  type: 'social',
  disabled: false,
  refreshNeeded: false,
  inBetweenSteps: false,
  tokenExpiration: null as Date | null,
  ...overrides,
});

const snapshot = (integrationId: string, date: string, followers: number | null) => ({
  integrationId,
  date: new Date(`${date}T00:00:00Z`),
  followers,
  following: null as number | null,
  posts: null as number | null,
});

let seq = 0;
const post = (overrides: Record<string, any> = {}) => ({
  id: `ap-${++seq}`,
  integrationId: 'a',
  externalId: `ext-${seq}`,
  postId: null as string | null,
  publishedAt: new Date('2026-10-30T12:00:00Z'),
  title: 'A post',
  url: null as string | null,
  views: null as number | null,
  likes: null as number | null,
  comments: null as number | null,
  shares: null as number | null,
  clicks: null as number | null,
  ...overrides,
});

const makeService = () => {
  const repository = {
    getOverviewChannels: jest.fn().mockResolvedValue([]),
    getAccountSnapshots: jest.fn().mockResolvedValue([]),
    getAnalyticsPosts: jest.fn().mockResolvedValue([]),
    countPublished: jest.fn().mockResolvedValue(0),
    getPostsContent: jest.fn().mockResolvedValue([]),
    getDailyPostTotals: jest.fn().mockResolvedValue([]),
  };
  const integrationManager = {
    getSocialIntegration: jest.fn(() => ({ accountStats: jest.fn() })),
  };
  return {
    service: new AnalyticsService(
      repository as any,
      {} as any,
      integrationManager as any
    ),
    repository,
    integrationManager,
  };
};

describe('top posts gallery (v2 Analytics)', () => {
  const now = new Date('2026-11-01T00:00:00Z');

  it('adds the first picture, the media type and a short excerpt', async () => {
    const { service, repository } = makeService();
    repository.getOverviewChannels.mockResolvedValue([channel('a')]);
    repository.getAnalyticsPosts.mockResolvedValue([
      post({ postId: 'p1', likes: 50, publishedAt: new Date('2026-10-30T09:00:00Z') }),
      post({ postId: 'p2', likes: 10, publishedAt: new Date('2026-10-29T09:00:00Z') }),
      post({ postId: null, likes: 5, publishedAt: new Date('2026-10-28T09:00:00Z') }),
    ]);
    repository.getPostsContent.mockResolvedValue([
      {
        id: 'p1',
        content: '<p>' + 'Launch day '.repeat(20) + '</p>',
        image: JSON.stringify([
          { path: 'https://cdn.example.com/clip.mp4', thumbnail: 'https://cdn.example.com/clip.jpg' },
          { path: 'https://cdn.example.com/b.png' },
        ]),
        tags: [],
      },
      { id: 'p2', content: 'Just text', image: '[]', tags: [] },
    ]);

    const result = await service.getTopPostsGallery('org-A', 7, { limit: 12 }, now);

    expect(result.total).toBe(3);
    expect(result.posts.map((p) => p.postId)).toEqual(['p1', 'p2', null]);
    expect(result.posts[0].thumbnail).toBe('https://cdn.example.com/clip.jpg');
    expect(result.posts[0].mediaType).toBe('video');
    expect(result.posts[0].excerpt.length).toBeLessThanOrEqual(140);
    expect(result.posts[0].excerpt.endsWith('…')).toBe(true);
    expect(result.posts[1]).toMatchObject({ thumbnail: null, mediaType: 'text', excerpt: 'Just text' });
    expect(result.posts[2]).toMatchObject({ thumbnail: null, mediaType: 'text', excerpt: '' });
    expect(repository.getPostsContent).toHaveBeenCalledWith('org-A', ['p1', 'p2']);
  });

  it('caps the gallery at 24 posts', async () => {
    const { service, repository } = makeService();
    repository.getOverviewChannels.mockResolvedValue([channel('a')]);
    repository.getAnalyticsPosts.mockResolvedValue(
      Array.from({ length: 40 }, (_, i) => post({ likes: i + 1 }))
    );
    const result = await service.getTopPostsGallery('org-A', 30, { limit: 200 }, now);
    expect(result.posts).toHaveLength(24);
  });

  it('ignores media JSON it cannot read', () => {
    const { service } = makeService();
    expect(service.galleryMediaOf('not json')).toEqual({ thumbnail: null, type: 'text' });
    expect(service.galleryMediaOf(JSON.stringify([{ path: 'javascript:alert(1)' }])).thumbnail).toBeNull();
    expect(service.galleryMediaOf(JSON.stringify([{ path: '/uploads/a.jpg' }]))).toEqual({
      thumbnail: '/uploads/a.jpg',
      type: 'image',
    });
  });
});
