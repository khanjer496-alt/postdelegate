// the real services pull in every social provider, the specs only need the types
jest.mock('@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service', () => ({ SubscriptionService: class {} }));
jest.mock('@gitroom/nestjs-libraries/database/prisma/posts/posts.service', () => ({ PostsService: class {} }));
jest.mock('@gitroom/nestjs-libraries/database/prisma/integrations/integration.service', () => ({ IntegrationService: class {} }));
jest.mock('@gitroom/nestjs-libraries/database/prisma/webhooks/webhooks.service', () => ({ WebhooksService: class {} }));
jest.mock('@gitroom/nestjs-libraries/database/prisma/ai-credentials/ai.credential.service', () => ({ AiCredentialService: class {} }));

import { PermissionsService } from './permissions.service';
import { AuthorizationActions, Sections } from './permission.exception.class';
import {
  freeChannels,
  planOptionsOf,
  pricing,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';

const create = AuthorizationActions.Create;
const channel = (id: string) => ({ id, disabled: false, inBetweenSteps: false, refreshNeeded: false, deletedAt: null });

const makeService = (opts: { tier?: string; posts?: number; channels?: number }) => {
  const subscription = opts.tier ? { subscriptionTier: opts.tier, totalChannels: 0 } : null;
  return new PermissionsService(
    {
      getSubscriptionByOrganizationId: jest.fn().mockResolvedValue(subscription),
      getSubscription: jest.fn().mockResolvedValue(subscription),
    } as any,
    { countPostsFromDay: jest.fn().mockResolvedValue(opts.posts || 0) } as any,
    {
      getIntegrationsList: jest
        .fn()
        .mockResolvedValue(Array.from({ length: opts.channels || 0 }, (_, i) => channel(`c${i}`))),
      getIntegrationByInternalId: jest.fn(),
    } as any,
    { getTotal: jest.fn().mockResolvedValue(0) } as any,
    { hasCredential: jest.fn().mockResolvedValue(false) } as any
  );
};

const can = async (section: Sections, opts: Parameters<typeof makeService>[0]) =>
  (await makeService(opts).check('org', new Date(), 'ADMIN', [[create, section]])).can(create, section);

describe('free plan (PD_FF_FREE_PLAN)', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_x';
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it('changes nothing while the flag is off', async () => {
    delete process.env.PD_FF_FREE_PLAN;
    expect(planOptionsOf('FREE')).toBe(pricing.FREE);
    expect(freeChannels()).toBe(pricing.FREE.channel || 0);
    expect(await can(Sections.CHANNEL, {})).toBe(false);
    expect(await can(Sections.POSTS_PER_MONTH, {})).toBe(false);
    expect(await makeService({}).freePlanUsage('org', new Date())).toBeNull();
  });

  it('optin does not turn on plan limits (they are not per visitor)', () => {
    process.env.PD_FF_FREE_PLAN = 'optin';
    expect(planOptionsOf('FREE')).toBe(pricing.FREE);
  });

  describe('flag on', () => {
    beforeEach(() => {
      process.env.PD_FF_FREE_PLAN = 'on';
    });

    it('allows 3 channels and 20 posts a month without a plan', async () => {
      expect(freeChannels()).toBe(3);
      expect(await can(Sections.CHANNEL, { channels: 2 })).toBe(true);
      expect(await can(Sections.CHANNEL, { channels: 3 })).toBe(false);
      expect(await can(Sections.POSTS_PER_MONTH, { posts: 19 })).toBe(true);
      expect(await can(Sections.POSTS_PER_MONTH, { posts: 20 })).toBe(false);
    });

    it('keeps the paid features off and paid plans unchanged', async () => {
      expect(await can(Sections.TEAM_MEMBERS, {})).toBe(false);
      expect(await can(Sections.ANALYTICS_REPORTS, {})).toBe(false);
      expect(planOptionsOf('FREE').provider_posts_per_month).toEqual({ x: 0 });
      expect(planOptionsOf('STANDARD')).toBe(pricing.STANDARD);
      expect(pricing.FREE.channel).toBe(0);
      expect(pricing.FREE.posts_per_month).toBe(0);
    });

    it('reports this month\'s use, only without a subscription', async () => {
      expect(await makeService({ posts: 4, channels: 1 }).freePlanUsage('org', new Date())).toEqual({
        limits: { workspaces: 1, channel: 3, posts_per_month: 20 },
        posts: 4,
        channels: 1,
      });
      expect(await makeService({ tier: 'STANDARD' }).freePlanUsage('org', new Date())).toBeNull();
    });
  });
});
