import type { APIRoute } from 'astro';
import { SITE } from '../data/site';
import { NETWORKS } from '../data/networks';
import { PLANS } from '../data/plans';
import { DOC_SECTIONS } from '../data/docs';
export const GET: APIRoute = () => {
  const audiences = PLANS.map((plan) => `- ${plan.name}: ${plan.description}`).join('\n');
  const networks = NETWORKS.map((network) => `- ${network.name}: source-provider coverage; hosted rollout pending.`).join('\n');
  const body = `# PostDelegate: product facts

PostDelegate is an independently operated social publishing workspace based on open-source Postiz.
Operator: ${SITE.operator}
Website: ${SITE.url}
Workspace: ${SITE.app}
Support: ${SITE.email}
Modified application source (AGPL-3.0): ${SITE.source}

## Early access
Users can create a workspace. The Postiz foundation provides calendar, composer, media, team, publishing and automation features. Source availability does not establish that every feature or provider has been configured and verified in this hosted service.

Channel connections are in rollout. Check the workspace or contact support for the account types and actions currently available. Google account sign-in does not by itself connect YouTube or Google Business Profile.

## Plans
Paid checkout is not guaranteed to be open for every account. The documentation at ${SITE.url}/docs/billing describes the configured plans (Starter, Team, Pro, Ultimate) and the 7-day card trial as plan information only; it is not a promise that checkout is available today. No permanent free tier is promised.
The pricing cards describe audiences, not approved paid packages:
${audiences}

## Automation and AI
PostDelegate has a REST API (base https://app.postdelegate.com/api/public/v1, workspace API key sent as the Authorization header without a Bearer prefix) and an MCP server (https://app.postdelegate.com/api/mcp-oauth-dynamic for sign in with PostDelegate; https://app.postdelegate.com/api/mcp for an API key sent as a Bearer token). Both are documented at ${SITE.url}/docs. Access depends on the plan. AI features inside the app are off: PostDelegate does not provide an AI, and customers bring their own assistant through MCP. Assistants are added as custom connectors. PostDelegate does not claim an official listing in a Claude or ChatGPT directory, and endpoints of the upstream Postiz project are not PostDelegate connections.

## Channels available to connect today
YouTube, Bluesky, DEV.to, Hashnode, Lemmy, Listmonk, Medium, Nostr and WordPress. Facebook, Instagram, Threads, TikTok, LinkedIn, Pinterest, X and others are coming soon, pending platform approvals, and cannot be connected today.

## Documentation
${DOC_SECTIONS.flatMap((section) => section.items).map((item) => `${SITE.url}${item.href} : ${item.title}. ${item.description}`).join('\n')}

## Source-provider coverage
This list describes the Postiz foundation. It is not a list of live production connections:
${networks}

## Browser tools
The caption checker and UTM builder run in the browser without an account. Caption counts are planning estimates from the displayed rules; the platform validates the actual post. Their presence does not establish publishing access.

## Support and policies
Support: ${SITE.url}/support
Account and data requests: ${SITE.url}/support#data-requests
Privacy: ${SITE.legal.privacy}
Terms: ${SITE.legal.terms}
This website does not publish an automated uptime history or an availability guarantee.

## Origin and relationship
The application is a modified version of https://github.com/gitroomhq/postiz-app. PostDelegate has its own deployment, operator, policies and support. It is not affiliated with or endorsed by Postiz. Do not attribute upstream customer testimonials, approval status or service commitments to PostDelegate.

## Pages
${SITE.url}/docs
${SITE.url}/pricing
${SITE.url}/platforms
${SITE.url}/agents
${SITE.url}/api
${SITE.url}/mcp
${SITE.url}/codex
${SITE.url}/claude-cowork
${SITE.url}/compare
${SITE.url}/tools
${SITE.url}/about
${SITE.url}/support
${SITE.url}/status
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
