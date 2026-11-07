import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { NOINDEX_PATHS } from './src/data/site.ts';

export default defineConfig({
  site: 'https://postdelegate.com',
  output: 'static',
  trailingSlash: 'never',
  // Astro 7 changed this default from true to 'jsx', which stops collapsing
  // whitespace between elements. On this site that rewrote 1,271 inline runs -
  // </a> <a>, </span> <span> - and none of them showed, because every one sits
  // in a flex container where a whitespace-only text node renders as nothing.
  // The first such run written outside a flex container would lose its space
  // silently, with no error and no visible diff anywhere else. Pinned to the
  // behaviour the pages were written against; 'jsx' is a deliberate choice to
  // make, not one to inherit. Measured across the 477 pages: astro 5 emitted
  // 103,968 whitespace runs between tags, 'jsx' emits 5,403, true emits 97,393.
  compressHTML: true,
  build: { format: 'file', inlineStylesheets: 'auto' },
  // English at the root URLs, the other languages under /{lang}/ (src/i18n); the sitemap
  // groups each page with its translations for hreflang.
  integrations: [sitemap({ filter: (page) => !NOINDEX_PATHS.includes(new URL(page).pathname.replace(/\/+$/, '')), i18n: { defaultLocale: 'en', locales: { en: 'en', es: 'es', pt: 'pt', de: 'de', fr: 'fr', ar: 'ar', it: 'it' } } })],
  vite: { plugins: [tailwindcss()] },
});
