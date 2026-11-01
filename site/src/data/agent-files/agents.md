# PostDelegate: instructions for coding agents

Guidance for Codex, Cursor, Claude Code and other coding agents that use PostDelegate's REST API or MCP server from a codebase. Drop this file into a repository as `AGENTS.md`, or append it to an existing one. Latest version: {{site}}/agents/AGENTS.md. Full docs: {{site}}/docs.

PostDelegate is a social media scheduler. Its API lists channels, uploads media and creates, reads and deletes posts in one workspace.

## Connect

{{connect}}

### REST from code

- Read the key from the environment, for example `POSTDELEGATE_API_KEY`. Never hard-code it, ship it in front-end code, or print it. Browsers on other sites are blocked by CORS anyway, so call the API from a server, script or job.
- Check the key: `GET /is-connected` returns `{ "connected": true }`. `GET /me` shows the workspace.

```bash
curl {{rest_base}}/integrations \
  -H "Authorization: $POSTDELEGATE_API_KEY"
```

### MCP in your agent

| Client | Setup |
| --- | --- |
| Codex | `~/.codex/config.toml`: `[mcp_servers.postdelegate]` with `url = "{{mcp_oauth}}"`, then `codex mcp login postdelegate` |
| Claude Code | `claude mcp add postdelegate --transport http "{{mcp_oauth}}"`, then `/mcp` to authenticate |
| Cursor | `.cursor/mcp.json`: `{ "mcpServers": { "postdelegate": { "url": "{{mcp_oauth}}" } } }` |
| Other clients | {{site}}/docs/mcp/clients |

MCP tool names: `integrationList`, `groupList`, `integrationSchema`, `triggerTool`, `integrationSchedulePostTool`, `postsListTool`, `postSettingsTool`, `deletePostTool`, `uploadFromUrlTool`, `mediaListTool`, `mediaStatusTool`, `uploadWidgetTool`, `uploadWidgetStatusTool`. The tools that change data are `integrationSchedulePostTool`, `postSettingsTool`, `deletePostTool`, `triggerTool` (may refresh a channel's login) and the upload tools. Reference: {{site}}/docs/mcp/tools.

## REST endpoints

All paths are relative to `{{rest_base}}`.

| Area | Endpoints |
| --- | --- |
| Channels | `GET /integrations` (`?group=`), `GET /groups`, `GET /integration-settings/:id`, `POST /integration-trigger/:id`, `GET /social/:integration`, `DELETE /integrations/:id` |
| Posts | `POST /posts`, `GET /posts` (`startDate`, `endDate`, `customer`), `DELETE /posts/:id`, `DELETE /posts/group/:group`, `PUT /posts/:id/status`, `PUT /posts/:id/settings`, `PUT /posts/:id/release-id`, `GET /posts/:id/missing` |
| Media | `POST /upload` (multipart `file`, optional `adjust=true`), `POST /upload-from-url` (`{ "url", "adjust" }`), `GET /media` (`page`, `search`), `GET /media/:id/status` |
| Other | `GET /analytics/:integration` (`date` = days), `GET /analytics/post/:postId`, `GET /notifications`, `GET /find-slot/:id`, `GET /is-connected`, `GET /me` |

`DELETE /integrations/:id` removes a channel and its posts permanently. Never call it, or `DELETE /posts/*`, without an explicit request from the user.

## Creating a post

1. `GET /integrations`. Use a channel's `id` and `identifier`. Skip `disabled: true`.
2. `GET /integration-settings/:id` returns `rules`, `maxLength`, a JSON schema of `settings` and helper `tools`. For ids, call `POST /integration-trigger/:id` with `{ "methodName": "...", "data": {} }`.
3. Upload media first and keep `id` and `path`. With `adjust`, poll `GET /media/:id/status` until `ready`.
4. `POST /posts`:

```json
{
  "type": "draft",
  "date": "2026-11-05T14:00:00.000Z",
  "shortLink": false,
  "tags": [],
  "posts": [
    {
      "integration": { "id": "CHANNEL_ID" },
      "value": [
        { "content": "<p>Hello from the API.</p>", "image": [{ "id": "MEDIA_ID", "path": "MEDIA_PATH" }] }
      ],
      "settings": {}
    }
  ]
}
```

- `type`: `draft`, `schedule`, `now` (publishes immediately) or `update` (with existing `value[].id`). Default to `draft` in code you write, unless the user asked for something else.
- `date` is UTC ISO 8601 and applies to every channel in the request. Channels that share a date belong in one request. Different dates need separate requests.
- `settings` is an object of network fields. Use `{}` for networks without settings. Do not send `__type`.
- `value[0]` is the post and later entries are follow-ups. `content` is a small HTML subset: `p`, `br`, `strong`, `u`, `a`, `ul`, `li`, `h1`, `h2`, `h3`, `span`, `img`. Wrap lines in `<p>`.
- The response is `[{ "postId", "integration" }]`. Preview: `https://app.postdelegate.com/p/POST_ID?share=true`.
- Drafts are only checked for empty content. `schedule` and `now` get the app's full checks.
- If the workspace requires approval for API posts, the post waits in Approvals until a teammate approves it. Do not resubmit.

## Networks you can connect today

{{networks}}

Follow-up entries are published on: {{followup_names}}. Only YouTube channels return analytics today. Other networks in the directory are coming soon and cannot be connected.

## Errors and limits

| Status | Meaning |
| --- | --- |
| `401` | `No API Key found`, `Invalid API key`, `Invalid OAuth token` or `No subscription found` |
| `400` | Validation failed. Post errors name the `provider`. Malformed bodies return a `message` array |
| `402` | Plan limit reached (channels or posts). The body has a billing `url` |
| `404` | `Integration not found` or `Tool not found` |
| `429` | `POST /posts` is limited to 30 requests per workspace per hour. Back off and batch |

Read `message` or `msg`. Don't retry a `400` unchanged. Retry `429` only after the hour window passes. For publish events, use webhooks ({{site}}/docs/webhooks) instead of polling.

## Rules for agents

{{safety}}
- In code, make destructive calls (`now`, `DELETE`) explicit and opt-in. Never hide them behind defaults or tests that hit the live API.
