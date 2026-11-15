// PREPARED FOR WHOLE-HARNESS REVIEW ONLY; no workflow publication/execution authorized here.
import {createRequire} from 'node:module';
import {readFileSync,existsSync,lstatSync,mkdtempSync,readdirSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pagesInput} from './input.mjs';
import {observeOnce} from './executor.mjs';
import {publishTerminal,strictPreflight} from './terminal.mjs';
import {pathToFileURL,fileURLToPath} from 'node:url';
const digest=b=>createHash('sha256').update(b).digest('hex');
async function main(){
 if(process.env.GITHUB_ACTIONS!=='true'||process.platform!=='linux'||process.env.API_OBSERVATION_AUTHORIZED!=='REVIEWED_ONE_SHOT')throw Error();
 const [cliDir,stage,source,output]=process.argv.slice(2);
 process.chdir(stage);
 // Refuse fixture/config discovery drift; never inspect private registry files or inherited credentials.
 for(const name of ['wrangler.jsonc','wrangler.json','wrangler.toml','.env','.dev.vars','.git','.wrangler'])if(existsSync(name))throw Error();
 const home=homedir();if(resolve(home)!==resolve(process.env.HOME)||resolve(home)!==join(resolve(stage),'api-home')||readdirSync(home).length!==0)throw Error();
 if(process.env.XDG_CONFIG_HOME!==undefined&&resolve(process.env.XDG_CONFIG_HOME)!==join(home,'.config'))throw Error();
 if('WRANGLER_REGISTRY_PATH' in process.env||'CLOUDFLARE_DEV_REGISTRY_PATH' in process.env)throw Error();
 let insideGit=false;try{execFileSync('git',['-C',stage,'rev-parse','HEAD'],{stdio:'pipe'});insideGit=true;}catch{}
 if(insideGit)throw Error();
 for(const key of Object.keys(process.env))if(/^(CLOUDFLARE_(API|ACCOUNT|AUTH|ACCESS)|CF_API|STRIPE_|ADMIN_KEY|GSC_)/.test(key))throw Error();
 const sha=execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim();if(sha!==process.env.GITHUB_SHA)throw Error();
 const prior=JSON.parse(readFileSync(join(stage,'diagnostics/worker-build.json')));
 const worker=join(stage,'payload/_worker.js');
 if(!strictPreflight(prior,sha,digest(readFileSync(worker))))throw Error();
 const controlHashes={};
 for(const file of ['_headers','_redirects','_routes.json']){
  controlHashes[file]=digest(readFileSync(join(source,'site/public',file)));
  if(digest(readFileSync(join(stage,'payload',file)))!==controlHashes[file])throw Error();
 }
 const root=createRequire(join(cliDir,'package.json')),pkg=root.resolve('wrangler/package.json'),installed=createRequire(pkg);
 if(JSON.parse(readFileSync(pkg)).version!=='4.162.0')throw Error();
 const api=root('wrangler'),esbuild=installed('esbuild');
 // Public dependency validator; no private bundled module access. Invalid input fails before startup.
 const compiled=mkdtempSync(join(stage,'api-pipeline-'));
 // Source-verbatim public validator, not an assumed installed bundled devDependency.
 // FatalError/telemetry wrapper differs only for rejected fixtures: no startup follows rejection.
 const validation=join(compiled,'validation.mjs');
 const vendor=fileURLToPath(new URL('./vendor/',import.meta.url));
 for(const record of JSON.parse(readFileSync(join(vendor,'PROVENANCE.json'))))
  if(digest(readFileSync(join(vendor,record.path)))!==record.sha256)throw Error();
 try{await esbuild.build({entryPoints:[join(vendor,'routes-validation.ts')],bundle:true,platform:'node',format:'esm',outfile:validation,logLevel:'silent'});}finally{esbuild.stop();}
 const {validateRoutes}=await import(pathToFileURL(validation).href);
 const routeText=readFileSync(join(stage,'payload/_routes.json'),'utf8');validateRoutes(JSON.parse(routeText),join(stage,'payload'));
 const templates=join(dirname(pkg),'templates');
 const entrypoint=join(compiled,'entry.js');
 const aliases={'__ENTRY_POINT__':worker,'./pages-dev-util':join(templates,'pages-dev-util.ts')};
 const plugin={name:'external-alias-imports',setup(build){build.onResolve({filter:/.*/},args=>{
  if(args.kind==='entry-point')return {path:args.path};
  if(!Object.hasOwn(aliases,args.path))throw Error();
  return {path:aliases[args.path],external:true};
 });}};
 try{await esbuild.build({entryPoints:[join(templates,'pages-dev-pipeline.ts')],bundle:true,sourcemap:true,format:'esm',
  plugins:[plugin],outfile:entrypoint,define:{__ROUTES__:routeText},logLevel:'silent'});}finally{esbuild.stop();}
 const counters={};const assetsAbort=new AbortController();
 const input=await pagesInput({entrypoint,payload:join(stage,'payload'),cwd:stage,env:process.env,home,
  legacyIsDirectory:existsSync(join(home,'.wrangler'))&&lstatSync(join(home,'.wrangler')).isDirectory(),
  generateASSETS:api.unstable_generateASSETSBinding,logCounters:counters,assetsSignal:assetsAbort.signal});
 // No IPC/auth listener, tunnel, browser, proxy URL or reload payload is serialized.
 let observation;
 let code;
 try {
  // Provisional observer result stays in memory. It cannot be mistaken for terminal completion.
  code=await observeOnce(api.unstable_DevEnv,input,output,{persist:(_,bytes)=>{observation=JSON.parse(bytes);}});
 } finally { assetsAbort.abort(); } // Close only the owned ASSETS watchers, after observation.
 const unchanged=digest(readFileSync(worker))===prior.compiledWorkerSha256&&
  ['_headers','_redirects','_routes.json'].every(file=>digest(readFileSync(join(stage,'payload',file)))===controlHashes[file]&&digest(readFileSync(join(source,'site/public',file)))===controlHashes[file]);
 if(!unchanged)code=1;
 publishTerminal(output,{schemaVersion:1,terminal:true,postflightVerified:unchanged,exitCode:code,observation});
 return code;
}
main().then(code=>{process.exitCode=code;},()=>{process.exitCode=1;});
