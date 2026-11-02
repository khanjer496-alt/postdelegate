---
layout: ../../layouts/DocsLayout.astro
title: REST API overview
description: Base URL, authentication, rate limits and error formats for the PostDelegate public API, with a first request you can run in a minute.
---

The public API lets your own software list channels, upload media, render [Studio](/docs/studio) videos and create, read and delete posts in your workspace. It is the same engine the app and the [MCP server](/docs/mcp) use.

## Base URL

```text
https://app.postdelegate.com/api/public/v1
```

Every path in these docs is relative to that base. For example `GET /integrations` means `GET https://app.postdelegate.com/api/public/v1/integrations`.

Call the API from your server or a script. Browsers are blocked from calling it from other websites by cross-origin rules, and an API key must never be shipped in front-end code.

## Authentication

Send your workspace API key in the `Authorization` header, as the bare key with no `Bearer ` prefix.

```bash
curl https://app.postdelegate.com/api/public/v1/is-connected \
  -H "Authorization: YOUR_API_KEY"
```

```json
{ "connected": true }
```

<div class="callout warn">

The REST API wants the bare key: `Authorization: Bearer YOUR_API_KEY` is rejected with a `401`. The [MCP server](/docs/mcp) at `/mcp` takes the key with or without `Bearer `.

</div>

### Where to find your key

1. Sign in at [app.postdelegate.com](https://app.postdelegate.com).
2. Open **Settings** and choose the **Agents / Dev** tab. It appears when your plan includes the API. See [Plans and billing](/docs/billing).
3. Use **Reveal** and **Copy**. The same page shows the base URL and has a **Rotate Key** button.

Rotating creates a new key and invalidates the old one immediately. Every script and MCP connection that used the old key stops working.

Treat the key like a password. It acts as the whole workspace: it can read, publish and delete posts on every connected channel. Keep it in your server's secret store, not in a repository, a prompt or a screenshot.

### Apps and OAuth tokens

If you build a product that posts for other PostDelegate users, create an OAuth app in **Settings > Apps**. Your users authorise your app and you receive a token that starts with `pos_`. Send it in the same `Authorization` header, again without `Bearer `. It works like an API key for the user's workspace.

## OpenAPI specification

The API is described in an OpenAPI 3.1 document you can import into Postman, Insomnia or a code generator:

- [`https://postdelegate.com/openapi.json`](https://postdelegate.com/openapi.json)
- [`https://app.postdelegate.com/api/public/v1/openapi.json`](https://app.postdelegate.com/api/public/v1/openapi.json), served by the API itself

Both are the same file. It covers every endpoint in the [endpoint index](#endpoint-index) below.

## Rate limits

Creating posts, that is `POST /posts`, is limited per workspace per hour. PostDelegate's deployment is configured for **30 requests per hour**. When you go over, the API answers `429 Too Many Requests` until the hour window passes.

One request can include several channels in its `posts` array, and they all share the request's `date`. Batch the channels of one post into a single request rather than sending one request per channel. Posts on different dates need separate requests.

Starting a Studio render, `POST /studio/renders`, has its own limit of 30 requests per workspace per hour. Other endpoints are not covered by these limits. Keep your usage reasonable: the networks apply their own limits when posts publish.

## Errors

Errors are JSON. The shape depends on where the error came from.

| Status | When | Body |
| --- | --- | --- |
| `401` | Missing, wrong or rotated key | `{ "msg": "No API Key found" }`, `{ "msg": "Invalid API key" }` or `{ "msg": "Invalid OAuth token" }` |
| `401` | Billing is on and the workspace has no active subscription | `{ "msg": "No subscription found" }` |
| `400` | A post fails the same checks as the app | `{ "statusCode": 400, "provider": "bluesky", "name": "Bluesky", "message": "post is too long, please fix it" }` |
| `400` | The request body or query is malformed | `{ "statusCode": 400, "message": ["date must be a valid ISO 8601 date string"], "error": "Bad Request" }` |
| `400`, `404` | A route-specific problem | `{ "msg": "Integration not found" }` |
| `402` | You reached a plan limit, such as posts or channels | `{ "statusCode": 402, "message": "…", "url": "https://app.postdelegate.com/billing" }` |
| `429` | Too many `POST /posts` or `POST /studio/renders` requests this hour, or a [Studio](/docs/api/studio#limits-and-errors) fair use limit | Standard throttling response, or `{ "statusCode": 429, "message": "…" }` |

Read `message` or `msg` for the reason. Post validation errors name the channel, so you know which entry in `posts` to fix.

## Conventions

- **Dates** are ISO 8601 strings in UTC, for example `2026-11-05T14:00:00.000Z`.
- **Ids** are opaque strings. Channel ids come from [`GET /integrations`](/docs/api/channels#get-integrations). Post ids come from [`POST /posts`](/docs/api/posts#post-posts) and [`GET /posts`](/docs/api/posts#get-posts).
- **Post content** is a small HTML subset: `p`, `br`, `strong`, `u`, `a`, `ul`, `li`, `h1`, `h2`, `h3`, `span` and `img`. Wrap each line in `<p>`. Anything else is stripped. Networks that use Markdown or plain text receive your content converted for them.
- **Media** must be uploaded through the [upload endpoints](/docs/api/uploads) first, then referenced by `id` and `path`. Files must end in `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` or `.mp4`.

## Endpoint index

| Area | Endpoints |
| --- | --- |
| [Posts](/docs/api/posts) | `POST /posts`, `GET /posts`, `DELETE /posts/:id`, `DELETE /posts/group/:group`, `PUT /posts/:id/status`, `PUT /posts/:id/settings`, `PUT /posts/:id/release-id`, `GET /posts/:id/missing` |
| [Uploads and media](/docs/api/uploads) | `POST /upload`, `POST /upload-from-url`, `GET /media`, `GET /media/:id/status` |
| [Studio](/docs/api/studio) | `GET /studio/templates`, `POST /studio/renders`, `GET /studio/renders/:id`, `POST /studio/renders/:id/cancel` |
| [Channels and customers](/docs/api/channels) | `GET /integrations`, `GET /groups`, `GET /integration-settings/:id`, `POST /integration-trigger/:id`, `GET /social/:integration`, `DELETE /integrations/:id` |
| [Analytics and more](/docs/api/more) | `GET /analytics/:integration`, `GET /analytics/post/:postId`, `GET /notifications`, `GET /find-slot/:id`, `GET /is-connected`, `GET /me` |

The API also has operator-only routes and routes for AI image, video and clipping features. They are not part of the supported surface. In the app, AI runs on the workspace's own OpenAI API key and AI video is not available; customers can also bring their own assistant through [MCP](/docs/mcp).

## Webhooks

To be called when a post publishes, instead of polling, set up a [webhook](/docs/webhooks).
