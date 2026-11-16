# Authenticated MCP QA composition — test-only, unrun

Original reviewed patch base: `12543651de9b759be36adc904d346075096183cb`. Integrated after compatibility inspection against rebased PR219 base `ab18e12d66bfa13a82da8b03db7ff6f855f0f25d`; the final integrated pin still needs its own review. Integrate/review these NEW files with Builder's corrected candidate; never deploy the unsafe base just to exercise them. No production file imports this directory, no production main/bootstrap changes, no fixture flag in a production module, no new public control route. `bootstrap.ts` uses real AppModule/controllers/auth/policies/repositories/Prisma/Redis/Temporal and real PostActivity. The only substitutions are a complete process-local fixture provider/catalog + its matching DTO discriminator, and an internal email transport. Infinite/background schedules are disabled in this isolated composition. Real provider modules have no catalog fallback. RE's network deny remains mandatory, including native gRPC and database sockets; JavaScript HTTP checks do not prove containment.

This patch supplies a composition and protected access helpers, NOT runtime/source acceptance or permission to seed. Every executable calls the run guard before application imports or connections. No imports, dependency installs, DB, Redis, Temporal, containers, credentials, provider calls, full tests or browser were run during preparation (Mac reserve below 15 GB). Only static/syntax checks are permitted now. Bootstrap/import/DI, DTO metadata, real workers, TLS/login/cookies/settings and MCP gates remain UNRUN until the reviewed contained-runtime go.

## Exact ownership and reference contract

RE alone creates NEW disposable app/frontend/API/sink/Postgres/Redis/Temporal resources, trusted TLS ingress and containment proof. Never overwrite staging, production Caddy/DNS/Registry or another agent checkout. Builder is sole integrated writer/CI owner. QA owns one authenticated test session. Proposed local operational reference name is `qa/mcp-<runId>`; this is metadata, not a request to create/push a Git ref. `sourceSha` MUST be the final reviewed integrated source/image SHA including this patch; `PD_QA_SOURCE_SHA` must match RE's image label proof.

Choose a fresh 12-character lowercase hex run ID; manifest IDs are eight DISTINCT UUIDv4s: A/B organization/channel/admin/member. RE supplies an actual owned, trusted HTTPS hostname `pd-mcp-qa-<runId>.<RE-owned-domain>`. This is a naming template, not an existing host or TLS claim. Origin has no trailing slash/path. Do not invent localhost TLS, a private CA, tunnel, certificate bypass or `NOT_SECURED`; the variable must be absent, even `NOT_SECURED=false` is rejected.

All containers share the necessary protected references under `/run/postdelegate-qa/<runId>` (owner matching process UID, directory 0700, references 0600 and single-link regular leaves; no symlinks or group/other-writable ancestors). Keep `access.json` and `protocol-keys.json` OFF frontend mounts/logs/artifacts. Seed writes a separate protected `frontend.env` containing ONLY the fresh run JWT secret and public QA URLs; RE injects that file into the NEW frontend via its secret/environment mechanism, never production keys or the account/protocol reference. Do not print it. Mount only uploads read-only into the frontend's normal upload serving path; confirm the actual candidate's route/volume, do not assume runtime variables serve files. Example manifest SHAPE below contains placeholders, not runnable credentials/config:

```json
{
  "purpose": "postdelegate-authenticated-qa",
  "runId": "<12hex>",
  "sourceSha": "<reviewed40hex>",
  "refName": "qa/mcp-<12hex>",
  "origin": "https://pd-mcp-qa-<12hex>.<RE-owned-domain>",
  "databaseUrl": "postgresql://<disposable-user>:<protected-password>@qa-postgres:5432/pd_mcp_qa_<12hex>",
  "redisUrl": "redis://<disposable-auth>@qa-redis:6379/15",
  "temporalAddress": "qa-temporal:7233",
  "namespace": "mcp-http-qa-<12hex>",
  "sinkOrigin": "http://qa-sink:7081",
  "protectedRoot": "/run/postdelegate-qa/<12hex>",
  "containmentRef": "/run/postdelegate-qa/<12hex>/containment.json",
  "tenants": [
    {"label":"A","orgId":"<uuidv4>","channelId":"<uuidv4>","adminId":"<uuidv4>","memberId":"<uuidv4>"},
    {"label":"B","orgId":"<uuidv4>","channelId":"<uuidv4>","adminId":"<uuidv4>","memberId":"<uuidv4>"}
  ]
}
```

RE's protected containment reference must contain matching `runId`, `sourceSha`, `origin`, `owner: "Release Engineer"`, `providerEgress: "DENIED"`, `trustedHttps: true`, `frontendBakedApi: "<origin>/api"`, `sourceReviewedSha`, `reviewedRuntimeGo: true`, `runtimeGoRef`, `evidenceRef`, and `trustedReferenceParents: "RE_IMMUTABLE_NO_CONCURRENT_UNTRUSTED_WRITERS"`. RE must prove ancestor ownership/mount integrity and no concurrent untrusted or same-UID writers; API references should be mounted read-only except explicitly private writer volumes. Node descriptor/no-follow/fstat checks plus before/after path identity checks do NOT provide a race-free openat-style sandbox against hostile root or concurrent same-UID mutation. Fields are prerequisites referencing real approvals/proof; writing them is NOT independent proof or authorization. RE must prove egress deny for API AND workers, route only internal sink/infrastructure and the exact trusted ingress, and preserve provider-deny evidence outside this helper. Never inject real platform, AI, billing, storage-cloud, email or Sentry credentials.

## Reviewed QA image and exact commands (execute only after go)

Image must retain source paths, frozen lockfile dependencies, generated Prisma client and matching `@nestjs/testing` / `@nestjs/core` (pinned manifest declares both 11.2.7). A production-only/pruned image may omit testing; bootstrap explicitly refuses that image. RE/Builder builds a NEW QA layer with dev/test dependencies via existing frozen lockfile; no local install under the current reserve. Do not import `apps/backend/src/main.ts`.

RE sets these environment variables in each relevant new container (values come from protected refs, never chat):

```sh
export PD_QA_MANIFEST_REF=/run/postdelegate-qa/RUN/manifest.json
export PD_QA_EXECUTE=RUN
export PD_QA_SOURCE_SHA=REVIEWED_SHA
export TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node","experimentalDecorators":true,"emitDecoratorMetadata":true,"esModuleInterop":true}'
```

Replace RUN/REVIEWED_SHA explicitly. Never print the manifest, passwords, cookies, JWTs or API response secrets. Guard supplies real dedicated DB/Redis/Temporal and `FRONTEND_URL=MAIN_URL=<trusted origin>`, `NEXT_PUBLIC_BACKEND_URL=NEXT_PUBLIC_OVERRIDE_BACKEND_URL=<origin>/api`, exact CSRF origin, local upload directory. Environment must have NO inherited JWT_SECRET/external provider keys. Bootstrap loads its per-run JWT secret from protected access reference, never from production.

RE applies the reviewed schema ONLY to `pd_mcp_qa_<runId>` and creates Temporal namespace `mcp-http-qa-<runId>` with organizationId/postId search attributes on `qa-temporal`. Existing real Temporal registration may verify/add those attributes, never default namespace. New API listens internal HTTP port 3000 (existing GET `/` is its internal health probe; sink uses internal TCP7081 health); RE TLS ingress routes `/api/*` to it with `/api` stripped, frontend at `/`, no public sink exposure. This mirrors normal backend route mounting. Route root `/.well-known/*` to the same API if OAuth/discovery acceptance is in the test plan; do not let it fall through to an unrelated frontend registry record. External URL and cookie Domain must be proven by normal HTTPS client; no `curl -k` or custom CA. RE must run `deploy/postdelegate/staging/frontend-url.sh` ONLY in the NEW QA frontend layer (BAKED_BACKEND_URL recorded, replacement `<origin>/api`) and verify no baked production API remains; setting runtime vars alone is insufficient. Start the normal frontend command (`pnpm --filter ./apps/frontend start`, port4200) through that wrapper with the protected fresh `frontend.env` injected by RE. Audit the NEW image for inherited production `.env`/telemetry/provider configuration and keep browser traffic restricted to this QA origin/internal fixture assets.

After reviewed go and schema/namespace preparation, run once in the guarded QA image, repository root:

```sh
node --experimental-require-module -r ts-node/register/transpile-only -r tsconfig-paths/register test/fixtures/mcp-authenticated-qa/seed-access.ts seed
```

This exclusively writes protected `access.json` and `frontend.env`, then creates activated LOCAL A/B admin+member accounts, normal bcrypt hashes/memberships, one fixture channel per tenant and existing approval settings. It refuses a nonempty DB or existing access reference. A failed/uncertain seed is NOT permission to delete/reseed: reconcile the exclusively owned disposable run or recreate it under RE's authority. It does not issue a login JWT or agent key directly.

Run separate internal sink container, no published host port:

```sh
node --experimental-require-module -r ts-node/register/transpile-only -r tsconfig-paths/register test/fixtures/mcp-authenticated-qa/internal-sink.ts
```

Start the QA API+actual V114 workers (one real TestingModule/manager instance shared by API/preflight/reconciliation/PostActivity):

```sh
node --experimental-require-module -r ts-node/register/transpile-only -r tsconfig-paths/register test/fixtures/mcp-authenticated-qa/bootstrap.ts
```

Bootstrap checks exact two tenant/channel identities, four activated non-superadmin LOCAL accounts/memberships, manager injection identity, static catalog identity and DTO metadata. It starts real workers on `mcp-publish-v114` and `mcp-v114-fixture` in the dedicated namespace, preserving production workflow source. Unknown provider, tenant/channel, dispatch identity, OAuth/refresh and predecessor receipt deny. Sink journals actual ACCEPT/DENY/RECONCILE events with fsync (IDs/digests only), records and rejects duplicate calls explicitly, never silently deduplicates. Optional protected `outcomes.json` maps EXACT segment ID to `UNPUBLISHED`; this is out-of-band fixture transport behavior, no public mutation/control endpoint. Missing receipt remains UNKNOWN; this is not a real-platform reconciliation claim. `qa-receipt` links identify synthetic receipts, not actual social posts or a promised UI route.

Then use normal trusted HTTPS login and protected normal admin API response capture:

```sh
node --experimental-require-module -r ts-node/register/transpile-only -r tsconfig-paths/register test/fixtures/mcp-authenticated-qa/seed-access.ts issue-protocol-keys
node --experimental-require-module -r ts-node/register/transpile-only -r tsconfig-paths/register test/fixtures/mcp-authenticated-qa/seed-access.ts probe
```

The helper first exclusively reserves and fsyncs protected version-2 `protocol-keys.json` BEFORE any login/credential POST. Existing, partial and concurrent operations stop before additional requests. Each operation has a unique bounded credential name, a durable PENDING intent before its POST, and an atomically checkpointed successful `{credential,secret}` response BEFORE validation or any next POST (even an unexpected member success). The helper verifies Secure+HttpOnly+SameSite=Lax and normal cookie Domain, exact admin identity, member POST denial, and issues A/B × three role keys through the REAL settings controller. Secrets go only into this protected journal; no server observer, browser evaluation, screenshot, URL or console capture. Probe first exercises real Settings admission GET/admin policy and exact recovery POST using the impossible UUID-zero owner (must return the actual controller stale-owner400, never fixture403); member routes must deny403. Probe initializes the REAL MCP server, lists actual tools, exercises real fixture catalog/schema/channel listing, cross-tenant preflight denial and REST audience rejection. It is a bounded probe, NOT full acceptance or publication proof. Unexpected errors do not count as successful denials. Issuer reruns never create additional keys: the reservation already exists before any request. No automatic resume, reissue, revocation, journal deletion or ownership takeover exists. Interrupted/partial journals cannot be probed as complete.

## Interrupted issuance and receipt evidence

A network loss can occur after server commit but before the response reaches durable storage; no helper can recover that show-once secret through metadata. It must remain UNKNOWN, not be retried. Earlier captured responses remain protected; the pending operation's unique name lets the admin inventory its created ID without obtaining a secret. A normal successful response whose checkpoint fails likewise leaves a durable PENDING correlation and may leave a private `.tmp` file. Preserve those artifacts, stop the operation, and do not rerun or remove the reservation.

After an explicitly reviewed contained-runtime go, the separate read-only reconciliation mode uses normal login and credential METADATA GETs, writes a new protected report, and never changes the issuance journal or credentials:

```sh
node --experimental-require-module -r ts-node/register/transpile-only -r tsconfig-paths/register test/fixtures/mcp-authenticated-qa/seed-access.ts reconcile-protocol-keys
```

`OBSERVED_WITH_CAPTURE` confirms metadata matches a retained response; `OBSERVED_SECRET_UNRECOVERABLE` requires operator handling under a separate explicit decision. `NO_MATCH_STILL_UNKNOWN` is not proof the old request cannot later commit. Duplicate matches also remain unknown. No absence permits blind retry, no automatic revocation occurs, and there is no server/UI secret observer. RE/QA must establish the old issuer/request is quiescent and decide how to handle inventoried keys; a fresh disposable run is safer than deleting this journal to force another issue. The CLI never prints secrets or response payloads.

Provider reconciliation scans the entire same-attempt history. Any acceptance mixed with denial, duplicate acceptance/call, multiple outcomes, inconsistent hash/tenant/segment/receipt or corrupt event returns UNKNOWN; exactly one authoritative DENY alone may return UNPUBLISHED. Every event remains in the fsynced ledger; none are deduplicated/dropped. Repeated same-attempt publish calls record DUPLICATE_CALL and fail the fixture instead of permitting mutable rules to turn a prior denial into a later acceptance. Reads/appends/fsync use the SAME opened no-follow descriptor and reject swapped leaves/parents. These controls still depend on RE's immutable-ancestor/no-untrusted-writer proof, not a claim of general race-free filesystem containment.

## UI separation and remaining hosted CI/QA gates

QA logs in using normal `/auth/login` with protected A/B account references in an isolated browser session. No session token/JWT injection and no production navigation. UI-created show-once key checks are separate from API-issued protocol keys: assert presence/visibility only, dismiss, then allow screenshots/snapshots. Never read code text/value or snapshot/screenshot while secret is visible. If browser automation cannot suppress automatic capture, use an approved manual UI check and state that boundary; do not add a secret observer. No claim is made for provider-specific frontend composer controls for synthetic provider `fixture`.

Builder must add to existing hosted CI (no competing pipeline/observer):

1. Explicitly run `pnpm exec jest --runInBand --testMatch '**/mcp-authenticated-qa/*.spec.ts'` (root Jest default patterns omit `test/`). Prepare an owned0700 `PD_QA_FS_TEST_ROOT` under trusted, non-world-writable ancestors in the QA CI image; filesystem tests must run, not silently remain skipped. Included regressions cover exact admission methods/paths, complete contradictory receipt histories, reservation collisions/concurrent calls, pre/post-checkpoint faults and lost responses, descriptor ownership/mode/hardlink/symlink/leaf-parent swaps and journal replacement. Add catalog/schema and unknown-provider/tenant/channel negative tests, and verify real API/preflight/worker use one instance; no empty-catalog shortcuts.
2. In the intended NEW QA image, dependency-resolution/version check for `@nestjs/testing`, real AppModule compilation/DI, cookie-parser/filters/validation/CORS and startMcp; application imports are runtime gates, not syntax proof. Check no production entrypoint imports this test directory and no test helper is baked as production entrypoint.
3. Actual disposable DB/Redis/Temporal test using these accounts plus trusted HTTPS ingress: normal A/B admin/member login, missing/wrong Origin rejection, Secure/HttpOnly/Domain cookies, member/tenant credential CRUD denials, defaults, explicit empty channels, all role negatives/positives, omitted-filter isolation, expiry/revoke between nested calls, REST/path audience rejection. Capture secrets only in protected Node flow; no raw artifacts. Test UI show-once/dismiss independently.
4. End-to-end tools/call through REAL MCP/auth/policy + actual workers + sink: reviewed draft stays IN_REVIEW; human approval required; same fixture identity reaches provider/reconciliation; duplicate/cancel/resume/crash/unknown behavior and original failed source cases. Existing native direct-domain fixture remains a separate proof; neither it nor this composition alone proves all gates.
5. Full corrected-candidate build/tests and reviewed contained staging still required. Without RE's real trusted HTTPS origin and network/stack proof, hosted CI must mark HTTP/UI runtime gates UNRUN/HELD, not invent localhost TLS, tunnel, mock auth, fake receipt or success. Add the fixture contract to the one exact reviewed app/worker/config handoff. No real social publication, customer data, live keys, production Caddy/DNS/Registry, merge or deploy is authorized here.


## Current-candidate compatibility delta

The original 11-file R2 patch is retained by digest in the integration evidence: SHA256 `83f4ed0ce9c30675143c499085c68304f00131668b56e68144c5b3568abfd495`. Current production composition adds durable MCP dispatch recovery. This isolated fixture sets `MCP_V114_DISPATCH_RECOVERY_DISABLED=true` before AppModule import/init, alongside its existing background stops. This prevents uncontrolled polling of case data; controlled dispatch-reconciliation acceptance must explicitly invoke the real service under the later reviewed QA session. No seed, key issuance, application composition or transport was run during static integration. The guard/README delta needs integrated source review; original base125 source approval alone is insufficient.


Bounded synthetic integration check: 76/76 across the three explicit fixture specs passed under the shared Mac guard with an owned 0700 PD_QA_FS_TEST_ROOT and zero skipped cases. This includes five actual synthetic-filesystem cases; all HTTP/persistence issuance ports were in-memory fakes. The first run found the expected reconciliation wording missing from the curated stop message; the message now explicitly names journal reconciliation and the affected 44-case issuance suite passed. This is neither a credential issuance nor an authenticated runtime/DI/worker/TLS result. The default application Jest scope intentionally excludes this test-only folder; the CI workflow has a separate explicit fixture testMatch and rejects skipped acceptance.
