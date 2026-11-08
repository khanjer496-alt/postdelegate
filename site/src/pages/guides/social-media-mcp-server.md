---
layout: ../../layouts/Guide.astro
title: "What is a social media MCP server and how to use one"
metaTitle: "What Is a Social Media MCP Server? | PostDelegate"
description: "What MCP is, what a social media MCP server lets an AI assistant do, how sign-in works and how to keep control of what gets published to your channels."
date: "2026-11-01"
---

If you use Claude, ChatGPT or an editor like Cursor, you have probably seen the term MCP. A social media MCP server is the piece that lets those assistants work with a social media scheduler instead of only talking about one. This guide explains what that means in practice, what an assistant can and cannot do through one, and how to use it without losing control of what gets published. Where it helps to be concrete, it uses PostDelegate's server.

## What MCP is

MCP stands for Model Context Protocol. It is a standard way for an AI assistant to use tools in another service. The service runs an MCP server that describes its tools: a name, what each does and what inputs it takes. The assistant, called the client, reads that description and decides when to call a tool during a conversation.

Without MCP, an assistant can write a caption, but you copy it into a scheduler by hand. With MCP, the assistant can ask the scheduler which channels you have, read what each network allows and create the post itself. You stay in the loop by reviewing what it made.

## What a social media MCP server does

A scheduler's MCP server turns its main actions into tools. For PostDelegate those fall into four groups.

| Group | What an assistant can do | Examples |
| --- | --- | --- |
| Channels and settings | See your channels and customers, and read each channel's post rules, length limit and required settings. | `integrationList`, `groupList`, `integrationSchema` |
| Posts | Create drafts, scheduled posts or immediate posts, list posts between two dates, update settings and delete posts. | `integrationSchedulePostTool`, `postsListTool`, `postSettingsTool`, `deletePostTool` |
| Media | Add an image or video from a public link, reuse files from the library and check whether an upload is ready. | `uploadFromUrlTool`, `mediaListTool`, `mediaStatusTool` |
| Helpers | Run lookups a network needs, such as WordPress categories or Listmonk lists. | `triggerTool` |

When an assistant creates a post it runs the same validation as the app and the REST API, and it gets back a post id and a preview link for each post, or a list of errors to fix. The full list, including which tools change data, is in the [MCP tools reference](/docs/mcp/tools).

## What an MCP server does not do

It does not give an assistant access to networks you have not connected. The assistant works through your connected channels, so it can only publish where you could publish yourself. Today that means [the networks marked available](/platforms), such as YouTube, Bluesky, WordPress, Slack and DEV.to. Facebook, Instagram, LinkedIn, TikTok and others are waiting on each network's approval, and X is not available.

It also does not include an AI. The assistant is yours, and so are its costs. Any AI inside the PostDelegate app runs on your workspace's own OpenAI key, and PostDelegate never charges for AI.

## How sign-in works

There are two ways to connect an assistant to PostDelegate's MCP server.

**Sign in with PostDelegate (OAuth).** You add the server address `https://app.postdelegate.com/mcp-oauth-dynamic` to your assistant. It opens a PostDelegate page in your browser, you sign in and approve, and the assistant gets its own token for your workspace. You never copy a key. The client registers itself with dynamic client registration and PKCE, and the scopes are `mcp:read` and `mcp:write`. This is the recommended route for Claude, ChatGPT, Claude Code, Cursor and any client that can register itself.

**API key.** For clients that cannot do OAuth, the workspace API key works at `https://app.postdelegate.com/api/mcp` as `Authorization: Bearer YOUR_API_KEY`, or inside the address for clients that can only take a URL. The key is as powerful as your account, so prefer OAuth where it is supported. Rotating the key invalidates it everywhere.

Approvals show under **Settings > Apps > Approved Apps**, where **Revoke** cuts an assistant off. The API key and MCP setup live in **Settings > Agents / Dev**, and every plan includes the public API and MCP.

## How to set one up

The shortest setups, with full steps in the docs:

- **Claude.** Add a custom connector under **Settings, Connectors** with the OAuth address. See [Connect Claude](/docs/mcp/claude) or the [Claude walkthrough](/guides/schedule-social-media-posts-with-claude).
- **ChatGPT.** Create a connector under **Settings, Connectors**, choose OAuth and paste the same address. See [Connect ChatGPT](/docs/mcp/chatgpt) or the [ChatGPT walkthrough](/guides/schedule-social-media-posts-with-chatgpt).
- **Claude Code.** One command registers the server:

```bash
claude mcp add postdelegate --transport http "https://app.postdelegate.com/mcp-oauth-dynamic"
```

Then run `/mcp` inside Claude Code and authenticate the `postdelegate` server.

- **Cursor.** Add the address to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "postdelegate": {
      "url": "https://app.postdelegate.com/mcp-oauth-dynamic"
    }
  }
}
```

Other editors and terminal clients, including VS Code, Codex, Windsurf and Gemini CLI, are covered on the [clients page](/docs/mcp/clients). The configuration formats belong to each client and may change, so check the client's own documentation if a snippet is rejected.

## Staying in control

A social media MCP server can publish in your name, so it is worth being deliberate.

1. **Ask for drafts first.** A draft sits on your calendar and never publishes until it is scheduled. Review it there before anything goes out.
2. **Keep tool approval prompts on.** Assistants that support confirmation prompts ask before running tools that change data. Scheduling and deleting are the ones to read carefully.
3. **Use the preview link.** Each post returns `https://app.postdelegate.com/p/POST_ID?share=true`, which shows the post itself.
4. **Know what is labelled.** Posts created over MCP are labelled with how they were created, so you can tell them apart on the calendar.
5. **Mind the content.** Text from your posts and videos is just data for the assistant to show you. Be wary of any assistant that treats text inside a post as instructions.
6. **Revoke what you are not using.** OAuth tokens do not expire on their own, so revoking is how you end access.

## MCP, the REST API or the app

All three reach the same posts, and the right one depends on the job.

- Use **the app** when you are writing and arranging posts yourself.
- Use **MCP** when you want an assistant to do the looking up and drafting in a conversation, with you approving the result.
- Use **the REST API** for scripts and automations that run without a conversation. It takes the API key without `Bearer`, and uses UTC for dates. See the [API overview](/docs/api).

Webhooks complement both: PostDelegate can send an HTTP request when a post is published, see [webhooks](/docs/webhooks).

## Questions to ask about any social media MCP server

If you are comparing servers, these questions separate a useful one from a risky one:

- Does it validate posts against each network's rules before scheduling, and tell the assistant what to fix?
- Can the assistant create a draft, or only publish immediately?
- Does it return something you can open to see the post before it goes out?
- How does sign-in work, and can you revoke access without rotating a key?
- Which networks can actually be connected today, and which are only on a roadmap?
- Who pays for the AI?

For how other schedulers answer some of these, our list of [social media MCP servers](/best/social-media-mcp-servers) links each vendor's own documentation, and says which plans include MCP and which servers cannot publish.

## Next steps

Pick one assistant, connect it, and ask for a single draft on a channel you control. The [MCP overview](/docs/mcp) explains the server addresses and sign-in options, and the [MCP page](/mcp) summarizes the setup. For a first channel, the [Bluesky](/bluesky-scheduler) and [WordPress](/wordpress-scheduler) scheduler pages show what each connection needs. Before you let an assistant schedule on its own, read [how to let an AI agent post safely](/guides/ai-social-media-agent-guardrails).

Want to try it? [Start your 7-day free trial](https://app.postdelegate.com/auth). No credit card is required.
