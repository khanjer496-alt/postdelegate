---
layout: ../../layouts/DocsLayout.astro
title: Plans and billing
description: What each PostDelegate plan includes, how the 7-day trial works and how to cancel.
---

## Plans

| | Starter | Team | Pro | Ultimate |
| --- | --- | --- | --- | --- |
| Monthly price | $19 | $29 | $39 | $79 |
| Yearly price | $180 | $276 | $372 | $756 |
| Channels | 5 | 10 | 30 | 100 |
| Posts per month | No practical limit | No practical limit | No practical limit | No practical limit |
| Team members | No | Yes | Yes | Yes |
| Public API and MCP | Yes | Yes | Yes | Yes |
| Webhooks | 2 | 10 | 30 | 10,000 |

All prices are in US dollars. Yearly prices are per year.

AI features are currently off on every plan. PostDelegate does not provide its own AI. If you want an AI assistant to work with your calendar, bring your own through [MCP](/docs/mcp).

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
