// the tools are built with stub services, their modules only need to load
jest.mock('@gitroom/nestjs-libraries/integrations/integration.manager', () => ({
  IntegrationManager: class {},
  socialIntegrationList: [],
}));
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service',
  () => ({ IntegrationService: class {} })
);
jest.mock('@gitroom/nestjs-libraries/database/prisma/posts/posts.service', () => ({
  PostsService: class {},
}));
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/analytics/analytics.service',
  () => ({ AnalyticsService: class {} })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/approvals/approvals.service',
  () => ({ ApprovalsService: class {} })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/approvals/approval.policy.service',
  () => ({ ApprovalPolicyService: class {} })
);

import 'reflect-metadata';
import { McpDispatchUnconfirmed } from '../../database/prisma/posts/mcp.dispatch.status';
import { PostsListTool } from './posts.list.tool';
import { BadRequestException } from '@nestjs/common';
import { runWithContext } from '@gitroom/nestjs-libraries/chat/async.storage';
import { IntegrationSchedulePostTool } from '@gitroom/nestjs-libraries/chat/tools/integration.schedule.post';
import {
  CreatePostForReviewTool,
  SendPostForReviewTool,
} from '@gitroom/nestjs-libraries/chat/tools/post.review.tool';
import { PostUpdateTool } from '@gitroom/nestjs-libraries/chat/tools/post.update.tool';
import {
  AnalyticsMetricsTool,
  AnalyticsTopPostsTool,
  BestTimeToPostTool,
  ChannelAnalyticsTool,
  CHANNEL_ANALYTICS_HOURLY_LIMIT,
} from '@gitroom/nestjs-libraries/chat/tools/analytics.tools';
import { requiredMcpScope } from '@gitroom/nestjs-libraries/chat/mcp.scopes';

// the request context the MCP server fills (checkAuth copies the auth in)
const contextFor = (orgId = 'org-1') => {
  const values = new Map<string, string>();
  return {
    requestContext: {
      get: (key: string) => values.get(key),
      set: (key: string, value: string) => values.set(key, value),
    },
  };
};

// runs a tool the way an MCP client call does
const call = (tool: any, input: unknown, source = 'Claude (MCP)') =>
  runWithContext(
    { requestId: 'r', auth: { id: 'org-1', name: 'QA' }, source },
    () => tool.run().execute(input, contextFor())
  );

const UPLOAD = 'https://uploads.postdelegate.com/a.png';

const socialPost = (type = 'draft') => ({
  socialPost: [
    {
      integrationId: 'int-1',
      isPremium: false,
      date: '2030-01-01T09:00:00',
      shortLink: false,
      type,
      postsAndComments: [{ content: '<p>Hello</p>', attachments: [] }],
      settings: [],
    },
  ],
});

describe('createPostForReviewTool', () => {
  const build = () => {
    const postsService = {
      withAgentAdmission: (_org: string, action: () => unknown) => action(),
      validatePosts: jest.fn().mockResolvedValue([
        { name: 'QA LinkedIn', valid: true, errors: true, tooLong: false },
      ]),
      createPost: jest
        .fn()
        .mockResolvedValue([{ postId: 'post-1', integration: 'int-1' }]),
    };
    const integrationService = {
      getIntegrationById: jest
        .fn()
        .mockResolvedValue({ id: 'int-1', providerIdentifier: 'linkedin' }),
    };
    const policy = { assertAgentGuardrails: jest.fn() };
    const approvals = {
      submitAsAgent: jest.fn().mockResolvedValue({ id: 'post-1' }),
    };
    const schedule = new IntegrationSchedulePostTool(
      postsService as any,
      integrationService as any,
      policy as any,
      approvals as any
    );
    return {
      tool: new CreatePostForReviewTool(schedule),
      schedule,
      postsService,
      approvals,
    };
  };

  it('saves a draft, checks it like a scheduled post and sends it for review', async () => {
    const { tool, postsService, approvals } = build();

    const result = await call(tool, socialPost('draft'));

    // a draft would skip the checks: the review copy is checked as scheduled
    expect(postsService.validatePosts.mock.calls[0][2]).toBe('schedule');
    expect(postsService.createPost.mock.calls[0][1].type).toBe('draft');
    expect(postsService.createPost.mock.calls[0][4]).toEqual({
      type: 'agent',
      source: 'Claude (MCP)',
    });
    expect(approvals.submitAsAgent).toHaveBeenCalledWith('org-1', 'post-1', {
      type: 'agent',
      source: 'Claude (MCP)',
    });
    expect(result.output[0]).toMatchObject({
      postId: 'post-1',
      approvalStatus: 'IN_REVIEW',
      previewUrl: expect.stringContaining('/p/post-1'),
    });
  });

  it('keeps review validation intent separate from draft storage', async () => {
    const { tool, postsService } = build();
    await call(tool, socialPost('draft'));
    expect(postsService.createPost.mock.calls[0][6]).toBe('review');
  });

  it('returns actual already-created IDs if a later channel fails final preparation', async () => {
    const { tool, postsService } = build();
    postsService.createPost.mockResolvedValueOnce([{ postId: 'saved-one', integration: 'int-1' }]).mockRejectedValueOnce(new BadRequestException('Final transformed payload too long'));
    const input = socialPost('draft');
    input.socialPost.push({ ...input.socialPost[0] });
    const result = await call(tool, input);
    expect(result.output.errors).toContain('saved-one');
    expect(result.output.errors).toContain('do not recreate');
  });

  it('returns dispatch uncertainty and all saved IDs without recreating a later failed batch item', async () => {
    const { schedule, postsService } = build();
    postsService.createPost.mockResolvedValueOnce([{ postId: 'saved-first', integration: 'int-1' }]).mockRejectedValueOnce(new McpDispatchUnconfirmed('saved-second', 2));
    const input = socialPost('schedule');
    input.socialPost.push({ ...input.socialPost[0] });
    const result = await call(schedule, input);
    expect(result.output).toMatchObject({ code: 'DISPATCH_UNCONFIRMED', savedPostIds: ['saved-first', 'saved-second'] });
    expect(postsService.createPost).toHaveBeenCalledTimes(2);
  });

  it('never publishes "now" posts directly', async () => {
    const { tool, postsService } = build();
    await call(tool, socialPost('now'));
    expect(postsService.createPost.mock.calls[0][1].type).toBe('draft');
  });

  it('returns validation problems instead of creating anything', async () => {
    const { tool, postsService, approvals } = build();
    postsService.validatePosts.mockResolvedValue([
      { name: 'QA X', valid: true, errors: true, tooLong: true, maximumCharacters: 280 },
    ]);

    const result = await call(tool, socialPost('schedule'));

    expect(result.output.errors).toContain('createPostForReviewTool');
    expect(postsService.createPost).not.toHaveBeenCalled();
    expect(approvals.submitAsAgent).not.toHaveBeenCalled();
  });

  it('reports the posts already created when sending one for review fails', async () => {
    const { tool, postsService, approvals } = build();
    const input = socialPost('schedule');
    input.socialPost.push({ ...input.socialPost[0], integrationId: 'int-2' });
    postsService.createPost
      .mockResolvedValueOnce([{ postId: 'post-1', integration: 'int-1' }])
      .mockResolvedValueOnce([
        { postId: 'post-2', integration: 'int-2' },
        { postId: 'post-3', integration: 'int-2' },
      ]);
    approvals.submitAsAgent
      .mockResolvedValueOnce({ id: 'post-1' })
      .mockResolvedValueOnce({ id: 'post-2' })
      .mockRejectedValueOnce(
        new BadRequestException('Agents can create 5 posts a day.')
      );

    const result = await call(tool, input);

    expect(typeof result.output.errors).toBe('string');
    expect(result.output.errors).toContain('Agents can create 5 posts a day.');
    expect(result.output.errors).toContain('in review: post-1, post-2;');
    expect(result.output.errors).toContain(
      'saved as drafts, not sent for review: post-3.'
    );
    expect(approvals.submitAsAgent).toHaveBeenCalledTimes(3);
  });

  it('does not show an internal error when sending for review fails', async () => {
    const { tool, approvals } = build();
    approvals.submitAsAgent.mockRejectedValueOnce(
      new Error('connect ECONNREFUSED 10.0.0.5:5432')
    );
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await call(tool, socialPost('schedule'));

    expect(result.output.errors).toContain('Sending the post for review failed.');
    expect(result.output.errors).toContain('in review: none;');
    expect(result.output.errors).toContain(
      'saved as drafts, not sent for review: post-1.'
    );
    expect(result.output.errors).not.toContain('ECONNREFUSED');
    spy.mockRestore();
  });

  it('the schedule tool itself never sends for review', async () => {
    const { schedule, approvals, postsService } = build();
    await call(schedule, socialPost('schedule'));
    expect(postsService.createPost.mock.calls[0][1].type).toBe('schedule');
    expect(approvals.submitAsAgent).not.toHaveBeenCalled();
  });
});

describe('sendPostForReviewTool', () => {
  it('sends the post for review as the MCP client', async () => {
    const approvals = {
      submitAsAgent: jest.fn().mockResolvedValue({
        id: 'post-1',
        approvalStatus: 'IN_REVIEW',
        state: 'DRAFT',
        submitted: true,
      }),
    };
    const result = await call(new SendPostForReviewTool(approvals as any), {
      postId: 'post-1',
    });
    expect(approvals.submitAsAgent).toHaveBeenCalledWith('org-1', 'post-1', {
      type: 'agent',
      source: 'Claude (MCP)',
    });
    expect(result).toEqual({
      output: {
        postId: 'post-1',
        approvalStatus: 'IN_REVIEW',
        state: 'DRAFT',
        submitted: true,
      },
    });
  });

  it('explains why a post cannot be sent', async () => {
    const approvals = {
      submitAsAgent: jest
        .fn()
        .mockRejectedValue(
          new BadRequestException('This post was already published.')
        ),
    };
    await expect(
      call(new SendPostForReviewTool(approvals as any), { postId: 'p' })
    ).resolves.toEqual({
      output: { errors: 'This post was already published.' },
    });
  });
});

describe('postUpdateTool', () => {
  const build = () => {
    const postsService = {
      withAgentAdmission: (_org: string, action: () => unknown) => action(),
      updatePostInPlace: jest.fn().mockResolvedValue({
        postId: 'post-1',
        publishDate: '2030-01-02T10:00:00',
      }),
    };
    return { tool: new PostUpdateTool(postsService as any), postsService };
  };

  it('changes text, media, date and settings in place', async () => {
    const { tool, postsService } = build();

    const result = await call(tool, {
      id: 'post-1',
      date: '2030-01-02T10:00:00',
      postsAndComments: [
        { content: '<p>New</p>', attachments: [{ path: UPLOAD, alt: 'A' }] },
        { content: '<p>Comment</p>' },
      ],
      settings: [{ key: 'post_as_images_carousel', value: true }],
    });

    expect(postsService.updatePostInPlace).toHaveBeenCalledWith(
      'org-1',
      'post-1',
      {
        date: '2030-01-02T10:00:00',
        settings: { post_as_images_carousel: true },
        value: [
          {
            content: '<p>New</p>',
            image: [
              { path: UPLOAD, alt: 'A', thumbnail: undefined, thumbnailTimestamp: undefined },
            ],
          },
          // media left out is kept
          { content: '<p>Comment</p>', image: undefined },
        ],
      },
      'MCP',
      { type: 'agent', source: 'Claude (MCP)' }
    );
    expect(result.output).toMatchObject({
      postId: 'post-1',
      previewUrl: expect.stringContaining('/p/post-1'),
    });
  });

  it('asks for something to change', async () => {
    const { tool, postsService } = build();
    const result = await call(tool, { id: 'post-1' });
    expect(result.output.errors).toContain('Nothing to change');
    expect(postsService.updatePostInPlace).not.toHaveBeenCalled();
  });

  it('turns service refusals into errors the client can show', async () => {
    const { tool, postsService } = build();
    postsService.updatePostInPlace.mockRejectedValue(
      new BadRequestException('The new date of a scheduled post must be in the future')
    );
    await expect(
      call(tool, { id: 'post-1', date: '2020-01-01T00:00:00' })
    ).resolves.toEqual({
      output: {
        errors: 'The new date of a scheduled post must be in the future',
      },
    });
  });
});

describe('analytics tools', () => {
  it('analyticsMetricsTool reads the trends of the workspace', async () => {
    const analytics = { getTrends: jest.fn().mockResolvedValue({ collecting: true }) };
    await expect(
      call(new AnalyticsMetricsTool(analytics as any), { days: 7, integrationId: 'int-1' })
    ).resolves.toEqual({ output: { collecting: true } });
    expect(analytics.getTrends).toHaveBeenCalledWith('org-1', 7, 'int-1');
  });

  it('analyticsTopPostsTool passes the ranking and a default limit', async () => {
    const analytics = { getTopPosts: jest.fn().mockResolvedValue({ posts: [] }) };
    await call(new AnalyticsTopPostsTool(analytics as any), {
      days: 30,
      sort: 'views',
      integrationIds: ['int-1'],
    });
    expect(analytics.getTopPosts).toHaveBeenCalledWith('org-1', 30, {
      sort: 'views',
      order: undefined,
      integrations: ['int-1'],
      limit: 10,
    });
  });

  it('bestTimeToPostTool narrows to a network in the given timezone', async () => {
    const analytics = { getBestTimes: jest.fn().mockResolvedValue({ bestHours: [] }) };
    await call(new BestTimeToPostTool(analytics as any), {
      days: 90,
      timezone: 'Asia/Dubai',
      platform: 'linkedin',
    });
    expect(analytics.getBestTimes).toHaveBeenCalledWith(
      'org-1',
      90,
      'Asia/Dubai',
      expect.any(Date),
      { provider: 'linkedin', integrationIds: undefined }
    );
  });

  it('bestTimeToPostTool refuses an unknown timezone', async () => {
    const analytics = { getBestTimes: jest.fn() };
    const result = await call(new BestTimeToPostTool(analytics as any), {
      days: 90,
      timezone: 'Mars/Olympus',
    });
    expect(result.output.errors).toContain('Unknown timezone');
    expect(analytics.getBestTimes).not.toHaveBeenCalled();
  });

  it('channelAnalyticsTool reads a channel without ever disconnecting it', async () => {
    const integrations = { checkAnalytics: jest.fn().mockResolvedValue([{ label: 'Followers' }]) };
    const posts = { checkPostAnalytics: jest.fn() };
    const result = await call(
      new ChannelAnalyticsTool(integrations as any, posts as any),
      { integrationId: 'int-1', days: 7 }
    );
    expect(result).toEqual({ output: [{ label: 'Followers' }] });
    expect(integrations.checkAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'org-1' }),
      'int-1',
      '7',
      false,
      'soft'
    );
  });

  it('channelAnalyticsTool reads one post, and needs exactly one id', async () => {
    const integrations = { checkAnalytics: jest.fn() };
    const posts = {
      checkPostAnalytics: jest.fn().mockResolvedValue({ missing: true }),
    };
    const tool = new ChannelAnalyticsTool(integrations as any, posts as any);
    await expect(call(tool, { postId: 'post-1', days: 30 })).resolves.toEqual({
      output: [],
    });
    expect(posts.checkPostAnalytics).toHaveBeenCalledWith('org-1', 'post-1', 30);
    expect((await call(tool, { days: 30 })).output.errors).toBeDefined();
    expect(
      (await call(tool, { days: 30, postId: 'a', integrationId: 'b' })).output.errors
    ).toBeDefined();
  });

  it('channelAnalyticsTool caps the live reads of a workspace per hour', async () => {
    const integrations = { checkAnalytics: jest.fn().mockResolvedValue([]) };
    const posts = { checkPostAnalytics: jest.fn().mockResolvedValue([]) };
    const tool = new ChannelAnalyticsTool(integrations as any, posts as any);
    const counts = new Map<string, number>();
    const redis = {
      incr: jest.fn(async (key: string) => {
        counts.set(key, (counts.get(key) || 0) + 1);
        return counts.get(key)!;
      }),
      expire: jest.fn().mockResolvedValue(1),
      ttl: jest.fn().mockResolvedValue(3000),
    };
    tool.redis = redis as any;

    for (let i = 0; i < CHANNEL_ANALYTICS_HOURLY_LIMIT; i++) {
      const input = i % 2 ? { postId: 'post-1', days: 7 } : { integrationId: 'int-1', days: 7 };
      expect((await call(tool, input)).output.errors).toBeUndefined();
    }
    const refused = await call(tool, { integrationId: 'int-1', days: 7 });

    expect(refused.output.errors).toContain(
      `reached ${CHANNEL_ANALYTICS_HOURLY_LIMIT} live analytics reads`
    );
    expect(
      integrations.checkAnalytics.mock.calls.length +
        posts.checkPostAnalytics.mock.calls.length
    ).toBe(CHANNEL_ANALYTICS_HOURLY_LIMIT);
    expect(redis.incr).toHaveBeenCalledWith('mcp-channel-analytics:org-1');
    // the window starts with the first read only
    expect(redis.expire).toHaveBeenCalledTimes(1);
    expect(redis.expire).toHaveBeenCalledWith('mcp-channel-analytics:org-1', 3600);
  });

  it('channelAnalyticsTool sets the window again when its expiry was lost', async () => {
    const integrations = { checkAnalytics: jest.fn().mockResolvedValue([]) };
    const tool = new ChannelAnalyticsTool(integrations as any, {} as any);
    const redis = {
      // a key left without a TTL after a crash between incr and expire
      incr: jest.fn().mockResolvedValue(7),
      ttl: jest.fn().mockResolvedValue(-1),
      expire: jest.fn().mockResolvedValue(1),
    };
    tool.redis = redis as any;

    await call(tool, { integrationId: 'int-1', days: 7 });

    expect(redis.expire).toHaveBeenCalledWith('mcp-channel-analytics:org-1', 3600);
  });

  it('channelAnalyticsTool keeps reading when the limit can not be checked', async () => {
    const integrations = { checkAnalytics: jest.fn().mockResolvedValue([{ label: 'Views' }]) };
    const tool = new ChannelAnalyticsTool(integrations as any, {} as any);
    tool.redis = { incr: jest.fn().mockRejectedValue(new Error('down')) } as any;
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(call(tool, { integrationId: 'int-1', days: 7 })).resolves.toEqual({
      output: [{ label: 'Views' }],
    });
    spy.mockRestore();
  });

  it('read-only tokens can use the analytics tools, but not the post tools', () => {
    for (const name of [
      'analyticsMetricsTool',
      'analyticsTopPostsTool',
      'bestTimeToPostTool',
      'channelAnalyticsTool',
    ]) {
      expect(requiredMcpScope(name)).toBe('mcp:read');
    }
    for (const name of [
      'postUpdateTool',
      'createPostForReviewTool',
      'sendPostForReviewTool',
    ]) {
      expect(requiredMcpScope(name)).toBe('mcp:write');
    }
  });
});


describe('tracked dispatch read receipt', () => {
  it('looks up only returned post IDs and adds no dispatch object to legacy rows', async () => {
    const posts = { getPosts: jest.fn().mockResolvedValue([
      { id: 'tracked', state: 'QUEUE', group: 'group', publishDate: new Date(), integration: { id: 'channel', providerIdentifier: 'fixture', name: 'Fixture' } },
      { id: 'legacy', state: 'DRAFT', group: 'group', publishDate: new Date(), integration: { id: 'channel', providerIdentifier: 'fixture', name: 'Fixture' } },
    ]), getMcpWarnings: jest.fn().mockResolvedValue([]), getMcpDispatchStatuses: jest.fn().mockResolvedValue([{ postId: 'tracked', generation: 2, dispatchState: 'UNKNOWN', dispatchErrorCode: 'START_UNCONFIRMED' }]) };
    const result = await call(new PostsListTool(posts as any), { startDate: '2026-01-01', endDate: '2027-01-01' });
    expect(posts.getMcpDispatchStatuses).toHaveBeenCalledWith('org-1', ['tracked', 'legacy']);
    expect(result.output.posts[0].dispatch).toEqual({ generation: 2, status: 'UNKNOWN', code: 'START_UNCONFIRMED' });
    expect(result.output.posts[1]).not.toHaveProperty('dispatch');
  });
});
