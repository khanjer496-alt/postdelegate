import 'reflect-metadata';
import { InstagramStandaloneProvider } from './instagram.standalone.provider';
import { InstagramProvider } from './instagram.provider';

describe('Instagram Login account insights', () => {
  const provider = new InstagramStandaloneProvider();
  const originalFetch = global.fetch;
  const request = jest.fn();
  const result = (data: unknown, ok = true) => ({
    ok,
    json: async () => data,
  });

  beforeEach(() => {
    request.mockReset();
    global.fetch = request;
  });
  afterEach(() => { global.fetch = originalFetch; });

  it('requests documented day totals independently of follower insight availability', async () => {
    request.mockResolvedValue(result({ data: [
      { name: 'reach', total_value: { value: 12 } },
      { name: 'views', total_value: { value: 30 } },
      { name: 'total_interactions', total_value: { value: 4 } },
    ] }));
    const data = await provider.analytics('synthetic-id', 'SYNTHETIC_TOKEN', 7);
    expect(request).toHaveBeenCalledTimes(1);
    const url = new URL(request.mock.calls[0][0]);
    expect(url.hostname).toBe('graph.instagram.com');
    expect(url.searchParams.get('period')).toBe('day');
    expect(url.searchParams.get('metric_type')).toBe('total_value');
    expect(url.searchParams.get('metric')?.split(',')).toEqual([
      'reach', 'views', 'likes', 'comments', 'shares', 'saves', 'total_interactions', 'replies',
    ]);
    expect(Number(url.searchParams.get('until'))).toBeGreaterThan(Number(url.searchParams.get('since')));
    expect(data.map((x) => [x.label, x.data[0].total])).toEqual([
      ['Reach', 12], ['Views', 30], ['Total Interactions', 4],
    ]);
    expect(data.every((x) => x.percentageChange === undefined)).toBe(true);
  });

  it('keeps actual zero and partial results without inventing missing metrics', async () => {
    request.mockResolvedValue(result({ data: [
      { name: 'likes', total_value: { value: 0 } },
      { name: 'saves', total_value: {} },
      { name: 'unknown', total_value: { value: 100 } },
    ] }));
    expect(await provider.analytics('synthetic-id', 'SYNTHETIC_TOKEN', 30))
      .toEqual([{ label: 'Likes', data: [{ total: 0, date: expect.any(String) }] }]);
  });

  it('reserves an empty list for a successful empty dataset', async () => {
    request.mockResolvedValue(result({ data: [] }));
    expect(await provider.analytics('synthetic-id', 'SYNTHETIC_TOKEN', 7)).toEqual([]);
  });

  it.each([
    [false, { error: { code: 100, message: 'unsupported metric SYNTHETIC_SECRET' } }],
    [true, { error: { code: 100, message: 'unsupported metric SYNTHETIC_SECRET' } }],
    [false, { data: [] }],
    [true, {}],
    [true, { data: {} }],
    [true, { data: [{ name: 'likes', total_value: { value: 'bad' } }] }],
  ])('curates HTTP/Graph/schema failure without exposing the response (%s)', async (ok, body) => {
    request.mockResolvedValue(result(body, ok));
    await expect(provider.analytics('synthetic-id', 'SYNTHETIC_TOKEN', 7))
      .rejects.toThrow('Analytics are temporarily unavailable. Try again later.');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each(['network', 'json'])('curates %s failures without carrying a URL, token or body', async (failure) => {
    if (failure === 'network') request.mockRejectedValue(new Error('SYNTHETIC_SECRET'));
    else request.mockResolvedValue({ ok: true, json: async () => { throw new Error('SYNTHETIC_SECRET'); } });
    await expect(provider.analytics('synthetic-id', 'SYNTHETIC_TOKEN', 7))
      .rejects.toThrow(/^Analytics are temporarily unavailable\. Try again later\.$/);
  });

  it('preserves the separate current follower summary', async () => {
    request.mockResolvedValue(result({ followers_count: 42, follows_count: 3, media_count: 2 }));
    expect(await provider.accountStats('synthetic-id', 'SYNTHETIC_TOKEN')).toEqual({
      followers: 42, following: 3, posts: 2,
    });
    expect(new URL(request.mock.calls[0][0]).searchParams.get('fields'))
      .toBe('followers_count,follows_count,media_count');
  });

  it('leaves the Facebook Login metric requests and follower series intact', async () => {
    request.mockResolvedValueOnce(result({ data: [
      { name: 'follower_count', values: [{ value: 2, end_time: '2026-11-08T00:00:00Z' }] },
    ] })).mockResolvedValueOnce(result({ data: [] }));
    const data = await new InstagramProvider().analytics('synthetic-id', 'SYNTHETIC_TOKEN', 7);
    expect(new URL(request.mock.calls[0][0]).hostname).toBe('graph.facebook.com');
    expect(new URL(request.mock.calls[0][0]).searchParams.get('metric')).toBe('follower_count,reach');
    expect(data[0].label).toBe('Follower Count');
    expect(data[0].data[0].total).toBe(2);
  });
});
