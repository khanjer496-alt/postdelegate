#!/usr/bin/env bash
# Owner-run: give every workspace of one email a free lifetime Ultimate plan, so
# switching Stripe on never drops the owner's own workspaces to Free.
#   deploy/postdelegate/comp-owner-plan.sh you@example.com
# Idempotent: workspaces that already have a plan are left untouched.
set -euo pipefail
EMAIL="${1:?usage: $0 email}"
case "$EMAIL" in *"'"*|*'\\'*) echo "invalid email" >&2; exit 2;; esac
HOST="${PD_HOST:-ubuntu@postdelegate-prod}"
SSHK="${PD_SSH_KEY:-$HOME/.ssh/postdelegate_prod}"
# The VPS accepts SSH only over Tailscale (public port 22 is closed by ufw). PD_HOST defaults to the tailnet
# machine name; the host key is checked against the existing known_hosts entry for the public address
# (HostKeyAlias). Override PD_HOST / PD_SSH_OPTS for any other setup. Never reopen public port 22 for this.
# PD_SSH_OPTS REPLACES the defaults (it does not add to them): when you override it, include
# "-o HostKeyAlias=57.129.186.135 -o StrictHostKeyChecking=yes" yourself if you still want them. Options are split on
# whitespace, so a value that contains spaces (for example a quoted ProxyCommand) cannot be passed this way.
read -r -a SSH_OPTS <<< "${PD_SSH_OPTS:--o HostKeyAlias=57.129.186.135 -o StrictHostKeyChecking=yes}"
ssh -o BatchMode=yes ${SSH_OPTS[@]+"${SSH_OPTS[@]}"} -i "$SSHK" "$HOST" 'sudo docker exec -i postdelegate-postiz-postgres-1 psql -U postiz -d postiz -v ON_ERROR_STOP=1' <<SQL
BEGIN;
INSERT INTO "Subscription" (id, "organizationId", "subscriptionTier", provider, period, "totalChannels", "isLifetime", "createdAt", "updatedAt")
SELECT 'owner-comp-' || o.id, o.id, 'ULTIMATE', 'manual', 'YEARLY', 100, true, now(), now()
FROM "Organization" o
WHERE o."deletedAt" IS NULL
  AND EXISTS (SELECT 1 FROM "UserOrganization" uo JOIN "User" u ON u.id = uo."userId"
              WHERE uo."organizationId" = o.id AND lower(u.email) = lower('$EMAIL'))
  AND NOT EXISTS (SELECT 1 FROM "Subscription" s WHERE s."organizationId" = o.id AND s."deletedAt" IS NULL);
SELECT o.id, o.name, s."subscriptionTier", s."isLifetime", s.provider
FROM "Organization" o JOIN "Subscription" s ON s."organizationId" = o.id
WHERE EXISTS (SELECT 1 FROM "UserOrganization" uo JOIN "User" u ON u.id = uo."userId"
              WHERE uo."organizationId" = o.id AND lower(u.email) = lower('$EMAIL'));
COMMIT;
SQL
