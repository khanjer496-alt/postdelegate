---
layout: ../../layouts/DocsLayout.astro
title: Plans and billing
description: "PostDelegate plans from $19 to $79 a month: channels, team members and API access on each plan, extra channels, the 7-day trial with no card, and how to cancel."
---

## Plans

| | Starter | Team | Pro | Ultimate |
| --- | --- | --- | --- | --- |
| Monthly price | $19 | $29 | $39 | $79 |
| Yearly price | $180 | $276 | $372 | $756 |
| Channels | 5 | 10 | 30 | 100, then $1/month per extra channel, up to 1,000 |
| Posts per month | Unlimited | Unlimited | Unlimited | Unlimited |
| Team members | No | Yes | Yes | Yes |
| Public API and MCP | Yes | Yes | Yes | Yes |
| Webhooks | 2 | 10 | 30 | 10,000 |

All prices are in US dollars. Yearly prices are per year.

PostDelegate never charges for AI. AI writing, the Agent and AI images run on your workspace's own OpenAI API key, added by an admin in **Settings → AI**, and OpenAI bills you directly for that use. AI video is not available. You can also bring your own assistant, such as ChatGPT or Claude, through [MCP](/docs/mcp).

## Extra channels

Ultimate includes 100 channels. If you need more, each extra channel above 100 costs $1 a month, or $9.60 a year on yearly billing (the same 20% yearly saving as the plans).

- A workspace admin sets the number of extra channels under **Extra channels** on the Billing page, up to 900 extra channels (1,000 channels in total).
- Adding channels charges a prorated amount today for the rest of the billing period. Removing them credits the unused time to your next invoice.
- You cannot lower your extra channels below the channels you already have connected. Disconnect or disable channels first.
- Extra channels need a paid plan. During the free trial, finish the trial on the Billing page to add them right away.
- Extra channels are only available on Ultimate. If you move to another plan they are removed and credited, and channels above the new plan's limit are disabled (never deleted) until you upgrade again.

## The 7-day trial

Every plan starts with a free trial:

- It lasts 7 days.
- No credit card is needed to start it.
- To keep your plan after the trial, choose **Add a card** on the Billing page (or in the banner at the top of the app) before the trial ends. The first payment is charged when the trial ends.
- If the trial ends without a card, your workspace is paused until you choose a plan. Your posts are kept, and your channels and team members are switched back on when you subscribe to a plan that includes them.
- Each email address gets one free trial.

We email you a reminder before the trial ends. The Billing page shows the date your trial ends.

## Change or cancel

Open **Billing** from the main menu to change your plan, update your payment method or see invoices. Only workspace admins can change or cancel a plan.

To cancel, choose **Cancel Subscription** on the Billing page. Cancellation takes effect at the end of the period you have already paid for, and the page shows the date. If you change your mind before that date you can reactivate from the same page.

## Billing and the API

API keys and MCP connections only work for a workspace with an active subscription. Requests without one return `401` with `No subscription found`. See the [API overview](/docs/api#errors).
