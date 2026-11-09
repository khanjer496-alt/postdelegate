# Credential connect URL fix — 9 November 2026

This change is independent of the provider scope/reviewer-workspace draft #184.
It starts from main fd0dfbe0. No deployment, live connect, credential rotation,
telemetry query of customer records or data deletion is performed by this PR.

## Behavior

Custom credential forms for Nostr, Bluesky, Lemmy, Listmonk, WordPress, Dev.to
(`devto`), Hashnode, Medium and X own-key now use the nonce-keyed sessionStorage
handoff that ContinueIntegration already consumes in its POST body. Moltbook's
raw API key and extension cookies use the same path. Navigation contains only
state and the optional onboarding flag. A blocked, failed or unreadable storage
write leaves the modal open with a warning; there is no URL fallback.

The callback captures its original parameters for the POST, then uses
history.replaceState to remove code and related OAuth credential parameters
before fetching. It preserves the existing Next history state, state nonce and
onboarding flag. The callback consumes tab storage before its first request, including network
failures. Pending confirmation keeps the payload only in component memory;
cancel/final response/error clears it, and abandoning the component leaves no
stored handoff. A failed flow must restart the connection. Real OAuth codes still reach the POST body.

This protects new connects. Replacing the current history entry cannot erase
older browser-history entries, synced history, server requests or old telemetry.
Do not open a real leaked URL to test the fix. Use synthetic credentials and a
stubbed/disposable test provider, never a customer's account.

## Telemetry

Frontend and Next server Sentry error events, transactions, spans, logs,
breadcrumbs and Replay custom events scrub URL userinfo, queries and fragments,
including URLs nested in context or embedded in messages. Credential field names,
request bodies and raw query/fragment attributes are filtered. Input masking alone
never established URL privacy. Replay request-body capture is explicitly disabled.

Replay DOM metadata cannot be edited by the custom-event hook. Initial Sentry
client initialization is skipped on auth/connect and legacy credential-path routes; entering one with an
existing client stops Replay with `flush: false`, discarding the pending buffer.
Normal later routes can initialize the client. An already-stopped Replay is not
forcibly restarted or resampled during that existing SPA session.

DataFast, Plausible, Dub, Meta Pixel and Google tag scripts are not newly loaded
on auth/connect routes even with analytics consent. Plausible's provider keeps
rendering application children. This does not unload scripts that already ran
on an earlier SPA page or control an edge-injected tracker.

Backend Sentry's existing secret-body filter also covers
`/integrations/social-connect`, `/integrations/extension-refresh` and
`/integrations/moltbook` (including status polling with its API key), so moving
credentials into POST does not introduce a request-body telemetry leak there.

## Production exposure assessment (no values)

The source Sentry client enables tracing and sampled Replay only when a DSN is
configured. Before this change its beforeSend filter did not scrub query strings.
CEO reported a read-only production check on 9 November: zero SENTRY-named
variables in runtime.env and the running container, and zero PULSE-named variables
in both. This is collaborator-reported metadata, not an independent production
check by this author. It supports runtime configuration absence, not a guarantee
that no historic event was sent: NEXT_PUBLIC_SENTRY_DSN can be embedded at build
time. App layouts pass that public env value into SentryComponent; Next's static
env handling inlines NEXT_PUBLIC_ values. Confirm the deployed build's effective
DSN presence with boolean-only inspection before declaring browser Sentry inactive.
Do not print a DSN, script payload or real URL to establish that boolean.

Source injection audit:
- site/src/layouts/Base.astro adds Pulse's /js/script.js tag with data-site
  postdelegate to the marketing site. The release Dockerfile copies/builds
  apps/frontend and libraries, not the marketing site.
- No Pulse script injection was found in the inspected app frontend, shared
  React/helpers, or checked-in Caddy configuration. The app's pulse_vid handling
  carries attribution to checkout; it is not a tracker loader.
- Projects/site-analytics/injector/index.ts and its wrangler.jsonc only target
  fishbasket.co/www.fishbasket.co, not app.postdelegate.com.
- This settles the inspected source paths, not deployed edge rules, tag-manager
  configuration, generated build artifacts or past releases. Absence of a
  PULSE-named environment variable alone is not tracker absence; the marketing
  tag is hardcoded. Previous public fetches returned HTTP 403; no bypass attempted.

Pulse's inspected Projects/site-analytics/src/tracker.js sends pathname, not the
page query, as p. Without data-hash, fragments are omitted too. It sends the full
first document.referrer in the request body, while src/index.ts reduces that to a
hostname via referrerHost before persistence; outbound links also omit queries
and fragments. Raw ingestion/proxy logs are outside that persistence guarantee.
Legacy MCP keys embedded in a pathname would still need protection if Pulse is
injected there. No Pulse source, configuration or data was changed by this PR.

CEO relayed Bug Fixer's aggregate checks: zero password= matches in the examined
nginx, Caddy and app stdout logs. Counts for /integrations/social/*?code= were
still pending. Password-name counts do not cover the base64 credential object in
code=, all possible telemetry/log sinks, earlier retention or browser history.
No current evidence justifies a blanket browser-history-only exposure conclusion.

If production Sentry was enabled during affected connects, assume matching error,
trace, log or replay records may retain the old URL. Check only aggregate counts
for app auth/connect URLs containing credential parameter names. If such records
exist, the owner should arrange a scoped purge of the matching records (including
replay segments), and rotate affected rotatable credentials through the providers.
A Nostr private key cannot be rotated while keeping the same identity. Absence in
current retention does not prove old URLs were never collected.

Do not purge Pulse blindly: first verify its deployed tracker/storage behavior
and obtain aggregate matches without printing parameter values. Historic browser
history and any enabled proxy/access logs are separate exposure surfaces. No
stored-event purge is claimed or executed here.

## Verification

The component regressions run the real custom-form submit and Moltbook completion
callbacks for all ten providers using example data. They also cover blocked storage,
the extension fallback, nonce-only navigation, POST-only consumption, current-entry
history cleanup, preserving router state, tracker suppression and app rendering.

Sentry tests exercise the configured event/transaction/span/log/breadcrumb/Replay
hooks, nested URLs, raw query attributes and POST body filtering. The original
credential component fails twelve of the fifteen component regressions; restoring
the fix passes them. Full-suite and exact-head CI results are recorded on the PR.

Sources: [Sentry breadcrumb hooks](https://docs.sentry.io/platforms/javascript/guides/svelte/enriching-events/breadcrumbs/),
installed @sentry/replay types (custom recording events and stop({flush:false})),
and the checked-in Pulse tracker/ingestion source. No real credential values were
used in tests or printed during the exposure check.

## MCP setup and legacy migration

New generated setup uses the OAuth-capable `/api/mcp` resource in production
(the configured API base plus `/mcp`, including its protected-resource discovery).
The existing OAuth issuer/discovery and `/mcp-oauth-dynamic` route still work.
The canonical resource routes self-hosted OAuth connections through the existing
relay server when that feature is enabled; revoked tokens and disabled relays
remain rejected. Cloud workspace auth and subscription checks are preserved.
Clients with custom-header support can use the same resource with
`Authorization: Bearer <API key>`. Claude/ChatGPT remote connectors and NanoClaw
are directed to OAuth; no unsupported header flag or key-in-URL workaround is
invented. The API-key fallback picker lists only clients with header configs.
No new configuration contains `/mcp/<key>`.

The legacy `/mcp/:id` endpoint remains a compatibility path for already configured
clients, with the same Deprecation/Link headers as draft #182. Legacy SSE/message
paths receive those headers too. There is no trustworthy registration marker for
an installed legacy client, so this PR does not invent account-age restrictions:
it stops all new UI setup from advertising that transport and preserves existing
client behavior until the endpoint is removed. The endpoint is still technically
reachable by any valid key; this is not a new-client allowlist.

**Proposed removal: 7 February 2027**, 90 days from 9 November 2026, subject to CEO
approval and a communicated migration window. If rollout/notice starts later,
allow a full 90 days from that notice. Do not enforce removal or advertise an
approved Sunset date until that decision. No automatic removal job is scheduled. Removing the legacy path does not revoke
an API key: rotate any exposed workspace keys separately with an approved client
migration plan.

App correlation IDs are now random per request, not API keys/OAuth tokens.
Frontend/Next and backend Sentry scrub private MCP/SSE/message path segments in
URLs, trace attributes and log messages; backend error/trace bodies are filtered.
This protects the telemetry transport, not arbitrary raw stdout/debug loggers.
Authentication, forwarded request URIs, MCP sessions and tool access are unchanged.

### Release Engineer: logging checklist (not applied by this PR)

1. Inspect the effective production and staging Caddy access/runtime logging and
   downstream exports without printing real URLs, keys or Authorization values.
   The checked-in Caddyfile has no access `log` directive; that is not proof that
   live logs or exports are disabled. Do not enable logging just to apply a filter.
2. If access logging is enabled, the simplest safe choice is to skip legacy
   credential-path requests, on Caddy 2.8+ inside each relevant site block:

   ```caddyfile
   @legacyCredentials path /api/mcp/* /mcp/* /api/sse/* /sse/* /api/message/* /message/*
   log_skip @legacyCredentials
   ```

   Validate with the installed Caddy version before reload. This changes logging
   only. Do not rewrite the forwarded URI: legacy authentication needs its path.
3. If counts must be retained instead, log a fixed route template and method/status
   with a non-secret correlation id. Delete the raw `request>uri` logging field
   and any duplicate original/upstream URI fields before persistence. Query-only
   filters do not redact a credential in the path. Keep `log_credentials` disabled;
   remove Authorization, Proxy-Authorization, Cookie, Set-Cookie and Referer from
   every access/runtime/export sink. Caddy's normal sensitive-header masking does
   not establish URI or Referer privacy.
4. In app/MCP/SDK HTTP loggers and log collectors, mask `/mcp/<key>` (and old
   `/sse/<key>` / `/message/<key>`) in `url`, `originalUrl`, request targets and free
   text; never dump the raw request, headers, bodies, auth context or configured
   transport URL. Keep verbose HTTP/SDK debug logging off in production. Preserve
   only route labels, status and the new random request id. Sentry hooks do not
   sanitize a line already written to Docker stdout or another collector.
5. Apply the same policy to Cloudflare exports, reverse-proxy errors and log
   shipping/retention. Verify using synthetic markers and boolean/count-only
   checks across Caddy, app stdout and telemetry. Do not display matching records.
   Existing records need a separate scoped retention/purge decision; this PR
   neither inspects nor deletes them.

Primary references: [Caddy log_skip](https://caddyserver.com/docs/caddyfile/directives/log_skip),
[Caddy logging filters and sensitive headers](https://caddyserver.com/docs/caddyfile/directives/log).
No Caddy/app logging configuration on a server was changed here. The MCP handler
file overlaps #182: preserve its authorization/scope checks when integrating both
PRs, along with the deprecation headers and this PR's non-secret request ids.


## Final review cleanup

Custom provider URL failures are checked before a storage-specific warning.
Public connect authentication failures log only err.message, not the AxiosError
object containing request configuration/Authorization. Regression cases cover
network failure, cancel, abandoned and accepted confirmation, malformed provider
start responses, Moltbook secret bodies and Axios header exclusion.
#183 is merged first; this branch is rebased onto main including #182.
Per the release decision, root Jest uses the JSX-capable tsconfig.test.json and
has no isolatedModules transform option. Root tsconfig.spec.json is unused and
removed; apps/backend/tsconfig.spec.json remains the backend-only Jest config.
The #182 MCP scope enforcement is preserved alongside non-secret correlation
IDs and self-hosted OAuth compatibility. Validated relay connections retain
the existing API-key-equivalent scopes; revoked/disabled relays remain rejected.
