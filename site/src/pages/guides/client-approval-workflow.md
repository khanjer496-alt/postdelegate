---
layout: ../../layouts/Guide.astro
title: "Social media approval workflow for agencies and clients"
metaTitle: "Social Media Approval Workflow for Agencies | PostDelegate"
description: "Keep each client's channels separate, send approval links that need no account, and schedule a social media post only after the client has approved it."
date: "2026-11-01"
---

The riskiest moment in social media management is the gap between "the client said it looked fine" and "it went out". A post that was never approved, or that was approved in one version and published in another, is how agencies lose trust. An approval workflow closes that gap: keep every client's channels apart, hold every post until someone approves it, let the client approve the post itself, and keep a record of who said yes.

This guide shows how to run that workflow in PostDelegate with the approval features built into the app. The full reference is in the [approvals docs](/docs/approvals).

## What PostDelegate gives you for approvals

- **Customers.** A customer, also called a group, collects the channels of one client or brand.
- **Require approval.** A workspace setting that holds posts from members who can't approve until an approver says yes.
- **Review statuses.** Posts show **In review**, **Changes requested**, **Approved** or **Rejected** on the calendar.
- **Client approval links.** A link your client opens without an account to approve a post or ask for changes.
- **The Approvals inbox.** One list of every post waiting for a decision, from teammates and from AI agents.
- **Activity history.** A record of who created, reviewed, approved and published each post, which cannot be edited.

## Step 1: give each client a customer

Open each channel's menu on the calendar page and choose **Move / add to group**. Pick an existing customer or create a new one. Do this as you connect channels, so every client's accounts are grouped from day one.

Then use the **Customers** selector on the calendar page to work in one customer at a time. Choosing a customer selects that customer's channels, which makes it harder to send a post to the wrong client. Plans with team members, Team, Pro and Ultimate, are built for this. Starter is for one person. See [Plans and billing](/docs/billing).

## Step 2: decide who approves

On plans that include team members, open **Settings > Teams** and invite people as **User** or **Admin**. Then open **Settings > Approvals**, which only admins can change:

1. Turn on **Require approval before publishing**. Posts by members who can't approve are now sent for review instead of being scheduled.
2. Under **Who can approve**, check the members who can approve besides the admins. Admins can always approve.
3. Choose **Save**.

A common split is that writers are Users, and the account lead is an admin or a chosen approver. In the composer and in CSV imports this is enforced, not just agreed: a writer's post is not scheduled until an approver approves it.

## Step 3: write and submit

Writers choose **Create Post**, select the client's channels, and set the date and time they want. With approval required, the main button reads **Submit for review**. Saving holds the post as **In review**, and approvers get an email and an in-app notification.

Half-finished work can still be saved as a draft.

## Step 4: review it inside the agency

Open **Approvals** from the main menu. The badge shows how many posts are waiting. Each post shows its channel, its planned time and who submitted it. An approver can:

- **Approve** it, which schedules it for its planned time.
- **Request changes**, with a note saying what should change. The post goes back to the author as **Changes requested**, and the note is added to the post's comments.
- **Reject** it, with an optional reason. It won't publish and stays a draft.
- **Edit** it directly.

If the client signs off too, go to step 5.

## Step 5: send the client an approval link

Open the post, expand **Review and history** and choose **Share for approval**. Only approvers can do this, because the client's approval publishes the post.

1. Pick how long the link works: 1, 3, 7, 14 or 30 days.
2. Choose **Create link**.
3. Copy it right away. The link is shown only once.

The post stays **In review** while it waits for the client. Send the link in the channel your client already uses, with a deadline:

> Here is Thursday's post for review. Open the link to see it exactly as it will look, then approve it or tell us what to change. Nothing goes out until you approve it.

The client does not need an account. They see each post as it will look and its planned date. They enter their name and email once, so your team sees who approved and when, then choose **Approve** or **Request changes**. Asking for changes requires a short explanation.

If you only want early comments, the **Share with a client** preview link still works for that. It lets anyone with the link comment on selected text, but it does not approve anything.

## Step 6: handle changes

When the client asks for changes, the post moves to **Changes requested**, your team is notified and the client's explanation lands in the post's comments. It also shows in the Approvals inbox next to the post.

Edit the post and send it for review again, with **Submit for review** or a new approval link. While the old link still works, the client can also reopen it once the post is back in review.

## Step 7: approval schedules the post

When the client or an approver approves, the post is scheduled for its planned time and shows **Approved** on the calendar. If that time passed while the post waited, approving publishes it right away. In the app, an approver is asked to confirm with **Approve and publish now**.

Before you share a link, check the channels, the date and time (in your profile's timezone) and any network-specific fields, such as a video's title.

## Step 8: confirm and keep the record

Published posts stay on your calendar with a link to the live post, so open it and check. If a network rejects a post, the calendar shows the error and you get an in-app notification.

**Settings > Activity** is the workspace history: who created, reviewed and approved each post, client approvals by the name and email they entered, approval links opened and turned off, and publishing. Each post's **Post history** shows the same for that post. This replaces the "who approved this?" email hunt.

## If an AI assistant drafts the posts

Many agencies now draft with Claude or ChatGPT connected over [MCP](/docs/mcp). In **Settings > Approvals**, the **AI agent guardrails** decide what agents can do:

- **Require approval for AI-created posts** holds posts from MCP clients and the PostDelegate Agent in Approvals. New workspaces start with this on.
- **Also require approval for API and CLI posts** extends that to the public API and the CLI, which otherwise skip approval.
- **Channels agents can post to** and **Max posts agents can create per day** limit agents on the server, whatever the assistant tries.

Use the **From AI agents** tab in Approvals to review agent posts on their own, then treat them like a junior writer's: same internal review, same client link. PostDelegate never charges for AI. The walkthroughs are [Claude](/guides/schedule-social-media-posts-with-claude) and [ChatGPT](/guides/schedule-social-media-posts-with-chatgpt).

## A simple checklist

1. Each client is a customer, with their channels in it.
2. **Require approval before publishing** is on, and approvers are chosen.
3. Writers submit posts for review instead of scheduling them.
4. The client gets an approval link and a deadline.
5. Changes go back through review before anything is scheduled.
6. After publication, someone opens the live post and checks it.

## Limits to be honest about

- The approval link is the client's only credential. Anyone who has it can approve, so share it only with the right people, and use **Turn off link** if it goes to the wrong person.
- Clients can approve or ask for changes. Rejecting a post is for your team.
- Uploaded media is served through public links. Do not put embargoed material in a post before it is cleared.

## Next steps

The [approvals docs](/docs/approvals) cover every setting used here. The [team and customers docs](/docs/team) and the [scheduling docs](/docs/posts) cover the rest. If you cross-post articles for clients, read the [cross-posting guide](/guides/cross-post-blog-articles).

Ready to try it? [Start your 7-day free trial](https://app.postdelegate.com/auth). No credit card is required.
