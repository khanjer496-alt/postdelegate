// Stage exact compiler bytes only after a strict single-entry inventory and non-executing syntax check.
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const require = (condition, message) => { if (!condition) throw new Error(message); };

export function stageWorker(compiledDirectory, destination, evidencePath) {
  const directory = lstatSync(compiledDirectory);
  require(directory.isDirectory() && !directory.isSymbolicLink(), 'Compiler output must be a real directory');
  const entries = readdirSync(compiledDirectory, { withFileTypes: true });
  require(entries.length === 1 && entries[0].name === 'index.js' && entries[0].isFile()
    && !entries[0].isSymbolicLink(), 'Expected only regular index.js; additional modules require separate review');
  const bytes = readFileSync(join(compiledDirectory, 'index.js'));
  require(bytes.length > 0 && bytes.length <= 16 * 1024 * 1024, 'Worker module size outside staging bound');
  // --check parses a module from stdin without evaluating it or resolving/executing its imports.
  const parsed = spawnSync(process.execPath, ['--input-type=module', '--check'], {
    input: bytes, timeout: 5000, maxBuffer: 16384, stdio: ['pipe', 'pipe', 'pipe'],
  });
  require(!parsed.error && parsed.status === 0, 'Compiler entry is not valid raw Module JavaScript');
  // Never decode/strip multipart or patch generated text. Refuse an existing destination.
  writeFileSync(destination, bytes, { flag: 'wx' });
  const evidence = { format: 'raw-es-module-javascript', compilerOutputFiles: ['index.js'],
    compilerOutputSha256: sha256(bytes), stagedWorkerSha256: sha256(readFileSync(destination)),
    syntaxGate: 'node --input-type=module --check', syntaxGatePassed: true,
    staging: 'byte-for-byte-copy', additionalModulesPolicy: 'reject' };
  require(evidence.compilerOutputSha256 === evidence.stagedWorkerSha256, 'Staged worker byte mismatch');
  writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
  return evidence;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) stageWorker(...process.argv.slice(2));
