#!/usr/bin/env python3
"""Local app: owns the transcript store, keeps it current, serves the Errors and Usage dashboards.

Usage:
  uv run app.py            serve on http://127.0.0.1:8765 (ingests at start and every 60 seconds)
  uv run app.py ingest     ingest new transcript lines once, then exit
  uv run app.py rebuild    regenerate the derived tables from the stored raw lines
"""
import argparse
import json
import os
import sys
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

import metrics
import store

HOST, PORT = "127.0.0.1", 8765
INTERVAL = 60
PAGES = {"/errors": "dashboard_template.html", "/usage": "usage.html"}


class App:
    def __init__(self, con, root):
        self.con, self.root = con, root
        self.lock = threading.Lock()
        self.wake = threading.Event()
        self.state = dict(ingesting=False, last_ingest=None, last_stats=None, error=None)

    def ingest(self):
        with self.lock:
            self.state["ingesting"] = True
            try:
                stats = store.ingest(self.con, self.root, log=None)
                self.state.update(last_ingest=datetime.now(timezone.utc).isoformat(timespec="seconds"),
                                  last_stats=stats, error=None)
                if stats["files"]:
                    print(f"ingest: {stats['files']} files, {stats['inserted']} new lines, {stats['seconds']}s", flush=True)
            except Exception as e:  # keep serving; the next run retries
                self.state["error"] = f"{type(e).__name__}: {e}"
                print("ingest failed:", self.state["error"], file=sys.stderr, flush=True)
            finally:
                self.state["ingesting"] = False

    def loop(self):
        while True:
            self.ingest()
            self.wake.wait(INTERVAL)
            self.wake.clear()

    def status(self):
        cur = self.con.cursor()
        counts = {t: cur.execute(f"SELECT count(*) FROM {t}").fetchone()[0] for t in ("raw_lines", "files", "sessions", "requests", "tool_calls")}
        return dict(self.state, counts=counts, interval=INTERVAL)


def page(name):
    with open(os.path.join(store.HERE, name)) as fh:
        html = fh.read()
    with open(os.path.join(store.HERE, "nav.html")) as fh:
        return html.replace("<!--NAV-->", fh.read())


def handler(app):
    class Handler(BaseHTTPRequestHandler):
        def send(self, code, body, ctype="application/json; charset=utf-8", headers=()):
            data = body if isinstance(body, bytes) else body.encode()
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            for k, v in headers:
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(data)

        def json(self, obj):
            self.send(200, json.dumps(obj, separators=(",", ":"), default=str))

        def checked_host(self):
            """Serve only 127.0.0.1; send localhost there (fix markers live in that origin); refuse other hosts."""
            host = (self.headers.get("Host") or "").lower()
            if host == f"localhost:{PORT}":
                self.send(301, "", headers=[("Location", f"http://{HOST}:{PORT}{self.path}")])
                return False
            if host != f"{HOST}:{PORT}":
                self.send(403, "forbidden host\n", "text/plain")
                return False
            return True

        def do_GET(self):
            if not self.checked_host():
                return
            url = urlsplit(self.path)
            q = {k: v[0] for k, v in parse_qs(url.query).items()}
            try:
                if url.path == "/":
                    self.send(302, "", headers=[("Location", "/usage")])
                elif url.path in PAGES:
                    self.send(200, page(PAGES[url.path]), "text/html; charset=utf-8")
                elif url.path == "/api/status":
                    self.json(app.status())
                elif url.path == "/api/errors":
                    self.json(metrics.errors_payload(app.con.cursor(), app.state["last_ingest"]))
                elif url.path == "/api/usage":
                    self.json(metrics.usage(app.con.cursor(), q.get("project", ""), int(q.get("range") or 0), q.get("session", "")))
                else:
                    self.send(404, "not found\n", "text/plain")
            except ValueError as e:
                self.send(400, json.dumps(dict(error=str(e))))

        def do_POST(self):
            if not self.checked_host():
                return
            if urlsplit(self.path).path != "/api/refresh":
                return self.send(404, "not found\n", "text/plain")
            app.ingest()
            self.json(app.status())

        def log_message(self, fmt, *args):
            pass

    return Handler


def serve(con, root):
    app = App(con, root)
    try:
        httpd = ThreadingHTTPServer((HOST, PORT), handler(app))
    except OSError as e:
        sys.exit(f"cannot listen on {HOST}:{PORT}: {e}")
    threading.Thread(target=app.loop, daemon=True).start()
    print(f"serving http://{HOST}:{PORT}/ (ingest every {INTERVAL}s)", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", nargs="?", choices=["serve", "ingest", "rebuild"], default="serve")
    ap.add_argument("--projects", default=store.DEFAULT_ROOT, help="transcript root")
    ap.add_argument("--db", default=store.DEFAULT_DB, help="database file")
    a = ap.parse_args()
    try:
        con = store.open_store(a.db)
    except store.StoreBusy as e:
        print(e, file=sys.stderr)
        sys.exit(1)
    if a.command == "serve":
        serve(con, a.projects)
    elif a.command == "ingest":
        t = time.time()
        print(store.ingest(con, a.projects, log=print))
        print(f"done in {time.time() - t:.1f}s")
    else:
        print(store.rebuild(con))
    con.close()


if __name__ == "__main__":
    main()
