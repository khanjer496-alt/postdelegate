# shellcheck shell=bash
# Shared helpers for the PostDelegate operations scripts (off-site backup and
# health check). Sourced, never executed. Installed as
# /usr/local/lib/postiz-ops/ops-lib.sh, root:root 0600.

OPS_STATE_DIR=${OPS_STATE_DIR:-/var/lib/postiz-ops}
BACKUP_ROOT=${BACKUP_ROOT:-/var/backups/postiz}
POSTIZ_ETC_DIR=${POSTIZ_ETC_DIR:-/etc/postiz}
OPS_EXPECT_UID=${OPS_EXPECT_UID:-0}
OPS_MARKER_FILE=${OPS_MARKER_FILE:-$OPS_STATE_DIR/offsite-last-success}

# ---------------------------------------------------------------- logging
# Under systemd, a "<N>" prefix sets the journald priority; on a terminal we
# print a timestamp instead.
_log() {
    local prio=$1 tag=$2
    shift 2
    if [ -n "${JOURNAL_STREAM:-}" ]; then
        printf '<%s>%s\n' "$prio" "$*" >&2
    else
        printf '%s [%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$tag" "$*" >&2
    fi
}
log_info() { _log 6 INFO "$@"; }
log_warn() { _log 4 WARN "$@"; }
log_err() { _log 3 ERROR "$@"; }

now_epoch() {
    if [ -n "${NOW_EPOCH:-}" ]; then
        printf '%s\n' "$NOW_EPOCH"
    else
        date +%s
    fi
}

# ------------------------------------------------------------ env files
# Mode must be 0600/0400 and the file owned by OPS_EXPECT_UID (root).
require_private_file() {
    local f=$1 mode owner
    if [ ! -f "$f" ]; then
        log_err "missing file: $f"
        return 1
    fi
    mode=$(stat -c '%a' "$f" 2>/dev/null || stat -f '%Lp' "$f")
    owner=$(stat -c '%u' "$f" 2>/dev/null || stat -f '%u' "$f")
    if [ "$owner" != "$OPS_EXPECT_UID" ]; then
        log_err "$f must be owned by uid $OPS_EXPECT_UID (found $owner)"
        return 1
    fi
    case $mode in
        600 | 400) ;;
        *)
            log_err "$f must be mode 0600 (found $mode): chmod 600 $f"
            return 1
            ;;
    esac
}

_env_key_allowed() {
    case $1 in
        BACKUP_* | AGE_RECIPIENT | ALERT_* | HEALTH_* | APP_HEALTH_URL | EXPECTED_SERVICES | COMPOSE_PROJECT) return 0 ;;
        *) return 1 ;;
    esac
}

_strip_env_value() {
    local value=$1
    value=${value%$'\r'}
    case $value in
        \"*\")
            value=${value#\"}
            value=${value%\"}
            ;;
        \'*\')
            value=${value#\'}
            value=${value%\'}
            ;;
    esac
    printf '%s' "$value"
}

# load_env_file FILE: reads KEY=VALUE lines only. Content is never evaluated,
# and only the allow-listed key names are exported.
load_env_file() {
    local file=$1 line key value
    [ -r "$file" ] || return 1
    while IFS= read -r line || [ -n "$line" ]; do
        case $line in '' | '#'*) continue ;; esac
        line=${line#export }
        key=${line%%=*}
        [ "$key" != "$line" ] || continue
        case $key in '' | *[!A-Za-z0-9_]* | [0-9]*) continue ;; esac
        _env_key_allowed "$key" || continue
        value=$(_strip_env_value "${line#*=}")
        export "$key=$value"
    done < "$file"
}

# env_file_value FILE KEY: prints one value without loading the file.
env_file_value() {
    local line
    [ -r "$1" ] || return 1
    line=$(grep -E "^$2=" "$1" | tail -n 1) || return 1
    _strip_env_value "${line#*=}"
}

# ------------------------------------------------------------ date maths
# Pure arithmetic so it behaves identically on GNU and BSD userlands.
is_stamp() {
    [[ $1 =~ ^[0-9]{8}T[0-9]{6}Z$ ]]
}

days_from_civil() {
    local y=$((10#$1)) m=$((10#$2)) d=$((10#$3)) era yoe doy doe
    if [ "$m" -le 2 ]; then y=$((y - 1)); fi
    if [ "$y" -ge 0 ]; then era=$((y / 400)); else era=$(((y - 399) / 400)); fi
    yoe=$((y - era * 400))
    if [ "$m" -gt 2 ]; then doy=$(((153 * (m - 3) + 2) / 5 + d - 1)); else doy=$(((153 * (m + 9) + 2) / 5 + d - 1)); fi
    doe=$((yoe * 365 + yoe / 4 - yoe / 100 + doy))
    printf '%s\n' $((era * 146097 + doe - 719468))
}

stamp_to_epoch() {
    local s=$1 days
    is_stamp "$s" || return 1
    days=$(days_from_civil "${s:0:4}" "${s:4:2}" "${s:6:2}")
    printf '%s\n' $((days * 86400 + 10#${s:9:2} * 3600 + 10#${s:11:2} * 60 + 10#${s:13:2}))
}

# Monday-based week number counted from the epoch (1970-01-01 was a Thursday).
stamp_week_bucket() {
    local s=$1 days
    is_stamp "$s" || return 1
    days=$(days_from_civil "${s:0:4}" "${s:4:2}" "${s:6:2}")
    printf '%s\n' $(((days + 3) / 7))
}

# ------------------------------------------------------------- retention
# retention_delete_list KEEP_DAILY KEEP_WEEKLY: reads backup stamps on stdin
# and prints the stamps to delete. Kept: the newest backup of each of the
# KEEP_DAILY most recent UTC days, plus the newest backup of each of the
# KEEP_WEEKLY most recent Monday-based weeks (days/weeks that have backups).
retention_delete_list() {
    local keep_daily=$1 keep_weekly=$2 stamp day week keep
    local last_day='' last_week='' nd=0 nw=0 first_day first_week
    while IFS= read -r stamp; do
        is_stamp "$stamp" || continue
        day=${stamp:0:8}
        week=$(stamp_week_bucket "$stamp")
        keep=0
        first_day=0
        first_week=0
        if [ "$day" != "$last_day" ]; then
            first_day=1
            last_day=$day
            nd=$((nd + 1))
        fi
        if [ "$week" != "$last_week" ]; then
            first_week=1
            last_week=$week
            nw=$((nw + 1))
        fi
        if [ "$first_day" -eq 1 ] && [ "$nd" -le "$keep_daily" ]; then keep=1; fi
        if [ "$first_week" -eq 1 ] && [ "$nw" -le "$keep_weekly" ]; then keep=1; fi
        if [ "$keep" -eq 0 ]; then printf '%s\n' "$stamp"; fi
    done < <(sort -ru)
}

# -------------------------------------------------------------- checksums
sha256_stdin() {
    if command -v sha256sum > /dev/null 2>&1; then
        sha256sum | cut -d' ' -f1
    else
        shasum -a 256 | cut -d' ' -f1
    fi
}

sha256_file() {
    sha256_stdin < "$1"
}

# ------------------------------------------------------ local snapshots
OPS_REQUIRED_DUMPS="postiz.dump temporal.dump temporal-visibility.dump"

# Prints the stamp of the newest snapshot directory that has SHA256SUMS
# (written last by backup-postiz, so its presence means the backup finished).
newest_complete_snapshot() {
    local d name best=''
    for d in "$BACKUP_ROOT"/*/; do
        [ -d "$d" ] || continue
        [ ! -L "${d%/}" ] || continue
        name=$(basename "$d")
        is_stamp "$name" || continue
        [ -f "$d/SHA256SUMS" ] || continue
        if [ -z "$best" ] || [[ $name > $best ]]; then best=$name; fi
    done
    [ -n "$best" ] || return 1
    printf '%s\n' "$best"
}

# SHA256SUMS written by backup-postiz uses absolute paths, so match by file
# name inside the snapshot directory instead of using sha256sum -c.
verify_snapshot_checksums() {
    local dir=$1 hash path base want seen=''
    while read -r hash path; do
        [ -n "$hash" ] || continue
        base=${path##*/}
        if [ ! -f "$dir/$base" ]; then
            log_err "checksum list names a missing file: $base"
            return 1
        fi
        if [ "$(sha256_file "$dir/$base")" != "$hash" ]; then
            log_err "checksum mismatch: $base"
            return 1
        fi
        seen="$seen $base"
    done < "$dir/SHA256SUMS"
    for want in $OPS_REQUIRED_DUMPS; do
        case " $seen " in
            *" $want "*) ;;
            *)
                log_err "SHA256SUMS does not cover $want"
                return 1
                ;;
        esac
    done
}

# ------------------------------------------------------------- alerting
json_escape() {
    local s=$1
    s=${s//\\/\\\\}
    s=${s//\"/\\\"}
    s=${s//$'\n'/\\n}
    s=${s//$'\r'/\\r}
    s=${s//$'\t'/\\t}
    printf '%s' "$s"
}

# send_alert TITLE MESSAGE [PRIORITY] [TAGS]
# Always safe to call. Delivers to ALERT_WEBHOOK_URL when set (ntfy topic URL,
# Slack or Discord webhook); the journal always gets the message from the
# caller. Returns non-zero only when a configured delivery failed. The URL is
# a secret and is never logged or put on a command line.
send_alert() {
    local title=$1 msg=$2 prio=${3:-high} tags=${4:-warning}
    local url=${ALERT_WEBHOOK_URL:-} format=${ALERT_WEBHOOK_FORMAT:-auto} body
    if [ -z "$url" ]; then
        log_warn "ALERT_WEBHOOK_URL is not set; alert is in the journal only: $title"
        return 0
    fi
    case $url in
        http://* | https://*) ;;
        *)
            log_err "ALERT_WEBHOOK_URL must start with http:// or https://"
            return 1
            ;;
    esac
    if [ "$format" = auto ]; then
        case $url in
            *hooks.slack.com/* | *discord.com/api/webhooks/* | *discordapp.com/api/webhooks/*) format=json ;;
            *) format=text ;;
        esac
    fi
    if [ "$format" = json ]; then
        body=$(printf '{"text":"%s","content":"%s"}' \
            "$(json_escape "$title: $msg")" "$(json_escape "$title: $msg")")
        printf 'url = "%s"\n' "$url" | curl --silent --show-error --fail --max-time 20 \
            --retry 2 --retry-delay 3 --config - \
            -H 'Content-Type: application/json' --data-binary "$body" > /dev/null || return 1
    else
        printf 'url = "%s"\n' "$url" | curl --silent --show-error --fail --max-time 20 \
            --retry 2 --retry-delay 3 --config - \
            -H "Title: $title" -H "Priority: $prio" -H "Tags: $tags" \
            --data-binary "$msg" > /dev/null || return 1
    fi
}

# Runs a command with a time limit when `timeout` exists (always on the VPS).
with_timeout() {
    local secs=$1
    shift
    if command -v timeout > /dev/null 2>&1; then
        timeout "$secs" "$@"
    else
        "$@"
    fi
}

# Serialise runs of the same script; no-op where flock is unavailable.
acquire_lock() {
    local name=$1
    if command -v flock > /dev/null 2>&1; then
        mkdir -p "$OPS_STATE_DIR"
        exec 9> "$OPS_STATE_DIR/$name.lock"
        flock -n 9 || {
            log_warn "another $name run is still in progress; exiting"
            exit 0
        }
    fi
}
