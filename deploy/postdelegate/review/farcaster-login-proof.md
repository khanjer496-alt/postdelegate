# Farcaster login: bound one-use proofs

Follow-up to #185 and #190. No production enablement or provider-key changes are
part of this PR. FARCASTER_LOGIN_ENABLED defaults false; publishing credentials
alone must not enable authentication. Keep it false until source/security review
and staging checks pass.

## Protocol

1. Auth-only POST /auth/farcaster/login/start requires JSON. Server creates a
   fresh signer through the existing channel SDK helper and binds its ID to a
   random flow ID AND a separate private browser nonce before returning approval
   URL/QR. Client cannot choose or substitute a signer UUID.
2. A per-flow host-only HttpOnly nonce cookie carries the private nonce. In secure
   mode it uses __Host-, Secure, Path=/, no Domain, and the configured same-site
   policy. Public state is only a lookup identifier; matching it alone is not
   browser binding. Other providers keep their existing public-state checks.
3. Auth status is a JSON POST with state only. Missing/wrong cookie fails before
   lookup. After approval, a compare-and-delete consumes the flow once and issues
   a short-lived opaque proof. No raw UUID is an accepted auth code.
4. Redemption rechecks approved signer/FID, verifies private binding and consumes
   the proof once. Internal login tickets and registration continuations have
   separate prefixes/purposes and are also consumed once. Wrong-browser/purpose
   requests cannot consume a legitimate record.
5. Auth UI uses a verified sessionStorage handoff and nonce-only /auth navigation;
   blocked storage has no URL fallback. Register captures legacy callback code in
   memory, strips current history before POST, and consumes handoff only in the
   guarded effect (StrictMode does not double-post).
6. Existing-user completion issues a normal session. New-user completion returns
   a separate bound registration ticket; the form carries only public provider
   state and that ticket. Registration consumes it and never trusts client FID or
   email. Cookie is cleared after completion, retained for registration only.

TTL: approval flow 600s; proof 60s; internal login ticket 60s; registration 600s.
Credential responses set Cache-Control: no-store.
Cookie maximum covers their bounded sum (1320s), then expires if abandoned.
Redis keys hash opaque credentials and records keep nonce hashes. Signer UUIDs
are retained only in pending flow/proof state and are omitted from login and
registration continuation records after redemption. The fixed Lua
script checks binding/purpose/expiry before deleting. Redis's atomic scripting
semantics are described in [the official scripting guide](https://redis.io/docs/latest/develop/programmability/eval-intro/).
The non-atomic development MockRedis is deliberately unsupported: fail closed.

## Boundaries

- Existing channel creation/approval endpoints and the default shared approval
  component mode are unchanged. Signer UUIDs retain their channel-publishing
  meaning; this PR does not rotate or erase old publishing credentials.
- Auth flow never exchanges a caller-supplied approved UUID for a proof. A stolen
  legacy callback cannot be rebound to an attacker's new browser/flow.
- Cookie-less mobile/redirect_uri and NOT_SECURED do not bypass private binding.
  Native/mobile PKCE support would be a separate reviewed feature; browser-based
  QR approval from a phone still completes in the original browser.
- Frontend cleanup cannot erase initial requests, backups or synced history.
  Previously issued sessions/compromised credentials need separate owner action;
  this does not claim retrospective incident eradication.
- Wallet authentication/signup policy is unchanged, except generic /auth current
  code-history cleanup. Its existing signup-abuse decision is separate.

## Operator staging checklist (before any enablement)

1. Deploy the exact reviewed candidate to isolated staging only through Release
   Engineer. Use approved test accounts/keys via user/Vault; never repo/log/recording.
2. Verify healthy configured Redis with Lua execution and real-Redis CI gate.
   Start refuses the in-memory fallback. No database migration is required.
3. With FARCASTER_LOGIN_ENABLED absent/false, verify auth start/redemption fail,
   even if channel Neynar configuration exists. Confirm channel mode still works.
4. In staging only, configure the existing Neynar app settings and set the auth
   flag true. Verify actual Set-Cookie keeps __Host-/Secure/HttpOnly/Path=/ and no
   Domain through all proxies. Blocked/dropped cookies must fail closed, never
   trigger a legacy UUID fallback. Do not weaken cookie security to work around
   a proxy; get its configuration fixed/reviewed by the release owner.
5. Approve fresh signer from QR, verify normal login and separate new-user signup.
   Check nonce-only /auth URL, no proof in history, proper expiry/error notice,
   two tabs/flows, cancelled modal and browser reload. No extra start in StrictMode.
6. Attempt raw old UUID callback, proof replay, mismatched browser, expired proof,
   revoked signer and repeated signup continuation; all must fail without session.
7. Verify existing email/Google/GitHub/Apple/custom OAuth and channel-approval
   behavior. Do not enable production until source/security/reviewer/staging
   gates and owner access-impact decisions are recorded.

New dedicated Farcaster proof Redis CI runs only on an explicitly isolated local
Redis service at port 6391 with example SDK responses. It never flushes a server
or connects to arbitrary configured URLs. Normal CI covers full tests/build and
the existing PostgreSQL gate. No real Neynar calls are made by these tests.
