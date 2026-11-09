# Auth callback URL/replay assessment — 9 November 2026

Follow-up to #185. This is source/unit evidence with synthetic keys and mocked
Neynar responses, not a live production account test.

## MeWe history fix

ContinueIntegration previously matched a query-only MeWe branch before its
unreachable hash branch. It now captures loginRequestToken and state from the
fragment (with legacy query fallback) before the effect runs. The history scrubber
removes sensitive parameters from both query and parameter-style fragment,
preserving router state, onboarding and non-sensitive fragment state. Only the
captured token goes into the existing POST body. Older synced history cannot be
removed by this patch. The regression failed before and passes after the fix.

## MCP setup is already covered by #185

The parent PR already generates OAuth /api/mcp setup and Bearer-header fallback
instead of /mcp/<key>. This follow-up does not duplicate that implementation.
public.config.spec.ts verifies the configuration together with the callback
regression run. Existing legacy transport acceptance is a separate compatibility
policy documented in #185, not a recommended new setup.

## Wallet: original signed challenge is consumed

apps/backend/src/services/auth/providers/wallet.provider.ts verifies the signature
against a Redis challenge (60-second TTL), deletes that challenge on successful
exchange and rejects a later exchange of the same signed payload. The new test
uses a real synthetic NaCl key/signature and in-memory Redis fixture: first
exchange succeeds, getUser resolves the verified token, second raw-code exchange
returns empty. The separate verified token remains usable for the registration
continuation for up to one hour; this test does not claim all tokens are one-use.
First-use interception is still a concern while the signed payload travels in a
URL. The wallet frontend also has separate state-flow concerns; no live login or
full auth-controller acceptance was checked by this provider-level test.

## Farcaster: legacy finding and bound-proof follow-up

Before this follow-up, the auth provider decoded signer_uuid and accepted it
repeatedly while Neynar reported approved. The #190 characterization and independent
security review rated that existing behavior High if enabled. Production key
absence was reported by CEO for one snapshot, not a permanent security guard.

This follow-up rejects raw UUIDs, requires an auth-only default-off flag, creates
signers bound to a private browser nonce, and issues/consumes opaque expiring
proofs and purpose-separated registration continuation. The old characterization
is now a rejection regression. Public state alone cannot redeem a proof, and an
arbitrary existing signer cannot mint one. Both client history cleanup and
nonce-only auth navigation are included; history cleanup alone is not replay
protection or historical erasure.

Protocol, limits and mandatory staging checks are in
[the proof runbook](../../deploy/postdelegate/review/farcaster-login-proof.md).
No production setting, live account, credential rotation or real Neynar call was
performed for this implementation. Source tests/build plus real-Redis consumption
proof and fresh security review are required; live enablement remains separate.
