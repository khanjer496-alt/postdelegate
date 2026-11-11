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
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('keeps the two production requests and shows a finite total_value', async () => {
    request
      .mockResolvedValueOnce(
        result({
          data: [
            { name: 'reach', period: 'day', total_value: { value: 12 } },
            { name: 'follower_count', period: 'day', values: [] },
          ],
        })
      )
      .mockResolvedValueOnce(
        result({
          data: [
            { name: 'views', total_value: { value: 30 } },
            { name: 'likes', total_value: { value: 0 } },
            { name: 'saves', total_value: {} },
          ],
        })
      );
    const data = await provider.analytics('synthetic-id', 'SYNTHETIC_TOKEN___extra', 7);
    expect(request).toHaveBeenCalledTimes(2);
    const first = new URL(request.mock.calls[0][0]);
    const second = new URL(request.mock.calls[1][0]);
    expect(first.hostname).toBe('graph.instagram.com');
    expect(second.hostname).toBe('graph.instagram.com');
    expect(first.pathname).toContain('/v25.0/');
    expect(first.searchParams.get('metric')).toBe('follower_count,reach');
    expect(first.searchParams.get('metric_type')).toBeNull();
    expect(first.searchParams.get('period')).toBe('day');
    expect(second.searchParams.get('metric_type')).toBe('total_value');
    expect(second.searchParams.get('metric')).toBe(
      'likes,views,comments,shares,saves,replies'
    );
    expect(Number(first.searchParams.get('until'))).toBeGreaterThan(
      Number(first.searchParams.get('since'))
    );
    expect(data.map((x) => [x.label, x.data[0].total])).toEqual([
      ['Reach', '12'],
      ['Views', '30'],
      ['Likes', '0'],
    ]);
    expect(JSON.stringify(data)).not.toContain('SYNTHETIC_TOKEN');
    expect(JSON.stringify(data)).not.toContain('synthetic-id');
  });

  it('uses a finite total when the daily series is only zeros', async () => {
    request
      .mockResolvedValueOnce(
        result({
          data: [
            {
              name: 'reach',
              values: [
                { value: 0, end_time: '2026-11-08T00:00:00Z' },
                { value: 0, end_time: '2026-11-09T00:00:00Z' },
              ],
              total_value: { value: 12 },
            },
          ],
        })
      )
      .mockResolvedValueOnce(result({ data: [] }));
    const data = await provider.analytics('synthetic-id', 'SYNTHETIC_TOKEN', 7);
    expect(data).toEqual([
      {
        label: 'Reach',
        percentageChange: 0,
        data: [{ total: '12', date: expect.any(String) }],
      },
    ]);
  });

  it('never claims a trend it did not measure on a total card or a series card', async () => {
    request
      .mockResolvedValueOnce(
        result({
          data: [
            {
              name: 'reach',
              values: [{ value: 3, end_time: '2026-11-08T08:00:00+0000' }],
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        result({ data: [{ name: 'views', total_value: { value: 30 } }] })
      );
    const data = await provider.analytics('synthetic-id', 'SYNTHETIC_TOKEN', 7);
    expect(data.map((x) => x.label)).toEqual(['Reach', 'Views']);
    data.forEach((card) => expect(card.percentageChange).toBe(0));
  });

  it('keeps a real daily series and a returned total from the other request', async () => {
    request
      .mockResolvedValueOnce(
        result({
          data: [
            {
              name: 'follower_count',
              values: [{ value: 2, end_time: '2026-11-08T00:00:00Z' }],
            },
            {
              name: 'reach',
              values: [
                { value: 2, end_time: '2026-11-08T00:00:00Z' },
                { value: 3, end_time: '2026-11-09T00:00:00Z' },
              ],
              total_value: { value: 9 },
            },
          ],
        })
      )
      .mockRejectedValueOnce(new Error('SYNTHETIC_SECRET'));
    const data = await provider.analytics('synthetic-id', 'SYNTHETIC_TOKEN', 7);
    expect(data.map((x) => [x.label, x.data.map((point) => point.total)])).toEqual([
      ['Follower Count', ['2']],
      ['Reach', ['2', '3']],
    ]);
    expect(JSON.stringify(data)).not.toContain('SYNTHETIC_SECRET');
  });

  it('reserves an empty list for a successful empty dataset', async () => {
    request.mockResolvedValue(result({ data: [] }));
    expect(
      await provider.analytics('synthetic-id', 'SYNTHETIC_TOKEN', 7)
    ).toEqual([]);
  });

  it.each([
    [
      false,
      { error: { code: 100, message: 'unsupported metric SYNTHETIC_SECRET' } },
    ],
    [
      true,
      { error: { code: 100, message: 'unsupported metric SYNTHETIC_SECRET' } },
    ],
    [false, { data: [] }],
    [true, {}],
    [true, { data: {} }],
  ])(
    'curates a failed insights read without exposing the response (%s)',
    async (ok, body) => {
      request.mockResolvedValue(result(body, ok));
      await expect(
        provider.analytics('synthetic-id', 'SYNTHETIC_TOKEN', 7)
      ).rejects.toThrow(
        /^Analytics are temporarily unavailable\. Try again later\.$/
      );
      expect(request).toHaveBeenCalledTimes(2);
    }
  );

  it('omits a non-numeric total instead of showing it or failing the other total', async () => {
    request
      .mockResolvedValueOnce(
        result({
          data: [{ name: 'likes', total_value: { value: 'bad' } }, null],
        })
      )
      .mockResolvedValueOnce(
        result({ data: [{ name: 'views', total_value: { value: 12 } }] })
      );
    const data = await provider.analytics('synthetic-id', 'SYNTHETIC_TOKEN', 7);
    expect(data.map((x) => [x.label, x.data[0].total])).toEqual([['Views', '12']]);
    expect(JSON.stringify(data)).not.toContain('bad');
  });

  it('marks a result partial when one of the two requests fails', async () => {
    const { isPartialAnalytics } = require('@gitroom/nestjs-libraries/integrations/social.abstract');
    request
      .mockResolvedValueOnce(
        result({
          data: [
            {
              name: 'reach',
              values: [{ value: 3, end_time: '2026-11-08T08:00:00+0000' }],
            },
          ],
        })
      )
      .mockResolvedValueOnce(result({ error: { message: 'SYNTHETIC_SECRET' } }, false));
    const data = await provider.analytics('synthetic-id', 'SYNTHETIC_TOKEN', 7);
    expect(data.map((x) => x.label)).toEqual(['Reach']);
    expect(isPartialAnalytics(data)).toBe(true);
    expect(JSON.stringify(data)).not.toContain('SYNTHETIC_SECRET');
  });

  it('does not mark a complete result partial', async () => {
    const { isPartialAnalytics } = require('@gitroom/nestjs-libraries/integrations/social.abstract');
    request.mockResolvedValue(result({ data: [] }));
    expect(isPartialAnalytics(await provider.analytics('synthetic-id', 'SYNTHETIC_TOKEN', 7))).toBe(false);
  });

  it.each(['network', 'json'])(
    'curates %s failures without carrying a URL, token or body',
    async (failure) => {
      if (failure === 'network')
        request.mockRejectedValue(new Error('SYNTHETIC_SECRET'));
      else
        request.mockResolvedValue({
          ok: true,
          json: async () => {
            throw new Error('SYNTHETIC_SECRET');
          },
        });
      await expect(
        provider.analytics('synthetic-id', 'SYNTHETIC_TOKEN', 7)
      ).rejects.toThrow(
        /^Analytics are temporarily unavailable\. Try again later\.$/
      );
      expect(request).toHaveBeenCalledTimes(2);
    }
  );

  it('preserves the separate current follower summary', async () => {
    request.mockResolvedValue(
      result({ followers_count: 42, follows_count: 3, media_count: 2 })
    );
    expect(
      await provider.accountStats('synthetic-id', 'SYNTHETIC_TOKEN')
    ).toEqual({
      followers: 42,
      following: 3,
      posts: 2,
    });
    expect(new URL(request.mock.calls[0][0]).searchParams.get('fields')).toBe(
      'followers_count,follows_count,media_count'
    );
  });

  it('leaves the Facebook Login metric requests and follower series intact', async () => {
    request
      .mockResolvedValueOnce(
        result({
          data: [
            {
              name: 'follower_count',
              values: [{ value: 2, end_time: '2026-11-08T00:00:00Z' }],
            },
          ],
        })
      )
      .mockResolvedValueOnce(result({ data: [] }));
    const data = await new InstagramProvider().analytics(
      'synthetic-id',
      'SYNTHETIC_TOKEN',
      7
    );
    expect(new URL(request.mock.calls[0][0]).hostname).toBe(
      'graph.facebook.com'
    );
    expect(new URL(request.mock.calls[0][0]).searchParams.get('metric')).toBe(
      'follower_count,reach'
    );
    expect(data[0].label).toBe('Follower Count');
    expect(data[0].data[0].total).toBe(2);
  });
});
