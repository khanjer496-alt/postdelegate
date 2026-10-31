---
layout: ../../layouts/Guide.astro
title: "How Discord announcement scheduling works (coming soon)"
metaTitle: "Discord Announcement Scheduling (Coming Soon) | PostDelegate"
description: "Discord is coming soon to PostDelegate. How scheduled announcements to a server channel will work with a bot, and what you can plan for your community today."
date: "2026-11-01"
---

Discord servers run on announcements: patch notes, event reminders, stream alerts, the weekly community call. Most of them are written ahead of time and posted by hand at the right moment, which means someone has to be there at that moment. Scheduling them takes that job away.

**Discord is coming soon to PostDelegate. It cannot be connected today.** This guide explains how scheduled Discord announcements are planned to work, so you know what to expect, and what you can do for your community in the meantime. Details may change before the connection opens.

## Where Discord stands

PostDelegate only offers a connection once it is ready to publish reliably for everyone. Discord is not on the list of [channels that work today](/docs/channels), and there is no Discord page in the docs yet. When the connection opens, it will appear under **Add Channel** in the app and get a guide in the docs. We do not give dates. See [Coming soon](/docs/channels/coming-soon).

## How it is planned to work

Discord's model is different from a social network's. You do not post as yourself. A bot that belongs to PostDelegate joins your server and posts in the channels you choose.

### Connecting a server

The planned flow follows the usual Discord pattern for adding a bot:

1. You choose **Add Channel**, then **Discord**, in PostDelegate.
2. You sign in with Discord on Discord's own page and pick the server to add the bot to. You need permission to add apps to that server, which usually means the **Manage Server** permission.
3. You approve the permissions the bot asks for, then come back to PostDelegate.

Each server becomes one channel on your PostDelegate calendar. PostDelegate never sees your Discord password.

### Choosing where each post goes

Like Slack, one connected server holds many channels, so each post will have a **Channel** setting. The planned list covers the kinds of channel where announcements usually live: regular text channels, announcement channels and forum channels.

The bot can only post where Discord lets it. If a channel's permissions keep the bot out, or stop it sending messages, the post fails with a clear reason, such as the bot not having access to that channel.

### What a post can contain

- **Text in Markdown.** Discord's own formatting, such as bold, lists and code blocks.
- **Length.** Discord limits messages to 2,000 characters. Plan announcements to stay comfortably under that.
- **Images and files** attached to the message.
- **Mentions,** including `@here` and `@everyone`, so an announcement can ping the server. Use those with care.

### Follow-ups in a thread

On other chat networks, extra entries in a post become replies. On Discord, the plan is that follow-up entries open a thread from the first message and continue there. That keeps a long announcement readable: the headline in the channel, the details and the discussion in the thread.

## What you can do today

You do not have to wait to get your announcement routine in order.

### 1. Plan Discord announcements as drafts

Write next month's announcements in PostDelegate now, on a channel you can connect today, and keep them as drafts. Drafts are stored on your calendar and never publish until you schedule them. When Discord opens, you can copy the text into a Discord post. Use [campaigns and tags](/docs/campaigns) to label them, so they are easy to find.

### 2. Schedule the same announcement where your community also is

Many communities live in more than one place. These connections work today:

- **Slack**, for community or team workspaces. Messages go to the channel you pick, with images and thread replies. See [how to schedule Slack announcements](/guides/slack-scheduled-announcements).
- **Twitch and Kick chat**, for stream reminders while people are watching. See [scheduling Twitch and Kick chat announcements](/guides/twitch-and-kick-chat-announcements).
- **Telegram**, for channels and groups. Posts go out through @PostDelegateBot, with photos, videos and albums. See [how to schedule posts to a Telegram channel or group](/guides/telegram-channel-scheduling).
- **Bluesky**, for public announcements. See [how to schedule Bluesky posts](/guides/schedule-bluesky-posts).

### 3. Set up review before anything is public

Announcements to a whole server are hard to take back. Decide now who approves them. In **Settings > Approvals**, turn on **Require approval before publishing** so posts from members who can't approve wait for review. When Discord opens, the same rules apply to it as to every other channel. See the [approval workflow guide](/guides/client-approval-workflow).

### 4. Keep a reusable announcement format

Save a reusable starting point under **Settings > Sets**, and a standard sign-off under **Settings > Signatures**, so every announcement has the same structure: what changed, what to do, where to ask. Sets and signatures are available on paid plans.

## A good structure for server announcements

Whatever tool you use, announcements read better when they follow one shape:

1. **One line that says what happened.** "Version 2.3 is out."
2. **What people need to do.** "Update before Friday's event."
3. **Where the details are.** A link, or a thread with the full notes.
4. **Who to ask.** A channel or a person.

Keep `@everyone` for things that affect everyone. A server that is pinged for every small update learns to mute the channel.

## Let an assistant prepare announcements

If you write with Claude or ChatGPT, connect PostDelegate over MCP and ask for drafts on the channels you have today. Keep **Require approval for AI-created posts** on, so anything an assistant schedules waits until a person approves it. See [how to let an AI agent post safely](/guides/ai-social-media-agent-guardrails). AI is bring-your-own, and PostDelegate never charges for it.

## Common questions

- **Can I connect Discord with a webhook URL today?** No. There is no Discord connection of any kind in PostDelegate yet.
- **Will the messages come from my own account?** No. The plan is that a PostDelegate bot posts them, as is normal for scheduled posts on Discord.
- **Can I use the Discord announcements I draft now?** Yes. Drafts stay on your calendar until you schedule or delete them, so you can copy them into Discord posts later.

## Tell us you need it

If Discord is the reason you are looking at PostDelegate, [email support](mailto:support@postdelegate.com) and say so. It helps us prioritise.

## Next steps

Discord does not have a scheduler page or a docs page yet. The [platform directory](/platforms) shows which networks you can connect today, and the [channels overview](/docs/channels) explains how connections work.

Ready to plan in the meantime? [Start your 7-day free trial](https://app.postdelegate.com/auth). No credit card is required.
