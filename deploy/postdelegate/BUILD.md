# Build PostDelegate

The release recipe is [Dockerfile.release](Dockerfile.release). It rebuilds the
NestJS backend, Temporal publishing orchestrator and Next.js frontend from this
source tree. It starts from the digest-pinned official Postiz v2.25.3 image,
regenerates the Prisma client, installs the additional dependencies specified in
the recipe, and includes the media tools, fonts and operator commands.

## Requirements

- Docker with BuildKit and access to GHCR, Debian package repositories and the
  npm registry.
- The complete source tree, including `apps/`, `libraries/`, `pnpm-lock.yaml`,
  `tsconfig.base.json`, `i18n.json` and `deploy/postdelegate/fonts/`.
- Enough memory for the Node build's 4 GiB heap plus Docker and other running
  services, and disk space for the base image and new layers.

Run from the source root, whether it is a Git checkout or an extracted source
archive. A host-side Node installation, dependency install or application
credential is not needed for this Docker build. The recipe uses the pinned base
image's installed dependency tree and explicit package additions; it does not
run a fresh install of this repository's `package.json`. The copied lockfile
also supplies version assertions for those additions.

## Build from a checkout or source archive

```sh
docker build --progress=plain \
  -f deploy/postdelegate/Dockerfile.release \
  --build-arg SOURCE_REVISION=local-source-build \
  -t postdelegate-postiz:local-source-build .
```

For a release from a Git checkout, record the exact revision in the image label
and use the tag expected by the staging release helper:

```sh
release_revision=$(git rev-parse HEAD)
release_tag=release-$(git rev-parse --short=8 HEAD)
docker build --progress=plain \
  -f deploy/postdelegate/Dockerfile.release \
  --build-arg SOURCE_REVISION="$release_revision" \
  -t "postdelegate-postiz:$release_tag" .
docker image inspect "postdelegate-postiz:$release_tag" \
  --format '{{index .Config.Labels "org.opencontainers.image.revision"}}'
```

The printed label must match `release_revision`. For a release built from an
archive, supply the revision associated with that archive instead of using Git;
the published deployment records its revision at `/source/REVISION`.

A successful build includes backend/orchestrator/frontend compilation and the
recipe's ffmpeg, ffprobe, encoder, filter and font checks. It does not establish
runtime health, authentication, publishing or billing. Follow [STAGING.md](STAGING.md)
and the [release runbook](README.md) for staging checks, backups, production
promotion, rollback and publishing the matching source archive.

The recipe's build-time URLs target `app.postdelegate.com`; adapt them for
another installation. Staging's documented startup wrapper rewrites the baked
frontend URL for its own host. Supply runtime secrets separately; never include
credential files in the build context or image.

`Dockerfile.branding` is the older frontend-only recipe and does not rebuild the
backend or orchestrator. The application's Source code offer includes the source,
assets, license, dependency declarations and release recipe needed for the full
build. Ignored runtime credentials and private backup/evidence files are excluded.
