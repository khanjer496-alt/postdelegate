---
layout: ../../layouts/Guide.astro
title: "How to bulk schedule social media posts from a CSV"
metaTitle: "Bulk Schedule Social Media Posts from a CSV | PostDelegate"
description: "Schedule up to 200 posts at once from a spreadsheet: the columns the importer reads, a sample CSV, dates and timezones, channel settings and fixing errors."
date: "2026-11-01"
---

Some posts are best written one at a time. Others come in batches: a month of tips, a run of event reminders, a content plan that already lives in a spreadsheet. Copying each row into a composer by hand is slow and easy to get wrong. A CSV import takes the spreadsheet as it is and schedules every row that is ready.

This guide shows how to bulk schedule posts in PostDelegate from a CSV file: the columns the importer reads, a sample file you can adapt, how dates and channels work, and how to fix the rows it flags. The reference is the [bulk import docs](/docs/bulk-import).

## What you need

- A PostDelegate workspace with at least one connected channel. The import button appears once you have one.
- A spreadsheet app, such as Excel, Google Sheets or Numbers, that can save a CSV file.

Every plan starts with a 7-day free trial and needs no credit card.

## Step 1: download the template

On the calendar page, choose the import button next to **Create Post**. Its tooltip reads "Import posts from a CSV file". Then choose **Download template**.

The template is a ready-to-fill file with your own channel names already in it, so it is the quickest way to get the format right. The same window lists **Your channel names** if you would rather type them.

## Step 2: know the columns

The first row names the columns. Names are not case sensitive.

| Column | Required | What to put in it |
| --- | --- | --- |
| `date` | Yes | When to post, like `2026-11-03 09:30`. It must be in the future. |
| `timezone` | No | A timezone name, like `Europe/London`. Empty means your timezone. |
| `channels` | Yes | One or more channel names, separated by `\|`. |
| `text` | Yes | The post text. Line breaks are kept. |
| `image_urls` | No | Public image links starting with `https://`, separated by `\|`. |
| `settings` | No | Channel settings as JSON, like `{"title": "My video"}`. |
| `tags` | No | Names of existing tags, campaigns or pillars, separated by `\|`. |

The `date`, `channels` and `text` columns must exist. A `text` cell can be empty when the row has an image link, but a row with neither is rejected as empty.

If your spreadsheet already uses other headings, some common ones work too. For example `content`, `message` or `caption` are read as `text`, and `channel` or `accounts` as `channels`.

## Step 3: fill in the rows

Here is a sample file using the real columns. The channel names are examples, so use the names from your template.

```csv
date,timezone,channels,text,image_urls,settings,tags
2026-11-10 09:00,Europe/London,Bluesky,"Five ideas to plan a month of posts in one afternoon. https://example.com/guide",,,Tips
2026-11-10 18:45,Europe/London,My Twitch,"Going live in 15 minutes: the final boss rush.",,"{""messageType"": ""announcement"", ""announcementColor"": ""purple""}",
2026-11-10 18:45,Europe/London,My Kick | Bluesky,"Going live in 15 minutes: the final boss rush.",,,
2026-11-11 12:00,,Bluesky,"Behind the scenes this week.
A second line.",https://example.com/images/studio.jpg,,
2026-11-12 08:30,America/New_York,Company blog,"Our November update is here.
Everything we shipped this month.",,"{""title"": ""November update"", ""type"": ""posts""}",Newsletter
```

What each row shows:

1. **A simple post** to one channel, with a tag. `Bluesky` works as a channel name when you have only one Bluesky channel.
2. **A channel with its own settings.** The JSON sends the Twitch message as a purple announcement. See [Twitch and Kick chat announcements](/guides/twitch-and-kick-chat-announcements).
3. **Two channels in one row**, separated by `|`. The settings in a row apply to every channel in it, so a channel that needs its own settings gets its own row, as Twitch does above.
4. **A post with a line break and an image.** The image is downloaded into your [media library](/docs/media).
5. **A WordPress post**, which needs a title and a post type. `posts` is the usual WordPress post type, and `pages` publishes a page. See [how to schedule WordPress posts](/guides/schedule-wordpress-posts).

Two details about the format:

- **Quotes.** A cell that contains commas, quotes or line breaks is wrapped in double quotes, and a double quote inside it is written twice. That is why the JSON looks like `""title""`. Spreadsheet apps do this for you when they save a CSV, so type the JSON normally in the cell.
- **Plain text.** The `text` cell is plain text. Each line becomes a paragraph, and HTML tags are shown as typed, not formatted. That applies to WordPress and article channels too.

## Step 4: get dates and timezones right

- Write dates as `YYYY-MM-DD HH:mm`, for example `2026-11-03 09:30`. Seconds and `am`/`pm` are also accepted.
- A date with an offset, such as `2026-11-03T09:30:00+01:00` or ending in `Z`, uses that offset and ignores the `timezone` column.
- A date that does not exist, such as `2026-02-31`, is rejected rather than moved to the next month.

If you plan posts for audiences in several regions, the `timezone` column lets each row use its own. Leave it empty to use the timezone in your profile settings.

## Step 5: find the settings a channel needs

Some networks need extra fields. Article networks ask for a title: at least 2 characters on DEV.to, Medium and WordPress, and at least 6 on Hashnode. Medium also requires a subtitle, WordPress a post type, Hashnode a publication and at least one tag, and YouTube a title and visibility. A Slack row needs the Slack channel to post to, given by its ID, like `{"channel": "C0123456789"}`. Each [channel guide](/docs/channels) lists the fields. For the exact JSON names, the API's [`GET /integration-settings/:id`](/docs/api/channels) returns the settings schema for a channel.

Each row goes through the same checks as a post made in the composer, including length limits and required settings, so a missing field shows up in the preview rather than at publishing time.

## Step 6: upload and check the preview

1. Save the file as CSV. In most apps that is **File > Download** (or **Save as**) **> CSV**.
2. In the import window, choose **Choose a CSV file or drop it here** and pick your file.
3. PostDelegate checks every row and shows a preview, such as "18 of 20 posts are ready".
4. Use **Only show rows with problems** to see the rows marked **Needs a fix**. Each one says what is wrong.
5. Choose **Schedule 20 posts**. The number matches the rows that are ready, and rows that need a fix are skipped.

Files saved with commas, semicolons or tabs between columns all work.

## Step 7: fix the skipped rows

Common reasons a row needs a fix:

- **A date in the past,** or one that does not exist.
- **A channel name that does not match.** If two channels share a name, the preview lists their IDs, and you can use the ID instead.
- **A channel that is turned off or not fully connected.** A channel that only needs reconnecting shows a warning instead, because the post can still be scheduled. Reconnect it before the post goes out.
- **Invalid JSON** in `settings`, or a required setting missing.
- **Text that is too long** for one of the channels in the row.

A tag that does not exist is ignored with a warning, and the post is scheduled without it. Create campaigns, pillars and tags first. See [campaigns and ideas](/docs/campaigns).

The same file is only imported once. To add the skipped rows, fix them and import a new file with only those rows, so nothing is scheduled twice.

## Limits

- Up to 200 posts per file, and up to 1 MB. Split larger plans into several files.
- Imported posts count like any other post. Paid plans have no practical monthly post limit.

## Imports and approvals

Imported posts follow the same approval rules as posts saved in the composer. If your workspace requires approval and you can't approve, your imported posts are sent for review instead of being scheduled, and an approver sees them in **Approvals**. See the [client approval workflow](/guides/client-approval-workflow).

## Let an assistant build the file

An AI assistant is good at turning a content plan into rows. Ask Claude or ChatGPT for a CSV with exactly these columns, check it in your spreadsheet, then import it. If the assistant is connected to PostDelegate over MCP, it can also create the posts directly as drafts. Either way, review before anything is scheduled. See [how to let an AI agent post safely](/guides/ai-social-media-agent-guardrails). AI is bring-your-own, and PostDelegate never charges for it.

## Next steps

The [bulk import docs](/docs/bulk-import) are the reference for every column and rule, and [creating and scheduling posts](/docs/posts) covers what happens after import. If many of your rows go to Bluesky, the [Bluesky scheduler page](/bluesky-scheduler) shows what that channel takes.

Ready? [Start your 7-day free trial](https://app.postdelegate.com/auth). No credit card is required.
