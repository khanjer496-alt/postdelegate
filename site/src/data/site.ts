export const SITE = {
 name:'PostDelegate',url:'https://postdelegate.com',app:'https://app.postdelegate.com',
 signup:'https://app.postdelegate.com/auth',login:'https://app.postdelegate.com/auth/login',
 email:'support@postdelegate.com',source:'https://app.postdelegate.com/source',
 tagline:'Your social media. All in one clear calendar.',
 legal:{terms:'https://app.postdelegate.com/legal/terms/',privacy:'https://app.postdelegate.com/legal/privacy/',
 dataDeletion:'https://app.postdelegate.com/legal/data-deletion',licenses:'/licenses',
 subprocessors:'/subprocessors',security:'/about#security'},operator:'Nasida Apps LLC',
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
