---
layout: ../../../layouts/DocsLayout.astro
title: Listmonk
description: Connect your self-hosted Listmonk to PostDelegate and send an email campaign when a post goes out. What you need, campaign settings, content and fixes.
---

Listmonk is open-source newsletter software you host yourself. Connecting it lets PostDelegate create a campaign in your Listmonk and start it on a schedule.

<div class="callout warn">

**Publishing starts the campaign.** When the post goes out, PostDelegate creates a regular campaign on your chosen list and sets it to running, which sends it. Use a PostDelegate draft to hold a campaign back, and send a test through Listmonk itself first.

</div>

## What you need

- A running Listmonk reachable from the internet over `http://` or `https://`.
- A Listmonk username and password that can read settings and lists and create campaigns. Listmonk owns how those are created.

## Connect

1. On the calendar page choose **Add Channel**, then **ListMonk**.
2. Fill in the fields:

| Field | What to enter |
| --- | --- |
| URL | The address of your Listmonk, for example `https://news.example.com`. |
| Username | Your Listmonk username. |
| Password | The matching password. |

3. Save. PostDelegate reads your Listmonk settings to check the details and uses your site name as the channel name.

## Post settings

| Setting | Notes |
| --- | --- |
| Subject | Required. The email subject. |
| Preview | The preview text shown next to the subject in many inboxes. |
| List | Required. Choose from the lists in your Listmonk. |
| Template | Optional. Choose a Listmonk template, or **Default**. |

## Content

The editor writes HTML. Put pictures inside the content where they should appear, using images from the [media library](/docs/media). Attachments are not sent.

## Troubleshooting

- **Invalid credentials.** Check the URL, username and password, and that the API is enabled in Listmonk.
- **Lists do not load.** The account needs permission to read lists.
