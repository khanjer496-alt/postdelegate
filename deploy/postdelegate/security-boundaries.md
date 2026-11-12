# Security boundary release notes

This change is PR preparation only. It does not apply database changes or deploy.

Before releasing the application, take the approved database/configuration backup and inspect `prisma migrate diff` against the target release schema. Use `--from-schema-datasource <target-schema> --to-schema-datamodel <target-schema> --script` with the target image's schema and the database environment supplied securely. Review the emitted SQL before the image's startup `prisma db push` can run; stop for unrelated drift or destructive changes. Then apply `payment-webhook-events.sql` through the approved release process and repeat the diff: it should be empty. The Prisma schema describes the same table. It stores provider/event identifiers, a random claim token, claim expiry, and completion time; no webhook payload or customer data. Do not delete completed markers while replay protection is required.

Concurrent deliveries claim the event in a short atomic database operation. Other workers return a retry response while it is pending. A live worker renews its 15-minute lease every minute; a crashed worker's lease becomes reclaimable. Failed financial effects remain retryable. Completed deliveries skip the handler. This is at-least-once processing: a process crash after an external side effect and before its completion marker can still repeat that effect. Existing invoice commission and reversal operations are idempotent. Qualify concurrent claims, lease expiry, failure/replay and the SQL on staging PostgreSQL before deployment.

Filtered or unsupported events are acknowledged before a ledger claim is created, so they remain replayable after configuration changes. A catalog mismatch also releases its claim and returns a successful webhook acknowledgement without changing entitlements. It logs `stripe_catalog_mismatch` and emits an error-level Sentry message; configure the application's Sentry alert routing to notify operators. After correcting the catalog/metadata, replay the event. Database or Stripe transport failures remain retryable.

Plan metadata is matched against server-owned catalog product identities, USD currency, actual recurring interval, one plan item and add-on limits. Prices are retrieved from Stripe; customer-provided metadata or price-shaped fields cannot identify a higher tier. Known named legacy products and inactive/historical prices are accepted, including prices with an earlier amount or a removed lookup key. Historical add-on prices are counted by product identity even if their lookup key was moved. Qualify current, retired and invalid catalog fixtures on staging before release. No live catalog was inspected for this PR.

## Rollback

Use a separately approved rollback image and preserve the current secrets and Temporal data. This PR does not reverse the earlier secrets-at-rest migration. Before changing images, run `prisma migrate diff` from the database to the **rollback image's** schema as above. A pre-PR schema can request deletion of `PaymentWebhookEvent`; do not let an unattended `db push` decide a destructive schema change.

Stop the new application/worker so no event handler or lease heartbeat is using the table. After verifying the backup and reviewing the rollback diff, explicitly apply the required rollback SQL through the approved database process:

```sql
DROP TABLE "PaymentWebhookEvent";
```

This permanently loses all completed replay markers and pending claims. Previously delivered events can execute again after rollback or a later re-upgrade; review financial side-effect reconciliation before replaying them. The older release has no event-ID ledger. Re-run the schema diff and require only reviewed changes (normally empty after the drop), then start the rollback image and check API/worker health, logins, existing keys and MCP. Do not restore an old encryption configuration or delete Temporal/database volumes. A later forward deployment must recreate the table before starting this PR's application. This document does not authorize any SQL execution or deployment.

Every MCP tool has a server-owned required scope. Reads require `mcp:read`, mutations and unknown/new tools require `mcp:write`; the catch-all agent requires both because it may call nested tools. OAuth currently issues both MCP scopes on every authorization; this change enforces those issued grants and does not introduce a consent UI for reduced-scope grants. API keys retain workspace read/write access.

The plugin uses `/api/mcp` and OAuth or an Authorization header, but the app's Agents / Dev examples and tutorial documentation still expose legacy key-in-URL setup. Keep `/mcp/:id` and SSE key-in-URL endpoints for existing clients; they now return deprecation headers and the client guide explains migration. No removal date is scheduled. Migrate app examples and audit existing client usage before separately retiring these endpoints. No production logs or usage data were read.

Media URL uploads accept public HTTP(S) only, validate every redirect, pin DNS, and apply a 120-second request/body deadline. Public preview remains HTTPS-only with the same deadline. Studio normally resolves organization-owned storage objects or local files; its remote signed-storage path now uses the same SSRF helper. The explicit self-hosted `DISABLE_SSRF_PROTECTION` setting continues to opt out of private-IP filtering, but never permits non-HTTP schemes. Streamed upload caps are applied to actual bytes after MIME sniffing, independently of Content-Length; both local and R2 providers await stream completion and propagate stream errors.

Both providers' `uploadSimple` path uses the shared safe fetch with HTTPS-only URLs, manual validated redirects and its 15-second deadline. It caps actual downloaded bytes at 10 MiB, cancels oversized bodies, rejects non-success downloads and applies the same decoded size cap to data URLs before writing a file/object. MIME sniffing and the existing type allowlist still apply.

Public v1 business routes live in `PublicIntegrationsController`. `PublicApiModule.configure` applies `PublicAuthMiddleware` to that entire controller. It validates API keys or OAuth credentials, resolves the organization, and sets `request.org`; operator overrides require the explicit admin feature and authorization. OpenAPI discovery is deliberately public. Tests enumerate every decorated business route for anonymous rejection and assert module-wide middleware registration.
