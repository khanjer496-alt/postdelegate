// Markdown twins of the documentation (/docs.md and /docs/<path>.md) for AI agents.
// Markdown pages are converted from their own source files in src/pages/docs, so the
// twin always matches the HTML page. The two .astro pages (the docs home and Agent files)
// are written out here from the same data their templates use; keep them in step.
// public/_headers serves the files as text/markdown, and functions/docs/_middleware.ts returns
// them to requests for the HTML page that send Accept: text/markdown.
import { SITE } from './site';
import { AGENT_FILES_META, DOC_PAGES, DOC_SECTIONS, DOCS_HOME_META } from './docs';
import { AVAILABLE_NETWORKS } from './networks';
import { AGENT_FILES, MCP_OAUTH_URL } from './agent-files';

export interface DocMarkdown { href: string; title: string; description: string; body: string }

const sources = import.meta.glob('../pages/docs/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const hrefOf = (file: string) => file.replace('../pages', '').replace(/\.md$/, '');
const DOC_HREFS = new Set(['/docs', ...DOC_PAGES.map((page) => page.href), ...Object.keys(sources).map(hrefOf)]);

// Absolute URLs everywhere; links to another docs page point at its Markdown twin.
const absolute = (href: string, page: string) => {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return href;
  if (href.startsWith('#')) return `${SITE.url}${page}${href}`;
  const [path, hash = ''] = href.split('#');
  if (DOC_HREFS.has(path)) return `${SITE.url}${path}.md${hash ? `#${hash}` : ''}`;
  return `${SITE.url}${href}`;
};
const linkify = (line: string, page: string) => line.replace(/\]\(([^)\s]+)\)/g, (_, href: string) => `](${absolute(href, page)})`);

// The docs use three HTML blocks inside Markdown: callouts, warning callouts and a card grid.
// Limits, none hit by today's pages: nested or four-backtick fences, links with a title, and
// escaped quotes in frontmatter values are not handled.
// Anything else fails the build, so a new block gets a Markdown form before it ships.
const CARD = /^<a href="([^"]+)"><strong>(.+?)<\/strong><span>(.+?)<\/span><\/a>$/;
const convert = (source: string, page: string) => {
  const out: string[] = [];
  let callout: string[] | undefined;
  let cards = false;
  let fence = false;
  for (const line of source.split('\n')) {
    const target = callout ?? out;
    if (/^\s*(```|~~~)/.test(line) || fence) {
      if (/^\s*(```|~~~)/.test(line)) fence = !fence;
      target.push(line);
      continue;
    }
    if (/^<div class="callout( warn)?">$/.test(line)) { callout = []; continue; }
    if (line === '<div class="card-grid">') { cards = true; continue; }
    if (line === '</div>' && callout) {
      // A callout becomes a blockquote, without the blank lines that open and close the HTML block.
      const text = callout.join('\n').trim().split('\n');
      out.push(...text.map((quoted) => (quoted ? `> ${quoted}` : '>')));
      callout = undefined;
      continue;
    }
    if (line === '</div>' && cards) { cards = false; continue; }
    if (cards) {
      const card = CARD.exec(line);
      if (!card) throw new Error(`Unsupported card markup on ${page}: ${line}`);
      out.push(`- [${card[2]}](${absolute(card[1], page)}): ${card[3]}`);
      continue;
    }
    if (/^\s*<\/?[a-z][^>]*>/i.test(line)) throw new Error(`Add a Markdown form for this HTML in the docs Markdown twins (${page}): ${line}`);
    target.push(linkify(line, page));
  }
  if (callout || cards || fence) throw new Error(`Unclosed block in ${page}`);
  return out.join('\n').trim();
};

const frontmatter = (source: string, file: string) => {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(source);
  if (!match) throw new Error(`Missing frontmatter in ${file}`);
  const field = (name: string) => {
    const value = new RegExp(`^${name}:\\s*(.+)$`, 'm').exec(match[1])?.[1]?.trim();
    if (!value) throw new Error(`Missing ${name} in ${file}`);
    return value.replace(/^(['"])(.*)\1$/, '$2');
  };
  return { title: field('title'), description: field('description'), body: source.slice(match[0].length) };
};

// The docs home, from DOC_SECTIONS like src/pages/docs/index.astro.
const homeBody = () => [
  `> **PostDelegate is in early access.** The channels listed as available in these docs are the ones you can connect today. Facebook, Instagram, Threads, TikTok, LinkedIn, Pinterest, Reddit, Mastodon and Google Business are waiting on platform approval. X is not available on PostDelegate. Nothing here promises a connection that is not yet open.`,
  `## Start here`,
  [
    `- [Getting started](${SITE.url}/docs/getting-started.md): Start your free trial, connect a channel and schedule your first post.`,
    `- [Connect a channel](${SITE.url}/docs/channels.md): Step-by-step guides for the ${AVAILABLE_NETWORKS.length} networks you can connect today.`,
    `- [REST API](${SITE.url}/docs/api.md): Authentication, rate limits and every endpoint with examples.`,
    `- [Connect your AI assistant](${SITE.url}/docs/mcp.md): Use Claude, ChatGPT, Cursor or another MCP client to draft and schedule posts.`,
  ].join('\n'),
  ...DOC_SECTIONS.map((section) => `## ${section.title}\n\n${section.items.map((item) => `- [${item.title}](${SITE.url}${item.href}.md): ${item.description}`).join('\n')}`),
  `## Need a hand?`,
  `Email [${SITE.email}](mailto:${SITE.email}). Include your workspace name, the channel involved and what you expected to happen. Never send passwords, API keys or tokens.`,
].join('\n\n');

// /docs/mcp/agent-files, from AGENT_FILES like src/pages/docs/mcp/agent-files.astro.
const agentFilesBody = () => {
  const url = (path: string) => `${SITE.url}${path}`;
  const doc = (path: string) => `${SITE.url}${path}.md`;
  return [
    `An assistant does better with PostDelegate when it knows the workflow before it starts: list channels, read the channel's rules, upload media, create a draft and wait for your OK. These files hold that knowledge, in the format each assistant reads. Point your assistant at one URL, or save the file where your tool looks for it.`,
    `> **The files teach, MCP connects.** An instruction file does not give an assistant access to your workspace. Connect it to the MCP server at \`${MCP_OAUTH_URL}\` first. See [Claude](${doc('/docs/mcp/claude')}), [ChatGPT](${doc('/docs/mcp/chatgpt')}) or [Claude Code, Cursor and others](${doc('/docs/mcp/clients')}). PostDelegate does not provide or charge for AI. These files are for the assistant you already use.`,
    `## The files`,
    `Each file stands on its own and tells the assistant to draft by default, never schedule or publish without your OK, confirm deletes and respect [approvals](${doc('/docs/approvals')}).`,
    AGENT_FILES.map((file) => `- **${file.title}** (for ${file.audience}): ${file.description} ${url(file.path)}`).join('\n'),
    `## Claude skill`,
    `The skill is a \`SKILL.md\` file named \`postdelegate\`. Claude reads its description and loads the rest when you ask for something it covers, such as drafting or scheduling a post.`,
    `### Claude apps (claude.ai)`,
    [
      `1. Download [postdelegate-skill.zip](${url('/agents/postdelegate-skill.zip')}). It holds a \`postdelegate\` folder with \`SKILL.md\` inside.`,
      `2. Make sure code execution is turned on. On personal plans it is under **Settings > Capabilities**. On Team and Enterprise plans an owner controls it.`,
      `3. Open **Customize > Skills**, choose **+**, then **Create skill** and **Upload a skill**, and pick the zip.`,
      `4. Turn the skill on, and make sure the PostDelegate connector is connected.`,
    ].join('\n'),
    `These menus belong to Anthropic and they get renamed from time to time. If yours look different, follow Anthropic's help article on using skills in Claude.`,
    `### Claude Code`,
    `Save the skill in your personal skills folder so every project can use it:`,
    `\`\`\`bash\nmkdir -p ~/.claude/skills/postdelegate\ncurl -fsSL ${url('/agents/postdelegate/SKILL.md')} \\\n  -o ~/.claude/skills/postdelegate/SKILL.md\n\`\`\``,
    `For one repository only, save it to \`.claude/skills/postdelegate/SKILL.md\` in that repository instead. Then connect the server once:`,
    `\`\`\`bash\nclaude mcp add postdelegate --transport http "${MCP_OAUTH_URL}"\n\`\`\``,
    `Run \`/mcp\` inside Claude Code to sign in. You can call the skill directly with \`/postdelegate\`, or just ask for a post.`,
    `## AGENTS.md for coding agents`,
    `Codex, Cursor and many other coding agents read an \`AGENTS.md\` file at the root of a repository. This one covers the [REST API](${doc('/docs/api')}) and MCP from code: authentication, endpoints, the post body, rate limits, errors and the safety rules.`,
    `\`\`\`bash\ncurl -fsSL ${url('/agents/AGENTS.md')} -o AGENTS.md\n\`\`\``,
    `If the repository already has an \`AGENTS.md\`, append the file to it instead (\`>> AGENTS.md\`), or save it as \`docs/postdelegate-agents.md\` and link to it. To connect Codex to MCP, see [Codex setup](${doc('/docs/mcp/clients')}#codex).`,
    `## ChatGPT custom GPT or Project`,
    [
      `1. Add the PostDelegate connector in ChatGPT. See [Connect ChatGPT](${doc('/docs/mcp/chatgpt')}).`,
      `2. Copy [chatgpt-instructions.md](${url('/agents/chatgpt-instructions.md')}).`,
      `3. Paste it into the **Instructions** of a custom GPT, or a Project's instructions, and enable the PostDelegate connector there.`,
    ].join('\n'),
    `The file is kept short enough for ChatGPT's instructions field. Custom GPTs and Projects depend on your ChatGPT plan and workspace settings, which belong to OpenAI.`,
    `## Cursor rule`,
    `Save the rule in your project's rules folder. Cursor applies it when a request or file is about PostDelegate.`,
    `\`\`\`bash\nmkdir -p .cursor/rules\ncurl -fsSL ${url('/agents/postdelegate.mdc')} -o .cursor/rules/postdelegate.mdc\n\`\`\``,
    `To let Cursor use the tools as well, add the MCP server to \`.cursor/mcp.json\`. See [Cursor setup](${doc('/docs/mcp/clients')}#cursor).`,
    `## Keeping them current`,
    `The files are built from the same data as these docs. When a network opens or a rule changes, the hosted files change with it. Download them again from time to time, or have your assistant read the URL directly when it starts a task. For the full list of what the server can do, see [MCP tools](${doc('/docs/mcp/tools')}). Assistants that read [llms.txt](${url('/llms.txt')}) find these files listed there too.`,
  ].join('\n\n');
};

const fromSources: DocMarkdown[] = Object.entries(sources).map(([file, source]) => {
  const href = hrefOf(file);
  const { title, description, body } = frontmatter(source, file);
  return { href, title, description, body: convert(body, href) };
});

export const DOC_MARKDOWN: DocMarkdown[] = [
  { href: '/docs', ...DOCS_HOME_META, body: homeBody() },
  { href: '/docs/mcp/agent-files', ...AGENT_FILES_META, body: agentFilesBody() },
  ...fromSources,
];

// Every docs page in DOC_SECTIONS must have a twin; this fails the build if one is added without it.
for (const page of DOC_PAGES) {
  if (!DOC_MARKDOWN.some((doc) => doc.href === page.href)) throw new Error(`No Markdown twin for ${page.href}`);
}

const yaml = (value: string) => JSON.stringify(value);
export const renderDocMarkdown = (doc: DocMarkdown) => `---
title: ${yaml(doc.title)}
description: ${yaml(doc.description)}
canonical: ${SITE.url}${doc.href}
---

> ## Documentation index
> Fetch the complete PostDelegate documentation index at: ${SITE.url}/llms.txt
> Use it to find every page before exploring further. Every docs page has a Markdown version at its URL plus \`.md\`.

# ${doc.title}

${doc.description}

${doc.body}
`;
