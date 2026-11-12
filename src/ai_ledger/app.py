"""Local app: owns the transcript store, keeps it current, serves the Activity, Cost, Errors, Limits, Insights and Live pages.

Usage:
  ai-ledger            serve on http://127.0.0.1:8765 and open it in the browser (ingests at start and every 60 seconds, every
                       second while Live is open)
  ai-ledger ingest     ingest new transcript lines and /insights usage data once, then exit
  ai-ledger rebuild    regenerate the derived tables from the stored raw lines
"""
import argparse
import collections
import importlib.metadata
import json
import os
import re
import sys
import threading
import time
import webbrowser
from datetime import date, datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

from . import insights, limits, live, metrics, store

HOST, PORT = "127.0.0.1", 8765  # PORT is the default; --port changes it
INTERVAL = 60
LIVE_INTERVAL = 1  # transcript ingest while a Live page is connected; usage data and limits stay on INTERVAL
KEEPALIVE = 15  # seconds between SSE comments, so a closed Live page is noticed
WEB = os.path.join(store.HERE, "web")  # the committed frontend build (npm run build in web/), shipped in the package
PAGES = ("/usage", "/cost", "/errors", "/limits", "/insights", "/live")  # one app; it picks the page from the path
ASSET_TYPES = {".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml",
               ".png": "image/png", ".woff2": "font/woff2", ".json": "application/json; charset=utf-8"}
MAX_BODY = 4096  # a POST body is one small JSON object
MAX_IMPORT_BODY, MAX_IMPORT = 65536, 500  # the import carries a marker per error type the browser kept: far fewer than this
MAX_CATEGORY = 100


def check_category(category):
    if not isinstance(category, str) or not 0 < len(category) <= MAX_CATEGORY:
        raise ValueError(f"category must be a string of 1 to {MAX_CATEGORY} characters")
    return category


def check_day(day, today):
    """The date of a YYYY-MM-DD string that is not after today. Raises ValueError."""
    # fromisoformat also reads 20261104 and 2026-W45-3, and \d reads any script's digits: ask for the one form the page sends.
    if not isinstance(day, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", day):
        raise ValueError("day must be YYYY-MM-DD or null")
    try:
        day = date.fromisoformat(day)
    except ValueError:
        raise ValueError("day is not a real date") from None
    if day > today:
        raise ValueError("day is after today")
    return day


def parse_fix(body, today):
    """(error type, day) from the JSON body of POST /api/errors/fix; day None removes the marker. Raises ValueError."""
    if not isinstance(body, dict):
        raise ValueError("body must be a JSON object")
    category, day = check_category(body.get("category")), body.get("day", "")
    return category, None if day is None else check_day(day, today)


def parse_mute(body):
    """(error type, muted) from the JSON body of POST /api/errors/mute; muted must be a JSON boolean. Raises ValueError."""
    if not isinstance(body, dict):
        raise ValueError("body must be a JSON object")
    if not isinstance(body.get("muted"), bool):
        raise ValueError("muted must be true or false")
    return check_category(body.get("category")), body["muted"]


def parse_import(body, today):
    """{error type: date} from the JSON body of POST /api/errors/fixes/import. A marker that is not valid is left out, so one bad
    entry in a browser's old copy cannot keep the rest from moving. Raises ValueError for a body that is not an object of fixes."""
    if not isinstance(body, dict) or not isinstance(body.get("fixes"), dict):
        raise ValueError("body must be a JSON object with a fixes object")
    if len(body["fixes"]) > MAX_IMPORT:
        raise ValueError(f"fixes must hold at most {MAX_IMPORT} markers")
    out = {}
    for category, day in body["fixes"].items():
        try:
            out[check_category(category)] = check_day(day, today)
        except ValueError:
            pass
    return out


class App:
    def __init__(self, con, roots, pollers=None):
        self.con, self.roots = con, roots
        self.pollers = limits.pollers() if pollers is None else pollers
        self.lock = threading.Lock()
        self.wake = threading.Event()
        self.stopping = threading.Event()
        # last_change: the time of the last ingest that stored anything, so pages refetch only when data changed.
        self.state = dict(ingesting=False, last_ingest=None, last_change=None, last_stats=None, error=None)
        # The nav's Limits badge: limits.alert_of over the open windows, worked out after each full cycle (see refresh_alert).
        self.limits_alert = None
        # Live pages: how many are connected, and the sessions each ingest changed, numbered so each page sends a
        # notice for every change since its last one.
        self.watchers = 0
        self.changed = threading.Condition()
        self.generation = 0
        self.changes = collections.deque(maxlen=64)

    def ingest(self, usage=True):
        """Ingest transcripts, and usage data unless usage is False (the fast pass while Live is open)."""
        with self.lock:
            self.state["ingesting"] = True
            try:
                stats = store.ingest(self.con, self.roots, log=None, usage=usage)
                sessions = stats.pop("sessions")
                now = datetime.now(timezone.utc).isoformat(timespec="seconds")
                self.state.update(last_ingest=now, last_stats=stats, error=None)
                if stats["inserted"] or stats.get("usage_files"):
                    self.state["last_change"] = now
                if sessions:
                    self.publish(sessions)
                if usage and (stats["files"] or stats.get("usage_files") or stats.get("usage_skipped")):
                    print(f"ingest: {stats['files']} files, {stats['inserted']} new lines, {stats.get('usage_files', 0)} usage-data files "
                          f"({stats.get('usage_skipped', 0)} skipped), {stats['seconds']}s", flush=True)
            except Exception as e:  # keep serving; the next run retries
                self.state["error"] = f"{type(e).__name__}: {e}"
                print("ingest failed:", self.state["error"], file=sys.stderr, flush=True)
            finally:
                self.state["ingesting"] = False

    def poll(self):
        """Poll each provider's plan limits that is due. A poller never raises, so ingest goes on whatever the endpoint does."""
        for p in self.pollers:
            if p.due():
                was = p.state["last_ok"]
                p.run(self.con, self.lock)
                if p.state["last_ok"] != was:  # a stored reading changes Limits, so pages refetch
                    self.state["last_change"] = datetime.now(timezone.utc).isoformat(timespec="seconds")

    def refresh_alert(self):
        """Work out the nav's limits alert, as the Limits page's payload gives it with no filters. Run once per full cycle,
        not per /api/status request: the payload scans the whole request history and every open page polls status. A read, as
        the routes do it: no store lock. It runs in the loop thread, so it delays the next fast pass of a Live page by the
        payload's duration (about 0.14 s on a store of 90,000 requests, once per INTERVAL); if a store ever makes it slow, the
        remedy is a thread of its own. Never raises: whatever the payload does, the alert is None and ingest goes on."""
        try:
            payload = limits.payload(self.con.cursor(), polls={p.name: dict(p.state) for p in self.pollers})
            self.limits_alert = limits.alert_of(payload["windows"])
        except Exception as e:  # the type only: the message could carry stored text
            self.limits_alert = None
            print(f"limits alert failed: {type(e).__name__}", file=sys.stderr, flush=True)

    def loop(self):
        """Ingest everything and poll limits every INTERVAL, then refresh the limits alert; in between, ingest transcripts
        every LIVE_INTERVAL while a Live page is connected."""
        due = 0
        while not self.stopping.is_set():
            if time.monotonic() >= due:
                self.ingest()
                self.poll()
                self.refresh_alert()
                due = time.monotonic() + INTERVAL
            elif self.watchers:
                self.ingest(usage=False)
            self.wake.wait(LIVE_INTERVAL if self.watchers else max(0, due - time.monotonic()))
            self.wake.clear()

    def stop(self, thread):
        """End the ingest loop so nothing holds the connection at exit (DuckDB's bindings warn about leaks otherwise)."""
        self.stopping.set()
        self.wake.set()
        with self.changed:
            self.changed.notify_all()  # Live streams return
        thread.join()

    def publish(self, sessions):
        with self.changed:
            self.generation += 1
            self.changes.append((self.generation, frozenset(sessions)))
            self.changed.notify_all()

    def changes_since(self, generation, timeout):
        """(newest generation, sessions changed after generation), waiting up to timeout for a change. None for the
        sessions when the change log no longer reaches back that far: the page then refetches everything."""
        with self.changed:
            if self.generation == generation and not self.stopping.is_set():
                self.changed.wait(timeout)
            newer = [s for g, s in self.changes if g > generation]
            if self.generation - generation > len(newer):
                return self.generation, None
            return self.generation, frozenset().union(*newer)

    def watch(self, delta):
        """Count a Live page in (+1) or out (-1); the first one starts the fast pass at once."""
        with self.changed:
            self.watchers += delta
            first = delta > 0 and self.watchers == 1
        if first:
            self.wake.set()

    def status(self):
        cur = self.con.cursor()
        counts = {t: cur.execute(f"SELECT count(*) FROM {t}").fetchone()[0] for t in ("raw_lines", "files", "sessions", "requests", "tool_calls")}
        return dict(self.state, counts=counts, interval=INTERVAL, limits={p.name: dict(p.state) for p in self.pollers},
                    limits_alert=self.limits_alert, project_order=metrics.project_order(cur))


def asset(path):
    """The build file at /assets/<name>, or None when the name leaves the build's assets folder or has no known type."""
    base = os.path.realpath(os.path.join(WEB, "assets"))
    full = os.path.realpath(os.path.join(base, path[len("/assets/"):]))
    ext = os.path.splitext(full)[1]
    return (full, ASSET_TYPES[ext]) if os.path.dirname(full) == base and ext in ASSET_TYPES and os.path.isfile(full) else None


def handler(app, port=PORT):
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

        def live_events(self):
            """Server-Sent Events for a Live page: a changed notice naming the sessions that gained lines (never their
            content), or a keep-alive comment every KEEPALIVE seconds. Runs until the page goes or the app stops."""
            self.send_response(200)
            for k, v in (("Content-Type", "text/event-stream"), ("Cache-Control", "no-store"), ("X-Accel-Buffering", "no")):
                self.send_header(k, v)
            self.end_headers()
            app.watch(1)
            try:
                generation = app.generation
                self.wfile.write(b"retry: 2000\n\n")
                self.wfile.flush()
                while not app.stopping.is_set():
                    generation, sessions = app.changes_since(generation, KEEPALIVE)
                    if sessions is None:
                        msg = 'event: changed\ndata: {"sessions":null}\n\n'
                    elif sessions:
                        msg = f"event: changed\ndata: {json.dumps(dict(sessions=sorted(sessions)))}\n\n"
                    else:
                        msg = ": keep-alive\n\n"
                    self.wfile.write(msg.encode())
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass
            finally:
                app.watch(-1)

        def json_body(self, limit=MAX_BODY):
            """The request's JSON body. Only application/json: a form post from another site cannot send it without a CORS
            preflight, which this server never answers."""
            if self.headers.get("Content-Type", "").split(";")[0].strip().lower() != "application/json":
                raise ValueError("content type must be application/json")
            try:
                n = int(self.headers.get("Content-Length", ""))
            except ValueError:
                raise ValueError("Content-Length is missing") from None
            if not 0 <= n <= limit:
                raise ValueError(f"body must be at most {limit} bytes")
            try:
                return json.loads(self.rfile.read(n))
            except (ValueError, RecursionError):
                raise ValueError("body must be JSON") from None

        def checked_host(self):
            """Serve only 127.0.0.1; send localhost there (fix markers live in that origin); refuse other hosts."""
            host = (self.headers.get("Host") or "").lower()
            if host == f"localhost:{port}":
                self.send(301, "", headers=[("Location", f"http://{HOST}:{port}{self.path}")])
                return False
            if host != f"{HOST}:{port}":
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
                elif url.path == "/api/live/events":
                    self.live_events()
                elif url.path == "/api/live":
                    self.json(live.sessions(app.con.cursor(), q.get("project", ""), q.get("source", ""), automated=q.get("automated") == "1",
                                           text=q.get("text") == "1"))
                elif url.path == "/api/live/session":
                    detail = live.session(app.con.cursor(), q.get("id", ""), q.get("after", ""), text=q.get("text") == "1")
                    self.send(404, json.dumps(dict(error="session not found"))) if detail is None else self.json(detail)
                elif url.path == "/api/status":
                    self.json(app.status())
                elif url.path == "/api/errors":
                    self.json(metrics.errors_payload(app.con.cursor(), app.state["last_ingest"]))
                elif url.path == "/api/errors/marks":  # the marks alone: the page's resync after a write it cannot account for
                    self.json(metrics.error_marks(app.con.cursor()))
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
                                                   q.get("near") == "1", int(q.get("offset") or 0), max(1, int(q.get("limit") or 100)),
                                                   day=q.get("day", ""), automated=q.get("automated") == "1", source=q.get("source", ""),
                                                   sort=q.get("sort", ""), desc=q.get("desc") == "1"))
                elif url.path == "/api/day":
                    self.json(metrics.day_view(app.con.cursor(), q.get("project", ""), int(q.get("range") or 0), q.get("day", ""),
                                               automated=q.get("automated") == "1", source=q.get("source", "")))
                elif url.path == "/api/palette":
                    self.json(metrics.palette(app.con.cursor(), q.get("project", ""), int(q.get("range") or 0),
                                              automated=q.get("automated") == "1", source=q.get("source", "")))
                elif url.path == "/api/limits":
                    self.json(limits.payload(app.con.cursor(), int(q.get("range") or 0), q.get("source", ""), q.get("project", ""),
                                             polls={p.name: dict(p.state) for p in app.pollers}))
                elif url.path == "/api/limits/window":  # one closed window's curve, for the history strip
                    got = limits.window_curve(app.con.cursor(), q.get("provider", ""), q.get("limit_id", ""), q.get("scope", ""), q.get("start", ""))
                    self.send(404, json.dumps(dict(error="window not found"))) if got is None else self.json(got)
                elif url.path == "/api/insights":
                    self.json(insights.payload(app.con.cursor(), q.get("project", ""), int(q.get("range") or 0), q.get("source", ""),
                                               automated=q.get("automated") == "1", usage_dir=app.roots.get("insights")))
                elif url.path == "/api/tool":
                    self.json(metrics.tool_detail(app.con.cursor(), q.get("kind", ""), q.get("name", ""), q.get("project", ""),
                                                  int(q.get("range") or 0), automated=q.get("automated") == "1", source=q.get("source", "")))
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
            path = urlsplit(self.path).path
            if path == "/api/refresh":
                app.ingest()
                self.json(app.status())
            elif path in ("/api/errors/fix", "/api/errors/mute", "/api/errors/fixes/import"):
                kind = path.rsplit("/", 1)[1]  # fix, mute or import
                try:
                    try:
                        today = metrics.local_today(app.con.cursor())
                        got = (parse_fix(self.json_body(), today) if kind == "fix" else parse_mute(self.json_body()) if kind == "mute"
                               else parse_import(self.json_body(MAX_IMPORT_BODY), today))
                    except ValueError as e:
                        return self.send(400, json.dumps(dict(error=str(e))))
                    # The ingest thread writes through app.con under app.lock, as the limit pollers do: take it for the write, so a
                    # mark never lands in the middle of an ingest's transaction and two writes cannot conflict. The import decides
                    # what the store already has here, at write time, not from what the page saw when it loaded.
                    with app.lock:
                        cur = app.con.cursor()
                        if kind == "fix":
                            store.set_error_fix(cur, *got)
                        elif kind == "mute":
                            store.set_error_muted(cur, *got)
                        else:
                            store.import_error_fixes(cur, got)
                        marks = metrics.error_marks(cur)
                except Exception as e:  # a store error: answer, instead of dropping the connection. The request body is never logged; the error's own text may name a type id
                    print(f"marks request failed: {type(e).__name__}: {e}", file=sys.stderr, flush=True)
                    return self.send(500, json.dumps(dict(error="internal error")))
                self.json(marks)
            else:
                self.send(404, "not found\n", "text/plain")

        def log_message(self, fmt, *args):
            pass

    return Handler


def can_open():
    """A browser the user can see: a terminal runs the app, and on Linux a display exists (webbrowser falls back to a
    text browser that takes the terminal otherwise)."""
    return sys.stdout.isatty() and (sys.platform != "linux" or bool(os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY")))


def serve(con, roots, port=PORT, open_page=False):
    app = App(con, roots)
    try:
        httpd = ThreadingHTTPServer((HOST, port), handler(app, port))
    except OSError as e:
        sys.exit(f"cannot listen on {HOST}:{port}: {e}; pass --port to use another port")
    loop = threading.Thread(target=app.loop, daemon=True)
    loop.start()
    print(f"serving http://{HOST}:{port}/ (ingest every {INTERVAL}s)", flush=True)
    if open_page and can_open():
        try:
            webbrowser.open(f"http://{HOST}:{port}/")
        except Exception:  # the printed URL still works
            pass
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
        app.stop(loop)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", nargs="?", choices=["serve", "ingest", "rebuild"], default="serve")
    ap.add_argument("--projects", default=store.DEFAULT_ROOT, help="Claude Code transcript root")
    ap.add_argument("--codex", default=store.DEFAULT_CODEX, help="Codex home")
    ap.add_argument("--usage-data", default=store.DEFAULT_USAGE_DATA, help="Claude Code /insights usage-data directory")
    ap.add_argument("--db", help=f"database file (default {store.DEFAULT_DB})")
    ap.add_argument("--port", type=int, default=PORT, help=f"port to serve on at {HOST} (default {PORT})")
    ap.add_argument("--no-open", action="store_true", help="serve without opening the browser")
    ap.add_argument("--version", action="version", version=f"ai-ledger {importlib.metadata.version('ai-ledger')}")
    a = ap.parse_args(argv)
    roots = dict(claude=a.projects, codex=a.codex, insights=a.usage_data)
    folder = os.path.dirname(os.path.abspath(a.db or store.DEFAULT_DB))  # the user files sit next to the store
    metrics.USER_PRICES, metrics.USER_AUTOMATED = os.path.join(folder, "prices.json"), os.path.join(folder, "automated.json")
    try:
        con = store.open_store(a.db)
    except (store.StoreBusy, store.StoreNotMoved) as e:
        print(e, file=sys.stderr)
        sys.exit(1)
    if a.command == "serve":
        serve(con, roots, a.port, open_page=not a.no_open)
    elif a.command == "ingest":
        t = time.time()
        print(store.ingest(con, roots, log=print))
        print(f"done in {time.time() - t:.1f}s")
    else:
        print(store.rebuild(con))
    con.close()

