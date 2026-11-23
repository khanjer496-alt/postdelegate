---
layout: ../../layouts/Guide.astro
title: "How to schedule social media posts with ChatGPT"
metaTitle: "Schedule Social Media Posts with ChatGPT | PostDelegate"
description: "Add PostDelegate to ChatGPT as a custom connector so ChatGPT can draft posts on your calendar, with you approving what goes out before it publishes."
date: "2026-11-01"
---

ChatGPT is good at turning a rough idea into a post, but the post still has to get to your channels. A custom connector closes that gap. Once PostDelegate is added to ChatGPT, it can list your channels, read the rules for each network, create drafts on your calendar and, if you ask, schedule them.

This guide covers adding the connector, the first conversation, and the habits that keep you in control. The examples use a Bluesky channel, but any [connected channel](/docs/channels) works the same way.

## What you need

- A PostDelegate account. Every plan starts with a 7-day free trial, no credit card needed, and every plan includes the public API and MCP.
- A connected channel in PostDelegate.
- A ChatGPT account that can create custom connectors. That depends on your ChatGPT plan, your workspace settings and, in many cases, a developer mode switch. Those controls belong to OpenAI and their names change, so treat the ChatGPT-side steps below as general guidance.

PostDelegate is not an official ChatGPT app listing. You add it as a custom connector by its address.

## What MCP means here

MCP, the Model Context Protocol, is a standard way for an assistant to use tools in another service. PostDelegate's MCP server offers tools for listing channels, reading each channel's post rules, creating drafts and scheduled posts, listing what is on your calendar, and adding media from a public link. ChatGPT discovers them when it connects, and you never call them by name. The [tools reference](/docs/mcp/tools) explains what each one does and which ones change data.

PostDelegate doesn’t sell AI. ChatGPT does the writing, and any usage costs on that side are between you and OpenAI. PostDelegate never charges for AI. If you also want AI inside the PostDelegate app, that runs on your workspace's own OpenAI key, added by an admin under **Settings, AI**, and is separate from the connector.

## Step 1: create the connector

1. In ChatGPT open **Settings**, then **Connectors**. If you do not see a way to create a connector, look under advanced settings for a developer mode switch, or ask your workspace admin.
2. Choose **Create**.
3. Enter a name such as `PostDelegate` and paste this address as the server URL:

```text
https://app.postdelegate.com/mcp-oauth-dynamic
```

4. Choose OAuth for authentication. ChatGPT registers itself with PostDelegate automatically.
5. Choose **Create**, then **Connect**. A PostDelegate page opens. Sign in if asked and click **Authorize**.

This is the address and menu path the app shows for ChatGPT under **Settings > Agents / Dev**. Because it uses sign in with PostDelegate, there is no API key to copy or paste into a chat.

## Step 2: start with a harmless question

Start a new chat and enable the PostDelegate connector for it. Then ask something that cannot change anything:

> Which channels do I have in PostDelegate?

ChatGPT should list the channels in your workspace. If the list is right, the connection is working and pointed at the right workspace.

## Step 3: ask for a draft and the preview link

Now ask for a post, and say clearly that it should not be scheduled yet:

> Draft a post about our product update for my Bluesky channel. Do not schedule it yet.

ChatGPT checks the channel's rules, writes the post and creates a draft. Each post returns a preview link of the form `https://app.postdelegate.com/p/POST_ID?share=true`. Ask to see it:

> Show me the preview link.

Open the link or your calendar and read the post as it will appear. Posts created over MCP are labelled with how they were created, so you can tell them apart on the calendar.

## Step 4: tighten the draft

Drafts are cheap, so iterate. Ask ChatGPT to shorten the text, change the tone or move the time. For networks with a length limit it helps to say the number, for example "under 300 characters for Bluesky". Dates and times in the app follow the timezone in **Settings > Global Settings**, so mention your timezone if the time matters.

Some networks need more than text. A WordPress post needs a title and a status, a Hashnode article needs a publication and a tag, and a YouTube video needs a video file and a visibility choice. ChatGPT reads these requirements from the channel's schema. Check them in the calendar anyway; the [channel guides](/docs/channels) list the fields.

## Step 5: schedule it

When the draft is right, either schedule it yourself in the app with **Add to Calendar**, or tell ChatGPT:

> Schedule that draft for Thursday at 10am.

A scheduled post publishes automatically at the chosen time, so say schedule only when you are ready. You can still move it back to draft before it publishes.

## Adding images and video

ChatGPT cannot read files on your computer. You can:

- Upload the file in the PostDelegate app and ask ChatGPT to reuse it from the media library.
- Give ChatGPT a public link, which it can add to your library with the upload-from-URL tool.
- Use the upload widget if your client supports interactive MCP apps. Others do not show it.

Posts only accept `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` or `.mp4` files, and uploaded media is served through public links. The [media guide](/docs/media) has the details.

## Good habits

- **Drafts first.** Ask for a draft and check it in the calendar before anything is scheduled.
- **Approve one tool call at a time.** ChatGPT asks before running tools that change something. Read the prompt, especially for anything that schedules or deletes.
- **Use the preview link.** It shows you the post itself rather than the chat's summary of it.
- **Revoke when you are done.** In PostDelegate open **Settings > Apps > Approved Apps** and choose **Revoke**. These tokens do not expire on their own.
- **Keep keys out of chats.** Never paste an API key into a conversation. OAuth means you do not have to.

## Limits to know about

ChatGPT can only work with channels that are connected in PostDelegate. Facebook, Instagram, LinkedIn company Pages and other networks are waiting on each network's approval, and X is not available on PostDelegate, so ChatGPT cannot publish to them. It can draft the text, and you can bring it into PostDelegate later.

The connector depends on your ChatGPT plan and settings, and PostDelegate cannot change those. If the connector option is missing, ask your workspace admin or check OpenAI's help pages for the current requirements.

## Troubleshooting

- **No way to create a connector.** Look for a developer mode switch in advanced settings, or ask your workspace admin.
- **The authorize page does not open.** Your plan or client may not support OAuth for remote servers. The [MCP overview](/docs/mcp) describes an API key address that works with clients that can set a header.
- **ChatGPT says a tool is missing.** The server lists only the tools your connection address offers.
- **It cannot see a channel.** Check that the channel is connected and enabled in PostDelegate, and that you authorized the right workspace.

## Next steps

The [ChatGPT setup page](/docs/mcp/chatgpt) keeps the current connector steps. To see what an assistant can and cannot do, read [what a social media MCP server is](/guides/social-media-mcp-server). If you use Claude too, the [Claude guide](/guides/schedule-social-media-posts-with-claude) is nearly identical. For a first channel, the [Bluesky scheduler page](/bluesky-scheduler) is a quick one to connect. To set limits on what ChatGPT can publish, read [how to let an AI agent post safely](/guides/ai-social-media-agent-guardrails).

Want to try it? [Start your 7-day free trial](https://app.postdelegate.com/auth). No credit card is required.
