// Hosted one-shot parent: natural child exit first; terminal publication is NOT readiness.
import {spawn} from 'node:child_process';
import {mkdirSync,existsSync,readFileSync,writeFileSync,lstatSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {evaluateTerminal} from './terminal.mjs';
if(process.env.GITHUB_ACTIONS!=='true'||process.platform!=='linux'||process.env.API_OBSERVATION_AUTHORIZED!=='REVIEWED_ONE_SHOT')throw Error();
const [cli,stage,source]=process.argv.slice(2);
if('WRANGLER_REGISTRY_PATH' in process.env||'CLOUDFLARE_DEV_REGISTRY_PATH' in process.env)throw Error();
const home=join(stage,'api-home');mkdirSync(home);
const output=join(stage,'diagnostics/api-observation.json');if(existsSync(output))throw Error();
const {runCase}=await import(pathToFileURL(join(source,'site/scripts/pages-startup-probe.mjs')).href);
const record=await runCase(process.execPath,[fileURLToPath(new URL('./entry.mjs',import.meta.url)),cli,stage,source,output],stage,{
 launch:(command,args,options)=>spawn(command,args,{...options,stdio:'ignore',env:{...process.env,HOME:home,XDG_CONFIG_HOME:join(home,'.config')}}),
 // Deliberately never report HTTP/readiness. runCase observes natural exit or enforces its deadline.
 probe:async()=>({status:null,errorClass:null}),timeoutMs:35000,cleanupMs:1000
});
record.configuredFlags=['<api-entry>','<isolated-cli>','<disposable-stage>','<source>','<allowlisted-output>'];
record.observationMode='natural-child-exit-only-no-HTTP';
delete record.loopbackRequestOutcomes;
delete record.categories;delete record.scannedBytes;delete record.outputTruncated;
let raw='';
if(existsSync(output)){
 const file=lstatSync(output);
 if(file.isFile()&&!file.isSymbolicLink()&&file.size<=65536)raw=readFileSync(output,'utf8');
}
record.terminalAccepted=evaluateTerminal(record,raw);
writeFileSync(join(stage,'diagnostics/api-parent.json'),JSON.stringify(record,null,2)+'\n',{flag:'wx'});
process.exitCode=record.terminalAccepted?0:1;
