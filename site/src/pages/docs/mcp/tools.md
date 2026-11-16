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

PostDelegate does not provide AI generation of its own. `generateImageTool` needs your workspace's own OpenAI key, added by an admin in Settings → AI. The video and clipping tools are only listed when the service is set up for them, which it is not today. You can also use your own assistant's image and video features, then bring the result into PostDelegate with `uploadFromUrlTool`.

## What an assistant sees

- Tools only act on the workspace you approved. A different workspace needs a separate sign-in.
- Tools that change data are marked as such to clients, so assistants that support confirmation prompts will ask you first.
- Connections through the API key addresses may also list a general `ask_postdelegate` tool that passes your request to the PostDelegate agent. It needs your workspace's own OpenAI key, added by an admin in Settings → AI. Without a key it answers with an error. It returns the agent's answer as `{ "text": "..." }`.
- Every tool carries a title and read-only, destructive and open-world hints, and the server card at `https://app.postdelegate.com/.well-known/mcp/server-card.json` lists the tools every connection offers.

## Changes

- **November 2026:** `ask_postdelegate` now returns only the agent's answer, as `{ "text": "..." }` in structured content. It used to return the agent's whole run (its steps, token usage and messages) serialized as text. Clients that read the answer from that text should read `text` instead.
- Content from your posts and videos is just data for the assistant to show you. Be wary of any assistant that treats text in a post as instructions.

## Results, review and recovery

| Tool | What it does | Changes data? |
| --- | --- | --- |
| `resultsToReviewedDraftsTool` | Gives an evidence-to-review workflow using the existing analytics tools. It does not fetch metrics or invent results. | No |
| `analyticsMetricsTool`, `analyticsTopPostsTool`, `bestTimeToPostTool`, `channelAnalyticsTool` | Read available metrics; access and filters depend on the credential's permitted channels. Missing or stale data stays qualified. | No provider publication |
| `postPreflightTool` | Checks the schedule input without saving, importing media, generating links or refreshing credentials. Returns per-check VALID, INVALID or UNKNOWN, input/config hashes and checkedAt. | No product/provider mutations |
| `postUpdateTool` | Edits permitted unpublished content/media/date; an approved revision may need review again. | Yes |
| `createPostForReviewTool`, `sendPostForReviewTool` | Save or submit a draft to human review. Verify the returned draft ID and IN_REVIEW receipt. A Draft-only credential cannot submit a scheduled post. | Yes; never a public post by these tools |
| `postUnscheduleTool` | Fences a new tracked MCP job and keeps its content/attempt history. Legacy or uncertain attempts stay BLOCKED/OUTCOME_UNKNOWN. | Yes |
| `postResumeTool` | Preserves confirmed receipts and attempts recovery only with terminal adapter proof that failed segments were not published. Unsupported provider reconciliation stays blocked. | Can queue an allowed recovery |

Preflight is a snapshot, not authorization or a durable publishing guarantee. UNKNOWN includes pending media, live provider readiness and short-link transformations whose maximum length is not proven. It creates no short URL and never promises an exact preview for those transformations. Save/send paths validate materialized content again; changing content, channel, media, thread or schedule can invalidate approval.

New MCP jobs use a versioned workflow and durable per-segment admission/receipt records. A started attempt without a stored receipt is uncertain even if the worker timed out or died. An accepted provider request followed by a database failure is not confirmed unpublished. No current production provider advertises the new terminal reconciliation hook: uncertain attempts on those providers stay blocked, rather than being retried. This is not universal exactly-once publication. Legacy jobs keep their existing workflow and cannot gain safe cancellation/recovery proof from an ERROR state alone.

For new per-agent credentials, `channelAnalyticsTool` returns UNKNOWN before any provider call or credential refresh. Use the cached history tools within your permitted channels. Legacy workspace keys/OAuth keep their existing live-read behavior. Partial cancellation returns the preserved published segment IDs; ALREADY_PUBLISHED means there was no unpublished remainder to cancel. A held remainder needs human approval of that current revision, without republishing its parent.
