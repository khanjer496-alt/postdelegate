---
layout: ../../layouts/DocsLayout.astro
title: Studio
description: Make vertical 1080×1920 videos from your videos and pictures, with hooks, captions, slideshows, before/after, top lists, quote cards and your own music.
---

Studio makes short vertical videos from the videos and pictures you already have. Pick them from your [media library](/docs/media), trim, choose what stays in the vertical frame, add text and, if you like, your own music. PostDelegate renders the video on its own servers and saves it to your media library, so it is ready for the composer. Open it from **Studio** in the main menu.

## Templates

| Template | What you get |
| --- | --- |
| Hook over clip | Your clip filling the vertical frame, with a hook line that pops in at the top, middle or bottom. Show it for the whole video or the first 3 or 5 seconds. |
| Talking head + captions | Your clip with burned-in captions that light up word by word. Fill the frame, or keep the whole picture over a blurred copy of itself. |
| Image slideshow | 2 to 10 pictures, each on screen for 1.5 to 5 seconds with its own line of text. Each picture slowly pans, with a fade, slide, wipe or circle transition between them (or a straight cut). |
| Before/after | Two pictures or videos with a label each, one above the other or the second wiping over the first half way through. 2 to 30 seconds. |
| Top-N list | A title over 3 to 7 pictures or clips shown one after the other, each numbered with its label. Count down to #1 or up from #1. A clip plays the part you pick, a picture stays 1 to 10 seconds. |
| Quote card | A quote that appears word by word, with its author, over a colour, a picture or a video. 5 to 15 seconds. |

Every video comes out as an MP4 of 1080×1920 at 30 fps, with H.264 video and AAC sound, which every network accepts.

## Editing a clip

- **Trim**: drag the two handles on the strip of frames. A video can be up to 90 seconds long after speed changes.
- **Crop**: drag the vertical frame over the picture to choose what stays in view.
- **Speed**: 0.5×, 1×, 1.5× or 2×. At 2× you can keep up to 180 seconds of the original.
- **Sound**: keep the sound of the clip or mute it. A muted video still has a silent sound track, because some networks refuse videos without one.
- **Text**: four styles (Bold, Impact, Clean, Classic). The preview uses the same fonts as the render, so what you see is what you get.

Your changes are saved as you go.

Pictures can be PNG, JPG or WebP, up to 20 MB and 25 megapixels (6000 pixels a side). Other picture types in your media library (GIF, AVIF, BMP, TIFF) are left out when you pick them.

## Music

Every template except **Talking head + captions** can have music. Click **Add your music** and upload an MP3, M4A or WAV file of up to 30 MB. Use music you have the rights to: PostDelegate bundles no tracks.

- The music loops if it is shorter than the video and fades out over the last 2 seconds. You can choose where in the track it starts.
- Over a clip with sound, the music sits under it at the level you pick and is lowered further whenever the clip speaks (ducking).
- Every video is brought to the same loudness the networks use (-14 LUFS), with or without music.

Music files are kept for Studio only and never appear in your media library or the composer. A file no project uses any more is removed after 7 days, and it is removed with its project when you delete the project.

## Captions

There are two ways to make captions:

- **With your AI**: if your workspace has its own OpenAI key in **Settings → AI**, Studio sends the sound of the clip to OpenAI's Whisper and gets each word with its timing. Usage is billed to you by OpenAI. See [AI in PostDelegate](/docs/ai).
- **With a typed script**: no key needed. Type or paste what is said and Studio spreads the words over the clip, giving longer words more time.

Either way you can fix any word before you render, and choose the caption style, position, words per line and highlight colour.

## Rendering

Click **Render video**. The video waits for its turn, renders and is saved to your media library, with a progress bar while it works. You can cancel at any time. When it is ready, click **Open in composer** to post or schedule it like any other video.

## Scheduling many videos at once

Under the templates on the Studio page, **Finished videos** lists the videos your projects rendered. Select the ones you want (or **Select all**) and click **Schedule all**:

1. Pick the channels. Fill in any setting a network needs, like a YouTube title.
2. Write the text of the posts.
3. Choose scheduled posts or drafts and confirm.

Each video becomes one post on every channel you picked, in the next free [time slots](/docs/channels) of each channel. Every post goes through the same checks as one made in the composer, counts toward your plan's monthly posts, and follows your [approval](/docs/approvals) rules. Up to 50 videos and 20 channels at a time. Sending the same selection twice on the same day adds nothing twice.

<div class="callout">

Studio is included in every paid plan with fair use:

- one video renders at a time per workspace, and up to 3 more can wait behind it
- up to 30 videos a day per workspace
- up to 90 seconds per video
- the free trial includes 10 videos in total

A render that fails on our side is never counted.

</div>

## What Studio reads

Studio only reads videos and pictures from your own media library and the music you upload. Videos up to 500 MB, 10 minutes long and 4K are supported. Records of renders are kept for 90 days; the videos stay in your media library until you delete them. The fonts are open source (SIL Open Font License) and bundled with PostDelegate.
