---
layout: ../../layouts/Guide.astro
title: "How to schedule Discord announcements to your server"
metaTitle: "How to Schedule Discord Announcements | PostDelegate"
description: "Add the PostDelegate bot to your Discord server, then schedule announcements with Markdown, images and mentions to the channel you pick, from one calendar."
date: "2026-11-01"
---

Discord servers run on announcements: patch notes, event reminders, stream alerts, the weekly community call. Most of them are written ahead of time and posted by hand at the right moment, which means someone has to be there at that moment. Scheduling takes that job away.

This guide shows how to schedule Discord announcements with PostDelegate: adding the bot, picking a channel, what a message can contain, and what to check when a post fails.

## How the Discord connection works

On Discord, scheduled posts come from a bot rather than from your own account. When you connect, you sign in with Discord and add the PostDelegate bot to a server you manage.

- Each post is sent as a message from the PostDelegate bot, not from your own Discord account.
- One Discord server is one channel in PostDelegate. You choose which Discord channel each post goes to in the post settings.
- PostDelegate never sees your Discord password.

## What you need

- A Discord server where you have the **Manage Server** permission. Discord only lets people with that permission add a bot.
- A PostDelegate workspace. Every plan starts with a 7-day free trial and needs no credit card.

## Step 1: add the bot to your server

1. On the PostDelegate calendar page choose **Add Channel**, then **Discord**.
2. Discord asks you to sign in if you are not already, then shows which server to add the bot to. Choose the server.
3. Approve the request. PostDelegate asks to see your Discord username and the servers you are in. The bot is allowed to send messages, create public and private threads, and send messages in threads.
4. You come back to PostDelegate and the server appears on your calendar under the bot's name.

Use **Rename channel** in the channel's menu to give it the server's name. If you run several servers, such as a main community and a staff server, connect and rename each one so they are easy to tell apart. To change the name the bot shows inside your server, choose **Change Bot Nickname** in the same menu. This also renames the channel in PostDelegate, unless you have already renamed it with **Rename channel**.

## Step 2: write the announcement

Choose **Create Post** and select your Discord server.

- **Length.** Text can be up to 1,980 characters, and the composer counts as you type. Discord allows 2,000, and PostDelegate keeps a small margin.
- **Formatting.** Bold, underline, headings, bullet lists and links are kept as Discord Markdown, so they look the way you wrote them.
- **Media.** Attach images or videos from your device or the [media library](/docs/media). They are uploaded as files with the message, and Discord takes up to 10 files per message. Very large files can be over the upload limit for your server.

## Step 3: mention people

Open the Discord version of the post, type **@** and at least two letters. PostDelegate searches your server and offers matching members, plus **@here** and **@everyone**.

A member mention always notifies that person. Whether @here and @everyone notify people is Discord's decision: the bot's role needs permission to mention @everyone, @here and all roles in your server.

Ping everyone only for things that affect everyone. A community that is notified about every small update learns to mute the channel.

## Step 4: pick the Discord channel

In the post settings, choose the channel the announcement goes to. The list shows the server's text, announcement and forum channels.

- **Text and announcement channels** take scheduled messages. Pick one of these.
- **Forum channels** appear in the list, but they need a new forum post rather than a message, so a scheduled message to a forum fails.
- **Announcement channels** get the message, but PostDelegate does not publish it to servers that follow the channel. If you rely on followers, press **Publish** on the message in Discord after it goes out.
- **Private channels** are hidden from the bot until you let it in. In Discord, open the channel's settings, then **Permissions**, and add the PostDelegate bot with **View Channel** and **Send Messages**. Add **Attach Files** too if your posts carry media.

To send the same announcement to two Discord channels in one server, create a second post for the other channel. Each post goes to one Discord channel.

## Step 5: add a follow-up in a thread

Use **Add comment** to add another entry. On Discord, the first follow-up entry opens a thread on your announcement, named "Thread", and is posted inside it. That keeps the details and the discussion under the announcement rather than in the main channel.

Further entries after the first follow-up are posted in the channel itself, so keep thread content to one follow-up. You can delay a follow-up so it appears later rather than immediately.

## Step 6: schedule it

Pick a date and time. Dates and times follow the timezone in your profile settings. Then choose:

| Choice | What happens |
| --- | --- |
| **Save as draft** | Stored on your calendar, never sent until you schedule it. |
| **Add to Calendar** | Sent automatically at the date and time you picked. |
| **Post now** | Sent right away. |

Once a post has gone out it stays on your calendar with a link to the message in Discord.

## Run your community channels from one calendar

A release note or event reminder rarely goes to one place. In the same post you can select your Discord server alongside other channels and adjust the text per channel:

- **Telegram.** Add @PostDelegateBot to your channel or group. See [how to schedule posts to a Telegram channel or group](/guides/telegram-channel-scheduling).
- **Slack.** Add PostDelegate to a community or team workspace. See [how to schedule Slack announcements](/guides/slack-scheduled-announcements).
- **Twitch and Kick chat.** Stream reminders for people who are watching. See [Twitch and Kick chat announcements](/guides/twitch-and-kick-chat-announcements).
- **Bluesky.** For public announcements. See [how to schedule Bluesky posts](/guides/schedule-bluesky-posts).

For posts that repeat, such as a weekly community call reminder, use **Repeat Post Every**. For a month of reminders at once, use the [CSV import](/guides/bulk-schedule-social-posts-csv). If you manage servers for clients, file each one under a customer with **Move / add to group** in the channel's menu. See [team and customers](/docs/team).

## A good structure for community announcements

Announcements read better when they follow one shape:

1. **One line that says what happened.** "Version 2.3 is out."
2. **What people need to do.** "Update before Friday's event."
3. **Where the details are.** A link, or a follow-up in the thread with the full notes.
4. **Who to ask.** A channel or a person.

A heading for the first line and a short bullet list for the rest work well on Discord, because the Markdown carries over.

## Have someone check announcements first

An announcement to a whole server is hard to take back gracefully. If several people write them, turn on **Require approval before publishing** in **Settings > Approvals**. Posts from members who can't approve are sent for review, and approvers see them in **Approvals** before anything reaches Discord. See the [approval workflow guide](/guides/client-approval-workflow).

## Let an assistant draft announcements

If you use Claude or ChatGPT, connect PostDelegate over MCP and ask for a **draft** to your Discord server. The assistant reads the channel's settings, so it knows a Discord channel must be chosen, and it can look up the list of channels. Keep **Require approval for AI-created posts** on in **Settings > Approvals**, so anything an assistant schedules or posts now waits in Approvals until a person approves it. See [how to let an AI agent post safely](/guides/ai-social-media-agent-guardrails). AI is bring-your-own, and PostDelegate never charges for it.

## Troubleshooting

- **"Bot doesn't have access to this channel".** The channel is private or hidden from the bot. Add the PostDelegate bot to the channel's permissions with **View Channel** and **Send Messages**.
- **"Bot lacks permission to send messages in this channel".** A permission override stops the bot posting. Allow **Send Messages** for it in that channel, and **Attach Files** if the post has media.
- **"Channel no longer exists".** The channel was deleted. Pick another one in the post settings.
- **"Attachment exceeds Discord's size limit".** Use a smaller or shorter file.
- **A post to a forum channel fails.** Choose a text or announcement channel instead.
- **An @everyone or @here mention did not notify anyone.** In Discord, allow the bot's role to mention @everyone, @here and all roles.
- **Every post to the server fails.** The bot was removed from the server. Use **Reconnect channel** and add it again. See [reconnecting a channel](/docs/channels#reconnecting-a-channel).

## Next steps

The [Discord scheduler page](/discord-scheduler) is the short version of this guide, and the [Discord channel guide](/docs/channels/discord) is the reference.

Ready? [Start your 7-day free trial](https://app.postdelegate.com/auth). No credit card is required.
