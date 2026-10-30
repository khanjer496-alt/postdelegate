---
layout: ../../../layouts/DocsLayout.astro
title: Uploads and media API
description: Upload an image or video, fetch one from a public URL, list your media library and check whether an adjusted file is ready.
---

Media in a post must already be in your media library. Upload first, then pass the returned `id` and `path` in a post's `value[].image`. See [Media library](/docs/media) for supported formats and size limits: images up to 10 MB, MP4 video up to 1 GB.

All paths are relative to `https://app.postdelegate.com/api/public/v1`.

### `POST /upload`

Uploads a file from your machine as `multipart/form-data`.

| Field | Notes |
| --- | --- |
| `file` | The file, required. |
| `adjust` | Optional, send the text `true` to resize and re-encode for the networks after upload. |

```bash
curl -X POST https://app.postdelegate.com/api/public/v1/upload \
  -H "Authorization: YOUR_API_KEY" \
  -F "file=@./launch.png"
```

**Response**

```json
{
  "id": "cm3xa1b2c0002efgh",
  "name": "7f3c2a91.png",
  "originalName": "launch.png",
  "path": "https://media.postdelegate.com/7f3c2a91.png",
  "thumbnail": null,
  "alt": null,
  "status": "ready"
}
```

With `adjust=true` on a file that can be adjusted, `status` is `processing` until the adjusted file replaces the original at the same `path`. A request without a file returns `400` with `{ "msg": "No file provided" }`.

### `POST /upload-from-url`

Fetches a public image or video and adds it to your library.

```json
{ "url": "https://example.com/launch.png", "adjust": false }
```

| Field | Notes |
| --- | --- |
| `url` | Required. A public HTTPS URL that ends in `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` or `.mp4`. Addresses inside private networks are refused. |
| `adjust` | Optional boolean, same meaning as above. |

The response has the same shape as `POST /upload`. A URL that cannot be fetched returns `400` with `{ "msg": "Failed to fetch URL" }`.

### `GET /media`

Lists your library, newest first, 18 per page. Media that is still being adjusted is left out.

| Parameter | Notes |
| --- | --- |
| `page` | Optional, starts at 1. |
| `search` | Optional. Matches the original file name, ignoring case. |

```json
{
  "pages": 3,
  "results": [
    {
      "id": "cm3xa1b2c0002efgh",
      "name": "7f3c2a91.png",
      "originalName": "launch.png",
      "path": "https://media.postdelegate.com/7f3c2a91.png",
      "createdAt": "2026-10-30T09:12:44.000Z"
    }
  ]
}
```

### `GET /media/:id/status`

Check an uploaded file, normally after uploading with `adjust`.

```json
{ "id": "cm3xa1b2c0002efgh", "path": "https://media.postdelegate.com/7f3c2a91.png", "status": "ready" }
```

`status` is `processing` or `ready`. While it is `processing`, wait about ten seconds and ask again, and do not publish with that path yet: a post that goes out mid-adjustment uses the original file. A `ready` result with a `warning` means the adjustment failed and the original is kept and used.

## Using the file in a post

```json
"value": [
  {
    "content": "<p>New release.</p>",
    "image": [{ "id": "cm3xa1b2c0002efgh", "path": "https://media.postdelegate.com/7f3c2a91.png", "alt": "The release banner" }]
  }
]
```
