// The share card each page gets. One generic card for 130 pages meant every
// guide, comparison and tool looked identical in a tweet, a LinkedIn post or a
// Slack unfurl - the three places these pages are actually shared.
//
// Plain .mjs because both sides import it: scripts/og.mjs renders the PNGs at
// build time (node, no TypeScript loader) and src/layouts/Base.astro looks the
// page up by its canonical path. One list, so the two cannot disagree.
//
// `kicker` is the small line above the headline. `title` is the headline; keep
// it close to what the page's own heading says, because that is what someone
// clicking the card expects to land on. It is wrapped and shrunk to fit, so
// length is a matter of how it reads, not whether it fits.
//
// Localised pages are not here on purpose: an English card over a Spanish page
// reads worse than the brand card, and they are keyed by exact path, so
// /es/pricing simply falls back.

export const OG_CARDS = {
  '/guides/ai-social-media-agent-guardrails': { kicker: 'Guide', title: 'How to let an AI agent post to social media safely' },
  '/guides/bulk-schedule-social-posts-csv': { kicker: 'Guide', title: 'How to bulk schedule social posts from a CSV' },
  '/guides/client-approval-workflow': { kicker: 'Guide', title: 'A social media approval workflow for agencies' },
  '/guides/cross-post-blog-articles': { kicker: 'Guide', title: 'Cross-post articles with canonical URLs' },
  '/guides/cross-post-to-medium-and-hashnode': { kicker: 'Guide', title: 'Avoid duplicate content on Medium and Hashnode' },
  '/guides/discord-announcement-scheduling': { kicker: 'Guide', title: 'How to schedule Discord announcements' },
  '/guides/nostr-scheduling': { kicker: 'Guide', title: 'How to schedule Nostr notes to relays' },
  '/guides/schedule-bluesky-posts': { kicker: 'Guide', title: 'How to schedule Bluesky posts and threads' },
  '/guides/schedule-dev-to-articles': { kicker: 'Guide', title: 'How to schedule DEV.to articles' },
  '/guides/schedule-social-media-posts-with-chatgpt': { kicker: 'Guide', title: 'How to schedule social posts with ChatGPT' },
  '/guides/schedule-social-media-posts-with-claude': { kicker: 'Guide', title: 'How to schedule social posts with Claude' },
  '/guides/schedule-wordpress-posts': { kicker: 'Guide', title: 'How to schedule WordPress posts' },
  '/guides/schedule-youtube-videos': { kicker: 'Guide', title: 'How to schedule YouTube videos' },
  '/guides/slack-scheduled-announcements': { kicker: 'Guide', title: 'How to schedule announcements to Slack' },
  '/guides/social-media-character-limits': { kicker: 'Guide', title: 'Social media character limits in 2026' },
  '/guides/social-media-mcp-server': { kicker: 'Guide', title: 'What is a social media MCP server?' },
  '/guides/telegram-channel-scheduling': { kicker: 'Guide', title: 'How to schedule posts to a Telegram channel' },
  '/guides/twitch-and-kick-chat-announcements': { kicker: 'Guide', title: 'How to schedule Twitch and Kick announcements' },

  '/compare/blotato-vs-buffer': { kicker: 'Compare', title: 'Blotato vs Buffer: AI content or per channel?' },
  '/compare/blotato-vs-metricool': { kicker: 'Compare', title: 'Blotato vs Metricool: AI content or analytics?' },
  '/compare/blotato-vs-mixpost': { kicker: 'Compare', title: 'Blotato vs Mixpost: AI content or self-host?' },
  '/compare/blotato-vs-post-bridge': { kicker: 'Compare', title: 'Blotato vs Post Bridge: AI or plain posting?' },
  '/compare/blotato-vs-publer': { kicker: 'Compare', title: 'Blotato vs Publer: AI content or bulk posting?' },
  '/compare/blotato-vs-zernio': { kicker: 'Compare', title: 'Blotato vs Zernio: AI app or social API?' },
  '/compare/buffer': { kicker: 'Compare', title: 'PostDelegate vs Buffer' },
  '/compare/buffer-vs-metricool': { kicker: 'Compare', title: 'Buffer vs Metricool: channels or brands?' },
  '/compare/buffer-vs-mixpost': { kicker: 'Compare', title: 'Buffer vs Mixpost: hosted or self-hosted?' },
  '/compare/buffer-vs-post-bridge': { kicker: 'Compare', title: 'Buffer vs Post Bridge: per channel or flat?' },
  '/compare/buffer-vs-zernio': { kicker: 'Compare', title: 'Buffer vs Zernio: scheduler or social API?' },
  '/compare/hootsuite': { kicker: 'Compare', title: 'PostDelegate vs Hootsuite' },
  '/compare/later': { kicker: 'Compare', title: 'PostDelegate vs Later' },
  '/compare/metricool-vs-mixpost': { kicker: 'Compare', title: 'Metricool vs Mixpost: analytics or self-host?' },
  '/compare/metricool-vs-post-bridge': { kicker: 'Compare', title: 'Metricool vs Post Bridge: reports or posting?' },
  '/compare/metricool-vs-postiz': { kicker: 'Compare', title: 'Metricool vs Postiz: analytics or open source?' },
  '/compare/metricool-vs-zernio': { kicker: 'Compare', title: 'Metricool vs Zernio: dashboard or API?' },
  '/compare/mixpost-vs-post-bridge': { kicker: 'Compare', title: 'Mixpost vs Post Bridge: self-host or hosted?' },
  '/compare/mixpost-vs-publer': { kicker: 'Compare', title: 'Mixpost vs Publer: self-host or bulk posting?' },
  '/compare/mixpost-vs-zernio': { kicker: 'Compare', title: 'Mixpost vs Zernio: self-hosted app or API?' },
  '/compare/post-bridge': { kicker: 'Compare', title: 'PostDelegate vs Post Bridge' },
  '/compare/post-bridge-vs-publer': { kicker: 'Compare', title: 'Post Bridge vs Publer: flat or per account?' },
  '/compare/post-bridge-vs-zernio': { kicker: 'Compare', title: 'Post Bridge vs Zernio: app or social API?' },
  '/compare/postiz': { kicker: 'Compare', title: 'PostDelegate vs Postiz' },
  '/compare/postiz-vs-publer': { kicker: 'Compare', title: 'Postiz vs Publer: open source or bulk posting?' },
  '/compare/postiz-vs-blotato': { kicker: 'Compare', title: 'Postiz vs Blotato: scheduling or AI content first?' },
  '/compare/postiz-vs-buffer': { kicker: 'Compare', title: 'Postiz vs Buffer: which scheduler fits how you post?' },
  '/compare/postiz-vs-mixpost': { kicker: 'Compare', title: 'Postiz vs Mixpost: two self-hosted schedulers' },
  '/compare/postiz-vs-post-bridge': { kicker: 'Compare', title: 'Postiz vs Post Bridge: features, price, channels' },
  '/compare/postiz-vs-zernio': { kicker: 'Compare', title: 'Postiz vs Zernio: scheduler app or social API?' },
  '/compare/publer': { kicker: 'Compare', title: 'PostDelegate vs Publer' },
  '/compare/publer-vs-buffer': { kicker: 'Compare', title: 'Publer vs Buffer: which scheduler suits you?' },
  '/compare/publer-vs-metricool': { kicker: 'Compare', title: 'Publer vs Metricool: volume or analytics?' },
  '/compare/publer-vs-zernio': { kicker: 'Compare', title: 'Publer vs Zernio: scheduler or social API?' },
  '/compare/sprout-social': { kicker: 'Compare', title: 'PostDelegate vs Sprout Social' },

  '/tools/caption-checker': { kicker: 'Free tool', title: 'Caption checker' },
  '/tools/image-resizer': { kicker: 'Free tool', title: 'Social media image resizer' },
  '/tools/post-preview': { kicker: 'Free tool', title: 'Social media post preview' },
  '/tools/social-image-sizes': { kicker: 'Free tool', title: 'Social media image sizes, 2026' },
  '/tools/thread-splitter': { kicker: 'Free tool', title: 'Thread splitter' },
  '/tools/utm-builder': { kicker: 'Free tool', title: 'UTM link builder for social posts' },
  '/tools/youtube-title-checker': { kicker: 'Free tool', title: 'YouTube title and description checker' },
  // The per-network tools from src/pages/tools/[tool].astro; network-tools.ts fails the build
  // if one of its pages is missing here.
  '/tools/instagram-character-counter': { kicker: 'Free tool', title: 'Instagram character counter' },
  '/tools/facebook-character-counter': { kicker: 'Free tool', title: 'Facebook character counter' },
  '/tools/linkedin-character-counter': { kicker: 'Free tool', title: 'LinkedIn character counter' },
  '/tools/tiktok-character-counter': { kicker: 'Free tool', title: 'TikTok character counter' },
  '/tools/youtube-character-counter': { kicker: 'Free tool', title: 'YouTube character counter' },
  '/tools/x-character-counter': { kicker: 'Free tool', title: 'X character counter' },
  '/tools/threads-character-counter': { kicker: 'Free tool', title: 'Threads character counter' },
  '/tools/bluesky-character-counter': { kicker: 'Free tool', title: 'Bluesky character counter' },
  '/tools/pinterest-character-counter': { kicker: 'Free tool', title: 'Pinterest character counter' },
  '/tools/mastodon-character-counter': { kicker: 'Free tool', title: 'Mastodon character counter' },
  '/tools/google-business-character-counter': { kicker: 'Free tool', title: 'Google Business Profile character counter' },
  '/tools/reddit-character-counter': { kicker: 'Free tool', title: 'Reddit character counter' },
  '/tools/telegram-character-counter': { kicker: 'Free tool', title: 'Telegram character counter' },
  '/tools/discord-character-counter': { kicker: 'Free tool', title: 'Discord character counter' },
  '/tools/slack-character-counter': { kicker: 'Free tool', title: 'Slack character counter' },
  '/tools/twitch-character-counter': { kicker: 'Free tool', title: 'Twitch character counter' },
  '/tools/kick-character-counter': { kicker: 'Free tool', title: 'Kick character counter' },
  '/tools/instagram-image-resizer': { kicker: 'Free tool', title: 'Instagram image resizer' },
  '/tools/linkedin-image-resizer': { kicker: 'Free tool', title: 'LinkedIn image resizer' },
  '/tools/youtube-image-resizer': { kicker: 'Free tool', title: 'YouTube image resizer' },
  '/tools/x-image-resizer': { kicker: 'Free tool', title: 'X image resizer' },
  '/tools/bluesky-image-resizer': { kicker: 'Free tool', title: 'Bluesky image resizer' },
  '/tools/pinterest-image-resizer': { kicker: 'Free tool', title: 'Pinterest image resizer' },
  '/tools/mastodon-image-resizer': { kicker: 'Free tool', title: 'Mastodon image resizer' },
  '/tools/twitch-image-resizer': { kicker: 'Free tool', title: 'Twitch image resizer' },
  '/tools/dribbble-image-resizer': { kicker: 'Free tool', title: 'Dribbble image resizer' },

  '/pricing': { kicker: 'Pricing', title: 'Flat plans, every channel included' },
  '/platforms': { kicker: 'Networks', title: 'Every network PostDelegate posts to' },
  '/mcp': { kicker: 'For agents', title: 'The MCP server for social media' },
  '/agents': { kicker: 'For agents', title: 'Let your AI assistant run your social media' },
  '/api': { kicker: 'Developers', title: 'The PostDelegate API' },
  '/alternatives': { kicker: 'Compare', title: 'Social media scheduler alternatives' },
  '/alternatives/postiz': { kicker: 'Compare', title: 'Postiz alternatives: hosted, self-hosted and API' },
  '/guides': { kicker: 'Guides', title: 'Guides for scheduling social media' },
  '/compare': { kicker: 'Compare', title: 'PostDelegate compared to every scheduler' },
  '/tools': { kicker: 'Free tools', title: 'Free tools for social media posts' },
  '/docs': { kicker: 'Documentation', title: 'PostDelegate documentation' },
};

// The card file for a page, or undefined when it keeps the brand card.
export const ogCardFor = (path) =>
  OG_CARDS[path] ? `/og/${path.slice(1).replace(/\//g, '-')}.png` : undefined;
