const mockStripe = {
  prices: { list: jest.fn(), create: jest.fn() },
  products: { list: jest.fn(), create: jest.fn() },
  subscriptions: { list: jest.fn(), cancel: jest.fn() },
  billingPortal: { sessions: { create: jest.fn() } },
};

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn(() => mockStripe),
}));
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service',
  () => ({ SubscriptionService: class {} })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service',
  () => ({ OrganizationService: class {} })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/users/users.service',
  () => ({ UsersService: class {} })
);
jest.mock('@gitroom/nestjs-libraries/track/track.service', () => ({
  TrackService: class {},
}));
jest.mock('@gitroom/helpers/auth/auth.service', () => ({ AuthService: {} }));

import {
  resolveTierPrice,
  StripeService,
} from '@gitroom/nestjs-libraries/services/stripe.service';

describe('resolveTierPrice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('uses the price found by lookup key when the amount matches', async () => {
    mockStripe.prices.list.mockResolvedValueOnce({
      data: [{ id: 'price_starter_month', unit_amount: 1900 }],
    });

    const price = await resolveTierPrice(
      mockStripe as any,
      'STANDARD',
      'MONTHLY'
    );

    expect(price.id).toBe('price_starter_month');
    expect(mockStripe.prices.list).toHaveBeenCalledWith({
      lookup_keys: ['postdelegate_starter_month'],
      active: true,
    });
    expect(mockStripe.products.list).not.toHaveBeenCalled();
    expect(mockStripe.prices.create).not.toHaveBeenCalled();
  });

  it('builds the yearly lookup key and amount', async () => {
    mockStripe.prices.list.mockResolvedValueOnce({
      data: [{ id: 'price_ultimate_year', unit_amount: 75600 }],
    });

    const price = await resolveTierPrice(
      mockStripe as any,
      'ULTIMATE',
      'YEARLY'
    );

    expect(price.id).toBe('price_ultimate_year');
    expect(mockStripe.prices.list.mock.calls[0][0].lookup_keys).toEqual([
      'postdelegate_ultimate_year',
    ]);
  });

  it('falls back to the name based lookup when the amount does not match', async () => {
    mockStripe.prices.list
      .mockResolvedValueOnce({
        data: [{ id: 'price_wrong', unit_amount: 2900 }],
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'price_by_name',
            unit_amount: 1900,
            recurring: { interval: 'month' },
          },
        ],
      });
    mockStripe.products.list.mockResolvedValueOnce({
      data: [{ id: 'prod_1', name: 'standard' }],
    });

    const price = await resolveTierPrice(
      mockStripe as any,
      'STANDARD',
      'MONTHLY'
    );

    expect(price.id).toBe('price_by_name');
    expect(console.warn).toHaveBeenCalled();
    expect(mockStripe.prices.create).not.toHaveBeenCalled();
  });

  it('creates the product and price when nothing exists', async () => {
    mockStripe.prices.list
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] });
    mockStripe.products.list.mockResolvedValueOnce({ data: [] });
    mockStripe.products.create.mockResolvedValueOnce({ id: 'prod_new' });
    mockStripe.prices.create.mockResolvedValueOnce({ id: 'price_new' });

    const price = await resolveTierPrice(mockStripe as any, 'TEAM', 'YEARLY');

    expect(price.id).toBe('price_new');
    expect(mockStripe.products.create).toHaveBeenCalledWith({
      active: true,
      name: 'TEAM',
    });
    expect(mockStripe.prices.create).toHaveBeenCalledWith(
      expect.objectContaining({
        product: 'prod_new',
        unit_amount: 27600,
        recurring: { interval: 'year' },
      })
    );
  });
});

describe('StripeService failed payments', () => {
  const subscriptionService = {
    createOrUpdateSubscription: jest.fn(),
    deleteSubscription: jest.fn(),
  };
  const organizationService = {
    getOrgByCustomerId: jest.fn().mockResolvedValue({ allowTrial: false }),
  };
  const service = new StripeService(
    subscriptionService as any,
    organizationService as any,
    {} as any,
    {} as any
  );

  const event = (status: string, id = 'sub_1') =>
    ({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id,
          status,
          customer: 'cus_1',
          cancel_at: null,
          metadata: {
            service: 'gitroom',
            billing: 'STANDARD',
            period: 'MONTHLY',
            uniqueId: 'u1',
          },
        },
      },
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    mockStripe.subscriptions.list.mockResolvedValue({ data: [] });
  });

  it.each(['unpaid', 'canceled', 'incomplete_expired'])(
    'drops the paid tier when a subscription becomes %s',
    async (status) => {
      await service.processWebhook(event(status));

      expect(subscriptionService.deleteSubscription).toHaveBeenCalledWith(
        'cus_1',
        'stripe'
      );
      expect(
        subscriptionService.createOrUpdateSubscription
      ).not.toHaveBeenCalled();
    }
  );

  it('keeps the tier while Stripe retries a past_due renewal', async () => {
    await service.processWebhook(event('past_due'));

    expect(subscriptionService.deleteSubscription).not.toHaveBeenCalled();
    expect(subscriptionService.createOrUpdateSubscription).toHaveBeenCalled();
  });

  it('does not treat an unpaid sibling as a survivor', async () => {
    mockStripe.subscriptions.list.mockResolvedValue({
      data: [
        { id: 'sub_1', status: 'unpaid', metadata: {} },
        { id: 'sub_other', status: 'unpaid', metadata: {} },
      ],
    });

    await service.processWebhook(event('unpaid'));

    expect(subscriptionService.deleteSubscription).toHaveBeenCalled();
  });

  it('keeps an active survivor instead of downgrading', async () => {
    mockStripe.subscriptions.list.mockResolvedValue({
      data: [
        { id: 'sub_1', status: 'unpaid', metadata: {} },
        {
          id: 'sub_2',
          status: 'active',
          cancel_at: null,
          metadata: {
            billing: 'PRO',
            period: 'MONTHLY',
            uniqueId: 'u2',
          },
        },
      ],
    });

    await service.processWebhook(event('unpaid'));

    expect(subscriptionService.deleteSubscription).not.toHaveBeenCalled();
    expect(subscriptionService.createOrUpdateSubscription).toHaveBeenCalledWith(
      'stripe',
      false,
      'u2',
      'cus_1',
      expect.any(Number),
      'PRO',
      'MONTHLY',
      null
    );
  });
});

describe('createBillingPortalLink', () => {
  const service = new StripeService({} as any, {} as any, {} as any, {} as any);
  const original = process.env.STRIPE_PORTAL_CONFIGURATION;
  afterEach(() => {
    if (original === undefined) {
      delete process.env.STRIPE_PORTAL_CONFIGURATION;
    } else {
      process.env.STRIPE_PORTAL_CONFIGURATION = original;
    }
  });

  it('only passes a configuration when one is set', async () => {
    delete process.env.STRIPE_PORTAL_CONFIGURATION;
    await service.createBillingPortalLink('cus_1');
    expect(
      mockStripe.billingPortal.sessions.create.mock.calls[0][0]
    ).not.toHaveProperty('configuration');

    process.env.STRIPE_PORTAL_CONFIGURATION = 'bpc_123';
    await service.createBillingPortalLink('cus_1');
    expect(
      mockStripe.billingPortal.sessions.create.mock.calls[1][0].configuration
    ).toBe('bpc_123');
  });
});
