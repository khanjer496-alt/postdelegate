// Hosted instruction files for AI agents (/agents/*), built from the templates in
// ./agent-files and the shared site data, so the network list, limits and plans
// follow networks.ts and plans.ts. Tool names, settings and media rules were written
// from the MCP tools in libraries/nestjs-libraries/src/chat/tools and the providers
// and DTOs in libraries/nestjs-libraries/src; re-check them when that code changes.
import { SITE } from './site';
import { AVAILABLE_NETWORKS } from './networks';
import { PLANS } from './plans';
import skillTemplate from './agent-files/skill.md?raw';
import agentsTemplate from './agent-files/agents.md?raw';
import chatgptTemplate from './agent-files/chatgpt.md?raw';
import cursorTemplate from './agent-files/cursor.mdc?raw';
import connectPartial from './agent-files/connect.md?raw';
import safetyPartial from './agent-files/safety.md?raw';

export const MCP_OAUTH_URL = 'https://app.postdelegate.com/mcp-oauth-dynamic';
export const MCP_KEY_URL = 'https://app.postdelegate.com/api/mcp';
export const REST_BASE_URL = 'https://app.postdelegate.com/api/public/v1';

// What an agent must know per network, keyed by the provider identifier (networks.ts key).
// `settings` lists the settings fields, `media` the media rules the server checks,
// `followUps` whether postsAndComments[1..] are published (the provider has comment()).
interface NetworkAgentNotes { settings: string; media: string; followUps?: boolean }
const NETWORK_AGENT_NOTES: Record<string, NetworkAgentNotes> = {
  youtube: { settings: 'Required `title` (2 to 100 characters) and `type` (`public`, `private` or `unlisted`). Optional `selfDeclaredMadeForKids` (`yes`/`no`), `tags` as `[{ value, label }]` (500 characters in total), `thumbnail`.', media: 'Exactly one MP4 video. The post text is the video description.' },
  bluesky: { settings: 'None.', media: 'Up to 4 images or 1 video per post, or no media.', followUps: true },
  telegram: { settings: 'None.', media: 'No extra media rules.', followUps: true },
  discord: { settings: 'Required `channel`: a channel id from helper `channels`.', media: 'No extra media rules.', followUps: true },
  slack: { settings: 'Required `channel`: a channel id from helper `channels`.', media: 'Images only (PNG, JPG, GIF). No MP4.', followUps: true },
  tumblr: { settings: 'Optional `title`, `link`, `sourceUrl`, and `tags` as one comma-separated string.', media: 'Up to 30 images and 1 video per post.' },
  lemmy: { settings: 'Required `subreddit`: a list of `{ value: { subreddit, id, title, url? } }` (title at least 2 characters). Find communities with helper `subreddits` and `dataSchema` `word`.', media: 'Optional single picture (PNG, JPG or GIF), used as the cover.', followUps: true },
  nostr: { settings: 'None.', media: 'No extra media rules.', followUps: true },
  twitch: { settings: 'Optional `messageType` (`message` or `announcement`) and `announcementColor` (`primary`, `blue`, `green`, `orange`, `purple`).', media: 'Sent as a chat message, text only.', followUps: true },
  kick: { settings: 'None.', media: 'Sent as a chat message, text only. Kick chat does not take media.', followUps: true },
  dribbble: { settings: 'Required `title`. Optional `team`: a team id from helper `teams`.', media: 'Exactly one image, at least 400×300 px. No MP4. A GIF must be exactly 400×300 or 800×600 px.' },
  devto: { settings: 'Required `title` (2+ characters). Optional `main_image`, `canonical` URL, `organization` (helper `organizations`), up to 4 `tags` as `[{ value: number, label }]` (helper `tags`).', media: 'Published as an article. Use `main_image` for the cover.' },
  medium: { settings: 'Required `title` and `subtitle` (2+ characters each). Optional `canonical` URL, `publication` (helper `publications`), up to 4 `tags`.', media: 'Published as an article.' },
  wordpress: { settings: 'Required `title` (2+ characters) and `type` (helper `postTypes`). Optional `main_image` (cover), `categories` and `tags` as number ids (helpers `categoriesList`, `tagsList`), `status` (`publish`, `draft`, `pending`, `private`).', media: 'Pictures go inside the content as `<img src="...">` with a media-library path. Attachments are not published.' },
  hashnode: { settings: 'Required `title` (6+ characters), `publication` (helper `publications`) and at least one tag in `tags` (helper `tagsList`). Optional `subtitle`, `main_image`, `canonical` URL.', media: 'Published as an article. Use `main_image` for the cover.' },
  listmonk: { settings: 'Required `subject`, `preview` and `list` (a list id from helper `list`). Optional `template` (helper `templates`).', media: 'Sent as an email. Pictures go inside the content as `<img src="...">` with a media-library path. Attachments are not sent.' },
};
const FALLBACK_NOTES: NetworkAgentNotes = { settings: 'Read them from `integrationSchema`.', media: 'Read the rules from `integrationSchema`.' };
const notesFor = (key: string) => NETWORK_AGENT_NOTES[key] ?? FALLBACK_NOTES;

const listNames = (names: string[]) => names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names.join('');
const limitText = (limit: number, note?: string) => `about ${limit.toLocaleString('en-US')} characters.${note ? ` ${note}` : ''}`;

const networksFull = AVAILABLE_NETWORKS.map((network) => {
  const notes = notesFor(network.key);
  return `- **${network.name}** (\`${network.key}\`). Limit: ${limitText(network.limit, network.note)} Settings: ${notes.settings} Media: ${notes.media}`;
}).join('\n');
const networksCompact = AVAILABLE_NETWORKS.map((network) => `- ${network.name} (\`${network.key}\`, ~${network.limit.toLocaleString('en-US')} chars): ${notesFor(network.key).settings}`).join('\n');
const followUpNames = listNames(AVAILABLE_NETWORKS.filter((network) => notesFor(network.key).followUps).map((network) => network.name));
const networkNames = listNames(AVAILABLE_NETWORKS.map((network) => network.name));
const plans = PLANS.map((plan) => `${plan.name} $${plan.monthly}/month`).join(', ');

const render = (template: string, values: Record<string, string>) =>
  template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (!(key in values)) throw new Error(`Unknown agent-file placeholder ${match}`);
    return values[key];
  });

const base = { site: SITE.url, app: SITE.app, mcp_oauth: MCP_OAUTH_URL, mcp_key: MCP_KEY_URL, rest_base: REST_BASE_URL, plans };
const values = {
  ...base,
  connect: render(connectPartial, base).trim(),
  safety: safetyPartial.trim(),
  networks: networksFull,
  networks_compact: networksCompact,
  network_names: networkNames,
  followup_names: followUpNames,
};

export const SKILL_MD = render(skillTemplate, values);
export const AGENTS_MD = render(agentsTemplate, values);
export const CHATGPT_INSTRUCTIONS_MD = render(chatgptTemplate, values);
export const CURSOR_RULE_MDC = render(cursorTemplate, values);

// The files, in the order the docs page lists them.
export interface AgentFile { path: string; title: string; audience: string; description: string; body?: string }
export const AGENT_FILES: AgentFile[] = [
  { path: '/agents/postdelegate/SKILL.md', title: 'Claude skill', audience: 'Claude, Claude Code and other tools that read Agent Skills', description: 'A skill named postdelegate: connecting, the draft workflow, every MCP tool, per-network rules, safety rules, errors and examples.', body: SKILL_MD },
  { path: '/agents/postdelegate-skill.zip', title: 'Claude skill (zip)', audience: 'uploading to claude.ai', description: 'The same SKILL.md inside a postdelegate folder, ready to upload as a custom skill.' },
  { path: '/agents/AGENTS.md', title: 'AGENTS.md', audience: 'Codex, Cursor, Claude Code and other coding agents', description: 'REST API and MCP guidance for agents working in a codebase: auth, endpoints, request bodies, limits and errors.', body: AGENTS_MD },
  { path: '/agents/chatgpt-instructions.md', title: 'ChatGPT instructions', audience: 'a custom GPT or a ChatGPT Project', description: 'Short instructions to paste into a GPT or Project that uses the PostDelegate connector.', body: CHATGPT_INSTRUCTIONS_MD },
  { path: '/agents/postdelegate.mdc', title: 'Cursor rule', audience: 'Cursor', description: 'A project rule with Cursor frontmatter, applied when your code or request touches PostDelegate.', body: CURSOR_RULE_MDC },
];
