# PostDelegate plugin

A plugin for Claude Code, Cursor and Grok Build that connects your assistant to [PostDelegate](https://postdelegate.com), a social media scheduler. It adds two things:

- **The PostDelegate MCP server** at `https://app.postdelegate.com/api/mcp` (streamable HTTP). Your assistant can list your connected channels, read each network's rules, upload media, create drafts and scheduled posts, and look at your calendar.
- **The `postdelegate` skill**, which teaches the workflow: list channels, read the channel's rules, upload media, create a draft and wait for your OK before anything is scheduled or published.

Available connections include LinkedIn personal profiles, YouTube, Bluesky, Mastodon, Google Business Profile, Telegram, Discord, Slack, Tumblr, Lemmy, Nostr, Twitch, Kick, Dribbble, DEV.to, Medium, WordPress, Hashnode, Listmonk, Moltbook and Whop. LinkedIn company Pages, Facebook, Instagram, Threads, TikTok, Pinterest and Reddit remain pending platform approval. X is not offered. Check the [platform directory](https://postdelegate.com/platforms) and the channels returned by your workspace before planning a post; availability and account permissions can change.

You need a PostDelegate account. Every plan starts with a 7-day trial and no credit card is needed.

## Sign-in and credentials

The plugin contains no keys or tokens. On first use your assistant finds the OAuth metadata at `https://app.postdelegate.com/.well-known/oauth-protected-resource/api/mcp`, opens a PostDelegate page in your browser, and you approve it. Approvals are listed, and can be revoked, under **Settings > Apps > Approved Apps** in PostDelegate.

The bundled skill also mentions `https://app.postdelegate.com/mcp-oauth-dynamic`, the sign-in address the docs recommend for adding the server by hand. Both addresses reach the same server and sign in the same way, so there is no need to add a second server.

If your client cannot sign in with OAuth, use a workspace API key from **Settings > Agents / Dev** as `Authorization: Bearer YOUR_API_KEY`. Keep the key in your client's own configuration, never in this plugin or in a chat. See [Claude Code, Cursor and other clients](https://postdelegate.com/docs/mcp/clients).

Network endpoints this plugin uses: `https://app.postdelegate.com/api/mcp` and the OAuth pages on `https://app.postdelegate.com`. The skill links to documentation on `https://postdelegate.com`. It runs no scripts or hooks.

## Files

| File | For |
| --- | --- |
| `.claude-plugin/plugin.json` | Claude Code plugin manifest (also accepted by Grok Build) |
| `.claude-plugin/marketplace.json` | Lets this folder, as the root of a public repository, be added as a Claude Code marketplace |
| `.mcp.json` | MCP server for Claude Code and Grok Build |
| `.cursor-plugin/plugin.json` | Cursor plugin manifest |
| `mcp.json` | MCP server for Cursor |
| `skills/postdelegate/SKILL.md` | The PostDelegate skill |
| `assets/` | Icon and logo |

## Install

The public plugin repository is [khanjer496-alt/postdelegate-plugin](https://github.com/khanjer496-alt/postdelegate-plugin). Add it as a marketplace, then install the plugin:

Claude Code:

```bash
claude plugin marketplace add khanjer496-alt/postdelegate-plugin
claude plugin install postdelegate@postdelegate
```

Then run `/mcp` in Claude Code and sign in to the `postdelegate` server.

To try it from a checkout without installing: `claude --plugin-dir ./integrations/postdelegate-plugin`.

Cursor: the repository contains a Cursor manifest, but this README does not establish that a marketplace listing is approved. To request listing, submit the public repository at [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish). Until it is listed, add the server from [the Cursor setup](https://postdelegate.com/docs/mcp/clients#cursor).

Grok Build: the repository contains a compatible manifest, but this README does not establish that a marketplace entry is merged. To request listing, open a pull request to [xai-org/plugin-marketplace](https://github.com/xai-org/plugin-marketplace) that adds this entry to `.grok-plugin/marketplace.json`, with the full commit SHA of the public repository, then regenerate the index as its CONTRIBUTING guide describes:

```json
{
  "name": "postdelegate",
  "description": "PostDelegate social media scheduling for Grok Build via the hosted PostDelegate MCP server. Draft, schedule, list, update and delete posts and upload media on your connected channels. Sign in with your PostDelegate account on first connect.",
  "category": "productivity",
  "source": {
    "source": "url",
    "url": "https://github.com/khanjer496-alt/postdelegate-plugin.git",
    "sha": "8f82d30367d3623b27458747916d3cb760ed50fe"
  },
  "homepage": "https://postdelegate.com/docs/mcp",
  "keywords": ["postdelegate", "postdelegate mcp", "postdelegate posts", "postdelegate calendar"],
  "domains": ["postdelegate.com", "app.postdelegate.com"]
}
```

The example pins the public plugin revision checked on 8 November 2026. Before a future submission, verify the public repository revision and replace the pinned SHA when publishing a newer plugin. A marketplace submission or merge is a separate action; these instructions do not claim either is complete.

## Keeping the skill current

`skills/postdelegate/SKILL.md` is a copy of the hosted skill, which the website builds from the same data as the docs. Refresh it before each release and bump `version` in both `plugin.json` files:

```bash
curl -fsSL https://postdelegate.com/agents/postdelegate/SKILL.md -o skills/postdelegate/SKILL.md
claude plugin validate --strict .
```

## Docs

- [MCP overview](https://postdelegate.com/docs/mcp)
- [MCP tools](https://postdelegate.com/docs/mcp/tools)
- [Approvals and client review](https://postdelegate.com/docs/approvals)
- [Support](https://postdelegate.com/support): support@postdelegate.com
