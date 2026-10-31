---
layout: ../../layouts/Guide.astro
title: "How to schedule Nostr notes to relays"
metaTitle: "How to Schedule Nostr Notes to Relays | PostDelegate"
description: "Connect a Nostr identity with a hex private key, schedule notes to public relays, add media and replies, and keep your main key safe with a separate key pair."
date: "2026-11-01"
---

Nostr has no company in the middle. Your identity is a key pair, and your notes are signed messages sent to relays that anyone can run. That is the appeal, and it also changes how scheduling works. There is no account to sign in to and no app permission to grant. To publish a note later, a scheduler has to be able to sign it for you.

This guide shows how to schedule Nostr notes with PostDelegate, which relays they go to, and how to do it without putting your main identity at risk. Nostr is available to connect today.

## How scheduling works on Nostr

When you connect Nostr to PostDelegate, you give it your **private key in hex format**. PostDelegate stores it so it can sign each note at the time you scheduled. It works out your public key from it and looks up your profile name and picture on the relays.

When a note goes out, PostDelegate sends it to these relays:

- nos.lol
- relay.damus.io
- relay.snort.social
- temp.iris.to
- vault.iris.to

The note counts as published when a relay accepts it. The link on your calendar points to the note on primal.net.

## Decide which key to use

This is the most important step, so it comes first.

Your private key controls your whole Nostr identity. Anyone who has it can post as you, and Nostr has no way to revoke a key. If it ever leaks, the only fix is a new identity.

You have two options:

| Option | Good for | Trade-off |
| --- | --- | --- |
| **A separate key pair just for scheduling** | A project account, a newsletter feed, a bot-style account | Followers follow that identity, not your personal one |
| **Your main key** | Scheduling notes as your personal identity | The key is stored on the service, and you cannot revoke it later |

If you are unsure, start with a separate key pair. Many Nostr clients can create one in a few seconds. Only connect a key you are comfortable storing on the service.

## Step 1: get the private key in hex

PostDelegate needs the key in **hex**, not in the `nsec` form many clients show by default.

- A hex key is a long string of the letters a to f and numbers.
- An `nsec` key starts with `nsec1`. If that is what you have, convert it to hex first.

Many Nostr clients and sites, such as iris.to, can show or convert your key to hex. Do the conversion in a tool you trust, since whatever converts the key sees it.

## Step 2: connect the identity

1. On the calendar page choose **Add Channel**, then **Nostr**.
2. Paste the hex key into **Nostr private key** and save.
3. PostDelegate works out your public key and looks up your profile on the relays.

If none of the relays return a profile for that key, the channel is named **No Name**. Posting still works. You can rename the channel in PostDelegate with **Rename channel** in its menu, or publish a profile for the identity from a Nostr client.

## Step 3: write the note

Choose **Create Post** and select your Nostr channel. Nostr has no extra post settings, so the note is just its content.

- **Length.** The composer allows up to 100,000 characters. In practice, clients display long notes differently, so keep the important part at the top.
- **Images and video.** Attach them as usual. Nostr notes carry text, so PostDelegate adds media to the note as plain URLs after your text. Most clients show image links as images.
- **Links.** Paste the URL into the text. Turn on **Short Link** if you want click statistics.

Uploaded media is served through public links, which is what lets clients load it from the note.

## Step 4: add replies

Use **Add post in a thread** to add more entries. On Nostr, follow-up entries become replies to the first note. That suits a short thread, or a note followed by a link and a longer explanation.

You can delay a follow-up so it appears after the first note rather than immediately behind it.

## Step 5: schedule it

Pick a date and time. Dates and times follow the timezone in your profile settings. Then choose:

| Choice | What happens |
| --- | --- |
| **Save as draft** | Stored on your calendar, never signed or sent until you schedule it. |
| **Add to Calendar** | Signed and sent to the relays at the date and time you picked. |
| **Post now** | Sent right away. |

Once the note goes out it stays on your calendar with a link to it on primal.net.

## Things to know before you publish

- **A published note is out of your hands.** Relays keep and pass on what they accept. Deleting the post in PostDelegate removes it from your calendar, not from the relays.
- **Relays are independent.** One relay may be slow or refuse a note while others accept it. The note counts as published when a relay accepts it, so it may take a moment to appear everywhere.
- **Clients differ.** How a note looks, including media links and long text, depends on the client your readers use.

## Post the same idea to Nostr and Bluesky

If you post on both Nostr and Bluesky, you can write once for both. In one post you can select both channels and adjust the text per channel. Bluesky has a 300-character limit and takes up to four images or one video, while Nostr takes a much longer note with media as links. Write the short version for Bluesky, and add more detail for Nostr if you like. See [how to schedule Bluesky posts](/guides/schedule-bluesky-posts) and the [character limits guide](/guides/social-media-character-limits).

For notes that repeat, such as a weekly link roundup, use **Repeat Post Every**, or make the post [evergreen](/docs/evergreen) with rotating wordings. To fill a month at once, use the [CSV import](/guides/bulk-schedule-social-posts-csv).

## Draft notes with an AI assistant

If you use Claude or ChatGPT, connect PostDelegate over MCP and ask for **drafts** on your Nostr channel. Review them in the calendar, then schedule. Because a note cannot be taken back once relays accept it, keep **Require approval for AI-created posts** on in **Settings > Approvals**, so anything an assistant schedules or posts now waits in Approvals until a person approves it. See [how to let an AI agent post safely](/guides/ai-social-media-agent-guardrails). AI is bring-your-own, and PostDelegate never charges for it.

## Troubleshooting

- **Invalid credentials.** Check that the key is hex, with no spaces, and not an `nsec` string.
- **No Name on the channel.** None of the relays returned a profile for that key. Posting still works.
- **A note failed.** The calendar shows the reason on the post, and PostDelegate sends an in-app notification.
- **You want to stop scheduling with a key.** Delete the channel in PostDelegate after deleting its posts. Remember that Nostr itself cannot revoke the key, so treat a key you shared as shared.

## Next steps

The [Nostr scheduler page](/nostr-scheduler) is the short version of this guide, and the [Nostr channel guide](/docs/channels/nostr) is the reference.

Ready? [Start your 7-day free trial](https://app.postdelegate.com/auth). No credit card is required.
