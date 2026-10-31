---
layout: ../../../layouts/DocsLayout.astro
title: Twitch
description: Connect a Twitch channel by signing in with Twitch and send scheduled chat messages or announcements to your channel's chat.
---

Twitch is a live-streaming platform. Connecting it lets PostDelegate send a scheduled message or announcement to your channel's chat.

## What you need

- A Twitch account with a channel.

## Connect

1. On the calendar page choose **Add Channel**, then **Twitch**.
2. Sign in with Twitch and approve the permissions. PostDelegate asks to read and write chat messages and to manage announcements in your chat.
3. You come back to PostDelegate and the channel appears on your calendar.

## What gets published

- Each post is sent to your channel's chat from your own Twitch account, up to 500 characters.
- Messages are text only. Images and video are not sent.
- Follow-up entries in a post are sent as replies to the first message. With **Announcement** chosen, they are sent as further announcements.

## Post settings

| Setting | Notes |
| --- | --- |
| Message Type | **Chat Message** (the default) or **Announcement**. An announcement is highlighted in chat. |
| Announcement Color | Shown for announcements. **Primary** (the default), **Blue**, **Green**, **Orange** or **Purple**. |

## Troubleshooting

- **The channel asks to reconnect.** Twitch stopped accepting the saved sign-in. Use **Reconnect channel** and sign in with Twitch again. See [Reconnecting a channel](/docs/channels#reconnecting-a-channel).
