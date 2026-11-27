// Renders the share cards into public/og.png and public/og/*.png, from the one
// list in src/data/og-cards.mjs that src/layouts/Base.astro reads too.
//
// Hand-written SVG through sharp, because that is all this needs and it keeps
// the site's dependencies as they are. font-family is sans-serif, as the brand
// card has always been: librsvg resolves it from the machine that builds, and
// the site is built and deployed from one machine (site/scripts/deploy.sh).
import { mkdir, readdir } from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';
import sharp from 'sharp';
import { OG_CARDS, ogCardFor } from '../src/data/og-cards.mjs';

const W = 1200;
const H = 630;
const MARGIN = 74;
// the estimate under-reads by up to 5% (see charWidth), so lines wrap against
// a box narrower than the card by more than that
const MAX_TEXT = (W - MARGIN * 2) * 0.88;

const escape = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// librsvg gives no way to measure text, so widths are estimated per character
// class. Bold sans at these sizes sits near 0.54em on average; the classes
// matter because a line of "Will Mimi win?" and one of "lilt it till" differ by
// more than a third.
//
// Measured against the rendered pixels of all 49 cards, the estimate runs up
// to 5% UNDER the truth on a long line and never more than a few pixels over.
// That is why MAX_TEXT keeps more than that in hand: a line that wraps one
// word early reads fine, a line that runs off the card does not.
const WIDTHS = { narrow: 0.3, wide: 0.86, upper: 0.69, space: 0.28, other: 0.55 };
const charWidth = (ch) => {
  if (ch === ' ') return WIDTHS.space;
  if ('ijltfIr.,:;\'!|[]()'.includes(ch)) return WIDTHS.narrow;
  if ('mwMW@%'.includes(ch)) return WIDTHS.wide;
  if (ch >= 'A' && ch <= 'Z') return WIDTHS.upper;
  return WIDTHS.other;
};
export const textWidth = (text, size) =>
  [...text].reduce((total, ch) => total + charWidth(ch) * size, 0);

// Greedy wrap, then shrink until it fits in `maxLines`. A word longer than the
// line is left alone rather than broken: there is none in the card list, and a
// hyphen inserted by a script reads like a typo.
// A headline set large enough to need three lines is cramped against the rule
// under it and reads worse than the same words a size down, so the big sizes
// are only allowed two lines.
const linesAllowed = (size) => (size >= 68 ? 2 : 3);

const wrap = (title, size) => {
  const lines = [];
  let line = '';
  for (const word of title.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && textWidth(candidate, size) > MAX_TEXT) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
};

export const layout = (title, { sizes = [76, 68, 60, 52, 46] } = {}) => {
  for (const size of sizes) {
    const lines = wrap(title, size);
    if (lines.length <= linesAllowed(size)) return { size, lines };
  }
  // Longer than any size can hold: keep the smallest size's own wrapping and
  // take the lines that fit. Dropping whole lines from a wrapped headline at
  // least leaves the card readable; what it used to do - re-split the title
  // and emit one unwrapped line - ran off the edge of the card.
  const size = sizes[sizes.length - 1];
  return { size, lines: wrap(title, size).slice(0, linesAllowed(size)) };
};

const MARK = `<g transform="translate(61.8 56) scale(1.6)" fill="none"><rect x="18" y="22" width="28" height="25" rx="7" stroke="#F7F7F2" stroke-width="4"/><path d="M25 18v6.5M39 18v6.5" stroke="#F7F7F2" stroke-width="4" stroke-linecap="round"/><circle cx="36" cy="31" r="4.4" fill="#C8FF4D"/><path d="M51.23 24.59A24 8 -21 0 1 54.41 26.9A24 8 -21 0 1 34.87 42.97A24 8 -21 0 1 9.59 44.1A24 8 -21 0 1 12 38.27" stroke="#7357FF" stroke-width="3.6" stroke-linecap="round"/></g>`;
const SPARK = `<path d="M1067 222q4 45 45 49-41 4-45 49-4-45-45-49 41-4 45-49" fill="none" stroke="white" stroke-width="3"/>`;
// on a page card the headline reaches across the top, so the ornament drops to
// the empty bottom right instead of sitting under the words
const SPARK_LOW = `<g transform="translate(0 248)">${SPARK}</g>`;

// The brand card: the default for every page without one of its own, the home
// page included, so its headline is the home page's (h1 and h1Mark of `home` in
// src/i18n/locales/en.ts), with the arc under "approve." like the mark on the page.
const brand = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#0d0d0d"/>${MARK}<text x="185" y="121" fill="white" font-family="sans-serif" font-size="36" font-weight="700">PostDelegate</text><text x="74" y="280" fill="white" font-family="sans-serif" font-size="80" font-weight="800">Your AI drafts.</text><text x="74" y="380" fill="white" font-family="sans-serif" font-size="80" font-weight="800">You approve.</text><path d="M246 400q160-18 318-4" stroke="#b799ff" stroke-width="5" stroke-linecap="round" fill="none"/><text x="74" y="480" fill="#bbb" font-family="sans-serif" font-size="28">Claude or ChatGPT drafts over MCP. PostDelegate posts on time.</text><text x="74" y="565" fill="#fff" font-family="sans-serif" font-size="24">postdelegate.com</text>${SPARK}</svg>`;

export const cardSvg = ({ kicker, title }) => {
  const { size, lines } = layout(title);
  const gap = Math.round(size * 1.22);
  // Centred on the same optical line whatever its height, so a one-line card
  // and a three-line card sit in the same place - but never so high that a
  // three-line headline climbs into the kicker above it.
  const top = Math.max(285, Math.round(355 - ((lines.length - 1) * gap) / 2));
  const text = lines
    .map(
      (line, i) =>
        `<text x="${MARGIN}" y="${top + i * gap}" fill="white" font-family="sans-serif" font-size="${size}" font-weight="800">${escape(line)}</text>`
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#0d0d0d"/>${MARK}<text x="185" y="121" fill="white" font-family="sans-serif" font-size="36" font-weight="700">PostDelegate</text><text x="${MARGIN}" y="212" fill="#C8FF4D" font-family="sans-serif" font-size="26" font-weight="700" letter-spacing="2">${escape(kicker.toUpperCase())}</text>${text}<path d="M${MARGIN} 505h${Math.min(620, Math.round(textWidth(lines[0] || '', size)))}" stroke="#7357FF" stroke-width="5" stroke-linecap="round"/><text x="${MARGIN}" y="565" fill="#fff" font-family="sans-serif" font-size="24">postdelegate.com</text>${SPARK_LOW}</svg>`;
};

// A page added to guides, compare, tools or best without a card would quietly fall
// back to the brand one, which is the thing this set exists to stop. The build
// fails instead.
const checkEveryPageHasOne = async () => {
  const missing = [];
  for (const section of ['guides', 'compare', 'tools', 'best']) {
    for (const name of await readdir(new URL(`../src/pages/${section}`, import.meta.url))) {
      // Astro routes neither an underscore-prefixed file nor an endpoint like
      // foo.md.ts as a page, and index is the section's own card
      if (name.startsWith('_') || name.startsWith('index.')) continue;
      if (name.includes('.') && !/\.(astro|md|mdx)$/.test(name)) continue;
      // a dynamic route checks its own generated pages, as tools/[tool] does in network-tools.ts
      // and best/[list] in best-lists.ts
      if (name.startsWith('[')) continue;
      const path = `/${section}/${name.replace(/\.(astro|md|mdx)$/, '')}`;
      if (!OG_CARDS[path]) missing.push(path);
    }
  }
  if (missing.length) {
    throw new Error(
      `these pages have no share card - add them to src/data/og-cards.mjs:\n  ${missing.join('\n  ')}`
    );
  }
};

const run = async () => {
  await checkEveryPageHasOne();
  // two paths can only differ by where their slashes are (/a/b-c and /a-b/c),
  // and the second written would quietly replace the first
  const files = Object.keys(OG_CARDS).map(ogCardFor);
  if (new Set(files).size !== files.length) {
    throw new Error('two pages want the same card file - rename one of them');
  }
  await mkdir(new URL('../public/og/', import.meta.url), { recursive: true });
  // flat brand colours and antialiased text: a palette halves every card with
  // no visible difference, and these are fetched by every unfurl
  const png = (svg, file) =>
    sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true }).toFile(file);
  // sharp wants a path, not a URL; resolving against import.meta.url keeps the
  // writes independent of the directory the script is run from
  const publicFile = (name) =>
    fileURLToPath(new URL(`../public${name}`, import.meta.url));
  await png(brand, publicFile('/og.png'));
  for (const [path, card] of Object.entries(OG_CARDS)) {
    await png(cardSvg(card), publicFile(ogCardFor(path)));
  }
  console.log(`og: ${Object.keys(OG_CARDS).length + 1} cards`);
};

// pathToFileURL, not a template: a symlinked or space-bearing path does not
// match the raw argv and the script would exit 0 having done nothing, leaving
// whatever cards happened to be in public/ to ship
// argv[1] is undefined when this module is imported rather than run
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run();
}
