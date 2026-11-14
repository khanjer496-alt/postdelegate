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
    def test_expected_page_pass(self):
        acceptance.check_page(page(), '/alternatives/recurpost', SIGNUP)

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

    def synthetic_preview(self, payload, broken_negotiation=False):
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
        for route in ('/docs', '/docs/channels/telegram'):
            file = payload / (route.lstrip('/') + '.md')
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(b'# Synthetic documentation')

        def get(route, accept='text/html', ua='site-acceptance-v1'):
            headers = {**security, 'Content-Type': 'text/html', 'Vary': 'Accept'}
            if route in html:
                return html[route], headers
            if route == '/_astro/test.css':
                return asset.read_bytes(), {**security, 'Cache-Control': 'public, immutable'}
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


if __name__ == '__main__':
    unittest.main()
