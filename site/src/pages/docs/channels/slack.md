---
layout: ../../../layouts/DocsLayout.astro
title: Slack
description: Add PostDelegate to a Slack workspace, then send scheduled messages with text and images to the channel you pick.
---

Slack is a workplace chat app. Connecting it lets PostDelegate send scheduled messages to a channel in your workspace.

## What you need

- A Slack workspace where you are allowed to add apps.

## Connect

1. On the calendar page choose **Add Channel**, then **Slack**.
2. Choose the workspace and allow PostDelegate. It asks to see the workspace's channels and members, join public channels, and post messages.
3. You come back to PostDelegate and the workspace appears on your calendar.

## What gets published

- Each post is sent as a message to the channel you pick. Posts appear from the PostDelegate app, not from your own Slack account.
- Text uses Slack's own formatting.
- Add images as PNG, JPG or GIF. Video is not supported.
- Follow-up entries in a post are sent as replies in a thread under the first message.

## Post settings

| Setting | Notes |
| --- | --- |
| Channel | Required. Choose the Slack channel to post to. PostDelegate joins a public channel on its own before posting. |

## Troubleshooting

- **A private channel is missing or the post fails.** PostDelegate cannot join private channels by itself. Invite the PostDelegate app to the channel in Slack, then pick it again.
- **The channel asks to reconnect.** The app was removed from the workspace or its access was revoked. Use **Reconnect channel** and add PostDelegate to the workspace again. See [Reconnecting a channel](/docs/channels#reconnecting-a-channel).
