# LinkedIn Pages approval gate

The Pages app holds Community Management API (CMA) alone. Its documented permissions include `r_basicprofile`, `rw_organization_admin`, `w_organization_social` and `r_organization_social`. OpenID Connect is a separate product: this provider uses `/v2/me` for member identity on authorization and refresh, rather than requesting `openid/profile` and `/v2/userinfo`. Personal LinkedIn is unchanged.

Sources checked 9 Nov 2026: [CMA permission list](https://learn.microsoft.com/en-us/linkedin/marketing/increasing-access?view=li-lms-2026-02), [Profile API](https://learn.microsoft.com/en-us/linkedin/shared/integrations/people/profile-api).

This is preparation, not proof of app approval. Before making `linkedin-page` visible:

1. Inspect the dedicated app's approved product, tier and exact grants. Compare them to `LinkedinPageProvider.scopes` and the returned token scope. Do not disable `checkScopes`; missing grants must block connection.
2. Configure both `LINKEDIN_PAGE_CLIENT_ID` and `LINKEDIN_PAGE_CLIENT_SECRET` for that same app through an authorized operator. A partial pair now fails instead of mixing credentials from different apps. The legacy single-app fallback remains only when both are absent.
3. Keep `linkedin-page` in `HIDDEN_PROVIDERS`. With separate authorization, use a workspace in `PREVIEW_PROVIDER_ORGS` to test consent, `/v2/me`, organization listing/selection and same-Page reconnect. Confirm Page identity survives refresh and scheduled jobs still target that Page.
4. Obtain explicit authorization for test posts, then check native Page publish, reschedule exactly once, revoked-access failure and all advertised formats. Verify analytics/comments against actual endpoint permissions; feed scopes and tier limits may need further work.
5. CEO reviews evidence and owner authorizes a separate availability/release change. This PR changes no server settings or visibility. Missing app grants or live acceptance keep the provider hidden.
