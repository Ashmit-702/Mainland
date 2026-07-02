#!/usr/bin/env python3
"""
Local dev server for Mainland.
Serves /public as static files + mounts /api routes.
Run:  python dev_server.py
Then open http://localhost:3000
"""

import os, sys, json, importlib.util, random
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

PUBLIC = Path(__file__).parent / "public"
API    = Path(__file__).parent / "api"

# ---------- tiny request/response shims ----------
class Req:
    def __init__(self, method, body_bytes):
        self.method = method
        self.body   = body_bytes.decode()

class Res:
    def __init__(self):
        self.status_code = 200
        self.headers     = {}
        self.body        = ""

# ---------- load an api/*.py module on demand ----------
def call_api(module_name, req):
    spec_path = API / f"{module_name}.py"
    if not spec_path.exists():
        r = Res(); r.status_code = 404
        r.body = json.dumps({"error": "not found"})
        return r
    spec = importlib.util.spec_from_file_location(module_name, spec_path)
    mod  = importlib.util.module_from_spec(spec)
    # make sibling imports (like _gemini) work
    sys.path.insert(0, str(API))
    spec.loader.exec_module(mod)
    sys.path.pop(0)
    res = Res()
    return mod.handler(req, res)

# ---------- HTTP handler ----------
class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"  {self.path}  {args[1]}")

    def _send(self, code, content_type, body):
        if isinstance(body, str): body = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", len(body))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/": path = "/index.html"
        file_path = PUBLIC / path.lstrip("/")
        if file_path.exists() and file_path.is_file():
            ext = file_path.suffix
            ct  = {"html":"text/html","css":"text/css","js":"application/javascript",
                   "png":"image/png","ico":"image/x-icon"}.get(ext.lstrip("."), "text/plain")
            self._send(200, ct, file_path.read_bytes())
        else:
            self._send(404, "text/plain", b"Not found")

    def do_POST(self):
        path = self.path.split("?")[0]
        length = int(self.headers.get("Content-Length", 0))
        body   = self.rfile.read(length)
        if path.startswith("/api/"):
            mod_name = path[5:].strip("/").replace("/", "_")
            req = Req("POST", body)
            res = call_api(mod_name, req)
            self._send(res.status_code,
                       res.headers.get("Content-Type", "application/json"),
                       res.body)
        else:
            self._send(404, "text/plain", b"Not found")


if __name__ == "__main__":
    port = 3000
    print(f"\n  Mainland dev server → http://localhost:{port}")
    print(f"  Set GEMINI_API_KEY env var for live AI dialogue.\n")
    HTTPServer(("", port), Handler).serve_forever()
