# PostDelegate MCP upgrade — delivery contract

Date: 2026-11-15 (Asia/Dubai)

User authorization: after reviewing the five improvements below, the user said “Let's do it”. CEO decides implementation details and the release after independent review. This is implementation authorization, not permission to post to real social accounts, send messages, spend money or delete unbacked data.

## Goal and verified baseline

Help an assistant inspect results, prepare better drafts, validate them and manage their lifecycle within the permissions assigned to that assistant.

GitHub main was verified at `914bdcf97fb429fd815f34716f55f723e3512924`. Canonical repository: `/Users/naserkhanjar/Documents/Codex/2026-10-26-https-github-com-athcagithub-postiz-leaked/postiz`, remote `khanjer496-alt/postdelegate`. Its checked-out branch is older; use a new isolated worktree based on freshly verified main. `~/Projects/PostDelegate` is a stale Nashr checkout and must not be used.

Existing source already has four analytics tools, post editing, review submission, workspace-wide approval rules, allowed agent channels and daily limits. Preserve and reuse these. Live deployment equality was not established in the initial source audit.

## Chosen approach

Extend existing NestJS/Prisma/Mastra MCP and approval services. Retain current tool names and existing credential behavior. Add focused capabilities and an evidence-backed assistant workflow; do not replace the transport, invent another analytics system or add an AI provider dependency.

Alternatives considered: documentation alone cannot enforce permissions or prevent duplicate mutations; rewriting the server adds migration risk without solving a new user need. Focused extensions best fit the current product.

## Deliverables

1. **Results to reviewed drafts.** An assistant can follow a documented/discoverable workflow to inspect a bounded recent period, cite real post/metric evidence, propose next week's channel-specific drafts and submit them for human review. Reuse existing analytics and review tools. Preserve missing-data, weak-sample, timezone and freshness qualifications; observed engagement does not establish causal growth or revenue. With no usable history, state that and prepare explicitly proposed experiments instead. No autonomous recurring schedule or new analytics provider. Use MCP prompts if the existing stack supports them cleanly; otherwise shipped agent instructions plus a verifiable workflow are sufficient.
2. **Per-agent credentials.** Usable admin-managed Analyst, Draft-only and Publisher presets, with explicit expiry/revocation and optional channel restrictions per credential. Default a new credential to Draft-only with a 30-day expiry; an admin explicitly selects any different role/expiry. Store only protected/verifiable secret representations; show a new secret once and redact logs. Enforce capability, organization, channel and expiry at execution, including nested/general-agent tools and alternate transports; hiding a tool is insufficient. Analyst cannot mutate. Draft-only can create/edit drafts and submit review, but cannot schedule, publish, approve, unschedule or mutate already scheduled/published content. Publisher remains subject to workspace approval/channel/daily-limit policy and never becomes a human approver. Legacy workspace keys and existing OAuth grants retain compatible behavior; do not silently rotate keys or broaden existing scopes. A new MCP-only key must not become an unrestricted REST credential.
3. **Preflight without side effects.** Add a discoverable check tool that reports per-channel content, character limits, provider/settings/media errors and readiness before saving. Reuse a shared preparation/validation path with actual scheduling. Validate the real transformed payload after link rewriting in mutation paths. A dry-run must not create posts, workflows, short-link records, media jobs, refresh credentials or publish. If a generated short URL cannot be known without materializing it, explicitly return a pending transformation and conservative length bound; do not claim an exact preview or unconditional validity. Include structured errors with entry/channel/field and practical fixes. Preserve generic provider interfaces.
4. **Safe cancel and recovery.** Expose reversible unscheduling rather than using deletion as the only cancellation. It must preserve draft content and audit history, be idempotent, respect ownership/approval and avoid racing an active publish. Resume only confirmed failed, unpublished thread segments while preserving provider receipts and published segments. Reconcile unknown/in-flight outcomes first; if reliable reconciliation is unavailable, return a clear blocked result and do not retry. Repeated calls and concurrent requests must not duplicate publication. Do not edit existing deployed Temporal workflow definitions or activity signatures; version new workflow behavior if needed.
5. **Accurate tools and instructions.** Update English MCP setup/tool reference and shipped Claude/ChatGPT/Codex/Cursor instruction files to match delivered capabilities and actual role/endpoint availability. Keep media generation optional. Keep existing clients/tool names compatible. Changes to scope consent/admin controls need concise copy using existing UI components. Do not touch unrelated SEO pages or the MCP Registry DNS/publisher record.

## Owners and coordination

- Builder: lead implementer/integrator; owns workflow, preflight, lifecycle tools, registry integration and delivered docs. Writes implementation plan/checklist in its isolated worktree before product changes, and coordinates shared interfaces with Integrations Dev.
- Integrations Dev: sole owner of the per-agent credential slice, authorization enforcement, minimal existing-settings UI and its migration/tests. Separate isolated worktree/PR. Sends interface/file-ownership contract to Builder before shared MCP files change.
- Reviewer plus Security Reviewer: independent review of final pinned heads and integrated candidate; Security Reviewer reviews the credential design early. Change Reviewer may additionally review cancellation/recovery races.
- QA Tester: controlled staging MCP protocol and app/settings acceptance using non-public fixtures; no real provider publication without separate user approval.
- Release Engineer: sole deployment executor after CEO go. Refreshes current deployed revision/config and reports staging readiness; no parallel deploy owner.

## Safety and repository constraints

- No unrelated changes to open PRs #191 (measurement), #192 (Farcaster), #207 (Zod) or #217 (SEO), observed 2026-11-15. Recheck overlap before branch integration; do not merge the dependency bump as part of this work.
- Preserve dirty worktrees and existing branch/index state. Use pnpm and existing dependencies, DTO → Controller → Service → Repository, Prisma rather than raw SQL.
- PRs follow the repository template. Every commit ends once with `Co-authored-by: OpenBot <335604065+openbotgit[bot]@users.noreply.github.com>`.
- Mac load snapshot: 5-minute 2.50, pressure level 2, about 19 GiB available. Do not start heavy local builds/full suites until pressure level 1, 5-minute load <12 and disk reserve >=15 GB. Use serialized CI gates where possible. No stress tests or cache/source cleanup.
- No bypass of CI terminal-escape safety checks, SSH host verification or other safety blocks. Provider-post verification remains separate from queued/scheduled state.

## Acceptance and release gates

### Binding clarifications from independent contract review

- Expiry/revocation blocks subsequent tool calls immediately. Previously accepted schedules remain workspace jobs governed by existing workspace approval/publishing policy; expiring or revoking a credential must not silently unschedule them. Explicit cancellation remains separate. Changing a credential's role never approves a pending draft or releases a workspace hold. Default Draft-only and 30-day expiry are enforced by the server, not only by UI defaults.
- Preflight has zero product/provider mutations. Bounded security audit records and rate-limit counters are permitted; content, posts, workflows, short links, media jobs, provider mutations and credential refreshes are not. Readiness that requires refreshing credentials remains explicitly unknown.
- Cancellation succeeds only when a publish fence shared with the executing worker guarantees it cannot publish. Legacy or in-flight executions without that guarantee return `BLOCKED`/`OUTCOME_UNKNOWN`; a database state change alone is not cancellation proof. Existing workflow histories/signatures remain immutable.

### Lifecycle implementation decision — 15 November

Builder verified that the legacy publisher has no durable attempt/reconciliation ledger: `ERROR` and a missing provider receipt do not prove that a segment was never published. A blocked-only recovery endpoint is a safe legacy fallback, but does not fulfill the supported recovery deliverable for new posts.

Implement a new versioned workflow and additive durable per-segment attempt/receipt tracking for new MCP-originated schedules, with a publish fence shared by cancellation and the executing worker. Preserve the recorded workflow version when a tracked post is edited/restarted or selected by a missing-post sweep. Existing jobs/histories stay on their old definitions; do not retrofit certainty into their data. Legacy cancellation may succeed only if termination plus authoritative history proves no publishing activity was ever scheduled and no alternate publisher can restart the post; otherwise return blocked/unknown.

For tracked posts, distinguish definitely not attempted, in flight, confirmed published, proven not accepted, and outcome unknown. A durable attempt-start marker without a receipt is unknown, never proof of failure. Persist and reuse stable per-segment identity and published receipts. Resume only eligible remaining segments after approval/channel/ownership rechecks and an atomic concurrency/fence check; never replay successful segments. Use provider idempotency/reconciliation only where its contract actually proves the outcome; unsupported or ambiguous cases remain blocked. Prove at least one supported new partial-thread recovery path with a controlled provider adapter/fixture, as well as failures after provider acceptance and concurrent resume/cancel calls. Mocked fixture proof is not live provider proof.

Builder owns this workflow/ledger slice and its additive migration. Coordinate schema/migration ownership with Integrations Dev's credential additions before editing common files. Reviewer plus Security/Change Reviewer must review the versioned workflow, fence, sweep routing and recovery policy before release; QA and Release Engineer incorporate both additive migrations and rollback compatibility. Public documentation must state the supported-new-post versus legacy boundary.

Tests must exercise denied mutations, cross-workspace/channel attempts, expired/revoked credentials, nested-agent bypass, legacy compatibility, approval holds and edits after approval. Preflight tests prove zero product/provider mutations and actual final-payload validation, including link-length boundaries and unfinished media. Recovery tests cover idempotency, concurrent calls, partial threads, revoked approval, unknown receipts and publishing races. Workflow tests/fixtures cover sufficient, sparse and missing analytics, plus drafts staying IN_REVIEW and never public.

Use focused meaningful regression tests first, then required CI/build checks and controlled MCP initialize/tools-list/tools-call/authorization tests on the exact integrated revision. Reviewer and specialist must give a go on exact final heads; QA proves staged behavior, schema/credential lifecycle and runtime publication containment. Release Engineer takes verified backup and records rollback/schema compatibility before production. CEO authorizes the exact release only after these gates; verify live revision and safe non-publishing MCP behavior afterward. Completion requires delivered code/docs, passing gates and checked deployment, with any genuine external blocker stated separately.
