---
layout: ../../../layouts/DocsLayout.astro
title: Connect ChatGPT
description: Add PostDelegate to ChatGPT as a custom connector so ChatGPT can draft and schedule posts on your calendar.
---

ChatGPT connects to PostDelegate as a **custom connector**. You sign in with your PostDelegate account, so there is no API key to copy.

PostDelegate is not an official ChatGPT app listing. Custom connectors in ChatGPT depend on your ChatGPT plan, your workspace settings, and in many cases a developer mode switch. Those controls belong to OpenAI, and their names change, so treat the ChatGPT-side steps below as general guidance.

## Add the connector

1. In ChatGPT open **Settings**, then **Connectors**. If you do not see a way to create a connector, look under advanced settings for a developer mode switch, or ask your workspace admin.
2. Choose **Create**.
3. Enter a name such as `PostDelegate` and paste this address as the server URL:

```text
https://app.postdelegate.com/mcp-oauth-dynamic
```

4. Choose OAuth for authentication. ChatGPT registers itself with PostDelegate automatically.
5. Choose **Create**, then **Connect**. A PostDelegate page opens. Sign in if asked and click **Authorize**.

This is the address and menu path the app shows for ChatGPT under **Settings > Agents / Dev**: Settings > Connectors > Create, then paste the URL.

## Use it

Start a chat, enable the PostDelegate connector, and begin with something harmless:

> Which channels do I have in PostDelegate?

Then ask for a draft and ask to see the preview link before scheduling:

> Draft a post about our product update for my Bluesky channel. Do not schedule it yet.

## Good habits

- Ask for drafts first and check them in the calendar.
- Approve tool calls one at a time when ChatGPT asks, especially for anything that schedules or deletes.
- Revoke access at any time from **Settings > Apps > Approved Apps** in PostDelegate.

If something does not work, see [MCP troubleshooting](/docs/mcp#troubleshooting).
