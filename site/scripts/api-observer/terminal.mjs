import {writeFileSync,linkSync,unlinkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
export function strictPreflight(prior,sha,workerHash){
 return prior?.sourceSha===sha&&prior.workerUnchanged===true&&
  prior.checkRawWorkerEquivalent?.status==='succeeded'&&prior.metadataAnalysis?.status==='succeeded'&&
  prior.compiledWorkerSha256===workerHash;
}
export function publishTerminal(path,result){
 const temporary=path+'.private-'+randomUUID();
 try{
  writeFileSync(temporary,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
  // Atomic, exclusive publication of a complete regular file; never overwrite a prior terminal.
  linkSync(temporary,path);
 }finally{try{unlinkSync(temporary);}catch(error){if(error.code!=='ENOENT')throw error;}}
}
export function evaluateTerminal(record,raw){
 let terminal;try{terminal=JSON.parse(raw);}catch{return false;}
 const observation=terminal?.observation;
 return terminal?.schemaVersion===1&&terminal.terminal===true&&terminal.postflightVerified===true&&terminal.exitCode===0&&
  Object.keys(terminal).sort().join(',')==='exitCode,observation,postflightVerified,schemaVersion,terminal'&&
  observation?.status==='proxy-and-reload-observed-not-site-acceptance'&&observation.cleanupComplete===true&&
  observation.observerFault===false&&observation.errors===0&&
  record.wrapperBeforeCleanup?.exitObserved===true&&record.wrapperBeforeCleanup.exitCode===0&&
  record.wrapperBeforeCleanup.signal===null&&record.wrapperBeforeCleanup.spawnErrorClass===null&&
  record.spawnErrorClass===null&&record.probeErrorClass===null&&
  record.finalExitCode===0&&record.finalSignal===null&&
  record.processGroupAfterCleanup?.state==='absent'&&record.cleanupErrorClasses?.length===0;
}
