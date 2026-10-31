---
layout: ../../layouts/Guide.astro
title: "How to schedule social media posts with Claude (MCP)"
metaTitle: "Schedule Social Media Posts with Claude (MCP) | PostDelegate"
description: "Add PostDelegate to Claude as a custom connector, then have Claude list your channels, draft posts and schedule them after you review each one."
date: "2026-11-01"
---

Claude can write a good post, but it cannot publish one on its own. It needs a way into your scheduler. MCP, the Model Context Protocol, is that way in. PostDelegate runs an MCP server, so once Claude is connected it can look at your channels, read the rules of each network, create drafts and schedule posts, while you review the result in your calendar.

This guide walks through the whole path: connecting Claude, asking for a first draft, checking it, and scheduling it. It uses a Bluesky channel for the examples, but the same steps work for any [channel you can connect today](/docs/channels).

## What you need

- A PostDelegate account. Every plan starts with a 7-day free trial and needs no credit card, and every plan includes the public API and MCP.
- At least one connected channel. If you have none yet, follow the [channel guides](/docs/channels) first. Bluesky, WordPress and Slack take a few minutes.
- A Claude account that can add custom connectors. Whether it can depends on your Claude plan and, on team plans, on what your organisation allows. Anthropic and your admin decide that, not PostDelegate.

PostDelegate is not in Claude's connector directory, so you add it by address.

## How Claude and PostDelegate work together

PostDelegate doesn’t sell AI. Claude is the assistant, PostDelegate is the calendar and publisher. Claude calls tools that PostDelegate exposes, and those tools do the same checks as the app and the API. Any usage costs on the Claude side are between you and Anthropic, and PostDelegate never charges for AI.

The tools cover four jobs: finding your channels, reading each channel's rules, creating posts, and handling media. The [MCP tools reference](/docs/mcp/tools) lists them all. The ones that matter for this guide are:

| Tool | What Claude uses it for |
| --- | --- |
| `integrationList` | Lists your connected channels. |
| `integrationSchema` | Returns a channel's post rules, its length limit and the settings it needs. |
| `integrationSchedulePostTool` | Creates a draft, a scheduled post or an immediate post, and returns a preview link. |
| `postsListTool` | Lists what is already on your calendar between two dates. |
| `uploadFromUrlTool` | Adds an image or video from a public link to your media library. |


## Step 1: add PostDelegate as a custom connector

1. In Claude open **Settings**, then **Connectors**, then **Add custom connector**.
2. Enter a name such as `PostDelegate`.
3. Paste this address as the server URL:

```text
https://app.postdelegate.com/mcp-oauth-dynamic
```

4. Choose **Add**, then **Connect**. A PostDelegate page opens in your browser.
5. Sign in to PostDelegate if asked. The page shows the name of the app asking for access. Click **Authorize**.
6. Back in Claude, the connector shows as connected.

This is sign in with PostDelegate over OAuth, so there is no API key to copy. The same address is shown under **Settings > Agents / Dev** in the app. The menus in step 1 are Claude's own, and Anthropic may rename them. The [Claude setup page](/docs/mcp/claude) keeps the current steps.

## Step 2: check the connection with something harmless

Start a conversation, make sure the PostDelegate connector is switched on for it, and ask a question that cannot change anything:

> List my PostDelegate channels.

Claude calls `integrationList` and answers with the channels in your workspace. If it lists the right ones, you are connected to the right workspace. A different workspace needs a separate sign-in.

## Step 3: ask for a draft, not a post

Be explicit about the word draft:

> Write a short post announcing our new feature and save it as a draft on my Bluesky channel for tomorrow at 9am. Show me the preview link.

Claude looks up the channel, reads the Bluesky rules with `integrationSchema` (300 characters, up to four images or one video), writes the post and creates a draft. It returns a preview link in the form `https://app.postdelegate.com/p/POST_ID?share=true`.

Open that link, or open your calendar, and read the post as it will appear. Posts created through MCP are labelled with how they were created, so you can tell them apart from posts you wrote yourself.

A few things worth asking for in the prompt:

- **The exact channel.** If you have two Bluesky accounts, name the one you mean.
- **The time and your timezone.** Dates and times in the app follow the timezone in your profile settings. The API and webhooks use UTC.

## Step 4: review it in the calendar

The draft is stored on your calendar and does not publish until it is scheduled. Open it, edit the wording, change the time, or attach media from the [media library](/docs/media). This is the step that keeps you in control, so do not skip it because the draft looks right in chat.

If the post needs a network-specific setting, check that too. An article on DEV.to needs a title and tags, a YouTube video needs a visibility choice, and a Lemmy post needs a community. Claude can fill these in from the schema, and the [channel guides](/docs/channels) list them so you know what to look for.

## Step 5: schedule when you are ready

When the draft is right, either move it to scheduled in the app with **Add to Calendar**, or tell Claude:

> Schedule that draft for tomorrow at 9am.

Say **schedule** only when you mean it. Scheduled posts publish automatically at the chosen time.

## Adding media

Claude cannot see files on your computer. There are three ways to get media into a post:

- Upload it in the app, then ask Claude to use it. `mediaListTool` lets Claude find files already in your library.
- Give Claude a public link. `uploadFromUrlTool` adds an image or video from that address to your library.
- If your client supports interactive MCP apps, an upload widget lets you add a file from your device. Other clients do not show it.

Uploaded media is served through public links, so only upload material that is meant to be public. The [media guide](/docs/media) has formats and size limits.

## Staying in control

An assistant connected over MCP can do what the tools allow, and that includes scheduling, publishing and deleting posts on your connected channels. A few habits keep that safe:

- Ask for a draft first and check it in the calendar.
- Keep Claude's tool approval prompts on. Claude shows a prompt before running a tool that changes something. Read it, especially for scheduling and deleting.
- Revoke access whenever you want from **Settings > Apps > Approved Apps** in PostDelegate. These tokens do not expire on their own, so revoking is how you end access.
- Be wary of any assistant that treats text inside a post or a video as instructions. Content from your posts is data to show you.

## What Claude cannot do

Claude can only work with channels that are connected in PostDelegate. Facebook, Instagram, LinkedIn, TikTok, X and other networks are coming soon and need each network's approval first, so Claude cannot publish to them yet. It can still help you write the text.

## Troubleshooting

- **The sign-in window never opens.** Your client may not support OAuth for remote servers. Use the API key address from the [MCP overview](/docs/mcp) instead.
- **`401` or "Invalid API Key or OAuth token".** The key was rotated or sent in the wrong form. Over MCP the key goes as `Authorization: Bearer YOUR_API_KEY`.
- **A tool is missing.** The server lists only the tools your connection address offers.

## Next steps

Try the flow once with a draft on a channel you control, then make it routine. The [MCP overview](/docs/mcp) covers the other ways to sign in, the [Claude and Cowork page](/claude-cowork) shows how it fits a content workflow, and the [Bluesky scheduler page](/bluesky-scheduler) is a good first channel. If you plan to use ChatGPT as well, read [how to schedule with ChatGPT](/guides/schedule-social-media-posts-with-chatgpt).

Ready to try it? [Start your 7-day free trial](https://app.postdelegate.com/auth). No credit card is required.
