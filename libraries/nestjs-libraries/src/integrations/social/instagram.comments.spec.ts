// a retry waits 5 seconds first
jest.mock('@gitroom/helpers/utils/timer', () => ({
  timer: jest.fn(async () => undefined),
}));
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

// The reply POST goes through axios (runStreamedUpload), answered in order:
// a body, an HTTP error status or a dropped connection
const replies = (
  instance: InstagramStandaloneProvider,
  answers: { data?: any; status?: number; drop?: boolean }[]
) => {
  const post = jest.fn(async (url: string) => {
    const answer = answers.shift() || { data: {} };
    if (answer.drop) throw new Error('socket hang up');
    if (answer.status) {
      throw Object.assign(new Error(`status ${answer.status}`), {
        response: { status: answer.status, data: { error: { message: 'boom' } } },
      });
    }
    return { data: answer.data };
  });
  jest.spyOn(instance as any, 'getSsrfSafeAxios').mockReturnValue({ post });
  return post;
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
    const { instance, fetched } = provider(() => ({}));
    const post = replies(instance, [{ data: { id: 'reply-1' } }]);

    const reply = await instance.replyToComment(
      'ig-1',
      'token',
      'c-1',
      'Hi & thanks!'
    );

    expect(reply).toEqual({ id: 'reply-1' });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toMatch(
      /^https:\/\/graph\.instagram\.com\/v[\d.]+\/c-1\/replies\?message=Hi%20%26%20thanks!&access_token=token$/
    );
    // a hung POST gives up instead of holding the claim
    expect(post.mock.calls[0][2]).toEqual({ timeout: 30_000 });
    // nothing to check before the first send
    expect(fetched).toEqual([]);
  });

  it('never sends a reply again that Instagram created before a 5xx', async () => {
    const { instance, fetched } = provider(() => ({
      data: [
        { id: 'r-fan', text: 'Hi & thanks!', from: { id: 'fan-id' } },
        { id: 'r-own', text: 'Hi & thanks!\r\n', user: { id: 'ig-1' } },
      ],
    }));
    const post = replies(instance, [{ status: 500 }]);

    const reply = await instance.replyToComment('ig-1', 'token', 'c-1', 'Hi & thanks!');

    // the retry found the channel's own reply, not the fan's one with the
    // same text, and did not post it a second time
    expect(reply).toEqual({ id: 'r-own' });
    expect(post).toHaveBeenCalledTimes(1);
    expect(fetched).toHaveLength(1);
    expect(fetched[0].method).toBe('GET');
    expect(fetched[0].url).toMatch(
      /^https:\/\/graph\.instagram\.com\/v[\d.]+\/c-1\/replies\?fields=/
    );
  });

  it('sends a reply again after a 5xx when it is not under the comment', async () => {
    const { instance, fetched } = provider(() => ({ data: [] }));
    const post = replies(instance, [{ status: 500 }, { data: { id: 'reply-2' } }]);

    const reply = await instance.replyToComment('ig-1', 'token', 'c-1', 'Hi');

    expect(reply).toEqual({ id: 'reply-2' });
    expect(post).toHaveBeenCalledTimes(2);
    expect(fetched).toHaveLength(1);
  });

  it('sends a reply again after a 5xx when the lookup itself fails', async () => {
    const { instance, fetched } = provider(() => {
      throw new Error('lookup failed');
    });
    const post = replies(instance, [{ status: 500 }, { data: { id: 'reply-3' } }]);

    const reply = await instance.replyToComment('ig-1', 'token', 'c-1', 'Hi');

    expect(reply).toEqual({ id: 'reply-3' });
    expect(post).toHaveBeenCalledTimes(2);
    expect(fetched).toHaveLength(1);
  });

  it('gives up after the usual retries when the lookup keeps failing', async () => {
    const { instance } = provider(() => {
      throw new Error('lookup failed');
    });
    const post = replies(instance, Array.from({ length: 5 }, () => ({ status: 500 })));

    await expect(
      instance.replyToComment('ig-1', 'token', 'c-1', 'Hi')
    ).rejects.toBeTruthy();
    // the first send and three retries, like this.fetch
    expect(post).toHaveBeenCalledTimes(4);
  });

  it('sends a reply again after a 429, once nothing is under the comment', async () => {
    const { instance, fetched } = provider(() => ({ data: [] }));
    const post = replies(instance, [{ status: 429 }, { data: { id: 'reply-4' } }]);

    const reply = await instance.replyToComment('ig-1', 'token', 'c-1', 'Hi');

    expect(reply).toEqual({ id: 'reply-4' });
    expect(post).toHaveBeenCalledTimes(2);
    expect(fetched).toHaveLength(1);
  });

  it('does not send a reply again after a dropped connection', async () => {
    const { instance, fetched } = provider(() => ({ data: [] }));
    const post = replies(instance, [{ drop: true }]);

    await expect(
      instance.replyToComment('ig-1', 'token', 'c-1', 'Hi')
    ).rejects.toThrow('Instagram did not answer the reply');
    expect(post).toHaveBeenCalledTimes(1);
    expect(fetched).toEqual([]);
  });

  it('finds the account own reply on a later page', async () => {
    const { instance, fetched } = provider((url) =>
      url.includes('next-2')
        ? { data: [{ id: 'r-own', text: 'Hi', user: { id: 'ig-1' } }] }
        : {
            data: [{ id: 'r-other', text: 'Hello', user: { id: 'ig-1' } }],
            paging: { next: 'https://graph.instagram.com/next-2' },
          }
    );

    expect(await instance.commentReply('ig-1', 'token___x', 'c-1', ' Hi ')).toEqual({
      id: 'r-own',
    });
    expect(fetched[0].url).toMatch(/access_token=token$/);
    expect(fetched).toHaveLength(2);
    expect(await instance.commentReply('ig-1', 'token', 'c-1', 'Bye')).toBeUndefined();
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

  it('follows the comment pages Instagram returns, up to four', async () => {
    const page = (n: number) => ({
      data: [{ id: `c-${n}`, text: 'hi', username: 'fan', timestamp: '2026-11-26T09:00:00+0000' }],
      paging: { next: `https://graph.instagram.com/next-${n + 1}` },
    });
    const { instance, fetched } = provider((url) =>
      page(url.includes('next-') ? Number(url.split('next-')[1]) : 1)
    );

    const comments = await instance.postComments('ig-1', 'token', 'media-1');

    expect(fetched).toHaveLength(4);
    expect(fetched[1].url).toBe('https://graph.instagram.com/next-2');
    expect(comments.map((c) => c.id)).toEqual(
      Array.from({ length: 4 }, (_, i) => `c-${i + 1}`)
    );
  });

  it('stops at the last comment page', async () => {
    const { instance, fetched } = provider(() => ({ data: [] }));
    expect(await instance.postComments('ig-1', 'token', 'media-1')).toEqual([]);
    expect(fetched).toHaveLength(1);
  });
});
