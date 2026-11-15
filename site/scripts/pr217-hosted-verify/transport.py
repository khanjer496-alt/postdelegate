"""Hosted-only same-byte container derivation. No uploader or artifact code execution."""
import hashlib,json,os,re,shutil,stat,sys,tarfile,time,unicodedata,zipfile,zlib
from pathlib import Path,PurePosixPath

LABELS=['NON_RELEASE','LOCAL_PREVIEW_FAILED','NOT_ACCEPTED']
ORIGINAL_FILES=('NON_RELEASE.json','candidate-manifest.json','candidate-payload.tar.gz','worker-format.json')
MAX_ZIP=25*1024**2
class TransportRejected(Exception):pass
def need(ok):
 if not ok:raise TransportRejected()
def deadline(end):need(time.monotonic()<end)
def sha_file(p,end):
 need(p.is_file() and not p.is_symlink() and p.stat().st_nlink==1)
 h=hashlib.sha256()
 with p.open('rb') as f:
  while True:
   deadline(end);b=f.read(65536)
   if not b:break
   h.update(b)
 return h.hexdigest()
def freeze_original(bundle,end):return {n:sha_file(bundle/n,end) for n in ORIGINAL_FILES}
def unchanged(bundle,frozen,end):need(freeze_original(bundle,end)==frozen)
def safe_name(name):
 p=PurePosixPath(name)
 need(bool(name) and str(p)==name and not p.is_absolute() and '\\' not in name and ':' not in name)
 need(all(part not in ('.','..') and not part.startswith('.') for part in p.parts) and all(ord(c)>=32 for c in name))
def reject_collisions(names):
 # A shared directory may repeat exactly, but aliased spellings or file/dir kinds may not.
 nodes={};files=set()
 for name in names:
  safe_name(name);need(name not in files);files.add(name)
  parts=PurePosixPath(name).parts;key=[]
  for i,part in enumerate(parts):
   key.append(unicodedata.normalize('NFC',unicodedata.normalize('NFC',part).casefold()))
   identity=('/'.join(parts[:i+1]),'file' if i==len(parts)-1 else 'directory');canonical=tuple(key)
   need(canonical not in nodes or nodes[canonical]==identity);nodes[canonical]=identity

def source_index(bundle,files,end):
 index={}
 with tarfile.open(bundle/'candidate-payload.tar.gz','r:gz') as t:
  for item in t:
   deadline(end);safe_name(item.name)
   need(item.isfile() and not item.issparse() and item.pax_headers in ({},{'path':item.name}) and item.mode==0o644 and item.name in files and item.name not in index and 0<=item.size<=32*1024**2)
   index[item.name]={'sha256':files[item.name],'bytes':item.size,'mode':item.mode}
   need(len(index)<=713 and sum(x['bytes'] for x in index.values())<=64*1024**2)
 need(set(index)==set(files));reject_collisions(index)
 return index
def copy_checked(src,out,record,end):
 h=hashlib.sha256();size=0
 while True:
  deadline(end);b=src.read(65536)
  if not b:break
  size+=len(b);need(size<=record['bytes']);h.update(b)
  if out is not None:out.write(b)
 need(size==record['bytes'] and h.hexdigest()==record['sha256'])
def write_zip(bundle,index,path,end):
 # Canonical metadata and DEFLATE/default-level bytes repeat within the recorded Python/zlib.
 # No cross-version compressor bitstream identity is claimed; member bytes stay exact.
 with tarfile.open(bundle/'candidate-payload.tar.gz','r:gz') as t,zipfile.ZipFile(path,'x',compression=zipfile.ZIP_DEFLATED,allowZip64=False) as z:
  members={x.name:x for x in t.getmembers()}
  need(len(members)==len(index) and set(members)==set(index))
  for name,record in sorted(index.items()):
   deadline(end);item=members[name]
   need(item.isfile() and item.mode==record['mode'] and item.size==record['bytes'])
   info=zipfile.ZipInfo(name,date_time=(1980,1,1,0,0,0));info.create_system=3
   info.external_attr=(stat.S_IFREG|record['mode'])<<16;info.compress_type=zipfile.ZIP_DEFLATED
   with t.extractfile(item) as src,z.open(info,'w') as out:copy_checked(src,out,record,end)
   need(z.fp.tell()<=MAX_ZIP)
 os.chmod(path,0o600);need(path.stat().st_size<=MAX_ZIP)
def reread_zip(path,index,end):
 need(path.stat().st_size<=MAX_ZIP)
 with zipfile.ZipFile(path) as z:
  members=z.infolist()
  need(len(members)==len(index) and len({i.filename for i in members})==len(members) and {i.filename for i in members}==set(index) and not z.comment)
  need([i.filename for i in members]==sorted(index));reject_collisions(i.filename for i in members)
  for item in members:
   deadline(end);safe_name(item.filename);r=index[item.filename]
   need(not item.is_dir() and not(item.flag_bits&~0x800) and item.compress_type==zipfile.ZIP_DEFLATED and not item.extra and not item.comment)
   need(item.create_system==3 and item.external_attr==(stat.S_IFREG|r['mode'])<<16 and item.file_size==r['bytes'] and item.date_time==(1980,1,1,0,0,0))
   # ZipExtFile enforces CRC when completely read; content hash/length are independently bound.
   with z.open(item) as src:copy_checked(src,None,r,end)
def json_file(path,data,cap):
 raw=(json.dumps(data,sort_keys=True,indent=2)+'\n').encode();need(len(raw)<=cap)
 with path.open('xb') as out:os.chmod(path,0o600);out.write(raw)
def derive(bundle,m,frozen,stage,identity,origin,end):
 unchanged(bundle,frozen,end)
 need(not stage.exists() and not stage.is_symlink());stage.mkdir(mode=0o700)
 need(shutil.disk_usage(stage).free>=512*1024**2)
 index=source_index(bundle,m['files'],end);need(len(index)==713)
 need(len(m['generatedOutputs']['outputs'])==115 and len(m['sourceFiles'])==435)
 zip_path=stage/'preview-payload.zip';write_zip(bundle,index,zip_path,end);reread_zip(zip_path,index,end)
 unchanged(bundle,frozen,end)
 record={'schemaVersion':1,'artifactClass':'PR217_SAME_BYTE_TRANSPORT_NOT_RELEASE','labels':LABELS,
  'releaseAccepted':False,'promotionAllowed':False,'runtimeAccepted':False,'visualQa':False,'fitQualified':False,
  'original':{**origin,'innerSha256':frozen,'sourceTree':m['sourceTree'],'producer':m['producer']},
  'derivation':identity,'files':index,'generatedOutputs':m['generatedOutputs'],
  'sourceFiles':m['sourceFiles'],'controlSha256':m['controlSha256'],'workerCompilation':m['workerCompilation'],
  'tools':m['tools'],'producerRecordedToolFileSha256':m['toolFileSha256'],
  'toolIdentity':'PRODUCER_RECORDED_HASHES_VERSION_SCHEMA_ONLY_NOT_REHASHED',
  'zip':{'sha256':sha_file(zip_path,end),'bytes':zip_path.stat().st_size,'fileCount':len(index),'ceilingBytes':MAX_ZIP,'format':'canonical-deflate-zip','compression':{'method':'deflate','level':'zlib-default','python':'.'.join(map(str,sys.version_info[:3])),'zlibRuntime':zlib.ZLIB_RUNTIME_VERSION},'collisionRule':'NFC-casefold-NFC-components-spelling-and-kind','unicodeVersion':unicodedata.unidata_version},
  'checks':{'trustedSchema2VerifiedBeforeDerivation':True,'everyMemberBytesNamesModes':True,'zipRereadCrcHashSet':True,'originalFrozenBeforeAfter':True,'pathCollisionsRejected':True,'actualZipWithinConservativeCeiling':True}}
 json_file(stage/'transport-record.json',record,2*1024**2)
 marker={'labels':LABELS,'releaseAccepted':False,'promotionAllowed':False,
  'recordSha256':sha_file(stage/'transport-record.json',end),'zipSha256':record['zip']['sha256']}
 json_file(stage/'NON_RELEASE.json',marker,4096)
 final_check(bundle,frozen,stage,record,end)
 return record
def final_check(bundle,frozen,stage,record,end):
 unchanged(bundle,frozen,end)
 check_staged(stage,record,end)
 unchanged(bundle,frozen,end)
def check_staged(stage,record,end):
 need({p.name for p in stage.iterdir()}=={'preview-payload.zip','transport-record.json','NON_RELEASE.json'})
 marker=json.loads((stage/'NON_RELEASE.json').read_text())
 need(marker=={'labels':LABELS,'releaseAccepted':False,'promotionAllowed':False,'recordSha256':sha_file(stage/'transport-record.json',end),'zipSha256':sha_file(stage/'preview-payload.zip',end)})
 need(json.loads((stage/'transport-record.json').read_text())==record and record['zip']['sha256']==marker['zipSha256'] and record['zip']['bytes']==(stage/'preview-payload.zip').stat().st_size)
 reread_zip(stage/'preview-payload.zip',record['files'],end)
