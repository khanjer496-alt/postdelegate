#!/usr/bin/env python3
"""Tiny synthetic metadata/network/ZIP fixtures only; no network or trusted-helper execution."""
import copy,hashlib,importlib.util,io,json,os,stat,sys,tempfile,time,unittest,warnings,zipfile
from pathlib import Path
from urllib.error import HTTPError
from email.message import Message
from unittest.mock import patch
from types import SimpleNamespace
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('readonly_verifier',Path(__file__).with_name('verify.py'));v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
class Response(io.BytesIO):
 status=200
class Metadata(unittest.TestCase):
 def test_run_job_artifact_identity_and_wrong_attempt(self):
  r={'id':v.RUN,'head_sha':v.APPROVED,'head_branch':v.PRODUCER_REF,'event':'push','run_attempt':1,'status':'completed','conclusion':'success','workflow_id':418794074,'path':'.github/workflows/pr217-nonrelease-candidate.yml','repository':{'full_name':v.REPO},'head_repository':{'full_name':v.REPO},'actor':{'login':'openbotgit[bot]'}}
  v.check_run(r)
  for k,x in [('head_sha','a'*40),('run_attempt',2),('event','workflow_dispatch'),('conclusion','failure')]:
   with self.subTest(k=k),self.assertRaises(v.Rejected):v.check_run({**r,k:x})
  a={'id':v.ARTIFACT,'name':v.NAME,'size_in_bytes':v.SIZE,'digest':'sha256:'+v.DIGEST,'expired':False,'workflow_run':{'id':v.RUN,'head_sha':v.APPROVED,'head_branch':v.PRODUCER_REF,'repository_id':1439958050,'head_repository_id':1439958050}}
  v.check_artifact(a)
  for k,x in [('id',123),('size_in_bytes',v.SIZE+1),('digest','sha256:'+'0'*64),('expired',True)]:
   with self.subTest(k=k),self.assertRaises(v.Rejected):v.check_artifact({**a,k:x})
  names=['Tiny fake contract checks only','Full frozen source build and raw compilation into NON_RELEASE bundle only','Store explicitly NOT_ACCEPTED candidate (never site-public release upload)','Store bounded phase receipt only (never a payload)']
  j={'total_count':1,'jobs':[{'id':132678438464,'name':'candidate','status':'completed','conclusion':'success','steps':[{'name':n,'conclusion':'success'} for n in names]}]}
  v.check_jobs(j);bad=copy.deepcopy(j);bad['jobs'][0]['steps'][1]['conclusion']='failure'
  with self.assertRaises(v.Rejected):v.check_jobs(bad)
 def test_api_scope_and_redirect_host_token_separation(self):
  class Fake:
   def __init__(self):self.calls=[]
   def open(self,request,timeout):
    self.calls.append(request)
    if len(self.calls)==1:
     headers=Message();headers['Location']='https://productionresultssa1.blob.core.windows.net/fake?sig=FAKE_SIGNED_CANARY'
     raise HTTPError(request.full_url,302,'',headers,None)
    return Response(b'abc')
  f=Fake();api=v.Api('FAKE_TOKEN_CANARY',time.monotonic()+5,f)
  with self.assertRaises(v.Rejected):api.json('/repos/other/repo/actions/artifacts/1')
  self.assertEqual(f.calls,[])
  with tempfile.TemporaryDirectory() as task,patch.object(v,'SIZE',3),patch.object(v,'DIGEST',hashlib.sha256(b'abc').hexdigest()):api.download('/repos/'+v.REPO+'/actions/artifacts/'+str(v.ARTIFACT)+'/zip',Path(task)/'zip')
  self.assertEqual(f.calls[0].get_header('Authorization'),'Bearer FAKE_TOKEN_CANARY')
  self.assertIsNone(f.calls[1].get_header('Authorization'));self.assertIsNone(f.calls[1].get_header('Cookie'))
  for url in ['http://productionresultssa1.blob.core.windows.net/x','https://evil.invalid/x','https://u:p@productionresultssa1.blob.core.windows.net/x']:
   with self.assertRaises(v.Rejected):v.signed_download_url(url)
 def test_http_permission_failure_has_no_prose(self):
  class Denied:
   def open(self,request,timeout):raise HTTPError(request.full_url,403,'PRIVATE_CANARY',Message(),None)
  with self.assertRaises(v.Rejected) as caught:v.Api('FAKE',time.monotonic()+5,Denied()).json('/repos/'+v.REPO+'/actions/runs/'+str(v.RUN))
  self.assertEqual(caught.exception.category,'api-permission');self.assertNotIn('PRIVATE',str(caught.exception))
class Bytes(unittest.TestCase):
 def test_stream_size_digest_and_deadline(self):
  with tempfile.TemporaryDirectory() as task:
   for i,(data,size,digest,end) in enumerate([(b'abc',3,hashlib.sha256(b'abc').hexdigest(),time.monotonic()+5),(b'abcd',3,'0'*64,time.monotonic()+5),(b'ab',3,'0'*64,time.monotonic()+5),(b'abc',3,'0'*64,time.monotonic()+5),(b'abc',3,'0'*64,0)]):
    path=Path(task)/str(i)
    if i==0:v.stream_zip(io.BytesIO(data),path,size,digest,end)
    else:
     with self.assertRaises(v.Rejected):v.stream_zip(io.BytesIO(data),path,size,digest,end)
 def members(self):
  out=[]
  for name in v.FILES:
   i=zipfile.ZipInfo(name);i.file_size=2;i.compress_type=zipfile.ZIP_STORED;i.external_attr=(stat.S_IFREG|0o600)<<16;out.append(i)
  return out
 def test_metadata_rejects_encrypted_links_directories_extras_duplicates_bombs(self):
  v.check_zip_members(self.members())
  for mutation in ['encrypted','symlink','directory','extra','duplicate','oversize']:
   m=self.members()
   if mutation=='encrypted':m[0].flag_bits|=1
   if mutation=='symlink':m[0].external_attr=(stat.S_IFLNK|0o777)<<16
   if mutation=='directory':m[0].external_attr|=0x10
   if mutation=='extra':m[0].filename='../escape'
   if mutation=='duplicate':m[0].filename=m[1].filename
   if mutation=='oversize':m[0].file_size=128*1024**2
   with self.subTest(mutation=mutation),self.assertRaises(v.Rejected):v.check_zip_members(m)
 def test_extract_fixed_regular_only_no_execution(self):
  with tempfile.TemporaryDirectory() as task:
   p=Path(task);z=p/'fake.zip'
   with zipfile.ZipFile(z,'w') as out:
    for name in v.FILES:out.writestr(name,b'not executable; synthetic fixture')
   v.extract_fixed(z,p/'bundle');self.assertEqual({f.name for f in (p/'bundle').iterdir()},set(v.FILES))
   with self.assertRaises(v.Rejected):v.extract_fixed(z,p/'bundle')
class HelperAndMetrics(unittest.TestCase):
 def test_helper_uses_only_pinned_code_and_no_token(self):
  calls=[]
  class FakeProcess:
   pid=123456
   def wait(self,timeout):return 0
   def poll(self):return 0
  def fake(args,**kwargs):calls.append((args,kwargs));return FakeProcess()
  with tempfile.TemporaryDirectory() as task,patch.dict(os.environ,{'GITHUB_TOKEN':'FAKE_PRIVATE_TOKEN'},clear=False),patch.object(v.os,'killpg',side_effect=ProcessLookupError):
   p=Path(task);v.run_trusted_helper(p/'approved',p/'source',p/'bundle',p,time.monotonic()+5,fake)
  args,kw=calls[0];self.assertIn('verify',args);self.assertNotIn('_input_reader',' '.join(args));self.assertNotIn('GITHUB_TOKEN',kw['env']);self.assertTrue(kw['start_new_session'])
 def test_metrics_are_actual_tar_headers(self):
  import tarfile
  with tempfile.TemporaryDirectory() as task:
   p=Path(task)
   with tarfile.open(p/'candidate-payload.tar.gz','w:gz') as t:
    for name,data in [('index.html',b'ab'),('_worker.js',b'12345')]:i=tarfile.TarInfo(name);i.size=len(data);t.addfile(i,io.BytesIO(data))
   m={'files':{'index.html':'a','_worker.js':'b'},'generatedOutputs':{'outputs':{}},'sourceFiles':{}}
   self.assertEqual(v.metrics(p,m),{'fileCount':2,'htmlCount':1,'maxFileBytes':5,'totalBytes':7,'generatedOutputs':0,'sourceInputs':0,'protectedStaticFiles':0})
class FailurePrivacy(unittest.TestCase):
 def test_failure_result_never_contains_exception_or_token(self):
  class FakeApi:
   def __init__(self,token,end):pass
   def json(self,path):raise RuntimeError('PRIVATE_CANARY headers/token/URL')
  with tempfile.TemporaryDirectory() as task:
   out=Path(task)/'result/verification.json'
   env={'GITHUB_ACTIONS':'true','GITHUB_REPOSITORY':v.REPO,'GITHUB_EVENT_NAME':'workflow_dispatch','GITHUB_REF':v.REF,'GITHUB_RUN_ATTEMPT':'1','GITHUB_RUN_ID':'999','GITHUB_WORKFLOW_REF':v.REPO+'/.github/workflows/build.yml@'+v.REF,'GITHUB_WORKSPACE':task,'GITHUB_SHA':'a'*40,'GITHUB_TOKEN':'PRIVATE_TOKEN_CANARY','RUNNER_TEMP':task}
   with patch.object(v.sys,'platform','linux'),patch.dict(os.environ,env,clear=True),patch.object(v,'assert_code',lambda root:None),patch.object(v,'Api',FakeApi),patch.object(sys,'argv',['verify.py',str(out)]):
    self.assertEqual(v.main(),1)
   data=out.read_text();self.assertNotIn('PRIVATE',data);r=json.loads(data)
   self.assertEqual(r['category'],'unclassified-failure');self.assertIsNone(r['metrics']);self.assertFalse(r['promotionAllowed'])
 def test_untrusted_helper_hash_refuses_before_network(self):
  def fake_git(root,*args):
   if args==('rev-parse','HEAD'):return (v.APPROVED if root.name=='approved' else v.SOURCE if root.name=='source' else 'a'*40).encode()
   if args[0]=='show':return v.APPROVED.encode()
   if args[0]=='diff-tree':return b'M\t.github/workflows/build.yml\nA\tsite/scripts/pr217-hosted-verify/verify.py\nA\tsite/scripts/pr217-hosted-verify/test-verify.py\nA\tsite/scripts/pr217-hosted-verify/transport.py\nA\tsite/scripts/pr217-hosted-verify/test-transport.py\n'
   raise AssertionError('unexpected fake Git')
  with patch.dict(os.environ,{'GITHUB_SHA':'a'*40,'VERIFIER_WORKFLOW_SHA':'a'*40}),patch.object(v,'git',fake_git),patch.object(v,'digest',lambda path:'bad'):
   with self.assertRaises(v.Rejected) as e:v.assert_code(Path('/synthetic'))
   self.assertEqual(e.exception.category,'trusted-code-hash')
class OwnedGroup(unittest.TestCase):
 def run_case(self,initial,states,signals,category=None):
  class Process:
   pid=123456
   def wait(self,timeout):
    if initial=='timeout':raise v.subprocess.TimeoutExpired('fake',timeout)
    return 0
   def poll(self):return 0
  def killpg(pid,sig):
   self.assertEqual(pid,123456)
   if sig==0:
    state=next(sequence)
    if state=='absent':raise ProcessLookupError()
    if state=='unknown':raise PermissionError()
   else:sent.append(sig)
  sequence=iter(states);sent=[]
  with tempfile.TemporaryDirectory() as task,patch.object(v.os,'killpg',side_effect=killpg),patch.object(v.time,'monotonic',side_effect=range(1000)),patch.object(v.time,'sleep'):
   p=Path(task)
   if category:
    with self.assertRaises(v.Rejected) as error:v.run_trusted_helper(p/'approved',p/'source',p/'bundle',p,10000,lambda *a,**k:Process())
    self.assertEqual(error.exception.category,category)
   else:v.run_trusted_helper(p/'approved',p/'source',p/'bundle',p,10000,lambda *a,**k:Process())
  self.assertEqual(sent,signals)
 def test_normal_exit_absent_group(self):self.run_case('normal',['absent'],[])
 def test_normal_exit_with_descendant_is_not_success(self):self.run_case('normal',['present','absent'],[v.signal.SIGTERM],'helper-descendants')
 def test_timed_out_leader_exits_but_group_needs_kill(self):self.run_case('timeout',['present']*7+['absent'],[v.signal.SIGTERM,v.signal.SIGKILL],'helper-timeout')
 def test_unknown_after_term_never_escalates(self):self.run_case('timeout',['present','unknown'],[v.signal.SIGTERM],'helper-cleanup-unconfirmed')
 def test_unknown_initial_state_never_signals(self):self.run_case('normal',['unknown'],[],'helper-cleanup-unconfirmed')
 def test_group_survives_kill_is_unconfirmed(self):self.run_case('timeout',['present']*20,[v.signal.SIGTERM,v.signal.SIGKILL],'helper-cleanup-unconfirmed')
 def test_unknown_after_kill_is_unconfirmed(self):self.run_case('timeout',['present']*7+['unknown'],[v.signal.SIGTERM,v.signal.SIGKILL],'helper-cleanup-unconfirmed')
 def test_unresolved_leader_wait_cannot_be_cleaned(self):
  class Process:
   pid=123456
   def wait(self,timeout):raise v.subprocess.TimeoutExpired('fake',timeout)
   def poll(self):return None
  with tempfile.TemporaryDirectory() as task,patch.object(v.os,'killpg',side_effect=ProcessLookupError):
   p=Path(task)
   with self.assertRaises(v.Rejected) as error:v.run_trusted_helper(p/'approved',p/'source',p/'bundle',p,time.monotonic()+5,lambda *a,**k:Process())
  self.assertEqual(error.exception.category,'helper-cleanup-unconfirmed')
class TerminalFailure(unittest.TestCase):
 def pipeline(self,task,helper,deadline):
  class FakeApi:
   def __init__(self,*args):pass
   def json(self,path):
    if path.endswith('401992919'):return {'id':401992919,'path':'.github/workflows/build.yml','state':'active'}
    if '?head_sha=' in path:return {'total_count':1,'workflow_runs':[{'id':v.RUN}]}
    return {}
   def download(self,path,target):target.write_bytes(b'fake')
  def extract(z,b,end):b.mkdir();(b/'candidate-manifest.json').write_text('{}')
  env={'GITHUB_ACTIONS':'true','GITHUB_REPOSITORY':v.REPO,'GITHUB_EVENT_NAME':'workflow_dispatch','GITHUB_REF':v.REF,'GITHUB_RUN_ATTEMPT':'1','GITHUB_RUN_ID':'999','GITHUB_WORKFLOW_REF':v.REPO+'/.github/workflows/build.yml@'+v.REF,'GITHUB_WORKSPACE':task,'GITHUB_SHA':'a'*40,'GITHUB_TOKEN':'FAKE','RUNNER_TEMP':task}
  out=Path(task)/'result/verification.json'
  with patch.object(v.sys,'platform','linux'),patch.dict(os.environ,env,clear=True),patch.object(v,'assert_code'),patch.object(v,'load_transport',return_value=SimpleNamespace(freeze_original=lambda *args:{})),patch.object(v,'Api',FakeApi),patch.object(v,'check_run'),patch.object(v,'check_jobs'),patch.object(v,'check_artifact'),patch.object(v,'extract_fixed',extract),patch.object(v,'run_trusted_helper',side_effect=helper),patch.object(v,'check_manifest'),patch.object(v,'metrics',return_value={'fileCount':123}),patch.object(v,'deadline_check',side_effect=deadline),patch.object(sys,'argv',['verify.py',str(out)]):
   self.assertEqual(v.main(),1)
  return json.loads(out.read_text())
 def test_deadline_after_metrics_clears_every_metric(self):
  with tempfile.TemporaryDirectory() as task:
   r=self.pipeline(task,None,[None,v.Rejected('deadline')])
   self.assertIsNone(r['metrics']);self.assertEqual(r['status'],'FAILED_NOT_ACCEPTED');self.assertTrue(r['ownedTempCleaned'])
 def test_unconfirmed_helper_retains_private_temp(self):
  with tempfile.TemporaryDirectory() as task:
   r=self.pipeline(task,v.Rejected('helper-cleanup-unconfirmed'),None)
   self.assertFalse(r['ownedTempCleaned']);self.assertIsNone(r['metrics']);self.assertEqual(len(list(Path(task).glob('pr217-readonly-*'))),1)
class TransportPublication(unittest.TestCase):
 def pipeline(self,root,fault=None):
  class FakeApi:
   def __init__(self,*args):pass
   def json(self,path):
    if path.endswith('401992919'):return {'id':401992919,'path':'.github/workflows/build.yml','state':'active'}
    if '?head_sha=' in path:return {'total_count':1,'workflow_runs':[{'id':v.RUN}]}
    return {}
   def download(self,path,target):target.write_bytes(b'fake')
  class FakeTransport:
   def freeze_original(self,*args):return {}
   def derive(self,b,m,f,stage,*args):
    stage.mkdir()
    for name in ('preview-payload.zip','transport-record.json','NON_RELEASE.json'):(stage/name).write_bytes(b'fake')
    return {'zip':{'sha256':'0'*64,'bytes':4}}
   def sha_file(self,*args):return '0'*64
   def check_staged(self,*args):
    if fault=='postflight':raise RuntimeError('FAKE_PRIVATE_CANARY')
  def extract(z,b,end):b.mkdir();(b/'candidate-manifest.json').write_text('{}')
  original=v.shutil.rmtree
  def cleanup(path,*args,**kwargs):
   if fault=='cleanup' and path.name.startswith('pr217-readonly-'):raise PermissionError('PRIVATE')
   return original(path,*args,**kwargs)
  env={'GITHUB_ACTIONS':'true','GITHUB_REPOSITORY':v.REPO,'GITHUB_EVENT_NAME':'workflow_dispatch','GITHUB_REF':v.REF,'GITHUB_RUN_ATTEMPT':'1','GITHUB_RUN_ID':'999','GITHUB_WORKFLOW_REF':v.REPO+'/.github/workflows/build.yml@'+v.REF,'GITHUB_WORKSPACE':str(root),'GITHUB_SHA':'a'*40,'VERIFIER_WORKFLOW_SHA':'a'*40,'GITHUB_TOKEN':'FAKE','RUNNER_TEMP':str(root)}
  out=root/'result/verification.json';counts={'fileCount':713,'htmlCount':491,'maxFileBytes':166366,'totalBytes':35703988,'generatedOutputs':115,'sourceInputs':435,'protectedStaticFiles':30}
  with patch.object(v.sys,'platform','linux'),patch.dict(os.environ,env,clear=True),patch.object(v,'assert_code'),patch.object(v,'load_transport',return_value=FakeTransport()),patch.object(v,'Api',FakeApi),patch.object(v,'check_run'),patch.object(v,'check_jobs'),patch.object(v,'check_artifact'),patch.object(v,'extract_fixed',extract),patch.object(v,'run_trusted_helper'),patch.object(v,'check_manifest'),patch.object(v,'metrics',return_value=counts),patch.object(v.shutil,'rmtree',side_effect=cleanup),patch.object(sys,'argv',['verify.py',str(out)]):
   code=v.main()
  return code,json.loads(out.read_text()),out.parent/'transport'
 def test_success_exposes_exact_three_files_only_after_cleanup(self):
  with tempfile.TemporaryDirectory() as temp:
   code,r,bundle=self.pipeline(Path(temp));self.assertEqual(code,0);self.assertTrue(r['ownedTempCleaned']);self.assertEqual(len(list(bundle.iterdir())),3)
 def test_cleanup_failure_never_exposes_transport_and_clears_metrics(self):
  with tempfile.TemporaryDirectory() as temp:
   code,r,bundle=self.pipeline(Path(temp),'cleanup');self.assertEqual(code,1);self.assertFalse(r['ownedTempCleaned']);self.assertFalse(bundle.exists());self.assertIsNone(r['metrics']);self.assertNotIn('transport',r)
 def test_late_staged_check_failure_never_exposes_transport(self):
  with tempfile.TemporaryDirectory() as temp:
   code,r,bundle=self.pipeline(Path(temp),'postflight');self.assertEqual(code,1);self.assertFalse(bundle.exists());self.assertIsNone(r['metrics']);self.assertNotIn('PRIVATE',json.dumps(r))
if __name__=='__main__':unittest.main()
