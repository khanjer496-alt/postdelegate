---
layout: ../../layouts/Guide.astro
title: "Twitch chat announcements: how to schedule them on Twitch and Kick"
metaTitle: "Twitch Chat Announcements: How to Schedule Them | PostDelegate"
description: "Sign in with Twitch and Kick, then schedule chat messages and highlighted Twitch announcements for stream reminders, schedules and links, from one calendar."
date: "2026-11-01"
---

Streamers repeat themselves a lot in chat: the schedule, the Discord link, the sponsor line, the reminder that the giveaway ends at nine. Typing it by hand in the middle of a stream is a distraction, and chat bots that loop the same line every few minutes can feel like noise. Scheduling those messages for the moments they matter is a quieter middle ground.

This guide shows how to schedule chat messages to Twitch and Kick with PostDelegate, including highlighted Twitch announcements, and how to plan a stream's messages in one go. Both connections are available today. The [Twitch chat message scheduler](/twitch-scheduler) is the short version.

## What a scheduled chat message is, and is not

It helps to be clear about what this does before you plan around it.

- A scheduled message is **sent to your channel's chat** at the time you choose. People who are in chat at that moment see it.
- It is **not a go-live notification**. Followers who are not in your chat are not alerted by it. Twitch and Kick send their own notifications when you go live.
- Messages are **text only**, up to 500 characters. Images and video are not sent.

So scheduled messages work best for things that should land while people are watching: a reminder before a segment, a link at the right moment, or the schedule near the end of a stream.

## Step 1: connect Twitch

1. On the calendar page choose **Add Channel**, then **Twitch**.
2. Sign in with Twitch and approve the permissions. PostDelegate asks to read and write chat messages and to manage announcements in your chat.
3. You come back to PostDelegate, and the channel appears on your calendar.

Messages go to your channel's chat from your own Twitch account.

## Step 2: connect Kick

1. Choose **Add Channel**, then **Kick**.
2. Sign in with Kick and approve the permissions. PostDelegate asks to read your user and channel details and to write chat messages.
3. You come back, and the Kick channel appears on your calendar.

You sign in with each platform on its own page, so PostDelegate never sees your Twitch or Kick password.

## Step 3: write the message once for both

Choose **Create Post** and select both your Twitch and Kick channels. Write the message once. Each channel keeps its own settings, and you can adjust the text per channel if one audience needs something different, such as a platform-specific command.

Keep it under 500 characters. The composer counts as you type. Chat moves quickly, so a short line with one clear point usually reads better than a paragraph.

## Step 4: make it a Twitch announcement

Twitch has two message types, set in the post settings for the Twitch channel:

| Setting | Options |
| --- | --- |
| **Message Type** | **Chat Message** (the default) or **Announcement**. An announcement is highlighted in chat. |
| **Announcement Color** | Shown for announcements. **Primary** (the default), **Blue**, **Green**, **Orange** or **Purple**. |

Use announcements sparingly. If every message is highlighted, none of them stand out. A good rule is to keep announcements for the things viewers would be sorry to miss, such as a giveaway closing or a schedule change.

Kick has no extra post settings, so the same post goes to Kick as a regular chat message.

## Step 5: add follow-up messages

Use **Add post in a thread** to add more entries to the same post:

- On **Twitch**, follow-ups are sent as replies to the first message. With **Announcement** chosen, they are sent as further announcements.
- On **Kick**, follow-ups are sent as replies to the first message.

You can delay a follow-up so it appears after the first message rather than immediately behind it. That is useful for a two-step reminder, such as "starting in 15 minutes" followed later by the link.

## Step 6: schedule it

Pick a date and time. Dates and times follow the timezone in **Settings > Global Settings**, so check it if you stream for an audience in another timezone. Then choose:

| Choice | What happens |
| --- | --- |
| **Save as draft** | Stored on your calendar, never sent until you schedule it. |
| **Add to Calendar** | Sent automatically at the date and time you picked. |
| **Post now** | Sent right away. |

Sent messages stay on your calendar, so you can see what went out and when.

## Plan a stream's messages in one sitting

A simple plan for a stream that starts at 19:00:

1. **18:45, Twitch announcement and Kick message.** "Starting in 15 minutes: tonight we finish the boss rush."
2. **19:30, chat message on both.** The link to the thing you are talking about.
3. **20:45, Twitch announcement in Orange and Kick message.** "Giveaway closes in 15 minutes."
4. **21:00, chat message on both.** Next week's schedule.

Create these once, check them on the calendar, and you do not have to think about them during the stream. If the stream moves, open the posts and change the times. A scheduled post can be moved back to draft at any time before it goes out.

## Repeat the messages you send every week

For a line you send at the same point in every stream, use **Repeat Post Every** to publish it on a fixed interval of days. A weekly stream would repeat every 7 days. A repeating post appears on the calendar once per repetition, and deleting it deletes every repetition.

If you want the wording to change from week to week, make the post evergreen instead. Evergreen posts can stop after a number of shares or on a date, and rotate through up to 10 other wordings. Each wording must fit every channel on the post, which here means 500 characters. See [evergreen posts](/docs/evergreen).

If you plan a whole month at once, a spreadsheet can be faster than the composer. The [CSV bulk scheduling guide](/guides/bulk-schedule-social-posts-csv) shows how, including the Twitch announcement settings in a CSV row.

## Tell the rest of your audience too

Chat only reaches people who are already watching. On the same calendar you can schedule the announcement to the places your audience follows you between streams, such as a Bluesky post before you go live, or a message in your Discord server or a community Slack. See [how to schedule Bluesky posts](/guides/schedule-bluesky-posts), [Discord announcements](/guides/discord-announcement-scheduling) and [Slack announcements](/guides/slack-scheduled-announcements).

## Troubleshooting

- **The channel asks to reconnect.** Twitch or Kick stopped accepting the saved sign-in, for example after you changed your password or removed the app. Use **Reconnect channel** and sign in again. Scheduled messages will not send until you do.
- **A message did not appear.** The calendar shows the platform's reason on the post, and PostDelegate sends an in-app notification.
- **An image was not sent.** Twitch and Kick messages are text only. Paste a link instead.

## Next steps

The [Twitch scheduler page](/twitch-scheduler) and the [Kick scheduler page](/kick-scheduler) are the short versions of this guide. The references are the [Twitch channel guide](/docs/channels/twitch) and the [Kick channel guide](/docs/channels/kick).

Ready? [Start your 7-day free trial](https://app.postdelegate.com/auth). No credit card is required.
