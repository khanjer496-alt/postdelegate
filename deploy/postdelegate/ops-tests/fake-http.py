#!/usr/bin/env python3
"""Local stand-in for the app URL and the alert webhook, used by run-tests.sh.

GET  anything     -> status code read from $FAKE_STATUS_FILE (default 200)
POST /hook...     -> recorded as one JSON line in $FAKE_LOG; 500 while
                     $FAKE_WEBHOOK_FAIL exists
The chosen port is written to $FAKE_PORT_FILE.
"""
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        try:
            code = int(open(os.environ["FAKE_STATUS_FILE"]).read().strip())
        except (OSError, ValueError):
            code = 200
        self.send_response(code)
        self.end_headers()
        self.wfile.write(b"ok")

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length).decode()
        if os.path.exists(os.environ.get("FAKE_WEBHOOK_FAIL", "/nonexistent")):
            self.send_response(500)
            self.end_headers()
            return
        with open(os.environ["FAKE_LOG"], "a") as log:
            log.write(json.dumps({"path": self.path, "headers": dict(self.headers), "body": body}) + "\n")
        self.send_response(200)
        self.end_headers()


server = HTTPServer(("127.0.0.1", 0), Handler)
with open(os.environ["FAKE_PORT_FILE"], "w") as f:
    f.write(str(server.server_address[1]))
sys.stdout.flush()
server.serve_forever()
