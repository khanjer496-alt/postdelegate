# PostDelegate launch checklist

Last updated: 27 October 2026 (Asia/Dubai), with live provider proof and the owner-supplied developer-app handoff kept distinct.

**Goal:** A customer signs up, subscribes, connects their own social accounts, and reliably publishes immediately or on a schedule through PostDelegate.

**Current status:** The branded Postiz application is deployed and Google login works. Search Console domain ownership is verified for the existing owner `khanjer496`, and Google branding is published. Two authorized private YouTube UI publications are provider-verified as processed/private; channel/video statistics and analytics also passed live API checks. Sensitive data-access review remains pending. Existing screen recordings are obstructed or incomplete, so a clean complete retake is still required. Other developer apps, paid subscriptions and public customer publishing are not launch-qualified. The deployed YouTube cleanup lifecycle remains default OFF pending its operating gates.

This is the central list of remaining launch work. An unchecked item means missing, unverified, or awaiting a decision; it does not necessarily mean the underlying Postiz feature is absent. Only selected launch networks and advertised features must pass before selling them. Other connectors and feature ports can be explicitly deferred.

## 1. Already completed

- [x] Deploy official Postiz on the existing OVH VPS with PostgreSQL, Redis, Temporal and Caddy.
- [x] Configure Cloudflare HTTPS/proxy and R2 media storage at `media.postdelegate.com`.
- [x] Verify real browser/media uploads and byte-identical public downloads.
- [x] Verify backend, publishing-worker and Temporal health. These are infrastructure checks, not successful social-posting tests.
- [x] Apply PostDelegate branding to the native Postiz UI.
- [x] Remove Hebrew/Israeli-flag locale options; verify English fallback and Arabic RTL.
- [x] Publish the matching modified application source through `/source`.
- [x] Publish owner-approved privacy and terms pages; the deployed YouTube disclosure update is effective 27 October 2026.
- [x] Configure Google profile/email signup and login; set the Google audience to **In production**.
- [x] Verify Google signup, repeat login to the same account/workspace, and continued access to the original password account.
- [x] Enable native Google and email/password registration.
- [x] Verify `postdelegate.com` Search Console domain ownership for existing owner `khanjer496`, pass Google's branding recheck and publish PostDelegate branding. This does not approve sensitive scopes.
- [x] Preserve the previous BrightBean deployment, database, media, configuration and rollback artifacts.
- [x] Install daily local database/configuration backups; restore-test all three Postiz/Temporal database dumps, including the later `20261027T022900Z` snapshot.
- [x] Create a later post-login backup including the published policies and database: `/var/backups/postiz/20261026T165101Z`. This later backup has not had its own full restore test.
- [x] Rebuild and deploy the public marketing site from this Postiz repository's `site/`, source revision `82677def`, to Cloudflare Pages project `postdelegate`, production branch `main` (deployment `c6a90de9-d246-47a4-a096-54d136167c8a`). The old BrightBean studio marketing source remains unchanged.
- [x] Verify the 28-page marketing build, responsive layouts and core interactions; independently check eight hosted routes and 16 assets, actual privacy/terms documents and the matching website source archive. See section 9 and the deployment README for the proof boundaries.

Operations evidence and recovery instructions: [deployment README](deploy/postdelegate/README.md).

## 2. Decisions needed from the owner

- [ ] Choose the social networks available on the first paid launch. Do not promise every connector shown in upstream Postiz.
- [ ] Approve PostDelegate plan names, currency, monthly/annual prices, trial rules and cancellation/refund policy.
- [ ] Choose channel, post, team-member, media/storage and optional AI allowances for each plan.
- [ ] Decide founder/internal/beta account entitlements before enabling paid mode.
- [ ] Choose which differentiated features are launch promises and which are a later release; see section 10.
- [ ] Supply accurate business/contact details and verification documents when a provider or payment processor requests them.
- [ ] Identify the company Page used to register PostDelegate's LinkedIn developer app, or authorize preparing a new Page.
- [ ] Confirm the signed-in LinkedIn account’s email before creating its required company Page. This is the actual 27 October Page-creation blocker; the separately reported account restriction has not been observed in this authenticated console.
- [ ] Complete owner-only identity, password, OTP, CAPTCHA, banking/payout or business-verification steps when required.
- [ ] Choose **Don't Allow** on the macOS “ChatGPT would like to access data from other apps” prompt. This unnecessary access is not needed for the demonstration; native automation cannot dismiss the protected prompt. A human response is pending before a clean recording retake.
- [ ] Decide and enforce Postiz database/Temporal backup retention; review the [four-day proposal](deploy/postdelegate/backup-retention-proposal.md). The planner is dry-run only, and current backups remain intact.
- [ ] Approve each new provider agreement at its final acceptance step. Google setup and PostDelegate policy publication are already approved; LinkedIn's API agreement has not been accepted.

## 3. Social API applications and public access — paid-launch blocker

Review requirements, source corrections and current handoffs are in [the app-review demo plan](POSTDELEGATE-APP-REVIEW-DEMOS.md). Current release `38dd7f0e` includes the earlier TikTok/scope corrections and disabled authorization safeguards; all three builds, 163 regression tests and 10 backup-planner tests passed. Google saved the five approved scopes and enabled YouTube Analytics API. Domain ownership and published branding are verified; YouTube connection, two private publications and analytics are live-tested. Sensitive data-access review, clean complete footage, other provider approvals and hosted revocation/erasure qualification remain pending. The [scope map](deploy/postdelegate/review/oauth-scope-map.md) corrects unsupported script claims.

Google's current **Prepare for verification** screen confirms branding, five scopes and the saved justification, but **Video link — Not provided** keeps **Confirm disabled**. The obstructed/incomplete native takes do not satisfy this submission field; the protected screenshot `google-review-missing-demo-20261027.png` records the blocker.

PostDelegate owns the shared developer applications and stores their credentials on the server. Each customer separately authorizes their own accounts, producing a connection associated with their workspace. For OAuth networks, customers should not need to register developer apps or enter PostDelegate's API secrets. Some other connectors use customer-supplied app passwords, API tokens or site credentials instead.

### Main network setup matrix

Evidence labels matter: **observed** means recorded deployment/browser/console checks; **reported** below means the owner-provided `1-claude-handoff-postiz-env.md`, prepared by Grok Bot at **2026-10-26 21:50 UTC+4**. Its heading “Ready now” refers to reported app/callback existence, not installed credentials, approved public access or a successful customer post. Importing this report did not change any environment, provider configuration or developer account.

| Network | Current evidence | Remaining setup |
|---|---|---|
| Facebook Pages | Reported app `1106117725538645` and Postiz callback registered; Meta development mode | Inspect that existing app and credential installation; finish required public/advanced permissions, business verification and Live mode; test a customer Page outside app roles. Do not create a duplicate app merely because setup is unverified. |
| Instagram through Facebook Business | Reported to share Facebook app `1106117725538645`; callback registered; development mode | Verify installed Facebook credentials and Instagram publishing permissions; complete applicable review and test the required professional-account/Page relationship and media formats. |
| Instagram Standalone | Reported app `2280201996094538`, callback registered; development mode | Verify the existing Instagram app/secret and scopes, complete applicable public-access review and test an eligible professional account. |
| Threads | Reported app `1119176243809209`, callback registered; development mode | Verify installed credentials, callback and publishing permissions; complete required public-access review and actual posting tests. |
| LinkedIn profiles and Pages | Observed: credentials absent; authenticated developer console has no apps; company Page creation requires email confirmation. The separate handoff reports an account restriction. | Confirm the signed-in account’s email and create/associate the correct company Page, then complete the prepared app form, required agreement, callbacks and products/scopes. No restriction was observed in this authenticated console. |
| YouTube | Original `postdelegate` client preserved; five intended scopes granted; two private UI publications processed successfully; channel/video reads and analytics HTTP 200; repeat Google login preserved the same owner/workspace; domain ownership verified and branding published | Satisfy disabled-lifecycle operating gates, capture and QA clean complete footage, complete sensitive data-access review and broader customer acceptance. Existing obstructed/incomplete takes are not review-ready. The second reported client remains unused; do not replace the working pair. Private owner tests do not qualify public customer access. |
| Google Business Profile | Handoff reports the new Google client and `/integrations/social/gmb` registered; no publishing proof | Resolve the Google-client conflict, confirm Business Profile API access and any dedicated credential/fallback choice, then test a customer-authorized location. |
| TikTok | Reported app `7700045361989224500`, client key `awr6csyl2s6b7itb`; form cannot save without review details/demo; callback not added | Continue the existing draft rather than assuming no app exists. Complete the demo, callback, Content Posting/Direct Post permissions and production review; complete the audit for public posting and required media URL/domain verification. |
| TikTok Business | No separate completed setup evidenced by this handoff | Decide whether the separate provider is in launch scope and confirm its own app, credentials, permissions and tests. Do not assume the TikTok draft qualifies it. |
| X | Reported app `33577748`, callback registered, pay-per-use account at zero credits | Verify OAuth 1.0a consumer `X_API_KEY`/`X_API_SECRET`, read/write access and live callback. The reported OAuth 2.0 client identifier is not the credential Postiz expects. Owner decides whether to fund usage; then test supported posting. |
| Pinterest | Reported app `1629300`, callback registered, trial access with posts visible only to the account owner | Verify credentials and actual trial limits; obtain applicable Standard/production access before offering customer-public publishing; test the customer's board and provider-side visibility. |
| Reddit | Reported waiting for data-access approval; app/callback not yet created | Track the existing access request and confirm permitted commercial use before completing credentials, callback and allowed-posting tests. |
| Discord | Reported account signup blocked by CAPTCHA; no app | Complete the owner account step before creating/configuring the app, bot and callback; keep the provider unavailable meanwhile. |

### Additional app inventory reported at 21:50 — not live-qualified

| Provider | Reported public identifier / setup | Next verification |
|---|---|---|
| Twitch | Client `5o6cie5cz538bafc5q1cbkdu2jtlg9`; callback registered | Confirm existing app, securely install/verify the secret and qualify its actual supported actions. |
| Kick | Client `01M5PYHZ65SRE1QA6N9MD5HTNJ`; callback registered | Verify app configuration and `KICK_CLIENT_ID`/`KICK_SECRET`, then authorize and test. |
| Dribbble | Application `271295`; client `Dp9YKn3YguSpbbjEv_l7Svy6TaZne74ObThqIfaMON8`; callback registered | Inspect the existing app and verify credential installation, account permissions and supported publication. |
| Tumblr | Client `9PyPjmvLjO53cqwalSDXcJNsvNHEvPeg4JyL2ZSgkTvpbVDVw6`; callback registered | Verify existing app/credentials and actual authorization/posting behavior. |
| Slack | App `A0CBU48N3PC`; client `12386945468375.12402144751794`; callback registered | Verify `SLACK_ID`, `SLACK_SECRET` and any required `SLACK_SIGNING_SECRET`, distribution/scopes, workspace authorization and posting. |
| Telegram | Bot `@PostDelegateBot` exists; token reportedly in BotFather | Owner supplies the token through protected configuration; verify bot ownership, destination permissions and actual supported messages. No token is recorded here. |

These reported registrations do not establish that secrets were copied or installed. Other source providers are **Mastodon, Bluesky, Lemmy, Farcaster, Nostr, VK, Medium, Dev.to, Hashnode, WordPress, Listmonk, Moltbook, Whop, Skool and MeWe**. Their configuration, public permissions and posting behavior remain unqualified. Verify only the selected launch providers; defer/hide the rest. Source presence or an app identifier is not public API approval.

### Google project/client reconciliation — preserve working login

- **Observed production baseline:** project `postdelegate`, project number/client prefix `325521386136`; client named `PostDelegate Web`; native Google signup and repeat login passed using `YOUTUBE_CLIENT_ID`/`YOUTUBE_CLIENT_SECRET` and `https://app.postdelegate.com/integrations/social/youtube` (see deployment README).
- **Conflicting handoff report:** project `postdelegate-app`, client `790268112731-jl8h3ooffi6jpm7nn2e9pgrbre7rq1gd.apps.googleusercontent.com`, also named `PostDelegate Web`; YouTube and `gmb` callbacks reportedly registered. This identity has not been verified against the working runtime or console during this update.
- [ ] Compare the existing projects, client ownership, consent audiences, enabled APIs, granted/requested scopes and registered redirects; record which identity should serve native login and each publishing provider.
- [ ] Preserve the working production `YOUTUBE_CLIENT_ID`/`YOUTUBE_CLIENT_SECRET` and its recovery materials. Do not overwrite them from this handoff or create/rotate another client as a reconciliation shortcut.
- [ ] If a change is later chosen, preserve the tested native callback, stage the credential/configuration change with rollback, and verify Google signup, repeat login and the original LOCAL account before accepting it.
- [x] Verify the existing client's YouTube owner-channel authorization, private publication and analytics independently of native login.
- [ ] Separately qualify Google Business Profile API access and its intended credential identity; a registered callback is insufficient.
- [ ] Retain the working native Google credential set and rollback configuration until both login and every intended publishing flow using a replacement have passed; a different client in a handoff is not authorization to discard the tested client.

### Repeat for every selected launch network

- [ ] Record the business-owned developer account, application identifier, administrator and support contact. Store secrets only in protected credential storage, never in this checklist.
- [ ] Register the exact production callback URL and required website/domain ownership proofs.
- [ ] Request only the permissions needed by the implemented features; confirm the granted scopes satisfy Postiz's provider implementation.
- [ ] Complete the provider's applicable business verification, app review, production-mode switch and publishing audit.
- [ ] Prepare an accurate reviewer demo/test account and feature walkthrough where required.
- [ ] Install real client IDs/secrets securely on the VPS and recreate only affected services.
- [ ] Verify the generated OAuth URL contains the correct client ID and callback, with no `undefined`, placeholders or stale Django callbacks.
- [ ] Test with a customer account outside developer/tester roles where the provider supports public access.
- [ ] Verify actual channel connection and provider-side publication using section 7; record evidence and any remaining limits.
- [ ] Track quota/rate limits, token expiry, review renewals and API-version changes.
- [ ] Hide unready connectors from Add Channel and remove unsupported claims from pricing/marketing. This source supports `HIDDEN_PROVIDERS`; verify the resulting UI.
- [ ] Reconcile the handoff's proposed `HIDDEN_PROVIDERS` value (`linkedin,linkedin-page,reddit,discord,tiktok,tiktok-business`) with actual runtime readiness. It is a reported recommendation, not an applied or sufficient launch-qualified allowlist; other unverified connectors may also need to stay hidden.

### Callback and credential reference

The normal OAuth callback shape is `https://app.postdelegate.com/integrations/social/{provider}`. Check each provider's current implementation and dashboard before registering it.

| Provider identifiers | Server credential names / notes |
|---|---|
| `facebook`, `instagram` | `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` |
| `instagram-standalone` | `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` |
| `threads` | `THREADS_APP_ID`, `THREADS_APP_SECRET` |
| `linkedin` | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` (personal app) |
| `linkedin-page` | `LINKEDIN_PAGE_CLIENT_ID`, `LINKEDIN_PAGE_CLIENT_SECRET` (separate app: LinkedIn grants the Community Management API only to an app holding no other product). Falls back to the personal app's variables when unset |
| `youtube` | `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`; also used by working native Google login, so preserve that callback and retest login when changing this client |
| `gmb` | `GOOGLE_GMB_CLIENT_ID`, `GOOGLE_GMB_CLIENT_SECRET`, with the documented YouTube-credential fallback |
| `tiktok` | `TIKTOK_CLIENT_ID`, `TIKTOK_CLIENT_SECRET` |
| `tiktok-business` | `TIKTOK_BUSINESS_CLIENT_ID`, `TIKTOK_BUSINESS_CLIENT_SECRET` |
| `x` | `X_API_KEY`, `X_API_SECRET` |
| `pinterest` | `PINTEREST_CLIENT_ID`, `PINTEREST_CLIENT_SECRET` |
| `reddit` | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` |
| `discord` | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN_ID` |
| `twitch` | `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` |
| `kick` | `KICK_CLIENT_ID`, `KICK_SECRET` |
| `dribbble` | `DRIBBBLE_CLIENT_ID`, `DRIBBBLE_CLIENT_SECRET` |
| `tumblr` | `TUMBLR_CLIENT_ID`, `TUMBLR_CLIENT_SECRET` |
| `slack` | `SLACK_ID`, `SLACK_SECRET`, plus `SLACK_SIGNING_SECRET` where the integration needs signed interactions |

For this Postiz version, both LinkedIn providers request `openid`, `profile`, `w_member_social`, `r_basicprofile`, `rw_organization_admin`, `w_organization_social` and `r_organization_social`. Complete the required product access; do not merely remove scopes from the outgoing URL to bypass Postiz's checks.

## 4. Payments, subscriptions and plan enforcement — paid-launch blocker

**Current state:** Billing is inactive. Postiz contains Stripe/subscription code, but it has not been configured or qualified for PostDelegate's paid customer journey.

- [ ] Finish the business Stripe account and payout setup through the owner.
- [ ] Implement the approved PostDelegate plans, prices and allowances consistently in backend entitlements, checkout and marketing.
- [ ] Review the stock trial/card-validation behavior before enabling it: the inspected code has a seven-day trial and a USD 1 authorization/cancellation flow. Align it with the actual offer.
- [ ] Configure `STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY` and `STRIPE_SIGNING_KEY` securely, initially in test mode.
- [ ] Configure the signed production webhook, using the selected `/api/stripe` or `/api/payment/stripe` route, and the customer billing portal.
- [ ] Handle owner/beta organizations deliberately: enabling paid mode changes stock unsubscribed organizations to a FREE tier with zero channels/posts.
- [ ] Verify checkout success becomes the correct workspace subscription through a trusted webhook, rather than relying on the browser's success URL.
- [ ] Verify webhook signatures, retries, duplicates and out-of-order delivery cannot grant duplicate or incorrect entitlements.
- [ ] Verify monthly/annual purchase, any trial, renewal, upgrade, downgrade, cancellation, end-of-period expiry and applicable refunds.
- [ ] Define and test failed-payment, recovery and grace/suspension behavior. The inspected event switch has no explicit `invoice.payment_failed` handler; prove the actual lifecycle rather than assuming it.
- [ ] Enforce channel/post/team/API/AI allowances on server-side paths as well as the UI, including scheduled work after a subscription changes.
- [ ] Confirm inactive AI/video/design features cannot be sold or used through an unintended entitlement path.
- [ ] Verify receipts, invoices, currency, taxes and the customer-facing renewal/cancellation wording match the chosen business setup.
- [ ] Complete a controlled live payment/refund acceptance check after owner authorization; then enable the intended public checkout.

Implementation notes: prices/allowances are in [pricing.ts](libraries/nestjs-libraries/src/database/prisma/subscriptions/pricing.ts), with billing logic in [stripe.service.ts](libraries/nestjs-libraries/src/services/stripe.service.ts) and [permissions.service.ts](apps/backend/src/services/auth/permissions/permissions.service.ts). Editing Stripe's dashboard alone does not redefine all application plan rules. Preserve internal event metadata identifiers unless both producers and consumers are intentionally updated.

## 5. Email, account recovery and customer support — paid-launch blocker

- **21:50 report:** Resend domain `send.postdelegate.com` is verified. API-key creation/availability and server installation are not established by the handoff; no new delivery test is recorded. Treat this as progress on provider setup, not working transactional email.
- [ ] Inspect the existing Resend domain and any protected key already supplied before creating duplicates; configure the supported Postiz sending path and sender. Transactional email was inactive at the last recorded runtime check.
- [ ] Set and verify required SPF/DKIM records and a suitable DMARC policy for the chosen sender.
- [ ] Verify real delivery of password resets, any enabled verification flow, invitations, publishing failures and billing/account notices.
- [ ] Check expired/used reset links, resend behavior and recovery for LOCAL accounts. Google login has been tested; password-reset email has not.
- [ ] Confirm `support@postdelegate.com` receives mail and is monitored; publishing an email address does not prove delivery.
- [ ] Define how support, failed posts, billing issues and provider reconnect requests are handled.
- [ ] Review notification settings and hide or explain email features until sending is working.
- [ ] Verify the intended behavior when a customer uses Google login and a password account with the same email. Current native behavior creates separate identities/workspaces; do not silently merge them without a designed, verified linking flow.

## 6. Customer isolation, abuse controls and data handling — paid-launch blocker

These are verification requirements, not claims that every listed control is currently missing.

- [ ] Test two independent customer organizations: one cannot read, modify or use the other's posts, channels, media records, credentials, API keys, webhooks, billing records or invitations.
- [ ] Verify team roles, invitation acceptance and email binding, removed members, workspace switching and organization-bound OAuth callbacks.
- [ ] Verify OAuth state expiry/replay, account disconnect, revoked grants, expired sessions and secret exposure in logs/errors/source downloads.
- [ ] Review protection of stored social access/refresh tokens and database/backup access. The inspected persistence path stores token values through Prisma; do not claim application-level token encryption without verification or implementation.
- [ ] Verify signup/login/reset/upload abuse controls and practical per-customer rate, storage and media-size limits.
- [ ] Validate allowed upload types and publishing media constraints; check malicious/oversized files and any server-side URL fetching used by enabled features.
- [ ] Decide and document the intended draft-media privacy model. Current R2 media URLs are publicly retrievable without application login, as disclosed in the published policy.
- [ ] Verify authenticated isolation of media records and upload operations; if private draft media is promised, implement and test an appropriate delivery/access design before offering that promise.
- [ ] Test disconnect, access/export and identity-verified deletion requests across application records, R2 objects, relevant caches and recovery copies.
- [ ] Define retention for account/content records, logs, media, backups and preserved BrightBean data; align the actual process with published disclosures.
- [ ] Verify any platform-required deletion/revocation endpoint. Old `/data-deletion` and `/legal/data-deletion/` routes were observed resolving to signup; implement proper routes if linked or required by selected platforms.
- [ ] Refresh privacy/subprocessor disclosures and obtain required approval before enabling new AI, email, payments, tracking or additional platform processing.
- [ ] Keep the matching public source offer current and free of secrets with each deployed application release.

## 7. Real publishing acceptance — required for each sold network

Record the tested account type, provider products/scopes, release, test time, actual provider result and any limitations. Use authorized test content and destinations.

- [ ] Connect a genuine customer-authorized account through the production domain.
- [ ] Publish an immediate supported post and verify it actually appears on the provider, with the intended visibility and correct author/account.
- [ ] Publish supported images/video/carousels and other advertised formats; verify R2 media fetching from the provider rather than only from a local browser.
- [ ] Schedule a post, close the browser, and verify the server publishes at the expected time and timezone.
- [ ] Verify editing, rescheduling and cancellation of pending posts.
- [ ] Verify retry/backoff for temporary errors and rate limits, without duplicate publishing.
- [ ] Restart the worker/application during a scheduled test and verify persistence/recovery.
- [ ] Verify token refresh or a clear reconnect path when refresh is unavailable; test revocation and disconnect.
- [ ] Confirm a customer's account permission changes and plan changes cannot produce unauthorized posting.
- [ ] Verify failures are visible to the right customer with a usable reason and working notification path.
- [ ] Exercise concurrent posts from two organizations and verify correct account/workspace attribution.
- [ ] Record provider-side publication identifiers/results as evidence; a successful auth URL, channel icon or healthy worker does not complete this gate.

## 8. Production operations and recovery — paid-launch blocker

- [ ] Add automated off-site backup replication with protected/encrypted access and a documented retention policy. Current daily automated backups stay on the VPS; earlier Mac copies were manual.
- [ ] Cover Postiz, both Temporal databases, runtime secrets/configuration, policy/source deployment assets and media recovery needs.
- [ ] Perform a current-release recovery test from the intended off-site backup location, including media references and scheduled work; record recovery time and any data-loss window.
- [ ] Verify VPS reboot/service restart recovery without starting the preserved BrightBean worker or causing duplicate publishing.
- [ ] Add uptime, worker/queue failure, webhook failure, disk, backup age and resource-usage monitoring with alerts that reach the operator.
- [ ] Define practical customer/media/queue capacity and budget alerts for the VPS, R2, platform APIs and optional AI providers.
- [ ] Review dependency/base-image updates, security patches and a repeatable deployment/rollback procedure that preserves current OAuth, policy and source routes.
- [ ] Protect platform/payment/email secrets with least access, backup protection and a usable rotation/recovery process.
- [ ] Document incident response, posting pause/recovery and customer communication responsibilities.

## 9. Public website and onboarding — paid-launch blocker

- [x] Publish the Postiz-inspired marketing redesign with PostDelegate's own identity, current workspace screenshot, illustrative previews and truthful early-access copy. Provider-directory coverage is separated from available hosted connections; no upstream customer counts, testimonials or awards are presented as PostDelegate proof.
- [x] Remove the old BrightBean pricing/trial/allowance, autonomy/approval, API-endpoint and source-branding promises across the homepage, secondary pages, FAQ, machine-readable facts and metadata. AI/API/MCP pages explain the integration rollout; the pricing page describes use cases without offering unapproved paid packages.
- [x] Correct signup and login links to the current Postiz flow, legal/support/deletion references and application/website source links. Independent hosted checks covered eight routes and 16 assets; privacy and terms returned their actual documents, rather than a successful authentication-page redirect.
- [x] Build 28 static pages and verify no horizontal overflow at desktop 1280 px, tablet 1024/768 px and mobile 390/320 px widths. This is responsive-layout evidence, not a full accessibility or paid-customer acceptance audit.
- [x] Exercise desktop/mobile navigation menus, FAQ disclosures, workflow-preview tabs and the browser-based caption/UTM tools. No social-provider publication or paid checkout is established by these website interaction tests.
- [x] Publish `/website-source.tar.gz` and independently inspect its 96 members: no secret-bearing files or Mac metadata were found, and the archived homepage matches the deployed source. SHA-256: `35bf00479ffe35a1aa51910b7d1a9fbd659f89a9ef649585481664c04d220b55`.
- [ ] Replace early-access plan placeholders with final approved prices, allowances, trial/renewal terms and enabled-feature promises when billing is ready. Recheck backend entitlements, checkout and marketing together.
- [ ] Verify future checkout buttons and the complete paid onboarding flow after payments are configured; the current signup/login link checks do not complete this work.
- [ ] Complete onboarding that clearly tells customers which account types and permissions each offered network requires.
- [ ] Show connection/reconnect and publishing failures clearly; avoid offering unconfigured connectors that generate `client_id=undefined`.
- [ ] Hide unready connectors in the application and verify the resulting Add Channel UI. Truthful rollout notices on the marketing site do not qualify or disable an app connector.
- [ ] Make plan usage, billing portal/cancellation and support easy to find.
- [ ] Check the paid customer journey on desktop and mobile, plus the languages/accessibility behavior actually advertised.

Canonical marketing source is now **this repository's `site/`**, not `/Users/naserkhanjar/Projects/postdelegate-studio/site`. Cloudflare Pages production deployment `c6a90de9-d246-47a4-a096-54d136167c8a` serves source `82677def`; preview identifier `f0488ab1`. Marketing-only rollback is available in the Pages dashboard to prior deployment `3b7273f8-1205-4876-b125-5abf57bb2834`. This does not roll back the app, provider setup or customer data.

## 10. BrightBean migration and differentiated features — decide launch scope

The new deployment has PostDelegate branding on Postiz. The old BrightBean product's custom features have not been ported. Complete each advertised launch promise or explicitly defer it and update marketing.

- [ ] Maintain a **keep / port / rebuild better / new** parity matrix against the preserved BrightBean fork before rebuilding overlapping Postiz features.
- [ ] Decide and implement any promised autonomy rules, publishing guardrails, undo behavior, crisis pause and audit trail.
- [ ] Decide and implement any promised client approvals, client portals, agency/team workflows and additional inbox behavior.
- [ ] Decide and implement any promised reports, custom onboarding and custom subscription/entitlement behavior.
- [ ] For AI features selected for launch: configure the provider, verify outputs and failure behavior, enforce cost/usage limits and update disclosures before enabling customer use.
- [ ] Decide whether to import or retain/archive the old five BrightBean draft posts and other preserved records. They have not been imported into Postiz.
- [ ] Keep the old deployment/keys/data recoverable until the migration retention decision is explicit; reconcile new schedules before any scheduler rollback.

Reference forks: current Postiz in this repository; preserved BrightBean source at `/Users/naserkhanjar/Projects/postdelegate-studio`, baseline `c3a8298`. Preserve unrelated local changes when revisiting either checkout.

## 11. Final go-live gate

- [ ] Launch networks and plan promises are explicitly listed and match the customer UI/website.
- [ ] Every sold network has passed public/customer authorization and actual immediate/scheduled publishing tests.
- [ ] Signup → payment → trusted webhook → correct entitlement → connection → scheduled publication has passed as one complete customer journey.
- [ ] Customer separation, plan enforcement, recovery email and support delivery have passed.
- [ ] Cancellation, expiry, failed payment/recovery, disconnect, token expiry and posting failures behave as documented.
- [ ] Privacy/deletion operations, off-site recovery and alert delivery are verified.
- [ ] Existing founder accounts and preserved migration data remain accessible/recoverable as intended.
- [ ] Record the released image/source revision, provider approval state, known limitations, proof links and go-live time.
- [ ] Start paid onboarding only for the capabilities that passed; keep deferred networks/features hidden or clearly unavailable.

## Suggested execution order

1. Decide launch networks, plans and feature promises.
2. Reconcile reported existing social apps, the Google-project conflict, credential installation and current access restrictions; finish missing setup and begin required external reviews.
3. Configure/test Stripe and email without disrupting current owner access.
4. Qualify connections, publishing, tenant isolation and data operations.
5. Finish off-site recovery, alerting and accurate marketing/onboarding.
6. Run the complete paid-customer journey and record final acceptance.

## Evidence and setup references

- [Deployment status and rollback](deploy/postdelegate/README.md)
- [Deployment execution record](docs/superpowers/plans/2026-10-26-postdelegate-postiz-vps.md)
- Owner-supplied `1-claude-handoff-postiz-env.md`, prepared by Grok Bot at 2026-10-26 21:50 UTC+4: imported as reported app/callback inventory only; runtime installation, console status and real publishing require separate verification. No secrets from that handoff are stored here.
- [Provider registration and credential overview](https://docs.postiz.com/self-host/providers/overview)
- [Facebook setup](https://docs.postiz.com/self-host/providers/facebook)
- [Instagram setup](https://docs.postiz.com/self-host/providers/instagram)
- [LinkedIn required products, scopes and callbacks](https://docs.postiz.com/self-host/providers/linkedin)
- [TikTok Direct Post prerequisites and audit](https://developers.tiktok.com/docs/en/content-posting-api-get-started)
- [Google sensitive-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
- [X setup](https://docs.postiz.com/self-host/providers/x-twitter)
- [Provider registry and hidden-provider configuration](libraries/nestjs-libraries/src/integrations/integration.manager.ts)

Provider rules and prices change. Recheck the relevant live dashboard and official documentation at setup/review time. Do not mark a provider ready from credentials alone: configuration, external approval, customer authorization and an actual successful post are separate evidence.
