---
layout: ../../../layouts/DocsLayout.astro
title: WordPress
description: Connect a WordPress site with an application password and schedule posts or pages with categories, tags and a featured image. Post settings and fixes.
---

## What you need

- A WordPress site that is reachable from the internet, with the REST API turned on.
- A WordPress user that is allowed to create posts.
- An **application password** for that user. Create it in WordPress under Users, Profile, Application Passwords. Application passwords are a built-in WordPress feature. Some hosts and security plugins turn them off.

## Connect

1. On the calendar page choose **Add Channel**, then **WordPress**.
2. Fill in the fields:

| Field | What to enter |
| --- | --- |
| Domain URL | The full address of your site, for example `https://example.com`. A trailing slash is removed for you. |
| Username | The WordPress username. |
| Password | The application password, not your login password. |

3. Save. PostDelegate calls your site's REST API to check the details.

If the connection fails you will see one of these messages:

- **Could not reach your WordPress site.** Check the address, and that the site is public.
- **WordPress rejected the login.** The username or application password is wrong, or a security plugin or server setting is blocking the REST API or stripping the Authorization header.
- **The REST API may be disabled or blocked.** Turn the REST API on or allow it in your security plugin.

## Post settings

| Setting | Notes |
| --- | --- |
| Title | Required, at least 2 characters. |
| Post type | Required. Choose from the types on your site, such as posts and pages. |
| Status | **Publish** (the default), **Draft**, **Pending** or **Private**. |
| Categories | Optional. Loaded from your site. |
| Tags | Optional. Loaded from your site. |
| Main image | Optional featured image. It is uploaded to your media library. |

## Content

The editor writes HTML, up to 100,000 characters. Put pictures inside the content where they should appear, using images from the [media library](/docs/media). Attachments are not published separately.

## Troubleshooting

- **The connected user has insufficient permissions to create posts.** Use a user with a role that can publish posts.
- **Categories or tags are empty.** Your site returned none, or the REST API blocked the request.
