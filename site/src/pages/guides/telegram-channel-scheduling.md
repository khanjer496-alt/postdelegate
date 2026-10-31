---
layout: ../../layouts/Guide.astro
title: "How to schedule posts to a Telegram channel or group"
metaTitle: "Schedule Posts to a Telegram Channel or Group | PostDelegate"
description: "Add @PostDelegateBot to your Telegram channel or group as an admin, link it with a one-time command, then schedule text, images and albums from a calendar."
date: "2026-11-01"
---

A Telegram channel is one of the most direct ways to reach an audience: no feed ranking, just your post in their chat list. That also makes timing matter. A post that lands at 3am for most subscribers is easy to scroll past by morning. Scheduling lets you write when it suits you and publish when it suits them.

This guide explains how scheduling to a Telegram channel or group works in PostDelegate: adding the bot, linking the chat, what a post can contain, and the limits to plan around.

<div class="doc-note">

**Telegram is in early rollout.** It is not yet on the list of [channels that work today](/docs/channels), and it does not have a page in the docs yet. If you see Telegram under **Add Channel** in your workspace, the steps below apply. If you do not, it has not reached your workspace yet. Check the [channels overview](/docs/channels) before you plan around it.

</div>

## How the Telegram connection works

Most networks connect with a sign-in or an API key. Telegram is different. PostDelegate publishes through a Telegram bot, **@PostDelegateBot**, that you add to your channel or group. You never give PostDelegate your Telegram login or phone number.

- The bot posts **as the channel** in a channel, the same way an admin's post appears.
- In a group, posts appear **from the bot**.
- You link each chat once, with a short command the app gives you.

Each linked chat becomes one channel on your PostDelegate calendar, named after the chat's title.

## What you need

- A Telegram channel or group where you are an admin, so you can add a bot and give it rights.
- The Telegram app, to add the bot and send the linking command.
- A PostDelegate workspace. Every plan starts with a 7-day free trial and needs no credit card.

## Step 1: add @PostDelegateBot as an admin

In Telegram, open your channel or group, then its settings:

1. Go to **Administrators** and choose to add an admin.
2. Search for **@PostDelegateBot** and select it.
3. For a channel, make sure it can **post messages**. Telegram only lets bots post in a channel when they are an admin with that right.
4. Optionally allow it to **delete messages**. The bot uses this only to clean up the linking command in the next step.

The names of these screens belong to Telegram and can differ between the phone and desktop apps.

## Step 2: link the chat to PostDelegate

1. On the PostDelegate calendar page choose **Add Channel**, then **Telegram**.
2. The window asks you to add the bot to your channel or group. Choose **Connect Telegram**.
3. The window shows a command such as `/connect ab12`. Choose **Copy**.
4. Paste the command into your Telegram channel or group as a message and send it.
5. Back in PostDelegate, keep the window open. It checks for the command every couple of seconds, and the chat appears on your calendar once the bot sees it.

The command is unique to this attempt, which is how PostDelegate knows which chat to link to your workspace.

After linking, the bot replies in the chat. If it can delete messages, it removes your command and its own reply after about ten seconds. If it cannot, it says so, and you can delete both messages yourself.

## Step 3: write the post

Choose **Create Post** and select your Telegram channel.

- **Length.** Text messages can be up to 4,096 characters, and the composer counts as you type.
- **Formatting.** Bold and underline carry over. Other formatting is removed, so paste links as plain URLs, which Telegram turns into links.
- **Paragraphs.** Each paragraph in the editor becomes its own line in Telegram.

Telegram allows much shorter text when it is a caption on a photo or video than when it is a message on its own. If a post with media is rejected for length, shorten the text, or send the long text as a separate entry (see step 5).

## Step 4: add images, video or files

| What you attach | What Telegram gets |
| --- | --- |
| Nothing | A text message. |
| One image or video | That image or video, with your text as its caption. |
| Two or more | An album. Telegram allows up to 10 items in an album, so more are split into several albums, and your text is the caption on the first item. |

Media comes from your device or the [media library](/docs/media). If Telegram cannot download a file, the post fails with "Telegram could not download your media file", so check the file and try again.

## Step 5: add follow-up messages

Use **Add post in a thread** to add more entries to the same post. On Telegram, each follow-up is sent as a reply to the message before it. That suits a long announcement split into readable parts, or a photo post followed by the full text.

You can delay a follow-up so it appears later rather than immediately behind the first message.

## Step 6: schedule it

Pick a date and time. Dates and times follow the timezone in your profile settings. Then choose:

| Choice | What happens |
| --- | --- |
| **Save as draft** | Stored on your calendar, never sent until you schedule it. |
| **Add to Calendar** | Sent automatically at the date and time you picked. |
| **Post now** | Sent right away. |

Once a post has gone out it stays on your calendar with a link to the message. Public channels and groups get a normal `t.me` link. Private ones get a link that only members can open.

## Run several chats from one calendar

Link each channel or group separately, by repeating step 2 in that chat. You can then select several Telegram chats in one post, alongside other channels, and adjust the text per chat. If you manage chats for clients, file each one under a customer with **Move / add to group** in the channel's menu. See [team and customers](/docs/team).

For posts that repeat, such as a weekly digest reminder, use **Repeat Post Every**, or make the post [evergreen](/docs/evergreen) to rotate the wording. For many posts at once, use the [CSV import](/guides/bulk-schedule-social-posts-csv).

## Let an assistant draft for your channel

If you use Claude or ChatGPT, connect PostDelegate over MCP and ask for **drafts** to your Telegram channel. Keep **Require approval for AI-created posts** on in **Settings > Approvals**, so nothing an assistant schedules reaches your subscribers before a person approves it. See [how to let an AI agent post safely](/guides/ai-social-media-agent-guardrails). AI is bring-your-own, and PostDelegate never charges for it.

## Troubleshooting

- **Nothing happens after sending the command.** Check that @PostDelegateBot is in the chat, and in a channel that it is an admin who can post. Send the exact command from the window, then keep the window open.
- **The command and the bot's reply stay in the chat.** The bot is not allowed to delete messages. Delete them yourself, or give it that right.
- **"Telegram rejected the post".** Telegram gives a reason after it, such as text that is too long for a caption. Fix the post and reschedule.
- **Telegram could not download your media file.** Check the file in your media library and try again.
- **Posts stopped after a change in Telegram.** If the bot was removed or lost its admin rights, add it back with the right to post.

## Next steps

Telegram does not have a scheduler page or a docs page yet. The [platform directory](/platforms) shows what you can connect today, and [Coming soon](/docs/channels/coming-soon) explains how new connections open. For other community chats, read [how to schedule Slack announcements](/guides/slack-scheduled-announcements) and [Discord announcement scheduling](/guides/discord-announcement-scheduling).

Ready? [Start your 7-day free trial](https://app.postdelegate.com/auth). No credit card is required.
