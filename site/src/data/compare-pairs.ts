// Head-to-head pages at /compare/{a}-vs-{b} for the pairs of tools in ./tools that have no
// hand-written page in src/pages/compare. CompareTool renders the tables from the two JSON files;
// the words below may only restate facts from those files, so every claim has a linked source.
// A pair gets a hand-written page instead when it needs a worked example or its own sections.
import { PLANS, TRIAL_DAYS } from './plans';
import { NETWORKS, WAITING_NETWORKS, networkStatus } from './networks';
import { TOOLS } from './tools';
import { ogCardFor } from './og-cards.mjs';

export interface ComparePair {
  a: string; b: string; published: string;
  /** Under 60 characters, like "Buffer vs Metricool (2026): Price, Analytics, AI". */
  title: string;
  /** 140-160 characters. */
  description: string;
  h1: string;
  /** Two or three sentences: who should pick which, with the one number that decides it. */
  shortAnswer: string;
  costIntro?: string;
  faq: { q: string; a: string }[];
}

export const COMPARE_PAIRS: ComparePair[] = [
  {
    a: 'blotato', b: 'buffer', published: '2026-11-07',
    title: 'Blotato vs Buffer (2026): AI Content, Price, Free Plan',
    description: 'Blotato vs Buffer compared on AI images and video, flat versus per-channel pricing, free plans, trials, API and MCP access, and the cost at 10 and 30 accounts.',
    h1: 'Blotato vs Buffer: AI content studio or per-channel scheduler?',
    shortAnswer: 'Pick Blotato if you want AI to make the posts as well as send them: unlimited AI writing, AI images and video from monthly credits, and up to 20 accounts on one $29 plan. Pick Buffer if you mostly schedule posts you have already written, want a free plan to start on, or need approvals for a team. At 10 accounts, Blotato Starter costs $29 a month and Buffer Essentials $60 (10 × $6).',
    costIntro: 'Buffer charges for each channel, so its price rises with every account you add. Blotato sells flat plans with an account limit, so Starter costs $29 whether you connect 3 accounts or 20. Buffer Essentials is cheaper up to 4 channels (4 × $6 = $24); from 5 channels (5 × $6 = $30) up to 40 accounts, Blotato costs less.',
    faq: [
      { q: 'Is Blotato free?', a: 'No. Blotato has no free plan, only a 7-day trial that needs a card. Buffer has a free plan for 3 channels, with 10 scheduled posts per channel and one user.' },
      { q: 'Can I use the API or MCP server during the trial?', a: 'Not on Blotato: its trial covers the web app only, and creating an API key ends the trial and starts the paid plan. Buffer has API keys and an MCP server on every plan, Free included, with monthly API request limits per channel.' },
      { q: 'Which is cheaper for 30 accounts?', a: 'Blotato. Thirty accounts need its Creator plan, $97 a month for up to 40 accounts. Buffer Essentials costs $135 (10 × $6 + 15 × $4 + 5 × $3), and Team $195.' },
      { q: 'Which networks does each support?', a: 'Blotato lists 9: X, LinkedIn, Facebook, Instagram, TikTok, YouTube, Threads, Bluesky and Pinterest. Buffer lists 12, the same nine plus Google Business Profile, Mastodon and Substack.' },
    ],
  },
  {
    a: 'blotato', b: 'metricool', published: '2026-11-07',
    title: 'Blotato vs Metricool (2026): AI Content or Analytics',
    description: 'Blotato vs Metricool compared on AI content, per-account versus per-brand pricing, the free plan, the X add-on, API and MCP access, and cost at 30 accounts.',
    h1: 'Blotato vs Metricool: AI-made content or analytics and reports?',
    shortAnswer: 'Pick Blotato if you want AI to produce posts, images and video and send them to up to 20 accounts for $29 a month, with the API and MCP server on every paid plan. Pick Metricool if reporting matters more: it is an analytics-led suite with an inbox, ads data and a free plan, priced per brand. One brand on five networks, none of them X or LinkedIn, fits Metricool Free (20 posts a month) or Starter at $25, against $29 for Blotato Starter.',
    costIntro: 'The two count different things. Blotato counts connected accounts: Starter covers 20 for $29 and Creator 40 for $97. Metricool counts brands, each holding one profile per network, and charges $10 a month for each X account on top. The Metricool ranges below depend on how your accounts split into brands.',
    faq: [
      { q: 'Is Metricool free?', a: 'Yes, for one brand with 20 posts a month and 30 days of analytics, but the free plan cannot connect LinkedIn or X. Blotato has no free plan, only a 7-day trial that needs a card.' },
      { q: 'Which one has an API?', a: 'Blotato includes its social media API, with official n8n and Make nodes, on every paid plan but not during the trial. Metricool’s API is on Advanced and Custom only; Advanced starts at $67 a month for 15 brands.' },
      { q: 'Do both have an MCP server?', a: 'Yes. Metricool’s MCP is on every plan, Free included, though limits may apply. Blotato’s hosted MCP server has 35 tools and comes with every paid plan, not the trial.' },
      { q: 'Does Metricool charge extra for X?', a: 'Yes. X is a paid add-on at $10 a month per account, and the free plan does not include it. Blotato lists X among its 9 networks.' },
    ],
  },
  {
    a: 'blotato', b: 'mixpost', published: '2026-11-07',
    title: 'Blotato vs Mixpost (2026): AI Content vs Self-Hosting',
    description: 'Blotato vs Mixpost compared on AI content, hosted versus self-hosted setups, one-time licences against monthly plans, free options, API, MCP and cost.',
    h1: 'Blotato vs Mixpost: AI content in the cloud or a scheduler you host?',
    shortAnswer: 'Pick Blotato if you want AI writing, images and video alongside posting, on a hosted plan of $29 a month for up to 20 accounts. Pick Mixpost if you would rather run the scheduler yourself, from the free MIT-licensed Lite to Pro at $299 one-time, or use its monthly Cloud plans. At 30 accounts, Mixpost Cloud Business costs $79 a month and Blotato Creator $97, though Mixpost Cloud cannot post to X.',
    costIntro: 'The Mixpost figures below are its Cloud plans. Self-hosted Mixpost is priced differently: Pro is a one-time $299 licence per domain with a year of updates, and Enterprise $1,199, and you run it on your own server. Blotato is hosted and billed monthly by connected accounts.',
    faq: [
      { q: 'Can I self-host Blotato?', a: 'No self-host option appears on Blotato’s pricing page; it is hosted. Mixpost can be self-hosted as Lite, Pro or Enterprise on PHP 8.3+, MySQL, Redis and Nginx or Apache, installed with Docker or Composer.' },
      { q: 'Is Mixpost free?', a: 'Mixpost Lite is free and open source under MIT, but it only posts to Facebook Pages, X and Mastodon. Blotato has no free plan, only a 7-day trial that needs a card.' },
      { q: 'Which one makes AI images and video?', a: 'Blotato: unlimited AI writing, AI images and videos from monthly credits (1,250 on Starter), plus AI voiceovers and captions. Mixpost has an AI Assistant in Pro and Cloud, and Cloud plans include monthly AI credits.' },
      { q: 'Do both have an API and MCP server?', a: 'Yes, on paid tiers. Blotato includes both on every paid plan, but not during the trial. Mixpost includes its API, webhooks and MCP server in Pro and Enterprise, and in Cloud Momentum ($49) and up.' },
    ],
  },
  {
    a: 'blotato', b: 'post-bridge', published: '2026-11-07',
    title: 'Blotato vs Post Bridge (2026): AI, Price, Accounts',
    description: 'Blotato vs Post Bridge compared on AI content, flat plans by account count, trials and free posts, API and MCP access, networks and the cost at 30 accounts.',
    h1: 'Blotato vs Post Bridge: AI content or plain cross-posting?',
    shortAnswer: 'Pick Blotato if you want AI to write posts and make images and video; it is also the cheaper start, at $29 a month for 20 accounts against Post Bridge’s $39 for 15. Pick Post Bridge if you only need to cross-post what you already have, want to try 5 free posts first, or want up to 99 accounts on one $99 plan.',
    faq: [
      { q: 'Which is cheaper for 30 accounts?', a: 'Blotato, by $2: Creator costs $97 a month for up to 40 accounts, and Post Bridge Operator $99 for up to 99.' },
      { q: 'Do the trials need a card?', a: 'Blotato’s 7-day trial needs a card and excludes the API and MCP server; creating an API key ends the trial and starts the paid plan. Post Bridge’s 7-day trial shows $0 due today, and free users can make 5 posts.' },
      { q: 'Do both have an API and MCP?', a: 'Yes. Blotato’s API and 35-tool MCP server are on every paid plan, with official n8n and Make nodes. Post Bridge includes its API and an MCP agent connection on Marketer, its $39 plan.' },
      { q: 'Which networks do they support?', a: 'Blotato lists 9: X, LinkedIn, Facebook, Instagram, TikTok, YouTube, Threads, Bluesky and Pinterest. Post Bridge lists 10, the same nine plus Google Business.' },
    ],
  },
  {
    a: 'blotato', b: 'publer', published: '2026-11-07',
    title: 'Blotato vs Publer (2026): AI Content, Price, API',
    description: 'Blotato vs Publer compared on AI content, flat versus per-account pricing, free plans, bulk scheduling, who gets the API and MCP, and cost at 30 accounts.',
    h1: 'Blotato vs Publer: AI-made content or bulk scheduling?',
    shortAnswer: 'Pick Blotato if you want AI images, video and voiceovers made for you, and the API and MCP server on every paid plan. Pick Publer if you schedule in bulk, recycle posts or run RSS automations, or have only a few accounts: 3 cost $12 a month on Professional, or nothing on the free plan if X is not one of them. At 10 accounts, Blotato Starter costs $29 and Publer Professional $36.',
    costIntro: 'Publer charges for each social account, with every 10th free, so a small setup costs little and the bill grows with each account. Blotato’s Starter is a flat $29 for up to 20 accounts, and Creator $97 for up to 40.',
    faq: [
      { q: 'Is Publer free?', a: 'Yes. Publer Free covers 3 social accounts, not including X, with 10 scheduled posts per account and one user. Blotato has no free plan, only a 7-day trial that needs a card.' },
      { q: 'Which one has an API and MCP server?', a: 'Blotato includes both on every paid plan, with official n8n and Make nodes, though not during the trial. Publer’s API and MCP server are on Business and Enterprise, for eligible customers only.' },
      { q: 'Which is cheaper for 30 accounts?', a: 'Blotato: Creator costs $97 a month for up to 40 accounts. Publer Professional costs $108 for 30, with 3 of them free, and Business $189.' },
      { q: 'Which networks does each cover?', a: 'Blotato lists 9 social networks. Publer lists 13, adding Telegram, WordPress, Mastodon and Google Business Profile; on Publer, X is on paid plans only.' },
    ],
  },
  {
    a: 'blotato', b: 'zernio', published: '2026-11-07',
    title: 'Blotato vs Zernio (2026): AI Content App vs Social API',
    description: 'Blotato is an AI content app and Zernio a social media API for developers. Compare free tiers, flat and per-account pricing, MCP and cost at 30 accounts.',
    h1: 'Blotato vs Zernio: AI content app or developer API?',
    shortAnswer: 'Pick Blotato if you want an app where AI writes posts and makes images and video, with an API and MCP server for automation on every paid plan. Pick Zernio if you are a developer who wants one API for posting, analytics, comments, messaging and ads, with the first 2 accounts free and no card. At 10 accounts, Zernio costs $48 a month (8 × $6) against $29 for Blotato Starter.',
    costIntro: 'Zernio bills each connected account after the first 2: $6 each for accounts 3 to 10, $3 for 11 to 100 and $1 beyond. Blotato sells flat plans with AI credits included: $29 for up to 20 accounts and $97 for up to 40. Zernio is cheaper up to 6 accounts (4 × $6 = $24); from 7 to 20 accounts (5 × $6 = $30 at 7) Blotato Starter costs less. From 21 to 26 accounts Zernio is cheaper again, against Creator’s $97.',
    faq: [
      { q: 'Is Zernio free?', a: 'The first 2 connected accounts are free, with no credit card. Blotato has no free plan; its 7-day trial needs a card and does not include the API or MCP server.' },
      { q: 'Do both have an MCP server?', a: 'Yes. Blotato’s hosted MCP server has 35 tools and comes with every paid plan, not the trial. Zernio’s MCP server is documented at docs.zernio.com/mcp.' },
      { q: 'Which is cheaper for 30 accounts?', a: 'Blotato: Creator costs $97 a month for up to 40 accounts. Zernio costs $108 for 30 (2 free, 8 × $6 and 20 × $3).' },
      { q: 'Which networks can each reach?', a: 'Blotato lists 9 social networks. Zernio covers social, messaging, blog and ads platforms through one API, including Reddit, which is not on Blotato’s list.' },
    ],
  },
  {
    a: 'buffer', b: 'metricool', published: '2026-11-07',
    title: 'Buffer vs Metricool (2026): Price, Analytics, API',
    description: 'Buffer vs Metricool compared on free plans, per-channel versus per-brand pricing, the X add-on, analytics, API and MCP, approvals and cost at 10 accounts.',
    h1: 'Buffer vs Metricool: per-channel scheduling or analytics per brand?',
    shortAnswer: 'Pick Buffer if you mainly schedule posts and want simple per-channel pricing, with API keys and an MCP server on every plan, Free included. Pick Metricool if analytics, an inbox and ads data matter, or you manage several brands, since it charges per brand rather than per account. One brand on five networks, none of them X or LinkedIn, fits Metricool Free (20 posts a month) or Starter at $25, against $30 on Buffer Essentials (5 × $6).',
    costIntro: 'Buffer charges for every channel. Metricool charges for brands, each holding one profile per network, plus $10 a month for each X account. The same 10 or 30 accounts can cost very different amounts on Metricool depending on how they split into brands, which is why its figures below are ranges.',
    faq: [
      { q: 'Which free plan is better?', a: 'They limit different things. Buffer Free covers 3 channels with 10 scheduled posts per channel and one user. Metricool Free covers one brand with 20 posts a month and 30 days of analytics, but no LinkedIn or X.' },
      { q: 'Do Buffer and Metricool have an API?', a: 'Buffer gives API keys on every plan, with monthly request limits per channel. Metricool’s API is on Advanced and Custom only, from $67 a month. Both have an MCP server on every plan, Free included; Metricool says limits may apply.' },
      { q: 'Which is cheaper for 10 accounts?', a: 'Metricool, unless several of the accounts are on X: Starter costs $25 for up to 5 brands or $45 for up to 10, against $60 on Buffer Essentials (10 × $6). Metricool adds $10 a month for each X account.' },
      { q: 'Which has post approvals?', a: 'Both, on their higher plans. Buffer Team has unlimited team members and approval workflows at $12 per channel for the first 10. Metricool has team and client management, roles and post approvals on Advanced, from $67 for 15 brands.' },
    ],
  },
  {
    a: 'buffer', b: 'mixpost', published: '2026-11-07',
    title: 'Buffer vs Mixpost (2026): Hosted vs Self-Hosted, Price',
    description: 'Buffer vs Mixpost compared on hosted versus self-hosted setups, per-channel pricing against one-time licences and Cloud plans, X support, teams, API and MCP.',
    h1: 'Buffer vs Mixpost: pay per channel or run your own scheduler?',
    shortAnswer: 'Pick Buffer if you want a hosted scheduler with a free plan for 3 channels and an API and MCP server on every plan. Pick Mixpost if you want to self-host, from the free MIT-licensed Lite to Pro at $299 one-time with unlimited users, or want flat Cloud plans that cost less than Buffer from 10 channels ($49 vs $60). At 30 accounts, Mixpost Cloud Business costs $79 a month against $135 on Buffer Essentials, though Mixpost Cloud cannot post to X.',
    costIntro: 'Buffer bills each channel monthly. The Mixpost figures below are its Cloud plans; self-hosted Pro is instead a one-time $299 licence per domain with a year of updates, and Enterprise $1,199, which you run on your own server.',
    faq: [
      { q: 'Can I self-host Buffer?', a: 'Buffer is sold as a hosted service. Mixpost can be self-hosted as Lite, Pro or Enterprise on PHP 8.3+, MySQL, Redis and Nginx or Apache, installed with Docker or Composer.' },
      { q: 'Is Mixpost free?', a: 'Mixpost Lite is free and open source, but only posts to Facebook Pages, X and Mastodon. Buffer’s free plan covers 3 channels with 10 scheduled posts per channel and one user.' },
      { q: 'Does Mixpost Cloud post to X?', a: 'No. Mixpost Cloud lists 11 networks, the same as Pro and Enterprise without X. Buffer lists X among its 12 networks.' },
      { q: 'How many team members do I get?', a: 'Mixpost Pro has unlimited users; Cloud has 1 member on Spark and Momentum, 5 on Business and unlimited on Agency. Buffer has one user on Free and Essentials, and unlimited members with approvals on Team.' },
    ],
  },
  {
    a: 'buffer', b: 'post-bridge', published: '2026-11-07',
    title: 'Buffer vs Post Bridge (2026): Per Channel vs Flat Price',
    description: 'Buffer vs Post Bridge compared on per-channel versus flat pricing, free plans, API and MCP access, team members and the monthly cost at 3, 10 and 30 accounts.',
    h1: 'Buffer vs Post Bridge: pay per channel or one flat plan?',
    shortAnswer: 'Pick Buffer if you have a few channels, want a free plan, or need approvals and unlimited team members on Team. Pick Post Bridge if you cross-post to many accounts on your own and want one flat price: $39 a month covers 15 accounts, with the API and MCP included. At 10 accounts, Post Bridge costs $39 and Buffer Essentials $60 (10 × $6).',
    costIntro: 'Buffer’s price grows with each channel, while Post Bridge Marketer is $39 for anything up to 15 accounts. Buffer Essentials is cheaper up to 6 channels (6 × $6 = $36); from 7 to 15 channels (7 × $6 = $42 at 7) Post Bridge Marketer costs less. From 16 to 19 channels Buffer is cheaper again, against Operator’s $99, and from 20 Post Bridge is cheaper.',
    faq: [
      { q: 'Is Buffer or Post Bridge free?', a: 'Buffer has a free plan: 3 channels, 10 scheduled posts per channel and one user. Post Bridge lets free users make 5 posts, and has a 7-day trial with $0 due today.' },
      { q: 'Which is cheaper for 30 accounts?', a: 'Post Bridge: Operator costs $99 a month for up to 99 accounts. Buffer Essentials costs $135 for 30 (10 × $6 + 15 × $4 + 5 × $3), and Team $195.' },
      { q: 'Do both have an API and MCP?', a: 'Yes. Buffer has API keys and an MCP server on every plan, Free included, with monthly API request limits per channel. Post Bridge includes its API and an MCP agent connection on Marketer.' },
      { q: 'Can I add team members?', a: 'Buffer Team adds unlimited members and approval workflows; Free and Essentials have one user. Post Bridge has team members on Operator only, at $99 a month.' },
    ],
  },
  {
    a: 'buffer', b: 'zernio', published: '2026-11-07',
    title: 'Buffer vs Zernio (2026): Scheduler App vs Social API',
    description: 'Buffer is a scheduler and Zernio a social media API for developers. Compare free plans, per-channel and per-account pricing, API, MCP and cost at 30 accounts.',
    h1: 'Buffer vs Zernio: a scheduler for people or an API for developers?',
    shortAnswer: 'Pick Buffer if you and your team want an app to plan and schedule posts, with a free plan, an AI Assistant and approvals on Team. Pick Zernio if you are building posting, analytics, comments or messaging into your own software through one API, with the first 2 accounts free. At 10 accounts, Zernio costs $48 a month (8 × $6) and Buffer Essentials $60 (10 × $6).',
    faq: [
      { q: 'Is Zernio a scheduler like Buffer?', a: 'Zernio describes itself as a social media API for developers, covering posting, analytics, comments, messaging, ads and webhooks. Buffer is a hosted scheduler with an AI Assistant on every plan.' },
      { q: 'Which one is free?', a: 'Both have a free tier. Buffer Free covers 3 channels with 10 scheduled posts per channel and one user. Zernio’s first 2 connected accounts are free, with no credit card.' },
      { q: 'Does Buffer have an API and MCP server?', a: 'Yes. Buffer has API keys on every plan, with monthly request limits per channel, and an MCP server on every plan including Free. Zernio also has an MCP server, documented at docs.zernio.com/mcp.' },
      { q: 'Which is cheaper for 30 accounts?', a: 'Zernio, at $108 a month (2 free, 8 × $6 and 20 × $3), against $135 on Buffer Essentials (10 × $6 + 15 × $4 + 5 × $3).' },
    ],
  },
  {
    a: 'metricool', b: 'mixpost', published: '2026-11-07',
    title: 'Metricool vs Mixpost (2026): Analytics vs Self-Hosting',
    description: 'Metricool vs Mixpost compared on analytics, per-brand pricing against one-time licences and Cloud plans, self-hosting, free plans, X support, API and MCP.',
    h1: 'Metricool vs Mixpost: analytics suite or self-hosted scheduler?',
    shortAnswer: 'Pick Metricool if analytics, reports, an inbox and ads data matter and a hosted plan priced per brand suits you, from $25 a month for up to 5 brands. Pick Mixpost if you want to own the scheduler: self-host the free Lite or a one-time $299 Pro licence, or use Mixpost Cloud from $29 a month. Metricool also has a free hosted plan and MCP on every plan; Mixpost’s MCP starts at Pro or Cloud Momentum.',
    costIntro: 'Metricool charges per brand, each holding one profile per network, with $10 a month per X account on top, so its figures below are ranges. The Mixpost figures are Cloud plans; self-hosted Pro is a one-time $299 licence per domain and Enterprise $1,199.',
    faq: [
      { q: 'Can I self-host Metricool?', a: 'No self-host option appears on Metricool’s pricing page. Mixpost can be self-hosted as Lite (free, MIT), Pro or Enterprise on PHP 8.3+, MySQL, Redis and Nginx or Apache.' },
      { q: 'Which one has a free plan?', a: 'Both, in different ways. Metricool Free is hosted: 1 brand, 20 posts a month and 30 days of analytics, without LinkedIn or X. Mixpost Lite is free to self-host but posts only to Facebook Pages, X and Mastodon.' },
      { q: 'Which has an API and MCP server?', a: 'Metricool’s MCP is on every plan, Free included, with limits that may apply, but its API is on Advanced and Custom only. Mixpost includes its API, webhooks and MCP in Pro and Enterprise, and in Cloud Momentum ($49) and up.' },
      { q: 'Which one supports X?', a: 'Metricool sells X as a paid add-on at $10 a month per account. Mixpost Lite, Pro and Enterprise include X, but Mixpost Cloud does not.' },
    ],
  },
  {
    a: 'metricool', b: 'post-bridge', published: '2026-11-07',
    title: 'Metricool vs Post Bridge (2026): Analytics or Cross-Posting',
    description: 'Metricool vs Post Bridge compared on analytics, per-brand versus flat per-account pricing, free plans, the X add-on, API and MCP access, and team features.',
    h1: 'Metricool vs Post Bridge: analytics per brand or simple cross-posting?',
    shortAnswer: 'Pick Metricool if you report on results: it is analytics-led, with an inbox, ads data and a free plan, and charges per brand. Pick Post Bridge if you are one person cross-posting to many accounts and want the API and MCP on its $39 plan for 15 accounts. One brand on five networks, none of them X or LinkedIn, fits Metricool Free (20 posts a month) or Starter at $25, against $39 on Post Bridge Marketer.',
    costIntro: 'Post Bridge counts connected accounts: $39 for up to 15 and $99 for up to 99. Metricool counts brands, each holding one profile per network, and adds $10 a month for each X account, so its figures below are ranges that depend on how your accounts split into brands.',
    faq: [
      { q: 'Is Metricool or Post Bridge free?', a: 'Metricool has a free plan for one brand, with 20 posts a month and 30 days of analytics, but no LinkedIn or X. Post Bridge lets free users make 5 posts, and has a 7-day trial with $0 due today.' },
      { q: 'Which one has an API?', a: 'Post Bridge includes its API and an MCP agent connection on Marketer, its entry plan. Metricool puts its MCP on every plan, Free included, but its API only on Advanced and Custom, from $67 a month.' },
      { q: 'Does Metricool charge extra for X?', a: 'Yes. X is a paid add-on at $10 a month per account, and it is not on the free plan.' },
      { q: 'Can a team use it?', a: 'Post Bridge has team members on Operator only, at $99 a month. Metricool has team and client management, roles and post approvals on Advanced, from $67 a month for 15 brands.' },
    ],
  },
  {
    a: 'metricool', b: 'postiz', published: '2026-11-07',
    title: 'Metricool vs Postiz (2026): Analytics, Open Source, Price',
    description: 'Metricool vs Postiz compared on analytics, per-brand versus channel-bundle pricing, free plans, self-hosting, API and MCP access, teams and cost at 30 channels.',
    h1: 'Metricool vs Postiz: analytics suite or open-source scheduler?',
    shortAnswer: 'Pick Metricool if analytics, reports, an inbox and ads data come first, or you want a free plan; it charges per brand. Pick Postiz if you want a scheduler with the API, CLI, webhooks and MCP on every plan, 30 listed networks and the option to self-host its AGPL-3.0 code. At 30 channels, Postiz Pro costs $49 a month; Metricool ranges from $25 to $210 depending on how those accounts split into brands.',
    costIntro: 'Postiz sells channel bundles: $29 for 5, $39 for 10, $49 for 30 and $99 for 100. Metricool charges per brand, each holding one profile per network, plus $10 a month for each X account. Its figures below are ranges because the same accounts can make up very different numbers of brands.',
    faq: [
      { q: 'Is Metricool or Postiz free?', a: 'Metricool has a free hosted plan: 1 brand, 20 posts a month and 30 days of analytics, without LinkedIn or X. Postiz has no free cloud plan, but its self-hosted code is free to run.' },
      { q: 'Can I self-host either one?', a: 'Postiz, yes: it runs with Docker Compose alongside PostgreSQL, Redis and Temporal, and self-hosters get each network’s developer app approved themselves. No self-host option appears on Metricool’s pricing page.' },
      { q: 'Which one has an API?', a: 'Postiz includes a public API, CLI and webhooks on every plan. Metricool’s API is on Advanced and Custom only. Both have an MCP server on every plan; Metricool’s includes Free, with limits that may apply.' },
      { q: 'Which suits a team?', a: 'Postiz includes unlimited team members on Team ($39), Pro and Ultimate, but none on Standard. Metricool keeps team and client management, roles and post approvals on Advanced, from $67 a month.' },
    ],
  },
  {
    a: 'metricool', b: 'zernio', published: '2026-11-07',
    title: 'Metricool vs Zernio (2026): Analytics App vs Social API',
    description: 'Metricool is an analytics suite and Zernio a social media API for developers. Compare free tiers, per-brand and per-account pricing, API access, MCP and ads.',
    h1: 'Metricool vs Zernio: analytics dashboard or developer API?',
    shortAnswer: 'Pick Metricool if you want to plan posts and read reports in an app: it is analytics-led, with an inbox, ads data and a free plan. Pick Zernio if you are writing code: one API for posting, analytics, comments, messaging and ads, billed per account with the first 2 free. Metricool’s API needs Advanced, from $67 a month; on Zernio the API is the product.',
    costIntro: 'Zernio bills each connected account after the first 2: $6 each for accounts 3 to 10 and $3 for 11 to 100. Metricool bills per brand, each holding one profile per network, with $10 a month per X account on top, so its figures below are ranges.',
    faq: [
      { q: 'Is Metricool or Zernio free?', a: 'Both have a free tier. Metricool Free covers one brand with 20 posts a month and 30 days of analytics, without LinkedIn or X. Zernio’s first 2 connected accounts are free, with no credit card.' },
      { q: 'Does Metricool have an API?', a: 'Yes, on Advanced and Custom only, though its MCP server is on every plan, Free included, with limits that may apply. Zernio’s product is the API itself, and its MCP server is documented at docs.zernio.com/mcp.' },
      { q: 'Which is cheaper for 10 accounts?', a: 'Metricool, unless several of the accounts are on X: Starter costs $25 for up to 5 brands or $45 for up to 10. Zernio costs $48 for 10 accounts (2 free + 8 × $6). Metricool adds $10 a month for each X account.' },
      { q: 'Which one covers ads?', a: 'Both. Metricool connects Facebook, Google and TikTok Ads alongside its social networks. Zernio’s API covers ads as well as posting, analytics, comments and messaging.' },
    ],
  },
  {
    a: 'mixpost', b: 'post-bridge', published: '2026-11-07',
    title: 'Mixpost vs Post Bridge (2026): Self-Hosted vs Hosted',
    description: 'Mixpost vs Post Bridge compared on self-hosting, one-time licences against flat monthly plans, X support, API and MCP on entry plans, and cost at 30 accounts.',
    h1: 'Mixpost vs Post Bridge: self-host a scheduler or pay for a hosted one?',
    shortAnswer: 'Pick Mixpost if you want to self-host, from the free Lite to a one-time $299 Pro licence with unlimited users, or a Cloud plan that grows to 180 channels. Pick Post Bridge if you are one person who wants hosted cross-posting with the API and MCP on its entry plan. At 10 accounts, Post Bridge Marketer costs $39 a month and Mixpost Cloud Momentum $49.',
    costIntro: 'The Mixpost figures below are its Cloud plans. Self-hosted Pro is a one-time $299 licence per domain with a year of updates, and Enterprise $1,199, run on your own server. Post Bridge is hosted and billed monthly by connected accounts.',
    faq: [
      { q: 'Can I self-host Post Bridge?', a: 'No self-host option appears on Post Bridge’s pricing page. Mixpost can be self-hosted as Lite, Pro or Enterprise on PHP 8.3+, MySQL, Redis and Nginx or Apache, installed with Docker or Composer.' },
      { q: 'Which is cheaper for 30 accounts?', a: 'Mixpost Cloud Business, by $20: $79 a month for 48 channels, though Mixpost Cloud cannot post to X. Post Bridge Operator costs $99 for 99 accounts, then $1 for each one above.' },
      { q: 'Does Mixpost Cloud post to X?', a: 'No. Mixpost Cloud lists 11 networks without X; self-hosted Lite, Pro and Enterprise include it. Post Bridge lists X among its 10 networks.' },
      { q: 'Which has an API and MCP on its cheapest plan?', a: 'Post Bridge includes both on Marketer, its $39 entry plan. Mixpost has them in Pro and Enterprise and in Cloud Momentum ($49) and up, so not on Cloud Spark ($29).' },
    ],
  },
  {
    a: 'mixpost', b: 'publer', published: '2026-11-07',
    title: 'Mixpost vs Publer (2026): Self-Hosted vs Bulk Scheduling',
    description: 'Mixpost vs Publer compared on self-hosting, one-time licences and Cloud plans against per-account pricing, free options, API and MCP access, networks and cost.',
    h1: 'Mixpost vs Publer: own your scheduler or rent a bulk-posting one?',
    shortAnswer: 'Pick Mixpost if you want to self-host, with Pro at $299 one-time including unlimited users and the API and MCP, or flat Cloud plans. Pick Publer if you want hosted bulk scheduling, RSS automation and post recycling, priced per account, with a free plan for 3 accounts. Publer is cheaper at 10 accounts ($36 vs $49 on Mixpost Cloud) and Mixpost at 30 ($79 vs $108), though Mixpost Cloud cannot post to X.',
    costIntro: 'Publer charges for each social account, with every 10th free. The Mixpost figures below are Cloud plans; self-hosted Pro is a one-time $299 licence per domain and Enterprise $1,199, run on your own server.',
    faq: [
      { q: 'Is Publer or Mixpost free?', a: 'Publer Free covers 3 social accounts, not including X, with 10 scheduled posts per account and one user. Mixpost Lite is free to self-host and posts to Facebook Pages, X and Mastodon only.' },
      { q: 'Which has an API and MCP server?', a: 'Mixpost includes its API, webhooks and MCP in Pro and Enterprise, and in Cloud Momentum ($49) and up. Publer puts its API and MCP server on Business and Enterprise, for eligible customers only.' },
      { q: 'Can I self-host Publer?', a: 'No self-host option appears on Publer’s pricing page. Mixpost can be self-hosted on PHP 8.3+, MySQL, Redis and Nginx or Apache, installed with Docker or Composer.' },
      { q: 'Which networks does each cover?', a: 'Publer lists 13, including Telegram and WordPress, with X on paid plans only. Mixpost Pro and Enterprise list 12, including Pixelfed; Mixpost Cloud has the same list without X.' },
    ],
  },
  {
    a: 'mixpost', b: 'zernio', published: '2026-11-07',
    title: 'Mixpost vs Zernio (2026): Self-Hosted App vs Social API',
    description: 'Mixpost is a self-hostable scheduler and Zernio a social media API for developers. Compare free options, licences, per-account pricing, MCP and 30-account cost.',
    h1: 'Mixpost vs Zernio: self-hosted scheduler or hosted developer API?',
    shortAnswer: 'Pick Mixpost if your team needs a scheduling app you can self-host, from the free Lite to a one-time $299 Pro licence, or run on Mixpost Cloud. Pick Zernio if you are building on an API for posting, analytics, comments, messaging and ads, with the first 2 accounts free and no card. At 10 accounts they cost almost the same: $48 a month on Zernio (8 × $6) and $49 on Mixpost Cloud Momentum.',
    costIntro: 'Zernio bills each account after the first 2 on a sliding scale: $6 each up to 10, then $3 from the 11th. The Mixpost figures below are Cloud plans; self-hosted Pro is instead a one-time $299 licence per domain with a year of updates.',
    faq: [
      { q: 'Can I self-host Zernio?', a: 'Zernio is a hosted API. Mixpost can be self-hosted as Lite, Pro or Enterprise on PHP 8.3+, MySQL, Redis and Nginx or Apache.' },
      { q: 'Which one is free?', a: 'Zernio’s first 2 connected accounts are free, with no credit card. Mixpost Lite is free and open source under MIT, but posts only to Facebook Pages, X and Mastodon.' },
      { q: 'Do both have an MCP server?', a: 'Yes. Mixpost includes an MCP server in Pro and Enterprise, and in Cloud Momentum and up. Zernio’s MCP server is documented at docs.zernio.com/mcp.' },
      { q: 'Which is cheaper for 30 accounts?', a: 'Mixpost Cloud Business, at $79 a month for 48 channels, though Mixpost Cloud cannot post to X. Zernio costs $108 for 30 (2 free, 8 × $6 and 20 × $3).' },
    ],
  },
  {
    a: 'post-bridge', b: 'publer', published: '2026-11-07',
    title: 'Post Bridge vs Publer (2026): Flat Price vs Per Account',
    description: 'Post Bridge vs Publer compared on flat versus per-account pricing, free posts and free plans, API and MCP access, team members and cost at 10 and 30 accounts.',
    h1: 'Post Bridge vs Publer: one flat plan or pay per account?',
    shortAnswer: 'Pick Post Bridge if you want the API and MCP on its entry plan and one flat price: $39 a month for up to 15 accounts. Pick Publer if you have only a few accounts, or want bulk scheduling, RSS automation and post recycling: 3 accounts cost $12 a month on Professional. At 10 accounts the two are close, $39 vs $36.',
    costIntro: 'Publer charges for each social account, with every 10th free, so it is cheap for a few accounts and rises steadily. Post Bridge charges $39 for anything up to 15 accounts and $99 for up to 99.',
    faq: [
      { q: 'Is Publer or Post Bridge free?', a: 'Publer has a free plan: 3 social accounts, not including X, with 10 scheduled posts per account and one user. Post Bridge lets free users make 5 posts, and has a 7-day trial with $0 due today.' },
      { q: 'Which one has an API?', a: 'Post Bridge includes its API and an MCP agent connection on Marketer ($39). Publer has an API and MCP server on Business and Enterprise, for eligible customers only.' },
      { q: 'Which is cheaper for 30 accounts?', a: 'Post Bridge: Operator costs $99 a month for up to 99 accounts. Publer Professional costs $108 for 30, with 3 of them free, and Business $189.' },
      { q: 'Can I add team members?', a: 'Publer adds extra members on paid plans, $2 each on Professional and $3 on Business, with approval workflows on Business. Post Bridge has team members on Operator only.' },
    ],
  },
  {
    a: 'post-bridge', b: 'zernio', published: '2026-11-07',
    title: 'Post Bridge vs Zernio (2026): Scheduler App vs Social API',
    description: 'Post Bridge is a cross-posting app and Zernio a social media API for developers. Compare free tiers, flat and per-account pricing, MCP and cost at 10 accounts.',
    h1: 'Post Bridge vs Zernio: cross-posting app or developer API?',
    shortAnswer: 'Pick Post Bridge if you are one person who wants an app to cross-post to your own accounts, with the API and MCP included on its $39 plan for 15 accounts. Pick Zernio if you are building software on one API for posting, analytics, comments, messaging and ads, with the first 2 accounts free. At 30 accounts, Post Bridge Operator costs $99 a month and Zernio $108.',
    costIntro: 'Zernio bills each account after the first 2, $6 each up to 10 and $3 from 11 to 100. Post Bridge sells flat plans, $39 for up to 15 accounts and $99 for up to 99. Zernio is cheaper up to 8 accounts (6 × $6 = $36); from 9 to 15 accounts (7 × $6 = $42 at 9) Post Bridge Marketer costs less. From 16 to 26 accounts Zernio is cheaper again, against Operator’s $99, and from 27 Post Bridge is cheaper.',
    faq: [
      { q: 'Is Zernio free?', a: 'Zernio’s first 2 connected accounts are free, with no credit card. Post Bridge lets free users make 5 posts, and has a 7-day trial with $0 due today.' },
      { q: 'Do both have an MCP server?', a: 'Yes. Post Bridge includes an MCP agent connection and its API on Marketer. Zernio’s MCP server is documented at docs.zernio.com/mcp.' },
      { q: 'Which is cheaper for 10 accounts?', a: 'Post Bridge: Marketer costs $39 a month for up to 15 accounts. Zernio costs $48 for 10 (2 free + 8 × $6).' },
      { q: 'Which networks can each reach?', a: 'Post Bridge lists 10, including Google Business. Zernio covers social, messaging, blog and ads platforms through one API, including Reddit.' },
    ],
  },
  {
    a: 'postiz', b: 'publer', published: '2026-11-07',
    title: 'Postiz vs Publer (2026): Open Source, API, Price',
    description: 'Postiz vs Publer compared on open source and self-hosting, channel bundles versus per-account pricing, free plans, API and MCP, teams and cost at 30 accounts.',
    h1: 'Postiz vs Publer: open-source scheduler or bulk-posting specialist?',
    shortAnswer: 'Pick Postiz if you want the API, CLI, webhooks and MCP on every plan, 30 listed networks, or the option to self-host its AGPL-3.0 code. Pick Publer if you post in bulk, run RSS automations or recycle posts, or have only a few accounts and want its free plan. At 30 accounts, Postiz Pro costs $49 a month and Publer Professional $108.',
    costIntro: 'Publer charges per social account, with every 10th free; Postiz sells channel bundles of 5, 10, 30 and 100. Publer is cheaper at 10 accounts ($36 vs $39); at 30, Postiz costs less than half as much ($49 vs $108).',
    faq: [
      { q: 'Is Postiz or Publer free?', a: 'Publer has a free plan: 3 social accounts, not including X, with 10 scheduled posts per account and one user. Postiz has no free cloud plan, but its self-hosted code is free to run.' },
      { q: 'Can I self-host Postiz or Publer?', a: 'Postiz, yes: it runs with Docker Compose alongside PostgreSQL, Redis and Temporal, and self-hosters get each network’s developer app approved themselves. No self-host option appears on Publer’s pricing page.' },
      { q: 'Which has an API and MCP server?', a: 'Postiz includes a public API, CLI, webhooks and a hosted MCP server on every plan. Publer puts its API and MCP server on Business and Enterprise, for eligible customers only.' },
      { q: 'How do team members work?', a: 'Postiz includes unlimited team members on Team, Pro and Ultimate, and none on Standard. Publer adds extra members on paid plans, $2 each on Professional and $3 on Business, with approval workflows on Business.' },
    ],
  },
  {
    a: 'publer', b: 'zernio', published: '2026-11-07',
    title: 'Publer vs Zernio (2026): Scheduler App vs Social API',
    description: 'Publer is a scheduler with bulk tools and Zernio a social media API for developers. Compare free tiers, per-account pricing, API, MCP and cost at 10 accounts.',
    h1: 'Publer vs Zernio: bulk scheduling app or developer API?',
    shortAnswer: 'Pick Publer if you want an app for bulk scheduling, RSS automation and post recycling, with a free plan for 3 accounts. Pick Zernio if you are building software on one API for posting, analytics, comments, messaging and ads, with the first 2 accounts free and no card. At 30 accounts both cost $108 a month, on Publer Professional and on Zernio.',
    faq: [
      { q: 'Does Publer have an API?', a: 'Only on Business and Enterprise, for eligible customers, along with its MCP server. Zernio’s product is the API itself: posting, analytics, comments, messaging, ads and webhooks, with an MCP server documented at docs.zernio.com/mcp.' },
      { q: 'Which one is free?', a: 'Publer Free covers 3 social accounts, not including X, with 10 scheduled posts per account and one user. Zernio’s first 2 connected accounts are free, with no credit card.' },
      { q: 'Which is cheaper for 10 accounts?', a: 'Publer Professional, at $36 a month with the 10th account free. Zernio costs $48 (2 free + 8 × $6).' },
      { q: 'Which networks can each reach?', a: 'Publer lists 13, including Telegram and WordPress, with X on paid plans only. Zernio covers social, messaging, blog and ads platforms through one API, including Reddit.' },
    ],
  },
];

export const pairHref = (pair: { a: string; b: string }) => `/compare/${pair.a}-vs-${pair.b}`;

// The PostDelegate box under every generated pair. Prices come from plans.ts.
const [starter, team] = PLANS;
const list = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names.at(-1)}` : names[0] ?? '');
// X is the one network readers expect that PostDelegate does not offer at all.
const x = NETWORKS.find((n) => n.key === 'x');
const unavailable = x && networkStatus(x) === 'unavailable' ? [x.name] : [];
export const PAIR_FIT = `PostDelegate is a lighter alternative to both: a scheduler with flat plans from $${starter.monthly}, team members from $${team.monthly} and the API and MCP server on every plan, with AI on your own assistant or key. It cannot reach ${list(WAITING_NETWORKS.map((n) => n.name))} yet, because those are waiting on platform approval${unavailable.length ? `, and ${list(unavailable)} is not available` : ''}. Every plan starts with a ${TRIAL_DAYS}-day trial and no card.`;

// Every generated pair needs both tools' data and a share card, and must not shadow a hand-written page.
const handWritten = Object.keys(import.meta.glob('../pages/compare/*.astro')).map((path) => path.split('/').pop()!.replace('.astro', ''));
for (const pair of COMPARE_PAIRS) {
  const slug = `${pair.a}-vs-${pair.b}`;
  if (!TOOLS[pair.a] || !TOOLS[pair.b]) throw new Error(`compare-pairs.ts: ${slug} needs src/data/tools/${pair.a}.json and ${pair.b}.json`);
  if (handWritten.includes(slug) || handWritten.includes(`${pair.b}-vs-${pair.a}`)) throw new Error(`compare-pairs.ts: ${slug} already has a hand-written page`);
  if (!ogCardFor(pairHref(pair))) throw new Error(`compare-pairs.ts: ${pairHref(pair)} has no share card - add it to src/data/og-cards.mjs`);
}
