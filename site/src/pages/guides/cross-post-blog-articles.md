---
layout: ../../layouts/Guide.astro
title: "Cross-post articles to DEV.to, Hashnode, Medium and WordPress with canonical URLs"
metaTitle: "Cross-Post Articles with Canonical URLs | PostDelegate"
description: "Publish one article to DEV.to, Hashnode, Medium and WordPress and point each copy back to the original with a canonical URL, in the right order."
date: "2026-11-01"
---

Writing an article once and publishing it in several places is a good way to reach readers who live on different platforms. The risk is duplicate content: search engines see the same text at several addresses and have to guess which one is the original. A canonical URL removes the guess. It tells the platform, and the search engines that read it, where the original article lives.

This guide shows how to cross-post an article from your own site to DEV.to, Hashnode and Medium using PostDelegate, with the canonical URL set correctly, and how WordPress fits in as the home of the original. It follows what each channel's settings actually allow.

## Decide where the original lives

Pick one address as the original and publish there first. For most people that is their own site, often a WordPress blog. Every other copy points back to it.

If your original is on WordPress, you can publish it from PostDelegate too. WordPress has no canonical URL setting in PostDelegate, because it is the original. Its settings are title, post type, status, categories, tags and a main image.

The order matters. A canonical URL should point at a page that already exists, so schedule the original first and the copies later. Leave a gap, such as a day, and check that the original loads before the copies go out.

## What each channel needs

| | WordPress | DEV.to | Hashnode | Medium |
| --- | --- | --- | --- | --- |
| Connect with | Site address, username, application password | API key | API key (personal access token) | Integration token |
| Body format | HTML | Markdown | Markdown | Markdown |
| Title | Required, 2+ characters | Required, 2+ characters | Required, 6+ characters | Required, 2+ characters |
| Subtitle | None | None | Optional | Required, 2+ characters |
| Canonical URL | Not offered | Optional | Optional | Optional |
| Tags | Loaded from your site | Up to 4 | Required, at least 1 | Optional, up to 4 |
| Other settings | Post type, status, categories, main image | Cover image, organization | Publication (required), cover image | Publication (optional) |

The [channel guides](/docs/channels) have the exact fields for each one.

## Step 1: connect the channels

Connect each channel from **Add Channel** on the calendar page:

- **WordPress.** Create an application password under Users, Profile, Application Passwords, then enter your site address, username and the application password. The site must be public with the REST API turned on.
- **DEV.to.** Generate an API key in your DEV account settings, under Extensions.
- **Hashnode.** Generate a personal access token in your account's developer settings. You need at least one publication.
- **Medium.** Create an integration token in your Medium security settings if your account still offers them. Medium decides who can create tokens, so some accounts cannot connect.

Each of those screens belongs to the platform, so its wording may change.

## Step 2: write the article once

Choose **Create Post** and select all the channels that should get the article. Write the content once, then adjust it per channel when a network needs something different. The composer switches editor to match each channel: WordPress takes HTML, while Medium, DEV.to and Hashnode take Markdown.

Adjust, then check, each of these per channel:

1. **Title.** Hashnode needs at least six characters. Keep one title across platforms if you want the copies to look like the same piece.
2. **Images.** In HTML and Markdown, put pictures inside the content where they should appear, using images from the [media library](/docs/media). Uploaded media is served through public links.
3. **Links.** Internal links from your original may need to be absolute addresses, so they still work from another platform.

Length limits differ too, and the composer counts as you type. Hashnode takes up to 10,000 characters of body, and a long article may need trimming or splitting for it. Medium takes up to 100,000. See the [character limits guide](/guides/social-media-character-limits) for how the networks compare.

## Step 3: set the canonical URL on each copy

On DEV.to, Hashnode and Medium, paste the address of your original article into **Canonical URL**.

- **DEV.to.** Canonical URL is optional. DEV rejects a canonical URL it already has, so if another DEV article uses that address, the post fails with "canonical URL already exists". Check that you have not already cross-posted that article.
- **Hashnode.** Canonical URL is optional. Also choose a **Publication**, which is required, and at least one **Tag**.
- **Medium.** Canonical URL is optional. Title and subtitle are both required.

Use the same exact address on every copy, including the protocol and any trailing slash your original uses.

## Step 4: know where each one publishes

The channels behave differently when the scheduled time arrives, and the differences are easy to miss:

- **WordPress** follows the Status you chose: Publish (the default), Draft, Pending or Private. Choosing Draft sends a draft to your site.
- **DEV.to** publishes the article straight away when the post goes out. A draft on DEV is not used, so keep a draft in PostDelegate to hold an article back.
- **Hashnode** publishes to the publication you chose.
- **Medium** depends on the Publication setting. With none selected, the story is published publicly on your profile. With a publication selected, it is sent to the publication as a draft so an editor can review it, and it does not go live until they do.

## Step 5: schedule in the right order

Use separate scheduled times, not one shared moment. A sensible sequence:

1. Publish the original on your WordPress site, or confirm it is already live.
2. A day later, schedule DEV.to and Hashnode.
3. Schedule Medium, or send it to the publication for review.

You can also create one post for all channels and pick a single date. One post goes out at one time on every channel you selected, so if you want a gap, create the original as a separate post with an earlier date. Choose **Save as draft** to hold anything back, and **Add to Calendar** to schedule it.

## Step 6: check the result

Published posts stay on your calendar with a link to the live post. Open each copy and check three things: the formatting, the images and the canonical link. If a network rejects a post, the calendar shows the reason and PostDelegate sends an in-app notification.

## Do it with Claude or ChatGPT

An assistant can help adapt one article to each platform's format, for example converting HTML to Markdown and trimming the length. Connect PostDelegate over MCP, ask for **drafts** on each channel, and review them in the calendar. The assistant reads each channel's rules and required settings before it creates the post, so it knows Hashnode needs a publication and a tag. See the [Claude walkthrough](/guides/schedule-social-media-posts-with-claude).

## Troubleshooting

- **Canonical URL already exists (DEV.to).** Another DEV article already uses that canonical URL.
- **No publications in the list (Hashnode).** Create a publication on Hashnode first, then reopen the post.
- **WordPress rejected the login.** The username or application password is wrong, or a security plugin is blocking the REST API or stripping the Authorization header.
- **Medium cannot connect.** Your account may not be able to create integration tokens.

## Next steps

Each channel has a scheduler page with the short version: [WordPress](/wordpress-scheduler), [DEV.to](/devto-scheduler), [Hashnode](/hashnode-scheduler) and [Medium](/medium-scheduler). The channel docs are [DEV.to](/docs/channels/devto), [Hashnode](/docs/channels/hashnode), [Medium](/docs/channels/medium) and [WordPress](/docs/channels/wordpress).

Ready? [Start your 7-day free trial](https://app.postdelegate.com/auth). No credit card is required.
