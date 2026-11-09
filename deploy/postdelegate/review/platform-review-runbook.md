# Platform review preparation — 9 November 2026

This branch prepares source and test paths. It does not prove platform approval,
production deployment, reviewer login, or a real publish. Do not merge or deploy
without Reviewer and Change Reviewer gates and the CEO's release decision.
Reuse the existing platform applications in GROK-LAUNCH-TASKS.md; never create duplicates.

## Launch scope sets

These sets supersede the older broad lists in GROK-LAUNCH-TASKS.md for this branch.

| Provider | Required for the implemented publishing flow | Optional, default off |
| --- | --- | --- |
| Facebook | pages_show_list, pages_manage_posts, pages_read_engagement | business_management, pages_manage_engagement, read_insights |
| Instagram via Facebook | instagram_basic, pages_show_list, pages_read_engagement, instagram_content_publish | business_management, instagram_manage_comments, instagram_manage_insights |
| Instagram standalone | instagram_business_basic, instagram_business_content_publish | instagram_business_manage_comments, instagram_business_manage_insights |
| Threads | threads_basic, threads_content_publish | threads_manage_replies, threads_manage_insights |
| TikTok | user.info.basic, video.publish, video.upload | video.list, user.info.profile, user.info.stats |
| LinkedIn Pages | r_basicprofile, rw_organization_admin, w_organization_social | r_organization_social |
| Pinterest | boards:read, boards:write, pins:read, pins:write, user_accounts:read | none |

TikTok retains video.upload because the shipping composer supports inbox upload.
Direct Post needs video.publish; inbox upload is a separate action and the user
must finish it in TikTok. Basic-only user-info calls omit username. Creator info
for Direct Post still supplies the creator identity in the composer. Pinterest's
five scopes are kept for the implemented API security requirements; see oauth-scope-map.md.

Do not enable any `*_OPTIONAL_SCOPES` in production until granted optional
permissions are persisted and enforced per connected channel. The current gates
read deployment-requested scopes, not the scopes each user actually granted.
A user can decline an optional scope at a fresh consent: publishing connects and
warns, but the optional feature may still appear enabled and fail at runtime,
including a reply failing after the main post publishes. Reconnecting alone does
not resolve this limitation. Platform approval alone is also insufficient.

On an isolated test deployment only, enable approved extras for investigation by
listing the exact scopes in
`FACEBOOK_OPTIONAL_SCOPES`, `INSTAGRAM_OPTIONAL_SCOPES`,
`INSTAGRAM_STANDALONE_OPTIONAL_SCOPES`, `THREADS_OPTIONAL_SCOPES`,
`TIKTOK_OPTIONAL_SCOPES`, or `LINKEDIN_PAGE_OPTIONAL_SCOPES`.
Unknown names are ignored. Required permissions cannot be disabled this way.
Optional analytics and automation are disabled by default; enabling their scope
configuration does not establish that an existing token has those permissions.
On that test deployment, reconnect with new consent and confirm the actual grant
before exercising an optional feature. Missing
optional consent returns a publishing-success warning; missing minimum consent
still rejects the connect. Older broad grants are not revoked by changing env.

LinkedIn Pages uses its own CMA-only application. This incorporates the existing
[PR #181](https://github.com/khanjer496-alt/postdelegate/pull/181) member-identity
fix: r_basicprofile reads /v2/me for the stable app-scoped member id; connect and
refresh do not call the OpenID /userinfo endpoint. The optional analytics trim is
added here. PR #184 absorbs #181 including its provider regression tests and
approval notes; close #181 as superseded rather than merging it separately.
See docs/providers/linkedin-pages-approval.md. Reconcile the organization's scopes against
the actual approved product before enabling Pages in production. Personal LinkedIn
and the approved Google clients are unchanged.

## Isolated reviewer workspace (owner-run seeding only)

1. The CEO chooses a dedicated reviewer email and ids such as `pd-review-meta`
   and `pd-review-meta-user`. Use separate workspaces per platform if reviews
   overlap. A reviewer is an ordinary workspace admin, never a superadmin.
2. The user arranges a strong password in OpenBot Vault, stored as a login for
   `https://app.postdelegate.com`. Supply it only through a protected Vault
   file outside the repository via `REVIEWER_PASSWORD_FILE`. Never put it in a shell argument, source,
   console log, report, recording or GitHub. No credentials are seeded by build
   or deployment. The script does not generate or persist plaintext passwords.
3. On a local disposable database first, export `DATABASE_URL`,
   `REVIEWER_ORG_ID`, `REVIEWER_USER_ID`, `REVIEWER_EMAIL` and the password-file
   path. Run `node deploy/postdelegate/review/seed-reviewer.cjs` for the plan,
   then `node deploy/postdelegate/review/seed-reviewer.cjs --apply` after choosing
   that database. The script uses Prisma and bcrypt with the normal cost 12.
4. CEO approved production reviewer seeding on 9 November 2026, conditional on
   PR #184 passing review and Release Engineer deploying it first. Release
   Engineer then runs this runbook using credentials supplied through the user
   and OpenBot Vault only. Never store credentials in the repository. This
   approval does not waive the disposable-database test or release gates above.
   The seed creates four rows atomically:
   user, workspace, membership, manual lifetime plan capped at ten channels.
   It refuses existing ids/emails, including soft-deleted ones; never upserts,
   adopts an owner workspace, edits billing, or reads customer posts/channels.
   Re-running an applied seed intentionally refuses without changing records.
5. Verify sign-in and that the workspace switcher contains only the review
   workspace. Verify it has no customer content, connected channels, API keys,
   webhook endpoints or shared integrations. Upload only original review media.
6. Add only this workspace id to `PREVIEW_PROVIDER_ORGS`. Preserve all existing
   `HIDDEN_PROVIDERS`, preview ids and provider credentials. This existing
   server-side allowlist exposes hidden providers to the review workspace,
   including connect authorization; it does not expose them globally.
7. Supply the login securely in the platform's review submission. The unlisted
   guide is `https://app.postdelegate.com/reviewer-guide.html` after deployment.
   It has a robots noindex directive, contains no credentials, and is not an
   authentication or authorization boundary.
8. After review, remove the preview allowlist entry, disconnect review channels,
   and use the normal account deletion process under an owner-approved cleanup.
   Do not delete or reset other workspace data.

## TikTok media ownership — read-only findings

Cloudflare zone `postdelegate.com` is `5b4fe7d77691f21e212f123c0d60980f`.
The existing `media.postdelegate.com` CNAME is proxied to `public.r2.dev`.
A TXT record at that exact hostname already contains a
`tiktok-developers-site-verification=` value. No DNS or R2 records were changed.
The TXT value is public proof, but only the TikTok console can establish whether
it matches app 7700045361989224500 and has been verified. R2 custom-domain
configuration lookup timed out; no bucket binding or media accessibility is
claimed from that lookup. No customer objects were listed or fetched.

TikTok distinguishes domain ownership from URL-prefix ownership. Domain proof
uses the console's exact DNS record. URL-prefix proof requires the downloaded
signature file at the complete URL being verified. A bucket root 404 is normal
when no index object exists and does not invalidate an otherwise public object.

Exact proposed change, if the console uses URL-prefix verification: upload the
console-provided file, with its original filename and bytes, as an R2 object at
that filename in the bucket actually bound to media.postdelegate.com. Use
`Content-Type: text/plain`, no redirect/authentication, and verify an HTTPS GET of
`https://media.postdelegate.com/<provided-filename>` is 200 and byte-identical.
Do not create a fake filename/value or upload an index page. If the console uses
Domain verification, compare its challenge to the existing TXT; add only the new
exact challenge if different, preserving every existing record. First confirm
the R2 custom domain is active; changing its binding is outside verification-only
DNS/R2 authority and needs the CEO's infrastructure decision.

After proof, upload an original test video to the review workspace, fetch its
actual HTTPS media URL without cookies, verify Content-Type/length and redirects,
and record a private Direct Post. A verification TXT alone is not fetch proof.

Sources: [TikTok development configuration](https://developers.tiktok.com/docs/en/set-up-development-configuration),
[TikTok media upload](https://developers.tiktok.com/docs/en/content-posting-api-reference-upload-video),
[TikTok scope migration](https://developers.tiktok.com/bulletin/user-info-scope-migration),
[LinkedIn organization roles](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/organization-access-control-by-role).

## Meta data deletion

Use the existing public instructions URL
`https://app.postdelegate.com/legal/data-deletion` in the **instructions URL**
option of the app's User data deletion field. Do not register an HTML page as a
callback endpoint. Instructions and callback are different configurations.

Primary Meta documentation could not be fetched during this check (HTTP 429),
and no signed-in console is available. Therefore the per-app console selection
and acceptance remain unverified; Platform Approvals must confirm them before
submission. No new endpoint is claimed as required or implemented on the basis
of inaccessible documentation. If an app requires a callback, it needs a separate
reviewed implementation that verifies HMAC-SHA256 signed_request for the correct
app, binds the app-scoped subject to its actual stored grant (Facebook Page and
Instagram ids are not that user id), performs durable deletion, and returns an
opaque confirmation code plus an honest status URL. Never report successful
deletion merely because a callback was received. The existing instructions path
remains usable while that configuration is checked.

Primary source to check when accessible:
[Meta deletion callback](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/).

## What Platform Approvals can record after deployment and seeding

| Flow | Recording | Remaining external gates |
| --- | --- | --- |
| Facebook / Instagram via Facebook | Login, minimal consent, test Page picker, original image/video publish, platform result | Existing app role, professional IG linked to Page, valid credentials and production release |
| Instagram standalone | Login, two publishing permissions, original image/Reel, platform result | Tester invitation accepted in the existing standalone app |
| Threads | Login, two publishing permissions, original text/image post, platform result | Existing Threads tester accepted and credentials installed |
| TikTok | Creator info, explicit SELF_ONLY privacy, interaction/disclosure/music choices, private Direct Post and private result in TikTok | Sandbox/test creator, verified actual media URL, matching app credentials |
| LinkedIn Pages | CMA-only consent, authorized Page selection, original company post | Community Management product approval and actual scopes reconciled |
| Pinterest | OAuth, existing board selection, original Pin and result | Trial owner account; Standard approval before public availability |

Use English UI and 1080p. Record real login/consent, the permission in use, and
the platform result; omit secrets. Never reuse customer accounts for recording.
Meta's logged successful API-call eligibility and business verification are
separate console checks. No live end-to-end test has been run from this branch.

## Local verification record

- Baseline: 22 existing integration-manager and TikTok tests passed.
- New scope/capability/identity/comment gates: 19 tests passed. A regression first
  demonstrated the basic-only TikTok username gap; creator_info now supplies it.
- Reviewer seed: three create-only/identity-isolation tests and the no-DB dry run passed.
- Full Jest suite and backend/frontend type checks are recorded in the PR once
  complete. These are source checks, not a production seed or a real provider post.


## Compatibility and exact-reviewer gates (9 November follow-up)

Optional scope env settings are consent/UI defaults, not evidence of grants on a
stored channel. Existing scheduled replies and saved plug executions continue to
call the platform using their existing tokens. New multi-entry compositions are
still rejected before publishing when optional replies are disabled. Analytics
UI and collection remain disabled by these defaults, including for older broad
grant channels. Do not roll these defaults into a customer deployment until the
release owner has explicitly accepted that analytics/composer behavior or a
per-channel capability migration is implemented. Editing an existing composition
also uses the disabled comment UI; validate that case before any customer rollout.

TikTok OAuth tolerates creator-info limits or temporary errors, returning an empty
handle. Public post links resolve the handle lazily; if it is still unavailable,
the link safely opens TikTok without a malformed /@ path. Publishing itself still
requires successful creator-info checks in the composer/provider.

Business Portfolio Page discovery remains a live gate: connect the exact Meta
reviewer Page, verify it appears in the Page picker, and test publishing before
recording/submission. Keep FACEBOOK_OPTIONAL_SCOPES=business_management (and the
corresponding INSTAGRAM_OPTIONAL_SCOPES value for Facebook login) available for
an approved isolated-test configuration change if discovery needs it; the
production prohibition above still applies. No live proof is claimed.
Threads optional grant introspection/warnings remain unproven; keep its extras off.
The earlier LinkedIn companies-on-auth finding refers to a superseded snapshot:
this branch uses the existing /v2/me member identity path at authentication.
