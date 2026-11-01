---
layout: ../../../layouts/DocsLayout.astro
title: Lemmy
description: Connect to a Lemmy instance from PostDelegate with your username and password, then schedule posts to one or more communities. Post settings, limits and fixes.
---

## What you need

- An account on a Lemmy instance, such as lemmy.world.
- The address of that instance.

## Connect

1. On the calendar page choose **Add Channel**, then **Lemmy**.
2. Fill in the fields:

| Field | What to enter |
| --- | --- |
| Service | The instance address, for example `https://lemmy.world`. It must start with `http://` or `https://` and point to a public server. |
| Identifier | Your username or email on that instance. At least 3 characters. |
| Password | Your account password. |

3. Save. PostDelegate signs in to the instance and shows your account on the channel.

Because Lemmy has no app passwords, this is your real account password. It is encrypted before it is stored. If you change it, use **Update Credentials**.

## Post settings

| Setting | Notes |
| --- | --- |
| Community | Required. Choose one or more communities. Each one needs its own title. |
| Title | Required, at least 2 characters, one per community. |
| URL | Optional link to attach to the post. |

The first image of a post is used as the cover. Use a PNG, JPG or GIF.

## Limits and behaviour

- Up to 10,000 characters of text.
- If the instance rate-limits PostDelegate, the post is retried later.
- A post fails with a readable reason if your account is banned, the community no longer exists, or the instance blocks a link in the post.

## Troubleshooting

- **Invalid credentials.** Check the instance address, then the username and password.
- **Session no longer valid.** Use **Update Credentials**.
