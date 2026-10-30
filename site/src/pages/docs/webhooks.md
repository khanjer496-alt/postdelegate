---
layout: ../../layouts/DocsLayout.astro
title: Webhooks
description: Receive an HTTP request at your own address each time a post is published, and learn exactly what the request contains.
---

A webhook is an address on your server that PostDelegate calls when something happens. Use one to log published posts, update a spreadsheet, tell your team in chat, or trigger the next step in your own workflow, without polling the API.

## What triggers a webhook

There is one event: **a post was published.** PostDelegate calls your webhook after a post has gone out on a channel. It is not called for drafts, for scheduled posts that have not yet gone out, or for posts that fail. To learn about failures, use the in-app notifications or [`GET /notifications`](/docs/api/more#get-notifications).

## Create a webhook

1. In the app open **Settings**, then the **Webhooks** tab. The tab shows how many webhooks your plan allows, for example 1 of 2. See [Plans and billing](/docs/billing).
2. Choose **Add a webhook**.
3. Enter a **Name** and your **URL**.
4. Choose which channels it covers: **All integrations**, or **Specific integrations** and then pick the channels. A webhook with no channels selected covers all of them.
5. Choose **Send Test** to send a sample request to your address, then **Save**.

You can edit or delete a webhook from the same tab.

### URL rules

The URL must be a public `https://` address. Addresses that point to private or internal networks are refused, both when you save and again when a request is sent, including every redirect it follows.

## The request

PostDelegate sends an HTTP `POST` with `Content-Type: application/json`. The body is a JSON array holding the published post:

```json
[
  {
    "id": "cm3x9k2yq0001abcd",
    "content": "<p>Hello from PostDelegate.</p>",
    "publishDate": "2026-11-05T14:00:00.000Z",
    "releaseURL": "https://bsky.app/profile/name.bsky.social/post/3l2abc",
    "state": "PUBLISHED",
    "integration": {
      "id": "cm3x7q1ab0000wxyz",
      "name": "My Bluesky",
      "providerIdentifier": "bluesky",
      "picture": "https://…",
      "type": "social"
    }
  }
]
```

| Field | Meaning |
| --- | --- |
| `id` | The PostDelegate post id, the same one the API returns. |
| `content` | The post content as stored, in the HTML subset described in the [API conventions](/docs/api#conventions). |
| `publishDate` | When the post was scheduled to publish, in UTC. |
| `releaseURL` | The link to the live post on the network, when the network gives one. |
| `state` | `PUBLISHED` for this event. |
| `integration` | The channel: its id, name, network identifier such as `bluesky`, picture and type. |

The **Send Test** button sends a sample array with example posts, so a test payload has made-up ids and more than one entry.

## Delivery

- Requests are sent once. There are no retries, and PostDelegate ignores your response, so a failing endpoint is not reported anywhere.
- There is no signature, secret or custom header, only the JSON body. Do not treat a request as proof that a post was published. If it matters, confirm with [`GET /posts`](/docs/api/posts#get-posts), or put a hard-to-guess token in the URL's path or query.
- Respond quickly with any `2xx` and do the slow work afterwards.

## A minimal receiver

```js
import express from 'express';

const app = express();
app.use(express.json());

app.post('/hooks/postdelegate/SOME_LONG_RANDOM_TOKEN', (req, res) => {
  for (const post of req.body) {
    console.log(`${post.integration.name} published: ${post.releaseURL}`);
  }
  res.sendStatus(204);
});

app.listen(3000);
```
