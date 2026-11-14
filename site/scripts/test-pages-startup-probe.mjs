// Small fake lifecycle checks: no native runtime, CLI, network, install or process signals.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { classify, runCase } from './pages-startup-probe.mjs';

const marker = Buffer.from('private token=hidden Failed to build _worker.js. private trailer');
assert.deepEqual(classify(marker).categories, ['worker-build-failed']);
assert(!JSON.stringify(classify(marker)).includes('private'));
const overflow = Buffer.concat([Buffer.alloc(65536, 'x'), marker]);
assert.equal(classify(overflow).scannedBytes, 65536);
assert.equal(classify(overflow).outputTruncated, true);
assert.deepEqual(classify(overflow).categories, ['unclassified-output']);
assert.deepEqual(classify(Buffer.from('Failed\u001b[31m to build _worker.js.')).categories, ['unclassified-output']);
for (const [literal, category] of [
  ['The Workers runtime failed to start.', 'runtime-start-failed'],
  ['Invalid _routes.json file found at:', 'routes-invalid'],
  ['_worker.js is not being bundled by Wrangler', 'worker-import-blocked'],
]) assert.deepEqual(classify(Buffer.from(literal)).categories, [category]);

function fixture(kind) {
  const child = new EventEmitter();
  child.pid = kind === 'spawn-error' ? undefined : 12345;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  let clock = 0;
  const signals = [];
  const dependencies = {
    launch: () => {
      queueMicrotask(() => {
        child.stderr.emit('data', marker);
        if (kind === 'exit') child.emit('exit', 1, null);
        if (kind === 'spawn-error') child.emit('error', { code: 'EPERM', message: 'private error' });
      });
      return child;
    },
    probe: async () => ({ status: kind === 'listening' ? 200 : null, errorClass: kind === 'listening' ? null : 'ECONNREFUSED' }),
    kill: (pid, signal) => { signals.push([pid, signal]); child.emit('exit', null, signal); },
    wait: async (ms) => { clock += ms; }, now: () => clock, timeoutMs: 250, cleanupMs: 1,
  };
  return { dependencies, signals };
}
for (const [kind, expected] of [['exit', 'process-exited'], ['listening', 'synthetic-route-responded'],
  ['timeout', 'readiness-timeout'], ['spawn-error', 'spawn-error']]) {
  const { dependencies, signals } = fixture(kind);
  const result = await runCase('/synthetic/wrangler', ['pages', 'dev', '/synthetic/payload'], '/synthetic', dependencies);
  assert.equal(result.outcome, expected);
  assert.equal(result.releasable, false);
  assert(result.durationMs < 2000);
  assert(!JSON.stringify(result).includes('private'));
  if (kind === 'exit') assert.equal(result.beforeCleanup.exitCode, 1);
  if (kind === 'spawn-error') assert.equal(result.spawnErrorClass, 'EPERM');
  else assert.deepEqual(signals.map(([, signal]) => signal), ['SIGTERM', 'SIGKILL']);
}
console.log('PASS: bounded literal-only classifier; early exit/listening/timeout/EPERM lifecycle; fake processes only.');
