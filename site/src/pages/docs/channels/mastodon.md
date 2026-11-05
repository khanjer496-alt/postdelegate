---
layout: ../../../layouts/DocsLayout.astro
title: Mastodon
description: Connect a mastodon.social account by signing in with Mastodon, then schedule public posts and threads of up to 500 characters with up to four images or one video.
---

Mastodon is a decentralised social network made of many servers. PostDelegate connects accounts on **mastodon.social**.

## What you need

- An account on mastodon.social. Accounts on other Mastodon servers cannot be connected yet.

## Connect

1. On the calendar page choose **Add Channel**, then **Mastodon**.
2. Sign in to mastodon.social and approve the permissions. PostDelegate asks to read your profile, publish posts and upload media.
3. The account appears as a channel on your calendar. PostDelegate never sees your Mastodon password.

## What gets published

- Text of up to 500 characters.
- Up to 4 images, or 1 video, per post. Alt text you add to an image is sent to Mastodon as its description.
- Add more entries with **Add post in a thread** to publish a thread of replies.
- Every post is published as a public post.

## Post settings

Mastodon has no extra post settings.

## Limits

- PostDelegate waits until Mastodon has finished processing a video before the post goes out, so a post with a video can appear a little after its scheduled time. Put a video in the first post; replies don't wait for processing.
- If the media expires on Mastodon before the post is published, the post fails with that reason. Schedule it again.

## Troubleshooting

- **The channel asks to reconnect.** Mastodon stopped accepting the saved sign-in, for example because the login was disabled. Use **Reconnect channel** and sign in again. See [Reconnecting a channel](/docs/channels#reconnecting-a-channel).
