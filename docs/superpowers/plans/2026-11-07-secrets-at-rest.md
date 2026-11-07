# Secrets at rest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No credential in the database is recoverable from `JWT_SECRET`, with every existing API key, OAuth token and connected channel still working.

**Architecture:** One new module exposes two primitives — an HMAC for secrets that are only ever matched, and the existing AES-256-GCM scheme for secrets that must be read back — both keyed off subkeys derived from the already-deployed `TOKEN_ENCRYPTION_KEY`, both taking a per-field label so a value cannot be replayed between fields. Each of the three call-site patterns moves over behind dual-write/dual-read, then a round-trip-verifying backfill converts the rows, as `integration.token.backfill.service.ts` already does for social tokens.

**Tech Stack:** NestJS 11, Prisma, node `crypto` (hkdf, HMAC-SHA256, AES-256-GCM), Jest.

**Spec:** `docs/superpowers/specs/2026-11-07-secrets-at-rest-design.md`

## Global Constraints

- Node `crypto` only. No new dependency, and no new environment variable — both keys derive from `TOKEN_ENCRYPTION_KEY` by HKDF-SHA256.
- `AuthService.fixedEncryption` / `fixedDecryption` keep exactly one caller after this work: `codes.service.ts` and `stripe.service.ts:2878` (the lifetime-deal code format). Every other caller is migrated.
- Every secret-bearing field keeps a legacy read path for the whole of this work. No task may make a read reject a value written by the previous release.
- No secret value in any log, error message, or test name.
- Layers: DTO → Controller → Service → Repository, no shortcuts. Crypto lives in `libraries/`, never in a controller.
- Generic code stays generic: labels are constants passed by callers. No provider name may appear in a shared code path.
- Prefixes: `h1:` for a hash, `enc:v1:` for ciphertext (the existing one).
- Branch `pd/secrets-at-rest` off `8cd62a23`. Commit after every task.

## Review Focus

Five failure modes the spec implies that no task's happy path exercises. Each has its test added to the task that owns the code.

1. **`TOKEN_ENCRYPTION_KEY` unset** (self-host default): hashing has no key. Authentication must keep working via the legacy read path and warn once — never authenticate against an empty key, never 500 on every request. *(Task 1, Task 3)*
2. **An empty or whitespace credential presented**: must never match a row whose column is `null` or `''`. The erased-channel sentinel is `''`. *(Task 3, Task 5)*
3. **Rotation**: a token issued under `TOKEN_ENCRYPTION_KEY_PREVIOUS` must still authenticate, which means lookups query the candidate set, not one hash. *(Task 1, Task 2)*
4. **Double conversion**: hashing a hash, or encrypting a ciphertext, must be a no-op so the backfill is re-runnable and a dual-write cannot corrupt a row. *(Task 1, Task 6)*
5. **`customInstanceDetails` shape**: sometimes JSON, sometimes a raw credential, sometimes `''`, sometimes `null`. The read helper must return each unchanged in kind and never throw for the erased sentinel. *(Task 5)*

---

### Task 1: The secret crypto module

**Files:**
- Create: `libraries/nestjs-libraries/src/database/prisma/secrets/secret.crypto.ts`
- Test: `libraries/nestjs-libraries/src/database/prisma/secrets/secret.crypto.spec.ts`

**Interfaces:**
- Consumes: nothing. Read `token.encryption.ts` first and mirror its structure, comment style, caching and `reset()` test hook.
- Produces:

```ts
export const SECRET_HASH_PREFIX = 'h1:';
export class SecretCryptoError extends Error {}

export const SecretCrypto = {
  isEnabled(): boolean;
  isHashed(value: unknown): value is string;
  hash(value: string, label: string): string;            // 'h1:' + base64url(HMAC)
  hashCandidates(value: string, label: string): string[]; // current key first, then each previous key
  isEncrypted(value: unknown): value is string;
  encrypt<T extends string | null | undefined>(value: T, label: string): T;
  decrypt<T extends string | null | undefined>(value: T, label: string): T;
  needsEncryption(value: string | null | undefined): boolean;
  warnIfDisabled(log?: (message: string) => void): void;
  reset(): void;
};

// New prefix → decrypt. No prefix → AuthService.fixedDecryption. Returns null
// for null/'' without touching either path.
export const readLegacySecret = (
  value: string | null | undefined,
  label: string
): string | null;
```

Key derivation: HKDF-SHA256 over `TOKEN_ENCRYPTION_KEY` (32 bytes, base64), salt empty, `info` of `postdelegate:secret-hmac:v1` for `hash` and `postdelegate:secret-aead:v1` for `encrypt`/`decrypt`. `label` is folded into the HMAC input as `label + ':' + value`, and into the AAD as `postdelegate:secret:v1:' + label`.

- [ ] **Step 1: Write the failing tests**

```ts
describe('SecretCrypto', () => {
  const KEY = Buffer.alloc(32, 7).toString('base64');
  beforeEach(() => { process.env.TOKEN_ENCRYPTION_KEY = KEY; SecretCrypto.reset(); });

  it('hashes deterministically with the h1: prefix', () => {
    expect(SecretCrypto.hash('tok', 'a')).toBe(SecretCrypto.hash('tok', 'a'));
    expect(SecretCrypto.hash('tok', 'a').startsWith(SECRET_HASH_PREFIX)).toBe(true);
  });

  it('separates labels, so a hash cannot be replayed into another field', () => {
    expect(SecretCrypto.hash('tok', 'a')).not.toBe(SecretCrypto.hash('tok', 'b'));
  });

  it('does not derive from JWT_SECRET', () => {
    const before = SecretCrypto.hash('tok', 'a');
    process.env.JWT_SECRET = 'something-else';
    SecretCrypto.reset();
    expect(SecretCrypto.hash('tok', 'a')).toBe(before);
  });

  it('round-trips encryption and binds the label', () => {
    const enc = SecretCrypto.encrypt('secret', 'a');
    expect(enc).not.toContain('secret');
    expect(SecretCrypto.decrypt(enc, 'a')).toBe('secret');
    expect(() => SecretCrypto.decrypt(enc, 'b')).toThrow(SecretCryptoError);
  });

  it('uses a fresh IV per value', () => {
    expect(SecretCrypto.encrypt('secret', 'a')).not.toBe(SecretCrypto.encrypt('secret', 'a'));
  });

  // Review Focus 4
  it('is a no-op on an already converted value', () => {
    const enc = SecretCrypto.encrypt('secret', 'a');
    expect(SecretCrypto.encrypt(enc, 'a')).toBe(enc);
    const h = SecretCrypto.hash('tok', 'a');
    expect(SecretCrypto.hash(h, 'a')).toBe(h);
  });

  // Review Focus 3
  it('offers the previous key as a lookup candidate', () => {
    const old = SecretCrypto.hash('tok', 'a');
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
    process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS = KEY;
    SecretCrypto.reset();
    const candidates = SecretCrypto.hashCandidates('tok', 'a');
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toBe(SecretCrypto.hash('tok', 'a'));
    expect(candidates).toContain(old);
  });

  // Review Focus 1
  it('reports disabled and returns no candidates without a key', () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    SecretCrypto.reset();
    expect(SecretCrypto.isEnabled()).toBe(false);
    expect(SecretCrypto.hashCandidates('tok', 'a')).toEqual([]);
    expect(SecretCrypto.encrypt('secret', 'a')).toBe('secret');
  });

  it('throws on a malformed key rather than storing plaintext', () => {
    process.env.TOKEN_ENCRYPTION_KEY = 'too-short';
    SecretCrypto.reset();
    expect(() => SecretCrypto.hash('tok', 'a')).toThrow(SecretCryptoError);
  });

  it('throws, never returns garbage, on a tampered ciphertext', () => {
    const enc = SecretCrypto.encrypt('secret', 'a');
    expect(() => SecretCrypto.decrypt(enc.slice(0, -2) + 'xy', 'a')).toThrow(SecretCryptoError);
  });
});

describe('readLegacySecret', () => {
  it('reads a new value, a legacy fixedEncryption value, and passes empties through', () => {
    expect(readLegacySecret(SecretCrypto.encrypt('v', 'a'), 'a')).toBe('v');
    expect(readLegacySecret(AuthService.fixedEncryption('v'), 'a')).toBe('v');
    expect(readLegacySecret('', 'a')).toBe(null);
    expect(readLegacySecret(null, 'a')).toBe(null);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx jest libraries/nestjs-libraries/src/database/prisma/secrets/secret.crypto.spec.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `secret.crypto.ts` to the Interfaces block above**

`hash` returns its input unchanged when already prefixed (Review Focus 4). `hashCandidates` returns `[]` when no key is configured, so a caller can tell "no key" from "no match". Cache derived subkeys keyed on the raw env values, as `token.encryption.ts` caches its keys, and invalidate in `reset()`.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: the same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libraries/nestjs-libraries/src/database/prisma/secrets/
git commit -m "feat(secrets): HMAC and AES-GCM primitives keyed off TOKEN_ENCRYPTION_KEY"
```

---

### Task 2: OAuth secrets — ciphertext lookup becomes HMAC

Pattern A. The customer's token never changes; only how the row is matched.

**Files:**
- Modify: `libraries/nestjs-libraries/src/database/prisma/oauth/oauth.service.ts` (lines 130, 170, 279, 484, 523–525, 554, 572, 584, 654, 668, 720, 794, 812, 871)
- Modify: `libraries/nestjs-libraries/src/database/prisma/oauth/oauth.repository.ts` — every finder named in those sites
- Test: `libraries/nestjs-libraries/src/database/prisma/oauth/oauth.service.secrets.spec.ts`

**Interfaces:**
- Consumes: `SecretCrypto.hash`, `SecretCrypto.hashCandidates`, `SECRET_HASH_PREFIX` from Task 1.
- Produces: labels `oauth-access-token`, `oauth-refresh-token`, `oauth-code`, `oauth-client-secret`, exported as `OAUTH_SECRET_LABELS` from `oauth.service.ts` for Task 6's backfill.

Finder signatures change from one value to a candidate list; repository finders take `string[]` and query `{ in: hashes }` (Review Focus 3). Each finder's `where` keeps the legacy ciphertext as an alternative for this release: `{ OR: [{ col: { in: hashes } }, { col: legacyCiphertext }] }`.

- [ ] **Step 1: Write the failing tests**

```ts
it('finds an authorization by the hash of the presented token', async () => { /* repository called with hashCandidates(token, 'oauth-access-token') */ });
it('still finds one stored as legacy ciphertext', async () => { /* row written with fixedEncryption is found */ });
it('stores a new access token hashed, not reversibly', async () => { /* written value starts with h1: and fixedDecryption of it does not yield the token */ });
it('rejects a wrong client secret and accepts the right one', async () => { /* via timingSafeEqual on the hash */ });
// Review Focus 2
it('never matches a row when the presented token is empty', async () => { /* '' and '   ' both return null without querying */ });
// Review Focus 1
it('falls back to the legacy lookup when no key is configured', async () => { /* TOKEN_ENCRYPTION_KEY unset: still authenticates */ });
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx jest oauth.service.secrets.spec.ts`

- [ ] **Step 3: Replace each `fixedEncryption` lookup and write in the sites listed above**

Writes store the hash. Reads pass `hashCandidates(...)` plus the legacy ciphertext. The client-secret comparison at `:554` becomes `crypto.timingSafeEqual` over equal-length hash buffers, guarding unequal lengths first.

- [ ] **Step 4: Run them and confirm they pass**

- [ ] **Step 5: Run the existing OAuth and MCP suites to prove nothing regressed**

Run: `npx jest oauth mcp`
Expected: PASS, no snapshot or behaviour change.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(oauth): match tokens, codes and client secrets by HMAC"
```

---

### Task 3: Organization API key — hashed lookup, encrypted display

Pattern B. Adds the one new column, so this is the task that carries the index note.

**Files:**
- Modify: `libraries/nestjs-libraries/src/database/prisma/schema.prisma` (`Organization`: add `apiKeyHash String?` and `@@index([apiKeyHash])`)
- Modify: `libraries/nestjs-libraries/src/database/prisma/organizations/organization.repository.ts:38,72-77,260,530`
- Modify: `libraries/nestjs-libraries/src/database/prisma/organizations/organization.service.ts` — the display path feeding `users.controller.ts:128`
- Test: `libraries/nestjs-libraries/src/database/prisma/organizations/organization.apikey.spec.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces: label `org-api-key`; `OrganizationRepository.getOrgByApiKey(api: string)` keeps its signature and return type; a new `issueApiKey(): { key: string; stored: string; hash: string }` used by all three creation sites so the three never drift.

The issued key stays `makeSecureId(20)`-shaped so nothing downstream sees a format change — but note it is now the plaintext id, not a ciphertext, so new keys look different in length from old ones. Both must work.

- [ ] **Step 1: Write the failing tests**

```ts
it('issues a key, stores it encrypted, and indexes its hash', () => { /* stored starts enc:v1:, hash starts h1:, neither equals the key */ });
it('finds the org by hash for a new key', async () => {});
it('finds the org by the legacy column for a key issued before this change', async () => {});
it('returns the key for display by decrypting the stored copy', async () => {});
// Review Focus 2
it('returns null for an empty or whitespace key and never matches a null column', async () => {});
```

- [ ] **Step 2: Run them and confirm they fail**

- [ ] **Step 3: Implement `issueApiKey`, the dual-write at the three creation sites, the dual-read in `getOrgByApiKey`, and the decrypt-on-display path**

`getOrgByApiKey` queries `{ OR: [{ apiKeyHash: { in: hashes } }, { apiKey: api }] }` with `deletedAt: null` kept. Reject an empty/whitespace argument before querying. The display path uses `readLegacySecret(org.apiKey, 'org-api-key')` so a legacy row still renders.

- [ ] **Step 4: Run them and confirm they pass, then run the auth middleware and public-API suites**

Run: `npx jest organization public.auth auth.middleware`

- [ ] **Step 5: Write the index note into the deploy runbook**

Add to `deploy/postdelegate/` the exact statement to run by hand **before** the deploy, because `prisma db push` emits a locking `CREATE INDEX`:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Organization_apiKeyHash_idx" ON "Organization"("apiKeyHash");
```

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(org): look up API keys by HMAC, store the displayable copy encrypted"
```

---

### Task 4: Recoverable service credentials

Pattern C, the three simple fields. `customInstanceDetails` is Task 5 because it has six readers.

**Files:**
- Modify: `libraries/nestjs-libraries/src/database/prisma/ai-credentials/ai.credential.repository.ts:21,25`
- Modify: `libraries/nestjs-libraries/src/database/prisma/ai-credentials/ai.credential.service.ts:24,66`
- Modify: `apps/backend/src/api/routes/third-party.controller.ts:87,120,149`
- Modify: `libraries/nestjs-libraries/src/database/prisma/oauth/oauth.service.ts:523,803`
- Test: `libraries/nestjs-libraries/src/database/prisma/ai-credentials/ai.credential.secrets.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`SecretCrypto.encrypt`, `readLegacySecret`).
- Produces: labels `ai-credential`, `third-party-key`, `mcp-relay-key`.

The third-party reads sit in a controller, which breaks the layering rule the moment they change. Move the decrypt into the third-party service and have the controller call that; the controller should not know a credential is encrypted.

- [ ] **Step 1: Write the failing tests**

```ts
it('stores an AI key with the new scheme and reads it back', async () => {});
it('reads a key stored by the previous release', async () => { /* fixedEncryption value */ });
it('masks from the decrypted value, whichever scheme stored it', async () => { /* mask() output unchanged */ });
it('does not put the key in the error when OpenAI rejects it', async () => {});
```

- [ ] **Step 2: Run them and confirm they fail**

- [ ] **Step 3: Switch each site to `SecretCrypto.encrypt(value, LABEL)` on write and `readLegacySecret(value, LABEL)` on read, and move the third-party decrypt behind its service**

- [ ] **Step 4: Run them and confirm they pass**

Run: `npx jest ai.credential third-party oauth`

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(secrets): AI, third-party and relay credentials on AES-GCM"
```

---

### Task 5: `customInstanceDetails`

Six providers read it; none of them may learn that it is encrypted.

**Files:**
- Modify: `libraries/nestjs-libraries/src/database/prisma/integrations/integration.repository.ts:539,577,586`
- Modify: `apps/backend/src/api/routes/no.auth.integrations.controller.ts:312,314,318,514`
- Modify readers: `bluesky.provider.ts:385,889,950,1005`, `lemmy.provider.ts:210`, `listmonk.provider.ts:130,157,186`, `mastodon.custom.provider.ts:82`, `skool.provider.ts:38`
- Test: `libraries/nestjs-libraries/src/database/prisma/integrations/custom.instance.details.spec.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces: label `custom-instance-details`, and one exported helper the providers call instead of `AuthService.fixedDecryption`:

```ts
export const readCustomInstanceDetails = (value: string | null | undefined): string | null;
```

- [ ] **Step 1: Write the failing tests**

```ts
it('round-trips a raw credential and a JSON payload', () => {});
it('reads a value written by the previous release', () => {});
// Review Focus 5
it('returns null for the erased sentinel and for null, without throwing', () => {
  expect(readCustomInstanceDetails('')).toBe(null);
  expect(readCustomInstanceDetails(null)).toBe(null);
});
it('throws rather than returning garbage on a tampered value', () => {});
```

- [ ] **Step 2: Run them and confirm they fail**

- [ ] **Step 3: Encrypt on the three write branches, and replace every provider's `fixedDecryption` call with `readCustomInstanceDetails`**

The write branches in the controller expression stay three branches; only the function they call changes. `skool.provider.ts:38` parses JSON from the result, so the helper must return the string and leave parsing where it is.

- [ ] **Step 4: Run them and confirm they pass, then the provider suites**

Run: `npx jest bluesky lemmy listmonk mastodon skool integration.repository`

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(integrations): encrypt customInstanceDetails with AES-GCM"
```

---

### Task 6: The backfill

**Files:**
- Create: `libraries/nestjs-libraries/src/database/prisma/secrets/secret.backfill.service.ts`
- Create: `apps/commands/src/tasks/secrets.backfill.ts` (follow the neighbouring command's registration)
- Test: `libraries/nestjs-libraries/src/database/prisma/secrets/secret.backfill.service.spec.ts`

**Interfaces:**
- Consumes: Task 1, plus the labels exported by Tasks 2–5.
- Produces:

```ts
export interface SecretBackfillReport {
  dryRun: boolean;
  scanned: number;
  updated: number;
  unchanged: number;
  skippedChanged: number;   // row changed under us, left alone
  unreadable: number;       // never modified
}
export class SecretBackfillService {
  run(options?: {
    batchSize?: number;
    dryRun?: boolean;
    only?: 'oauth' | 'org' | 'credentials' | 'integrations';
    onProgress?: (report: SecretBackfillReport) => void;
  }): Promise<Record<string, SecretBackfillReport>>;
}
```

Read `integration.token.backfill.service.ts` and mirror it: idempotent, resumable, batched, round-trip verified before writing, never logs a value, and it refuses to run when `SecretCrypto.isEnabled()` is false.

- [ ] **Step 1: Write the failing tests**

```ts
it('converts a legacy row and verifies the value round-trips before writing', async () => {});
// Review Focus 4
it('is idempotent: a second run reports every row unchanged', async () => {});
it('leaves a row it cannot read alone and counts it unreadable', async () => {});
it('writes nothing in a dry run but reports what it would write', async () => {});
it('skips a row that changed while the batch was in flight', async () => {});
it('refuses to run with no key configured', async () => {});
```

- [ ] **Step 2: Run them and confirm they fail**

- [ ] **Step 3: Implement the service and the command**

- [ ] **Step 4: Run them and confirm they pass**

- [ ] **Step 5: Commit**

```bash
git add libraries/nestjs-libraries/src/database/prisma/secrets/ apps/commands/src/tasks/
git commit -m "feat(secrets): backfill legacy credentials onto the new schemes"
```

---

### Task 7: Close it out

**Files:**
- Modify: `libraries/helpers/src/auth/auth.service.ts` — comment on `fixedEncryption`/`fixedDecryption`
- Create: `deploy/postdelegate/secrets-at-rest-rollout.md`
- Modify: `~/Projects/PostDelegate/SECURITY-AUDIT-2026-11-07.md` — A1 and A10's third bullet

**Interfaces:** none.

- [ ] **Step 1: Comment `fixedEncryption` and `fixedDecryption`**

State that their only remaining purpose is the lifetime-deal code format, that they are deterministic, unauthenticated, and keyed off `JWT_SECRET`, and that no new caller should use them — point at `secret.crypto.ts`.

- [ ] **Step 2: Write the rollout runbook**

The five ordered steps from the spec, with the `CREATE INDEX CONCURRENTLY` statement, the backfill commands (dry run first), the verification query that counts rows still holding a legacy value per field, and the explicit note that dropping the legacy read path is a **second, later deploy**.

- [ ] **Step 3: Record what is still coupled to `JWT_SECRET`**

In the runbook: lifetime-deal codes, and only those. `JWT_SECRET` rotation also invalidates every session (by design, via `passwordFingerprint`) — say so, so nobody rotates it expecting a quiet change.

- [ ] **Step 4: Verify the whole suite and both builds**

Run: `npx jest` then `pnpm run build:backend && pnpm run build:frontend`
Expected: PASS. Jest has TS diagnostics off, so only the real build proves it compiles.

- [ ] **Step 5: Commit**

```bash
git commit -am "docs(secrets): rollout runbook and the last JWT_SECRET coupling"
```

---

## After the plan

Per `CLAUDE.md` and project memory, before this merges: an Opus review of the
whole branch, then staging, then a browser click-through of the API-key page,
the onboarding modal, an MCP connection, and reconnecting a Bluesky or Mastodon
channel — the four paths these changes can break in a way tests would not
catch.
