---
name: postdelegate
description: "Draft, schedule and manage social media posts in PostDelegate through its MCP server (or REST API). Use when the user wants to create a draft, schedule or publish a post, list or check posts on their PostDelegate calendar, change a post's network settings, delete a post, or upload images or video for a post on their connected channels ({{network_names}}). Covers connecting, the channel, schema, media, draft workflow, per-network rules, approvals and safety rules."
---

# PostDelegate

PostDelegate is a social media scheduler with one calendar for many channels. This skill tells you how to use it for the user safely. Full docs: {{site}}/docs. This file: {{site}}/agents/postdelegate/SKILL.md.

## Connect

{{connect}}

If no PostDelegate tools are available, help the user add the MCP server first: {{site}}/docs/mcp/clients (Claude: {{site}}/docs/mcp/claude). Without MCP, use the REST API (see "REST fallback" below).

## MCP tools

Tool names are exactly as the server reports them.

| Tool | Use it to | Changes data? |
| --- | --- | --- |
| `integrationList` | List connected channels: `id`, `name`, `platform`, `picture`. Optional `group` filters by customer. | No |
| `groupList` | List customers (groups) for agencies. | No |
| `integrationSchema` | Get a network's `rules`, `maxLength`, `settings` schema and helper `tools`. Input: `platform` (the channel's `platform`), `isPremium` (`false`). | No |
| `triggerTool` | Run a helper from `integrationSchema` `tools` to fetch ids (channels, lists, categories, tags). Input: `integrationId`, `methodName`, `dataSchema: [{key, value}]` (required, `[]` when the helper takes no input). May refresh the channel's saved login, and a failed refresh disconnects the channel. | Can refresh credentials |
| `integrationSchedulePostTool` | Create a draft, scheduled or immediate post on one or more channels. | **Yes** |
| `postsListTool` | List posts between `startDate` and `endDate` (UTC), optional `customer`. Returns `id`, `publishDate`, `state`, `error`, `content`, `settings`, `platform`. | No |
| `postSettingsTool` | Merge new network settings into an unpublished post. Input: `id`, `settings: [{key, value}]`. Content and date stay. | **Yes** |
| `deletePostTool` | Delete one post (and its comments) by `id`. Cannot be undone. | **Yes** |
| `uploadFromUrlTool` | Add an image or video from a public `url` to the media library. Optional `adjust: true` resizes and re-encodes. Returns `{ id, path, status }`. | Yes |
| `mediaListTool` | Reuse uploaded media: newest first, 18 per page, optional `search` by file name, `page`. | No |
| `mediaStatusTool` | Check an adjusted upload by `id`: `processing` or `ready`. | No |
| `uploadWidgetTool` | Show an upload widget for files on the user's device. Only in hosts that support MCP Apps. Returns a `sessionId`. | Yes |
| `uploadWidgetStatusTool` | List files uploaded through the widget, by `sessionId`. | No |

`uploadWidgetTicketTool` is called by the widget itself. Do not call it. `generateImageTool` only works if the workspace admin added their own OpenAI key in Settings → AI. The AI video tools are not available. Prefer your own image features, then bring the file in with `uploadFromUrlTool`.

## Workflow

1. **Find the channel.** Call `integrationList`. Match the user's words to a channel `name` and `platform`. For agencies, call `groupList` and filter by `group`. If more than one channel fits, ask which one.
2. **Read the channel's rules.** Call `integrationSchema` with the channel's `platform` and `isPremium: false`. Keep `rules`, `maxLength`, the `settings` schema and the helper `tools`. Do this before every new post, and again if the channel changes.
3. **Fill settings that need ids.** If a setting needs an id (a Discord channel, a WordPress category, a Listmonk list), call `triggerTool` with the channel `id`, the helper's `methodName` and `dataSchema` (always an array: `[]` when the helper takes no input, otherwise `[{ "key", "value" }]` such as `[{ "key": "word", "value": "rust" }]`). Pass ids, never display labels. If the channel's login has expired, `triggerTool` tries to refresh it. If that fails the channel is disconnected and the user must reconnect it in PostDelegate.
4. **Prepare media.**
   - Already uploaded: `mediaListTool` (search by file name) and use its `path`.
   - Upload media first with `uploadFromUrlTool` (public URL) or the upload widget, then attach only the returned `path`. Links to other sites are rejected as attachments.
   - With `adjust: true`, poll `mediaStatusTool` about every 10 seconds until `ready` before scheduling.
   - A file on the user's device: `uploadWidgetTool` if the host shows widgets, otherwise ask the user to upload it in the app (**Media**) or through `POST /upload`. You cannot read local files.
   - Posts accept `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` and `.mp4`. Images up to 10 MB, MP4 video up to 1 GB.
5. **Confirm, then create.** Show the full post (text, media, channel, account, date and time in the user's time zone). Then call `integrationSchedulePostTool`, with `type: "draft"` unless the user said to schedule or publish now.
6. **Report the result.** Share each `previewUrl` (`https://app.postdelegate.com/p/POST_ID?share=true`). If `approvalStatus` is `IN_REVIEW`, say the post waits for a teammate's approval. If the result is `output.errors`, fix what it names and try again, or explain it to the user.

### `integrationSchedulePostTool` input

```json
{
  "socialPost": [
    {
      "integrationId": "CHANNEL_ID",
      "isPremium": false,
      "date": "2026-11-05T14:00:00.000Z",
      "shortLink": false,
      "type": "draft",
      "postsAndComments": [
        { "content": "<p>First line.</p><p>Second line.</p>", "attachments": [] }
      ],
      "settings": []
    }
  ]
}
```

- One `socialPost` entry per channel and date. Each entry has its own `date` (UTC ISO 8601) and `type` (`draft`, `schedule` or `now`).
- `postsAndComments[0]` is the post. Later items are follow-ups (comments or thread replies), but only on networks that support them (listed below). Ask before you split text into a thread.
- `attachments` items are an uploaded media `path` string, or `{ "path", "alt"?, "thumbnail"?, "thumbnailTimestamp"? }`. `thumbnail` is the path of an uploaded JPEG or PNG used as a video cover, and `thumbnailTimestamp` is a frame in milliseconds.
- `settings` is a list of `{ "key", "value" }` taken from the `integrationSchema` settings schema. Use `[]` for networks with no settings.
- Drafts are only checked for empty content. `schedule` and `now` get the full checks: settings, media rules, length. So a draft can still need fixes before it is scheduled.

## Writing content

- `content` is HTML. Wrap each line or paragraph in `<p>`. Allowed tags: `p`, `strong`, `u`, `ul`, `li`, `h1`, `h2`, `h3`. Do not combine `u` and `strong`. Use `<img src="...">` only when the channel's rules say pictures go inside the content. Use `span` only for a mention in the exact format a mention helper returns. PostDelegate converts the HTML to Markdown or plain text for networks that need it.
- Stay within `maxLength` from `integrationSchema`. The limits below are guides. The schema and the server's checks have the final say.
- Dates are UTC. Ask for the user's time zone if it is unclear, and show times back to the user in their own time zone.
- To turn an existing draft into a scheduled post, ask the user to schedule it in the app (or use REST `PUT /posts/:id/status` with `{ "status": "schedule" }`, or `{ "status": "draft" }` to move it back). Do not create a second copy.

## Networks you can connect today

{{networks}}

Only these networks can be connected today. Others in PostDelegate's directory are coming soon. Do not offer to post to them. Follow-ups (`postsAndComments[1..]`) are published on: {{followup_names}}. Only YouTube channels return analytics today.

## Safety rules

{{safety}}

## Changing or deleting posts

- **Find first.** Call `postsListTool` with a UTC window. For "all upcoming", use now to a year ahead. `state` is `QUEUE` (scheduled), `DRAFT`, `PUBLISHED` or `ERROR`. Errored posts carry a readable `error`.
- **Settings only.** `postSettingsTool` changes network settings of a scheduled or draft post that has not published. Only the keys you pass change. You cannot change content or date with it, so for those send the user to the app. Follow the "Confirm settings changes" safety rule first.
- **Delete.** `deletePostTool` removes the post on that one channel. A post made for several channels has a separate id on each, so ask which channels. A repeating post is listed once per repetition with the same id, and deleting it deletes every repetition.
- Never use `integrationSchedulePostTool` to edit an existing post. It always creates a new one.

## Errors

| Signal | Meaning | What to do |
| --- | --- | --- |
| `401`, "Invalid API Key or OAuth token" | Wrong, rotated or revoked credentials, or `Bearer ` used wrongly | Ask the user to reconnect, or check the key format |
| `output.errors` with a network name | The post failed validation (settings, media, length) | Fix exactly what it says, then try again |
| `output.errors` about allowed channels or posts per day | Workspace guardrails for agents | Tell the user. Do not work around it |
| `approvalStatus: "IN_REVIEW"` | Waiting for a teammate's approval | Tell the user. Do not resubmit |
| Plan limit message (`402` in REST) | The plan's channel or post limit was reached | Point the user to {{app}}/billing |
| `429` (REST `POST /posts`) | Over 30 post-creation requests this hour | Wait. Batch channels into one request |
| "channel was disconnected" / "reconnect" | The network rejected the saved login | Ask the user to reconnect the channel in PostDelegate |
| `processing` media | The adjusted file is not ready | Wait about 10 s and check again before publishing |

## REST fallback

Base `{{rest_base}}`, header `Authorization: YOUR_API_KEY` (no `Bearer `). Call it from a server or script, not a browser.

| MCP tool | REST |
| --- | --- |
| `integrationList`, `groupList` | `GET /integrations?group=`, `GET /groups` |
| `integrationSchema`, `triggerTool` | `GET /integration-settings/:id`, `POST /integration-trigger/:id` `{ "methodName", "data": {} }` |
| `integrationSchedulePostTool` | `POST /posts` |
| `postsListTool` | `GET /posts?startDate=&endDate=&customer=` |
| `postSettingsTool` | `PUT /posts/:id/settings` `{ "settings": { ... } }` |
| `deletePostTool` | `DELETE /posts/:id` (also deletes posts created with it in the same group) |
| `uploadFromUrlTool`, `mediaListTool`, `mediaStatusTool` | `POST /upload-from-url`, `GET /media`, `GET /media/:id/status`. Local files: `POST /upload` (multipart `file`) |

In REST `POST /posts`, `type` and `date` apply to the whole request, `posts[]` has one entry per channel with `integration.id`, `value[]` (`content`, `image: [{ id, path }]`), and `settings` is an **object** (`{}` when none), not a key/value list. `shortLink` and `tags` (`[]`) are required. Reference: {{site}}/docs/api/posts.

## Examples

**Draft for review.** User: "Draft a Bluesky post about our new export feature for tomorrow 9am Berlin time."
1. `integrationList` finds the Bluesky channel. `integrationSchema` with `{ "platform": "bluesky", "isPremium": false }` gives a 300-character limit, at most 4 images or 1 video.
2. Write the post within 300 characters and show it with the time 09:00 Europe/Berlin (08:00 UTC in winter).
3. `integrationSchedulePostTool` with `type: "draft"`, `settings: []`. Share the `previewUrl`.

**Scheduled YouTube video.** User: "Schedule https://example.com/demo.mp4 on YouTube as unlisted 'Product demo' on Friday 15:00 UTC."
1. `integrationList` gives the YouTube channel. `integrationSchema` with `platform: "youtube"` says exactly one MP4 video, and `title` and `type` are required.
2. `uploadFromUrlTool` with `{ "url": "https://example.com/demo.mp4" }` returns `path`.
3. Confirm the summary. On a yes, call `integrationSchedulePostTool` with `type: "schedule"`, `postsAndComments: [{ "content": "<p>Video description</p>", "attachments": ["PATH"] }]` and `settings: [{ "key": "title", "value": "Product demo" }, { "key": "type", "value": "unlisted" }]`.

**Delete.** User: "Remove tomorrow's Discord post." Call `postsListTool` for tomorrow, show the matching post, get a yes, then `deletePostTool` with its `id`.
