// "Post to <network> from <assistant>" pages: one per assistant and live network, at
// /<assistant>/<network>. English only, like the guides. The setup steps and snippets are the
// ones in /docs/mcp/claude, /docs/mcp/chatgpt and /docs/mcp/clients; the network facts come from
// schedulers.ts and networks.ts. Only the example asks below are written for these pages.
// Each assistant has its own route folder (src/pages/<slug>/[network].astro) rather than one
// [agent]/[network] route, which would compete with [lang]/[scheduler] on route priority.
import { AVAILABLE_NETWORKS, type Network } from './networks';

export interface Agent {
  slug: string; name: string;
  /** chat: an app you talk to; code: a coding agent that can read your project's files. */
  kind: 'chat' | 'code';
  /** One sentence on where you use it, for the intro. */
  where: string;
  setup: { steps: string[]; code: string; codeLabel: string; after?: string };
  /** The agent file that teaches it the posting rules, from /docs/mcp/agent-files. */
  teach: { text: string; href: string };
  docs: string;
}

const OAUTH_URL = 'https://app.postdelegate.com/mcp-oauth-dynamic';

export const AGENTS: Agent[] = [
  {
    slug: 'claude', name: 'Claude', kind: 'chat', where: 'in the Claude app on the web, desktop or phone',
    setup: {
      steps: ['In Claude open Settings, then Connectors, then Add custom connector.', 'Name it PostDelegate and paste the server URL below.', 'Choose Add, then Connect, sign in to PostDelegate and click Authorize.'],
      code: OAUTH_URL, codeLabel: 'Server URL',
      after: 'Custom connectors depend on your Claude plan and, on team plans, on what your organisation allows.',
    },
    teach: { text: 'Add the PostDelegate skill to Claude so it knows the posting rules before it writes: download the skill zip and upload it under Customize, then Skills, with code execution turned on.', href: '/docs/mcp/agent-files#claude-ai' },
    docs: '/docs/mcp/claude',
  },
  {
    slug: 'chatgpt', name: 'ChatGPT', kind: 'chat', where: 'in a ChatGPT chat',
    setup: {
      steps: ['In ChatGPT open Settings, then Connectors, then Create. If you cannot create one, look for a developer mode switch under advanced settings, or ask your workspace admin.', 'Name it PostDelegate, paste the server URL below and choose OAuth.', 'Choose Create, then Connect, sign in to PostDelegate and click Authorize.'],
      code: OAUTH_URL, codeLabel: 'Server URL',
      after: 'Custom connectors depend on your ChatGPT plan and workspace settings, which OpenAI controls.',
    },
    teach: { text: 'Paste the PostDelegate instructions into a custom GPT or a Project, with the connector enabled there, so ChatGPT follows the posting rules in every chat.', href: '/docs/mcp/agent-files#chatgpt' },
    docs: '/docs/mcp/chatgpt',
  },
  {
    slug: 'claude-code', name: 'Claude Code', kind: 'code', where: 'from your terminal, next to your code',
    setup: {
      steps: ['Add the PostDelegate MCP server with the command below.', 'Run /mcp inside Claude Code and authenticate the postdelegate server. Your browser opens to sign in.'],
      code: `claude mcp add postdelegate --transport http "${OAUTH_URL}"`, codeLabel: 'Terminal',
    },
    teach: { text: 'Save the PostDelegate skill to ~/.claude/skills/postdelegate/SKILL.md. Call it with /postdelegate, or just ask for a post and Claude Code loads it.', href: '/docs/mcp/agent-files#claude-code' },
    docs: '/docs/mcp/clients#claude-code',
  },
  {
    slug: 'codex', name: 'Codex', kind: 'code', where: 'from the Codex CLI or IDE extension',
    setup: {
      steps: ['Add the server to ~/.codex/config.toml as below.', 'Run codex mcp login postdelegate and sign in in your browser.'],
      code: `[mcp_servers.postdelegate]\nurl = "${OAUTH_URL}"`, codeLabel: '~/.codex/config.toml',
    },
    teach: { text: 'Add PostDelegate’s AGENTS.md to your repository, so Codex knows the MCP tools, the REST API and the safety rules when it works there.', href: '/docs/mcp/agent-files#agents-md' },
    docs: '/docs/mcp/clients#codex',
  },
  {
    slug: 'cursor', name: 'Cursor', kind: 'code', where: 'from Cursor’s agent, inside your editor',
    setup: {
      steps: ['Add the server to .cursor/mcp.json in your project, as below.', 'Sign in with PostDelegate when Cursor prompts you.'],
      code: `{\n  "mcpServers": {\n    "postdelegate": {\n      "url": "${OAUTH_URL}"\n    }\n  }\n}`, codeLabel: '.cursor/mcp.json',
    },
    teach: { text: 'Save the PostDelegate rule to .cursor/rules/postdelegate.mdc. Cursor applies it whenever a request is about PostDelegate.', href: '/docs/mcp/agent-files#cursor' },
    docs: '/docs/mcp/clients#cursor',
  },
  {
    slug: 'gemini-cli', name: 'Gemini CLI', kind: 'code', where: 'from Google’s Gemini CLI in your terminal',
    setup: {
      steps: ['Add the server to ~/.gemini/settings.json as below.', 'Sign in with PostDelegate when Gemini CLI prompts you.'],
      code: `{\n  "mcpServers": {\n    "postdelegate": {\n      "url": "${OAUTH_URL}"\n    }\n  }\n}`, codeLabel: '~/.gemini/settings.json',
    },
    teach: { text: 'Save PostDelegate’s AGENTS.md in your repository and point to it from your GEMINI.md, so Gemini CLI follows the posting rules there.', href: '/docs/mcp/agent-files#agents-md' },
    docs: '/docs/mcp/clients#gemini-cli',
  },
];

// Three asks per live network. The first two suit any assistant; the third reads a file in the
// project, so only coding agents get it. Every setting named here is one the network supports.
export const NETWORK_ASKS: Record<string, [string, string, string]> = {
  youtube: [
    'Draft a YouTube post for the video I uploaded to my media library today: title “How we cut our build time in half”, unlisted, not made for kids. Do not schedule it yet.',
    'What is scheduled on my YouTube channel this month, and are any of the videos missing a thumbnail?',
    'Write a YouTube description for our launch video from docs/launch.md, keep the tags under 500 characters, and save it as a draft for Friday at 17:00.',
  ],
  bluesky: [
    'Draft a Bluesky thread of three posts about our new pricing, each under 300 characters. Show me the preview link before scheduling.',
    'Schedule this as a Bluesky post for tomorrow at 9:00: “We just shipped dark mode.”',
    'Turn the top three entries in CHANGELOG.md into a short Bluesky thread and save it as a draft.',
  ],
  mastodon: [
    'Draft a Mastodon post about our open-source release, under 500 characters, with two relevant hashtags.',
    'Which Mastodon posts do I have scheduled next week? Move nothing, just list them.',
    'Summarise the README’s “Why” section as a Mastodon thread and save it as a draft.',
  ],
  google_business: [
    'Draft a Google Business Profile offer for our weekend sale: 20% off, Saturday to Sunday, with a Shop button linking to example.com/sale.',
    'Create an event post for our open day on the 14th from 10:00 to 16:00 and schedule it for Monday morning.',
    'Write a standard update from the opening hours in content/hours.md with a Learn More button linking to our website, as a draft.',
  ],
  telegram: [
    'Draft a Telegram announcement for our channel about tonight’s maintenance window, then show me the preview link.',
    'Schedule a reminder in our Telegram group for Friday at 18:00: “Live Q&A starts in one hour.”',
    'Post the release notes from CHANGELOG.md to our Telegram channel tomorrow at 10:00, as a draft first.',
  ],
  discord: [
    'Draft an announcement for our Discord #announcements channel about the new feature, under 1,980 characters, using a heading and a bullet list.',
    'Which Discord channels can PostDelegate post to? Schedule “Office hours start in 10 minutes” in the community one at 14:50.',
    'Announce v2.4 in #announcements with the top three changes from CHANGELOG.md, saved as a draft for me to approve.',
  ],
  slack: [
    'Draft a Slack message for #general about Friday’s all-hands and show me the preview link.',
    'Schedule a reminder in #team for Monday at 9:00: “Post your goals for the week.”',
    'Summarise the merged pull requests listed in RELEASES.md into a Slack update for #engineering, as a draft.',
  ],
  tumblr: [
    'Draft a Tumblr text post titled “Behind the scenes” about how we design our covers, with the tags design and process.',
    'Schedule this image post from my media library on my Tumblr blog for Sunday at 12:00, and credit the source URL.',
    'Turn posts/studio-tour.md into a Tumblr post with a title and tags, saved as a draft.',
  ],
  lemmy: [
    'Draft a Lemmy post for the selfhosted community with the title “We open-sourced our scheduler” and a link to the repository.',
    'Post the same announcement to two communities, each with its own title, as drafts.',
    'Write a Lemmy post from the project’s README introduction, link to the docs, and save it as a draft.',
  ],
  nostr: [
    'Draft a Nostr note about this week’s release and show me the preview before scheduling.',
    'Schedule a note for tomorrow at 8:00: “Good morning. New episode is out.”',
    'Summarise the changes in CHANGELOG.md as a short Nostr note, as a draft.',
  ],
  twitch: [
    'Schedule a Twitch announcement in purple for Friday at 19:55: “Stream starts in five minutes.”',
    'Draft three chat messages for tonight’s stream, each under 500 characters, one every half hour from 20:00.',
    'Turn the schedule in stream-plan.md into chat announcements for this week, as drafts.',
  ],
  kick: [
    'Schedule a Kick chat message for 20:00 tonight: “We are live. Today: viewer games.”',
    'Draft a reminder for my Kick chat about the giveaway rules, under 500 characters.',
    'Post the segments listed in stream-plan.md to my Kick chat at the start of each one, as drafts.',
  ],
  dribbble: [
    'Draft a Dribbble shot titled “Onboarding, take two” with the image I just added to my media library.',
    'What Dribbble shots do I have scheduled, and when?',
    'Write a short description for the shot from design-notes.md and save it as a draft.',
  ],
  devto: [
    'Draft a DEV.to article from this outline, with the tags javascript and webdev, and a canonical URL pointing to our blog.',
    'Schedule my DEV.to article for Tuesday at 15:00 under our organization, with the cover image from my media library.',
    'Turn docs/how-we-test.md into a DEV.to article with up to four tags, saved as a draft.',
  ],
  medium: [
    'Draft a Medium story with a title and a subtitle from this outline, with a canonical URL to the original post.',
    'Schedule the story for Thursday at 8:00 in our publication, with up to four tags.',
    'Cross-post blog/2026-11-launch.md to Medium with the canonical URL set to our blog, as a draft.',
  ],
  wordpress: [
    'Draft a WordPress post in the News category with the tags launch and product, and the featured image from my media library.',
    'Schedule this as a WordPress page, status Publish, for Monday at 9:00.',
    'Turn content/case-study.md into a WordPress post as a Draft status, with categories loaded from my site.',
  ],
  hashnode: [
    'Draft a Hashnode article for my publication with a title, subtitle and the tags javascript and testing.',
    'Schedule the article for Wednesday at 11:00 with a canonical URL to our blog.',
    'Turn docs/architecture.md into a Hashnode article with a cover image from my media library, as a draft.',
  ],
  listmonk: [
    'Draft a Listmonk campaign for the newsletter list, subject “November update”, with a preview line.',
    'Schedule the campaign for Tuesday at 7:00 with the Default template.',
    'Write this month’s newsletter from CHANGELOG.md and docs/roadmap.md, as a draft campaign.',
  ],
};

/** The URL segment for a network: its scheduler page without "-scheduler" (google-business, devto, ...). */
export const networkSlug = (n: Network) => (n.scheduler ?? n.key).replace(/-scheduler$/, '');
export const GUIDE_NETWORKS = AVAILABLE_NETWORKS.filter((n) => NETWORK_ASKS[n.key]);
export const agentGuideHref = (agent: Agent, n: Network) => `/${agent.slug}/${networkSlug(n)}`;
export const agentGuidePaths = (agentSlug: string) => {
  const agent = AGENTS.find((a) => a.slug === agentSlug)!;
  return GUIDE_NETWORKS.map((network) => ({ params: { network: networkSlug(network) }, props: { agent, network } }));
};
