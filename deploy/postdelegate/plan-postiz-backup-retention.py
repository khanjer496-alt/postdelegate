#!/usr/bin/env python3
"""Draft four-day Postiz retention planner. It never removes or changes files."""
import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys

RETENTION_DAYS = 4
RECENT_BACKUP_HOURS = 36
STAMP = re.compile(r'^\d{8}T\d{6}Z$')
DUMPS = {'postiz.dump', 'temporal.dump', 'temporal-visibility.dump'}
REQUIRED = DUMPS | {'SHA256SUMS', 'configuration', 'compose.yaml', 'Caddyfile', 'dynamicconfig'}
ALLOWED = REQUIRED | {'legal-public'}


class PlanError(ValueError):
    pass


def _private_directory(path):
    info = path.lstat()
    return stat.S_ISDIR(info.st_mode) and not info.st_mode & 0o077 and info.st_uid in {0, os.geteuid()}


def _check_root(root):
    if not root.is_absolute() or '..' in root.parts or root.name != 'postiz':
        raise PlanError('An absolute, dedicated Postiz backup root named postiz is required.')
    for part in [root, *root.parents]:
        if part.is_symlink():
            raise PlanError('The backup root and its parents must not be symlinks.')
    if not _private_directory(root):
        raise PlanError('The backup root must be an owner-only directory owned by root or the caller.')


def _sha256(path):
    with path.open('rb') as handle:
        if handle.read(5) != b'PGDMP':
            raise PlanError('A required dump is not a PostgreSQL custom archive.')
        handle.seek(0)
        digest = hashlib.sha256()
        for block in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(block)
        return digest.hexdigest()


def _check_snapshot(snapshot):
    if snapshot.is_symlink() or not _private_directory(snapshot):
        raise PlanError('Snapshot must be an owner-only directory, not a symlink.')
    names = {entry.name for entry in snapshot.iterdir()}
    if not REQUIRED <= names or not names <= ALLOWED:
        raise PlanError('Snapshot contents do not match the Postiz backup layout.')
    for directory, directories, files in os.walk(snapshot, followlinks=False):
        for name in directories + files:
            entry = Path(directory) / name
            mode = entry.lstat().st_mode
            if stat.S_ISLNK(mode) or not (stat.S_ISDIR(mode) or stat.S_ISREG(mode)):
                raise PlanError('Snapshot contains a symlink or unsupported filesystem entry.')
    if not _private_directory(snapshot / 'configuration'):
        raise PlanError('Protected configuration directory is not owner-only.')
    if not (snapshot / 'dynamicconfig').is_dir():
        raise PlanError('Snapshot dynamic configuration is missing.')
    for name in DUMPS | {'SHA256SUMS'}:
        info = (snapshot / name).lstat()
        if not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077:
            raise PlanError('Dump files and checksum manifest must be owner-only regular files.')
    expected = {}
    for line in (snapshot / 'SHA256SUMS').read_text(encoding='utf-8').splitlines():
        pieces = line.split(maxsplit=1)
        if len(pieces) != 2 or not re.fullmatch('[a-fA-F0-9]{64}', pieces[0]):
            raise PlanError('Checksum manifest is malformed.')
        filename = Path(pieces[1].lstrip('*'))
        if filename.name not in DUMPS or filename.name in expected:
            raise PlanError('Checksum manifest does not describe exactly the three Postiz dumps.')
        if filename.is_absolute():
            if filename.parent != snapshot:
                raise PlanError('Checksum manifest refers outside this snapshot.')
        elif filename.parts != (filename.name,):
            raise PlanError('Checksum manifest refers outside this snapshot.')
        expected[filename.name] = pieces[0].lower()
    if set(expected) != DUMPS:
        raise PlanError('Checksum manifest is incomplete.')
    for name in DUMPS:
        if _sha256(snapshot / name) != expected[name]:
            raise PlanError('Snapshot checksum verification failed.')


def plan_retention(root, now=None):
    root = Path(root)
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        raise PlanError('A timezone-aware UTC clock is required.')
    now = now.astimezone(timezone.utc)
    _check_root(root)
    cutoff = now - timedelta(days=RETENTION_DAYS)
    eligible = []
    retained = []
    blocked = []
    ignored = 0
    recognized = []
    for snapshot in sorted(root.iterdir(), key=lambda entry: entry.name):
        if not STAMP.fullmatch(snapshot.name):
            ignored += 1
            continue
        try:
            stamp_time = datetime.strptime(snapshot.name, '%Y%m%dT%H%M%SZ').replace(tzinfo=timezone.utc)
        except ValueError:
            ignored += 1
            continue
        try:
            _check_snapshot(snapshot)
            if stamp_time > now:
                raise PlanError('Future snapshot timestamp requires operator review.')
            recognized.append(stamp_time)
            (eligible if stamp_time < cutoff else retained).append(snapshot.name)
        except (OSError, UnicodeError, PlanError) as error:
            reason = str(error) if isinstance(error, PlanError) else 'Snapshot could not be safely inspected.'
            blocked.append({'stamp': snapshot.name, 'reason': reason})
    result = {
        'mode': 'DRY-RUN',
        'backup_root': str(root),
        'retention_days': RETENTION_DAYS,
        'cutoff_utc': cutoff.isoformat(),
        'eligible_snapshots': eligible,
        'retained_snapshots': retained,
        'blocked_snapshots': blocked,
        'ignored_entries': ignored,
    }
    if blocked:
        result['guard_error'] = 'Unsafe snapshots require operator review; retain everything until the guard is resolved.'
    if not recognized or max(recognized) < now - timedelta(hours=RECENT_BACKUP_HOURS):
        result['guard_error'] = 'No recent recognized snapshot exists; retain everything and investigate the backup timer.'
    if result.get('guard_error'):
        result['retained_snapshots'] = sorted(retained + eligible)
        result['eligible_snapshots'] = []
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backup-root', default='/var/backups/postiz', help='Dedicated, owner-only Postiz backup directory')
    args = parser.parse_args(argv)
    try:
        result = plan_retention(Path(args.backup_root))
    except (OSError, PlanError) as error:
        message = str(error) if isinstance(error, PlanError) else 'Backup root could not be safely inspected.'
        print(json.dumps({'mode': 'DRY-RUN', 'error': message}), file=sys.stderr)
        return 2
    print(json.dumps(result, indent=2))
    return 2 if result.get('guard_error') or result['blocked_snapshots'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
