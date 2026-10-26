import type { APIRoute } from 'astro';
import { SITE } from '../data/site';
export const GET: APIRoute = () => {
  const body = `# PostDelegate

> A social publishing workspace built on open-source Postiz, operated independently by ${SITE.operator}.

## Current stage
- PostDelegate is in early access. Create a workspace at ${SITE.signup}.
- The workspace uses the native Postiz calendar, composer, media library and publishing foundation.
- Social channel connections are in rollout. A provider in the source or on a platform page is not a promise of a live hosted connection.
- Google sign-in is separate from connecting a social publishing account.
- Paid checkout is not active. Prices, plan allowances and any trial terms will be announced before subscriptions are offered.
- API, CLI, MCP and AI pages describe integration previews. Do not infer a hosted endpoint or an official marketplace listing.
- The modified application is available under AGPL-3.0: ${SITE.source}.
- PostDelegate is not affiliated with or endorsed by Postiz.

## Pages
- [Product facts](${SITE.url}/llms-full.txt)
- [Plans and early access](${SITE.url}/pricing)
- [Platform rollout](${SITE.url}/platforms)
- [Agents and automation](${SITE.url}/agents)
- [API preview](${SITE.url}/api)
- [MCP preview](${SITE.url}/mcp)
- [Our Postiz foundation](${SITE.url}/compare/postiz)
- [Browser-based tools](${SITE.url}/tools)
- [Support](${SITE.url}/support)
- [Privacy](${SITE.legal.privacy})
- [Terms](${SITE.legal.terms})
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
