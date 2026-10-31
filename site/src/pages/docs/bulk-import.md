---
layout: ../../layouts/DocsLayout.astro
title: Bulk import from CSV
description: Schedule many posts at once from a spreadsheet. The columns the importer reads, date and channel formats, limits, and how imports follow approval rules.
---

Schedule many posts at once from a spreadsheet. Save it as a CSV file with one post per row, upload it, check the preview, and PostDelegate schedules the rows that are ready.

## Import a file

1. On the calendar page, choose the import button next to **Create Post**. Its tooltip reads "Import posts from a CSV file". It appears once you have connected a channel.
2. Choose **Download template** to get a ready-to-fill file with your own channel names, or check the names under **Your channel names**.
3. Fill in the file in your spreadsheet app and save it as CSV. In most apps that is **File > Download** (or **Save as**) **> CSV**.
4. Choose **Choose a CSV file or drop it here** and pick your file. PostDelegate checks every row and shows a preview, such as "18 of 20 posts are ready".
5. Fix any rows marked **Needs a fix**, or leave them out. Use **Only show rows with problems** to see just those.
6. Choose **Schedule 20 posts** (the number matches the rows that are ready). Rows that need a fix are skipped.

Each row goes through the same checks as a post made in the composer, including each network's length limit and required settings.

## Columns

The first row of the file names the columns. Column names are not case sensitive.

| Column | Required | What to put in it |
| --- | --- | --- |
| `date` | Yes | When to post, like `2026-11-03 09:30` (year-month-day, 24-hour time). It must be in the future. |
| `timezone` | No | A timezone name, like `Europe/London` or `America/New_York`. Empty means your timezone. |
| `channels` | Yes | One or more channel names, separated by `\|`. |
| `text` | Yes | The post text. Line breaks are kept. |
| `image_urls` | No | Public image links starting with `https://`, separated by `\|`. PostDelegate downloads them into your [media library](/docs/media). |
| `settings` | No | Channel settings as JSON, like `{"title": "My video"}`. See each [channel guide](/docs/channels) for the fields a network asks for. |
| `tags` | No | Names of existing tags, campaigns or pillars, separated by `\|`. |

The `date`, `channels` and `text` columns must exist. A cell in the `text` column can be empty when the row has an image link, but a row with neither text nor an image is rejected as empty.

The importer also accepts some common alternative column names. For example `content`, `message` or `caption` work for `text`, and `channel` or `accounts` work for `channels`.

### Dates and timezones

- Write dates as `YYYY-MM-DD HH:mm`, for example `2026-11-03 09:30`. Seconds and `am`/`pm` are also accepted.
- A full date with an offset, such as `2026-11-03T09:30:00+01:00` or ending in `Z`, uses that offset and ignores the `timezone` column.
- A date that does not exist, such as `2026-02-31`, is rejected rather than moved to the next month.

### Channels

A channel cell can hold a channel's name as it appears in PostDelegate, its channel ID, or the network name when you have only one channel on that network. If two channels share a name, the preview asks you to use the channel ID instead and lists the IDs.

A channel that is turned off or not fully connected makes the row need a fix. A channel that needs to be reconnected only shows a warning, because the post can still be scheduled. Reconnect it before the post goes out.

### Tags

Tags must already exist in your workspace. A name that does not match is ignored with a warning, and the post is scheduled without it. Create campaigns, pillars and tags first. See [Campaigns and ideas](/docs/campaigns).

### Separators

Files saved with a comma, semicolon or tab between columns all work. Inside a cell, separate several channels, images or tags with `|`. In a comma-separated file a `;` also works. Commas never split a cell, so channel names can contain them.

## Limits

- Up to 200 posts per file. Split larger files.
- Up to 1 MB per file.
- Imported posts count like any other post. Paid plans have no practical monthly post limit, see [Plans and billing](/docs/billing).

## Importing the same file twice

The same file is only imported once. Uploading it again returns the first result, "This file was already imported, nothing new was added." To add rows that were skipped, fix them and import a file with only those rows, so nothing is scheduled twice.

## Imports and approvals

Imported posts follow the same [approval rules](/docs/approvals) as posts saved in the composer. If your workspace requires approval and you can't approve, your imported posts are sent for review instead of being scheduled.
