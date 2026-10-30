---
layout: ../../../layouts/DocsLayout.astro
title: DEV.to
description: Connect a DEV Community account with an API key and publish Markdown articles with tags, a cover image and a canonical URL.
---

## What you need

- A DEV Community account (dev.to).
- An **API key** for it. DEV lets you generate one from your account settings under Extensions. DEV owns that screen, so its wording may change.

## Connect

1. On the calendar page choose **Add Channel**, then **Dev.to**.
2. Paste the key into **API key** and save.
3. PostDelegate asks DEV who the key belongs to. If it answers, your name and avatar appear on the channel.

## Post settings

| Setting | Notes |
| --- | --- |
| Title | Required, at least 2 characters. |
| Cover image | Optional. |
| Canonical URL | Optional. Use it when the article first appeared elsewhere. DEV rejects a canonical URL it already has. |
| Organization | Optional. Publish under one of your DEV organizations. |
| Tags | Up to 4, picked from DEV's tag list. |

The article body is written in Markdown.

<div class="callout warn">

DEV articles are published straight away when the post goes out. Use a draft in PostDelegate to hold an article back, not a draft on DEV.

</div>

## Troubleshooting

- **Invalid credentials.** Generate a new key and use **Update Credentials**.
- **Canonical URL already exists.** Another DEV article already uses that canonical URL.
