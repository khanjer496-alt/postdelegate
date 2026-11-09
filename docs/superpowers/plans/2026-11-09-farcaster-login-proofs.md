# Farcaster Login Proofs Implementation Plan

> Execute inline with the executing-plans workflow; existing reviewers provide independent security review. Do not merge or deploy.

**Goal:** Approved signer login becomes short-lived, browser-bound and single-use, rejecting bare signer UUIDs even when Neynar is configured.

**Architecture:** Auth-only start/status endpoints create the signer and bind it immediately to a separate private HttpOnly cookie. Redis stores only hashed proof keys and nonce hashes with expiry; a Lua compare-and-delete consumes each proof atomically. Fresh login, server verification and registration continuation have distinct one-use stages. Shared channel approval behavior stays unchanged. Generic auth context is optional for existing providers. Bound-proof providers require private cookie context even when legacy public-state checks would be skipped; other providers keep their existing checks. Frontend uses nonce-only navigation and scrubs old /auth code history before POST.

**Stack:** Existing NestJS/React/ioredis/Neynar, Node crypto. No new dependency or database schema. Stack after #185 and #190 so the old Farcaster characterization can become a rejection regression.

- [x] Add protocol regression tests: raw UUID reject; browser mismatch; approval bound at signer creation; no arbitrary UUID exchange; expiry; repeated/concurrent redemption; revocation; registration purpose separation.
- [x] Add auth-only FARCASTER_LOGIN_ENABLED default-off control; channel keys must not silently enable login. No production setting changes.
- [x] Add auth-provider request context/cookie helpers and DTO providerState. Trace all consumers; keep older provider signatures optional.
- [x] Implement auth-only Farcaster flow with 10-minute approval state, 60-second proof/login ticket and 10-minute registration ticket; cookie covers the complete bounded flow. Atomic script checks expiry and binding before deleting. Mock-Redis without eval fails closed.
- [x] Pass server-derived context into checkExists and registration; consume login tickets and return separate registration continuation. No raw identity fields trusted from client.
- [x] Add JSON-only, throttled start/status routes and host-only nonce cookies; leave old channel signer endpoints unchanged. Secret auth POST bodies excluded from telemetry.
- [x] Add authentication mode to shared approval UI. Store proof only in verified sessionStorage handoff; navigate /auth with provider/state/marker only. Capture and clear handoff once; preserve callback payload in memory; strip legacy history before POST. No URL fallback on blocked storage.
- [x] Test controller cookies/context, service registration continuity, UI transport/history and existing channel-mode compatibility.
- [x] Add real Redis atomic/expiry integration tests in a NEW CI workflow using an isolated local CI Redis service; no changes to existing Temporal workflows or production services. No stress tests/flushall.
- [ ] Run only gated/serialized local checks if load <=12; otherwise CI. Require normal full build plus real Redis gate, then current-head security review. No production key requests/enablement or live account tests.

Security limits: history cleanup cannot erase initial request logs or synced history. Browser binding uses a secret cookie independent of public state. An approved UUID alone must never mint an auth proof. Registration continuation cannot issue another continuation indefinitely. Legacy mobile/cookie-less Farcaster callbacks fail closed; other providers' mobile behavior is unchanged. Production env absence is CEO-reported snapshot, not a permanent guard.
