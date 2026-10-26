#!/usr/bin/env bash
# Uses the official image's installed dependencies without starting the app.
# No runtime.env, credentials, network, publishing workers or writable checkout.
set -euo pipefail
review_root=$(cd "$(dirname "$0")/../../.." && pwd)
review_image=${POSTDELEGATE_TEST_IMAGE:-ghcr.io/gitroomhq/postiz-app:v2.25.3@sha256:1e376ff2cb781022d528f171719cf174cf693a985a30cb40eefb13eae3ddda13}
for review_runner in "$review_root"/deploy/postdelegate/review/tests/*.cjs; do
  docker run --rm --network none --read-only --tmpfs /tmp \
    --entrypoint node -v "$review_root:/review:ro" "$review_image" \
    "/review/deploy/postdelegate/review/tests/$(basename "$review_runner")"
done
docker run --rm --network none --read-only --tmpfs /tmp \
  --entrypoint node -v "$review_root:/review:ro" "$review_image" \
  --experimental-strip-types --test \
  /review/apps/frontend/src/components/new-launch/providers/tiktok/tiktok.direct-post.test.ts
