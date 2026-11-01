---
layout: ../../layouts/DocsLayout.astro
title: MCP overview
description: Connect your own AI assistant to PostDelegate over MCP so it can look at your channels, draft posts and schedule them with your approval.
---

MCP, the Model Context Protocol, is a standard way for an AI assistant to use tools in another service. PostDelegate runs an MCP server. Once your assistant is connected it can list your channels, read the rules of each network, upload media, create drafts and scheduled posts, and look at what is already on your calendar.

<div class="callout">

**Bring your own assistant.** PostDelegate does not provide an AI of its own: AI inside the app runs on your workspace's own OpenAI API key, added by an admin in **Settings → AI**. MCP is how you use the assistant you already have, such as Claude, ChatGPT or an editor like Cursor, with your calendar. Any usage costs on the assistant's side are between you and its provider.

</div>

## Pick your assistant

<div class="card-grid">
<a href="/docs/mcp/claude"><strong>Claude</strong><span>Add a custom connector in claude.ai.</span></a>
<a href="/docs/mcp/chatgpt"><strong>ChatGPT</strong><span>Add a custom connector in ChatGPT.</span></a>
<a href="/docs/mcp/clients"><strong>Claude Code, Cursor and others</strong><span>JSON, TOML and command-line setup.</span></a>
<a href="/docs/mcp/tools"><strong>Tools reference</strong><span>What the server lets an assistant do.</span></a>
</div>

## Teach your assistant the workflow

PostDelegate hosts ready-made instruction files: a [Claude skill](/agents/postdelegate/SKILL.md), an [AGENTS.md](/agents/AGENTS.md) for coding agents, [ChatGPT instructions](/agents/chatgpt-instructions.md) and a [Cursor rule](/agents/postdelegate.mdc). Each one teaches an assistant the channel, rules, media and draft workflow and the safety rules. See [Agent files](/docs/mcp/agent-files) for how to install each one.

## Server addresses

The MCP server lives under the API origin, `https://app.postdelegate.com/api`. It uses the streamable HTTP transport.

| Address | Sign-in | Use it for |
| --- | --- | --- |
| `https://app.postdelegate.com/mcp-oauth-dynamic` | Sign in with PostDelegate (OAuth) | **Recommended.** Claude, ChatGPT, Claude Code, Cursor and any client that can register itself. |
| `https://app.postdelegate.com/api/mcp` | API key as `Authorization: Bearer YOUR_API_KEY` (the bare key works too), or OAuth | Clients and scripts that can set a header. |
| `https://app.postdelegate.com/api/mcp/YOUR_API_KEY` | API key inside the address | Clients that can only take a URL. |

Settings > Agents / Dev in the app shows these with your own values filled in, ready to copy. If it shows a different base address than this page, use the one from the app.

MCP directories and clients that discover servers on their own read the server card at `https://app.postdelegate.com/.well-known/mcp/server-card.json` (also served as `/.well-known/mcp.json`) and the OAuth metadata at `https://app.postdelegate.com/.well-known/oauth-protected-resource`.

Other addresses exist for directory listings of specific assistants (`/mcp-oauth-claude`, `/mcp-oauth-chatgpt`, `/mcp-oauth`) and a legacy server-sent-events address (`/sse/YOUR_API_KEY`). You should not need them.

## Two ways to sign in

### Sign in with PostDelegate (OAuth)

You add the server address to your assistant. The assistant opens a PostDelegate page in your browser, you sign in and approve, and the assistant gets its own token for your workspace. You never copy an API key.

- The client registers itself using dynamic client registration and PKCE (S256). The scopes are `mcp:read` and `mcp:write`.
- Web assistants may only register callback addresses on claude.ai, claude.com, chatgpt.com or openai.com (and their subdomains), plus the MCP directories Smithery (smithery.ai, smithery.run), Glama (glama.ai) and Vercel Connect (`https://connect.vercel.com/callback`). Local tools can register `http://localhost`, `http://127.0.0.1` or `http://[::1]` callbacks, or a private-use scheme such as `cursor://`, as native apps do.
- Approvals appear under **Settings > Apps > Approved Apps**. Choose **Revoke** to cut an assistant off. These tokens do not expire on their own, so revoking is how you end access.

### API key

Use the workspace [API key](/docs/api#authentication) from **Settings > Agents / Dev**. This works anywhere, but the key is as powerful as your account, so prefer OAuth where the client supports it. At `/mcp` send it as `Authorization: Bearer YOUR_API_KEY`. The bare key, the way the REST API takes it, works at `/mcp` too.

Rotating the key invalidates it everywhere.

## Staying in control

An assistant connected over MCP can do what the tools allow, which includes scheduling, publishing and deleting posts on your connected channels.

- Ask for a **draft** first and check it in the calendar before anything is scheduled.
- Keep your assistant's tool approval prompts on, so you confirm each action that changes something.
- Each post an assistant creates returns a preview link, `https://app.postdelegate.com/p/POST_ID?share=true`, for you to inspect.
- Posts created this way are labelled with how they were created, so you can tell them apart on the calendar.
- Never paste an API key into a chat. Use OAuth, or put the key in the client's configuration.

## Plans

The API key and MCP setup live in **Settings > Agents / Dev**, which appears when your plan includes the API. See [Plans and billing](/docs/billing).

## Troubleshooting

- **`401` or "Invalid API Key or OAuth token".** The key was rotated, mistyped, or sent in the wrong form. `/mcp` takes the key with or without `Bearer `, the REST API only without it.
- **The browser sign-in window never opens.** Your client may not support OAuth for remote servers. Use the API key address instead.
- **"redirect_uri host is not a verified domain".** A web client is trying to register a callback outside the allowed list. Use a local client or the API key address.
- **A tool is missing.** The server lists only the tools your connection address offers. See [MCP tools](/docs/mcp/tools).
