import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { NOINDEX_PATHS } from './src/data/site.ts';

export default defineConfig({
  site: 'https://postdelegate.com',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'auto' },
  // English at the root URLs, the other languages under /{lang}/ (src/i18n); the sitemap
  // groups each page with its translations for hreflang.
  integrations: [sitemap({ filter: (page) => !NOINDEX_PATHS.includes(new URL(page).pathname.replace(/\/+$/, '')), i18n: { defaultLocale: 'en', locales: { en: 'en', es: 'es', pt: 'pt', de: 'de', fr: 'fr', ar: 'ar', it: 'it' } } })],
  vite: { plugins: [tailwindcss()] },
});
