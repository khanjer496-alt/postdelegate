---
layout: ../../layouts/DocsLayout.astro
title: Creating and scheduling posts
description: How the composer, calendar and preview links work in PostDelegate, the difference between a draft, a scheduled post and a post sent now, and time slots.
---

## The composer

Choose **Create Post** on the calendar page. The composer lets you:

- Pick one or more channels. The same post can go to several channels at once, and each channel keeps its own settings.
- Write the content once, then adjust it per channel when a network needs something different.
- Attach images and video from your device or from the [media library](/docs/media).
- Fill in the extra fields a network asks for. Article networks ask for a title, YouTube asks for a title and visibility, and Lemmy asks for a community. See each [channel guide](/docs/channels) for the fields.
- Add tags to organise your calendar.
- Turn on **Short Link** to shorten the URLs in your post so you can see click statistics.

### Content format

Networks differ in how they take text. Plain networks such as Bluesky, Lemmy, Nostr and YouTube take text with simple formatting. Medium, DEV.to and Hashnode take Markdown. WordPress and Listmonk take HTML. The composer switches editor to match the channel.

Each network also has its own length limit, and the composer counts as you type. A few from the connected networks:

| Network | Limit |
| --- | --- |
| Bluesky | 300 characters |
| YouTube | 5,000 characters |
| Hashnode | 10,000 characters |
| Lemmy | 10,000 characters |
| DEV.to, Medium, Nostr, WordPress | 100,000 characters |

Your post is rejected with a readable message if it is empty, too long, or missing something the network requires, such as a video for YouTube.

## Draft, schedule or post now

| Choice | What happens |
| --- | --- |
| **Save as draft** | The post is stored on your calendar and never publishes until you schedule it. Drafts skip most settings checks, so you can save half-finished work. |
| **Add to Calendar** | The post is scheduled for the date and time you picked and publishes automatically. |
| **Post now** | The post is sent right away. |

You can move a draft to scheduled, or a scheduled post back to draft, at any time before it publishes. Published posts stay on your calendar with a link to the live post. Publishing an already published post again has to be requested explicitly, which prevents accidental duplicates. In the API that is the `republish` flag.

Dates and times follow the timezone in **Settings > Global Settings**. The REST API and webhooks use UTC.

## Threads and comments

Some networks support a series of posts. Add more entries to the same post with **Add post in a thread**. How they appear depends on the network. On Bluesky they become a thread of replies. You can delay a follow-up comment so it appears after the first post.

## Repeating posts

Use **Repeat Post Every** to publish the same post on a fixed interval of days. A repeating post appears on the calendar once per repetition. Deleting it deletes every repetition.

## Time slots

Every channel has time slots, the times of day you prefer to publish. Open the channel's menu and choose **Edit Time Slots**. Slots power the "next free slot" suggestions in the app and in the API's [find-slot endpoint](/docs/api/more#get-find-slotid).

## Previews and comments

Open a post's preview to see how it will read. Choose **Share with a client** to copy a preview link. Anyone with the link can read the post and leave comments on selected text without an account. Comments on text lose their highlight if the text is edited afterwards.

## Sets and signatures

- **Sets** save a reusable starting point for posts. Open them from **Settings > Sets**.
- **Signatures** save text you can drop at the end of posts, from **Settings > Signatures**.

Both are available on paid plans.

## When something goes wrong

If a network rejects a post, the calendar shows the error on that post and PostDelegate sends an in-app notification. Fix the content or reconnect the channel, then reschedule. If a channel's credentials stop working, the channel shows a reconnect prompt. See [Channels overview](/docs/channels#reconnecting-a-channel).
