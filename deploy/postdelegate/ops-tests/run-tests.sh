#!/usr/bin/env bash
# Local tests for the operations tooling. No server, no network beyond
# 127.0.0.1, no real rclone/age: those are replaced by stubs, so this proves
# the scripts' logic and not the third-party tools. Run from anywhere:
#   bash deploy/postdelegate/ops-tests/run-tests.sh
set -uo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
DEPLOY=$(cd "$HERE/.." && pwd)
WORK=$(mktemp -d "${TMPDIR:-/tmp}/ops-tests.XXXXXX")
PASS=0
FAIL=0
SERVER_PID=''

cleanup() {
    [ -z "$SERVER_PID" ] || kill "$SERVER_PID" 2> /dev/null || true
    rm -rf "$WORK"
}
trap cleanup EXIT

mode_of() { stat -c '%a' "$1" 2> /dev/null || stat -f '%Lp' "$1"; }
ok() { PASS=$((PASS + 1)); printf 'ok   %s\n' "$1"; }
bad() { FAIL=$((FAIL + 1)); printf 'FAIL %s\n' "$1"; }
check() { # DESCRIPTION CONDITION-COMMAND...
    local d=$1
    shift
    if "$@" > /dev/null 2>&1; then ok "$d"; else bad "$d"; fi
}
eq() { # DESCRIPTION EXPECTED ACTUAL
    if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (expected '$2', got '$3')"; fi
}

export POSTIZ_OPS_LIB=$DEPLOY/ops-lib.sh
export OPS_EXPECT_UID
OPS_EXPECT_UID=$(id -u)

# ----------------------------------------------------------- pure functions
echo "== ops-lib pure functions"
(
    # shellcheck source=../ops-lib.sh
    . "$POSTIZ_OPS_LIB"
    set +e
    for s in 19700101T000000Z 20240229T235959Z 20261029T022000Z 20991231T120000Z; do
        got=$(stamp_to_epoch "$s")
        want=$(python3 -c "import calendar,datetime,sys;print(calendar.timegm(datetime.datetime.strptime(sys.argv[1],'%Y%m%dT%H%M%SZ').timetuple()))" "$s")
        [ "$got" = "$want" ] && echo "ok   epoch $s" || echo "FAIL epoch $s got $got want $want"
    done
    # Monday and Sunday of the same ISO week share a bucket; next Monday differs.
    a=$(stamp_week_bucket 20261026T000000Z) # Monday
    b=$(stamp_week_bucket 20261101T235959Z) # Sunday
    c=$(stamp_week_bucket 20261102T000000Z) # next Monday
    [ "$a" = "$b" ] && [ "$b" != "$c" ] && echo "ok   week buckets" || echo "FAIL week buckets $a $b $c"
    is_stamp 20261029T022000Z && ! is_stamp 2026-10-29 && ! is_stamp '20261029T022000Z; rm' && echo "ok   is_stamp" || echo "FAIL is_stamp"
    [ "$(json_escape 'a"b\c
d')" = 'a\"b\\c\nd' ] && echo "ok   json_escape" || echo "FAIL json_escape"
) | while IFS= read -r line; do
    case $line in ok*) ok "${line#ok   }" ;; *) bad "${line#FAIL }" ;; esac
done

echo "== retention policy against an independent Python implementation"
python3 - "$DEPLOY" <<'EOF' > "$WORK/retention-cases.txt"
import datetime, random, subprocess, sys
random.seed(7)
base = datetime.datetime(2026, 10, 30, 3, 0, 0)
def expected(stamps, kd, kw):
    keep = set()
    days, weeks = [], []
    for s in sorted(stamps, reverse=True):
        d = datetime.datetime.strptime(s, "%Y%m%dT%H%M%SZ")
        day = d.date()
        wk = d.date().isocalendar()[:2]
        if day not in days:
            days.append(day)
            if len(days) <= kd: keep.add(s)
        if wk not in weeks:
            weeks.append(wk)
            if len(weeks) <= kw: keep.add(s)
    return sorted(set(stamps) - keep)
cases = []
# one per day for 120 days; two per day with gaps; sparse
cases.append([(base - datetime.timedelta(days=i)).strftime("%Y%m%dT%H%M%SZ") for i in range(120)])
cases.append([(base - datetime.timedelta(days=i, hours=h)).strftime("%Y%m%dT%H%M%SZ") for i in range(0, 90, 1) for h in (0, 5)])
cases.append([(base - datetime.timedelta(days=random.randint(0, 200), seconds=random.randint(0, 80000))).strftime("%Y%m%dT%H%M%SZ") for _ in range(60)])
cases.append(["20261029T022000Z"])
for i, c in enumerate(cases):
    c = sorted(set(c))
    print(i, ",".join(c), ",".join(expected(c, 14, 8)))
EOF
while read -r idx stamps expected_set; do
    got=$(
        # shellcheck source=../ops-lib.sh
        . "$POSTIZ_OPS_LIB"
        printf '%s\n' "${stamps//,/$'\n'}" | retention_delete_list 14 8 | sort | tr '\n' ',' | sed 's/,$//'
    )
    eq "retention case $idx" "$expected_set" "$got"
done < "$WORK/retention-cases.txt"

echo "== env loader never evaluates content"
cat > "$WORK/t.env" <<'EOF'
# comment
BACKUP_R2_BUCKET="quoted-bucket"
ALERT_WEBHOOK_URL=https://ntfy.sh/topic?x=$(touch PWNED)&y=`touch PWNED2`
AGE_RECIPIENT='age1abc'
PATH=/evil
HEALTH_DISK_MAX_PCT=77
export BACKUP_KEEP_DAILY=3
not a valid line
EOF
printf 'BACKUP_R2_ACCOUNT_ID=crlf\r\n' >> "$WORK/t.env"
(
    cd "$WORK" || exit 1
    # shellcheck source=../ops-lib.sh
    . "$POSTIZ_OPS_LIB"
    load_env_file "$WORK/t.env"
    r=ok
    [ "$BACKUP_R2_BUCKET" = quoted-bucket ] || r="bucket quote: $BACKUP_R2_BUCKET"
    [ "$AGE_RECIPIENT" = age1abc ] || r="age: $AGE_RECIPIENT"
    [ "$HEALTH_DISK_MAX_PCT" = 77 ] || r=pct
    [ "$BACKUP_KEEP_DAILY" = 3 ] || r=exported_key
    [ "$BACKUP_R2_ACCOUNT_ID" = crlf ] || r=crlf
    [ "$PATH" != /evil ] || r=PATH
    # shellcheck disable=SC2016
    case $ALERT_WEBHOOK_URL in 'https://ntfy.sh/topic?x=$(touch PWNED)&y=`touch PWNED2`') ;; *) r="url: $ALERT_WEBHOOK_URL" ;; esac
    [ ! -e PWNED ] && [ ! -e PWNED2 ] || r=evaluated
    echo "$r"
) > "$WORK/env-result.txt"
eq "env loader" ok "$(cat "$WORK/env-result.txt")"

# ------------------------------------------------------------ fake services
export FAKE_STATUS_FILE=$WORK/http-status FAKE_LOG=$WORK/hook.log FAKE_PORT_FILE=$WORK/port FAKE_WEBHOOK_FAIL=$WORK/webhook-fail
echo 200 > "$FAKE_STATUS_FILE"
: > "$FAKE_LOG"
python3 "$HERE/fake-http.py" &
SERVER_PID=$!
for _ in 1 2 3 4 5 6 7 8 9 10 20 30 40; do
    [ -s "$FAKE_PORT_FILE" ] && break
    sleep 0.2
done
PORT=$(cat "$FAKE_PORT_FILE")
hook_count() { wc -l < "$FAKE_LOG" | tr -d ' '; }
last_hook() { tail -n 1 "$FAKE_LOG"; }

echo "== send_alert formats"
(
    # shellcheck source=../ops-lib.sh
    . "$POSTIZ_OPS_LIB"
    set +e
    ALERT_WEBHOOK_URL=http://127.0.0.1:$PORT/hook/mytopic send_alert "Title here" 'line "one"
line two' high warning
    echo "rc=$?"
    ALERT_WEBHOOK_URL=http://127.0.0.1:$PORT/hook/slack ALERT_WEBHOOK_FORMAT=json send_alert "T" 'quote " and \ back'
    echo "rc=$?"
    ALERT_WEBHOOK_URL='' send_alert "no hook" "msg" 2> /dev/null
    echo "rc=$?"
    ALERT_WEBHOOK_URL='ftp://nope' send_alert "bad" "msg" 2> /dev/null
    echo "rc=$?"
    touch "$FAKE_WEBHOOK_FAIL"
    ALERT_WEBHOOK_URL=http://127.0.0.1:$PORT/hook/x send_alert "fails" "msg" 2> /dev/null
    echo "rc=$?"
    rm -f "$FAKE_WEBHOOK_FAIL"
) > "$WORK/alert-rc.txt"
eq "send_alert return codes" "rc=0 rc=0 rc=0 rc=1 rc=1" "$(tr '\n' ' ' < "$WORK/alert-rc.txt" | sed 's/ $//')"
python3 - "$FAKE_LOG" > "$WORK/alert-check.txt" <<'EOF'
import json, sys
lines = [json.loads(l) for l in open(sys.argv[1])]
a, b = lines[0], lines[1]
assert a["path"] == "/hook/mytopic"
assert a["headers"]["Title"] == "Title here" and a["headers"]["Priority"] == "high" and a["headers"]["Tags"] == "warning", a
assert a["body"] == 'line "one"\nline two', a["body"]
j = json.loads(b["body"])
assert j["text"] == j["content"] == 'T: quote " and \\ back', j
assert b["headers"]["Content-Type"] == "application/json"
print("ok")
EOF
eq "ntfy text body+headers and slack/discord JSON body" ok "$(cat "$WORK/alert-check.txt" 2>&1 | tail -n 1)"
: > "$FAKE_LOG"

# ------------------------------------------------------------- health check
echo "== postiz-healthcheck end to end (stubbed docker, real curl, real df)"
STUBS=$WORK/stubs
mkdir -p "$STUBS"
cat > "$STUBS/docker" <<'EOF'
#!/usr/bin/env bash
# Minimal docker stand-in. Env: STUB_DOCKER_DOWN, STUB_MISSING, STUB_BAD_SERVICE, STUB_TEMPORAL_BAD
case $1 in
    info) [ -z "${STUB_DOCKER_DOWN:-}" ] ;;
    ps)
        svc=''
        for a in "$@"; do case $a in label=com.docker.compose.service=*) svc=${a#label=com.docker.compose.service=} ;; esac; done
        case " ${STUB_MISSING:-} " in *" $svc "*) exit 0 ;; esac
        echo "cid-$svc"
        ;;
    inspect)
        id=${*: -1}
        if [ "cid-${STUB_BAD_SERVICE:-}" = "$id" ]; then echo 'running|unhealthy'; else echo 'running|healthy'; fi
        ;;
    exec)
        if [ -n "${STUB_TEMPORAL_BAD:-}" ]; then echo 'connection refused'; exit 1; fi
        echo SERVING
        ;;
esac
EOF
chmod +x "$STUBS/docker"

H_ETC=$WORK/h-etc H_STATE=$WORK/h-state H_BACKUPS=$WORK/h-backups
mkdir -p "$H_ETC" "$H_STATE" "$H_BACKUPS"
chmod 700 "$H_STATE"
fresh_stamp() { date -u -v-"${1:-1}"H +%Y%m%dT%H%M%SZ 2> /dev/null || date -u -d "-${1:-1} hours" +%Y%m%dT%H%M%SZ; }
make_snapshot() { # STAMP
    mkdir -p "$H_BACKUPS/$1"
    echo x > "$H_BACKUPS/$1/SHA256SUMS"
}
make_snapshot "$(fresh_stamp 2)"
printf 'stamp=%s\nobject=postiz/x\n' "$(fresh_stamp 2)" > "$H_STATE/offsite-last-success"
printf 'ALERT_WEBHOOK_URL=http://127.0.0.1:%s/hook/health\n' "$PORT" > "$H_ETC/alerts.env"
chmod 600 "$H_ETC/alerts.env"

run_health() { # extra env assignments as args; prints exit code
    env POSTIZ_ETC_DIR="$H_ETC" OPS_STATE_DIR="$H_STATE" BACKUP_ROOT="$H_BACKUPS" \
        OPS_MARKER_FILE="$H_STATE/offsite-last-success" PATH="$STUBS:$PATH" \
        APP_HEALTH_URL="http://127.0.0.1:$PORT/api/auth/can-register" HEALTH_DISK_PATHS=/ \
        HEALTH_DISK_MAX_PCT=101 HEALTH_HTTP_RETRIES=0 "$@" \
        "$DEPLOY/postiz-healthcheck" ${HC_ARG:+"$HC_ARG"} 2> "$WORK/health.err"
    echo $?
}

eq "healthy run exits 0" 0 "$(run_health)"
eq "healthy run sends nothing" 0 "$(hook_count)"
echo 503 > "$FAKE_STATUS_FILE"
eq "first failure exits 1" 1 "$(run_health)"
eq "first failure is below the alert threshold" 0 "$(hook_count)"
eq "second consecutive failure exits 1" 1 "$(run_health)"
eq "second consecutive failure alerts once" 1 "$(hook_count)"
check "alert names the failing check" grep -q 'http' <<< "$(last_hook)"
eq "third failure exits 1" 1 "$(run_health)"
eq "repeat inside the reminder window is rate limited" 1 "$(hook_count)"
LATER=$(($(date +%s) + 7 * 3600))
eq "failure past 6h exits 1" 1 "$(run_health NOW_EPOCH=$LATER)"
eq "reminder sent after 6h" 2 "$(hook_count)"
check "reminder is labelled" grep -q 'REMINDER' <<< "$(last_hook)"
eq "second failing check changes the set" 1 "$(run_health NOW_EPOCH=$LATER HEALTH_DISK_MAX_PCT=1)"
eq "changed failing set alerts immediately" 3 "$(hook_count)"
check "update lists both checks" grep -q 'disk' <<< "$(last_hook)"
echo 200 > "$FAKE_STATUS_FILE"
eq "recovery exits 0" 0 "$(run_health)"
eq "recovery notice sent" 4 "$(hook_count)"
check "recovery notice text" grep -q 'recovered' <<< "$(last_hook)"
eq "steady state after recovery sends nothing" 0 "$(run_health)"
eq "steady state hook count unchanged" 4 "$(hook_count)"

: > "$FAKE_LOG"
rm -f "$H_STATE/health-state"
eq "stopped container: run 1" 1 "$(run_health STUB_BAD_SERVICE=temporal)"
eq "stopped container: run 2" 1 "$(run_health STUB_BAD_SERVICE=temporal)"
check "unhealthy service reported" grep -q 'service-temporal' <<< "$(last_hook)"
eq "missing container + temporal failure" 1 "$(run_health STUB_MISSING=redis STUB_TEMPORAL_BAD=1)"
check "set change names redis and temporal" grep -q 'service-redis' <<< "$(last_hook)"
eq "recovers" 0 "$(run_health)"

: > "$FAKE_LOG"
rm -f "$H_STATE/health-state"
eq "stale local backup: run 1" 1 "$(run_health NOW_EPOCH=$(($(date +%s) + 30 * 3600)))"
eq "stale local backup + off-site: run 2" 1 "$(run_health NOW_EPOCH=$(($(date +%s) + 30 * 3600)))"
check "stale backups are named" grep -q 'backup-local' <<< "$(last_hook)"
check "stale off-site is named" grep -q 'backup-offsite' <<< "$(last_hook)"
eq "recovers (fresh again)" 0 "$(run_health)"
mv "$H_STATE/offsite-last-success" "$WORK/marker.bak"
rm -f "$H_STATE/health-state"
: > "$FAKE_LOG"
run_health > /dev/null
eq "missing off-site marker is a failure" 1 "$(run_health)"
check "missing marker explained" grep -q 'marker' <<< "$(last_hook)"
mv "$WORK/marker.bak" "$H_STATE/offsite-last-success"
run_health > /dev/null

: > "$FAKE_LOG"
rm -f "$H_STATE/health-state"
eq "docker down: run 1" 1 "$(run_health STUB_DOCKER_DOWN=1)"
eq "docker down: run 2" 1 "$(run_health STUB_DOCKER_DOWN=1)"
check "docker daemon failure is reported" grep -q 'docker' <<< "$(last_hook)"
run_health > /dev/null
: > "$FAKE_LOG"

echo 200 > "$FAKE_STATUS_FILE"
rm -f "$H_STATE/health-state"
touch "$FAKE_WEBHOOK_FAIL"
eq "undeliverable alert exits 2" 2 "$(run_health HEALTH_FAIL_THRESHOLD=1 HEALTH_DISK_MAX_PCT=1)"
eq "undeliverable alert exits 2 again" 2 "$(run_health HEALTH_FAIL_THRESHOLD=1 HEALTH_DISK_MAX_PCT=1)"
eq "undelivered alert is not recorded as sent" 0 "$(grep -c '^alerted=1' "$H_STATE/health-state" || true)"
rm -f "$FAKE_WEBHOOK_FAIL"
eq "retry delivers when the webhook is back" 1 "$(run_health HEALTH_FAIL_THRESHOLD=1 HEALTH_DISK_MAX_PCT=1)"
eq "alert delivered on retry" 1 "$(hook_count)"
run_health > /dev/null
: > "$FAKE_LOG"
eq "--test-alert delivers" 0 "$(HC_ARG=--test-alert run_health)"
check "--test-alert message" grep -q 'test alert' <<< "$(last_hook)"
rm -f "$H_ETC/alerts.env"
eq "no webhook configured still logs and exits cleanly when healthy" 0 "$(run_health)"
check "state dir is private" test "$(mode_of "$H_STATE")" = 700

# ------------------------------------------------------- off-site backup
echo "== offsite-backup-postiz (stubbed rclone and age)"
OS=$WORK/offsite
mkdir -p "$OS/stubs" "$OS/etc" "$OS/state" "$OS/backups" "$OS/remote"
cat > "$OS/stubs/rclone" <<'EOF'
#!/usr/bin/env python3
import os, shutil, sys
root = os.environ["STUB_REMOTE_ROOT"]
if os.environ.get("STUB_RCLONE_DOWN"):
    sys.exit(1)
with open(os.environ["STUB_RCLONE_LOG"], "a") as log:
    log.write(" ".join(sys.argv[1:]) + "\n")
with open(os.environ["STUB_RCLONE_ENV"], "w") as f:
    for k, v in sorted(os.environ.items()):
        if k.startswith("RCLONE_"):
            f.write(f"{k}={v}\n")
def path(arg):
    assert arg.startswith("PDBACKUP:"), arg
    return os.path.join(root, arg.split(":", 1)[1])
a = sys.argv[1:]
if a[0] == "lsf":
    assert a[1:6] == ["--files-only", "--format", "sp", "--separator", " "], a
    t = path(a[-1])
    if not os.path.isdir(t):
        sys.exit(3)
    for n in sorted(os.listdir(t)):
        print(os.path.getsize(os.path.join(t, n)), n)
elif a[0] == "copyto":
    dst = path(a[2])
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copyfile(a[1], dst)
    if os.environ.get("STUB_CORRUPT") and dst.endswith(".tar.age"):
        open(dst, "ab").write(b"x")
elif a[0] == "cat":
    data = open(path(a[1]), "rb").read()
    if os.environ.get("STUB_FLIP") and a[1].endswith(".tar.age"):
        data = b"Z" + data[1:]
    sys.stdout.buffer.write(data)
elif a[0] == "deletefile":
    os.remove(path(a[1]))
else:
    sys.exit(99)
EOF
cat > "$OS/stubs/age" <<'EOF'
#!/usr/bin/env bash
# Records recipients, then writes stdin unchanged (a plain tar) to the -o file.
out=''
while [ $# -gt 0 ]; do
    case $1 in
        -r) echo "$2" >> "$STUB_AGE_LOG"; shift 2 ;;
        -o) out=$2; shift 2 ;;
        *) echo "unexpected age arg: $1" >&2; exit 64 ;;
    esac
done
cat > "$out"
EOF
chmod +x "$OS/stubs/rclone" "$OS/stubs/age"
export STUB_REMOTE_ROOT=$OS/remote STUB_RCLONE_LOG=$OS/rclone.log STUB_RCLONE_ENV=$OS/rclone.env STUB_AGE_LOG=$OS/age.log
RECIPIENT=age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq
ACCOUNT=0123456789abcdef0123456789abcdef

write_env() {
    cat > "$OS/etc/backup-r2.env" <<EOF
BACKUP_R2_ACCOUNT_ID=$ACCOUNT
BACKUP_R2_ACCESS_KEY_ID=backupkeyid
BACKUP_R2_SECRET_ACCESS_KEY=backupsecret
BACKUP_R2_BUCKET=${1:-postdelegate-backups}
AGE_RECIPIENT=${2:-$RECIPIENT}
EOF
    chmod 600 "$OS/etc/backup-r2.env"
    printf 'CLOUDFLARE_BUCKETNAME=nashr-production-media\nCLOUDFLARE_ACCESS_KEY=mediakeyid\n' > "$OS/etc/runtime.env"
    chmod 600 "$OS/etc/runtime.env"
    printf 'ALERT_WEBHOOK_URL=http://127.0.0.1:%s/hook/offsite\n' "$PORT" > "$OS/etc/alerts.env"
    chmod 600 "$OS/etc/alerts.env"
}
make_real_snapshot() { # STAMP
    local d=$OS/backups/$1 f
    mkdir -p "$d/configuration" "$d/dynamicconfig"
    for f in postiz.dump temporal.dump temporal-visibility.dump; do head -c 4096 /dev/urandom > "$d/$f"; done
    echo 'media=secret' > "$d/configuration/r2.env"
    echo 'BACKUP_R2_SECRET_ACCESS_KEY=backupsecret' > "$d/configuration/backup-r2.env"
    echo services > "$d/compose.yaml"
    (
        cd "$d" || exit 1
        # Absolute paths, exactly like backup-postiz writes them.
        for f in postiz.dump temporal.dump temporal-visibility.dump; do
            printf '%s  %s/%s\n' "$(shasum -a 256 "$f" | cut -d' ' -f1)" "/var/backups/postiz/$1" "$f"
        done > SHA256SUMS
    )
}
run_offsite() { # extra env assignments as args; prints exit code
    env POSTIZ_ETC_DIR="$OS/etc" OPS_STATE_DIR="$OS/state" BACKUP_ROOT="$OS/backups" \
        OPS_MARKER_FILE="$OS/state/offsite-last-success" RCLONE_BIN="$OS/stubs/rclone" AGE_BIN="$OS/stubs/age" \
        PATH="$PATH" "$@" "$DEPLOY/offsite-backup-postiz" 2> "$OS/last.err"
    echo $?
}
reset_remote() { rm -rf "$OS/remote"; mkdir -p "$OS/remote"; rm -f "$OS/state/offsite-last-success"; : > "$STUB_RCLONE_LOG"; : > "$STUB_AGE_LOG"; }

write_env
NEW=$(date -u +%Y%m%dT%H%M%SZ)
make_real_snapshot "$NEW"
eq "upload succeeds" 0 "$(run_offsite)"
check "encrypted archive is in the bucket" test -s "$OS/remote/postdelegate-backups/postiz/$NEW.tar.age"
check "checksum file is in the bucket" test -s "$OS/remote/postdelegate-backups/postiz/$NEW.tar.age.sha256"
(cd "$OS/remote/postdelegate-backups/postiz" && check "uploaded checksum matches the archive" shasum -a 256 -c "$NEW.tar.age.sha256")
check "marker written with the snapshot stamp" grep -q "^stamp=$NEW\$" "$OS/state/offsite-last-success"
check "marker has a verified epoch" grep -Eq '^verified_epoch=[0-9]+$' "$OS/state/offsite-last-success"
tar -tf "$OS/remote/postdelegate-backups/postiz/$NEW.tar.age" > "$OS/tar.list"
check "archive contains the dumps" grep -q 'temporal-visibility.dump' "$OS/tar.list"
check "archive contains configuration" grep -q 'configuration/r2.env' "$OS/tar.list"
check "archive leaves out the backup bucket credentials" bash -c "! grep -q 'configuration/backup-r2.env' '$OS/tar.list'"
eq "age got the public recipient" "$RECIPIENT" "$(head -n 1 "$OS/age.log")"
eq "rclone endpoint points at the account's R2" "RCLONE_CONFIG_PDBACKUP_ENDPOINT=https://$ACCOUNT.r2.cloudflarestorage.com" "$(grep ENDPOINT "$OS/rclone.env")"
check "rclone does not try to create the bucket" grep -q 'NO_CHECK_BUCKET=true' "$OS/rclone.env"
check "no secrets in the journal output" bash -c "! grep -q 'backupsecret' '$OS/last.err'"

: > "$STUB_RCLONE_LOG"
eq "second run is idempotent" 0 "$(run_offsite)"
check "second run skips the upload" grep -q 'already off-site' "$OS/last.err"
check "second run does not copy anything" bash -c "! grep -q '^copyto' '$STUB_RCLONE_LOG'"

echo "-- retention"
reset_remote
SEEDED=$(python3 - "$NEW" <<'EOF'
import datetime, sys
now = datetime.datetime.strptime(sys.argv[1], "%Y%m%dT%H%M%SZ")
print(" ".join((now - datetime.timedelta(days=i, hours=1)).strftime("%Y%m%dT%H%M%SZ") for i in range(1, 80)))
EOF
)
mkdir -p "$OS/remote/postdelegate-backups/postiz"
for s in $SEEDED; do
    echo old > "$OS/remote/postdelegate-backups/postiz/$s.tar.age"
    echo sum > "$OS/remote/postdelegate-backups/postiz/$s.tar.age.sha256"
done
echo keepme > "$OS/remote/postdelegate-backups/postiz/README-not-a-backup.txt"
eq "retention beyond the per-run limit fails safely" 1 "$(run_offsite)"
check "limit failure is explained" grep -q 'would delete' "$OS/last.err"
eq "nothing was deleted by the refused run" 161 "$(find "$OS/remote" -type f | wc -l | tr -d ' ')"
eq "retention applies with a raised limit" 0 "$(run_offsite BACKUP_MAX_DELETE_PER_RUN=500)"
WANT=$(python3 - "$NEW" "$SEEDED" <<'EOF'
import datetime, sys
stamps = sorted(set(sys.argv[2].split() + [sys.argv[1]]), reverse=True)
keep, days, weeks = set(), [], []
for s in stamps:
    d = datetime.datetime.strptime(s, "%Y%m%dT%H%M%SZ")
    if d.date() not in days:
        days.append(d.date())
        if len(days) <= 14: keep.add(s)
    wk = d.date().isocalendar()[:2]
    if wk not in weeks:
        weeks.append(wk)
        if len(weeks) <= 8: keep.add(s)
print(" ".join(sorted(keep)))
EOF
)
# shellcheck disable=SC2012
GOT=$(ls "$OS/remote/postdelegate-backups/postiz" | sed -n 's/\.tar\.age$//p' | sort | tr '\n' ' ' | sed 's/ $//')
eq "exactly the 14 daily + 8 weekly backups remain" "$WANT" "$GOT"
check "newest backup survived" test -f "$OS/remote/postdelegate-backups/postiz/$NEW.tar.age"
check "unrelated objects are never deleted" test -f "$OS/remote/postdelegate-backups/postiz/README-not-a-backup.txt"
eq "no orphan checksum files" 0 "$(for f in "$OS"/remote/postdelegate-backups/postiz/*.sha256; do [ -f "${f%.sha256}" ] || echo orphan; done | wc -l | tr -d ' ')"

echo "-- failure modes (each must exit non-zero and alert)"
: > "$FAKE_LOG"
reset_remote
eq "size mismatch after upload is caught" 1 "$(run_offsite STUB_CORRUPT=1)"
check "size mismatch is explained" grep -q 'size mismatch' "$OS/last.err"
eq "a failure alert was sent" 1 "$(hook_count)"
check "alert says FAILED" grep -q 'FAILED' <<< "$(last_hook)"
reset_remote
eq "read-back checksum mismatch is caught" 1 "$(run_offsite STUB_FLIP=1)"
check "checksum mismatch is explained" grep -q 'read-back checksum' "$OS/last.err"
check "no marker after a failed upload" test ! -e "$OS/state/offsite-last-success"
reset_remote
eq "unreachable bucket fails" 1 "$(run_offsite STUB_RCLONE_DOWN=1)"
check "temporary files are cleaned up" bash -c "! ls '$OS/state' | grep -q '^offsite\\.'"

OLDSTAMP=$(date -u -v-3d +%Y%m%dT%H%M%SZ 2> /dev/null || date -u -d '-3 days' +%Y%m%dT%H%M%SZ)
rm -rf "${OS:?}/backups"/*
make_real_snapshot "$OLDSTAMP"
reset_remote
eq "stale newest snapshot uploads but exits non-zero" 1 "$(run_offsite)"
check "stale snapshot explained" grep -q 'not running' "$OS/last.err"
check "stale snapshot was still copied off-site" test -f "$OS/remote/postdelegate-backups/postiz/$OLDSTAMP.tar.age"

rm -rf "${OS:?}/backups"/*
make_real_snapshot "$NEW"
echo corrupt >> "$OS/backups/$NEW/postiz.dump"
reset_remote
eq "corrupt local snapshot is refused" 1 "$(run_offsite)"
check "corrupt snapshot explained" grep -q 'checksum' "$OS/last.err"
check "nothing uploaded from a corrupt snapshot" test ! -e "$OS/remote/postdelegate-backups/postiz/$NEW.tar.age"

rm -rf "${OS:?}/backups"/*
mkdir -p "$OS/backups/$NEW"
reset_remote
eq "incomplete snapshot (no SHA256SUMS) is ignored" 1 "$(run_offsite)"
check "reports no complete snapshot" grep -q 'no complete snapshot' "$OS/last.err"
rm -rf "${OS:?}/backups"/*
make_real_snapshot "$NEW"

echo "-- configuration guards"
write_env nashr-production-media
eq "media bucket is refused" 1 "$(run_offsite)"
write_env postdelegate-backups AGE-SECRET-KEY-1ABCDEF
eq "private age key is refused" 1 "$(run_offsite)"
write_env
chmod 644 "$OS/etc/backup-r2.env"
eq "world-readable env file is refused" 1 "$(run_offsite)"
write_env
sed -i.bak 's/^BACKUP_R2_ACCESS_KEY_ID=.*/BACKUP_R2_ACCESS_KEY_ID=mediakeyid/' "$OS/etc/backup-r2.env"
eq "reusing the media token is refused" 1 "$(run_offsite)"
write_env
sed -i.bak '/^AGE_RECIPIENT/d' "$OS/etc/backup-r2.env"
eq "missing AGE_RECIPIENT is refused" 1 "$(run_offsite)"
write_env
eq "valid configuration works again" 0 "$(run_offsite)"

# ------------------------------------------------------------ install script
echo "== install-ops.sh (DESTDIR staging)"
IN=$WORK/install
mkdir -p "$IN/stubs" "$IN/root/usr/local/bin" "$IN/root/etc/postiz"
for t in age rclone docker flock; do printf '#!/bin/sh\nexit 0\n' > "$IN/stubs/$t"; chmod +x "$IN/stubs/$t"; done
printf '#!/bin/sh\n' > "$IN/root/usr/local/bin/postiz-compose"
printf '#!/bin/sh\n' > "$IN/root/usr/local/bin/backup-postiz"
chmod +x "$IN/root/usr/local/bin/postiz-compose" "$IN/root/usr/local/bin/backup-postiz"
echo "MAIN_URL=x" > "$IN/root/etc/postiz/runtime.env"
run_install() { env DESTDIR="$IN/root" PATH="$IN/stubs:$PATH" "$DEPLOY/install-ops.sh" "$@" > "$IN/out.txt" 2>&1; echo $?; }
eq "refuses without env files" 1 "$(run_install)"
check "names the missing env files" grep -q 'backup-r2.env' "$IN/out.txt"
check "tells how to create them" grep -q -- '--init-env' "$IN/out.txt"
eq "--init-env succeeds" 0 "$(run_install --init-env)"
eq "env templates are 0600" "600 600" "$(for f in backup-r2.env alerts.env; do mode_of "$IN/root/etc/postiz/$f"; done | tr '\n' ' ' | sed 's/ $//')"
eq "refuses while placeholders remain" 1 "$(run_install)"
check "reports placeholder keys" grep -q 'BACKUP_R2_SECRET_ACCESS_KEY' "$IN/out.txt"
sed -i.bak "s/^BACKUP_R2_ACCOUNT_ID=.*/BACKUP_R2_ACCOUNT_ID=$ACCOUNT/;s/^BACKUP_R2_ACCESS_KEY_ID=.*/BACKUP_R2_ACCESS_KEY_ID=k/;s/^BACKUP_R2_SECRET_ACCESS_KEY=.*/BACKUP_R2_SECRET_ACCESS_KEY=s/;s/^AGE_RECIPIENT=.*/AGE_RECIPIENT=AGE-SECRET-KEY-1XYZ/" "$IN/root/etc/postiz/backup-r2.env"
sed -i.bak "s#^ALERT_WEBHOOK_URL=.*#ALERT_WEBHOOK_URL=https://ntfy.sh/x#" "$IN/root/etc/postiz/alerts.env"
eq "refuses a private age key" 1 "$(run_install)"
check "explains the private key problem" grep -q 'PRIVATE' "$IN/out.txt"
sed -i.bak "s/^AGE_RECIPIENT=.*/AGE_RECIPIENT=$RECIPIENT/" "$IN/root/etc/postiz/backup-r2.env"
eq "--check passes with a complete configuration" 0 "$(run_install --check)"
eq "install succeeds" 0 "$(run_install)"
for f in usr/local/bin/offsite-backup-postiz usr/local/bin/postiz-healthcheck usr/local/lib/postiz-ops/ops-lib.sh \
    etc/systemd/system/postiz-offsite-backup.timer etc/systemd/system/postiz-offsite-backup.service \
    etc/systemd/system/postiz-healthcheck.timer etc/systemd/system/postiz-healthcheck.service; do
    check "installed $f" test -s "$IN/root/$f"
done
eq "scripts are 0700" "700 700" "$(for f in offsite-backup-postiz postiz-healthcheck; do mode_of "$IN/root/usr/local/bin/$f"; done | tr '\n' ' ' | sed 's/ $//')"
eq "install is idempotent" 0 "$(run_install)"
eq "--allow-no-webhook works without alerts.env" 0 "$(rm "$IN/root/etc/postiz/alerts.env"; run_install --allow-no-webhook)"

echo
printf '%s passed, %s failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
