const mockStripe = {
  prices: { list: jest.fn(), create: jest.fn() },
  products: { list: jest.fn(), create: jest.fn() },
  subscriptions: { list: jest.fn(), cancel: jest.fn() },
  billingPortal: { sessions: { create: jest.fn() } },
  invoicePayments: { list: jest.fn() },
  charges: { retrieve: jest.fn() },
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

describe('StripeService affiliate events', () => {
  const affiliateService = {
    recordInvoicePayment: jest.fn(),
    reverseCommission: jest.fn(),
  };
  const service = new StripeService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    affiliateService as any
  );

  const invoiceEvent = (over: Record<string, unknown> = {}) =>
    ({
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          id: 'in_1',
          customer: 'cus_1',
          amount_paid: 2900,
          total: 2900,
          total_taxes: [{ amount: 400, tax_behavior: 'exclusive' }],
          currency: 'usd',
          created: 1790000000,
          status_transitions: { paid_at: 1790000100 },
          metadata: {},
          ...over,
        },
      },
    } as any);

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('records the commission of a paid invoice without needing gitroom metadata', async () => {
    await service.processWebhook(invoiceEvent());

    expect(affiliateService.recordInvoicePayment).toHaveBeenCalledWith({
      invoiceId: 'in_1',
      customerId: 'cus_1',
      amountPaidCents: 2900,
      totalCents: 2900,
      taxCents: 400,
      currency: 'usd',
      paidAt: new Date(1790000100 * 1000),
    });
  });

  it('reads the customer from an expanded object and falls back to the creation date', async () => {
    await service.processWebhook(
      invoiceEvent({
        customer: { id: 'cus_9' },
        status_transitions: { paid_at: null },
        total_taxes: null,
      })
    );

    expect(affiliateService.recordInvoicePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cus_9',
        taxCents: 0,
        paidAt: new Date(1790000000 * 1000),
      })
    );
  });

  it('does not fail the webhook when the commission cannot be recorded', async () => {
    affiliateService.recordInvoicePayment.mockRejectedValue(new Error('db'));

    await expect(service.processWebhook(invoiceEvent())).resolves.toEqual({
      ok: true,
    });
    expect(console.error).toHaveBeenCalledWith(
      'affiliate_commission_failed',
      { stripe_invoice_id: 'in_1' },
      expect.any(Error)
    );
  });

  it('reverses the commission on charge.refunded although the charge has no service metadata', async () => {
    mockStripe.invoicePayments.list.mockResolvedValue({
      data: [{ invoice: 'in_1' }],
    });

    await service.processWebhook({
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_1',
          payment_intent: 'pi_1',
          amount: 2900,
          amount_refunded: 1450,
          metadata: {},
        },
      },
    } as any);

    expect(mockStripe.invoicePayments.list).toHaveBeenCalledWith({
      payment: { type: 'payment_intent', payment_intent: 'pi_1' },
      limit: 1,
    });
    expect(affiliateService.reverseCommission).toHaveBeenCalledWith({
      invoiceId: 'in_1',
      reversedCents: 1450,
      chargedCents: 2900,
    });
  });

  it('uses the invoice that older API versions put on the charge', async () => {
    await service.processWebhook({
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_1',
          invoice: 'in_old',
          amount: 1000,
          amount_refunded: 1000,
        },
      },
    } as any);

    expect(mockStripe.invoicePayments.list).not.toHaveBeenCalled();
    expect(affiliateService.reverseCommission).toHaveBeenCalledWith({
      invoiceId: 'in_old',
      reversedCents: 1000,
      chargedCents: 1000,
    });
  });

  it('ignores refunds of charges that belong to no invoice', async () => {
    mockStripe.invoicePayments.list.mockResolvedValue({ data: [] });

    await expect(
      service.processWebhook({
        type: 'charge.refunded',
        data: {
          object: {
            id: 'ch_1',
            payment_intent: 'pi_1',
            amount: 1000,
            amount_refunded: 1000,
          },
        },
      } as any)
    ).resolves.toEqual({ ok: true });
    expect(affiliateService.reverseCommission).not.toHaveBeenCalled();
  });

  it('reverses the disputed share on charge.dispute.created', async () => {
    mockStripe.charges.retrieve.mockResolvedValue({
      id: 'ch_1',
      payment_intent: 'pi_1',
      amount: 2900,
    });
    mockStripe.invoicePayments.list.mockResolvedValue({
      data: [{ invoice: { id: 'in_1' } }],
    });

    await service.processWebhook({
      type: 'charge.dispute.created',
      data: { object: { id: 'dp_1', charge: 'ch_1', amount: 2900 } },
    } as any);

    expect(mockStripe.charges.retrieve).toHaveBeenCalledWith('ch_1');
    expect(affiliateService.reverseCommission).toHaveBeenCalledWith({
      invoiceId: 'in_1',
      reversedCents: 2900,
      chargedCents: 2900,
    });
  });

  it('does not fail the webhook when a refund cannot be processed', async () => {
    mockStripe.invoicePayments.list.mockRejectedValue(new Error('stripe'));

    await expect(
      service.processWebhook({
        type: 'charge.refunded',
        data: {
          object: { id: 'ch_1', payment_intent: 'pi_1', amount: 1, amount_refunded: 1 },
        },
      } as any)
    ).resolves.toEqual({ ok: true });
  });

  it('still ignores other events that carry no gitroom metadata', async () => {
    await service.processWebhook({
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_1', metadata: {} } },
    } as any);
    await service.processWebhook({
      type: 'charge.succeeded',
      data: { object: { id: 'ch_1', metadata: {} } },
    } as any);

    expect(affiliateService.recordInvoicePayment).not.toHaveBeenCalled();
    expect(affiliateService.reverseCommission).not.toHaveBeenCalled();
    expect(mockStripe.invoicePayments.list).not.toHaveBeenCalled();
  });
});
