#!/usr/bin/env python3
"""Local app: owns the transcript store, keeps it current, serves the Activity, Cost, Errors and Limits dashboards.

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

import limits
import metrics
import store

HOST, PORT = "127.0.0.1", 8765
INTERVAL = 60
WEB = os.path.join(store.HERE, "web", "dist")  # the committed frontend build (npm run build in web/)
PAGES = ("/usage", "/cost", "/errors", "/limits")  # one app; it picks the page from the path
ASSET_TYPES = {".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml",
               ".png": "image/png", ".woff2": "font/woff2", ".json": "application/json; charset=utf-8"}


class App:
    def __init__(self, con, roots, pollers=None):
        self.con, self.roots = con, roots
        self.pollers = limits.pollers() if pollers is None else pollers
        self.lock = threading.Lock()
        self.wake = threading.Event()
        self.stopping = threading.Event()
        self.state = dict(ingesting=False, last_ingest=None, last_stats=None, error=None)

    def ingest(self):
        with self.lock:
            self.state["ingesting"] = True
            try:
                stats = store.ingest(self.con, self.roots, log=None)
                self.state.update(last_ingest=datetime.now(timezone.utc).isoformat(timespec="seconds"),
                                  last_stats=stats, error=None)
                if stats["files"]:
                    print(f"ingest: {stats['files']} files, {stats['inserted']} new lines, {stats['seconds']}s", flush=True)
            except Exception as e:  # keep serving; the next run retries
                self.state["error"] = f"{type(e).__name__}: {e}"
                print("ingest failed:", self.state["error"], file=sys.stderr, flush=True)
            finally:
                self.state["ingesting"] = False

    def poll(self):
        """Poll each provider's plan limits that is due. A poller never raises, so ingest goes on whatever the endpoint does."""
        for p in self.pollers:
            if p.due():
                p.run(self.con, self.lock)

    def loop(self):
        while not self.stopping.is_set():
            self.ingest()
            self.poll()
            self.wake.wait(INTERVAL)
            self.wake.clear()

    def stop(self, thread):
        """End the ingest loop so nothing holds the connection at exit (DuckDB's bindings warn about leaks otherwise)."""
        self.stopping.set()
        self.wake.set()
        thread.join()

    def status(self):
        cur = self.con.cursor()
        counts = {t: cur.execute(f"SELECT count(*) FROM {t}").fetchone()[0] for t in ("raw_lines", "files", "sessions", "requests", "tool_calls")}
        return dict(self.state, counts=counts, interval=INTERVAL, limits={p.name: dict(p.state) for p in self.pollers})


def asset(path):
    """The build file at /assets/<name>, or None when the name leaves web/dist/assets or has no known type."""
    base = os.path.realpath(os.path.join(WEB, "assets"))
    full = os.path.realpath(os.path.join(base, path[len("/assets/"):]))
    ext = os.path.splitext(full)[1]
    return (full, ASSET_TYPES[ext]) if os.path.dirname(full) == base and ext in ASSET_TYPES and os.path.isfile(full) else None


def handler(app):
    class Handler(BaseHTTPRequestHandler):
        def send(self, code, body, ctype="application/json; charset=utf-8", headers=(), cache="no-store"):
            data = body if isinstance(body, bytes) else body.encode()
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", cache)
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
                    try:
                        with open(os.path.join(WEB, "index.html"), "rb") as fh:
                            self.send(200, fh.read(), "text/html; charset=utf-8")
                    except FileNotFoundError:
                        self.send(503, "frontend build missing: run npm install && npm run build in web/\n", "text/plain")
                elif url.path.startswith("/assets/"):
                    found = asset(url.path)
                    if found is None:
                        self.send(404, "not found\n", "text/plain")
                    else:  # names carry a content hash, so a file never changes
                        with open(found[0], "rb") as fh:
                            self.send(200, fh.read(), found[1], cache="public, max-age=31536000, immutable")
                elif url.path == "/api/status":
                    self.json(app.status())
                elif url.path == "/api/errors":
                    self.json(metrics.errors_payload(app.con.cursor(), app.state["last_ingest"]))
                elif url.path == "/api/error":
                    detail = metrics.error_detail(app.con.cursor(), q.get("id", ""))
                    self.send(404, json.dumps(dict(error="error not found"))) if detail is None else self.json(detail)
                elif url.path == "/api/session":
                    detail = metrics.session(app.con.cursor(), q.get("id", ""))
                    self.send(404, json.dumps(dict(error="session not found"))) if detail is None else self.json(detail)
                elif url.path == "/api/prompt":  # the session's whole first prompt; /api/session caps it
                    text = metrics.first_prompt(app.con.cursor(), q.get("session", ""), cap=None)
                    self.send(404, json.dumps(dict(error="prompt not found"))) if text is None else self.json(dict(text=text))
                elif url.path == "/api/sessions":
                    self.json(metrics.session_list(app.con.cursor(), q.get("project", ""), int(q.get("range") or 0), q.get("q", ""),
                                                   q.get("near") == "1", int(q.get("offset") or 0), day=q.get("day", ""),
                                                   automated=q.get("automated") == "1", source=q.get("source", "")))
                elif url.path == "/api/limits":
                    self.json(limits.payload(app.con.cursor(), int(q.get("range") or 0), q.get("source", ""), q.get("project", ""),
                                             polls={p.name: dict(p.state) for p in app.pollers}))
                elif url.path == "/api/usage":
                    self.json(metrics.usage(app.con.cursor(), q.get("project", ""), int(q.get("range") or 0), q.get("session", ""),
                                            automated=q.get("automated") == "1", source=q.get("source", "")))
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


def serve(con, roots):
    app = App(con, roots)
    try:
        httpd = ThreadingHTTPServer((HOST, PORT), handler(app))
    except OSError as e:
        sys.exit(f"cannot listen on {HOST}:{PORT}: {e}")
    loop = threading.Thread(target=app.loop, daemon=True)
    loop.start()
    print(f"serving http://{HOST}:{PORT}/ (ingest every {INTERVAL}s)", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
        app.stop(loop)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", nargs="?", choices=["serve", "ingest", "rebuild"], default="serve")
    ap.add_argument("--projects", default=store.DEFAULT_ROOT, help="Claude Code transcript root")
    ap.add_argument("--codex", default=store.DEFAULT_CODEX, help="Codex home")
    ap.add_argument("--db", help="database file (default data/ai-ledger.duckdb)")
    a = ap.parse_args()
    roots = dict(claude=a.projects, codex=a.codex)
    try:
        con = store.open_store(a.db)
    except store.StoreBusy as e:
        print(e, file=sys.stderr)
        sys.exit(1)
    if a.command == "serve":
        serve(con, roots)
    elif a.command == "ingest":
        t = time.time()
        print(store.ingest(con, roots, log=print))
        print(f"done in {time.time() - t:.1f}s")
    else:
        print(store.rebuild(con))
    con.close()


if __name__ == "__main__":
    main()
