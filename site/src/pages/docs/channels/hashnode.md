---
layout: ../../../layouts/DocsLayout.astro
title: Hashnode
description: Connect a Hashnode account with an API key and publish Markdown articles to one of your publications.
---

## What you need

- A Hashnode account with at least one publication.
- A Hashnode **API key**, which Hashnode calls a personal access token. Generate it from your Hashnode account's developer settings. Hashnode owns that screen, so its wording may change.

## Connect

1. On the calendar page choose **Add Channel**, then **Hashnode**.
2. Paste the token into **API key** and save.
3. PostDelegate asks Hashnode who the token belongs to and shows your name and avatar on the channel.

## Post settings

| Setting | Notes |
| --- | --- |
| Title | Required, at least 6 characters. |
| Subtitle | Optional, at least 2 characters. |
| Cover image | Optional. |
| Canonical URL | Optional. Use it when the article first appeared elsewhere. |
| Publication | Required. Choose from the publications on your account. |
| Tags | Required, at least one, picked from Hashnode's tag list. |

The article body is written in Markdown, up to 10,000 characters.

## Troubleshooting

- **Invalid credentials.** Generate a new token and use **Update Credentials**.
- **No publications in the list.** Create a publication on Hashnode first, then reopen the post.
