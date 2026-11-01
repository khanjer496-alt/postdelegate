---
layout: ../../layouts/DocsLayout.astro
title: Media library
description: Where your images and videos live in PostDelegate, accepted formats and sizes, how files are adjusted for each network, alt text and thumbnails, and reuse.
---

The media library keeps everything you have uploaded in one place, so you can reuse a file across posts instead of uploading it again. Open it from **Media** in the main menu, or from the media picker in the composer.

## Supported files

| Type | Accepted formats | Size limit |
| --- | --- | --- |
| Images | JPEG, PNG, GIF, WebP, AVIF, BMP, TIFF | 10 MB |
| Video | MP4 | 1 GB |

These limits apply to uploads from the app, uploads from a URL and uploads through the [API](/docs/api/uploads). Other file types, including audio, are rejected.

GIF, AVIF, BMP and TIFF files are never compressed before upload, so the file itself must be under 10 MB. A larger GIF is refused when you add it.

<div class="callout">

Posts only accept files that end in `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` or `.mp4`. AVIF, BMP and TIFF files can be stored in the library, but they cannot be attached to a post.

</div>

## Adjusting media to each network

Networks reject media that is too large, too small or in the wrong encoding. When you upload through the API or an AI assistant you can ask PostDelegate to adjust the file after upload:

- Videos are scaled so the short side is 1080 px (long side at most 1920 px) and re-encoded as H.264 MP4 with AAC audio at up to 60 fps.
- Images are only scaled down (short side at most 1080 px, long side at most 1920 px) and keep their format.
- GIF, AVIF, BMP and TIFF files are stored as uploaded.

While a file is being adjusted its status is `processing`. Wait until it is `ready` before publishing: a post that publishes mid-adjustment uses the original, unadjusted file. If the adjustment fails for a format the networks accept as is, the original is kept and used.

## Alt text and thumbnails

Click a media item in the composer to set its alt text. For video you can also set a thumbnail. Thumbnails are sent to every channel that supports them. YouTube may ignore a thumbnail on videos it treats as Shorts, and custom thumbnails need a phone-verified YouTube channel. If YouTube rejects the thumbnail the video is still published.

## Finding files again

The library lists newest files first, 18 per page, and you can search by the original file name. The same search is available from the [API](/docs/api/uploads#get-media) and from the [MCP tools](/docs/mcp/tools).

## Uploading from an AI assistant

An assistant connected over [MCP](/docs/mcp) can add media from a public URL. For a file on your own device, assistants that support interactive MCP apps show an upload widget. Other assistants cannot see local files, so use the app or the [upload API](/docs/api/uploads).
