---
layout: ../../layouts/DocsLayout.astro
title: Getting started
description: Start your free trial, connect a channel and schedule your first post. About ten minutes from sign-up to a post on your calendar.
---

PostDelegate is a hosted social media scheduler. You write a post once, pick the channels it belongs on, and PostDelegate publishes it at the right time. This page walks through the first session. The rest of the docs go deeper on each part.

<div class="callout">

**Early access.** Today you can connect YouTube, Bluesky, DEV.to, Hashnode, Lemmy, Listmonk, Medium, Nostr, WordPress, Kick, Twitch, Tumblr, Dribbble, Slack, Telegram and Discord. Facebook, Instagram, Threads, TikTok, LinkedIn, Pinterest, X and others are coming soon, pending platform approvals. See [Channels overview](/docs/channels) for the current list.

</div>

## 1. Start your free trial

After signing up, pick a plan and start your 7-day free trial. No credit card is needed. Add one any time before the trial ends to keep your plan; see [Plans and billing](/docs/billing) for what happens when the trial ends.

1. Open [app.postdelegate.com](https://app.postdelegate.com/auth).
2. Create an account with your email, a password and your company name (it becomes your workspace name, at least 3 characters), or use Google sign-in. If your account needs email activation, open the link in the message we send you.
3. Sign in at [app.postdelegate.com/auth/login](https://app.postdelegate.com/auth/login) from then on.

Signing in with Google gives you access to PostDelegate. It does not connect a YouTube channel. Each publishing destination has its own connection step.

If anything goes wrong while signing up, email [support@postdelegate.com](mailto:support@postdelegate.com).

## 2. Connect a channel

A channel is one destination for your posts, such as a Bluesky profile or a WordPress site.

1. Open the **Calendar** page and choose **Add Channel**.
2. Pick a network. Some networks send you to the network's own sign-in page (YouTube, Kick, Twitch, Tumblr, Dribbble, Slack and Discord). Others ask you to paste a credential into PostDelegate, such as an app password, an API key or a site address. For Telegram you add a bot to your chat instead.
3. Follow the guide for your network: [YouTube](/docs/channels/youtube), [Bluesky](/docs/channels/bluesky), [DEV.to](/docs/channels/devto), [Hashnode](/docs/channels/hashnode), [Lemmy](/docs/channels/lemmy), [Listmonk](/docs/channels/listmonk), [Medium](/docs/channels/medium), [Nostr](/docs/channels/nostr), [WordPress](/docs/channels/wordpress), [Kick](/docs/channels/kick), [Twitch](/docs/channels/twitch), [Tumblr](/docs/channels/tumblr), [Dribbble](/docs/channels/dribbble), [Slack](/docs/channels/slack), [Telegram](/docs/channels/telegram), [Discord](/docs/channels/discord).

Your channels appear on the left of the calendar. Open a channel's menu to rename it, move it to a customer group, edit its time slots, disable it or delete it.

## 3. Create and schedule a post

1. Choose **Create Post** on the calendar page.
2. Select one or more channels.
3. Write your content, and add images or video from your device or the [media library](/docs/media). Some networks have extra fields, such as a title for articles or a visibility setting for videos. The composer shows them when they apply.
4. Choose a date and time, then **Add to Calendar** to schedule it. You can also **Save as draft**, or **Post now**.

See [Creating and scheduling posts](/docs/posts) for drafts, repeats, previews and comments.

## 4. Check your calendar

The calendar has **Day**, **Week**, **Month** and **List** views. A scheduled post sits on its date until it publishes. A post that could not publish shows an error you can read and fix. You also get an in-app notification when a post fails.

## Where things live

| Area | What it is for |
| --- | --- |
| **Calendar** | Your channels, scheduled posts, drafts and the composer. |
| **Analytics** | Per-channel statistics for the networks that provide them. |
| **Media** | Your media library. See [Media library](/docs/media). |
| **Billing** | Plan and payment details. See [Plans and billing](/docs/billing). |
| **Settings** | Profile, [team](/docs/team), [webhooks](/docs/webhooks), the **Agents / Dev** tab with your API key and MCP setup, sets, signatures and OAuth apps. Some tabs depend on your plan. |

## Next steps

- Group channels for clients with [customers](/docs/team#customers).
- Automate with the [REST API](/docs/api) or [connect your own AI assistant](/docs/mcp).
- Get an HTTP request each time a post goes live with [webhooks](/docs/webhooks).
