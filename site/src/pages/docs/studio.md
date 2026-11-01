---
layout: ../../layouts/DocsLayout.astro
title: Studio
description: Turn a video from your media library into a vertical 1080×1920 video with a hook or word-by-word captions, rendered by PostDelegate and saved back to your library.
---

Studio makes short vertical videos from the videos you already have. Pick a video from your [media library](/docs/media), trim it, choose what stays in the vertical frame and add text. PostDelegate renders the video on its own servers and saves it to your media library, so it is ready for the composer. Open it from **Studio** in the main menu.

## Templates

| Template | What you get |
| --- | --- |
| Hook over clip | Your clip filling the vertical frame, with a hook line that pops in at the top, middle or bottom. Show it for the whole video or the first 3 or 5 seconds. |
| Talking head + captions | Your clip with burned-in captions that light up word by word. Fill the frame, or keep the whole picture over a blurred copy of itself. |

Every video comes out as an MP4 of 1080×1920 at 30 fps, with H.264 video and AAC sound, which every network accepts.

## Editing a clip

- **Trim**: drag the two handles on the strip of frames. A video can be up to 90 seconds long after speed changes.
- **Crop**: drag the vertical frame over the picture to choose what stays in view.
- **Speed**: 0.5×, 1×, 1.5× or 2×. At 2× you can keep up to 180 seconds of the original.
- **Sound**: keep the sound of the clip or mute it. A muted video still has a silent sound track, because some networks refuse videos without one.
- **Text**: four styles (Bold, Impact, Clean, Classic). The preview uses the same fonts as the render, so what you see is what you get.

Your changes are saved as you go.

## Captions

There are two ways to make captions:

- **With your AI**: if your workspace has its own OpenAI key in **Settings → AI**, Studio sends the sound of the clip to OpenAI's Whisper and gets each word with its timing. Usage is billed to you by OpenAI. See [AI in PostDelegate](/docs/ai).
- **With a typed script**: no key needed. Type or paste what is said and Studio spreads the words over the clip, giving longer words more time.

Either way you can fix any word before you render, and choose the caption style, position, words per line and highlight colour.

## Rendering

Click **Render video**. The video waits for its turn, renders and is saved to your media library, with a progress bar while it works. You can cancel at any time. When it is ready, click **Open in composer** to post or schedule it like any other video.

<div class="callout">

Studio is included in every paid plan with fair use:

- one video renders at a time per workspace, and up to 3 more can wait behind it
- up to 30 videos a day per workspace
- up to 90 seconds per video
- the free trial includes 10 videos in total

A render that fails on our side is never counted.

</div>

## What Studio reads

Studio only reads videos from your own media library. Inputs up to 500 MB, 10 minutes long and 4K are supported. The fonts are open source (SIL Open Font License) and bundled with PostDelegate.
