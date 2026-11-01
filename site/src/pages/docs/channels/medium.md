---
layout: ../../../layouts/DocsLayout.astro
title: Medium
description: Connect Medium to PostDelegate with an integration token and schedule Markdown stories, optionally to a publication you can write to. Post settings and fixes.
---

## What you need

- A Medium account.
- A Medium **integration token**, created from your Medium security settings if your account still offers them. Medium decides who can create tokens and owns that screen. If your account cannot create one, the connection cannot be made.

## Connect

1. On the calendar page choose **Add Channel**, then **Medium**.
2. Paste the token into **API key** and save.
3. PostDelegate asks Medium who the token belongs to and shows your name and avatar on the channel.

## Post settings

| Setting | Notes |
| --- | --- |
| Title | Required, at least 2 characters. |
| Subtitle | Required, at least 2 characters. |
| Canonical URL | Optional. Use it when the story first appeared elsewhere. |
| Publication | Optional. Choose one of the publications you can post to. |
| Tags | Optional, up to 4. |

The story body is written in Markdown, up to 100,000 characters.

## Where it publishes

- **No publication selected.** The story is published publicly on your profile.
- **A publication selected.** The story is sent to the publication as a draft, so an editor can review it first.

## Troubleshooting

- **Invalid credentials.** Create a new token and use **Update Credentials**.
