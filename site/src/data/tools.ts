// Competitor facts for the /compare/{a}-vs-{b} and /alternatives/{tool} pages.
// One JSON file per tool in ./tools. Every fact is { value, src } so each claim on a page
// links to the vendor page it was read from, and `checked` is the day someone re-read them.
// The build fails when a file is missing a source or was checked more than MAX_AGE_DAYS ago,
// so prices are re-read on the vendor's own site before they go stale.
import { PLANS, type Plan } from './plans';
import { SITE } from './site';
import { ogCardFor } from './og-cards.mjs';

export interface Fact { value: string; src: string | string[]; note?: string }
// Per-unit prices that drop at volume: [up to this many units, price per unit per month], in order.
export interface TieredFact extends Fact { tiers: Record<string, [number, number][]> }
export const COST_POINTS = ['3', '10', '30'] as const;
export type CostPoint = (typeof COST_POINTS)[number];
export interface Tool {
  name: string; slug: string; site: string; pricingUrl: string; checked: string;
  kind?: Fact; hosting?: Fact; license?: Fact; pricingModel?: Fact; freeOption?: Fact; trial?: Fact;
  entryPaid?: Fact; plans?: Fact; perChannel?: TieredFact; cost?: Partial<Record<CostPoint, Fact>>; networks?: Fact; api?: Fact;
  mcp?: Fact; ai?: Fact; teams?: Fact; selfHostStack?: Fact; selfHostApps?: Fact;
}

const MAX_AGE_DAYS = 90;
const META = new Set(['name', 'slug', 'site', 'pricingUrl', 'checked']);
const files = import.meta.glob<Tool>('./tools/*.json', { eager: true, import: 'default' });

const isFact = (value: unknown): value is Fact => {
  if (!value || typeof value !== 'object') return false;
  const { value: text, src } = value as Fact;
  const sources = Array.isArray(src) ? src : [src];
  return typeof text === 'string' && text.length > 0 && sources.length > 0 && sources.every((s) => typeof s === 'string' && /^https:\/\//.test(s));
};

function validate(file: string, tool: Tool): Tool {
  const problems: string[] = [];
  if (!tool.name || !tool.slug || !/^https:\/\//.test(tool.pricingUrl || '')) problems.push('needs name, slug and an https pricingUrl');
  const checked = new Date(`${tool.checked}T00:00:00Z`);
  if (Number.isNaN(checked.getTime())) problems.push(`"checked" must be a YYYY-MM-DD date, got ${JSON.stringify(tool.checked)}`);
  else {
    const age = Math.floor((Date.now() - checked.getTime()) / 86_400_000);
    if (age > MAX_AGE_DAYS) problems.push(`facts were checked on ${tool.checked}, ${age} days ago (limit ${MAX_AGE_DAYS}). Re-read ${tool.pricingUrl} and update the file`);
  }
  for (const [key, value] of Object.entries(tool)) {
    if (META.has(key)) continue;
    if (key === 'cost') {
      for (const [point, fact] of Object.entries(value as object)) if (!isFact(fact)) problems.push(`cost.${point} needs { value, src }`);
    } else if (!isFact(value)) problems.push(`${key} needs { value, src } with an https source`);
  }
  if (problems.length) throw new Error(`src/data/tools/${file}: ${problems.join('; ')}`);
  return tool;
}

export const TOOLS: Record<string, Tool> = Object.fromEntries(
  Object.entries(files).map(([path, tool]) => {
    const file = path.split('/').pop()!;
    return [tool.slug, validate(file, tool)];
  }),
);

export function tool(slug: string): Tool {
  const found = TOOLS[slug];
  if (!found) throw new Error(`No src/data/tools/${slug}.json`);
  return found;
}

export const sources = (fact?: Fact) => (fact ? (Array.isArray(fact.src) ? fact.src : [fact.src]) : []);

// Monthly total for `units` on a tiered plan, e.g. tieredMonthly(tool('buffer'), 'team', 30).
export function tieredMonthly(t: Tool, plan: string, units: number): number {
  const tiers = t.perChannel?.tiers[plan];
  if (!tiers) throw new Error(`src/data/tools/${t.slug}.json has no perChannel tiers for "${plan}"`);
  let total = 0;
  let from = 0;
  for (const [upTo, price] of tiers) {
    if (units <= from) break;
    total += (Math.min(units, upTo) - from) * price;
    from = upTo;
  }
  if (units > from) throw new Error(`${t.name} ${plan} tiers in src/data/tools/${t.slug}.json stop at ${from} units`);
  return total;
}

// The oldest `checked` date among the tools on a page: the page's "Prices checked on" date.
export const checkedOn = (tools: Tool[]) => tools.map((t) => t.checked).sort()[0];
export const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

// The cheapest PostDelegate plan that covers a number of channels, from plans.ts.
export const planFor = (channels: number): Plan =>
  PLANS.find((plan) => plan.channels >= channels) ?? PLANS[PLANS.length - 1];

// Schema for a comparison page: breadcrumbs, the FAQ and the article itself.
export function comparisonJsonLd(page: { path: string; title: string; description: string; section: { name: string; path: string };
  faq: { q: string; a: string }[]; published: string; modified: string }) {
  const url = new URL(page.path, SITE.url).href;
  const strip = (html: string) => html.replace(/<[^>]+>/g, '');
  return [
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'PostDelegate', item: SITE.url },
      { '@type': 'ListItem', position: 2, name: page.section.name, item: new URL(page.section.path, SITE.url).href },
      { '@type': 'ListItem', position: 3, name: page.title, item: url }] },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: page.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: strip(f.a) } })) },
    { '@context': 'https://schema.org', '@type': 'Article', headline: page.title, description: page.description, url, mainEntityOfPage: url, inLanguage: 'en',
      // the page's own share card, which carries its headline; /og.png only
      // for the pages that have no card of their own
      image: new URL(ogCardFor(page.path) ?? '/og.png', SITE.url).href, datePublished: page.published, dateModified: page.modified,
      author: { '@type': 'Person', name: 'Naser Khanjar' },
      publisher: { '@type': 'Organization', name: SITE.operator, url: SITE.url, logo: { '@type': 'ImageObject', url: new URL('/postdelegate-icon-512.png', SITE.url).href, width: 512, height: 512 } } },
  ];
}
