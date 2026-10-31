---
layout: ../../layouts/Guide.astro
title: "Avoid duplicate content on Medium and Hashnode with canonical URLs"
metaTitle: "Avoid Duplicate Content on Medium and Hashnode | PostDelegate"
description: "Set a canonical URL on your Medium and Hashnode copies so search engines credit the original article: which address to use, when to publish and what to avoid."
date: "2026-11-01"
---

Medium and Hashnode both have readers you will not reach from your own blog. Both also accept a canonical URL, a setting that tells the platform and search engines which address is the original. Set it correctly and a republished article helps the original. Get it wrong, or skip it, and the copy can end up competing with the page you actually care about.

This guide is about that one decision: how to use canonical URLs on Medium and Hashnode with PostDelegate. It does not repeat the full publishing workflow. For the step-by-step setup across DEV.to, Hashnode, Medium and WordPress, read [cross-post articles with canonical URLs](/guides/cross-post-blog-articles).

## What a canonical URL does

When the same article exists at several addresses, a search engine has to pick one to show. A canonical URL is a line in the page that says "the original is over there". Medium and Hashnode add it to the copy for you when you fill in the setting.

Two things are worth knowing before you start:

- **It is a strong hint, not a command.** Search engines usually follow a canonical URL when the pages are substantially the same, but they make the final call.
- **It only helps if the original is real and reachable.** A canonical URL that points at a page that does not exist yet, redirects, or returns an error gives the search engine nothing to credit.

So the job is simple: publish the original first, then point every copy at its exact address.

## Pick the original

Decide which address is the article's home. There are two common setups:

| Your setup | Original | Medium copy | Hashnode copy |
| --- | --- | --- | --- |
| Your own site, such as WordPress | Your site | Canonical URL to your site | Canonical URL to your site |
| Hashnode is your blog | Hashnode | Canonical URL to the Hashnode article | No canonical URL, it is the original |

If Hashnode is your blog, leave its canonical URL empty. Setting a canonical URL on the original that points at itself, or at another copy, is how articles lose credit by accident.

## Step 1: connect Medium and Hashnode

Connect each from **Add Channel** on the calendar page:

1. **Hashnode.** Generate a personal access token in your Hashnode account's developer settings. You need at least one publication on Hashnode, because every article goes to a publication. Paste the token into **API key**.
2. **Medium.** Create an integration token in your Medium security settings, if your account still offers them. Medium decides who can create tokens, so some accounts cannot connect. Paste the token into **API key**.

PostDelegate asks each platform who the key belongs to and shows your name and avatar on the channel. If you publish the original on WordPress, connect it too. See [how to schedule WordPress posts](/guides/schedule-wordpress-posts).

## Step 2: publish the original and copy its live address

Schedule the original first. Once it has gone out, it stays on your calendar with a link to the live post. Open that link and copy the address from your browser.

Copying the live address, rather than typing what you expect it to be, avoids the small differences that break a canonical URL: `http` against `https`, `www` or no `www`, a trailing slash, or a slug your site changed when it published. Use exactly the address your site settles on.

If the original is already live from before, open it and copy its address the same way.

## Step 3: create the Hashnode copy

Choose **Create Post**, select your Hashnode channel and paste the article. Hashnode takes Markdown.

1. **Title.** Required, at least 6 characters. Use the same title as the original so readers recognise the piece.
2. **Subtitle.** Optional.
3. **Canonical URL.** Paste the original's address. Leave it empty only if Hashnode is your original.
4. **Publication.** Required. Choose from the publications on your account.
5. **Tags.** Required, at least one, picked from Hashnode's tag list.
6. **Cover image.** Optional.

Hashnode takes up to 10,000 characters of body. A long article may need trimming. A shorter copy that links to the full version is still fine to mark with a canonical URL, as long as it is clearly the same article.

## Step 4: create the Medium copy

Add your Medium channel to the same post, or create a separate post if you want it to go out at another time. Medium also takes Markdown, up to 100,000 characters.

1. **Title.** Required, at least 2 characters.
2. **Subtitle.** Required, at least 2 characters on Medium.
3. **Canonical URL.** Paste the original's address.
4. **Publication.** Optional. This changes where the story lands, see the next step.
5. **Tags.** Optional, up to 4.

## Step 5: know where each copy lands

- **Hashnode** publishes to the publication you chose.
- **Medium with no publication** publishes the story publicly on your profile.
- **Medium with a publication** sends it to the publication as a draft, so an editor can review it. It does not go live until they publish it.

If you submit to a Medium publication, mention the canonical URL to the editor, so it survives their edits.

## Step 6: schedule in order

1. The original goes out first.
2. A day later, or once you have checked the original, schedule Hashnode.
3. Then Medium, or the Medium submission.

One post goes out at one time on every channel selected in it. If you want a gap, use separate posts with separate dates. **Save as draft** holds anything back and **Add to Calendar** schedules it.

## Step 7: check each copy

Open each published copy and check:

- The canonical address matches the original exactly. You can view the page source and search for `canonical`.
- Images load. In Markdown, pictures go inside the content, using images from the [media library](/docs/media).
- Links inside the article still work. Relative links from your own site may need to be full addresses.

If a platform rejects the post, the calendar shows its reason and PostDelegate sends an in-app notification.

## Mistakes to avoid

- **Scheduling the copies before the original.** The canonical URL then points at nothing until the original appears.
- **A canonical URL on the original.** The original should not point anywhere else.
- **Different addresses on different copies.** Every copy should name the same original.
- **Rewriting the copy heavily.** If the copy becomes a different article, a canonical URL is the wrong tool. Publish it as its own piece instead.
- **Cross-posting the same article twice to one platform.** Check your calendar before you schedule a copy.

## Let an assistant prepare the copies

If you use Claude or ChatGPT, connect PostDelegate over MCP and ask for **drafts** on Medium and Hashnode with a given canonical URL. The assistant reads each channel's required settings before it creates the post, so it knows Medium needs a subtitle and Hashnode needs a publication and a tag. You review the drafts and schedule them. AI is bring-your-own and PostDelegate never charges for it. See [what a social media MCP server is](/guides/social-media-mcp-server).

## Next steps

The [Medium scheduler page](/medium-scheduler) and the [Hashnode scheduler page](/hashnode-scheduler) are the short versions, and the channel references are [Medium](/docs/channels/medium) and [Hashnode](/docs/channels/hashnode). For DEV.to, which rejects a canonical URL it already has, read [how to schedule DEV.to articles](/guides/schedule-dev-to-articles).

Ready? [Start your 7-day free trial](https://app.postdelegate.com/auth). No credit card is required.
