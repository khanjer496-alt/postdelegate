---
layout: ../../layouts/DocsLayout.astro
title: Channels overview
description: Which networks you can connect to PostDelegate today, which are waiting on approval, how each connection works, and what to do when a channel needs to be reconnected.
---

A channel is one connected account or destination, such as a Bluesky profile, a YouTube channel or a WordPress site. This page covers what is available now. Each network has its own guide with exact fields and post settings.

## Available now

| Network | How you connect | What you publish |
| --- | --- | --- |
| [LinkedIn personal profiles](/docs/channels/linkedin) | LinkedIn sign-in | Public profile posts |
| [YouTube](/docs/channels/youtube) | Google sign-in, then choose a channel | Videos |
| [Bluesky](/docs/channels/bluesky) | Service address, identifier and app password | Posts and threads, up to 4 images or 1 video |
| [DEV.to](/docs/channels/devto) | API key | Articles in Markdown |
| [Hashnode](/docs/channels/hashnode) | API key | Articles in Markdown |
| [Lemmy](/docs/channels/lemmy) | Instance address, username and password | Posts to communities |
| [Listmonk](/docs/channels/listmonk) | Your Listmonk address, username and password | Email campaigns |
| [Medium](/docs/channels/medium) | Integration token | Stories in Markdown |
| [Moltbook](/docs/channels/moltbook) | Moltbook agent connection | Text posts |
| [Whop](/docs/channels/whop) | Whop sign-in | Forum posts |
| [Nostr](/docs/channels/nostr) | Hex private key | Notes |
| [WordPress](/docs/channels/wordpress) | Site address, username and application password | Posts and pages |
| [Kick](/docs/channels/kick) | Kick sign-in | Chat messages |
| [Twitch](/docs/channels/twitch) | Twitch sign-in | Chat messages and announcements |
| [Tumblr](/docs/channels/tumblr) | Tumblr sign-in, then choose a blog | Posts with text, images or a video |
| [Dribbble](/docs/channels/dribbble) | Dribbble sign-in | Shots, one image each |
| [Slack](/docs/channels/slack) | Add PostDelegate to a workspace | Messages to a channel |
| [Telegram](/docs/channels/telegram) | Add @PostDelegateBot, then send a connect command | Messages to a channel or group |
| [Discord](/docs/channels/discord) | Discord sign-in, then add the bot to a server | Messages to a channel |
| [Mastodon](/docs/channels/mastodon) | Mastodon sign-in (mastodon.social) | Posts and threads, up to 4 images or 1 video |
| [Google Business Profile](/docs/channels/google-business) | Google sign-in, then pick a business location | Updates, events and offers, with 1 optional image |

## Bring your own app

| Network | How you connect | What you publish |
| --- | --- | --- |
| [Reddit (Own app)](/docs/channels/reddit) | Create a Reddit "web app" in your own account, then paste its client ID and secret | Posts to subreddits, for personal, non-commercial use |

Reddit is not in the list above and is not counted in the networks available on the [platform status](/platforms) page. PostDelegate does not offer its own Reddit connection yet, so Reddit works only through an app you create yourself.

## Waiting on approval

Facebook, Instagram, Threads, TikTok, LinkedIn company Pages, and Pinterest are waiting on approval from each network. We do not give dates. See [Waiting on approval](/docs/channels/coming-soon). X is not available on PostDelegate. A network that is not in the tables above does not work today.

## How connections work

There are four kinds of connection.

**Sign in with the network.** You are sent to the network's own page, approve PostDelegate, and come back. PostDelegate never sees your network password. LinkedIn personal profiles, YouTube, Kick, Twitch, Tumblr, Dribbble, Slack, Discord, Mastodon and Google Business Profile work this way. For Discord, approving also adds the PostDelegate bot to the server you choose.

**Paste a credential.** You enter an app password, API key or site address into PostDelegate. Bluesky, DEV.to, Hashnode, Lemmy, Listmonk, Medium, Nostr and WordPress work this way. Credentials you type are encrypted before they are stored. Use the narrowest credential the network offers, such as an app password or a dedicated API key, so you can revoke it from the network without changing your main password.

**Add a bot.** For Telegram you add @PostDelegateBot to your channel or group and send a short connect command there. No password or key is involved.

**Use your own app.** For Reddit you create an app in your own Reddit account and paste its client ID and secret into PostDelegate, then approve the connection on Reddit. It is for personal, non-commercial use and is connected from the app only.

Whichever kind it is, you start from **Add Channel** on the calendar page.

## Connecting more than one account

You can connect several accounts from the same network, such as two YouTube channels, three Bluesky profiles or a Slack workspace for each client. Each account is its own channel, with its own settings, time slots and posts. To add another one, choose **Add Channel** and pick the network again.

**Every connected account counts as one channel on your plan.** There is no separate limit per network, so you can mix networks however you like up to your plan's total. See [pricing](/pricing) for how many channels each plan includes. A channel that is turned off does not use a slot, and turning it back on needs room on your plan. Channels a downgrade locked unlock by themselves when you upgrade, oldest first, as many as the new plan has room for. Channels you turned off yourself stay off until you turn them on.

**Connecting the same account twice updates it.** If you connect an account that is already in the workspace, PostDelegate refreshes the existing channel instead of adding a copy.

**Networks you sign in to remember who you are.** LinkedIn personal profiles, YouTube, Kick, Twitch, Tumblr, Dribbble, Slack, Discord, Mastodon and Google Business Profile send you to the network's own page. If you are already signed in there, the network usually approves the account you are signed in to, without asking. To add a different account:

1. Open the network's website in the same browser and sign out, or switch to the other account.
2. Back in PostDelegate, choose **Add Channel** and the network again.
3. Sign in with the account you want to add.

A private or incognito window also works, as long as you sign in to PostDelegate in that window too.

Some networks let one login hold several destinations. On YouTube, choose the channel after you sign in; to connect another channel from the same Google account, add YouTube again and choose the other one. On Tumblr, each blog is its own channel. On Slack, each workspace is one channel and you pick the Slack channel for each post. On Discord, each server is one channel and you pick the Discord channel for each post; add Discord again to connect another server. On Telegram, add @PostDelegateBot to each channel or group you want to post to.

**Networks where you paste a credential** take whatever you enter, so use the app password, API key or site address of the account you want to add.

To keep many accounts organised, file them under a [customer](/docs/team#customers), for example one per client.

## Managing a channel

Open a channel's menu on the calendar page to:

- **Rename channel**, or reset to the network's name.
- **Move / add to group**, to file it under a [customer](/docs/team#customers).
- **Edit Time Slots**, the times of day you prefer to publish.
- **Update Credentials**, for networks where you paste credentials, when you change a password or key.
- **Disable Channel** to pause it without deleting its history, and **Enable Channel** to resume.
- **Delete** to remove it. Delete the posts on it first.

## Reconnecting a channel

If a network stops accepting PostDelegate, for example after you change a password or revoke access, the channel shows a reconnect prompt and your scheduled posts for it will not publish. Use **Reconnect channel**, or **Update Credentials** on networks where you paste credentials.

## Content rules differ per network

Length limits, media rules and required fields vary. The composer enforces them before you schedule, and the API returns the same checks as a readable `400` error. If a post fails after scheduling, the calendar shows the network's reason.
