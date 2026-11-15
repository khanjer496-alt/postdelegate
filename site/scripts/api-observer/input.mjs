// Pinned4.162 pages/dev.ts -> start-dev.ts setup mapping. Linux, no-config fixture only.
import {basename,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {wranglerRegistry,assetsLogger} from './adapters.mjs';
export async function pagesInput({entrypoint,payload,cwd,env,home,legacyIsDirectory,generateASSETS,logCounters,assetsSignal}) {
 const fetcher=await generateASSETS({log:assetsLogger(logCounters),proxyPort:undefined,directory:payload,signal:assetsSignal});
 return {
  name:undefined,config:undefined,entrypoint,compatibilityDate:'2026-09-08',compatibilityFlags:[],
  triggers:undefined,env:undefined,envFiles:undefined,
  build:{bundle:false,define:{},jsxFactory:undefined,jsxFragment:undefined,tsconfig:undefined,minify:undefined,
   processEntrypoint:true,additionalModules:[],moduleRoot:undefined,moduleRules:undefined,
   nodejsCompatMode:()=> 'v2'},
  bindings:{ASSETS:{type:'fetcher',fetcher}},
  defaultBindings:{CF_PAGES:{type:'plain_text',value:'1'},CF_PAGES_BRANCH:{type:'plain_text',value:'local'},
   CF_PAGES_COMMIT_SHA:{type:'plain_text',value:'0'.repeat(40)},
   CF_PAGES_URL:{type:'plain_text',value:`https://00000000.${basename(cwd)}.pages.dev`}},
  dev:{auth:async()=>{throw Object.assign(Error(),{code:'AUTH_NOT_ALLOWED'});},remote:undefined,
   server:{hostname:'127.0.0.1',port:8789,secure:false,httpsCertPath:undefined,httpsKeyPath:undefined},
   inspector:{hostname:undefined,port:undefined},origin:{hostname:undefined,secure:undefined},
   inferOriginFromRoutes:undefined,persist:undefined,liveReload:false,testScheduled:false,logLevel:'log',
   registry:wranglerRegistry(env,home,legacyIsDirectory),multiworkerPrimary:undefined,enableContainers:false,
   dockerPath:undefined,containerBuildId:randomUUID().slice(0,8),generateTypes:false,experimentalNewConfig:false,
   tunnel:{enabled:false,name:undefined,allowedMail:undefined}},
  legacy:{site:()=>undefined},assets:undefined
 };
}
