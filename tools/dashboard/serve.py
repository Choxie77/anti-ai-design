#!/usr/bin/env python3
"""Tiny local server for the progress dashboard. Serves only whitelisted files
(never .env), plus recent git activity as JSON. Usage: python3 tools/dashboard/serve.py [port]"""
import http.server, json, subprocess, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
HERE = pathlib.Path(__file__).resolve().parent
FILES = {
    "/": (HERE / "index.html", "text/html; charset=utf-8"),
    "/prd.json": (ROOT / "prd.json", "application/json"),
    "/progress.txt": (ROOT / "progress.txt", "text/plain; charset=utf-8"),
}

def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True).stdout

class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, body, ctype):
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)
    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/git.json":
            commits = [dict(zip(("hash", "date", "subject"), l.split("\t", 2)))
                       for l in git("log", "-8", "--format=%h\t%cs\t%s").splitlines() if l]
            changed = len([l for l in git("status", "--porcelain").splitlines() if l])
            branch = git("rev-parse", "--abbrev-ref", "HEAD").strip()
            return self.send(json.dumps({"commits": commits, "changed": changed, "branch": branch}).encode(), "application/json")
        if path in FILES:
            f, ctype = FILES[path]
            return self.send(f.read_bytes(), ctype)
        self.send_response(404); self.end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
print(f"Dashboard: http://localhost:{port}")
http.server.ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
