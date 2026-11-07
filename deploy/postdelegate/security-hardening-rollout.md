# Rolling out the security hardening

Audit findings A2, A3, A5, A7, A9, A10 (the 7 Nov audit; A1 is its own branch
and runbook). Everything here ships with the next release.

## Server step needed BEFORE the release, or Compose will not start

Two changes in `compose.yaml` need a server step first. Compose refusing to
start is deliberate: the alternative is a default that quietly brings back the
thing being fixed.

1. **Redis now requires a password.** Add to `/etc/postiz/runtime.env`:

   ```bash
   printf 'POSTIZ_REDIS_PASSWORD=%s\n' "$(openssl rand -base64 36 | tr -d '/+=' | cut -c1-40)" >> /etc/postiz/runtime.env
   ```

   It has no default on purpose: a fallback would quietly bring back the open
   Redis this fixes. `docker compose config` fails loudly if it is missing.
   Redis holds queue state and cache and was reachable from every container on
   the network.

2. **`no-new-privileges` on every service, and `cap_drop: ALL` on Redis.**
   Postgres, Temporal and Caddy keep their capabilities: their entrypoints need
   chown/setuid and Caddy needs `NET_BIND_SERVICE` for 80/443, so dropping
   everything breaks them. Worth revisiting per-service later.

Also in this train, needing no server step: the Caddyfile gains `base-uri`,
`object-src` and a `Permissions-Policy`. Remember that a Caddy config change
needs the **container restarted**, not reloaded — a reload is a no-op here.

## Needing no server step

- **Sign out of all devices** (A2). `User.sessionVersion` is new, so the schema
  change arrives with `prisma db push` as usual. No index, no backfill: every
  user starts at 0, and a session issued before this release carries no version
  claim and is read as 0, so the deploy signs nobody out.
- **The tenant boundary is now compiler-enforced** (A3), with a guard spec over
  all 93 route handlers that take a resource id. No runtime change.
- **bcrypt cost 12** for new hashes (A10). Existing hashes keep their own cost
  and upgrade when the password next changes.
- **Sentry 10.78.0** (A6), clearing the one critical advisory. The pinned
  release image carries 10.56.0 and this repo's install goes over it — check the
  built image resolves 10.78.0, as was needed for @aws-sdk/client-sesv2.

## What to click through on staging

1. Sign in, then Settings → Sign out of all devices: it signs you out, and a
   second browser that was signed in is signed out too.
2. Sign in again on both: both work (the version moved for both).
3. Change a password: the other session is signed out, as before.
4. Open the public preview link of a post while signed out: it still renders.
5. Post to any channel: the queue still works, which is what proves Redis
   authentication is wired (the app cannot reach Redis without it).
6. `curl -sI https://staging.postdelegate.com | grep -i -E 'permissions-policy|content-security'`
   shows the new headers. Remember Caddy needs the container **restarted**, not
   reloaded.
