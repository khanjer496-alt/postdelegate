---
layout: ../../../layouts/DocsLayout.astro
title: X
description: "X is coming soon to PostDelegate. How X posts will work: a monthly cap on each paid plan, or no PostDelegate cap with your own X API key, and how to set one up."
---

**X is not available on PostDelegate yet.** It is listed under [Coming soon](/docs/channels/coming-soon). This page explains how X will work once it opens, so you can prepare.

X charges for its API, so there will be two ways to connect an X account.

## Through PostDelegate

You will sign in to X and PostDelegate will post through its own X app. X posts on each paid plan will be capped each month, counted separately from your other networks. The monthly numbers for each plan will be published when X opens. The cap will work like this:

- Every post of a thread counts as one X post.
- A post counts when it is published. Deleting or moving it afterwards does not give it back.
- A draft does not count. Scheduled posts are checked against the plan month they publish in.
- The count starts again at the start of each plan month.
- Repeating and evergreen posts need your own X API key.

When the month's X posts are used up, scheduling another X post will show a message, and a post that reaches its publish time after that will fail with the same message instead of going out. You'll be able to upgrade your plan, or connect the account with your own X API key.

## Using your own X API key

When X is available, you'll be able to connect with the keys of your own X developer app. PostDelegate won't cap these X posts, and X will bill your developer account for the API use. The steps will be:

1. Sign in at [developer.x.com](https://developer.x.com) and create a Project with an App in it.
2. In the App's **User authentication settings**, set **App permissions** to **Read and write**.
3. Under **Keys and tokens**, copy the **API Key** and **API Key Secret**, then generate the **Access Token** and **Access Token Secret**. Generate the token after setting Read and write. If you change the permissions later, generate it again.
4. In PostDelegate choose **Add Channel**, then **X (Own API key)**, and paste the four values.

PostDelegate will check the keys with X before it saves the channel, and store them encrypted. The access token you generate in the developer portal belongs to the X account that owns the app, so that is the account the channel will post as.

If the connection fails you will see one of these messages:

- **X did not accept these keys.** A value is incomplete, or the values come from different apps.
- **These keys can only read.** Set App permissions to Read and write, then generate a new Access Token and Secret.
- **X refused these keys.** The app is not inside a Project, or your developer account has no API access.

To replace the keys later, you'll use **Update Credentials** in the channel's menu.

An account will connect one way at a time. To move an account from one way to the other, you'll delete its channel first, then connect it again. Posts already published will still count toward that plan month.
