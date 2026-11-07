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

// Copy of CRAWLER_UA from github.com/khanjer496-alt/site-analytics src/lib.ts: only named search and
// AI crawlers are reported, and Pulse does the final classification.
const CRAWLER = /chatgpt-user|oai-searchbot|perplexity-user|perplexitybot|claude-user|claude-searchbot|duckassistbot|mistralai-user|meta-externalfetcher|youbot|gptbot|claudebot|anthropic-ai|ccbot|google-cloudvertexbot|bytespider|amazonbot|applebot-extended|meta-externalagent|cohere-ai|diffbot|ai2bot|petalbot|timpibot|googleother|googlebot|bingbot|applebot|duckduckbot|yandexbot|baiduspider|slurp/i;

export const onRequest = async ({ request, next, waitUntil, passThroughOnException, env }: Context) => {
  passThroughOnException();
  const ua = request.headers.get('User-Agent') ?? '';
  if (env.PULSE_CRAWL_KEY && (request.method === 'GET' || request.method === 'HEAD') && CRAWLER.test(ua)) {
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
