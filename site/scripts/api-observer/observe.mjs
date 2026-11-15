// Nonthrowing, own-data only export. Never inspect message/name/stack/data/proxyData.
const CODES = new Set(['AUTH_NOT_ALLOWED','ERR_RUNTIME_FAILURE','ERR_ADDRESS_IN_USE','ERR_VALIDATION','EPERM','EACCES','ENOENT','EADDRINUSE']);
const SOURCES = new Set(['LocalRuntimeController','ProxyController','ConfigController','BundlerController']);
const own = (obj,key) => {
  try { const d=Object.getOwnPropertyDescriptor(obj,key); return d && Object.hasOwn(d,'value') ? d.value : undefined; }
  catch { return undefined; }
};
export function codes(value) {
  const seen=new Set(), result=[]; let cycle=false, truncated=false, accessor=false;
  for(let depth=0; value && (typeof value==='object'||typeof value==='function');depth++) {
    if(seen.has(value)){cycle=true;break;}
    if(depth===3){truncated=true;break;}
    seen.add(value);
    const code=own(value,'code'); result.push(CODES.has(code)?code:code===undefined?'unavailable':'other');
    let d; try { d=Object.getOwnPropertyDescriptor(value,'cause'); } catch {}
    if(d&&!Object.hasOwn(d,'value')){accessor=true;break;}
    value=d?.value;
  }
  return {codes:result,cycle,truncated,accessor};
}
export function attach(dev,report) {
  const listen=(type,handler)=>dev.on(type,(event)=>{try{handler(event);}catch{report.observerFault=true;}});
  listen('error',(event)=>{
    report.errors=Math.min(100,report.errors+1);
    if(report.errorRecords.length>=10)return;
    const source=own(event,'source'),reason=own(event,'reason');
    report.errorRecords.push({source:SOURCES.has(source)?source:'unavailable',
      reason:reason==='Error reloading local server'?'local-reload-error':'unavailable',
      ...codes(own(event,'cause')??event)});
  });
  for(const type of ['runtimeError','reloadComplete','teardown'])
    listen(type,()=>{report[type]=Math.min(100,report[type]+1);});
}
