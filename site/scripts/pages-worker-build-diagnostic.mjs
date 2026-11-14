// Compile-only hosted diagnostic. Raw code, metadata, error text and locations never leave memory.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const KINDS = new Set(['entry-point', 'import-statement', 'dynamic-import', 'require-call', 'require-resolve']);
const IDS = new Set(['unsupported-dynamic-import', 'unsupported-require-call', 'commonjs-variable-in-esm', 'top-level-this']);
const PLUGINS = new Set(['block-worker-js-imports', 'wrangler notifier and monitor']);
const bounded = (number, maximum) => Number.isInteger(number) && number >= 0 && number <= maximum ? number : null;
const kindClass = (kind) => KINDS.has(kind) ? kind : 'other-kind';
export const specifierClass = (value) => typeof value !== 'string' ? 'other'
  : value.startsWith('node:') ? 'node-builtin' : value.startsWith('cloudflare:') ? 'cloudflare-builtin'
  : value.startsWith('.') ? 'relative' : isAbsolute(value) ? 'absolute' : /^\w+:/.test(value) ? 'url' : 'bare-package';

export function sanitizeMessage(message, worker) {
  const text = typeof message.text === 'string' ? message.text.slice(0, 4096) : '';
  const categories = [
    ['import-blocked', '_worker.js is not being bundled by Wrangler'],
    ['top-level-await-output-format', 'Top-level await is currently not supported'],
    ['unresolved-import', 'Could not resolve'], ['missing-export', 'No matching export'],
    ['syntax-error', 'Unexpected'], ['syntax-error', 'Expected'],
  ];
  const file = message.location?.file;
  return { id: message.id === '' ? 'empty-id' : IDS.has(message.id) ? message.id : 'other-id',
    plugin: !message.pluginName ? 'none' : PLUGINS.has(message.pluginName) ? message.pluginName : 'other-plugin',
    category: categories.find(([, signature]) => text.includes(signature))?.[0] ?? 'other-build-error',
    locationClass: !file ? 'none' : file === '<stdin>' ? 'stdin' : resolve(file) === worker ? 'compiled-entry' : 'other-source',
    line: bounded(message.location?.line, 10_000_000), column: bounded(message.location?.column, 1_000_000) };
}

export function topology(metafile) {
  const outputs = Object.values(metafile.outputs ?? {});
  const imports = outputs.flatMap((output) => output.imports ?? []);
  const counts = {};
  for (const item of imports.slice(0, 1000)) {
    const kind = kindClass(item.kind), specifier = specifierClass(item.path);
    counts[kind] ??= {}; counts[kind][specifier] = (counts[kind][specifier] ?? 0) + 1;
  }
  const exports = outputs.flatMap((output) => output.exports ?? []);
  return { importSemantics: 'retained-emitted-output-imports', importCounts: counts, importsTruncated: imports.length > 1000,
    hasDefaultExport: exports.includes('default'), namedExportCount: Math.min(1000, exports.filter((name) => name !== 'default').length),
    exportsTruncated: exports.length > 1000 };
}

export function checkOptions(worker, resolutions) {
  // Faithful to wrangler@4.162.0 checkRawWorker()/blockWorkerJsImports(), with no Node compatibility flags.
  // Only buildNotifierPlugin's logger is replaced with a no-op at its source; no CLI log parsing.
  return { entryPoints: [worker], write: false, bundle: true, logLevel: 'silent', plugins: [
    { name: 'block-worker-js-imports', setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        const decision = args.kind === 'entry-point' ? 'entry' : args.path.startsWith('cloudflare:') ? 'allowed-builtin' : 'blocked';
        if (resolutions.length < 100) resolutions.push({ kind: kindClass(args.kind), specifierClass: specifierClass(args.path), decision });
        if (decision === 'entry') return { path: args.path };
        if (decision === 'allowed-builtin') return { path: args.path, external: true };
        throw new Error('_worker.js is not being bundled by Wrangler but it is importing from another file.');
      });
    } },
    { name: 'wrangler notifier and monitor', setup(build) { build.onEnd(() => {}); } },
  ] };
}

export async function inspectBuild(worker, build, stop, timeoutMs = 5000) {
  const run = async (options) => {
    let timer;
    try {
      const result = await Promise.race([build(options), new Promise((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error(), { diagnosticTimeout: true })), timeoutMs);
      })]);
      return { status: 'succeeded', result };
    } catch (error) {
      if (error.diagnosticTimeout) { stop(); return { status: 'timed-out' }; }
      const messages = Array.isArray(error.errors) ? error.errors : [];
      return { status: 'failed', errorCount: Math.min(messages.length, 1_000_000), errorsTruncated: messages.length > 20,
        errors: messages.slice(0, 20).map((message) => sanitizeMessage(message, worker)),
        exceptionClass: messages.length ? 'typed-build-failure' : 'unclassified-exception' };
    } finally { clearTimeout(timer); }
  };
  const resolutions = [];
  const checked = await run(checkOptions(worker, resolutions));
  if (checked.result) {
    checked.warningCount = Math.min(1_000_000, checked.result.warnings?.length ?? 0);
    delete checked.result;
  }
  checked.resolutionClasses = resolutions;
  // A separately labeled analysis pass, not a change to the failing check or compiled payload.
  const analysis = await run({ entryPoints: [worker], write: false, bundle: false, format: 'esm', metafile: true, logLevel: 'silent' });
  if (analysis.result) { analysis.topology = topology(analysis.result.metafile); delete analysis.result; }
  return { checkRawWorkerEquivalent: checked, metadataAnalysis: analysis };
}

async function main() {
  if (process.env.GITHUB_ACTIONS !== 'true') throw new Error('Build inspection is hosted-only');
  const [cliDir, stage, source, output] = process.argv.slice(2);
  const sourceSha = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (!/^[0-9a-f]{40}$/.test(sourceSha) || sourceSha !== process.env.GITHUB_SHA) throw new Error('Source identity mismatch');
  const root = createRequire(join(cliDir, 'package.json'));
  const wranglerPackage = root.resolve('wrangler/package.json');
  const observedWranglerVersion = JSON.parse(readFileSync(wranglerPackage, 'utf8')).version;
  if (observedWranglerVersion !== '4.162.0') throw new Error('Pinned CLI identity mismatch');
  const installed = createRequire(wranglerPackage);
  const esbuild = installed('esbuild');
  const worker = join(stage, 'payload/_worker.js');
  const bytes = readFileSync(worker);
  const sourceFileSha256 = {};
  for (const file of ['site/functions/_middleware.ts', 'site/functions/docs/_middleware.ts',
    'site/public/_routes.json', 'site/public/_headers', 'site/public/_redirects']) sourceFileSha256[file] = sha256(readFileSync(join(source, file)));
  for (const control of ['_routes.json', '_headers', '_redirects']) {
    if (sha256(readFileSync(join(stage, 'payload', control))) !== sourceFileSha256['site/public/' + control]) throw new Error('Control identity mismatch');
  }
  const version = /^\d+\.\d+\.\d+$/.test(esbuild.version) ? esbuild.version : null;
  const result = { schemaVersion: 1, synthetic: true, diagnosticOnly: true, releasable: false,
    repository: 'khanjer496-alt/postdelegate', sourceSha, configuredWranglerVersion: '4.162.0', observedWranglerVersion,
    observedEsbuildVersion: version, sourceFileSha256, compiledWorkerSha256: sha256(bytes), compiledWorkerBytes: bytes.length,
    nodeCompatibilityMode: 'none', phase: 'before-build-check' };
  writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  process.chdir(stage); // Match Pages' disposable working directory, including its default esbuild options.
  try { Object.assign(result, await inspectBuild(worker, esbuild.build, esbuild.stop)); }
  finally { esbuild.stop(); }
  result.phase = 'completed';
  result.workerUnchanged = sha256(readFileSync(worker)) === result.compiledWorkerSha256;
  writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
