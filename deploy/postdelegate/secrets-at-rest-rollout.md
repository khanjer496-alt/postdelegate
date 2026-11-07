# Rolling out the secrets-at-rest change

Design: `docs/superpowers/specs/2026-11-07-secrets-at-rest-design.md`.
Plan: `docs/superpowers/plans/2026-11-07-secrets-at-rest.md`.

Every credential that used to go through `AuthService.fixedEncryption` now uses
either an HMAC (secrets only ever matched) or AES-256-GCM (secrets that have to
be read back). Both keys derive from the **already-deployed**
`TOKEN_ENCRYPTION_KEY`; no new environment variable. Nothing a customer holds
changes.

**This is two deploys.** Read §6 before starting: there is a point after which
rolling the image back locks every customer out of the public API.

---

## 1. Add the column and its index by hand, before the deploy

`Organization.apiKeyHash` is new and indexed. Both statements are needed, in
this order — the index alone fails with `column "apiKeyHash" does not exist`:

```sql
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "apiKeyHash" TEXT;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Organization_apiKeyHash_idx" ON "Organization"("apiKeyHash");
```

Why by hand: the schema reaches production through `prisma db push`, which the
container entrypoint runs on every deploy (`pm2-run` in `package.json`). It
emits a plain `CREATE INDEX`, which takes a SHARE lock and blocks every write
to `Organization` while it builds. Doing it concurrently first means `db push`
finds both already there and changes nothing.

Then, as on every deploy with no migration files, read the SQL `db push` would
run before letting it run:

```bash
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel libraries/nestjs-libraries/src/database/prisma/schema.prisma --script
```

## 2. Deploy

This release **writes only the new form** and **reads either**. Nothing
dual-writes. A customer whose rows the backfill has not reached authenticates
exactly as before, because every lookup also offers the legacy value and every
read falls back to it.

## 3. Backfill

Dry run first and read the report. The release image wraps the command as
`backfill-secrets`, the same way it wraps `erase-account`:

```bash
docker exec -i postdelegate-postiz-postiz-1 backfill-secrets --dry-run
```

Then for real. It is idempotent and resumable, so it can be re-run, and it can
be taken a group at a time (`org`, `oauth`, `credentials`, `integrations`):

```bash
docker exec -i postdelegate-postiz-postiz-1 backfill-secrets
```

It exits 2 when any row was `unreadable` (could not be read, never modified) or
`skippedChanged` (a reconnect, refresh or rotation landed while the batch was in
flight — re-run to pick those up). It never logs a secret value, only row ids.

Authorization codes are deliberately not converted: they expire ten minutes
after being issued, and both forms are accepted while they live.

## 4. Verify nothing legacy is left

Deploy #2 is only safe when every count here is 0:

```sql
SELECT 'Organization.apiKey' AS column, count(*) AS legacy_rows
  FROM "Organization"
  WHERE "deletedAt" IS NULL AND "apiKey" IS NOT NULL
    AND ("apiKeyHash" IS NULL OR "apiKey" NOT LIKE 'enc:v1:%')
UNION ALL SELECT 'OAuthAuthorization.accessToken', count(*)
  FROM "OAuthAuthorization"
  WHERE "accessToken" IS NOT NULL AND "accessToken" NOT LIKE 'h1:%'
UNION ALL SELECT 'OAuthApp.clientSecret', count(*)
  FROM "OAuthApp"
  WHERE "clientSecret" IS NOT NULL AND "clientSecret" NOT LIKE 'h1:%'
UNION ALL SELECT 'OAuthSelfHostedAuthorization.accessToken', count(*)
  FROM "OAuthSelfHostedAuthorization"
  WHERE "accessToken" IS NOT NULL AND "accessToken" NOT LIKE 'h1:%'
UNION ALL SELECT 'OAuthSelfHostedAuthorization.apiKey', count(*)
  FROM "OAuthSelfHostedAuthorization"
  WHERE "apiKey" IS NOT NULL AND "apiKey" NOT LIKE 'enc:v1:%'
UNION ALL SELECT 'AiCredential.apiKey', count(*)
  FROM "AiCredential"
  WHERE "apiKey" IS NOT NULL AND "apiKey" NOT LIKE 'enc:v1:%'
UNION ALL SELECT 'ThirdParty.apiKey', count(*)
  FROM "ThirdParty"
  WHERE "apiKey" IS NOT NULL AND "apiKey" NOT LIKE 'enc:v1:%'
UNION ALL SELECT 'Integration.customInstanceDetails', count(*)
  FROM "Integration"
  WHERE "customInstanceDetails" IS NOT NULL AND "customInstanceDetails" <> ''
    AND "customInstanceDetails" NOT LIKE 'enc:v1:%';
```

## 5. Deploy #2: stop accepting the legacy form

Two things to delete, and nothing else:

1. the `{ apiKey: api }` arm of the `OR` in
   `OrganizationRepository.getOrgByApiKey`, and
2. the `AuthService.fixedEncryption(value)` entry in
   `OAuthService.lookupSecrets`.

Until that deploy, **the `apiKey` column is still a directly usable bearer
token**: the lookup accepts the stored value verbatim, so a database read is
still enough to authenticate. The spec's goal of "Pattern B stops storing a
bearer token in the clear" lands with *this* deploy, not the first one. Do not
let it drift after launch.

It will also invalidate any authorization code issued in the preceding ten
minutes, since those are the one thing the backfill does not convert. The
affected customer retries the connect flow.

## 6. The rollback window

Before the backfill, rolling the image back is safe.

**After the backfill it is not.** `Organization.apiKey` then holds `enc:v1:…`
for every workspace, and the previous release matches that column by plain
equality — so a rollback would:

- reject every customer's API key on the public API,
- break every configured `/mcp/<apiKey>` URL in Claude and ChatGPT, and
- show each customer a ciphertext where their key used to be.

So: take the backup before §3, and if something is wrong after the backfill,
roll **forward** with a fix rather than back. Restoring the pre-backfill
database would also undo it, at the cost of everything written since.

## 7. Rotating `TOKEN_ENCRYPTION_KEY`

Set the new key in `TOKEN_ENCRYPTION_KEY` and the old one in
`TOKEN_ENCRYPTION_KEY_PREVIOUS`, deploy, then:

```bash
docker exec -i postdelegate-postiz-postiz-1 backfill-secrets --rotate
```

That moves everything it can onto the new key. **It cannot move everything.**
An HMAC cannot be recomputed without the plaintext, and for these the plaintext
is held only by the customer:

- `OAuthAuthorization.accessToken`
- `OAuthApp.clientSecret`
- `OAuthSelfHostedAuthorization.accessToken`

So `TOKEN_ENCRYPTION_KEY_PREVIOUS` has to stay until those credentials are
re-issued — or you invalidate them deliberately, which forces every connected
app to authorise again. The command prints this list when run with `--rotate`.
`Organization.apiKeyHash` is not in it: its key is recoverable from the
encrypted copy in the same row, so it is re-hashed.

## 8. What stays coupled to `JWT_SECRET`

Two callers of `fixedEncryption` remain:

1. the lifetime-deal code format (`codes.service.ts`,
   `StripeService.lifetimeDeal`) — those codes are already in customers' hands,
   so the scheme cannot change without invalidating them;
2. `skool.provider.ts`, which pre-encrypts its cookie JSON into
   `Integration.token`, a column the repository then encrypts again with
   `token.encryption.ts`. Nothing reads that inner layer (`getCookies` reads
   `customInstanceDetails`), so it was left alone rather than changing a stored
   format on a deliberately hidden provider — but rotating `JWT_SECRET` does
   silently change what Skool writes there from then on.

Rotating `JWT_SECRET` also signs out every session by design, through
`AuthService.passwordFingerprint`. It is not a quiet change.
