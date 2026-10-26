#!/usr/bin/env python3
"""Create/reuse the first owner over loopback and print only nonsecret checks."""
from http.cookies import SimpleCookie
from pathlib import Path
import json
import os
import secrets
import urllib.error
import urllib.request

config = Path('/etc/postiz')
credential_path = config / 'owner-credentials.json'
if credential_path.exists():
    credentials = json.loads(credential_path.read_text())
else:
    email = os.environ.get('POSTIZ_OWNER_EMAIL')
    if not email:
        raise SystemExit('Set POSTIZ_OWNER_EMAIL when creating the first owner.')
    credentials = {'email': email, 'password': secrets.token_urlsafe(32)}
    credential_path.write_text(json.dumps(credentials))
    os.chmod(credential_path, 0o600)

token = None
def request(path, body=None, expected=(200, 201)):
    global token
    headers = {'Content-Type': 'application/json', 'Host': 'app.postdelegate.com'}
    if token:
        headers['auth'] = token
    req = urllib.request.Request('http://127.0.0.1:4007/api' + path,
        data=json.dumps(body).encode() if body is not None else None, headers=headers)
    try:
        response = urllib.request.urlopen(req, timeout=45)
    except urllib.error.HTTPError as exc:
        if exc.code in expected:
            return exc.code, None
        raise RuntimeError(f'{path}: unexpected HTTP {exc.code}') from None
    with response:
        assert response.status in expected, (path, response.status)
        for header in response.headers.get_all('Set-Cookie', []):
            cookie = SimpleCookie(); cookie.load(header)
            if 'auth' in cookie:
                token = cookie['auth'].value
        raw = response.read()
        try:
            data = json.loads(raw)
        except ValueError:
            data = None
        return response.status, data

_, can_register = request('/auth/can-register')
if can_register.get('register'):
    request('/auth/register', {'provider': 'LOCAL', 'company': 'PostDelegate', **credentials})
request('/auth/login', {'provider': 'LOCAL', **credentials})
assert token, 'Login did not return a session cookie'
_, user = request('/user/self')
_, can_register = request('/auth/can-register')
assert can_register.get('register') is False, 'Public registration remains open'
request('/auth/register', {'provider': 'LOCAL', 'company': 'Deployment check',
    'email': 'deployment-check@postdelegate.invalid', 'password': secrets.token_urlsafe(24)}, expected=(400, 403))
posts_status, _ = request('/posts/list?state=all&page=0&limit=20')
media_status, _ = request('/media?page=1')
session_path = config / 'verification-session.json'
session_path.write_text(json.dumps({'auth': token}))
os.chmod(session_path, 0o600)
print(json.dumps({'login': 'passed', 'authenticated_user': bool(user.get('id')),
    'registration_closed': True, 'posts_http': posts_status, 'media_http': media_status,
    'credential_file': str(credential_path)}))
