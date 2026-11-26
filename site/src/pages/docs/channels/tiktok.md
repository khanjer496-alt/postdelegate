---
layout: ../../../layouts/DocsLayout.astro
title: TikTok
description: Connect a TikTok account to PostDelegate and schedule videos. Posts can go to the TikTok inbox, or publish privately until TikTok finishes its posting audit.
---

TikTok is available to connect today. You can schedule a video from the composer and either send it to your TikTok inbox to finish there, or publish it directly. Until TikTok finishes its Direct Post audit, videos published directly go out as **Only me** (private). Inbox upload is the way to finish a public post in the TikTok app today.

## What you need

- A TikTok account.
- A video for each TikTok post. Photo posts can also be sent; video posts need a video file.

## Connect

1. On the calendar page choose **Add Channel**, then **TikTok**.
2. Sign in with TikTok and approve the permissions. PostDelegate asks for basic profile information, and for permission to list, upload and publish videos.
3. The channel appears on your calendar.

PostDelegate never sees your TikTok password. To add a different TikTok account, sign out of TikTok in the same browser (or use a private window), then choose **Add Channel** and **TikTok** again.

TikTok Business is a separate connection and is not offered on PostDelegate today.

## How posts go out

Every TikTok post has a **Content posting method**:

| Method | What happens |
| --- | --- |
| **Post content directly to TikTok** | PostDelegate publishes the post to the connected account. Until TikTok finishes its Direct Post audit, those posts go out as **Only me**. Public, friends and other visibility choices cannot go live through this method until that audit is complete. |
| **Upload content to TikTok without posting it** | The video is sent to the creator inbox in the TikTok app. You open TikTok, finish the caption and privacy there, and publish it yourself. Inbox items expire after 24 hours, and TikTok limits pending inbox posts to five in any 24-hour period. Privacy, comments, duet, stitch and branded-content settings are not applied in this mode; you set them in TikTok. |

Posts sent through the public API, the CLI, MCP or an AI assistant, bulk upload or CSV import always go to the creator's TikTok inbox to finish in the TikTok app. Posting directly, with your choice of who can see the post, happens only in the PostDelegate composer.

## Post settings

These settings apply when you post directly to TikTok. They are ignored on inbox uploads, because you finish those in the TikTok app.

| Setting | Notes |
| --- | --- |
| Who can see this post? | Required for a direct post. The options TikTok offers for your account, such as **Everyone**, **Friends** or **Only me**. Until the Direct Post audit is finished, a direct post is published as **Only me** even if another option is selected. |
| Title | Optional, for photo posts, up to 90 characters. On a video, the post text is the caption (up to 2,200 characters). |
| Comments, duet and stitch | Optional toggles, on a direct post only. |
| Branded content and AI labels | Optional disclosures on a direct post. Branded content cannot be marked **Only me**. |

Your account also has a maximum video length, which PostDelegate reads from TikTok when you connect and when you publish.

## Analytics

TikTok only lists public videos in analytics. Posts set to **Only me** do not appear there.

## Good to know

- If the channel shows a reconnect prompt, sign in with TikTok again. See [Reconnecting a channel](/docs/channels#reconnecting-a-channel).
- To remove everything PostDelegate holds, see [Privacy and data deletion](/docs/privacy).
