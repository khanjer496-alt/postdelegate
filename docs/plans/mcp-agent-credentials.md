# MCP agent credentials (2026-11-15)

Base: main 914bdcf9. Integrations Dev owns this slice in feat/mcp-agent-credentials.

1. Add an additive AgentCredential table, SHA-256 digest only, random 256-bit mca_ bearer secret returned once. Admin list/create/revoke in existing Settings; Draft-only / 30 days defaults, explicit Analyst/Publisher and expiry choice. No legacy key mutation.
2. Resolve credentials only on MCP transports. Carry credential identity in server AsyncLocalStorage, never caller annotations. Reload active credential at each tool execution (including nested tools). Default-deny unknown tools; explicit role/action/channel checks. Existing workspace approval/limits still run. No approve capability. Reject mca_ on REST and path transports (secrets must be headers).
3. Wrap tools at LoadToolsService so nested agent tools share the same boundary; wrap ask_postdelegate separately. Enforce tenant from authenticated context. Check existing post state for draft edits; add service boundary checks for draft-only writes. Restrict channel reads as well as writes; disallow workspace aggregate analytics under channel restrictions where filtering cannot be guaranteed.
4. Focused role/tenant/channel/nested/expiry/revoke/legacy tests; CI build/full suites. Additive migration, rollback app first with credentials disabled, retain table/digests; never resurrect revoked keys.

Ownership: new chat/agent-credential* and database/prisma/agent-credentials/*, schema/migration, DTO/controller, settings UI. Shared files owned here: start.mcp.ts, async.storage.ts, auth.context.ts, load.tools.service.ts, chat.module.ts, settings.controller.ts, global.settings.tsx; minimal posts.service.ts guards coordinated with Builder. Builder owns lifecycle/preflight tool files, registry/docs; must register explicit authorization actions for new tools (unknown tools denied to agent credentials). No transport replacement.

Interface: AgentCredentialService.resolve(secret) -> { organization, credentialId } | null; authorizeTool(name,input) -> Promise<input> under getContext().agentCredentialId; assertPostAction(orgId,channelId,state?,action) at mutation boundary. Absent agentCredentialId preserves legacy behavior. New tool names/actions must be agreed before integration.

## Frozen operation / role / transport matrix

| Operation | Analyst | Draft-only | Publisher |
| --- | --- | --- | --- |
| Channel schemas/list, post list, stored analytics, preflight, workflow guidance | yes | yes | yes |
| Create draft, edit stored DRAFT, submit stored DRAFT for review | no | yes | yes |
| Schedule/now, edit QUEUE, review QUEUE (unschedule), delete/cancel/resume | no | no | yes |
| Dynamic provider lookup, import media from URL | no | no | yes |
| Approve / credential administration / unknown tools | no | no | no |
| ask_postdelegate | nested actions use same policy | nested actions use same policy | nested actions use same policy |

All roles: header-authenticated canonical /mcp and OAuth-resource MCP endpoints use the same credential resolver/policy. REST, /mcp/:secret, /sse/:secret and /message/:secret reject new keys; legacy keys and OAuth remain on existing paths/contracts. Channel restrictions apply before reads/writes. Unfilterable workspace totals are refused for restricted credentials; top-post/best-time omitted filters become the permitted subset; lists are filtered. null restriction means all; [] means none. Unknown tools fail closed until explicitly mapped.

Bindings from early review: each nested call reloads expiry/revocation; accepted approved schedules remain workspace jobs after revoke. No role upgrade clears holds (roles are immutable; create a replacement and revoke the old key). Draft edits preserve IN_REVIEW and invalidate an old APPROVED revision. Builder owns atomic workspace quota admission, new tracked workflow fences/ledger and its separate schema/migration hunks. New draft-only stored-state guards include a conditional DRAFT/releaseId-null predicate on the write to fail closed in a race.

## Migration and rollback

Apply 20261115160000_agent_credentials before new application code, alongside Builder's separately reviewed additive ledger migration. No live migration or key issuance performed here. This migration adds a table/type/index and org foreign key only; no credential backfill/rotation. Existing binaries ignore the table. Roll back app exposure first; retain the table, hashes and revoked markers (never restore an old backup to re-enable revoked keys). If removing schema later, export/retain credential metadata as approved and confirm no new-code process remains before dropping the table/type. Builder's workflow versions additionally require compatibility-aware worker retention/drain; old-image-only rollback is not sufficient for newly accepted jobs. No customer data is deleted by this PR.

Review corrections: Draft-only existing-thread writes use a serializable root/version/state claim and conditional updates with no upsert fallback or group cleanup. Every child must belong to that root chain and remain DRAFT/unpublished; any failure rolls back the whole thread. The editor carries its captured root revision to the transaction. Top-post analytics restricts both metadata and posts before constructing the result. All credential mutations intersect current workspace agent-channel policy without spending creation quota. Server principal-kind and deny-only request-context markers prevent a missing agent ID/context from silently falling back to legacy within an identified restricted request. AgentCredential erasure follows the organization FK cascade. These changes supersede the earlier upsert-predicate design/test assumption.

Live channel/post analytics for new agent credentials returns explicit UNKNOWN without invoking provider, token refresh, disconnect or persistence. Stored history remains readable under channel policy. Legacy live analytics is unchanged. This applies to direct and nested calls for all three presets.
