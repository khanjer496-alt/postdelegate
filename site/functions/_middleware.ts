// Cloudflare Pages middleware for every HTML route (see public/_routes.json; static assets are
// excluded there). When the User-Agent looks like a search or AI crawler, it reports the hit to
// Pulse (our analytics, https://pulse.nasidaapps.com) in the background. Crawlers don't run
// JavaScript, so the page tag never sees them. The response itself is never touched.
// If the Functions quota runs out, Pages fails open and serves the static files.
interface Context {
  request: Request;
  next: () => Promise<Response>;
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException: () => void;
  env: { PULSE_CRAWL_KEY?: string };
}

// Cheap prefilter only; Pulse does the real classification and ignores anything it doesn't know.
const CRAWLER = /bot|crawl|spider|slurp|gpt|claude|anthropic|perplexity|ccbot|bytespider|duckassist|mistralai|meta-external|cohere|diffbot|timpibot|google-cloudvertex|oai-search/i;

export const onRequest = async ({ request, next, waitUntil, passThroughOnException, env }: Context) => {
  passThroughOnException();
  const ua = request.headers.get('User-Agent') ?? '';
  if (env.PULSE_CRAWL_KEY && CRAWLER.test(ua)) {
    const path = new URL(request.url).pathname;
    waitUntil(
      fetch('https://pulse.nasidaapps.com/crawl', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.PULSE_CRAWL_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ site: 'postdelegate', ua, path }),
      }).catch(() => undefined),
    );
  }
  return next();
};
