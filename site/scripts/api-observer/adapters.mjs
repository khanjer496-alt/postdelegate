// Linux-only source-backed derivation; no registry/private file reads.
import {join,resolve} from 'node:path';
export function wranglerRegistry(env,home,legacyIsDirectory) {
  // workers-utils environment factory uses a defined override, including empty string.
  const caller=env.WRANGLER_REGISTRY_PATH!==undefined?env.WRANGLER_REGISTRY_PATH:
    join(legacyIsDirectory?join(home,'.wrangler'):join(env.XDG_CONFIG_HOME||join(home,'.config'),'.wrangler'),'registry');
  // ConfigController only resolves truthy registry inputs. Miniflare then gives its override priority.
  return caller?resolve(env.CLOUDFLARE_DEV_REGISTRY_PATH||caller):caller;
}
export function assetsLogger(report) {
  // Explicit LOGGING-ONLY non-equivalence: no original private logger singleton is loaded.
  // Arguments are ignored without reading/coercing; responses/metadata are untouched.
  return Object.fromEntries(['log','error','warn','info','debug'].map(method=>[method,()=>{
    report[method]=Math.min(100,(report[method]||0)+1);
  }]));
}
