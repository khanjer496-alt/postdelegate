---
layout: ../../../layouts/DocsLayout.astro
title: Studio API
description: List the Studio templates with the JSON schema of their inputs, render a vertical video from your media library and check the render.
---

[Studio](/docs/studio) turns videos from your media library into vertical 1080×1920 videos. The API renders the same templates as the app, with the same fair use limits. A render only saves a new video to your media library. It never creates, schedules or publishes a post: to post the video, pass its `id` and `path` to [`POST /posts`](/docs/api/posts#post-posts) like any other upload.

All paths are relative to `https://app.postdelegate.com/api/public/v1`. Authentication is the same as for every other endpoint: see [REST API overview](/docs/api).

### `GET /studio/templates`

Lists the templates. Each one has a plain `description` and a `schema`: the JSON schema of the `spec` a render takes. New templates appear here by themselves, so read the schema instead of hard-coding it.

```bash
curl https://app.postdelegate.com/api/public/v1/studio/templates \
  -H "Authorization: YOUR_API_KEY"
```

```json
[
  {
    "identifier": "hook-over-clip",
    "title": "Hook over clip",
    "description": "A clip filling the vertical frame with a hook line popping in over it.",
    "captions": false,
    "schema": {
      "type": "object",
      "required": ["input", "trim", "hook"],
      "properties": {
        "input": { "type": "object", "required": ["mediaId"], "properties": { "mediaId": { "type": "string", "format": "uuid" } } },
        "trim": { "type": "object", "required": ["start", "end"], "properties": { "start": { "type": "number" }, "end": { "type": "number" } } },
        "hook": { "type": "object", "required": ["text"], "properties": { "text": { "type": "string", "maxLength": 120 } } }
      }
    }
  }
]
```

The schema above is shortened. Times are seconds on the source video. Today there are seven templates:

| `identifier` | What it makes | Media it reads |
| --- | --- | --- |
| `hook-over-clip` | A trimmed clip with a hook line popping in | 1 video |
| `talking-head-captions` | A trimmed clip with word-by-word captions from a typed script or your own word timings | 1 video |
| `image-slideshow` | 2 to 10 pictures with a line of text each and transitions | pictures |
| `before-after` | Two pictures or videos stacked or wiping, with labels | 2 pictures or videos |
| `top-n-list` | A title over 3 to 7 numbered pictures or clips | pictures or videos |
| `quote-card` | A quote appearing word by word over a colour, picture or video | optional background |
| `ai-ugc` | A spoken script over your footage with word-by-word captions | 1 or more videos |


### `POST /studio/renders`

Makes a Studio project from a template and a spec and starts rendering it.

| Field | Notes |
| --- | --- |
| `template` | Required. An `identifier` from `GET /studio/templates`. |
| `spec` | Required. An object that follows the template's `schema`. |
| `name` | Optional name of the project in Studio, up to 100 characters. Defaults to the template's title. |

- **Media are ids only.** Every `mediaId` must be a media in your own media library, from [`GET /media`](/docs/api/uploads#get-media) or an upload. URLs are not accepted, and a `path` you send is replaced with the stored one. An upload with `adjust` must be `ready` first.
- **Captions.** For a template with `"captions": true`, send what is said in `captions.script` and leave `captions.words` out. Studio spreads the words over the clip, giving longer words more time. You can also send `captions.words` with your own timings.
- **AI UGC without a key.** `ai-ugc` takes your own script (`script.hook`, `script.lines`, `script.cta`) and, unless you send `"voiceover": true`, renders it as captions over your footage for `seconds`, with no AI key. An AI voice (`voiceover: true`) runs on your workspace's own OpenAI key and answers `400` without one. AI stills (`stills`) only come with the voice: `stills` without `voiceover: true` answers `400`. A `null` counts as left out.
- **Music.** `music.assetId` must be a music uploaded in Studio in the app that no other project uses. A music already used by another project answers `400` ("That music belongs to another Studio project; upload it again in Studio"). The API cannot upload or list music yet.
- **Paths.** Any `path` in the spec is replaced with the stored path of its media or music, or dropped.
- A video is at most 90 seconds long after speed changes, and each template's own rules (like a clip's end after its start) are checked before anything is made.

```bash
curl -X POST https://app.postdelegate.com/api/public/v1/studio/renders \
  -H "Authorization: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "template": "hook-over-clip",
    "name": "Launch teaser",
    "spec": {
      "input": { "mediaId": "MEDIA_ID" },
      "trim": { "start": 4, "end": 19 },
      "hook": { "text": "We shipped exports", "position": "top" }
    }
  }'
```

```json
{ "id": "RENDER_ID", "projectId": "PROJECT_ID" }
```

The project also appears in **Studio** in the app, where it can be edited and rendered again. Projects made through the API are hidden from the Studio list until you turn on **Show projects made by assistants and the API**, so they never crowd out your own.

`POST /studio/renders` is limited to 30 requests per workspace per hour, counting requests that are refused.

### `GET /studio/renders/:id`

Returns a render. Poll it every few seconds until `status` is `completed`, `failed` or `cancelled`.

```json
{
  "id": "RENDER_ID",
  "projectId": "PROJECT_ID",
  "status": "completed",
  "progress": 100,
  "seconds": 15,
  "error": null,
  "mediaId": "MEDIA_ID_OF_THE_VIDEO",
  "path": "https://media.postdelegate.com/....mp4",
  "thumbnail": "https://media.postdelegate.com/....jpg",
  "createdAt": "2026-11-01T10:00:00.000Z",
  "updatedAt": "2026-11-01T10:00:41.000Z"
}
```

`status` goes from `queued` to `rendering` and `uploading`, then ends as `completed`, `failed` or `cancelled`. On `completed`, `mediaId` and `path` are the new video in your media library. On `failed`, `error` says why, and the render is not counted.

### `POST /studio/renders/:id/cancel`

Stops a render that is still waiting or rendering and returns it. A cancelled render still counts toward the daily and trial limits. A render that already ended is returned as it is.

## Limits and errors

Studio is included in every paid plan with fair use: one render at a time per workspace with up to 3 more waiting, 30 videos a day, 90 seconds per video, and 10 videos in total during the free trial.

| Status | When |
| --- | --- |
| `400` | Unknown template, a spec that does not follow the schema (the `message` array says what to fix), a media that is not in your media library, still processing or of the wrong kind (a picture where a video is needed), a music that is not yours or belongs to another project, an AI voice without an AI key, AI stills without the AI voice, or a video longer than 90 seconds |
| `404` | `Render not found`, including renders of another workspace |
| `406` | `Studio needs an active plan`, or the trial's 10 videos are used |
| `429` | More than 30 `POST /studio/renders` requests this hour, 3 videos are already waiting, the 30 videos a day are reached, another render is being started, or `Studio is busy right now` |
| `503` | `Studio is not available` |

Every id is scoped to the workspace of the API key: another workspace's media, projects and renders are never found.
