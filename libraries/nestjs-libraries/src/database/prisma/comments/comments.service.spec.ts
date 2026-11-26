jest.mock('nestjs-temporal-core', () => ({ TemporalService: class {} }));
jest.mock('@gitroom/nestjs-libraries/integrations/integration.manager', () => ({ IntegrationManager: class {} }));
jest.mock('@gitroom/nestjs-libraries/integrations/refresh.integration.service', () => ({ RefreshIntegrationService: class {} }));
jest.mock('@gitroom/nestjs-libraries/database/prisma/integrations/integration.service', () => ({ IntegrationService: class {} }));

import {
  CommentsService,
  matchingRule,
} from '@gitroom/nestjs-libraries/database/prisma/comments/comments.service';

const ruleCreated = new Date('2026-11-26T09:00:00.000Z');
const now = new Date('2026-11-26T09:01:00.000Z').getTime();
beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(now);
});
afterEach(() => {
  jest.restoreAllMocks();
});
const rule = (over: any = {}) => ({
  id: 'rule-1',
  organizationId: 'org-1',
  integrationId: 'int-1',
  postId: 'media-1',
  keyword: 'Price',
  reply: 'Sent you the price list!',
  active: true,
  createdAt: ruleCreated,
  ...over,
});
const comment = (over: any = {}) => ({
  id: 'c-1',
  text: 'what is the PRICE?',
  username: 'fan',
  createdAt: '2026-11-26T09:00:30+0000',
  hidden: false,
  own: false,
  replies: [],
  ...over,
});

const setup = (comments: any[] = [comment()], rules: any[] = [rule()]) => {
  const provider = {
    commentPosts: jest.fn().mockResolvedValue([]),
    postComments: jest.fn().mockResolvedValue(comments),
    replyToComment: jest.fn().mockResolvedValue({ id: 'reply-1' }),
    hideComment: jest.fn().mockResolvedValue(undefined),
    deleteComment: jest.fn().mockResolvedValue(undefined),
  };
  const integration = {
    id: 'int-1',
    organizationId: 'org-1',
    internalId: 'ig-1',
    token: 'token',
    type: 'social',
    providerIdentifier: 'instagram-standalone',
    tokenExpiration: new Date(Date.now() + 86400000),
    deletedAt: null,
    disabled: false,
    inBetweenSteps: false,
    refreshNeeded: false,
  };
  let claims = 0;
  const repository = {
    activeRules: jest.fn().mockResolvedValue(rules),
    rules: jest.fn().mockResolvedValue(rules),
    answered: jest.fn().mockResolvedValue([]),
    claim: jest.fn().mockImplementation(async () => ({ id: `claim-${++claims}` })),
    finish: jest.fn().mockResolvedValue(undefined),
    createRule: jest.fn().mockImplementation(async (org: string, data: any) => ({ id: 'rule-new', organizationId: org, ...data })),
    updateRule: jest.fn().mockResolvedValue({ count: 1 }),
    getRule: jest.fn().mockResolvedValue(rule()),
    deleteRule: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const integrationService = {
    getIntegrationById: jest.fn().mockResolvedValue(integration),
    getIntegrationsList: jest.fn().mockResolvedValue([integration]),
  };
  const manager = { getSocialIntegration: jest.fn().mockReturnValue(provider) };
  const refresh = { refresh: jest.fn() };
  const start = jest.fn().mockResolvedValue({});
  const temporal = { client: { getRawClient: () => ({ workflow: { start } }) } };
  const service = new CommentsService(
    repository as any,
    integrationService as any,
    manager as any,
    refresh as any,
    temporal as any
  );
  return { service, provider, repository, integrationService, refresh, start };
};

describe('matchingRule', () => {
  it('matches the keyword anywhere in the comment, ignoring case', () => {
    expect(matchingRule([rule()], 'media-1', comment())?.id).toBe('rule-1');
    expect(matchingRule([rule()], 'media-1', comment({ text: 'nice' }))).toBeUndefined();
  });
  it('only answers comments on the rule post', () => {
    expect(matchingRule([rule()], 'media-2', comment())).toBeUndefined();
  });
  it('never answers the channel own comments', () => {
    expect(matchingRule([rule()], 'media-1', comment({ own: true }))).toBeUndefined();
  });
  it('leaves comments written before the rule existed alone', () => {
    expect(
      matchingRule([rule()], 'media-1', comment({ createdAt: '2026-11-26T08:59:59+0000' }))
    ).toBeUndefined();
    // Instagram timestamps have no milliseconds: the same second still counts
    expect(
      matchingRule(
        [rule({ createdAt: new Date('2026-11-26T09:00:00.700Z') })],
        'media-1',
        comment({ createdAt: '2026-11-26T09:00:00+0000' })
      )?.id
    ).toBe('rule-1');
  });
  it('only counts comments written after the rule was last turned on', () => {
    const resumed = rule({ activeSince: new Date('2026-11-26T09:00:45.000Z') });
    expect(matchingRule([resumed], 'media-1', comment())).toBeUndefined();
    expect(
      matchingRule([resumed], 'media-1', comment({ createdAt: '2026-11-26T09:00:50+0000' }))?.id
    ).toBe('rule-1');
  });
  it('never answers comments older than an hour', () => {
    expect(
      matchingRule([rule()], 'media-1', comment(), now + 61 * 60 * 1000)
    ).toBeUndefined();
  });
  it('skips inactive and blank keyword rules', () => {
    expect(matchingRule([rule({ active: false })], 'media-1', comment())).toBeUndefined();
    expect(matchingRule([rule({ keyword: '  ' })], 'media-1', comment())).toBeUndefined();
  });
});

describe('CommentsService auto-replies', () => {
  const flag = process.env.PD_FF_COMMENTS;
  beforeEach(() => {
    process.env.PD_FF_COMMENTS = 'on';
  });
  afterAll(() => {
    process.env.PD_FF_COMMENTS = flag;
  });

  it('stops the poller when the comments flag is off', async () => {
    const { service, provider } = setup();
    process.env.PD_FF_COMMENTS = 'off';
    expect(await service.runRules('int-1')).toBe(false);
    expect(provider.postComments).not.toHaveBeenCalled();
  });

  it('keeps polling when a token refresh fails, it may be a passing outage', async () => {
    const { service, integrationService, refresh, provider } = setup();
    integrationService.getIntegrationById.mockResolvedValue({
      ...(await integrationService.getIntegrationById()),
      tokenExpiration: new Date(now - 1000),
    });
    refresh.refresh.mockResolvedValue(false);
    expect(await service.runRules('int-1')).toBe(true);
    expect(provider.postComments).not.toHaveBeenCalled();
  });

  it('stops polling once the token has been expired for a day', async () => {
    const { service, integrationService, refresh } = setup();
    integrationService.getIntegrationById.mockResolvedValue({
      ...(await integrationService.getIntegrationById()),
      tokenExpiration: new Date(now - 25 * 60 * 60 * 1000),
    });
    refresh.refresh.mockResolvedValue(false);
    expect(await service.runRules('int-1')).toBe(false);
  });

  it('hides channels whose provider lacks the comments permission', async () => {
    const { service, provider } = setup();
    (provider as any).commentsAvailable = false;
    expect(await service.channels('org-1')).toEqual([]);
    expect(await service.runRules('int-1')).toBe(false);
  });

  it('answers a new matching comment once, through the provider', async () => {
    const { service, provider, repository } = setup([
      comment(),
      comment({ id: 'c-2', text: 'love it' }),
      comment({ id: 'c-3', own: true, text: 'price is in bio' }),
    ]);

    expect(await service.runRules('int-1')).toBe(true);

    expect(provider.postComments).toHaveBeenCalledWith('ig-1', 'token', 'media-1');
    expect(repository.claim).toHaveBeenCalledTimes(1);
    expect(repository.claim).toHaveBeenCalledWith('int-1', 'rule-1', 'c-1');
    expect(provider.replyToComment).toHaveBeenCalledWith(
      'ig-1',
      'token',
      'c-1',
      'Sent you the price list!'
    );
    expect(repository.finish).toHaveBeenCalledWith('claim-1', 'replied', 'reply-1');
  });

  it('does not answer a comment another run already claimed', async () => {
    const { service, provider, repository } = setup();
    repository.claim.mockResolvedValue(null);

    await service.runRules('int-1');

    expect(provider.replyToComment).not.toHaveBeenCalled();
  });

  it('records a failed reply and keeps going', async () => {
    const { service, provider, repository } = setup([
      comment(),
      comment({ id: 'c-2', text: 'price?' }),
    ]);
    provider.replyToComment
      .mockRejectedValueOnce(new Error('rate limited'))
      .mockResolvedValueOnce({ id: 'reply-2' });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await service.runRules('int-1');

    expect(repository.finish).toHaveBeenCalledWith('claim-1', 'failed', null);
    expect(repository.finish).toHaveBeenCalledWith('claim-2', 'replied', 'reply-2');
  });

  it('stops the poller when there is no active rule', async () => {
    const { service, provider } = setup([comment()], []);
    expect(await service.runRules('int-1')).toBe(false);
    expect(provider.postComments).not.toHaveBeenCalled();
  });

  it('stops the poller when the channel is gone or off', async () => {
    const { service, integrationService, provider } = setup();
    integrationService.getIntegrationById.mockResolvedValue({
      ...(await integrationService.getIntegrationById()),
      disabled: true,
    });
    expect(await service.runRules('int-1')).toBe(false);
    expect(provider.postComments).not.toHaveBeenCalled();
  });

  it('answers while the comments view reads a post', async () => {
    const { service, provider, repository } = setup();
    repository.answered.mockResolvedValue([{ commentId: 'c-1', status: 'replied' }]);

    const result = await service.comments('org-1', 'int-1', 'media-1');

    expect(provider.replyToComment).toHaveBeenCalledTimes(1);
    expect(result.comments[0].id).toBe('c-1');
    expect(result.rules).toHaveLength(1);
    expect(result.autoReplies).toEqual({ 'c-1': 'replied' });
  });
});

describe('CommentsService rules', () => {
  it('saves a rule and starts the channel poller fresh', async () => {
    const { service, repository, start } = setup();

    await service.createRule('org-1', 'int-1', 'media-1', {
      keyword: ' price ',
      reply: ' Sent! ',
    });

    expect(repository.createRule).toHaveBeenCalledWith('org-1', {
      integrationId: 'int-1',
      postId: 'media-1',
      keyword: 'price',
      reply: 'Sent!',
    });
    expect(start).toHaveBeenCalledWith(
      'commentRulesWorkflowV1',
      expect.objectContaining({
        workflowId: 'comment-rules-int-1',
        taskQueue: 'main',
        workflowIdConflictPolicy: 'TERMINATE_EXISTING',
      })
    );
  });

  it('rejects a rule on a channel without comment support', async () => {
    const { service, integrationService } = setup();
    integrationService.getIntegrationById.mockResolvedValue(null);
    await expect(
      service.createRule('org-1', 'int-1', 'media-1', { keyword: 'a', reply: 'b' })
    ).rejects.toThrow();
  });
});

describe('CommentsService turning a rule back on', () => {
  it('restarts the rule clock so it never answers the backlog', async () => {
    const { service, repository, start } = setup();
    await service.setRuleActive('org-1', 'rule-1', true);
    expect(repository.updateRule).toHaveBeenCalledWith('org-1', 'rule-1', {
      active: true,
      activeSince: new Date(now),
    });
    expect(start).toHaveBeenCalled();
  });
  it('leaves the clock alone when a rule is paused', async () => {
    const { service, repository } = setup();
    await service.setRuleActive('org-1', 'rule-1', false);
    expect(repository.updateRule).toHaveBeenCalledWith('org-1', 'rule-1', { active: false });
  });
});
