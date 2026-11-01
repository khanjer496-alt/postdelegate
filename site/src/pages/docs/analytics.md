---
layout: ../../layouts/DocsLayout.astro
title: Analytics and reports
description: Workspace analytics with daily history, view gains, top posts and best times, plus CSV exports, PDF and scheduled reports, and a weekly summary email.
---

Open **Analytics** from the main menu. The top of the page is **Workspace analytics**, which covers every channel in the workspace. Below it, each channel on a network that shares statistics has its own view.

Pick a range of the last 7, 30 or 90 days. The page remembers your range and the section you were on.

## Where the numbers come from

Two kinds of numbers appear on this page:

- **Post counts** come from your PostDelegate calendar: how many posts were published, scheduled and failed. They cover every channel.
- **Engagement, views and followers** come from the networks. A network only appears in these figures if it shares statistics with PostDelegate, and each network decides which numbers it shares. A count that a network does not report is left out, not shown as zero.

Of the networks you can [connect today](/docs/channels), YouTube is the one that shares statistics. Google does not allow YouTube statistics to be stored, so PostDelegate reads them when you look and never saves them in the daily history. YouTube channels therefore have their own view on this page and appear in [Views](#views), but do not feed trends, top posts or insights. More networks will feed these sections as their connections open. See [Coming soon](/docs/channels/coming-soon).

## Daily history

Once a day, PostDelegate saves the follower count of each channel and the latest metrics of its recent posts, including posts published through PostDelegate in the last 30 days. Trends and comparisons fill in as the days add up. Until the first daily snapshot has run, the trends, top posts and insights sections say "Collecting data from today".

History is only kept for channels whose network allows it. A channel without history says so in its own view.

## Overview

- **Published**, **Scheduled** and **Failed**: published and failed in the last days of your range, scheduled in the next days.
- **Compared with the previous** period: **Followers gained**, **Posts published**, **Engagement** and **Views**, each next to the period before. Engagement and views add up the posts published in each period, as last measured, so newer posts have had less time to collect them.
- **By channel**: published and failed posts per channel.
- **Best days and hours**: when your posts do best. Until 10 posts have engagement data, this is based on when your posts went out. After that it is based on engagement, shown as a multiple of a typical post on the same channel. Times are in your timezone.
- **Engagement**: totals across channels whose network shares analytics, with how many channels the figure covers.

## Trends

**Follower growth** charts the total followers across every channel that has a follower count. **By channel** lists each channel's followers now and how many it gained in the range.

## Views

**Views** charts the new views your channels get each day, like a daily bar chart per channel. Today YouTube is the only network you can connect that shares view counts, so a workspace with a YouTube channel sees its views here and other channels say "This network doesn't share view counts yet". TikTok, Instagram and Facebook are ready for this section and fill in once their connections open.

- **Views gained**, **Best day** and **Daily average** for the range.
- **Daily views gained**: a bar chart of new views per day across the selected channels. Hover or tap a bar to read that day. When more than one channel has views, pick channels at the top to narrow the chart, the totals and the top posts. With none picked, every channel with views counts.
- **By channel**: each channel's views gained in the range, its best day and a small daily chart.
- **Top posts by views gained**: the 10 posts that gained the most views in the range, with the channel and, where PostDelegate knows it, the post's views in all.

Each channel is marked with where its numbers come from:

| Mark | What it means |
| --- | --- |
| **Live** | The network reports views per day, and PostDelegate reads them when you open the section. Nothing is stored. YouTube works this way, and its top posts are read live too. Networks report recent days with a delay, so the last day or two can be empty. |
| **Daily history** | The network only reports each post's total views, so PostDelegate works out the daily gain from the daily history: today's total minus the last one. It covers the posts the history tracks, which are posts published through PostDelegate in the last 30 days and the latest posts the network lists. A new post counts from the day it went out. A day the history missed shares its gain with the days around it, and a total that drops (a network recount) counts as no gain instead of a loss, with gains counting again once it passes its earlier high. These channels need two daily snapshots before they show gains. |

## Top posts

A table of your best posts in the range across every channel, as last measured, with **Views**, **Likes**, **Comments**, **Shares** and **Engagement**. Engagement is likes, comments and shares. Sort by any column, use **Filter by channel**, and choose **Export CSV** to download the list.

Post metrics are saved once a day, so top posts appear after the first daily snapshot.

## Insights

Insights compare your posts published through PostDelegate in the range. Each group is scored against a typical post on its own channel: 1× is typical, and higher is better.

| Insight | Groups |
| --- | --- |
| **By content type** | Video, Carousel, Image or Text only, from the media attached to each post. |
| **By post length** | Up to 80 characters, 81 to 280, 281 to 1,000, and over 1,000. |
| **Top hashtags** | The hashtags you used most and how those posts did. |
| **By tag or campaign** | The tags, [campaigns and pillars](/docs/campaigns) you add to posts. |

Insights start once posts published through PostDelegate have their first daily metrics.

## Reports

The **Reports** section has three parts.

### Export data

Spreadsheet files of the range, for every channel. Available on every plan.

- **Top posts (CSV)**.
- **Daily metrics (CSV)**: one row per channel and day, with followers, total posts and the summed metrics of the posts tracked that day.

### Client-ready PDF report

A printable report with your logo and name: trends, top posts, best times and insights. Pick **From** and **To** dates and choose **Open printable report**. It opens in a new tab. Choose **Save as PDF** in the print dialog.

### Scheduled email and branding

A summary of the previous week or month, emailed to the workspace members you choose. Only admins see this card.

| Setting | Options |
| --- | --- |
| **Send the email** | **Off**, **Weekly, on Mondays** or **Monthly, on the 1st**. |
| **Recipients** | One or more members of the workspace. Required unless the email is off. |
| **Name on the report** | The name shown on the PDF report and the scheduled email. Empty uses the workspace name. |
| **Logo** | An image from your media library, chosen with **Choose**, shown on the PDF report and the scheduled email. |

Choose **Save settings**, then **Email me a sample** to see what recipients will get.

The PDF report and the scheduled email are part of the Pro and Ultimate plans. On other plans the Reports section shows an upgrade note. See [Plans and billing](/docs/billing).

## Weekly summary email

Separately from reports, each member can get a short summary of the workspace every Monday morning. It is sent from 8:00 in your own timezone and includes:

- How many posts were published and failed last week, and how many are scheduled this week.
- **Top posts last week**, when PostDelegate already has engagement figures for them. Nothing is fetched from the networks for the email.
- **Coming up this week**: the next scheduled posts.
- **Needs your attention**: channels that need to be reconnected and posts that failed.

A week with nothing to report sends no email.

To turn it on or off, open **Settings > Global Settings** and use **Weekly summary** under **Email Notifications**. The setting is per workspace, so you can get the summary for one workspace and not another. It starts on for the admin who creates a new workspace.

## Analytics in the API

The REST API returns a channel's statistics and a post's statistics where the network provides them. See [Analytics and other endpoints](/docs/api/more).
