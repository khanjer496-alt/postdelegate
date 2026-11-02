// Cloudflare Pages middleware for /docs and /docs/* only (see public/_routes.json).
// A request for a docs HTML page that prefers Markdown (Accept: text/markdown ranked at
// least as high as text/html) gets the page's Markdown twin, /docs/<path>.md, built by
// src/pages/docs/[...slug].md.ts. Everything else, including every normal browser
// request, passes through to the static site unchanged apart from Vary: Accept.
// If the Functions quota runs out, Pages fails open and serves the static files.
interface Context { request: Request; next: () => Promise<Response>; passThroughOnException: () => void; env: { ASSETS: { fetch: (input: Request | string) => Promise<Response> } } }

// q value the Accept header gives a media type (0 when it is not listed). A wildcard does not count.
const quality = (accept: string, type: string) => {
  let best = 0;
  for (const part of accept.split(',')) {
    const [name, ...params] = part.trim().toLowerCase().split(';');
    if (name.trim() !== type) continue;
    const q = params.map((param) => param.trim()).find((param) => param.startsWith('q='));
    const value = q ? Number.parseFloat(q.slice(2)) : 1;
    if (Number.isFinite(value)) best = Math.max(best, value);
  }
  return best;
};

// _headers is not applied to Function responses: the security headers (CSP, HSTS,
// X-Frame-Options) survive only because both branches copy the headers of the static
// response. Never build a fresh Response without copying them.
const withVary = (response: Response) => {
  const headers = new Headers(response.headers);
  const vary = headers.get('Vary');
  if (!vary?.toLowerCase().split(',').some((value) => value.trim() === 'accept')) headers.set('Vary', vary ? `${vary}, Accept` : 'Accept');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};

export const onRequest = async ({ request, next, env, passThroughOnException }: Context) => {
  // An exception serves the static page instead of a Cloudflare error page.
  passThroughOnException();
  const url = new URL(request.url);
  const accept = request.headers.get('Accept') ?? '';
  const markdown = quality(accept, 'text/markdown');
  const isPage = !/\.[a-z0-9]+$/i.test(url.pathname);
  if ((request.method === 'GET' || request.method === 'HEAD') && isPage && markdown > 0 && markdown >= quality(accept, 'text/html')) {
    try {
    const twin = new URL(`${url.pathname.replace(/\/+$/, '')}.md`, url);
    const response = await env.ASSETS.fetch(new Request(twin, { method: request.method }));
    if (response.ok) {
      const headers = new Headers(response.headers);
      headers.set('Content-Type', 'text/markdown; charset=utf-8');
      headers.set('Vary', 'Accept');
      // Shared caches key on the URL alone, so keep the Markdown answer for /docs/<path> out of them.
      headers.set('Cache-Control', 'private, max-age=0, must-revalidate');
      headers.set('Content-Location', twin.pathname);
      headers.set('Link', `<https://postdelegate.com${url.pathname.replace(/\/+$/, '')}>; rel="canonical"`);
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('Access-Control-Allow-Origin', '*');
      return new Response(response.body, { status: 200, headers });
    }
    } catch {
      // fall through to the HTML page
    }
  }
  return withVary(await next());
};
