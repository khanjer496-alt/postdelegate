---
layout: ../../../layouts/DocsLayout.astro
title: Telegram
description: Add @PostDelegateBot to a Telegram channel or group, send one connect command, then schedule messages with text, photos, videos and files.
---

Telegram is a messaging app with public and private channels and groups. Connecting it lets PostDelegate send scheduled messages to a channel or group you manage, through the PostDelegate bot.

## What you need

- A Telegram channel or group where you can add members and, for a channel, appoint admins.
- For a **channel**, the Telegram app on your phone or computer. Telegram's web version does not let you make a bot a channel admin. Groups can be connected from any version, including the web.

## Connect

1. In Telegram, add **@PostDelegateBot** to your channel or group.
   - **Channel:** make @PostDelegateBot an admin with permission to post messages. Only admins can post in a channel.
   - **Group:** add @PostDelegateBot as a member. Making it an admin is optional, but it lets the bot tidy up after connecting.
2. In PostDelegate, on the calendar page choose **Add Channel**, then **Telegram**, and choose **Connect Telegram**.
3. PostDelegate shows a command such as `/connect AB12`. Copy it and send it as a message in the channel or group.
4. PostDelegate finds the message within a few seconds and the channel or group appears on your calendar. Keep the dialog open until it does.

If the bot is an admin, it deletes your `/connect` message and posts a short confirmation that removes itself after 10 seconds. If it is not an admin, it posts a confirmation and asks you to delete those messages yourself.

## What gets published

- Each post is sent as a message from @PostDelegateBot, not from your own Telegram account.
- Text can be up to 4,096 characters. Bold and underline carry over; other formatting is removed, so paste links as plain URLs, which Telegram turns into links.
- Attach photos, videos or other files. A single attachment is sent with your text as its caption. Several attachments are sent as an album of up to 10 items, with the text on the first album.
- With an attachment, Telegram limits the caption to 1,024 characters. Keep longer text for posts without media, or put it in a follow-up entry.
- Follow-up entries in a post are sent as replies to the first message.

## Troubleshooting

- **The dialog keeps waiting after I sent the command.** Check that @PostDelegateBot is in the chat and, for a channel, that it is an admin who can post. Send the command exactly as shown, then wait a few seconds.
- **I can't make the bot an admin of my channel.** Use the Telegram app on your phone or computer. Telegram's web version doesn't offer this.
- **A post fails with a caption error.** The text is longer than Telegram allows with media attached. Shorten it to 1,024 characters or remove the attachment.
- **Posts stop arriving.** The bot was removed from the chat or lost its admin rights. Add it back, then reconnect the channel. See [Reconnecting a channel](/docs/channels#reconnecting-a-channel).
