import { WebsiteStatsService } from '@gitroom/nestjs-libraries/services/website.stats.service';

const redisGet = jest.fn();
const redisSet = jest.fn();
jest.mock('@gitroom/nestjs-libraries/redis/redis.service', () => ({
  ioRedis: {
    get: (...args: unknown[]) => redisGet(...args),
    set: (...args: unknown[]) => redisSet(...args),
  },
}));

jest.mock('google-auth-library', () => ({
  JWT: jest.fn().mockImplementation(() => ({
    getAccessToken: async () => ({ token: 'gsc-access-token' }),
  })),
}));

const ENV = [
  'CLOUDFLARE_ANALYTICS_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_WEB_ANALYTICS_SITE_TAG',
  'GOOGLE_SEARCH_CONSOLE_SITE',
  'GOOGLE_SEARCH_CONSOLE_CREDENTIALS',
  'SEARCH_CONSOLE_FORWARD_URL',
  'FRONTEND_URL',
];

const connectAll = () => {
  process.env.CLOUDFLARE_ANALYTICS_TOKEN = 'cf-secret-token';
  process.env.CLOUDFLARE_ACCOUNT_ID = 'account_1';
  process.env.CLOUDFLARE_WEB_ANALYTICS_SITE_TAG = 'site_1';
  process.env.FRONTEND_URL = 'https://app.postdelegate.com';
  process.env.GOOGLE_SEARCH_CONSOLE_SITE = 'sc-domain:postdelegate.com';
  process.env.GOOGLE_SEARCH_CONSOLE_CREDENTIALS = Buffer.from(
    JSON.stringify({
      client_email: 'stats@project.iam.gserviceaccount.com',
      private_key: 'private-key',
    })
  ).toString('base64');
};

// the dates of the range are recent, so the 6 months of Cloudflare keep them
const day = (offset: number) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - offset);
  return date;
};
const iso = (offset: number) => {
  const date = day(offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(date.getDate()).padStart(2, '0')}`;
};
const range = { from: day(2), to: day(0) };

// the shape Cloudflare answers the RUM query with
const rumFixture = () => ({
  data: {
    viewer: {
      accounts: [
        {
          totals: [{ count: 120, sum: { visits: 45 } }],
          perDay: [
            { count: 70, sum: { visits: 30 }, dimensions: { date: iso(2) } },
            { count: 50, sum: { visits: 15 }, dimensions: { date: iso(0) } },
          ],
          pages: [
            { count: 80, sum: { visits: 40 }, dimensions: { name: '/' } },
            { count: 40, sum: { visits: 5 }, dimensions: { name: '/pricing' } },
          ],
          countries: [
            { count: 100, sum: { visits: 40 }, dimensions: { name: 'US' } },
          ],
          referrers: [
            {
              count: 30,
              sum: { visits: 30 },
              dimensions: { name: 'www.google.com' },
            },
            {
              count: 60,
              sum: { visits: 0 },
              dimensions: { name: 'postdelegate.com' },
            },
          ],
        },
      ],
    },
  },
  errors: null,
});

// the shape Search Console answers each searchAnalytics query with
const searchFixture = (body: { dimensions?: string[] }) => {
  switch (body.dimensions?.[0]) {
    case 'date':
      return {
        rows: [
          {
            keys: [iso(2)],
            clicks: 3,
            impressions: 100,
            ctr: 0.03,
            position: 9.5,
          },
        ],
      };
    case 'query':
      return {
        rows: [
          {
            keys: ['social scheduler'],
            clicks: 3,
            impressions: 50,
            ctr: 0.06,
            position: 7.1,
          },
          {
            keys: ['postdelegate'],
            clicks: 1,
            impressions: 400,
            ctr: 0.0025,
            position: 1.2,
          },
        ],
      };
    case 'page':
      return {
        rows: [
          {
            keys: ['https://postdelegate.com/'],
            clicks: 4,
            impressions: 450,
            ctr: 0.0089,
            position: 3.3,
          },
        ],
      };
    default:
      // the totals: no dimensions, so the row has no keys
      return {
        rows: [{ clicks: 4, impressions: 450, ctr: 0.0089, position: 3.3 }],
      };
  }
};

describe('WebsiteStatsService', () => {
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    ENV.forEach((name) => delete process.env[name]);
    redisGet.mockReset().mockResolvedValue(null);
    redisSet.mockReset().mockResolvedValue('OK');
    fetchMock = jest.fn();
    global.fetch = fetchMock as any;
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = realFetch;
    ENV.forEach((name) => delete process.env[name]);
    jest.restoreAllMocks();
  });

  it('says a source without its env vars is not connected', async () => {
    const service = new WebsiteStatsService();

    expect(await service.getVisitors(range)).toEqual({ connected: false });
    expect(await service.getSearch(range)).toEqual({ connected: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('says a source that fails, without the token, and caches nothing', async () => {
    connectAll();
    fetchMock.mockImplementation(
      async () =>
        new Response('{"error":"bad token cf-secret-token"}', { status: 403 })
    );
    const service = new WebsiteStatsService();

    const visitors = await service.getVisitors(range);
    const search = await service.getSearch(range);

    expect(visitors).toEqual({
      connected: true,
      error: 'Cloudflare could not be reached',
    });
    expect(search).toEqual({
      connected: true,
      error: 'Search Console could not be reached',
    });
    const answer = JSON.stringify([visitors, search]);
    expect(answer).not.toContain('cf-secret-token');
    expect(answer).not.toContain('gsc-access-token');
    expect(redisSet).not.toHaveBeenCalled();
  });

  it('says a Cloudflare query error even when it answers 200', async () => {
    connectAll();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ data: null, errors: [{ message: 'not authorized' }] })
      )
    );

    expect(await new WebsiteStatsService().getVisitors(range)).toEqual({
      connected: true,
      error: 'Cloudflare could not be reached',
    });
  });

  it('maps the Cloudflare answer, every day of the range included', async () => {
    connectAll();
    fetchMock.mockResolvedValue(new Response(JSON.stringify(rumFixture())));

    const visitors = await new WebsiteStatsService().getVisitors(range);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.cloudflare.com/client/v4/graphql');
    expect(init.headers.Authorization).toBe('Bearer cf-secret-token');
    expect(JSON.parse(init.body).variables).toEqual({
      accountTag: 'account_1',
      filter: {
        siteTag: 'site_1',
        bot: 0,
        date_geq: iso(2),
        date_leq: iso(0),
        requestHost_notin: ['app.postdelegate.com', 'localhost', '127.0.0.1'],
      },
      referrerFilter: {
        siteTag: 'site_1',
        bot: 0,
        date_geq: iso(2),
        date_leq: iso(0),
        requestHost_notin: ['app.postdelegate.com', 'localhost', '127.0.0.1'],
        refererHost_neq: '',
      },
      days: 3,
    });
    expect(visitors).toEqual({
      connected: true,
      from: iso(2),
      to: iso(0),
      totals: { pageViews: 120, visits: 45 },
      perDay: [
        { date: iso(2), pageViews: 70, visits: 30 },
        { date: iso(1), pageViews: 0, visits: 0 },
        { date: iso(0), pageViews: 50, visits: 15 },
      ],
      pages: [
        { name: '/', pageViews: 80, visits: 40 },
        { name: '/pricing', pageViews: 40, visits: 5 },
      ],
      countries: [{ name: 'US', pageViews: 100, visits: 40 }],
      // our own host sends no visits
      referrers: [{ name: 'www.google.com', pageViews: 30, visits: 30 }],
    });
    expect(redisSet).toHaveBeenCalledWith(
      `admin:website:visitors:${iso(2)}:${iso(0)}`,
      JSON.stringify(visitors),
      'EX',
      expect.any(Number)
    );
  });

  it('moves a from older than Cloudflare allows in one query up', async () => {
    connectAll();
    fetchMock.mockResolvedValue(new Response(JSON.stringify(rumFixture())));

    const visitors = await new WebsiteStatsService().getVisitors({
      from: day(400),
      to: day(0),
    });

    expect(visitors).toMatchObject({ from: iso(92), to: iso(0) });
    expect(
      JSON.parse(fetchMock.mock.calls[0][1].body).variables.filter
    ).toEqual(expect.objectContaining({ date_geq: iso(92) }));
  });

  it('never asks Cloudflare for days older than it keeps', async () => {
    connectAll();
    fetchMock.mockResolvedValue(new Response(JSON.stringify(rumFixture())));

    const visitors = await new WebsiteStatsService().getVisitors({
      from: day(250),
      to: day(170),
    });

    expect(visitors).toMatchObject({ from: iso(183), to: iso(170) });
  });

  it('answers from the cache without asking Cloudflare', async () => {
    connectAll();
    redisGet.mockResolvedValue(
      JSON.stringify({ connected: true, from: iso(2), to: iso(0) })
    );

    expect(await new WebsiteStatsService().getVisitors(range)).toEqual({
      connected: true,
      from: iso(2),
      to: iso(0),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps the Search Console answers, top by impressions', async () => {
    connectAll();
    fetchMock.mockImplementation(
      async (_url: string, init: { body: string }) =>
        new Response(JSON.stringify(searchFixture(JSON.parse(init.body))))
    );

    const search = await new WebsiteStatsService().getSearch(range);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Apostdelegate.com/searchAnalytics/query'
    );
    expect(init.headers.Authorization).toBe('Bearer gsc-access-token');
    expect(JSON.parse(init.body)).toEqual({
      startDate: iso(2),
      endDate: iso(0),
      rowLimit: 1,
    });
    expect(search).toEqual({
      connected: true,
      totals: { clicks: 4, impressions: 450, ctr: 0.0089, position: 3.3 },
      perDay: [
        { date: iso(2), clicks: 3, impressions: 100 },
        { date: iso(1), clicks: 0, impressions: 0 },
        { date: iso(0), clicks: 0, impressions: 0 },
      ],
      queries: [
        {
          name: 'postdelegate',
          clicks: 1,
          impressions: 400,
          ctr: 0.0025,
          position: 1.2,
        },
        {
          name: 'social scheduler',
          clicks: 3,
          impressions: 50,
          ctr: 0.06,
          position: 7.1,
        },
      ],
      pages: [
        {
          name: 'https://postdelegate.com/',
          clicks: 4,
          impressions: 450,
          ctr: 0.0089,
          position: 3.3,
        },
      ],
    });
  });

  it('says credentials that are not a service account JSON', async () => {
    connectAll();
    process.env.GOOGLE_SEARCH_CONSOLE_CREDENTIALS = 'not-base64-json';

    expect(await new WebsiteStatsService().getSearch(range)).toEqual({
      connected: true,
      error: 'Search Console could not be reached',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe('forwardSearch', () => {
    const FORWARD_URL = 'https://receiver.example.com/ingest?site=example';
    const SEARCH_URL =
      'https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Apostdelegate.com/searchAnalytics/query';

    // a page of Search Console rows by date, query and page
    const searchPage = (count: number) => ({
      rows: Array.from({ length: count }, (_, index) => ({
        keys: [iso(3), `query ${index}`, 'https://postdelegate.com/pricing'],
        clicks: 1,
        impressions: 10,
        ctr: 0.1,
        position: 4.2,
      })),
    });

    // Search Console answers pages of the given sizes in turn, the receiver
    // stores what it gets
    const answer = (pages: number[], receiver?: () => Response) => {
      let asked = 0;
      fetchMock.mockImplementation(
        async (url: string, init: { body: string }) => {
          if (url === SEARCH_URL) {
            return new Response(
              JSON.stringify(searchPage(pages[asked++] ?? 0))
            );
          }
          if (receiver) {
            return receiver();
          }
          return new Response(
            JSON.stringify({ stored: JSON.parse(init.body).rows.length })
          );
        }
      );
    };
    const searchCalls = () =>
      fetchMock.mock.calls.filter(([url]) => url === SEARCH_URL);
    const forwardCalls = () =>
      fetchMock.mock.calls.filter(([url]) => url === FORWARD_URL);

    it('does nothing without the URL', async () => {
      connectAll();

      expect(await new WebsiteStatsService().forwardSearch()).toEqual({
        enabled: false,
        rows: 0,
        stored: 0,
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does nothing with an empty URL or without Search Console', async () => {
      process.env.SEARCH_CONSOLE_FORWARD_URL = FORWARD_URL;
      expect(await new WebsiteStatsService().forwardSearch()).toMatchObject({
        enabled: false,
      });

      connectAll();
      process.env.SEARCH_CONSOLE_FORWARD_URL = '';
      expect(await new WebsiteStatsService().forwardSearch()).toMatchObject({
        enabled: false,
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('pages through Search Console and posts at most 5000 rows each', async () => {
      connectAll();
      process.env.SEARCH_CONSOLE_FORWARD_URL = FORWARD_URL;
      answer([5000, 1200]);

      const result = await new WebsiteStatsService().forwardSearch();

      expect(result).toEqual({ enabled: true, rows: 6200, stored: 6200 });
      expect(searchCalls().map(([, init]) => JSON.parse(init.body))).toEqual([
        {
          startDate: iso(4),
          endDate: iso(2),
          dimensions: ['date', 'query', 'page'],
          rowLimit: 5000,
          startRow: 0,
        },
        {
          startDate: iso(4),
          endDate: iso(2),
          dimensions: ['date', 'query', 'page'],
          rowLimit: 5000,
          startRow: 5000,
        },
      ]);
      const posts = forwardCalls();
      expect(
        posts.map(([, init]) => JSON.parse(init.body).rows.length)
      ).toEqual([5000, 1200]);
      const [, init] = posts[0];
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(JSON.parse(init.body).rows[0]).toEqual({
        date: iso(3),
        query: 'query 0',
        page: 'https://postdelegate.com/pricing',
        clicks: 1,
        impressions: 10,
        ctr: 0.1,
        position: 4.2,
      });
    });

    it('sends no more than 25000 rows in a run', async () => {
      connectAll();
      process.env.SEARCH_CONSOLE_FORWARD_URL = FORWARD_URL;
      answer([5000, 5000, 5000, 5000, 5000, 5000, 5000]);

      expect(await new WebsiteStatsService().forwardSearch()).toEqual({
        enabled: true,
        rows: 25000,
        stored: 25000,
      });
      expect(searchCalls()).toHaveLength(5);
      expect(forwardCalls()).toHaveLength(5);
      expect(console.warn).toHaveBeenCalledWith(
        'search_console_forward_capped',
        { rows: 25000 }
      );
    });

    it('stops at the first answer that is not a stored count', async () => {
      connectAll();
      process.env.SEARCH_CONSOLE_FORWARD_URL = FORWARD_URL;
      answer([5000, 10], () => new Response('forbidden', { status: 403 }));

      expect(await new WebsiteStatsService().forwardSearch()).toEqual({
        enabled: true,
        rows: 5010,
        stored: 0,
      });
      expect(forwardCalls()).toHaveLength(1);
      expect(console.warn).toHaveBeenCalledWith(
        'search_console_forward_failed',
        { status: 403 }
      );
    });

    it('posts nothing when Search Console fails, and does not throw', async () => {
      connectAll();
      process.env.SEARCH_CONSOLE_FORWARD_URL = FORWARD_URL;
      fetchMock.mockImplementation(
        async () => new Response('{"error":"quota"}', { status: 429 })
      );

      expect(await new WebsiteStatsService().forwardSearch()).toEqual({
        enabled: true,
        rows: 0,
        stored: 0,
      });
      expect(forwardCalls()).toHaveLength(0);
    });

    it('does not throw when the receiver cannot be reached', async () => {
      connectAll();
      process.env.SEARCH_CONSOLE_FORWARD_URL = FORWARD_URL;
      answer([3], () => {
        throw new Error('connect ECONNREFUSED');
      });

      expect(await new WebsiteStatsService().forwardSearch()).toEqual({
        enabled: true,
        rows: 3,
        stored: 0,
      });
    });
  });
});
