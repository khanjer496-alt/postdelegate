---
layout: ../../layouts/DocsLayout.astro
title: Bulk import from CSV
description: "Schedule many posts at once from a spreadsheet, or up to 50 videos from your computer: the columns, date and channel formats, time slots, limits and approvals."
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

## Bulk schedule videos

Turn a folder of videos into posts in one go. Each video becomes one post on the channels you pick, spread over your posting times.

1. On the calendar page, choose the video button next to the import button. Its tooltip reads "Bulk schedule videos: one post for every video".
2. Choose **Choose videos or drop them here** and add up to 50 MP4 videos, up to 1 GB each. They upload one after another into your [media library](/docs/media), with the progress, length and size of each. Use **Remove** to leave a video out. A removed video stays in the media library.
3. Choose **Next**, then pick one or more channels. Only channels whose network can post a video are shown. A channel marked **Drafts only** needs a setting you pick in the composer, see below.
4. Fill in the settings a network asks for, such as the YouTube title and visibility. They go to every video. A required title starts as `{filename}`, which becomes the name of each video file without the extension.
5. Optionally write a caption for all the videos. `{filename}` works here too. To give one video a different text, write it in the box under that video. An empty box uses the shared caption.
6. Choose **Next**, then pick how to spread the posts and the date to start from:
   - **Next free time slots** (the default) fills each channel's [time slots](/docs/getting-started) in order, day by day, and skips any slot where that channel already has a post or that is less than 5 minutes away. Each channel uses its own slots, so one video can go out at different times on different channels. A channel without time slots uses the same default times as **Create Post**.
   - **One every few hours or days** posts the first video at the start time, at least 5 minutes from now, then one every N hours or days. Daily posts keep the same time of day when the clocks change.

   Every post must fall within the next year. A video that would land later is marked in the preview.
7. Choose **Add them as drafts** instead of **Schedule them** to save drafts you can finish later in the calendar.
8. Check the preview. It lists every video with the date and time on each channel, and marks the ones that need a fix. Fix the caption or a text setting, such as a title, right in the preview, then choose **Check again**.
9. Choose **Schedule 12 videos** (or **Add 12 drafts**). The button works once every video is ready. Nothing is created while a video still needs a fix. The posts go out at the times the preview showed. If one of those times was taken in the meantime, nothing is created and you're asked to check the preview again.

Every video goes through the same checks as a post made in the composer, including each network's length limit, media rules and required settings. Drafts only get the checks a draft gets in the composer, the rest run when you schedule them.

Some settings are picked from a list loaded from the network, like a Discord or Slack channel. They can't be set here. A channel whose network requires one is marked **Drafts only**: picking it switches the videos to **Add them as drafts**, and you finish them in the composer. Once Pinterest, Reddit and TikTok are available, a Pinterest board or a subreddit will work the same way, and TikTok videos will go in as drafts so the composer can check your TikTok account and ask for TikTok's music confirmation.

### Limits and partial results

- Up to 50 videos at a time, up to 1 GB each.
- Each channel of a video counts as one post. Five videos on two channels are ten posts.
- Paid plans have no practical monthly post limit, see [Plans and billing](/docs/billing). In the rare case that the workspace still reaches its monthly post limit part way, PostDelegate stops there and tells you how many videos were created. The rest are listed, and **Try the rest again** goes back to them once you have room.
- If one network's monthly cap on your plan is reached (for example, a network that limits posts per month), only that network's posts are skipped. The other channels still get every video, and the result lists the skipped ones.
- A large batch can take a while. If the connection drops or times out, the window says "This may still be running" and keeps checking for up to 20 minutes. It shows the result when the run is done, so nothing is created twice. A run that stopped on the server is picked up again after 15 minutes. Sending the same videos again while they run, or after they are done, never asks you to upgrade: it waits for, or shows, the first result.
- A video that fails for another reason is listed with the reason, and the others are still created.
- Sending the same videos with the same settings twice doesn't create them twice. The second time says "These videos were already scheduled, nothing new was added."

Videos follow the same [approval rules](/docs/approvals) as posts saved in the composer.
