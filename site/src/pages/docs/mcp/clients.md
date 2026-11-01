---
layout: ../../../layouts/DocsLayout.astro
title: Claude Code, Cursor and other MCP clients
description: Copy-paste MCP configuration for Claude Code, Cursor, VS Code, Codex, Windsurf, Gemini CLI and other clients, using sign-in with PostDelegate or an API key.
---

The snippets below are the ones PostDelegate shows under **Settings > Agents / Dev** in the app, with the address filled in. The configuration formats belong to each client and may change, so if a client rejects a snippet, check its own MCP documentation and use the address and header from this page.

Prefer **sign in with PostDelegate** where the client supports OAuth. The client opens your browser and you approve it once. Use an API key for clients that cannot do that. Replace `YOUR_API_KEY` with the key from Settings > Agents / Dev and keep it out of anything you commit.

## Claude Code

Sign in with PostDelegate:

```bash
claude mcp add postdelegate --transport http "https://app.postdelegate.com/mcp-oauth-dynamic"
```

Then run `/mcp` inside Claude Code and authenticate the `postdelegate` server. With an API key instead:

```bash
claude mcp add --transport http postdelegate https://app.postdelegate.com/api/mcp --header "Authorization: Bearer YOUR_API_KEY"
```

## Cursor

Add to `.cursor/mcp.json` in your project.

```json
{
  "mcpServers": {
    "postdelegate": {
      "url": "https://app.postdelegate.com/mcp-oauth-dynamic"
    }
  }
}
```

With an API key:

```json
{
  "mcpServers": {
    "postdelegate": {
      "url": "https://app.postdelegate.com/api/mcp",
      "headers": { "Authorization": "Bearer YOUR_API_KEY" }
    }
  }
}
```

## VS Code and GitHub Copilot

Add to `.vscode/mcp.json`.

```json
{
  "servers": {
    "postdelegate": {
      "type": "http",
      "url": "https://app.postdelegate.com/mcp-oauth-dynamic"
    }
  }
}
```

With an API key, use `"url": "https://app.postdelegate.com/api/mcp"` and add `"headers": { "Authorization": "Bearer YOUR_API_KEY" }`.

## Codex

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.postdelegate]
url = "https://app.postdelegate.com/mcp-oauth-dynamic"
```

Then run `codex mcp login postdelegate`. With an API key:

```toml
[mcp_servers.postdelegate]
url = "https://app.postdelegate.com/api/mcp"
http_headers = { "Authorization" = "Bearer YOUR_API_KEY" }
```

## Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "postdelegate": {
      "serverUrl": "https://app.postdelegate.com/mcp-oauth-dynamic"
    }
  }
}
```

## Gemini CLI

Add to `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "postdelegate": {
      "url": "https://app.postdelegate.com/mcp-oauth-dynamic"
    }
  }
}
```

## Amp

```bash
amp mcp add postdelegate https://app.postdelegate.com/mcp-oauth-dynamic
```

## Warp, Hermes, OpenClaw and NanoClaw

Settings > Agents / Dev in the app has ready-made configuration for Warp, Hermes, OpenClaw and NanoClaw, with your own address and, if you pick the API key option, your key.

## Any other client

If your client supports remote MCP servers over streamable HTTP, give it one of these:

| Sign-in | Address | Header |
| --- | --- | --- |
| OAuth | `https://app.postdelegate.com/mcp-oauth-dynamic` | None. The client handles sign-in. |
| API key | `https://app.postdelegate.com/api/mcp` | `Authorization: Bearer YOUR_API_KEY` |
| API key in the address | `https://app.postdelegate.com/api/mcp/YOUR_API_KEY` | None |

If a client only speaks the older server-sent-events transport, use `https://app.postdelegate.com/api/sse/YOUR_API_KEY`. Treat that address as a secret, because it contains your key.

### Check it from a terminal

You can confirm that a key works with a single request. A reply that is not `401` means the key was accepted.

```bash
curl -i https://app.postdelegate.com/api/mcp \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Real clients send an `initialize` request first, so a bare `tools/list` may still return a protocol error. That is fine for this check. A `401` is what to worry about.

For what the tools do, see [MCP tools](/docs/mcp/tools).
