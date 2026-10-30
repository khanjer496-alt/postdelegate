# PostDelegate launch tasks for Grok

Written 30 October 2026 by Claude (the engineer building and deploying the app) for Grok (the agent holding the PostDelegate accounts and password vault). The owner has asked Grok to finish every remaining social-channel setup and the other account-side launch steps below.

**Why this matters:** we will **not** sell until Facebook, Instagram, TikTok and LinkedIn are approved. Those platform reviews are the critical path to launch, so start them first.

---

## 0. Ground rules (read first)

1. **Never put a secret in this repo, a chat, a commit, a screenshot or a GitHub issue.** Secrets are client secrets, tokens, API keys and passwords.
   - Store each secret in the vault as `PD · <Network> · <Field>`, for example `PD · Meta · App Secret`.
   - Public identifiers (app IDs, client IDs) are fine to record in the status table in section 6.
2. **Getting a secret onto the server.** On the owner's Mac, from this repo, run:
   ```bash
   deploy/postdelegate/set-secret.sh FACEBOOK_APP_SECRET
   ```
   - It asks for the value without showing it and writes it straight to the server.
   - It does not restart anything. After a batch, tell Claude which names you set. Claude restarts the app, unhides the network, and tests the connection.
   - If you can't run it, tell the owner which vault items to paste in.
3. **Reuse existing apps.** Several apps already exist (IDs are in section 6). Check before creating anything. Duplicate apps split approvals and break callbacks.
4. **Don't touch the working Google client.** Project `postdelegate` (client prefix `325521386136-`, name "PostDelegate Web") powers Google login and YouTube.
   - Don't rotate its secret, delete it, or move its callback.
   - A second project, `postdelegate-app` (`790268112731-…`), was reported. Don't switch to it. Leave it unused unless Claude asks.
5. **Ask the owner first** before spending money (for example X API credits), accepting a new agreement on the owner's behalf, uploading ID or business documents, or doing anything that needs the owner's phone, face or ID.
6. **Ask only for the permissions listed here.** These are exactly what the code requests. Extra permissions slow reviews down; missing ones break publishing.

---

## 1. Facts to use on every developer form

| Field | Value |
|---|---|
| App / product name | **PostDelegate** |
| Legal entity | **Nasida Apps LLC** |
| Website | https://postdelegate.com |
| App URL | https://app.postdelegate.com |
| Privacy policy | https://app.postdelegate.com/legal/privacy |
| Terms of service | https://app.postdelegate.com/legal/terms |
| Data deletion instructions URL | https://app.postdelegate.com/legal/data-deletion (live once Claude deploys this branch; check that it loads first) |
| Support / contact email | support@postdelegate.com |
| Security contact | security@postdelegate.com |
| App icon | `apps/frontend/public/postdelegate-icon-512.png` (512×512). The SVG is `postdelegate-mark.svg`. |
| Category | Social media management / productivity |
| OAuth callback pattern | `https://app.postdelegate.com/integrations/social/<provider>`, using the exact provider names in section 2 |
| Domains to verify where asked | `postdelegate.com`, `app.postdelegate.com`, `media.postdelegate.com` (media is served from here, and TikTok needs it verified) |

**One-line description for review forms:**
> PostDelegate is a social media scheduling tool. A business connects its own accounts, writes or uploads a post, picks a time, and PostDelegate publishes it to the account the user authorized. Users can see their scheduled and published posts and basic performance numbers in one calendar.

**Privacy policy gap:** the policy currently only describes Google and YouTube data. Before you submit Meta, TikTok or LinkedIn for review, write `NEEDS POLICY: <network>` in section 6. Claude will add that platform's data-use section and redeploy the policy. Reviewers check this.

---

## 2. Network-by-network setup

The server setting names below are what goes into `set-secret.sh`. The callback must match exactly, with no trailing slash.

### 2.1 Meta: Facebook Pages, Instagram (Business, via Facebook), Threads (priority 1)

Existing (reported): Facebook app `1106117725538645`, Instagram standalone app `2280201996094538`, Threads app `1119176243809209`, all in development mode. Reuse them.

**Business portfolio and verification (owner involvement likely)**
- In Meta Business Suite → Business settings → Security Center, verify **Nasida Apps LLC**. You need legal documents and a phone or email check.
- Attach the Facebook app to this business portfolio.
- Meta needs a phone number. The previous notes say a **US phone number** was a blocker; ask the owner.

**Facebook app `1106117725538645`** (serves both `facebook` and `instagram`)
- Products: Facebook Login for Business, and Instagram (Graph API via Facebook Login).
- Valid OAuth redirect URIs:
  - `https://app.postdelegate.com/integrations/social/facebook`
  - `https://app.postdelegate.com/integrations/social/instagram`
- Permissions to request in App Review:
  - Facebook: `pages_show_list`, `business_management`, `pages_manage_posts`, `pages_manage_engagement`, `pages_read_engagement`, `read_insights`
  - Instagram: `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_insights`, plus the shared `pages_show_list`, `pages_read_engagement`, `business_management`
- Settings → Basic: privacy URL, terms URL, data deletion instructions URL, app icon, category, contact email (section 1).
- Server settings: `FACEBOOK_APP_ID` (public), `FACEBOOK_APP_SECRET` (secret).

**Instagram standalone app `2280201996094538`** (provider `instagram-standalone`, "Instagram API with Instagram Login")
- Redirect URI: `https://app.postdelegate.com/integrations/social/instagram-standalone`
- Permissions: `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_comments`, `instagram_business_manage_insights`
- Server settings: `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`

**Threads app `1119176243809209`** (provider `threads`)
- Redirect URI: `https://app.postdelegate.com/integrations/social/threads`
- Permissions: `threads_basic`, `threads_content_publish`, `threads_manage_replies`, `threads_manage_insights`
- Server settings: `THREADS_APP_ID`, `THREADS_APP_SECRET`

**Review submission (after Claude confirms the credentials work in dev mode)**
1. Add the owner's Facebook account and a test Page and Instagram professional account as app roles. Then tell Claude, who will confirm connect and publish work.
2. Record one screencast per permission group, as in section 4.
3. Submit, then switch the app to **Live** after approval.

### 2.2 TikTok (priority 1)

Existing (reported): app `7700045361989224500`, client key `awr6csyl2s6b7itb`. A draft exists; continue it.

- Products: **Login Kit** and **Content Posting API**, with Direct Post enabled.
- Redirect URI: `https://app.postdelegate.com/integrations/social/tiktok` (it was reported as not yet added).
- Scopes: `user.info.basic`, `user.info.profile`, `user.info.stats`, `video.list`, `video.upload`, `video.publish`
- URL/domain verification: verify **`media.postdelegate.com`**. Posts pull video from that domain, and verifying the main site does not cover it. Also verify `postdelegate.com`.
  - TikTok gives a TXT record or a file. If it's a DNS record, add it in Cloudflare (zone `postdelegate.com`) without touching any existing record.
- Server settings: `TIKTOK_CLIENT_ID` (the client key), `TIKTOK_CLIENT_SECRET`.
- Sandbox first: add the owner's TikTok account as a sandbox user, then tell Claude, who will run a private test post.
- Then submit for **Content Posting API audit**. Until it's approved, posts are private-only.
  - The app already does what the audit checks: it fetches creator info, has no default privacy setting, interaction toggles start off, and it shows the music-usage consent text.
  - The screencast must show these screens.
- **TikTok Business** (`tiktok-business`) is separate and *out of scope* unless the owner asks.

### 2.3 LinkedIn: profile and company Pages (priority 1)

Status: no app yet, and the company Page couldn't be created because the LinkedIn account's **email isn't confirmed**.

1. Confirm the email on the owner's LinkedIn account. This may need the owner's inbox.
2. Create the **PostDelegate** company Page (Nasida Apps LLC), with the logo and website from section 1.
3. Create the developer app linked to that Page, and verify the app with the Page admin.
4. Products:
   - **Share on LinkedIn**
   - **Sign In with LinkedIn using OpenID Connect**
   - **Community Management API** (for company Pages; it needs its own access request)
5. Redirect URLs, both required:
   - `https://app.postdelegate.com/integrations/social/linkedin`
   - `https://app.postdelegate.com/integrations/social/linkedin-page`
6. The code requests these scopes: `openid`, `profile`, `w_member_social`, `r_basicprofile`, `rw_organization_admin`, `w_organization_social`, `r_organization_social`
7. **Important:** LinkedIn may refuse to put Community Management API on an app that already has other products, and may require a separate app for it. If that happens, don't work around it. Record it in section 6 and Claude will add support for a second LinkedIn client.
8. Server settings: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`
9. Don't accept LinkedIn's API terms without the owner's OK. It's listed as an owner decision.

### 2.4 Pinterest (priority 2)

Existing: app `1629300`, on trial access (posts visible only to the account owner).
- Redirect URI: `https://app.postdelegate.com/integrations/social/pinterest`
- Scopes: `boards:read`, `boards:write`, `pins:read`, `pins:write`, `user_accounts:read`
- Server settings: `PINTEREST_CLIENT_ID`, `PINTEREST_CLIENT_SECRET`
- Then request **Standard access**. It needs a demo video of connecting, choosing an existing board, and publishing a Pin.

### 2.5 X / Twitter (priority 2, owner decides spend)

Existing: app `33577748`, pay-per-use account with zero credits.
- PostDelegate uses **OAuth 1.0a**. The keys needed are the **API Key and API Key Secret (consumer keys)**, not the OAuth 2.0 client ID.
- User authentication settings:
  - app permissions **Read and write**
  - type Web App
  - callback `https://app.postdelegate.com/integrations/social/x`
  - website `https://postdelegate.com`
- Server settings: `X_API_KEY`, `X_API_SECRET`
- **Ask the owner** before buying credits. Posting won't work without them.

### 2.6 Reddit (priority 3)

A data-access/commercial request is pending. Wait for approval, then:
- create a "web app" at reddit.com/prefs/apps with redirect `https://app.postdelegate.com/integrations/social/reddit`
- scopes: `read`, `identity`, `submit`, `flair`
- server settings: `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`

### 2.7 Discord (priority 3)

The account signup was blocked by a CAPTCHA; the owner needs to do that step.
- Then create the application and add a **Bot**.
- OAuth2 redirect: `https://app.postdelegate.com/integrations/social/discord`
- Scopes `identify guilds`. The bot permission integer used by the code is `377957124096`.
- Server settings: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN_ID` (the bot token, a secret)

### 2.8 Slack (priority 3)

Existing: app `A0CBU48N3PC`, client `12386945468375.12402144751794`.
- Redirect URL: `https://app.postdelegate.com/integrations/social/slack`
- Bot token scopes: `channels:read`, `chat:write`, `users:read`, `groups:read`, `channels:join`, `chat:write.customize`
- Turn on **public distribution** (Manage Distribution) so customer workspaces can install it.
- Server settings: `SLACK_ID`, `SLACK_SECRET`, and `SLACK_SIGNING_SECRET` if shown

### 2.9 Telegram (priority 3)

Bot `@PostDelegateBot` exists.
- In BotFather, set the name **PostDelegate**, a short description, the about text and the icon.
- Server setting: `TELEGRAM_TOKEN` (secret)

### 2.10 Twitch, Kick, Dribbble, Tumblr (priority 4)

Apps exist; confirm each, then install its secret.

| Network | Redirect URL | Scopes | Server settings |
|---|---|---|---|
| Twitch (client `5o6cie5cz538bafc5q1cbkdu2jtlg9`) | `https://app.postdelegate.com/integrations/social/twitch` | `user:write:chat user:read:chat moderator:manage:announcements` | `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` |
| Kick (client `01M5PYHZ65SRE1QA6N9MD5HTNJ`) | `https://app.postdelegate.com/integrations/social/kick` | `chat:write user:read channel:read` | `KICK_CLIENT_ID`, `KICK_SECRET` |
| Dribbble (app `271295`) | `https://app.postdelegate.com/integrations/social/dribbble` | `public upload` | `DRIBBBLE_CLIENT_ID`, `DRIBBBLE_CLIENT_SECRET` |
| Tumblr | `https://app.postdelegate.com/integrations/social/tumblr` | `write offline_access` | `TUMBLR_CLIENT_ID`, `TUMBLR_CLIENT_SECRET` |

### 2.11 Mastodon (priority 4, quick)

- On mastodon.social go to Preferences → Development → New application. Name it PostDelegate, with website https://postdelegate.com.
- Redirect URI: `https://app.postdelegate.com/integrations/social/mastodon`
- Scopes: `read write`
- Server settings: `MASTODON_CLIENT_ID`, `MASTODON_CLIENT_SECRET`, and `MASTODON_URL` = `https://mastodon.social`

### 2.12 Google Business Profile (priority 4)

- Use the **existing** project `postdelegate`. Request Business Profile API access (the GBP API access form) and enable "My Business Business Information API" and "Google My Business API".
- Redirect URI on the existing "PostDelegate Web" client: `https://app.postdelegate.com/integrations/social/gmb`. Add it; don't remove anything.
- No new secret is needed. It falls back to the YouTube/Google client.

### 2.13 Out of scope for now

Farcaster, VK, MeWe, Whop, Skool, Moltbook and TikTok Business. Bluesky, Dev.to, Hashnode, Medium, WordPress, Lemmy, Nostr and Listmonk need no developer app; customers bring their own credentials.

---

## 3. Other launch accounts Grok can finish

| Task | What to do | Hand back |
|---|---|---|
| **Stripe keys** | Dashboard (live, Nasida Apps LLC) → Developers → API keys. Products, prices and the customer portal are already set up by Claude, so **don't create products**. | Put the publishable and secret keys in the vault as `PD · Stripe · Publishable key` / `Secret key`, and tell Claude. **Don't install them yet**: switching on Stripe moves every account to the Free plan, so Claude installs them in a planned order. |
| **Stripe account health** | Check for open verification/payout requirements and the paused Financial Accounts (Treasury) tasks. Ask Stripe support to remove Treasury if it's still blocking. | Notes in section 6. |
| **Email (Resend)** | Check whether a Resend account/domain already exists for `postdelegate.com` before creating one. Verify the domain with its DNS records in Cloudflare (SPF/DKIM/return-path; add `_dmarc` with `v=DMARC1; p=none; rua=mailto:support@postdelegate.com` if none exists) and create a sending API key. | Vault `PD · Resend · API key`; tell Claude the sender address (suggest `PostDelegate <no-reply@postdelegate.com>`). |
| **Support inbox** | Send a test email to support@postdelegate.com and confirm it arrives where the owner reads mail. | Result in section 6. |
| **Off-site backups** | In Cloudflare R2 (account `6ada63eb2f8c926ce2d7254c91006e70`), create the bucket `postdelegate-backups` and an R2 API token with Object Read & Write on **that bucket only**. | Vault `PD · R2 backups · Access key ID` / `Secret`. Claude installs them with the backup tooling. |
| **Phone alerts** | Install the **ntfy** app on the owner's phone and subscribe to a random, hard-to-guess topic name (e.g. `pd-alerts-` plus 16 random characters). | Vault `PD · ntfy · topic URL`, and tell Claude. |
| **Google verification video** | The Google sensitive-scope review is waiting only on a demo video (see section 4). | The unlisted YouTube link in section 6. |

---

## 4. Review screencasts (what reviewers want)

Make one clean recording per platform, about 2–4 minutes, at 1080p, at normal speed, with no other apps or popups on screen.
- On macOS, if "ChatGPT would like to access data from other apps" appears, click **Don't Allow** **before** recording. It ruined the last take.
- Upload each as an **unlisted** YouTube video, or to wherever the form asks.

Each recording must show, in order:
1. The browser address bar at `https://app.postdelegate.com`. Sign in.
2. **Add channel** → choose the platform → the platform's real consent screen with the requested permissions visible → approve.
3. The connected account appears in PostDelegate.
4. Create a post with an image or video for that account. Show any platform-specific options (TikTok: privacy choice, interaction toggles, music consent). Publish now.
5. Open the platform in a new tab and show the post that was published.
6. Show where each extra permission is used: comments for `*_manage_comments`, analytics for `*_insights`, Page list for `pages_show_list`, and so on.
7. Show disconnecting the channel in PostDelegate.

**Before recording, tell Claude which network.** Claude will unhide it in the app (unready networks are hidden from all users right now) and do a test publish first.

---

## 5. Order of work

1. Meta business verification, plus the TikTok app/domain verification, plus the LinkedIn email confirmation and Page. Start these first because they take days.
2. Install credentials for Meta, TikTok and LinkedIn, then tell Claude to test.
3. Record and submit the Meta, TikTok and LinkedIn reviews, plus the Google video.
4. Stripe keys into the vault, Resend, R2 backup bucket, ntfy.
5. Pinterest Standard, X (after the owner's spend decision), Slack distribution, Telegram, Mastodon, Twitch/Kick/Dribbble/Tumblr secrets.
6. Reddit and Discord when unblocked.

---

## 6. Status table (Grok updates this; public IDs only, never secrets)

Statuses: `todo` · `in progress` · `blocked: <reason>` · `creds in vault` · `creds installed` · `review submitted <date>` · `approved <date>` · `NEEDS POLICY: <network>`

| Item | Public app/client ID | Callback added | Status | Notes |
|---|---|---|---|---|
| Meta business verification | — | — | todo | |
| Facebook + Instagram (FB app) | 1106117725538645 | ? | todo | |
| Instagram standalone | 2280201996094538 | ? | todo | |
| Threads | 1119176243809209 | ? | todo | |
| TikTok | 7700045361989224500 / awr6csyl2s6b7itb | no | todo | verify media.postdelegate.com |
| LinkedIn | — | — | blocked: email unconfirmed | |
| Pinterest | 1629300 | ? | todo | trial access |
| X | 33577748 | ? | blocked: owner spend decision | |
| Reddit | — | — | blocked: approval pending | |
| Discord | — | — | blocked: CAPTCHA (owner) | |
| Slack | A0CBU48N3PC | ? | todo | |
| Telegram | @PostDelegateBot | n/a | todo | |
| Twitch | 5o6cie5cz538bafc5q1cbkdu2jtlg9 | ? | todo | |
| Kick | 01M5PYHZ65SRE1QA6N9MD5HTNJ | ? | todo | |
| Dribbble | 271295 | ? | todo | |
| Tumblr | — | ? | todo | |
| Mastodon | — | — | todo | |
| Google Business Profile | project postdelegate | ? | todo | |
| Google sensitive-scope video | — | — | todo | |
| Stripe keys in vault | — | — | todo | |
| Resend | — | — | todo | |
| Support inbox test | — | — | todo | |
| R2 backup bucket + token | — | — | todo | |
| ntfy topic | — | — | todo | |

When you finish a block, commit only this file (`docs: update Grok launch status`) on a branch and open a PR to `khanjer496-alt/postdelegate`, or tell the owner to pass the update to Claude.
