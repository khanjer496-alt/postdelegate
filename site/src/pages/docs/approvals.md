---
layout: ../../layouts/DocsLayout.astro
title: Approvals and client review
description: Review statuses, required approval, client approval links that need no account, the Approvals inbox for AI-drafted posts, guardrails and activity history.
---

Approvals put a second pair of eyes on a post before it goes out. A post that waits for approval is held as a draft and does not publish until someone approves it. You decide which posts wait: posts from teammates, posts from AI agents, or both.

## Review statuses

A post in review shows its status on the calendar and in the composer.

| Status | What it means |
| --- | --- |
| **In review** | Waiting for an approver, or for a client who has an approval link. It will not publish while it waits. |
| **Changes requested** | An approver or a client asked for changes. It stays a draft until it is sent for review again and approved. |
| **Approved** | Approved and scheduled. It publishes at its planned time. |
| **Rejected** | It will not publish. It stays a draft you can delete or send for review again. |

If a post's planned time passes while it waits, approving it publishes it right away. The app asks you to confirm with **Approve and publish now** first.

## Who can approve

Workspace admins can always approve. An admin can pick other members who can approve too. Everyone else can see and edit posts that wait for review, but cannot approve them.

## Approval settings

Open **Settings > Approvals**. Only workspace admins can change these settings. Under **Team posts**:

- **Require approval before publishing.** When this is on, posts by members who can't approve are sent for review instead of being scheduled.
- **Who can approve.** Check the members who can approve besides the admins.

Choose **Save** when you are done.

### Sending a post for review

With **Require approval before publishing** on, the main button in the composer reads **Submit for review** for members who can't approve. Saving sends the post to the approvers instead of the calendar, and the app confirms with "Sent for review. It will publish once an approver approves it."

Drafts are not affected. A draft stays a draft until someone schedules it or posts it.

When an approver opens a post that is waiting, the main button reads **Approve and schedule**, so editing and approving happen in one step.

### Review and history in the composer

Every saved post has a **Review and history** panel in the composer. It shows the post's review status, the actions you can take and the **Post history**: who created, reviewed, approved and published it.

| Action | Who sees it | What it does |
| --- | --- | --- |
| **Approve** | Approvers, on a waiting post | Schedules the post for its planned time. |
| **Request changes** | Approvers, on a post in review | Sends the post back to its author. You have to say what should change. |
| **Reject** | Approvers, on a waiting post | Stops the post. You can give a reason. |
| **Submit for review** | A draft, or a post with changes requested or rejected | Sends the saved version for review. To include unsaved edits, save with the main button instead. |
| **Share for approval** | Approvers | Creates a client approval link. See below. |

Feedback from **Request changes** and **Reject** is also added to the post's comments, next to the preview.

## Client approval links

A client approval link lets someone outside your workspace approve a post without an account. They open the link, see the post as it will look, and approve it or ask for changes. While it waits, the post won't publish.

### Share a post for approval

1. Open the post in the composer and expand **Review and history**.
2. Choose **Share for approval**. Only approvers can share, because a client's approval publishes the post.
3. Under **Link stops working after**, pick 1, 3, 7, 14 or 30 days. The default is 7 days.
4. Choose **Create link** and copy it. The link is shown only once.

Creating the link moves the post to **In review**. Your approvers are not notified, because the post now waits for the client.

The same window lists **Links that work now**, with when each link was opened and the date it stops working. Choose **Turn off link** to stop a link early. Anyone with a link that was turned off, or that has expired, sees "This link no longer works".

### What the client sees

The client page shows each post as it will look and its planned date. To approve or ask for changes, the client enters **Your name** and **Your email** once, so your team sees who approved or asked for changes, and when.

- **Approve** schedules the post for its planned time, or publishes it right away if that time has passed. The client can add an optional note for the team.
- **Request changes** needs a short explanation under **What should change?** The post goes back to draft with **Changes requested**, and the explanation lands in the post's comments.

A client can only act on a post that is **In review**. Once someone approves, rejects or sends a post back, the link no longer changes it. The link itself is the only credential, so share it only with the people who should review.

### Preview links and approval links

The **Share with a client** preview link described in [Creating and scheduling posts](/docs/posts#previews-and-comments) is for reading and commenting on selected text. It does not approve anything. Use **Share for approval** when you want the client's yes to be what lets the post go out.

## The Approvals inbox

**Approvals** in the main menu lists every post that waits for a decision: posts **In review** and posts with **Changes requested**. A badge shows how many are waiting. Nothing in this list publishes until it is approved.

- Each post shows its channel, its planned time and who sent it: **From** and the name of the connected app or agent, or **Submitted by** and a teammate's name. If changes were requested, the feedback is shown with it.
- Use the **All** and **From AI agents** tabs to focus on posts that agents created.
- Approvers can **Approve**, **Edit**, **Request changes** or **Reject** each post, or tick several and choose **Approve selected**. When some selected posts have a planned time that has passed, the app tells you those publish right away.
- Members who can't approve see the list and can edit the posts, but cannot approve them.

## Posts from AI agents

**Settings > Approvals** has an **AI agent guardrails** section for posts created by AI agents: Claude, ChatGPT and other MCP clients, the PostDelegate Agent, the public API and the CLI. The rules are checked on PostDelegate's servers, and an agent gets a clear message when a rule stops it.

| Setting | What it does |
| --- | --- |
| **Require approval for AI-created posts** | Posts from MCP clients and the PostDelegate Agent wait in Approvals until someone approves them. New workspaces start with this on. |
| **Also require approval for API and CLI posts** | Shown when the setting above is on. Posts from the public API (API keys and connected apps) and the CLI wait for approval too. MCP clients always follow the setting above. |
| **Channels agents can post to** | Leave every channel unchecked to allow all channels, or check some to limit agents to them. |
| **Max posts agents can create per day** | A whole number from 1 to 10,000, or empty for no limit. Counted per day in UTC, across all agents. A post to several channels counts once per channel. |

API and CLI posts skip approval unless you turn on **Also require approval for API and CLI posts**. The channel list and the daily limit apply to API and CLI posts either way.

When an agent's post is held, the [MCP tool](/docs/mcp/tools) reports it as `IN_REVIEW`, and the assistant is told the post is waiting for a teammate to approve it. An agent's draft stays a draft: approval applies when the agent schedules a post or posts it now.

If you connect an assistant over [MCP](/docs/mcp), keep approval for AI-created posts on until you trust how it writes for you.

## Notifications

- When a post is sent for review, the workspace gets an in-app notification and approvers get an email with a link to Approvals.
- When a post is approved, rejected or sent back, the workspace gets an in-app notification and the post's author gets an email, with the feedback if there is any.

## Activity

**Settings > Activity** is the workspace history: who created, reviewed, approved and published posts, including AI agents and clients. It also records approval links being shared, opened and turned off, guardrails stopping an agent, and changes to the approval settings. This history cannot be edited. The tab is shown to members who can approve.

The **Post history** in each post's **Review and history** panel shows the same events for that one post.

## Bulk imports

Posts from a [CSV import](/docs/bulk-import) follow the same rules as posts saved in the composer. If you can't approve and the workspace requires approval, your imported posts are sent for review.
