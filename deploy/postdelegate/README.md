# PostDelegate on official Postiz

Deployment date: 2026-10-26. Application: https://app.postdelegate.com.
The separate marketing website remains https://postdelegate.com.

## Stack and operating cost

- Existing OVH VPS: 4 vCPU, 8 GB RAM. No new hosting plan was purchased.
- Official Postiz v2.25.3 image, pinned by OCI digest in `compose.yaml`.
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

Treat application logs as potentially sensitive; do not paste raw logs/configuration into public issues. The image remains pinned, so upgrades require an intentional image version/digest change followed by acceptance checks.

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

The first Postiz backup/restore check used `/var/backups/postiz/20261026T143502Z`. BrightBean recovery snapshots are under `/var/backups/postdelegate/pre-postiz-*`; the final frozen-ingress snapshot is `pre-postiz-20261026T143854Z`.

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

This change deploys official Postiz. It does not port the BrightBean product's custom features.

1. Compare existing Postiz capabilities against the current BrightBean fork at `c3a8298` before rebuilding overlaps.
2. Port differentiated autonomy/guardrails/undo/crisis pause/audit, client approval and portal workflows, inbox additions, custom onboarding, plans/entitlements, reports and other product-specific flows as separately verified TypeScript changes.
3. Configure social developer credentials and Postiz callback URLs; the old Django callback paths are different. Real account connection, scheduled publishing and timeout recovery still need provider qualification.
4. Configure email and billing before public customer onboarding. Their secrets were absent from the old VPS configuration and were not invented or silently activated.
5. Apply PostDelegate branding to a custom image, update legal/source attribution to the new base, and keep changes compatible with upstream upgrades. The current deployed UI is stock Postiz.

## References

- https://docs.postiz.com/self-host/installation/docker-compose
- https://docs.postiz.com/self-host/installation/system-requirements
- https://docs.postiz.com/self-host/configuration/r2
- https://docs.temporal.io/self-hosted-guide/visibility/postgresql
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1010/
