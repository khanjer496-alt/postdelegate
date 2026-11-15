// Fake parent/child outcomes plus tiny owned temporary files; no actual child/runtime.
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {evaluateTerminal,strictPreflight,publishTerminal} from './terminal.mjs';
const observation={status:'proxy-and-reload-observed-not-site-acceptance',cleanupComplete:true,observerFault:false,errors:0};
const terminal={schemaVersion:1,terminal:true,postflightVerified:true,exitCode:0,observation};
const record={wrapperBeforeCleanup:{exitObserved:true,exitCode:0,signal:null,spawnErrorClass:null},spawnErrorClass:null,
 probeErrorClass:null,finalExitCode:0,finalSignal:null,processGroupAfterCleanup:{state:'absent'},cleanupErrorClasses:[]};
const accept=(r=record,t=terminal)=>evaluateTerminal(r,JSON.stringify(t));
assert(accept());
assert(!accept({...record,wrapperBeforeCleanup:{...record.wrapperBeforeCleanup,exitCode:1},finalExitCode:1}));
assert(!accept({...record,wrapperBeforeCleanup:{...record.wrapperBeforeCleanup,exitObserved:false,exitCode:null},finalExitCode:null,finalSignal:'SIGKILL'}));
assert(!accept(record,{...terminal,postflightVerified:false,exitCode:1}));
assert(!accept(record,observation)); // report visible before terminal/postflight
assert(!evaluateTerminal(record,'{"terminal":')); // partial file
assert(!accept(record,{...terminal,observation:{...observation,errors:1,status:'failed'}}));
for(const key of ['spawnErrorClass','probeErrorClass'])assert(!accept({...record,[key]:'EPERM'}));
assert(!accept({...record,processGroupAfterCleanup:{state:'unknown'}}));
assert(!accept({...record,cleanupErrorClasses:['EPERM']}));
assert(!accept({...record,wrapperBeforeCleanup:{...record.wrapperBeforeCleanup,exitCode:null,signal:'SIGTERM'},finalExitCode:null,finalSignal:'SIGTERM'}));
const p={sourceSha:'sha',workerUnchanged:true,checkRawWorkerEquivalent:{status:'succeeded'},metadataAnalysis:{status:'succeeded'},compiledWorkerSha256:'hash'};
assert(strictPreflight(p,'sha','hash'));
for(const state of [undefined,'failed','timed-out'])assert(!strictPreflight({...p,metadataAnalysis:state?{status:state}:undefined},'sha','hash'));
for(const value of [false,1,'true',undefined])assert(!strictPreflight({...p,workerUnchanged:value},'sha','hash'));
const task=mkdtempSync(join(tmpdir(),'api-terminal-fake-'));
try{
 const path=join(task,'terminal.json');publishTerminal(path,terminal);assert.equal(readFileSync(path,'utf8'),JSON.stringify(terminal,null,2)+'\n');
 assert.throws(()=>publishTerminal(path,{...terminal,exitCode:1}));assert.deepEqual(readdirSync(task),['terminal.json']);
 assert.equal(JSON.parse(readFileSync(path)).exitCode,0);
}finally{rmSync(task,{recursive:true});}
console.log('PASS: natural-zero vs exit1/hang/kill/postflight/partial/premature/late-error/cleanup; strict metadata+boolean; atomic exclusive publication. No child/runtime.');
