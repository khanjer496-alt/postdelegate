# PostDelegate on Postiz

Deployment date: 2026-10-26. Application: https://app.postdelegate.com.
The separate marketing website remains https://postdelegate.com.

## Stack and operating cost

- Existing OVH VPS: 4 vCPU, 8 GB RAM. No new hosting plan was purchased.
- Deployed image: `postdelegate-postiz:brand-9a302a1a5c1d`, built from source revision `9a302a1a5c1d7e05e129d9f76142b6716d39b257`. It rebuilds the branded frontend on the OCI-digest-pinned official Postiz v2.25.3 base; backend and publishing workers remain upstream binaries.
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
- Owner bootstrap/login and authenticated posts/media endpoints passed. Public registration is closed; an attempted second local registration was rejected.
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

The first Postiz backup/restore check used `/var/backups/postiz/20261026T143502Z`. BrightBean recovery snapshots are under `/var/backups/postdelegate/pre-postiz-*`; the final frozen-ingress snapshot is `pre-postiz-20261026T143854Z`.

## Public source offer and stock Postiz rollback

The settings Source code link is live: [the source offer](https://app.postdelegate.com/source) returns HTTP 302 to [the application archive](https://app.postdelegate.com/source/postdelegate-source.tar.gz), which returns HTTP 200. Public download verification on 2026-10-26 confirmed 12,949,308 bytes and SHA-256 `b0c4f831111213415bc2154a13835feda19c608f3a7666f3628f8017ff60e1f9`. Its 1,338 archive entries contain the example environment template but no `.local`, `.git`, real environment files, owner credentials or verification-session paths. The modified application source, assets, dependency lockfiles, license and frontend build recipe are included; private server configuration and operations documents are excluded.

The pre-branding stock deployment is preserved at `/etc/postiz/runtime.env.before-branding-9a302a1a`, `/opt/postiz/compose.before-branding-9a302a1a.yaml` and `/opt/postiz/Caddyfile.before-branding-9a302a1a`. The saved Compose file retains the official image digest; the saved runtime has no `POSTIZ_IMAGE` override. To restore stock Postiz while keeping the Postiz databases, uploads and separate R2 credentials:

```sh
sudo cp -a /etc/postiz/runtime.env /etc/postiz/runtime.env.before-stock-rollback
sudo cp /etc/postiz/runtime.env.before-branding-9a302a1a /etc/postiz/runtime.env
sudo cp /opt/postiz/compose.before-branding-9a302a1a.yaml /opt/postiz/compose.yaml
sudo sh -c 'cat /opt/postiz/Caddyfile.before-branding-9a302a1a > /opt/postiz/Caddyfile'
sudo postiz-compose --profile edge up -d --wait --force-recreate postiz caddy
curl --fail --user-agent 'PostDelegate-operations-verification/1.0' https://app.postdelegate.com/api/auth/can-register
```

The Caddyfile is written through its existing inode and Caddy is recreated so the bind mount and running configuration agree. Confirm owner login, closed registration and worker health after rollback. The runtime restore returns integration settings to their pre-branding state; the first command preserves later settings for deliberate reapplication.

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
4. Configure email and billing before public customer onboarding. Their secrets were absent from the old VPS configuration and were not invented or silently activated.
5. Keep the completed branding, upstream attribution and matching public source offer compatible with future upstream upgrades.

## Google login setup: configured, final signup pending

On 2026-10-26 the owner approved Google's API Services User Data Policy and creation of the web-login client. Google Auth Platform is configured in project `postdelegate`; the `PostDelegate Web` client is enabled with origin `https://app.postdelegate.com` and redirect `https://app.postdelegate.com/integrations/social/youtube`. The external audience remains **Testing**, with the owner's Google account listed as a test user.

Postiz uses `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET` for native Google login. They are installed in `/etc/postiz/runtime.env`; protected client JSON copies are `/etc/postiz/google-oauth-client.json` and this checkout's ignored `.local/google-oauth-client.json`, all mode 0600. Keep `POSTIZ_GENERIC_OAUTH` unset. The pre-change runtime is `/etc/postiz/runtime.env.before-google-20261026T160834Z`.

Fresh checks confirmed the authorization URL contains the client ID, exact callback and only profile/email scopes, and sets `oauth_state`. The real browser completed Google's profile/email consent and returned to PostDelegate's company-name signup form. The existing LOCAL owner separately logged in successfully with secure HttpOnly cookies, and worker health returned HTTP 200. **Google account creation and a repeat Google login have not yet been completed.** Native Google signup creates a separate user/workspace rather than automatically linking a LOCAL account by matching email.

The signup form still uses upstream Postiz policy links in the deployed image, and the old PostDelegate `/legal/privacy/` and `/legal/terms/` routes redirect to authentication. Source commit `adbd8662` corrects the form links; replacement image `postdelegate-postiz:brand-adbd8662` built successfully but is **not deployed**. Current production remains `brand-9a302a1a5c1d` and its matching public source archive.

Review drafts are in [legal-public/index.html](legal-public/index.html). They are not published or effective. The owner has been asked to review the privacy/terms drafts and supply the registered address/jurisdiction before final account creation and public signup. The old draft contains BrightBean-specific factual claims, so it was not restored verbatim. Candidate Caddy exact legal handlers and read-only static mount are saved in ignored `.local/legal-rollout`; Caddy validation passed without activating them. A local review server runs only on `127.0.0.1:8188` while review is pending.

`DISABLE_REGISTRATION=true` was restored after the callback test. After the remaining approval/details are resolved, publish final static documents, deploy the prepared frontend with its matching source archive, then set `DISABLE_REGISTRATION=false` to enable **both Google and local email/password signup**. Complete the Google signup, verify `providerName=GOOGLE`, sign out and repeat Google login to the same user/workspace, and separately preserve the LOCAL owner login. Publish the Google audience only after these signup/policy checks; no YouTube publishing permission or channel qualification has been completed by this login setup.

## References

- https://docs.postiz.com/self-host/installation/docker-compose
- https://docs.postiz.com/self-host/installation/system-requirements
- https://docs.postiz.com/self-host/configuration/r2
- https://docs.temporal.io/self-hosted-guide/visibility/postgresql
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1010/
