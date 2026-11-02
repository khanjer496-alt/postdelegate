import type { APIRoute } from 'astro';
import { SITE } from '../data/site';
import { DOC_SECTIONS } from '../data/docs';
import { GUIDES } from '../data/guides';
import { SCHEDULERS } from '../data/schedulers';
// Every public page as a Markdown list, for AI assistants and crawlers that read llms.txt.
// Routes come from the page files themselves, so new pages appear here without a list to update.
const files = Object.keys(import.meta.glob(['./**/*.astro', './**/*.md', '!./**/\\[*\\].astro', '!./\\[lang\\]/**', '!./404.astro']));
const route = (file: string) => file.replace(/^\./, '').replace(/\.(astro|md)$/, '').replace(/\/index$/, '') || '/';
const titles = new Map<string, string>([
  ...DOC_SECTIONS.flatMap((section) => section.items).map((item) => [item.href, item.title] as [string, string]),
  ...GUIDES.map((guide) => [`/guides/${guide.slug}`, guide.title] as [string, string]),
  ...SCHEDULERS.map((scheduler) => [`/${scheduler.slug}`, `${scheduler.name} scheduler`] as [string, string]),
  ['/api', 'REST API'], ['/mcp', 'MCP server'], ['/agents', 'AI agents'], ['/claude-cowork', 'Claude'], ['/codex', 'Codex and coding agents'],
  ['/platforms', 'Platform status'], ['/docs', 'Documentation'], ['/guides', 'Guides'], ['/tools', 'Free tools'], ['/compare', 'Compare schedulers'],
  ['/alternatives', 'Scheduler alternatives'],
]);
const words = (slug: string) => slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const label = (path: string) => {
  const known = titles.get(path);
  if (known) return known;
  if (path === '/') return 'Home';
  const slug = path.split('/').filter(Boolean).at(-1)!;
  if (path.startsWith('/compare/')) return slug.includes('-vs-') ? slug.split('-vs-').map(words).join(' vs ') : `PostDelegate vs ${words(slug)}`;
  if (path.startsWith('/alternatives/')) return `${words(slug)} alternatives`;
  return words(slug);
};
const groups: [string, (path: string) => boolean][] = [
  ['Product', (p) => !/^\/(docs|guides|compare|alternatives|tools|agents)\b/.test(p) && !p.endsWith('-scheduler')],
  ['Schedulers by network', (p) => p.endsWith('-scheduler')],
  ['Compare and alternatives', (p) => /^\/(compare|alternatives)\b/.test(p)],
  ['Guides', (p) => p.startsWith('/guides')],
  ['Documentation', (p) => p.startsWith('/docs')],
  ['Free tools', (p) => p.startsWith('/tools')],
  ['Agents', (p) => p.startsWith('/agents')],
];

export const GET: APIRoute = () => {
  const paths = [...new Set([...files.map(route), ...SCHEDULERS.map((s) => `/${s.slug}`)])].sort();
  const sections = groups.map(([title, test]) => {
    const items = paths.filter(test);
    return items.length ? `## ${title}\n${items.map((p) => `- [${label(p)}](${SITE.url}${p === '/' ? '' : p})`).join('\n')}` : '';
  }).filter(Boolean);
  const body = `# PostDelegate sitemap\n\n> Every public page on ${SITE.url}. Product facts for AI assistants: ${SITE.url}/llms.txt\n\n${sections.join('\n\n')}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
};
