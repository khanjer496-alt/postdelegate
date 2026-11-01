---
layout: ../../../layouts/DocsLayout.astro
title: X
description: X is coming soon to PostDelegate. How X posts will work on each plan, and how to use your own X API key.
---

**X is not available on PostDelegate yet.** It is listed under [Coming soon](/docs/channels/coming-soon). This page explains how X will work once it opens, so you can prepare.

X charges for its API, so there will be two ways to connect an X account.

## Through PostDelegate

You sign in to X and PostDelegate posts through its own X app. Each paid plan includes a number of X posts a month, counted separately from your other networks:

- Every post of a thread counts as one X post.
- A draft does not count until it is scheduled.
- Deleting a post that was already published does not give the post back.
- A post counts in the plan month it is scheduled to publish in, and the count starts again at the start of each plan month.

When the month's X posts are used up, scheduling another X post shows a message. Upgrade your plan, or connect the account with your own X API key.

## Using your own X API key

You connect with the keys of your own X developer app. PostDelegate does not cap these X posts, and X bills your developer account for the API use.

1. Sign in at [developer.x.com](https://developer.x.com) and create a Project with an App in it.
2. In the App's **User authentication settings**, set **App permissions** to **Read and write**.
3. Under **Keys and tokens**, copy the **API Key** and **API Key Secret**, then generate the **Access Token** and **Access Token Secret**. Generate the token after setting Read and write. If you change the permissions later, generate it again.
4. In PostDelegate choose **Add Channel**, then **X (Own API key)**, and paste the four values.

PostDelegate checks the keys with X before it saves the channel. The keys are stored encrypted. The access token you generate in the developer portal belongs to the X account that owns the app, so that is the account the channel posts as.

If the connection fails you will see one of these messages:

- **X did not accept these keys.** A value is incomplete, or the values come from different apps.
- **These keys can only read.** Set App permissions to Read and write, then generate a new Access Token and Secret.
- **X refused these keys.** The app is not inside a Project, or your developer account has no API access.

To replace the keys later, use **Update Credentials** in the channel's menu.

An account is connected one way at a time. To move an account from one way to the other, delete its channel first, then connect it again.
