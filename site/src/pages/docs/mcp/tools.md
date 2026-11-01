---
layout: ../../../layouts/DocsLayout.astro
title: MCP tools
description: "Every tool the PostDelegate MCP server offers for channels, posts, media and AI media: what each does, whether it changes anything and what an assistant sees."
---

Your assistant discovers these tools by itself when it connects. You do not call them directly. This page explains what each one does so you know what an assistant can and cannot do. Tool names are shown exactly as the server reports them. To teach an assistant how to use them well, give it one of the [agent files](/docs/mcp/agent-files).

## Channels and settings

| Tool | What it does | Changes data? |
| --- | --- | --- |
| `integrationList` | Lists your connected channels. Pass a group id to list only one customer's channels. | No |
| `groupList` | Lists your customers (groups). | No |
| `integrationSchema` | Returns a channel's post rules, its length limit, the settings fields it needs, and the helper lookups available. Assistants call it before scheduling. | No |
| `triggerTool` | Runs a helper lookup named by `integrationSchema`, for example fetching WordPress categories or Listmonk lists. May refresh the channel's saved login. | Can refresh credentials |

## Posts

| Tool | What it does | Changes data? |
| --- | --- | --- |
| `integrationSchedulePostTool` | Creates a draft, a scheduled post or an immediate post on one or more channels. It runs the same validation as the app and the API, and returns a post id and a preview link for each post, or a list of errors to fix. | Yes |
| `postsListTool` | Lists your posts between two dates, with their state, errors, content, channel and settings. | No |
| `postSettingsTool` | Updates the network settings of a scheduled post or draft that has not published. Content and date stay as they are. | Yes |
| `deletePostTool` | Deletes a post and its comments on that channel. A deleted scheduled post does not publish. Deleting a published post only removes it from PostDelegate. It cannot be undone. | Yes |

## Media

| Tool | What it does | Changes data? |
| --- | --- | --- |
| `uploadFromUrlTool` | Adds an image or video from a public URL to your media library. An optional `adjust` setting resizes and re-encodes it for the networks. | Yes |
| `mediaListTool` | Lists your media library, newest first, 18 per page, with an optional file-name search. Used to reuse a file instead of uploading it again. | No |
| `mediaStatusTool` | Checks whether an adjusted upload is `ready` or still `processing`. | No |
| `uploadWidgetTool` | Shows an upload widget so you can add a file from your own device. Only shown by assistants that support interactive MCP apps. | Yes |
| `uploadWidgetStatusTool` | Lists the files uploaded through the widget. | No |
| `uploadWidgetTicketTool` | Used by the upload widget itself to get a short-lived upload ticket. Assistants do not need to call it. | No |

Local files cannot be fetched by an assistant. Upload them through the app, the widget, or the [upload API](/docs/api/uploads).

## Studio

[Studio](/docs/studio) renders vertical 1080×1920 videos from the videos in your media library, with the same templates and fair use limits as the app.

| Tool | What it does | Changes data? |
| --- | --- | --- |
| `studioTemplatesTool` | Lists the Studio templates, each with a plain description and a JSON schema of its inputs. New templates appear by themselves. | No |
| `studioRenderTool` | Renders a video from a template, a spec and the ids of media in your media library. It never accepts links. It only saves a new video to your media library and never creates, schedules or publishes a post. Returns a `renderId`, or the reason it could not start, such as Studio being busy, the daily limit or a missing plan. | Yes |
| `studioRenderStatusTool` | Waits up to 25 seconds for a render to finish, then returns its status. When it is done, it returns the `mediaId` and `path` of the video, ready to attach to a post with `integrationSchedulePostTool`. | No |
| `studioCancelTool` | Stops a render that is still waiting or rendering. A cancelled render still counts toward the daily and trial limits. | Yes |

All seven templates work from an assistant: Hook over clip, Talking head + captions, Image slideshow, Before/after, Top-N list, Quote card and AI UGC. For AI UGC the assistant writes the script itself, and by default it renders without an AI voice, so no AI key is needed. An AI voice needs your workspace's own OpenAI key, and AI stills only come with the AI voice. Music must already be uploaded in Studio and not used by another project.

To post a Studio video, the assistant still goes through `integrationSchedulePostTool`, so drafts by default and your workspace's [approvals](/docs/approvals) apply as usual.

## AI media tools

The server also defines tools for generating images and video and for turning long YouTube videos into short clips: `generateImageTool`, `generateVideoOptions`, `videoFunctionTool`, `generateVideoTool`, `videoStatusTool`, `clippingTool`, `clippingStatusTool` and `clippingWidgetTicketTool`.

PostDelegate does not provide AI generation of its own. `generateImageTool` needs your workspace's own OpenAI key, added by an admin in Settings → AI. The video tools are not available on any plan and answer with an error such as no credits available, and the clipping tools only exist when the service is set up for them. You can also use your own assistant's image and video features, then bring the result into PostDelegate with `uploadFromUrlTool`.

## What an assistant sees

- Tools only act on the workspace you approved. A different workspace needs a separate sign-in.
- Tools that change data are marked as such to clients, so assistants that support confirmation prompts will ask you first.
- Connections through the API key addresses may also list a general `ask_postdelegate` tool that passes your request to the PostDelegate agent. It needs your workspace's own OpenAI key, added by an admin in Settings → AI. Without a key it answers with an error.
- Content from your posts and videos is just data for the assistant to show you. Be wary of any assistant that treats text in a post as instructions.
