// Single source of truth for the documentation: sidebar, docs home, previous/next links,
// llms.txt and llms-full.txt all read this list. Every href has a page in src/pages/docs.
export interface DocPage { title: string; href: string; description: string }
export interface DocSection { title: string; items: DocPage[] }

export const DOC_SECTIONS: DocSection[] = [
  { title: 'Get started', items: [
    { title: 'Getting started', href: '/docs/getting-started', description: 'Start your free trial, connect a channel and schedule your first post.' },
    { title: 'Creating and scheduling posts', href: '/docs/posts', description: 'Drafts, schedules, immediate posts, repeats, previews and the calendar.' },
    { title: 'Media library', href: '/docs/media', description: 'Upload images and video, supported formats and size limits.' },
    { title: 'Team and customers', href: '/docs/team', description: 'Invite team members and group channels by customer.' },
    { title: 'Plans and billing', href: '/docs/billing', description: 'Plan information, the trial and how cancellation works.' },
  ] },
  { title: 'Plan and review', items: [
    { title: 'Approvals and client review', href: '/docs/approvals', description: 'Review statuses, client approval links, the Approvals inbox and guardrails for AI agents.' },
    { title: 'Bulk import from CSV', href: '/docs/bulk-import', description: 'Schedule up to 200 posts at once from a spreadsheet.' },
    { title: 'Evergreen posts', href: '/docs/evergreen', description: 'Share a post again on a schedule with rotating wordings.' },
    { title: 'Campaigns and ideas', href: '/docs/campaigns', description: 'Campaigns, content pillars, tags and the ideas board.' },
  ] },
  { title: 'Analytics and AI', items: [
    { title: 'Analytics and reports', href: '/docs/analytics', description: 'Daily history, trends, top posts, insights, reports and the weekly summary email.' },
    { title: 'AI in PostDelegate', href: '/docs/ai', description: 'Bring your own OpenAI key for AI writing, the Agent and images.' },
  ] },
  { title: 'Connect channels', items: [
    { title: 'Channels overview', href: '/docs/channels', description: 'What you can connect today and how connections work.' },
    { title: 'YouTube', href: '/docs/channels/youtube', description: 'Connect a YouTube channel with Google sign-in.' },
    { title: 'Bluesky', href: '/docs/channels/bluesky', description: 'Connect with an app password.' },
    { title: 'DEV.to', href: '/docs/channels/devto', description: 'Connect with a DEV Community API key.' },
    { title: 'Hashnode', href: '/docs/channels/hashnode', description: 'Connect with a personal access token.' },
    { title: 'Lemmy', href: '/docs/channels/lemmy', description: 'Connect to a Lemmy instance with your login.' },
    { title: 'Listmonk', href: '/docs/channels/listmonk', description: 'Send email campaigns through your own Listmonk.' },
    { title: 'Medium', href: '/docs/channels/medium', description: 'Connect with a Medium integration token.' },
    { title: 'Nostr', href: '/docs/channels/nostr', description: 'Connect with a hex private key.' },
    { title: 'WordPress', href: '/docs/channels/wordpress', description: 'Connect with an application password.' },
    { title: 'Kick', href: '/docs/channels/kick', description: 'Connect a Kick channel with Kick sign-in.' },
    { title: 'Twitch', href: '/docs/channels/twitch', description: 'Connect a Twitch channel with Twitch sign-in.' },
    { title: 'Tumblr', href: '/docs/channels/tumblr', description: 'Connect a Tumblr blog with Tumblr sign-in.' },
    { title: 'Dribbble', href: '/docs/channels/dribbble', description: 'Publish shots with Dribbble sign-in.' },
    { title: 'Slack', href: '/docs/channels/slack', description: 'Add PostDelegate to a Slack workspace.' },
    { title: 'Telegram', href: '/docs/channels/telegram', description: 'Add @PostDelegateBot to a channel or group.' },
    { title: 'Discord', href: '/docs/channels/discord', description: 'Add the PostDelegate bot to a Discord server.' },
    { title: 'Coming soon', href: '/docs/channels/coming-soon', description: 'Networks waiting on platform approval.' },
  ] },
  { title: 'REST API', items: [
    { title: 'API overview', href: '/docs/api', description: 'Base URL, authentication, rate limits and errors.' },
    { title: 'Posts', href: '/docs/api/posts', description: 'Create, list, update and delete posts.' },
    { title: 'Uploads and media', href: '/docs/api/uploads', description: 'Upload files or fetch them from a URL.' },
    { title: 'Channels and customers', href: '/docs/api/channels', description: 'List channels, read settings and start a connection.' },
    { title: 'Analytics and other endpoints', href: '/docs/api/more', description: 'Analytics, notifications, free slots and account info.' },
  ] },
  { title: 'AI assistants (MCP)', items: [
    { title: 'MCP overview', href: '/docs/mcp', description: 'Endpoints, sign-in options and how your assistant connects.' },
    { title: 'Claude', href: '/docs/mcp/claude', description: 'Add PostDelegate as a custom connector in Claude.' },
    { title: 'ChatGPT', href: '/docs/mcp/chatgpt', description: 'Add PostDelegate as a custom connector in ChatGPT.' },
    { title: 'Claude Code, Cursor and others', href: '/docs/mcp/clients', description: 'Configuration for terminal and editor MCP clients.' },
    { title: 'MCP tools', href: '/docs/mcp/tools', description: 'Every tool the server offers and what it does.' },
  ] },
  { title: 'Automation', items: [
    { title: 'Webhooks', href: '/docs/webhooks', description: 'Get an HTTP request when a post is published.' },
  ] },
  { title: 'Privacy', items: [
    { title: 'Privacy and data deletion', href: '/docs/privacy', description: 'Policies, disconnecting channels and deleting your data.' },
  ] },
];

export const DOC_PAGES: DocPage[] = DOC_SECTIONS.flatMap((section) => section.items);

export const findDocSection = (pathname: string) =>
  DOC_SECTIONS.find((section) => section.items.some((item) => item.href === pathname));
