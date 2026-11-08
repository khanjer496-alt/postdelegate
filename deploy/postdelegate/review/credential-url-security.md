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
onboarding flag. A network failure retains the handoff for retry; a backend
response consumes it as before. Real OAuth codes still reach the POST body.

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
client initialization is skipped on auth/connect routes; entering one with an
existing client stops Replay with `flush: false`, discarding the pending buffer.
Normal later routes can initialize the client. An already-stopped Replay is not
forcibly restarted or resampled during that existing SPA session.

DataFast, Plausible, Dub, Meta Pixel and Google tag scripts are not newly loaded
on auth/connect routes even with analytics consent. Plausible's provider keeps
rendering application children. This does not unload scripts that already ran
on an earlier SPA page or control an edge-injected tracker.

Backend Sentry's existing secret-body filter also covers
`/integrations/social-connect` and `/integrations/extension-refresh`, so moving
credentials into POST does not introduce a request-body telemetry leak there.

## Production exposure assessment (no values)

The source Sentry client enables tracing and sampled Replay only when a DSN is
configured. Before this change its beforeSend filter did not scrub query strings.
Production DSN presence and event retention have not been established here.
Public requests to both app.postdelegate.com/auth/login and the Pulse tracker
returned HTTP 403; no bypass was attempted. CEO has been asked for booleans and
aggregate parameter-name counts only, never DSN values or event payloads.

Pulse's local source at Projects/site-analytics/src/tracker.js sends pathname,
not the page query, as `p`. It sends a full first referrer in the request payload,
but index.ts reduces that to a hostname via referrerHost before persistence;
outbound links also omit queries/fragments. This describes the inspected source,
not proof of the deployed version or historic retained events. No Pulse source,
Cloudflare config or data was changed by this PR.

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
