// Languages of the marketing site. English lives at the root URLs; every other language
// gets a /{lang}/ copy of the pages in TRANSLATED_PATHS, built from the same components
// with the strings in ./locales. Every other page (docs, guides, legal, tools, the
// individual compare pages) stays English, and links to it from a translated page go
// to the English page.
import { AVAILABLE_NETWORKS } from '../data/networks';
import { SCHEDULERS } from '../data/schedulers';
import en, { type Dict } from './locales/en';
import es from './locales/es';
import pt from './locales/pt';
import de from './locales/de';
import fr from './locales/fr';
import ar from './locales/ar';
import it from './locales/it';

export const LOCALES = ['en', 'es', 'pt', 'de', 'fr', 'ar', 'it'] as const;
export type Lang = (typeof LOCALES)[number];
export const DEFAULT_LANG: Lang = 'en';

// name: the language in its own words, as the switcher lists it; short: its code on the
// switcher button; flag: the Flag.astro key.
export const LANGUAGES: Record<Lang, { name: string; short: string; flag: string; dir: 'ltr' | 'rtl'; ogLocale: string }> = {
  en: { name: 'English', short: 'EN', flag: 'us', dir: 'ltr', ogLocale: 'en_US' },
  es: { name: 'Español', short: 'ES', flag: 'es', dir: 'ltr', ogLocale: 'es_ES' },
  pt: { name: 'Português', short: 'PT', flag: 'br', dir: 'ltr', ogLocale: 'pt_BR' },
  de: { name: 'Deutsch', short: 'DE', flag: 'de', dir: 'ltr', ogLocale: 'de_DE' },
  fr: { name: 'Français', short: 'FR', flag: 'fr', dir: 'ltr', ogLocale: 'fr_FR' },
  ar: { name: 'العربية', short: 'AR', flag: 'ae', dir: 'rtl', ogLocale: 'ar_AE' },
  it: { name: 'Italiano', short: 'IT', flag: 'it', dir: 'ltr', ogLocale: 'it_IT' },
};

const DICTS: Record<Lang, Dict> = { en, es, pt, de, fr, ar, it };
export const strings = (lang: Lang): Dict => DICTS[lang];

// Live network pages only: pages for networks that are not live stay English.
export const TRANSLATED_SCHEDULERS = SCHEDULERS.filter((s) => AVAILABLE_NETWORKS.some((n) => n.key === s.key));

// English paths of the pages that exist in every language.
export const TRANSLATED_PATHS = new Set([
  '/', '/pricing', '/platforms', '/agents', '/mcp', '/claude-cowork', '/codex', '/api',
  '/compare', '/alternatives', '/about', '/support',
  ...TRANSLATED_SCHEDULERS.map((s) => `/${s.slug}`),
]);

const isLang = (value: string): value is Lang => (LOCALES as readonly string[]).includes(value);

// "/es/pricing.html" -> { lang: 'es', path: '/pricing' }; "/docs/api" -> { lang: 'en', path: '/docs/api' }
export const splitPath = (pathname: string): { lang: Lang; path: string } => {
  const clean = pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/';
  const [first, ...rest] = clean.split('/').filter(Boolean);
  if (first && first !== DEFAULT_LANG && isLang(first)) return { lang: first, path: `/${rest.join('/')}` };
  return { lang: DEFAULT_LANG, path: clean };
};

// The URL of an English path in a language. It only exists for TRANSLATED_PATHS.
export const localePath = (lang: Lang, path: string) =>
  lang === DEFAULT_LANG ? path : path === '/' ? `/${lang}` : `/${lang}${path}`;

// An internal link from a page in `lang`: translated pages stay in the language, everything
// else (docs, guides, anchors on English-only pages, other sites) is returned unchanged.
export const localeHref = (lang: Lang, href: string) => {
  if (lang === DEFAULT_LANG || !href.startsWith('/') || href.startsWith('//')) return href;
  const cut = href.search(/[?#]/);
  const path = cut === -1 ? href : href.slice(0, cut);
  return TRANSLATED_PATHS.has(path) ? localePath(lang, path) + (cut === -1 ? '' : href.slice(cut)) : href;
};

// The same for the internal links inside an HTML string from a dictionary.
export const localizeLinks = (lang: Lang, html: string) =>
  lang === DEFAULT_LANG ? html : html.replace(/href="(\/[^"]*)"/g, (_, href: string) => `href="${localeHref(lang, href)}"`);

// getStaticPaths for the pages under src/pages/[lang]/.
export const localeStaticPaths = () => LOCALES.filter((lang) => lang !== DEFAULT_LANG).map((lang) => ({ params: { lang } }));
