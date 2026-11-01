// Verify a built site against scripts/serve.mjs, plus the public app entry points.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const BASE = new URL(process.env.PD_SITE_BASE || 'http://127.0.0.1:4321');
const SITE_ORIGINS = new Set(['https://postdelegate.com', 'https://www.postdelegate.com']);
const APP = 'https://app.postdelegate.com';
const APP_PATHS = ['/auth', '/auth/login', '/legal/privacy/', '/legal/terms/', '/source'];
const USER_AGENT = 'PostDelegate-Site-QA/1.0 (public links and assets; no authentication)';
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;
const legacyPaths = [
  '/', '/about', '/terms', '/privacy', '/licenses', '/support', '/data-deletion',
  '/status', '/agents', '/mcp', '/api', '/claude-cowork', '/codex', '/platforms',
  '/instagram-scheduler', '/linkedin-scheduler', '/facebook-scheduler',
  '/tiktok-scheduler', '/youtube-scheduler', '/bluesky-scheduler',
  '/threads-scheduler', '/pinterest-scheduler', '/google-business-scheduler',
  '/mastodon-scheduler', '/devto-scheduler', '/tools', '/tools/caption-checker',
  '/tools/utm-builder', '/compare', '/compare/postiz', '/compare/post-bridge',
  '/sitemap.xml', '/llms.txt', '/llms-full.txt', '/docs/mcp/agent-files',
  '/agents/postdelegate/SKILL.md', '/agents/postdelegate-skill.zip', '/agents/AGENTS.md',
  '/agents/chatgpt-instructions.md', '/agents/postdelegate.mdc',
];

const queue = new Map();
const anchors = new Map();
const requestCache = new Map();
const ignoredExternal = new Set();
const errors = new Set();
let redirectCount = 0;
let verifiedAnchors = 0;

function label(value) {
  const url = new URL(value);
  return `${url.origin === BASE.origin ? '' : url.origin}${url.pathname}${url.hash}`;
}
function fail(message) { errors.add(message); }
function withoutHash(value) {
  const url = new URL(value);
  url.hash = '';
  return url.href;
}
function normalize(value, parent = BASE) {
  const url = new URL(value, parent);
  if (!['http:', 'https:'].includes(url.protocol)) return null;
  if (SITE_ORIGINS.has(url.origin)) return new URL(url.pathname + url.search + url.hash, BASE);
  return url;
}
function decodeEntities(value) {
  return value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, (entity) => {
    const named = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
    if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
    const hex = /^&#x/i.test(entity);
    const code = Number.parseInt(entity.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
    return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  });
}
function attributes(source) {
  const values = {};
  const expression = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of source.matchAll(expression)) values[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4]);
  return values;
}
function addReference(raw, parent, kind = 'local') {
  const value = raw.trim();
  if (!value || /^(?:data|blob|mailto|tel|javascript):/i.test(value)) return;
  let url;
  try { url = normalize(value, parent); }
  catch { fail(`Invalid URL in ${label(parent)}`); return; }
  if (!url) return;
  const liveApp = url.origin === APP && APP_PATHS.includes(url.pathname);
  if (url.origin !== BASE.origin && !liveApp) {
    ignoredExternal.add(withoutHash(url));
    return;
  }
  const key = withoutHash(url);
  if (!queue.has(key)) queue.set(key, liveApp ? 'app' : kind);
  if (url.origin === BASE.origin && url.hash.length > 1) {
    const identity = key + url.hash;
    if (!anchors.has(identity)) anchors.set(identity, url);
  }
}
function parseDocument(source, parent) {
  const ids = new Set();
  const html = source.replace(/<!--[\s\S]*?-->/g, '');
  for (const match of html.matchAll(/<([a-z][\w:-]*)\b([^>]*)>/gi)) {
    const tag = match[1].toLowerCase();
    const attrs = attributes(match[2]);
    if (attrs.id) ids.add(attrs.id);
    if (tag === 'a' && attrs.name) ids.add(attrs.name);
    for (const attribute of ['href', 'src', 'poster']) {
      if (attrs[attribute]) addReference(attrs[attribute], parent);
    }
    if (attrs.srcset && !attrs.srcset.trim().startsWith('data:')) {
      for (const candidate of attrs.srcset.split(',')) {
        const url = candidate.trim().split(/\s+/)[0];
        if (url) addReference(url, parent);
      }
    }
  }
  return ids;
}
function parseCss(source, parent) {
  for (const match of source.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]*))\s*\)/gi)) {
    addReference(match[1] ?? match[2] ?? match[3] ?? '', parent);
  }
}
function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const file = join(directory, name);
    return statSync(file).isDirectory() ? walk(file) : [file];
  });
}
function pageUrl(file) {
  const pathname = '/' + relative(DIST, file).split(sep).join('/');
  return new URL(pathname === '/index.html' ? '/' : pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, ''), BASE);
}
async function request(value) {
  const key = withoutHash(value);
  if (!requestCache.has(key)) {
    requestCache.set(key, (async () => {
      try {
        const response = await fetch(key, {
          redirect: 'manual',
          headers: { 'User-Agent': USER_AGENT },
          signal: AbortSignal.timeout(20_000),
        });
        const type = response.headers.get('content-type') || '';
        const isLocalText = new URL(key).origin === BASE.origin && /text\/html|image\/svg\+xml|text\/css/i.test(type);
        const body = response.status === 200 && isLocalText ? await response.text() : '';
        if (!isLocalText || response.status !== 200) await response.body?.cancel().catch(() => {});
        return { status: response.status, location: response.headers.get('location'), type, body };
      } catch (error) {
        return { status: 0, error: error?.name === 'TimeoutError' ? 'request timed out' : 'network request failed' };
      }
    })());
  }
  return requestCache.get(key);
}
async function follow(value) {
  let url = new URL(value);
  const visited = new Set();
  for (let hops = 0; hops <= MAX_REDIRECTS; hops++) {
    const key = withoutHash(url);
    if (visited.has(key)) return { url, error: 'redirect loop' };
    visited.add(key);
    const result = await request(url);
    if (!REDIRECTS.has(result.status)) return { ...result, url };
    if (!result.location) return { url, error: `HTTP ${result.status} without Location` };
    if (hops === MAX_REDIRECTS) return { url, error: `more than ${MAX_REDIRECTS} redirects` };
    let next;
    try { next = normalize(result.location, url); }
    catch { return { url, error: 'invalid redirect Location' }; }
    if (!next) return { url, error: 'unsupported redirect protocol' };
    if (!result.location.includes('#')) next.hash = url.hash;
    url = next;
    redirectCount++;
  }
}
function fragmentExists(result, fragment) {
  if (!result.body || !/text\/html|image\/svg\+xml/i.test(result.type || '')) return false;
  let id;
  try { id = decodeURIComponent(fragment.slice(1)); }
  catch { return false; }
  // Text fragments do not refer to element IDs.
  if (id.startsWith(':~:text=')) return true;
  id = id.split(':~:text=')[0];
  return parseDocument(result.body, result.url).has(id);
}

try {
  if (!['http:', 'https:'].includes(BASE.protocol)) throw new Error('PD_SITE_BASE must be HTTP or HTTPS');
  const pages = walk(DIST).filter((file) => extname(file) === '.html');
  if (!pages.length) throw new Error('No built HTML files found; build the site first');
  for (const pathname of legacyPaths) addReference(pathname, BASE, 'page');
  for (const pathname of APP_PATHS) addReference(APP + pathname, BASE, 'app');
  for (const file of pages) {
    const url = pageUrl(file);
    addReference(url.href, BASE, 'page');
    parseDocument(readFileSync(file, 'utf8'), url);
  }
  let pagesChecked = 0;
  let assetsChecked = 0;
  let appChecked = 0;
  for (const [value, kind] of queue) {
    const result = await follow(value);
    if (kind === 'app') appChecked++;
    else if (/text\/html/i.test(result.type || '')) pagesChecked++;
    else assetsChecked++;
    if (result.error || result.status !== 200) {
      fail(`${label(value)}: ${result.error || `HTTP ${result.status}`}`);
      continue;
    }
    if (result.url.origin === BASE.origin && result.body) {
      if (/text\/html|image\/svg\+xml/i.test(result.type)) parseDocument(result.body, result.url);
      if (/text\/css/i.test(result.type)) parseCss(result.body, result.url);
      if (result.url.hash.length > 1 && !fragmentExists(result, result.url.hash)) fail(`${label(value)}: redirect target anchor missing`);
    }
  }
  for (const url of anchors.values()) {
    const result = await follow(url);
    if (result.status === 200 && result.url.origin === BASE.origin && fragmentExists(result, result.url.hash)) verifiedAnchors++;
    else fail(`${label(url)}: anchor missing or target unavailable`);
  }
  for (const error of errors) console.error(`FAIL ${error}`);
  console.log(`Checked ${pagesChecked} local pages, ${assetsChecked} local assets/routes, ${appChecked} live app URLs, ${verifiedAnchors} anchors; ${errors.size} errors.`);
  console.log(`${requestCache.size} unique HTTP requests; ${redirectCount} redirects followed (maximum ${MAX_REDIRECTS} per URL); ${ignoredExternal.size} other external URLs skipped.`);
  if (errors.size) process.exitCode = 1;
} catch (error) {
  console.error(`Site check failed: ${error.message}`);
  process.exitCode = 1;
}
