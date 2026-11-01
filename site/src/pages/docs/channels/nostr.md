---
layout: ../../../layouts/DocsLayout.astro
title: Nostr
description: Connect a Nostr identity to PostDelegate with its hex private key and publish scheduled notes to public relays. How publishing works, settings and fixes.
---

## What you need

- A Nostr identity (a key pair).
- Your **private key in hex format**. Many Nostr clients and sites such as iris.to can show or convert your key to hex. It is a long string of letters a to f and numbers, not the `nsec` form.

<div class="callout warn">

Your private key controls your whole Nostr identity. PostDelegate needs it to sign notes for you, so it is stored on the service. If that is more than you want to hand over, create a separate key pair just for scheduling and use that. Nostr has no way to revoke a key, so only connect one you are comfortable with.

</div>

## Connect

1. On the calendar page choose **Add Channel**, then **Nostr**.
2. Paste the hex key into **Nostr private key** and save.
3. PostDelegate works out your public key and looks up your profile name and picture on the relays. If it finds none, the channel is named **No Name**.

## How publishing works

PostDelegate sends each note to these relays: nos.lol, relay.damus.io, relay.snort.social, temp.iris.to and vault.iris.to. The note counts as published when a relay accepts it, and the link in your calendar points to the note on primal.net.

Images and video are added to the note as plain URLs after your text, because Nostr notes carry text. Follow-up entries in a post become replies to the first note.

## Post settings

Nostr has no extra post settings.

## Troubleshooting

- **Invalid credentials.** Check that the key is hex, with no spaces, and not an `nsec` string.
- **No Name on the channel.** None of the relays returned a profile for that key. Posting still works.
