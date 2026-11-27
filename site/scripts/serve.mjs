// Loopback-only Cloudflare-style preview: clean URLs and _redirects.
import http from 'node:http';
import { createReadStream, existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const requestedRoot = fileURLToPath(new URL('../dist/', import.meta.url));
if (!existsSync(requestedRoot)) {
  console.error('No dist directory; build the site before starting the preview.');
  process.exit(1);
}
const DIST = realpathSync(requestedRoot);
const PORT = Number(process.argv[2] || 4321);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error('Pass a port from 1 to 65535.');
  process.exit(1);
}
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json; charset=utf-8',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject', '.gz': 'application/gzip', '.gzip': 'application/gzip',
  '.tar': 'application/x-tar', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.map': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.mdc': 'text/markdown; charset=utf-8', '.zip': 'application/zip',
};
const redirectsFile = join(DIST, '_redirects');
const rules = existsSync(redirectsFile)
  ? readFileSync(redirectsFile, 'utf8').split('\n').map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#')).map((line) => line.split(/\s+/))
  : [];

function contained(file) {
  const pathname = relative(DIST, file);
  return pathname === '' || (!isAbsolute(pathname) && pathname !== '..' && !pathname.startsWith('..' + sep));
}
function safeFile(pathname) {
  const candidate = resolve(DIST, '.' + pathname);
  if (!contained(candidate)) return { blocked: true };
  if (!existsSync(candidate)) return {};
  const real = realpathSync(candidate);
  if (!contained(real)) return { blocked: true };
  return statSync(real).isFile() ? { file: real } : {};
}
function reply(res, status, message, method = 'GET') {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
  res.end(method === 'HEAD' ? undefined : message);
}
function send(req, res, file) {
  const size = statSync(file).size;
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
    'Content-Length': size,
    'X-Content-Type-Options': 'nosniff',
  });
  if (req.method === 'HEAD') return res.end();
  const stream = createReadStream(file);
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}
function matchRule(pathname) {
  for (const rule of rules) {
    if (rule[0] === pathname) return { rule, destination: rule[1] };
    if (rule[0]?.endsWith('*') && pathname.startsWith(rule[0].slice(0, -1))) {
      return { rule, destination: rule[1].replaceAll(':splat', pathname.slice(rule[0].length - 1)) };
    }
  }
}

const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD');
    return reply(res, 405, 'Method not allowed', req.method);
  }
  let url;
  let pathname;
  try {
    url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    pathname = decodeURIComponent(url.pathname);
    if (pathname.includes(String.fromCharCode(0)) || pathname.includes(String.fromCharCode(92))) throw new Error('Invalid path');
  } catch {
    return reply(res, 400, 'Invalid request path', req.method);
  }
  try {
    const matched = matchRule(pathname);
    if (matched) {
      const status = Number.parseInt(matched.rule[2] || '301', 10);
      if (status === 200) {
        const destination = new URL(matched.destination, url);
        if (destination.origin !== url.origin) return reply(res, 502, 'External rewrites are not supported by this preview', req.method);
        const target = safeFile(decodeURIComponent(destination.pathname));
        if (target.blocked) return reply(res, 403, 'Forbidden', req.method);
        if (!target.file) return reply(res, 404, 'Not found', req.method);
        return send(req, res, target.file);
      }
      if (![301, 302, 303, 307, 308].includes(status)) return reply(res, 500, 'Unsupported redirect rule', req.method);
      // Pages keeps the request's query string when the destination has none of its own
      // (checked on postdelegate.com/auth?utm_source=x, November 2026)
      res.writeHead(status, { Location: matched.destination.includes('?') ? matched.destination : matched.destination + url.search });
      return res.end();
    }
    // Cloudflare serves file-style HTML through extensionless URLs.
    if (pathname.endsWith('.html')) {
      const target = safeFile(pathname);
      if (target.blocked) return reply(res, 403, 'Forbidden', req.method);
      if (target.file) {
        const clean = pathname === '/index.html' ? '/' : pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
        res.writeHead(308, { Location: clean + url.search });
        return res.end();
      }
    }
    if (pathname.length > 1 && pathname.endsWith('/')) {
      const clean = pathname.replace(/\/+$/, '');
      const target = safeFile(clean + '.html');
      if (target.blocked) return reply(res, 403, 'Forbidden', req.method);
      if (target.file) {
        res.writeHead(308, { Location: clean + url.search });
        return res.end();
      }
    }
    for (const candidate of [pathname, pathname + '.html', pathname.replace(/\/$/, '') + '/index.html']) {
      const target = safeFile(candidate);
      if (target.blocked) return reply(res, 403, 'Forbidden', req.method);
      if (target.file) return send(req, res, target.file);
    }
    return reply(res, 404, 'Not found', req.method);
  } catch {
    return reply(res, 500, 'Preview server error', req.method);
  }
});
server.on('error', (error) => {
  console.error(`Preview server failed: ${error.code || 'unknown error'}`);
  process.exitCode = 1;
});
server.listen(PORT, '127.0.0.1', () => console.log(`Previewing dist at http://127.0.0.1:${PORT}`));
