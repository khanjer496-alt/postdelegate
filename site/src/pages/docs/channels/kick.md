---
layout: ../../../layouts/DocsLayout.astro
title: Kick
description: Connect a Kick channel to PostDelegate by signing in with Kick, then send scheduled messages to your channel's chat. What gets published, settings and fixes.
---

Kick is a live-streaming platform. Connecting it lets PostDelegate send a scheduled message to your channel's chat.

## What you need

- A Kick account with a channel.

## Connect

1. On the calendar page choose **Add Channel**, then **Kick**.
2. Sign in with Kick and approve the permissions. PostDelegate asks to read your user and channel details and to write chat messages.
3. You come back to PostDelegate and the channel appears on your calendar.

## What gets published

- Each post is sent as a chat message to your channel, up to 500 characters.
- Messages are text only. Images and video are not sent.
- Follow-up entries in a post are sent as replies to the first message.

## Post settings

Kick has no extra post settings.

## Troubleshooting

- **The channel asks to reconnect.** Kick stopped accepting the saved sign-in. Use **Reconnect channel** and sign in with Kick again. See [Reconnecting a channel](/docs/channels#reconnecting-a-channel).
