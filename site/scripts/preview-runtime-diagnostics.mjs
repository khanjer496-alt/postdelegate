// Hosted-only inspection; never changes install policy or preview flags.
import { accessSync, constants, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function inspectRuntime(cliDir, run = spawnSync) {
  const result = { schemaVersion: 1, releasable: false, nativeExists: false, nativeExecutable: false,
    nativeExitCode: null, nativeSignal: null, nativeVersion: null, nativeSpawnErrorClass: null };
  const manifest = JSON.parse(readFileSync(join(cliDir, 'package.json'), 'utf8'));
  const policy = manifest.pnpm ?? {};
  result.projectManifestPolicy = {
    hasOnlyBuiltDependencies: Array.isArray(policy.onlyBuiltDependencies),
    explicitlyAllowsWorkerd: policy.onlyBuiltDependencies?.includes('workerd') === true,
    explicitlyIgnoresWorkerd: policy.ignoredBuiltDependencies?.includes('workerd') === true,
    interpretation: 'project-manifest-only; absence does not prove scripts were blocked',
  };
  const config = run('pnpm', ['config', 'get', 'ignore-scripts'], { cwd: cliDir, timeout: 5000, encoding: 'utf8' });
  const setting = config.stdout?.trim();
  result.observedIgnoreScripts = config.status === 0 && ['true', 'false', 'undefined'].includes(setting) ? setting : 'unknown';
  try {
    const root = createRequire(join(cliDir, 'package.json'));
    const wrangler = createRequire(root.resolve('wrangler/package.json'));
    const miniflare = createRequire(wrangler.resolve('miniflare/package.json'));
    const workerd = miniflare.resolve('workerd/package.json');
    const version = JSON.parse(readFileSync(workerd, 'utf8')).version;
    result.workerdPackageVersion = /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(version) ? version : null;
    const native = createRequire(workerd).resolve('@cloudflare/workerd-linux-64/bin/workerd');
    result.nativeExists = existsSync(native);
    try { accessSync(native, constants.X_OK); result.nativeExecutable = true; } catch (error) {
      result.nativeAccessErrorClass = ['ENOENT', 'EACCES', 'EPERM'].includes(error.code) ? error.code : 'other-error';
    }
    if (result.nativeExecutable) {
      const probe = run(native, ['--version'], { timeout: 5000, encoding: 'utf8' });
      result.nativeExitCode = Number.isInteger(probe.status) ? probe.status : null;
      result.nativeSignal = ['SIGABRT', 'SIGSEGV', 'SIGKILL', 'SIGTERM'].includes(probe.signal)
        ? probe.signal : probe.signal ? 'other-signal' : null;
      result.nativeSpawnErrorClass = probe.error
        ? ['ENOENT', 'EACCES', 'EPERM', 'ETIMEDOUT'].includes(probe.error.code) ? probe.error.code : 'other-error'
        : null;
      result.nativeVersion = /\bworkerd\s+(\d{4}-\d{2}-\d{2}|\d+(?:\.\d+)*)\b/.exec(probe.stdout ?? '')?.[1] ?? null;
    }
    result.resolution = 'resolved';
  } catch (error) {
    result.resolution = ['MODULE_NOT_FOUND', 'ERR_PACKAGE_PATH_NOT_EXPORTED', 'EACCES', 'EPERM'].includes(error.code)
      ? error.code : 'other-error';
  }
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.env.GITHUB_ACTIONS !== 'true') throw new Error('Runtime inspection is hosted-only');
  // Only booleans, fixed enums, numeric statuses and parsed public versions are exported.
  let diagnostic;
  try { diagnostic = inspectRuntime(process.argv[2]); } catch (error) {
    diagnostic = { schemaVersion: 1, releasable: false, inspectionFailureClass:
      ['ENOENT', 'EACCES', 'EPERM'].includes(error.code) ? error.code : 'other-error' };
  }
  writeFileSync(process.argv[3], JSON.stringify(diagnostic, null, 2) + '\n');
}
