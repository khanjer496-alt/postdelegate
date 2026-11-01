---
layout: ../../layouts/Guide.astro
title: "How to schedule Bluesky posts and threads"
metaTitle: "How to Schedule Bluesky Posts and Threads | PostDelegate"
description: "Connect Bluesky with an app password, then schedule posts, threads, images and video from one calendar. Includes time slots, repeats and the API."
date: "2026-11-01"
---

If you want a Bluesky post to go out at 9am while you are asleep or offline, you need a tool that holds it and publishes it for you. This guide shows how to do that in PostDelegate: connect your account safely, write a post or a thread, attach media, and choose when it goes out.

## What you need

- A Bluesky account.
- An **app password** for it. An app password is a separate password you can revoke at any time without changing your main one.
- A PostDelegate workspace. Every plan starts with a 7-day free trial and needs no credit card.

If you would rather keep your main password out of it, the app password is the right choice. PostDelegate never needs the password you sign in with.

## Step 1: create a Bluesky app password

In the Bluesky app open **Settings, Privacy and security, App passwords** and create one. Name it something you will recognise, such as `PostDelegate`, and copy it. Bluesky owns that screen, so its wording may change.

If two-factor authentication is turned on for your Bluesky account, note that the connection does not support it. The in-app tip says to turn it off if you want to connect.

## Step 2: connect Bluesky to PostDelegate

1. On the calendar page choose **Add Channel**, then **Bluesky**.
2. Fill in the three fields:

| Field | What to enter |
| --- | --- |
| Service | `https://bsky.social`, the default. Only change it if your account lives on a different Bluesky-compatible server. It must be a public HTTPS address. |
| Identifier | Your handle, for example `name.bsky.social`, or the email on the account. |
| Password | The app password. |

3. Click **Connect**. PostDelegate signs in to check the details and shows the channel on your calendar.

If you change the app password later, use **Update Credentials** in the channel's menu. If Bluesky rejects the saved login, the channel shows a reconnect prompt and scheduled posts for it will not publish until you update the credentials.

## Step 3: write the post

Choose **Create Post** on the calendar page and select your Bluesky channel. Bluesky has no extra post settings, so there is nothing to fill in beyond the content.

- **Length.** Posts are limited to 300 characters. The composer counts as you type. Bluesky counts graphemes, the characters a reader sees, so an emoji or a flag counts as one. You can also paste text into the [caption checker](/tools/caption-checker), which shows the count for each network.
- **Images or video.** Attach up to 4 images, or 1 video. You cannot mix them. Images are reduced automatically to fit Bluesky's size limit. Video must be MP4.
- **Links.** Paste the URL into the text. If you want click statistics, turn on **Short Link** to shorten the URLs in your post. The [UTM link builder](/tools/utm-builder) helps you tag them first.
- **Alt text.** Click a media item in the composer to set its alt text.

## Step 4: turn it into a thread

Use **Add post in a thread** to add more entries to the same post. Each entry is limited to 300 characters, and on Bluesky they are published as a thread of replies.

Two details help:

- The first entry is the post that appears on your profile, so make it stand on its own.
- You can delay a follow-up comment so it appears after the first post rather than immediately behind it.

## Step 5: choose when it goes out

Pick a date and time. Dates and times follow the timezone in **Settings > Global Settings**. Then choose one of three options:

| Choice | What happens |
| --- | --- |
| **Save as draft** | The post is stored on your calendar and never publishes until you schedule it. |
| **Add to Calendar** | The post is scheduled for the date and time you picked and publishes automatically. |
| **Post now** | The post is sent right away. |

You can move a draft to scheduled, or a scheduled post back to draft, at any time before it publishes. Published posts stay on your calendar with a link to the live post.

## Use time slots

Every channel has time slots, the times of day you prefer to publish. Open the channel's menu and choose **Edit Time Slots**. Slots power the "next free slot" suggestions in the app and in the API's find-slot endpoint, so you can fill the calendar without picking each time by hand.

## Repeat a post

Use **Repeat Post Every** to publish the same post on a fixed interval of days. A repeating post appears on the calendar once per repetition, and deleting it deletes every repetition. Use it for things that are genuinely worth repeating, such as a recurring reminder.

## Schedule Bluesky posts with Claude or ChatGPT

If you already use an AI assistant, it can do the drafting for you. Add PostDelegate to Claude or ChatGPT as a custom connector, and the assistant can read Bluesky's rules, create a draft on your channel and give you a preview link. A prompt that works:

> Draft a post about our product update for my Bluesky channel, under 300 characters. Do not schedule it yet.

You review the draft in the calendar, then schedule it. The walkthroughs are [Claude](/guides/schedule-social-media-posts-with-claude) and [ChatGPT](/guides/schedule-social-media-posts-with-chatgpt). AI is bring-your-own, and PostDelegate never charges for it.

## Schedule from a script with the API

For automation, the REST API creates the same posts. A scheduled Bluesky post needs a date in UTC, the channel id from the integrations endpoint, the content as HTML and empty settings:

```bash
curl -X POST https://app.postdelegate.com/api/public/v1/posts \
  -H "Authorization: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "schedule",
    "date": "2026-11-05T14:00:00.000Z",
    "shortLink": false,
    "tags": [],
    "posts": [
      {
        "integration": { "id": "CHANNEL_ID" },
        "value": [{ "content": "<p>Hello from the API.</p>", "image": [] }],
        "settings": {}
      }
    ]
  }'
```

See the [Posts API](/docs/api/posts) for every field.

## Troubleshooting

- **Invalid credentials.** Check the handle and generate a fresh app password.
- **Invalid service URL.** The service address must be a public HTTPS URL.
- **The channel asks to reconnect.** Bluesky rejected the saved login. Use **Update Credentials** with a new app password.
- **A post failed.** The calendar shows Bluesky's reason on that post, and PostDelegate sends an in-app notification. Fix the content or reconnect the channel, then reschedule.

## Next steps

The [Bluesky scheduler page](/bluesky-scheduler) is the short version of this guide, and the [Bluesky channel guide](/docs/channels/bluesky) is the reference for fields and limits. If you write for other networks too, the [character limits guide](/guides/social-media-character-limits) compares them. To schedule many posts at once, see [bulk scheduling from a CSV](/guides/bulk-schedule-social-posts-csv), and for another open network, [how to schedule Nostr notes](/guides/nostr-scheduling).

Ready? [Start your 7-day free trial](https://app.postdelegate.com/auth). No credit card is required.
