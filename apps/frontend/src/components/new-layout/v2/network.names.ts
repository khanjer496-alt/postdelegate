// display names for provider identifiers, for the v2 labels
const NAMES: Record<string, string> = {
  x: 'X',
  'x-own-key': 'X',
  linkedin: 'LinkedIn',
  'linkedin-page': 'LinkedIn',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  'instagram-standalone': 'Instagram',
  facebook: 'Facebook',
  threads: 'Threads',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  discord: 'Discord',
  telegram: 'Telegram',
  slack: 'Slack',
  medium: 'Medium',
  reddit: 'Reddit',
  pinterest: 'Pinterest',
  dribbble: 'Dribbble',
  lemmy: 'Lemmy',
  wordpress: 'WordPress',
  devto: 'DEV',
  hashnode: 'Hashnode',
  nostr: 'Nostr',
  vk: 'VK',
  gmb: 'Google Business',
  warpcast: 'Warpcast',
};

export const networkName = (identifier: string) =>
  NAMES[identifier] ||
  identifier
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
