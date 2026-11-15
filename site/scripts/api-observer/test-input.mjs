import assert from 'node:assert/strict';
import {pagesInput} from './input.mjs';
let options;
const input=await pagesInput({entrypoint:'/synthetic/entry.js',payload:'/synthetic/payload',cwd:'/synthetic/stage',
 env:{},home:'/synthetic/home',legacyIsDirectory:false,logCounters:{},generateASSETS:async o=>{options=o;return ()=>{};}});
assert.equal(input.build.nodejsCompatMode(),'v2');assert.equal(input.dev.remote,undefined);
assert.deepEqual(input.compatibilityFlags,[]);assert.equal(input.compatibilityDate,'2026-09-08');
assert.deepEqual(input.dev.inspector,{hostname:undefined,port:undefined});assert.equal(input.dev.persist,undefined);
assert.equal(input.dev.registry,'/synthetic/home/.config/.wrangler/registry');
assert.equal(input.dev.server.secure,false);assert.equal(input.build.bundle,false);assert.equal(input.build.processEntrypoint,true);
assert.equal(options.directory,'/synthetic/payload');assert.equal(options.proxyPort,undefined);
assert.equal(input.defaultBindings.CF_PAGES_COMMIT_SHA.value,'0'.repeat(40));
assert.equal(input.defaultBindings.CF_PAGES_URL.value,'https://00000000.stage.pages.dev');
assert.match(input.dev.containerBuildId,/^[a-f0-9]{8}$/);
await assert.rejects(input.dev.auth(),e=>e.code==='AUTH_NOT_ALLOWED');
console.log('PASS: fixed-date v2, undefined remote/inspector/persist, ASSETS/default bindings, container-ID shape, auth fail closed; no runtime.');
