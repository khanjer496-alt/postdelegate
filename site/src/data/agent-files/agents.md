# PostDelegate: instructions for coding agents

Guidance for Codex, Cursor, Claude Code and other coding agents that use PostDelegate's REST API or MCP server from a codebase. Drop this file into a repository as `AGENTS.md`, or append it to an existing one. Latest version: {{site}}/agents/AGENTS.md. Full docs: {{site}}/docs.

PostDelegate is a social media scheduler. Its API lists channels, uploads media, renders Studio videos and creates, reads and deletes posts in one workspace.

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

MCP tool names: `integrationList`, `groupList`, `integrationSchema`, `triggerTool`, `integrationSchedulePostTool`, `postsListTool`, `postSettingsTool`, `deletePostTool`, `uploadFromUrlTool`, `mediaListTool`, `mediaStatusTool`, `uploadWidgetTool`, `uploadWidgetStatusTool`, `studioTemplatesTool`, `studioRenderTool`, `studioRenderStatusTool`, `studioCancelTool`. The tools that change data are `integrationSchedulePostTool`, `postSettingsTool`, `deletePostTool`, `triggerTool` (may refresh a channel's login; a failed refresh disconnects the channel; pass `dataSchema: []` when the helper takes no input) the upload tools, `studioRenderTool` and `studioCancelTool` (they make or stop a video in the media library, never a post). Reference: {{site}}/docs/mcp/tools.

## REST endpoints

All paths are relative to `{{rest_base}}`.

| Area | Endpoints |
| --- | --- |
| Channels | `GET /integrations` (`?group=`), `GET /groups`, `GET /integration-settings/:id`, `POST /integration-trigger/:id`, `GET /social/:integration`, `DELETE /integrations/:id` |
| Posts | `POST /posts`, `GET /posts` (`startDate`, `endDate`, `customer`), `DELETE /posts/:id`, `DELETE /posts/group/:group`, `PUT /posts/:id/status`, `PUT /posts/:id/settings`, `PUT /posts/:id/release-id`, `GET /posts/:id/missing` |
| Media | `POST /upload` (multipart `file`, optional `adjust=true`), `POST /upload-from-url` (`{ "url", "adjust" }`), `GET /media` (`page`, `search`), `GET /media/:id/status` |
| Studio | `GET /studio/templates`, `POST /studio/renders`, `GET /studio/renders/:id`, `POST /studio/renders/:id/cancel` |
| Other | `GET /analytics/:integration` (`date` = days), `GET /analytics/post/:postId`, `GET /notifications`, `GET /find-slot/:id`, `GET /is-connected`, `GET /me` |

`DELETE /integrations/:id` removes a channel and its posts permanently. Never call it, or `DELETE /posts/*`, without an explicit request from the user.

## Creating a post

1. `GET /integrations`. Use a channel's `id` and `identifier`. Skip channels with `disabled: true`, which are paused.
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
- The response is `[{ "postId", "integration" }]`, plus `"approvalStatus": "IN_REVIEW"` on items held for approval. Preview: `https://app.postdelegate.com/p/POST_ID?share=true`.
- Every type, drafts included, must have valid network `settings` for the channel. Drafts skip only the media rules and length checks. `schedule` and `now` get the app's full checks.
- If the workspace requires approval for API posts, the response item includes `"approvalStatus": "IN_REVIEW"` and the post waits in the Review inbox (approvals) until a teammate approves it. Do not resubmit.

## Rendering a Studio video

1. `GET /studio/templates` lists the templates, each with a `schema`: the JSON schema of the `spec`. Read it rather than hard-coding a shape, new templates appear by themselves.
2. Media are ids from `GET /media` or an upload, never URLs. A `path` in the spec is replaced with the stored one.
3. `POST /studio/renders` with `{ "template", "spec", "name"? }` returns `{ "id", "projectId" }`. For a template with `"captions": true`, send `captions.script` and leave `captions.words` out.

Templates (`identifier`): `hook-over-clip`, `talking-head-captions`, `image-slideshow`, `before-after`, `top-n-list`, `quote-card` and `ai-ugc`. For `ai-ugc`, write `script` (`hook`, `lines`, `cta`) yourself and leave `voiceover` at its default `false`: it renders with no AI key. `voiceover: true` needs the workspace's own OpenAI key, and `stills` need `voiceover: true` (refused otherwise). `music.assetId` must be a music already uploaded in Studio that no other project uses; music used by another project is refused, so the user uploads it again in Studio. There is no music upload or list API yet.
4. Poll `GET /studio/renders/:id` every few seconds until `status` is `completed`, `failed` or `cancelled`. On `completed`, `mediaId` and `path` are the new video. Post it with `POST /posts` (`image: [{ "id": mediaId, "path": path }]`), as a draft unless the user asked otherwise.

```bash
curl -X POST {{rest_base}}/studio/renders \
  -H "Authorization: $POSTDELEGATE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "template": "hook-over-clip", "spec": { "input": { "mediaId": "MEDIA_ID" }, "trim": { "start": 4, "end": 19 }, "hook": { "text": "We shipped exports" } } }'
```

A render only creates media, never a post. Fair use: one render at a time per workspace with up to 3 waiting, 30 videos a day, 90 seconds per video, 10 videos in total on the trial. Reference: {{site}}/docs/api/studio.

## Networks you can connect today

{{networks}}

Follow-up entries are published on: {{followup_names}}. Only YouTube channels return analytics today. Other networks cannot be connected.

## Errors and limits

| Status | Meaning |
| --- | --- |
| `401` | `No API Key found`, `Invalid API key`, `Invalid OAuth token` or `No subscription found` |
| `400` | Validation failed. Post errors name the `provider`. Malformed bodies return a `message` array |
| `402` | Plan limit reached (channels or posts). The body has a billing `url` |
| `404` | `Integration not found`, `Tool not found` or `Render not found` |
| `406` | Studio needs an active plan, or the trial's Studio videos are used |
| `429` | `POST /posts` is limited to 30 requests per workspace per hour. Back off and batch. `POST /studio/renders` is limited to 30 requests per workspace per hour, and Studio fair use limits also answer `429` with a readable `message` |

Read `message` or `msg`. Don't retry a `400` unchanged. Retry `429` only after the hour window passes. For publish events, use webhooks ({{site}}/docs/webhooks) instead of polling.

## Rules for agents

{{safety}}
- In code, make destructive calls (`now`, `DELETE`) explicit and opt-in. Never hide them behind defaults or tests that hit the live API.
