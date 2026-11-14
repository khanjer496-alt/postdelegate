---
layout: ../../../layouts/DocsLayout.astro
title: Reddit (your own app)
description: Connect Reddit to PostDelegate through a Reddit app you create yourself, for personal, non-commercial use. What you need, the connect steps and what to expect.
---

Reddit works differently from the other networks. PostDelegate doesn't offer a shared Reddit connection. Connect Reddit through **a Reddit app that you create yourself**. It appears in **Add Channel** as **Reddit (Own app)**.

Reddit is not counted in the networks listed as available on the [platform status](/platforms) page: those are the networks connected through PostDelegate's own apps.

## What you need

- A Reddit account to post from.
- A Reddit "web app" in that account. You create it in the next section.
- A personal, non-commercial purpose. This connection is meant for your own personal, non-commercial use, and Reddit's Data API terms apply to the app you create. If you need Reddit for a business or on behalf of clients, check Reddit's terms first. This page is not legal advice.

## Connect

1. On the calendar page choose **Add Channel**, then **Reddit (Own app)**. Copy the redirect URI shown in the form (it has a Copy button) and keep the form open.
2. Open [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps) in another tab, signed in to the Reddit account you want to post from, and choose **create another app**.
3. Pick **web app**, give it a name, and paste the redirect URI from step 1.
4. Copy the client ID (the string under "web app") and the secret from your Reddit app into the **Client ID** and **Secret** fields in PostDelegate.
5. Choose **Connect**, then approve the connection on Reddit's own page. You are sent back to PostDelegate when you are done.

The client ID and secret are sent to PostDelegate in the form, never in a link, and are stored encrypted with the channel. Reddit signs you in on its own page, so PostDelegate never sees your Reddit password.

## Where you connect it

Only from the PostDelegate app. A Reddit own-app channel cannot be connected through the public API.

## Post settings

Posts go to one or more subreddits that you choose, each with its own title. Reddit's rules for each subreddit, such as required flair, still apply.

## If it stops working

If the connection expires or Reddit no longer accepts your app, PostDelegate asks you to connect again. If you delete or change your Reddit app, connect the channel again with the new client ID and secret.
