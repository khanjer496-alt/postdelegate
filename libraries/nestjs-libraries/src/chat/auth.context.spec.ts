import {
  SUBSCRIPTION_ENDED_MESSAGE,
  subscriptionEnded,
} from '@gitroom/nestjs-libraries/chat/auth.context';

describe('subscriptionEnded (MCP auth)', () => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  afterEach(() => {
    if (stripeKey === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
    } else {
      process.env.STRIPE_SECRET_KEY = stripeKey;
    }
  });

  it('blocks an organization without a subscription when billing is on', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    expect(subscriptionEnded({ subscription: null })).toBe(true);
  });

  it('lets a subscribed organization through', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    expect(
      subscriptionEnded({ subscription: { subscriptionTier: 'PRO' } })
    ).toBe(false);
  });

  it('never blocks when billing is off (self-hosted)', () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(subscriptionEnded({ subscription: null })).toBe(false);
  });

  it('leaves a missing organization to the invalid token answer', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    expect(subscriptionEnded(undefined)).toBe(false);
  });

  it('says the subscription has ended in plain words', () => {
    expect(SUBSCRIPTION_ENDED_MESSAGE).toContain(
      'Your PostDelegate subscription has ended'
    );
  });
});
