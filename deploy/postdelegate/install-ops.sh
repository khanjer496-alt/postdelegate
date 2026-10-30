#!/usr/bin/env bash
# Install the PostDelegate off-site backup and health-check tooling.
# Run as root on the VPS from a copy of this directory. Idempotent.
#
#   sudo ./install-ops.sh --init-env   create the two env files from templates (0600)
#   sudo ./install-ops.sh --check      check prerequisites only; change nothing
#   sudo ./install-ops.sh              install, enable timers, run one off-site upload
#
# Options: --install-packages   apt-get install age rclone curl when missing
#          --allow-no-webhook   accept an empty ALERT_WEBHOOK_URL (journal-only alerts)
#          --no-initial-backup  skip the first off-site upload and test alert
#
# DESTDIR=/some/dir stages the files without root, systemctl or ownership
# changes (used by the local tests).
set -euo pipefail

SRC=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
D=${DESTDIR:-}
ETC=$D/etc/postiz
BIN=$D/usr/local/bin
LIB=$D/usr/local/lib/postiz-ops
UNITS=$D/etc/systemd/system

MODE_INIT=0
MODE_CHECK=0
INSTALL_PACKAGES=0
ALLOW_NO_WEBHOOK=0
INITIAL_BACKUP=1
for arg in "$@"; do
    case $arg in
        --init-env) MODE_INIT=1 ;;
        --check) MODE_CHECK=1 ;;
        --install-packages) INSTALL_PACKAGES=1 ;;
        --allow-no-webhook) ALLOW_NO_WEBHOOK=1 ;;
        --no-initial-backup) INITIAL_BACKUP=0 ;;
        -h | --help)
            sed -n '2,14p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *)
            echo "unknown option: $arg" >&2
            exit 2
            ;;
    esac
done

MISSING=''
note_missing() { MISSING="$MISSING  - $1"$'\n'; }

if [ -z "$D" ] && [ "$(id -u)" -ne 0 ]; then
    echo "Run as root: sudo $0 $*" >&2
    exit 1
fi

# install_file MODE SOURCE DEST
install_file() {
    mkdir -p "$(dirname "$3")"
    if [ -n "$D" ]; then
        install -m "$1" "$2" "$3"
    else
        install -o root -g root -m "$1" "$2" "$3"
    fi
}

mode_of() { stat -c '%a' "$1" 2> /dev/null || stat -f '%Lp' "$1"; }
owner_of() { stat -c '%u' "$1" 2> /dev/null || stat -f '%u' "$1"; }

if [ "$MODE_INIT" -eq 1 ]; then
    mkdir -p "$ETC"
    for f in backup-r2.env alerts.env; do
        if [ -e "$ETC/$f" ]; then
            echo "kept existing $ETC/$f"
        else
            install_file 0600 "$SRC/$f.example" "$ETC/$f"
            echo "created $ETC/$f (0600): edit it and replace every CHANGE_ME"
        fi
    done
    exit 0
fi

# ---------------------------------------------------------- prerequisites
if [ "$INSTALL_PACKAGES" -eq 1 ] && [ -z "$D" ]; then
    apt-get install -y age rclone curl
fi
for tool in age rclone curl docker tar flock; do
    command -v "$tool" > /dev/null 2>&1 || note_missing "command '$tool' (Ubuntu: sudo apt-get install -y age rclone curl, or rerun with --install-packages)"
done

for f in postiz-compose backup-postiz; do
    [ -x "$BIN/$f" ] || note_missing "$BIN/$f (the existing deployment helper)"
done
[ -f "$ETC/runtime.env" ] || note_missing "$ETC/runtime.env (the existing application configuration)"

for src in ops-lib.sh offsite-backup-postiz postiz-healthcheck \
    postiz-offsite-backup.service postiz-offsite-backup.timer \
    postiz-healthcheck.service postiz-healthcheck.timer; do
    [ -f "$SRC/$src" ] || note_missing "$SRC/$src (copy the whole file set next to this script)"
done

# env_value FILE KEY: prints the first value, without evaluating the file
env_value() {
    local line
    line=$(grep -E "^$2=" "$1" | tail -n 1) || return 1
    line=${line#*=}
    line=${line%$'\r'}
    line=${line#\"}
    line=${line%\"}
    printf '%s' "$line"
}

# require_env FILE KEY...: each key must be set to a real value
require_env() {
    local f=$1 k v
    shift
    if [ ! -f "$f" ]; then
        note_missing "$f (create it with: sudo $0 --init-env)"
        return 0
    fi
    if [ -z "$D" ]; then
        if [ "$(owner_of "$f")" != 0 ] || [ "$(mode_of "$f")" != 600 ]; then
            note_missing "$f must be root:root mode 0600 (sudo chown root:root $f && sudo chmod 600 $f)"
        fi
    fi
    for k in "$@"; do
        v=$(env_value "$f" "$k" || true)
        case $v in
            '' | *CHANGE_ME*) note_missing "$k in $f (not set)" ;;
        esac
    done
}

require_env "$ETC/backup-r2.env" BACKUP_R2_ACCOUNT_ID BACKUP_R2_ACCESS_KEY_ID \
    BACKUP_R2_SECRET_ACCESS_KEY BACKUP_R2_BUCKET AGE_RECIPIENT
if [ -f "$ETC/backup-r2.env" ]; then
    recipient=$(env_value "$ETC/backup-r2.env" AGE_RECIPIENT || true)
    case $recipient in
        '' | *CHANGE_ME*) ;;
        *AGE-SECRET-KEY*) note_missing "AGE_RECIPIENT holds a PRIVATE key: put only the public key (age1...) and keep the private key off this server" ;;
        age1*) ;;
        *) note_missing "AGE_RECIPIENT in $ETC/backup-r2.env must start with age1" ;;
    esac
fi
if [ "$ALLOW_NO_WEBHOOK" -ne 1 ]; then
    require_env "$ETC/alerts.env" ALERT_WEBHOOK_URL
fi

if [ -n "$MISSING" ]; then
    printf 'Cannot install yet. Missing or unsafe:\n%s\n' "$MISSING" >&2
    exit 1
fi
if [ "$MODE_CHECK" -eq 1 ]; then
    echo "All prerequisites are present. Run without --check to install."
    exit 0
fi

# ------------------------------------------------------------------ install
install_file 0600 "$SRC/ops-lib.sh" "$LIB/ops-lib.sh"
install_file 0700 "$SRC/offsite-backup-postiz" "$BIN/offsite-backup-postiz"
install_file 0700 "$SRC/postiz-healthcheck" "$BIN/postiz-healthcheck"
for u in postiz-offsite-backup.service postiz-offsite-backup.timer \
    postiz-healthcheck.service postiz-healthcheck.timer; do
    install_file 0644 "$SRC/$u" "$UNITS/$u"
done
if [ -z "$D" ]; then
    install -d -o root -g root -m 0700 /var/lib/postiz-ops
else
    mkdir -p "$D/var/lib/postiz-ops"
fi
echo "Installed scripts and units."

if [ -n "$D" ]; then
    echo "DESTDIR staging only: systemctl steps skipped."
    exit 0
fi

systemctl daemon-reload
systemctl enable --now postiz-backup.timer postiz-offsite-backup.timer

status=0
if [ "$INITIAL_BACKUP" -eq 1 ]; then
    echo "Running the first off-site upload now (this proves the bucket, token and age key work)..."
    if ! systemctl start postiz-offsite-backup.service; then
        echo "The first off-site upload FAILED. Details: journalctl -u postiz-offsite-backup -n 100 --no-pager" >&2
        status=1
    fi
    echo "Sending a test alert..."
    /usr/local/bin/postiz-healthcheck --test-alert || {
        echo "The test alert could not be delivered; check ALERT_WEBHOOK_URL in $ETC/alerts.env" >&2
        status=1
    }
fi
systemctl enable --now postiz-healthcheck.timer

echo
systemctl list-timers 'postiz-*' --no-pager || true
if [ "$status" -eq 0 ]; then
    echo "Done. Next: do the restore drill in README.md (Restore an off-site backup)."
else
    echo "Installed, with errors above. Timers are enabled; rerun this script after fixing them." >&2
fi
exit "$status"
