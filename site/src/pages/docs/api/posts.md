---
layout: ../../../layouts/DocsLayout.astro
title: Posts API
description: Create, list, update and delete posts. Request bodies and response shapes come straight from the PostDelegate API.
---

All paths are relative to `https://app.postdelegate.com/api/public/v1` and need the `Authorization` header described in the [API overview](/docs/api).

### `POST /posts`

Creates a draft, a scheduled post or an immediate post on one or more channels. Limited per workspace per hour, see [rate limits](/docs/api#rate-limits).

**Body**

| Field | Type | Notes |
| --- | --- | --- |
| `type` | string, required | `draft`, `schedule`, `now` or `update`. `now` publishes immediately. `update` edits posts whose `value[].id` you pass. |
| `date` | ISO 8601 string, required | Publish time in UTC. For `now` the current time is used. One date applies to every channel in the request. |
| `shortLink` | boolean, required | `true` shortens URLs in the content so you get click statistics. |
| `tags` | array, required | `[]` or a list of `{ "value": "tag-name", "label": "Tag name" }`. |
| `posts` | array, required | One entry per channel. At least one. |
| `republish` | boolean, optional | Set `true` to publish an already published post again. Without it that request is rejected. |
| `inter` | number, optional | Repeat the post every this many days. |

**Each entry of `posts`**

| Field | Type | Notes |
| --- | --- | --- |
| `integration.id` | string, required | A channel id from [`GET /integrations`](/docs/api/channels#get-integrations). |
| `value` | array, required | The post, then its follow-ups. The first entry is the post. Further entries are comments or thread replies, depending on the network. At least one. |
| `value[].content` | string, required | HTML, see [conventions](/docs/api#conventions). Required unless the entry has an image. |
| `value[].image` | array, required | `[]` or a list of `{ "id", "path", "alt"?, "thumbnail"? }` from the [upload endpoints](/docs/api/uploads). |
| `value[].id` | string, optional | Id of an existing post entry, used with `type: "update"`. |
| `value[].delay` | number, optional | Delay for a follow-up entry. |
| `settings` | object | Network-specific fields. Required unless the type is `draft`. Use `{}` for networks without extra settings. See the [channel guides](/docs/channels). |
| `group` | string, optional | Groups entries that belong together. |

You do not send a `__type` in `settings`. PostDelegate fills it in from the channel.

**Example**

```bash
curl -X POST https://app.postdelegate.com/api/public/v1/posts \
  -H "Authorization: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "schedule",
    "date": "2026-11-05T14:00:00.000Z",
    "shortLink": false,
    "tags": [],
    "posts": [
      {
        "integration": { "id": "CHANNEL_ID" },
        "value": [
          { "content": "<p>Hello from the API.</p>", "image": [] }
        ],
        "settings": {}
      }
    ]
  }'
```

A YouTube entry adds its required settings and a video:

```json
{
  "integration": { "id": "YOUTUBE_CHANNEL_ID" },
  "value": [
    {
      "content": "<p>What changed this month.</p>",
      "image": [{ "id": "MEDIA_ID", "path": "https://media.postdelegate.com/video.mp4" }]
    }
  ],
  "settings": { "title": "Monthly update", "type": "unlisted" }
}
```

**Response** `201`

One object per entry in `posts`, in order:

```json
[
  { "postId": "cm3x9k2yq0001abcd", "integration": "CHANNEL_ID" }
]
```

**Validation**

For `draft` the API only checks that each entry has content or an image. For `schedule` and `now` it applies the same checks as the app, per channel: valid settings, media rules, empty content and length. A failure returns `400` with the offending channel:

```json
{
  "statusCode": 400,
  "provider": "bluesky",
  "name": "Bluesky",
  "message": "post is too long, please fix it"
}
```

### `GET /posts`

Lists posts with a publish date inside a window, whatever their state.

**Query**

| Parameter | Type | Notes |
| --- | --- | --- |
| `startDate` | ISO 8601 string, required | Start of the window. |
| `endDate` | ISO 8601 string, required | End of the window. |
| `customer` | string, optional | Only channels in this customer (group) id. |

```bash
curl "https://app.postdelegate.com/api/public/v1/posts?startDate=2026-11-01T00:00:00Z&endDate=2026-11-30T23:59:59Z" \
  -H "Authorization: YOUR_API_KEY"
```

**Response**

```json
{
  "posts": [
    {
      "id": "cm3x9k2yq0001abcd",
      "content": "<p>Hello from the API.</p>",
      "publishDate": "2026-11-05T14:00:00.000Z",
      "releaseURL": null,
      "releaseId": null,
      "state": "QUEUE",
      "error": null,
      "intervalInDays": null,
      "group": "9d1f…",
      "creationMethod": "API",
      "settings": "{\"__type\":\"bluesky\"}",
      "tags": [],
      "integration": {
        "id": "CHANNEL_ID",
        "providerIdentifier": "bluesky",
        "name": "My Bluesky",
        "picture": "https://…"
      }
    }
  ]
}
```

`state` is `QUEUE` (scheduled), `PUBLISHED`, `ERROR` or `DRAFT`. Failed posts carry a readable `error`. A repeating post appears once per repetition inside the window, and `settings` is a JSON string.

### `DELETE /posts/:id`

Deletes the post with this id and every post created with it in the same group. Returns `{ "id": "…" }`. Deleting a scheduled post cancels it. Deleting a published post only removes it from PostDelegate, it stays live on the network.

### `DELETE /posts/group/:group`

Deletes every post in a group, using the `group` value from [`GET /posts`](#get-posts).

### `PUT /posts/:id/status`

Moves a post between draft and scheduled.

```json
{ "status": "draft" }
```

`status` is `draft` or `schedule`. A `400` with `Post not found` means the id does not belong to your workspace.

### `PUT /posts/:id/settings`

Merges network settings into a post that has not published yet, either scheduled or draft. The content and the date stay as they are, and only the keys you send change.

```json
{ "settings": { "title": "A better title" } }
```

**Response**

```json
{ "postId": "cm3x9k2yq0001abcd", "publishDate": "2026-11-05T14:00:00.000Z" }
```

A post that already published, a comment id, and a scheduled post whose time has passed are all rejected with a readable `400`.

### `PUT /posts/:id/release-id`

Links a post to the id of the live post on the network. It is used when a post is marked as published without a known link. Send `{ "releaseId": "ID_ON_THE_NETWORK" }`.

### `GET /posts/:id/missing`

For posts that published without a known link, returns the candidate live posts as a list of `{ "id", "url" }`, so you can pick one and call [`PUT /posts/:id/release-id`](#put-postsidrelease-id). It returns `[]` when nothing is missing or the network does not support it.
