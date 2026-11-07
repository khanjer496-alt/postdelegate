# Scrubbing the stored error bodies

`Errors.body` is the debug snapshot of the posts a workflow was publishing
when it failed. Until this release it stored whole post rows, including the
**decrypted** channel credentials (`token`, `refreshToken`,
`customInstanceDetails`) and the `submittedForOrder` tree. New rows now go
through an allowlist (`auditErrorBody` in
`libraries/nestjs-libraries/src/database/prisma/errors/errors.audit.body.ts`):
each post keeps only the fields needed to debug it, and its integration only
`id`, `name` and `providerIdentifier`.

Every reader (the admin errors view, the post debug export, the debug
timeline) also passes stored bodies through the same allowlist, so the old rows
stop showing credentials **the moment this release serves traffic**. The scrub
below removes them from the database itself. At the time of writing production
held 2 such rows, both in the owner's own test workspace.

---

## 1. Back up first

```bash
sudo backup-postiz
```

The scrub rewrites a column in place and cannot be undone except by restoring
that backup.

## 2. Dry run

The release image wraps the command as `scrub-error-bodies`, the same way it
wraps `backfill-secrets`:

```bash
sudo postiz-compose exec -T postiz scrub-error-bodies --dry-run
```

It writes nothing and prints `done {...}` with:

- `bodies`: `scanned`, `updated` (rows it would rewrite), `unchanged` (already
  allowlisted), `skippedChanged`;
- `tokenLike`: for `Errors.message` and `Post.error`, how many rows contain each
  of `Bearer `, `access_token=`, `refresh_token`, `EAA`, `ya29.` and
  `"token":"`. Counts only, never the rows. These two columns are **not**
  rewritten (changing what a persisted column holds needs its own decision).
  `EAA` also matches ordinary text, so a count is a reason to look, not proof.

## 3. Real run

```bash
sudo postiz-compose exec -T postiz scrub-error-bodies
```

Idempotent and resumable: an allowlisted body comes back unchanged and is not
written, so it can be re-run at any time. `--batch-size=200` is the default.
Every write is compare-and-swap on the body it read, so a row that changed or
was erased while it ran is counted as `skippedChanged` and left alone.

Exit codes: `0` done, `2` some rows were `skippedChanged` (re-run to pick them
up), `1` it failed (rows already rewritten stay rewritten; fix the cause and
re-run). The `tokenLike` counts do not affect the exit code, since nothing here
rewrites those columns: read them. It never logs a value, only counts.

A second run should report `updated: 0`.

## 4. Copies the scrub does not reach

- **Backups.** The local backups under `/var/backups/postiz` and the encrypted
  off-site backups (14 daily + 8 weekly in R2) keep the old rows until their
  retention expires. Nothing to do but let them age out. The off-site copies are
  encrypted to a key that is never on the VPS; the local ones are not, so they
  are only as safe as root on the server.
- **A restore brings them back.** After restoring any backup taken before the
  scrub, run steps 2 and 3 again on the restored database.
- **Temporal workflow history.** The workflows passed the same posts to the
  `changeState` activity, so the activity inputs in Temporal's history hold
  them too. Closed workflow history is kept for 24 hours (archival disabled),
  then deleted by Temporal; a workflow that is still open keeps its history
  until it closes. The Temporal database dumps in the backups above hold it
  for as long as those backups live.
