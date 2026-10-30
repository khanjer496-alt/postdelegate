---
layout: ../../layouts/DocsLayout.astro
title: Plans and billing
description: What each PostDelegate plan includes, how the 7-day trial works and how to cancel. Billing may not be switched on for your account yet.
---

<div class="callout warn">

**Billing may not be enabled for your account yet.** This page describes the plans as they are configured in PostDelegate. It is not a promise that checkout is open today. If you cannot see a **Billing** page in the app, or your account has no plan to choose, that is expected during early access. Questions go to [support@postdelegate.com](mailto:support@postdelegate.com).

</div>

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

When a trial is offered for your account:

- It lasts 7 days.
- A card is required to start it.
- To check the card, PostDelegate places a $1 authorization and voids it straight away. The $1 is not collected.
- The first payment is charged when the trial ends, unless you cancel first.

The Billing page shows the date your trial ends and your first payment is charged.

## Change or cancel

Open **Billing** from the main menu to change your plan, update your payment method or see invoices. Only workspace admins can change or cancel a plan.

To cancel, choose **Cancel Subscription** on the Billing page. Cancellation takes effect at the end of the period you have already paid for, and the page shows the date. If you change your mind before that date you can reactivate from the same page.

## Billing and the API

When billing is enabled on PostDelegate, API keys and MCP connections only work for a workspace with an active subscription. Requests without one return `401` with `No subscription found`. See the [API overview](/docs/api#errors).
