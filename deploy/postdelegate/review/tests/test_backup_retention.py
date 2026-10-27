"""Local planner tests only. No apply mode, production access or file deletion."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timezone

SCRIPT = Path(__file__).resolve().parents[2] / 'plan-postiz-backup-retention.py'
SPEC = importlib.util.spec_from_file_location('postiz_backup_retention', SCRIPT)
planner = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(planner)
NOW = datetime(2026, 10, 27, 12, tzinfo=timezone.utc)

class RetentionPlanTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        # macOS /var is itself a symlink; use the real temporary parent so
        # ordinary fixtures satisfy the planner's deliberately strict guard.
        self.root = Path(self.temp.name).resolve() / 'postiz'
        self.root.mkdir(mode=0o700)
        self.addCleanup(self.temp.cleanup)

    def snapshot(self, stamp, *, absolute_manifest=False):
        target = self.root / stamp
        target.mkdir(mode=0o700)
        (target / 'configuration').mkdir(mode=0o700)
        (target / 'dynamicconfig').mkdir(mode=0o700)
        for filename in ['compose.yaml', 'Caddyfile']:
            (target / filename).write_text('synthetic fixture\n')
        manifest = []
        for name in ['postiz.dump', 'temporal.dump', 'temporal-visibility.dump']:
            data = b'PGDMP' + name.encode()
            (target / name).write_bytes(data)
            (target / name).chmod(0o600)
            manifest.append(f'{hashlib.sha256(data).hexdigest()}  {target / name if absolute_manifest else name}\n')
        (target / 'SHA256SUMS').write_text(''.join(manifest))
        (target / 'SHA256SUMS').chmod(0o600)
        return target

    def recent(self):
        return self.snapshot('20261027T022900Z', absolute_manifest=True)

    def test_selects_only_complete_private_snapshots_older_than_four_days(self):
        old = self.snapshot('20261022T000000Z')
        self.recent()
        self.snapshot('20261023T120000Z')  # Exact cutoff stays until next pass.
        self.snapshot('20261024T000000Z')
        plan = planner.plan_retention(self.root, NOW)
        self.assertEqual(plan['mode'], 'DRY-RUN')
        self.assertEqual(plan['retention_days'], 4)
        self.assertEqual(plan['eligible_snapshots'], ['20261022T000000Z'])
        self.assertEqual(plan['blocked_snapshots'], [])
        self.assertTrue(old.is_dir())
        self.assertTrue((old / 'postiz.dump').is_file())

    def test_foreign_names_and_brightbean_archive_are_never_candidates(self):
        self.recent()
        (self.root / 'pre-postiz-20261001T000000Z').mkdir()
        (self.root / 'brightbean-backup.tar.gz').write_bytes(b'foreign')
        (self.root / '20261340T999999Z').mkdir()
        plan = planner.plan_retention(self.root, NOW)
        self.assertEqual(plan['eligible_snapshots'], [])
        self.assertEqual(plan['ignored_entries'], 3)

    def test_symlinks_to_other_backups_and_nested_symlinks_are_blocked(self):
        self.recent()
        external = Path(self.temp.name) / 'foreign'
        external.mkdir()
        (external / 'keep').write_text('foreign data')
        (self.root / '20261020T000000Z').symlink_to(external, target_is_directory=True)
        nested = self.snapshot('20261021T000000Z')
        (nested / 'configuration' / 'outside').symlink_to(external, target_is_directory=True)
        plan = planner.plan_retention(self.root, NOW)
        self.assertEqual(plan['eligible_snapshots'], [])
        self.assertEqual({row['stamp'] for row in plan['blocked_snapshots']}, {'20261020T000000Z', '20261021T000000Z'})
        self.assertEqual((external / 'keep').read_text(), 'foreign data')

    def test_foreign_content_missing_dumps_and_checksum_mismatches_are_blocked(self):
        self.recent()
        foreign = self.snapshot('20261020T000000Z')
        (foreign / 'foreign-archive.zip').write_bytes(b'foreign')
        missing = self.snapshot('20261021T000000Z')
        (missing / 'postiz.dump').unlink()
        corrupt = self.snapshot('20261022T000000Z')
        (corrupt / 'temporal.dump').write_bytes(b'PGDMP changed')
        plan = planner.plan_retention(self.root, NOW)
        self.assertEqual(plan['eligible_snapshots'], [])
        self.assertEqual(len(plan['blocked_snapshots']), 3)

    def test_nonprivate_root_or_snapshot_cannot_be_scheduled_for_removal(self):
        self.recent()
        old = self.snapshot('20261020T000000Z')
        old.chmod(0o755)
        self.assertEqual(planner.plan_retention(self.root, NOW)['eligible_snapshots'], [])
        self.root.chmod(0o755)
        with self.assertRaises(planner.PlanError):
            planner.plan_retention(self.root, NOW)

    def test_nonpostiz_or_symlinked_root_is_rejected(self):
        brightbean = Path(self.temp.name) / 'postdelegate'
        brightbean.mkdir(mode=0o700)
        with self.assertRaises(planner.PlanError):
            planner.plan_retention(brightbean, NOW)
        link_parent = Path(self.temp.name) / 'linked'
        link_parent.symlink_to(self.root, target_is_directory=True)
        with self.assertRaises(planner.PlanError):
            planner.plan_retention(link_parent / 'postiz', NOW)

    def test_stale_or_absent_recent_backup_keeps_everything_and_reports_guard(self):
        old = self.snapshot('20261020T000000Z')
        plan = planner.plan_retention(self.root, NOW)
        self.assertEqual(plan['eligible_snapshots'], [])
        self.assertIn('recent', plan['guard_error'].lower())
        self.assertTrue(old.is_dir())

    def test_future_snapshot_does_not_satisfy_recent_backup_guard(self):
        self.snapshot('20261028T000000Z')
        self.snapshot('20261020T000000Z')
        plan = planner.plan_retention(self.root, NOW)
        self.assertEqual(plan['eligible_snapshots'], [])
        self.assertTrue(plan['guard_error'])

    def test_any_blocked_snapshot_invalidates_all_other_removal_candidates(self):
        self.recent()
        self.snapshot('20261020T000000Z')
        broken = self.snapshot('20261021T000000Z')
        (broken / 'postiz.dump').unlink()
        plan = planner.plan_retention(self.root, NOW)
        self.assertEqual(plan['eligible_snapshots'], [])
        self.assertIn('20261020T000000Z', plan['retained_snapshots'])
        self.assertEqual(len(plan['blocked_snapshots']), 1)
        self.assertTrue(plan['guard_error'])

    def test_cli_is_dry_run_and_does_not_alter_files(self):
        today = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        current = self.snapshot(today)
        old = self.snapshot('20201020T000000Z')
        before = {str(p.relative_to(self.root)): p.read_bytes() for p in self.root.rglob('*') if p.is_file()}
        run = subprocess.run([sys.executable, str(SCRIPT), '--backup-root', str(self.root)], capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertEqual(json.loads(run.stdout)['eligible_snapshots'], ['20201020T000000Z'])
        after = {str(p.relative_to(self.root)): p.read_bytes() for p in self.root.rglob('*') if p.is_file()}
        self.assertEqual(before, after)
        self.assertTrue(current.is_dir() and old.is_dir())

if __name__ == '__main__':
    unittest.main()
