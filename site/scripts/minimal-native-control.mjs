// Hosted synthetic control only: distinguish Pages-specific startup from basic Miniflare startup.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify } from './pages-startup-probe.mjs';

export async function control(Miniflare, log, persist) {
  let runtime;
  const result = { synthetic: true, diagnosticOnly: true, releasable: false,
    scope: 'minimal-module-no-assets-no-bindings', compatibilityDate: '2026-09-08',
    compatibilityFlags: [], phase: 'constructing' };
  persist(result);
  try {
    // Pinned4.162 Miniflare config/schema.ts requires the normalized workers/config/manifest API.
    runtime = new Miniflare({ host: '127.0.0.1', port: 8789, log,
      workers: [{ config: { name: 'synthetic-native-control',
        compatibilityDate: '2026-09-08', compatibilityFlags: [],
        manifest: { mainModule: 'control.mjs', modules: { 'control.mjs': { type: 'esm',
          contents: 'export default { fetch() { return new Response("Synthetic native control only"); } };' } } } } }] });
    await runtime.ready;
    result.phase = 'ready';
  } catch (error) {
    result.phase = 'failed';
    result.code = ['ERR_RUNTIME_FAILURE','ERR_ADDRESS_IN_USE','ERR_VALIDATION','EPERM','EACCES'].includes(error?.code)
      ? error.code : 'other-code';
    result.errorClass = ['Error','TypeError','RangeError','MiniflareCoreError'].includes(error?.name) ? error.name : 'other-error';
    // No messages, stack, cause, values or locations leave memory.
    result.classes = classify(Buffer.from(typeof error?.message === 'string' ? error.message : '')).categories;
  }
  persist(result);
  return runtime;
}

async function main() {
  if (process.env.GITHUB_ACTIONS !== 'true') throw new Error('Hosted-only diagnostic control');
  const [cliDir, output] = process.argv.slice(2);
  const root = createRequire(join(cliDir,'package.json'));
  const installed = createRequire(root.resolve('wrangler/package.json'));
  const { Miniflare, Log, LogLevel } = installed('miniflare');
  const runtime = await control(Miniflare,new Log(LogLevel.NONE),
    (result) => writeFileSync(output,JSON.stringify(result,null,2)+'\n'));
  if (runtime) {
    process.once('SIGTERM', () => { void runtime.dispose().finally(() => process.exit(0)); });
    // Parent's bounded probe owns readiness and process-group cleanup.
    await new Promise(() => {});
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
