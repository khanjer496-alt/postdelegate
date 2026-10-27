# Authorization cleanup operating gates

Prepared 27 October 2026. This is a release and verification runbook, not evidence that cleanup has been enabled or completed.

## Default and scope

`INTEGRATION_AUTHORIZATION_LIFECYCLE_ENABLED` must equal `true` to start the new managed-provider deletion/check workflows. It is off when unset. `INTEGRATION_AUTHORIZATION_HISTORY_RETENTION_HOURS` must describe the actual namespace retention; the verified production namespace currently uses 24 hours with history and visibility archival disabled. Keep both values out of a release's runtime changes until the operating gates below pass.

The YouTube policy opts into this lifecycle. Explicit removal stops local use, revokes the applicable Google project/account grant and removes attributable stored API data. Google revocation can affect other channels and native Google consent under the same project/account; the confirmation includes this effect. Original user-authored posts/uploads and the provider-side video are preserved. Google sign-in grants may need to be authorized again.

Existing publishing workflow files and activity parameters remain unchanged. New versioned workflows receive only opaque local IDs, cursors and counts. Older execution histories may contain credentials or provider responses; closing every attributable running execution and waiting for verified namespace expiry is part of cleanup, not an optional optimization.

## Gates before enabling

1. Run the focused test suite and all three production builds against the exact release tree. Review stale authorization decisions, reconnect generations, accepted publishing outcomes, late cache/notification writes, account deletion and recurring child histories.
2. Preserve a working rollback image/configuration and restore-tested database snapshot. Recheck API, publishing-worker and native Google login behavior after the rollout.
3. Verify active grant audience/account identity without printing credentials. Inventory any pending deletion rows, OAuth intermediate generations and relevant open post/refresh/digest executions using metadata-only queries.
4. Resolve all safely attributable historical API-data copies. Current read-only R2 inventory contains five objects: two referenced by media rows, one referenced YouTube avatar and two objects not attributable from current Postiz records. An unreferenced object may belong to preserved BrightBean or older authorized records; do not bulk-delete it. CDN/cache copies require a separate check.
5. Resolve historical free-text notifications, manual exports, recordings/screenshots, operational proof files, host snapshots, off-site copies and old configuration archives where they contain API data. Preserve other owners' data and unrelated recovery archives. Do not make a seven-day erasure promise while these copies remain unaccounted for.
6. Obtain the owner's concrete recovery-window decision for the [four-day backup proposal](backup-retention-proposal.md). The planner has no deletion implementation. Enforce and monitor the approved policy before claiming that live cleanup plus backup expiry meet the required period.
7. Exercise revocation and cleanup using a separately approved disposable authorization. Verify external revocation detection, explicit app removal, transient errors, reconnect handling and final disappearance from database/cache/object/history copies. Never revoke the live demonstration grant merely to test the implementation.
8. Set the feature flag and verified namespace-retention value only after all gates pass; recreate only the affected application service and check the maintenance singleton is running. Confirm pending deletions retry and surface operational failures.

## Review status

The real private YouTube post and read-only analytics tests passed. Full review footage, Google/provider verification, broader customer acceptance and the operating gates above remain pending. Shipping code with this feature disabled does not establish working revocation or complete API-data erasure.
