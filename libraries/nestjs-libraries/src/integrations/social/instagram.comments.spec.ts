import 'reflect-metadata';
import { InstagramStandaloneProvider } from '@gitroom/nestjs-libraries/integrations/social/instagram.standalone.provider';

// Only the Graph calls are replaced, the comment methods run as is
const provider = (answer: (url: string, method: string) => any) => {
  const instance = new InstagramStandaloneProvider();
  const fetched: { url: string; method: string }[] = [];
  instance.fetch = jest.fn(async (url: string, options: any = {}) => {
    const method = options.method || 'GET';
    fetched.push({ url, method });
    return { json: async () => answer(url, method) } as any;
  }) as any;
  return { instance, fetched };
};

describe('InstagramStandaloneProvider comment management', () => {
  it('lists the latest posts from graph.instagram.com', async () => {
    const { instance, fetched } = provider(() => ({
      data: [
        {
          id: 'media-1',
          caption: 'Launch day',
          permalink: 'https://www.instagram.com/p/abc/',
          media_type: 'IMAGE',
          media_url: 'https://cdn/img.jpg',
          timestamp: '2026-11-26T08:00:00+0000',
          comments_count: 3,
        },
        {
          id: 'media-2',
          media_type: 'VIDEO',
          thumbnail_url: 'https://cdn/thumb.jpg',
          timestamp: '2026-11-25T08:00:00+0000',
        },
      ],
    }));

    const posts = await instance.commentPosts('ig-1', 'token___x', 12);

    expect(fetched[0].url).toMatch(
      /^https:\/\/graph\.instagram\.com\/v[\d.]+\/ig-1\/media\?fields=/
    );
    expect(fetched[0].url).toContain('limit=12');
    expect(fetched[0].url).toContain('access_token=token&');
    expect(posts).toEqual([
      {
        id: 'media-1',
        caption: 'Launch day',
        permalink: 'https://www.instagram.com/p/abc/',
        thumbnail: 'https://cdn/img.jpg',
        createdAt: '2026-11-26T08:00:00+0000',
        comments: 3,
      },
      {
        id: 'media-2',
        caption: '',
        permalink: undefined,
        thumbnail: 'https://cdn/thumb.jpg',
        createdAt: '2026-11-25T08:00:00+0000',
        comments: 0,
      },
    ]);
  });

  it('reads the comments of a post with their replies and marks the account own ones', async () => {
    const { instance, fetched } = provider(() => ({
      data: [
        {
          id: 'c-1',
          text: 'What is the price?',
          username: 'fan',
          from: { id: 'fan-id', username: 'fan' },
          timestamp: '2026-11-26T09:00:00+0000',
          hidden: false,
          replies: {
            data: [
              {
                id: 'r-1',
                text: 'DM us',
                username: 'brand',
                user: { id: 'ig-1' },
                timestamp: '2026-11-26T09:00:10+0000',
              },
            ],
          },
        },
        {
          id: 'c-2',
          text: 'spam',
          username: 'bot',
          timestamp: '2026-11-26T09:01:00+0000',
          hidden: true,
        },
      ],
    }));

    const comments = await instance.postComments('ig-1', 'token', 'media-1');

    expect(fetched[0].url).toMatch(
      /^https:\/\/graph\.instagram\.com\/v[\d.]+\/media-1\/comments\?fields=/
    );
    expect(decodeURIComponent(fetched[0].url)).toContain('replies{');
    expect(comments).toEqual([
      {
        id: 'c-1',
        text: 'What is the price?',
        username: 'fan',
        createdAt: '2026-11-26T09:00:00+0000',
        hidden: false,
        own: false,
        replies: [
          {
            id: 'r-1',
            text: 'DM us',
            username: 'brand',
            createdAt: '2026-11-26T09:00:10+0000',
            hidden: false,
            own: true,
            replies: [],
          },
        ],
      },
      {
        id: 'c-2',
        text: 'spam',
        username: 'bot',
        createdAt: '2026-11-26T09:01:00+0000',
        hidden: true,
        own: false,
        replies: [],
      },
    ]);
  });

  it('replies to a comment through /replies', async () => {
    const { instance, fetched } = provider(() => ({ id: 'reply-1' }));

    const reply = await instance.replyToComment(
      'ig-1',
      'token',
      'c-1',
      'Hi & thanks!'
    );

    expect(reply).toEqual({ id: 'reply-1' });
    expect(fetched).toEqual([
      {
        url: expect.stringMatching(
          /^https:\/\/graph\.instagram\.com\/v[\d.]+\/c-1\/replies\?message=Hi%20%26%20thanks!&access_token=token$/
        ),
        method: 'POST',
      },
    ]);
  });

  it('hides, unhides and deletes a comment', async () => {
    const { instance, fetched } = provider(() => ({ success: true }));

    await instance.hideComment('ig-1', 'token', 'c-1', true);
    await instance.hideComment('ig-1', 'token', 'c-1', false);
    await instance.deleteComment('ig-1', 'token', 'c-1');

    expect(fetched.map((f) => `${f.method} ${f.url.replace(/\/v[\d.]+\//, '/')}`)).toEqual([
      'POST https://graph.instagram.com/c-1?hide=true&access_token=token',
      'POST https://graph.instagram.com/c-1?hide=false&access_token=token',
      'DELETE https://graph.instagram.com/c-1?access_token=token',
    ]);
  });

  it('follows the comment pages Instagram returns, up to ten', async () => {
    const page = (n: number) => ({
      data: [{ id: `c-${n}`, text: 'hi', username: 'fan', timestamp: '2026-11-26T09:00:00+0000' }],
      paging: { next: `https://graph.instagram.com/next-${n + 1}` },
    });
    const { instance, fetched } = provider((url) =>
      page(url.includes('next-') ? Number(url.split('next-')[1]) : 1)
    );

    const comments = await instance.postComments('ig-1', 'token', 'media-1');

    expect(fetched).toHaveLength(10);
    expect(fetched[1].url).toBe('https://graph.instagram.com/next-2');
    expect(comments.map((c) => c.id)).toEqual(
      Array.from({ length: 10 }, (_, i) => `c-${i + 1}`)
    );
  });

  it('stops at the last comment page', async () => {
    const { instance, fetched } = provider(() => ({ data: [] }));
    expect(await instance.postComments('ig-1', 'token', 'media-1')).toEqual([]);
    expect(fetched).toHaveLength(1);
  });
});
