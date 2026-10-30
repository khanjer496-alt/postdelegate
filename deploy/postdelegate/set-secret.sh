#!/usr/bin/env bash
# Install one secret into the PostDelegate server config without it ever
# appearing in chat, the repo, shell history or process arguments.
#
#   deploy/postdelegate/set-secret.sh FACEBOOK_APP_SECRET
#
# It asks for the value (hidden), backs up the server file, replaces or adds
# NAME=value, and does NOT restart anything. Tell Claude which names you set;
# Claude restarts the app and verifies the connection.
set -euo pipefail

NAME="${1:-}"
FILE="${2:-/etc/postiz/runtime.env}"
HOST="${PD_HOST:-ubuntu@57.129.186.135}"
KEY="${PD_SSH_KEY:-$HOME/.ssh/postdelegate_prod}"

if [[ ! "$NAME" =~ ^[A-Z][A-Z0-9_]*$ ]]; then
  echo "usage: $0 NAME [server-env-file]   (NAME like FACEBOOK_APP_SECRET)" >&2
  exit 2
fi
case "$FILE" in
  /etc/postiz/runtime.env|/etc/postiz/r2.env|/etc/postiz/backup-r2.env|/etc/postiz/alerts.env) ;;
  *) echo "refusing unknown target file $FILE" >&2; exit 2 ;;
esac

read -rsp "Paste value for $NAME (hidden): " VALUE
echo
if [[ -z "$VALUE" || "$VALUE" == *$'\n'* ]]; then
  echo "empty or multi-line value; nothing changed" >&2
  exit 1
fi

# The value travels on stdin over SSH, never on a command line.
printf '%s' "$VALUE" | ssh -o BatchMode=yes -i "$KEY" "$HOST" \
  "sudo NAME='$NAME' FILE='$FILE' bash -c '
    set -euo pipefail
    IFS= read -r VALUE || true
    touch \"\$FILE\"; chmod 600 \"\$FILE\"
    cp -a \"\$FILE\" \"\$FILE.before-\$NAME-\$(date -u +%Y%m%dT%H%M%SZ)\"
    tmp=\$(mktemp)
    grep -v \"^\$NAME=\" \"\$FILE\" > \"\$tmp\" || true
    printf \"%s=%s\n\" \"\$NAME\" \"\$VALUE\" >> \"\$tmp\"
    install -m 600 -o root -g root \"\$tmp\" \"\$FILE\"
    rm -f \"\$tmp\"
    echo \"\$NAME set in \$FILE (restart pending)\"
  '"
unset VALUE
