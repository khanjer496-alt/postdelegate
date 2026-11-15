"""Declarative metadata only; SOURCE_BOUND never means runtime observed."""
import hashlib,json
REPO='khanjer496-alt/postdelegate';SOURCE='7c84b1ebffbccb731a972c2ff55e6bc0accea663';RULE='PR217-CJSON-ASCII-v1';RECORD='ad31db5ed373b4bdf674d1d727b256cd3e0f87dbe42e114f4ae8bb87b60b4ea3'
class OracleRejected(Exception):pass
def need(ok):
 if not ok:raise OracleRejected()
def build(index,source,packet_hashes,blobs):
 config=source['site/astro.config.mjs'].decode();need("output: 'static'" in config and "format: 'file'" in config and "trailingSlash: 'never'" in config)
 need(b'new URL(canonicalPath, SITE.url).href' in source['site/src/layouts/Base.astro'] and b'pagePath(Astro.url)' in source['site/src/layouts/Base.astro'] and b"url:'https://postdelegate.com'" in source['site/src/data/site.ts'])
 registry={};refs={n:'s'+str(i) for i,n in enumerate(source,1)}
 for name,b in source.items():
  need(name in blobs);registry[refs[name]]={'kind':'GIT_SOURCE','repository':REPO,'sha':SOURCE,'path':name,'git_blob':blobs[name],'sha256':hashlib.sha256(b).hexdigest(),'line_start':1,'line_end':len(b.decode().splitlines())}
 headers={};current=None
 for line in source['site/public/_headers'].decode().splitlines():
  if not line.strip():continue
  if not line[0].isspace():current=line;need(current not in headers);headers[current]={}
  else:
   name,sep,value=line.strip().partition(':');need(sep and name.lower() not in headers[current]);headers[current][name.lower()]=value.strip()
 security=headers['/*'];need(set(security)=={'strict-transport-security','x-content-type-options','referrer-policy','x-frame-options','permissions-policy','content-security-policy'})
 redirects={}
 for line in source['site/public/_redirects'].decode().splitlines():
  if line.strip() and not line.lstrip().startswith('#'):
   path,target,status=line.split();need(path not in redirects);redirects[path]={'status':int(status),'location':target}
 header_sets={'security':security};rows=[];file_refs={};header_keys={};profile_keys={}
 def oracle(state,value,ref,reason):
  need(state in ('SOURCE_BOUND','UNBOUND','NOT_APPLICABLE') and (state=='SOURCE_BOUND' or value is None))
  return {'state':state,'value':value,'provenance_ref':refs.get(ref,ref),'reason_enum':reason}
 def unbound(reason,ref=None):return oracle('UNBOUND',None,ref,reason)
 def na(reason):return oracle('NOT_APPLICABLE',None,None,reason)
 def bound(v,ref,reason='EXPECTED_ONLY'):return oracle('SOURCE_BOUND',v,ref,reason)
 def file(name):
  need(name in index)
  if name not in file_refs:file_refs[name]='f'+str(len(file_refs)+1)
  ref=file_refs[name]
  registry[ref]={'kind':'AUTHENTICATED_TRANSPORT_RECORD','record_sha256':RECORD,'json_pointer':'/files/'+name.replace('~','~0').replace('/','~1')}
  return index[name],ref
 def add(i,path='/',accept='text/html',kind='H',host='I',client='A',method='GET'):
  row={'id':i,'host_role':host,'client_role':client,'method':method,'path':path,'accept':accept,'ua':'PostDelegate-PR217-Diagnostic-v1','phase':'CONTENT' if i<50 else 'RESERVED_CLEANUP_SEPARATE_GO','kind':kind,'oracles':{}}
  a=row['oracles'];a['delivery']=unbound('PLATFORM_DELIVERY_ALIAS_ACCESS_NOT_QUALIFIED');a['platform_noindex']=unbound('PLATFORM_NOINDEX_NOT_QUALIFIED')
  a['body_sha256']=unbound('BODY_UNBOUND');a['body_bytes']=unbound('BODY_UNBOUND');a['member']=unbound('NO_PUBLIC_MEMBER_MAPPING');a['status']=unbound('PLATFORM_STATUS')
  a['header_set']=na('NO_SOURCE_HEADER_SET');a['security_headers']=na('ACCESS_OR_PLATFORM_RESPONSE_NOT_APP_SOURCE');a['cache']=unbound('PLATFORM_CACHE_NOT_QUALIFIED');a['media_type']=unbound('PLATFORM_MIME_NOT_QUALIFIED');a['canonical_body']=na('NO_SOURCE_HTML_ASSERTION')
  if kind in ('DENY','APEX_UNDEPLOYED'):
   a['status']=unbound('ACCESS_DENIAL_UNBOUND' if kind=='DENY' else 'UNDEPLOYED_APEX_UNBOUND');a['body_sha256']=unbound('ACCESS_OR_PLATFORM_BODY_UNBOUND')
  elif kind=='REDIRECT':
   need(path in redirects);a['status']=bound(redirects[path]['status'],'site/public/_redirects');a['location']=bound(redirects[path]['location'],'site/public/_redirects');a['body_sha256']=na('REDIRECT_BODY_PLATFORM_GENERATED');a['body_bytes']=na('REDIRECT_BODY_PLATFORM_GENERATED')
  elif kind=='404':
   _,ref=file('404.html');a['source_404_candidate']=bound('404.html',ref,'FILE_NOT_FALLBACK');a['status']=unbound('FALLBACK_UNBOUND','site/src/pages/404.astro')
  else:
   member=('index.html' if path=='/' else path[1:]+'.html') if kind=='H' else path[1:]+'.md' if kind=='M' else path[1:]
   value,ref=file(member);a['member']=bound(member,ref,'INDEX_ASTRO_FILE');a['security_headers']=bound('security','site/public/_headers','POLICY_NOT_RESPONSE')
   if method=='HEAD':a['body_sha256']=na('HEAD_HAS_NO_ENTITY_HASH');a['body_bytes']=na('HEAD_EMPTY_UNOBSERVED')
   else:a['body_sha256']=bound(value['sha256'],ref,'PRIOR_INDEX_ONLY');a['body_bytes']=bound(value['bytes'],ref,'PRIOR_INDEX_ONLY')
   expected={};basis='site/public/_headers'
   if kind=='M':
    basis='site/functions/docs/_middleware.ts';expected={'content-type':'text/markdown; charset=utf-8','cache-control':'private, max-age=0, must-revalidate','vary':'Accept','content-location':path+'.md','link':'<https://postdelegate.com'+path+'>; rel="canonical"','access-control-allow-origin':'*'};a['status']=bound(200,basis)
   elif kind=='DIRECT_M':
    nested=path.startswith('/docs/');expected=dict(headers['/docs/*.md' if nested else '/docs.md']);expected['link']='<https://postdelegate.com'+path[:-3]+'>; rel="canonical"'
    if nested:expected['vary']='Accept'
    a['content_location']=bound('ABSENT',basis);a['root_direct_vary']=na('NO_ROOT_VARY_REQUIREMENT') if not nested else bound('Accept',basis)
   elif kind=='H':
    a['canonical_body']=bound('https://postdelegate.com'+path,'site/src/layouts/Base.astro','CANONICAL_NOT_PARSED')
    if path.startswith('/docs'):expected['vary']='Accept';basis='site/functions/docs/_middleware.ts';a['content_location']=bound('ABSENT',basis)
   else:expected=dict(headers['/fonts/*' if path.startswith('/fonts/') else path])
   if 'content-type' in expected:a['media_type']=bound(expected['content-type'],basis)
   if 'cache-control' in expected:a['cache']=bound(expected['cache-control'],basis)
   if expected:
    encoded=json.dumps(expected,sort_keys=True,separators=(',',':'))
    if encoded not in header_keys:header_keys[encoded]='headers:'+str(len(header_keys)+1)
    key=header_keys[encoded];header_sets[key]=expected;a['header_set']=bound(key,basis)
  if kind in ('REDIRECT','404'):a['security_headers']=bound('security','site/public/_headers','POLICY_NOT_RESPONSE')
  a.pop('delivery');a.pop('platform_noindex')
  profile={key:a.pop(key) for key in ('header_set','security_headers','cache','media_type')}
  profile['delivery']=unbound('PLATFORM_DELIVERY_UNBOUND');profile['platform_noindex']=unbound('PLATFORM_NOINDEX_UNBOUND')
  encoded=json.dumps(profile,sort_keys=True,separators=(',',':'))
  if encoded not in profile_keys:profile_keys[encoded]='profile:'+str(len(profile_keys)+1)
  key=profile_keys[encoded];header_sets[key]=profile
  a['header_profile']=bound(key,'site/public/_headers','PROFILE_REF')
  if kind!='H':a.pop('canonical_body')
  rows.append(row)
 add(1,kind='DENY',client='D');add(2);add(3,kind='DENY',client='D',host='B');add(4,host='B');add(5,kind='DENY',client='D',host='P');add(6,kind='APEX_UNDEPLOYED',host='P')
 for i,path in enumerate(('/alternatives','/alternatives/recurpost','/alternatives/post-planner','/alternatives/coschedule','/alternatives/rella'),7):add(i,path)
 add(12,'/__pr217_no_such_route_7c84__',kind='404');add(13,'/openapi.json','application/json','STATIC');add(14,'/fonts/plus-jakarta-sans.woff2','text/markdown','STATIC');add(15,'/agents/AGENTS.md','text/markdown','STATIC')
 for i,path in ((16,'/auth'),(17,'/auth/'),(18,'/privacy')):add(i,path,kind='REDIRECT')
 add(19,'/auth/login',kind='404')
 for start,path in ((20,'/docs'),(35,'/docs/channels/telegram')):
  choices=[('OMIT','H'),('text/html;q=1, text/markdown;q=0.5','H'),('text/markdown;q=1, text/html;q=0.5','M'),('text/html;q=1, text/markdown;q=1','M'),('text/html;q=1, text/markdown;q=0','H'),('*/*','H')]
  for offset,(accept,kind) in enumerate(choices):add(start+offset,path,accept,kind)
  add(start+6,path,'text/html','H',method='HEAD');add(start+7,path,'text/markdown','M',method='HEAD');add(start+8,path+'.md','text/markdown','DIRECT_M')
  for offset,kind in enumerate(('H','M','H','M','H','M'),9):add(start+offset,path,'text/html' if kind=='H' else 'text/markdown',kind)
 for i,host in ((50,'I'),(51,'B'),(52,'P')):add(i,kind='DENY',host=host)
 need([r['id'] for r in rows]==list(range(1,53)))
 for row in rows:
  for value in row['oracles'].values():need(value['provenance_ref'] is None or value['provenance_ref'] in registry)
 return {'projection_schema_version':1,'canonical_rule':RULE,'identity_ref':'identity-binding.json','source_control_hashes':{},'provenance_registry':registry,'header_sets':header_sets,'rows':rows,'unbound_gates':['NOT_READY_NO_EXECUTION','I_B_P_HOST_ALIAS_ACCESS_AUTH_BINDINGS','DEFAULT_MIME_CACHE_NOINDEX_DELIVERY','SOURCE_404_NOT_PLATFORM_FALLBACK','CLIENT_PROTOCOL_EMPTY_HEAD_ENTITY_CHECK_NOT_RUN','CANONICAL_BODY_NOT_PARSED','TOOLS_RECORDED_ONLY_NO_NEW_BODY_VALIDATION','V3_49_CONTENT_3_CLEANUP_60_TOTAL_300S_30S_900S_LIMITS_UNCHANGED','PACKETS:'+packet_hashes['controlsV3']+':'+packet_hashes['executionV1']]}
