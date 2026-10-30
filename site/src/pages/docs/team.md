---
layout: ../../layouts/DocsLayout.astro
title: Team and customers
description: Invite people to your workspace, and group channels by customer so each client's channels stay together.
---

## Team members

Team members share your workspace so they can create, review and schedule posts together. The **Teams** tab appears under **Settings** when your plan includes team members and your role allows inviting people. See [Plans and billing](/docs/billing) for which plans include it.

### Invite someone

1. Open **Settings > Teams**.
2. Choose to add a member (**Add another member** once you already have some).
3. Pick a role, **User** or **Admin**.
4. Leave **Send invitation via email** on to email the invite, or switch it off to copy an invitation link and send it yourself.

### Roles

| Role | Can do |
| --- | --- |
| **Admin** | Manage the workspace, including inviting and removing team members, within the limits of your plan. |
| **User** | Work on posts and channels. The **Teams** tab is not shown to this role. |

You can only manage members at a lower level than your own. To remove a team member, use **Remove** next to their name in **Settings > Teams**. The workspace owner appears as **Super Admin**.

## Customers

A customer groups channels, which helps when you manage more than one brand or client. In the app a customer is also called a group.

### Add a channel to a customer

1. Open the channel's menu on the calendar page.
2. Choose **Move / add to group**.
3. Pick an existing customer or create a new one.

### Work in one customer at a time

Use the **Customers** selector on the calendar page to focus on one customer's channels. Choosing a customer selects that customer's channels, which makes it harder to send a post to the wrong client.

### Customers in the API and MCP

The REST API calls customers **groups**. [`GET /groups`](/docs/api/channels#get-groups) lists them, and [`GET /integrations?group=ID`](/docs/api/channels#get-integrations) lists the channels in one group. [`GET /posts`](/docs/api/posts#get-posts) accepts a `customer` filter. MCP assistants use the `groupList` and `integrationList` tools. See [MCP tools](/docs/mcp/tools).

## Removing a channel

Deleting a channel needs every post on it to be deleted first. For networks that grant PostDelegate access through the network's own sign-in, deleting a channel also starts removal of the saved access and related data. See [Privacy and data deletion](/docs/privacy).
