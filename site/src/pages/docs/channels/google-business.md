---
layout: ../../../layouts/DocsLayout.astro
title: Google Business Profile
description: Connect a Google Business Profile location with Google sign-in and schedule updates, events and offers with one image and a call-to-action button.
---

A Google Business Profile post appears on your business's listing on Google. PostDelegate publishes to the business location you pick when you connect.

## What you need

- A Google account that manages a verified Business Profile with at least one location.

## Connect

1. On the calendar page choose **Add Channel**, then **Google My Business**.
2. Sign in with Google and approve the permissions. PostDelegate asks to see your profile and email and to manage your Business Profile.
3. Choose the business location to connect. Each location is its own channel, so add the network again to connect another one.

Until Google verifies PostDelegate for the Business Profile permission, you may see a "Google hasn't verified this app" screen: choose **Advanced**, then **Go to PostDelegate**.

Signing in to PostDelegate with Google does not connect a Business Profile. You still need this step. If no locations appear, check that the business is verified on Google.

## What gets published

- Text of up to 1,500 characters.
- Text only, or text with one image. Video is not supported.
- Single posts only. Follow-up entries in a post are not published.

## Post settings

| Setting | Notes |
| --- | --- |
| Post Type | **Standard Update**, **Event** or **Offer**. Defaults to Standard Update. |
| Call to Action | Optional. **Book**, **Order Online**, **Shop**, **Learn More**, **Sign Up** or **Get Offer**, with the URL the button opens. **Call** adds no button, because it has no URL. |
| Event details | Event posts only. An event title is required. Start and end dates default to the day the post goes out, and start and end times are optional. |
| Offer details | Offer posts only. Optional coupon code, redeem online URL and terms and conditions. |

## Limits

- Google reviews each post. If it rejects one for its content policies, the post fails and the calendar shows the reason.
- If a location is removed from the Business Profile, posts to it fail until you connect another location.

## Troubleshooting

- **The channel asks to reconnect.** Google stopped accepting the saved sign-in, or the account lost access to the location. Use **Reconnect channel** and sign in with Google again. See [Reconnecting a channel](/docs/channels#reconnecting-a-channel).
