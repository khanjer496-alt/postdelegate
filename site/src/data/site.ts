export const SITE = {
 name:'PostDelegate',url:'https://postdelegate.com',app:'https://app.postdelegate.com',
 signup:'https://app.postdelegate.com/auth',login:'https://app.postdelegate.com/auth/login',
 email:'support@postdelegate.com',source:'https://app.postdelegate.com/source',
 tagline:'Your social media. All in one clear calendar.',
 legal:{terms:'https://app.postdelegate.com/legal/terms/',privacy:'https://app.postdelegate.com/legal/privacy/',
 dataDeletion:'https://app.postdelegate.com/legal/data-deletion',licenses:'/licenses',
 dpa:'https://app.postdelegate.com/legal/dpa/',subprocessors:'https://app.postdelegate.com/legal/subprocessors/',
 security:'/about#security'},operator:'Nasida Apps LLC',address:'30 N Gould St, Ste R, Sheridan, WY 82801, USA',
} as const;
// Sign-up calls to action. Every plan starts with a 7-day free trial that needs no card.
export const CTA_LABEL='Start your 7-day free trial';
export const CTA_SHORT='Start free trial';
export const CTA_NOTE='No credit card required';
// Official PostDelegate profiles: Organization `sameAs` on every page and the footer links.
// The Telegram bot is a product integration, not a social profile, so it is not listed.
export const SOCIAL_PROFILES = [
  { name: 'DEV', href: 'https://dev.to/postdelegate' },
  { name: 'Hashnode', href: 'https://hashnode.com/@postdelegate' },
  { name: 'Medium', href: 'https://medium.com/@postdelegate_app' },
  { name: 'Bluesky', href: 'https://bsky.app/profile/postdelegate.com' },
  { name: 'YouTube', href: 'https://www.youtube.com/@postdelegate' },
  { name: 'GitHub', href: 'https://github.com/khanjer496-alt/postdelegate-app' },
] as const;
// Pages kept out of search and the sitemap: X, which is not available. A scheduler page for a
// network that is not switched on yet goes here too, and comes out when its network goes live.
export const NOINDEX_PATHS = ['/docs/channels/x'];

// The page's own path, from Astro.url.pathname, as the site writes URLs:
// no .html, no trailing slash, "/" for the home page.
//
// Built with build.format 'file', so every page is a file: /pricing.html, and
// the home page is /index.html. Astro 5 reported the home page's pathname as
// "/", Astro 7 reports "/index.html" - which turned the home page's canonical
// and og:url into https://postdelegate.com/index and dropped its hreflang
// alternates, because the path no longer matched TRANSLATED_PATHS. Hence the
// /index step, and hence one helper rather than the copy in each layout.
export const pagePath = (url: URL): string =>
  url.pathname.replace(/\.html$/, '').replace(/\/index$/, '/').replace(/\/+$/, '') || '/';
