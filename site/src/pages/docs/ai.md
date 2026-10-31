---
layout: ../../layouts/DocsLayout.astro
title: AI in PostDelegate
description: Add your own OpenAI key in Settings > AI for AI writing, the Agent and AI images. PostDelegate never charges for AI. How it differs from MCP.
---

PostDelegate's AI writing, Agent and images run on your own OpenAI account. An admin adds the workspace's OpenAI API key once, and every AI feature in the app uses it. You pay OpenAI directly for what you use.

<div class="callout">

**PostDelegate never charges for AI.** There is no AI add-on and no AI credit to buy. Without a key, the AI features are simply switched off. AI video is not available.

</div>

## Add your OpenAI key

You need an OpenAI API key from your OpenAI account. A ChatGPT Plus subscription does not include API usage, so the key is billed separately by OpenAI.

1. Open **Settings > AI**. Only workspace admins see this tab.
2. Choose **Get an API key** to open your OpenAI API keys page, and create a key there.
3. Paste the key into the field and choose **Save**.

PostDelegate checks the key with OpenAI before saving it. If OpenAI refuses it, nothing is saved and you see why, for example "OpenAI rejected this key. Check it's an active API key with access to models."

Once the key is saved, the tab shows it masked, for example `OpenAI key: sk-…a9F2`. Nobody can read the full key back, including admins. The AI features turn on for the whole workspace without a reload.

### Replace or remove the key

- Choose **Replace** to paste a new key. It is checked the same way.
- Choose **Remove** to delete the key. AI features turn off for the workspace.

For safety, a key can only be saved a limited number of times per hour. If you see "Too many attempts. Try again in an hour.", wait and try again.

AI works on every plan once the workspace has a key.

## What the key powers

| Feature | Where to find it |
| --- | --- |
| **Writing help** | An assistant inside the post composer that helps you refine your posts. |
| **The Agent** | **Agent** in the main menu. Chat with it to plan and create posts for the channels you select. |
| **AI images** | In the composer, next to the media options. It opens **Generate AI Image**, where you write a prompt and pick a style. The image is added to the post. |
| **MCP tools that use AI** | `ask_postdelegate` and `generateImageTool`, for assistants connected over MCP. See [MCP tools](/docs/mcp/tools). |

Without a key, the Agent page shows **Connect your OpenAI key to start**. Admins get an **Add your OpenAI key** button. Other members see "Ask your workspace admin to add a key".

Posts the Agent creates count as AI-created posts. They follow the **AI agent guardrails** in **Settings > Approvals**, so they can wait for approval before they publish. See [Approvals](/docs/approvals#posts-from-ai-agents).

## AI in PostDelegate or your own assistant over MCP

There are two separate ways to use AI with PostDelegate. You can use either, both or neither.

| | OpenAI key in Settings > AI | Claude, ChatGPT or another assistant over MCP |
| --- | --- | --- |
| **Where you work** | Inside PostDelegate: the composer, the Agent and the media tools. | Inside your assistant, such as claude.ai, ChatGPT, Claude Code or Cursor. |
| **What it needs** | An OpenAI API key, added by an admin. | Your assistant's own account, connected to PostDelegate. No OpenAI key needed. |
| **Who bills you** | OpenAI, for API usage on your key. | Your assistant's provider, under your plan with them. |
| **What PostDelegate charges** | Nothing for AI. | Nothing for AI. MCP is included in every plan. |

With MCP, your assistant does the writing and PostDelegate is the calendar and publisher. The assistant calls PostDelegate's tools to list channels, upload media and create drafts or scheduled posts. Only the two MCP tools listed above use the workspace's OpenAI key. Set it up with the [MCP overview](/docs/mcp), or follow the guides for [Claude](/docs/mcp/claude) and [ChatGPT](/docs/mcp/chatgpt).

## Privacy

The key is stored encrypted and is only used for this workspace's AI requests. What you send to the AI features is processed by OpenAI under your OpenAI account. Removing the key deletes it from PostDelegate. See [Privacy and data deletion](/docs/privacy) for the rest of your data.
