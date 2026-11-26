import { NotFoundException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import dayjs from 'dayjs';

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
import { YoutubeSettingsDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/youtube.settings.dto';
import { isSafePublicHttpsUrl } from '@gitroom/nestjs-libraries/dtos/webhooks/webhook.url.validator';

const previousMcpAdmission = process.env.MCP_V114_ADMISSION_ENABLED;
beforeAll(() => { process.env.MCP_V114_ADMISSION_ENABLED = 'true'; });
afterAll(() => { if (previousMcpAdmission === undefined) delete process.env.MCP_V114_ADMISSION_ENABLED; else process.env.MCP_V114_ADMISSION_ENABLED = previousMcpAdmission; });

const safeUrl = isSafePublicHttpsUrl as jest.Mock;

const makeService = (integrationManager: any = {}) => {
  const postRepository = {
    acquireAgentAdmission: jest.fn().mockResolvedValue({}),
    releaseAgentAdmission: jest.fn().mockResolvedValue({ count: 1 }),
    mcpWorkflowVersion: jest.fn().mockResolvedValue(null),
    getPost: jest.fn(),
    getPosts: jest.fn(),
    createComment: jest.fn().mockResolvedValue({ id: 'c-1' }),
    updateImages: jest.fn(),
  };
  const mediaService = {
    getOrgMediaById: jest.fn(),
    getMediaById: jest.fn(),
    getOrgMediaByPaths: jest.fn().mockResolvedValue([]),
  };
  const service = new PostsService(
    postRepository as any,
    integrationManager,
    {} as any,
    mediaService as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any
  );
  return { service, postRepository, mediaService };
};

describe('PostsService.createPublicComment organization binding', () => {
  const body = { content: 'nice' } as any;

  it('rejects a comment on a post of another organization', async () => {
    const { service, postRepository } = makeService();
    postRepository.getPost.mockResolvedValue({
      id: 'p-1',
      organizationId: 'org-B',
      content: 'x',
      childrenPost: [],
    });

    await expect(
      service.createPublicComment('p-1', body, 'user-1', '1.1.1.1', 'org-A')
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(postRepository.createComment).not.toHaveBeenCalled();
  });

  it('accepts a comment on a post of the caller organization', async () => {
    const { service, postRepository } = makeService();
    postRepository.getPost.mockResolvedValue({
      id: 'p-1',
      organizationId: 'org-A',
      content: 'x',
      childrenPost: [],
    });

    await service.createPublicComment('p-1', body, 'user-1', '1.1.1.1', 'org-A');

    expect(postRepository.createComment).toHaveBeenCalledWith(
      'org-A',
      'user-1',
      'p-1',
      'nice',
      expect.anything()
    );
  });

  it('keeps the public comment flow open to any shared post', async () => {
    const { service, postRepository } = makeService();
    postRepository.getPost.mockResolvedValue({
      id: 'p-1',
      organizationId: 'org-B',
      content: 'x',
      childrenPost: [],
    });

    await service.createPublicComment(
      'p-1',
      { content: 'hi', displayName: 'Guest' } as any,
      null,
      '1.1.1.1'
    );

    expect(postRepository.createComment).toHaveBeenCalledTimes(1);
  });
});

describe('PostsService.updateMedia organization scoping', () => {
  it('resolves media only inside the organization of the post', async () => {
    const { service, mediaService } = makeService();
    mediaService.getOrgMediaById.mockResolvedValue(null);

    const result = await service.updateMedia('post-1', 'org-A', [
      { id: 'foreign-media' },
    ]);

    expect(mediaService.getOrgMediaById).toHaveBeenCalledWith(
      'org-A',
      'foreign-media'
    );
    expect(mediaService.getMediaById).not.toHaveBeenCalled();
    // the foreign media is never attached
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('refreshes an already composed media from the same organization only', async () => {
    const { service, mediaService } = makeService();
    mediaService.getOrgMediaById.mockResolvedValue(null);

    await service.updateMedia('post-1', 'org-A', [
      { id: 'foreign-media', path: '/a.png', name: 'a.png' },
    ]);

    expect(mediaService.getOrgMediaById).toHaveBeenCalledWith(
      'org-A',
      'foreign-media'
    );
    expect(mediaService.getMediaById).not.toHaveBeenCalled();
  });
});

describe('PostsService.getPostsMinified published label', () => {
  const calendarPost = (overrides: Record<string, unknown>) => ({
    id: 'p-1',
    state: 'PUBLISHED',
    image: null,
    settings: JSON.stringify({ content_posting_method: 'UPLOAD' }),
    integration: { providerIdentifier: 'tiktok' },
    ...overrides,
  });
  const integrationManager = {
    getSocialIntegration: (identifier: string) =>
      identifier === 'tiktok'
        ? {
            publishedLabel: (settings: any) =>
              settings.content_posting_method === 'UPLOAD'
                ? 'Sent to TikTok inbox'
                : undefined,
          }
        : {},
  };

  it('labels published posts from the provider and never sends the settings', async () => {
    const { service, postRepository } = makeService(integrationManager);
    postRepository.getPosts.mockResolvedValue([
      calendarPost({ id: 'inbox' }),
      calendarPost({ id: 'queued', state: 'QUEUE' }),
      calendarPost({
        id: 'direct',
        settings: JSON.stringify({ content_posting_method: 'DIRECT_POST' }),
      }),
      calendarPost({ id: 'broken', settings: '{not json' }),
      calendarPost({ id: 'other', integration: { providerIdentifier: 'x' } }),
    ]);

    const { p: posts } = await service.getPostsMinified('org-A', {} as any);

    expect(posts.map((post: any) => [post.i, post.pl])).toEqual([
      ['inbox', 'Sent to TikTok inbox'],
      ['queued', undefined],
      ['direct', undefined],
      ['broken', undefined],
      ['other', undefined],
    ]);
    expect(posts.some((post: any) => 'settings' in post)).toBe(false);
  });
});

describe('PostsService approvals on save', () => {
  const makeApprovalService = (decision: any) => {
    const postRepository = {
    acquireAgentAdmission: jest.fn().mockResolvedValue({}),
    releaseAgentAdmission: jest.fn().mockResolvedValue({ count: 1 }),
    mcpWorkflowVersion: jest.fn().mockResolvedValue(null),
      getPost: jest.fn().mockResolvedValue({ id: 'p-1', integrationId: 'i-1', content: 'hi', publishDate: new Date('2026-12-01T12:00:00Z'), childrenPost: [] }),
      registerMcpFence: jest.fn().mockResolvedValue({}),
      getPostById: jest.fn().mockResolvedValue(null),
      createOrUpdatePost: jest.fn().mockResolvedValue({
        posts: [{ id: 'p-1', state: decision?.hold ? 'DRAFT' : 'QUEUE', content: 'hi' }],
      }),
      holdForReview: jest.fn().mockResolvedValue({ count: 1 }),
      changeState: jest.fn().mockResolvedValue({}),
      changeGroupState: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const policy = {
      assertAgentGuardrails: jest.fn().mockResolvedValue(undefined),
      decide: jest.fn().mockResolvedValue(decision),
      afterSave: jest
        .fn()
        .mockResolvedValue({ submitted: !!decision?.hold }),
      notifyApprovers: jest.fn().mockResolvedValue(undefined),
    };
    const service = new PostsService(
      postRepository as any,
      { getSocialIntegration: () => undefined } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      policy as any,
      { recordPublished: jest.fn() } as any,
      { getProviderPostsLimits: jest.fn().mockResolvedValue(null) } as any
    );
    jest.spyOn(service, 'validatePosts').mockResolvedValue([{ emptyContent: false, valid: true, errors: true, tooLong: false, disabled: false }] as any);
    jest.spyOn(service, 'startWorkflow').mockResolvedValue(undefined);
    jest.spyOn(service, 'detachStaleAnchors').mockResolvedValue(undefined as any);
    return { service, postRepository, policy };
  };

  const body = (type: 'schedule' | 'draft' | 'now' = 'schedule') =>
    ({
      type,
      date: '2026-11-02T10:00:00',
      shortLink: false,
      tags: [],
      posts: [
        {
          integration: { id: 'i-1', name: 'Brand X' },
          group: 'g',
          settings: { __type: 'linkedin' },
          value: [{ id: 'v-1', content: 'hi', image: [] }],
        },
      ],
    } as any);

  const agent = { type: 'agent' as const, source: 'Claude (MCP)' };

  it('checks the agent guardrails before saving anything', async () => {
    const { service, postRepository, policy } = makeApprovalService({ hold: false });
    policy.assertAgentGuardrails.mockRejectedValue(new BadRequestException('blocked'));
    await expect(
      service.createPost('org-1', body(), 'MCP', false, agent)
    ).rejects.toThrow('blocked');
    expect(policy.assertAgentGuardrails).toHaveBeenCalledWith('org-1', agent, ['i-1'], {
      countsTowardLimit: true,
    });
    expect(postRepository.createOrUpdatePost).not.toHaveBeenCalled();
  });

  it('saves a held post as a draft in review, marked with its agent', async () => {
    const decision = { hold: true, approvalStatus: 'IN_REVIEW' };
    const { service, postRepository, policy } = makeApprovalService(decision);
    const output = await service.createPost('org-1', body('now'), 'MCP', false, agent);

    const call = postRepository.createOrUpdatePost.mock.calls[0];
    expect(call[0]).toBe('draft');
    expect(call[1]).toBe('org-1');
    expect(call[call.length - 1]).toEqual({
      approvalStatus: 'IN_REVIEW',
      agentSource: 'Claude (MCP)',
    });
    // a draft never starts publishing, startWorkflow only stops old runs
    expect(service.startWorkflow).toHaveBeenCalledWith('linkedin', 'p-1', 'org-1', 'DRAFT');
    expect(policy.afterSave).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({ id: 'p-1' }),
      agent,
      { created: true, decision, notify: false }
    );
    // approvers hear about the whole save once
    expect(policy.notifyApprovers).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({ id: 'p-1' }),
      'Claude (MCP)',
      1
    );
    expect(output[0]).toMatchObject({ postId: 'p-1', approvalStatus: 'IN_REVIEW' });
  });

  it('schedules a public API post that is not held, keeping its source and the guardrails', async () => {
    const apiAgent = { type: 'agent' as const, source: 'Public API key', viaApi: true };
    const { service, postRepository, policy } = makeApprovalService({ hold: false });
    await service.createPost('org-1', body(), 'API', false, apiAgent);
    expect(policy.assertAgentGuardrails).toHaveBeenCalledWith('org-1', apiAgent, ['i-1'], {
      countsTowardLimit: true,
    });
    const call = postRepository.createOrUpdatePost.mock.calls[0];
    expect(call[0]).toBe('schedule');
    expect(call[call.length - 1]).toEqual({
      approvalStatus: undefined,
      agentSource: 'Public API key',
    });
  });

  it('keeps the old behaviour when nobody is passed (auto post, internal callers)', async () => {
    const { service, postRepository, policy } = makeApprovalService(undefined);
    await service.createPost('org-1', body(), 'AUTOPOST');
    expect(policy.decide).not.toHaveBeenCalled();
    expect(policy.assertAgentGuardrails).not.toHaveBeenCalled();
    const call = postRepository.createOrUpdatePost.mock.calls[0];
    expect(call[0]).toBe('schedule');
    expect(call[call.length - 1]).toEqual({
      approvalStatus: undefined,
      agentSource: undefined,
    });
  });

  it('an agent update must point at an existing post', async () => {
    const { service, postRepository } = makeApprovalService({ hold: false });
    await expect(
      service.createPost('org-1', body('update' as any), 'API', false, agent)
    ).rejects.toThrow('This post was not found');
    expect(postRepository.createOrUpdatePost).not.toHaveBeenCalled();
  });

  it('an agent update held for review stops the waiting workflow', async () => {
    const decision = { hold: true, approvalStatus: 'IN_REVIEW', previous: 'APPROVED' };
    const { service, postRepository } = makeApprovalService(decision);
    postRepository.getPostById.mockResolvedValue({
      id: 'v-1',
      state: 'QUEUE',
      approvalStatus: 'APPROVED',
    });
    await service.createPost('org-1', body('update' as any), 'API', true, agent);
    expect(postRepository.createOrUpdatePost.mock.calls[0][0]).toBe('draft');
    expect(service.startWorkflow).toHaveBeenCalledWith('linkedin', 'p-1', 'org-1', 'DRAFT');
  });

  it('an agent cannot hold a post that is already published', async () => {
    const decision = { hold: true, approvalStatus: 'IN_REVIEW' };
    const { service, postRepository } = makeApprovalService(decision);
    postRepository.getPostById.mockResolvedValue({
      id: 'p-1',
      group: 'g-1',
      state: 'PUBLISHED',
      approvalStatus: 'NONE',
      integrationId: 'i-1',
      integration: { providerIdentifier: 'x' },
    });
    await expect(
      service.changePostStatus('org-1', 'p-1', 'schedule', agent)
    ).rejects.toThrow('already published');
    expect(postRepository.holdForReview).not.toHaveBeenCalled();
  });

  it('an agent scheduling a draft through the API puts it in review instead', async () => {
    const decision = { hold: true, approvalStatus: 'IN_REVIEW', previous: 'NONE' };
    const { service, postRepository, policy } = makeApprovalService(decision);
    postRepository.getPostById.mockResolvedValue({
      id: 'p-1',
      group: 'g-1',
      state: 'DRAFT',
      approvalStatus: 'NONE',
      content: 'hi',
      integration: { name: 'Brand X', providerIdentifier: 'x' },
    });
    const result = await service.changePostStatus('org-1', 'p-1', 'schedule', agent);
    expect(postRepository.holdForReview).toHaveBeenCalledWith('org-1', 'g-1');
    expect(postRepository.changeState).not.toHaveBeenCalled();
    expect(postRepository.changeGroupState).not.toHaveBeenCalled();
    expect(policy.afterSave).toHaveBeenCalled();
    expect(result).toMatchObject({ state: 'DRAFT', approvalStatus: 'IN_REVIEW' });
  });
});

describe('PostsService TikTok Direct Post outside the composer', () => {
  // the real TikTok rules, every other network has none
  const { TiktokProvider } = jest.requireActual(
    '@gitroom/nestjs-libraries/integrations/social/tiktok.provider'
  );
  const tiktok = new TiktokProvider();
  const makeTikTokService = () => {
    const postRepository = {
      getPostById: jest.fn().mockResolvedValue(null),
      createOrUpdatePost: jest.fn().mockResolvedValue({
        posts: [{ id: 'p-1', state: 'QUEUE', content: 'hi' }],
      }),
      acquireAgentAdmission: jest.fn().mockResolvedValue({}),
      releaseAgentAdmission: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const integrationService = {
      getIntegrationById: jest.fn(async (_org: string, id: string) =>
        id === 'i-tiktok' ? { id, providerIdentifier: 'tiktok' } : null
      ),
    };
    const service = new PostsService(
      postRepository as any,
      {
        getSocialIntegration: (identifier: string) =>
          identifier === 'tiktok' ? tiktok : undefined,
      } as any,
      integrationService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        assertAgentGuardrails: jest.fn().mockResolvedValue(undefined),
        decide: jest.fn().mockResolvedValue({ hold: false }),
        afterSave: jest.fn().mockResolvedValue({ submitted: false }),
        notifyApprovers: jest.fn().mockResolvedValue(undefined),
      } as any,
      { recordPublished: jest.fn() } as any,
      { getProviderPostsLimits: jest.fn().mockResolvedValue(null) } as any
    );
    jest.spyOn(service, 'startWorkflow').mockResolvedValue(undefined);
    jest.spyOn(service, 'detachStaleAnchors').mockResolvedValue(undefined as any);
    jest.spyOn(service, 'validatePosts').mockResolvedValue([{ emptyContent: false, valid: true, errors: true, tooLong: false, disabled: false }] as any);
    return { service, postRepository, integrationService };
  };

  const directPost = {
    __type: 'tiktok',
    content_posting_method: 'DIRECT_POST',
    privacy_level: 'PUBLIC_TO_EVERYONE',
    music_usage_consent: true,
    creator_info_verified: true,
  };
  const body = (settings: any) =>
    ({
      type: 'schedule',
      date: '2026-12-02T10:00:00',
      shortLink: false,
      tags: [],
      posts: [
        {
          integration: { id: 'i-tiktok' },
          group: 'g',
          settings,
          value: [{ id: 'v-1', content: 'hi', image: [] }],
        },
      ],
    } as any);
  // the post argument of the save
  const savedSettings = (postRepository: any) =>
    postRepository.createOrUpdatePost.mock.calls[0].find(
      (arg: any) => arg && typeof arg === 'object' && 'settings' in arg
    )?.settings;
  const agent = { type: 'agent' as const, source: 'Claude (MCP)' };

  it.each(['API', 'CLI', 'MCP', 'AUTOPOST'] as const)(
    'refuses a %s Direct Post with the reason, and saves nothing',
    async (method) => {
      const { service, postRepository } = makeTikTokService();
      await expect(
        service.createPost('org-1', body(directPost), method, false, agent)
      ).rejects.toThrow(
        'TikTok: TikTok Direct Post is only available in the PostDelegate composer'
      );
      expect(postRepository.createOrUpdatePost).not.toHaveBeenCalled();
    }
  );

  it('refuses a Direct Post saved by bulk or import (WEB, not the composer)', async () => {
    const { service, postRepository } = makeTikTokService();
    await expect(
      service.createPost('org-1', body(directPost), 'WEB', false, {
        type: 'user',
      } as any)
    ).rejects.toThrow('only available in the PostDelegate composer');
    expect(postRepository.createOrUpdatePost).not.toHaveBeenCalled();
  });

  it('sends a post without a method to the inbox and drops self-made consent', async () => {
    const { service, postRepository } = makeTikTokService();
    await service.createPost(
      'org-1',
      body({ __type: 'tiktok', music_usage_consent: true, creator_info_verified: true }),
      'API',
      false,
      agent
    );
    expect(savedSettings(postRepository)).toEqual({
      __type: 'tiktok',
      content_posting_method: 'UPLOAD',
    });
  });

  it('keeps the composer Direct Post exactly as the composer sent it', async () => {
    const { service, postRepository } = makeTikTokService();
    await service.createPost(
      'org-1',
      body(directPost),
      'WEB',
      false,
      { type: 'user' } as any,
      undefined,
      undefined,
      true
    );
    expect(savedSettings(postRepository)).toEqual(directPost);
  });

  it('applies the rule of the channel when a request carries no __type yet', async () => {
    const { service, integrationService } = makeTikTokService();
    await expect(
      service.applyOutsideComposerRules('org-1', [
        {
          integration: { id: 'i-tiktok' },
          settings: { content_posting_method: 'DIRECT_POST' },
        },
      ])
    ).rejects.toThrow('only available in the PostDelegate composer');
    expect(integrationService.getIntegrationById).toHaveBeenCalledWith(
      'org-1',
      'i-tiktok'
    );
  });

  it('leaves other networks alone without a lookup', async () => {
    const { service, integrationService } = makeTikTokService();
    const posts = [
      { integration: { id: 'i-x' }, settings: { __type: 'x', who: 'me' } },
    ];
    expect(await service.applyOutsideComposerRules('org-1', posts)).toEqual(
      posts
    );
    expect(integrationService.getIntegrationById).not.toHaveBeenCalled();
  });
});

describe('PostsService status and date changes', () => {
  const future = () => new Date(Date.now() + 24 * 3600 * 1000);
  const past = () => new Date(Date.now() - 3600 * 1000);

  const stored = (over: Record<string, any> = {}) => ({
    id: 'p-1',
    group: 'g-1',
    state: 'DRAFT',
    approvalStatus: 'NONE',
    publishDate: future(),
    deletedAt: null,
    parentPostId: null,
    content: 'hi',
    integrationId: 'i-1',
    integration: { id: 'i-1', name: 'Brand X', providerIdentifier: 'linkedin-page' },
    ...over,
  });

  const makeStateService = (decision: any = { hold: false }) => {
    const postRepository = {
    acquireAgentAdmission: jest.fn().mockResolvedValue({}),
    releaseAgentAdmission: jest.fn().mockResolvedValue({ count: 1 }),
    mcpWorkflowVersion: jest.fn().mockResolvedValue(null),
      getPostById: jest.fn().mockResolvedValue(stored()),
      changeGroupState: jest.fn().mockResolvedValue({ count: 2 }),
      changeState: jest.fn().mockResolvedValue({}),
      changeDate: jest.fn().mockResolvedValue({ id: 'p-1' }),
      holdForReview: jest.fn().mockResolvedValue({ count: 2 }),
      createOrUpdatePost: jest.fn(),
    };
    const policy = {
      assertAgentGuardrails: jest.fn().mockResolvedValue(undefined),
      decide: jest.fn().mockResolvedValue(decision),
      afterSave: jest.fn().mockResolvedValue({ submitted: !!decision?.hold }),
      notifyApprovers: jest.fn().mockResolvedValue(undefined),
    };
    const service = new PostsService(
      postRepository as any,
      { getSocialIntegration: () => undefined } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      policy as any,
      { recordPublished: jest.fn() } as any,
      { getProviderPostsLimits: jest.fn().mockResolvedValue(null) } as any
    );
    jest.spyOn(service, 'validatePosts').mockResolvedValue([{ emptyContent: false, valid: true, errors: true, tooLong: false, disabled: false }] as any);
    jest.spyOn(service, 'startWorkflow').mockResolvedValue(undefined);
    jest.spyOn(service, 'detachStaleAnchors').mockResolvedValue(undefined as any);
    return { service, postRepository, policy };
  };

  const member = { type: 'user' as const, userId: 'u-1', role: 'USER', name: 'Sam' };

  describe('changePostStatus', () => {
    it('schedules the post and its comments together and starts the workflow', async () => {
      const { service, postRepository } = makeStateService();
      const result = await service.changePostStatus('org-1', 'p-1', 'schedule');
      expect(postRepository.changeGroupState).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ id: 'p-1', group: 'g-1', integrationId: 'i-1' }),
        'QUEUE',
        false
      );
      expect(postRepository.changeState).not.toHaveBeenCalled();
      expect(service.startWorkflow).toHaveBeenCalledWith('linkedin', 'p-1', 'org-1', 'QUEUE');
      expect(result).toEqual({ id: 'p-1', state: 'QUEUE' });
    });

    it('does not schedule a published post again without republish', async () => {
      const { service, postRepository } = makeStateService();
      postRepository.getPostById.mockResolvedValue(stored({ state: 'PUBLISHED' }));
      await expect(
        service.changePostStatus('org-1', 'p-1', 'schedule')
      ).rejects.toThrow('pass republish: true');
      await expect(
        service.changePostStatus('org-1', 'p-1', 'draft')
      ).rejects.toThrow('already published');
      expect(postRepository.changeGroupState).not.toHaveBeenCalled();
      expect(service.startWorkflow).not.toHaveBeenCalled();

      await service.changePostStatus('org-1', 'p-1', 'schedule', undefined, true);
      // republish lets the write change a published post
      expect(postRepository.changeGroupState).toHaveBeenCalledWith(
        'org-1',
        expect.anything(),
        'QUEUE',
        true
      );
    });

    it('does not schedule again a post that is being published, but can stop it', async () => {
      const { service, postRepository } = makeStateService();
      postRepository.getPostById.mockResolvedValue(
        stored({ state: 'QUEUE', publishDate: past() })
      );
      await expect(
        service.changePostStatus('org-1', 'p-1', 'schedule')
      ).rejects.toThrow('already being published');
      expect(postRepository.changeGroupState).not.toHaveBeenCalled();
      expect(service.startWorkflow).not.toHaveBeenCalled();

      // a draft stops it, the safe direction
      await service.changePostStatus('org-1', 'p-1', 'draft');
      expect(postRepository.changeGroupState).toHaveBeenCalledWith(
        'org-1',
        expect.anything(),
        'DRAFT',
        false
      );
      expect(service.startWorkflow).toHaveBeenCalledWith('linkedin', 'p-1', 'org-1', 'DRAFT');
    });

    it('refuses a deleted post or a comment, and never notifies about them', async () => {
      const agent = { type: 'agent' as const, source: 'Public API key', viaApi: true };
      const { service, postRepository, policy } = makeStateService({
        hold: true,
        approvalStatus: 'IN_REVIEW',
      });
      postRepository.getPostById.mockResolvedValue(stored({ deletedAt: new Date() }));
      await expect(
        service.changePostStatus('org-1', 'p-1', 'schedule', agent)
      ).rejects.toThrow('Post not found');

      postRepository.getPostById.mockResolvedValue(stored({ parentPostId: 'p-0' }));
      await expect(
        service.changePostStatus('org-1', 'p-1', 'schedule', agent)
      ).rejects.toThrow('belongs to a comment');

      postRepository.getPostById.mockResolvedValue(null);
      await expect(
        service.changePostStatus('org-1', 'p-1', 'schedule', agent)
      ).rejects.toThrow('Post not found');

      expect(postRepository.holdForReview).not.toHaveBeenCalled();
      expect(policy.afterSave).not.toHaveBeenCalled();
    });
  });

  describe('changeDate', () => {
    it('answers a missing post with a 400 instead of crashing', async () => {
      const { service, postRepository } = makeStateService();
      postRepository.getPostById.mockResolvedValue(null);
      await expect(
        service.changeDate('org-1', 'p-1', '2030-01-01T10:00:00', 'update')
      ).rejects.toMatchObject({ status: 400 });
      expect(postRepository.changeDate).not.toHaveBeenCalled();
    });

    it('restarts the workflow of a queued post it moves, so it fires at the new time', async () => {
      const { service, postRepository } = makeStateService();
      postRepository.getPostById.mockResolvedValue(stored({ state: 'QUEUE' }));
      await service.changeDate('org-1', 'p-1', '2030-01-01T10:00:00', 'update');
      expect(postRepository.changeDate).toHaveBeenCalledWith(
        'org-1',
        'p-1',
        '2030-01-01T10:00:00',
        false,
        'update'
      );
      expect(service.startWorkflow).toHaveBeenCalledWith('linkedin', 'p-1', 'org-1', 'QUEUE');
    });

    it('leaves the workflow alone when a draft or a published post only moves', async () => {
      const { service, postRepository } = makeStateService();
      await service.changeDate('org-1', 'p-1', '2030-01-01T10:00:00', 'update');
      postRepository.getPostById.mockResolvedValue(stored({ state: 'PUBLISHED' }));
      await service.changeDate('org-1', 'p-1', '2030-01-01T10:00:00', 'update');
      expect(postRepository.changeDate).toHaveBeenCalledTimes(2);
      expect(service.startWorkflow).not.toHaveBeenCalled();
    });

    it('does not reschedule a post that is being published unless asked to publish it again', async () => {
      const { service, postRepository } = makeStateService();
      postRepository.getPostById.mockResolvedValue(
        stored({ state: 'QUEUE', publishDate: past() })
      );
      await expect(
        service.changeDate('org-1', 'p-1', '2030-01-01T10:00:00', 'schedule')
      ).rejects.toThrow('already being published');
      expect(postRepository.changeDate).not.toHaveBeenCalled();

      await service.changeDate('org-1', 'p-1', '2030-01-01T10:00:00', 'schedule', true);
      expect(service.startWorkflow).toHaveBeenCalledWith('linkedin', 'p-1', 'org-1', 'QUEUE');
    });

    it('only moves the date of a post that is being published, its workflow keeps running', async () => {
      const { service, postRepository } = makeStateService();
      postRepository.getPostById.mockResolvedValue(
        stored({ state: 'QUEUE', publishDate: past() })
      );
      await service.changeDate('org-1', 'p-1', '2030-01-01T10:00:00', 'update');
      expect(postRepository.changeDate).toHaveBeenCalledWith(
        'org-1',
        'p-1',
        '2030-01-01T10:00:00',
        false,
        'update'
      );
      expect(service.startWorkflow).not.toHaveBeenCalled();
    });

    it('tells a member that publishing a post again needs an approver', async () => {
      const decision = { hold: true, approvalStatus: 'IN_REVIEW', previous: 'NONE' };
      const { service, postRepository } = makeStateService(decision);
      postRepository.getPostById.mockResolvedValue(stored({ state: 'PUBLISHED' }));
      await expect(
        service.changeDate('org-1', 'p-1', '2030-01-01T10:00:00', 'schedule', true, member)
      ).rejects.toThrow('Publishing it again needs an approver');
      expect(postRepository.changeDate).not.toHaveBeenCalled();
      expect(postRepository.holdForReview).not.toHaveBeenCalled();
    });

    it('holds a failed post queued again by someone who cannot approve', async () => {
      const decision = { hold: true, approvalStatus: 'IN_REVIEW', previous: 'NONE' };
      const { service, postRepository, policy } = makeStateService(decision);
      postRepository.getPostById.mockResolvedValue(stored({ state: 'ERROR' }));
      const result = await service.changeDate(
        'org-1',
        'p-1',
        '2030-01-01T10:00:00',
        'schedule',
        false,
        member
      );
      expect(policy.decide).toHaveBeenCalledWith(
        'org-1',
        member,
        'schedule',
        expect.objectContaining({ id: 'p-1', state: 'ERROR' })
      );
      // the new time is kept, the state is left to the hold
      expect(postRepository.changeDate).toHaveBeenCalledWith(
        'org-1',
        'p-1',
        '2030-01-01T10:00:00',
        true,
        'update'
      );
      expect(postRepository.holdForReview).toHaveBeenCalledWith('org-1', 'g-1');
      expect(service.startWorkflow).toHaveBeenCalledWith('linkedin', 'p-1', 'org-1', 'DRAFT');
      expect(service.startWorkflow).not.toHaveBeenCalledWith(
        'linkedin',
        'p-1',
        'org-1',
        'QUEUE'
      );
      expect(result).toMatchObject({ state: 'DRAFT', approvalStatus: 'IN_REVIEW' });
    });

    it('asks the approval rules only when a post is queued again', async () => {
      const { service, postRepository, policy } = makeStateService();
      postRepository.getPostById.mockResolvedValue(stored({ state: 'QUEUE' }));
      await service.changeDate('org-1', 'p-1', '2030-01-01T10:00:00', 'schedule', false, member);
      await service.changeDate('org-1', 'p-1', '2030-01-01T10:00:00', 'update', false, member);
      expect(policy.decide).not.toHaveBeenCalled();

      postRepository.getPostById.mockResolvedValue(stored({ state: 'ERROR' }));
      await service.changeDate('org-1', 'p-1', '2030-01-01T10:00:00', 'schedule', false, member);
      expect(policy.decide).toHaveBeenCalledTimes(1);
      expect(service.startWorkflow).toHaveBeenLastCalledWith('linkedin', 'p-1', 'org-1', 'QUEUE');
    });
  });

  describe('createPost with type update', () => {
    const update = (date: string) =>
      ({
        type: 'update',
        date,
        shortLink: false,
        tags: [],
        posts: [
          {
            integration: { id: 'i-1' },
            group: 'g-1',
            settings: { __type: 'linkedin' },
            value: [{ id: 'p-1', content: 'hi', image: [] }],
          },
        ],
      } as any);

    it('restarts the workflow of a queued post whose time it moved', async () => {
      const { service, postRepository } = makeStateService();
      const before = future();
      const after = new Date(before.getTime() + 3600 * 1000);
      postRepository.getPostById.mockResolvedValue(
        stored({ state: 'QUEUE', publishDate: before })
      );
      postRepository.createOrUpdatePost.mockResolvedValue({
        posts: [{ id: 'p-1', state: 'QUEUE', publishDate: after, content: 'hi' }],
      });
      await service.createPost('org-1', update(after.toISOString()), 'API');
      expect(service.startWorkflow).toHaveBeenCalledWith('linkedin', 'p-1', 'org-1', 'QUEUE');
    });

    it('leaves the workflow alone when the time did not change', async () => {
      const { service, postRepository } = makeStateService();
      const at = future();
      postRepository.getPostById.mockResolvedValue(
        stored({ state: 'QUEUE', publishDate: at })
      );
      postRepository.createOrUpdatePost.mockResolvedValue({
        posts: [{ id: 'p-1', state: 'QUEUE', publishDate: at, content: 'hi' }],
      });
      await service.createPost('org-1', update(at.toISOString()), 'API');
      expect(service.startWorkflow).not.toHaveBeenCalled();
    });
  });

  it('logs a publish workflow that could not start instead of hiding it', async () => {
    const temporal = {
      client: {
        getRawClient: () => ({
          workflow: {
            list: () => (async function* () {})(),
            start: jest.fn().mockRejectedValue(new Error('temporal down')),
          },
        }),
      },
    };
    const service = new PostsService(
      { mcpWorkflowVersion: jest.fn().mockResolvedValue(null) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      temporal as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
    const error = jest
      .spyOn((service as any)._logger, 'error')
      .mockImplementation(() => undefined);
    await expect(
      service.startWorkflow('linkedin', 'p-1', 'org-1', 'QUEUE')
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('p-1'));
  });
});

describe('PostsService monthly cap on one network', () => {
  // a subscription started on the 1st, so the plan month is the calendar month
  const anchor = dayjs().startOf('month').subtract(3, 'month').toDate();
  const monthStart = dayjs().startOf('month').toDate();
  const nextMonth = dayjs(monthStart).add(1, 'month');

  const makeLimitService = (
    limits: Record<string, number> | null = { x: 30 },
    usage = 0,
    queued = 0,
    stored: any[] = []
  ) => {
    const postRepository = {
    acquireAgentAdmission: jest.fn().mockResolvedValue({}),
    releaseAgentAdmission: jest.fn().mockResolvedValue({ count: 1 }),
    mcpWorkflowVersion: jest.fn().mockResolvedValue(null),
      countProviderUsage: jest.fn().mockResolvedValue(usage),
      countQueuedProviderPosts: jest.fn().mockResolvedValue(queued),
      getPostsState: jest.fn().mockResolvedValue(stored),
      recordProviderUsage: jest.fn().mockResolvedValue({ count: 1 }),
      getPostById: jest.fn(),
      changeDate: jest.fn().mockResolvedValue({}),
      changeState: jest.fn().mockResolvedValue({}),
      changeGroupState: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const subscriptionService = {
      getProviderPostsLimits: jest
        .fn()
        .mockResolvedValue(limits ? { plan: 'Starter', limits, anchor } : null),
    };
    // the live trial status, asked only when the trial cap alone refuses
    const paymentService = { isTrialing: jest.fn().mockResolvedValue(false) };
    const integrationService = {
      getIntegrationsList: jest.fn().mockResolvedValue([
        { id: 'i-x', providerIdentifier: 'x' },
        { id: 'i-own', providerIdentifier: 'x-own-key' },
        { id: 'i-li', providerIdentifier: 'linkedin' },
      ]),
    };
    const integrationManager = {
      getSocialIntegration: (identifier: string) =>
        identifier === 'x'
          ? {
              name: 'X',
              planLimitHint: 'Or bring your own key.',
              planRepeatHint: 'Repeats on X need your own key.',
            }
          : undefined,
    };
    const service = new PostsService(
      postRepository as any,
      integrationManager as any,
      integrationService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      subscriptionService as any,
      paymentService as any
    );
    jest.spyOn(service, 'validatePosts').mockResolvedValue([{ emptyContent: false, valid: true, errors: true, tooLong: false, disabled: false }] as any);
    jest.spyOn(service, 'startWorkflow').mockResolvedValue(undefined);
    return { service, postRepository, subscriptionService, paymentService };
  };

  const post = (integration: string, values: number, ids = false) => ({
    integration: { id: integration },
    // the client can claim any network, the channel's own one is counted
    settings: { __type: 'linkedin' },
    value: [...new Array(values)].map((_, i) => ({
      ...(ids ? { id: `${integration}-${i}` } : {}),
      content: 'hi',
    })),
  });

  const queuedRow = (id: string, publishDate = new Date()) => ({
    id,
    state: 'QUEUE',
    publishDate,
    deletedAt: null,
  });

  describe('when a post is saved', () => {
    it('lets a post through while the month has room', async () => {
      const { service, postRepository } = makeLimitService({ x: 30 }, 20, 7);
      await service.checkProviderPostsLimit('org-1', {
        type: 'schedule',
        posts: [post('i-x', 3)],
      });
      expect(postRepository.countProviderUsage).toHaveBeenCalledWith(
        'org-1',
        'x',
        monthStart,
        nextMonth.toDate()
      );
      expect(postRepository.countQueuedProviderPosts).toHaveBeenCalledWith(
        'org-1',
        'x',
        monthStart,
        nextMonth.toDate(),
        []
      );
    });

    it('counts published and queued posts and every post of a thread', async () => {
      const { service } = makeLimitService({ x: 30 }, 20, 8);
      await expect(
        service.checkProviderPostsLimit('org-1', {
          type: 'schedule',
          posts: [post('i-x', 3)],
        })
      ).rejects.toMatchObject({
        status: 402,
        message:
          'Only 2 of your 30 X posts for this month on the Starter plan are left, and this needs 3 (every post of a thread counts). Or bring your own key.',
      });
    });

    it('says the month is used up when nothing is left', async () => {
      const { service } = makeLimitService({ x: 30 }, 30);
      await expect(
        service.checkProviderPostsLimit('org-1', {
          type: 'now',
          posts: [post('i-x', 1)],
        })
      ).rejects.toMatchObject({
        message:
          "You've used your 30 X posts for this month on the Starter plan. Or bring your own key.",
      });
    });

    it('adds up the channels of the same network in one save', async () => {
      const { service, postRepository } = makeLimitService({ x: 30 }, 28);
      await expect(
        service.checkProviderPostsLimit('org-1', {
          type: 'schedule',
          posts: [post('i-x', 1), post('i-x', 2)],
        })
      ).rejects.toMatchObject({ status: 402 });
      expect(postRepository.countProviderUsage).toHaveBeenCalledTimes(1);
    });

    it('counts a passed date in the current plan month', async () => {
      const { service, postRepository } = makeLimitService({ x: 30 }, 0);
      await service.checkProviderPostsLimit('org-1', {
        type: 'schedule',
        date: dayjs(anchor).subtract(1, 'year').format('YYYY-MM-DDTHH:mm:ss'),
        posts: [post('i-x', 1)],
      });
      expect(postRepository.countProviderUsage).toHaveBeenCalledWith(
        'org-1',
        'x',
        monthStart,
        nextMonth.toDate()
      );
    });

    it('counts a post in the plan month it publishes in', async () => {
      const { service, postRepository } = makeLimitService({ x: 30 }, 0, 30);
      await expect(
        service.checkProviderPostsLimit('org-1', {
          type: 'schedule',
          date: nextMonth.add(3, 'day').format('YYYY-MM-DDTHH:mm:ss'),
          posts: [post('i-x', 1)],
        })
      ).rejects.toMatchObject({
        message: `You've used your 30 X posts for the plan month starting ${nextMonth.format(
          'MMMM D'
        )} on the Starter plan. Or bring your own key.`,
      });
      expect(postRepository.countQueuedProviderPosts).toHaveBeenCalledWith(
        'org-1',
        'x',
        nextMonth.toDate(),
        nextMonth.add(1, 'month').toDate(),
        []
      );
    });

    it('does not count a queued post saved again in the same month twice', async () => {
      const { service, postRepository } = makeLimitService({ x: 30 }, 30, 0, [
        queuedRow('i-x-0'),
      ]);
      await service.checkProviderPostsLimit('org-1', {
        type: 'schedule',
        posts: [post('i-x', 1, true)],
      });
      expect(postRepository.countProviderUsage).not.toHaveBeenCalled();
    });

    it('counts a republished post again', async () => {
      const published = {
        id: 'i-x-0',
        state: 'PUBLISHED',
        publishDate: new Date(),
        deletedAt: null,
      };
      const full = makeLimitService({ x: 30 }, 30, 0, [published]);
      await expect(
        full.service.checkProviderPostsLimit('org-1', {
          type: 'schedule',
          posts: [post('i-x', 1, true)],
        })
      ).rejects.toMatchObject({ status: 402 });

      const room = makeLimitService({ x: 30 }, 29, 0, [published]);
      await room.service.checkProviderPostsLimit('org-1', {
        type: 'schedule',
        posts: [post('i-x', 1, true)],
      });
    });

    it('does not cap networks the plan does not list, nor the own key variant', async () => {
      const { service, postRepository } = makeLimitService({ x: 0 }, 0);
      await service.checkProviderPostsLimit('org-1', {
        type: 'schedule',
        inter: 7,
        posts: [post('i-own', 5), post('i-li', 5)],
      });
      expect(postRepository.countProviderUsage).not.toHaveBeenCalled();
    });

    it('takes nothing for a draft', async () => {
      const { service, postRepository } = makeLimitService({ x: 0 });
      await service.checkProviderPostsLimit('org-1', {
        type: 'draft',
        posts: [post('i-x', 1)],
      });
      expect(postRepository.countProviderUsage).not.toHaveBeenCalled();
    });

    it('counts the new entries an in-place update queues', async () => {
      const { service } = makeLimitService({ x: 30 }, 30, 0, [
        queuedRow('kept'),
      ]);
      await expect(
        service.checkProviderPostsLimit('org-1', {
          type: 'update',
          posts: [
            {
              integration: { id: 'i-x' },
              value: [{ id: 'kept' }, {}],
            },
          ],
        })
      ).rejects.toMatchObject({ status: 402 });
    });

    it('lets an in-place update of queued posts through at the cap', async () => {
      const { service, postRepository } = makeLimitService({ x: 30 }, 30, 0, [
        queuedRow('kept'),
      ]);
      await service.checkProviderPostsLimit('org-1', {
        type: 'update',
        posts: [{ integration: { id: 'i-x' }, value: [{ id: 'kept' }] }],
      });
      expect(postRepository.countProviderUsage).not.toHaveBeenCalled();
    });

    it('recounts an in-place update that moves to another plan month', async () => {
      const { service } = makeLimitService({ x: 30 }, 0, 30, [
        queuedRow('kept'),
      ]);
      await expect(
        service.checkProviderPostsLimit('org-1', {
          type: 'update',
          date: nextMonth.add(1, 'day').format('YYYY-MM-DDTHH:mm:ss'),
          posts: [{ integration: { id: 'i-x' }, value: [{ id: 'kept' }] }],
        })
      ).rejects.toMatchObject({ status: 402 });
    });

    it('caps nothing without billing', async () => {
      const { service, postRepository } = makeLimitService(null);
      await service.checkProviderPostsLimit('org-1', {
        type: 'schedule',
        inter: 1,
        posts: [post('i-x', 100)],
      });
      expect(postRepository.countProviderUsage).not.toHaveBeenCalled();
    });

    it('falls back to a plain upgrade message for a network without a hint', async () => {
      const { service } = makeLimitService({ linkedin: 1 }, 1);
      await expect(
        service.checkProviderPostsLimit('org-1', {
          type: 'schedule',
          posts: [post('i-li', 1)],
        })
      ).rejects.toMatchObject({
        message:
          "You've used your 1 linkedin posts for this month on the Starter plan. Upgrade your plan to post more.",
      });
    });
  });

  describe('a passed date on a capped network', () => {
    const save = async (
      integration: string,
      type: 'schedule' | 'update' = 'schedule',
      stored: any[] = [],
      value: any = post(integration, 1)
    ) => {
      const { service, postRepository } = makeLimitService(
        { x: 30 },
        0,
        0,
        stored
      );
      (postRepository as any).createOrUpdatePost = jest
        .fn()
        .mockResolvedValue({ posts: [{ id: 'p-1', state: 'QUEUE' }] });
      jest
        .spyOn(service, 'detachStaleAnchors')
        .mockResolvedValue(undefined as any);
      await service.createPost(
        'org-1',
        {
          type,
          date: '2020-01-01T10:00:00',
          shortLink: false,
          tags: [],
          posts: [value],
        } as any,
        'API'
      );
      return (postRepository as any).createOrUpdatePost.mock.calls[0][2];
    };

    it('is stored as now, the plan month it was counted in', async () => {
      expect(dayjs(await save('i-x')).isAfter(dayjs().subtract(1, 'minute'))).toBe(
        true
      );
    });

    it('stays as it is on other networks', async () => {
      expect(await save('i-li')).toBe('2020-01-01T10:00:00');
    });

    it('keeps the date of a published X post when its text is edited', async () => {
      const published = {
        id: 'i-x-0',
        state: 'PUBLISHED',
        publishDate: new Date('2020-01-01T10:00:00'),
        deletedAt: null,
      };
      expect(
        await save('i-x', 'update', [published], post('i-x', 1, true))
      ).toBe('2020-01-01T10:00:00');
    });

    it('still counts a new entry an update adds with a passed date', async () => {
      const { service, postRepository } = makeLimitService({ x: 30 }, 30, 0, [
        {
          id: 'i-x-0',
          state: 'PUBLISHED',
          publishDate: new Date('2020-01-01T10:00:00'),
          deletedAt: null,
        },
      ]);
      await expect(
        service.checkProviderPostsLimit('org-1', {
          type: 'update',
          date: '2020-01-01T10:00:00',
          posts: [{ integration: { id: 'i-x' }, value: [{ id: 'i-x-0' }, {}] }],
        })
      ).rejects.toMatchObject({ status: 402 });
      // counted in the current plan month, not the passed one
      expect(postRepository.countProviderUsage).toHaveBeenCalledWith(
        'org-1',
        'x',
        monthStart,
        nextMonth.toDate()
      );
    });
  });

  describe('repeating and evergreen posts', () => {
    it('are refused on a capped network, even as a draft', async () => {
      for (const type of ['schedule', 'draft'] as const) {
        const { service } = makeLimitService({ x: 30 });
        await expect(
          service.checkProviderPostsLimit('org-1', {
            type,
            inter: 7,
            posts: [post('i-x', 1)],
          })
        ).rejects.toMatchObject({
          status: 400,
          message: 'Repeats on X need your own key.',
        });
      }
    });

    it('stay available with the own key variant', async () => {
      const { service } = makeLimitService({ x: 30 });
      await service.checkRepeatAllowed('org-1', ['i-own']);
      await expect(
        service.checkRepeatAllowed('org-1', ['i-own', 'i-x'])
      ).rejects.toMatchObject({ status: 400 });
    });

    it('are refused when a stored repeating post is queued again', async () => {
      const { service } = makeLimitService({ x: 30 });
      jest
        .spyOn(service, 'getPostsRecursively')
        .mockResolvedValue([
          { id: 'p-1', integrationId: 'i-x', publishDate: new Date(), intervalInDays: 1 },
        ] as any);
      await expect(
        service.checkStoredPostLimit('org-1', 'p-1')
      ).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('when a stored post is queued again', () => {
    const thread = (state: string, publishDate = new Date()) => [
      { id: 'p-1', integrationId: 'i-x', publishDate, intervalInDays: null, state },
      { id: 'p-2', integrationId: 'i-x', publishDate, intervalInDays: null, state },
    ];

    it('checks every post of its thread', async () => {
      const { service, postRepository } = makeLimitService({ x: 30 }, 29);
      jest
        .spyOn(service, 'getPostsRecursively')
        .mockResolvedValue(thread('DRAFT') as any);
      await expect(
        service.checkStoredPostLimit('org-1', 'p-1')
      ).rejects.toMatchObject({ status: 402 });
      expect(postRepository.countQueuedProviderPosts).toHaveBeenCalledWith(
        'org-1',
        'x',
        expect.any(Date),
        expect.any(Date),
        ['p-1', 'p-2']
      );
    });

    it('checks a published post scheduled again through the API', async () => {
      const { service, postRepository } = makeLimitService({ x: 30 }, 30, 0, [
        { id: 'p-1', state: 'PUBLISHED', publishDate: new Date(), deletedAt: null },
      ]);
      postRepository.getPostById.mockResolvedValue({
        id: 'p-1',
        state: 'PUBLISHED',
        integrationId: 'i-x',
        integration: { providerIdentifier: 'x' },
      });
      jest
        .spyOn(service, 'getPostsRecursively')
        .mockResolvedValue([thread('PUBLISHED')[0]] as any);
      // republish: true, a published post is refused before the cap otherwise
      await expect(
        service.changePostStatus('org-1', 'p-1', 'schedule', undefined, true)
      ).rejects.toMatchObject({ status: 402 });
      expect(postRepository.changeGroupState).not.toHaveBeenCalled();
    });

    it('checks a reschedule that moves to a full plan month', async () => {
      const { service, postRepository } = makeLimitService({ x: 30 }, 0, 30, [
        queuedRow('p-1'),
      ]);
      postRepository.getPostById.mockResolvedValue({
        id: 'p-1',
        state: 'QUEUE',
        integration: { providerIdentifier: 'x' },
      });
      jest
        .spyOn(service, 'getPostsRecursively')
        .mockResolvedValue([thread('QUEUE')[0]] as any);
      await expect(
        service.changeDate(
          'org-1',
          'p-1',
          nextMonth.add(2, 'day').format('YYYY-MM-DDTHH:mm:ss'),
          'update'
        )
      ).rejects.toMatchObject({ status: 402 });
      expect(postRepository.changeDate).not.toHaveBeenCalled();
    });

    it('lets a queued post move inside its plan month at the cap', async () => {
      const { service, postRepository } = makeLimitService({ x: 30 }, 30, 0, [
        queuedRow('p-1'),
      ]);
      postRepository.getPostById.mockResolvedValue({
        id: 'p-1',
        state: 'QUEUE',
        integration: { providerIdentifier: 'x' },
      });
      jest
        .spyOn(service, 'getPostsRecursively')
        .mockResolvedValue([thread('QUEUE')[0]] as any);
      const later = dayjs().add(1, 'minute');
      const date = (later.isBefore(nextMonth) ? later : dayjs())
        .format('YYYY-MM-DDTHH:mm:ss');
      await service.changeDate('org-1', 'p-1', date, 'update');
      expect(postRepository.changeDate).toHaveBeenCalled();
    });

    it('checks a published post rescheduled with republish, stored at now for a passed date', async () => {
      const full = makeLimitService({ x: 30 }, 30, 0, []);
      full.postRepository.getPostById.mockResolvedValue({
        id: 'p-1',
        state: 'PUBLISHED',
        integration: { providerIdentifier: 'x' },
      });
      jest
        .spyOn(full.service, 'getPostsRecursively')
        .mockResolvedValue([thread('PUBLISHED')[0]] as any);
      await expect(
        full.service.changeDate('org-1', 'p-1', '2020-01-01T10:00:00', 'schedule', true)
      ).rejects.toMatchObject({ status: 402 });

      const room = makeLimitService({ x: 30 }, 0, 0, []);
      room.postRepository.getPostById.mockResolvedValue({
        id: 'p-1',
        state: 'PUBLISHED',
        integration: { providerIdentifier: 'x' },
      });
      jest
        .spyOn(room.service, 'getPostsRecursively')
        .mockResolvedValue([thread('PUBLISHED')[0]] as any);
      await room.service.changeDate(
        'org-1',
        'p-1',
        '2020-01-01T10:00:00',
        'schedule',
        true
      );
      const stored = room.postRepository.changeDate.mock.calls[0][2];
      expect(dayjs(stored).isAfter(dayjs().subtract(1, 'minute'))).toBe(true);
    });

    it('does not check a draft that only moves', async () => {
      const { service, postRepository } = makeLimitService({ x: 0 });
      postRepository.getPostById.mockResolvedValue({
        id: 'p-1',
        state: 'DRAFT',
        integration: { providerIdentifier: 'x' },
      });
      const spy = jest.spyOn(service, 'checkStoredPostLimit');
      await service.changeDate('org-1', 'p-1', '2030-01-01T10:00:00', 'schedule');
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // An Ultimate subscription marked isTrailing: a real trial, or a paid one
  // whose renewal Stripe is retrying (past_due), which keeps the plan's cap
  describe('a trial', () => {
    const trialPlan = (service: any, subscriptionService: any) => {
      subscriptionService.getProviderPostsLimits.mockResolvedValue({
        plan: 'Ultimate',
        limits: { x: 1000 },
        trialLimits: { x: 30 },
        anchor,
      });
      jest
        .spyOn(service, 'getPostsRecursively')
        .mockResolvedValue([{ id: 'p-1' }] as any);
    };
    const trialMessage =
      'A free trial posts here as much as the Starter plan. Add a card, then end your trial on the Billing page to get your plan\'s full limit.';

    it('holds a trialing subscription to the Starter cap when scheduling', async () => {
      const { service, subscriptionService, paymentService } =
        makeLimitService({ x: 1000 }, 30, 0);
      trialPlan(service, subscriptionService);
      paymentService.isTrialing.mockResolvedValue(true);
      await expect(
        service.checkProviderPostsLimit('org-1', {
          type: 'schedule',
          posts: [post('i-x', 1)],
        })
      ).rejects.toMatchObject({
        status: 402,
        message: `You've used your 30 X posts for this month on the Ultimate trial. ${trialMessage}`,
      });
      expect(paymentService.isTrialing).toHaveBeenCalledWith('org-1');
    });

    it('holds a trialing subscription to the Starter cap when publishing', async () => {
      const { service, subscriptionService, paymentService } =
        makeLimitService({ x: 1000 }, 30);
      trialPlan(service, subscriptionService);
      paymentService.isTrialing.mockResolvedValue(true);
      expect(
        await service.providerPublishProblem('org-1', 'x', [
          { id: 'p-1', parentPostId: null },
        ])
      ).toBe(
        `Monthly X post limit reached on the Ultimate trial (30). ${trialMessage}`
      );
    });

    it.each([
      ['past_due, its renewal being retried', false],
      ['active', false],
    ])(
      'keeps the plan cap of a subscription that is %s',
      async (_, trialing) => {
        const { service, subscriptionService, paymentService } =
          makeLimitService({ x: 1000 }, 30, 0);
        trialPlan(service, subscriptionService);
        paymentService.isTrialing.mockResolvedValue(trialing);
        await expect(
          service.checkProviderPostsLimit('org-1', {
            type: 'schedule',
            posts: [post('i-x', 1)],
          })
        ).resolves.toEqual(new Set(['i-x']));
        expect(
          await service.providerPublishProblem('org-1', 'x', [
            { id: 'p-1', parentPostId: null },
          ])
        ).toBeNull();
      }
    );

    it('never asks Stripe while the trial cap has room or the plan cap refuses anyway', async () => {
      const { service, subscriptionService, paymentService } =
        makeLimitService({ x: 1000 }, 10);
      trialPlan(service, subscriptionService);
      expect(
        await service.providerPublishProblem('org-1', 'x', [
          { id: 'p-1', parentPostId: null },
        ])
      ).toBeNull();

      const full = makeLimitService({ x: 1000 }, 1000);
      trialPlan(full.service, full.subscriptionService);
      expect(
        await full.service.providerPublishProblem('org-1', 'x', [
          { id: 'p-1', parentPostId: null },
        ])
      ).toBe(
        'Monthly X post limit reached on the Ultimate plan (1000). Or bring your own key.'
      );
      expect(paymentService.isTrialing).not.toHaveBeenCalled();
      expect(full.paymentService.isTrialing).not.toHaveBeenCalled();
    });
  });

  describe('when a post goes out', () => {
    it('lets it publish while the month has room for its thread', async () => {
      const { service, postRepository } = makeLimitService({ x: 30 }, 28);
      jest
        .spyOn(service, 'getPostsRecursively')
        .mockResolvedValue([{ id: 'p-1' }, { id: 'p-2' }] as any);
      expect(
        await service.providerPublishProblem('org-1', 'x', [
          { id: 'p-1', parentPostId: null },
        ])
      ).toBeNull();
      expect(postRepository.countProviderUsage).toHaveBeenCalledWith(
        'org-1',
        'x',
        monthStart,
        nextMonth.toDate()
      );
    });

    it('stops it when the published posts leave no room for its thread', async () => {
      const { service } = makeLimitService({ x: 30 }, 29);
      jest
        .spyOn(service, 'getPostsRecursively')
        .mockResolvedValue([{ id: 'p-1' }, { id: 'p-2' }] as any);
      expect(
        await service.providerPublishProblem('org-1', 'x', [
          { id: 'p-1', parentPostId: null },
        ])
      ).toBe(
        'Monthly X post limit reached on the Starter plan (30). Or bring your own key.'
      );
    });

    it('never looks at the plan for a network no plan caps', async () => {
      const { service, subscriptionService } = makeLimitService({ x: 0 });
      expect(
        await service.providerPublishProblem('org-1', 'x-own-key', [
          { id: 'p-1' },
        ])
      ).toBeNull();
      expect(subscriptionService.getProviderPostsLimits).not.toHaveBeenCalled();
    });

    it('records what went out on a capped network only', async () => {
      const { service, postRepository } = makeLimitService();
      await service.recordProviderPublish('org-1', 'x', ['p-1', 'p-2']);
      await service.recordProviderPublish('org-1', 'x-own-key', ['p-3']);
      expect(postRepository.recordProviderUsage).toHaveBeenCalledTimes(1);
      expect(postRepository.recordProviderUsage).toHaveBeenCalledWith(
        'org-1',
        'x',
        ['p-1', 'p-2']
      );
    });
  });
});

describe('PostsService.validatePosts post date context', () => {
  const makeValidationService = () => {
    const integrationService = {
      getIntegrationById: jest.fn().mockResolvedValue({
        id: 'yt-1',
        name: 'Channel',
        providerIdentifier: 'youtube',
        additionalSettings: '[]',
      }),
    };
    const service = new PostsService(
      {} as any,
      {
        // the real settings DTO, the provider media rules are not under test
        getSocialIntegration: () => ({
          dto: YoutubeSettingsDto,
          checkValidity: async () => true,
          maxLength: () => 5000,
        }),
      } as any,
      integrationService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
    return { service, integrationService };
  };

  const postDate = dayjs.utc().add(2, 'day');
  const youtubePost = (settings: Record<string, any>, extra = {}) => ({
    integration: { id: 'yt-1' },
    value: [{ content: 'Description', image: [] }],
    settings: { title: 'My video', type: 'public', ...settings },
    ...extra,
  });

  it('checks publishAt against the request date', async () => {
    const { service } = makeValidationService();
    const [result] = await service.validatePosts(
      'org-1',
      [youtubePost({ publishAt: postDate.subtract(1, 'hour').format() })],
      'schedule',
      false,
      postDate.format('YYYY-MM-DDTHH:mm:ss')
    );
    expect(result.valid).toBe(false);
    expect(result.settingsError).toContain('after the post is published');
  });

  it('prefers the date of the channel over the request date', async () => {
    const { service } = makeValidationService();
    const [result] = await service.validatePosts(
      'org-1',
      [
        youtubePost(
          { publishAt: postDate.add(1, 'hour').format() },
          { date: postDate.add(3, 'hour').format('YYYY-MM-DDTHH:mm:ss') }
        ),
      ],
      'schedule',
      false,
      postDate.format('YYYY-MM-DDTHH:mm:ss')
    );
    expect(result.valid).toBe(false);
  });

  it('never trusts a date sent inside the settings', async () => {
    const { service } = makeValidationService();
    const [result] = await service.validatePosts(
      'org-1',
      [
        youtubePost({
          publishAt: postDate.subtract(1, 'hour').format(),
          __validationDate: dayjs.utc().format('YYYY-MM-DDTHH:mm:ss'),
        }),
      ],
      'schedule',
      false,
      postDate.format('YYYY-MM-DDTHH:mm:ss')
    );
    expect(result.valid).toBe(false);
  });

  it('accepts a later YouTube time and settings without it, as before', async () => {
    const { service } = makeValidationService();
    const results = await service.validatePosts(
      'org-1',
      [youtubePost({ publishAt: postDate.add(1, 'hour').format() }), youtubePost({})],
      'schedule',
      false,
      postDate.format('YYYY-MM-DDTHH:mm:ss')
    );
    expect(results.map((r) => r.valid)).toEqual([true, true]);
  });

  it('flags a turned off channel so API and MCP can refuse it', async () => {
    const { service, integrationService } = makeValidationService();
    integrationService.getIntegrationById.mockResolvedValue({
      id: 'yt-1',
      name: 'Channel',
      providerIdentifier: 'youtube',
      additionalSettings: '[]',
      disabled: true,
    });
    const [result] = await service.validatePosts(
      'org-1',
      [youtubePost({})],
      'draft'
    );
    expect(result.disabled).toBe(true);
  });
});

describe('PostsService.validatePosts text for the provider rules', () => {
  it('hands checkValidity each entry as the provider receives it', async () => {
    const checkValidity = jest.fn(async () => 'too long' as const);
    const service = new PostsService(
      {} as any,
      {
        getSocialIntegration: () => ({
          editor: 'html',
          checkValidity,
          maxLength: () => 4096,
        }),
      } as any,
      {
        getIntegrationById: jest.fn().mockResolvedValue({
          id: 'tg-1',
          name: 'Channel',
          providerIdentifier: 'telegram',
          additionalSettings: '[]',
        }),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );

    const [result] = await service.validatePosts('org-1', [
      {
        integration: { id: 'tg-1' },
        value: [
          { content: '<p dir="auto">One &amp; two</p>', image: [{ path: 'a.png' }] },
          { content: 'plain reply', image: [] },
        ],
        settings: {},
      },
    ]);

    expect(result.errors).toBe('too long');
    expect(checkValidity).toHaveBeenCalledWith(
      [[{ path: 'a.png' }], []],
      { __type: 'telegram' },
      [],
      ['<p dir="auto">One & two</p>', 'plain reply']
    );
  });
});

// X keeps the composer HTML (editor 'html'), but its limit is on the text the
// composer shows: the markup never counts
describe('PostsService.validatePosts counts the visible text of an X post', () => {
  // 'a' x n, a bold word and a link: n + 38 visible characters on X
  const xPost = (n: number) =>
    `<p>${'a'.repeat(n)} <strong>bold</strong></p><p>Read <a href="https://example.com/a/very/long/path">example.com/a/very/long/path</a></p>`;
  const make = () => {
    const service = new PostsService(
      {} as any,
      {
        getSocialIntegration: () => ({
          editor: 'html',
          checkValidity: async () => true,
          maxLength: () => 280,
        }),
      } as any,
      {
        getIntegrationById: jest.fn().mockResolvedValue({
          id: 'x-1',
          name: 'X',
          providerIdentifier: 'x',
          additionalSettings: '[]',
        }),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
    return service;
  };
  const validate = (content: string) =>
    make().validatePosts('org-1', [
      { integration: { id: 'x-1' }, value: [{ content, image: [] }], settings: {} },
    ]);

  it('accepts 279 visible characters wrapped in paragraphs, bold and a link', async () => {
    const [result] = await validate(xPost(241));
    expect(result.tooLong).toBe(false);
    expect(result.emptyContent).toBe(false);
  });

  it('refuses 281 visible characters', async () => {
    const [result] = await validate(xPost(243));
    expect(result.tooLong).toBe(true);
  });

  it('treats markup without text as empty', async () => {
    const [result] = await validate('<p></p>');
    expect(result.emptyContent).toBe(true);
  });

  it('approval re-checks a stored post with the same count', async () => {
    const service = make();
    const stored = (content: string) => [
      {
        id: 'p-1',
        content,
        image: '[]',
        settings: '{}',
        publishDate: new Date('2030-01-01T00:00:00Z'),
        integration: { id: 'x-1', providerIdentifier: 'x' },
      },
    ];
    const spy = jest.spyOn(service, 'getPostsRecursively' as any);
    spy.mockResolvedValueOnce(stored(xPost(241)));
    await expect(service.getStoredPostProblem('org-1', 'p-1')).resolves.toBeNull();
    spy.mockResolvedValueOnce(stored(xPost(243)));
    await expect(service.getStoredPostProblem('org-1', 'p-1')).resolves.toContain('280 characters');
  });
});

// A network's posting rules for one connected account (postingLimits), like
// Reddit's 5 posts a day, at least 10 minutes apart
describe('PostsService posting limits', () => {
  const now = new Date('2026-11-02T12:00:00.000Z');
  const minutes = (n: number) => new Date(now.getTime() + n * 60 * 1000);
  const reddit = {
    identifier: 'reddit',
    name: 'Reddit',
    postingLimits: { perDay: 5, minSpacingMinutes: 10 },
  };
  const account = { providerIdentifier: 'reddit', internalId: 'u1' };

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.setSystemTime(now);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const make = (dates: Date[] = [], stored: any[] = []) => {
    const postRepository = {
    acquireAgentAdmission: jest.fn().mockResolvedValue({}),
    releaseAgentAdmission: jest.fn().mockResolvedValue({ count: 1 }),
    mcpWorkflowVersion: jest.fn().mockResolvedValue(null),
      getAccountPostingDates: jest.fn().mockResolvedValue(dates),
      getPostsState: jest.fn().mockResolvedValue(stored),
      getPostById: jest.fn().mockResolvedValue({
        id: 'p-1',
        parentPostId: null,
        publishDate: minutes(60),
        integration: { id: 'i-r', ...account },
      }),
    };
    const integrationService = {
      getIntegrationById: jest.fn().mockResolvedValue({
        id: 'i-r',
        ...account,
      }),
    };
    const integrationManager = {
      getSocialIntegration: (identifier: string) =>
        identifier === 'reddit' ? reddit : { identifier, name: identifier },
    };
    const service = new PostsService(
      postRepository as any,
      integrationManager as any,
      integrationService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
    return { service, postRepository, integrationService };
  };

  describe('when a post goes out', () => {
    it('lets it publish when the account has room', async () => {
      const { service, postRepository } = make([minutes(-60), minutes(-30)]);
      expect(
        await service.postingLimitProblem(account, [{ id: 'p-1' }])
      ).toBeNull();
      // the account's published posts only, around now (with 30 seconds of
      // slack), not this post
      expect(postRepository.getAccountPostingDates).toHaveBeenCalledWith(
        'reddit',
        'u1',
        minutes(-24 * 60 + 0.5),
        minutes(24 * 60 + 0.5),
        false,
        ['p-1']
      );
    });

    it('lets a post go out a few seconds before its 10 minutes are up', async () => {
      const { service } = make([minutes(-9.75)]);
      expect(
        await service.postingLimitProblem(account, [{ id: 'p-1' }])
      ).toBeNull();
    });

    it('refuses a post less than 10 minutes after the last one', async () => {
      const { service } = make([minutes(-4)]);
      expect(await service.postingLimitProblem(account, [{ id: 'p-1' }])).toBe(
        'Reddit allows 5 posts a day per account, at least 10 minutes apart. Next allowed at 2026-11-02 12:06 UTC.'
      );
    });

    it('refuses a sixth post in 24 hours until the oldest one leaves them', async () => {
      const { service } = make([
        minutes(-23 * 60),
        minutes(-600),
        minutes(-300),
        minutes(-120),
        minutes(-60),
      ]);
      expect(await service.postingLimitProblem(account, [{ id: 'p-1' }])).toBe(
        'Reddit allows 5 posts a day per account, at least 10 minutes apart. Next allowed at 2026-11-02 13:00 UTC.'
      );
    });

    it('lets the sixth post go once 24 hours have passed since the first', async () => {
      const { service } = make([
        minutes(-24 * 60 - 1),
        minutes(-600),
        minutes(-300),
        minutes(-120),
        minutes(-60),
      ]);
      expect(
        await service.postingLimitProblem(account, [{ id: 'p-1' }])
      ).toBeNull();
    });

    it('never reads posts for a network without posting rules', async () => {
      const { service, postRepository } = make([minutes(-1)]);
      expect(
        await service.postingLimitProblem(
          { providerIdentifier: 'x', internalId: 'u1' },
          [{ id: 'p-1' }]
        )
      ).toBeNull();
      expect(postRepository.getAccountPostingDates).not.toHaveBeenCalled();
    });
  });

  describe('when a post is saved', () => {
    const save = (
      type: 'schedule' | 'now' | 'draft' | 'update',
      date: Date,
      id?: string
    ) => ({
      type,
      date: date.toISOString(),
      posts: [
        {
          integration: { id: 'i-r' },
          settings: { __type: 'reddit' },
          value: [{ ...(id ? { id } : {}) }],
        },
      ],
    });

    it('refuses a schedule 5 minutes before another queued post of the account', async () => {
      const { service, postRepository } = make([minutes(65)]);
      await expect(
        service.checkPostingLimits('org-1', save('schedule', minutes(60)))
      ).rejects.toMatchObject({
        message:
          'Reddit allows 5 posts a day per account, at least 10 minutes apart. Next allowed at 2026-11-02 13:15 UTC.',
      });
      // published and queued posts around the publish time
      expect(postRepository.getAccountPostingDates).toHaveBeenCalledWith(
        'reddit',
        'u1',
        minutes(60 - 24 * 60),
        minutes(60 + 2 * 24 * 60),
        true,
        []
      );
    });

    it('refuses a schedule that would make one 24 hours hold six posts', async () => {
      const { service } = make([
        minutes(120),
        minutes(240),
        minutes(360),
        minutes(480),
        minutes(600),
      ]);
      await expect(
        service.checkPostingLimits('org-1', save('schedule', minutes(60)))
      ).rejects.toMatchObject({
        message: expect.stringContaining(
          'Reddit allows 5 posts a day per account, at least 10 minutes apart.'
        ),
      });
    });

    it('accepts a schedule with room and excludes the post being edited', async () => {
      const { service, postRepository } = make(
        [minutes(-60)],
        [{ id: 'p-1', state: 'QUEUE' }]
      );
      await expect(
        service.checkPostingLimits('org-1', save('update', minutes(60), 'p-1'))
      ).resolves.toBeUndefined();
      expect(
        postRepository.getAccountPostingDates.mock.calls[0][5]
      ).toEqual(['p-1']);
    });

    const stored = (integration: any = { id: 'i-r', ...account }) => ({
      id: 'p-1',
      parentPostId: null,
      publishDate: minutes(60),
      integration,
    });

    it('checks a stored post moved next to another one of the account', async () => {
      const { service, postRepository, integrationService } = make([
        minutes(122),
      ]);
      await expect(
        service.checkStoredPostingLimits('org-1', stored(), minutes(120))
      ).rejects.toMatchObject({
        message: expect.stringContaining('Next allowed at 2026-11-02 14:12 UTC.'),
      });
      expect(postRepository.getAccountPostingDates.mock.calls[0][5]).toEqual([
        'p-1',
      ]);
      // the loaded post had the account, nothing else is read
      expect(integrationService.getIntegrationById).not.toHaveBeenCalled();
      // at its stored date when it does not move
      await expect(
        service.checkStoredPostingLimits('org-1', stored())
      ).resolves.toBeUndefined();
    });

    it('reads the account only for a network with posting rules', async () => {
      const { service, postRepository, integrationService } = make([
        minutes(62),
      ]);
      // an approval's post carries the provider but not the account
      await expect(
        service.checkStoredPostingLimits(
          'org-1',
          stored({ id: 'i-r', providerIdentifier: 'reddit' })
        )
      ).rejects.toMatchObject({
        message: expect.stringContaining('Reddit allows 5 posts a day'),
      });
      expect(integrationService.getIntegrationById).toHaveBeenCalledWith(
        'org-1',
        'i-r'
      );

      integrationService.getIntegrationById.mockClear();
      postRepository.getAccountPostingDates.mockClear();
      await service.checkStoredPostingLimits(
        'org-1',
        stored({ id: 'i-x', providerIdentifier: 'x' })
      );
      expect(integrationService.getIntegrationById).not.toHaveBeenCalled();
      expect(postRepository.getAccountPostingDates).not.toHaveBeenCalled();
    });

    it('skips drafts and updates of posts that already went out', async () => {
      const { service, postRepository } = make(
        [minutes(1)],
        [{ id: 'p-1', state: 'PUBLISHED' }]
      );
      await service.checkPostingLimits('org-1', save('draft', minutes(0)));
      await service.checkPostingLimits(
        'org-1',
        save('update', minutes(0), 'p-1')
      );
      expect(postRepository.getAccountPostingDates).not.toHaveBeenCalled();
    });
  });
});

describe('PostsService.publicPostLink', () => {
  const publicProvider = {
    isPublicReleaseURL: (url: string) =>
      /^https:\/\/x\.com\/[^/]+\/status\/\d+$/.test(url),
  };
  // a provider that reads a settings field to tell a public post from a
  // members-only one, the way X does for a Community post
  const settingsProvider = {
    isPublicReleaseURL: (url: string, settings: any) =>
      /^https:\/\/x\.com\//.test(url) && !settings?.community,
  };
  // a provider that stores an inbox or admin URL and never opts in, like
  // tiktok's creator inbox or listmonk's self-hosted campaign preview
  const privateProvider = {};
  const policyProvider = {
    isPublicReleaseURL: () => true,
    authorizationPolicy: { authorizationRealm: 'google-project:test' },
  };
  const throwingProvider = {
    isPublicReleaseURL: () => {
      throw new Error('boom');
    },
  };

  const providers: Record<string, any> = {
    x: publicProvider,
    community: settingsProvider,
    tiktok: privateProvider,
    listmonk: privateProvider,
    youtube: policyProvider,
    broken: throwingProvider,
  };

  const make = () =>
    makeService({
      getSocialIntegration: (identifier: string) => providers[identifier],
    } as any).service;

  const post = (overrides: any = {}) => ({
    state: 'PUBLISHED' as any,
    releaseURL: 'https://x.com/acme/status/1',
    settings: '{}',
    integration: { providerIdentifier: 'x' },
    ...overrides,
  });

  beforeEach(() => {
    safeUrl.mockReset();
    safeUrl.mockResolvedValue(true);
  });

  it('links the post when the provider says the release URL is public', async () => {
    await expect(make().publicPostLink(post())).resolves.toBe(
      'https://x.com/acme/status/1'
    );
    expect(safeUrl).toHaveBeenCalledWith('https://x.com/acme/status/1');
  });

  it('never links a provider that did not opt in, even with a release URL', async () => {
    await expect(
      make().publicPostLink(
        post({
          releaseURL: 'https://www.tiktok.com/messages?lang=en#7300000000',
          integration: { providerIdentifier: 'tiktok' },
        })
      )
    ).resolves.toBeUndefined();
    await expect(
      make().publicPostLink(
        post({
          releaseURL: 'https://mail.acme.internal/api/campaigns/4/preview',
          integration: { providerIdentifier: 'listmonk' },
        })
      )
    ).resolves.toBeUndefined();
    // a provider that never opts in is not even asked about the URL
    expect(safeUrl).not.toHaveBeenCalled();
  });

  it('rejects a release URL the provider does not recognise as a permalink', async () => {
    // the owner's own article list, not a post
    await expect(
      make().publicPostLink(post({ releaseURL: 'https://x.com/i/articles' }))
    ).resolves.toBeUndefined();
    // a profile page rather than the post
    await expect(
      make().publicPostLink(post({ releaseURL: 'https://x.com/acme' }))
    ).resolves.toBeUndefined();
  });

  it('drops a URL that is not a public https URL, whatever the provider said', async () => {
    safeUrl.mockResolvedValue(false);
    await expect(make().publicPostLink(post())).resolves.toBeUndefined();
    expect(safeUrl).toHaveBeenCalledWith('https://x.com/acme/status/1');
  });

  it('links nothing for a post that is not published or is deleted', async () => {
    for (const state of ['QUEUE', 'DRAFT', 'ERROR']) {
      await expect(make().publicPostLink(post({ state }))).resolves.toBeUndefined();
    }
    await expect(
      make().publicPostLink(post({ deletedAt: new Date() }))
    ).resolves.toBeUndefined();
  });

  it('links nothing when the post has no release URL', async () => {
    await expect(
      make().publicPostLink(post({ releaseURL: '' }))
    ).resolves.toBeUndefined();
    await expect(
      make().publicPostLink(post({ releaseURL: null }))
    ).resolves.toBeUndefined();
  });

  it('links nothing for a deleted, disabled, half-connected or reconnect-needed channel', async () => {
    for (const broken of [
      { deletedAt: new Date() },
      { disabled: true },
      { inBetweenSteps: true },
      { refreshNeeded: true },
    ]) {
      await expect(
        make().publicPostLink(
          post({ integration: { providerIdentifier: 'x', ...broken } })
        )
      ).resolves.toBeUndefined();
    }
  });

  it('links nothing for a provider under an authorizationPolicy', async () => {
    await expect(
      make().publicPostLink(
        post({
          releaseURL: 'https://www.youtube.com/watch?v=abc',
          integration: { providerIdentifier: 'youtube' },
        })
      )
    ).resolves.toBeUndefined();
  });

  it('links the first target when the provider comma-joins several', async () => {
    await expect(
      make().publicPostLink(
        post({
          releaseURL:
            'https://x.com/acme/status/1,https://x.com/acme/status/2',
        })
      )
    ).resolves.toBe('https://x.com/acme/status/1');
  });

  it('links nothing when the post has no integration or an unknown provider', async () => {
    await expect(
      make().publicPostLink(post({ integration: null }))
    ).resolves.toBeUndefined();
    await expect(
      make().publicPostLink(post({ integration: { providerIdentifier: 'nope' } }))
    ).resolves.toBeUndefined();
  });

  it('survives settings that are not valid json, and a provider that throws', async () => {
    await expect(
      make().publicPostLink(post({ settings: 'not json' }))
    ).resolves.toBeUndefined();
    await expect(
      make().publicPostLink(post({ integration: { providerIdentifier: 'broken' } }))
    ).resolves.toBeUndefined();
  });

  it('refuses settings that parse to something other than an object', async () => {
    const communityPost = (settings: string) =>
      post({ settings, integration: { providerIdentifier: 'community' } });

    // the guard works when the settings really are an object
    await expect(
      make().publicPostLink(communityPost('{}'))
    ).resolves.toBe('https://x.com/acme/status/1');
    await expect(
      make().publicPostLink(
        communityPost('{"community":"https://x.com/i/communities/1"}')
      )
    ).resolves.toBeUndefined();

    // and anything that is not an object would read as "no community set",
    // so it must not reach the provider at all
    for (const settings of ['"x"', '42', 'true', 'null', '[]']) {
      await expect(
        make().publicPostLink(communityPost(settings))
      ).resolves.toBeUndefined();
    }
  });
});

describe('PostsService.getPost error curation', () => {
  const failure = (type: string, message: string) =>
    JSON.stringify({ cause: { type, failure: { message } } });

  const load = async (error: string | null) => {
    const { service, postRepository } = makeService();
    postRepository.getPost.mockResolvedValue({
      id: 'p-1',
      group: 'g-1',
      content: 'hello',
      childrenPost: [],
      error,
      integration: { id: 'i-1', name: 'X', providerIdentifier: 'x' },
    });
    const { posts } = await service.getPost('org-1', 'p-1');
    return posts[0];
  };

  // the editor and the approvals inbox are served this payload to any member
  // of the workspace, so it carries the same curated message as the calendar
  it('keeps a provider message and drops a failure of ours', async () => {
    expect((await load(failure('bad_body', 'Duplicate post content'))).error).toBe(
      'Duplicate post content'
    );
    expect(
      (
        await load(
          failure('unknown', 'error:1C800064:Provider routines::bad decrypt')
        )
      ).error
    ).toBe(null);
    expect((await load(null)).error).toBe(null);
  });
});

describe('PostsService optional comments permission', () => {
  it('rejects an additional comment before creating any publish workflow', async () => {
    const service = new PostsService(
      {} as any,
      { getSocialIntegration: () => ({
        plugsAvailable: false, checkValidity: async () => true,
        maxLength: () => 2200, editor: 'normal',
      }) } as any,
      { getIntegrationById: async () => ({
        id: 'review-channel', name: 'Reviewer', providerIdentifier: 'instagram', additionalSettings: '[]',
      }) } as any,
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any
    );
    const [result] = await service.validatePosts('review-org', [{
      integration: { id: 'review-channel' },
      value: [{ content: 'Original post', image: [] }, { content: 'First comment', image: [] }],
      settings: {},
    }]);
    expect(result.errors).toMatch(/optional permission/);
  });
});


describe('saved composition optional-reply compatibility', () => {
  const payload = () => ({ integration: { id: 'channel-1' }, value: [
    { id: 'saved-root', content: 'Edited post', image: [] },
    { id: 'saved-reply', content: 'Edited reply', image: [{ path: 'https://example.test/reply.jpg' }] },
  ], settings: {} });
  const make = (saved: boolean) => {
    const repo = { isExistingPostSequence: jest.fn(async () => saved) };
    const service = new PostsService(repo as any,
      { getSocialIntegration: () => ({ plugsAvailable: false, checkValidity: async () => true, maxLength: () => 2200, editor: 'normal' }) } as any,
      { getIntegrationById: async () => ({ id: 'channel-1', name: 'Review', providerIdentifier: 'instagram', additionalSettings: '[]' }) } as any,
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    return { service, repo };
  };
  it('allows existing saved entries to be edited/rescheduled without dropping content', async () => {
    const { service, repo } = make(true);
    const post = payload(); const before = structuredClone(post);
    const [result] = await service.validatePosts('org-1', [post], 'schedule');
    expect(result.errors).toBe(true);
    expect(repo.isExistingPostSequence).toHaveBeenCalledWith('org-1', 'channel-1', ['saved-root', 'saved-reply']);
    expect(post).toEqual(before);
  });
  it('still rejects a forged/new sequence when optional replies are unavailable', async () => {
    const { service } = make(false);
    const [result] = await service.validatePosts('org-1', [payload()], 'schedule');
    expect(result.errors).toMatch(/optional permission/);
  });
});

describe('no-write post preflight and final preparation', () => {
  const fixture = () => {
    const provider = { editor: 'normal', maxLength: () => 5, checkValidity: jest.fn().mockResolvedValue(true) };
    const { service, postRepository } = makeService({ getSocialIntegration: () => provider });
    const integration = { id: 'channel', name: 'Channel', providerIdentifier: 'test', additionalSettings: '[]', disabled: false };
    (service as any)._integrationService = { getIntegrationById: jest.fn().mockResolvedValue(integration) };
    const writes = { convertTextToShortLinks: jest.fn(), askShortLinkedin: jest.fn().mockReturnValue(true) };
    (service as any)._shortLinkService = writes;
    const post = { date: '2026-12-01T12:00:00Z', integration: { id: 'channel' }, settings: {}, value: [{ content: '<p>hello</p>', image: [] }] };
    return { service, post, provider, postRepository, writes };
  };
  it('reports input/config identity and per-entry limits without creating links or posts', async () => {
    const { service, post, writes, postRepository } = fixture();
    const [result] = await service.preflightPosts('org', [post], 'schedule');
    expect(result.inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.configHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.checks.find((c: any) => c.field === 'value.0.content.length').status).toBe('VALID');
    expect(result.status).toBe('UNKNOWN'); // provider authorization/final media readiness is not refreshed
    expect(writes.convertTextToShortLinks).not.toHaveBeenCalled();
    expect(postRepository.createComment).not.toHaveBeenCalled();
  });
  it('short-link transformation is UNKNOWN without an invented length bound', async () => {
    const { service, post, writes } = fixture();
    const [result] = await service.preflightPosts('org', [post], 'schedule', undefined, true);
    expect(result.checks.find((c: any) => c.field === 'shortLink').status).toBe('UNKNOWN');
    expect(writes.convertTextToShortLinks).not.toHaveBeenCalled();
  });
  it('rejects an empty thread, rather than vacuously passing every check', async () => {
    const { service, post } = fixture();
    const [result] = await service.preflightPosts('org', [{ ...post, value: [] }], 'schedule');
    expect(result.status).toBe('INVALID');
  });
  it('uses the actual provider-formatted text for character limits', async () => {
    const { service, post, provider } = fixture();
    const [result] = await service.preflightPosts('org', [{ ...post, value: [{ content: '<p>toolong</p>', image: [] }] }], 'schedule');
    expect(result.status).toBe('INVALID');
    expect(provider.checkValidity).toHaveBeenCalledWith([[]], expect.anything(), [], ['toolong']);
  });
  it('marks unfinished media UNKNOWN and supplies a practical fix', async () => {
    const { service, post } = fixture();
    const [result] = await service.preflightPosts('org', [{ ...post, value: [{ content: 'ok', image: [{ path: 'https://media.test/a.mp4' }] }] }], 'schedule');
    expect(result.checks.find((c: any) => c.field === 'mediaIdentity').status).toBe('UNKNOWN');
  });
});

describe('tracked MCP publication admission', () => {
  const fixture = () => {
    const { service } = makeService({ getSocialIntegration: () => ({}) });
    const root: any = { id: 'root', organizationId: 'org', integrationId: 'channel', parentPostId: null, mcpWorkflowVersion: 114, state: 'QUEUE', approvalStatus: 'APPROVED', content: 'text', settings: '{}', image: '[]', publishDate: new Date('2026-12-01T12:00:00Z'), integration: { id: 'channel', organizationId: 'org', providerIdentifier: 'test' } };
    jest.spyOn(service, 'mcpThread').mockResolvedValue([root]);
    jest.spyOn(service, 'getStoredPostProblem').mockResolvedValue(null);
    jest.spyOn(service, 'mcpExecutionState').mockResolvedValue({ generation: 0, closed: true });
    const repo = { claimMcpSegment: jest.fn().mockResolvedValue({ id: 'attempt', replay: false }), finishMcpSegment: jest.fn().mockResolvedValue({}), markMcpUnknown: jest.fn().mockResolvedValue({}), mcpAttempts: jest.fn(), reconcileMcpAttempt: jest.fn(), resumeMcp: jest.fn() };
    (service as any)._postRepository = repo;
    (service as any)._approvalPolicyService = { assertAgentGuardrails: jest.fn(), getSettings: jest.fn().mockResolvedValue({ requireAgentApproval: true }) };
    const hash = (service as any).mcpRevision([root]);
    const receipt = [{ id: 'root', postId: 'remote', releaseURL: 'https://test/remote', status: 'published' }];
    return { service, root, repo, hash, receipt };
  };
  it.each([null, 'not-an-array', [], [{ id: 'foreign', postId: 'remote', releaseURL: '', status: 'published' }], [{ id: 'root', postId: 'remote', releaseURL: '', status: 'processing' }], [{ id: 'root', postId: 'remote' }]].map(stored => [stored]))('refuses malformed recorded receipt replay without a provider call or ledger rewrite: %j', async (stored) => {
    const { service, repo, hash } = fixture();
    repo.mcpAttempts.mockResolvedValue([{ segmentPostId: 'root', status: 'CONFIRMED', revisionHash: hash }]);
    repo.claimMcpSegment.mockResolvedValue({ replay: true, receipt: stored, id: 'prior' });
    const send = jest.fn();
    await expect(service.runMcpSegment('org', 'root', 'root', 0, hash, send)).rejects.toThrow('OUTCOME_UNKNOWN');
    expect(send).not.toHaveBeenCalled();
    expect(repo.finishMcpSegment).not.toHaveBeenCalled();
    expect(repo.markMcpUnknown).not.toHaveBeenCalled();
  });
  it('returns the validated recorded receipt array without resending', async () => {
    const { service, repo, hash, receipt } = fixture();
    repo.mcpAttempts.mockResolvedValue([{ segmentPostId: 'root', status: 'CONFIRMED', revisionHash: hash }]);
    repo.claimMcpSegment.mockResolvedValue({ replay: true, receipt, id: 'prior' });
    const send = jest.fn();
    await expect(service.runMcpSegment('org', 'root', 'root', 0, hash, send)).resolves.toEqual(receipt);
    expect(send).not.toHaveBeenCalled();
  });
  it('preserves a known published warning with best-effort accounting and never demotes it for accounting failure', async () => {
    const { service, repo, hash, receipt } = fixture();
    (receipt[0] as any).warning = 'thumbnail failed';
    (receipt[0] as any).publicationAccountingPending = true;
    const accounting = jest.spyOn(service, 'recordProviderPublish').mockRejectedValue(new Error('accounting unavailable'));
    const result = await service.runMcpSegment('org', 'root', 'root', 0, hash, jest.fn().mockResolvedValue(receipt));
    expect(result[0]).toMatchObject({ postId: 'remote', warning: expect.stringContaining('Published successfully') });
    expect(repo.finishMcpSegment).toHaveBeenCalledWith('org', 'attempt', result);
    expect(repo.markMcpUnknown).not.toHaveBeenCalled();
    expect(accounting).toHaveBeenCalledWith('org', 'test', ['root']);
  });
  it('keeps a mismatched typed published identity or failed atomic completion UNKNOWN without a legacy release write', async () => {
    const first = fixture();
    const mismatched = first.receipt.map(receipt => ({ ...receipt, id: 'foreign-segment', warning: 'follow-up failed' }));
    await expect(first.service.runMcpSegment('org', 'root', 'root', 0, first.hash, jest.fn().mockResolvedValue(mismatched))).rejects.toThrow('OUTCOME_UNKNOWN');
    expect(first.repo.finishMcpSegment).not.toHaveBeenCalled();
    const second = fixture();
    second.repo.finishMcpSegment.mockRejectedValue(new Error('owned commit fault'));
    await expect(second.service.runMcpSegment('org', 'root', 'root', 0, second.hash, jest.fn().mockResolvedValue(second.receipt.map(receipt => ({ ...receipt, warning: 'follow-up failed' }))))).rejects.toThrow('OUTCOME_UNKNOWN');
    expect(second.repo.markMcpUnknown).toHaveBeenCalledWith('org', 'attempt');
  });
  it('persists STARTED admission before sending and stores the receipt before returning', async () => {
    const { service, repo, hash, receipt } = fixture();
    const send = jest.fn(async () => { expect(repo.claimMcpSegment).toHaveBeenCalled(); return receipt; });
    await expect(service.runMcpSegment('org', 'root', 'root', 0, hash, send)).resolves.toEqual(receipt);
    expect(repo.finishMcpSegment).toHaveBeenCalledWith('org', 'attempt', receipt);
  });
  it('acceptance followed by receipt-persistence failure is UNKNOWN, never confirmed failure', async () => {
    const { service, repo, hash, receipt } = fixture();
    repo.finishMcpSegment.mockRejectedValue(new Error('database unavailable'));
    await expect(service.runMcpSegment('org', 'root', 'root', 0, hash, jest.fn().mockResolvedValue(receipt))).rejects.toThrow('OUTCOME_UNKNOWN');
    expect(repo.markMcpUnknown).toHaveBeenCalledWith('org', 'attempt');
  });
  it('a durable published receipt is returned without a provider call', async () => {
    const { service, repo, hash, receipt } = fixture();
    repo.claimMcpSegment.mockResolvedValue({ replay: true, receipt });
    const send = jest.fn();
    await expect(service.runMcpSegment('org', 'root', 'root', 0, hash, send)).resolves.toEqual(receipt);
    expect(send).not.toHaveBeenCalled();
  });
  it('never sends after uncertain admission, changed revision or revoked approval', async () => {
    const { service, repo, hash, root } = fixture();
    const send = jest.fn();
    repo.claimMcpSegment.mockRejectedValue(new Error('OUTCOME_UNKNOWN'));
    await expect(service.runMcpSegment('org', 'root', 'root', 0, hash, send)).rejects.toThrow('OUTCOME_UNKNOWN');
    await expect(service.runMcpSegment('org', 'root', 'root', 0, 'changed', send)).rejects.toThrow('revision');
    root.approvalStatus = 'IN_REVIEW';
    await expect(service.runMcpSegment('org', 'root', 'root', 0, hash, send)).rejects.toThrow('approval');
    expect(send).not.toHaveBeenCalled();
  });
  it('unsupported reconciliation blocks recovery without updating or retrying', async () => {
    const { service, repo } = fixture();
    repo.mcpAttempts.mockResolvedValue([{ id: 'uncertain', status: 'STARTED' }]);
    expect(await service.resumeMcp('org', 'root')).toMatchObject({ status: 'OUTCOME_UNKNOWN' });
    expect(repo.reconcileMcpAttempt).not.toHaveBeenCalled();
    expect(repo.resumeMcp).not.toHaveBeenCalled();
  });
  it('only explicit terminal unpublished adapter evidence can unlock the failed segment', async () => {
    const { service, repo } = fixture();
    const reconcile = jest.fn().mockResolvedValue({ terminal: true, outcome: 'UNPUBLISHED' });
    (service as any)._integrationManager = { getSocialIntegration: () => ({ reconcileMcpAttempt: reconcile }) };
    repo.mcpAttempts.mockResolvedValue([{ id: 'child-attempt', segmentPostId: 'child', revisionHash: 'hash', status: 'UNKNOWN' }, { id: 'parent-attempt', status: 'CONFIRMED' }]);
    repo.resumeMcp.mockResolvedValue({ status: 'RESUMED' });
    jest.spyOn(service, 'startWorkflow').mockResolvedValue(undefined);
    expect(await service.resumeMcp('org', 'root')).toMatchObject({ status: 'RESUMED' });
    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(repo.reconcileMcpAttempt).toHaveBeenCalledWith('org', 'child-attempt', 'FAILED');
  });
  it('nonterminal reconciliation never creates a new attempt', async () => {
    const { service, repo } = fixture();
    (service as any)._integrationManager = { getSocialIntegration: () => ({ reconcileMcpAttempt: async () => ({ terminal: false, outcome: 'UNKNOWN' }) }) };
    repo.mcpAttempts.mockResolvedValue([{ id: 'a', status: 'UNKNOWN' }]);
    expect(await service.resumeMcp('org', 'root')).toMatchObject({ status: 'OUTCOME_UNKNOWN' });
    expect(repo.resumeMcp).not.toHaveBeenCalled();
  });
});

describe('review intent survives draft storage', () => {
  const fixture = (invalid: any) => {
    const { service, postRepository } = makeService({ getSocialIntegration: () => ({}) });
    Object.assign(postRepository, { getPostById: jest.fn().mockResolvedValue(null), createOrUpdatePost: jest.fn().mockResolvedValue({ posts: [{ id: 'new-root', state: 'DRAFT', content: 'saved' }] }) });
    (service as any)._shortLinkService = { convertTextToShortLinks: jest.fn().mockResolvedValue(['expanded payload']) };
    (service as any)._approvalPolicyService = { assertAgentGuardrails: jest.fn(), decide: jest.fn().mockResolvedValue({ hold: false }), afterSave: jest.fn().mockResolvedValue({ submitted: false }), notifyApprovers: jest.fn() };
    jest.spyOn(service, 'checkProviderPostsLimit').mockResolvedValue(new Set());
    jest.spyOn(service, 'checkPostingLimits').mockResolvedValue(undefined);
    jest.spyOn(service, 'detachStaleAnchors').mockResolvedValue(undefined as any);
    jest.spyOn(service, 'startWorkflow').mockResolvedValue(undefined);
    jest.spyOn(service, 'validatePosts').mockResolvedValue([{ valid: true, errors: true, tooLong: false, emptyContent: false, disabled: false, ...invalid }] as any);
    const body: any = { type: 'draft', date: '2030-01-01T00:00:00Z', shortLink: true, tags: [], posts: [{ integration: { id: 'channel' }, settings: { __type: 'fixture' }, value: [{ id: 'new', content: 'short', image: [] }] }] };
    return { service, postRepository, body };
  };
  it.each([{ tooLong: true }, { valid: false, settingsError: 'settings invalid' }, { errors: 'media invalid' }, { disabled: true }])('rejects final transformed review payload before saving: %j', async invalid => {
    const { service, postRepository, body } = fixture(invalid);
    await expect(service.createPost('org', body, 'MCP', false, { type: 'agent', source: 'test' }, undefined, 'review')).rejects.toThrow();
    expect((postRepository as any).createOrUpdatePost).not.toHaveBeenCalled();
    expect((service.validatePosts as jest.Mock).mock.calls[0][2]).toBe('schedule');
  });
  it('still allows an incomplete ordinary editable draft without claiming review validity', async () => {
    const { service, postRepository, body } = fixture({ tooLong: true, valid: false, errors: 'not ready' });
    await expect(service.createPost('org', body, 'MCP', false, { type: 'agent', source: 'test' })).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ postId: 'new-root' })]));
    expect((postRepository as any).createOrUpdatePost).toHaveBeenCalled();
  });
});

describe('MCP immutable media preparation', () => {
  it('can refresh a ready media path without rewriting the approved image JSON', async () => {
    const { service, postRepository, mediaService } = makeService();
    const original = [{ id: 'owned', path: 'https://uploads.test/original.png' }];
    mediaService.getOrgMediaById.mockResolvedValue({ id: 'owned', path: 'https://uploads.test/normalized.jpg', status: 'ready' });
    const result = await service.updateMedia('post', 'org', original, false, false);
    expect(result[0].url).toBe('https://uploads.test/normalized.jpg');
    expect(original[0].path).toBe('https://uploads.test/original.png');
    expect(postRepository.updateImages).not.toHaveBeenCalled();
  });
  it('PNG to JPEG binds a derived payload and does not mutate the approved source image', async () => {
    const { service, postRepository, mediaService } = makeService();
    const source = [{ id: 'owned', path: 'https://uploads.test/original.png' }];
    mediaService.getOrgMediaById.mockResolvedValue({ id: 'owned', path: source[0].path, status: 'ready' });
    const sharp = require('sharp');
    const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: 'white' } }).png().toBuffer();
    const dispatcher = require('@gitroom/nestjs-libraries/dtos/webhooks/ssrf.safe.dispatcher');
    const fetch = jest.spyOn(dispatcher, 'getSsrfSafeAxios').mockReturnValue({ get: jest.fn().mockResolvedValue({ data: png }) });
    (service as any).storage = { uploadFile: jest.fn().mockResolvedValue({ path: 'https://uploads.test/derived.jpg', originalname: 'derived.jpg' }) };
    try {
      const result = await service.updateMedia('post', 'org', source, true, false);
      expect(result[0].url).toBe('https://uploads.test/derived.jpg');
      expect(postRepository.updateImages).not.toHaveBeenCalled();
      expect(source[0].path).toBe('https://uploads.test/original.png');
    } finally { fetch.mockRestore(); }
  });
  it('preflight refuses an unowned or unfinished media path before invoking provider validation', async () => {
    const provider = { checkValidity: jest.fn(), maxLength: jest.fn() };
    const { service } = makeService({ getSocialIntegration: () => provider });
    const [result] = await service.preflightPosts('org', [{ integration: { id: 'c' }, value: [{ content: 'text', image: [{ path: 'https://uploads.test/other-tenant.png' }] }] }]);
    expect(result.status).toBe('UNKNOWN');
    expect(provider.checkValidity).not.toHaveBeenCalled();
  });
});

describe('exact-generation execution liveness and remainder policy', () => {
  it('uses authoritative execution states and preserves UNKNOWN for network failures', async () => {
    const { service, postRepository } = makeService();
    (postRepository as any).mcpFence = jest.fn().mockResolvedValue({ generation: 3 });
    const describe = jest.fn().mockResolvedValue({ status: { name: 'RUNNING' } });
    const getHandle = jest.fn(() => ({ describe }));
    (service as any)._temporalService = { client: { getRawClient: () => ({ connection: { withDeadline: (_deadline: number, fn: any) => fn() }, workflow: { getHandle } }) } };
    expect(await service.mcpExecutionState('org', 'root')).toEqual({ generation: 3, closed: false });
    expect(getHandle).toHaveBeenCalledWith('post_root_mcp_3');
    describe.mockResolvedValue({ status: { name: 'COMPLETED' } });
    expect(await service.mcpExecutionState('org', 'root')).toEqual({ generation: 3, closed: true });
    describe.mockRejectedValue(new Error('network unavailable'));
    expect(await service.mcpExecutionState('org', 'root')).toEqual({ generation: 3, closed: undefined });
    describe.mockRejectedValue(Object.assign(new Error('missing'), { name: 'WorkflowNotFoundError' }));
    expect(await service.mcpExecutionState('org', 'root')).toEqual({ generation: 3, closed: true });
  });
  it('checks held unpublished children even when the published parent retains an old approval', async () => {
    const { service, postRepository } = makeService();
    const root: any = { id: 'root', organizationId: 'org', integrationId: 'c', mcpWorkflowVersion: 114, state: 'PUBLISHED', approvalStatus: 'APPROVED', integration: { providerIdentifier: 'fixture' } };
    const child: any = { id: 'child', state: 'DRAFT', approvalStatus: 'IN_REVIEW' };
    jest.spyOn(service, 'mcpThread').mockResolvedValue([root, child]);
    (service as any)._approvalPolicyService = { getSettings: jest.fn().mockResolvedValue({ requireAgentApproval: true }), assertAgentGuardrails: jest.fn() };
    const send = jest.fn();
    (postRepository as any).claimMcpSegment = jest.fn();
    await expect(service.runMcpSegment('org', 'root', 'child', 0, 'hash', send)).rejects.toThrow('approval');
    expect(await service.resumeMcp('org', 'root')).toMatchObject({ status: 'BLOCKED' });
    expect(send).not.toHaveBeenCalled();
    expect((postRepository as any).claimMcpSegment).not.toHaveBeenCalled();
  });
});

describe('MCP producer rollout gate', () => {
  it('returns BLOCKED for a closed tracked resume before policy/provider/recovery effects', async () => {
    const provider = jest.fn(), { service, postRepository } = makeService({ getSocialIntegration: provider });
    jest.spyOn(service, 'mcpThread').mockResolvedValue([{ id: 'root', mcpWorkflowVersion: 114, integration: { providerIdentifier: 'fixture' } }] as any);
    const policy = { assertAgentGuardrails: jest.fn() };
    (service as any)._approvalPolicyService = policy;
    const resume = jest.fn();
    (postRepository as any).resumeMcp = resume;
    const before = process.env.MCP_V114_ADMISSION_ENABLED;
    process.env.MCP_V114_ADMISSION_ENABLED = 'false';
    try {
      await expect(service.resumeMcp('org', 'root')).resolves.toEqual({ status: 'BLOCKED', reason: 'Assistant post saves are temporarily unavailable while the service updates.' });
      expect(policy.assertAgentGuardrails).not.toHaveBeenCalled();
      expect(provider).not.toHaveBeenCalled();
      expect(resume).not.toHaveBeenCalled();
    } finally {
      if (before === undefined) delete process.env.MCP_V114_ADMISSION_ENABLED;
      else process.env.MCP_V114_ADMISSION_ENABLED = before;
    }
  });

  it('does not create a post or an admission while old publishing pollers may still exist', async () => {
    const { service, postRepository } = makeService();
    const before = process.env.MCP_V114_ADMISSION_ENABLED;
    process.env.MCP_V114_ADMISSION_ENABLED = 'false';
    try {
      const save = service.createPost('org', { type: 'draft', posts: [{ integration: { id: 'channel' } }] } as any, 'MCP', false, { type: 'agent', source: 'test' });
      await expect(save).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(save).rejects.toMatchObject({ status: 503, message: 'Assistant post saves are temporarily unavailable while the service updates.' });
      expect(postRepository.acquireAgentAdmission).not.toHaveBeenCalled();
    } finally { process.env.MCP_V114_ADMISSION_ENABLED = before; }
  });
});


describe('durable exact-generation MCP dispatch', () => {
  const setup = () => {
    const { service, postRepository } = makeService();
    const rows: any[] = [{ id: 'root', integrationId: 'channel', state: 'QUEUE', integration: { providerIdentifier: 'fixture' } }];
    jest.spyOn(service, 'mcpThread').mockResolvedValue(rows);
    jest.spyOn(service, 'mcpRevision').mockReturnValue('revision');
    const fence = { organizationId: 'org', postId: 'root', state: 'ACTIVE', generation: 4, revisionHash: 'revision' };
    Object.assign(postRepository, {
      mcpFence: jest.fn().mockResolvedValue(fence),
      mcpAttempts: jest.fn().mockResolvedValue([]),
      recordMcpDispatch: jest.fn().mockResolvedValue({ count: 1 }),
      pendingMcpDispatches: jest.fn().mockResolvedValue([fence]),
    });
    const missing = Object.assign(new Error('missing'), { name: 'WorkflowNotFoundError' });
    const describe = jest.fn().mockRejectedValue(missing);
    const start = jest.fn().mockResolvedValue({});
    const getHandle = jest.fn(() => ({ describe }));
    const withDeadline = jest.fn((_deadline: number, fn: any) => fn());
    (service as any)._temporalService = { client: { getRawClient: () => ({ connection: { withDeadline }, workflow: { getHandle, start } }) } };
    return { service, repo: postRepository as any, rows, fence, missing, describe, start, getHandle, withDeadline };
  };

  it('returns saved identity on a pre-start failure and recovers the same generation after a scheduler restart', async () => {
    const { service, repo, start, getHandle, withDeadline } = setup();
    start.mockRejectedValueOnce(new Error('before RPC'));
    await expect(service.reconcileMcpDispatch('org', 'root', 4, 'revision')).rejects.toMatchObject({ code: 'DISPATCH_UNCONFIRMED', savedPostIds: ['root'] });
    expect(repo.recordMcpDispatch).toHaveBeenLastCalledWith('org', 'root', 4, 'revision', 'UNKNOWN', 'START_UNCONFIRMED');
    expect(await service.recoverPendingMcpDispatches()).toEqual({ examined: 1, confirmed: 1, unconfirmed: 0 });
    expect(start.mock.calls.map(call => call[1])).toEqual([expect.objectContaining({ workflowId: 'post_root_mcp_4', workflowIdReusePolicy: 'REJECT_DUPLICATE', workflowIdConflictPolicy: 'USE_EXISTING' }), expect.objectContaining({ workflowId: 'post_root_mcp_4' })]);
    expect(getHandle).toHaveBeenCalledWith('post_root_mcp_4');
    expect(withDeadline).toHaveBeenCalledWith(expect.any(Number), expect.any(Function));
  });

  it.each(['RUNNING', 'COMPLETED', 'FAILED', 'TERMINATED'])('acknowledges an accepted %s execution after a lost start response without starting again', async status => {
    const { service, start, describe } = setup();
    start.mockRejectedValueOnce(new Error('response lost'));
    await expect(service.reconcileMcpDispatch('org', 'root', 4, 'revision')).rejects.toMatchObject({ code: 'DISPATCH_UNCONFIRMED' });
    describe.mockResolvedValue({ status: { name: status } });
    await service.recoverPendingMcpDispatches();
    expect(start).toHaveBeenCalledTimes(1);
  });

  it.each(['network', 'invalid-status'])('keeps %s inspection uncertain without another start or a new generation', async mode => {
    const { service, start, describe, repo } = setup();
    if (mode === 'network') describe.mockRejectedValue(new Error('timeout'));
    else describe.mockResolvedValue({ status: { name: 'unrecognized' } });
    await expect(service.reconcileMcpDispatch('org', 'root', 4, 'revision')).rejects.toMatchObject({ code: 'DISPATCH_UNCONFIRMED' });
    expect(start).not.toHaveBeenCalled();
    expect(repo.recordMcpDispatch).toHaveBeenLastCalledWith('org', 'root', 4, 'revision', 'UNKNOWN', 'STATUS_UNCONFIRMED');
  });

  it('recognizes a duplicate closed execution rejected at start without replaying it', async () => {
    const { service, start, describe } = setup();
    start.mockRejectedValue(Object.assign(new Error('duplicate'), { name: 'WorkflowExecutionAlreadyStartedError' }));
    describe.mockRejectedValueOnce(Object.assign(new Error('not retained yet'), { name: 'WorkflowNotFoundError' })).mockResolvedValue({ status: { name: 'COMPLETED' } });
    await service.reconcileMcpDispatch('org', 'root', 4, 'revision');
    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0][1].workflowIdReusePolicy).toBe('REJECT_DUPLICATE');
  });

  it('does not start when retention has lost a workflow that already has a provider attempt', async () => {
    const { service, repo, start } = setup();
    repo.mcpAttempts.mockResolvedValue([{ generation: 4, status: 'CONFIRMED' }]);
    await expect(service.reconcileMcpDispatch('org', 'root', 4, 'revision')).rejects.toMatchObject({ code: 'DISPATCH_UNCONFIRMED' });
    expect(start).not.toHaveBeenCalled();
    expect(repo.recordMcpDispatch).toHaveBeenLastCalledWith('org', 'root', 4, 'revision', 'HELD', 'PROVIDER_RECONCILIATION_REQUIRED');
  });

  it.each(['future', 'old', 'published-root'])('dispatches an outbox record for %s without the due-root sweep', async kind => {
    const { service, rows, start } = setup();
    rows[0].publishDate = new Date(kind === 'old' ? '2000-01-01' : '2100-01-01');
    if (kind === 'published-root') { rows[0].state = 'PUBLISHED'; rows.push({ id: 'reply', state: 'QUEUE' }); }
    expect(await service.recoverPendingMcpDispatches()).toMatchObject({ confirmed: 1 });
    expect(start).toHaveBeenCalledTimes(1);
  });

  it.each(['cancel', 'edit'])('refuses stale dispatch admission after a concurrent %s', async () => {
    const { service, repo, start } = setup();
    repo.recordMcpDispatch.mockResolvedValue({ count: 0 });
    await expect(service.reconcileMcpDispatch('org', 'root', 4, 'revision')).rejects.toMatchObject({ code: 'DISPATCH_UNCONFIRMED' });
    expect(start).not.toHaveBeenCalled();
  });

  it('lets concurrent dispatchers use one stable Temporal identity with closed-run reuse forbidden', async () => {
    const { service, start } = setup();
    await Promise.all([service.reconcileMcpDispatch('org', 'root', 4, 'revision'), service.reconcileMcpDispatch('org', 'root', 4, 'revision')]);
    expect(start).toHaveBeenCalledTimes(2);
    expect(start.mock.calls.every(call => call[1].workflowId === 'post_root_mcp_4' && call[1].workflowIdReusePolicy === 'REJECT_DUPLICATE')).toBe(true);
    // One actual execution is asserted by the native Temporal fixture, not this mock.
  });

  it('does not starve another pending generation when one row is unavailable', async () => {
    const { service, repo, fence } = setup();
    repo.pendingMcpDispatches.mockResolvedValue([fence, { ...fence, postId: 'next' }]);
    jest.spyOn(service, 'reconcileMcpDispatch').mockRejectedValueOnce(new Error('DB unavailable')).mockResolvedValueOnce(undefined);
    expect(await service.recoverPendingMcpDispatches()).toEqual({ examined: 2, confirmed: 1, unconfirmed: 1 });
  });
});
