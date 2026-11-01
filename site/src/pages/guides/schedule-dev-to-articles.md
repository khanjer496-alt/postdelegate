---
layout: ../../layouts/Guide.astro
title: "How to schedule DEV.to articles (tags, cover image, canonical URL)"
metaTitle: "How to Schedule DEV.to Articles | PostDelegate"
description: "Connect DEV Community with an API key and schedule Markdown articles with up to four tags, a cover image, an organization and a canonical URL for cross-posts."
date: "2026-11-01"
---

Writing an article and publishing it are often two different moments. You finish the draft on a Sunday, but you want it to go out on Tuesday morning, next to the posts that announce it, while you are doing something else. For that you need a tool that holds the article and publishes it at the time you choose.

This guide shows how to schedule DEV.to articles with PostDelegate: connect your account with an API key, write in Markdown, set tags, a cover image and a canonical URL, and pick the time. It follows the settings the DEV connection actually has.

## What you need

- A DEV Community account at dev.to.
- A DEV **API key**. You generate it from your DEV account settings.
- A PostDelegate workspace. Every plan starts with a 7-day free trial and needs no credit card.

## Step 1: generate a DEV API key

In DEV, open your account settings, then **Extensions**, and generate an API key. Give it a description you will recognise, such as `PostDelegate`, and copy it. DEV owns that screen, so its wording may change.

The key lets PostDelegate publish articles on your account. If you ever want to cut it off, revoke the key in DEV.

## Step 2: connect DEV to PostDelegate

1. On the calendar page choose **Add Channel**, then **Dev.to**.
2. Paste the key into **API key** and save.
3. PostDelegate asks DEV who the key belongs to. If DEV answers, your name and avatar appear on the channel.

If DEV rejects the key later, generate a new one and use **Update Credentials** in the channel's menu.

## Step 3: write the article in Markdown

Choose **Create Post** and select your DEV channel. The composer switches to a Markdown editor for DEV, with room for up to 100,000 characters.

- **Headings, code blocks and lists** work the way DEV expects in Markdown. Fenced code blocks with a language name are a good habit, since DEV highlights them.
- **Images** go inside the content, where they should appear. Use images from the [media library](/docs/media). Uploaded media is served through public links, so DEV can load them.
- **Links** from an article that started on your own site may need to be full addresses, so they still work from DEV.

If you write the article somewhere else first, paste the Markdown in and check the preview before you schedule.

## Step 4: fill in the post settings

| Setting | Notes |
| --- | --- |
| **Title** | Required, at least 2 characters. |
| **Cover image** | Optional. Shown at the top of the article and in DEV's feeds. |
| **Canonical URL** | Optional. Use it when the article first appeared somewhere else. |
| **Organization** | Optional. Publish under one of your DEV organizations instead of only your profile. |
| **Tags** | Up to 4, picked from DEV's tag list. |

A few notes from using these:

1. **Tags.** You pick from DEV's own list rather than typing free text, so the tags you choose match the ones readers follow. Four is the most DEV allows. Pick the ones that describe the article, not the most popular ones.
2. **Cover image.** Choose it from your media library like any other image. Use a wide image, since DEV shows covers as a wide banner.
3. **Organization.** Only shows organizations your DEV account belongs to.

## Step 5: set the canonical URL if it is a cross-post

If the article was first published on your blog, paste that address into **Canonical URL**. DEV adds it to the article, which tells search engines where the original lives.

DEV checks canonical URLs. If another DEV article already uses the same address, DEV rejects the new one and the post fails with "canonical URL already exists". That usually means you, or someone else, has already cross-posted that article to DEV. Check before you schedule a second copy.

Two habits help:

- Publish the original first and copy its live address, rather than typing what you expect it to be.
- Schedule the DEV copy a day or so after the original, so the canonical URL points at a page that exists.

The [guide to cross-posting with canonical URLs](/guides/cross-post-blog-articles) covers the order across DEV.to, Hashnode, Medium and WordPress, and [cross-posting to Medium and Hashnode](/guides/cross-post-to-medium-and-hashnode) goes deeper on duplicate content.

## Step 6: choose when it goes out

Pick a date and time. Dates and times follow the timezone in **Settings > Global Settings**. Then choose:

| Choice | What happens |
| --- | --- |
| **Save as draft** | Stored on your calendar, never sent to DEV until you schedule it. |
| **Add to Calendar** | Published on DEV automatically at the date and time you picked. |
| **Post now** | Published right away. |

One thing differs from what you might expect. **DEV articles are published straight away when the post goes out.** PostDelegate does not create a draft on DEV for you to finish later. If you want to hold an article back, keep it as a draft in PostDelegate.

Once the article is published it stays on your calendar with a link to the live page. Open it and check the tags, the cover and the formatting.

## Promote it on the same calendar

An article is usually followed by a few posts that link to it. Because the DEV article and the promotion sit on one calendar, you can space them properly:

1. DEV article at 09:00.
2. A Bluesky post with the link at 11:00. See [how to schedule Bluesky posts](/guides/schedule-bluesky-posts).
3. A Slack message to your team or community at the same time. See [Slack announcements](/guides/slack-scheduled-announcements).

Turn on **Short Link** on the promotional posts if you want click statistics for the link.

## Draft with Claude or ChatGPT

If you write with an AI assistant, connect PostDelegate over MCP and ask for a **draft** on your DEV channel. The assistant reads DEV's settings before creating the post, so it knows a title is required and tags are limited to four. You review the draft in the calendar, then schedule it. AI is bring-your-own, and PostDelegate never charges for it. See [scheduling with Claude](/guides/schedule-social-media-posts-with-claude).

## Schedule from a script

The REST API creates the same posts, for example from a static site build that publishes to DEV after your own site. Use [`GET /integration-settings/:id`](/docs/api/channels) to read the exact settings fields for your DEV channel, then send the post to the [Posts API](/docs/api/posts) with a date in UTC.

## Troubleshooting

- **Invalid credentials.** Generate a new key in DEV and use **Update Credentials**.
- **Canonical URL already exists.** Another DEV article already uses that canonical URL.
- **Invalid URL.** The canonical URL must be a full web address, such as `https://example.com/my-article`.
- **The article went live sooner than expected.** DEV publishes as soon as the post goes out. Use a PostDelegate draft to hold it.
- **A post failed.** The calendar shows DEV's reason on the post, and PostDelegate sends an in-app notification.

## Next steps

The [DEV.to scheduler page](/devto-scheduler) is the short version of this guide, and the [DEV.to channel guide](/docs/channels/devto) is the reference for every field.

Ready? [Start your 7-day free trial](https://app.postdelegate.com/auth). No credit card is required.
