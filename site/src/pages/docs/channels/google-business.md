---
layout: ../../../layouts/DocsLayout.astro
title: Google Business Profile
description: Connect a business location with Google sign-in, then schedule updates, events and offers of up to 1,500 characters with one optional image and button.
---

Google Business Profile is your business's listing on Google Search and Maps. PostDelegate publishes posts to the locations you connect.

## What you need

- A Google account that owns or manages the Business Profile.
- A verified business location. Google only accepts posts for verified locations.

## Connect

1. On the calendar page choose **Add Channel**, then **Google My Business**.
2. Sign in with Google and approve the permissions. PostDelegate asks to see your basic profile and email address, and to manage your Business Profile.
3. Under **Select Business Location**, pick the location to post to.
4. The location appears as a channel on your calendar. PostDelegate never sees your Google password.

Each location is its own channel. To add another location, choose **Add Channel**, then **Google My Business** again, and pick it.

Signing in to PostDelegate with Google does not connect a Business Profile. You still need these steps.

## What gets published

- Text of up to 1,500 characters.
- One optional image. Videos are not supported.
- Only the first entry of a post is published. Google Business Profile has no replies or threads.

## Post settings

| Setting | Notes |
| --- | --- |
| Post Type | **Standard Update**, **Event** or **Offer**. Defaults to **Standard Update**. |
| Call to Action | Optional button: **Book**, **Order Online**, **Shop**, **Learn More**, **Sign Up** or **Get Offer**. Enter the **Call to Action URL** the button opens. Without a URL, no button is added. |
| Event Details | For events. **Event Title** is required. **Start Date** and **End Date** are optional and default to the day the post goes out. Start and end times are optional. |
| Offer Details | For offers. **Coupon Code**, **Redeem Online URL** and **Terms & Conditions**, all optional. |

## Analytics

Each location has its own view on the **Analytics** page, with website clicks, phone calls, direction requests and map views on desktop and mobile, as Google reports them for the location. Pick the last 7, 30 or 90 days. Google does not report statistics for single posts, so Business Profile channels do not feed trends, top posts or insights. See [Analytics and reports](/docs/analytics).

## Removing a location

Deleting the channel removes its saved sign-in from PostDelegate. Once no other Business Profile location or YouTube channel from the same Google account is connected to PostDelegate, PostDelegate also asks Google to revoke its access. Posts already published stay on Google.

## Troubleshooting

- **No locations are listed.** The Google account you signed in with does not manage a Business Profile location. Close the dialog, delete the channel, and connect again with the Google account that manages the location.
- **Google rejected the post.** Google reviews posts and rejects ones that break its content policies. The reason appears on the calendar. Change the post and schedule it again.
- **Business location not found.** The location was removed from the Google account. Delete the channel, or connect the location again if it still exists.
- **The channel asks to reconnect.** Google stopped accepting the saved sign-in, or the account lost access to the location. Use **Reconnect channel** and sign in with the Google account that manages the location. See [Reconnecting a channel](/docs/channels#reconnecting-a-channel).
