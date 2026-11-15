// Fake API only: no actual Miniflare/native module, network, runtime or signals.
import assert from 'node:assert/strict';
import { control } from './minimal-native-control.mjs';
let observed;
class Good {
  constructor(options) { observed = options; this.ready = Promise.resolve(); }
}
let report;
await control(Good,{},(r)=>{ report = {...r}; });
assert.equal(report.phase,'ready');
assert.equal(observed.port,8789);
assert.equal(observed.host,'127.0.0.1');
assert.deepEqual(observed.compatibilityFlags,[]);
assert.equal(observed.compatibilityDate,'2026-09-08');
assert.deepEqual(Object.keys(observed).sort(),['modules','host','port','compatibilityDate','compatibilityFlags','log','script'].sort());
class Bad {
  constructor() { this.ready = Promise.reject(Object.assign(new Error('PRIVATE_CANARY account/path/token'),{code:'PRIVATE_CODE'})); }
}
await control(Bad,{},(r)=>{ report = {...r}; });
assert.equal(report.phase,'failed');
assert.equal(report.code,'other-code');
assert(!JSON.stringify(report).includes('PRIVATE'));
assert.equal(report.releasable,false);
console.log('PASS: minimal native control constructor/typed-failure privacy; fake API only.');
