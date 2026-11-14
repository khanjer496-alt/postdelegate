#!/usr/bin/env python3
"""Accept a loopback Pages preview; seal public output only after every check passes.

No browser execution, external URL fetching, bindings, deploy, or dependencies.
The extract mode validates a previously authenticated bundle before safe extraction.
"""
import argparse
import gzip
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import tarfile
import time
from html import unescape
from html.parser import HTMLParser
from urllib.error import URLError
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

REPOSITORY = 'khanjer496-alt/postdelegate'
ORIGIN = 'https://postdelegate.com'
ROUTES = ['/alternatives/' + name for name in ('recurpost', 'post-planner', 'coschedule', 'rella')]
CONTROL = ('_worker.js', '_routes.json', '_headers', '_redirects')
EXTENSIONS = {'.html', '.js', '.css', '.json', '.xml', '.txt', '.md', '.mdc', '.png', '.svg',
              '.ico', '.webp', '.woff2', '.webmanifest', '.zip'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def safe_path(name):
    path = PurePosixPath(name)
    require(name and not path.is_absolute() and str(path) == name and '\\' not in name
            and ':' not in name and all(ord(char) >= 32 for char in name),
            'unsafe path: ' + name)
    require(all(part not in ('.', '..') and not part.startswith('.') for part in path.parts),
            'hidden/traversal path: ' + name)
    require(not any(re.search(r'(^|[._-])(env|credentials?|secrets?|node_modules|functions|wrangler)([._-]|$)',
                              part, re.I) for part in path.parts), 'private/unexpected path: ' + name)
    require(name in CONTROL or path.suffix in EXTENSIONS, 'unexpected public file: ' + name)
    return path


def inventory(root):
    require(root.is_dir() and not root.is_symlink(), 'payload must be a real directory')
    result = {}
    for file in sorted(root.rglob('*')):
        require(not file.is_symlink(), 'symlink in payload')
        if file.is_dir():
            # Validate directories as well, including empty private directories.
            safe_path(file.relative_to(root).as_posix() + '/placeholder.txt')
            continue
        require(file.is_file(), 'non-regular payload entry')
        name = file.relative_to(root).as_posix()
        safe_path(name)
        result[name] = digest(file.read_bytes())
    for name in CONTROL:
        require(name in result and (root / name).stat().st_size > 0, 'missing required ' + name)
    return result


def text(value):
    return ' '.join(unescape(re.sub(r'<[^>]*>', '', value)).split())


class Page(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.h1 = 0
        self.title = ''
        self.descriptions = []
        self.canonicals = []
        self.links = []
        self.ctas = []
        self.schemas = []
        self.faqs = []
        self.capture = None
        self.buffer = ''
        self.faq = None
        self.in_answer = False
        self.feed(html)

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == 'h1':
            self.h1 += 1
        if tag == 'title' or (tag == 'script' and attrs.get('type') == 'application/ld+json'):
            self.capture, self.buffer = tag, ''
        if tag == 'meta' and attrs.get('name') == 'description':
            self.descriptions.append(attrs.get('content', ''))
        if tag == 'link' and attrs.get('rel') == 'canonical':
            self.canonicals.append(attrs.get('href'))
        if tag == 'a':
            self.links.append(attrs.get('href'))
            if attrs.get('data-pulse-goal') == 'trial_clicked':
                self.ctas.append(attrs.get('href'))
        if tag == 'details' and 'faq-item' in attrs.get('class', '').split():
            self.faq = ['', '']
        if self.faq is not None and tag == 'div' and 'faq-answer' in attrs.get('class', '').split():
            self.in_answer = True

    def handle_data(self, value):
        if self.capture:
            self.buffer += value
        if self.faq is not None:
            self.faq[int(self.in_answer)] += value

    def handle_endtag(self, tag):
        if tag == self.capture:
            if tag == 'title':
                self.title = text(self.buffer)
            else:
                self.schemas.append(json.loads(self.buffer))
            self.capture = None
        if tag == 'details' and self.faq is not None:
            self.faqs.append(tuple(text(value) for value in self.faq))
            self.faq, self.in_answer = None, False


def check_page(html, route, signup):
    page = Page(html)
    require(page.canonicals == [ORIGIN + route], route + ': canonical')
    require(page.h1 == 1, route + ': H1 count')
    require(0 < len(page.title) <= 65, route + ': title length')
    require(len(page.descriptions) == 1 and 130 <= len(page.descriptions[0]) <= 160,
            route + ': description length')
    require(signup in page.ctas, route + ': inherited trial CTA/hook')
    schemas = [item for item in page.schemas if item.get('@type') == 'FAQPage']
    require(len(schemas) == 1, route + ': FAQPage count')
    expected = [(text(item['name']), text(item['acceptedAnswer']['text']))
                for item in schemas[0]['mainEntity']]
    require(len(expected) == 3 and page.faqs == expected, route + ': visible/schema FAQ mismatch')
    return page


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


def client(base):
    require(base == 'http://127.0.0.1:8789', 'preview must use the fixed loopback origin')
    opener = build_opener(ProxyHandler({}), NoRedirect())

    def get(path, accept='text/html', ua='site-acceptance-v1'):
        require(path.startswith('/') and not path.startswith('//'), 'nonlocal request')
        request = Request(base + path, headers={'Accept': accept, 'User-Agent': ua})
        with opener.open(request, timeout=5) as response:
            require(response.status == 200, path + ': HTTP status')
            return response.read(), response.headers
    return get


def check_preview(payload, base, signup):
    get = client(base)
    deadline = time.monotonic() + 60
    while True:
        try:
            get('/alternatives')
            break
        except (URLError, TimeoutError):
            require(time.monotonic() < deadline, 'preview readiness timeout')
            time.sleep(1)
    pages = {}
    sitemap = ''.join(file.read_text() for file in payload.glob('sitemap*.xml'))
    for route in ['/alternatives', *ROUTES]:
        body, headers = get(route)
        require('text/html' in headers.get('Content-Type', ''), route + ': HTML content type')
        page = check_page(body.decode(), route, signup)
        require(ORIGIN + route + '</loc>' in sitemap, route + ': sitemap inclusion')
        pages[route] = page
    for route in ROUTES:
        require(route in pages['/alternatives'].links, route + ': hub outbound link')
        require('/alternatives' in pages[route].links, route + ': page return link')
    security = {'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
                'Referrer-Policy': 'strict-origin-when-cross-origin',
                'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
                'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'}
    # Check both root docs and a nested twin: root and nested middleware must survive compilation.
    docs = []
    for route in ('/docs', '/docs/channels/telegram'):
        html, html_headers = get(route)
        markdown, md_headers = get(route, 'text/markdown', 'Googlebot')
        direct, direct_headers = get(route + '.md', 'text/markdown')
        preferred, _ = get(route, 'text/html;q=1, text/markdown;q=0.5')
        require(preferred == html and b'<html' in html, route + ': HTML preference')
        require(markdown == direct and b'<html' not in markdown, route + ': Markdown twin')
        require(direct == (payload / (route.lstrip('/') + '.md')).read_bytes(),
                route + ': direct Markdown pass-through')
        require(direct_headers.get('Content-Location') is None, route + ': direct Markdown not negotiated')
        require('text/markdown' in md_headers.get('Content-Type', ''), route + ': Markdown type')
        require('text/markdown' in direct_headers.get('Content-Type', ''), route + ': direct type')
        require(md_headers.get('Content-Location') == route + '.md', route + ': Content-Location')
        canonical = '<' + ORIGIN + route + '>; rel="canonical"'
        require(md_headers.get('Link') == canonical and direct_headers.get('Link') == canonical,
                route + ': canonical Link')
        require(md_headers.get('Cache-Control') == 'private, max-age=0, must-revalidate', route + ': cache')
        for headers in (html_headers, md_headers):
            require('accept' in headers.get('Vary', '').lower(), route + ': Vary')
        for headers in (html_headers, md_headers, direct_headers):
            for name, value in security.items():
                require(headers.get(name) == value, route + ': security ' + name)
            require(headers.get('Content-Security-Policy') == html_headers.get('Content-Security-Policy')
                    and headers.get('Content-Security-Policy'), route + ': CSP preservation')
        docs.append(route)
    asset = next(iter(sorted(payload.glob('_astro/*.css'))), None)
    require(asset is not None, 'no built CSS asset')
    body, headers = get('/' + asset.relative_to(payload).as_posix(), 'text/markdown', 'Googlebot')
    require(body == asset.read_bytes() and headers.get('Content-Location') is None, 'static pass-through')
    require('immutable' in headers.get('Cache-Control', ''), 'static cache headers')
    for name, value in security.items():
        require(headers.get(name) == value, 'static security ' + name)
    return {'routes': list(pages), 'docs': docs, 'staticAsset': asset.relative_to(payload).as_posix(),
            'generatedHtmlPageCount': sum(1 for _ in payload.rglob('*.html')),
            'networkScope': 'loopback GET only; no browser scripts or signup submission'}


def archive_payload(payload, files, archive):
    with archive.open('wb') as raw, gzip.GzipFile(fileobj=raw, mode='wb', filename='', mtime=0) as zipped:
        with tarfile.open(fileobj=zipped, mode='w') as tar:
            for name in files:
                data = (payload / name).read_bytes()
                require(digest(data) == files[name], 'payload changed before archive: ' + name)
                info = tarfile.TarInfo(name)
                info.size, info.mode, info.mtime = len(data), 0o644, 0
                tar.addfile(info, io.BytesIO(data))


def extract_bundle(bundle, destination, approved_sha):
    manifest = json.loads((bundle / 'manifest.json').read_text())
    require(manifest['repository'] == REPOSITORY and manifest['sourceSha'] == approved_sha,
            'source/repository mismatch')
    archive = bundle / 'public-payload.tar.gz'
    require(digest(archive.read_bytes()) == manifest['archiveSha256'], 'archive hash mismatch')
    require(not destination.exists(), 'extract destination must not exist')
    files = manifest['files']
    require(isinstance(files, dict) and all(name in files for name in CONTROL), 'missing payload controls')
    for name, value in files.items():
        safe_path(name)
        require(isinstance(value, str) and re.fullmatch(r'[0-9a-f]{64}', value), 'invalid file digest')
    # Validate ALL metadata and bytes before writing any extracted file. No extractall.
    with tarfile.open(archive, 'r:gz') as tar:
        entries = tar.getmembers()
        require(len(entries) == len(files) and len({item.name for item in entries}) == len(entries),
                'unexpected/duplicate archive members')
        for item in entries:
            safe_path(item.name)
            require(item.isfile() and item.name in files, 'nonregular/unexpected archive member')
            require(digest(tar.extractfile(item).read()) == files[item.name], 'file hash mismatch')
        for item in entries:
            file = destination / item.name
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(tar.extractfile(item).read())
    require(inventory(destination) == files, 'extracted inventory mismatch')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--payload', type=Path)
    parser.add_argument('--base')
    parser.add_argument('--source', type=Path)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--extract', type=Path)
    parser.add_argument('--destination', type=Path)
    parser.add_argument('--approved-sha')
    args = parser.parse_args()
    if args.extract:
        require(args.destination and re.fullmatch(r'[0-9a-f]{40}', args.approved_sha or ''),
                'extract requires destination and approved SHA')
        extract_bundle(args.extract, args.destination, args.approved_sha)
        print('Validated and extracted public payload; external provenance/approval gates still required.')
        return
    require(all((args.payload, args.base, args.source, args.output)), 'missing acceptance arguments')
    require(os.environ.get('GITHUB_ACTIONS') == 'true', 'actual preview acceptance is hosted CI only')
    require(os.environ.get('GITHUB_REPOSITORY') == REPOSITORY, 'noncanonical repository')
    files = inventory(args.payload)
    for name in CONTROL[1:]:
        require((args.payload / name).read_bytes() == (args.source / 'site/public' / name).read_bytes(),
                'source control file changed: ' + name)
    site_source = (args.source / 'site/src/data/site.ts').read_text()
    signup = re.search(r"signup:\s*['\"]([^'\"]+)['\"]", site_source).group(1)
    evidence = check_preview(args.payload, args.base, signup)
    require(inventory(args.payload) == files, 'payload changed during preview')
    sha = subprocess.check_output(['git', '-C', str(args.source), 'rev-parse', 'HEAD'], text=True).strip()
    require(re.fullmatch(r'[0-9a-f]{40}', sha), 'invalid checkout SHA')
    observed = {name: (args.output / (name + '-version.txt')).read_text().strip()
                for name in ('node', 'pnpm', 'wrangler')}
    require(observed['node'] == 'v22.23.4' and observed['pnpm'] == '10.6.1'
            and re.search(r'(?<![\d.])4\.162\.0(?![\d.])', observed['wrangler']), 'unexpected tool versions')
    args.output.mkdir(parents=True, exist_ok=True)
    archive = args.output / 'public-payload.tar.gz'
    archive_payload(args.payload, files, archive)
    manifest = {'schemaVersion': 1, 'repository': REPOSITORY, 'sourceSha': sha,
                'workflow': os.environ['GITHUB_WORKFLOW_REF'], 'runId': os.environ['GITHUB_RUN_ID'],
                'runAttempt': os.environ['GITHUB_RUN_ATTEMPT'], 'event': os.environ['GITHUB_EVENT_NAME'],
                'ref': os.environ['GITHUB_REF'], 'configuredVersions': {'node': '22.23.4', 'pnpm': '10.6.1',
                'wrangler': '4.162.0'}, 'observedVersions': observed,
                'siteLockfileSha256': digest((args.source / 'site/pnpm-lock.yaml').read_bytes()),
                'files': files, 'archiveSha256': digest(archive.read_bytes())}
    (args.output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    (args.output / 'acceptance.json').write_text(json.dumps({'status': 'passed', 'sourceSha': sha,
                                                          **evidence}, indent=2) + '\n')
    print(json.dumps({'status': 'passed', 'sourceSha': sha, **evidence}))


if __name__ == '__main__':
    main()
