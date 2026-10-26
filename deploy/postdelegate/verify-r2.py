#!/usr/bin/env python3
"""Exercise the real Postiz multipart API and anonymous public media delivery."""
from pathlib import Path
import binascii
import hashlib
import json
import struct
import urllib.request
import zlib

token = json.loads(Path('/etc/postiz/verification-session.json').read_text())['auth']
def api(path, body):
    request = urllib.request.Request('http://127.0.0.1:4007/api/media/' + path,
        data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', 'auth': token})
    with urllib.request.urlopen(request, timeout=90) as response:
        return json.load(response)

def chunk(kind, payload):
    return struct.pack('>I', len(payload)) + kind + payload + struct.pack('>I', binascii.crc32(kind + payload) & 0xffffffff)

data = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 6, 0, 0, 0))
    + chunk(b'IDAT', zlib.compress(b'\x00\x44\x88\xcc\xff')) + chunk(b'IEND', b''))
file = {'name': 'postiz-deployment-smoke.png', 'type': 'image/png'}
upload = api('create-multipart-upload', {'file': file, 'fileHash': hashlib.sha256(data).hexdigest()})
upload_id, key = upload['uploadId'], upload['key']
try:
    signed = api('sign-part', {'key': key, 'uploadId': upload_id, 'partNumber': 1})
    request = urllib.request.Request(signed['url'], data=data, method='PUT', headers={
        'Content-Type': 'image/png', 'Origin': 'https://app.postdelegate.com'})
    with urllib.request.urlopen(request, timeout=90) as response:
        assert response.status == 200
        etag = response.headers['ETag']
        assert response.headers.get('Access-Control-Allow-Origin') == 'https://app.postdelegate.com'
    completed = api('complete-multipart-upload', {'key': key, 'uploadId': upload_id,
        'parts': [{'ETag': etag, 'PartNumber': 1}], 'file': file})
except Exception:
    api('abort-multipart-upload', {'key': key, 'uploadId': upload_id})
    raise

url = completed.get('Location') or completed.get('location')
assert url and url.startswith('https://media.postdelegate.com/'), 'Unexpected public media origin'
public_request = urllib.request.Request(url, headers={'User-Agent': 'PostDelegate-Postiz-deployment-check/1.0'})
with urllib.request.urlopen(public_request, timeout=45) as response:
    downloaded = response.read()
    assert response.status == 200 and downloaded == data, 'Public media bytes differ'
result = {'multipart_upload': 'passed', 'signed_browser_origin_cors': 'passed',
    'anonymous_https_download': 'passed', 'bytes_match': True, 'media_url': url,
    'saved_media_record': bool(completed.get('saved'))}
print(json.dumps(result))
Path('/etc/postiz/r2-verification.json').write_text(json.dumps(result, indent=2) + '\n')
