# PostDelegate developer-app review recordings

Checked: 26 October 2026. This supplements the [launch checklist](POSTDELEGATE-LAUNCH-CHECKLIST.md).

User-supplied script pack: [PostDelegate launch review pack](https://postdelegate-launch-review-pack-s6yz.pages.grok.bot/). It was read in the browser. Its statements about developer dashboards, account restrictions, business verification and completed checkboxes are reported setup information, not proof of installed credentials, approval or publication.

## Current position

- The public website, actual app, privacy and terms pages are live. The pack's blanket “hold until the site is live” instruction is outdated.
- A fresh read-only check of the running Postiz container found incomplete credential pairs for Facebook, Instagram Standalone, Threads, TikTok, Pinterest, LinkedIn and X. This checks presence only; it does not validate any credential or external permission.
- The existing YouTube-named credential pair is present and still belongs to the tested Google client starting `325521386136-`. Native Google login works; YouTube publishing is not qualified.
- A fresh database query found **zero active social-channel connections**.
- No review recording, successful social test post or review submission was produced by these checks.
- The pack describes a second Google project/client (`postdelegate-app`, prefix `790268112731-`). Reconcile ownership, branding, callbacks and scopes before replacing the working production credentials. Postiz currently shares the YouTube credential variables with native Google login.
- TikTok composer/provider corrections and narrower YouTube scopes are deployed in source release `038e57dc`. All three builds and 61 focused tests passed; hosted API/worker health and preserved account/media counts were independently verified. See the [scope map](deploy/postdelegate/review/oauth-scope-map.md) and [deployment evidence](deploy/postdelegate/README.md#review-preparation-release--26-october-2026). These checks are separate from a live provider connection or audit approval.
- Original test media is ready and was uploaded through the real PostDelegate media library to R2. The 12-second H.264/AAC clip is 720×1280; the app-compressed image is 800×1000. The downloaded hosted video matches the local SHA-256. These files are upload fixtures, **not review screen recordings**.
- Facebook, Pinterest and TikTok developer consoles are signed out in the available Chrome session. Their login tabs are prepared; the owner chose to sign into Facebook later. The approved five-scope Google declaration and truthful justification were saved successfully in project `postdelegate`. YouTube Analytics API was enabled with owner-approved terms, and the dashboard shows **Enabled**. These steps are not a customer authorization or verification approval.
- YouTube's real authorization flow now requests the five intended scopes using the preserved Google client. The selected account is paused at Google's unverified-app warning pending explicit account-access approval. No authorization grant or connected channel has been completed.
- No screen recording has been produced. Native QuickTime control timed out twice in this session; complete the real publishing flow and use an available recorder before submitting footage. Do not substitute the upload fixture or a simulated walkthrough for the required end-to-end recording.

**Next milestone:** complete a real tester connection and successful test post, then record that working flow. Use developer/tester/sandbox permissions where the platform supports them before public-access approval.

## 1. Prepare the demo environment

- [ ] Securely install the selected providers' real client IDs and secrets; recreate the affected container and verify the runtime configuration without exposing values.
- [ ] Verify exact Postiz callbacks, app identity and every requested scope against the intended developer app.
- [ ] Prepare a dedicated reviewer/demo PostDelegate workspace with access to the demonstrated features. The pack's “subscription already active” statement has not been established; billing is currently inactive.
- [ ] Keep reviewer credentials in the provider's private review fields. Do not reuse the production founder login or put passwords/API secrets in the public pack or recording.
- [ ] Prepare a Facebook test user/Page and eligible Instagram professional account; accept any Instagram/Threads tester invitations.
- [ ] Add an eligible private TikTok account as a sandbox target user for first-time review.
- [ ] Prepare a YouTube channel and Google test account for the chosen project; prepare an existing Pinterest test board/account for the Pinterest flow.
- [x] Prepare an original image and a short original MP4 clip that can be posted to the authorized test destinations. Local files are in ignored `.local/review-media/`; regenerate with `deploy/postdelegate/review/create-demo-media.py`. These upload assets are separate from the screen-recording videos submitted to reviewers.
- [ ] Complete required business/identity checks and usable API access or funding where necessary. Follow the actual dashboard; do not treat a US-phone claim or payment/auto-recharge recommendation in the pack as a universal requirement or spending authorization.
- [ ] Fix the source issues in section 3 and verify each demo feature before recording it.

## 2. The recording sequence

This is a recommended concise recording script, not a universal provider duration/resolution rule. Use the limits and fields shown by the current review form.

1. Open the real public PostDelegate website and show its privacy/terms links.
2. Sign into the dedicated demo workspace without exposing the password.
3. Start **Add Channel** from a disconnected state.
4. Show the provider's actual authorization screen, correct app identity and requested permissions; authorize the test account.
5. Select the intended account, Page, channel or board and show it connected in PostDelegate.
6. Compose an original test post, choose its destination/settings and use **Post now**. Demonstrate a video upload when requesting a video-specific capability; an image Pin is sufficient for a Pinterest action demonstration.
7. Open the provider and show the resulting post, destination and visibility. A successful status label in PostDelegate alone is insufficient evidence of publication.
8. Demonstrate every additional requested feature/permission that is actually implemented, such as a first comment on a provider that supports it or available analytics. YouTube's provider does not insert comments. Do not invent results or imply that a local edit changed the remote post.
9. Provide written reviewer steps and any required private demo access. Use readable English UI/narration and keep the relevant browser URL visible.

Suggested separate flows are Facebook Pages, the selected Instagram login route, Threads, TikTok, YouTube and Pinterest. Record both Instagram routes only if both are being submitted. Follow the review form if it requests combined or separate clips for particular permissions.

| Provider | What the recording/submission needs |
|---|---|
| Facebook / Instagram / Threads | Actual login/consent, account selection, supported publication and the features tied to requested permissions. Start with proper app-role/tester access and confirm current Meta review fields/business requirements in the dashboard. Meta's primary screencast documentation returned HTTP 429 during this research, so the pack's exact format and per-permission assertions remain to be checked there. |
| TikTok | First app review must use the sandbox and show the actual website integration, all requested products/scopes and user interactions. TikTok allows at least one, at most five demo files, each up to 50 MB. Direct Post public-visibility audit is a separate step. |
| YouTube / Google | Record the actual selected OAuth client, English consent/sign-in, visible app name/client ID and the working use of every requested sensitive scope. The current verification guide directs submission of an Unlisted YouTube video link. Published branding and data-access verification are separate from the audience's “In production” setting. |
| Pinterest | Show the user OAuth flow and a real Pinterest API action, such as choosing an existing board and creating a Pin. Trial-created Pins/boards are visible only to their creator. Generic product tours or wireframes do not satisfy the live-integration requirement for Standard access. |
| LinkedIn | Resolve the reported account restriction and company Page/app setup first. Select the API product/tier that grants the exact scopes used by this Postiz build, then follow its actual demo requirements. The script pack is not proof that Community Management access alone grants all current provider scopes. |
| Google Business Profile | Qualify API access before recording the location/post workflow. Current prerequisites require a managed, verified Business Profile active for at least 60 days with the business website listed; it may be a managed client's profile. This can be deferred independently of YouTube. |

## 3. Correct the supplied script pack before filming

The findings below led to source corrections in this review-preparation work. Checked implementation items have focused regression coverage; real provider demonstrations remain pending.

### TikTok: product work required before Direct Post audit

- [x] Use fresh creator information for nickname, available privacy choices, disabled interactions and duration limits. The composer checks browser video metadata against the current account limit; the backend independently refreshes permissions before Direct Post.
- [x] Remove the UI's public-visibility preselection and backend public fallback; require explicit user privacy selection from the current creator's options.
- [x] Start interaction choices unchecked and disable those the creator cannot use. Do not show Duet/Stitch for photo posts.
- [x] Require explicit music/upload consent for ordinary as well as commercial Direct Posts.
- [x] Enforce commercial choices, correct labels and branded-content/private restrictions. Disable actual publishing controls when prerequisites are incomplete, preserving draft/update-only operations.
- [x] Use `PULL_FROM_URL` for hosted media with public HTTPS validation; retain streaming `FILE_UPLOAD` for local video files. Video inbox uploads send only supported `source_info`, while photo uploads retain their supported title/description.
- [ ] Verify the actual serving domain `media.postdelegate.com` in the TikTok developer app; do not assume apex-domain verification covers it.
- [ ] Verify processing/status feedback and successful private sandbox publication.

Source pointers: [TikTok composer](apps/frontend/src/components/new-launch/providers/tiktok/tiktok.provider.tsx), [TikTok provider](libraries/nestjs-libraries/src/integrations/social/tiktok.provider.ts), and [focused review tests](deploy/postdelegate/review/tests). Duration inspection on the backend is not implemented; the composer enforces the current creator duration limit using browser metadata.

The pack's separate **upload to TikTok inbox** step is supported in source through the `UPLOAD` path, subject to actual `video.upload` authorization and testing. Show the real inbox receipt/completion if retaining that permission. It is not the same as Direct Post and does not apply all Direct Post settings.

### YouTube: remove unsupported published-video editing claims

The pack proposes changing an already-published YouTube title through PostDelegate. No remote `videos.update` implementation was found. The provider creates new uploads, and a local post update does not establish an update to the existing YouTube video. Remove that demo/justification or implement and test it first.

- [x] Map actual YouTube operations to required scopes; remove unused broad `youtube`, `youtube.force-ssl` and `youtubepartner`.
- [x] Use the same five-scope list for authorization and granted-scope checks. See the [scope map](deploy/postdelegate/review/oauth-scope-map.md).
- [ ] Keep native Google login working while reconciling the two Google clients.
- [ ] Demonstrate upload, optional custom thumbnail, channel/video reads and analytics. Do not demonstrate comment insertion or published-video editing; neither is implemented by this provider.

Source: [YouTube provider](libraries/nestjs-libraries/src/integrations/social/youtube.provider.ts), scopes at 65–74 and new upload at 602–624; [post service](libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts), local update handling around 1210–1216. Check current line positions when editing.

### LinkedIn: incoming comment inbox is not established

The pack proposes showing a member's incoming LinkedIn comment inside PostDelegate. Inspected provider code has outbound comment creation and aggregate comment-count analytics; the app's local review comments are not an imported LinkedIn inbox. Remove that promise or implement/verify the incoming feature before submitting it.

### Pinterest: existing board picker, not board creation

The current composer selects existing boards and directs users to create one first if none exist. Use a pre-created test board in the recording. Pinterest's current official API specification requires **`boards:write` for `POST /pins` even with an existing board**, so that permission is retained. Its presence is not a board-creation feature. The authorization URL and checks now derive from one scope list; see the [scope map](deploy/postdelegate/review/oauth-scope-map.md).

## 4. Submit only after the working flow is proven

- [ ] A real tester can reproduce connection and publication on the submitted domain.
- [ ] Every requested feature/scope has a truthful explanation and visible working demonstration.
- [ ] The chosen developer app, runtime credentials, callback, consent identity and recorded client ID all match.
- [ ] Privacy disclosures and deletion/support paths accurately cover the enabled data processing.
- [ ] Business verification and any separate API-access prerequisites are satisfied where required.
- [ ] Reviewer login/access and links work; recordings are accessible and contain no passwords, API secrets or access tokens.
- [ ] Submit the correct review/audit stage and record its actual status. Preparing a script or uploading a recording is not approval.

No review submission, social test post or payment has been made during this preparation. Uploading fixtures to PostDelegate/R2 does not establish social publication.

## Primary references checked

- [TikTok app-review requirements](https://developers.tiktok.com/docs/en/app-review-guidelines)
- [TikTok publishing UX and media-transfer rules](https://developers.tiktok.com/docs/en/content-sharing-guidelines)
- [Google verification and demo-video instructions](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
- [Pinterest Trial/Standard requirements](https://developers.pinterest.com/docs/key-concepts/access-tiers/)
- [Google Business Profile API prerequisites](https://developers.google.com/my-business/content/prereqs)
- [Meta screen-recording guide — primary fetch was rate-limited](https://developers.facebook.com/docs/app-review/submission-guide/screen-recordings/)
- [Postiz Instagram setup — integration-specific fallback](https://docs.postiz.com/self-host/providers/instagram)
- [Postiz Threads setup — integration-specific fallback](https://docs.postiz.com/self-host/providers/threads)
- [Postiz LinkedIn product/scope requirements](https://docs.postiz.com/self-host/providers/linkedin)
