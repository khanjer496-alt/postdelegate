// DRAFT FOR STATIC REVIEW ONLY. No workflow/entry publication or execution authority.
import {once} from 'node:events';
import {writeFileSync} from 'node:fs';
import {codes,attach} from './observe.mjs';

// Caller must supply the reviewed Pages-equivalent input and original default DevEnv class.
// This function does not simplify or discover configuration. No installed-code monkey patch.
export async function observeOnce(DevEnv,input,output,dependencies={}) {
  const {observationMs=25000,teardownMs=5000,persist=(path,bytes)=>writeFileSync(path,bytes,{flag:'wx'}),attachObserver=attach}=dependencies;
  if(!Number.isInteger(observationMs)||observationMs<1||observationMs>25000||!Number.isInteger(teardownMs)||teardownMs<1||teardownMs>5000)throw Error('Invalid bounded deadline');
  const report={diagnosticOnly:true,releasable:false,apiEquivalenceStatus:'NOT_YET_CLEARED',status:'starting',
    errors:0,errorRecords:[],runtimeError:0,reloadComplete:0,teardown:0,
    proxyReady:false,observerFault:false,cleanupComplete:false};
  const dev=new DevEnv();
  attachObserver(dev,report); // Before any config/start.
  let timer,cleanupTimer;
  let rejectFailure,resolveReady;
  const failed=new Promise((_,reject)=>{rejectFailure=reject;});
  // Preserve Pages events.once(teardown) error rejection rather than swallowing an error event.
  const tornDown=once(dev,'teardown');
  tornDown.catch(rejectFailure);
  dev.on('error',(event)=>rejectFailure(event));
  const ready=new Promise(resolve=>{resolveReady=resolve;});
  const maybeReady=()=>{if(report.proxyReady&&report.reloadComplete>0)resolveReady();};
  dev.on('reloadComplete',maybeReady); // No payload access.
  void dev.proxy.ready.promise.then(()=>{report.proxyReady=true;maybeReady();},rejectFailure);
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error()),observationMs);});
  // Install handlers before config.set, preserving config.set(...,true) rejection semantics.
  try {
    await Promise.race([(async()=>{await dev.config.set(input,true);await ready;})(),failed,deadline]);
    report.status='proxy-and-reload-observed-not-site-acceptance';
  } catch(error) {
    report.status='failed';report.initializationFailure=codes(error);
    if(report.initializationFailure.codes.includes('AUTH_NOT_ALLOWED'))report.status='failed-auth-unproven';
  } finally {
    clearTimeout(timer);
    try {
      await Promise.race([dev.teardown(),new Promise((_,reject)=>{cleanupTimer=setTimeout(()=>reject(new Error()),teardownMs);})]);
      report.cleanupComplete=true;
    } catch { report.cleanupComplete=false; }
    clearTimeout(cleanupTimer);
    if(report.errors>0)report.status='failed';
    persist(output,JSON.stringify(report,null,2)+'\n');
  }
  return report.status!=='proxy-and-reload-observed-not-site-acceptance'||!report.cleanupComplete||report.observerFault?1:0;
}
