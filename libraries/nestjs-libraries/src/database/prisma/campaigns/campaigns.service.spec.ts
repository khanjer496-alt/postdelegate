import { CampaignsService } from './campaigns.service';

const post = (id: string, tagIds: string[], state = 'PUBLISHED', integration = 'i1', date = '2026-11-01T10:00:00Z') => ({
  id,
  content: '<p>Hello <b>world</b> &amp; friends</p>',
  publishDate: new Date(date),
  state,
  releaseURL: state === 'PUBLISHED' ? 'https://x.com/p/1' : null,
  group: `g-${id}`,
  integration: { id: integration, name: `Channel ${integration}`, picture: null, providerIdentifier: 'x' },
  tags: tagIds.map((tagId) => ({ tagId })),
});

const setup = () => {
  const repository = {
    getTags: jest.fn().mockResolvedValue([
      { id: 'c1', name: 'Black Friday', color: '#f00', kind: 'CAMPAIGN', description: null },
      { id: 'c2', name: 'Launch', color: '#0f0', kind: 'CAMPAIGN', description: 'v2 launch' },
    ]),
    getTaggedPosts: jest.fn().mockResolvedValue([
      post('p1', ['c1']),
      post('p2', ['c1', 'c2'], 'QUEUE', 'i2', '2026-11-20T10:00:00Z'),
      post('p3', ['c2'], 'ERROR'),
    ]),
    getMetrics: jest.fn().mockResolvedValue([
      { postId: 'p1', views: 100, likes: 10, comments: 2, shares: 1, clicks: null },
      { postId: 'p3', views: null, likes: null, comments: null, shares: null, clicks: null },
    ]),
  };
  return { repository, service: new CampaignsService(repository as any) };
};

describe('CampaignsService', () => {
  const now = new Date('2026-11-13T00:00:00Z');

  it('lists campaigns with their totals, busiest first', async () => {
    const { service, repository } = setup();
    const result = await service.list('org-A', 30, false, now);
    expect(repository.getTags).toHaveBeenCalledWith('org-A', ['CAMPAIGN']);
    expect(repository.getTaggedPosts.mock.calls[0][1]).toEqual(['c1', 'c2']);
    const bf = result.campaigns.find((c) => c.id === 'c1')!;
    expect(bf.totals).toMatchObject({
      posts: 2,
      published: 1,
      scheduled: 1,
      failed: 0,
      channels: 2,
      views: 100,
      engagement: 13,
      clicks: null,
    });
    expect(bf.firstPost).toBe('2026-11-01T10:00:00.000Z');
    expect(bf.lastPost).toBe('2026-11-20T10:00:00.000Z');
    const launch = result.campaigns.find((c) => c.id === 'c2')!;
    expect(launch.totals).toMatchObject({ posts: 2, failed: 1, views: null, engagement: null });
  });

  it('can include plain tags and pillars', async () => {
    const { service, repository } = setup();
    await service.list('org-A', 30, true, now);
    expect(repository.getTags).toHaveBeenCalledWith('org-A', ['CAMPAIGN', 'PILLAR', 'TAG']);
  });

  it('spans the past and the scheduled future', () => {
    const { service } = setup();
    const { from, to } = service.range(7, now);
    expect(from.toISOString()).toBe('2026-11-06T00:00:00.000Z');
    expect(to.toISOString()).toBe('2026-11-20T00:00:00.000Z');
  });

  it('details one campaign with channels and plain-text posts', async () => {
    const { service, repository } = setup();
    repository.getTaggedPosts.mockResolvedValue([post('p1', ['c1']), post('p2', ['c1'], 'QUEUE', 'i2')]);
    const result = await service.detail('org-A', 'c1', 30, now);
    expect(result?.campaign.name).toBe('Black Friday');
    expect(result?.channels.map((c) => c.id)).toEqual(['i1', 'i2']);
    expect(result?.posts[0]).toMatchObject({ excerpt: 'Hello world & friends', url: 'https://x.com/p/1', views: 100 });
    expect(result?.posts[1].url).toBeNull();
  });

  it('returns null for a tag of another workspace', async () => {
    const { service } = setup();
    expect(await service.detail('org-A', 'nope', 30, now)).toBeNull();
  });
});
