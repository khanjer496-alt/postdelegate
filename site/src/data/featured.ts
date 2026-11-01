// "Featured on" badges in the footer of every page. Each `html` is the directory's own snippet,
// pasted exactly as given: some listings (Fazier, Startup Fame, Launch Llama) are only kept while
// their badge is in the server-rendered HTML, with a followed link. Do not add rel="nofollow".
// To add a directory, append one entry with its snippet.
export interface FeaturedBadge { name: string; html: string }

export const FEATURED_ON: FeaturedBadge[] = [
  {
    name: 'Fazier',
    html: '<a href="https://fazier.com" target="_blank"><img src="https://fazier.com/api/v1//public/badges/launch_badges.svg?badge_type=launched&theme=light" width=120 alt="Fazier badge" /></a>',
  },
];
