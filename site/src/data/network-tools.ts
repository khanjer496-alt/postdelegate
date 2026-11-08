// Per-network free tools: /tools/<network>-character-counter and /tools/<network>-image-resizer.
// A counter exists only where the limit in networks.ts is the platform's own rule for one post or
// message; networks whose limit is only PostDelegate's planning cap (Medium, WordPress, Listmonk,
// DEV.to, Nostr, ...) get none. A resizer exists for every network with a preset in image-sizes.ts.
import { NETWORKS, type Network } from './networks';
import { RESIZER_GROUPS } from './image-sizes';
import { ogCardFor } from './og-cards.mjs';

/** What the limit applies to, and anything a writer should know about it. */
export const COUNTERS: Record<string, { what: string; detail?: string }> = {
  instagram: { what: 'caption' },
  facebook: { what: 'post', detail: 'Most of that is hidden behind “See more”, so put the point in the first lines.' },
  linkedin: { what: 'post', detail: 'LinkedIn shows the first few lines and hides the rest behind “…more”.' },
  tiktok: { what: 'caption', detail: 'When TikTok opens on PostDelegate, it will send captions of up to 2,000 characters.' },
  youtube: { what: 'video description', detail: 'The video title is separate and can have up to 100 characters.' },
  x: { what: 'post', detail: 'Premium accounts can write up to 25,000.' },
  threads: { what: 'post' },
  bluesky: { what: 'post' },
  pinterest: { what: 'Pin description' },
  mastodon: { what: 'post', detail: 'That is the limit on mastodon.social. Other Mastodon servers can set their own.' },
  google_business: { what: 'update' },
  reddit: { what: 'post body', detail: 'The title is separate and can have up to 300 characters. Reddit is not available on PostDelegate.' },
  telegram: { what: 'message', detail: 'With a photo, video or file attached, the caption is limited to 1,024 characters.' },
  discord: { what: 'message', detail: 'Discord allows 2,000; PostDelegate keeps a small margin and sends up to 1,980.' },
  slack: { what: 'message', detail: 'PostDelegate sends up to 4,000 characters, the length Slack recommends for one message.' },
  twitch: { what: 'chat message', detail: 'Through PostDelegate a message can also go out as an announcement, highlighted in chat in Primary, Blue, Green, Orange or Purple.' },
  kick: { what: 'chat message', detail: 'Kick chat messages are text only. Through PostDelegate, extra entries in a post are sent as replies to the first message.' },
};

/** How each counting rule treats emoji, links and other scripts, for the counter pages. */
export const UNIT_NOTES: Record<string, string> = {
  weighted: 'X weights characters: Latin, Cyrillic, Greek, Arabic, Hebrew and most other alphabets count as 1; Chinese, Japanese, Korean and emoji count as 2; and every link counts as 23 however long it is.',
  graphemes: 'Bluesky counts graphemes, the characters you see, so an emoji or a flag counts as 1.',
  codepoints_emoji_bytes: 'Threads counts an emoji as its UTF-8 byte length, so most emoji count as 4.',
  utf16: 'TikTok counts UTF-16 units, so many emoji count as 2.',
  utf8_bytes: 'YouTube counts UTF-8 bytes, so accented letters count as 2 and many other scripts and emoji as 3 or 4.',
  codepoints: 'Each Unicode character counts as 1. Some emoji are built from several characters, such as a skin tone or a family, and count as more.',
};
export const MASTODON_NOTE = 'Every link counts as 23 characters however long it is, and a mention of someone on another server counts as just @user.';

/** "an Instagram caption", "an X post", "a TikTok caption". */
export const article = (word: string) => (/^(?:[aeiou]|X\b)/i.test(word) ? 'an' : 'a');
/** "Listmonk (email)" reads as "Listmonk" in a headline. */
export const toolName = (n: Network) => n.name.replace(/\s*\(.*\)$/, '');
const slug = (n: Network) => n.key.replace(/_/g, '-');
export const counterHref = (n: Network) => `/tools/${slug(n)}-character-counter`;
export const resizerHref = (n: Network) => `/tools/${slug(n)}-image-resizer`;
export const COUNTER_NETWORKS = NETWORKS.filter((n) => COUNTERS[n.key]);
export const RESIZER_NETWORKS = NETWORKS.filter((n) => RESIZER_GROUPS.some((group) => group.items.some((item) => item[4] === n.key)));
// scripts/og.mjs cannot see the pages a dynamic route generates, so every one must have a share
// card in og-cards.mjs or the build fails here.
const noCard = [...COUNTER_NETWORKS.map(counterHref), ...RESIZER_NETWORKS.map(resizerHref)].filter((href) => !ogCardFor(href));
if (noCard.length) throw new Error(`these tool pages have no share card - add them to src/data/og-cards.mjs:\n  ${noCard.join('\n  ')}`);
