#!/usr/bin/env python3
"""Prepared hosted-only read-only verification; never execute artifact contents."""
import hashlib,importlib.util,json,os,re,shutil,signal,stat,subprocess,sys,tarfile,tempfile,time,zipfile
from pathlib import Path
from urllib.request import Request,build_opener,HTTPRedirectHandler,ProxyHandler
from urllib.error import HTTPError
from urllib.parse import urlsplit
sys.dont_write_bytecode=True
REPO='khanjer496-alt/postdelegate';SOURCE='7c84b1ebffbccb731a972c2ff55e6bc0accea663';APPROVED='6708125ffc150c9d692dc8698dbe1ddae0cdedce'
REF='refs/heads/test/pr217-transport-6708-20261115';PRODUCER_REF='test/pr217-generated-provenance-7c84-20261115'
RUN=43670231792;ARTIFACT=14144390000;SIZE=8561290;DIGEST='1b689f33e3b3d8d1d51302f1c077e084cb206bbf801829254f772f4cc2b41b66'
NAME='NON_RELEASE-LOCAL_PREVIEW_FAILED-NOT_ACCEPTED-pr217-'+SOURCE+'-producer-'+APPROVED+'-'+str(RUN)+'-1'
FILES={'NON_RELEASE.json':4096,'candidate-manifest.json':8*1024**2,'worker-format.json':16384,'candidate-payload.tar.gz':48*1024**2}
CODE_HASHES={'approved/site/scripts/pr217-candidate/candidate.py':'9957e9448e9ee82f7b747a8093de3713daca78d631c257e43865d9554057ff94','source/site/scripts/accept-public-payload.py':'1290e9a24ac94174da6dfdd18a77399c43d6c8a7c59482ae71079daf6800fac5','source/site/src/data/og-cards.mjs':'a805c0fd140089c0ab2194467ce454cb6215d93794b15361fb712100fae81adf'}
ALLOWED_API_PATHS={
 '/repos/'+REPO+'/actions/workflows/401992919',
 '/repos/'+REPO+'/actions/runs?head_sha='+APPROVED+'&per_page=100',
 '/repos/'+REPO+'/actions/runs/'+str(RUN),
 '/repos/'+REPO+'/actions/runs/'+str(RUN)+'/attempts/1/jobs?per_page=100',
 '/repos/'+REPO+'/actions/artifacts/'+str(ARTIFACT),
 '/repos/'+REPO+'/actions/artifacts/'+str(ARTIFACT)+'/zip'}
class Rejected(Exception):
 def __init__(self,category):self.category=category
class NoRedirect(HTTPRedirectHandler):
 def redirect_request(self,*args):return None

def need(ok,category):
 if not ok:raise Rejected(category)
def digest(path):
 h=hashlib.sha256()
 with open(path,'rb') as f:
  for chunk in iter(lambda:f.read(65536),b''):h.update(chunk)
 return h.hexdigest()
def git(root,*args):return subprocess.check_output(['git','-C',str(root),*args],stderr=subprocess.DEVNULL,timeout=15)
def deadline_check(end):need(time.monotonic()<end,'deadline')

def signed_download_url(url):
 p=urlsplit(url)
 need(p.scheme=='https' and not p.username and not p.password and p.port in (None,443) and not p.fragment,'download-redirect')
 need(bool(re.fullmatch(r'[a-z0-9-]+\.blob\.core\.windows\.net',p.hostname or '')),'download-host')
 return url

class Api:
 def __init__(self,token,end,opener=None):
  self.token=token;self.end=end;self.opener=opener or build_opener(ProxyHandler({}),NoRedirect())
 def request(self,path):
  deadline_check(self.end)
  need(path in ALLOWED_API_PATHS,'api-scope')
  return Request('https://api.github.com'+path,headers={'Authorization':'Bearer '+self.token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'pr217-readonly-verification'})
 def json(self,path):
  try:
   with self.opener.open(self.request(path),timeout=15) as r:
    need(r.status==200,'api-status');body=read_bounded(r,2*1024**2,self.end)
   deadline_check(self.end);return json.loads(body)
  except HTTPError as e:
   code=e.code
   if e.fp is not None:e.fp.close()
   raise Rejected({401:'api-auth',403:'api-permission',404:'api-missing',429:'api-rate'}.get(code,'api-http')) from None
 def download(self,path,destination):
  try:
   with self.opener.open(self.request(path),timeout=15):raise Rejected('download-no-redirect')
  except HTTPError as e:
   try:need(e.code==302,'download-api-status');url=signed_download_url(e.headers.get('Location',''))
   finally:
    if e.fp is not None:e.fp.close()
  # NEW request has NO Authorization/cookie; never forward API token to signed blob host.
  request=Request(url,headers={'User-Agent':'pr217-readonly-verification'})
  with self.opener.open(request,timeout=15) as r:
   need(r.status==200,'download-status');stream_zip(r,destination,SIZE,DIGEST,self.end)

def read_bounded(stream,limit,end):
 read=getattr(stream,'read1',None);need(callable(read),'unsupported-stream')
 result=bytearray()
 while True:
  deadline_check(end);chunk=read(min(65536,limit-len(result)+1))
  if not chunk:break
  result.extend(chunk);need(len(result)<=limit,'api-size')
 return bytes(result)

def stream_zip(stream,path,size,expected,end):
 total=0;h=hashlib.sha256()
 with open(path,'xb') as f:
  os.chmod(path,0o600)
  while True:
   deadline_check(end);read=getattr(stream,'read1',None);need(callable(read),'unsupported-stream');b=read(65536)
   if not b:break
   total+=len(b);need(total<=size,'download-size');h.update(b);f.write(b)
 need(total==size and h.hexdigest()==expected,'outer-zip-digest')

def check_run(r):
 need(r['id']==RUN and r['head_sha']==APPROVED and r['head_branch']==PRODUCER_REF and r['event']=='push' and r['run_attempt']==1 and r['status']=='completed' and r['conclusion']=='success' and r['workflow_id']==418794074 and r['path']=='.github/workflows/pr217-nonrelease-candidate.yml','run-identity')
 need(r['repository']['full_name']==REPO and r['head_repository']['full_name']==REPO and r['actor']['login']=='openbotgit[bot]','run-repository-actor')
def check_jobs(j):
 need(j['total_count']==1 and len(j['jobs'])==1,'job-count')
 job=j['jobs'][0];need(job['id']==132678438464 and job['name']=='candidate' and job['status']=='completed' and job['conclusion']=='success','job-identity')
 for name in ['Tiny fake contract checks only','Full frozen source build and raw compilation into NON_RELEASE bundle only','Store explicitly NOT_ACCEPTED candidate (never site-public release upload)','Store bounded phase receipt only (never a payload)']:
  found=[s for s in job['steps'] if s['name']==name];need(len(found)==1 and found[0]['conclusion']=='success','job-step')
def check_artifact(a):
 need(a['id']==ARTIFACT and a['name']==NAME and a['size_in_bytes']==SIZE and a['digest']=='sha256:'+DIGEST and a['expired'] is False,'artifact-identity')
 w=a['workflow_run'];need(w['id']==RUN and w['head_sha']==APPROVED and w['head_branch']==PRODUCER_REF and w['repository_id']==1439958050 and w['head_repository_id']==1439958050,'artifact-run')

def check_zip_members(members):
 need(len(members)==4 and {i.filename for i in members}==set(FILES),'zip-layout')
 need(sum(i.file_size for i in members)<=64*1024**2,'zip-size')
 for i in members:
  mode=i.external_attr>>16
  need(not i.is_dir() and not(i.flag_bits&1) and stat.S_IFMT(mode) in (0,stat.S_IFREG) and not(i.external_attr&0x10),'zip-type')
  need(i.compress_type in (zipfile.ZIP_STORED,zipfile.ZIP_DEFLATED) and 0<=i.file_size<=FILES[i.filename],'zip-bound')

def extract_fixed(zip_path,destination,end=None):
 need(not destination.exists(),'extraction-target');destination.mkdir(mode=0o700)
 with zipfile.ZipFile(zip_path) as z:
  members=z.infolist();check_zip_members(members)
  for i in members:
   total=0
   with z.open(i) as src,open(destination/i.filename,'xb') as out:
    os.chmod(destination/i.filename,0o600)
    while True:
     if end is not None:deadline_check(end)
     b=src.read(65536)
     if not b:break
     total+=len(b);need(total<=i.file_size,'zip-expansion');out.write(b)
   need(total==i.file_size,'zip-length')

def assert_code(workspace):
 driver=workspace/'wrapper';approved=workspace/'approved';source=workspace/'source'
 need(git(driver,'rev-parse','HEAD').decode().strip()==os.environ['VERIFIER_WORKFLOW_SHA']==os.environ['GITHUB_SHA'],'wrapper-sha')
 need(git(driver,'show','-s','--format=%P','HEAD').decode().strip()==APPROVED,'wrapper-parent')
 expected={'M\t.github/workflows/build.yml','A\tsite/scripts/pr217-hosted-verify/verify.py','A\tsite/scripts/pr217-hosted-verify/test-verify.py','A\tsite/scripts/pr217-hosted-verify/transport.py','A\tsite/scripts/pr217-hosted-verify/test-transport.py'}
 need(set(git(driver,'diff-tree','--no-commit-id','--name-status','-r','HEAD').decode().splitlines())==expected,'wrapper-diff')
 need(git(approved,'rev-parse','HEAD').decode().strip()==APPROVED and git(source,'rev-parse','HEAD').decode().strip()==SOURCE,'trusted-checkout')
 for name,value in CODE_HASHES.items():need(digest(workspace/name)==value,'trusted-code-hash')
 for name in ('verify.py','transport.py','test-verify.py','test-transport.py'):
  rel='site/scripts/pr217-hosted-verify/'+name
  need((driver/rel).read_bytes()==git(driver,'show','HEAD:'+rel),'wrapper-modified')

def owned_group_state(process):
 # Reap/check the leader, then independently test the originally owned session group.
 try:leader_exited=process.poll() is not None
 except Exception:return 'unknown'
 try:
  os.killpg(process.pid,0)
 except ProcessLookupError:return 'absent' if leader_exited else 'unknown'
 except Exception:return 'unknown'
 return 'present'

def confirm_owned_group_absent(process):
 state=owned_group_state(process)
 if state=='absent':return False
 need(state=='present','helper-cleanup-unconfirmed')
 for sig in (signal.SIGTERM,signal.SIGKILL):
  # Escalate only from a confirmed-present group; never from denied/unknown state.
  try:os.killpg(process.pid,sig)
  except ProcessLookupError:pass
  except Exception:raise Rejected('helper-cleanup-unconfirmed') from None
  limit=time.monotonic()+5
  while True:
   state=owned_group_state(process)
   if state=='absent':return True
   need(state=='present','helper-cleanup-unconfirmed')
   if time.monotonic()>=limit:break
   time.sleep(0.05)
 raise Rejected('helper-cleanup-unconfirmed')

def run_trusted_helper(approved,source,bundle,private,end,popen=subprocess.Popen):
 deadline_check(end)
 # No token/auth/proxy environment is passed to helper/Git/pure Node module evaluation.
 env={k:v for k,v in os.environ.items() if k in ('PATH','LANG','LC_ALL')};env.update(HOME=str(private/'helper-home'),TMPDIR=str(private))
 Path(env['HOME']).mkdir()
 process=popen([sys.executable,'-B','-I',str(approved/'site/scripts/pr217-candidate/candidate.py'),'verify',str(source),str(bundle)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,env=env,start_new_session=True)
 failure=None;code=None
 try:code=process.wait(timeout=min(180,max(1,end-time.monotonic())))
 except subprocess.TimeoutExpired:failure='helper-timeout'
 except Exception:failure='helper-wait-failure'
 try:descendants=confirm_owned_group_absent(process)
 except Exception:raise Rejected('helper-cleanup-unconfirmed') from None
 if failure:raise Rejected(failure)
 need(not descendants,'helper-descendants')
 need(code==0,'trusted-schema2-helper')

def check_manifest(m,approved,source):
 need(m['schemaVersion']==2 and m['sourceSha']==SOURCE and m['sourceTree']==git(source,'rev-parse',SOURCE+'^{tree}').decode().strip(),'manifest-source')
 p=m['producer'];need(p['sha']==APPROVED and p['workflowSha']==APPROVED and p['runId']==str(RUN) and p['runAttempt']=='1' and p['event']=='push' and p['ref']=='refs/heads/'+PRODUCER_REF,'manifest-producer')
 need(p['workflowRef']==REPO+'/.github/workflows/pr217-nonrelease-candidate.yml@refs/heads/'+PRODUCER_REF,'manifest-workflow')
 paths={'.github/workflows/pr217-nonrelease-candidate.yml',*['site/scripts/pr217-candidate/'+n for n in ('candidate.py','producer.sh','tool-metadata.mjs','test-candidate.py')]}
 need(set(p['files'])==paths,'producer-files')
 for name in paths:
  b=git(approved,'show',APPROVED+':'+name)
  need(p['files'][name]=={'gitBlob':git(approved,'rev-parse',APPROVED+':'+name).decode().strip(),'sha256':hashlib.sha256(b).hexdigest()},'producer-file-hash')
 need(set(m['tools'])=={'node','pnpm','wrangler','miniflare','workerd','esbuild'} and all(type(x) is str and re.fullmatch('[0-9][a-zA-Z0-9.+-]{0,80}',x) for x in m['tools'].values()),'recorded-tool-version-schema')
 need(len(m['generatedOutputs']['mapping'])==115 and len(m['generatedOutputs']['outputs'])==115,'generated-count')

def metrics(bundle,m):
 with tarfile.open(bundle/'candidate-payload.tar.gz','r:gz') as t:
  members=t.getmembers();need(len(members)==len(m['files']) and all(x.isfile() for x in members),'metrics-inventory')
  return {'fileCount':len(members),'htmlCount':sum(x.name.endswith('.html') for x in members),
   'maxFileBytes':max((x.size for x in members),default=0),'totalBytes':sum(x.size for x in members),
   'generatedOutputs':len(m['generatedOutputs']['outputs']),'sourceInputs':len(m['sourceFiles']),
   'protectedStaticFiles':sum(n.startswith('site/public/') and n not in m['generatedOutputs']['outputs'] for n in m['sourceFiles'])}

def load_transport():
 path=Path(__file__).with_name('transport.py')
 spec=importlib.util.spec_from_file_location('transport',path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
 return module

def main():
 if sys.platform!='linux' or os.environ.get('GITHUB_ACTIONS')!='true':return 2
 result={'schemaVersion':1,'labels':['NON_RELEASE','LOCAL_PREVIEW_FAILED','NOT_ACCEPTED'],'releaseAccepted':False,'promotionAllowed':False,'status':'FAILED_NOT_ACCEPTED','producerRun':RUN,'artifactId':ARTIFACT,'expectedOuterZipSha256':DIGEST,'outerZipVerified':False,'metrics':None}
 private=None;stage='context';cleanup=True;cleanup_allowed=True;transport_stage=None;record=None;transport=None
 output=Path(sys.argv[1]);published=False
 try:
  need(os.environ.get('GITHUB_REPOSITORY')==REPO and os.environ.get('GITHUB_EVENT_NAME')=='workflow_dispatch' and os.environ.get('GITHUB_REF')==REF and os.environ.get('GITHUB_RUN_ATTEMPT')=='1','verifier-context')
  need(os.environ.get('GITHUB_WORKFLOW_REF')==REPO+'/.github/workflows/build.yml@'+REF and bool(re.fullmatch('[1-9][0-9]*',os.environ.get('GITHUB_RUN_ID',''))),'wrapper-workflow-context')
  workspace=Path(os.environ['GITHUB_WORKSPACE']);assert_code(workspace);transport=load_transport()
  result.update(verifierCommit=os.environ['GITHUB_SHA'],verifierRunId=os.environ['GITHUB_RUN_ID'],verifierAttempt=1,producerHead=APPROVED,sourceSha=SOURCE)
  end=time.monotonic()+420;token=os.environ.get('GITHUB_TOKEN','');need(bool(token),'missing-ephemeral-token');api=Api(token,end)
  stage='api-provenance'
  workflow=api.json('/repos/'+REPO+'/actions/workflows/401992919');need(workflow['id']==401992919 and workflow['path']=='.github/workflows/build.yml' and workflow['state']=='active','registered-wrapper-workflow')
  runs=api.json('/repos/'+REPO+'/actions/runs?head_sha='+APPROVED+'&per_page=100');need(runs['total_count']==1 and len(runs['workflow_runs'])==1 and runs['workflow_runs'][0]['id']==RUN,'caused-run-count')
  check_run(api.json('/repos/'+REPO+'/actions/runs/'+str(RUN)))
  check_jobs(api.json('/repos/'+REPO+'/actions/runs/'+str(RUN)+'/attempts/1/jobs?per_page=100'))
  artifact=api.json('/repos/'+REPO+'/actions/artifacts/'+str(ARTIFACT));check_artifact(artifact)
  need(shutil.disk_usage(os.environ['RUNNER_TEMP']).free>=512*1024**2,'runner-disk-reserve')
  private=Path(tempfile.mkdtemp(prefix='pr217-readonly-',dir=os.environ['RUNNER_TEMP']))
  stage='outer-download';archive=private/'candidate.zip';api.download('/repos/'+REPO+'/actions/artifacts/'+str(ARTIFACT)+'/zip',archive);result.update(outerZipVerified=True,outerZipSha256=DIGEST)
  stage='safe-zip';bundle=private/'bundle';extract_fixed(archive,bundle,end)
  frozen=transport.freeze_original(bundle,end)
  stage='trusted-helper';assert_code(workspace);run_trusted_helper(workspace/'approved',workspace/'source',bundle,private,end)
  stage='manifest-provenance';m=json.loads((bundle/'candidate-manifest.json').read_text());check_manifest(m,workspace/'approved',workspace/'source')
  stage='metrics';deadline_check(end);verified_metrics=metrics(bundle,m);deadline_check(end)
  need(verified_metrics=={'fileCount':713,'htmlCount':491,'maxFileBytes':166366,'totalBytes':35703988,'generatedOutputs':115,'sourceInputs':435,'protectedStaticFiles':30},'original-metrics')
  stage='same-byte-transport';transport_stage=Path(tempfile.mkdtemp(prefix='pr217-transport-',dir=os.environ['RUNNER_TEMP']))
  identity={'sha':os.environ['GITHUB_SHA'],'workflowSha':os.environ['VERIFIER_WORKFLOW_SHA'],'workflowRef':os.environ['GITHUB_WORKFLOW_REF'],'runId':os.environ['GITHUB_RUN_ID'],'runAttempt':'1','event':'workflow_dispatch','ref':REF}
  origin={'repository':REPO,'sourceSha':SOURCE,'producerSha':APPROVED,'runId':str(RUN),'runAttempt':'1','artifactId':ARTIFACT,'outerZipBytes':SIZE,'outerZipSha256':DIGEST}
  try:record=transport.derive(bundle,m,frozen,transport_stage/'bundle',identity,origin,end)
  except Exception:raise Rejected('transport-boundary') from None
  assert_code(workspace);deadline_check(end)
  result['metrics']=verified_metrics
  result['transport']={'zipSha256':record['zip']['sha256'],'zipBytes':record['zip']['bytes'],'recordSha256':transport.sha_file(transport_stage/'bundle'/'transport-record.json',end),'sameByteMembers':713}
  result.update(status='TRANSPORT_VERIFIED_NON_RELEASE_NOT_ACCEPTED',checks={'apiProvenance':True,'outerZip':True,'fixedFourRegularMembers':True,'trustedSchema2Helper':True,'pristineSourceInputs':True,'generatedRunPayloadArchive':True,'protectedStaticEquality':True,'workerControlsArchive':True},
   toolIdentity='PRODUCER_RECORDED_HASHES_VERSION_SCHEMA_ONLY_NOT_REHASHED',producerSyntaxGateRecordedOnly=True,runtimeAccepted=False,visualQa=False,fitQualified=False)
 except Rejected as error:
  result.update(failedStage=stage,category=error.category)
  if error.category=='helper-cleanup-unconfirmed':cleanup_allowed=False
 except Exception:result.update(failedStage=stage,category='unclassified-failure')
 finally:
  if private is not None:
   if cleanup_allowed:
    try:shutil.rmtree(private)
    except Exception:cleanup=False
   else:cleanup=False
  result['ownedTempCleaned']=cleanup
  if not cleanup:
   result.update(status='FAILED_NOT_ACCEPTED');result.setdefault('category','owned-temp-cleanup');result['metrics']=None
  try:
   output.parent.mkdir(mode=0o700)
   if result['status']=='TRANSPORT_VERIFIED_NON_RELEASE_NOT_ACCEPTED' and cleanup:
    transport.check_staged(transport_stage/'bundle',record,end)
    deadline_check(end);need(not (output.parent/'transport').exists(),'transport-target')
    # Original temp has been removed only after confirmed helper-group absence.
    # Atomic directory rename keeps partial bundles outside the workflow upload selector.
    (transport_stage/'bundle').rename(output.parent/'transport');published=True
  except Exception:result.update(status='FAILED_NOT_ACCEPTED',category='transport-publication')
  if transport_stage is not None:
   try:shutil.rmtree(transport_stage)
   except Exception:result.update(status='FAILED_NOT_ACCEPTED',category='transport-stage-cleanup');result['ownedTempCleaned']=False
  if result['status']!='TRANSPORT_VERIFIED_NON_RELEASE_NOT_ACCEPTED':
   result['metrics']=None;result.pop('transport',None)
   if published:
    try:shutil.rmtree(output.parent/'transport')
    except Exception:result['ownedTempCleaned']=False

  data=json.dumps(result,indent=2)+'\n';need(len(data.encode())<=16384,'result-size')
  with output.open('x') as f:f.write(data)
 return 0 if result['status']=='TRANSPORT_VERIFIED_NON_RELEASE_NOT_ACCEPTED' else 1
if __name__=='__main__':
 try:sys.exit(main())
 except Exception:sys.exit(1) # No exception prose/paths/token-bearing request representation.
