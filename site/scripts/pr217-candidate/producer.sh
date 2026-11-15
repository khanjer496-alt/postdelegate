#!/usr/bin/env bash
# PREPARED ONLY. Full build is hosted and requires a NEW CEO execution decision.
set -euo pipefail
[ "${GITHUB_ACTIONS:-}" = true ] && [ "$(uname -s)" = Linux ] || exit 2
[ "${CANDIDATE_BUILD_AUTHORIZED:-}" = REVIEWED_NON_RELEASE_ONLY ] || exit 2
[ "$#" = 3 ] || exit 2
source=$1; producer=$2; root=$3
[ ! -e "$root" ] && [ ! -L "$root" ] || exit 2
[ "$(git -C "$source" rev-parse HEAD)" = 7c84b1ebffbccb731a972c2ff55e6bc0accea663 ] || exit 2
[ "$(git -C "$producer" rev-parse HEAD)" = "$REVIEWED_PRODUCER_SHA" ] || exit 2
[ "$REVIEWED_PRODUCER_SHA" = "$PRODUCER_WORKFLOW_SHA" ] || exit 2
[ -z "$(git -C "$source" status --porcelain --untracked-files=all)" ] || exit 2
[ -z "$(git -C "$producer" status --porcelain --untracked-files=all)" ] || exit 2
helper="$producer/site/scripts/pr217-candidate"
python3 -I "$helper/candidate.py" publication-preflight "$source" "$producer"
mkdir "$root"
root=$(cd "$root" && pwd)
# Snapshot every tracked site file BEFORE build. No cache/downloaded old dist/output reuse.
python3 -I "$helper/candidate.py" snapshot "$source" "$root/source-before.json"
[ ! -e "$source/site/dist" ] && [ ! -L "$source/site/dist" ] || exit 2
(cd "$source/site" && pnpm install --ignore-workspace --frozen-lockfile && pnpm build)
mkdir "$root/cli"
(cd "$root/cli" && pnpm --ignore-workspace add wrangler@4.162.0 --save-exact)
node "$helper/tool-metadata.mjs" "$root/cli" "$root/tools.json"
compiled=$(mktemp -d "$root/functions.XXXXXX")
(cd "$source" && "$root/cli/node_modules/.bin/wrangler" pages functions build site/functions --outdir="$compiled")
node "$source/site/scripts/stage-pages-worker.mjs" "$compiled" "$source/site/dist/_worker.js" "$root/worker-format.json"
for file in _headers _routes.json _redirects; do cmp "$source/site/public/$file" "$source/site/dist/$file"; done
# No pages dev, API/native startup, local preview acceptance, remote HTTP, upload or deploy.
# Everything sealed comes from THIS run's complete fresh build. Never concatenate runs or repair bytes.
python3 -I "$helper/candidate.py" seal "$source" "$producer" "$source/site/dist" \
  "$root/NON_RELEASE-bundle" "$root/worker-format.json" "$root/source-before.json" "$root/tools.json"
