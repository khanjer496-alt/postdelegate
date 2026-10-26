// Audience directions for early access, not purchasable subscription packages.
export interface Plan {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  features: string[];
  popular?: boolean;
}

export const PLANS: Plan[] = [
  {
    slug: 'solo', name: 'Solo', tagline: 'For your own content.',
    description: 'A clearer rhythm for one person planning their social presence.',
    features: ['Draft and preview posts', 'Plan in a visual calendar', 'Keep your media together'],
  },
  {
    slug: 'teams', name: 'Teams', tagline: 'For working together.', popular: true,
    description: 'A shared place for the people behind your content.',
    features: ['Collaborate in a workspace', 'Invite your team', 'Discuss posts with internal comments'],
  },
  {
    slug: 'agencies', name: 'Agencies', tagline: 'For more than one brand.',
    description: 'Keep client channels and content easier to find.',
    features: ['Organize channels by customer', 'Plan content across brands', 'Keep reusable posting sets'],
  },
  {
    slug: 'custom', name: 'Custom', tagline: 'For a different kind of setup.',
    description: 'Talk through your channels, team and automation needs.',
    features: ['Discuss your publishing workflow', 'Explore integration requirements', 'Plan your onboarding'],
  },
];
