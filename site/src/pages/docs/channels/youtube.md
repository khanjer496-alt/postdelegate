---
layout: ../../../layouts/DocsLayout.astro
title: YouTube
description: Connect a YouTube channel with Google sign-in and schedule uploads with a title, visibility, thumbnail, tags, a later publish time and the AI content label.
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
| Altered or synthetic content | Optional. **Yes** or **No**, defaults to **No**. See [AI and altered content label](#ai-and-altered-content-label). |
| Thumbnail | Optional image. Custom thumbnails need a phone-verified YouTube channel. YouTube may ignore them on videos it treats as Shorts. The video is still published if YouTube rejects a thumbnail. |
| Tags | Optional. All tags together can use at most 500 characters. A tag with a space counts two extra characters. |
| Publish later on YouTube | Optional. A date and time when YouTube makes the video public. See [Publish later on YouTube](#publish-later-on-youtube). |

The post text becomes the video description, up to 5,000 characters. Add the video as the post's attachment.

## Publish later on YouTube

Turn on **Publish later on YouTube** and pick a date and time. PostDelegate still uploads the video at the post's scheduled time, but as **Private**. YouTube then makes it public at the time you picked, so the video is processed and ready before it goes live.

- The time must be in the future and after the post's own scheduled time.
- While this is on, the **Visibility** setting is not used. The video stays private until YouTube publishes it.
- If the post goes out after the chosen time (for example it was moved later on the calendar), the video is published as public straight away. The same happens for later runs of a repeating post, because the chosen time has passed by then.
- To change the time after the upload, edit the video in YouTube Studio.

## AI and altered content label

Set **This video contains realistic altered or synthetic content** to **Yes** to add YouTube's altered or synthetic content label. YouTube requires it when realistic content was made or meaningfully changed with AI or other tools, for example:

- A real person appears to say or do something they did not.
- Footage of a real event or place is altered.
- A realistic-looking scene that never happened is generated.

You don't need it for clearly unrealistic content such as animation or fantasy, for small edits like beauty filters, colour correction or background blur, or when AI only helped with the script, title or ideas. See YouTube's [disclosure guidelines](https://support.google.com/youtube/answer/14328491).

## Good to know

- Uploads follow YouTube's own daily quota, so large batches can be slowed down by YouTube.
- If the channel shows a reconnect prompt, sign in with Google again. See [Reconnecting a channel](/docs/channels#reconnecting-a-channel).
- To remove everything PostDelegate holds, see [Privacy and data deletion](/docs/privacy).
