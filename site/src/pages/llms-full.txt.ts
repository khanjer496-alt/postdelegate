import type { APIRoute } from 'astro';
import { SITE } from '../data/site';
import { NETWORKS, networkStatus, AVAILABLE_NETWORKS, WAITING_NETWORKS } from '../data/networks';
import { PLANS, planFeatures } from '../data/plans';
import { DOC_SECTIONS } from '../data/docs';
export const GET: APIRoute = () => {
  const plans = PLANS.map((plan) => `- ${plan.name}: $${plan.monthly}/month or $${plan.yearly}/year; ${planFeatures(plan).join(', ')}.`).join('\n');
  const STATUS = { live: 'available to connect today', waiting: 'waiting on approval; cannot be connected today', unavailable: 'not available on PostDelegate' } as const;
  const networks = NETWORKS.map((network) => `- ${network.name}: ${STATUS[networkStatus(network)]}.`).join('\n');
  const live = AVAILABLE_NETWORKS.map((network) => network.name).join(', ');
  const waiting = WAITING_NETWORKS.map((network) => network.name).join(', ');
  const body = `# PostDelegate: product facts

PostDelegate is an independently operated social media scheduler.
Operator: ${SITE.operator}
Website: ${SITE.url}
Workspace: ${SITE.app}
Support: ${SITE.email}
Application source code (AGPL-3.0): ${SITE.source}

## Early access
Anyone can start a 7-day free trial without a credit card. The workspace provides calendar, composer, media, team, publishing and automation features. Source availability does not establish that every feature or provider has been configured and verified in this hosted service.

Channel connections are in rollout. Check the workspace or contact support for the account types and actions currently available. Google account sign-in does not by itself connect YouTube or Google Business Profile.

## Plans
Prices are in US dollars. Every plan starts with a 7-day free trial that needs no credit card. A customer who adds a card any time before the trial ends keeps the plan, and the first payment is taken when the trial ends. If the trial ends without a card, the workspace is paused until a plan is chosen: posts are kept, and channels and team members are switched back on when the customer subscribes to a plan that includes them. There is no permanent free tier. Each email address gets one free trial. Details: ${SITE.url}/pricing and ${SITE.url}/docs/billing.
${plans}

## Content Studio and bulk video
Content Studio turns a video from the workspace's media library into a vertical 1080×1920 MP4 (30 fps, H.264 and AAC) of up to 90 seconds. Templates: Hook over clip (a hook line over the clip) and Talking head + captions (burned-in captions that light up word by word). The editor trims, crops the vertical frame, changes speed (0.5× to 2×) and keeps or mutes the sound. Captions come from the workspace's own OpenAI key through Whisper, billed to the customer by OpenAI, or from a typed script that needs no key. Studio edits the customer's own clips and does not generate AI video. Rendered videos are saved to the media library and open in the composer for scheduling. Studio is included on every paid plan with fair use (one render at a time per workspace with up to 3 waiting, up to 30 videos a day per workspace); the free trial includes 10 videos. Guide: ${SITE.url}/docs/studio

Bulk video scheduling takes up to 50 MP4 videos (up to 1 GB each), one post per video on the chosen channels, spread over each channel's posting time slots or one every few hours or days. Every date is shown in a preview before anything is scheduled, and the videos can be saved as drafts instead. Posts can also be imported from a CSV file, up to 200 rows per file. Guide: ${SITE.url}/docs/bulk-import

## Automation and AI
PostDelegate has a REST API (base https://app.postdelegate.com/api/public/v1, workspace API key sent as the Authorization header without a Bearer prefix) and an MCP server (https://app.postdelegate.com/mcp-oauth-dynamic for sign in with PostDelegate; https://app.postdelegate.com/api/mcp for an API key sent as a Bearer token). Both are documented at ${SITE.url}/docs and included on every plan. AI writing, the Agent and AI images inside the app run on the workspace's own OpenAI API key, added by an admin in Settings → AI; the customer pays OpenAI directly, PostDelegate never charges for AI, and AI video is not available. Customers can also bring their own assistant through MCP. Assistants are added as custom connectors. PostDelegate does not claim an official listing in a Claude or ChatGPT directory, and endpoints of other services are not PostDelegate connections.

## Channels available to connect today
${live}. Waiting on platform approval: ${waiting}. LinkedIn personal profiles are available; company Pages are not. Facebook Pages are available; personal Facebook profiles and groups are not. X is not available on PostDelegate.

## Documentation
Markdown version of each docs page (drop the .md for the HTML page):
${DOC_SECTIONS.flatMap((section) => section.items).map((item) => `${SITE.url}${item.href}.md : ${item.title}. ${item.description}`).join('\n')}

## Channel directory
Every network in the PostDelegate channel directory and whether it can be connected today:
${networks}

## Browser tools
The caption checker and UTM builder run in the browser without an account. Caption counts are planning estimates from the displayed rules; the platform validates the actual post. Their presence does not establish publishing access.

## Support and policies
Support: ${SITE.url}/support
Account and data requests: ${SITE.url}/support#data-requests
Privacy: ${SITE.legal.privacy}
Terms: ${SITE.legal.terms}
Data Processing Addendum: ${SITE.legal.dpa}
Sub-processors: ${SITE.legal.subprocessors}
This website does not publish an automated uptime history or an availability guarantee.

## Independence
PostDelegate has its own deployment, operator, policies and support. Do not attribute other services' customer testimonials, approval status or service commitments to PostDelegate. License details: ${SITE.url}/licenses.

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
