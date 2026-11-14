import { BadRequestException, NotFoundException } from '@nestjs/common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

// the service pulls in heavy provider / upload modules that are not under test
jest.mock('@gitroom/nestjs-libraries/integrations/integration.manager', () => ({
  IntegrationManager: class {},
}));
jest.mock('@gitroom/nestjs-libraries/database/prisma/media/media.service', () => ({
  MediaService: class {},
}));
jest.mock('@gitroom/helpers/utils/sanitize.post.content', () => ({
  sanitizePostContent: (html: string) => html,
}));
jest.mock('@gitroom/nestjs-libraries/upload/upload.factory', () => ({
  UploadFactory: { createStorage: jest.fn() },
}));
jest.mock('@gitroom/nestjs-libraries/dtos/webhooks/webhook.url.validator', () => ({
  isSafePublicHttpsUrl: jest.fn(),
}));

import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';

const future = dayjs.utc().add(2, 'day');

const stored = (over: Record<string, any> = {}) => [
  {
    id: 'p-1',
    group: 'g-1',
    state: 'QUEUE',
    parentPostId: null,
    publishDate: future.toDate(),
    content: '<p>Old</p>',
    image: JSON.stringify([{ id: 'm-1', path: 'https://cdn/x.png' }]),
    settings: JSON.stringify({ __type: 'linkedin', keep: 1 }),
    delay: 0,
    integration: { id: 'i-1', providerIdentifier: 'linkedin' },
    tags: [],
    ...over,
  },
  {
    id: 'c-1',
    parentPostId: 'p-1',
    content: '<p>Comment</p>',
    image: '[]',
    delay: 0,
  },
];

const makeService = (posts = stored()) => {
  const service = Object.create(PostsService.prototype) as PostsService;
  const spies = {
    getPostsRecursively: jest.fn().mockResolvedValue(posts),
    validatePosts: jest
      .fn()
      .mockResolvedValue([{ name: 'QA', valid: true, errors: true, tooLong: false }]),
    createPost: jest.fn().mockResolvedValue([{ postId: 'p-1' }]),
  };
  Object.assign(service, spies);
  return { service, ...spies };
};

const agent = { type: 'agent' as const, source: 'Claude (MCP)' };

describe('PostsService.updatePostInPlace', () => {
  it('edits text, media, date and settings of the stored entries in place', async () => {
    const { service, createPost } = makeService();
    const date = future.add(1, 'day').format('YYYY-MM-DDTHH:mm:ss');

    await expect(
      service.updatePostInPlace(
        'org-1',
        'p-1',
        {
          date,
          settings: { added: true },
          value: [
            { content: '<p>New</p>', image: [{ path: 'https://cdn/y.png' }] },
            {},
          ],
        },
        'MCP',
        agent
      )
    ).resolves.toEqual({ postId: 'p-1', publishDate: date });

    const [org, body, method, keepGroup, actor] = createPost.mock.calls[0];
    expect(org).toBe('org-1');
    expect(method).toBe('MCP');
    expect(keepGroup).toBe(true);
    expect(actor).toBe(agent);
    expect(body.type).toBe('update');
    expect(body.date).toBe(date);
    expect(body.posts[0].group).toBe('g-1');
    expect(body.posts[0].settings).toEqual({
      __type: 'linkedin',
      keep: 1,
      added: true,
    });
    expect(body.posts[0].value).toEqual([
      {
        id: 'p-1',
        content: '<p>New</p>',
        delay: 0,
        image: [{ path: 'https://cdn/y.png', id: expect.any(String) }],
      },
      // an entry with nothing passed keeps its text and media
      { id: 'c-1', content: '<p>Comment</p>', delay: 0, image: [] },
    ]);
  });

  it('keeps the date when none is passed', async () => {
    const { service, createPost } = makeService();
    await service.updatePostInPlace('org-1', 'p-1', { settings: { a: 1 } }, 'MCP');
    expect(createPost.mock.calls[0][1].date).toBe(
      future.format('YYYY-MM-DDTHH:mm:ss')
    );
  });

  it('needs one entry per stored post and comment', async () => {
    const { service, createPost } = makeService();
    await expect(
      service.updatePostInPlace(
        'org-1',
        'p-1',
        { value: [{ content: '<p>Only one</p>' }] },
        'MCP'
      )
    ).rejects.toThrow('pass exactly 2');
    expect(createPost).not.toHaveBeenCalled();
  });

  it('refuses a past date for a scheduled post, and a date that does not parse', async () => {
    const { service } = makeService();
    await expect(
      service.updatePostInPlace('org-1', 'p-1', { date: '2020-01-01T00:00:00' }, 'MCP')
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.updatePostInPlace('org-1', 'p-1', { date: 'tomorrow-ish' }, 'MCP')
    ).rejects.toThrow('not a valid date');
  });

  it('refuses published posts, comments and unknown ids', async () => {
    await expect(
      makeService(stored({ state: 'PUBLISHED' })).service.updatePostInPlace(
        'org-1',
        'p-1',
        { date: future.format() },
        'MCP'
      )
    ).rejects.toThrow('not published yet');
    await expect(
      makeService(stored({ parentPostId: 'x' })).service.updatePostInPlace(
        'org-1',
        'p-1',
        { settings: {} },
        'MCP'
      )
    ).rejects.toThrow('belongs to a comment');
    await expect(
      makeService([] as any).service.updatePostInPlace('org-1', 'p-1', {}, 'MCP')
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the validation problem of a scheduled post', async () => {
    const { service, validatePosts, createPost } = makeService();
    validatePosts.mockResolvedValue([
      { name: 'QA', valid: true, errors: true, tooLong: true, maximumCharacters: 3000 },
    ]);
    await expect(
      service.updatePostInPlace(
        'org-1',
        'p-1',
        { value: [{ content: 'x'.repeat(4000) }, {}] },
        'MCP'
      )
    ).rejects.toThrow('The maximum characters is 3000');
    expect(createPost).not.toHaveBeenCalled();
  });

  it('updatePostSettings still only changes the settings', async () => {
    const { service, createPost } = makeService();
    await service.updatePostSettings('org-1', 'p-1', { a: 1 }, 'MCP');
    const body = createPost.mock.calls[0][1];
    expect(body.posts[0].value.map((v: any) => v.content)).toEqual([
      '<p>Old</p>',
      '<p>Comment</p>',
    ]);
    expect(body.date).toBe(future.format('YYYY-MM-DDTHH:mm:ss'));
  });
});
