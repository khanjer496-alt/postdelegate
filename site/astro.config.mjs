import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://postdelegate.com',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'auto' },
  // English at the root URLs, the other languages under /{lang}/ (src/i18n); the sitemap
  // groups each page with its translations for hreflang.
  integrations: [sitemap({ i18n: { defaultLocale: 'en', locales: { en: 'en', es: 'es', pt: 'pt', de: 'de', fr: 'fr', ar: 'ar', it: 'it' } } })],
  vite: { plugins: [tailwindcss()] },
});
