#!/usr/bin/env python3
"""NON_RELEASE contract only. No preview/network/upload/release-acceptance entry."""
import hashlib, importlib.util, json, os, re, subprocess, sys, tarfile, tempfile
from pathlib import Path
sys.dont_write_bytecode=True
SOURCE='7c84b1ebffbccb731a972c2ff55e6bc0accea663'
REPO='khanjer496-alt/postdelegate'
LABELS=['NON_RELEASE','LOCAL_PREVIEW_FAILED','NOT_ACCEPTED']
BUNDLE_FILES={'NON_RELEASE.json','candidate-manifest.json','candidate-payload.tar.gz','worker-format.json'}

def require(ok,why):
    if not ok: raise ValueError(why)
def sha(b): return hashlib.sha256(b).hexdigest()
def git(repo,*args): return subprocess.check_output(['git','-C',str(repo),*args])
def helper(source):
    require(git(source,'rev-parse','HEAD').decode().strip()==SOURCE,'helper source head mismatch')
    require((source/'site/scripts/accept-public-payload.py').read_bytes()==git(source,'show',SOURCE+':site/scripts/accept-public-payload.py'),'helper bytes modified')
    spec=importlib.util.spec_from_file_location('reviewed_contract',source/'site/scripts/accept-public-payload.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

def snapshot(source):
    require(git(source,'rev-parse','HEAD').decode().strip()==SOURCE,'wrong source commit')
    records={}
    for item in git(source,'ls-tree','-rz','--full-tree',SOURCE,'--','site').split(b'\0'):
        if not item:continue
        metadata,name=item.split(b'\t',1);mode,kind,blob=metadata.decode().split();name=name.decode()
        require(mode in ('100644','100755') and kind=='blob','nonregular source')
        p=source/name;require(p.is_file() and not p.is_symlink(),'missing/nonregular source')
        data=p.read_bytes();require(data==git(source,'show',SOURCE+':'+name),'tracked source changed')
        records[name]={'gitBlob':blob,'sha256':sha(data),'bytes':len(data),'mode':mode}
    require(bool(records),'empty source');return records

def validate_context(c):
    require(c['repository']==REPO and c['sourceSha']==SOURCE,'wrong repository/source')
    require(c['labels']==LABELS and c['releaseAccepted'] is False,'wrong candidate status')
    require(c['localVerdict']=={'status':'LOCAL_PREVIEW_FAILED','sourceRunId':'43655693022','sourceSha':SOURCE,
        'diagnosticZipSha256':'2fcccf538ee7218e5e2bbeda4ed4ab8ad35e8f40c2a9b985f6c354b3f6556c3e'},'retained failure altered')
    require(c['candidateLocalPreview']=='NOT_RUN_NOT_ACCEPTED','acceptance laundering')
    require(re.fullmatch('[0-9a-f]{40}',c['sourceTree']) is not None,'source tree')
    p=c['producer'];require(re.fullmatch('[0-9a-f]{40}',p['sha']) is not None,'producer sha')
    require(p['sha']==p['workflowSha'] and p['event']=='push','producer/workflow mismatch')
    require(p['workflowRef']==REPO+'/.github/workflows/pr217-nonrelease-candidate.yml@'+p['ref'],'workflow ref mismatch')
    require(p['ref']=='refs/heads/test/pr217-nonrelease-phase-7c84-20261115','unreviewed producer ref')
    require(p['created'] is True and p['deleted'] is False and p['forced'] is False and p['before']=='0'*40 and p['after']==p['sha'] and p['initialParent']==SOURCE,'not the single initial publication event')
    require(p['workflow']=='PR217 NON_RELEASE LOCAL_PREVIEW_FAILED NOT_ACCEPTED candidate','wrong workflow name')
    require({'.github/workflows/pr217-nonrelease-candidate.yml',*['site/scripts/pr217-candidate/'+name for name in ('candidate.py','producer.sh','tool-metadata.mjs','test-candidate.py')]}<=set(p['files']),'missing producer file inventory')
    require(all(re.fullmatch('[0-9a-f]{64}',v['sha256']) and re.fullmatch('[0-9a-f]{40}',v['gitBlob']) for v in p['files'].values()),'producer file hash')
    require(all(re.fullmatch('[1-9][0-9]*',p[x]) for x in ('runId','runAttempt')) and p['runAttempt']=='1','invalid/repeated run identity')
    require(c['tools']['node']=='22.23.4' and c['tools']['pnpm']=='10.6.1' and c['tools']['wrangler']=='4.162.0','tool version mismatch')
    require(set(c['toolFileSha256'])=={'cliLockfile','wranglerPackage','miniflarePackage','workerdPackage','nativeWorkerd','esbuildPackage'},'missing tool identity')
    require(all(re.fullmatch('[0-9a-f]{64}',v) for v in c['toolFileSha256'].values()) and bool(c['toolFileSha256']),'missing tool hashes')

def validate_publication_shape(producer_sha,parents,delta,workflows,event):
    require(parents==[producer_sha,SOURCE],'producer must be one additive commit directly on fixed source')
    expected={'.github/workflows/pr217-nonrelease-candidate.yml',*['site/scripts/pr217-candidate/'+name for name in ('candidate.py','producer.sh','tool-metadata.mjs','test-candidate.py')]}
    require(set(delta)=={'A\t'+p for p in expected} and len(delta)==len(expected),'non-additive/unexpected producer delta')
    require(set(workflows)=={'.github/workflows/'+n for n in ('build.yml','site-check-v1.yml','uptime.yml','pr217-nonrelease-candidate.yml')},'unexpected workflow/old probe inherited')
    require(event.get('ref')=='refs/heads/test/pr217-nonrelease-phase-7c84-20261115' and event.get('after')==producer_sha,'push payload identity')
    require(event.get('created') is True and event.get('deleted') is False and event.get('forced') is False and event.get('before')=='0'*40,'not initial nonforced push')

def seal(payload,source,bundle,format_path,context,source_records,h):
    validate_context(context)
    require(not bundle.exists() and not bundle.is_symlink(),'fresh candidate directory required')
    require(all(not p.is_file() or p.stat().st_nlink==1 for p in payload.rglob('*')),'hardlinked payload')
    files=h.inventory(payload) # reviewed path/link/private/extension/control rejection
    record=json.loads(format_path.read_text());h.check_worker_format(record,files['_worker.js'])
    controls={name:sha((source/'site/public'/name).read_bytes()) for name in h.CONTROL[1:]}
    require(all(files[name]==value==source_records['site/public/'+name]['sha256'] for name,value in controls.items()),'changed controls')
    require(h.inventory(payload)==files,'payload drift')
    bundle.mkdir()
    archive=bundle/'candidate-payload.tar.gz';h.archive_payload(payload,files,archive)
    require(h.inventory(payload)==files,'payload changed during archive')
    manifest={**context,'schemaVersion':1,'artifactClass':'PR217_NON_RELEASE_CANDIDATE',
       'sourceFiles':source_records,'siteLockfileSha256':source_records['site/pnpm-lock.yaml']['sha256'],
       'files':files,'controlSha256':controls,'workerCompilation':record,'archiveSha256':sha(archive.read_bytes()),
       'isolatedHttpDiagnostic':'NOT_AUTHORIZED_NOT_RUN','promotionAllowed':False}
    (bundle/'candidate-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    (bundle/'NON_RELEASE.json').write_text(json.dumps({'labels':LABELS,'promotionAllowed':False,'manifestSha256':sha((bundle/'candidate-manifest.json').read_bytes())},indent=2)+'\n')
    (bundle/'worker-format.json').write_bytes(format_path.read_bytes())
    verify(bundle,h)
    return manifest

def verify(bundle,h):
    require(bundle.is_dir() and not bundle.is_symlink(),'invalid candidate bundle')
    require({p.name for p in bundle.iterdir()}==BUNDLE_FILES,'unexpected/release evidence members')
    require(all(p.is_file() and not p.is_symlink() and p.stat().st_nlink==1 for p in bundle.iterdir()),'nonregular bundle member')
    m=json.loads((bundle/'candidate-manifest.json').read_text());validate_context(m)
    marker=json.loads((bundle/'NON_RELEASE.json').read_text())
    require(marker=={'labels':LABELS,'promotionAllowed':False,'manifestSha256':sha((bundle/'candidate-manifest.json').read_bytes())},'candidate marker mismatch')
    require(m['artifactClass']=='PR217_NON_RELEASE_CANDIDATE' and m['promotionAllowed'] is False and m['isolatedHttpDiagnostic']=='NOT_AUTHORIZED_NOT_RUN','candidate identity')
    require(m['archiveSha256']==sha((bundle/'candidate-payload.tar.gz').read_bytes()),'archive digest')
    require(m['siteLockfileSha256']==m['sourceFiles']['site/pnpm-lock.yaml']['sha256'],'source lock mismatch')
    for name,value in m['controlSha256'].items():
        require(name in h.CONTROL[1:] and value==m['files'][name]==m['sourceFiles']['site/public/'+name]['sha256'],'control binding')
    require(set(m['controlSha256'])==set(h.CONTROL[1:]),'missing controls')
    record=json.loads((bundle/'worker-format.json').read_text());require(record==m['workerCompilation'],'worker sidecar mismatch')
    h.check_worker_format(record,m['files']['_worker.js'])
    with tarfile.open(bundle/'candidate-payload.tar.gz','r:gz') as archive:
        members=archive.getmembers()
        require(len(members)<=100000 and sum(x.size for x in members)<=2*1024**3 and all(0<=x.size<=32*1024**2 for x in members),'archive size bound')
        require(len(members)==len(m['files']) and len({x.name for x in members})==len(members),'duplicate/unexpected archive members')
        for item in members:
            h.safe_path(item.name);require(item.isfile() and item.name in m['files'],'nonregular/unexpected member')
            require(sha(archive.extractfile(item).read())==m['files'][item.name],'inner member digest')
    return m

def publication_preflight(producer):
    require(os.environ.get('GITHUB_ACTIONS')=='true' and os.environ.get('GITHUB_REPOSITORY')==REPO,'wrong hosted repository')
    require(os.environ.get('GITHUB_EVENT_NAME')=='push' and os.environ.get('GITHUB_REF')=='refs/heads/test/pr217-nonrelease-phase-7c84-20261115' and os.environ.get('GITHUB_RUN_ATTEMPT')=='1','wrong/repeated event')
    producer_sha=git(producer,'rev-parse','HEAD').decode().strip()
    require(producer_sha==os.environ['REVIEWED_PRODUCER_SHA']==os.environ['PRODUCER_WORKFLOW_SHA'],'producer identity drift')
    parents=git(producer,'rev-list','--parents','-n','1',producer_sha).decode().strip().split()
    delta=git(producer,'diff-tree','--no-commit-id','--name-status','-r',producer_sha).decode().splitlines()
    workflows=git(producer,'ls-tree','-r','--name-only',producer_sha,'--','.github/workflows').decode().splitlines()
    event=json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    validate_publication_shape(producer_sha,parents,delta,workflows,event)
    require(event.get('ref')==os.environ['GITHUB_REF'],'push ref/environment mismatch')
    return producer_sha,parents,event

PHASES=('entry','identity-cleanliness','publication-preflight','source-snapshot','site-install','site-build','cli-install','tool-metadata','raw-compile','raw-stage','control-equality','candidate-seal')
def phase_receipt(path,phase,status,code,completed):
    require(phase in PHASES and status in ('started','failed','completed'),'invalid receipt enum')
    require(type(code) is int and 0<=code<=255,'invalid receipt exit')
    index=PHASES.index(phase)
    require(completed==list(PHASES[:index]),'invalid receipt phase order')
    require((status=='started' and code==0) or (status=='failed' and code!=0) or (status=='completed' and code==0 and phase==PHASES[-1]),'invalid receipt outcome')
    report={'schemaVersion':1,'artifactClass':'PR217_PRODUCER_PHASE_RECEIPT_NOT_PAYLOAD',
       'labels':['NON_RELEASE','PHASE_EVIDENCE_ONLY','NOT_ACCEPTED'],'releasable':False,
       'sourceSha':SOURCE,'phase':phase,'status':status,'completedPhases':completed,
       'exitCode':None if status=='started' else code,'errorClass':'not-finished' if status=='started' else 'command-exit' if status=='failed' else 'none'}
    for key in ('GITHUB_SHA','GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT'):
        value=os.environ.get(key,'')
        report[key] = value if re.fullmatch('[0-9a-f]{40}' if key=='GITHUB_SHA' else '[1-9][0-9]*',value) else 'unavailable'
    path=Path(path)
    require(not path.is_symlink() and (not path.exists() or (path.is_file() and path.stat().st_nlink==1)),'unsafe receipt target')
    if path.exists():
        previous=json.loads(path.read_text())
        require(type(previous) is dict and previous.get('artifactClass')==report['artifactClass'] and previous.get('sourceSha')==SOURCE and all(previous.get(k)==report[k] for k in ('GITHUB_SHA','GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT')),'foreign/cross-run receipt target')
    fd,temporary=tempfile.mkstemp(prefix='.phase-receipt-',dir=path.parent)
    try:
        with os.fdopen(fd,'w') as f: f.write(json.dumps(report,indent=2)+'\n')
        os.replace(temporary,path)
    finally:
        if os.path.exists(temporary):os.unlink(temporary)
    return report

def main():
    mode=sys.argv[1]
    if mode=='phase-receipt':
        phase_receipt(sys.argv[2],sys.argv[3],sys.argv[4],int(sys.argv[5]),sys.argv[6].split(',') if sys.argv[6] else []);return
    source=Path(sys.argv[2]).resolve();h=helper(source)
    if mode=='snapshot':
        Path(sys.argv[3]).write_text(json.dumps(snapshot(source),sort_keys=True)+'\n');return
    if mode=='verify':verify(Path(sys.argv[3]),h);return
    if mode=='publication-preflight':publication_preflight(Path(sys.argv[3]).resolve());return
    require(mode=='seal','invalid command')
    require(os.environ.get('GITHUB_ACTIONS')=='true','hosted producer only')
    producer=Path(sys.argv[3]).resolve();payload=Path(sys.argv[4]);output=Path(sys.argv[5]);fmt=Path(sys.argv[6]);before=Path(sys.argv[7]);tools=Path(sys.argv[8])
    records=snapshot(source);require(records==json.loads(before.read_text()),'source build drift')
    producer_sha,parents,event=publication_preflight(producer)
    tracked=git(producer,'ls-tree','-rz','--full-tree',producer_sha,'--','.github/workflows/pr217-nonrelease-candidate.yml','site/scripts/pr217-candidate')
    producer_files={}
    for item in tracked.split(b'\0'):
        if not item:continue
        meta,name=item.split(b'\t',1);name=name.decode();mode_bits,kind,blob=meta.decode().split()
        require(mode_bits in ('100644','100755') and kind=='blob','producer source link')
        b=(producer/name).read_bytes();require(b==git(producer,'show',producer_sha+':'+name),'producer modified')
        producer_files[name]={'gitBlob':blob,'sha256':sha(b)}
    require(bool(producer_files),'missing producer code identity')
    metadata=json.loads(tools.read_text())
    c={'repository':REPO,'sourceSha':SOURCE,'sourceTree':git(source,'rev-parse',SOURCE+'^{tree}').decode().strip(),
       'labels':LABELS,'releaseAccepted':False,'candidateLocalPreview':'NOT_RUN_NOT_ACCEPTED',
       'localVerdict':{'status':'LOCAL_PREVIEW_FAILED','sourceRunId':'43655693022','sourceSha':SOURCE,'diagnosticZipSha256':'2fcccf538ee7218e5e2bbeda4ed4ab8ad35e8f40c2a9b985f6c354b3f6556c3e'},
       'producer':{'sha':producer_sha,'workflowSha':os.environ['PRODUCER_WORKFLOW_SHA'],'workflowRef':os.environ['GITHUB_WORKFLOW_REF'],
          'workflow':os.environ['GITHUB_WORKFLOW'],'runId':os.environ['GITHUB_RUN_ID'],'runAttempt':os.environ['GITHUB_RUN_ATTEMPT'],
          'event':os.environ['GITHUB_EVENT_NAME'],'ref':os.environ['GITHUB_REF'],'files':producer_files,
          'created':event.get('created'),'deleted':event.get('deleted'),'forced':event.get('forced'),
          'before':event.get('before'),'after':event.get('after'),'initialParent':parents[1]},**metadata}
    seal(payload,source,output,fmt,c,records,h)
    print('NON_RELEASE / LOCAL_PREVIEW_FAILED / NOT_ACCEPTED candidate sealed; no acceptance or promotion.')
if __name__=='__main__':main()
