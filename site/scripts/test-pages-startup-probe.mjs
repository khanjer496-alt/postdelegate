// Small fake lifecycle checks: no native runtime, CLI, network, install or process signals.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import * as startup from './pages-startup-probe.mjs';
const { classify, runCase } = startup;

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
  let groupPresent = kind !== 'spawn-error';
  let wrapperExited = false;
  const signals = [];
  const dependencies = {
    launch: () => {
      queueMicrotask(() => {
        child.stderr.emit('data', marker);
        if (kind === 'exit') { wrapperExited = true; child.emit('exit', 1, null); }
        if (kind === 'spawn-error') child.emit('error', { code: 'EPERM', message: 'private error' });
      });
      return child;
    },
    probe: async () => ({ status: kind === 'listening' ? 200 : null, errorClass: kind === 'listening' ? null : 'ECONNREFUSED' }),
    kill: (pid, signal) => {
      if (!groupPresent) throw { code: 'ESRCH' };
      if (signal === 0) return true;
      signals.push([pid, signal]); groupPresent = false;
      if (!wrapperExited) { wrapperExited = true; child.emit('exit', null, signal); }
    },
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
  if (kind === 'exit') assert.equal(result.wrapperBeforeCleanup.exitCode, 1);
  if (kind === 'spawn-error') assert.equal(result.spawnErrorClass, 'EPERM');
  else {
    assert.deepEqual(signals.map(([, signal]) => signal), ['SIGTERM']);
    assert.equal(result.processGroupAfterCleanup.state, 'absent');
  }
}
for (const kind of ['surviving-descendant', 'termination-denied', 'unconfirmed-after-kill']) {
  const { dependencies } = fixture('exit');
  const signals = [];
  let killed = false;
  dependencies.kill = (_pid, signal) => {
    if (signal !== 0) signals.push(signal);
    if (kind === 'termination-denied' && signal !== 0) throw { code: 'EPERM' };
    if (signal === 'SIGKILL') killed = true;
    if (kind === 'unconfirmed-after-kill' && signal === 0 && killed) throw { code: 'EIO' };
    // Group remains present after wrapper exit, including after TERM/KILL.
    return true;
  };
  const result = await runCase('/synthetic/wrangler', ['pages', 'dev', '/synthetic/payload'], '/synthetic', dependencies);
  assert.equal(result.processGroupAfterCleanup.state, kind === 'surviving-descendant' ? 'present' : 'unknown');
  assert.equal(result.wrapperAfterCleanup.exitObserved, true);
  assert.equal(result.wrapperAfterCleanup.exitCode, 1);
  assert(result.durationMs < 2000);
  if (kind === 'termination-denied') assert.deepEqual(signals, ['SIGTERM']);
  let launches = 0, persisted;
  await startup.runCases([['first', []], ['second', []]], async () => { launches++; return result; }, (partial) => { persisted = partial; });
  assert.equal(launches, 1);
  assert.equal(persisted.cases.length, 1);
  assert.equal(persisted.suppressedCases[0].reason, 'prior-process-group-not-confirmed-absent');
}
const { dependencies } = fixture('exit');
let groupGone = false;
dependencies.kill = (_pid, signal) => {
  if (groupGone) throw { code: 'ESRCH' };
  if (signal === 'SIGKILL') groupGone = true;
};
const confirmed = await runCase('/synthetic/wrangler', ['pages', 'dev'], '/synthetic', dependencies);
assert.equal(confirmed.processGroupAfterCleanup.state, 'absent');
let permittedLaunches = 0;
const complete = await startup.runCases([['first', []], ['second', []]], async () => {
  permittedLaunches++; return confirmed;
}, () => {});
assert.equal(permittedLaunches, 2);
assert.deepEqual(complete.suppressedCases, []);
console.log('PASS: bounded classifier/lifecycle; surviving/denied/unconfirmed groups suppress serial launch; fake processes only.');
