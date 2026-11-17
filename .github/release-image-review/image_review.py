#!/usr/bin/env python3
"""Manual hosted-runner artifact construction only. No delivery or app execution."""
import argparse
import hashlib
import io
import json
import os
import platform
from pathlib import Path, PurePosixPath
import re
import signal
import subprocess
import tarfile
import time
import urllib.request

HERE=Path(__file__).resolve().parent
BASIS=json.loads((HERE/'capacity-basis.json').read_text())
SOURCE=BASIS['source_sha']; TREE=BASIS['source_tree']
COPY_INPUTS=['.dockerignore','deploy/postdelegate/Dockerfile.release','deploy/postdelegate/fonts','pnpm-lock.yaml','apps/frontend','apps/backend','apps/orchestrator','libraries','tsconfig.base.json','i18n.json']
HELPERS={'.github/workflows/build.yml',*[f'.github/release-image-review/{x}' for x in ['capacity-basis.json','image_review.py','metadata-resolve.cjs','Dockerfile.qa']]}
GIB=1024**3
STORAGE_BINDING=None

def execute(args,**kwargs):
    p=subprocess.run(args,check=True,capture_output=True,**kwargs)
    return p.stdout

def write(file,value):
    data=json.dumps(value,indent=2)+'\n'
    if len(data.encode())>128*1024: raise RuntimeError('BOUNDED_REPORT_EXCEEDED')
    file.write_text(data)

def filesystem(path):
    requested=Path(path)
    if not requested.is_absolute():raise RuntimeError('NONABSOLUTE_STORAGE_PATH')
    real=requested.resolve(strict=True)
    if not real.is_dir():raise RuntimeError('NONDIRECTORY_STORAGE_PATH')
    st=real.stat();vfs=os.statvfs(real)
    candidates=[]
    for line in Path('/proc/self/mountinfo').read_text().splitlines():
        parts=line.split();separator=parts.index('-')
        mount=parts[4].replace('\\040',' ').replace('\\011','\t').replace('\\134','\\')
        if real==Path(mount) or Path(mount) in real.parents:
            candidates.append((len(mount),parts,mount,separator))
    if not candidates:raise RuntimeError('STORAGE_MOUNT_UNRESOLVED')
    _,parts,mount,separator=max(candidates,key=lambda x:x[0])
    major_minor=str(os.major(st.st_dev))+':'+str(os.minor(st.st_dev))
    if parts[2]!=major_minor:raise RuntimeError('STORAGE_DEVICE_AMBIGUOUS')
    source=parts[separator+2]
    return {'requested_path':str(requested),'real_path':str(real),'device':st.st_dev,'major_minor':major_minor,'fsid':getattr(vfs,'f_fsid',None),'mount_id':parts[0],'mountpoint':mount,'filesystem':parts[separator+1],'source':source if re.fullmatch(r'/dev/[A-Za-z0-9_./-]+',source) else 'NON_DEVICE_SOURCE','free_bytes':vfs.f_bavail*vfs.f_frsize,'fragment_bytes':vfs.f_frsize}

def storage_identity(value):
    return {k:value[k] for k in ['real_path','device','major_minor','fsid','mount_id','mountpoint','filesystem','fragment_bytes']}

def resources():
    mem={line.split(':')[0]:int(line.split()[1])*1024 for line in Path('/proc/meminfo').read_text().splitlines() if len(line.split())>=2}
    temp=filesystem(os.environ['RUNNER_TEMP']);spaces={'runner_temp':temp}
    if STORAGE_BINDING is not None:
        docker=filesystem(STORAGE_BINDING['docker_root']['requested_path']);spaces['docker_root']=docker
        for name in spaces:
            if storage_identity(spaces[name])!=storage_identity(STORAGE_BINDING[name]):raise RuntimeError('STORAGE_LAYOUT_CHANGED')
    return {'available_memory_bytes':mem['MemAvailable'],'free_disk_bytes':min(x['free_bytes'] for x in spaces.values()),'filesystems':spaces,'docker_storage_measured':STORAGE_BINDING is not None,'cpu_count':os.cpu_count(),'os':platform.system(),'architecture':platform.machine()}

def bind_storage(out):
    global STORAGE_BINDING
    info=json.loads(execute(['docker','info','--format','{{json .}}'],text=True))
    record={'driver':info.get('Driver'),'docker_root_dir':info.get('DockerRootDir'),'status':'NOT_ADMITTED'}
    try:
        temp=filesystem(os.environ['RUNNER_TEMP']);root=filesystem(info['DockerRootDir'])
        record.update({'runner_temp':temp,'docker_root':root})
        # Containerd/alternate stores may place image data elsewhere. Never infer their root.
        if info.get('Driver')!='overlay2':raise RuntimeError('UNSUPPORTED_OR_AMBIGUOUS_IMAGE_STORE')
        if temp['filesystem'] not in ['ext4','xfs'] or root['filesystem'] not in ['ext4','xfs']:raise RuntimeError('UNSUPPORTED_STORAGE_FILESYSTEM')
        if any(temp[k]!=root[k] for k in ['device','major_minor','fsid','mount_id','filesystem']):raise RuntimeError('DOCKER_AND_TEMP_NOT_SAME_MONITORED_FILESYSTEM')
        record['status']='SAME_FILESYSTEM_BOUND_NOT_CAPACITY_GO'
        STORAGE_BINDING={'runner_temp':temp,'docker_root':root}
        return record
    finally:write(out/'storage.json',record)

def verify_storage_configuration():
    if STORAGE_BINDING is None:raise RuntimeError('DOCKER_STORAGE_NOT_BOUND')
    info=json.loads(execute(['docker','info','--format','{{json .}}'],text=True))
    if info.get('Driver')!='overlay2' or info.get('DockerRootDir')!=STORAGE_BINDING['docker_root']['requested_path']:raise RuntimeError('DAEMON_STORAGE_CONFIGURATION_CHANGED')

def read_json_url(url):
    # Fixed public GitHub metadata only. No token or account credentials.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self,*args,**kwargs): return None
    opener=urllib.request.build_opener(NoRedirect)
    with opener.open(urllib.request.Request(url,headers={'Accept':'application/vnd.github+json','User-Agent':'postdelegate-image-review'}),timeout=30) as response:
        raw=response.read(1024*1024+1)
    if len(raw)>1024*1024: raise RuntimeError('PUBLIC_METADATA_LIMIT')
    return json.loads(raw)

def runner_guard(repo):
    if os.environ.get('GITHUB_EVENT_NAME')!='workflow_dispatch' or os.environ.get('GITHUB_REPOSITORY')!='khanjer496-alt/postdelegate': raise RuntimeError('MANUAL_PUBLIC_REPO_ONLY')
    if os.environ.get('RUNNER_ENVIRONMENT')!='github-hosted' or os.environ.get('RUNNER_OS')!='Linux': raise RuntimeError('STANDARD_HOSTED_LINUX_ONLY')
    event=json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    if event.get('repository',{}).get('private') is not False: raise RuntimeError('PRIVATE_REPO_FORBIDDEN')
    if any(os.environ.get(k) for k in ['DOCKER_HOST','DOCKER_CONTEXT','BUILDX_BUILDER','BUILDKIT_HOST','BUILDX_CONFIG','DOCKER_BUILDKIT','GIT_SSL_NO_VERIFY']): raise RuntimeError('REMOTE_OR_OVERRIDDEN_BUILDER_FORBIDDEN')
    blocked=[k for k,v in os.environ.items() if v and (k in ['GH_TOKEN','GITHUB_TOKEN','SSH_AUTH_SOCK','DOCKER_AUTH_CONFIG','NPM_TOKEN','NODE_AUTH_TOKEN'] or re.match(r'^(AWS_|STRIPE_|SENTRY_AUTH_TOKEN|OPENAI_API_KEY|RESEND_API_KEY)',k))]
    if blocked: raise RuntimeError('PRIVATE_AUTH_ENV_FORBIDDEN')
    public=read_json_url('https://api.github.com/repos/khanjer496-alt/postdelegate')
    if public.get('private') is not False: raise RuntimeError('PUBLIC_REPO_NOT_VERIFIED')
    if execute(['git','rev-parse',SOURCE+'^{tree}'],cwd=repo,text=True).strip()!=TREE: raise RuntimeError('SOURCE_TREE_MISMATCH')
    recipe=execute(['git','show',SOURCE+':deploy/postdelegate/Dockerfile.release'],cwd=repo)
    if hashlib.sha256(recipe).hexdigest()!=BASIS['recipe_sha256']: raise RuntimeError('RECIPE_MISMATCH')
    changed=set(execute(['git','diff','--name-only',SOURCE,'HEAD'],cwd=repo,text=True).splitlines())
    if not changed<=HELPERS: raise RuntimeError('ORCHESTRATION_CHANGED_SOURCE')
    ci=read_json_url('https://api.github.com/repos/khanjer496-alt/postdelegate/actions/runs/'+str(BASIS['required_ci_run']))
    if ci.get('head_sha')!=SOURCE or ci.get('conclusion')!='success': raise RuntimeError('PINNED_REQUIRED_CI_NOT_SUCCESS')
    jobs=read_json_url('https://api.github.com/repos/khanjer496-alt/postdelegate/actions/runs/'+str(BASIS['required_ci_run'])+'/jobs?per_page=100')
    if not jobs.get('jobs') or jobs.get('total_count',0)>100 or any(job.get('conclusion')!='success' or not job.get('steps') or any(step.get('conclusion')!='success' for step in job['steps']) for job in jobs['jobs']):raise RuntimeError('PINNED_CI_STEP_NOT_SUCCESS')
    return {'source':SOURCE,'tree':TREE,'orchestration_sha':execute(['git','rev-parse','HEAD'],cwd=repo,text=True).strip(),'source_ci':BASIS['required_ci_run'],'recipe_sha256':BASIS['recipe_sha256'],'selected_source_input_trees_equal':True,'extracted_archive_verified':False,'context_equivalence_scope':'Git trees of selected COPY inputs only; no archive or image in capacity mode','no_registry_credentials':True}

def archive(repo,dest,paths):
    dest.mkdir(mode=0o700)
    data=execute(['git','archive','--format=tar',SOURCE,*paths],cwd=repo)
    with tarfile.open(fileobj=io.BytesIO(data)) as source:
        for item in source.getmembers():
            p=PurePosixPath(item.name)
            if p.is_absolute() or '..' in p.parts or item.issym() or item.islnk() or not (item.isfile() or item.isdir()): raise RuntimeError('CONTEXT_TYPE_OR_PATH')
            if any(x in ['.git','.npmrc','.netrc','id_rsa','id_ed25519'] or x=='.env' or x.startswith('.env.') for x in p.parts): raise RuntimeError('ENV_OR_AUTH_CONTEXT')
        source.extractall(dest,filter='data')
    return hashlib.sha256(data).hexdigest()

def capacity(repo,out,mode='capacity-only'):
    identity=runner_guard(repo); observed=resources()
    result={**identity,'mode':mode,'mode_scope':'New image-review job only; unchanged ordinary CI runs first on its separate VM','basis':BASIS,'observed':observed,'historical_peak_rss_measured':False,'capacity_model_estimate':True,'source_ci_is_not_image_evidence':True}
    result['runner_temp_estimated_budget_fits']=observed['available_memory_bytes']>=BASIS['required_available_memory_bytes'] and observed['free_disk_bytes']>=BASIS['required_free_disk_bytes']
    result['docker_storage_status']='UNMEASURED_DOCKER_FREE_CAPACITY_ONLY'
    result['image_build_admitted']=False
    result['status']='CAPACITY_ONLY_NO_IMAGE_OR_RUNTIME'
    write(out/'capacity.json',result)
    return result

def guarded_build(args,out,phase='release'):
    verify_storage_configuration()
    current=resources()
    required_memory=BASIS['required_available_memory_bytes'] if phase=='release' else BASIS['qa_copy_memory_estimate_bytes']+BASIS['memory_reserve_bytes']
    required_disk=BASIS['required_free_disk_bytes'] if phase=='release' else BASIS['qa_copy_disk_estimate_bytes']+BASIS['disk_reserve_bytes']
    if current['available_memory_bytes']<required_memory or current['free_disk_bytes']<required_disk: raise RuntimeError('BUILD_ADMISSION_NOT_FIT')
    # No custom/privileged builder or global daemon setting is created/changed.
    if execute(['docker','ps','-q'],text=True).strip(): raise RuntimeError('OTHER_CONTAINER_WORK_PRESENT')
    p=subprocess.Popen(args,start_new_session=True)
    record={'argv':args,'phase':phase,'status':'RUNNING','minimum_memory':current['available_memory_bytes'],'minimum_disk':current['free_disk_bytes'],'started':time.time()}
    try:
        while p.poll() is None:
            current=resources();record['minimum_memory']=min(record['minimum_memory'],current['available_memory_bytes']);record['minimum_disk']=min(record['minimum_disk'],current['free_disk_bytes'])
            if current['available_memory_bytes']<BASIS['memory_reserve_bytes']+BASIS['cancellation_margin_bytes'] or current['free_disk_bytes']<BASIS['disk_reserve_bytes']+BASIS['cancellation_margin_bytes']:
                record['status']='OWNED_BUILD_CANCEL_REQUESTED_RESERVE'
                raise RuntimeError('OWNED_BUILD_RESERVE_LIMIT')
            time.sleep(0.5)
        record['exit_code']=p.returncode;record['status']='EXITED_UNADMITTED_ARTIFACT' if p.returncode==0 else 'FAILED'
        if p.returncode: raise RuntimeError('BUILD_NONZERO')
        verify_storage_configuration()
    except BaseException as error:
        # Includes lost/unsupported filesystem metrics: never leave an admitted build running.
        record['failure_type']=type(error).__name__
        if p.poll() is None:
            if record['status']!='OWNED_BUILD_CANCEL_REQUESTED_RESERVE':record['status']='OWNED_BUILD_CANCEL_REQUESTED_PREFLIGHT_OR_METRIC_ERROR'
            os.killpg(p.pid,signal.SIGINT)
            try:p.wait(timeout=30)
            except subprocess.TimeoutExpired:record['status']='CANCEL_UNCONFIRMED_JOB_MUST_END'
        elif record['status']=='EXITED_UNADMITTED_ARTIFACT':record['status']='FAILED_POST_BUILD_STORAGE_CHECK'
        raise
    finally:
        record['finished']=time.time();write(out/('build-'+str(len(list(out.glob('build-*.json'))))+'.json'),record)

def copied_bytes(container,path,limit=8*1024*1024):
    if not path.startswith('/app/') or '..' in PurePosixPath(path).parts: raise RuntimeError('METADATA_PATH_OUTSIDE_APP')
    p=subprocess.Popen(['docker','cp','-L',container+':'+path,'-'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
    raw=p.stdout.read(limit+1024*1024+1)
    if len(raw)>limit+1024*1024:
        p.terminate();p.wait(timeout=10);raise RuntimeError('METADATA_TAR_LIMIT')
    if p.wait(timeout=30):raise RuntimeError('METADATA_COPY_FAILED')
    with tarfile.open(fileobj=io.BytesIO(raw)) as archive:
        files=[x for x in archive.getmembers() if x.isfile()]
        if len(files)!=1 or files[0].size>limit: raise RuntimeError('METADATA_MEMBER_LIMIT')
        return archive.extractfile(files[0]).read()

def inventory(image,source_schema,out,kind):
    # A bare built-in-only Node metadata process; no dependency/AppModule import.
    observed=resources()
    if observed['available_memory_bytes']<BASIS['memory_reserve_bytes']+512*1024**2 or observed['free_disk_bytes']<BASIS['disk_reserve_bytes']+128*1024**2:raise RuntimeError('METADATA_RESERVE_NOT_FIT')
    image_info=json.loads(execute(['docker','image','inspect',image],text=True))[0]
    env=dict(x.partition('=')[::2] for x in image_info['Config'].get('Env',[]))
    if env.get('LD_PRELOAD') or env.get('LD_LIBRARY_PATH'):raise RuntimeError('NATIVE_PRELOAD_ENV_UNVALIDATED_NO_PROBE')
    if any(p=='/app' or p.startswith('/app/') for p in (image_info['Config'].get('Volumes') or {})):raise RuntimeError('APP_OVERLAY_VOLUME_UNVALIDATED_NO_PROBE')
    if image_info['Config'].get('Labels',{}).get('org.opencontainers.image.revision')!=SOURCE or image_info['Config'].get('WorkingDir')!='/app':raise RuntimeError('IMAGE_SOURCE_OR_WORKDIR_MISMATCH')
    container=execute(['docker','create','--network','none','--no-healthcheck','--read-only','--memory','384m','--memory-swap','384m','--cpus','0.5','--pids-limit','64','--cap-drop','ALL','--security-opt','no-new-privileges:true','-e','NODE_OPTIONS=--max-old-space-size=256','-e','NODE_PATH=','-e','NODE_V8_COVERAGE=','--label','com.postdelegate.image-review=metadata-only','--entrypoint','/usr/local/bin/node',image,'-e',(HERE/'metadata-resolve.cjs').read_text()],text=True).strip()
    try:
        c=json.loads(execute(['docker','inspect',container],text=True))[0]
        if c['State']['Running'] or c['HostConfig']['NetworkMode']!='none' or c['HostConfig']['Binds'] or c['HostConfig']['PortBindings'] or c['HostConfig']['Privileged'] or any(x['Type']!='volume' for x in c['Mounts']):raise RuntimeError('METADATA_PRESTART_ISOLATION')
        node=execute(['docker','start','--attach',container],text=True)
        state=json.loads(execute(['docker','inspect',container],text=True))[0]['State']
        if state['Running'] or state['ExitCode']!=0 or state['OOMKilled']:raise RuntimeError('METADATA_NODE_DID_NOT_EXIT_CLEANLY')
        resolved=json.loads(node)
    except Exception:
        execute(['docker','rm','-v',container]);raise
    commands={}
    for key in ['Entrypoint','Cmd']:
        values=image_info['Config'].get(key) or []
        commands[key]={'executable':values[0] if values and re.fullmatch(r'[/.A-Za-z0-9_-]{1,128}',values[0]) else 'NON_PATH_OR_EMPTY','argument_count':len(values),'argv_sha256':hashlib.sha256(json.dumps(values).encode()).hexdigest()}
    result={'kind':kind,'metadata_container_id':container,'image_id':image_info['Id'],'repo_digests':image_info.get('RepoDigests',[]),'size':image_info['Size'],'os':image_info['Os'],'architecture':image_info['Architecture'],'workdir':'/app','commands':commands,'revision':SOURCE,'node':resolved['node'],'glibc_runtime':resolved['glibcRuntime'],'resolution_limits':resolved['resolutionLimits'],'contexts':{},'hashes':{},'env_file_presence':resolved['envFilePresence'],'no_application_execution':True,'phase':'UNADMITTED_METADATA_ONLY'}
    try:
        c=json.loads(execute(['docker','inspect',container],text=True))[0]
        if c['State']['Running'] or c['HostConfig']['Binds'] or any(x['Type']!='volume' for x in c['Mounts']): raise RuntimeError('INSPECTION_MOUNT_OR_RUNNING')
        for label,items in resolved['contexts'].items():
            result['contexts'][label]={}
            for package,entry in items.items():
                if 'path' not in entry:result['contexts'][label][package]={'status':'NOT_RESOLVED'};continue
                raw=copied_bytes(container,entry['path']);data=json.loads(raw);version=data.get('version','')
                if data.get('name')!=package or not re.fullmatch(r'[0-9A-Za-z.+_-]{1,80}',version): raise RuntimeError('MANIFEST_IDENTITY')
                result['contexts'][label][package]={'path':entry['path'],'version':version,'manifest_sha256':hashlib.sha256(raw).hexdigest()}
        for key,path in resolved['files'].items():
            if path is None:result['hashes'][key]={'status':'NOT_RESOLVED'};continue
            raw=copied_bytes(container,path);result['hashes'][key]={'path':path,'sha256':hashlib.sha256(raw).hexdigest()}
            if key=='rootManifest':
                data=json.loads(raw);script=data.get('scripts',{}).get('prisma-generate','');result['prisma_generation_script']={'sha256':hashlib.sha256(script.encode()).hexdigest(),'mentions_pinned_6_5_0':'6.5.0' in script,'uses_dlx':'dlx' in script}
            if key=='generatedPackage':result['generated_client_package_version']=json.loads(raw).get('version')
        result['generated_schema_matches_source']=result['hashes'].get('generatedSchema',{}).get('sha256')==source_schema
        sensitive=[]
        for item in image_info['Config'].get('Env',[]):
            key,_,value=item.partition('=')
            if value and re.search(r'SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY|DATABASE_URL|REDIS_URL',key):sensitive.append(key)
        result['nonempty_sensitive_env_names']=sensitive # names only, never values
        result['config_projection_sha256']=hashlib.sha256(json.dumps(image_info['Config'],sort_keys=True).encode()).hexdigest()
        result['oci_config_digest']=None;result['oci_manifest_digest']=None
        result['consumer_identity_status']='UNDELIVERED: engine image ID/projection hash are not asserted as registry OCI digest pair'
        expected={'next':'16.4.5','@next/env':'16.4.5','@next/swc-linux-x64-gnu':'16.4.5','nestjs-temporal-core':'3.2.3','@nestjs/core':'11.2.7','@nestjs/common':'11.2.7','@prisma/client':'6.5.0','prisma':'6.5.0'}
        expected.update({x:'1.15.0' for x in ['@temporalio/worker','@temporalio/client','@temporalio/workflow','@temporalio/activity','@temporalio/common','@temporalio/proto','@temporalio/core-bridge']})
        result['unvalidated_differences']=[{'context':label,'package':name,'expected':version,'observed':items[name].get('version','NOT_RESOLVED')} for label,items in result['contexts'].items() for name,version in expected.items() if name in items and items[name].get('version')!=version]
        if not result['generated_schema_matches_source']:result['unvalidated_differences'].append({'package':'generated_schema','status':'SOURCE_HASH_MISMATCH_OR_UNRESOLVED'})
        if result.get('generated_client_package_version')!='6.5.0':result['unvalidated_differences'].append({'package':'generated_client_package_version','expected':'6.5.0','observed':result.get('generated_client_package_version')})
        write(out/(kind+'-inventory.json'),result)
    finally:
        # Only this stopped inspection container and its automatically created anonymous volumes.
        execute(['docker','rm','-v',container])
    if result['revision']!=SOURCE or result['node']!='v22.23.4' or result['os']!='linux' or result['architecture']!='amd64' or not result['glibc_runtime']: raise RuntimeError('IMAGE_IDENTITY_NOT_QUALIFIED')
    for name in ['next','@next/env','@next/swc-linux-x64-gnu']:
        if any(items[name].get('version')!='16.4.5' for items in result['contexts'].values() if name in items):raise RuntimeError('NEXT_PARITY_MANDATORY')
    return result

def build_metadata(repo,out):
    result=capacity(repo,out,mode='build-metadata-preflight')
    if not result['runner_temp_estimated_budget_fits']:raise RuntimeError('CAPACITY_ESTIMATE_NOT_FIT_NO_PULL')
    if execute(['docker','context','show'],text=True).strip()!='default':raise RuntimeError('NONDEFAULT_BUILDER_CONTEXT')
    endpoint=json.loads(execute(['docker','context','inspect','default'],text=True))[0]['Endpoints']['docker']['Host']
    if endpoint!='unix:///var/run/docker.sock':raise RuntimeError('NONLOCAL_DAEMON')
    builder=execute(['docker','buildx','inspect','default'],text=True)
    if 'Driver:        docker' not in builder or builder.count('Endpoint:')!=1:raise RuntimeError('NONDEFAULT_OR_CUSTOM_BUILDER')
    server=json.loads(execute(['docker','version','--format','{{json .Server}}'],text=True))
    write(out/'engine.json',{'engine_version':server['Version'],'api_version':server['ApiVersion'],'engine_commit':server['GitCommit'],'os':server['Os'],'architecture':server['Arch'],'buildx_version':execute(['docker','buildx','version'],text=True).strip(),'default_driver':'docker','created_or_reconfigured_builder':False})
    bind_storage(out)
    result['docker_storage_preflight']=resources()
    if result['docker_storage_preflight']['free_disk_bytes']<BASIS['required_free_disk_bytes']:raise RuntimeError('DOCKER_STORAGE_BUDGET_NOT_FIT_NO_PULL')
    work=out.parent/'owned-context';result['archive_sha256']=archive(repo,work,COPY_INPUTS);result['extracted_archive_verified']=True;write(out/'capacity.json',result)
    recipe=work/'deploy/postdelegate/Dockerfile.release'
    if hashlib.sha256(recipe.read_bytes()).hexdigest()!=BASIS['recipe_sha256']:raise RuntimeError('ARCHIVE_RECIPE_MISMATCH')
    release='postdelegate-review:release-'+SOURCE
    old=Path.cwd()
    try:
        os.chdir(work)
        guarded_build(['docker','build','--progress=plain','--build-arg','SOURCE_REVISION='+SOURCE,'-f','deploy/postdelegate/Dockerfile.release','-t',release,'.'],out)
    finally:os.chdir(old)
    schema=hashlib.sha256((work/'libraries/nestjs-libraries/src/database/prisma/schema.prisma').read_bytes()).hexdigest()
    first=inventory(release,schema,out,'release')
    # QA copy-only layer: any missing tooling blocks instead of mutating installed production deps.
    for label in ['root','frontend','backend','orchestrator']:
        items=first['contexts'][label]
        if items['@nestjs/testing'].get('version')!=items['@nestjs/core'].get('version') or any(items[x].get('status') for x in ['ts-node','tsconfig-paths','expect']):raise RuntimeError('QA_TOOLING_REVIEW_REQUIRED_NO_INSTALL')
    qa_context=out.parent/'owned-qa-context';archive(repo,qa_context,['test/fixtures/mcp-authenticated-qa']);(qa_context/'Dockerfile.qa').write_bytes((HERE/'Dockerfile.qa').read_bytes())
    qa='postdelegate-review:qa-'+SOURCE
    guarded_build(['docker','build','--progress=plain','--build-arg','REVIEWED_RELEASE_IMAGE='+first['image_id'],'-f',str(qa_context/'Dockerfile.qa'),'-t',qa,str(qa_context)],out,phase='qa-copy-only')
    second=inventory(qa,schema,out,'qa')
    equal=first['contexts']==second['contexts'] and first['hashes']==second['hashes']
    write(out/'comparison.json',{'source':SOURCE,'tree':TREE,'production_dependency_metadata_unchanged_in_qa':equal,'image_ids':[first['image_id'],second['image_id']],'status':'IMAGES_UNADMITTED_NO_REGISTRY_OR_RUNTIME','source_ci_not_image_runtime_proof':True})
    if not equal:raise RuntimeError('QA_LAYER_CHANGED_PRODUCTION_DEPENDENCIES')

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--mode',choices=['capacity-only','build-metadata'],required=True);parser.add_argument('--repo',type=Path,required=True);parser.add_argument('--out',type=Path,required=True);args=parser.parse_args()
    temp=Path(os.environ['RUNNER_TEMP']).resolve()
    if args.repo.resolve()!=temp/'postdelegate-image-review' or args.out.resolve()!=temp/'postdelegate-image-result':raise RuntimeError('EXPLICIT_OWNED_JOB_PATHS_REQUIRED')
    args.repo=args.repo.resolve();args.out=args.out.resolve()
    args.out.mkdir(mode=0o700,parents=True,exist_ok=False)
    try:
        if args.mode=='capacity-only':capacity(args.repo,args.out)
        else:build_metadata(args.repo,args.out)
    except Exception as error:
        write(args.out/'failure.json',{'status':'FAILED_NOT_QUALIFIED','error_type':type(error).__name__,'code':str(error) if re.fullmatch(r'[A-Z0-9_ :.-]{1,120}',str(error)) else 'BOUNDED_FAILURE','mode':args.mode});raise

if __name__=='__main__':main()
