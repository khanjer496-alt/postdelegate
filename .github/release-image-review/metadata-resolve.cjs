'use strict';
// Built-in-only metadata resolver: no application or third-party package imports.
const fs = require('node:fs');
const path = require('node:path');
const {createRequire} = require('node:module');
const targets = ['next','@next/env','@next/swc-linux-x64-gnu','@temporalio/worker','@temporalio/client','@temporalio/workflow','@temporalio/activity','@temporalio/common','@temporalio/proto','@temporalio/core-bridge','nestjs-temporal-core','@nestjs/core','@nestjs/common','@nestjs/testing','@prisma/client','prisma','ts-node','tsconfig-paths','expect'];
function safe(p) { const q=fs.realpathSync(p); if(!q.startsWith('/app/')) throw Error('OUTSIDE_APP_METADATA'); return q; }
function packageFile(req,name) {
  try { return safe(req.resolve(name+'/package.json')); } catch (_) {}
  let current=path.dirname(safe(req.resolve(name)));
  for(let i=0;i<24 && current.startsWith('/app/');i++,current=path.dirname(current)) {
    const p=path.join(current,'package.json');
    if(fs.existsSync(p) && JSON.parse(fs.readFileSync(p,'utf8')).name===name) return safe(p);
  }
  throw Error('NO_MANIFEST');
}
const result={node:process.version,platform:process.platform,arch:process.arch,glibcRuntime:process.report.getReport().header.glibcVersionRuntime||null,contexts:{},files:{},envFilePresence:[],resolutionLimits:[]};
const contexts={root:{path:'/app/package.json',targets},frontend:{path:'/app/apps/frontend/package.json',targets},backend:{path:'/app/apps/backend/package.json',targets},orchestrator:{path:'/app/apps/orchestrator/package.json',targets}};
for(const [label,name,selected] of [
  ['dependency:temporal-worker','@temporalio/worker',['@temporalio/worker','@temporalio/activity','@temporalio/common','@temporalio/client','@temporalio/proto','@temporalio/core-bridge','@temporalio/workflow']],
  ['dependency:temporal-client','@temporalio/client',['@temporalio/client','@temporalio/common','@temporalio/proto']],
  ['dependency:prisma-client','@prisma/client',['@prisma/client','prisma']],
  ['dependency:next','next',['next','@next/env','@next/swc-linux-x64-gnu']],
  ['dependency:nest-core','@nestjs/core',['@nestjs/core','@nestjs/common']],
]) {
  try {contexts[label]={path:packageFile(createRequire('/app/package.json'),name),targets:selected};}
  catch (_) {result.resolutionLimits.push({context:label,status:'IMPORTER_NOT_RESOLVED'});}
}
for(const [label,entry] of Object.entries(contexts)) {
  const context=entry.path;
  const req=createRequire(context); result.contexts[label]={};
  for(const name of entry.targets) {
    try {result.contexts[label][name]={path:packageFile(req,name)};}
    catch (_) {result.contexts[label][name]={status:'NOT_RESOLVED'};}
  }
}
try {
  const prisma=createRequire(packageFile(createRequire('/app/package.json'),'@prisma/client'));
  const generated=safe(prisma.resolve('.prisma/client/package.json'));
  result.files.generatedPackage=generated;
  result.files.generatedSchema=safe(path.join(path.dirname(generated),'schema.prisma'));
} catch (_) {}
for(const [key,p] of Object.entries({rootManifest:'/app/package.json',rootLock:'/app/pnpm-lock.yaml',sourceSchema:'/app/libraries/nestjs-libraries/src/database/prisma/schema.prisma',generatedSchema:'/app/node_modules/.prisma/client/schema.prisma',generatedPackage:'/app/node_modules/.prisma/client/package.json'})) {
  if(result.files[key]) continue;
  try {result.files[key]=safe(p);} catch (_) {result.files[key]=null;}
}
for(const p of ['/app/.env','/app/.env.local','/app/.env.production','/app/apps/frontend/.env.local','/app/apps/frontend/.env.production','/app/.npmrc','/root/.npmrc']) {
  if(fs.existsSync(p)) result.envFilePresence.push({path:p,bytes:fs.statSync(p).size});
}
process.stdout.write(JSON.stringify(result));
