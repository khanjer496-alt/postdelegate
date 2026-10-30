import type { APIRoute } from 'astro';
import { SITE } from '../data/site';
import { DOC_SECTIONS } from '../data/docs';
export const GET: APIRoute = () => {
  const body = `# PostDelegate

> A social publishing workspace built on open-source Postiz, operated independently by ${SITE.operator}.

## Current stage
- PostDelegate is in early access. Create a workspace at ${SITE.signup}.
- The workspace uses the native Postiz calendar, composer, media library and publishing foundation.
- Social channel connections are in rollout. A provider in the source or on a platform page is not a promise of a live hosted connection.
- Google sign-in is separate from connecting a social publishing account.
- Paid checkout is not guaranteed to be open for every account. Plan information (Starter, Team, Pro, Ultimate) and the 7-day card trial are described at ${SITE.url}/docs/billing as plan information, not a promise of checkout availability.
- Documentation is at ${SITE.url}/docs. The REST API base is https://app.postdelegate.com/api/public/v1 and the MCP server is https://app.postdelegate.com/mcp-oauth-dynamic. PostDelegate has no official marketplace listing in Claude or ChatGPT; assistants are added as custom connectors.
- AI features inside the app are off. Customers bring their own AI assistant through MCP.
- Connectable channels today: YouTube, Bluesky, DEV.to, Hashnode, Lemmy, Listmonk, Medium, Nostr and WordPress. Facebook, Instagram, Threads, TikTok, LinkedIn, Pinterest, X and others are coming soon, pending platform approvals.
- The modified application is available under AGPL-3.0: ${SITE.source}.
- PostDelegate is not affiliated with or endorsed by Postiz.

## Documentation
${DOC_SECTIONS.flatMap((section) => section.items).map((item) => `- [${item.title}](${SITE.url}${item.href}): ${item.description}`).join('\n')}

## Pages
- [Product facts](${SITE.url}/llms-full.txt)
- [Plans and early access](${SITE.url}/pricing)
- [Platform rollout](${SITE.url}/platforms)
- [Agents and automation](${SITE.url}/agents)
- [REST API](${SITE.url}/api)
- [MCP](${SITE.url}/mcp)
- [Our Postiz foundation](${SITE.url}/compare/postiz)
- [Browser-based tools](${SITE.url}/tools)
- [Support](${SITE.url}/support)
- [Privacy](${SITE.legal.privacy})
- [Terms](${SITE.legal.terms})
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
