# Secrets at rest: off `fixedEncryption` — design

**Status:** approved to build, 7 Nov 2026
**Origin:** finding A1 of `SECURITY-AUDIT-2026-11-07.md`
**Decided by:** Claude, delegated by Naser. Calls marked **[my call]** are mine,
not his.

---

## Intent and the why

`AuthService.fixedEncryption` / `fixedDecryption`
(`libraries/helpers/src/auth/auth.service.ts`) is AES-256-CBC with **both the
key and the IV** derived by `EVP_BytesToKey` (MD5) from `JWT_SECRET`. It has no
MAC, it is deterministic, and it is reversible with nothing but `JWT_SECRET`.

Today it carries the credentials that a breach would hurt customers with most.
The audit first described this as one problem; reading the call sites shows it
is **three different problems wearing one function**, and they need three
different fixes. That distinction is the whole point of this design.

### Pattern A — deterministic ciphertext used as a lookup hash

The customer holds the plaintext; the server encrypts what it is given and
compares ciphertext.

| Secret | Site |
|---|---|
| OAuth access tokens (`pos_`, `psh_`) | `oauth.service.ts:584,668,794,812` |
| OAuth refresh tokens | `oauth.service.ts:720,871` |
| OAuth authorization codes | `oauth.service.ts:484,525,572,654` |
| OAuth app client secrets | `oauth.service.ts:130,170,279,554` |

These never need to be read back — only matched. Storing them reversibly is
pure downside: `JWT_SECRET` plus a database read yields live bearer tokens for
every connected app.

### Pattern B — the stored value *is* the issued credential

`Organization.apiKey` is `fixedEncryption(makeSecureId(20))`
(`organization.repository.ts:38,260,530`). The random id is **discarded**; the
ciphertext is what the customer is handed, and `getOrgByApiKey` matches it with
plain equality (`:72-77`). It is never decrypted anywhere.

So this is not encryption at all — it is a convoluted random-string generator,
and the database stores the bearer token **in the clear**. A database read is a
working keyring with no secret needed. (Correspondingly, and contrary to what
the audit first said, rotating `JWT_SECRET` does *not* break org API keys.)

### Pattern C — genuinely encrypted and genuinely recoverable

Decrypted at use because the plaintext is replayed to someone else.

| Secret | Site |
|---|---|
| Customers' own AI API keys (BYO OpenAI) | `ai.credential.repository.ts:21,25`, read `ai.credential.service.ts:24,66` |
| Third-party integration keys | `third-party.controller.ts:87,120,149` |
| Self-hosted MCP relay API key | `oauth.service.ts:523,803` |
| `Integration.customInstanceDetails`: Bluesky app passwords, Lemmy, Listmonk, custom Mastodon, Skool credentials, **and Chrome-extension cookie jars** | written `no.auth.integrations.controller.ts:312,314,318,514`; read in 6 providers |

`customInstanceDetails` was missed by the audit and matters: a Bluesky app
password is a live credential to someone's account, stored under the weakest
scheme in the codebase while the OAuth tokens next to it got AES-256-GCM.

### The model to follow

The fork already solved this correctly once, for social tokens:
`libraries/nestjs-libraries/src/database/prisma/integrations/token.encryption.ts`
— AES-256-GCM, random 12-byte IV per value, an AAD binding ciphertext to
purpose, a dedicated `TOKEN_ENCRYPTION_KEY` never derived from `JWT_SECRET`,
retired-key support for rotation, a decrypt that throws rather than returning
garbage, an `enc:v1:` prefix so legacy plaintext keeps working, and a
round-trip-verifying backfill in `integration.token.backfill.service.ts`.

This work extends that design to the rest. It invents nothing.

---

## Goals

1. No credential in the database is recoverable from `JWT_SECRET`.
2. Pattern A secrets become **non-reversible**: a database read yields no usable
   token.
3. Pattern B stops storing a bearer token in the clear. **Lands with deploy
   #2, not the first one:** while the lookup still accepts the stored value
   verbatim, a database read is still enough to authenticate. See §5 of the
   rollout runbook.
4. Pattern C moves onto authenticated encryption with a rotatable key.
5. **Zero customer disruption.** Every API key, OAuth token, authorization code
   and connected channel that works before the deploy works after it.
6. `JWT_SECRET` becomes rotatable, with the documented exceptions below.
   **`TOKEN_ENCRYPTION_KEY` is rotatable only in part**, and this is a property
   of HMACs rather than an omission: a hash cannot be recomputed without the
   plaintext, and for an OAuth access token or client secret the plaintext is
   held only by the customer. Those columns keep working through
   `TOKEN_ENCRYPTION_KEY_PREVIOUS`, which therefore cannot be retired until the
   credentials are re-issued. Everything encrypted, plus `apiKeyHash` (whose key
   is recoverable from the encrypted copy beside it), is moved by
   `backfill-secrets --rotate`.

## Non-goals

- Changing any wire format, URL, or anything a customer sees or has configured.
- Re-issuing or invalidating any existing credential.
- Fixing the other audit findings (sessions, Redis, CSP, port 22).
- Full `JWT_SECRET` rotation as part of this work; this only makes it possible.

## Anti-goals — this work has failed, even if it ships, if

- Any customer's API key, OAuth token or connected channel stops working.
- A backfill writes a value that does not read back as the original.
- A missing or malformed environment variable at boot breaks authentication.
  **This is the main risk:** authentication lookups move onto a derived key, so
  a key problem is an outage, not a degraded feature.
- A secret value reaches a log.

---

## Constraints

- Live production, paying users, 18 live networks. Deploys go build → staging →
  browser click-through → production with a backup (`CLAUDE.md`, memory).
- **No Prisma migration files**; schema arrives via `prisma db push`, which
  emits plain `CREATE INDEX` and takes a SHARE lock. Any index this work adds
  must be created by hand with `CREATE INDEX CONCURRENTLY` **before** the
  deploy, exactly as the five indexes in `STATUS-2026-11-06.md` required.
- Three layers, no shortcuts: DTO → Controller → Service → Repository. Most
  logic in `libraries/`.
- Generic code stays generic: no provider name may appear in a shared path. The
  per-field AAD labels are data passed in by the caller, never a branch.
- Prod is currently serving `release-8019c35b`, behind `main` (`8cd62a23`).

---

## The design

### One module, two primitives

New: `libraries/nestjs-libraries/src/database/prisma/secrets/secret.crypto.ts`

- `secretHash(value, label)` → `'h1:' + base64url(HMAC-SHA256(key, label + ':' + value))`
  for Pattern A and for Pattern B's lookup column.
- `secretEncrypt(value, label)` / `secretDecrypt(value, label)` → the existing
  `enc:v1:` AES-256-GCM scheme for Patterns B (display) and C.

Both take an explicit `label`, folded into the AAD (encryption) or the HMAC
input (hashing), so a ciphertext or hash from one field can never be replayed
into another. Labels are constants declared next to each call site.

**[my call] Keys are derived, not added.** Both primitives derive from the
already-deployed `TOKEN_ENCRYPTION_KEY` via HKDF-SHA256 with distinct `info`
strings, rather than introducing a new environment variable. Rationale: a new
required variable that is missing at boot is an authentication outage on a live
box, and this deployment sets env through two files where one already sets keys
to empty (audit A10). One key, already present, already 32 bytes, already
rotatable. `TOKEN_ENCRYPTION_KEY_PREVIOUS` continues to work: decryption tries
each key as it does today, and **hash lookups query the set of candidate
hashes** (`where: { in: [...] }`) so a rotation does not break lookups.

**[my call] `fixedEncryption` is not deleted.** It keeps exactly one caller —
the lifetime-deal code scheme (`codes.service.ts`, `stripe.service.ts:2878`),
which mints 10,000 redeemable codes by encrypting `"<token>:<index>"` and
verifies a redemption by decrypting it. Those codes are already in customers'
hands; changing the scheme invalidates them. It is a code format, not secret
storage, so it is left alone and documented as the single remaining
`JWT_SECRET` coupling. The function gets a comment saying so, so nobody reaches
for it again.

### Pattern A — replace ciphertext lookup with HMAC

Mechanical: every `findBy...(fixedEncryption(x))` becomes
`findBy...(secretHash(x, LABEL))`, and every write stores the hash.

Migration is lossless and invisible: the stored ciphertext is decryptable
today, so the backfill decrypts it, hashes the plaintext, writes the hash.
Existing tokens keep working because the token itself never changes.

Client secrets get `timingSafeEqual` on the hash (audit A10), replacing the
`!==` at `oauth.service.ts:554`.

### Pattern B — split lookup from display

`Organization.apiKey` is displayed: `users.controller.ts:128` returns it as
`user.publicApi`, the onboarding modal reveals and copies it
(`onboarding.modal.tsx:255-304`), the public-api page shows it as a Bearer
token, **and it is embedded in MCP URLs** (`/mcp/<apiKey>`) that customers have
already configured in Claude and ChatGPT. It therefore has to stay recoverable;
hashing it alone would break working setups and a UI customers use.

So, two columns:

- **new** `apiKeyHash String?` with an index — `secretHash`, the only thing
  queried.
- existing `apiKey` — re-stored as `secretEncrypt(...)`, decrypted only on the
  display path.

Net: the lookup is non-reversible, and the displayable copy needs a key that is
not `JWT_SECRET` and can be rotated. Existing keys keep working untouched.

**[my call]** Pure hashing with show-once-on-rotate is the stronger design and
is wrong for right now: it breaks configured MCP URLs and a settings page days
before a paid launch. Worth revisiting after launch; the `apiKeyHash` column
this adds is the half that would survive that change.

### Pattern C — AES-GCM with a per-field label

Each field moves to `secretEncrypt`/`secretDecrypt` with its own label, reading
legacy values through a fallback: not encrypted with the new prefix → try
`fixedDecryption` → if that yields something, re-encrypt on next write. Same
shape as `token.encryption.ts`'s legacy-plaintext path, which is proven in
production.

`customInstanceDetails` is the delicate one: six providers read it, it is
sometimes JSON and sometimes a raw credential, and it is written from three
branches in one controller expression. The read goes through one helper so no
provider learns about encryption.

### Rollout

1. `CREATE INDEX CONCURRENTLY` for `apiKeyHash` by hand, before the deploy.
2. Deploy code that **writes both** old and new forms and **reads either**.
3. Run the backfill (dry run, read the report, then for real).
4. Verify no legacy values remain, then stop writing the old form.
5. Only then is `JWT_SECRET` rotatable — and the lifetime-deal codes still are
   not.

Steps 2 and 4 are separate deploys. A single deploy that reads only the new
form would lock out every customer whose row has not been backfilled yet.

---

## Left to the builder

- Batch sizes, progress reporting and CLI flags for the backfill: follow
  `integration.token.backfill.service.ts`.
- Whether the backfill is one command per pattern or one with subcommands.
- Exact label strings, as long as they are distinct, constant, and
  field-specific.
- Test file placement, following each module's existing `*.spec.ts` neighbour.
