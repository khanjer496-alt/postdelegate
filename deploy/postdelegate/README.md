# PostDelegate on Postiz

Deployment date: 2026-10-26. Latest operational checks: 2026-10-27. Application: https://app.postdelegate.com.
The separate marketing website remains https://postdelegate.com.

Remaining work before paid customer launch: [PostDelegate launch checklist](../../POSTDELEGATE-LAUNCH-CHECKLIST.md).

## Marketing website: current source and release

The canonical marketing source is [this repository's `site/`](../../site), locally `/Users/naserkhanjar/Documents/Codex/2026-10-26-https-github-com-athcagithub-postiz-leaked/postiz/site`. The old `/Users/naserkhanjar/Projects/postdelegate-studio/site` is preserved unchanged and is no longer the deployment source.

- Cloudflare Pages project: `postdelegate`; production branch: `main`; source revision: `82677def`.
- Production deployment: `c6a90de9-d246-47a4-a096-54d136167c8a`; preview identifier: `f0488ab1`.
- The 28-page Astro build presents the current Postiz-based workspace and truthful early-access status. Desktop 1280 px, tablet 1024/768 px and mobile 390/320 px layouts had no horizontal overflow; navigation, FAQ, preview tabs and caption/UTM tools were exercised.
- Independent hosted verification checked eight routes and 16 assets, confirmed privacy/terms were actual documents, and inspected the 96-member website archive with no secret-bearing files or Mac metadata found. The archived homepage matched the deployed source. These checks do not establish paid checkout or public social publishing.
- Website source: [postdelegate.com/website-source.tar.gz](https://postdelegate.com/website-source.tar.gz), SHA-256 `35bf00479ffe35a1aa51910b7d1a9fbd659f89a9ef649585481664c04d220b55`. This archive is separate from the modified application's `/source` offer below.

For a marketing-only rollback, open the Cloudflare Pages dashboard, select project `postdelegate`, and roll production back to the preserved deployment `3b7273f8-1205-4876-b125-5abf57bb2834`. Verify the public site and entry links afterwards. No CLI rollback command is assumed; this action does not change the VPS application or its databases.

## Stack and operating cost

- Existing OVH VPS: 4 vCPU, 8 GB RAM. No new hosting plan was purchased.
- Deployed image: `postdelegate-postiz:lifecycle-38dd7f0e`, built from source revision `38dd7f0e0d75f5f4f1bb1b418a36a987080bd168`; image ID `sha256:cd8b18c8ae2f6bf74d764f1d410bd6294c4df3cd987a241189920daf08a8c2ba`. [Dockerfile.release](Dockerfile.release) rebuilds the API, Temporal publishing worker and branded frontend sequentially on the OCI-digest-pinned official Postiz v2.25.3 base. It includes the earlier TikTok/scope corrections plus managed authorization cleanup safeguards, late-write fencing, YouTube notification minimization and signed-in legal links. Cleanup enforcement remains disabled pending the operating gates below.
- PostgreSQL 17 for Postiz; Redis 7.2; Temporal 1.28.1 with separate PostgreSQL 16 persistence/visibility databases.
- PostgreSQL Advanced Visibility replaces Elasticsearch. `SKIP_ADD_CUSTOM_SEARCH_ATTRIBUTES=true` prevents Temporal's example attributes consuming PostgreSQL's limited Text slots; Postiz registers `organizationId` and `postId` itself.
- Caddy serves HTTPS behind the existing Cloudflare proxy. Databases, Redis and Temporal have no published host ports; Postiz's diagnostic port binds only to loopback.
- R2: existing `nashr-production-media`, public URL https://media.postdelegate.com, production-origin CORS. Bucket-scoped Object Read & Write credentials are in `/etc/postiz/r2.env` (0600).
- No managed database, managed Redis, Temporal Cloud, Kubernetes, or Workers application rewrite is required.

R2 usage is billed under the account's existing allowances/pricing; this is not a promise of permanently free storage. The private backup bucket is separate and remains private.

## Files and commands

- Deployment: `/opt/postiz`.
- Main configuration: `/etc/postiz/runtime.env` (0600).
- Media credentials: `/etc/postiz/r2.env` (0600), loaded after the main configuration.
- Founder credentials: `/etc/postiz/owner-credentials.json` (0600); local protected copy in this checkout's ignored `.local/owner-credentials.json`.
- Compose wrapper: `sudo postiz-compose ps`, `sudo postiz-compose logs --tail 100 postiz`.
- Daily local backups: `postiz-backup.timer`, with output under `/var/backups/postiz`.
- Manual backup: `sudo backup-postiz`.
- Off-site encrypted backups and health alerts: `offsite-backup-postiz`, `postiz-healthcheck`, installed with `install-ops.sh`; see [Operations: off-site backups and alerts](#operations-off-site-backups-and-alerts).

Treat application logs as potentially sensitive; do not paste raw logs/configuration into public issues. The base image remains pinned, and the custom image tag records its source revision. Upgrades require an intentional release change followed by acceptance checks.

## Acceptance evidence

- Official image and every persistent service started successfully.
- Owner bootstrap/login and authenticated posts/media endpoints passed. During the initial closed-registration bootstrap, an attempted second local registration was rejected. Public Google and local signup was later authorized and enabled as described below.
- The live browser successfully signed in and loaded the Postiz calendar, showing v2.25.3.
- Orchestrator `/health/status` passed; Temporal registered both Postiz Text search attributes; an organization-filtered SQL visibility query succeeded.
- Real multipart create/sign/PUT/complete passed, saved a media record, and public HTTPS returned identical PNG bytes. Browser-origin CORS was checked.
- A real browser upload also completed; all three test thumbnails loaded from the R2 custom domain. Test records/objects were subsequently removed; previously cached public test URLs may remain until cache expiry.
- Cloudflare rejects Python urllib's default User-Agent with error 1010. Descriptive application UA, curl and Node requests succeed; no security controls were disabled. Crawler-header probes are not real social-provider publishing evidence.
- Postiz, Temporal persistence and Temporal visibility dumps were each restored successfully into isolated verification databases, which were then removed.
- HTTPS application backend, login and the separate marketing website returned successful responses after cutover.
- The branded image passed backend and worker health after rollout. The live browser loaded the PostDelegate logo, the `#7357ff` primary accent and the `PostDelegate Calendar` title.
- The language picker contains 13 choices with no Hebrew option or Israeli flag. Arabic RTL passed in the browser, then English was restored. Requests carrying legacy `he`, `he-IL` and `iw` cookies returned HTTP 200 with the preference normalized to `en`.
- Browser evidence: [branded calendar](evidence/postdelegate-live.jpg) and [language picker](evidence/postdelegate-languages.jpg).
- Google signup and repeat Google login passed with the same activated `GOOGLE` user, `SUPERADMIN` role and organization. Counts stayed at two users and two organizations after repeat login. The original LOCAL owner's password login and secure HttpOnly session cookies still passed.
- Owner-approved [privacy](https://app.postdelegate.com/legal/privacy/) and [terms](https://app.postdelegate.com/legal/terms/) are published with updated YouTube disclosures and effective date 27 October 2026; both returned HTTP 200 without draft markers.

The first Postiz backup/restore check used `/var/backups/postiz/20261026T143502Z`. Snapshot `/var/backups/postiz/20261027T022900Z` was separately restored into isolated PostgreSQL 17/16 databases on 27 October: all three checksums, restores and fresh archive readbacks passed. Restored totals were two users, two organizations, five media rows, one post and one integration; production had two active media rows and three soft-deleted smoke-test rows. No application worker or publishing process ran during this restore test. The backup before the Google/policy rollout is `/var/backups/postiz/20261026T163458Z`; that rollout's preserved configuration rollback set is stamped `20261026T163655Z`. BrightBean recovery snapshots are under `/var/backups/postdelegate/pre-postiz-*`; the final frozen-ingress snapshot is `pre-postiz-20261026T143854Z`.

## YouTube owner tests and Google verification — 27 October 2026

The authorized owner connected the test channel through real Google consent and published an original video with **Private** visibility. PostDelegate recorded `PUBLISHED`; YouTube independently reported private visibility, upload processed, processing succeeded and duration `PT13S`. The owner's YouTube Studio showed the same private video and playback. Channel statistics, video statistics and the implemented analytics report returned HTTP 200.

The later UI walkthrough reauthorized the same Google account/channel and used **Post now** once for **PostDelegate - private review demonstration**, with Private visibility and not made for kids. The second post also reached `PUBLISHED`; YouTube's API confirmed private/processed/succeeded and `PT13S`, and the owner's YouTube Studio showed private playback through 13/13 seconds during the agent walkthrough. Existing media was reused: two active media records and one active connection remain. Reauthorization left a second, soft-deleted intermediate OAuth row holding credentials; no cleanup was run. The new success notification contains only generic product status and a local post link; the older URL-bearing notification remains part of the historical-data operating gate.

Fresh native Google login returned to the same activated Google owner and SUPERADMIN workspace, preserving two users and two organizations. Search Console domain ownership for `postdelegate.com` is verified under the existing Google owner `khanjer496`. The owner-approved TXT was added through the authenticated Cloudflare DNS dashboard; independent authoritative/public DNS checks matched the exact addition and preserved every prior TXT value, including SPF, DKIM and DMARC. No new Cloudflare credential, OAuth scope or account delegation was created. Google's branding recheck passed and the PostDelegate branding is published. Sensitive data-access review remains pending; branding publication is separate from YouTube scope approval and public-customer access.

Private proof and identifiers are retained under ignored `.local/review-evidence/`, including `domain-dns-and-login-verified-20261027T073808Z.json` and `walkthrough-publication-20261027T082914Z.json`. No sensitive data-access/API publishing review has been submitted. Native MOV captures do exist, but the current takes are obstructed/incomplete: the 188.185-second sampled walkthrough has a macOS data-access prompt over all sampled frames and ends at Google's Continue screen, without the later permission details, publication, analytics or Studio result. Raw footage, a 16-frame contact sheet and `postdelegate-review-coverage.json` are protected in `.local/review-recordings/`. A clean complete retake and full-footage QA are pending; neither the original upload fixture nor the current captures qualify as the review demonstration.

The live Google **Prepare for verification** summary confirms published branding, five scopes and the saved justification. Its missing-demo-video alert shows **Video link — Not provided** and **Confirm disabled**; the protected `google-review-missing-demo-20261027.png` screenshot records that the review cannot yet be submitted. The current manual recording gate is macOS's “ChatGPT would like to access data from other apps” prompt. The operator has been asked to choose **Don't Allow**, since that access is unnecessary. Native automation refuses the protected ChatGPT/UserNotificationCenter apps for safety and cannot dismiss it. The toolbar is closed; the latest short attempt produced no new MOV, and no clean retake is claimed.

Upstream channel deletion retained tokens and API-derived data. The deployed authorization lifecycle adds provider revocation, periodic authorization checks and bounded cleanup, with late-write safeguards. It remains disabled until the [operating gates](authorization-lifecycle-operations.md) are satisfied. The [four-day backup proposal](backup-retention-proposal.md) is dry-run only: production backups have not been pruned. Do not claim YouTube verification readiness from the private publication test.

## Public source offer and stock Postiz rollback

The settings Source code link is live: [the source offer](https://app.postdelegate.com/source) returns HTTP 302 to [the matching versioned application archive](https://app.postdelegate.com/source/postdelegate-38dd7f0e.tar.gz), which returned HTTP 200. Independent public download verification on 2026-10-27 confirmed 13,491,032 bytes and SHA-256 `dc4f5d22c6f4b2cacff5deb119807e020f58fea3e9625244ff9ceb0769865fb8`. The redirect now uses `Cache-Control: no-store`. Use this versioned URL for release checks: Cloudflare previously served an older cached archive at a stable alias. This is the exact tracked release tree, including application source, assets, lockfiles, license, release recipe and regression tests. Ignored credentials, runtime configuration, `.local` evidence and backups are absent; the archive passed structural and credential-pattern checks.

## Authorization safeguards release — 27 October 2026

All three production applications built successfully; **163 JavaScript/TypeScript regression tests** and **10 Python backup-planner tests** passed. All 930 compiled source inputs matched the reviewed local tree. The final image applies the committed source-revision label to that tested build; no application code changed between build and commit.

The live API and publishing worker returned HTTP 200. Independent release verification preserved two users, two organizations, two active media records, one active connection and the then-existing single published post. The later owner walkthrough added the second authorized private post and an intermediate OAuth generation as recorded above. Google/R2 credential files matched the saved checksums. Native Google authorization still requests only profile/email using the original client and callback. Both public legal pages returned 200 with the 27 October YouTube disclosures. The signed-in settings page renders Privacy Policy and Terms links; live analytics loaded after rollout.

`INTEGRATION_AUTHORIZATION_LIFECYCLE_ENABLED` and `INTEGRATION_AUTHORIZATION_HISTORY_RETENTION_HOURS` remain absent. No cleanup workflow, real grant revocation, notification purge, object deletion or backup pruning ran. Temporal remains at verified 24-hour closed-history retention with archival disabled. Shared digest history, ambiguous legacy notifications, objects and backup enforcement remain operating gates. This release does not establish end-to-end erasure or provider approval.

The pre-rollout backup is `/var/backups/postiz/20261027T071328Z`; this snapshot was archive-validated, not separately restored. The earlier `20261027T022900Z` snapshot has the full three-database restore proof. Immediate rollback files are under root-only `/var/backups/postiz-release/lifecycle-38dd7f0e/`: runtime, Caddyfile, Compose, legal directory and protected credential checksums. Restore the saved runtime, write the saved Caddyfile through its existing inode, restore the saved legal files, recreate only `postiz`, reload Caddy and verify API/worker health. This returns to `review-038e57dc` without replacing database volumes or Google/R2 credentials.

Search Console domain ownership, the successful branding recheck and published PostDelegate branding are now complete, as recorded above. The earlier site-ownership failure is resolved. Sensitive data-access/provider review and clean complete review footage remain pending.

## Review preparation release — 26 October 2026

- All three production builds passed. **61 focused regression tests** passed across real provider methods, React/Hook Form/SWR integration, desktop/mobile publishing controls, and trusted server validation-operation boundaries. Run them without credentials, network or app bootstrap with `bash deploy/postdelegate/review/run-checks.sh` on a Docker host. These tests do not establish a successful social post.
- After deployment, the app container was healthy; API and worker returned 200; PostgreSQL, Redis and Temporal remained healthy. Read-only checks preserved two users, two organizations, two media objects and zero active social integrations, with both existing owners activated and retaining SUPERADMIN access. Native Google authorization still uses the existing client prefix `325521386136`, exact profile/email scopes and original callback. Signup/login pages returned 200. No fresh Google callback login was performed in these read-only checks.
- Google project `postdelegate` saved the approved five-scope YouTube declaration and truthful justification. YouTube Analytics API was enabled with owner-approved terms and its dashboard shows Enabled. The actual social authorization URL requested exactly those five scopes. The subsequent authorized channel connection, private publication and analytics proof are recorded in the 27 October section above; a recording and provider verification remain pending.
- The original silent 12-second 720×1280 H.264/AAC fixture and original image were uploaded through the real app into R2. The hosted video matches SHA-256 `ae05ccf932aabfeeab5d0c2bcb59dd868e201fc144af8d36d4507423fef95366`; the app compressed the image to 800×1000. These are upload fixtures, not screen recordings.
- Facebook, Pinterest and TikTok consoles require sign-in. The owner chose to sign into Facebook later. Recording controls timed out at that earlier checkpoint. Native captures were subsequently produced on 27 October, but QA found obstructed/incomplete takes; the clean review retake remains pending despite successful private publication.
- The pre-release database/configuration backup is `/var/backups/postiz/20261026T193735Z`. Immediate image/config rollback copies are `/etc/postiz/runtime.env.before-review-038e57dc`, `/opt/postiz/compose.before-review-038e57dc.yaml` and `/opt/postiz/Caddyfile.before-review-038e57dc`. The previous `brand-adbd8662` image and source archive remain present. No schema migration or new worker workflow definition was introduced. Google and R2 credential files matched their pre-release checksums.

For this immediate rollback, restore the saved runtime and Caddyfile through its existing inode, recreate only the `postiz` service, reload Caddy and recheck API/worker health. This rollback preserves the working Google credentials and published policies, unlike the older stock rollback below.

The pre-branding stock deployment is preserved at `/etc/postiz/runtime.env.before-branding-9a302a1a`, `/opt/postiz/compose.before-branding-9a302a1a.yaml` and `/opt/postiz/Caddyfile.before-branding-9a302a1a`. The saved Compose file retains the official image digest; the saved runtime has no `POSTIZ_IMAGE` override. To restore stock Postiz while keeping the Postiz databases, uploads and separate R2 credentials:

```sh
sudo cp -a /etc/postiz/runtime.env /etc/postiz/runtime.env.before-stock-rollback
sudo cp /etc/postiz/runtime.env.before-branding-9a302a1a /etc/postiz/runtime.env
sudo cp /opt/postiz/compose.before-branding-9a302a1a.yaml /opt/postiz/compose.yaml
sudo sh -c 'cat /opt/postiz/Caddyfile.before-branding-9a302a1a > /opt/postiz/Caddyfile'
sudo postiz-compose --profile edge up -d --wait --force-recreate postiz caddy
curl --fail --user-agent 'PostDelegate-operations-verification/1.0' https://app.postdelegate.com/api/auth/can-register
```

The Caddyfile is written through its existing inode and Caddy is recreated so the bind mount and running configuration agree. Confirm owner login, the intended registration setting and worker health after rollback. This pre-branding restore predates the Google credentials, published policies and open signup; the first command preserves later runtime settings for deliberate reapplication. Keep the current policy/source routes and Google callback configuration in view when choosing a rollback target.

## Operations: off-site backups and alerts

Added 30 October 2026 (branch `pd/ops-monitoring`). Nothing here changes the existing `backup-postiz` job, its timer, the four-day local retention proposal or any application file. Backups were on the VPS only until this is installed.

What it adds:

| Piece | Where it lives on the server | What it does |
| --- | --- | --- |
| `offsite-backup-postiz` + `postiz-offsite-backup.timer` | `/usr/local/bin`, 03:00 UTC daily (after the 02:20 local backup) | Takes the newest complete `/var/backups/postiz/<stamp>`, re-verifies its checksums, tars it, encrypts it with `age` to the owner's **public** key, uploads `postiz/<stamp>.tar.age` and `.sha256` to the separate R2 bucket, reads it back to confirm the checksum, then prunes to 14 daily + 8 weekly. Any failure exits non-zero and sends an alert. |
| `postiz-healthcheck` + `postiz-healthcheck.timer` | `/usr/local/bin`, every 10 minutes | Disk below 85%, newest local backup under 26 h, newest off-site backup under 26 h, all six compose services running and healthy, Temporal `SERVING`, and `https://app.postdelegate.com/api/auth/can-register` returning 2xx. Logs to journald and posts to your phone. |
| `.github/workflows/uptime.yml` | GitHub Actions | Every 30 minutes, from outside the VPS: curls the app API, app home page and marketing site, and checks both TLS certificates have more than 14 days left. A failed run makes GitHub email the repository owner. |

Design notes:

- The age **private** key is never on the VPS, so a server compromise cannot read old backups. Only the owner can decrypt them.
- The archive omits `configuration/backup-r2.env`, so the backup bucket does not hold the credentials for itself. The rest of `/etc/postiz` (including `runtime.env` and `r2.env`) is inside the encrypted archive.
- Media lives in R2 `nashr-production-media`, not on disk, so it is not in these backups. Off-site backups cover both databases and configuration only.
- The scripts refuse to run if the backup bucket equals the media bucket, if the backup token equals the media token, or if the env file is not `root:root` 0600.
- Retention keeps the newest backup of each of the last 14 UTC days plus the newest of each of the last 8 Monday-based weeks. It only touches `postiz/<stamp>.tar.age[.sha256]` names, refuses to delete more than 10 objects in one run, and never deletes the backup it just uploaded. Local retention is unchanged.
- Health alerts: the first alert goes out after 2 consecutive failing runs (about 10-20 minutes), a changed set of failing checks alerts immediately, a reminder repeats every 6 hours, and a recovery message is sent when all checks pass again. State is in `/var/lib/postiz-ops/health-state`; the off-site success marker is `/var/lib/postiz-ops/offsite-last-success`.
- Alerts go to `ALERT_WEBHOOK_URL`: an ntfy topic URL (plain text with title/priority headers), or a Slack or Discord webhook (JSON, detected from the URL). The URL is a secret and is never logged. Email is not used.

### Owner steps (one time)

1. **Cloudflare R2 bucket and token.** Dashboard, R2, Create bucket `postdelegate-backups` (private: do not add a public URL or custom domain). Then R2, Manage API tokens, Create API token: permission **Object Read & Write**, scoped to **only** `postdelegate-backups`. Keep the Account ID, Access Key ID and Secret Access Key for step 4. Do not reuse the media bucket token.
2. **age key (on your Mac, never on the server).**

   ```sh
   brew install age
   age-keygen -o postdelegate-backup.agekey
   ```

   The command prints `Public key: age1...`. Save the **whole** `postdelegate-backup.agekey` file in your password manager (and ideally one offline copy), then delete it from the Mac. Without it the off-site backups cannot be decrypted. Only the `age1...` public key goes on the server.
3. **Phone alerts.** Install the ntfy app, subscribe to a long random topic, for example the output of `echo postdelegate-ops-$(openssl rand -hex 12)`. The full URL is `https://ntfy.sh/<that topic>`. Treat it like a password.
4. **Install on the server.** From your Mac (the file list below is everything the installer needs):

   ```sh
   cd <repo>/deploy/postdelegate
   tar czf - ops-lib.sh offsite-backup-postiz postiz-healthcheck \
     postiz-offsite-backup.service postiz-offsite-backup.timer \
     postiz-healthcheck.service postiz-healthcheck.timer \
     backup-r2.env.example alerts.env.example install-ops.sh \
     | ssh <vps> 'mkdir -p /root/postdelegate-ops && tar xzf - -C /root/postdelegate-ops'
   ```

   On the server, as root:

   ```sh
   cd /root/postdelegate-ops
   ./install-ops.sh --install-packages --init-env   # installs age + rclone, creates both env files (0600)
   nano /etc/postiz/backup-r2.env                   # account id, token, bucket, age1... public key
   nano /etc/postiz/alerts.env                      # ALERT_WEBHOOK_URL=https://ntfy.sh/<your topic>
   ./install-ops.sh --check                         # lists anything still missing
   ./install-ops.sh                                 # installs, enables timers, runs one upload + a test alert
   ```

   The phone should buzz with "PostDelegate test alert", and the script prints the timer table. If anything is missing, it refuses and lists exactly what.
5. **Do the restore drill once** (below) within the first week; an untested backup is only a hope.
6. **GitHub emails.** In GitHub, Settings, Notifications, keep "Actions" notifications enabled for failed workflows (the default). After the branch is merged, run the **Uptime** workflow once from the Actions tab to confirm it is green.

File ownership and modes (the installer sets these): scripts `root:root 0700`, `/usr/local/lib/postiz-ops/ops-lib.sh` `0600`, units `0644`, `/etc/postiz/backup-r2.env` and `alerts.env` `root:root 0600`, `/var/lib/postiz-ops` `0700`. Never commit real values; `backup-r2.env.example` and `alerts.env.example` contain placeholders only.

Useful commands:

```sh
systemctl list-timers 'postiz-*'
journalctl -u postiz-offsite-backup -n 100 --no-pager
journalctl -u postiz-healthcheck -n 50 --no-pager
sudo offsite-backup-postiz            # run an off-site backup now
sudo postiz-healthcheck               # run the checks now (exit 0 healthy, 1 unhealthy, 2 alert not delivered)
sudo postiz-healthcheck --test-alert  # send a test message to your phone
```

Tuning (optional, in the env files): `BACKUP_KEEP_DAILY`, `BACKUP_KEEP_WEEKLY`, `BACKUP_MAX_AGE_HOURS`, `HEALTH_FAIL_THRESHOLD`, `HEALTH_REMINDER_HOURS`, `HEALTH_DISK_MAX_PCT`; see the `.example` files.

### Restore an off-site backup

Run this on any machine with Docker, `age` and `rclone`; the production stack is never touched. The private key comes from the password manager.

1. **Download and check the archive.**

   ```sh
   export RCLONE_CONFIG=/dev/null RCLONE_CONFIG_PDBACKUP_TYPE=s3 RCLONE_CONFIG_PDBACKUP_PROVIDER=Cloudflare \
     RCLONE_CONFIG_PDBACKUP_REGION=auto RCLONE_CONFIG_PDBACKUP_NO_CHECK_BUCKET=true \
     RCLONE_CONFIG_PDBACKUP_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com \
     RCLONE_CONFIG_PDBACKUP_ACCESS_KEY_ID=<backup token id> RCLONE_CONFIG_PDBACKUP_SECRET_ACCESS_KEY=<backup token secret>
   rclone lsf PDBACKUP:postdelegate-backups/postiz | sort | tail      # pick the newest <stamp>
   STAMP=20261030T022100Z
   mkdir -p /srv/restore-test/$STAMP && cd /srv/restore-test
   rclone copy PDBACKUP:postdelegate-backups/postiz/$STAMP.tar.age . && rclone copy PDBACKUP:postdelegate-backups/postiz/$STAMP.tar.age.sha256 .
   sha256sum -c $STAMP.tar.age.sha256          # macOS: shasum -a 256 -c
   ```

2. **Decrypt and unpack.** Put the private key file somewhere temporary, then remove it afterwards.

   ```sh
   age -d -i ~/postdelegate-backup.agekey -o $STAMP.tar $STAMP.tar.age
   tar -xf $STAMP.tar -C $STAMP
   ```

3. **Verify the dumps' own checksums.** `SHA256SUMS` stores the original server paths, so compare by file name:

   ```sh
   cd $STAMP && sed 's#  .*/#  #' SHA256SUMS | sha256sum -c -     # macOS: shasum -a 256 -c -
   ```

4. **Start the scratch databases** (no network, no published ports, data in RAM; project name `postdelegate-restore-test`):

   ```sh
   export RESTORE_DIR=/srv/restore-test/$STAMP
   docker compose -f <repo>/deploy/postdelegate/restore-scratch.compose.yaml up -d --wait
   ```

5. **Restore the three dumps.** Any error stops the restore:

   ```sh
   C="docker compose -f <repo>/deploy/postdelegate/restore-scratch.compose.yaml"
   $C exec -T postiz-db pg_restore -U postiz -d postiz --exit-on-error --no-owner < $RESTORE_DIR/postiz.dump
   $C exec -T temporal-db pg_restore -U temporal -d temporal --exit-on-error --no-owner < $RESTORE_DIR/temporal.dump
   $C exec -T temporal-db createdb -U temporal temporal_visibility
   $C exec -T temporal-db pg_restore -U temporal -d temporal_visibility --exit-on-error --no-owner < $RESTORE_DIR/temporal-visibility.dump
   ```

6. **Verify.** Compare with production (`sudo postiz-compose exec -T postgres psql -U postiz -d postiz -tAc '<same query>'`), allowing for rows added since the snapshot:

   ```sh
   $C exec -T postiz-db psql -U postiz -d postiz -tAc 'select count(*) from "User"'
   $C exec -T postiz-db psql -U postiz -d postiz -tAc 'select count(*) from "Organization"'
   $C exec -T postiz-db psql -U postiz -d postiz -tAc 'select count(*) from "Post"'
   $C exec -T temporal-db psql -U temporal -d temporal -tAc "select count(*) from information_schema.tables where table_schema='public'"
   $C exec -T temporal-db psql -U temporal -d temporal_visibility -tAc "select count(*) from information_schema.tables where table_schema='public'"
   ```

   The unpacked `configuration/` directory holds the `/etc/postiz` files as of the snapshot, minus `backup-r2.env`. Treat it as secret.
7. **Tear down.** The scratch project has no volumes, so this removes everything. Never use the production project name with these commands.

   ```sh
   $C down
   rm -rf /srv/restore-test/$STAMP*
   ```

A real disaster restore is the same procedure, but into the production stack's database containers using the existing rollback notes above; it also needs the media bucket (not in these backups) and the secrets from the decrypted `configuration/` directory.

## BrightBean data and rollback

Before cutover the old database contained one user, one organization, two workspaces, one disconnected Bluesky account record, five draft platform posts and zero subscriptions. There was no scheduled publishing queue to transfer.

The database, media, runtime configuration including encryption keys, Caddy state, source revision and exact image ID were backed up. Drafts were additionally exported to JSON. These records have **not** been imported into the new Postiz database. The original volumes, source and image are retained. Old containers are stopped and their Docker restart policies are set to `no`.

For immediate rollback before accepting new Postiz publishing work:

```sh
sudo postiz-compose --profile edge stop caddy postiz
sudo docker update --restart=unless-stopped postdelegate-prod-app-1 postdelegate-prod-worker-1 postdelegate-prod-caddy-1 postdelegate-prod-postgres-1 postdelegate-prod-redis-1
sudo pd up -d --no-build postgres redis app worker caddy
curl --fail https://app.postdelegate.com/health/
```

`pd` and `pd-deploy` remain legacy BrightBean helpers. Use `postiz-compose` for the new deployment. Never run `down -v`, volume prune, or discard the old image as part of routine deployment. If new Postiz publishing work has been accepted, reconcile schedules before changing scheduler ownership.

Daily backups stay on the VPS until the off-site tooling in [Operations: off-site backups and alerts](#operations-off-site-backups-and-alerts) is installed; local pruning remains a separate, unapproved proposal. Private recovery copies of the BrightBean snapshot and initial Postiz backups were additionally downloaded to the ignored `.local/backups` directory on this Mac. A readable archive/listing is not a restore test; the three Postiz database dumps were separately restored as described above. The old BrightBean dump passed archive validation and remains alongside its intact original database volume.

## Deliberate next migration work

This change deploys Postiz with the completed PostDelegate frontend branding and locale changes. It does not port the BrightBean product's custom features.

1. Compare existing Postiz capabilities against the current BrightBean fork at `c3a8298` before rebuilding overlaps.
2. Port differentiated autonomy/guardrails/undo/crisis pause/audit, client approval and portal workflows, inbox additions, custom onboarding, plans/entitlements, reports and other product-specific flows as separately verified TypeScript changes.
3. Configure social developer credentials and Postiz callback URLs; the old Django callback paths are different. Real account connection, scheduled publishing and timeout recovery still need provider qualification.
4. Configure email and billing before enabling those features. They remain inactive and are described that way in the published policies.
5. Keep the completed branding, upstream attribution and matching public source offer compatible with future upstream upgrades.

## Google login: complete

On 2026-10-26 the owner approved Google's API Services User Data Policy, web-login client setup, policy publication and account creation. Google Auth Platform is configured in project `postdelegate`; the `PostDelegate Web` client is enabled with origin `https://app.postdelegate.com` and redirect `https://app.postdelegate.com/integrations/social/youtube`. Its external audience is **In production**. This audience setting does not establish approval for additional Google or YouTube publishing scopes.

Postiz uses `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET` for native Google login. They are installed in `/etc/postiz/runtime.env`; protected client JSON copies are `/etc/postiz/google-oauth-client.json` and this checkout's ignored `.local/google-oauth-client.json`, all mode 0600. Keep `POSTIZ_GENERIC_OAUTH` unset. The pre-change runtime is `/etc/postiz/runtime.env.before-google-20261026T160834Z`.

The real browser completed profile/email consent, company-name signup and a repeat Google login to the same activated `GOOGLE` user and organization with the `SUPERADMIN` role. Database counts remained two users and two organizations after repeat login, confirming that it did not create another account. The existing LOCAL owner separately logged in successfully with secure HttpOnly cookies, and worker health passed. Native Google signup creates a separate user/workspace rather than automatically linking a LOCAL account by matching email.

The deployed branded release includes signup links to the published PostDelegate privacy and terms pages. Both legal routes serve the owner-approved standalone documents without authentication or draft markers. The earlier [review index](legal-public/index.html) is retained as an internal historical review record and is not published.

Public registration is enabled (`DISABLE_REGISTRATION=false`), allowing **both Google and local email/password signup**. The authorization flow requested profile/email only. No YouTube publishing permission, channel connection or publishing qualification is claimed by this login acceptance.

## LinkedIn connection: in progress

The reported LinkedIn authorization URL contained `client_id=undefined` because LinkedIn client credentials were absent from both the current and preserved legacy runtime. The authenticated LinkedIn developer console showed no existing applications. A new-app form has the PostDelegate name and published privacy URL prepared; no app, credentials or terms acceptance have been submitted. No PostDelegate or Nasida Apps Page appeared in the company search. The actual Page-creation screen on 27 October requires the signed-in account's email to be confirmed first. Complete that account step and the required company Page association before app creation. A LinkedIn connection, granted products/scopes and publishing are not yet verified.

The owner clarified that the goal is public customer onboarding and paid publishing through PostDelegate-owned provider apps. Each OAuth customer will authorize their own accounts; these shared application credentials do not replace customer-specific grants. Production platform approvals, Stripe plan configuration/webhooks, tenant isolation checks and end-to-end scheduled publishing remain launch work. Stock Stripe behavior and plan defaults must be reviewed before enabling live billing, including the entitlement effect on existing owner/beta organizations.

## References

- https://docs.postiz.com/self-host/installation/docker-compose
- https://docs.postiz.com/self-host/installation/system-requirements
- https://docs.postiz.com/self-host/configuration/r2
- https://docs.temporal.io/self-hosted-guide/visibility/postgresql
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1010/
