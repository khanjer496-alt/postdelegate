#!/usr/bin/env python3
"""Small synthetic acceptance/fault checks; never builds or starts Wrangler."""
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError

spec = importlib.util.spec_from_file_location('acceptance', Path(__file__).with_name('accept-public-payload.py'))
acceptance = importlib.util.module_from_spec(spec)
spec.loader.exec_module(acceptance)
SHA = 'a' * 40
SIGNUP = 'https://app.postdelegate.com/auth'


def page(canonical='https://postdelegate.com/alternatives/recurpost'):
    faq = [{'@type': 'Question', 'name': 'Question ' + str(i),
            'acceptedAnswer': {'@type': 'Answer', 'text': 'Answer & detail ' + str(i)}} for i in range(3)]
    return ('<html><head><title>A useful comparison</title><meta name="description" content="'
            + 'x' * 140 + '"><link rel="canonical" href="' + canonical + '">'
            + '<script type="application/ld+json">' + json.dumps({'@type': 'FAQPage', 'mainEntity': faq})
            + '</script></head><body><h1>Comparison</h1><a href="' + SIGNUP
            + '" data-pulse-goal="trial_clicked">Trial</a>'
            + ''.join('<details class="faq-item"><summary>Question ' + str(i)
                      + '</summary><div class="faq-answer">Answer &amp; detail ' + str(i)
                      + '</div></details>' for i in range(3)) + '</body></html>')


class PublicPayloadTests(unittest.TestCase):
    def setUp(self):
        acceptance.DIAGNOSTICS.clear()
        acceptance.DIAGNOSTICS.update({'phase': 'setup', 'loopbackRequests': []})

    def test_expected_page_pass(self):
        acceptance.check_page(page(), '/alternatives/recurpost', SIGNUP)

    def test_hidden_faq_rejected(self):
        for attribute in ('hidden', 'style="display: none"', 'style="visibility: hidden"',
                          'style="content-visibility:hidden"', 'style="opacity:0"'):
            for old, new in (
                ('<details class="faq-item">', '<details class="faq-item" ' + attribute + '>'),
                ('<body>', '<body ' + attribute + '>'),
                ('<div class="faq-answer">', '<div class="faq-answer" ' + attribute + '>'),
                ('Answer &amp; detail 0', '<span ' + attribute + '>Answer &amp; detail 0</span>'),
            ):
                with self.subTest(attribute=attribute, element=old), self.assertRaisesRegex(ValueError, 'hidden FAQ'):
                    acceptance.check_page(page().replace(old, new), '/alternatives/recurpost', SIGNUP)

    def test_collapsed_expandable_faq_valid(self):
        self.assertNotIn(' open', page())
        acceptance.check_page(page(), '/alternatives/recurpost', SIGNUP)
        html = page().replace('<h1>', '<div hidden>Unrelated hidden text</div><h1>')
        acceptance.check_page(html, '/alternatives/recurpost', SIGNUP)

    def test_duplicate_title_rejected(self):
        html = page().replace('<title>', '<title>' + 'X' * 100 + '</title><title>')
        with self.assertRaisesRegex(ValueError, 'title'):
            acceptance.check_page(html, '/alternatives/recurpost', SIGNUP)

    def test_empty_title_rejected(self):
        with self.assertRaisesRegex(ValueError, 'title'):
            acceptance.check_page(page().replace('A useful comparison', ' '), '/alternatives/recurpost', SIGNUP)

    def test_duplicate_required_metadata_rejected(self):
        for addition in ('<meta name="description" content="' + 'x' * 140 + '">',
                         '<link rel="canonical" href="https://postdelegate.com/alternatives/recurpost">'):
            with self.subTest(addition=addition), self.assertRaises(ValueError):
                acceptance.check_page(page().replace('</head>', addition + '</head>'),
                                      '/alternatives/recurpost', SIGNUP)

    def test_wrong_canonical(self):
        with self.assertRaisesRegex(ValueError, 'canonical'):
            acceptance.check_page(page('https://wrong.invalid/alternatives/recurpost'),
                                  '/alternatives/recurpost', SIGNUP)

    def test_faq_mismatch(self):
        with self.assertRaisesRegex(ValueError, 'FAQ mismatch'):
            acceptance.check_page(page().replace('Answer &amp; detail 0', 'Different answer'),
                                  '/alternatives/recurpost', SIGNUP)

    def test_cta_hook_missing(self):
        with self.assertRaisesRegex(ValueError, 'CTA'):
            acceptance.check_page(page().replace('data-pulse-goal', 'data-other'),
                                  '/alternatives/recurpost', SIGNUP)

    def test_missing_worker(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError, 'missing required _worker.js'):
                acceptance.inventory(Path(directory))

    def test_unsafe_paths(self):
        for name in ('/absolute.html', '../escape.html', 'a/../escape.html', '.env',
                     'node_modules/code.js', 'functions/code.js', 'credentials.json',
                     'a\\escape.html', 'C:/absolute.html', 'a\nfile.html', 'unexpected.exe'):
            with self.subTest(name=name), self.assertRaises(ValueError):
                acceptance.safe_path(name)

    def test_symlink_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            (Path(directory) / 'linked.html').symlink_to('/dev/null')
            with self.assertRaisesRegex(ValueError, 'symlink'):
                acceptance.inventory(Path(directory))

    def bundle(self, root):
        payload = root / 'payload'
        payload.mkdir()
        for name in acceptance.CONTROL:
            (payload / name).write_text('synthetic public ' + name)
        files = acceptance.inventory(payload)
        bundle = root / 'bundle'
        bundle.mkdir()
        archive = bundle / 'public-payload.tar.gz'
        acceptance.archive_payload(payload, files, archive)
        manifest = {'repository': acceptance.REPOSITORY, 'sourceSha': SHA, 'files': files,
                    'archiveSha256': acceptance.digest(archive.read_bytes())}
        (bundle / 'manifest.json').write_text(json.dumps(manifest))
        return payload, bundle, manifest

    def test_archive_roundtrip_and_determinism(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            payload, bundle, manifest = self.bundle(root)
            second = root / 'second.tar.gz'
            acceptance.archive_payload(payload, manifest['files'], second)
            self.assertEqual(acceptance.digest(second.read_bytes()), manifest['archiveSha256'])
            acceptance.extract_bundle(bundle, root / 'extracted', SHA)
            self.assertEqual(acceptance.inventory(root / 'extracted'), acceptance.inventory(payload))

    def test_archive_hash_mismatch(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _, bundle, _ = self.bundle(root)
            with (bundle / 'public-payload.tar.gz').open('ab') as file:
                file.write(b'corrupt')
            with self.assertRaisesRegex(ValueError, 'archive hash mismatch'):
                acceptance.extract_bundle(bundle, root / 'extracted', SHA)
            self.assertFalse((root / 'extracted').exists())

    def test_file_hash_mismatch(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _, bundle, manifest = self.bundle(root)
            manifest['files']['_worker.js'] = '0' * 64
            (bundle / 'manifest.json').write_text(json.dumps(manifest))
            with self.assertRaisesRegex(ValueError, 'file hash mismatch'):
                acceptance.extract_bundle(bundle, root / 'extracted', SHA)
            self.assertFalse((root / 'extracted').exists())

    def test_archive_traversal_rejected_before_writing(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _, bundle, manifest = self.bundle(root)
            archive = bundle / 'public-payload.tar.gz'
            with tarfile.open(archive, 'w:gz') as tar:
                for name in ('../escape.html', *list(manifest['files'])[1:]):
                    entry = tarfile.TarInfo(name)
                    entry.size = 1
                    tar.addfile(entry, io.BytesIO(b'x'))
            manifest['archiveSha256'] = acceptance.digest(archive.read_bytes())
            (bundle / 'manifest.json').write_text(json.dumps(manifest))
            with self.assertRaisesRegex(ValueError, 'path'):
                acceptance.extract_bundle(bundle, root / 'extracted', SHA)
            self.assertFalse((root / 'extracted').exists())

    def test_request_origin_rejected(self):
        with self.assertRaisesRegex(ValueError, 'loopback'):
            acceptance.client('https://postdelegate.com')

    def synthetic_preview(self, payload, broken_negotiation=False, weak_csp=False, weak_csp_on=None):
        paths = ['/alternatives', *acceptance.ROUTES]
        links = ''.join('<a href="' + route + '">Related</a>' for route in paths)
        html = {route: (page(acceptance.ORIGIN + route) + links).encode() for route in paths}
        for route, body in html.items():
            file = payload / (route.lstrip('/') + '.html')
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(body)
        (payload / 'sitemap-0.xml').write_text(''.join('<loc>' + acceptance.ORIGIN + route + '</loc>'
                                                    for route in paths))
        asset = payload / '_astro/test.css'
        asset.parent.mkdir()
        asset.write_bytes(b'body { color: white }')
        security = {'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
                    'Referrer-Policy': 'strict-origin-when-cross-origin',
                    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
                    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
                    'Content-Security-Policy': "default-src 'self'"}
        (payload / '_headers').write_text("/*\n  Content-Security-Policy: default-src 'self'\n")
        for route in ('/docs', '/docs/channels/telegram'):
            file = payload / (route.lstrip('/') + '.md')
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(b'# Synthetic documentation')

        def get(route, accept='text/html', ua='site-acceptance-v1'):
            observed = dict(security)
            kind = ('static' if route.startswith('/_astro/') else 'direct' if route.endswith('.md')
                    else 'negotiated' if accept == 'text/markdown'
                    else 'docs-html' if route.startswith('/docs') else 'html')
            if weak_csp or kind == weak_csp_on:
                observed['Content-Security-Policy'] = "default-src * 'unsafe-inline' 'unsafe-eval'"
            headers = {**observed, 'Content-Type': 'text/html', 'Vary': 'Accept'}
            if route in html:
                return html[route], headers
            if route == '/_astro/test.css':
                return asset.read_bytes(), {**observed, 'Cache-Control': 'public, immutable'}
            direct = route.endswith('.md')
            canonical = route.removesuffix('.md')
            if direct or accept == 'text/markdown':
                headers.update({'Content-Type': 'text/markdown; charset=utf-8',
                                'Link': '<' + acceptance.ORIGIN + canonical + '>; rel="canonical"'})
                if not direct:
                    headers.update({'Content-Location': canonical + '.md',
                                    'Cache-Control': 'private, max-age=0, must-revalidate'})
                    if broken_negotiation:
                        headers.pop('Content-Location')
                return b'# Synthetic documentation', headers
            return b'<html>Synthetic documentation</html>', headers
        return get

    def test_full_synthetic_preview_pass(self):
        with tempfile.TemporaryDirectory() as directory:
            payload = Path(directory)
            with patch.object(acceptance, 'client', return_value=self.synthetic_preview(payload)):
                evidence = acceptance.check_preview(payload, 'http://127.0.0.1:8789', SIGNUP)
            self.assertEqual(evidence['generatedHtmlPageCount'], 5)
            self.assertEqual(evidence['routes'], ['/alternatives', *acceptance.ROUTES])

    def test_broken_negotiation_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            payload = Path(directory)
            get = self.synthetic_preview(payload, broken_negotiation=True)
            with patch.object(acceptance, 'client', return_value=get):
                with self.assertRaisesRegex(ValueError, 'Content-Location'):
                    acceptance.check_preview(payload, 'http://127.0.0.1:8789', SIGNUP)

    def test_consistently_weakened_csp_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            payload = Path(directory)
            get = self.synthetic_preview(payload, weak_csp=True)
            with patch.object(acceptance, 'client', return_value=get), self.assertRaisesRegex(ValueError, 'CSP'):
                acceptance.check_preview(payload, 'http://127.0.0.1:8789', SIGNUP)

    def test_each_response_csp_anchored_to_payload(self):
        for kind in ('html', 'docs-html', 'negotiated', 'direct', 'static'):
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as directory:
                payload = Path(directory)
                get = self.synthetic_preview(payload, weak_csp_on=kind)
                with patch.object(acceptance, 'client', return_value=get), self.assertRaisesRegex(ValueError, 'CSP'):
                    acceptance.check_preview(payload, 'http://127.0.0.1:8789', SIGNUP)

    def test_diagnostic_request_categories_are_bounded_and_no_raw_values(self):
        errors = ((URLError(ConnectionRefusedError('private runtime text')), 'connection-refused'),
                  (TimeoutError('private timeout text'), 'timeout'),
                  (PermissionError('private sandbox text'), 'permission-error'),
                  (HTTPError('https://private.invalid/?token=hidden', 503, 'private reason', {}, None),
                   'http-error'))
        for error, category in errors:
            opener = unittest.mock.Mock()
            opener.open.side_effect = error
            with patch.object(acceptance, 'build_opener', return_value=opener):
                get = acceptance.client('http://127.0.0.1:8789')
                with self.assertRaises(type(error)):
                    get('/alternatives')
            record = acceptance.DIAGNOSTICS['loopbackRequests'][-1]
            self.assertEqual(record['category'], category)
            self.assertEqual(record['status'], 503 if isinstance(error, HTTPError) else None)
            if isinstance(error, HTTPError):
                error.close()
        for _ in range(150):
            acceptance.record_request('/private?token=hidden', 'private accept', 'network-error')
        self.assertEqual(len(acceptance.DIAGNOSTICS['loopbackRequests']), 100)
        encoded = json.dumps(acceptance.DIAGNOSTICS)
        for forbidden in ('private', 'token', 'hidden', 'sandbox text', 'https://'):
            self.assertNotIn(forbidden, encoded)

    def test_failure_diagnostic_keeps_only_public_command_version_and_exit(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / 'diagnostics.json'
            acceptance.DIAGNOSTICS['phase'] = 'readiness'
            acceptance.DIAGNOSTICS['acceptanceExceptionCategory'] = 'validation-error'
            acceptance.record_request('/alternatives', 'text/html', 'connection-refused')
            acceptance.write_diagnostics(path)
            (root / 'wrangler-version.txt').write_text('private prefix: wrangler 4.162.0 private suffix')
            acceptance.finalize_diagnostics(path, 'exited', '1', 1, root)
            data = json.loads(path.read_text())
            self.assertFalse(data['releasable'])
            self.assertEqual(data['processExitBeforeCleanup'], 1)
            self.assertEqual(data['observedWranglerVersion'], '4.162.0')
            self.assertIn('--no-bundle', data['configuredCommand'])
            self.assertNotIn('private', path.read_text())
            acceptance.finalize_diagnostics(path, 'running', '', 1, root)
            self.assertIsNone(json.loads(path.read_text())['processExitBeforeCleanup'])


if __name__ == '__main__':
    unittest.main()
