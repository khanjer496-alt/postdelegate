"""Preparation-only hosted metadata projection. No body validation or client/uploader."""
import hashlib,importlib.util,io,json,os,re,shutil,stat,subprocess,sys,tempfile,time,zipfile
from pathlib import Path
sys.dont_write_bytecode=True
REPO='khanjer496-alt/postdelegate';REF='refs/heads/test/pr217-metadata-c047-20261115'
SOURCE='7c84b1ebffbccb731a972c2ff55e6bc0accea663';PRODUCER='6708125ffc150c9d692dc8698dbe1ddae0cdedce';TRANSPORT='c047b52fbc5da99c3b10673d393611a9297dec81'
RUN=43679130209;ARTIFACT=14147099190;SIZE=9153156;OUTER='b42d8811616d2ceed169e707a36783bab5c0326b3e67c180469b75858d197cc9'
PREVIEW_SIZE=9212002
ZIP_SHA='9f6f43f00b6ef2de385b8a6d969e85d54a24a78b5d2592ae0fa80c38aa406ade';RECORD_SHA='ad31db5ed373b4bdf674d1d727b256cd3e0f87dbe42e114f4ae8bb87b60b4ea3'
LABELS=['NON_RELEASE','LOCAL_PREVIEW_FAILED','NOT_ACCEPTED']
CAPS={'identity-binding.json':32*1024,'public-file-index.json':512*1024,'row-oracles.json':64*1024}
SOURCE_PATHS=('site/astro.config.mjs','site/public/_headers','site/public/_redirects','site/public/_routes.json','site/functions/docs/_middleware.ts','site/functions/_middleware.ts','site/src/pages/404.astro','site/src/pages/docs/[...slug].md.ts','site/src/layouts/Base.astro','site/src/data/site.ts')
PACKETS={'controlsV3':'9b6fe18be313ae1ac6c6c420edca17be053d1b104a256766aaee1c80d5c77171','executionV1':'ca354cab977cf68cfb5dde1f2374927d01b1e985ce46b7d847c45a67fdb00619'}
class Refused(Exception):pass
def need(ok):
 if not ok:raise Refused()
def sha(b):return hashlib.sha256(b).hexdigest()
CANON_RULE='PR217-CJSON-ASCII-v1'
def json_data(x):
 if type(x) in (type(None),bool,int):return
 if type(x) is str:need(not any(0xD800<=ord(c)<=0xDFFF for c in x));return
 if type(x) is list:
  for v in x:json_data(v)
  return
 if type(x) is dict:
  for k,v in x.items():need(type(k) is str);json_data(k);json_data(v)
  return
 raise Refused()
def canon(x):
 json_data(x);return json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=True,allow_nan=False).encode('utf8')
def shape(x,keys):need(type(x) is dict and set(x)==set(keys.split()))
def hex64(x):need(type(x) is str and re.fullmatch('[a-f0-9]{64}',x))
def strict_json(b):
 def pairs(rows):
  d={}
  for k,v in rows:need(k not in d);d[k]=v
  return d
 result=json.loads(b,object_pairs_hook=pairs,parse_constant=lambda x:(_ for _ in ()).throw(Refused()))
 json_data(result);return result
def git(root,*a):
 env={k:v for k,v in os.environ.items() if k in ('PATH','LANG','LC_ALL')};env.update(GIT_OPTIONAL_LOCKS='0',GIT_CONFIG_NOSYSTEM='1',HOME=os.environ.get('RUNNER_TEMP',os.devnull))
 return subprocess.check_output(['git','-C',str(root),*a],env=env,stderr=subprocess.DEVNULL,timeout=15)
def module(path,name):
 spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
def assert_code(work):
 w=work/'wrapper';c=work/'transport-code';s=work/'source';head=git(w,'rev-parse','HEAD').decode().strip()
 need(head==os.environ['GITHUB_SHA']==os.environ['PROJECTION_WORKFLOW_SHA'])
 need(git(w,'show','-s','--format=%P','HEAD').decode().strip()==PRODUCER)
 expected={'M\t.github/workflows/build.yml',*['A\tsite/scripts/pr217-projection/'+n for n in ('project.py','oracles.py','test-project.py')]}
 need(set(git(w,'diff-tree','--no-commit-id','--name-status','-r','HEAD').decode().splitlines())==expected)
 for n in ('project.py','oracles.py','test-project.py'):
  rel='site/scripts/pr217-projection/'+n;need((w/rel).read_bytes()==git(w,'show','HEAD:'+rel))
 need(git(c,'rev-parse','HEAD').decode().strip()==TRANSPORT and git(s,'rev-parse','HEAD').decode().strip()==SOURCE)
 for n,h in [('verify.py','3ff2f655911bfb340605fff98609954d0ee07697ed3d86e674c541c0b00166fd'),('transport.py','b626251382f54c63519a9749c0d90045ea9fcc94dea05f9c812293edc4e34c0e')]:need(sha((c/'site/scripts/pr217-hosted-verify'/n).read_bytes())==h)
 sources={}
 for n in SOURCE_PATHS:
  b=git(s,'show',SOURCE+':'+n);need((s/n).read_bytes()==b);sources[n]=b
 return sources
def api_paths():
 return {'/repos/'+REPO+'/actions/workflows/401992919','/repos/'+REPO+'/actions/runs?head_sha='+TRANSPORT+'&per_page=100','/repos/'+REPO+'/actions/runs/'+str(RUN),'/repos/'+REPO+'/actions/runs/'+str(RUN)+'/attempts/1/jobs?per_page=100','/repos/'+REPO+'/actions/artifacts/'+str(ARTIFACT),'/repos/'+REPO+'/actions/artifacts/'+str(ARTIFACT)+'/zip'}
def reader_api(reader,token,end):
 class Api(reader.Api):
  def request(self,path):
   reader.deadline_check(end);need(path in api_paths())
   return reader.Request('https://api.github.com'+path,headers={'Authorization':'Bearer '+self.token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'pr217-metadata-projection'})
  def download(self,path,destination):
   try:
    with self.opener.open(self.request(path),timeout=15):raise Refused()
   except reader.HTTPError as e:
    try:need(e.code==302);url=reader.signed_download_url(e.headers.get('Location',''))
    finally:
     if e.fp is not None:e.fp.close()
   with self.opener.open(reader.Request(url,headers={'User-Agent':'pr217-metadata-projection'}),timeout=15) as response:
    need(response.status==200);reader.stream_zip(response,destination,SIZE,OUTER,end)
 return Api(token,end)
def authenticate(api):
 prefix='/repos/'+REPO+'/actions/'
 w=api.json(prefix+'workflows/401992919');need(w['id']==401992919 and w['path']=='.github/workflows/build.yml' and w['state']=='active')
 runs=api.json(prefix+'runs?head_sha='+TRANSPORT+'&per_page=100');need(runs['total_count']==1 and len(runs['workflow_runs'])==1 and runs['workflow_runs'][0]['id']==RUN)
 r=api.json(prefix+'runs/'+str(RUN));need(r['head_sha']==TRANSPORT and r['head_branch']=='test/pr217-transport-6708-20261115' and r['id']==RUN and r['workflow_id']==401992919 and r['path']=='.github/workflows/build.yml' and r['event']=='workflow_dispatch' and r['run_attempt']==1 and r['conclusion']=='success' and r['status']=='completed')
 need(r['repository']['full_name']==r['head_repository']['full_name']==REPO and r['actor']['login']=='khanjer496-alt')
 jobs=api.json(prefix+'runs/'+str(RUN)+'/attempts/1/jobs?per_page=100');need(jobs['total_count']==1 and len(jobs['jobs'])==1)
 j=jobs['jobs'][0];need(j['id']==132705726033 and j['name']=='verify' and j['labels']==['ubuntu-latest'] and j['conclusion']=='success' and j['status']=='completed' and all(x['conclusion']=='success' for x in j['steps']))
 a=api.json(prefix+'artifacts/'+str(ARTIFACT));need(a['id']==ARTIFACT and a['size_in_bytes']==SIZE and a['digest']=='sha256:'+OUTER and a['expired'] is False and a['name']=='NON_RELEASE-NOT_ACCEPTED-SAME_BYTE_TRANSPORT-'+TRANSPORT+'-'+str(RUN)+'-1')
 need(a['workflow_run']['id']==RUN and a['workflow_run']['head_sha']==TRANSPORT and a['workflow_run']['head_branch']=='test/pr217-transport-6708-20261115' and a['workflow_run']['repository_id']==a['workflow_run']['head_repository_id']==1439958050)
def read_container(path,end):
 need(path.stat().st_size==SIZE)
 h=hashlib.sha256()
 with path.open('rb') as f:
  while True:
   need(time.monotonic()<end);b=f.read(65536)
   if not b:break
   h.update(b)
 need(h.hexdigest()==OUTER)
 caps={'preview-payload.zip':PREVIEW_SIZE,'transport-record.json':2*1024**2,'NON_RELEASE.json':4096};data={}
 with zipfile.ZipFile(path) as z:
  members=z.infolist();need(len(members)==3 and {x.filename for x in members}==set(caps))
  for i in members:
   need(not i.is_dir() and not(i.flag_bits&1) and stat.S_IFMT(i.external_attr>>16) in (0,stat.S_IFREG) and not(i.external_attr&0x10) and i.compress_type in (zipfile.ZIP_STORED,zipfile.ZIP_DEFLATED) and 0<=i.file_size<=caps[i.filename])
   digest=hashlib.sha256();buf=bytearray();size=0
   with z.open(i) as f:
    while True:
     need(time.monotonic()<end);b=f.read(65536)
     if not b:break
     size+=len(b);need(size<=caps[i.filename]);digest.update(b)
     if i.filename!='preview-payload.zip':buf.extend(b)
   need(size==i.file_size)
   if i.filename=='preview-payload.zip':need(size==PREVIEW_SIZE and digest.hexdigest()==ZIP_SHA)
   elif i.filename=='transport-record.json':need(digest.hexdigest()==RECORD_SHA);data[i.filename]=strict_json(buf)
   else:data[i.filename]=strict_json(buf)
 need(data['NON_RELEASE.json']=={'labels':LABELS,'releaseAccepted':False,'promotionAllowed':False,'recordSha256':RECORD_SHA,'zipSha256':ZIP_SHA})
 return data['transport-record.json']
def validate_record(m,collision,source,sources):
 shape(m,'schemaVersion artifactClass labels releaseAccepted promotionAllowed runtimeAccepted visualQa fitQualified original derivation files generatedOutputs sourceFiles controlSha256 workerCompilation tools producerRecordedToolFileSha256 toolIdentity zip checks')
 need(m['schemaVersion']==1 and m['artifactClass']=='PR217_SAME_BYTE_TRANSPORT_NOT_RELEASE' and m['labels']==LABELS and all(m[k] is False for k in ('releaseAccepted','promotionAllowed','runtimeAccepted','visualQa','fitQualified')))
 o=m['original'];shape(o,'repository sourceSha producerSha runId runAttempt artifactId outerZipBytes outerZipSha256 innerSha256 sourceTree producer')
 need({k:o[k] for k in ('repository','sourceSha','producerSha','runId','runAttempt','artifactId','outerZipBytes','outerZipSha256')}=={'repository':REPO,'sourceSha':SOURCE,'producerSha':PRODUCER,'runId':'43670231792','runAttempt':'1','artifactId':14144390000,'outerZipBytes':8561290,'outerZipSha256':'1b689f33e3b3d8d1d51302f1c077e084cb206bbf801829254f772f4cc2b41b66'})
 need(o['sourceTree']==git(source,'rev-parse',SOURCE+'^{tree}').decode().strip());shape(o['innerSha256'],'NON_RELEASE.json candidate-manifest.json candidate-payload.tar.gz worker-format.json')
 for h in o['innerSha256'].values():hex64(h)
 p=o['producer'];shape(p,'sha workflowSha workflowRef workflow runId runAttempt event ref files created deleted forced before after initialParent')
 need(p['sha']==p['workflowSha']==p['after']==PRODUCER and p['initialParent']==SOURCE and p['runId']=='43670231792' and p['runAttempt']=='1' and p['event']=='push' and p['created'] is True and p['forced'] is False and p['deleted'] is False and p['before']=='0'*40)
 need(p['ref']=='refs/heads/test/pr217-generated-provenance-7c84-20261115' and p['workflowRef']==REPO+'/.github/workflows/pr217-nonrelease-candidate.yml@'+p['ref'] and p['workflow']=='PR217 NON_RELEASE LOCAL_PREVIEW_FAILED NOT_ACCEPTED candidate')
 need(set(p['files'])=={'.github/workflows/pr217-nonrelease-candidate.yml',*['site/scripts/pr217-candidate/'+n for n in ('candidate.py','producer.sh','test-candidate.py','tool-metadata.mjs')]})
 for x in p['files'].values():shape(x,'gitBlob sha256');hex64(x['sha256']);need(re.fullmatch('[0-9a-f]{40}',x['gitBlob']))
 d=m['derivation'];need(d=={'sha':TRANSPORT,'workflowSha':TRANSPORT,'workflowRef':REPO+'/.github/workflows/build.yml@refs/heads/test/pr217-transport-6708-20261115','runId':str(RUN),'runAttempt':'1','event':'workflow_dispatch','ref':'refs/heads/test/pr217-transport-6708-20261115'})
 f=m['files'];need(type(f) is dict and len(f)==713);collision(f)
 for name,r in f.items():
  need(len(name.encode('utf8'))<=384);shape(r,'sha256 bytes mode');hex64(r['sha256']);need(type(r['bytes']) is int and 0<=r['bytes']<=166366 and r['mode']==0o644)
 need(sum(x['bytes'] for x in f.values())==35703988 and sum(n.endswith('.html') for n in f)==491 and max(x['bytes'] for x in f.values())==166366)
 sf=m['sourceFiles'];need(type(sf) is dict and len(sf)==435)
 for n,r in sf.items():
  need(n.startswith('site/'));shape(r,'gitBlob sha256 bytes mode');hex64(r['sha256']);need(re.fullmatch('[0-9a-f]{40}',r['gitBlob']) and r['mode'] in ('100644','100755') and type(r['bytes']) is int and r['bytes']>=0)
 actual={}
 for item in git(source,'ls-tree','-rz','--full-tree',SOURCE,'--','site').split(b'\0'):
  if item:
   meta,name=item.split(b'\t');mode,kind,blob=meta.decode().split();need(kind=='blob');actual[name.decode()]=(mode,blob)
 need(actual=={n:(r['mode'],r['gitBlob']) for n,r in sf.items()})
 g=m['generatedOutputs'];shape(g,'generatorInputs mapping runIdentity outputs');need(len(g['mapping'])==len(g['outputs'])==115 and g['runIdentity']=={'sha':PRODUCER,'runId':'43670231792','runAttempt':'1'})
 mapped={}
 for r in g['mapping']:shape(r,'route sourcePath payloadPath');need(r['sourcePath']=='site/public/'+r['payloadPath'] and r['sourcePath'] not in mapped);mapped[r['sourcePath']]=r['payloadPath']
 need(set(mapped)==set(g['outputs']))
 for n,r in g['outputs'].items():
  shape(r,'payloadPath sha256 bytes gitInputSha256');need(r['payloadPath']==mapped[n] and r['sha256']==f[mapped[n]]['sha256'] and r['bytes']==f[mapped[n]]['bytes'] and r['gitInputSha256']==sf[n]['sha256'])
 need(set(g['generatorInputs'])=={'site/package.json','site/scripts/og.mjs','site/src/data/og-cards.mjs'})
 for n,r in g['generatorInputs'].items():shape(r,'gitBlob sha256');need(r=={k:sf[n][k] for k in ('gitBlob','sha256')})
 controls=m['controlSha256'];need(set(controls)=={'_headers','_redirects','_routes.json'})
 for n,h in controls.items():need(h==f[n]['sha256']==sha(sources['site/public/'+n])==sf['site/public/'+n]['sha256'])
 need(m['workerCompilation']=={'format':'raw-es-module-javascript','compilerOutputFiles':['index.js'],'compilerOutputSha256':f['_worker.js']['sha256'],'stagedWorkerSha256':f['_worker.js']['sha256'],'syntaxGate':'node --input-type=module --check','syntaxGatePassed':True,'staging':'byte-for-byte-copy','additionalModulesPolicy':'reject'})
 need(set(m['tools'])=={'node','pnpm','wrangler','miniflare','workerd','esbuild'} and all(type(x) is str and re.fullmatch('[0-9][a-zA-Z0-9.+-]{0,80}',x) for x in m['tools'].values()))
 need(set(m['producerRecordedToolFileSha256'])=={'cliLockfile','wranglerPackage','miniflarePackage','workerdPackage','nativeWorkerd','esbuildPackage'})
 for h in m['producerRecordedToolFileSha256'].values():hex64(h)
 need(m['toolIdentity']=='PRODUCER_RECORDED_HASHES_VERSION_SCHEMA_ONLY_NOT_REHASHED')
 z=m['zip'];shape(z,'sha256 bytes fileCount ceilingBytes format compression collisionRule unicodeVersion');need(z['sha256']==ZIP_SHA and z['bytes']==9212002 and z['fileCount']==713 and z['ceilingBytes']==26214400 and z['format']=='canonical-deflate-zip' and z['collisionRule']=='NFC-casefold-NFC-components-spelling-and-kind')
 shape(z['compression'],'method level python zlibRuntime');need(z['compression']['method']=='deflate' and z['compression']['level']=='zlib-default')
 for v in (z['unicodeVersion'],z['compression']['python'],z['compression']['zlibRuntime']):need(type(v) is str and re.fullmatch('[0-9]+(?:\.[0-9]+){1,3}',v))
 shape(m['checks'],'trustedSchema2VerifiedBeforeDerivation everyMemberBytesNamesModes zipRereadCrcHashSet originalFrozenBeforeAfter pathCollisionsRejected actualZipWithinConservativeCeiling');need(all(x is True for x in m['checks'].values()))
 return m
def outputs(m,oracle,identity):
 o=m['original'];z=m['zip']
 binding={'projection_schema_version':1,'canonical_rule':CANON_RULE,'labels':LABELS,'status':'METADATA_PROJECTED_NOT_READY_NOT_ACCEPTED',
  'flags':{k:False for k in ('releaseAccepted','promotionAllowed','runtimeAccepted','visualQa','fitQualified')},
  'source':{'repository':REPO,'sha':SOURCE,'tree':o['sourceTree']},
  'candidate':{'producer_sha':PRODUCER,'run_id':o['runId'],'run_attempt':o['runAttempt'],'artifact_id':o['artifactId'],'outer_zip_bytes':o['outerZipBytes'],'outer_zip_sha256':o['outerZipSha256'],'inner_sha256':o['innerSha256']},
  'transport':{'head_sha':TRANSPORT,'run_id':str(RUN),'run_attempt':'1','bundle_artifact_id':ARTIFACT,'bundle_outer_zip_bytes':SIZE,'bundle_outer_zip_sha256':OUTER,'record_sha256':RECORD_SHA,'zip_sha256':ZIP_SHA,'zip_bytes':z['bytes'],'file_count':z['fileCount'],'ceiling_bytes':z['ceilingBytes'],'format':z['format'],'compression':z['compression'],'collision_rule':z['collisionRule'],'unicode_version':z['unicodeVersion']},
  'worker':m['workerCompilation'],'controls':m['controlSha256'],
  'source_inputs':{'count':435,'canonical_substructure_sha256':sha(canon(m['sourceFiles']))},
  'generated_outputs':{'count':115,'canonical_substructure_sha256':sha(canon(m['generatedOutputs']))},
  'tools':m['tools'],'recorded_tool_files':m['producerRecordedToolFileSha256'],'tool_identity':m['toolIdentity'],'inherited_checks':m['checks'],'projection_provenance':identity}
 index={'projection_schema_version':1,'canonical_rule':CANON_RULE,'identity_ref':'identity-binding.json','transport_record_sha256':RECORD_SHA,'files':[{'path':n,'bytes':r['bytes'],'mode':r['mode'],'sha256':r['sha256']} for n,r in sorted(m['files'].items())]}
 oracle['source_control_hashes']={n:m['files'][n]['sha256'] for n in ('_headers','_redirects','_routes.json','_worker.js')}
 data={'identity-binding.json':binding,'public-file-index.json':index,'row-oracles.json':oracle}
 validate_output(data)
 return data
def validate_runtime(provenance):
 shape(provenance,'repository implementation_sha script_hashes workflow_path workflow_sha workflow_ref run_id run_attempt event job_id actor serialization_runtime')
 need(provenance['repository']==REPO and re.fullmatch('[0-9a-f]{40}',provenance['implementation_sha']) and provenance['workflow_sha']==provenance['implementation_sha'] and provenance['workflow_path']=='.github/workflows/build.yml')
 paths={'site/scripts/pr217-projection/'+n for n in ('project.py','oracles.py','test-project.py')};need(set(provenance['script_hashes'])==paths)
 for h in provenance['script_hashes'].values():hex64(h)
 runtime=provenance['serialization_runtime'];shape(runtime,'canonical_rule_id encoder_id python_implementation python_version approved_implementation_sha approved_script_path approved_script_sha256')
 need(runtime['canonical_rule_id']==CANON_RULE and runtime['encoder_id']=='cpython-stdlib-json.dumps' and runtime['python_implementation']=='cpython' and type(runtime['python_version']) is str and re.fullmatch('[0-9]+\.[0-9]+\.[0-9]+',runtime['python_version']) and 1<=len(runtime['python_version'].encode('ascii'))<=32)
 need(runtime['approved_implementation_sha']==provenance['implementation_sha'] and runtime['approved_script_path']=='site/scripts/pr217-projection/project.py' and runtime['approved_script_sha256']==provenance['script_hashes'][runtime['approved_script_path']])
 need(provenance['run_attempt']=='1' and provenance['event']=='workflow_dispatch' and provenance['actor']=='khanjer496-alt' and type(provenance['job_id']) is int and provenance['job_id']>0 and re.fullmatch('[1-9][0-9]*',provenance['run_id']) and provenance['workflow_ref']==REPO+'/.github/workflows/build.yml@'+REF)

def validate_output(data):
 need(set(data)==set(CAPS))
 identity=data['identity-binding.json'];shape(identity,'projection_schema_version canonical_rule labels status flags source candidate transport worker controls source_inputs generated_outputs tools recorded_tool_files tool_identity inherited_checks projection_provenance')
 index=data['public-file-index.json'];shape(index,'projection_schema_version canonical_rule identity_ref transport_record_sha256 files')
 rows=data['row-oracles.json'];shape(rows,'projection_schema_version canonical_rule identity_ref source_control_hashes provenance_registry header_sets rows unbound_gates')
 need(all(x['projection_schema_version']==1 and x['canonical_rule']==CANON_RULE for x in data.values()))
 need(identity['labels']==LABELS and identity['status']=='METADATA_PROJECTED_NOT_READY_NOT_ACCEPTED');shape(identity['flags'],'releaseAccepted promotionAllowed runtimeAccepted visualQa fitQualified');need(all(x is False for x in identity['flags'].values()))
 shape(identity['source'],'repository sha tree');shape(identity['candidate'],'producer_sha run_id run_attempt artifact_id outer_zip_bytes outer_zip_sha256 inner_sha256');shape(identity['transport'],'head_sha run_id run_attempt bundle_artifact_id bundle_outer_zip_bytes bundle_outer_zip_sha256 record_sha256 zip_sha256 zip_bytes file_count ceiling_bytes format compression collision_rule unicode_version')
 for key,count in (('source_inputs',435),('generated_outputs',115)):
  shape(identity[key],'count canonical_substructure_sha256');need(identity[key]['count']==count);hex64(identity[key]['canonical_substructure_sha256'])
 validate_runtime(identity['projection_provenance'])
 need(index['identity_ref']==rows['identity_ref']=='identity-binding.json' and index['transport_record_sha256']==RECORD_SHA and len(index['files'])==713)
 names=[]
 for r in index['files']:
  shape(r,'path bytes mode sha256');need(type(r['path']) is str and len(r['path'].encode('utf8'))<=384 and type(r['bytes']) is int and 0<=r['bytes']<=166366 and r['mode']==0o644);hex64(r['sha256']);names.append(r['path'])
 need(names==sorted(names) and len(set(names))==713)
 need(set(rows['source_control_hashes'])=={'_headers','_redirects','_routes.json','_worker.js'} and [x['id'] for x in rows['rows']]==list(range(1,53)) and rows['unbound_gates'])
 registry=rows['provenance_registry']
 for r in registry.values():
  if r['kind']=='GIT_SOURCE':shape(r,'kind repository sha path git_blob sha256 line_start line_end');need(r['repository']==REPO and r['sha']==SOURCE and r['path'] in SOURCE_PATHS and re.fullmatch('[a-f0-9]{40}',r['git_blob']) and type(r['line_start']) is int and type(r['line_end']) is int and 1<=r['line_start']<=r['line_end']);hex64(r['sha256'])
  else:shape(r,'kind record_sha256 json_pointer');need(r['kind']=='AUTHENTICATED_TRANSPORT_RECORD' and r['record_sha256']==RECORD_SHA and r['json_pointer'].startswith('/files/'))
 def field(v):
  shape(v,'state value provenance_ref reason_enum');need(v['state'] in ('SOURCE_BOUND','UNBOUND','NOT_APPLICABLE') and (v['state']=='SOURCE_BOUND' or v['value'] is None) and type(v['reason_enum']) is str and re.fullmatch('[A-Z0-9_]{1,80}',v['reason_enum']) and (v['provenance_ref'] is None or v['provenance_ref'] in registry))
  if v['state']=='SOURCE_BOUND':need(v['provenance_ref'] in registry)
 for row in rows['rows']:
  shape(row,'id host_role client_role method path accept ua phase kind oracles');need(row['host_role'] in ('I','B','P') and row['client_role'] in ('A','D') and row['method'] in ('GET','HEAD') and row['ua']=='PostDelegate-PR217-Diagnostic-v1')
  need(set(row['oracles'])<=set('member body_sha256 body_bytes status header_profile canonical_body location source_404_candidate content_location root_direct_vary'.split()))
  for v in row['oracles'].values():field(v)
  need(row['oracles']['header_profile']['value'] in rows['header_sets'])
  if row['method']=='HEAD':need(row['oracles']['body_sha256']['state']=='NOT_APPLICABLE')
 for key,value in rows['header_sets'].items():
  if key.startswith('profile:'):
   shape(value,'header_set security_headers cache media_type delivery platform_noindex')
   for v in value.values():field(v)
   if value['header_set']['state']=='SOURCE_BOUND':need(value['header_set']['value'] in rows['header_sets'])
  else:need(key=='security' or key.startswith('headers:'));need(all(type(n) is str and type(v) is str and len(v.encode('utf8'))<=2048 for n,v in value.items()))
 json_data(data)

def encode_output(data):
 need(set(data)==set(CAPS));raw={n:canon(v)+b'\n' for n,v in data.items()}
 need(all(len(raw[n])<=CAPS[n] for n in CAPS) and sum(map(len,raw.values()))<=608*1024)
 # Stricter source-side reserve for three-file level0 upload ZIP overhead. The actual
 # provider ZIP size/digest still requires API readback before acceptance/download.
 need(sum(map(len,raw.values()))<=240*1024)
 b=io.BytesIO()
 with zipfile.ZipFile(b,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=0) as z:
  for n,v in sorted(raw.items()):z.writestr(n,v)
 need(len(b.getvalue())<=256*1024)
 return raw
def check_uploaded_metadata(a,artifact_id,sha_value,head,run):
 need(a['id']==artifact_id and 0<a['size_in_bytes']<=256*1024 and a['expired'] is False)
 need(a['digest']=='sha256:'+sha_value and a['workflow_run']['id']==int(run) and a['workflow_run']['head_sha']==head and a['workflow_run']['repository_id']==a['workflow_run']['head_repository_id']==1439958050)
 need(a['name']=='NON_RELEASE-NOT_ACCEPTED-METADATA-PROJECTION-'+head+'-'+run+'-1')
def post_upload(reader):
 value=os.environ['PROJECTION_ARTIFACT_ID'];digest=os.environ['PROJECTION_ARTIFACT_DIGEST'];need(re.fullmatch('[1-9][0-9]*',value));hex64(digest)
 path='/repos/'+REPO+'/actions/artifacts/'+value
 class Api(reader.Api):
  def request(self,p):
   need(p==path);return reader.Request('https://api.github.com'+path,headers={'Authorization':'Bearer '+self.token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'pr217-metadata-size-check'})
 a=Api(os.environ['GITHUB_TOKEN'],time.monotonic()+30).json(path)
 check_uploaded_metadata(a,int(value),digest,os.environ['GITHUB_SHA'],os.environ['GITHUB_RUN_ID'])
def own_job_id(reader):
 path='/repos/'+REPO+'/actions/runs/'+os.environ['GITHUB_RUN_ID']+'/attempts/1/jobs?per_page=100'
 class Api(reader.Api):
  def request(self,p):
   need(p==path);return reader.Request('https://api.github.com'+path,headers={'Authorization':'Bearer '+self.token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'pr217-projection-job-binding'})
 data=Api(os.environ['GITHUB_TOKEN'],time.monotonic()+30).json(path);need(data['total_count']==1 and len(data['jobs'])==1)
 j=data['jobs'][0];need(j['name']=='project' and j['run_id']==int(os.environ['GITHUB_RUN_ID']) and j['head_sha']==os.environ['GITHUB_SHA'] and j['labels']==['ubuntu-latest'] and type(j['id']) is int and j['id']>0)
 return j['id']
def main():
 need(os.environ.get('GITHUB_ACTOR')=='khanjer496-alt' and sys.platform=='linux' and os.environ.get('GITHUB_ACTIONS')=='true' and os.environ.get('GITHUB_REPOSITORY')==REPO and os.environ.get('GITHUB_EVENT_NAME')=='workflow_dispatch' and os.environ.get('GITHUB_REF')==REF and os.environ.get('GITHUB_RUN_ATTEMPT')=='1')
 need(os.environ['GITHUB_WORKFLOW_REF']==REPO+'/.github/workflows/build.yml@'+REF and re.fullmatch('[1-9][0-9]*',os.environ['GITHUB_RUN_ID']))
 work=Path(os.environ['GITHUB_WORKSPACE']);sources=assert_code(work);reader=module(work/'transport-code/site/scripts/pr217-hosted-verify/verify.py','pinned_reader');collision=module(work/'transport-code/site/scripts/pr217-hosted-verify/transport.py','pinned_collision').reject_collisions;oracle=module(Path(__file__).with_name('oracles.py'),'oracle')
 if sys.argv[1]=='artifact-size-check':post_upload(reader);return 0
 end=time.monotonic()+420;api=reader_api(reader,os.environ['GITHUB_TOKEN'],end);need(bool(api.token));authenticate(api);job_id=own_job_id(reader);need(shutil.disk_usage(os.environ['RUNNER_TEMP']).free>=128*1024**2)
 target=Path(sys.argv[1]);need(not target.exists() and not target.is_symlink())
 with tempfile.TemporaryDirectory(prefix='pr217-projection-',dir=os.environ['RUNNER_TEMP']) as temp:
  p=Path(temp);archive=p/'transport.zip';api.download('/repos/'+REPO+'/actions/artifacts/'+str(ARTIFACT)+'/zip',archive)
  m=validate_record(read_container(archive,end),collision,work/'source',sources)
  need(os.environ['GITHUB_ACTOR']=='khanjer496-alt')
  identity={'repository':REPO,'implementation_sha':os.environ['GITHUB_SHA'],'script_hashes':{'site/scripts/pr217-projection/'+n:sha(Path(__file__).with_name(n).read_bytes()) for n in ('project.py','oracles.py','test-project.py')},'workflow_path':'.github/workflows/build.yml','workflow_sha':os.environ['PROJECTION_WORKFLOW_SHA'],'workflow_ref':os.environ['GITHUB_WORKFLOW_REF'],'run_id':os.environ['GITHUB_RUN_ID'],'run_attempt':'1','event':'workflow_dispatch','job_id':job_id,'actor':os.environ['GITHUB_ACTOR']}
  need(sys.implementation.name=='cpython' and sys.version_info.releaselevel=='final')
  script='site/scripts/pr217-projection/project.py'
  identity['serialization_runtime']={'canonical_rule_id':CANON_RULE,'encoder_id':'cpython-stdlib-json.dumps','python_implementation':'cpython','python_version':'.'.join(map(str,sys.version_info[:3])),'approved_implementation_sha':identity['implementation_sha'],'approved_script_path':script,'approved_script_sha256':identity['script_hashes'][script]}

  raw=encode_output(outputs(m,oracle.build(m['files'],sources,PACKETS,{n:git(work/'source','rev-parse',SOURCE+':'+n).decode().strip() for n in sources}),identity));assert_code(work);need(time.monotonic()<end)
 # No payload or source code is copied to projection output. Cleanup failure above
 # refuses before output publication. No helper/body verifier/process is launched.
 target.mkdir(mode=0o700)
 for n,b in raw.items():
  with (target/n).open('xb') as f:os.chmod(target/n,0o600);f.write(b)
 return 0
if __name__=='__main__':
 try:sys.exit(main())
 except Exception:sys.exit(1)
