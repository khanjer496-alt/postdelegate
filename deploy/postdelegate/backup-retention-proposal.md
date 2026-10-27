# Postiz backup retention proposal — not enabled

Prepared 27 October 2026. The existing backup script and timer are unchanged. All production backups remain in place. `plan-postiz-backup-retention.py` only produces a dry-run plan; it has no apply/delete implementation and has not been installed or run against production.

## Current restore proof

Snapshot `/var/backups/postiz/20261027T022900Z` was restored successfully on 27 October:

| Dump | Disposable database engine | Verification |
| --- | --- | --- |
| `postiz.dump` | PostgreSQL 17 | Restore with error-on-failure; fresh archive readback; Prisma counts |
| `temporal.dump` | PostgreSQL 16 | Restore with error-on-failure; fresh archive readback |
| `temporal-visibility.dump` | PostgreSQL 16 | Restore with error-on-failure; fresh archive readback |

All three original archive checksums matched. Restored application totals: 2 users, 2 organizations, 5 media rows, 1 post and 1 integration. These are **all rows, including soft-deleted rows**. A separate read-only production count confirmed 5 total media rows: 2 active and 3 soft-deleted; no media keys or contents were inspected or changed by this audit.

Both test database containers used network `none`, no published ports, read-only root filesystems and tmpfs database storage. Prisma ran only against the isolated application database. No application worker was started. The created containers and tmpfs data were removed, and the audit-container inventory was empty afterward. This verifies database restoration, not restoration of uploaded objects, external provider access or every protected configuration setting.

Private evidence: `.local/review-evidence/backup-restore-20261027.json` (owner-only).

## Proposed window and scope

Keep four days of complete Postiz snapshots, using the UTC timestamp in a strict `YYYYMMDDTHHMMSSZ` directory name. A future, separately approved pruning job would run daily after a successful backup. It would remove only approved, recognized snapshots **strictly older** than the four-day cutoff. Exact-boundary snapshots stay until the next pass.

The planner accepts only the dedicated owner-only `postiz` backup root, private snapshot/configuration directories, the known three custom-format dumps and their matching SHA-256 manifest, plus the known compose/Caddy/dynamicconfig/legal layout. It rejects symlinks, unsupported filesystem objects, foreign snapshot contents, bad checksums and unsafe permissions. Other names are ignored. `/var/backups/postdelegate`, BrightBean archives and other recovery collections are outside its scope.

A recognized snapshot less than 36 hours old is required. If the backup timer is stale or snapshots are unsafe, the planner retains everything and exits nonzero. This protects recoverability, but requires operator action to avoid exceeding a deletion deadline. Checksums and archive headers identify recognized snapshots; they do not replace periodic restore tests.

Conditional timing calculation: after old secret-bearing workflows are closed, a verified 24-hour Temporal namespace retention plus the lifecycle's one-hour safety buffer, four-day backup window and at most one day until a daily pruning pass totals approximately **145 hours**. This leaves approximately 23 hours within a seven-day budget. This is a proposed operating bound, not an enabled deletion guarantee.

The bound requires all of the following to remain true:

- Relevant live database data, caches and objects are actually removed by the verified lifecycle operation.
- Old workflows containing provider data have been completed or terminated. Namespace retention does not expire open execution history.
- Temporal cleanup, backups and pruning actually complete on time; pending jobs and missed runs are monitored.
- No untracked copies retain the same data in host/provider snapshots, off-site backups, manual exports, old configuration copies or operational artifacts.

Four days shortens recovery time for corruption discovered late. Root must approve this recovery tradeoff and a concrete list of candidate folders before any deletion implementation is installed or run. No hold should be treated as indefinite permission to retain provider data.

## Operator procedure for review/test artifacts

This is a manual procedure, not automated cleanup:

1. Identify the exact account, workspace and approved request. Preserve other owners' shared workspace data and any media referenced elsewhere.
2. Inventory only the relevant local review screenshots/recordings, private API-proof files, temporary exports and VPS operational copies. Avoid printing tokens, email-bearing screenshots or object keys into logs.
3. Separate the intended original demonstration media and owner-approved provider test post from disposable test artifacts. A PostDelegate data-removal request does not itself authorize deleting a YouTube video.
4. After explicit approval of that concrete inventory, remove only the approved artifacts, retire temporary sessions as appropriate, and record what remains, why, who owns it and the next review date.
5. Recheck public media/cache copies and all restore collections separately. Never bulk-delete unknown R2 objects or the BrightBean rollback archives.

## Local validation

Run the planner tests with:

```sh
python3 -m unittest discover -s deploy/postdelegate/review/tests -p test_backup_retention.py -v
```

Ten local fixture tests pass, including cutoff behavior, exclusion of foreign archives, symlink protection, checksum/incomplete-snapshot rejection, permission guards, stale/future snapshot guards, invalidation of every candidate when any snapshot is blocked, and unchanged file contents after a CLI dry run. No production pruning or apply command was executed.
