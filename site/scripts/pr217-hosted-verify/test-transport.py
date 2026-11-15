"""Tiny owned fake archives only: no download/helper/native/build/runtime."""
import hashlib,importlib.util,io,json,os,stat,sys,tarfile,tempfile,time,unittest,zipfile
from pathlib import Path
from unittest.mock import patch
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('transport',Path(__file__).with_name('transport.py'));t=importlib.util.module_from_spec(spec);spec.loader.exec_module(t)
class Transport(unittest.TestCase):
 def fixture(self,root,files=None):
  files=files or {'index.html':b'public html','_worker.js':b'not executable: fake fixture'}
  bundle=root/'original';bundle.mkdir()
  with tarfile.open(bundle/'candidate-payload.tar.gz','w:gz') as tar:
   for name,b in sorted(files.items()):
    i=tarfile.TarInfo(name);i.size=len(b);i.mode=0o644;tar.addfile(i,io.BytesIO(b))
  for name in ('NON_RELEASE.json','candidate-manifest.json','worker-format.json'):(bundle/name).write_text('{}')
  return bundle,{n:hashlib.sha256(b).hexdigest() for n,b in files.items()}
 def test_exact_names_bytes_modes_deterministic_container(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);bundle,files=self.fixture(root);end=time.monotonic()+5
   index=t.source_index(bundle,files,end)
   for name in ('a.zip','b.zip'):t.write_zip(bundle,index,root/name,end);t.reread_zip(root/name,index,end)
   self.assertEqual((root/'a.zip').read_bytes(),(root/'b.zip').read_bytes())
   with zipfile.ZipFile(root/'a.zip') as z:
    self.assertEqual(set(z.namelist()),set(files));self.assertNotIn('NON_RELEASE.json',z.namelist())
    self.assertTrue(all(i.external_attr==(stat.S_IFREG|0o644)<<16 for i in z.infolist()))
 def test_tar_byte_hash_mismatch_refuses(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);bundle,files=self.fixture(root);files['index.html']='0'*64;end=time.monotonic()+5
   with self.assertRaises(t.TransportRejected):t.write_zip(bundle,t.source_index(bundle,files,end),root/'bad.zip',end)
 def test_missing_extra_duplicate_nonregular_and_mode_refuse(self):
  for fault in ('missing','extra','duplicate','symlink','mode','path'):
   with self.subTest(fault=fault),tempfile.TemporaryDirectory() as temp:
    root=Path(temp);bundle,files=self.fixture(root);end=time.monotonic()+5
    if fault=='missing':files['missing.html']='0'*64
    else:
     with tarfile.open(bundle/'candidate-payload.tar.gz','w:gz') as tar:
      names=['index.html','_worker.js']
      if fault=='extra':names+=['extra.html']
      if fault=='duplicate':names+=['index.html']
      if fault=='path':names[0]='../bad'
      for name in names:
       i=tarfile.TarInfo(name);i.mode=0o755 if fault=='mode' else 0o644
       if fault=='symlink':i.type=tarfile.SYMTYPE;i.linkname='index.html'
       tar.addfile(i)
    with self.assertRaises(t.TransportRejected):t.source_index(bundle,files,end)
 def test_reread_refuses_self_consistent_altered_zip_content_extra_modes(self):
  for fault in ('bytes','extra','mode','duplicate','metadata'):
   with self.subTest(fault=fault),tempfile.TemporaryDirectory() as temp:
    root=Path(temp);bundle,files=self.fixture(root);end=time.monotonic()+5;index=t.source_index(bundle,files,end)
    with zipfile.ZipFile(root/'bad.zip','w') as z:
     for name,r in sorted(index.items()):
      i=zipfile.ZipInfo(name);i.create_system=3;i.external_attr=(stat.S_IFREG|(0o755 if fault=='mode' else 0o644))<<16
      if fault=='metadata':i.comment=b'not allowed'
      z.writestr(i,b'wrong bytes')
     if fault=='extra':z.writestr('extra.html',b'x')
     if fault=='duplicate':
      import warnings
      with warnings.catch_warnings():warnings.simplefilter('ignore');z.writestr('index.html',b'x')
    with self.assertRaises(t.TransportRejected):t.reread_zip(root/'bad.zip',index,end)
 def test_frozen_original_rejects_late_manifest_or_tar_and_links(self):
  for name in ('candidate-manifest.json','candidate-payload.tar.gz','worker-format.json','NON_RELEASE.json'):
   with self.subTest(name=name),tempfile.TemporaryDirectory() as temp:
    root=Path(temp);bundle,_=self.fixture(root);end=time.monotonic()+5;frozen=t.freeze_original(bundle,end)
    (bundle/name).write_bytes(b'changed');
    with self.assertRaises(t.TransportRejected):t.unchanged(bundle,frozen,end)
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);bundle,_=self.fixture(root);os.link(bundle/'candidate-manifest.json',root/'linked')
   with self.assertRaises(t.TransportRejected):t.freeze_original(bundle,time.monotonic()+5)
 def test_deadline_and_disk_reserve_and_exact_713_gate(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);bundle,files=self.fixture(root);end=time.monotonic()+5;frozen=t.freeze_original(bundle,end)
   with self.assertRaises(t.TransportRejected):t.source_index(bundle,files,0)
   with patch.object(t.shutil,'disk_usage',return_value=type('Disk',(),{'free':0})()):
    with self.assertRaises(t.TransportRejected):t.derive(bundle,{'files':files},frozen,root/'disk',{}, {},end)
   with self.assertRaises(t.TransportRejected):t.derive(bundle,{'files':files},frozen,root/'count',{}, {},end)
 def test_success_bundle_is_separate_and_marker_binds_complete_record(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);files={('page%03d.html'%n):b'x' for n in range(713)}
   bundle,hashes=self.fixture(root,files);end=time.monotonic()+5;frozen=t.freeze_original(bundle,end)
   m={'files':hashes,'generatedOutputs':{'outputs':{str(i):{} for i in range(115)}},'sourceFiles':{str(i):{} for i in range(435)},'sourceTree':'fake','producer':{},'controlSha256':{},'workerCompilation':{},'tools':{},'toolFileSha256':{}}
   record=t.derive(bundle,m,frozen,root/'stage',{'sha':'FAKE'}, {},end)
   self.assertEqual(set(p.name for p in (root/'stage').iterdir()),{'preview-payload.zip','transport-record.json','NON_RELEASE.json'})
   self.assertFalse(record['promotionAllowed']);self.assertFalse(record['runtimeAccepted']);self.assertEqual(record['zip']['fileCount'],713)
   with zipfile.ZipFile(root/'stage/preview-payload.zip') as z:self.assertEqual(set(z.namelist()),set(files))
   (root/'stage/transport-record.json').write_text('{}')
   with self.assertRaises(t.TransportRejected):t.check_staged(root/'stage',record,end)
 def test_completed_zip_crc_corruption_refuses(self):
  import struct
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);bundle,files=self.fixture(root);end=time.monotonic()+5;index=t.source_index(bundle,files,end)
   zpath=root/'ok.zip';t.write_zip(bundle,index,zpath,end)
   raw=bytearray(zpath.read_bytes());central=raw.index(b'PK\x01\x02');raw[central+16]^=1;zpath.write_bytes(raw)
   with self.assertRaises(zipfile.BadZipFile):t.reread_zip(zpath,index,end)
class CollisionAndCeiling(unittest.TestCase):
 fixture=Transport.fixture
 def test_retained_default_25mib_and_compressed_output(self):
  self.assertEqual(t.MAX_ZIP,25*1024**2)
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);bundle,files=self.fixture(root);end=time.monotonic()+5;index=t.source_index(bundle,files,end)
   t.write_zip(bundle,index,root/'z.zip',end)
   with zipfile.ZipFile(root/'z.zip') as z:self.assertTrue(all(x.compress_type==zipfile.ZIP_DEFLATED for x in z.infolist()))
 def test_case_unicode_directory_alias_and_file_directory_collisions(self):
  examples=[['A.txt','a.txt'],['caf\u00e9.txt','cafe\u0301.txt'],['Dir/a.txt','dir/b.txt'],['caf\u00e9/a.txt','cafe\u0301/b.txt'],['Dir','dir/a.txt'],['same','same/a.txt']]
  for names in examples:
   with self.subTest(names=names),tempfile.TemporaryDirectory() as temp:
    root=Path(temp);bundle,files=self.fixture(root,{n:b'x' for n in names});end=time.monotonic()+5
    with self.assertRaises(t.TransportRejected):t.source_index(bundle,files,end)
    index={n:{'sha256':hashlib.sha256(b'x').hexdigest(),'bytes':1,'mode':0o644} for n in names}
    with zipfile.ZipFile(root/'bad.zip','w') as z:
     for name in sorted(names):
      info=zipfile.ZipInfo(name,date_time=(1980,1,1,0,0,0));info.create_system=3;info.external_attr=(stat.S_IFREG|0o644)<<16;info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,b'x')
    with self.assertRaises(t.TransportRejected):t.reread_zip(root/'bad.zip',index,end)
 def test_actual_whole_zip_cap_refuses_and_shared_directory_is_valid(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);bundle,files=self.fixture(root,{'same/a.txt':b'abc','same/b.txt':b'def'});end=time.monotonic()+5;index=t.source_index(bundle,files,end)
   with patch.object(t,'MAX_ZIP',50):
    with self.assertRaises(t.TransportRejected):t.write_zip(bundle,index,root/'too-big.zip',end)
   t.write_zip(bundle,index,root/'ok.zip',end)
   with patch.object(t,'MAX_ZIP',50):
    with self.assertRaises(t.TransportRejected):t.reread_zip(root/'ok.zip',index,end)
if __name__=='__main__':unittest.main()
