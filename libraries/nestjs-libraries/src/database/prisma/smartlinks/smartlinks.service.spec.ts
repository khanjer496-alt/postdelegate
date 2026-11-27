import {
  normalizeSlug,
  safeUrl,
  SmartLinksService,
  summarizeStats,
  validSlug,
} from './smartlinks.service';

const page = (overrides: Record<string, unknown> = {}) => ({
  id: 'page-1',
  organizationId: 'org-1',
  slug: 'acme',
  title: 'Acme',
  bio: null,
  avatarUrl: null,
  accentColor: null,
  published: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [
    { id: 'item-1', pageId: 'page-1', title: 'Shop', url: 'https://shop.acme.com/', imageUrl: null, position: 0, active: true },
  ],
  ...overrides,
});

const repository = (overrides: Record<string, unknown> = {}) => ({
  getPage: jest.fn().mockResolvedValue(page()),
  getPageBySlug: jest.fn().mockResolvedValue(page()),
  slugTaken: jest.fn().mockResolvedValue(false),
  upsertPage: jest.fn().mockResolvedValue({}),
  createItem: jest.fn().mockResolvedValue({}),
  updateItem: jest.fn().mockResolvedValue({ count: 1 }),
  deleteItem: jest.fn().mockResolvedValue({ count: 1 }),
  getStats: jest.fn().mockResolvedValue([]),
  increment: jest.fn().mockResolvedValue({}),
  ...overrides,
});

describe('SmartLinks', () => {
  it('normalizes and checks page addresses', () => {
    expect(normalizeSlug('  Acme Studio!! ')).toBe('acme-studio');
    expect(validSlug('acme-studio')).toBe(true);
    expect(validSlug('ab')).toBe(false);
    expect(validSlug('admin')).toBe(false);
    expect(validSlug('-acme')).toBe(false);
  });

  it('only keeps web links', () => {
    expect(safeUrl('acme.com/shop')).toBe('https://acme.com/shop');
    expect(safeUrl('http://acme.com')).toBe('http://acme.com/');
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('data:text/html,hi')).toBeNull();
    expect(safeUrl('localhost')).toBeNull();
    expect(safeUrl('')).toBeNull();
  });

  it('sums views, clicks and click rate per day and link', () => {
    const from = new Date('2026-11-01T00:00:00Z');
    const stats = summarizeStats(
      [
        { itemId: '', date: new Date('2026-11-01'), views: 10, clicks: 0 },
        { itemId: '', date: new Date('2026-11-02'), views: 10, clicks: 0 },
        { itemId: 'a', date: new Date('2026-11-02'), views: 0, clicks: 3 },
        { itemId: 'b', date: new Date('2026-11-02'), views: 0, clicks: 1 },
      ],
      from,
      3
    );
    expect(stats.views).toBe(20);
    expect(stats.clicks).toBe(4);
    expect(stats.ctr).toBe(20);
    expect(stats.byItem).toEqual({ a: 3, b: 1 });
    expect(stats.days).toEqual([
      { date: '2026-11-01', views: 10, clicks: 0 },
      { date: '2026-11-02', views: 10, clicks: 4 },
      { date: '2026-11-03', views: 0, clicks: 0 },
    ]);
    expect(summarizeStats([], from, 1).ctr).toBeNull();
  });

  it('refuses a taken or invalid address', async () => {
    const service = new SmartLinksService(repository({ slugTaken: jest.fn().mockResolvedValue(true) }) as any);
    await expect(service.savePage('org-1', { slug: 'acme', title: 'A' })).rejects.toThrow('taken');
    await expect(service.savePage('org-1', { slug: 'x', title: 'A' })).rejects.toThrow('3 to 40');
  });

  it('counts a click and returns the link; unpublished pages are not public', async () => {
    const repo = repository();
    const service = new SmartLinksService(repo as any);
    const now = new Date('2026-11-13T15:30:00Z');
    await expect(service.click('ACME', 'item-1', now)).resolves.toEqual({ ok: true });
    expect(repo.increment).toHaveBeenCalledWith('page-1', 'item-1', new Date('2026-11-13T00:00:00Z'), 'clicks');
    await expect(service.click('acme', 'other', now)).rejects.toThrow();

    const hidden = new SmartLinksService(
      repository({ getPageBySlug: jest.fn().mockResolvedValue(page({ published: false })) }) as any
    );
    await expect(hidden.publicPage('acme')).rejects.toThrow();
    await expect(hidden.recordView('acme')).rejects.toThrow();
  });

  it('public page lists only safe web links', async () => {
    const service = new SmartLinksService(
      repository({
        getPageBySlug: jest.fn().mockResolvedValue(
          page({
            items: [
              { id: 'item-1', title: 'Shop', url: 'https://shop.acme.com/', imageUrl: null, position: 0, active: true },
              { id: 'item-2', title: 'Bad', url: 'javascript:alert(1)', imageUrl: null, position: 1, active: true },
            ],
          })
        ),
      }) as any
    );
    const result = await service.publicPage('acme');
    expect(result.items).toEqual([{ id: 'item-1', title: 'Shop', imageUrl: null, url: 'https://shop.acme.com/' }]);
  });

  it('reorders only its own links', async () => {
    const repo = repository();
    const service = new SmartLinksService(repo as any);
    await service.reorder('org-1', ['foreign', 'item-1']);
    expect(repo.updateItem).toHaveBeenCalledTimes(1);
    expect(repo.updateItem).toHaveBeenCalledWith('page-1', 'item-1', { position: 0 });
  });
});
