// Tiny installed-package fixture; fake spawn means no native runtime or CLI runs locally.
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectRuntime } from './preview-runtime-diagnostics.mjs';

const fixture = mkdtempSync(join(tmpdir(), 'site-runtime-diagnostics-'));
try {
  writeFileSync(join(fixture, 'package.json'), '{}');
  const calls = [];
  const fakeSpawn = (command, flags, options) => {
    calls.push({ command, flags, timeout: options.timeout });
    return command === 'pnpm' ? { stdout: 'undefined\n', status: 0 }
      : { stdout: 'workerd 2026-11-15 private runtime text', status: 0 };
  };
  const absent = inspectRuntime(fixture, fakeSpawn);
  assert.equal(absent.resolution, 'MODULE_NOT_FOUND');
  assert.equal(absent.nativeExists, false);
  assert.equal(absent.projectManifestPolicy.hasOnlyBuiltDependencies, false);
  for (const name of ['wrangler', 'miniflare', 'workerd', '@cloudflare/workerd-linux-64']) {
    const directory = join(fixture, 'node_modules', name);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ name, version: '1.20261115.0' }));
  }
  const native = join(fixture, 'node_modules/@cloudflare/workerd-linux-64/bin/workerd');
  mkdirSync(join(native, '..'), { recursive: true });
  writeFileSync(native, 'synthetic, never executed');
  chmodSync(native, 0o755);
  const present = inspectRuntime(fixture, fakeSpawn);
  assert.equal(present.resolution, 'resolved');
  assert.equal(present.nativeExecutable, true);
  assert.equal(present.nativeVersion, '2026-11-15');
  assert.equal(present.nativeExitCode, 0);
  assert(!JSON.stringify(present).includes('private'));
  const denied = inspectRuntime(fixture, (command) => command === 'pnpm'
    ? { stdout: 'false', status: 0 } : { status: null, error: { code: 'EPERM', message: 'private error' } });
  assert.equal(denied.nativeSpawnErrorClass, 'EPERM');
  assert(!JSON.stringify(denied).includes('private'));
  assert(calls.every(({ timeout }) => timeout === 5000));
  console.log('PASS: missing/present native runtime and denied spawn diagnostics; fixed policy/version fields; no native spawn.');
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
