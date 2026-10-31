---
layout: ../../layouts/Guide.astro
title: "How to schedule WordPress posts from a social calendar"
metaTitle: "How to Schedule WordPress Posts from a Calendar | PostDelegate"
description: "Connect a WordPress site with an application password and schedule posts and pages from the same calendar as your social posts, with categories and tags."
date: "2026-11-01"
---

WordPress has its own scheduler, so why schedule from somewhere else? Because the article is rarely the only thing going out. There is the announcement on Bluesky, the reminder in Slack, the copy on DEV.to. When the blog post lives in one tool and everything that points to it lives in another, the dates drift apart and links go out before the page exists.

This guide shows how to connect a WordPress site to PostDelegate and schedule posts and pages from the same calendar as the rest of your channels. It follows the settings the WordPress connection actually has.

## What you need

- A WordPress site that is reachable from the internet, with the REST API turned on. Most self-hosted sites have it on by default.
- A WordPress user that is allowed to create posts. An Editor, or an Author if you only publish posts, is a sensible choice rather than your main administrator. Authors cannot create pages.
- An **application password** for that user. Application passwords are built into WordPress. Some hosts and security plugins turn them off, and WordPress generally only offers them on sites served over HTTPS.
- A PostDelegate workspace. Every plan starts with a 7-day free trial and needs no credit card.

An application password is separate from your login password. You can revoke it in WordPress at any time without changing how you sign in.

## Step 1: create an application password

1. In your WordPress dashboard, open **Users**, then **Profile** for the user you want to publish as.
2. Scroll to **Application Passwords**.
3. Enter a name you will recognise, such as `PostDelegate`, and choose **Add New Application Password**.
4. Copy the password WordPress shows. It is displayed once.

That screen belongs to WordPress, so its wording may change between versions.

## Step 2: connect the site

1. On the PostDelegate calendar page choose **Add Channel**, then **WordPress**.
2. Fill in the three fields:

| Field | What to enter |
| --- | --- |
| Domain URL | The full address of your site, for example `https://example.com`. A trailing slash is removed for you. |
| Username | The WordPress username of the user from step 1. |
| Password | The application password, not your login password. |

3. Save. PostDelegate calls your site's REST API to check the details, and the site appears on your calendar.

If something is wrong you will see one of three messages: the site could not be reached, WordPress rejected the login, or the REST API may be disabled or blocked. The troubleshooting section below covers each one.

## Step 3: write the post

Choose **Create Post** and select your WordPress channel. The composer switches to an HTML editor for WordPress, and the body can be up to 100,000 characters.

Put pictures inside the content where they should appear, using images from the [media library](/docs/media). WordPress does not publish separate attachments, so an image that is only attached to the post and not placed in the body will not show.

Then fill in the post settings:

| Setting | Notes |
| --- | --- |
| **Title** | Required, at least 2 characters. |
| **Post type** | Required. The list comes from your site, so you will see posts, pages and any custom types your site exposes through the REST API. |
| **Status** | **Publish** (the default), **Draft**, **Pending** or **Private**. |
| **Categories** | Optional. Loaded from your site. |
| **Tags** | Optional. Loaded from your site. |
| **Main image** | Optional featured image. It is uploaded to your WordPress media library. |

Categories and tags are read from your site, so create any new ones in WordPress first, then reopen the post.

## Step 4: choose a status that matches your plan

The scheduled time in PostDelegate is when the post is sent to WordPress. The **Status** decides what WordPress does with it when it arrives:

- **Publish** makes the post live at the scheduled time. This is the usual choice.
- **Draft** puts a draft on your site at that time. Use it when someone else finishes the post inside WordPress, such as adding a plugin block that PostDelegate cannot set.
- **Pending** puts it in WordPress's review queue, for sites where an editor approves posts.
- **Private** publishes it so that only logged-in users with the right role can read it.

If you want to hold a post back entirely, keep it as a draft in PostDelegate. Nothing is sent to WordPress until you schedule it.

## Step 5: schedule it on the calendar

Pick a date and time. Dates and times follow the timezone in your profile settings, not your WordPress site's timezone, so check both if they differ. Then choose:

| Choice | What happens |
| --- | --- |
| **Save as draft** | Stored on your calendar, never sent until you schedule it. |
| **Add to Calendar** | Sent to WordPress automatically at the date and time you picked. |
| **Post now** | Sent right away. |

Once the post has gone out, it stays on your calendar with a link to the live page.

## Step 6: schedule the posts that point to it

This is the reason to use one calendar. Plan the promotion around the article:

1. Schedule the WordPress post first, for example Tuesday at 08:00.
2. Schedule a Bluesky post for later the same morning with the link. Turn on **Short Link** if you want click statistics.
3. Schedule a Slack message to your team or community channel. See [how to schedule Slack announcements](/guides/slack-scheduled-announcements).
4. If you cross-post the article, schedule the copies a day later with a canonical URL pointing at the WordPress original. The [cross-posting guide](/guides/cross-post-blog-articles) explains the order.

Leave a gap between the original and anything that links to it, and open the live page before the promotion goes out. A promotional post that goes out before the article is live sends readers to a page that is not there yet.

## Use approvals for blog posts

If several people write for the site, turn on **Require approval before publishing** in **Settings > Approvals**. Posts from members who can't approve are sent for review instead of being scheduled, and an approver checks them in **Approvals** first. You can also send a client an approval link that needs no account. See the [approval workflow guide](/guides/client-approval-workflow).

## Draft with an AI assistant

If you write with Claude or ChatGPT, connect PostDelegate over MCP and ask for a **draft** on your WordPress channel. The assistant reads the channel's required settings first, so it knows a title and post type are needed, and it can look up your categories. Review the draft in the calendar before you schedule it. AI is bring-your-own, and PostDelegate never charges for it. See [scheduling with Claude](/guides/schedule-social-media-posts-with-claude).

## Troubleshooting

- **Could not reach your WordPress site.** Check the address, including `https://`, and that the site is public. A site behind a login wall or a maintenance page cannot be reached.
- **WordPress rejected the login.** The username or application password is wrong, or a security plugin or server setting is blocking the REST API or stripping the Authorization header. Some hosts need a setting changed to pass that header through.
- **The REST API may be disabled or blocked.** Turn the REST API on, or allow it in your security plugin.
- **The connected user has insufficient permissions to create posts.** Use a user with a role that can publish.
- **Categories or tags are empty.** Your site returned none, or the REST API blocked the request.
- **The password changed.** Use **Update Credentials** in the channel's menu with a new application password.

## Next steps

The [WordPress scheduler page](/wordpress-scheduler) is the short version of this guide, and the [WordPress channel guide](/docs/channels/wordpress) is the reference for every field. If you also publish the article elsewhere, read [avoiding duplicate content on Medium and Hashnode with canonical URLs](/guides/cross-post-to-medium-and-hashnode).

Ready? [Start your 7-day free trial](https://app.postdelegate.com/auth). No credit card is required.
