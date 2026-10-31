// Subscription plans as configured in the app (libraries/.../subscriptions/pricing.ts) and
// documented at /docs/billing. Prices are US dollars; every plan starts with a 7-day free trial that needs no card.
export interface Plan {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  monthly: number;
  yearly: number;
  channels: number;
  teamMembers: boolean;
  webhooks: number;
  popular?: boolean;
}

export const TRIAL_DAYS = 7;

export const PLANS: Plan[] = [
  {
    slug: 'starter', name: 'Starter', tagline: 'For your own content.',
    description: 'A clearer rhythm for one person planning their social presence.',
    monthly: 19, yearly: 180, channels: 5, teamMembers: false, webhooks: 2,
  },
  {
    slug: 'team', name: 'Team', tagline: 'For working together.', popular: true,
    description: 'A shared place for the people behind your content.',
    monthly: 29, yearly: 276, channels: 10, teamMembers: true, webhooks: 10,
  },
  {
    slug: 'pro', name: 'Pro', tagline: 'For more than one brand.',
    description: 'Room for client channels and content across several brands.',
    monthly: 39, yearly: 372, channels: 30, teamMembers: true, webhooks: 30,
  },
  {
    slug: 'ultimate', name: 'Ultimate', tagline: 'For a lot of channels.',
    description: 'For agencies and networks running many accounts and automations.',
    monthly: 79, yearly: 756, channels: 100, teamMembers: true, webhooks: 10000,
  },
];

export const planFeatures = (plan: Plan) => [
  `${plan.channels} channels`,
  plan.teamMembers ? 'Invite team members' : 'Just you, no team seats',
  'No practical limit on posts',
  'Public API and MCP',
  `${plan.webhooks.toLocaleString('en-US')} webhooks`,
];
