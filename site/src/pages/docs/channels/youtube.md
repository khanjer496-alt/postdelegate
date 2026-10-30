---
layout: ../../../layouts/DocsLayout.astro
title: YouTube
description: Connect a YouTube channel with Google sign-in and schedule video uploads with a title, visibility, thumbnail and tags.
---

## What you need

- A Google account that owns or manages the YouTube channel.
- A video file (MP4) for every post. YouTube posts cannot be text only.

## Connect

1. On the calendar page choose **Add Channel**, then **YouTube**.
2. Sign in with Google and approve the permissions. PostDelegate asks to see your profile and email, read your YouTube channel and statistics, and upload videos.
3. If your Google account has more than one channel, choose the channel to connect.

Signing in to PostDelegate with Google does not connect a YouTube channel. You still need this step.

<div class="callout">

**One Google project, several channels.** PostDelegate uses a single Google project for YouTube. Disconnecting a channel revokes this Google account's permissions for that project, which also affects your other connected YouTube channels and Google sign-in for the same account. PostDelegate removes the saved channel data and analytics. Your videos stay on YouTube, and you can reconnect afterwards.

</div>

## Post settings

| Setting | Notes |
| --- | --- |
| Title | Required. 2 to 100 characters. |
| Visibility | Required. **Public**, **Private** or **Unlisted**. |
| Made for kids | Optional. **Yes** or **No**. |
| Thumbnail | Optional image. Custom thumbnails need a phone-verified YouTube channel. YouTube may ignore them on videos it treats as Shorts. The video is still published if YouTube rejects a thumbnail. |
| Tags | Optional. All tags together can use at most 500 characters. A tag with a space counts two extra characters. |

The post text becomes the video description, up to 5,000 characters. Add the video as the post's attachment.

## Good to know

- Uploads follow YouTube's own daily quota, so large batches can be slowed down by YouTube.
- If the channel shows a reconnect prompt, sign in with Google again. See [Reconnecting a channel](/docs/channels#reconnecting-a-channel).
- To remove everything PostDelegate holds, see [Privacy and data deletion](/docs/privacy).
