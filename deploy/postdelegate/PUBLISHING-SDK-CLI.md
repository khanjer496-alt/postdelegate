# Publishing the PostDelegate SDK and CLI to npm

Two packages live in this repo and are published from `main`:

| Package | Path | Name on npm | Version | License |
| --- | --- | --- | --- | --- |
| Node.js SDK | `apps/sdk` | `@postdelegate/node` | 1.0.0 | AGPL-3.0 (kept from the original `apps/sdk`) |
| Command-line tool | `apps/cli` | `postdelegate` (bin: `postdelegate`) | 1.0.0 | AGPL-3.0 (same as the app) |

The CLI bundles the SDK at build time, so `postdelegate` has no runtime dependencies and the two packages
can be published in any order. Both names were unregistered on npm on 2026-10-30
(`npm view postdelegate` and `npm view @postdelegate/node` returned 404), re-check right before publishing.

Publishing is irreversible (a version can be unpublished only within 72 hours and a name/version can never be reused),
so nothing is published until the owner has finished the steps below.

## Owner steps (once, about 10 minutes)

1. **Create the npm account**: https://www.npmjs.com/signup. Use the PostDelegate owner email and verify it.
2. **Enable 2FA** (required to publish): npmjs.com > avatar > Account > Two-Factor Authentication > "Authorization and publishing".
   Use an authenticator app and store the recovery codes in the password manager.
3. **Create the organization `postdelegate`**: npmjs.com > avatar > "Add Organization" > name `postdelegate`,
   choose the **Free** plan (unlimited public packages). This reserves the `@postdelegate/` scope.
   The unscoped `postdelegate` package needs no organization, it is published under the account.
4. **Log in on the machine Claude publishes from**:
   ```bash
   npm login
   npm whoami          # must print the account name
   npm org ls postdelegate   # the account must be listed as owner
   ```
5. Tell Claude "npm is ready". Claude publishes with the commands below. Because 2FA is on, npm asks for a
   one-time password per publish, so the owner either reads the 6-digit code out when asked, or creates a
   **granular access token** (npmjs.com > Access Tokens > Generate New Token > Granular, permission
   "Read and write", packages `@postdelegate/*` and `postdelegate`, "Bypass 2FA" enabled, 7 day expiry) and runs
   `npm config set //registry.npmjs.org/:_authToken <token>` locally. Never paste a token in a chat or commit it.

## Commands Claude runs after that

From the repository root on an up to date, clean `main` (after the `pd/cli` PR is merged):

```bash
git checkout main && git pull --ff-only
git status --short            # must be empty
pnpm install --frozen-lockfile

# 1. verify
pnpm exec jest -c jest.config.ts apps/sdk apps/cli
pnpm run build:sdk && pnpm run build:cli
node apps/cli/dist/index.js --version        # 1.0.0

# 2. preview the tarballs (no upload)
pnpm --filter ./apps/sdk publish --access public --dry-run
pnpm --filter ./apps/cli publish --access public --dry-run

# 3. publish (prepublishOnly rebuilds each package; add --otp=<code> if 2FA asks)
pnpm run publish-sdk          # @postdelegate/node
pnpm run publish-cli          # postdelegate
```

`publish-sdk` and `publish-cli` are root scripts that run `pnpm --filter ./apps/<pkg> publish --access public`.
Scoped packages are private by default, `--access public` is required for `@postdelegate/node`.

## Verify after publishing

```bash
npm view @postdelegate/node version        # 1.0.0
npm view postdelegate version              # 1.0.0
cd "$(mktemp -d)" && npx --yes postdelegate@1.0.0 --version
POSTDELEGATE_API_KEY=dummy npx --yes postdelegate@1.0.0 channels   # expect exit 3 "Authentication failed"
```

Then tag the release: `git tag sdk-cli-v1.0.0 && git push origin sdk-cli-v1.0.0`.

## Releasing later versions

1. Bump `version` in `apps/sdk/package.json` and/or `apps/cli/package.json` (semver).
2. Update the README or `apps/cli/SKILL.md` if behaviour changed, merge to `main`.
3. Run the same commands. npm refuses to publish a version that already exists.

## Notes

- The package license is AGPL-3.0 because `apps/sdk` already declared it and the SDK/CLI are part of the AGPL
  monorepo. Switching to MIT later is possible (the code is original to this repo) but must be a deliberate
  decision, since the SDK starts from upstream Postiz code.
- npm provenance (`--provenance`) needs a public GitHub repository and CI publishing, so it is not used while the repo is private.
- The upstream packages `@postiz/node` and the `postiz` CLI are not used or depended on anywhere.
