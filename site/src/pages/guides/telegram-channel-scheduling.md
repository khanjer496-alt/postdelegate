---
layout: ../../layouts/Guide.astro
title: "How to schedule posts to a Telegram channel or group"
metaTitle: "Schedule Posts to a Telegram Channel or Group | PostDelegate"
description: "Add @PostDelegateBot to your Telegram channel or group, link it with a one-time command, then schedule text, photos, videos and albums from one calendar."
date: "2026-11-01"
---

A Telegram channel is one of the most direct ways to reach an audience: no feed ranking, just your post in their chat list. That also makes timing matter. A post that lands at 3am for most subscribers is easy to scroll past by morning. Scheduling lets you write when it suits you and publish when it suits them.

This guide shows how to schedule posts to a Telegram channel or group with PostDelegate: adding the bot, linking the chat, what a post can contain, and the limits to plan around. Telegram is available to connect today.

## How the Telegram connection works

Most networks connect with a sign-in or an API key. Telegram is different. PostDelegate publishes through a Telegram bot, **@PostDelegateBot**, that you add to your channel or group. No password or key is involved, and PostDelegate never sees your Telegram login or phone number.

- Each post is sent through @PostDelegateBot, not from your own Telegram account.
- You link each chat once, with a short command the app gives you.
- Each linked chat becomes one channel on your PostDelegate calendar, named after the chat's title.

## What you need

- A Telegram channel or group where you can add members and, for a channel, appoint admins.
- For a **channel**, the Telegram app on your phone or computer. Telegram's web version does not let you make a bot a channel admin. Groups can be connected from any version, including the web.
- A PostDelegate workspace. Every plan starts with a 7-day free trial and needs no credit card.

## Step 1: add @PostDelegateBot to the chat

**For a channel:**

1. Open the channel in the Telegram app on your phone or computer, then its settings.
2. Go to **Administrators** and choose to add an admin.
3. Search for **@PostDelegateBot**, select it, and make sure it can **post messages**. Only admins can post in a channel.

**For a group:**

1. Add **@PostDelegateBot** as a member, from any version of Telegram.
2. Optionally make it an admin. That is not needed to post, but it lets the bot tidy up after connecting.

The names of these screens belong to Telegram and can differ between the phone and desktop apps. If you cannot find the option to make the bot a channel admin, you are probably on Telegram Web. Switch to the app.

## Step 2: link the chat to PostDelegate

1. On the PostDelegate calendar page choose **Add Channel**, then **Telegram**, and choose **Connect Telegram**.
2. PostDelegate shows a command such as `/connect AB12`. Choose **Copy**.
3. Send the command as a message in your Telegram channel or group.
4. Back in PostDelegate, keep the dialog open. It finds the message within a few seconds, and the chat appears on your calendar.

The command is unique to this attempt, which is how PostDelegate knows which chat to link to your workspace.

After linking, the bot replies in the chat. If it is an admin, it deletes your `/connect` message and posts a short confirmation that removes itself after 10 seconds. If it is not an admin, it posts a confirmation and asks you to delete those messages yourself.

## Step 3: write the post

Choose **Create Post** and select your Telegram channel.

- **Length.** Text can be up to 4,096 characters, and the composer counts as you type.
- **Formatting.** Bold and underline carry over. Paste links as plain URLs, which Telegram turns into links. Check the preview before you schedule.
- **Paragraphs.** Each paragraph in the editor becomes its own line in Telegram.

## Step 4: add photos, videos or files

| What you attach | What Telegram gets |
| --- | --- |
| Nothing | A text message, up to 4,096 characters. |
| One attachment | That photo, video or file, with your text as its caption. |
| Two or more | An album of up to 10 items, with your text on the first album. More than 10 are split into several albums. |

**With an attachment, Telegram limits the caption to 1,024 characters**, far less than the 4,096 allowed for text on its own. Keep longer text for posts without media, or put it in a follow-up entry (see step 5).

Media comes from your device or the [media library](/docs/media). If Telegram cannot download a file, the post fails with "Telegram could not download your media file", so check the file and try again.

## Step 5: add follow-up messages

Use **Add comment** to add more entries to the same post. On Telegram, follow-up entries are sent as replies to the first message.

That solves the caption limit neatly: a photo with a short caption first, then the full text as a reply. It also suits a long announcement split into readable parts.

You can delay a follow-up so it appears later rather than immediately behind the first message.

## Step 6: schedule it

Pick a date and time. Dates and times follow the timezone in **Settings > Global Settings**. Then choose:

| Choice | What happens |
| --- | --- |
| **Save as draft** | Stored on your calendar, never sent until you schedule it. |
| **Add to Calendar** | Sent automatically at the date and time you picked. |
| **Post now** | Sent right away. |

Once a post has gone out it stays on your calendar with a link to the message. Public channels and groups get a normal `t.me` link. Private ones get a link that only members can open.

## Run several chats from one calendar

Link each channel or group separately, by repeating step 2 in that chat. You can then select several Telegram chats in one post, alongside other channels such as Bluesky or Slack, and adjust the text per chat. If you manage chats for clients, file each one under a customer with **Move / add to group** in the channel's menu. See [team and customers](/docs/team).

For posts that repeat, such as a weekly digest reminder, use **Repeat Post Every**, or make the post [evergreen](/docs/evergreen) to rotate the wording. Each wording must fit every channel on the post. For many posts at once, use the [CSV import](/guides/bulk-schedule-social-posts-csv).

## Have someone check posts first

A post to a large channel lands in every subscriber's chat list and is hard to take back gracefully. If several people write for the channel, turn on **Require approval before publishing** in **Settings > Approvals**. Posts from members who can't approve are sent for review, and approvers see them in **Approvals** before anything reaches Telegram. See the [approval workflow guide](/guides/client-approval-workflow).

## Let an assistant draft for your channel

If you use Claude or ChatGPT, connect PostDelegate over MCP and ask for **drafts** to your Telegram channel. The assistant reads the channel's rules before it creates a post. Keep **Require approval for AI-created posts** on in **Settings > Approvals**, so anything an assistant schedules or posts now waits in Approvals until a person approves it. See [how to let an AI agent post safely](/guides/ai-social-media-agent-guardrails). AI is bring-your-own, and PostDelegate never charges for it.

## Troubleshooting

- **The dialog keeps waiting after I sent the command.** Check that @PostDelegateBot is in the chat and, for a channel, that it is an admin who can post. Send the command exactly as shown, then wait a few seconds.
- **I can't make the bot an admin of my channel.** Use the Telegram app on your phone or computer. Telegram's web version doesn't offer this.
- **The command and the bot's reply stay in the chat.** The bot is not an admin, so it cannot delete them. Delete them yourself.
- **A post fails with a caption error.** The text is longer than Telegram allows with media attached. Shorten it to 1,024 characters, move the rest to a follow-up, or remove the attachment.
- **Telegram could not download your media file.** Check the file in your media library and try again.
- **Posts stop arriving.** The bot was removed from the chat or lost its admin rights. Add it back, then reconnect the channel. See [reconnecting a channel](/docs/channels#reconnecting-a-channel).

## Next steps

The [Telegram scheduler page](/telegram-scheduler) is the short version of this guide, and the [Telegram channel guide](/docs/channels/telegram) is the reference. For other community chats, read [how to schedule Slack announcements](/guides/slack-scheduled-announcements) and [how to schedule Discord announcements](/guides/discord-announcement-scheduling).

Ready? [Start your 7-day free trial](https://app.postdelegate.com/auth). No credit card is required.
