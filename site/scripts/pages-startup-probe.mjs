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
  // Pinned Miniflare runtime/index.ts and runtime/structured-logs.ts failure boundaries.
  ['runtime-stderr-present', 'Runtime stderr:'],
  ['native-uncaught-exception', '*** Uncaught exception'],
  ['native-fatal-uncaught', '*** Fatal uncaught'],
  ['native-terminate', '*** std::terminate()'],
  ['native-signal-banner', '*** Received signal'],
  ['native-bind-error', 'bind():'],
  ['native-access-violation', 'access violation;'],
  // Fixed standard OS/ECMAScript/CLI class labels only, never following values/paths.
  ['permission-denied', 'Permission denied'],
  ['operation-not-permitted', 'Operation not permitted'],
  ['address-not-available', 'Cannot assign requested address'],
  ['address-family-unsupported', 'Address family not supported'],
  ['missing-native-library', 'error while loading shared libraries'],
  ['js-reference-error', 'ReferenceError:'],
  ['js-type-error', 'TypeError:'],
  ['js-syntax-error', 'SyntaxError:'],
  ['cli-unexpected-argument', 'unexpected argument'],
  ['native-worker-start-error', 'Failed to start Worker:'],
  ['native-invalid-config', 'config is invalid'],
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
    const wrapperBeforeCleanup = { exitObserved: exited, exitCode, signal, spawnErrorClass };
    const cleanupErrors = [];
    const groupState = () => {
      if (!child.pid) return { state: 'unknown', errorClass: 'missing-pid' };
      try { kill(-child.pid, 0); return { state: 'present', errorClass: null }; } catch (error) {
        if (error.code === 'ESRCH') return { state: 'absent', errorClass: null };
        return { state: 'unknown', errorClass: errorClass(error) };
      }
    };
    const send = (name) => {
      try { kill(-child.pid, name); return null; } catch (error) {
        if (error.code === 'ESRCH') return null;
        const category = errorClass(error);
        cleanupErrors.push(category);
        return category;
      }
    };
    const waitForGroup = async () => {
      const deadline = now() + cleanupMs;
      let state = groupState();
      while (state.state === 'present' && now() < deadline) {
        await wait(Math.min(50, deadline - now()));
        state = groupState();
      }
      return state;
    };
    // Wrapper exit is not evidence that its process group or descendants disappeared.
    const processGroupBeforeCleanup = groupState();
    let processGroupAfterCleanup = processGroupBeforeCleanup;
    for (const name of ['SIGTERM', 'SIGKILL']) {
      if (processGroupAfterCleanup.state !== 'present') break;
      const failure = send(name);
      processGroupAfterCleanup = failure ? { state: 'unknown', errorClass: failure } : await waitForGroup();
      // A permission/unknown result is unresolved: do not escalate past that refusal.
    }
    const scan = classify(output);
    scan.outputTruncated = receivedBytes > LIMIT;
    return { synthetic: true, diagnosticOnly: true, releasable: false,
      configuredFlags: flags.map((value) => value === join(cwd, 'payload') ? '<synthetic-payload>' : value),
      pid: child.pid ?? null, wrapperBeforeCleanup,
      wrapperAfterCleanup: { exitObserved: exited, exitCode, signal, spawnErrorClass },
      processGroupBeforeCleanup, processGroupAfterCleanup,
      finalExitCode: exitCode, finalSignal: signal, probeErrorClass,
      spawnErrorClass, exitAfterMs: exitAt, durationMs: Math.round(now() - start),
      outcome: listening ? 'synthetic-route-responded' : spawnErrorClass ? 'spawn-error'
        : probeErrorClass ? 'probe-error' : wrapperBeforeCleanup.exitObserved ? 'process-exited' : 'readiness-timeout',
      loopbackRequestOutcomes: outcomes, cleanupErrorClasses: [...new Set(cleanupErrors)], ...scan };
  }
}

export async function runCases(definitions, execute, persist) {
  const partial = { cases: [], suppressedCases: [] };
  for (let index = 0; index < definitions.length; index++) {
    const [name, flags] = definitions[index];
    const current = { name, ...await execute(flags) };
    partial.cases.push(current);
    if (current.processGroupAfterCleanup.state !== 'absent' || current.cleanupErrorClasses.length) {
      partial.suppressedCases = definitions.slice(index + 1).map(([remaining]) =>
        ({ name: remaining, reason: 'prior-process-group-not-confirmed-absent' }));
      persist(partial);
      break;
    }
    persist(partial);
  }
  return partial;
}

async function main() {
  if (process.env.GITHUB_ACTIONS !== 'true') throw new Error('Startup probe is hosted-only');
  const [cliDir, stage, source, output] = process.argv.slice(2);
  const checkoutSha = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (!/^[0-9a-f]{40}$/.test(checkoutSha) || checkoutSha !== process.env.GITHUB_SHA) throw new Error('Source identity mismatch');
  const prior = JSON.parse(readFileSync(join(stage, 'diagnostics/worker-build.json')));
  const workerHash = sha256(readFileSync(join(stage, 'payload/_worker.js')));
  if (prior.sourceSha !== checkoutSha || prior.workerUnchanged !== true || prior.compiledWorkerSha256 !== workerHash
      || prior.checkRawWorkerEquivalent?.status !== 'succeeded' || prior.metadataAnalysis?.status !== 'succeeded') {
    throw new Error('Typed check failed or changed input; no startup authorized');
  }
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
  // One corrected-raw case only; the older default-date comparison is not repeated.
  await runCases([['corrected-raw-production-equivalence', [...original, '--compatibility-date', '2026-09-08']]], async (flags) => {
    const current = await runCase(command, flags, stage);
    current.sourceControlsUnchanged = ['_routes.json', '_headers', '_redirects'].every((control) =>
      sha256(readFileSync(join(stage, 'payload', control))) === identities['site/public/' + control]);
    return current;
  }, (partial) => writeFileSync(output, JSON.stringify({ ...result, ...partial }, null, 2) + '\n'));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
