// Small fixtures and Node syntax-only subprocesses; never execute worker code or load esbuild/Wrangler.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stageWorker } from './stage-pages-worker.mjs';

const root = mkdtempSync(join(tmpdir(), 'pages-worker-staging-'));
let sequence = 0;
function fixture(source) {
  const directory = join(root, String(sequence++));
  const compiled = join(directory, 'compiled');
  mkdirSync(compiled, { recursive: true });
  writeFileSync(join(compiled, 'index.js'), source);
  return { compiled, destination: join(directory, '_worker.js'), evidence: join(directory, 'format.json') };
}
try {
  const raw = 'export default { async fetch() { return new Response("synthetic"); } };\n';
  const good = fixture(raw);
  const evidence = stageWorker(good.compiled, good.destination, good.evidence);
  assert.equal(readFileSync(good.destination, 'utf8'), raw);
  assert.equal(evidence.format, 'raw-es-module-javascript');
  assert.equal(evidence.compilerOutputSha256, evidence.stagedWorkerSha256);
  assert.deepEqual(evidence.compilerOutputFiles, ['index.js']);
  const notExecuted = fixture('throw new Error("Worker must not execute during syntax gate");\n' + raw);
  stageWorker(notExecuted.compiled, notExecuted.destination, notExecuted.evidence);
  const multipart = fixture('--synthetic-boundary\r\nContent-Disposition: form-data; name="index.js"\r\nContent-Type: application/javascript\r\n\r\n' + raw + '\r\n--synthetic-boundary--');
  assert.throws(() => stageWorker(multipart.compiled, multipart.destination, multipart.evidence), /not valid raw Module/);
  assert(!existsSync(multipart.destination) && !existsSync(multipart.evidence));
  for (const extra of ['module.js', '_routes.json', 'metadata.json']) {
    const unexpected = fixture(raw);
    writeFileSync(join(unexpected.compiled, extra), 'synthetic');
    assert.throws(() => stageWorker(unexpected.compiled, unexpected.destination, unexpected.evidence), /Expected only regular index.js/);
    assert(!existsSync(unexpected.destination));
  }
  const link = fixture(raw);
  const linked = join(root, 'linked-directory');
  mkdirSync(linked);
  symlinkSync(join(link.compiled, 'index.js'), join(linked, 'index.js'));
  assert.throws(() => stageWorker(linked, link.destination, link.evidence), /Expected only regular index.js/);
  assert.throws(() => stageWorker(good.compiled, good.destination, good.evidence), /EEXIST/);
  console.log('PASS: raw module copied exactly; multipart rejected; worker not evaluated; extra modules/metadata/symlinks/overwrite refused.');
} finally { rmSync(root, { recursive: true, force: true }); }
