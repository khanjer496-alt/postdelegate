---
layout: ../../layouts/Guide.astro
title: "How to let an AI agent post to social media safely"
metaTitle: "Let an AI Agent Post to Social Media Safely | PostDelegate"
description: "Hold AI-drafted posts in an approvals inbox, limit which channels an agent can use and how much it can post, and keep a record of everything it did."
date: "2026-11-01"
---

An AI assistant that can write and schedule your posts saves real time. It can also publish something you would never have approved, to the wrong account, at a bad moment, many times over. The answer is not to keep agents away from your channels. It is to put rules around them that do not depend on the agent behaving well.

This guide shows how to set those rules in PostDelegate: hold agent posts for approval, limit where and how much agents can post, decide what counts as an agent, and keep a record of what happened. The settings are described in full in the [approvals docs](/docs/approvals).

## Which agents this covers

PostDelegate treats these as AI agents for the purpose of these rules:

- **Claude, ChatGPT and other assistants** connected over [MCP](/docs/mcp).
- **The PostDelegate Agent**, the chat in the app's main menu, which runs on your workspace's own OpenAI key.
- **The public API and the CLI**, for scripts and automations. These are covered by the channel and daily limits, and you choose whether they need approval too.

AI is bring-your-own. An assistant over MCP runs on your own account with its provider, and the in-app features use an OpenAI key an admin adds. PostDelegate never charges for AI. See [AI in PostDelegate](/docs/ai).

## Why the rules live on the server

Most assistants ask before they use a tool that changes something, and you should keep those prompts on. But a prompt is a feature of the assistant, and it is easy to click through. The guardrails in PostDelegate are checked on PostDelegate's servers, whatever the assistant tries. When a rule stops an agent, the agent gets a clear message saying so.

## Step 1: open the guardrail settings

Open **Settings > Approvals** and find **AI agent guardrails**. Only workspace admins can change these settings. The section has four settings:

| Setting | What it does |
| --- | --- |
| **Require approval for AI-created posts** | Posts from MCP clients and the PostDelegate Agent wait in Approvals until someone approves them. |
| **Also require approval for API and CLI posts** | Shown when the setting above is on. Posts from the public API and the CLI wait for approval too. |
| **Channels agents can post to** | Leave every channel unchecked to allow all, or check some to limit agents to them. |
| **Max posts agents can create per day** | A whole number from 1 to 10,000, or empty for no limit. |

Choose **Save** after any change.

## Step 2: keep approval on for AI-created posts

New workspaces start with **Require approval for AI-created posts** turned on. Leave it on until you trust how an assistant writes for you.

With it on, when an assistant schedules a post or asks to post it now, the post is held **In review** instead. It will not publish until an approver approves it. Over MCP, the tool reports the post as `IN_REVIEW`, and the assistant is told it is waiting for a teammate to approve it.

An agent's draft stays a draft. Approval applies when the agent tries to schedule or publish.

## Step 3: decide about the API and the CLI

API and CLI posts skip approval unless you turn on **Also require approval for API and CLI posts**. Whether to turn it on depends on what calls the API:

- **Your own tested script**, such as a build that announces each release, usually does not need a person in the loop.
- **An automation that writes its own text**, such as a workflow tool that asks a model for a caption, is an AI agent in all but name. Turn approval on.

MCP clients always follow the first setting, whichever way you set this one.

## Step 4: limit which channels agents can use

Under **Channels agents can post to**, check the channels agents are allowed to touch. Leaving them all unchecked allows every channel.

A sensible start is to allow one or two lower-risk channels, such as a project account or an internal Slack workspace, and keep your main brand accounts off the list until you are comfortable. The limit applies to MCP clients, the Agent, the API and the CLI.

## Step 5: set a daily cap

**Max posts agents can create per day** stops a loop or a misunderstanding from filling your calendar. It is counted per day in UTC, across all agents, and a post to several channels counts once per channel.

Pick a number a little above what you expect on a busy day. If an agent hits it, it is told so and cannot create more posts until the next day in UTC. The cap applies to API and CLI posts too.

## Step 6: connect the assistant the safer way

When you connect an assistant over MCP, prefer **Sign in with PostDelegate (OAuth)**. The assistant gets its own token for your workspace, and you never copy an API key into it.

- Approved assistants appear under **Settings > Apps > Approved Apps**. Choose **Revoke** to cut one off. These tokens do not expire on their own, so revoking is how you end access.
- Never paste an API key into a chat. If you use a key, put it in the client's configuration, and rotate it if it leaks. Rotating invalidates it everywhere.
- Keep your assistant's tool approval prompts on, as a second check.

The walkthroughs are [Claude](/guides/schedule-social-media-posts-with-claude) and [ChatGPT](/guides/schedule-social-media-posts-with-chatgpt).

## Step 7: review agent posts in the Approvals inbox

**Approvals** in the main menu lists every post waiting for a decision. A badge shows how many.

1. Choose the **From AI agents** tab to see only posts agents created. Each one shows its channel, its planned time and **From** with the name of the connected app or agent.
2. Open a post to check the text, the media and the channel settings against the preview.
3. **Approve** it to schedule it for its planned time, **Edit** it first, **Request changes** with a note, or **Reject** it with an optional reason.
4. To clear several at once, tick them and choose **Approve selected**.

If a post's planned time passed while it waited, approving publishes it right away. The app warns you first.

Workspace admins can always approve, and an admin can choose other members who can approve. Approvers get an email when a post is sent for review, so agent posts do not sit unnoticed.

## Step 8: check the record

**Settings > Activity** is the workspace history. It shows who created, reviewed, approved and published posts, including AI agents. It also records guardrails stopping an agent and changes to the approval settings. The history cannot be edited. The tab is shown to members who can approve.

Each post also has a **Post history** in its **Review and history** panel, with the same events for that post. Posts created by an assistant are labelled with how they were created, so you can tell them apart on the calendar.

## A starting setup

1. **Require approval for AI-created posts:** on.
2. **Also require approval for API and CLI posts:** on if anything that calls the API writes its own text.
3. **Channels agents can post to:** one or two lower-risk channels.
4. **Max posts agents can create per day:** a little above your normal daily volume.
5. OAuth for every assistant, reviewed under **Approved Apps** now and then.
6. A weekly look at **Settings > Activity**.

Relax the rules one at a time as you learn how each agent behaves.

## What guardrails do not do

- They do not check whether a post is true, on-brand or wise. That is what the approver is for.
- They do not stop someone with approval rights from approving a bad post. Choose approvers deliberately.
- They do not limit what an assistant can read, such as your channel list and calendar. Connect only assistants you trust with that.

## Next steps

The [approvals docs](/docs/approvals) cover every setting and status, and the [MCP tools reference](/docs/mcp/tools) lists what an assistant can do. For background, read [what a social media MCP server is](/guides/social-media-mcp-server). If agents draft for clients, combine this with the [client approval workflow](/guides/client-approval-workflow).

Ready to try it? [Start your 7-day free trial](https://app.postdelegate.com/auth). No credit card is required.
