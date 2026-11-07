# Rolling out the secrets-at-rest change

Design: `docs/superpowers/specs/2026-11-07-secrets-at-rest-design.md`.
Plan: `docs/superpowers/plans/2026-11-07-secrets-at-rest.md`.

This release moves every credential that used to go through
`AuthService.fixedEncryption` onto either an HMAC (secrets that are only ever
matched) or AES-256-GCM (secrets that have to be read back). Both keys derive
from the **already-deployed** `TOKEN_ENCRYPTION_KEY`; no new environment
variable is needed. Nothing a customer holds changes.

## 1. Create the index by hand, before the deploy

`Organization.apiKeyHash` is new and indexed. The schema arrives via
`prisma db push`, which emits a plain `CREATE INDEX` and takes a SHARE lock
that blocks every write to the table while it builds. Create it concurrently
first, so `db push` finds it already there:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Organization_apiKeyHash_idx" ON "Organization"("apiKeyHash");
```

Then, as on every deploy with no migration files, read the SQL `db push` would
run before letting it run:

```bash
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel libraries/nestjs-libraries/src/database/prisma/schema.prisma --script
```

## 2. Deploy

This release **writes both** the new and the legacy forms where it must, and
**reads either** everywhere. A customer whose rows have not been converted yet
authenticates exactly as before.

## 3. Backfill

(Filled in by Task 6 — dry run first, read the report, then for real.)

## 4. Verify, then stop writing the legacy form

Dropping the legacy read paths is a **separate, later deploy**. A single deploy
that reads only the new form would lock out every customer whose row the
backfill had not reached.

## 5. What stays coupled to `JWT_SECRET`

After this work, `fixedEncryption` keeps exactly one caller: the lifetime-deal
code format (`codes.service.ts`, `stripe.service.ts`'s `lifetimeDeal`). Those
codes are already in customers' hands, so the scheme cannot change without
invalidating them.

Note also that rotating `JWT_SECRET` signs out every session by design, through
`AuthService.passwordFingerprint`. It is not a quiet change.
