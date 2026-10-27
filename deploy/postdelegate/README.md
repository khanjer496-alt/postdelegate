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
- Deployed image: `postdelegate-postiz:review-038e57dc`, built from source revision `038e57dc7832bebc5b0d67f6537768baa64a698d`; image ID `sha256:023b7d3a15013ad2432b10a7482e4f50d40ff028eb19a7a67406971a428b08c8`. [Dockerfile.release](Dockerfile.release) rebuilds the API, Temporal publishing worker and branded frontend sequentially on the OCI-digest-pinned official Postiz v2.25.3 base. It includes TikTok review UX/media-transfer corrections, narrower YouTube permissions and operation-aware validation that preserves draft/update-only saves.
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
- Owner-approved [privacy](https://app.postdelegate.com/legal/privacy/) and [terms](https://app.postdelegate.com/legal/terms/) are published with effective date 26 October 2026; both returned HTTP 200 without draft markers.

The first Postiz backup/restore check used `/var/backups/postiz/20261026T143502Z`. Snapshot `/var/backups/postiz/20261027T022900Z` was separately restored into isolated PostgreSQL 17/16 databases on 27 October: all three checksums, restores and fresh archive readbacks passed. Restored totals were two users, two organizations, five media rows, one post and one integration; production had two active media rows and three soft-deleted smoke-test rows. No application worker or publishing process ran during this restore test. The backup before the Google/policy rollout is `/var/backups/postiz/20261026T163458Z`; that rollout's preserved configuration rollback set is stamped `20261026T163655Z`. BrightBean recovery snapshots are under `/var/backups/postdelegate/pre-postiz-*`; the final frozen-ingress snapshot is `pre-postiz-20261026T143854Z`.

## YouTube owner test — 27 October 2026

The authorized owner connected the test channel through real Google consent and published one original video with **Private** visibility. PostDelegate recorded `PUBLISHED`; YouTube independently reported private visibility, upload processed, processing succeeded and duration `PT13S`. The owner's YouTube Studio showed the same private video and playback. Channel statistics, video statistics and the implemented analytics report returned HTTP 200. Fresh desktop native Google login returned to the existing Google user and workspace; no additional user or organization was created.

Private evidence and identifiers are retained under ignored `.local/review-evidence/` and protected `.local/review-youtube-*-proof-*.json`. The original upload clip is not a review recording. No provider review has been submitted, no screen recording has been produced and public customer access remains unqualified.

Upstream channel deletion retained tokens and API-derived data. The prepared authorization lifecycle adds provider revocation, periodic authorization checks and bounded cleanup, with late-write safeguards. It remains disabled by default until the [operating gates](authorization-lifecycle-operations.md) are satisfied. The [four-day backup proposal](backup-retention-proposal.md) is dry-run only: production backups have not been pruned. Do not claim YouTube verification readiness from the private publication test.

## Public source offer and stock Postiz rollback

The settings Source code link is live: [the source offer](https://app.postdelegate.com/source) returns HTTP 302 to [the matching versioned application archive](https://app.postdelegate.com/source/postdelegate-038e57dc.tar.gz), which returned HTTP 200. Independent public download verification on 2026-10-26 confirmed 13,445,774 bytes and SHA-256 `cc7b475467cdfaa2d661e214691881756bb00a3cd0bae19a8d027546e0df4e46`. Use this versioned URL for release checks: Cloudflare previously served an older cached archive at a stable alias. This is the exact tracked release tree, including application source, assets, lockfiles, license, release recipe and regression tests. Ignored credentials, runtime configuration, `.local` evidence and backups are absent; the archive passed structural and credential-pattern checks.

## Review preparation release — 26 October 2026

- All three production builds passed. **61 focused regression tests** passed across real provider methods, React/Hook Form/SWR integration, desktop/mobile publishing controls, and trusted server validation-operation boundaries. Run them without credentials, network or app bootstrap with `bash deploy/postdelegate/review/run-checks.sh` on a Docker host. These tests do not establish a successful social post.
- After deployment, the app container was healthy; API and worker returned 200; PostgreSQL, Redis and Temporal remained healthy. Read-only checks preserved two users, two organizations, two media objects and zero active social integrations, with both existing owners activated and retaining SUPERADMIN access. Native Google authorization still uses the existing client prefix `325521386136`, exact profile/email scopes and original callback. Signup/login pages returned 200. No fresh Google callback login was performed in these read-only checks.
- Google project `postdelegate` saved the approved five-scope YouTube declaration and truthful justification. YouTube Analytics API was enabled with owner-approved terms and its dashboard shows Enabled. The actual social authorization URL requested exactly those five scopes. The subsequent authorized channel connection, private publication and analytics proof are recorded in the 27 October section above; a recording and provider verification remain pending.
- The original silent 12-second 720×1280 H.264/AAC fixture and original image were uploaded through the real app into R2. The hosted video matches SHA-256 `ae05ccf932aabfeeab5d0c2bcb59dd868e201fc144af8d36d4507423fef95366`; the app compressed the image to 800×1000. These are upload fixtures, not screen recordings.
- Facebook, Pinterest and TikTok consoles require sign-in. The owner chose to sign into Facebook later. QuickTime is present, but native recording control timed out twice; no screen capture was started or recording produced. Complete a real account connection and private test post before making review footage, using an available recorder.
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

Daily backups currently stay on the VPS; retention and automated off-site replication remain follow-up operations. Private recovery copies of the BrightBean snapshot and initial Postiz backups were additionally downloaded to the ignored `.local/backups` directory on this Mac. A readable archive/listing is not a restore test; the three Postiz database dumps were separately restored as described above. The old BrightBean dump passed archive validation and remains alongside its intact original database volume.

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
