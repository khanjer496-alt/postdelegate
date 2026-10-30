---
layout: ../../../layouts/DocsLayout.astro
title: Analytics and other endpoints
description: Channel and post analytics, notifications, free-slot suggestions and account information.
---

All paths are relative to `https://app.postdelegate.com/api/public/v1`.

### `GET /analytics/:integration`

Returns analytics for one channel, where the network provides them. Use a channel id from [`GET /integrations`](/docs/api/channels#get-integrations).

| Parameter | Notes |
| --- | --- |
| `date` | Optional number of days to cover. Defaults to 7. |

```bash
curl "https://app.postdelegate.com/api/public/v1/analytics/CHANNEL_ID?date=30" \
  -H "Authorization: YOUR_API_KEY"
```

The response is a list of metric series, each with a `label`, dated `data` points and a `percentageChange`:

```json
[
  {
    "label": "Followers",
    "data": [
      { "total": "1204", "date": "2026-10-24" },
      { "total": "1231", "date": "2026-10-31" }
    ],
    "percentageChange": 2.2
  }
]
```

The values above are illustrative. The metrics differ by network, so read the `label` of each series rather than assuming a fixed set. Networks without analytics, and disabled or disconnected channels, return `[]`.

### `GET /analytics/post/:postId`

Returns analytics for one published post in the same shape. `date` is the number of days to cover. The answer is `[]` when the post has not published or the network has no post analytics, and `{ "missing": true }` for a post whose live link is not known yet.

### `GET /notifications`

Lists your workspace's in-app notifications, such as failed posts.

| Parameter | Notes |
| --- | --- |
| `page` | Optional, starts at 0. |

### `GET /find-slot/:id`

Suggests the next free time to publish on a channel, based on that channel's time slots and your existing posts.

```json
{ "date": "2026-11-06T09:20:00" }
```

Pass a channel id as `:id`. The date is UTC. Use it as the `date` of a new post.

### `GET /is-connected`

Checks that your key works.

```json
{ "connected": true }
```

### `GET /me`

Shows which workspace the key belongs to.

```json
{
  "organization": { "id": "cm3x5a9zz0000orgg", "name": "Acme Studio" },
  "user": null
}
```

`user` is filled in only for `pos_` tokens issued to an app. A plain API key belongs to the whole workspace, so `user` is `null`.
