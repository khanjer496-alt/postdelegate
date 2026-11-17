# PostDelegate MCP Workflow Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. CEO delegated implementation decisions; no further design approval is required.

**Goal:** Turn permitted analytics into reviewed drafts, validate final payloads without preflight writes, and support fenced cancellation/recovery for new MCP jobs.

**Architecture:** Extend NestJS tools and existing PostsService validation; keep legacy contracts. New MCP schedules use a versioned workflow with durable per-segment attempts and a shared database fence. Credential authorization is a separate Integrations Dev slice and wraps all tools centrally.

**Tech Stack:** NestJS, Prisma/PostgreSQL, Temporal, Mastra, Zod, Jest, pnpm.

**Spec:** [Delivery contract](2026-11-15-mcp-upgrade-design.md), including CEO lifecycle decision and Reviewer/Security refinements.

## Global Constraints

- No real social posts/customer-data writes, payments, sends, merge or deployment.
- Preserve legacy workflow definitions and activity signatures; additive version only.
- Original remote main verified 914bdcf97fb429fd815f34716f55f723e3512924. Do not overlap unrelated PRs191/192/207/217.
- New MCP credentials default Draft-only/30days, scoped reads and writes; expiry/revoke blocks subsequent calls, never implicitly cancels accepted workspace jobs. Role upgrade never releases review holds.
- Preflight has zero product/provider mutations or credential refresh. Audit/rate-limit bookkeeping is permitted. Unknown short-link bound or refresh-dependent readiness remains UNKNOWN.
- Approval binds content/channel/media/thread/schedule revision. Changed revision reacquires approval under workspace policy.
- STARTED without durable receipt is UNKNOWN, including acceptance followed by persistence failure. No uncertain/published replay, including restart and sweep. Same attempt identity/different payload rejects.
- Local heavy checks require uptime1m/5m<12, pressure1, >=15GiB and Shared/mac-resource-guard.py; use hosted CI otherwise.

## Review Focus

- Worker crashes after provider acceptance before receipt storage: never resend automatically.
- Cancel/resume/edit/approve race: shared worker fence admits at most one authorized operation.
- Sparse/stale/missing analytics: evidence-qualified experiments, never fabricated success.
- Short-link growth, HTML/mentions and unfinished media: transformed payload checks or UNKNOWN, never false ready.
- Restricted credential nesting, foreign IDs and mixed batches: authorization before inspection/effects, no legacy escalation.

### Task 1: Shared preparation and no-write preflight

**Files:** posts/posts.service.ts; chat/tools/post.preflight.tool.ts; focused specs.
**Interfaces:** consumes existing schedulePostInputSchema and validatePosts; produces PostsService.preflightPosts(orgId, posts, operation, date), postPreflightTool.
- [ ] Add failing fixtures: provider transformation/stripLinks, pending links, empty thread, final link-growth rejection, no mutation/refresh spies.
- [ ] Extract shared pure content preparation into PostsService; validate exact provider-formatted entries and expose per-check VALID/INVALID/UNKNOWN with input/config hash and checkedAt.
- [ ] Add preflight tool reusing schedule input; no schedule/create/shortlink/media-job calls; scoped authorization via central wrapper.
- [ ] Add final validation after materialized link rewrite before repository save; reject invalid publication/review payload.
- [ ] Run focused tests serially or hosted CI; commit with OpenBot trailer.

### Task 2: Durable attempts, fence and new workflow

**Files:** schema.prisma (Builder hunks only), additive migration, posts.repository.ts, posts.service.ts, new post.workflow.v1.1.4.ts, new activity methods; registry exports.
**Interfaces:** durable Post.mcpWorkflowVersion; root fence revision/generation/state; per-segment attempt status and receipt. No credential schema overlap.
- [ ] Add crash-after-acceptance, same-key/different-payload, partial-thread predecessor, concurrent cancel/resume, policy-revocation and legacy refusal fixtures.
- [ ] Persist version before starting new MCP job; preserve on approval/edit/restart/sweep. New activity admission atomically claims STARTED under current fence/revision before provider call.
- [ ] Persist response before returning to workflow; replay returns receipt only, never repeats provider call; started/partial/pending/unknown refuses retry.
- [ ] Add generic optional provider reconciliation contract; only adapter-confirmed unpublished attempts may acquire next generation; preserve all confirmed receipts.
- [ ] Unschedule transaction fences admission and keeps draft content/audit; any admitted/legacy uncertain attempt returns BLOCKED/OUTCOME_UNKNOWN. No success from best-effort Temporal termination.
- [ ] Approval revision invalidation covers every edit path; no role upgrade/old approval bypass.
- [ ] Run meaningful repository/worker/service/workflow tests, commit.

### Task 3: Evidence-to-review workflow and accurate docs

**Files:** results.to.reviewed.drafts.tool.ts; tool.list.ts; load.tools.service.ts guidance ONLY; English docs/mcp and site/src/data/agent-files/*; plugin skill.
**Interfaces:** read-only discoverable workflow uses existing analytics/tools and createPostForReviewTool/sendPostForReviewTool; outputs draft IDs and IN_REVIEW receipts.
- [ ] Test sufficient/sparse/missing analytics instructions; forbid fabricated metrics and scheduling substitution.
- [ ] Add workflow guidance with bounded recent UTC period, explicit local timezone, evidence IDs/freshness/sample caveats and channel-specific experiments.
- [ ] Register new tools, preserve optional media availability and current endpoints; document lifecycle support boundaries accurately.
- [ ] Freeze explicit role × operation × transport matrix with credential slice; reconcile exact names and legacy compatibility tests.

### Task 4: Integration and delivery

- [ ] Inspect credential branch diff/ownership and integrate only approved scoped commits; recheck main/open PR overlap.
- [ ] Push scoped draft PR with repository template and real QA steps; use GitHub MCP for PR creation.
- [ ] Run hosted full Jest/build and controlled protocol fixtures on exact integrated head; no real provider mutations.
- [ ] Request Reviewer + Security/Change review on pinned candidate; fix findings and rerun affected checks.
- [ ] Report pinned PR/head, actual tests, additive migration/rollback notes and remaining staging/release gates to CEO. Do not merge/deploy.
