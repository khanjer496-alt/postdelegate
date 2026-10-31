// Network families in the PostDelegate channel directory.
// `available` marks networks that can be connected in the app today; every other
// network is coming soon and directory presence is not a claim of access.
// Caption limits are tool estimates; providers validate the actual post.
// unit: codepoints | utf16 | utf8_bytes | graphemes | codepoints_emoji_bytes | weighted (X)
export interface Network {
  key: string; name: string; color: string; abbr: string; limit: number;
  unit: string; urlCost?: number; noMentionDomain?: boolean; scheduler?: string; note?: string; available?: boolean;
}
export const NETWORKS: Network[] = [
  { key: 'instagram', name: 'Instagram', color: '#c4256e', abbr: 'Ig', limit: 2200, unit: 'codepoints', scheduler: 'instagram-scheduler' },
  { key: 'facebook', name: 'Facebook', color: '#1877f2', abbr: 'Fb', limit: 63206, unit: 'codepoints', scheduler: 'facebook-scheduler' },
  { key: 'linkedin', name: 'LinkedIn', color: '#0a66c2', abbr: 'in', limit: 3000, unit: 'codepoints', scheduler: 'linkedin-scheduler' },
  { key: 'tiktok', name: 'TikTok', color: '#25f4ee', abbr: 'Tk', limit: 2200, unit: 'utf16', scheduler: 'tiktok-scheduler' },
  { key: 'youtube', name: 'YouTube', color: '#ff0000', abbr: 'Yt', limit: 5000, unit: 'utf8_bytes', scheduler: 'youtube-scheduler', available: true },
  { key: 'x', name: 'X', color: '#e7e7ea', abbr: 'X', limit: 280, unit: 'weighted', note: 'Premium accounts get 25,000.' },
  { key: 'threads', name: 'Threads', color: '#9aa0b4', abbr: 'Th', limit: 500, unit: 'codepoints_emoji_bytes', scheduler: 'threads-scheduler' },
  { key: 'bluesky', name: 'Bluesky', color: '#0085ff', abbr: 'Bs', limit: 300, unit: 'graphemes', scheduler: 'bluesky-scheduler', available: true },
  { key: 'pinterest', name: 'Pinterest', color: '#e60023', abbr: 'Pi', limit: 500, unit: 'codepoints', scheduler: 'pinterest-scheduler' },
  { key: 'mastodon', name: 'Mastodon', color: '#6364ff', abbr: 'Ma', limit: 500, unit: 'codepoints', urlCost: 23, noMentionDomain: true, scheduler: 'mastodon-scheduler' },
  { key: 'google_business', name: 'Google Business', color: '#4285f4', abbr: 'Gb', limit: 1500, unit: 'codepoints', scheduler: 'google-business-scheduler' },
  { key: 'reddit', name: 'Reddit', color: '#ff4500', abbr: 'Re', limit: 40000, unit: 'codepoints' },
  { key: 'telegram', name: 'Telegram', color: '#26a5e4', abbr: 'Tg', limit: 4096, unit: 'codepoints' },
  { key: 'discord', name: 'Discord', color: '#5865f2', abbr: 'Dc', limit: 2000, unit: 'codepoints' },
  { key: 'slack', name: 'Slack', color: '#8c3a90', abbr: 'Sl', limit: 4000, unit: 'codepoints', scheduler: 'slack-scheduler', available: true },
  { key: 'tumblr', name: 'Tumblr', color: '#5a7396', abbr: 'Tu', limit: 32768, unit: 'codepoints', scheduler: 'tumblr-scheduler', available: true },
  { key: 'lemmy', name: 'Lemmy', color: '#00bc8c', abbr: 'Le', limit: 10000, unit: 'codepoints', scheduler: 'lemmy-scheduler', available: true },
  { key: 'nostr', name: 'Nostr', color: '#8e30eb', abbr: 'No', limit: 100000, unit: 'codepoints', scheduler: 'nostr-scheduler', available: true },
  { key: 'farcaster', name: 'Farcaster', color: '#8a63d2', abbr: 'Fc', limit: 320, unit: 'utf8_bytes' },
  { key: 'twitch', name: 'Twitch', color: '#9146ff', abbr: 'Tw', limit: 500, unit: 'codepoints', scheduler: 'twitch-scheduler', available: true },
  { key: 'kick', name: 'Kick', color: '#53fc18', abbr: 'Ki', limit: 500, unit: 'codepoints', scheduler: 'kick-scheduler', available: true },
  { key: 'dribbble', name: 'Dribbble', color: '#ea4c89', abbr: 'Dr', limit: 40000, unit: 'codepoints', scheduler: 'dribbble-scheduler', available: true },
  { key: 'devto', name: 'DEV.to', color: '#e7e7ea', abbr: 'De', limit: 100000, unit: 'codepoints', scheduler: 'devto-scheduler', available: true },
  { key: 'medium', name: 'Medium', color: '#e7e7ea', abbr: 'Me', limit: 100000, unit: 'codepoints', scheduler: 'medium-scheduler', available: true },
  { key: 'wordpress', name: 'WordPress', color: '#21759b', abbr: 'Wp', limit: 100000, unit: 'codepoints', scheduler: 'wordpress-scheduler', available: true },
  { key: 'hashnode', name: 'Hashnode', color: '#2962ff', abbr: 'Hn', limit: 10000, unit: 'codepoints', scheduler: 'hashnode-scheduler', available: true },
  { key: 'listmonk', name: 'Listmonk (email)', color: '#0055d4', abbr: 'Lm', limit: 100000, unit: 'codepoints', scheduler: 'listmonk-scheduler', available: true },
  { key: 'vk', name: 'VK', color: '#0077ff', abbr: 'VK', limit: 0, unit: 'not-assessed', note: 'Connection rollout pending.' },
  { key: 'whop', name: 'Whop', color: '#ff6243', abbr: 'Wh', limit: 0, unit: 'not-assessed', note: 'Connection rollout pending.' },
  { key: 'skool', name: 'Skool', color: '#f9d54a', abbr: 'Sk', limit: 0, unit: 'not-assessed', note: 'Connection rollout pending.' },
  { key: 'mewe', name: 'MeWe', color: '#18b69b', abbr: 'Mw', limit: 0, unit: 'not-assessed', note: 'Connection rollout pending.' },
  { key: 'moltbook', name: 'Moltbook', color: '#e85b48', abbr: 'Mb', limit: 0, unit: 'not-assessed', note: 'Connection rollout pending.' },
];
export const NETWORK_COUNT = NETWORKS.length;
export const AVAILABLE_NETWORKS = NETWORKS.filter((network) => network.available);
