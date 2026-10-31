import type { APIRoute } from 'astro';
import { SITE } from '../data/site';
import { DOC_SECTIONS } from '../data/docs';
export const GET: APIRoute = () => {
  const body = `# PostDelegate

> An open-source social publishing workspace, operated independently by ${SITE.operator}.

## Current stage
- PostDelegate is in early access. Start a 7-day free trial, no credit card needed, at ${SITE.signup}.
- The workspace includes a calendar, composer, media library and publishing workflow.
- Social channel connections are in rollout. A provider in the source or on a platform page is not a promise of a live hosted connection.
- Google sign-in is separate from connecting a social publishing account.
- Plans: Starter $19, Team $29, Pro $39 and Ultimate $79 per month ($180, $276, $372 and $756 per year, US dollars). Every plan starts with a 7-day free trial that needs no credit card. Add a card any time before the trial ends to keep the plan; the first payment is taken when the trial ends. If the trial ends without a card, the workspace is paused until a plan is chosen; posts are kept, and channels and team members are switched back on on subscribing. One free trial per email address. Details at ${SITE.url}/pricing and ${SITE.url}/docs/billing.
- Documentation is at ${SITE.url}/docs. The REST API base is https://app.postdelegate.com/api/public/v1 and the MCP server is https://app.postdelegate.com/mcp-oauth-dynamic. PostDelegate has no official marketplace listing in Claude or ChatGPT; assistants are added as custom connectors.
- AI features inside the app are off. Customers bring their own AI assistant through MCP.
- Connectable channels today: YouTube, Bluesky, DEV.to, Hashnode, Lemmy, Listmonk, Medium, Nostr, WordPress and Kick. Facebook, Instagram, Threads, TikTok, LinkedIn, Pinterest, X and others are coming soon, pending platform approvals.
- The application is open source under AGPL-3.0: ${SITE.source}. It is based on the Postiz project; PostDelegate is not affiliated with or endorsed by Postiz.

## Documentation
${DOC_SECTIONS.flatMap((section) => section.items).map((item) => `- [${item.title}](${SITE.url}${item.href}): ${item.description}`).join('\n')}

## Pages
- [Product facts](${SITE.url}/llms-full.txt)
- [Plans and pricing](${SITE.url}/pricing)
- [Platform rollout](${SITE.url}/platforms)
- [Agents and automation](${SITE.url}/agents)
- [REST API](${SITE.url}/api)
- [MCP](${SITE.url}/mcp)
- [Open-source origins](${SITE.url}/compare/postiz)
- [Browser-based tools](${SITE.url}/tools)
- [Support](${SITE.url}/support)
- [Privacy](${SITE.legal.privacy})
- [Terms](${SITE.legal.terms})
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
