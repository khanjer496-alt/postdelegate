// Built-in fake API tests only: never load esbuild or spawn a binary.
import assert from 'node:assert/strict';
import { checkOptions, inspectBuild, sanitizeMessage, topology } from './pages-worker-build-diagnostic.mjs';

const worker = '/synthetic/payload/_worker.js';
const canary = 'PRIVATE_CANARY_do_not_export';
const resolutions = [];
const options = checkOptions(worker, resolutions);
assert.deepEqual(Object.keys(options).sort(), ['bundle', 'entryPoints', 'logLevel', 'plugins', 'write']);
assert.equal(options.bundle, true);
assert.equal(options.write, false);
assert.equal(options.logLevel, 'silent');
let resolveImport;
options.plugins[0].setup({ onResolve: (_options, callback) => { resolveImport = callback; } });
assert.deepEqual(resolveImport({ kind: 'entry-point', path: worker }), { path: worker });
assert.deepEqual(resolveImport({ kind: 'import-statement', path: 'cloudflare:' + canary }), { path: 'cloudflare:' + canary, external: true });
for (const path of ['node:' + canary, './' + canary, canary]) {
  assert.throws(() => resolveImport({ kind: 'import-statement', path }), /not being bundled/);
}
let notified = false;
options.plugins[1].setup({ onEnd: (callback) => { callback({ errors: [canary], warnings: [canary] }); notified = true; } });
assert(notified);
assert(!JSON.stringify(resolutions).includes(canary));

const message = { id: canary, pluginName: canary, text: 'Top-level await is currently not supported ' + canary,
  notes: [{ text: canary }], detail: { value: canary }, location: { file: worker, line: 12, column: 7, lineText: canary } };
assert.deepEqual(sanitizeMessage(message, worker), { id: 'other-id', plugin: 'other-plugin',
  category: 'top-level-await-output-format', locationClass: 'compiled-entry', line: 12, column: 7 });
const untrustedLocation = sanitizeMessage({ ...message, location: { file: '/' + canary, line: 1e20, column: -1 } }, worker);
assert.equal(untrustedLocation.locationClass, 'other-source');
assert.equal(untrustedLocation.line, null);
assert.equal(untrustedLocation.column, null);

const metadata = { inputs: { [canary]: { imports: [] } }, outputs: { [canary]: { imports: [
  { path: 'cloudflare:' + canary, kind: 'import-statement' },
  { path: 'node:' + canary, kind: 'import-statement' }, { path: './' + canary, kind: 'dynamic-import' },
  { path: canary, kind: canary },
] , exports: ['default', canary] } } };
const topologyResult = topology(metadata);
assert.deepEqual(topologyResult.importCounts, { 'import-statement': { 'cloudflare-builtin': 1, 'node-builtin': 1 },
  'dynamic-import': { relative: 1 }, 'other-kind': { 'bare-package': 1 } });
assert.equal(topologyResult.importSemantics, 'retained-emitted-output-imports');
assert.equal(topologyResult.hasDefaultExport, true);
assert.equal(topologyResult.namedExportCount, 1);
assert(!JSON.stringify(topologyResult).includes(canary));
const many = topology({ inputs: { [canary]: { imports: [] } }, outputs: { [canary]: {
  imports: Array(1001).fill({ path: canary, kind: canary }), exports: Array(1001).fill(canary),
} } });
assert.equal(many.importsTruncated, true);
assert.equal(many.importCounts['other-kind']['bare-package'], 1000);
assert.equal(many.exportsTruncated, true);
assert.equal(many.namedExportCount, 1000);
assert(!JSON.stringify(many).includes(canary));

let calls = 0;
const result = await inspectBuild(worker, async (actual) => {
  calls++;
  assert.equal(actual.logLevel, 'silent');
  if (actual.bundle) throw { errors: Array(25).fill(message), message: canary, notes: [canary] };
  assert.equal(actual.write, false); assert.equal(actual.format, 'esm'); assert.equal(actual.metafile, true);
  return { metafile: metadata, warnings: [{ text: canary }], outputFiles: [{ text: canary }] };
}, () => {});
assert.equal(calls, 2);
assert.equal(result.checkRawWorkerEquivalent.errorCount, 25);
assert.equal(result.checkRawWorkerEquivalent.errors.length, 20);
assert.equal(result.checkRawWorkerEquivalent.errorsTruncated, true);
assert.equal(result.metadataAnalysis.status, 'succeeded');
assert(!JSON.stringify(result).includes(canary));
let stops = 0;
const timeout = await inspectBuild(worker, () => new Promise(() => {}), () => { stops++; }, 2);
assert.equal(timeout.checkRawWorkerEquivalent.status, 'timed-out');
assert.equal(timeout.metadataAnalysis.status, 'timed-out');
assert.equal(stops, 2);
console.log('PASS: faithful option shape, import blocker, silent notifier, typed-error/topology canary redaction, count/time bounds; fake API only.');
