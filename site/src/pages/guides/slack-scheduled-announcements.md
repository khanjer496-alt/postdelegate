---
layout: ../../layouts/Guide.astro
title: "How to schedule announcements to Slack channels"
metaTitle: "How to Schedule Slack Announcements | PostDelegate"
description: "Add PostDelegate to a Slack workspace and schedule team or community announcements with images to the channel you pick, with follow-ups sent in a thread."
date: "2026-11-01"
---

Slack can already schedule a message from your own account. That works for a one-off reminder. It works less well when the announcement is part of something bigger: a release that also goes to your blog, Bluesky and a community channel, written by one person and checked by another. Then you want the Slack message on the same calendar as everything else.

This guide shows how to schedule announcements to Slack channels with PostDelegate, for an internal team or a community workspace. It follows what the Slack connection actually does.

## What you need

- A Slack workspace where you are allowed to add apps. In many workspaces only admins can, or apps need approval first.
- A PostDelegate workspace. Every plan starts with a 7-day free trial and needs no credit card.

## How messages appear in Slack

Two details shape how you write for Slack through PostDelegate:

- **Messages come from the PostDelegate app, not your own Slack account.** That suits announcements from a team or a project. If people expect to see a person's name, add it to the message.
- **One Slack workspace is one channel in PostDelegate.** You choose which Slack channel each post goes to in the post settings.

## Step 1: add PostDelegate to Slack

1. On the calendar page choose **Add Channel**, then **Slack**.
2. Choose the workspace and allow PostDelegate. It asks to see the workspace's channels and members, join public channels, and post messages.
3. You come back to PostDelegate and the workspace appears on your calendar.

If you manage several workspaces, such as your company's and a community's, connect each one. Rename them in the channel menu with **Rename channel** so they are easy to tell apart.

## Step 2: write the announcement

Choose **Create Post** and select your Slack workspace. Write the message.

- **Formatting.** Text uses Slack's own formatting. Check the preview before you schedule.
- **Length.** Keep announcements short enough to read without expanding. Put the one thing people need to do near the top.
- **Images.** Add PNG, JPG or GIF images from your device or the [media library](/docs/media). Video is not supported.
- **Links.** Paste the URL into the text. Turn on **Short Link** if you want click statistics.

## Step 3: pick the Slack channel

In the post settings, choose the **Channel** to post to. This is required.

- **Public channels.** PostDelegate joins a public channel on its own before posting, so you can pick any public channel in the list.
- **Private channels.** PostDelegate cannot join private channels by itself. In Slack, invite the PostDelegate app to the channel first, then pick it again in the post settings.

To send the same announcement to two Slack channels in one workspace, create a second post for the other channel. Each post goes to one Slack channel.

## Step 4: add details in a thread

Use **Add comment** to add more entries. On Slack, follow-up entries are sent as replies in a thread under the first message.

That suits a common announcement shape:

1. **The first message** says what changed and what people should do, in two or three lines.
2. **A thread reply** has the details: the changelog, the link to the docs, the known issues.

People who only need the headline see the headline. People who need the detail find it in one place, and questions stay in the thread.

## Step 5: schedule it

Pick a date and time. Dates and times follow the timezone in your profile settings, which matters if your team is spread across timezones. Then choose:

| Choice | What happens |
| --- | --- |
| **Save as draft** | Stored on your calendar, never sent until you schedule it. |
| **Add to Calendar** | Sent automatically at the date and time you picked. |
| **Post now** | Sent right away. |

You can move a scheduled message back to draft at any time before it goes out. Sent messages stay on your calendar with a link to the message.

## Step 6: have someone check it first

Announcements to a large channel are hard to take back gracefully. If several people write them, turn on **Require approval before publishing** in **Settings > Approvals**. Posts from members who can't approve are sent for review instead of being scheduled, and approvers see them in **Approvals** before anything reaches Slack.

Approvers can approve, edit, request changes with a note, or reject. Every step is recorded in **Settings > Activity**. See the [approval workflow guide](/guides/client-approval-workflow).

## Recurring announcements

For things that repeat on a fixed interval of days, such as a weekly office-hours reminder, use **Repeat Post Every**. A repeating post appears on the calendar once per repetition, and deleting it deletes every repetition.

If the wording should change each time, make it evergreen instead. Evergreen posts can stop after a number of shares or on a date, and rotate through other wordings. See [evergreen posts](/docs/evergreen).

## Announce everywhere from one post

A release announcement rarely goes to Slack alone. In the same post you can select your Slack workspace and other channels, such as Bluesky or your Twitch chat, and adjust the text per channel. If the Slack message should go out at a different time from the public posts, create separate posts.

For a launch with an article, schedule the article first and the Slack message after, so the link works. See [how to schedule WordPress posts](/guides/schedule-wordpress-posts). For many announcements at once, such as a month of reminders, use the [CSV import](/guides/bulk-schedule-social-posts-csv).

## Draft announcements with an AI assistant

If you use Claude or ChatGPT, connect PostDelegate over MCP and ask for a **draft** to your Slack workspace. The assistant reads the channel's settings, so it knows a Slack channel must be chosen, and it can look up the list of channels. Keep **Require approval for AI-created posts** on, so anything an assistant schedules or posts now waits in Approvals until a person approves it. A draft stays a draft until someone schedules it. See [how to let an AI agent post safely](/guides/ai-social-media-agent-guardrails). AI is bring-your-own, and PostDelegate never charges for it.

## Know when a message went out

Webhooks can tell another system when a post is published, for example to log announcements or trigger the next step of a release. They fire after a post has gone out, not for drafts or failures. See [webhooks](/docs/webhooks).

## Troubleshooting

- **A private channel is missing or the post fails.** Invite the PostDelegate app to the channel in Slack, then pick the channel again.
- **The workspace asks to reconnect.** The app was removed from the workspace or its access was revoked. Use **Reconnect channel** and add PostDelegate to the workspace again. Scheduled messages will not send until you do.
- **Video did not appear.** Slack messages from PostDelegate take images only, as PNG, JPG or GIF.
- **A message failed.** The calendar shows Slack's reason on the post, and PostDelegate sends an in-app notification.

## Next steps

The [Slack scheduler page](/slack-scheduler) is the short version of this guide, and the [Slack channel guide](/docs/channels/slack) is the reference.

Ready? [Start your 7-day free trial](https://app.postdelegate.com/auth). No credit card is required.
