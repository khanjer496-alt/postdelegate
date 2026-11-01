---
layout: ../../../layouts/DocsLayout.astro
title: Bluesky
description: Connect a Bluesky account to PostDelegate with an app password, then schedule posts and threads with up to four images or one video. Settings, limits and fixes.
---

## What you need

- A Bluesky account.
- An **app password** for it. An app password is a separate password you can revoke at any time without changing your main one. Create one in the Bluesky app under Settings, Privacy and security, App passwords. Bluesky owns that screen, so its wording may change.

## Connect

1. On the calendar page choose **Add Channel**, then **Bluesky**.
2. Fill in the three fields:

| Field | What to enter |
| --- | --- |
| Service | `https://bsky.social`, the default. Only change it if your account lives on a different Bluesky-compatible server. It must be a public HTTPS address. |
| Identifier | Your handle, for example `name.bsky.social` (or the email on the account). |
| Password | The app password. |

3. Click **Connect**. PostDelegate signs in to check the details and shows the channel on your calendar.

The in-app tip says two-factor authentication is not supported: if it is turned on for your Bluesky account you will need to turn it off. If you change the password later, use **Update Credentials** in the channel's menu.

## Post settings

Bluesky has no extra post settings.

## Limits

- 300 characters per post.
- Up to 4 images, or 1 video, per post. You cannot mix them.
- Images are reduced automatically to fit Bluesky's size limit. Video must be MP4.
- Add more entries to a post with **Add post in a thread** to publish a thread of replies.

## Troubleshooting

- **Invalid credentials.** Check the handle and generate a fresh app password.
- **Invalid service URL.** The service address must be a public HTTPS URL.
- **The channel asks to reconnect.** Bluesky rejected the saved login. Use **Update Credentials** with a new app password.
