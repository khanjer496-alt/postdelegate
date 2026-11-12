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

## Farcaster: replay remains possible at the provider boundary

apps/backend/src/services/auth/providers/farcaster.provider.ts decodes signer_uuid,
asks Neynar whether it is approved, then returns that same identifier. getUser
looks up the same signer again. There is no nonce consumption, code lifetime or
binding of that code to a particular browser-state nonce in these methods.

The characterization test submits the same synthetic approved signer code twice:
both getToken calls return the same token and both getUser calls return the same
identity. It makes no real Neynar request. AuthService.checkExists separately
checks a browser state-cookie match, but that is not single-use binding of the
signer code; an attacker who obtains a code can initiate a fresh state flow.
Mobile redirect_uri and NOT_SECURED paths have different state rules. A full
production account replay was not attempted, and deployed app configuration and
affected-user counts are unverified.

Treat the approved signer UUID/code as a reusable credential, not an expiring
challenge. History removal alone cannot fix replay. A separate auth change should
issue short-lived, browser-bound, single-use login proofs after approved signer
validation, consume them atomically on redemption, preserve new-user registration
continuations and cover concurrent redemption/revocation. That behavior change is
not implemented or claimed by this assessment. CEO/Security Reviewer must decide
its release priority or provider containment; this PR does not disable a provider.

## Verification scope

Auth characterization and MeWe/MCP/auth-form regressions run offline using example
credentials only. No production records, keys, real signed messages, log payloads,
provider settings, live accounts, rotations, merges or deployments were accessed.
