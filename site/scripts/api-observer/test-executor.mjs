// Fake controllers only; no actual runtime, network, installed CLI or files.
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {observeOnce} from './executor.mjs';
import {attach} from './observe.mjs';
const pending=()=>new Promise(()=>{});
async function run(kind,extra={}){
 let report,instance;
 class Fake extends EventEmitter {
  constructor(){
   super();instance=this;
   let ready;const promise=new Promise((resolve,reject)=>{ready={resolve,reject};});
   this.proxy={ready:{promise}};
   this.config={set:async(input,initial)=>{
    assert.equal(initial,true);
    if(kind==='config-reject')throw Object.assign(Error('PRIVATE_MESSAGE'),{code:'ERR_VALIDATION'});
    if(kind==='early-error'){this.emit('error',{source:'LocalRuntimeController',cause:{code:'ERR_RUNTIME_FAILURE',message:'PRIVATE_TOKEN'}});return;}
    if(kind==='ready-reject'){ready.reject({code:'EACCES'});return;}
    if(kind==='inflight')return pending();
    if(!['reload-only','deadline'].includes(kind))ready.resolve({url:'PRIVATE_PROXY_URL'});
    if(!['proxy-only','deadline'].includes(kind))this.emit('reloadComplete',{proxyData:{secret:'PRIVATE_PROXY_TOKEN'}});
   }};
  }
  async teardown(){
   if(kind==='teardown-reject')throw Error('PRIVATE_TEARDOWN');
   if(kind==='teardown-timeout')return pending();
   if(kind==='late-error')this.emit('error',{cause:{code:'ERR_RUNTIME_FAILURE'}});
   this.emit('teardown');
  }
 }
 const code=await observeOnce(Fake,{},'/synthetic/output',{
  observationMs:8,teardownMs:5,persist:(_,bytes)=>{report=JSON.parse(bytes);},...extra});
 assert(!JSON.stringify(report).includes('PRIVATE'));
 return {code,report,instance};
}
assert.equal((await run('good')).code,0);
for(const kind of ['config-reject','early-error','ready-reject','proxy-only','reload-only','deadline','inflight','teardown-reject','teardown-timeout','late-error']){
 const {code,report}=await run(kind);assert.equal(code,1,kind);
 if(kind.startsWith('teardown-'))assert.equal(report.cleanupComplete,false);
}
assert.equal((await run('good',{attachObserver:(dev,report)=>{attach(dev,report);report.observerFault=true;}})).code,1);
await assert.rejects(run('good',{persist:()=>{throw Error('synthetic-output-failure');}}),/synthetic-output-failure/);
await assert.rejects(run('good',{observationMs:25001}),/bounded deadline/);
console.log('PASS: config/early+late error/ready rejection/split readiness/deadline/in-flight setup/teardown failure+timeout/observer fault/output failure; fakes only.');
