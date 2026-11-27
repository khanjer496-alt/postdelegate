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
  // per channel above `channels`, for the plan that sells extra channels
  extraChannelMonthly?: number;
  extraChannelYearly?: number;
  // the most channels with extra channels, MAX_EXTRA_CHANNELS in the app
  maxChannels?: number;
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
    slug: 'team', name: 'Team', tagline: 'For working together.',
    description: 'A shared place for the people behind your content.',
    monthly: 29, yearly: 276, channels: 10, teamMembers: true, webhooks: 10,
  },
  {
    slug: 'pro', name: 'Pro', tagline: 'For more than one brand.', popular: true,
    description: 'Room for client channels and content across several brands.',
    monthly: 39, yearly: 372, channels: 30, teamMembers: true, webhooks: 30,
  },
  {
    slug: 'ultimate', name: 'Ultimate', tagline: 'For a lot of channels.',
    description: 'For agencies and networks running many accounts and automations.',
    monthly: 79, yearly: 756, channels: 100, teamMembers: true, webhooks: 10000,
    extraChannelMonthly: 1, extraChannelYearly: 9.6, maxChannels: 1000,
  },
];

// "100 channels, then $1/month per extra channel"
export const planChannels = (plan: Plan) =>
  plan.extraChannelMonthly
    ? `${plan.channels} channels, then $${plan.extraChannelMonthly}/month per extra channel, up to ${(plan.maxChannels || plan.channels).toLocaleString('en-US')}`
    : `${plan.channels} channels`;

export const planFeatures = (plan: Plan) => [
  planChannels(plan),
  plan.teamMembers ? 'Unlimited team members' : 'Just you, no team members',
  'Unlimited posts per month',
  'Public API and MCP',
  `${plan.webhooks.toLocaleString('en-US')} webhooks`,
];

// The pricing card list: what each plan gets you, with an icon key for Pricing.astro.
// Same facts as planFeatures, worded as results; channels have their own block on the card.
// The words come from the page's language (src/i18n/locales, `perks`).
export interface PlanPerk { icon: 'team' | 'solo' | 'posts' | 'agent' | 'webhook' | 'studio' | 'ai'; text: string; note?: string }
export interface PlanPerkStrings {
  team: string; solo: string; soloNote: string; posts: string; agent: string; agentNote: string;
  webhooks: (count: string) => string; webhooksNote: string; studio: string; studioNote: string; ai: string; aiNote: string;
}
export const planPerks = (plan: Plan, t: PlanPerkStrings, numberLocale = 'en-US'): PlanPerk[] => [
  plan.teamMembers
    ? { icon: 'team', text: t.team }
    : { icon: 'solo', text: t.solo, note: t.soloNote },
  { icon: 'posts', text: t.posts },
  { icon: 'agent', text: t.agent, note: t.agentNote },
  { icon: 'webhook', text: t.webhooks(plan.webhooks.toLocaleString(numberLocale)), note: t.webhooksNote },
  { icon: 'studio', text: t.studio, note: t.studioNote },
  { icon: 'ai', text: t.ai, note: t.aiNote },
];
