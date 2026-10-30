---
layout: ../../layouts/DocsLayout.astro
title: Channels overview
description: Which networks you can connect to PostDelegate today, how each connection works and what to do when a channel needs attention.
---

A channel is one connected account or destination, such as a Bluesky profile, a YouTube channel or a WordPress site. This page covers what is available now. Each network has its own guide with exact fields and post settings.

## Available now

| Network | How you connect | What you publish |
| --- | --- | --- |
| [YouTube](/docs/channels/youtube) | Google sign-in, then choose a channel | Videos |
| [Bluesky](/docs/channels/bluesky) | Service address, identifier and app password | Posts and threads, up to 4 images or 1 video |
| [DEV.to](/docs/channels/devto) | API key | Articles in Markdown |
| [Hashnode](/docs/channels/hashnode) | API key | Articles in Markdown |
| [Lemmy](/docs/channels/lemmy) | Instance address, username and password | Posts to communities |
| [Listmonk](/docs/channels/listmonk) | Your Listmonk address, username and password | Email campaigns |
| [Medium](/docs/channels/medium) | Integration token | Stories in Markdown |
| [Nostr](/docs/channels/nostr) | Hex private key | Notes |
| [WordPress](/docs/channels/wordpress) | Site address, username and application password | Posts and pages |

## Coming soon

Facebook, Instagram, Threads, TikTok, LinkedIn, Pinterest, X and several other networks are in preparation. Each one needs approval from the network before PostDelegate can offer a connection, so we do not give dates. See [Coming soon](/docs/channels/coming-soon). A network that is not in the table above does not work today.

## How connections work

There are two kinds of connection.

**Sign in with the network.** You are sent to the network's own page, approve PostDelegate, and come back. PostDelegate never sees your network password. YouTube works this way.

**Paste a credential.** You enter an app password, API key or site address into PostDelegate. The other eight networks work this way. Credentials you type are encrypted before they are stored. Use the narrowest credential the network offers, such as an app password or a dedicated API key, so you can revoke it from the network without changing your main password.

Whichever kind it is, you start from **Add Channel** on the calendar page.

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
