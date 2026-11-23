// English strings for the pages that exist in every language (src/i18n TRANSLATED_PATHS).
// Every other locale file has exactly this shape (`Dict`). Rules for translations:
// - Strings with HTML tags are rendered as HTML: keep the tags, the hrefs and the order of links.
//   Internal links are written as English paths (/pricing); they are pointed at the right
//   language automatically when that page is translated.
// - Functions receive the facts (prices, counts, names) from src/data; never type a number
//   that a function parameter already gives you.
// - Brand, product and network names stay as they are: PostDelegate, Claude, ChatGPT, MCP, API,
//   Content Studio, the plan names and every network name.
import { SITE, CTA_LABEL, CTA_SHORT, CTA_NOTE, CTA_PAY } from '../../data/site';
import { BUYER_FAQ } from '../../data/faq';
import { PLANS, TRIAL_DAYS, planChannels } from '../../data/plans';
import { AVAILABLE_NETWORKS } from '../../data/networks';
import { LIVE_SCHEDULERS } from '../../data/schedulers';

type QA = { q: string; a: string };
type Card = { title: string; text: string };
// Per live network: the fields of its scheduler page that are translated.
export type SchedulerStrings = {
  action: string; description: string; h1: string; intro: string; plan: string[]; limits: string[];
  /** Optional <title> override for search intent the default "{name} scheduler" title misses. */
  title?: string;
  /** Optional how-to for doing it in the network itself, shown before the product sections. */
  nativeHowTo?: { title: string; intro: string; sections: { heading: string; steps: string[] }[]; sources: { label: string; href: string }[]; sourcesLabel: string };
  /** Optional "when PostDelegate fits better" section shown after the native how-to. */
  fitTitle?: string; fitPoints?: string[];
  /** Optional page-specific questions for this language; plain text answers. */
  localFaq?: QA[];
};
type Site = typeof SITE;

// The English /mcp page body. Facts come only from docs/mcp, docs/mcp/tools, docs/approvals and plans.ts;
// the plan rows are generated from PLANS so the prices on this page never drift from the product.
const mcpPriceRows = PLANS.map((plan) => `<tr><td>${plan.name}</td><td>$${plan.monthly}</td><td>$${plan.yearly}</td><td>${planChannels(plan)}</td></tr>`).join('');
const mcpBody = `<h2>What an MCP server does for your social calendar</h2>
<p>MCP, the Model Context Protocol, is a standard way for an AI assistant to use tools in another service. PostDelegate runs an MCP server. Once your assistant is connected it can list your channels, read the rules of each network, upload media, create drafts and scheduled posts, and look at what is already on your calendar. You keep working in the assistant you already use, and the posts it prepares land in the same calendar as everything you schedule by hand.</p>
<p>PostDelegate does not provide an AI of its own. MCP is how you use your own assistant, such as Claude, ChatGPT or an editor like Cursor, with your PostDelegate workspace. Any usage costs on the assistant's side are between you and its provider. The MCP server is included on every plan, and every plan starts with a ${TRIAL_DAYS}-day free trial that needs no card.</p>

<h2>From a conversation to a draft</h2>
<p>A compatible client discovers the tools the server offers and uses them to look up your channels, read each network's rules, upload media and create drafts. The useful starting point is a single draft that you can inspect in the calendar before anything is scheduled. Each post an assistant creates comes back with a preview link, so you can see it as it will look before you decide.</p>

<h2>Connect your assistant in four steps</h2>
<ol>
<li><strong>Create a workspace.</strong> Start your free trial and sign in to PostDelegate. You need an account because the assistant signs in as you.</li>
<li><strong>Copy the server address.</strong> The recommended address is <code>https://app.postdelegate.com/mcp-oauth-dynamic</code>. Settings, then Agents / Dev in the app shows the addresses with your own values filled in, ready to copy.</li>
<li><strong>Add it to your assistant.</strong> In Claude and ChatGPT this is a custom connector. In Claude Code and Cursor it is one command or a few lines of configuration. The next section has each one.</li>
<li><strong>Sign in with PostDelegate.</strong> The assistant opens a PostDelegate page in your browser, you sign in and click Authorize, and the assistant gets its own token for your workspace. You never copy an API key.</li>
</ol>
<p>Then start small. Ask your assistant to list your PostDelegate channels, and only after that ask for a draft. Say "draft" when you want to review first and "schedule" only when you are ready.</p>

<h2>Set up Claude, ChatGPT, Claude Code and Cursor</h2>
<h3>Claude</h3>
<p>Claude connects to PostDelegate as a custom connector. In Claude open Settings, then Connectors, then Add custom connector. Enter a name such as PostDelegate, paste the server address above as the server URL, choose Add and then Connect, sign in to PostDelegate and click Authorize. PostDelegate is not in Claude's connector directory, so you add it by address, and whether custom connectors are available depends on your Claude plan. The <a href="/docs/mcp/claude">Claude setup guide</a> has the details.</p>
<h3>ChatGPT</h3>
<p>ChatGPT also uses a custom connector. Open Settings, then Connectors, and choose Create. If you do not see a way to create a connector, look under advanced settings for a developer mode switch, or ask your workspace admin. Enter a name, paste the server address, choose OAuth for authentication and then Connect. ChatGPT registers itself with PostDelegate automatically. The <a href="/docs/mcp/chatgpt">ChatGPT setup guide</a> has the steps.</p>
<h3>Claude Code, Cursor and other clients</h3>
<p>For Claude Code, add the server with one command, then run <code>/mcp</code> inside Claude Code to authenticate it:</p>
<pre><code>claude mcp add postdelegate --transport http "https://app.postdelegate.com/mcp-oauth-dynamic"</code></pre>
<p>Cursor takes the same address in <code>.cursor/mcp.json</code> under <code>mcpServers</code>, or through a one-click install link on the <a href="/docs/mcp/clients">clients page</a>. That page also has copy-paste configuration for Claude Desktop, VS Code, Codex, Windsurf and other clients, using either sign in with PostDelegate or an API key.</p>

<h2>Server addresses and the two ways to sign in</h2>
<p>The MCP server uses the streamable HTTP transport. Three addresses cover every kind of client:</p>
<table>
<thead><tr><th>Address</th><th>Sign-in</th><th>Use it for</th></tr></thead>
<tbody>
<tr><td><code>https://app.postdelegate.com/mcp-oauth-dynamic</code></td><td>Sign in with PostDelegate (OAuth)</td><td>Recommended. Claude, ChatGPT, Claude Code, Cursor and any client that can register itself.</td></tr>
<tr><td><code>https://app.postdelegate.com/api/mcp</code></td><td>API key as a Bearer header, or OAuth</td><td>Clients and scripts that can set a header.</td></tr>
<tr><td><code>https://app.postdelegate.com/api/mcp/YOUR_API_KEY</code></td><td>API key inside the address</td><td>Clients that can only take a URL.</td></tr>
</tbody>
</table>
<p>With sign in with PostDelegate, the client registers itself using dynamic client registration and PKCE, and asks for the scopes <code>mcp:read</code> and <code>mcp:write</code>. Approvals appear under Settings, then Apps, then Approved Apps, where you can choose Revoke to cut an assistant off. These tokens do not expire on their own, so revoking is how you end access.</p>
<p>The alternative is your workspace API key from Settings, then Agents / Dev. It works anywhere, but the key is as powerful as your account, so prefer OAuth where the client supports it. Rotating the key invalidates it everywhere. MCP directories and clients that discover servers on their own can read the server card at <code>https://app.postdelegate.com/.well-known/mcp/server-card.json</code>.</p>

<h2>What your assistant can do: the tools</h2>
<p>Your assistant discovers these tools by itself when it connects, and you do not call them directly. Tool names are shown exactly as the server reports them. The <a href="/docs/mcp/tools">tools reference</a> has the full detail.</p>
<h3>Channels and settings</h3>
<ul>
<li><code>integrationList</code> lists your connected channels, and <code>groupList</code> lists your customers. Neither changes anything.</li>
<li><code>integrationSchema</code> returns a channel's post rules, its length limit and the settings fields it needs. Assistants call it before scheduling.</li>
<li><code>triggerTool</code> runs a helper lookup named by <code>integrationSchema</code>, for example fetching WordPress categories or Listmonk lists.</li>
</ul>
<h3>Posts</h3>
<ul>
<li><code>integrationSchedulePostTool</code> creates a draft, a scheduled post or an immediate post on one or more channels. It runs the same validation as the app and the API, and returns a post id and a preview link for each post, or a list of errors to fix.</li>
<li><code>postsListTool</code> lists your posts between two dates with their state, errors, content and channel.</li>
<li><code>postSettingsTool</code> updates the network settings of a scheduled post or draft that has not published. Content and date stay as they are.</li>
<li><code>deletePostTool</code> deletes a post and its comments on that channel. A deleted scheduled post does not publish, and the deletion cannot be undone.</li>
</ul>
<h3>Media</h3>
<ul>
<li><code>uploadFromUrlTool</code> adds an image or video from a public URL to your media library, and can resize and re-encode it for the networks.</li>
<li><code>mediaListTool</code> and <code>mediaStatusTool</code> let an assistant reuse a file and check whether an adjusted upload is ready or still processing.</li>
<li>Assistants that support interactive MCP apps can show an upload widget so you can add a file from your own device. An assistant cannot read files on your computer.</li>
</ul>
<h3>Studio and AI media</h3>
<p>Studio renders vertical 1080×1920 videos from the videos in your media library. An assistant can list the templates, start a render, check its status and cancel it. The seven templates are Hook over clip, Talking head + captions, Image slideshow, Before/after, Top-N list, Quote card and AI UGC. A render only saves a new video to your media library. It never creates, schedules or publishes a post.</p>
<p>The server also defines tools for generating images and video and for turning long YouTube videos into short clips. PostDelegate does not provide AI generation of its own: the image tool needs your workspace's own OpenAI key, added by an admin in Settings, then AI, and the video and clipping tools are not set up today. You can use your own assistant's image and video features and bring the result in with the upload-from-URL tool.</p>
<p>Tools that change data are marked as such to clients, so assistants that support confirmation prompts will ask you first. Tools only act on the workspace you approved, and a different workspace needs a separate sign-in.</p>

<h2>The approval flow: AI drafts, you decide</h2>
<p>Approvals put a second pair of eyes on a post before it goes out. A post that waits for approval is held as a draft and does not publish until someone approves it. For AI assistants this is a setting you control under Settings, then Approvals, in the AI agent guardrails section. The rules are checked on PostDelegate's servers, and an assistant gets a clear message when a rule stops it.</p>
<ul>
<li><strong>Require approval for AI-created posts.</strong> Posts from MCP clients and the PostDelegate Agent wait in Approvals until someone approves them. New workspaces start with this on.</li>
<li><strong>Also require approval for API and CLI posts.</strong> Posts from the public API and the CLI wait for approval too. MCP clients always follow the setting above.</li>
<li><strong>Channels agents can post to.</strong> Leave every channel unchecked to allow all channels, or check some to limit agents to them.</li>
<li><strong>Max posts agents can create per day.</strong> A whole number from 1 to 10,000, or empty for no limit. It is counted per day in UTC across all agents, and a post to several channels counts once per channel.</li>
</ul>
<p>The Approvals page in the main menu lists every post that waits for a decision, with a badge for how many are waiting. Each post shows its channel, its planned time and which connected app or agent sent it, and the From AI agents tab narrows the list to posts that agents created. Approvers can approve, edit, request changes or reject each post, or tick several and choose Approve selected. Nothing in that list publishes until it is approved.</p>
<p>When an assistant's post is held, the MCP tool reports it as <code>IN_REVIEW</code>, and the assistant is told the post is waiting for a teammate to approve it. An assistant's draft stays a draft: approval applies when it schedules a post or posts it now. If you need a client's yes before a post goes out, a client approval link lets someone outside your workspace approve a post without an account. The <a href="/docs/approvals">approvals guide</a> covers statuses, who can approve and activity history, and <a href="/guides/ai-social-media-agent-guardrails">how to let an AI agent post to social media safely</a> goes through the guardrails step by step.</p>

<h2>Staying in control</h2>
<ol>
<li>Ask for a draft first and check it in the calendar before anything is scheduled.</li>
<li>Keep your assistant's tool approval prompts on, so you confirm each action that changes something. Scheduling and deleting are the ones to watch.</li>
<li>Open the preview link each post returns, <code>https://app.postdelegate.com/p/POST_ID?share=true</code>, to inspect it.</li>
<li>Look for the label on posts created this way, which tells them apart on the calendar.</li>
<li>Never paste an API key into a chat. Use OAuth, or put the key in the client's configuration.</li>
</ol>
<p>Content from your posts and videos is just data for the assistant to show you. Be wary of any assistant that treats text in a post as instructions.</p>

<h2>Plans and prices</h2>
<p>Public API and MCP are included on every plan, and every plan starts with a ${TRIAL_DAYS}-day free trial that needs no card. Prices are in US dollars.</p>
<table>
<thead><tr><th>Plan</th><th>Per month</th><th>Per year</th><th>Channels</th></tr></thead>
<tbody>${mcpPriceRows}</tbody>
</table>
<p>The API key and MCP setup live in Settings, then Agents / Dev. <a href="/pricing">See the pricing page</a> for what each plan includes and <a href="/docs/billing">plans and billing</a> for how billing works.</p>

<h2>If something does not work</h2>
<ul>
<li><strong>A 401, or "Invalid API Key or OAuth token".</strong> The key was rotated, mistyped or sent in the wrong form. The MCP address takes the key with or without the word Bearer in front.</li>
<li><strong>The browser sign-in window never opens.</strong> Your client may not support OAuth for remote servers. Use the API key address instead.</li>
<li><strong>"redirect_uri host is not a verified domain".</strong> A web client is trying to register a callback outside the allowed list. Use a local client or the API key address.</li>
<li><strong>A tool is missing.</strong> The server lists only the tools your connection address offers. See the <a href="/docs/mcp/tools">tools reference</a>.</li>
</ul>

<aside class="doc-note">PostDelegate does not provide an AI of its own, and does not claim an official directory listing in Claude or ChatGPT. You add the server as a custom connector. The MCP server is included on every plan.</aside>
<p>Related: <a href="/docs/mcp">MCP documentation</a> · <a href="/docs/mcp/agent-files">agent files</a> · <a href="/api">REST API</a> · <a href="/codex">Codex</a> · <a href="/claude-cowork">Claude and Cowork</a>.</p>`;

const en = {
  // BCP 47 tag for formatting numbers (1,000). Arabic uses Western digits, like the prices.
  numberLocale: 'en-US',
  launch: {
    available: (count: number) => `${count} networks available today`,
    examples: 'Including YouTube, Bluesky, Slack, TikTok and LinkedIn personal profiles. Publish to connected channels.',
    pending: 'Coming soon · awaiting platform approval',
    unavailable: 'Not available',
    modes: 'Use AI through MCP, or schedule posts yourself.',
    trial: (days: number, price: number) => `After ${days} days, pick a plan to keep publishing, from $${price}/month. No card needed to start. If no plan is chosen, the workspace pauses and your posts are kept.`,
    compare: 'Compare plans',
    payNow: CTA_PAY,
    choose: (count: number) => `Choose from ${count} currently available networks`,
  },
  common: {
    ctaLabel: CTA_LABEL,
    ctaShort: CTA_SHORT,
    ctaNote: CTA_NOTE,
    skipToContent: 'Skip to content',
    homeLabel: 'PostDelegate home',
    // alt text of /og.png, the share image of the pages with no card of their own (src/data/og-cards.mjs)
    ogImageAlt: 'PostDelegate logo and the line “Your social media, all in one place.” on a dark background',
  },
  header: {
    mainNav: 'Main navigation',
    mobileNav: 'Mobile navigation',
    aiGroup: 'AI & workflows',
    channelsGroup: 'Channels',
    resourcesGroup: 'Resources',
    agents: 'AI agents', agentsText: 'Bring publishing to your AI workflow.',
    claude: 'Claude', claudeText: 'Plan and prepare content with Claude.',
    codex: 'Codex & coding agents', codexText: 'Connect the tools you already work in.',
    mcp: 'MCP', mcpText: 'Explore the agent connection.',
    moreNetworks: 'See all networks and their status',
    tools: 'Free tools', toolsText: 'Small tools for your next post.',
    guides: 'Guides', guidesText: 'Step-by-step publishing how-tos.',
    compare: 'Compare', compareText: 'Find the right publishing workflow.',
    alternatives: 'Alternatives', alternativesText: 'How PostDelegate stacks up.',
    about: 'About', aboutText: 'Meet PostDelegate.',
    support: 'Support', supportText: 'Get help with your workspace.',
    developers: 'Developers',
    pricing: 'Pricing',
    docs: 'Docs',
    signIn: 'Sign in',
    menu: 'Menu',
    openMenu: 'Open navigation menu',
    closeMenu: 'Close navigation menu',
    language: 'Language',
    // the switcher button's accessible name, with the current language's own name
    languageButton: (name: string) => `Language: ${name}`,
  },
  footer: {
    taglineA: 'Plan it once.',
    taglineB: 'Publish everywhere you’re live.',
    product: 'Product', features: 'Features', pricing: 'Pricing', channels: 'Channels', signIn: 'Sign in',
    aiDevelopers: 'AI & developers', documentation: 'Documentation', aiWorkflows: 'AI workflows', claude: 'Claude',
    codex: 'Codex & coding agents', mcp: 'MCP', restApi: 'REST API', apiReference: 'API reference', mcpSetup: 'MCP setup',
    schedulers: 'Social schedulers', moreNetworks: 'See all networks and their status',
    resources: 'Resources', guides: 'Guides', tools: 'Free tools', captionChecker: 'Caption checker', compare: 'Compare',
    alternatives: 'Alternatives', best: 'Best-of lists', changelog: 'Changelog', roadmap: 'Roadmap', about: 'About', brand: 'Brand', support: 'Support', status: 'Status',
    legal: 'Legal', privacy: 'Privacy policy', terms: 'Terms of service', dataDeletion: 'Data deletion', dpa: 'DPA',
    subprocessors: 'Sub-processors', licenses: 'Licenses', cookieSettings: 'Cookie settings',
    follow: 'Follow PostDelegate', featuredOn: 'Featured on',
    rights: 'All rights reserved.',
    source: 'Source code',
    trademarks: 'Network names and logos belong to their respective owners.',
  },
  cookies: {
    title: 'Cookies',
    settingsTitle: 'Cookie settings',
    close: 'Close',
    text: 'We use cookies to keep you signed in and, if you agree, for referrals and analytics.',
    learnMore: 'Learn more',
    necessary: 'Necessary',
    necessaryText: 'Sign-in and settings.',
    attribution: 'Referrals',
    attributionText: 'Credits whoever referred you.',
    analytics: 'Analytics',
    analyticsText: 'Remembers your browser to count return visits and credit sign-ups.',
    reject: 'Reject',
    customize: 'Customize',
    accept: 'Accept',
    save: 'Save',
  },
  ctaBand: {
    eyebrow: (days: number) => `Try it for ${days} days`,
    title: 'Your next great post starts here.',
    text: 'Give your ideas a home. Plan your content, find your rhythm, and bring your social channels together.',
    note: 'Add a card before the trial ends to keep your plan.',
  },
  testimonials: {
    eyebrow: 'FROM OUR USERS',
    title: 'What people say about PostDelegate.',
    stars: (rating: number) => `${rating} out of 5 stars`,
  },
  logoStack: {
    andMore: (names: string, more: number) => `${names} and ${more} more`,
  },
  compareCard: {
    cta: 'Read the comparison',
    vs: 'vs',
  },
  networkGrid: {
    label: 'Networks you can connect today',
    scheduler: ' scheduler',
    pendingTitle: '<b>Coming soon (awaiting platform approval).</b> None of these can be connected yet. X is not available on PostDelegate.',
    pendingLabel: 'Networks waiting on approval',
    status: 'See platform status',
  },
  // The one-line blurb of each live network, keyed by networks.ts key.
  networkBlurbs: Object.fromEntries(AVAILABLE_NETWORKS.map((n) => [n.key, n.blurb ?? ''])) as Record<string, string>,
  planTaglines: Object.fromEntries(PLANS.map((plan) => [plan.slug, plan.tagline])) as Record<string, string>,
  perks: {
    team: 'Unlimited team members',
    solo: 'Just you', soloNote: 'No team seats on this plan',
    posts: 'Unlimited posts per month',
    agent: 'Claude, ChatGPT and scripts', agentNote: 'MCP server and public REST API',
    webhooks: (count: string) => `${count} webhooks`, webhooksNote: 'Tell your own tools when a post goes out',
    studio: 'Content Studio vertical videos', studioNote: 'Fair use',
    ai: 'AI on your own OpenAI key', aiNote: 'No AI markup, no credit cap',
  },
  pricing: {
    eyebrow: 'Plans',
    heading: (lowest: number) => `From $${lowest} a month. API, MCP and Studio on every plan.`,
    intro: (days: number) => `Plans differ by channels, team seats and webhooks. Try any of them for ${days} days with no credit card, and add one before the trial ends to keep your plan.`,
    billingPeriod: 'Billing period',
    monthly: 'Monthly',
    yearly: 'Yearly',
    saveUpTo: (percent: number) => `save up to ${percent}%`,
    recommended: 'Recommended',
    perMonth: '/month',
    orYearly: (yearly: string, save: string) => `or $${yearly} a year, save $${save}`,
    billedYearly: (yearly: string, save: string) => `billed $${yearly} a year, save $${save}`,
    startTrial: 'Start free trial',
    trialNote: (days: number) => `${days} days free · no card`,
    channels: 'channels',
    extraMonthly: (price: string, max: string) => `then $${price}/month each, up to ${max}`,
    extraYearly: (price: string, max: string) => `then $${price}/year each, up to ${max}`,
    anyLive: (count: number) => `Any of ${count} live networks`,
    customTitle: 'Custom',
    customText: (max: string) => `Need more than ${max} channels? Talk to us.`,
    customSubject: 'Custom plan',
    talkToUs: 'Talk to us',
    // the checklist under every plan card; each item is documented under /docs
    everyPlanTitle: 'On every plan',
    everyPlan: ['Threaded posts and comments', 'Repeating and evergreen posts', 'Client approval links', 'Bulk import from CSV', 'Customer groups', 'Analytics', 'Sets and signatures', 'Day, week, month and list views'],
    whyTitle: 'Why no AI credits?',
    whyText: 'You bring your own OpenAI key, or the assistant you already pay for, so you pay OpenAI\'s own rates with no markup from us and no monthly credit cap.',
    note: 'Prices in US dollars. AI runs on your own OpenAI key or the assistant you already use over <a href="/docs/mcp">MCP</a>, and PostDelegate never charges for it. Content Studio is included on every paid plan with fair use. One free trial per email address. See <a href="/docs/billing">plans and billing</a>.',
  },
  buyerFaq: BUYER_FAQ as QA[],
  // The home page (HomePage.astro), top to bottom: hero, how it works, networks, features,
  // bring your own AI, pricing, compare, FAQ and the closing call to action.
  home: {
    title: 'PostDelegate: Social Media Scheduler for Teams and AI Agents',
    description: (days: number, count: number) => `Social media scheduler with an MCP server and REST API on every plan. Claude or ChatGPT drafts, you approve, it posts to ${count} networks. ${days}-day trial, no card.`,
    appDescription: (days: number) => `A social media scheduler with an MCP server and REST API on every plan. Claude, ChatGPT or your own scripts draft posts, you approve them on one visual calendar, and PostDelegate publishes them on time. AI is bring-your-own: connect the assistant you already pay for over MCP, or add your own OpenAI key, and PostDelegate never charges for AI. Includes Content Studio for vertical videos and bulk video scheduling. Every plan starts with a ${days}-day free trial with no credit card needed.`,
    appFeatures: ['Visual content calendar', 'Post composer with per-channel settings', 'Content Studio: vertical 1080×1920 videos with a hook line or word-by-word captions', 'Bulk video scheduling across your posting time slots', 'Bulk post import from CSV', 'Daily views gained analytics for YouTube channels', 'YouTube publish later and AI content label', 'Media library', 'Workspaces and team members', 'MCP server and REST API on every plan', 'Bring your own AI: Claude or ChatGPT over MCP, or your own OpenAI key', 'Agent files for Claude, ChatGPT, Cursor and coding agents'],
    orbitLabel: (count: number, names: string) => `${count} networks connect today: ${names}. Instagram, LinkedIn company Pages and other networks are waiting on approval.`,
    h1: 'Plan your posts. ',
    h1Mark: 'Publish on time.',
    lead: (count: number) => `Claude, ChatGPT or your own scripts draft posts over MCP. You approve them on one calendar. Publish to connected channels when you approve.`,
    trialNote: (price: number) => `No card needed. Then from $${price}/month.`,
    mcpLink: 'See how MCP works',
    orbitCore: 'Your calendar',
    cardScheduled: 'Scheduled', cardScheduledSub: 'YouTube · Tue 09:00',
    cardDraft: 'Draft ready to review', cardDraftSub: 'From your own AI, via MCP',
    legendLive: 'Connect today', legendSoon: 'Coming soon',
    stepsTitle: 'How it works',
    steps: ['Your AI drafts it.', 'You approve it.', 'PostDelegate posts it.'],
    // the hero switch: classic scheduling, for people who plan and write posts themselves
    modeLabel: 'How do you want to post?',
    modeAi: 'With AI agents',
    modeClassic: 'Classic scheduling',
    classicH1: 'Plan your posts. ',
    classicH1Mark: 'Publish on time.',
    classicLead: (count: number) => `Plan every post on one calendar, get it approved by your team or client, and publish to connected channels on time.`,
    classicCardDraftSub: 'Waiting on your approval',
    classicSteps: ['You plan it.', 'You or your client approve it.', 'PostDelegate posts it.'],
    channelsEyebrow: 'Live networks',
    channelsTitle: (count: number) => `Schedule YouTube, TikTok, Bluesky and ${count - 3} more.`,
    featuresEyebrow: 'Inside PostDelegate',
    featuresTitle: 'One workspace from idea to published post.',
    // same order as the cards in HomePage.astro: calendar, approvals, Content Studio, bulk video
    features: [
      { title: 'Calendar', text: 'Every channel’s week in one view, with drafts and scheduled posts side by side.' },
      { title: 'Client approvals', text: 'Send a link and your client approves or asks for changes, no account needed.' },
      { title: 'Content Studio', text: 'Turn a clip into a captioned vertical video, ready to schedule.' },
      { title: 'Bulk video', text: 'Drop in up to 50 videos and PostDelegate spreads them across your posting slots.' },
    ] as Card[],
    demoAlt: 'The PostDelegate calendar in week view: a labeled sidebar, a channel strip for three example brands (Harbor Fitness, Lumen Coffee and Northwind), a week of scheduled, published and draft posts, and a This week panel with approval actions',
    aiEyebrow: 'Bring your own AI',
    aiTitleA: 'No AI markup. Use the assistant',
    aiTitleB: 'you already ',
    aiMark: 'pay for.',
    aiIntro: 'Connect Claude or ChatGPT over MCP, or add your own OpenAI key. You pay the provider’s own rates, and we never resell AI credits.',
    aiLinksLabel: 'Ways to connect your AI',
    pricingEyebrow: 'Pricing',
    pricingTitle: 'Pay for channels, not for AI.',
    pricingMore: 'Compare every plan',
    compareLine: '<b>Switching?</b> Compare with <a href="/compare/buffer">Buffer</a> · <a href="/compare/hootsuite">Hootsuite</a> · <a href="/compare/publer">Publer</a>',
    faqTitle: 'Frequently asked ',
    faqMark: 'questions.',
    // p: live network count and names (from networks.ts), trial days and the lowest monthly price (from plans.ts)
    faq: (p: { count: number; live: string; days: number; price: number }) => [
      { q: 'What is PostDelegate?', a: `A social media scheduler your AI can run. Claude or ChatGPT drafts posts over MCP, you approve them on one calendar, and PostDelegate posts them to ${p.count} networks. You can also plan and write everything yourself.` },
      { q: 'Do I need a credit card for the trial?', a: `No. Every plan starts with a ${p.days}-day free trial with no card. After ${p.days} days, pick a plan to keep publishing, from $${p.price}/month. If you don’t choose a plan, your workspace pauses and your posts are kept.` },
      { q: 'Which networks can I connect?', a: `${p.count} today: ${p.live}. Facebook, Instagram, Threads, LinkedIn company Pages and Pinterest are coming soon (awaiting platform approval). X is not available. See <a href="/platforms">platform status</a>.` },
      { q: 'How much does the AI cost?', a: 'Nothing from us. Connect the assistant you already pay for over MCP, or add your own OpenAI key and pay OpenAI directly. There are no AI credits and no markup.' },
      { q: 'Can I cancel anytime?', a: 'Yes. A workspace admin cancels from Billing, and the plan runs to the end of the period you have paid for. See <a href="/docs/billing">plans and billing</a>.' },
    ] as QA[],
    ctaTitle: 'Get next week’s posts off your plate.',
    ctaText: (days: number, price: number) => `${days} days free, no card. Then from $${price}/month.`,
    pricingLabel: 'Plans and pricing',
    supportBubble: 'Support',
  },
  pricingPage: {
    title: 'Plans and pricing — PostDelegate',
    description: (price: number, days: number) => `PostDelegate plans start at $${price} a month, with channels, team members and webhooks compared by plan. Every plan has a ${days}-day free trial, no credit card needed.`,
    eyebrow: 'Plans',
    h1: (price: number, days: number) => `Plans from $${price}. Try any of them free for ${days} days.`,
    lead: 'Pay for channels, team seats and webhooks. The calendar, MCP server, REST API and Content Studio come with every plan.',
    billingGuide: 'Read the billing guide',
    trialNote: (note: string) => `${note} · One trial per email`,
    heroNetworks: (count: number) => `Publish to <b>${count} live networks</b> on every plan`,
    compareTitle: 'Compare plans',
    feature: 'Feature', yes: 'Yes', no: 'No',
    rowMonthly: 'Monthly price',
    rowYearly: 'Yearly price',
    rowChannels: 'Channels',
    channelsExtra: (channels: number, price: number, max: string) => `${channels}, then $${price}/month per extra channel, up to ${max}`,
    rowPosts: 'Posts per month', postsValue: 'Unlimited',
    rowTeam: 'Team members',
    rowApi: 'Public API and MCP',
    rowStudio: 'Content Studio (fair use)',
    rowAi: 'AI on your own OpenAI key',
    rowWebhooks: 'Webhooks',
    rowTrial: 'Free trial', trialValue: (days: number) => `${days} days`,
    questionsTitle: 'Before you get started',
    trialQ: 'How does the free trial work?',
    trialA: (days: number) => `Every plan starts with a ${days}-day free trial, and you do not need a credit card to start it. Add a card any time before the trial ends to keep your plan; the first payment is taken when the trial ends. If it ends without a card, your workspace is paused until you choose a plan. Your posts are kept, and your channels and team members are switched back on when you subscribe to a plan that includes them. Each email address gets one free trial.`,
    channelsQ: 'Which channels can I connect?',
    channelsA: (count: number) => `${count} networks connect today, including YouTube, Bluesky, Slack, TikTok and LinkedIn personal profiles. Facebook, Instagram, Threads, LinkedIn company Pages and Pinterest are coming soon (awaiting platform approval), and X is not available. See <a href="/platforms">platform coverage</a>.`,
    extraQ: (channels: number) => `What if I need more than ${channels} channels?`,
    extraA: (p: { plan: string; channels: number; monthly: number; yearly: string; extra: number; max: string }) => `${p.plan} includes ${p.channels} channels, then each extra channel costs $${p.monthly} a month, or $${p.yearly} a year on yearly billing, up to ${p.extra} extra channels (${p.max} in total). A workspace admin adds them under <strong>Extra channels</strong> on the Billing page once the plan is paid. Changes are prorated, and you cannot go below the channels you already have connected.`,
    changeQ: 'Can I change or cancel my plan?',
    changeA: 'Workspace admins can change plan, update the payment method or cancel from <strong>Billing</strong> in the app. Cancellation takes effect at the end of the period you have already paid for.',
    creditsQ: 'Why no AI credits?',
    creditsA: 'Most schedulers bundle AI credits into the plan price and cap them each month. PostDelegate doesn\'t sell AI at all. You add your own OpenAI API key, or connect the assistant you already pay for, such as Claude or ChatGPT, through MCP. You pay the provider\'s own rates with no markup from us, and there is no monthly credit cap to run out of.',
    aiQ: 'What about AI and automation?',
    aiA: 'AI writing, the Agent and AI images run on your workspace\'s own OpenAI API key, added by an admin in <strong>Settings → AI</strong>. You pay OpenAI directly, and PostDelegate never charges for AI. AI video is not available. Every plan includes the REST API and MCP server, so you can also bring your own assistant, such as ChatGPT or Claude.',
    moreTitle: 'More questions',
    compareLinks: 'Switching from another tool? Compare PostDelegate with <a href="/compare/buffer">Buffer</a>, <a href="/compare/hootsuite">Hootsuite</a>, <a href="/compare/publer">Publer</a> and <a href="/compare/sprout-social">Sprout Social</a>, or see <a href="/compare">every comparison</a>.',
  },
  platformsPage: {
    title: (count: number) => `Supported Social Networks: ${count} Live Today | PostDelegate`,
    description: (count: number) => `The ${count} networks you can connect to PostDelegate today, from YouTube, Bluesky and TikTok to WordPress and Slack, and the ones waiting on platform approval.`,
    eyebrow: 'Platform coverage',
    h1: (count: number) => `Supported social networks: ${count} live today.`,
    lead: "Connect an available network from Add Channel. Coming-soon networks await platform approval. X is not available.",
    ask: 'Ask about a channel',
    note: 'Networks marked available can be connected from Add Channel in your workspace. Account types and permissions still affect what each connection can do. See the <a href="/docs/channels">channel guides</a> for details.',
    connectIt: 'Connect it in your workspace',
    notYet: 'Not connectable yet',
    available: 'Available',
    waiting: 'Coming soon (awaiting platform approval)',
    liveTitle: (count: number) => `Live today (${count})`,
    waitingTitle: (count: number) => `Coming soon (awaiting platform approval): ${count}`,
    waitingText: 'None of these can be connected yet. Each one opens once its platform approves PostDelegate and the connection is switched on. We don’t give dates.',
    ownAppTitle: 'Reddit: bring your own app',
    ownAppText: (count: number) => `Reddit is not one of the ${count} networks above, and PostDelegate doesn’t offer a shared Reddit connection. Instead, Add Channel offers “Reddit (Own app)”: you create a Reddit “web app” in your own Reddit account and paste its client ID and secret. It is meant for your personal, non-commercial use (check Reddit’s Data API terms), and it is connected in the app, not through the public API.`,
    ownAppCard: 'Connect it with your own Reddit app',
    ownAppLabel: 'Your own app',
    xTitle: 'X: not available',
    xText: 'PostDelegate does not post to X, and you cannot connect an X account.',
    googleNote: 'A Google login creates access to PostDelegate; it does not connect a YouTube channel or Google Business Profile. Each publishing destination has its own connection flow.',
  },
  agentsPage: {
    title: 'AI agents and automation — PostDelegate',
    description: 'Connect your own AI assistant or software to PostDelegate through MCP and the REST API. Agents draft and schedule posts, and every post stays under your review.',
    eyebrow: 'AI agents and automation',
    h1: 'Bring your workflow. Keep your calendar.',
    lead: 'Use the assistant you already have. PostDelegate offers an MCP server and a REST API so your tools can prepare content while you keep the final say.',
    readDocs: 'Read the docs',
    // links to the English /<assistant>/<network> guides
    byNetworkTitle: 'Guides by assistant and network',
    byNetworkLead: 'Setup steps and example asks for each assistant on each live network.',
    // same order as the cards in AgentsPage.astro: /mcp, /api, /claude-cowork, /codex
    guides: [
      { title: 'MCP connections', text: 'How compatible AI clients connect to PostDelegate and what they can do.' },
      { title: 'The REST API', text: 'The developer interface behind drafts, media and publishing workflows.' },
      { title: 'Claude and Cowork', text: 'Add PostDelegate to Claude as a custom connector.' },
      { title: 'Codex and coding agents', text: 'Connect Codex, Cursor and other coding tools over MCP.' },
    ] as Card[],
    explore: 'Explore the integration →',
    body: '<h2>A useful place to start</h2><p>Prepare a post with your AI tool, then bring the draft and media into the workspace. Review the destination, content and timing before scheduling on an available channel.</p><h2>How it connects</h2><p>Add the PostDelegate MCP server to your assistant and sign in with your PostDelegate account, or use your workspace API key. The <a href="/docs/mcp">MCP docs</a> have the server address, sign-in options and setup for each client.</p><aside class="doc-note">PostDelegate does not provide an AI of its own: you bring your own assistant. The MCP server and REST API are included on every plan, and only the channels listed as available in the <a href="/docs/channels">channel guides</a> can be published to today.</aside><h2>For developers</h2><p>The <a href="/docs/api">REST API docs</a> cover authentication, rate limits and every endpoint. Ask <a href="/support">PostDelegate support</a> if you get stuck.</p>',
  },
  mcpPage: {
    title: 'Social Media MCP Server for Claude & ChatGPT | PostDelegate',
    description: (count: number) => `Connect Claude, ChatGPT or Cursor to PostDelegate. Your AI drafts and schedules posts to ${count} networks, and nothing goes out without your OK.`,
    eyebrow: 'MCP',
    h1: 'Social media MCP server for Claude, ChatGPT and Cursor',
    lead: 'MCP gives compatible AI tools a way to work with a publishing workspace. Bring your own assistant, sign in with PostDelegate and keep every post under your review.',
    readDocs: 'Read the MCP docs',
    body: mcpBody,
  },
  claudePage: {
    title: 'Claude and Cowork — PostDelegate',
    description: 'Connect Claude to PostDelegate as a custom connector so it can turn a conversation into drafts and scheduled posts on your calendar, with your review first.',
    eyebrow: 'Claude and Cowork',
    h1: 'Turn a good conversation into content.',
    lead: 'Use Claude to shape an idea, then review the result in your publishing workspace. Add PostDelegate to Claude as a custom connector.',
    connect: 'Connect Claude',
    body: '<h2>Start with the content</h2><p>Work on a caption, campaign idea or post outline in Claude. Bring the result into PostDelegate, attach the right media and inspect the channel preview before scheduling.</p><h2>Direct connections</h2><p>Claude can connect to PostDelegate as a custom connector. You add the server address, sign in with your PostDelegate account and approve access. The <a href="/docs/mcp/claude">Claude setup guide</a> has the steps, and the <a href="/docs/mcp/tools">tools reference</a> lists what Claude can do.</p><aside class="doc-note">PostDelegate does not claim an official Claude directory listing or affiliation. You add it as a custom connector, and availability of custom connectors depends on your Claude plan.</aside><h2>Keep the final review in view</h2><p>Confirm the destination account, final wording, media and schedule. Review the tools a connection exposes before allowing it to act on your behalf.</p>',
  },
  codexPage: {
    title: 'Codex and coding agents — PostDelegate',
    description: 'Connect Codex, Cursor, Claude Code and other coding agents to PostDelegate over MCP or the REST API, with copy-paste setup for each client in the docs.',
    eyebrow: 'Codex and coding agents',
    h1: 'Keep content close to your coding workflow.',
    lead: 'Coding agents can use PostDelegate over MCP or the REST API. Bring your own tool, sign in with PostDelegate and review every draft.',
    setup: 'MCP client setup',
    body: '<h2>A launch post is a good first task</h2><p>Have your coding tool prepare a short launch announcement and any supporting media. Review the wording in PostDelegate and choose an available channel and time yourself.</p><h2>Once your agent is connected</h2><p>Start by discovering the workspace and connected accounts, then create one draft. Confirm that the draft arrived before allowing a workflow to schedule content.</p><h2>Use the right connection instructions</h2><p>Codex, Cursor, Claude Code and other coding tools connect to PostDelegate over MCP, or call the REST API directly. The <a href="/docs/mcp/clients">client setup guide</a> has the configuration for each tool using the PostDelegate server address. Tools and endpoints from other services are not connected to PostDelegate.</p><p>See the <a href="/agents">agent overview</a>, <a href="/mcp">MCP</a> and <a href="/api">REST API</a>.</p>',
  },
  apiPage: {
    title: 'REST API — PostDelegate',
    description: 'PostDelegate\'s REST API for channels, posts and media. Authenticate with an API key, schedule posts from your own code, and find rate limits and examples.',
    eyebrow: 'REST API',
    h1: 'Build around your publishing workflow.',
    lead: 'A REST API for your channels, media and posts. Authenticate with your workspace API key and schedule from your own software.',
    readDocs: 'Read the API docs',
    discuss: 'Discuss an integration',
    body: '<h2>One interface for your content</h2><p>The API covers discovering connected channels, uploading media, creating drafts and scheduling posts. Each network still has its own content rules and account permissions, and the API applies the same checks as the app.</p><h2>Before connecting a production workflow</h2><ul><li>Find your API key under Settings, Agents / Dev in the app. The API is included on every plan.</li><li>Check which channels the workspace has connected. Only the networks listed as available in the <a href="/docs/channels">channel guides</a> can be connected today.</li><li>Begin with a draft, review it in the app, then test the scheduling and error-recovery path.</li></ul><aside class="doc-note">Base address: <code>https://app.postdelegate.com/api/public/v1</code>. Creating posts is rate limited per workspace. The <a href="/docs/api">API overview</a> has the details.</aside><h2>Keep credentials out of content</h2><p>Store your API key in your application or agent\'s secure settings. Do not include it in prompts, public repositories or screenshots. You can rotate it at any time in the app.</p><h2>Explore the docs</h2><p><a href="/docs/api/posts">Posts</a> · <a href="/docs/api/uploads">Uploads</a> · <a href="/docs/api/channels">Channels</a> · <a href="/docs/webhooks">Webhooks</a> · <a href="/docs/mcp">MCP</a> · <a href="/agents">Agent overview</a></p>',
  },
  comparePage: {
    title: 'Social Media Scheduler Comparisons (2026) | PostDelegate',
    description: 'Compare PostDelegate with Buffer, Hootsuite, Later, Publer, Sprout Social and other social media schedulers: pricing, free trial, AI approach and workflow.',
    eyebrow: 'Compare',
    h1: 'Social media scheduler comparisons, with every price sourced.',
    lead: 'Prices, limits, AI and networks side by side. Each competitor price links to the page we read it from.',
    // same order as VERSUS in ComparePage.astro: postiz, buffer, hootsuite, later, sprout-social, publer, post-bridge
    versus: [
      { title: 'PostDelegate vs Postiz', text: 'Plan prices, free trial, channel limits, AI approach and support side by side.' },
      { title: 'PostDelegate vs Buffer', text: 'Flat plans or per-channel pricing, free trial, AI, approvals and networks.' },
      { title: 'PostDelegate vs Hootsuite', text: 'Flat plans or per-seat pricing, approvals, AI, inbox and networks.' },
      { title: 'PostDelegate vs Later', text: 'Plan prices, post and user limits, AI credits or your own key, and networks.' },
      { title: 'PostDelegate vs Sprout Social', text: 'Per-seat or flat pricing, free trial, AI, API access and networks.' },
      { title: 'PostDelegate vs Publer', text: 'Per-account or flat pricing, entry options and trial, API and MCP access, and networks.' },
      { title: 'PostDelegate and Post Bridge', text: 'Questions to ask when choosing a social publishing workflow.' },
    ] as Card[],
    postBridgeCta: 'Compare the approach',
    pairsTitle: 'Head-to-head comparisons',
    pairsIntro: 'Two other tools side by side, with prices read from each vendor\'s own pricing page and a separate note on where PostDelegate fits.',
    morePairsTitle: 'More head-to-head comparisons',
    // same order as PAIRS in ComparePage.astro
    pairs: [
      { title: 'Postiz vs Buffer', text: 'Flat plans or per-channel pricing, worked costs at 3, 10 and 30 accounts, self-hosting, API and MCP.' },
      { title: 'Postiz vs Mixpost', text: 'Two self-hosted schedulers: AGPL or MIT and one-time licenses, server stack, 12-month cost and networks.' },
      { title: 'Postiz vs Post Bridge', text: 'Flat plans by account count, worked costs, team seats, networks, API and MCP, and self-hosting.' },
      { title: 'Postiz vs Blotato', text: 'Scheduling first or AI content first: AI credits, account limits, networks and API access during the trial.' },
      { title: 'Postiz vs Zernio', text: 'A scheduling app or a social media API: per-channel or per-account pricing, MCP, webhooks and SDKs.' },
      { title: 'Publer vs Buffer', text: 'Free plans and the X catch, per-account or per-channel pricing, bulk CSV, RSS, approvals, API and MCP.' },
      { title: 'Publer vs Metricool', text: 'Per-account or per-brand pricing, analytics and competitor tracking, bulk tools and the cost of adding X.' },
      { title: 'Postiz alternatives', text: 'Hosted, self-hosted and API options, with a fair section on when to stay on Postiz.' },
    ] as Card[],
    body: '<p>PostDelegate is open source (AGPL-3.0). See <a href="/licenses">/licenses</a>.</p><p>Looking for a Buffer or Hootsuite alternative? See <a href="/alternatives">social media scheduler alternatives</a> for a short summary of each comparison.</p><h2>Try the work you actually do</h2><p>Choose an account you manage, prepare a representative post, and check the connection, review and scheduling experience. Confirm the platforms and features you need before choosing a paid service.</p>',
  },
  alternativesPage: {
    title: 'Social media scheduler alternatives in 2026 — PostDelegate',
    description: 'Looking for a Buffer, Hootsuite, Later, Sprout Social or Publer alternative? Plain comparisons of pricing, trials, AI, API and the networks each connects.',
    eyebrow: 'Alternatives',
    h1: 'Social media scheduler alternatives.',
    lead: 'Comparing Buffer, Hootsuite, Later, Sprout Social and Publer with PostDelegate, including where each of them is the better pick today.',
    seePricing: 'See pricing',
    crumbCompare: 'Compare',
    crumbAlternatives: 'Alternatives',
    comparisonsTitle: 'The comparisons',
    versus: (name: string) => `PostDelegate vs ${name}`,
    seeComparison: 'See the comparison →',
    // same order as the cards in AlternativesPage.astro: buffer, hootsuite, later, sprout-social, publer, post-bridge
    buffer: (low: number, high: number) => `Buffer charges $${low} to $${high} per channel a month for the first ten channels and has a free plan for three channels. It is cheaper for one to three channels; PostDelegate’s flat plans cost less from five channels up.`,
    hootsuite: 'Hootsuite is a full suite with an inbox and listening, from $99 per user a month. PostDelegate covers scheduling and approvals for a flat price, without the inbox.',
    later: 'Later is built for Instagram, TikTok and visual planning, with AI credits and post caps by plan. PostDelegate suits YouTube, Bluesky, blogs and newsletters today.',
    sprout: 'Sprout Social is a broad platform from $79 per seat a month, with its API on Advanced. PostDelegate includes the API and MCP on every plan.',
    publer: 'Publer prices per account and member and has a free plan. It is cheaper for one or two accounts; PostDelegate keeps one flat price as you grow.',
    postBridge: 'Questions to ask about channels, workflow and automation when choosing between two lighter publishing tools.',
    oneToolTitle: 'Alternatives to one tool',
    postizAlternatives: 'Postiz alternatives',
    postizAlternativesText: 'Hosted, self-hosted and API options compared by price, networks and MCP, including when to stay on Postiz.',
    seeAlternatives: 'See the alternatives →',
    postizVsBuffer: 'Postiz vs Buffer',
    postizVsBufferText: 'Worked monthly costs at 3, 10 and 30 accounts, with every price linked to its source.',
    // p: plan prices and channel counts from plans.ts, the live network count and names
    body: (p: { starter: number; starterChannels: number; team: number; teamChannels: number; pro: number; proChannels: number; ultimate: number; ultimateChannels: number; liveCount: number; live: string; days: number }) => `<p>PostDelegate is open source (AGPL-3.0). See <a href="/licenses">/licenses</a>.</p><p>Competitor details on each page are taken from their own websites in October 2026. Plans change, so check each service’s website before you decide.</p><h2>How to choose a scheduler</h2><p>Most schedulers can put a post on a calendar. The differences that matter show up in four places. First, whether the exact accounts you manage can connect and publish today. Second, how the price is built: per channel, per account, per person or per plan, and what the total comes to for your real numbers. Third, how AI is paid for: an allowance or credits in the plan, or your own key. Fourth, how drafts get reviewed, by your team, your clients and any AI assistant that writes for you.</p><h2>Who PostDelegate suits</h2><ul><li><strong>Teams that work with AI assistants.</strong> The <a href="/mcp">MCP server</a> lets Claude, ChatGPT, Cursor, Claude Code and other MCP clients draft and schedule posts on every plan. Drafts can wait in the AI review inbox until a person approves them. A public <a href="/api">REST API</a> and webhooks are included too.</li><li><strong>Agencies that need client sign-off.</strong> Posts carry statuses, and clients approve posts from a link without creating an account. Customers keep each client’s channels together.</li><li><strong>Anyone watching the budget.</strong> Plans are flat: $${p.starter} a month for ${p.starterChannels} channels, $${p.team} for ${p.teamChannels} with team members, $${p.pro} for ${p.proChannels} and $${p.ultimate} for ${p.ultimateChannels}. They are not priced per person, and AI runs on your own OpenAI API key, so PostDelegate never charges for AI.</li><li><strong>Publishers beyond the big feeds.</strong> ${p.liveCount} networks connect today: ${p.live}.</li></ul><h2>Who should look elsewhere for now</h2><p>Instagram, Facebook, LinkedIn company Pages, Threads and Pinterest are waiting on each platform’s approval and cannot be connected yet, and X is not available on PostDelegate. If one of those is your main channel, Buffer, Hootsuite, Later, Sprout Social or Publer will serve you better today. The same goes if you need a shared inbox for replying to comments and messages, or social listening, which PostDelegate does not offer.</p><h2>Try it with your own content</h2><p>Every PostDelegate plan starts with a ${p.days}-day free trial that needs no credit card. Connect an account you manage, prepare a representative post, send it for approval and schedule it. Then compare that with the trial of any service above.</p>`,
    questionsTitle: 'Questions',
    faqBufferQ: 'What is a cheaper alternative to Buffer?',
    faqBufferA: (p: { starter: number; starterChannels: number; team: number; teamChannels: number }) => `For five or more channels, PostDelegate usually costs less than Buffer: $${p.starter} a month for ${p.starterChannels} channels and $${p.team} for ${p.teamChannels} channels with team members, where Buffer charges per channel. Check that the networks you need can connect today.`,
    faqAiQ: 'Which social media scheduler works with Claude or ChatGPT?',
    faqAiA: 'Several now do. PostDelegate has an MCP server on every plan, so Claude, ChatGPT, Cursor, Claude Code and other MCP clients can draft and schedule posts, and drafts can wait in an AI review inbox for a person to approve. Buffer, Hootsuite and Publer also offer MCP connections, on different plans.',
    faqMetaQ: 'Can PostDelegate post to Instagram, Facebook, LinkedIn company Pages or TikTok?',
    faqMetaA: (live: string) => `Instagram, Facebook and LinkedIn company Pages, along with Threads and Pinterest, are waiting on each platform’s approval, and X is not available on PostDelegate. TikTok is available to connect today; until TikTok finishes its Direct Post audit, posts sent straight to TikTok go out as private, and you can also send a video to the TikTok inbox to finish there. Today you can also connect ${live}.`,
    independent: (operator: string) => `PostDelegate is operated independently by ${operator} and is not affiliated with or endorsed by any of the services compared here. Their names belong to their owners.`,
  },
  aboutPage: {
    title: 'About PostDelegate',
    description: 'PostDelegate is a social media scheduler operated by Nasida Apps LLC: one visual calendar, composer and media library for creators, teams and brands.',
    eyebrow: 'About PostDelegate',
    h1: 'A clearer home for your social content.',
    lead: 'Plan your content, see what is coming next, and keep the work in one place.',
    body: (site: Site) => `<h2>What we are building</h2><p>PostDelegate brings a visual calendar, post composer and media library together for creators, teams and people working across brands. We are rolling out channel connections and integrations during early access.</p><h2>How it works</h2><p>Write a post once, tailor it for each channel and schedule it on the calendar. Teams share one workspace, with channels grouped by brand or customer. Every plan starts with a 7-day free trial that needs no credit card.</p><h2>Bring your own AI</h2><p>PostDelegate never charges for AI. AI writing, the Agent and AI images run on your workspace's own OpenAI API key, and a public REST API and MCP server let Claude, ChatGPT, coding agents and your own scripts work with your calendar. See the <a href="/docs">documentation</a> for setup.</p><h2 id="security">Accounts and your content</h2><p>Connect social accounts through the sign-in flow offered for that channel. Do not send your social passwords or access tokens to support or paste them into an AI conversation.</p><p>Read our <a href="${site.legal.privacy}">privacy policy</a> and <a href="${site.legal.terms}">terms</a> for the service's data practices and conditions. For account or data requests, <a href="/support#data-requests">contact support</a>.</p><h2>Who runs PostDelegate</h2><p>PostDelegate is operated by ${site.operator}. For questions, feedback or partnership enquiries, email <a href="mailto:${site.email}">${site.email}</a>.</p>`,
  },
  supportPage: {
    title: 'Support — PostDelegate',
    description: 'Contact PostDelegate support about account access, channel connections, content or a data request, and see how to disconnect a channel or delete your account.',
    eyebrow: 'Support',
    h1: 'A little help with your next post.',
    lead: 'Tell us what happened and which part of your workflow needs a hand.',
    email: 'Email support',
    workspace: 'Open your workspace',
    body: (site: Site) => `<h2>Help us find the issue</h2><p>Include your workspace name, affected platform, the time and timezone, and what you expected to happen. An error message or a screenshot can help.</p><p>Remove passwords, API keys, access tokens, payment details and recovery codes before sending a screenshot. We do not need your social account password.</p><h2>Connecting a channel</h2><p>Connections are being rolled out during early access. The <a href="/docs/channels">channels overview</a> lists the networks you can connect today. A platform appearing in our directory is not a guarantee that every account or publishing feature is available on PostDelegate.</p><h2 id="data-requests">Account and data requests</h2><p>Email <a href="mailto:${site.email}">${site.email}</a> from the email associated with your account and describe your request. Tell us whether you want to disconnect a channel, request information about your data, or delete your account. We may need to verify account ownership before acting.</p><p>See our <a href="${site.legal.privacy}">privacy policy</a> for details about the data the service processes.</p><h2>Useful links</h2><p><a href="/status">Service availability</a> · <a href="/platforms">Platform coverage</a> · <a href="/agents">Integration previews</a> · <a href="${site.source}">Application source</a></p>`,
  },
  // The scheduler page template, for the live networks.
  scheduler: {
    title: (name: string, action: string) => `${name} Scheduler: ${action} | PostDelegate`,
    eyebrow: (name: string) => `${name} · available now`,
    tryCaption: 'Try the caption checker',
    head: (name: string) => `${name} is live on PostDelegate`,
    headSub: (others: number) => `Plan it on one calendar with ${others} other live networks.`,
    note: (name: string, docs: string) => `<strong>Available now.</strong> Connect ${name} from <strong>Add Channel</strong> on the calendar page. The <a href="${docs}">${name} guide</a> has the exact fields and post settings.`,
    howTo: (action: string) => `How to ${action}`,
    publishTitle: (name: string) => `What you can publish to ${name}`,
    settingsTitle: (name: string) => `${name} post settings`,
    setting: 'Setting', notes: 'Notes',
    beforeTitle: 'Before connecting',
    readGuide: (name: string, docs: string) => `Read the <a href="${docs}">${name} guide</a> in our documentation for connection steps, post settings and troubleshooting.`,
    planTitle: (name: string) => `Plan ${name} with the rest of your channels`,
    planText: (name: string) => `${name} sits on the same calendar as every other channel you connect. In one post you can pick several channels, write the content once and adjust it for each, and every channel keeps its own settings. Save a draft to review a post first, choose Add to Calendar to schedule it, or choose Post now to send it immediately. The <a href="/docs/posts">scheduling guide</a> covers drafts, repeats, previews and time slots.`,
    aiTitle: (name: string) => `Use Claude or ChatGPT with ${name}`,
    aiText: (name: string) => `PostDelegate runs an MCP server, so an assistant you already use can look at your ${name} channel, read its rules and create a draft for you to review. AI is bring-your-own, and PostDelegate never charges for it. Setup guides: <a href="/docs/mcp/claude">Claude</a>, <a href="/docs/mcp/chatgpt">ChatGPT</a>, and <a href="/guides/social-media-mcp-server">what a social media MCP server is</a>.`,
    fromAgents: (name: string) => `Step-by-step guides for ${name}:`,
    reviewTitle: 'Review the whole post',
    reviewText: 'Check the destination, wording, media and time before scheduling. Look at the result in your workspace after publication; a queued item is not a published-post confirmation.',
    faqTitle: 'Frequently asked questions',
    guidesTitle: 'Guides',
    moreTitle: (others: number) => `Schedule on ${others} more networks from the same calendar`,
    crumb: 'Platforms',
    // FAQ answers are plain text; [label](/path) becomes a link
    freeQ: (name: string) => `Can I schedule ${name} posts for free?`,
    freeA: (name: string, days: number, price: number) => `Every PostDelegate plan starts with a ${days}-day free trial, and no credit card is needed. During the trial you can connect ${name} and schedule posts like any other channel. To keep scheduling after the trial, choose a paid plan, from $${price} a month.`,
    aiQ: (name: string) => `Can Claude or ChatGPT post to ${name}?`,
    aiA: (name: string) => `Yes, through MCP. Add PostDelegate to Claude or ChatGPT as a custom connector, and the assistant can list your channels, read the rules for ${name} and create a draft or scheduled post for you. Ask for a draft first and check it in the calendar before anything is scheduled. AI is bring-your-own, and PostDelegate never charges for it. See the [Claude setup](/docs/mcp/claude) and the [ChatGPT setup](/docs/mcp/chatgpt).`,
  },
  // Per live network, keyed by scheduler slug. English pages read schedulers.ts directly.
  schedulers: Object.fromEntries(LIVE_SCHEDULERS.map((s) => [s.slug, { action: s.action ?? '', description: s.description ?? '', h1: s.h1, intro: s.intro, plan: s.plan, limits: s.limits }])) as Record<string, SchedulerStrings>,
};

export type Dict = typeof en;
export default en;

// Pages for networks that are not live yet are English only (src/i18n TRANSLATED_SCHEDULERS),
// so their strings are not part of Dict.
export const SCHEDULER_SOON = {
  title: (name: string) => `${name} Scheduler (waiting on approval) | PostDelegate`,
  description: (name: string, pending: string, open: number, days: number) => `${name} scheduling on PostDelegate opens once ${pending}. Until then, try the ${open} networks open today: ${days}-day free trial, no card.`,
  pendingDefault: 'the connection is ready',
  eyebrow: (name: string) => `${name} · waiting on approval`,
  head: (name: string) => `${name}: waiting on approval`,
  headSub: (open: number) => `Meanwhile, ${open} networks connect today.`,
  note: (name: string, pending: string) => `<strong>Not live yet.</strong> ${name} cannot be connected on PostDelegate yet. It opens once ${pending}. See the <a href="/docs/channels">networks you can connect today</a>, or <a href="/support">contact support</a> to tell us you need it.`,
  publishTitle: 'What is planned',
  readGuide: (docs: string) => `See <a href="${docs}">Waiting on approval</a> in our documentation for the networks that are not open yet.`,
  agents: 'For automation, see our <a href="/agents">integration previews</a>. No agent connection is implied by this platform page.',
  moreTitle: (open: number) => `Schedule on these ${open} networks today`,
  faq: (name: string, pending: string, open: number, days: number) => [
    { q: `Can I schedule ${name} posts with PostDelegate today?`, a: `Not yet. ${name} cannot be connected on PostDelegate today. It opens once ${pending}, and a network that is not marked available in the [platform directory](/platforms) does not work.` },
    { q: `When will ${name} be available?`, a: 'We do not give dates, because platform review timelines are outside our control. When a connection opens it will appear under Add Channel in the app and get its own guide in the documentation. [Contact support](/support) to tell us you need it.' },
    { q: 'What can I do on PostDelegate while I wait?', a: `Start the ${days}-day free trial, with no credit card, and connect any of the ${open} networks open today, such as YouTube, Bluesky, Slack and TikTok. The calendar, composer and media library work the same way for every channel.` },
    { q: `Can Claude or ChatGPT post to ${name}?`, a: `Not yet. An assistant connected over MCP can only work with channels that are connected in PostDelegate, so it cannot publish to ${name} until that connection exists. You can still use Claude or ChatGPT to draft the text, then bring it into PostDelegate. See the [MCP guide](/docs/mcp).` },
  ],
};
