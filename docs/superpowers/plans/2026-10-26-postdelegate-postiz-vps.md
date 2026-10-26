# PostDelegate Postiz VPS Implementation Plan

> **For agentic workers:** Use executing-plans for the deployment and obtain an independent infrastructure review before cutover.

**Goal:** Replace the BrightBean deployment at app.postdelegate.com with official Postiz while preserving its recovery set.

**Architecture:** Run the official pinned Postiz image, PostgreSQL, Redis, and Temporal on the existing OVH VPS. Temporal uses its supported PostgreSQL visibility store to avoid Elasticsearch. Cloudflare remains the DNS/proxy edge; the existing empty R2 media bucket is served at media.postdelegate.com.

**Tech Stack:** Docker Compose, Postiz v2.25.3, PostgreSQL 17 and 16, Redis 7.2, Temporal 1.28.1, Caddy 2.10, Cloudflare R2.

**Spec:** User instruction of 2026-10-26: fully Postiz, replace deployed BrightBean, use Cloudflare/R2, favor easier and cheaper deployment.

## Global Constraints

- Preserve both existing source checkouts, all BrightBean data/volumes, configuration, encryption keys and release image.
- Preserve the separate marketing site at postdelegate.com.
- Use official upstream source and the version/digest-pinned prebuilt image. No application feature ports in this deployment change.
- Keep application databases, Redis and Temporal off public host ports. Postiz preflight listens only on 127.0.0.1:4007.
- Secrets are generated/stored in root-only server files, never in git or command output.
- Keep public registration disabled; bootstrap only the first owner using upstream's first-organization exception.
- Missing R2 credentials are a real gate for R2 acceptance. Never claim CORS/domain setup is an upload test.

## Review Focus

- Recovery: compressed database backup must pass pg_restore --list and media archive must be readable before cutover.
- Scheduled posts: inspect old queue states; stop the old worker at cutover so two systems cannot publish the same work.
- Access: bootstrap owner before routing public traffic; a second registration must fail.
- Workflow persistence: verify Temporal health, namespace/search attributes and visibility queries with the SQL store.
- Media: complete a real multipart PNG upload, verify unauthenticated HTTPS download, and record any credential gate.

## Tasks

- [x] Discover live VPS resources, Compose ownership, current data counts and Cloudflare resources.
- [x] Create isolated deployment configuration and independently review it.
- [x] Snapshot BrightBean database/media/configuration/image and verify recovery artifacts.
- [x] Start Postiz on loopback, bootstrap owner, test authentication and Temporal SQL visibility.
- [x] Configure R2 and verify an actual upload plus public download.
- [x] Switch Caddy ownership to Postiz, stop BrightBean publishing, and verify public HTTPS/auth/assets.
- [x] Install database backup timer, document rollback and custom-feature migration inventory, commit configuration and report exact acceptance boundaries.

## Sources

- Canonical Compose: gitroomhq/postiz-docker-compose at dd4969e5e694cd009619a0d53cff14c21104580b.
- Postiz source checkout: a5affe62c74e39c1e7ac960d50d8418b807d532c.
- https://docs.postiz.com/self-host/installation/system-requirements
- https://docs.postiz.com/self-host/configuration/r2
- https://docs.temporal.io/self-hosted-guide/visibility/postgresql

## Execution Record

- Existing VPS verified: 4 vCPU, 7751 MiB RAM, 60 GiB available root disk. BrightBean app/worker healthy.
- Existing database inventory: 1 user, 1 organization, 2 workspaces, 1 social account, 5 posts/platform posts, no subscriptions. Preserve all records.
- R2 media bucket is empty; media hostname and CORS configured and HTTPS/preflight verified. S3 credentials absent; current OAuth cannot create account tokens (403/9109).
- Independent review identified missing R2 env-file wiring and Temporal SQL Text attribute capacity; both corrected before application startup.
- R2 gate resolved through the user's explicit request to obtain the keys: the in-app browser's existing Google sign-in worked; created one bucket-scoped credential and transferred it encrypted without printing its values.
- Runtime evidence: owner/API/login, closed registration, worker health, both Temporal attributes and filtered query passed; public browser calendar shows v2.25.3.
- R2 multipart and byte-identical anonymous download passed. Python's default UA is rejected with 1010; proper descriptive UA fixes the client, with no Cloudflare security changes.
- Three current database archives restored into isolated databases successfully. Daily local systemd backup timer installed. Automated off-site backups remain a documented follow-up.
- Old account is disconnected Bluesky; all five old posts are drafts. Final recovery snapshot: pre-postiz-20261026T143854Z. Old records remain archived, not imported.
- Real browser upload and R2 thumbnails passed. Own test artifacts removed after acceptance; no customer files deleted.
- Public HTTPS application/API, owner calendar and separate marketing site verified. Old BrightBean containers stopped with restart=no; original volumes/images retained and rollback documented.
- Private recovery archives copied to mode-600 files in ignored `.local/backups` on this Mac. Final independent infrastructure review found no important remaining defects; live social-provider qualification and custom feature ports remain outside this deployment acceptance.

## User-directed branding and locale follow-up

The user requested PostDelegate branding on Postiz's native UI and removal of Hebrew/Israeli flag UI. Preserve native layout and Arabic support. Build a custom frontend on top of the exact official v2.25.3 image, retaining backend and publishing workers. Offer the exact modified application source through `/source`, without private server operations/configuration.

- [x] Reuse canonical PostDelegate identity assets and accessible purple/lime accents.
- [x] Remove Hebrew locale, generator target, flag mapping and RTL entry; normalize old he/iw preferences to English.
- [x] Add page titles, icons, truthful upstream testimonial attribution and Source code link.
- [ ] Build the custom frontend image and review the source changes.
- [ ] Deploy the branded image with a rollback path and public source offer.
- [ ] Verify live branding, language chooser, legacy locale fallback and Arabic RTL; capture updated evidence.
