import type { APIRoute } from 'astro';
import { SITE } from '../data/site';
import { NETWORKS } from '../data/networks';
import { PLANS } from '../data/plans';
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
Paid checkout is not active. No prices, paid packages, permanent free tier, trial period, channel limits, AI allowance or API quota is promised by these pages. Subscription details will be announced before checkout opens.
The pricing cards describe audiences, not approved paid packages:
${audiences}

## Automation and AI
The upstream Postiz project has API, CLI and MCP interfaces and AI features. PostDelegate's pages are integration previews while hosted behavior is qualified. We do not publish setup commands, a hosted MCP URL or scoped-token guarantees here. An official upstream Postiz connector or cloud endpoint is not automatically a PostDelegate connection.

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
