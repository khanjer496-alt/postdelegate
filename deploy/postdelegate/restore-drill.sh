#!/usr/bin/env bash
# Owner-run backup restore drill. Run on the owner's Mac (it holds the age key).
#   deploy/postdelegate/restore-drill.sh [~/postdelegate-backup.agekey]
# Downloads the newest off-site backup from R2 (via the server), decrypts it HERE,
# restores the Postiz database into a throwaway Postgres container on the server,
# prints row counts next to the live database, then deletes everything it made.
set -euo pipefail
KEY="${1:-$HOME/postdelegate-backup.agekey}"
HOST="${PD_HOST:-ubuntu@postdelegate-prod}"
SSHK="${PD_SSH_KEY:-$HOME/.ssh/postdelegate_prod}"
# The VPS accepts SSH only over Tailscale (public port 22 is closed by ufw). PD_HOST defaults to the tailnet
# machine name; the host key is checked against the existing known_hosts entry for the public address
# (HostKeyAlias). Override PD_HOST / PD_SSH_OPTS for any other setup. Never reopen public port 22 for this.
# PD_SSH_OPTS REPLACES the defaults (it does not add to them): when you override it, include
# "-o HostKeyAlias=57.129.186.135 -o StrictHostKeyChecking=yes" yourself if you still want them. Options are split on
# whitespace, so a value that contains spaces (for example a quoted ProxyCommand) cannot be passed this way.
read -r -a SSH_OPTS <<< "${PD_SSH_OPTS:--o HostKeyAlias=57.129.186.135 -o StrictHostKeyChecking=yes}"
ssh_() { ssh -o BatchMode=yes ${SSH_OPTS[@]+"${SSH_OPTS[@]}"} -i "$SSHK" "$HOST" "$@"; }
command -v age >/dev/null || { echo "install age: brew install age" >&2; exit 2; }
[ -r "$KEY" ] || { echo "age key not found: $KEY" >&2; exit 2; }
WORK=$(mktemp -d); trap 'rm -rf "$WORK"; ssh_ "sudo docker rm -f pd-restore-drill >/dev/null 2>&1 || true"' EXIT
echo "1/4 downloading newest off-site backup"
ssh_ 'sudo bash -s' > "$WORK/b.tar.age" <<'REMOTE'
set -euo pipefail
set -a; . /etc/postiz/backup-r2.env; set +a
export RCLONE_CONFIG=/dev/null RCLONE_CONFIG_R_TYPE=s3 RCLONE_CONFIG_R_PROVIDER=Cloudflare RCLONE_CONFIG_R_REGION=auto RCLONE_CONFIG_R_NO_CHECK_BUCKET=true
export RCLONE_CONFIG_R_ACCESS_KEY_ID="$BACKUP_R2_ACCESS_KEY_ID" RCLONE_CONFIG_R_SECRET_ACCESS_KEY="$BACKUP_R2_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_R_ENDPOINT="https://$BACKUP_R2_ACCOUNT_ID.r2.cloudflarestorage.com"
latest=$(rclone lsf "R:$BACKUP_R2_BUCKET/postiz/" --include '*.tar.age' | sort | tail -1)
echo "backup: $latest" >&2
rclone cat "R:$BACKUP_R2_BUCKET/postiz/$latest"
REMOTE
echo "2/4 decrypting locally"
age -d -i "$KEY" "$WORK/b.tar.age" | tar -x -C "$WORK"
DUMP=$(find "$WORK" -name postiz.dump | head -1); [ -s "$DUMP" ] || { echo "no postiz.dump in backup" >&2; exit 1; }
echo "3/4 restoring into a throwaway database on the server"
ssh_ 'sudo docker run -d --name pd-restore-drill --network none -e POSTGRES_PASSWORD=drill postgres:17-alpine >/dev/null && for i in $(seq 1 30); do sudo docker exec pd-restore-drill pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done'
ssh_ 'sudo docker exec -i pd-restore-drill pg_restore -U postgres -d postgres --no-owner --no-privileges' < "$DUMP"
echo "4/4 comparing row counts (restored, then live)"
SQL='select (select count(*) from "User") as users, (select count(*) from "Organization") as orgs, (select count(*) from "Post") as posts, (select count(*) from "Integration") as channels, (select count(*) from "Media") as media;'
printf '%s\n' "$SQL" | ssh_ 'sudo docker exec -i pd-restore-drill psql -U postgres -d postgres'
printf '%s\n' "$SQL" | ssh_ 'sudo docker exec -i postdelegate-postiz-postgres-1 psql -U postiz -d postiz'
echo "Restore drill passed if both lines match (live may be slightly ahead if data changed since the backup)."
