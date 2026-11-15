#!/usr/bin/env bash
# LOCAL proposal only. No rerun authorized; original one-event guards remain unchanged.
set -euo pipefail
[ "$#" = 4 ] || exit 2
source=$1; producer=$2; root=$3; receipt=$4
helper="$producer/site/scripts/pr217-candidate"
current=entry
completed=''
publish() { python3 -I "$helper/candidate.py" phase-receipt "$receipt" "$current" "$1" "$2" "$completed"; }
finish() {
  local -r original_status=$?
  trap - EXIT TERM INT
  if [ "$original_status" -ne 0 ]; then publish failed "$original_status" || :; fi
  exit "$original_status"
}
trap finish EXIT
trap 'exit 143' TERM
trap 'exit 130' INT
phase() {
  completed="${completed:+$completed,}$current"
  current=$1
  publish started 0
}
publish started 0
[ "${GITHUB_ACTIONS:-}" = true ] && [ "$(uname -s)" = Linux ] || exit 2
[ "${CANDIDATE_BUILD_AUTHORIZED:-}" = REVIEWED_NON_RELEASE_ONLY ] || exit 2
phase identity-cleanliness
[ ! -e "$root" ] && [ ! -L "$root" ] || exit 2
[ "$(git -C "$source" rev-parse HEAD)" = 7c84b1ebffbccb731a972c2ff55e6bc0accea663 ] || exit 2
[ "$(git -C "$producer" rev-parse HEAD)" = "$REVIEWED_PRODUCER_SHA" ] || exit 2
[ "$REVIEWED_PRODUCER_SHA" = "$PRODUCER_WORKFLOW_SHA" ] || exit 2
[ -z "$(git -C "$source" status --porcelain --untracked-files=all)" ] || exit 2
[ -z "$(git -C "$producer" status --porcelain --untracked-files=all)" ] || exit 2
phase publication-preflight
python3 -I "$helper/candidate.py" publication-preflight "$source" "$producer"
mkdir "$root"
root=$(cd "$root" && pwd)
phase source-snapshot
python3 -I "$helper/candidate.py" snapshot "$source" "$root/source-before.json"
[ ! -e "$source/site/dist" ] && [ ! -L "$source/site/dist" ] || exit 2
phase site-install
(cd "$source/site" && pnpm install --ignore-workspace --frozen-lockfile)
phase site-build
(cd "$source/site" && pnpm build)
phase cli-install
mkdir "$root/cli"
(cd "$root/cli" && pnpm --ignore-workspace add wrangler@4.162.0 --save-exact)
phase tool-metadata
node "$helper/tool-metadata.mjs" "$root/cli" "$root/tools.json"
phase raw-compile
compiled=$(mktemp -d "$root/functions.XXXXXX")
(cd "$source" && "$root/cli/node_modules/.bin/wrangler" pages functions build site/functions --outdir="$compiled")
phase raw-stage
node "$source/site/scripts/stage-pages-worker.mjs" "$compiled" "$source/site/dist/_worker.js" "$root/worker-format.json"
phase control-equality
for file in _headers _routes.json _redirects; do cmp "$source/site/public/$file" "$source/site/dist/$file"; done
phase candidate-seal
python3 -I "$helper/candidate.py" seal "$source" "$producer" "$source/site/dist" \
  "$root/NON_RELEASE-bundle" "$root/worker-format.json" "$root/source-before.json" "$root/tools.json"
publish completed 0
