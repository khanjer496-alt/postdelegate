// Diagnostic-only: no Astro build, release artifact, bindings or production request.
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { get } from 'node:http';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { inspectRuntime } from './preview-runtime-diagnostics.mjs';

const LIMIT = 64 * 1024;
// Literal signatures from official workers-sdk tag wrangler@4.162.0:
// src/pages/dev.ts, pages/functions/buildWorker.ts, core/handle-errors.ts;
// miniflare/src/runtime/index.ts. No regex capture or ANSI transformation.
const SIGNATURES = [
  ['worker-import-blocked', '_worker.js is not being bundled by Wrangler'],
  ['worker-build-failed', 'Failed to build _worker.js.'],
  ['routes-invalid', 'Invalid _routes.json file found at:'],
  ['routes-pipeline-failed', 'Could not validate _routes.json at'],
  ['serve-target-conflict', 'Cannot specify both a directory and a proxy command.'],
  ['raw-mode-unsupported', "This terminal doesn't support raw mode."],
  ['runtime-start-failed', 'The Workers runtime failed to start.'],
  ['address-in-use', 'Address already in use'],
  ['default-date-warning', 'No compatibility_date was specified.'],
  ['worker-compiled-marker', 'Compiled Worker successfully'],
];
export function classify(bytes) {
  const prefix = bytes.subarray(0, LIMIT);
  const categories = SIGNATURES.filter(([, literal]) => prefix.includes(Buffer.from(literal))).map(([label]) => label);
  return { scannedBytes: prefix.length, outputTruncated: bytes.length > LIMIT,
    categories: categories.length ? categories : ['unclassified-output'] };
}
const errorClass = (error) => ['ENOENT', 'EACCES', 'EPERM', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'].includes(error?.code)
  ? error.code : 'other-error';
const signalClass = (signal) => ['SIGTERM', 'SIGKILL', 'SIGABRT', 'SIGSEGV'].includes(signal) ? signal : signal ? 'other-signal' : null;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function request() {
  return new Promise((resolve) => {
    const req = get('http://127.0.0.1:8789/alternatives', { headers: { 'User-Agent': 'startup-probe-v1' } }, (response) => {
      response.resume(); // Never execute scripts, follow redirects or retain body/headers.
      resolve({ status: response.statusCode, errorClass: null });
    });
    req.setTimeout(1000, () => req.destroy(Object.assign(new Error(), { code: 'ETIMEDOUT' })));
    req.on('error', (error) => resolve({ status: null, errorClass: errorClass(error) }));
  });
}

export async function runCase(command, flags, cwd, dependencies = {}) {
  const { launch = spawn, probe = request, kill = process.kill, wait = delay,
    now = () => performance.now(), timeoutMs = 25000, cleanupMs = 1000 } = dependencies;
  const start = now();
  const child = launch(command, flags, { cwd, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let exited = false, exitCode = null, signal = null, spawnErrorClass = null, exitAt = null;
  let output = Buffer.alloc(0), receivedBytes = 0;
  let notifyExit;
  const exit = new Promise((resolve) => { notifyExit = resolve; });
  const retain = (chunk) => {
    receivedBytes += chunk.length;
    if (output.length < LIMIT) output = Buffer.concat([output, chunk.subarray(0, LIMIT - output.length)]);
  };
  child.stdout?.on('data', retain);
  child.stderr?.on('data', retain);
  child.on('exit', (code, exitSignal) => {
    exited = true; exitCode = Number.isInteger(code) ? code : null; signal = signalClass(exitSignal);
    exitAt = Math.round(now() - start); notifyExit();
  });
  child.on('error', (error) => { spawnErrorClass = errorClass(error); notifyExit(); });
  const outcomes = [];
  let listening = false, probeErrorClass = null;
  try {
    while (!exited && !spawnErrorClass && now() - start < timeoutMs) {
      const outcome = await probe();
      if (outcomes.length < 100) outcomes.push(outcome);
      if (outcome.status === 200) { listening = true; break; }
      await Promise.race([wait(200), exit]);
    }
  } catch (error) {
    probeErrorClass = errorClass(error);
  } finally {
    const beforeCleanup = { alive: !exited && !spawnErrorClass, exitCode, signal };
    const cleanupErrors = [];
    const send = (name) => {
      try { if (child.pid) kill(-child.pid, name); } catch (error) {
        if (error.code !== 'ESRCH') cleanupErrors.push(errorClass(error));
      }
    };
    // Even an exited wrapper may have surviving children in its process group.
    send('SIGTERM');
    await Promise.race([wait(cleanupMs), exit]);
    send('SIGKILL');
    if (!exited && !spawnErrorClass) await Promise.race([wait(cleanupMs), exit]);
    const scan = classify(output);
    scan.outputTruncated = receivedBytes > LIMIT;
    return { synthetic: true, diagnosticOnly: true, releasable: false,
      configuredFlags: flags.map((value) => value === join(cwd, 'payload') ? '<synthetic-payload>' : value),
      pid: child.pid ?? null, beforeCleanup, aliveAfterCleanup: !exited && !spawnErrorClass,
      finalExitCode: exitCode, finalSignal: signal, probeErrorClass,
      spawnErrorClass, exitAfterMs: exitAt, durationMs: Math.round(now() - start),
      outcome: listening ? 'synthetic-route-responded' : spawnErrorClass ? 'spawn-error'
        : probeErrorClass ? 'probe-error' : beforeCleanup.alive ? 'readiness-timeout' : 'process-exited',
      loopbackRequestOutcomes: outcomes, cleanupErrorClasses: [...new Set(cleanupErrors)], ...scan };
  }
}

async function main() {
  if (process.env.GITHUB_ACTIONS !== 'true') throw new Error('Startup probe is hosted-only');
  const [cliDir, stage, source, output] = process.argv.slice(2);
  const checkoutSha = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (!/^[0-9a-f]{40}$/.test(checkoutSha) || checkoutSha !== process.env.GITHUB_SHA) throw new Error('Source identity mismatch');
  const root = createRequire(join(cliDir, 'package.json'));
  const wranglerPackage = root.resolve('wrangler/package.json');
  const observedWranglerVersion = JSON.parse(readFileSync(wranglerPackage, 'utf8')).version;
  if (observedWranglerVersion !== '4.162.0') throw new Error('Pinned CLI identity mismatch');
  const wrangler = createRequire(wranglerPackage);
  const miniflare = createRequire(wrangler.resolve('miniflare/package.json'));
  const workerdPackage = miniflare.resolve('workerd/package.json');
  const native = createRequire(workerdPackage).resolve('@cloudflare/workerd-linux-64/bin/workerd');
  const identities = {};
  for (const file of ['site/functions/_middleware.ts', 'site/functions/docs/_middleware.ts',
    'site/public/_routes.json', 'site/public/_headers', 'site/public/_redirects']) {
    identities[file] = sha256(readFileSync(join(source, file)));
  }
  for (const control of ['_routes.json', '_headers', '_redirects']) {
    if (sha256(readFileSync(join(stage, 'payload', control))) !== identities['site/public/' + control]) {
      throw new Error('Control identity mismatch');
    }
  }
  const result = { schemaVersion: 1, synthetic: true, diagnosticOnly: true, releasable: false,
    repository: 'khanjer496-alt/postdelegate', sourceSha: checkoutSha,
    configuredWranglerVersion: '4.162.0', observedWranglerVersion, sourceFileSha256: identities,
    pinnedSourceDefaultCompatibilityDate: '2026-11-13', configuredCompatibilityFlags: [],
    equivalenceControlDate: '2026-09-08',
    compiledWorkerSha256: sha256(readFileSync(join(stage, 'payload/_worker.js'))),
    nativeSha256: sha256(readFileSync(native)), workerdPackageSha256: sha256(readFileSync(workerdPackage)),
    nativeDiagnostics: inspectRuntime(cliDir), cases: [] };
  const command = join(cliDir, 'node_modules/.bin/wrangler');
  const original = ['pages', 'dev', join(stage, 'payload'), '--no-bundle', '--ip', '127.0.0.1', '--port', '8789'];
  // Default first; the second changes only compatibility date to observed production equivalence.
  for (const [name, flags] of [['original-default', original],
    ['production-date-equivalence', [...original, '--compatibility-date', '2026-09-08']]]) {
    const current = { name, ...await runCase(command, flags, stage) };
    current.sourceControlsUnchanged = ['_routes.json', '_headers', '_redirects'].every((control) =>
      sha256(readFileSync(join(stage, 'payload', control))) === identities['site/public/' + control]);
    result.cases.push(current);
    writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
