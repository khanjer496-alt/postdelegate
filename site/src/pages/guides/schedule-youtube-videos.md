---
layout: ../../layouts/Guide.astro
title: "How to schedule YouTube videos (title, thumbnail, visibility)"
metaTitle: "How to Schedule YouTube Videos (Title, Thumbnail) | PostDelegate"
description: "Connect a YouTube channel, set the title, visibility, thumbnail and tags, and schedule a video upload for a time you choose. Covers quotas and Shorts."
date: "2026-11-01"
---

A YouTube upload has more moving parts than a text post: a video file, a title, a description, a visibility choice, often a thumbnail, and tags. Scheduling means getting all of that ready ahead of time and letting the upload happen at the moment you chose. This guide walks through doing that in PostDelegate, including the details that most often trip people up.

## What you need

- A Google account that owns or manages the YouTube channel.
- A video file in MP4 format. YouTube posts cannot be text only, so every post needs a video.
- A PostDelegate workspace. Every plan starts with a 7-day free trial and needs no credit card.

## Step 1: connect your YouTube channel

1. On the calendar page choose **Add Channel**, then **YouTube**.
2. Sign in with Google and approve the permissions. PostDelegate asks to see your profile and email, read your YouTube channel and statistics, and upload videos.
3. If your Google account has more than one channel, choose the channel to connect.

Signing in to PostDelegate with Google does not connect a YouTube channel. Logging in and connecting are separate steps, and you still need this one.

One thing to know before you connect several channels: PostDelegate uses a single Google project for YouTube. Disconnecting a channel revokes this Google account's permissions for that project, which also affects your other connected YouTube channels and Google sign-in for the same account. PostDelegate removes the saved channel data and analytics. Your videos stay on YouTube, and you can reconnect afterwards.

## Step 2: add the video

Choose **Create Post** and select the YouTube channel. Attach the MP4 as the post's attachment. The media library accepts MP4 video up to 1 GB, and you can reuse a file from the library instead of uploading it again. See the [media guide](/docs/media) for formats and limits.

The text of the post becomes the video description, up to 5,000 characters. YouTube counts the description in bytes, so text in non-Latin scripts can reach the limit sooner. The [caption checker](/tools/caption-checker) shows the count for YouTube.

## Step 3: set the title and visibility

These are the YouTube settings in the composer:

| Setting | Notes |
| --- | --- |
| Title | Required. 2 to 100 characters. |
| Visibility | Required. **Public**, **Private** or **Unlisted**. |
| Made for kids | Optional. **Yes** or **No**. |
| Thumbnail | Optional image. Custom thumbnails need a phone-verified YouTube channel. YouTube may ignore them on videos it treats as Shorts. The video is still published if YouTube rejects a thumbnail. |
| Tags | Optional. All tags together can use at most 500 characters. A tag with a space counts two extra characters. |

**Visibility** deserves a deliberate choice, because it decides who can see the video the moment the upload finishes. Public is visible to everyone, Unlisted is visible to people who have the link, and Private is visible only to you and anyone you invite on YouTube.

**Made for kids** is a YouTube setting with its own rules. If you are unsure which answer applies to your video, check YouTube's own guidance rather than guessing.

## Step 4: add a thumbnail

Click the media item in the composer to set its thumbnail. Thumbnails are sent to every channel that supports them. Three points to remember:

- Custom thumbnails need a phone-verified YouTube channel.
- YouTube may ignore a custom thumbnail on videos it treats as Shorts.
- If YouTube rejects the thumbnail, the video is still published, so check the video on YouTube after it goes out.

## Step 5: choose when it uploads

Pick a date and time, then choose one of:

| Choice | What happens |
| --- | --- |
| **Save as draft** | The post is stored on your calendar and never publishes until you schedule it. |
| **Add to Calendar** | The post is scheduled for the date and time you picked and publishes automatically. |
| **Post now** | The upload starts right away. |

Dates and times follow the timezone in **Settings > Global Settings**. You can move a draft to scheduled, or a scheduled post back to draft, at any time before it publishes.

Use a draft while you are still finishing the video, then schedule it once the file and title are final. Drafts skip most settings checks, so you can save half-finished work. A scheduled post gets the full checks, and the composer tells you what is missing, such as a video or a title that is too short.

## Plan around YouTube's quota

Uploads follow YouTube's own daily quota, so large batches can be slowed down by YouTube. If you are scheduling many videos, spread them across days instead of stacking them at the same hour, and check the calendar for any that failed.

If YouTube rejects an upload, the calendar shows the reason on that post and PostDelegate sends an in-app notification. Fix the cause and reschedule.

## If the channel asks to reconnect

If the channel shows a reconnect prompt, YouTube has stopped accepting the saved sign-in. Sign in with Google again from **Reconnect channel**. Scheduled posts for the channel will not publish until you do.

## Prepare the video for the networks

Video sent to a network has to be in a format it accepts. When you upload through the API or an AI assistant, you can ask PostDelegate to adjust the file after upload: videos are scaled so the short side is 1080 px (long side at most 1920 px) and re-encoded as H.264 MP4 with AAC audio at up to 60 fps. While a file is being adjusted its status is `processing`. Wait until it is `ready` before publishing, because a post that publishes mid-adjustment uses the original, unadjusted file.

## Schedule YouTube videos with Claude or ChatGPT

An AI assistant can help with the writing around the video, such as the title and description. Connect PostDelegate to Claude or ChatGPT as a custom connector and ask for a draft on your YouTube channel. An assistant cannot read files on your computer, so upload the video in the app or give the assistant a public link that it can add to your library. Check the draft in the calendar before scheduling it. The [Claude](/guides/schedule-social-media-posts-with-claude) and [ChatGPT](/guides/schedule-social-media-posts-with-chatgpt) walkthroughs cover the setup.

## Troubleshooting

- **The post is rejected as missing a video.** Every YouTube post needs an MP4 attached.
- **The title is rejected.** It must be 2 to 100 characters.
- **Tags are rejected.** All tags together can use at most 500 characters, and each tag with a space counts two extra.
- **The thumbnail did not show.** Check that the channel is phone-verified. YouTube may also ignore thumbnails on Shorts.
- **To remove everything PostDelegate holds,** see [Privacy and data deletion](/docs/privacy).

## Next steps

The [YouTube scheduler page](/youtube-scheduler) is the short version of this guide, and the [YouTube channel guide](/docs/channels/youtube) is the reference. For the rest of your calendar, read [how to schedule Bluesky posts and threads](/guides/schedule-bluesky-posts).

Ready to schedule your first video? [Start your 7-day free trial](https://app.postdelegate.com/auth). No credit card is required.
