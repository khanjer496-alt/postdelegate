# Review scope map

Verified against the implemented provider operations and primary provider documentation on 26 October 2026. This records requested permissions; it does not establish provider approval or successful live API access.

## YouTube

Google approved OAuth verification for `youtube.readonly` and `youtube.upload` on 2 November 2026 (project `postdelegate`). Any new sensitive scope, or any change to the consent screen, needs a new verification request before release.

The social-channel connection uses these scopes. Basic Google sign-in is a separate flow and continues to request profile and email only; neither its provider nor the tested `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` configuration is changed here.

| Scope | Implemented operation | Review evidence to record |
| --- | --- | --- |
| `userinfo.profile`, `userinfo.email` | `oauth2.userinfo.get` identifies the connected Google account. | Consent and the resulting connected identity. |
| `youtube.upload` | Resumable `videos.insert` uploads a new video with its title, description, tags, audience and visibility; `thumbnails.set` sets an optional custom thumbnail. | Compose and upload an original test video, then show it in the selected channel. Show a custom thumbnail if that feature is included in the review. |
| `youtube.readonly` | `channels.list` selects and verifies the channel; `videos.list` reads post statistics. `reports.query` accepts this scope, so channel analytics need no separate `yt-analytics.readonly` grant. | Channel selection and the post statistics view. |

Removed permissions: `yt-analytics.readonly` (not verified; `youtube.readonly` covers `reports.query`), broad `youtube`, content-partner `youtubepartner`, and `youtube.force-ssl`. Upload and thumbnail operations accept `youtube.upload`; channel/video reads use `youtube.readonly`; this provider contains no comment insertion or reply operation that would need `youtube.force-ssl`. It does not manage YouTube CMS content owners or Analytics groups.

Changing the requested scope list does not revoke permissions on an older token. Use a fresh grant for review evidence, and reconnect any channel that was previously authorized with broader permissions when reducing its existing access.

Do not demonstrate editing the title of an already published video or receiving/replying to YouTube comments: the provider does not implement those operations. Changing a saved PostDelegate post is not proof of a remote video update.

Primary references:

- [Videos: insert authorization](https://developers.google.com/youtube/data/reference/rest/v3/videos/insert#authorization)
- [Thumbnails: set authorization](https://developers.google.com/youtube/data/reference/rest/v3/thumbnails/set#authorization)
- [Channels: list](https://developers.google.com/youtube/data/reference/rest/v3/channels/list)
- [Videos: list](https://developers.google.com/youtube/data/reference/rest/v3/videos/list)
- [YouTube Analytics reports: query authorization](https://developers.google.com/youtube/analytics/reference/reports/query)
- [Comments: insert authorization](https://developers.google.com/youtube/data/reference/rest/v3/comments/insert#authorization)

## Pinterest

All five existing scopes remain necessary under Pinterest's official OpenAPI specification, version 5.28.0. In particular, **`boards:write` is required by `POST /pins` even when PostDelegate selects an existing board**. Its presence does not mean PostDelegate can create boards.

| Operation | Required scopes in the official API specification |
| --- | --- |
| `GET /user_account` and `GET /user_account/analytics` | `user_accounts:read` |
| `GET /boards` | `boards:read` |
| `POST /media` | `pins:read`, `pins:write` |
| `GET /media/{media_id}` | `pins:read` |
| `POST /pins` | `boards:read`, `boards:write`, `pins:read`, `pins:write` |
| `GET /pins/{pin_id}/analytics` | `boards:read`, `pins:read` |

Record OAuth, selection of a board that already exists, publishing an original image Pin (or a separately verified video Pin), and the resulting Pin on Pinterest. A board can be created directly on Pinterest before recording; do not claim the composer creates it. Trial access and production Standard access remain distinct gates.

The authorization URL, refresh request and granted-scope validation derive from the provider's single `scopes` list so future permission changes cannot silently leave the URL requesting a different set.

Primary references:

- [Pinterest's official API description repository](https://github.com/pinterest/api-description)
- [Official v5 OpenAPI: endpoint security requirements](https://github.com/pinterest/api-description/blob/main/v5/openapi.yaml)
- [Pinterest API access tiers](https://developers.pinterest.com/docs/key-concepts/access-tiers/)

## Release verification

[`tests/oauth-scopes.test.cjs`](tests/oauth-scopes.test.cjs) exercises the actual provider methods with isolated transport and SDK boundaries. It checks the requested scope set, that the narrowed YouTube grant is accepted, that a missing required grant is rejected, and that Pinterest authorization and refresh use the same scope list. These checks do not substitute for a fresh OAuth grant and real test publication after deployment.
