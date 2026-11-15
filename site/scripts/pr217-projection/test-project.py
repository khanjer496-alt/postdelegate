"""Tiny metadata/ZIP/row fixtures only. No real download/helper/renderer/worker."""
import copy,hashlib,importlib.util,io,json,os,stat,sys,tempfile,time,unittest,zipfile
from pathlib import Path
from unittest.mock import patch
sys.dont_write_bytecode=True
def load(n):
 s=importlib.util.spec_from_file_location(n,Path(__file__).with_name(n+'.py'));m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
p=load('project');o=load('oracles')
def sources():
 h='/*\n'+''.join('  '+n+': '+v+'\n' for n,v in [('Strict-Transport-Security','max-age=31536000; includeSubDomains'),('X-Content-Type-Options','nosniff'),('Referrer-Policy','strict-origin-when-cross-origin'),('X-Frame-Options','DENY'),('Permissions-Policy','camera=(), microphone=(), geolocation=()'),('Content-Security-Policy',"default-src 'self'")])
 for rule,fields in {'/fonts/*':{'Cache-Control':'public, max-age=31536000, immutable'},'/openapi.json':{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=3600'},'/agents/AGENTS.md':{'Content-Type':'text/markdown; charset=utf-8','Cache-Control':'public, max-age=3600'},'/docs.md':{'Content-Type':'text/markdown; charset=utf-8','Link':'<https://postdelegate.com/docs>; rel="canonical"','Cache-Control':'public, max-age=3600'},'/docs/*.md':{'Content-Type':'text/markdown; charset=utf-8','Link':'<https://postdelegate.com/docs/:splat>; rel="canonical"','Cache-Control':'public, max-age=3600'}}.items():
  h+=rule+'\n'+''.join('  '+n+': '+v+'\n' for n,v in fields.items())
 result={'site/astro.config.mjs':b"output: 'static', trailingSlash: 'never', build: { format: 'file' }",'site/public/_headers':h.encode(),'site/public/_redirects':b'/auth https://app.postdelegate.com/auth 301\n/auth/ https://app.postdelegate.com/auth 301\n/privacy https://app.postdelegate.com/legal/privacy/ 301\n'}
 result['site/src/layouts/Base.astro']=b'pagePath(Astro.url); new URL(canonicalPath, SITE.url).href'
 result['site/src/data/site.ts']=b"url:'https://postdelegate.com'"
 for name in p.SOURCE_PATHS:result.setdefault(name,b'synthetic source fixture')
 return result
def index():
 names=['index.html','alternatives.html','alternatives/recurpost.html','alternatives/post-planner.html','alternatives/coschedule.html','alternatives/rella.html','404.html','docs.html','docs/channels/telegram.html','docs.md','docs/channels/telegram.md','openapi.json','fonts/plus-jakarta-sans.woff2','agents/AGENTS.md']
 return {n:{'sha256':p.sha(n.encode()),'bytes':10,'mode':0o644} for n in names}
class RowContract(unittest.TestCase):
 def test_source_file_format52_rows_and_unbound_platform(self):
  src=sources();result=o.build(index(),src,p.PACKETS,{n:'a'*40 for n in src});r={x['id']:x for x in result['rows']}
  self.assertEqual(len(r),52);self.assertEqual(r[7]['oracles']['member']['value'],'alternatives.html');self.assertEqual(r[20]['oracles']['member']['value'],'docs.html')
  self.assertEqual(r[22]['oracles']['member']['value'],'docs.md');self.assertEqual(r[37]['oracles']['member']['value'],'docs/channels/telegram.md')
  self.assertEqual(r[26]['oracles']['body_sha256']['state'],'NOT_APPLICABLE');self.assertIsNone(r[26]['oracles']['body_sha256']['value']);self.assertEqual(r[12]['oracles']['body_sha256']['state'],'UNBOUND');self.assertEqual(r[12]['oracles']['source_404_candidate']['value'],'404.html')
  self.assertEqual(r[28]['oracles']['root_direct_vary']['state'],'NOT_APPLICABLE');self.assertEqual(r[43]['oracles']['root_direct_vary']['value'],'Accept')
  def profile(i):return result['header_sets'][r[i]['oracles']['header_profile']['value']]
  self.assertEqual(profile(14)['media_type']['state'],'UNBOUND');self.assertEqual(profile(20)['cache']['state'],'UNBOUND');self.assertTrue(result['unbound_gates'])
  self.assertEqual(r[50]['phase'],'RESERVED_CLEANUP_SEPARATE_GO')
 def test_missing_member_duplicate_rule_or_other_build_format_refuses(self):
  for kind in ('missing','rule','format'):
   with self.subTest(kind=kind):
    f=index();s=sources()
    if kind=='missing':del f['docs.html']
    if kind=='rule':s['site/public/_headers']+=b'/*\n X-Test: no\n'
    if kind=='format':s['site/astro.config.mjs']=b"output: 'static', trailingSlash: 'never', build: { format: 'directory' }"
    with self.assertRaises((o.OracleRejected,KeyError)):o.build(f,s,p.PACKETS,{n:'a'*40 for n in s})
class CapsAndJson(unittest.TestCase):
 def data(self):return {n:{} for n in p.CAPS}
 def test_exact_three_json_no_payload(self):
  encoded=p.encode_output(self.data());self.assertEqual(set(encoded),set(p.CAPS));self.assertTrue(all(json.loads(x)=={} for x in encoded.values()))
 def test_each_cap_combined_reserve_and_unknown_file_refuse(self):
  for name,cap in p.CAPS.items():
   data=self.data();data[name]={'x':'a'*(cap+1)}
   with self.subTest(name=name),self.assertRaises(p.Refused):p.encode_output(data)
  data=self.data();data['public-file-index.json']={'x':'x'*(241*1024)}
  with self.assertRaises(p.Refused):p.encode_output(data)
  data=self.data();data['extra.json']={}
  with self.assertRaises(p.Refused):p.encode_output(data)
 def test_duplicate_keys_nan_and_unknown_schema_refuse(self):
  for b in (b'{"a":1,"a":2}',b'{"a":NaN}'):
   with self.assertRaises(p.Refused):p.strict_json(b)
  with self.assertRaises(p.Refused):p.shape({'allowed':1,'secret':'PRIVATE'},'allowed')
class Container(unittest.TestCase):
 def fixture(self,root,mutation=None):
  preview=b'TINY FAKE BYTES NOT A REAL PREVIEW ZIP';record=b'{"synthetic":true}'
  marker=json.dumps({'labels':p.LABELS,'releaseAccepted':False,'promotionAllowed':False,'recordSha256':p.sha(record),'zipSha256':p.sha(preview)}).encode()
  path=root/'outer.zip'
  with zipfile.ZipFile(path,'w') as z:
   for n,b in [('preview-payload.zip',preview),('transport-record.json',record),('NON_RELEASE.json',marker)]:
    i=zipfile.ZipInfo(n);i.create_system=3;i.external_attr=(stat.S_IFREG|0o600)<<16
    if mutation=='link' and n=='transport-record.json':i.external_attr=(stat.S_IFLNK|0o600)<<16
    z.writestr(i,b)
   if mutation=='extra':z.writestr('extra.json',b'{}')
  return path,preview,record
 def test_outer_hash_precedes_parsing_and_fixed_container_streams_preview(self):
  # Patch numeric pins for tiny fixtures only; production has no trust override.
  with tempfile.TemporaryDirectory() as task:
   path,preview,record=self.fixture(Path(task))
   with patch.object(p,'SIZE',path.stat().st_size),patch.object(p,'OUTER',p.sha(path.read_bytes())),patch.object(p,'ZIP_SHA',p.sha(preview)),patch.object(p,'RECORD_SHA',p.sha(record)):
    with patch.object(p,'PREVIEW_SIZE',len(preview)):
     self.assertEqual(p.read_container(path,time.monotonic()+5),{'synthetic':True})
   with patch.object(p,'SIZE',path.stat().st_size),patch.object(p,'OUTER','0'*64),patch.object(p,'strict_json',side_effect=AssertionError('must not parse')):
    with self.assertRaises(p.Refused):p.read_container(path,time.monotonic()+5)
 def test_nonregular_extra_members_refuse_before_json(self):
  for kind in ('link','extra'):
   with self.subTest(kind=kind),tempfile.TemporaryDirectory() as task:
    path,preview,record=self.fixture(Path(task),kind)
    with patch.object(p,'SIZE',path.stat().st_size),patch.object(p,'OUTER',p.sha(path.read_bytes())),patch.object(p,'PREVIEW_SIZE',len(preview)),self.assertRaises(p.Refused):p.read_container(path,time.monotonic()+5)
 def test_expired_deadline_and_no_extra_api_paths(self):
  self.assertEqual(len(p.api_paths()),6);self.assertTrue(all(x.startswith('/repos/'+p.REPO+'/actions/') for x in p.api_paths()))
  with tempfile.TemporaryDirectory() as task:
   path,_,_=self.fixture(Path(task))
   with patch.object(p,'SIZE',path.stat().st_size),patch.object(p,'OUTER',p.sha(path.read_bytes())),self.assertRaises(p.Refused):p.read_container(path,0)
class CanonicalAndArtifact(unittest.TestCase):
 def test_fixed_ascii_unicode_order_integer_vectors(self):
  self.assertEqual(p.canon({'b':1,'a':'é'}),b'{"a":"\\u00e9","b":1}')
  self.assertEqual(p.canon({'x':'🚀'}),b'{"x":"\\ud83d\\ude80"}')
  self.assertEqual(p.canon([True,None,-12]),b'[true,null,-12]');self.assertNotEqual(p.canon([1,2]),p.canon([2,1]))
  for value in (1.0,float('nan'),'\ud800',{1:'no'}):
   with self.assertRaises(p.Refused):p.canon(value)
  for value in (b'1.0',b'"\\ud800"'):
   with self.assertRaises(p.Refused):p.strict_json(value)
 def test_actual_provider_artifact_ceiling_and_binding(self):
  a={'id':1,'size_in_bytes':100,'expired':False,'digest':'sha256:'+'a'*64,'workflow_run':{'id':9,'head_sha':'b'*40,'repository_id':1439958050,'head_repository_id':1439958050},'name':'NON_RELEASE-NOT_ACCEPTED-METADATA-PROJECTION-'+'b'*40+'-9-1'}
  p.check_uploaded_metadata(a,1,'a'*64,'b'*40,'9')
  for key,value in [('size_in_bytes',256*1024+1),('expired',True),('digest','bad')]:
   with self.assertRaises(p.Refused):p.check_uploaded_metadata({**a,key:value},1,'a'*64,'b'*40,'9')
def metadata_fixture():
 src=sources();names=[('page%03d.html'%i) for i in range(491)]+[('og/%03d.png'%i) for i in range(115)]+['_worker.js','_headers','_redirects','_routes.json']+[('misc%03d.txt'%i) for i in range(103)]
 files={n:{'sha256':p.sha(n.encode()),'bytes':0,'mode':0o644} for n in names};base,extra=divmod(35703988-166366,712)
 for i,n in enumerate(names):files[n]['bytes']=166366 if i==0 else base+int(i<=extra)
 for n in ('_headers','_redirects','_routes.json'):files[n]['sha256']=p.sha(src['site/public/'+n])
 sf={}
 for n in ['site/public/og/%03d.png'%i for i in range(115)]+['site/public/'+n for n in ('_headers','_redirects','_routes.json')]+['site/package.json','site/scripts/og.mjs','site/src/data/og-cards.mjs']:
  sf[n]={'gitBlob':'b'*40,'sha256':p.sha(n.encode()),'bytes':10,'mode':'100644'}
 for n in ('_headers','_redirects','_routes.json'):sf['site/public/'+n]['sha256']=files[n]['sha256']
 for i in range(435-len(sf)):sf['site/src/fake%03d.ts'%i]={'gitBlob':'b'*40,'sha256':'a'*64,'bytes':0,'mode':'100644'}
 gen={'generatorInputs':{n:{k:sf[n][k] for k in ('gitBlob','sha256')} for n in ('site/package.json','site/scripts/og.mjs','site/src/data/og-cards.mjs')},'mapping':[],'runIdentity':{'sha':p.PRODUCER,'runId':'43670231792','runAttempt':'1'},'outputs':{}}
 for i in range(115):
  name='site/public/og/%03d.png'%i;path='og/%03d.png'%i;gen['mapping'].append({'route':'/fake'+str(i),'sourcePath':name,'payloadPath':path});gen['outputs'][name]={'payloadPath':path,'sha256':files[path]['sha256'],'bytes':files[path]['bytes'],'gitInputSha256':sf[name]['sha256']}
 producer={'sha':p.PRODUCER,'workflowSha':p.PRODUCER,'after':p.PRODUCER,'initialParent':p.SOURCE,'runId':'43670231792','runAttempt':'1','event':'push','created':True,'forced':False,'deleted':False,'before':'0'*40,'ref':'refs/heads/test/pr217-generated-provenance-7c84-20261115','workflow':'PR217 NON_RELEASE LOCAL_PREVIEW_FAILED NOT_ACCEPTED candidate','files':{n:{'gitBlob':'b'*40,'sha256':'a'*64} for n in ['.github/workflows/pr217-nonrelease-candidate.yml']+['site/scripts/pr217-candidate/'+n for n in ('candidate.py','producer.sh','test-candidate.py','tool-metadata.mjs')]}}
 producer['workflowRef']=p.REPO+'/.github/workflows/pr217-nonrelease-candidate.yml@'+producer['ref']
 m={'schemaVersion':1,'artifactClass':'PR217_SAME_BYTE_TRANSPORT_NOT_RELEASE','labels':p.LABELS,'releaseAccepted':False,'promotionAllowed':False,'runtimeAccepted':False,'visualQa':False,'fitQualified':False,'files':files,'sourceFiles':sf,'generatedOutputs':gen,'original':{'repository':p.REPO,'sourceSha':p.SOURCE,'producerSha':p.PRODUCER,'runId':'43670231792','runAttempt':'1','artifactId':14144390000,'outerZipBytes':8561290,'outerZipSha256':'1b689f33e3b3d8d1d51302f1c077e084cb206bbf801829254f772f4cc2b41b66','innerSha256':{n:'a'*64 for n in ('NON_RELEASE.json','candidate-manifest.json','candidate-payload.tar.gz','worker-format.json')},'sourceTree':'c'*40,'producer':producer},'derivation':{'sha':p.TRANSPORT,'workflowSha':p.TRANSPORT,'workflowRef':p.REPO+'/.github/workflows/build.yml@refs/heads/test/pr217-transport-6708-20261115','runId':str(p.RUN),'runAttempt':'1','event':'workflow_dispatch','ref':'refs/heads/test/pr217-transport-6708-20261115'},'controlSha256':{n:files[n]['sha256'] for n in ('_headers','_redirects','_routes.json')},'workerCompilation':{'format':'raw-es-module-javascript','compilerOutputFiles':['index.js'],'compilerOutputSha256':files['_worker.js']['sha256'],'stagedWorkerSha256':files['_worker.js']['sha256'],'syntaxGate':'node --input-type=module --check','syntaxGatePassed':True,'staging':'byte-for-byte-copy','additionalModulesPolicy':'reject'},'tools':{n:'1.0.0' for n in ('node','pnpm','wrangler','miniflare','workerd','esbuild')},'producerRecordedToolFileSha256':{n:'a'*64 for n in ('cliLockfile','wranglerPackage','miniflarePackage','workerdPackage','nativeWorkerd','esbuildPackage')},'toolIdentity':'PRODUCER_RECORDED_HASHES_VERSION_SCHEMA_ONLY_NOT_REHASHED','zip':{'sha256':p.ZIP_SHA,'bytes':9212002,'fileCount':713,'ceilingBytes':26214400,'format':'canonical-deflate-zip','compression':{'method':'deflate','level':'zlib-default','python':'3.12.0','zlibRuntime':'1.2.13'},'collisionRule':'NFC-casefold-NFC-components-spelling-and-kind','unicodeVersion':'15.0'},'checks':{n:True for n in ('trustedSchema2VerifiedBeforeDerivation','everyMemberBytesNamesModes','zipRereadCrcHashSet','originalFrozenBeforeAfter','pathCollisionsRejected','actualZipWithinConservativeCeiling')}}
 def fake_git(root,*args):
  if args[0]=='rev-parse':return ('c'*40).encode()
  if args[0]=='ls-tree':return b''.join(('100644 blob '+r['gitBlob']+'\t'+n+'\0').encode() for n,r in sf.items())
  raise AssertionError('No real Git helper allowed')
 return m,src,fake_git
class FullMetadataSchema(unittest.TestCase):
 def test_record_accepts_metadata_only_and_refuses_unknown_or_drift(self):
  m,src,g=metadata_fixture()
  with patch.object(p,'git',g):p.validate_record(m,lambda names:None,Path('/fake'),src)
  for kind in ('extra','outer','mode','longpath','generated'):
   n=copy.deepcopy(m)
   if kind=='extra':n['private']='CANARY'
   if kind=='outer':n['original']['artifactId']=1
   if kind=='mode':n['files']['_worker.js']['mode']=0o755
   if kind=='longpath':n['files']['x'*385]=n['files'].pop('misc000.txt')
   if kind=='generated':n['generatedOutputs']['outputs']['site/public/og/000.png']['bytes']+=1
   with self.subTest(kind=kind),patch.object(p,'git',g),self.assertRaises(p.Refused):p.validate_record(n,lambda names:None,Path('/fake'),src)
 def identity(self):
  scripts={'site/scripts/pr217-projection/'+n:'a'*64 for n in ('project.py','oracles.py','test-project.py')}
  return {'repository':p.REPO,'implementation_sha':'d'*40,'script_hashes':scripts,'workflow_path':'.github/workflows/build.yml','workflow_sha':'d'*40,'workflow_ref':p.REPO+'/.github/workflows/build.yml@'+p.REF,'run_id':'99','run_attempt':'1','event':'workflow_dispatch','job_id':123,'actor':'khanjer496-alt','serialization_runtime':{'canonical_rule_id':p.CANON_RULE,'encoder_id':'cpython-stdlib-json.dumps','python_implementation':'cpython','python_version':'3.12.0','approved_implementation_sha':'d'*40,'approved_script_path':'site/scripts/pr217-projection/project.py','approved_script_sha256':'a'*64}}
 def test_serialization_runtime_exact_binding_and_no_substitution(self):
  p.validate_runtime(self.identity())
  for field,value in [('approved_implementation_sha','e'*40),('approved_script_sha256','b'*64),('approved_script_path','project.py'),('python_version','3.12'),('extra','unknown')]:
   i=self.identity();i['serialization_runtime'][field]=value
   with self.subTest(field=field),self.assertRaises(p.Refused):p.validate_runtime(i)
 def test_three_exact_output_schemas_and_typed_unknown_fields(self):
  m,src,g=metadata_fixture();m['files'].update({n:r for n,r in index().items() if n not in m['files']})
  # Output test keeps713 metadata rows while adding only named oracle fixtures.
  for n in list(m['files']):
   if len(m['files'])<=713:break
   if n.startswith('misc'):del m['files'][n]
  oracle=o.build(m['files'],src,p.PACKETS,{n:'a'*40 for n in src});data=p.outputs(m,oracle,self.identity());raw=p.encode_output(data)
  self.assertEqual(set(raw),set(p.CAPS));self.assertLess(sum(map(len,raw.values())),240*1024)
  for value in data.values():self.assertEqual(value['canonical_rule'],p.CANON_RULE)
  data['row-oracles.json']['rows'][0]['oracles']['status']['value']='invented'
  with self.assertRaises(p.Refused):p.validate_output(data)
class TokenAndOutputBoundary(unittest.TestCase):
 def test_git_metadata_subprocess_has_no_api_token_or_proxy(self):
  captured={}
  def fake(*args,**kwargs):captured.update(kwargs);return b'fake'
  with patch.dict(os.environ,{'GITHUB_TOKEN':'PRIVATE_CANARY','HTTPS_PROXY':'PRIVATE_PROXY','RUNNER_TEMP':'/tmp'}),patch.object(p.subprocess,'check_output',side_effect=fake):p.git(Path('/fake'),'rev-parse','HEAD')
  self.assertNotIn('GITHUB_TOKEN',captured['env']);self.assertNotIn('HTTPS_PROXY',captured['env']);self.assertEqual(captured['env']['GIT_OPTIONAL_LOCKS'],'0')
 def test_output_extra_fields_and_unbound_value_fail(self):
  m,src,g=metadata_fixture();m['files'].update(index())
  for n in list(m['files']):
   if len(m['files'])<=713:break
   if n.startswith('misc'):del m['files'][n]
  data=p.outputs(m,o.build(m['files'],src,p.PACKETS,{n:'a'*40 for n in src}),FullMetadataSchema().identity())
  bad=copy.deepcopy(data);bad['identity-binding.json']['extra']='PRIVATE_CANARY'
  with self.assertRaises(p.Refused):p.validate_output(bad)
  bad=copy.deepcopy(data);bad['row-oracles.json']['rows'][0]['oracles']['status']['value']=200
  with self.assertRaises(p.Refused):p.validate_output(bad)
if __name__=='__main__':unittest.main()
