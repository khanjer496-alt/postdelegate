// Network families in the PostDelegate channel directory.
// `available` marks networks that can be connected in the app today. WAITING_KEYS are the
// networks that are not live yet but are on their way (waiting on platform approval or verification).
// Every other network here (X, Farcaster) is not offered on
// PostDelegate and is listed only for the free tools' character limits.
// Caption limits are tool estimates; providers validate the actual post.
// unit: codepoints | utf16 | utf8_bytes | graphemes | codepoints_emoji_bytes | weighted (X)
export interface Network {
  key: string; name: string; color: string; abbr: string; limit: number;
  unit: string; urlCost?: number; noMentionDomain?: boolean; scheduler?: string; note?: string; available?: boolean;
  /** The app's provider identifier (the MCP and API `platform`), when it differs from `key`. */
  identifier?: string;
  /** Destination still pending when another account type in this family is live. */
  pendingName?: string;
  /** Available networks: one line on what you can schedule there, from its channel guide. */
  blurb?: string;
}
export const NETWORKS: Network[] = [
  { key: 'instagram', name: 'Instagram', color: '#c4256e', abbr: 'Ig', limit: 2200, unit: 'codepoints', scheduler: 'instagram-scheduler' },
  { key: 'facebook', name: 'Facebook', color: '#1877f2', abbr: 'Fb', limit: 63206, unit: 'codepoints', scheduler: 'facebook-scheduler' },
  { key: 'linkedin', name: 'LinkedIn (personal)', color: '#0a66c2', abbr: 'in', limit: 3000, unit: 'codepoints', scheduler: 'linkedin-scheduler', available: true, pendingName: 'LinkedIn Pages', blurb: 'Posts to your personal profile. Company Pages are waiting on approval.' },
  { key: 'tiktok', name: 'TikTok', color: '#25f4ee', abbr: 'Tk', limit: 2200, unit: 'utf16', scheduler: 'tiktok-scheduler' },
  { key: 'youtube', name: 'YouTube', color: '#ff0000', abbr: 'Yt', limit: 5000, unit: 'utf8_bytes', scheduler: 'youtube-scheduler', available: true, blurb: 'Video uploads with a title, visibility, thumbnail and tags.' },
  { key: 'x', name: 'X', color: '#e7e7ea', abbr: 'X', limit: 280, unit: 'weighted', note: 'Premium accounts get 25,000.' },
  { key: 'threads', name: 'Threads', color: '#9aa0b4', abbr: 'Th', limit: 500, unit: 'codepoints_emoji_bytes', scheduler: 'threads-scheduler' },
  { key: 'bluesky', name: 'Bluesky', color: '#0085ff', abbr: 'Bs', limit: 300, unit: 'graphemes', scheduler: 'bluesky-scheduler', available: true, blurb: 'Posts and threads, connected with an app password.' },
  { key: 'pinterest', name: 'Pinterest', color: '#e60023', abbr: 'Pi', limit: 500, unit: 'codepoints', scheduler: 'pinterest-scheduler' },
  { key: 'mastodon', name: 'Mastodon', color: '#6364ff', abbr: 'Ma', limit: 500, unit: 'codepoints', urlCost: 23, noMentionDomain: true, scheduler: 'mastodon-scheduler', available: true, blurb: 'Posts and threads on mastodon.social, with images or a video.' },
  { key: 'google_business', name: 'Google Business Profile', color: '#4285f4', abbr: 'Gb', limit: 1500, unit: 'codepoints', scheduler: 'google-business-scheduler', identifier: 'gmb', available: true, blurb: 'Updates, events and offers for a business location, with an optional image.' },
  { key: 'reddit', name: 'Reddit', color: '#ff4500', abbr: 'Re', limit: 40000, unit: 'codepoints' },
  { key: 'telegram', name: 'Telegram', color: '#26a5e4', abbr: 'Tg', limit: 4096, unit: 'codepoints', scheduler: 'telegram-scheduler', available: true, blurb: 'Text, photos, videos and files to a channel or group.' },
  { key: 'discord', name: 'Discord', color: '#5865f2', abbr: 'Dc', limit: 1980, unit: 'codepoints', note: 'Discord allows 2,000; PostDelegate keeps a small margin.', scheduler: 'discord-scheduler', available: true, blurb: 'Markdown messages, images and videos to the channel you pick.' },
  { key: 'slack', name: 'Slack', color: '#8c3a90', abbr: 'Sl', limit: 4000, unit: 'codepoints', scheduler: 'slack-scheduler', available: true, blurb: 'Text and image messages to the channel you pick.' },
  { key: 'tumblr', name: 'Tumblr', color: '#5a7396', abbr: 'Tu', limit: 32768, unit: 'codepoints', scheduler: 'tumblr-scheduler', available: true, blurb: 'Text, image or video posts on your blog.' },
  { key: 'lemmy', name: 'Lemmy', color: '#00bc8c', abbr: 'Le', limit: 10000, unit: 'codepoints', scheduler: 'lemmy-scheduler', available: true, blurb: 'Posts to one or more communities on your instance.' },
  { key: 'nostr', name: 'Nostr', color: '#8e30eb', abbr: 'No', limit: 100000, unit: 'codepoints', scheduler: 'nostr-scheduler', available: true, blurb: 'Notes sent to a set of public relays.' },
  { key: 'farcaster', name: 'Farcaster', color: '#8a63d2', abbr: 'Fc', limit: 320, unit: 'utf8_bytes' },
  { key: 'twitch', name: 'Twitch', color: '#9146ff', abbr: 'Tw', limit: 500, unit: 'codepoints', scheduler: 'twitch-scheduler', available: true, blurb: 'Chat messages and announcements in your channel.' },
  { key: 'kick', name: 'Kick', color: '#53fc18', abbr: 'Ki', limit: 500, unit: 'codepoints', scheduler: 'kick-scheduler', available: true, blurb: 'Text messages in your channel’s chat.' },
  { key: 'dribbble', name: 'Dribbble', color: '#ea4c89', abbr: 'Dr', limit: 40000, unit: 'codepoints', scheduler: 'dribbble-scheduler', available: true, blurb: 'Shots with a title and one image.' },
  { key: 'devto', name: 'DEV.to', color: '#e7e7ea', abbr: 'De', limit: 100000, unit: 'codepoints', scheduler: 'devto-scheduler', available: true, blurb: 'Markdown articles with tags, a cover and a canonical URL.' },
  { key: 'medium', name: 'Medium', color: '#e7e7ea', abbr: 'Me', limit: 100000, unit: 'codepoints', scheduler: 'medium-scheduler', available: true, blurb: 'Markdown stories, on your profile or a publication.' },
  { key: 'wordpress', name: 'WordPress', color: '#21759b', abbr: 'Wp', limit: 100000, unit: 'codepoints', scheduler: 'wordpress-scheduler', available: true, blurb: 'Posts or pages with categories, tags and a featured image.' },
  { key: 'hashnode', name: 'Hashnode', color: '#2962ff', abbr: 'Hn', limit: 10000, unit: 'codepoints', scheduler: 'hashnode-scheduler', available: true, blurb: 'Markdown articles to one of your publications.' },
  { key: 'listmonk', name: 'Listmonk (email)', color: '#0055d4', abbr: 'Lm', limit: 100000, unit: 'codepoints', scheduler: 'listmonk-scheduler', available: true, blurb: 'Email campaigns through your own Listmonk.' },
];
export const NETWORK_COUNT = NETWORKS.length;
export const AVAILABLE_NETWORKS = NETWORKS.filter((network) => network.available);
// Live networks with the ones people ask about most first, for logo stacks.
const FEATURED_KEYS = ['youtube', 'bluesky', 'discord', 'telegram', 'wordpress', 'slack'];
export const FEATURED_LIVE_NETWORKS = [
  ...FEATURED_KEYS.map((key) => AVAILABLE_NETWORKS.find((network) => network.key === key)).filter((network): network is Network => Boolean(network)),
  ...AVAILABLE_NETWORKS.filter((network) => !FEATURED_KEYS.includes(network.key)),
];
// The networks listed on /docs/channels/coming-soon as waiting on approval, in that order.
// pendingName distinguishes a pending destination from a live account type in the same family.
// X is not one of them: it is not available on PostDelegate.
export const WAITING_KEYS = ['facebook', 'instagram', 'threads', 'tiktok', 'linkedin', 'pinterest', 'reddit'];
export const WAITING_NETWORKS = WAITING_KEYS
  .map((key) => NETWORKS.find((network) => network.key === key))
  .filter((network): network is Network => Boolean(network))
  .map((network) => network.pendingName ? { ...network, name: network.pendingName, available: false } : network);
export type NetworkStatus = 'live' | 'waiting' | 'unavailable';
export const networkStatus = (network: Network): NetworkStatus =>
  network.available ? 'live' : WAITING_KEYS.includes(network.key) ? 'waiting' : 'unavailable';
// Scheduler pages for a menu, in the order given with the available networks first.
// The header and footer menus show only available networks, so a network joins them once it is marked available above.
export const menuNetworks = (keys: string[]) => keys
  .map((key) => NETWORKS.find((network) => network.key === key))
  .filter((network): network is Network => Boolean(network?.scheduler))
  .sort((a, b) => Number(!a.available) - Number(!b.available));
