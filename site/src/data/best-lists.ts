// Best-of lists at /best/{slug}: the tools in ./tools that meet one stated rule, in an order set by
// a second rule, with PostDelegate held to both like everyone else. BestList.astro renders the facts
// from the JSON files, so every claim on a list links the vendor page it was read from.
// `picks` holds the tools that meet the rule, applied by hand to each tool's fact; the checks below fail the build
// when an included tool lacks the fact the rule reads, or a network list names a tool that does not
// list the network. The words below may only restate facts from those files, plans.ts and networks.ts.
import { PLANS, TRIAL_DAYS } from './plans';
import { AVAILABLE_NETWORKS, NETWORKS, WAITING_NETWORKS, networkStatus } from './networks';
import { TOOLS, planFor, type CostPoint, type Fact, type Tool } from './tools';
import { SITE } from './site';
import { ogCardFor } from './og-cards.mjs';

type FactName = Exclude<keyof Tool, 'name' | 'slug' | 'site' | 'pricingUrl' | 'checked' | 'perChannel' | 'cost'>;
export type FactKey = FactName | `cost.${CostPoint}`;
export type BestOrder = { by: 'name' } | { by: 'lowest'; key: FactKey } | { by: 'trialDays' };

export interface BestList {
  slug: string; published: string;
  /** Under 60 characters. */
  title: string;
  /** 140-160 characters; also the card text on /best. */
  description: string;
  h1: string;
  /** Two or three sentences: who should pick what, from the facts. */
  shortAnswer: string;
  /** The fact the inclusion rule reads; tools left out show it under "Not on this list". */
  requires: FactKey;
  /** For a network list: the key in networks.ts. */
  network?: string;
  /** Which tools are on the list, and why, in plain words. */
  rule: string;
  order: BestOrder;
  /** The facts shown for each tool, 2 to 4. */
  facts: { label: string; key: FactKey }[];
  /** The tools on the list, by slug, each with its "Pick it if ..." line, written only from its facts. */
  picks: Record<string, string>;
  faq: { q: string; a: string }[];
  /** Guides and pages for this topic; the PostDelegate vs pages and the hubs are added for every list. */
  links: { href: string; label: string }[];
}

const [starter] = PLANS;
const at3 = planFor(3);
const at30 = planFor(30);
const PRICING = `${SITE.url}/pricing`;
const PLATFORMS = `${SITE.url}/platforms`;
const names = (list: { name: string }[]) => list.map((n) => n.name).join(', ');
const and = (list: { name: string }[]) => (list.length > 1 ? `${names(list.slice(0, -1))} and ${list.at(-1)!.name}` : names(list));
const bluesky = NETWORKS.find((n) => n.key === 'bluesky')!;
const mastodon = NETWORKS.find((n) => n.key === 'mastodon')!;

// PostDelegate's JSON file leaves out what plans.ts and networks.ts already hold, so the list
// reads those instead of a copy that could drift from the product.
function ownFact(key: FactKey): Fact | undefined {
  if (key.startsWith('cost.')) {
    const plan = planFor(Number(key.slice(5)));
    return { value: `$${plan.monthly}`, note: `${plan.name}, ${plan.channels} channels`, src: PRICING };
  }
  if (key === 'entryPaid') return { value: `${starter.name}, $${starter.monthly}/month for ${starter.channels} channels`, src: PRICING };
  if (key === 'networks') return { value: `${AVAILABLE_NETWORKS.length} live: ${names(AVAILABLE_NETWORKS)}. Waiting on platform approval, so not connectable yet: ${names(WAITING_NETWORKS)}. X is not available`, src: PLATFORMS };
  return undefined;
}

export function bestFact(t: Tool, key: FactKey): Fact | undefined {
  const fact = key.startsWith('cost.') ? t.cost?.[key.slice(5) as CostPoint] : t[key as FactName];
  return fact ?? (t.slug === 'postdelegate' ? ownFact(key) : undefined);
}

/** The lowest dollar figure in a fact: "$74 to $84" is 74, "$0 / $18" is 0. */
export const lowestDollars = (fact?: Fact) => {
  const found = [...(fact?.value ?? '').matchAll(/\$(\d[\d,]*(?:\.\d+)?)/g)].map((m) => Number(m[1].replace(/,/g, '')));
  return found.length ? Math.min(...found) : Infinity;
};
/** "14-day free trial" and "Free for 30 days" are 14 and 30. */
export const trialDays = (fact?: Fact) => {
  const found = fact?.value.match(/(\d+)[- ]days?\b/i);
  return found ? Number(found[1]) : undefined;
};

export const bestHref = (list: { slug: string }) => `/best/${list.slug}`;
/** The slugs of the tools that meet a list's rule. */
export const bestIncluded = (list: BestList) => Object.keys(list.picks);
const byName = (a: Tool, b: Tool) => a.name.localeCompare(b.name);

/** The tools on a list, in the list's order; ties always go alphabetically. */
export function bestEntries(list: BestList): Tool[] {
  const tools = bestIncluded(list).map((slug) => TOOLS[slug]);
  const order = list.order;
  if (order.by === 'lowest') return tools.sort((a, b) => lowestDollars(bestFact(a, order.key)) - lowestDollars(bestFact(b, order.key)) || byName(a, b));
  if (order.by === 'trialDays') return tools.sort((a, b) => (trialDays(b.trial) ?? 0) - (trialDays(a.trial) ?? 0) || byName(a, b));
  return tools.sort(byName);
}
export const bestLeftOut = (list: BestList): Tool[] => Object.values(TOOLS).filter((t) => !bestIncluded(list).includes(t.slug)).sort(byName);

/** One sentence on the order, for "How we chose". */
export function orderRule(list: BestList): string {
  const order = list.order;
  if (order.by === 'lowest') {
    const label = list.facts.find((f) => f.key === order.key)?.label ?? order.key;
    return `Order: by the lowest dollar figure in the "${label}" fact, cheapest first. Where a price is a range, the low end counts. Ties go alphabetically, and a tool with no published figure goes last.`;
  }
  if (order.by === 'trialDays') return 'Order: by the length of the trial in days, longest first. Ties go alphabetically.';
  return 'Order: alphabetical. We do not rank or score these tools; the facts and the "pick it if" line are there for you to choose.';
}

const TOOL_COUNT = Object.keys(TOOLS).length;
// Some vendors write "including ..." before a partial list of networks.
const networkRule = (name: string) => `Every tool in our comparison data (${TOOL_COUNT} tools) whose own network list names ${name}. For PostDelegate that means ${name} is live in the app today, not waiting on approval. Some vendors list networks as "including" a few names, so a tool under "Not on this list" may still reach ${name}; check its own site.`;

export const BEST_LISTS: BestList[] = [
  {
    slug: 'social-media-mcp-servers', published: '2026-11-08',
    title: 'Best Social Media MCP Servers (2026): 13 Tools, Sourced',
    description: 'Social media schedulers whose vendors document an MCP server for Claude, ChatGPT and other assistants: which plans include it, free options, trials and price.',
    h1: 'Social media MCP servers for AI assistants',
    shortAnswer: `To try MCP on a free plan, look at Buffer, Metricool or Typefully. If the assistant should draft but never publish, Agorapulse and Planable say their connectors cannot publish. To self-host, Mixpost Pro includes one, and to build posting into your own product, Zernio is an API with an MCP server. PostDelegate, which makes this page, has MCP on every plan from $${starter.monthly} a month.`,
    requires: 'mcp',
    rule: `Every tool in our comparison data (${TOOL_COUNT} tools) whose vendor's own site documents an MCP server or connector for AI assistants, on any plan. Tools whose sites do not mention one are under "Not on this list", with what we found.`,
    order: { by: 'name' },
    facts: [
      { label: 'MCP', key: 'mcp' },
      { label: 'API', key: 'api' },
      { label: 'Trial', key: 'trial' },
      { label: '10 accounts, per month', key: 'cost.10' },
    ],
    picks: {
      agorapulse: 'you want an assistant to read your inbox, listening and analytics data and leave drafts, but never publish. It needs your own paid assistant subscription.',
      blotato: 'you want AI images and video as well as posting, and will pay from day one: the MCP server is on paid plans, not the trial.',
      buffer: 'you want to try MCP for free. It is on every plan, including the Free plan for 3 channels.',
      metricool: 'analytics matter most and you want MCP on the Free plan, where limits may apply.',
      mixpost: 'you want to self-host. MCP is in the Pro and Enterprise licenses, and in Cloud from Momentum up.',
      planable: 'your team works through approvals and the assistant should draft and handle approvals, not publish.',
      'post-bridge': 'you post on your own and want MCP in the $39 Marketer plan for 15 accounts.',
      postdelegate: `you want MCP on every plan, from $${starter.monthly}, with sign-in by OAuth or an API key, and AI on your own assistant or key.`,
      postiz: 'you want MCP, a public API and a CLI on every plan, or the AGPL code to run yourself.',
      publer: 'you are on Business or Enterprise, where Publer offers MCP to eligible customers.',
      typefully: 'you write for X, LinkedIn, Threads, Bluesky, Mastodon or Substack and want MCP on the Free plan, with setup guides for Claude, ChatGPT, Claude Code and Cursor.',
      'vista-social': 'you want an assistant to reach scheduling, analytics, inbox and reporting under each user\'s own role permissions, on any paid plan.',
      zernio: 'you are building your own product and want an API with an MCP server, priced per connected account.',
    },
    faq: [
      { q: 'What is a social media MCP server?', a: 'It lets an AI assistant such as Claude or ChatGPT use a scheduler\'s tools, for example to list your channels or create a draft, instead of only writing text for you to paste. Our guide, <a href="/guides/social-media-mcp-server">what is a social media MCP server</a>, explains how they work and how to stay in control.' },
      { q: 'Which social media MCP servers are free?', a: 'Buffer, Metricool and Typefully list MCP on their free plans. Buffer Free covers 3 channels with 10 scheduled posts per channel. Metricool Free covers 1 brand and 20 posts a month, and Metricool says limits may apply. Typefully Free covers 1 social set and 10 posts a month.' },
      { q: 'Can the assistant publish through these servers?', a: 'It depends on the server. Agorapulse says its connector does not publish or schedule posts, and Planable says its connector cannot publish directly. Vista Social lists scheduling among its MCP tools. For the others, the pages we read do not say either way. PostDelegate\'s server can create drafts, scheduled posts or immediate posts; see the <a href="/docs/mcp/tools">MCP tools reference</a>.' },
      { q: 'Why is PostDelegate on this list?', a: `Because it meets the same rule as every other tool: its own docs describe an MCP server. We make PostDelegate, so read its entry with that in mind. ${and(WAITING_NETWORKS)} are waiting on platform approval and cannot be connected yet, and X is not available.` },
    ],
    links: [
      { href: '/guides/social-media-mcp-server', label: 'What is a social media MCP server?' },
      { href: '/guides/schedule-social-media-posts-with-claude', label: 'Schedule posts with Claude' },
      { href: '/guides/schedule-social-media-posts-with-chatgpt', label: 'Schedule posts with ChatGPT' },
      { href: '/guides/ai-social-media-agent-guardrails', label: 'Let an AI agent post safely' },
      { href: '/mcp', label: 'PostDelegate MCP server' },
    ],
  },
  {
    slug: 'social-media-scheduling-apis', published: '2026-11-08',
    title: 'Best Social Media Scheduling APIs (2026): 10 Tools, Sourced',
    description: 'Schedulers and APIs whose vendors document a public API you can switch on yourself: which plans include it, free options, MCP and price at 10 accounts.',
    h1: 'Social media scheduling APIs you can switch on yourself',
    shortAnswer: `To build posting into your own product, Zernio is an API first, with the first 2 accounts free. For an API inside a scheduler you can start free, Buffer and Typefully include one on their free plans. Postiz and PostDelegate list a public API on every plan, and Metricool and Planable put theirs on higher plans. PostDelegate makes this page; its plans start at $${starter.monthly} a month.`,
    requires: 'api',
    rule: `Every tool in our comparison data (${TOOL_COUNT} tools) whose vendor documents a public API you can turn on yourself, on a published plan or a free tier. We left out APIs that need a sales call, a request form or an eligibility check, APIs whose price is not published, and APIs that only export reports. Each one is under "Not on this list" with the vendor's wording.`,
    order: { by: 'name' },
    facts: [
      { label: 'API', key: 'api' },
      { label: 'MCP', key: 'mcp' },
      { label: 'Free option', key: 'freeOption' },
      { label: '10 accounts, per month', key: 'cost.10' },
    ],
    picks: {
      blotato: 'you want an API with official n8n and Make nodes and AI-made media, on a paid plan. Creating an API key ends the trial.',
      buffer: 'you want API keys on every plan, Free included, and can work within monthly request limits per channel.',
      metricool: 'you already use Metricool for analytics and are on Advanced or Custom, where the API is.',
      mixpost: 'you want the API and webhooks on your own server with Pro or Enterprise, or on Cloud from Momentum up.',
      planable: 'your team plans in Planable and is on Pro or Enterprise; Basic does not include the API.',
      'post-bridge': 'you post on your own and want the API in the $39 Marketer plan.',
      postdelegate: `you want a REST API and webhooks on every plan, from $${starter.monthly} a month, with an MCP server for assistants too.`,
      postiz: 'you want a public API, a CLI and webhooks on every plan, or the AGPL code to run yourself.',
      typefully: 'you write for X, LinkedIn, Threads, Bluesky, Mastodon or Substack and want an API on the Free plan, with higher rate limits on Business.',
      zernio: 'you are building a product and want one API for posting, analytics, comments, messaging, ads and webhooks, with the first 2 accounts free.',
    },
    faq: [
      { q: 'Which social media APIs can I use for free?', a: 'Buffer has API keys on every plan, Free included, with monthly request limits per channel. Typefully has a public API on every plan including Free. Zernio\'s first 2 connected accounts are free, with no credit card.' },
      { q: 'Why are Publer, Vista Social and Zoho Social not listed?', a: 'Their APIs are not something you can switch on from a published plan. Publer offers its API on Business and Enterprise to eligible customers. Vista Social\'s comes with Enterprise or an API add-on whose price is not published. Zoho Social opens its API by request, reviewed within two business days. Each vendor\'s wording is under "Not on this list".' },
      { q: 'Do I need an API or an MCP server?', a: 'Use an API for scripts and automations that run on their own. Use MCP when you want an AI assistant to draft posts in a conversation. Every tool on this list also documents an MCP server; see the <a href="/best/social-media-mcp-servers">MCP list</a>.' },
    ],
    links: [
      { href: '/api', label: 'PostDelegate REST API' },
      { href: '/docs/api', label: 'PostDelegate API reference' },
      { href: '/guides/bulk-schedule-social-posts-csv', label: 'Bulk schedule posts from a CSV' },
    ],
  },
  {
    slug: 'social-media-schedulers-for-multiple-accounts', published: '2026-11-08',
    title: 'Best Social Media Schedulers for 30 Accounts (2026)',
    description: 'What 17 social media schedulers cost a month for 30 accounts, cheapest first, with team seats and approvals, each figure linked to the vendor\'s pricing page.',
    h1: 'Social media schedulers for 30 accounts, cheapest first',
    shortAnswer: `At 30 accounts the lowest published prices here are Metricool (from $25, if your accounts fit into 5 brands), PostDelegate ($${at30.monthly} on ${at30.name}) and Postiz ($49 on Pro). If you run an agency, read the team row too: on many tools the 30-account price is for a plan without approvals or extra users. PostDelegate makes this page and sits where the price puts it.`,
    requires: 'cost.30',
    rule: `Every tool in our comparison data (${TOOL_COUNT} tools) whose pricing page publishes enough for us to work out a monthly price at 30 connected accounts. Prices are for monthly billing, before tax, and each one's note shows how it was worked out. The price is for the plan named in that note, which is not always the plan with team features.`,
    order: { by: 'lowest', key: 'cost.30' },
    facts: [
      { label: '30 accounts, per month', key: 'cost.30' },
      { label: '10 accounts, per month', key: 'cost.10' },
      { label: 'Teams and approvals', key: 'teams' },
      { label: 'Priced by', key: 'pricingModel' },
    ],
    picks: {
      metricool: 'your 30 accounts group into a few brands with one profile per network each. The price depends on that split, from $25 to $210.',
      postdelegate: `you want one flat plan for 30 channels with team members: ${at30.name}, $${at30.monthly} a month.`,
      postiz: 'you want 30 channels and unlimited team members on one flat plan (Pro, $49), or to self-host.',
      'zoho-social': 'your channels fit into a few brands: 30 means three brands on Professional ($74) or two on Premium ($88), where approvals start.',
      mixpost: 'you want 48 channels on Cloud Business for $79 with 5 members, or a self-hosted license.',
      blotato: 'you want AI to make content for up to 40 accounts on Creator, $97 a month.',
      'post-bridge': 'you want up to 99 accounts and team members on Operator, $99 a month.',
      publer: 'you want per-account pricing with every 10th account free: $108 on Professional, or $189 on Business with approval workflows.',
      zernio: 'you are building software rather than scheduling by hand: 30 accounts through the API cost $108.',
      socialbee: 'you reuse posts by content category: Pro\'s 25 profiles plus a 5-profile add-on is $114, with 3 users.',
      buffer: 'you want to pay per channel: Essentials is $135, and approvals with unlimited members need Team at $195.',
      sendible: 'you run client workspaces with unlimited users: 30 profiles on Plus cost $159, with assignment and approvals.',
      coschedule: 'you plan social inside a marketing calendar: $174 on Starter for one user, or $184 on Professional for up to 3. X is extra.',
      planable: 'approvals come first: 30 pages on Pro means 3 workspaces for $177, with unlimited users.',
      'vista-social': 'you want 30 profiles, 3 users and multi-stage approval on Advanced, $199 a month. X is $29 more.',
      loomly: 'you want unlimited users and calendars: 30 accounts means Beyond, $332 for up to 60 accounts.',
      agorapulse: 'you need a unified inbox and listening for one user: $399 for 30 profiles on Standard, with each extra teammate $99 more.',
    },
    faq: [
      { q: 'What is the cheapest scheduler for 30 accounts?', a: `By the lowest published price, Metricool: from $25 a month on Starter if your accounts fit into 5 brands, with one profile per network in each brand. If they do not, Metricool can cost up to $210. Of the flat plans that count channels, PostDelegate ${at30.name} is $${at30.monthly} for ${at30.channels} channels and Postiz Pro is $49 for 30.` },
      { q: 'Which of these suit an agency with clients?', a: 'Check the team row for approvals and how clients are kept apart. Sendible includes unlimited users on every plan, with approvals from Plus. Planable has unlimited users and required approvals on Pro. Vista Social has single-stage approval on every plan and white label on Scale. PostDelegate has client approval links that need no account; see the <a href="/guides/client-approval-workflow">client approval guide</a>.' },
      { q: 'Why is Typefully not on this list?', a: 'Our data has no monthly price for Typefully at 30 accounts. It prices per social set rather than per account, and its Creator plan is billed yearly only.' },
    ],
    links: [
      { href: '/guides/client-approval-workflow', label: 'Social media approval workflow for agencies' },
      { href: '/guides/bulk-schedule-social-posts-csv', label: 'Bulk schedule posts from a CSV' },
      { href: '/pricing', label: 'PostDelegate pricing' },
    ],
  },
  {
    slug: 'social-media-schedulers-free-trial-no-credit-card', published: '2026-11-08',
    title: 'Social Media Schedulers With a Free Trial, No Card (2026)',
    description: 'Social media schedulers whose own sites offer a timed free trial with no credit card, longest trial first, with what happens when it ends and the entry price.',
    h1: 'Social media schedulers with a free trial and no credit card',
    shortAnswer: `Agorapulse has the longest no-card trial here, 30 days. Zoho Social gives 15 days and then moves you to its free plan instead of charging you. Sendible, SocialBee and Vista Social give 14 days, and Loomly and PostDelegate give ${TRIAL_DAYS}. PostDelegate makes this page and sits where its trial length puts it.`,
    requires: 'trial',
    rule: `Every tool in our comparison data (${TOOL_COUNT} tools) whose own site offers a free trial of a set number of days and says no credit card is needed to start it. Trials that need a card, trials whose page does not say, and free post allowances with no time limit are under "Not on this list".`,
    order: { by: 'trialDays' },
    facts: [
      { label: 'Trial', key: 'trial' },
      { label: 'After the trial', key: 'freeOption' },
      { label: 'Entry price', key: 'entryPaid' },
      { label: '10 accounts, per month', key: 'cost.10' },
    ],
    picks: {
      agorapulse: 'you want the longest trial here, 30 days, and a per-user plan from $99 fits your budget.',
      'zoho-social': 'you want 15 days of everything, then a forever free plan for 1 brand with 6 channels.',
      sendible: 'you manage clients in workspaces and want 14 days with no contract.',
      socialbee: 'you want 14 days of Pro, and a 30-day money-back guarantee after that.',
      'vista-social': 'you want 14 days on a suite with an inbox, review management and listening, from $99.',
      loomly: 'you want 7 days on a calendar with approval workflows from Starter, which is $65 for 12 accounts.',
      postdelegate: `you want ${TRIAL_DAYS} days, then flat plans from $${starter.monthly} with unlimited posts and the API and MCP on every plan.`,
    },
    faq: [
      { q: 'Which scheduler has the longest free trial without a card?', a: 'Agorapulse, at 30 days with no credit card. Its pricing FAQ says you can keep using a free plan after the trial with no automatic charge.' },
      { q: 'What happens when the trial ends?', a: 'It varies. Zoho Social moves the account to its free plan. Agorapulse says you can keep using a free plan with no automatic charge. SocialBee stops posting automatically. PostDelegate asks you to add a card before the trial ends to keep your plan. For the others, see the "After the trial" fact.' },
      { q: 'Why are Buffer, Postiz and Blotato not here?', a: 'What we recorded from Buffer\'s pricing page is a 14-day trial, with nothing on whether a card is needed. Postiz needs a payment method to start its trial, and Blotato needs a card. Their exact wording is under "Not on this list".' },
    ],
    links: [
      { href: '/pricing', label: 'PostDelegate pricing' },
      { href: '/docs/billing', label: 'PostDelegate billing and trial' },
    ],
  },
  {
    slug: 'bluesky-schedulers', published: '2026-11-08', network: 'bluesky',
    title: 'Best Bluesky Schedulers (2026): 16 Tools, Sourced',
    description: 'Social media schedulers whose own network lists name Bluesky, cheapest first at 3 accounts, with free plans and MCP, each fact linked to the vendor page.',
    h1: 'Bluesky schedulers, cheapest first at 3 accounts',
    shortAnswer: `To start free, Buffer, Metricool, Publer and Zoho Social all list Bluesky and have free plans. To post to Bluesky from your own code, Zernio is an API. PostDelegate, which makes this page, has Bluesky live from $${at3.monthly} a month. Loomly and Planable do not list Bluesky on the pages we read.`,
    requires: 'networks',
    rule: networkRule(bluesky.name),
    order: { by: 'lowest', key: 'cost.3' },
    facts: [
      { label: 'Networks', key: 'networks' },
      { label: '3 accounts, per month', key: 'cost.3' },
      { label: 'Free option', key: 'freeOption' },
      { label: 'MCP', key: 'mcp' },
    ],
    picks: {
      buffer: 'you have up to 3 channels and 10 scheduled posts per channel is enough: Buffer Free covers that.',
      metricool: 'you want analytics with your scheduling, and the Free plan\'s 1 brand and 20 posts a month are enough.',
      publer: 'you want a free plan for 3 accounts with 10 scheduled posts each, and bulk scheduling later.',
      'zoho-social': 'you want a forever free plan for 1 brand with 6 channels.',
      zernio: 'you are a developer posting to Bluesky from your own app through an API.',
      postdelegate: `${bluesky.name} is one of your main networks: it is live on PostDelegate for posts and threads, connected with an app password, from $${at3.monthly} for ${at3.channels} channels.`,
      blotato: 'you want AI to make the posts too: Starter is $29 for 20 accounts.',
      mixpost: 'you want to self-host (Bluesky is in Pro and Enterprise, not the free Lite) or use Cloud from $29.',
      postiz: 'you want 30 listed networks and open-source code you can self-host.',
      socialbee: 'you reuse posts by content category, from $29 for up to 5 profiles.',
      sendible: 'you manage client workspaces with unlimited users, from $35 for 6 profiles.',
      coschedule: 'you plan social posts inside a marketing calendar; Starter is $39 for one user and 3 profiles.',
      'post-bridge': 'you cross-post on your own to up to 15 accounts for $39.',
      agorapulse: 'you need an inbox and listening as much as scheduling; plans are per user, from $99.',
      'vista-social': 'you want an inbox, review management and listening too, from $99 for 15 profiles.',
      typefully: 'you write text-first posts and threads; the Free plan covers 1 social set and 10 posts a month.',
    },
    faq: [
      { q: 'Is there a free Bluesky scheduler?', a: 'Several tools here list Bluesky and have a free plan: Buffer (3 channels, 10 scheduled posts per channel), Metricool (1 brand, 20 posts a month), Publer (3 accounts, 10 scheduled posts each), Zoho Social (1 brand with 6 channels) and Typefully (1 social set, 10 posts a month). Postiz\'s self-hosted code is also free to run, if you host it.' },
      { q: 'How does PostDelegate connect to Bluesky?', a: 'With an app password, not your main password. The <a href="/guides/schedule-bluesky-posts">Bluesky guide</a> walks through it, including threads, images and video.' },
      { q: 'Why are Loomly and Planable missing?', a: 'Loomly\'s integrations and pricing pages do not list Bluesky, and Planable\'s list of supported platforms does not include it. Their network lists are under "Not on this list".' },
    ],
    links: [
      { href: '/guides/schedule-bluesky-posts', label: 'How to schedule Bluesky posts and threads' },
      { href: `/${bluesky.scheduler}`, label: 'PostDelegate Bluesky scheduler' },
      { href: '/tools/bluesky-character-counter', label: 'Bluesky character counter' },
      { href: '/tools/thread-splitter', label: 'Thread splitter' },
    ],
  },
  {
    slug: 'mastodon-schedulers', published: '2026-11-08', network: 'mastodon',
    title: 'Best Mastodon Schedulers (2026): 9 Tools, Sourced',
    description: 'Schedulers whose own network lists name Mastodon, cheapest first at 3 accounts, with free and self-hosted options and MCP, each fact linked to its source.',
    h1: 'Mastodon schedulers, cheapest first at 3 accounts',
    shortAnswer: `Buffer, Publer and Zoho Social list Mastodon and have free plans. To self-host, Mixpost Lite is free and MIT-licensed, and Postiz is AGPL open source. PostDelegate, which makes this page, has Mastodon live for mastodon.social from $${at3.monthly} a month.`,
    requires: 'networks',
    rule: networkRule(mastodon.name),
    order: { by: 'lowest', key: 'cost.3' },
    facts: [
      { label: 'Networks', key: 'networks' },
      { label: '3 accounts, per month', key: 'cost.3' },
      { label: 'Free option', key: 'freeOption' },
      { label: 'MCP', key: 'mcp' },
    ],
    picks: {
      buffer: 'you have up to 3 channels and want a free plan with 10 scheduled posts per channel.',
      publer: 'you want a free plan for 3 accounts, with Telegram and WordPress on the same calendar later.',
      'zoho-social': 'you want a forever free plan for 1 brand with 6 channels.',
      postdelegate: `you post to mastodon.social, with threads, images or a video, alongside networks such as Bluesky, Nostr and Lemmy, from $${at3.monthly} for ${at3.channels} channels.`,
      mixpost: 'you want to self-host for free: Mixpost Lite (MIT) covers Facebook Pages, X and Mastodon.',
      postiz: 'you want 30 listed networks and AGPL code you can self-host.',
      socialbee: 'you already use SocialBee. Mastodon is not in its main network list; it is reached through Universal Posting in the mobile app.',
      coschedule: 'you plan social posts inside a marketing calendar; Starter is $39 with 3 profiles.',
      typefully: 'you write text-first threads. Its pricing page lists Mastodon but its help centre does not, so check before you rely on it.',
    },
    faq: [
      { q: 'Is there a free Mastodon scheduler?', a: 'Buffer, Publer and Zoho Social list Mastodon and have free plans: Buffer for 3 channels with 10 scheduled posts per channel, Publer for 3 accounts with 10 scheduled posts each, Zoho Social for 1 brand with 6 channels. Mixpost Lite is free to self-host and covers Facebook Pages, X and Mastodon, and Postiz\'s self-hosted code is free to run.' },
      { q: 'Which Mastodon servers does PostDelegate post to?', a: 'PostDelegate\'s Mastodon connection posts to mastodon.social, with threads, images or a video. See the <a href="/mastodon-scheduler">Mastodon scheduler</a> page.' },
    ],
    links: [
      { href: `/${mastodon.scheduler}`, label: 'PostDelegate Mastodon scheduler' },
      { href: '/tools/mastodon-character-counter', label: 'Mastodon character counter' },
      { href: '/tools/thread-splitter', label: 'Thread splitter' },
      { href: '/guides/nostr-scheduling', label: 'How to schedule Nostr notes' },
    ],
  },
];

// Every list must be backed by its data: each tool on it exists and has the fact the rule reads,
// every tool has a "pick it if" line, a network list only names tools that list the network, and
// every page has a share card (scripts/og.mjs cannot see the pages of this dynamic route).
for (const list of BEST_LISTS) {
  const where = `best-lists.ts (${list.slug})`;
  const count = list.title.match(/(\d+) Tools/)?.[1];
  if (count && Number(count) !== bestIncluded(list).length) throw new Error(`${where}: the title says ${count} tools but the list has ${bestIncluded(list).length}`);
  if (list.facts.length < 2 || list.facts.length > 4) throw new Error(`${where}: show 2 to 4 facts per tool`);
  for (const slug of bestIncluded(list)) {
    const t = TOOLS[slug];
    if (!t) throw new Error(`${where}: no src/data/tools/${slug}.json`);
    if (!bestFact(t, list.requires)) throw new Error(`${where}: ${t.name} has no "${list.requires}" fact, which the rule reads`);
    if (list.order.by === 'trialDays' && trialDays(t.trial) === undefined) throw new Error(`${where}: ${t.name}'s trial gives no number of days`);
    if (list.network) {
      const network = NETWORKS.find((n) => n.key === list.network);
      if (!network) throw new Error(`${where}: no network "${list.network}" in networks.ts`);
      const listed = slug === 'postdelegate' ? networkStatus(network) === 'live' : t.networks?.value.includes(network.name);
      if (!listed) throw new Error(`${where}: ${t.name} does not list ${network.name}`);
    }
  }
  if (!ogCardFor(bestHref(list))) throw new Error(`${where}: ${bestHref(list)} has no share card - add it to src/data/og-cards.mjs`);
}
// A network list leaves out PostDelegate only while the network is not live.
for (const list of BEST_LISTS.filter((l) => l.network)) {
  const network = NETWORKS.find((n) => n.key === list.network)!;
  if (networkStatus(network) === 'live' && !bestIncluded(list).includes('postdelegate')) throw new Error(`best-lists.ts (${list.slug}): ${network.name} is live, so PostDelegate meets the rule`);
}
