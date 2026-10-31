// Guides: informational pages under /guides. The index, the "more guides" list on every guide and the
// sitemap all follow this list. Each slug has a page in src/pages/guides.
export interface Guide { slug: string; title: string; description: string }

export const GUIDES: Guide[] = [
  { slug: 'schedule-social-media-posts-with-claude', title: 'How to schedule social media posts with Claude (MCP)', description: 'Add PostDelegate to Claude as a custom connector, then have Claude list your channels, draft posts and schedule them after you review each one.' },
  { slug: 'schedule-social-media-posts-with-chatgpt', title: 'How to schedule social media posts with ChatGPT', description: 'Add PostDelegate to ChatGPT as a custom connector so ChatGPT can draft posts on your calendar, with you approving what goes out before it publishes.' },
  { slug: 'social-media-mcp-server', title: 'What is a social media MCP server and how to use one', description: 'What MCP is, what a social media MCP server lets an AI assistant do, how sign-in works and how to keep control of what gets published to your channels.' },
  { slug: 'schedule-bluesky-posts', title: 'How to schedule Bluesky posts and threads', description: 'Connect Bluesky with an app password, then schedule posts, threads, images and video from one calendar. Includes time slots, repeats and the API.' },
  { slug: 'schedule-youtube-videos', title: 'How to schedule YouTube videos (title, thumbnail, visibility)', description: 'Connect a YouTube channel, set the title, visibility, thumbnail and tags, and schedule a video upload for a time you choose. Covers quotas and Shorts.' },
  { slug: 'client-approval-workflow', title: 'Social media approval workflow for agencies and clients', description: 'Keep each client\'s channels separate, send approval links that need no account, and schedule a social media post only after the client has approved it.' },
  { slug: 'cross-post-blog-articles', title: 'Cross-post articles to DEV.to, Hashnode, Medium and WordPress with canonical URLs', description: 'Publish one article to DEV.to, Hashnode, Medium and WordPress and point each copy back to the original with a canonical URL, in the right order.' },
  { slug: 'social-media-character-limits', title: 'Social media character limits in 2026', description: 'A table of social media character limits for every network, how each one counts characters, and why the platform has the last word on the final post.' },
];
