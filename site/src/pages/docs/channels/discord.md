---
layout: ../../../layouts/DocsLayout.astro
title: Discord
description: Add the PostDelegate bot to a Discord server you manage, then schedule messages with Markdown, images, videos and mentions to the channel you pick.
---

Discord is a chat app built around community servers. Connecting it adds the PostDelegate bot to one of your servers, so PostDelegate can send scheduled messages to the channel you pick for each post.

## What you need

- A Discord server where you have the **Manage Server** permission. Discord only lets people with that permission add a bot, and only lists those servers when you connect.

## Connect

1. On the calendar page choose **Add Channel**, then **Discord**.
2. Discord asks you to sign in if you are not already, then shows which server to add the bot to. Choose the server.
3. Approve the request. PostDelegate asks to see your Discord username and the servers you are in, and gives its bot permission to send messages, create threads and send messages in threads.
4. You come back to PostDelegate and the server appears on your calendar under the bot's name.

Each server is one channel in PostDelegate. Use **Rename channel** in its menu to give it the server's name. To connect another server, choose **Add Channel** and **Discord** again and pick the other server, then rename that one too so they are easy to tell apart.

## What gets published

- Each post is sent as a message from the PostDelegate bot, not from your own Discord account, to the Discord channel you choose in the post settings.
- Text can be up to 1,980 characters. Discord allows 2,000, and PostDelegate keeps a small margin.
- Formatting is kept as Discord Markdown: bold, underline, headings, bullet lists and links all carry over.
- Attach images or videos. They are uploaded as files with the message, and Discord takes up to 10 files per message.
- To mention someone, open the Discord version of the post, type **@** and at least two letters. You can pick server members, **@here** and **@everyone**. The bot's permissions in your server decide whether an @here or @everyone mention notifies people.
- Add a follow-up with **Add comment**. The first follow-up entry in a post opens a thread on your message, named "Thread", and is posted inside it. Further entries are posted in the channel itself.
- In an announcement channel the message is posted but not published to servers that follow the channel. Use **Publish** in Discord if you want that.

To change the name the bot shows in your server, choose **Change Bot Nickname** in the channel's menu on the calendar page. This also renames the channel in PostDelegate, unless you have already renamed it with **Rename channel**.

## Post settings

| Setting | Notes |
| --- | --- |
| Channel | Required. Choose the Discord channel to post to. The list shows the server's text, announcement and forum channels. Pick a text or announcement channel, because posts are sent as messages and forum channels need a new post instead. |

## Troubleshooting

- **"Bot doesn't have access to this channel".** The channel is private, or its permissions hide it from the bot. In Discord, open the channel's settings, then **Permissions**, and add the PostDelegate bot with **View Channel** and **Send Messages**.
- **"Bot lacks permission to send messages in this channel".** The bot can see the channel but a permission override stops it posting. Allow **Send Messages** for the bot in that channel, and **Attach Files** if the post has media.
- **"Channel no longer exists".** The channel was deleted in Discord. Pick another channel in the post settings.
- **Every post to the server fails.** The bot was removed from the server. Use **Reconnect channel** and add the bot to the server again. See [Reconnecting a channel](/docs/channels#reconnecting-a-channel).
- **"Attachment exceeds Discord's size limit".** A file is larger than Discord allows in your server. Use a smaller or shorter file.
- **A post to a forum channel fails.** Choose a text or announcement channel instead.
- **An @everyone or @here mention did not notify anyone.** In Discord, allow the bot's role to mention @everyone, @here and all roles.
