---
layout: ../../../layouts/DocsLayout.astro
title: Connect Claude
description: Add PostDelegate to Claude as a custom connector so Claude can draft and schedule posts on your calendar.
---

Claude connects to PostDelegate as a **custom connector**. You sign in with your PostDelegate account, so there is no API key to copy.

PostDelegate is not in Claude's connector directory, so you add it by address. Whether custom connectors are available depends on your Claude plan and, on team plans, on what your organisation allows. That is decided by Anthropic and your admin, not by PostDelegate.

## Add the connector

1. In Claude open **Settings**, then **Connectors**, then **Add custom connector**.
2. Enter a name such as `PostDelegate`.
3. Paste this address as the server URL:

```text
https://app.postdelegate.com/api/mcp-oauth-dynamic
```

4. Choose **Add**, then **Connect**. A PostDelegate page opens in your browser.
5. Sign in to PostDelegate if asked. The page shows the name of the app asking for access and where it will return you. Approve it.
6. Back in Claude the connector shows as connected.

The address is the same one the app shows for Claude under **Settings > Agents / Dev**. The steps above for adding a custom connector are Claude's own and Anthropic may rename its menus.

## Use it

Start a conversation, make sure the PostDelegate connector is switched on for it, and ask Claude something small first:

> List my PostDelegate channels.

Then try a draft:

> Write a short post announcing our new feature and save it as a draft on my Bluesky channel for tomorrow at 9am. Show me the preview link.

Claude will look up your channels, read the rules for Bluesky, and create the draft. Open the preview link or the calendar to check it before you schedule anything.

## Tips

- Say **draft** when you want to review first. Say **schedule** only when you are ready.
- Claude shows a prompt before running a tool that changes something. Read it. Scheduling and deleting are the ones to watch.
- To upload a file from your computer, use the app or the [upload API](/docs/api/uploads). Claude can add media from a public link with the upload-from-URL tool. Interactive upload widgets only show in apps that support them.
- To disconnect, remove the connector in Claude. To cut off access from PostDelegate's side, revoke it in **Settings > Apps > Approved Apps**.

If something does not work, see [MCP troubleshooting](/docs/mcp#troubleshooting).
