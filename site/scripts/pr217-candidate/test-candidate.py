#!/usr/bin/env python3
"""Tiny fake contract faults, no app/build/runtime/network. Use exact source helper read-only."""
import copy,hashlib,importlib.util,io,json,os,sys,tarfile,tempfile,unittest,subprocess,shlex
from pathlib import Path
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('candidate',Path(__file__).with_name('candidate.py'));c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
h=c.helper(Path(sys.argv.pop(1)).resolve())
class Contract(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name)
  self.source=self.root/'source';self.public=self.source/'site/public';self.public.mkdir(parents=True)
  self.payload=self.root/'payload';self.payload.mkdir();self.bundle=self.root/'NON_RELEASE-bundle'
  self.records={'site/pnpm-lock.yaml':{'sha256':'b'*64,'gitBlob':'c'*40,'bytes':0,'mode':'100644'}}
  for name in h.CONTROL:
   b=b'export default {}' if name=='_worker.js' else b'synthetic public control'
   (self.payload/name).write_bytes(b)
   if name!='_worker.js':
    (self.public/name).write_bytes(b);self.records['site/public/'+name]={'sha256':c.sha(b),'gitBlob':'c'*40,'bytes':len(b),'mode':'100644'}
  (self.payload/'index.html').write_text('<title>synthetic only</title>')
  digest=c.sha((self.payload/'_worker.js').read_bytes())
  self.fmt=self.root/'worker-format.json';self.fmt.write_text(json.dumps({'format':'raw-es-module-javascript','compilerOutputFiles':['index.js'],'compilerOutputSha256':digest,'stagedWorkerSha256':digest,'syntaxGate':'node --input-type=module --check','syntaxGatePassed':True,'staging':'byte-for-byte-copy','additionalModulesPolicy':'reject'}))
  self.context={'repository':c.REPO,'sourceSha':c.SOURCE,'sourceTree':'d'*40,'labels':c.LABELS[:],'releaseAccepted':False,'candidateLocalPreview':'NOT_RUN_NOT_ACCEPTED',
   'localVerdict':{'status':'LOCAL_PREVIEW_FAILED','sourceRunId':'43655693022','sourceSha':c.SOURCE,'diagnosticZipSha256':'2fcccf538ee7218e5e2bbeda4ed4ab8ad35e8f40c2a9b985f6c354b3f6556c3e'},
   'producer':{'sha':'a'*40,'workflowSha':'a'*40,'event':'push','ref':'refs/heads/test/pr217-nonrelease-phase-7c84-20261115','workflowRef':c.REPO+'/.github/workflows/pr217-nonrelease-candidate.yml@refs/heads/test/pr217-nonrelease-phase-7c84-20261115','created':True,'deleted':False,'forced':False,'before':'0'*40,'after':'a'*40,'initialParent':c.SOURCE,'runId':'123','runAttempt':'1','workflow':'PR217 NON_RELEASE LOCAL_PREVIEW_FAILED NOT_ACCEPTED candidate','files':{path:{'sha256':'b'*64,'gitBlob':'c'*40} for path in ['.github/workflows/pr217-nonrelease-candidate.yml',*['site/scripts/pr217-candidate/'+name for name in ('candidate.py','producer.sh','tool-metadata.mjs','test-candidate.py')]]}},
   'tools':{'node':'22.23.4','pnpm':'10.6.1','wrangler':'4.162.0'},'toolFileSha256':{k:'b'*64 for k in ['cliLockfile','wranglerPackage','miniflarePackage','workerdPackage','nativeWorkerd','esbuildPackage']}}
 def seal(self):return c.seal(self.payload,self.source,self.bundle,self.fmt,self.context,self.records,h)
 def test_roundtrip_is_nonrelease_and_release_extractor_refuses(self):
  m=self.seal();self.assertEqual(c.verify(self.bundle,h)['files'],m['files']);self.assertEqual(set(p.name for p in self.bundle.iterdir()),c.BUNDLE_FILES)
  with self.assertRaises(Exception):h.extract_bundle(self.bundle,self.root/'must-not-extract',c.SOURCE)
  self.assertFalse((self.root/'must-not-extract').exists())
 def test_labels_source_tool_and_producer_identity_refuse(self):
  for key,value in [('labels',[]),('sourceSha','e'*40),('releaseAccepted',True),('candidateLocalPreview','PASSED')]:
   x=copy.deepcopy(self.context);x[key]=value
   with self.assertRaises(Exception):c.validate_context(x)
  for key,value in [('workflowSha','f'*40),('event','workflow_dispatch'),('runId',''),('runAttempt','2'),('ref','refs/heads/main'),('ref','refs/heads/test/pr217-nonrelease-candidate-7c84')]:
   x=copy.deepcopy(self.context);x['producer'][key]=value
   with self.assertRaises(Exception):c.validate_context(x)
  for tool in ['node','pnpm','wrangler']:
   x=copy.deepcopy(self.context);x['tools'][tool]='0.0.0'
   with self.assertRaises(Exception):c.validate_context(x)
  x=copy.deepcopy(self.context);x['producer']['files']={}
  with self.assertRaises(Exception):c.validate_context(x)
  for key,value in [('created',False),('deleted',True),('forced',True),('before','f'*40),('after','f'*40),('initialParent','f'*40)]:
   x=copy.deepcopy(self.context);x['producer'][key]=value
   with self.assertRaises(Exception):c.validate_context(x)
 def test_publication_shape_rejects_old_root_workflow_or_modified_files(self):
  producer='a'*40;parents=[producer,c.SOURCE]
  paths=['.github/workflows/pr217-nonrelease-candidate.yml',*['site/scripts/pr217-candidate/'+name for name in ('candidate.py','producer.sh','tool-metadata.mjs','test-candidate.py')]]
  delta=['A\t'+p for p in paths]
  workflows=['.github/workflows/'+n for n in ('build.yml','site-check-v1.yml','uptime.yml','pr217-nonrelease-candidate.yml')]
  event={k:self.context['producer'][k] for k in ('created','deleted','forced','before','after','ref')}
  c.validate_publication_shape(producer,parents,delta,workflows,event)
  for changed in [[producer,'f'*40],[producer,c.SOURCE,'e'*40]]:
   with self.assertRaises(Exception):c.validate_publication_shape(producer,changed,delta,workflows,event)
  for changed in [delta[:-1],delta+['A\tsite/unrelated.txt'],['M'+v[1:] if i==0 else v for i,v in enumerate(delta)]]:
   with self.assertRaises(Exception):c.validate_publication_shape(producer,parents,changed,workflows,event)
  with self.assertRaises(Exception):c.validate_publication_shape(producer,parents,delta,workflows+['.github/workflows/site-preview-startup-v1.yml'],event)
  with self.assertRaises(Exception):c.validate_publication_shape(producer,parents,delta,workflows,{**event,'created':False})
 def test_worker_module_and_mixed_output_hash_refuse(self):
  original=json.loads(self.fmt.read_text())
  for key,value in [('compilerOutputFiles',['index.js','extra.js']),('stagedWorkerSha256','a'*64),('syntaxGatePassed',False)]:
   record={**original,key:value};self.fmt.write_text(json.dumps(record))
   with self.assertRaises(Exception):self.seal()
 def test_control_change_refuses(self):
  (self.payload/'_headers').write_text('changed')
  with self.assertRaises(Exception):self.seal()
 def test_symlink_hardlink_private_and_overwrite_refuse(self):
  for kind in ['symlink','hardlink','private']:
   p=self.payload/('.env' if kind=='private' else 'alias.js')
   if kind=='symlink':p.symlink_to(self.payload/'_worker.js')
   elif kind=='hardlink':os.link(self.payload/'_worker.js',p)
   else:p.write_text('synthetic')
   with self.assertRaises(Exception):self.seal()
   p.unlink()
  self.seal()
  with self.assertRaises(Exception):self.seal()
 def test_archive_traversal_links_duplicates_and_tamper_refuse(self):
  self.seal();archive=self.bundle/'candidate-payload.tar.gz'
  for kind in ['traversal','symlink','duplicate','tamper']:
   with tarfile.open(archive,'w:gz') as out:
    for name in ['../escape'] if kind=='traversal' else ['_worker.js','_worker.js'] if kind=='duplicate' else ['_worker.js']:
     info=tarfile.TarInfo(name);b=b'wrong bytes';info.size=len(b)
     if kind=='symlink':info.type=tarfile.SYMTYPE;info.linkname='/outside';info.size=0;out.addfile(info)
     else:out.addfile(info,io.BytesIO(b))
   m=json.loads((self.bundle/'candidate-manifest.json').read_text());m['archiveSha256']=c.sha(archive.read_bytes())
   (self.bundle/'candidate-manifest.json').write_text(json.dumps(m))
   (self.bundle/'NON_RELEASE.json').write_text(json.dumps({'labels':c.LABELS,'promotionAllowed':False,'manifestSha256':c.sha((self.bundle/'candidate-manifest.json').read_bytes())}))
   with self.assertRaises(Exception):c.verify(self.bundle,h)
class PhaseEvidence(unittest.TestCase):
 def test_fixed_phase_failure_complete_and_privacy(self):
  with tempfile.TemporaryDirectory() as task:
   p=Path(task)/'receipt.json'
   for i,phase in enumerate(c.PHASES):
    report=c.phase_receipt(p,phase,'failed',1,list(c.PHASES[:i]))
    self.assertEqual(report['phase'],phase);self.assertEqual(report['errorClass'],'command-exit')
    self.assertEqual(json.loads(p.read_text()),report)
   report=c.phase_receipt(p,c.PHASES[-1],'completed',0,list(c.PHASES[:-1]))
   self.assertFalse(report['releasable']);self.assertEqual(report['artifactClass'],'PR217_PRODUCER_PHASE_RECEIPT_NOT_PAYLOAD')
 def test_rejects_free_text_states_links_and_invalid_order(self):
  with tempfile.TemporaryDirectory() as task:
   p=Path(task)/'receipt.json'
   for phase,state,code,done in [('PRIVATE_TOKEN','failed',1,[]),('entry','PRIVATE_MSG',1,[]),('entry','failed',0,[]),('site-build','failed',1,[])]:
    with self.assertRaises(Exception):c.phase_receipt(p,phase,state,code,done)
   p.write_text('unrelated owned fixture')
   with self.assertRaises(Exception):c.phase_receipt(p,'entry','started',0,[])
   self.assertEqual(p.read_text(),'unrelated owned fixture');p.unlink()
   outside=Path(task)/'other';outside.write_text('preserved');p.symlink_to(outside)
   with self.assertRaises(Exception):c.phase_receipt(p,'entry','started',0,[])
   self.assertEqual(outside.read_text(),'preserved')
class ShellPhaseTrap(unittest.TestCase):
 def test_isolated_trap_fragment_records_explicit_and_command_failure(self):
  packet=Path(__file__).parent.resolve()
  source=(packet/'producer.sh').read_text()
  fragment=source[source.index('current=entry'):source.index('\npublish started 0')]
  with tempfile.TemporaryDirectory() as task:
   for tail,expected in [('phase identity-cleanliness\nfalse',1),('exit 2',2),('kill -TERM $$',143)]:
    receipt=Path(task)/('receipt-'+str(expected)+'.json')
    script='set -euo pipefail\nhelper='+shlex.quote(str(packet))+'\nreceipt='+shlex.quote(str(receipt))+'\n'+fragment+'\npublish started 0\n'+tail+'\n'
    result=subprocess.run(['bash','-c',script],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=5)
    self.assertEqual(result.returncode,expected)
    data=json.loads(receipt.read_text());self.assertEqual(data['status'],'failed');self.assertEqual(data['exitCode'],expected)
    self.assertEqual(data['phase'],'identity-cleanliness' if expected==1 else 'entry')
class ReceiptFailureStatus(unittest.TestCase):
 def test_failed_publisher_cannot_replace_original_failure_or_signal(self):
  packet=Path(__file__).parent.resolve();source=(packet/'producer.sh').read_text()
  fragment=source[source.index('current=entry'):source.index('\npublish started 0')]
  for tail,expected in [('exit 2',2),('kill -INT $$',130),('kill -TERM $$',143)]:
   script='set -euo pipefail\n'+fragment+'\npublish(){ return 17; }\n'+tail+'\n'
   result=subprocess.run(['bash','-c',script],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=5)
   with self.subTest(tail=tail):self.assertEqual(result.returncode,expected,tail)
 def test_success_path_receipt_failure_is_still_failure(self):
  packet=Path(__file__).parent.resolve();source=(packet/'producer.sh').read_text()
  fragment=source[source.index('current=entry'):source.index('\npublish started 0')]
  script='set -euo pipefail\n'+fragment+'\npublish(){ return 17; }\npublish completed 0\n'
  result=subprocess.run(['bash','-c',script],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=5)
  self.assertEqual(result.returncode,17)
if __name__=='__main__':unittest.main()
