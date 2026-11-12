import contextlib
import http.client
import importlib.metadata
import io
import json
import os
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from datetime import datetime, timedelta
from unittest import mock
from http.server import ThreadingHTTPServer

from ai_ledger import app, metrics, store

USAGE_DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "usage-data")


class AppTest(unittest.TestCase):
    """The pages and assets come from the committed build in src/ai_ledger/web; the host check guards all of them."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        cls.con = store.open_store(os.path.join(cls.tmp, "d", "x.duckdb"))
        store.insert(cls.con.cursor(), "sessions", ["session_id", "project", "first_ts", "last_ts"],
                     [("s1", "foo", "2026-11-04 10:00:00", "2026-11-04 11:00:00")])
        store.insert(cls.con.cursor(), "prompts", ["prompt_id", "session_id", "ts"], [("p1", "s1", "2026-11-04 10:00:00")])
        store.insert(cls.con.cursor(), "tool_calls", ["tool_use_id", "session_id", "tool", "input_summary", "start_ts", "end_ts", "is_error"],
                     [("t1", "s1", "Bash", "npm test", "2026-11-04 10:01:00", "2026-11-04 10:01:02", False)])
        store.ingest(cls.con, dict(insights=USAGE_DATA))
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), app.handler(app.App(cls.con, dict(claude=cls.tmp, insights=USAGE_DATA))))
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.con.close()

    def get(self, path, host=f"{app.HOST}:{app.PORT}", server=None):
        h = http.client.HTTPConnection("127.0.0.1", (server or self.httpd).server_address[1])
        h.request("GET", path, headers={"Host": host})
        r = h.getresponse()
        return r.status, dict(r.getheaders()), r.read()

    def test_pages_serve_the_build(self):
        with open(os.path.join(app.WEB, "index.html"), "rb") as fh:
            index = fh.read()
        for path in app.PAGES:
            status, headers, body = self.get(path)
            self.assertEqual((status, headers["Content-Type"], headers["Cache-Control"], body), (200, "text/html; charset=utf-8", "no-store", index))

    def test_root_opens_activity(self):
        status, headers, _ = self.get("/")
        self.assertEqual((status, headers["Location"]), (302, "/usage"))

    def test_assets(self):
        names = os.listdir(os.path.join(app.WEB, "assets"))
        js = next(n for n in names if n.endswith(".js"))
        status, headers, body = self.get(f"/assets/{js}")
        self.assertEqual((status, headers["Content-Type"]), (200, "text/javascript; charset=utf-8"))
        self.assertIn("immutable", headers["Cache-Control"])
        self.assertTrue(body)
        css = next(n for n in names if n.endswith(".css"))
        self.assertEqual(self.get(f"/assets/{css}")[1]["Content-Type"], "text/css; charset=utf-8")

    def test_assets_stay_inside_the_build(self):
        for path in ("/assets/../app.py", "/assets/../index.html", "/assets/%2e%2e/index.html", "/assets/", "/assets/missing.js",
                     "/assets//etc/passwd", "/theme.css", "/nav.html"):
            self.assertEqual(self.get(path)[0], 404, path)

    def test_tool_inspector(self):
        status, _, body = self.get("/api/tool?kind=tool&name=Bash")
        self.assertEqual((status, json.loads(body)["totals"]["calls"]), (200, 1))
        status, _, body = self.get("/api/tool?kind=tool&name=Glob&range=30")
        self.assertEqual((status, json.loads(body)["totals"]["calls"]), (200, 0))
        status, _, body = self.get("/api/tool?kind=hook&name=Bash")
        self.assertEqual((status, json.loads(body)), (400, dict(error="unknown kind: hook")))
        status, _, body = self.get("/api/tool?kind=tool&name=Bash&source=grok")
        self.assertEqual((status, json.loads(body)), (400, dict(error="unknown source: grok")))

    def test_palette(self):
        status, _, body = self.get("/api/palette?range=0")
        got = json.loads(body)
        self.assertEqual(status, 200)
        for k in ("projects", "sources", "tools", "mcp", "skills", "categories"):
            self.assertIsInstance(got[k], list, k)
        self.assertEqual([(r["name"], r["calls"]) for r in got["tools"]], [("Bash", 1)])
        status, _, body = self.get("/api/palette?source=grok")
        self.assertEqual((status, json.loads(body)), (400, dict(error="unknown source: grok")))
        status, _, body = self.get("/api/palette?range=-1")
        self.assertEqual((status, json.loads(body)), (400, dict(error="range must be >= 0")))

    def test_status_carries_project_order(self):
        status, _, body = self.get("/api/status")
        got = json.loads(body)
        self.assertEqual(status, 200)
        self.assertEqual(got["project_order"], metrics.project_order(self.con.cursor()))
        self.assertIn("last_change", got)

    def test_insights(self):
        self.assertIn("/insights", app.PAGES)
        status, _, body = self.get("/api/insights?range=0")
        got = json.loads(body)
        self.assertEqual((status, got["coverage"]["facets"], got["coverage"]["dir"]), (200, 3, USAGE_DATA))
        self.assertEqual(len(got["sessions"]), 3)
        status, _, body = self.get("/api/insights?source=grok")
        self.assertEqual((status, json.loads(body)), (400, dict(error="unknown source: grok")))

    def test_live(self):
        self.assertIn("/live", app.PAGES)
        status, _, body = self.get("/api/live")
        self.assertEqual((status, json.loads(body)["sessions"]), (200, []))
        self.assertEqual(self.get("/api/live?source=grok")[0], 400)
        with mock.patch.object(app.live, "sessions", wraps=app.live.sessions) as listed:
            self.assertEqual(self.get("/api/live?text=1")[0], 200)
            self.assertEqual(self.get("/api/live")[0], 200)
        self.assertEqual([c.kwargs["text"] for c in listed.call_args_list], [True, False])
        status, _, body = self.get("/api/live/session?id=s1")
        self.assertEqual((status, json.loads(body)["session_id"]), (200, "s1"))
        self.assertEqual(self.get("/api/live/session?id=s1&after=yesterday")[0], 400)
        self.assertEqual(self.get("/api/live/session?id=nope")[0], 404)

    def test_ingest_command_reads_usage_data(self):
        tmp = tempfile.mkdtemp()
        r = subprocess.run([sys.executable, "-m", "ai_ledger", "ingest", "--db", os.path.join(tmp, "x.duckdb"),
                            "--projects", os.path.join(tmp, "p"), "--codex", os.path.join(tmp, "c"), "--usage-data", USAGE_DATA],
                           capture_output=True, text=True, timeout=60)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("'usage_files': 6, 'usage_skipped': 2", r.stdout)
        self.assertNotIn("SENTINEL", r.stdout + r.stderr)

    def test_foreign_host_refused(self):
        self.assertEqual(self.get("/usage", host="example.com")[0], 403)
        self.assertEqual(self.get("/assets/x.js", host="evil:8765")[0], 403)

    def test_custom_port_host_check(self):
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), app.handler(app.App(self.con, {}, pollers=[]), 8766))
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        self.addCleanup(httpd.server_close)
        self.addCleanup(httpd.shutdown)
        self.assertEqual(self.get("/", host="127.0.0.1:8766", server=httpd)[0], 302)
        status, headers, _ = self.get("/usage", host="localhost:8766", server=httpd)
        self.assertEqual((status, headers["Location"]), (301, "http://127.0.0.1:8766/usage"))
        self.assertEqual(self.get("/usage", host=f"127.0.0.1:{app.PORT}", server=httpd)[0], 403)

    def test_port_in_use(self):
        with socket.socket() as held:
            held.bind(("127.0.0.1", 0))
            held.listen()
            port = held.getsockname()[1]
            with self.assertRaises(SystemExit) as cm:
                app.serve(self.con, {}, port)
        self.assertIn(f"127.0.0.1:{port}", str(cm.exception.code))
        self.assertIn("--port", str(cm.exception.code))

    def test_opens_only_where_a_browser_is_visible(self):
        with mock.patch.object(sys.stdout, "isatty", return_value=False):
            self.assertFalse(app.can_open())
        with mock.patch.object(sys.stdout, "isatty", return_value=True), mock.patch.object(sys, "platform", "linux"), \
                mock.patch.dict(os.environ, {}, clear=True):
            self.assertFalse(app.can_open())
        with mock.patch.object(sys.stdout, "isatty", return_value=True), mock.patch.object(sys, "platform", "linux"), \
                mock.patch.dict(os.environ, {"WAYLAND_DISPLAY": "wayland-0"}, clear=True):
            self.assertTrue(app.can_open())
        with mock.patch.object(sys.stdout, "isatty", return_value=True), mock.patch.object(sys, "platform", "darwin"):
            self.assertTrue(app.can_open())

    def test_version_opens_no_store(self):
        out = io.StringIO()
        with mock.patch.object(store, "open_store") as opened, contextlib.redirect_stdout(out), self.assertRaises(SystemExit) as cm:
            app.main(["--version"])
        self.assertEqual(cm.exception.code, 0)
        self.assertEqual(out.getvalue(), f"ai-ledger {importlib.metadata.version('ai-ledger')}\n")
        opened.assert_not_called()

    def test_user_files_sit_next_to_the_store(self):
        seen = {}

        def refuse(db):
            seen.update(prices=metrics.USER_PRICES, automated=metrics.USER_AUTOMATED)
            raise store.StoreBusy("busy")
        with mock.patch.object(metrics, "USER_PRICES"), mock.patch.object(metrics, "USER_AUTOMATED"), \
                mock.patch.object(store, "open_store", side_effect=refuse), contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            app.main(["--db", "/data/ledger/x.duckdb"])
        self.assertEqual(seen, dict(prices="/data/ledger/prices.json", automated="/data/ledger/automated.json"))

    def test_day(self):
        status, _, body = self.get("/api/day?day=2026-11-04&range=0")
        got = json.loads(body)
        self.assertEqual((status, got["day"], [(t["tool"], t["calls"]) for t in got["tools"]]), (200, "2026-11-04", [("Bash", 1)]))
        for path in ("/api/day", "/api/day?day=nope", "/api/day?day=2026-11-04&range=-1"):
            self.assertEqual(self.get(path)[0], 400, path)

    def test_store_not_moved_exits(self):
        err = io.StringIO()
        with mock.patch.object(store, "open_store", side_effect=store.StoreNotMoved("cannot move the store a to b")), \
                contextlib.redirect_stderr(err), self.assertRaises(SystemExit) as cm:
            app.main([])
        self.assertEqual((cm.exception.code, err.getvalue()), (1, "cannot move the store a to b\n"))


class FixEndpointTest(unittest.TestCase):
    """POST /api/errors/fix: the Errors page's fix markers, written to the store and answered as the full map."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.con = store.open_store(os.path.join(self.tmp, "d", "x.duckdb"))
        self.app = app.App(self.con, {}, pollers=[])
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), app.handler(self.app))
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.addCleanup(self.con.close)
        self.addCleanup(self.httpd.server_close)
        self.addCleanup(self.httpd.shutdown)
        self.today = metrics.local_today(self.con.cursor())

    def post(self, body, host=f"{app.HOST}:{app.PORT}", ctype="application/json", path="/api/errors/fix", length=None):
        raw = body if isinstance(body, bytes) else json.dumps(body).encode()
        h = http.client.HTTPConnection("127.0.0.1", self.httpd.server_address[1])
        headers = {"Host": host, "Content-Length": str(len(raw) if length is None else length)}
        if ctype:
            headers["Content-Type"] = ctype
        h.request("POST", path, body=raw, headers=headers)
        r = h.getresponse()
        text = r.read()
        return r.status, json.loads(text) if text and r.getheader("Content-Type", "").startswith("application/json") else text

    def marks(self):
        return {c: d.isoformat() for c, d in self.con.execute("SELECT category, fixed_on FROM error_marks").fetchall()}

    def test_sets_replaces_and_removes_a_marker(self):
        today = self.today.isoformat()
        self.assertEqual(self.post({"category": "x", "day": "2026-11-04"}), (200, {"x": "2026-11-04"}))
        self.assertEqual(self.post({"category": "y", "day": today}), (200, {"x": "2026-11-04", "y": today}))
        self.assertEqual(self.post({"category": "x", "day": "2026-10-01"}), (200, {"x": "2026-10-01", "y": today}))
        self.assertEqual(self.post({"category": "x", "day": None}), (200, {"y": today}))
        self.assertEqual(self.post({"category": "x", "day": None}), (200, {"y": today}))  # removing a missing one is fine
        self.assertEqual(self.marks(), {"y": today})
        self.assertEqual(metrics.errors_payload(self.con.cursor())["fixes"], {"y": today})

    def test_refuses_what_is_not_valid(self):
        tomorrow = (self.today + timedelta(days=1)).isoformat()
        good = {"category": "x", "day": "2026-11-04"}
        bad = [
            ({**good, "day": tomorrow}, "future"), ({**good, "day": "2026-02-30"}, "not a date"), ({**good, "day": "20261104"}, "basic format"),
            ({**good, "day": "2026-W45-3"}, "week format"), ({**good, "day": "２０２６-１１-０４"}, "full-width digits"),
            ({**good, "day": " 2026-11-04"}, "space"), ({**good, "day": 20261104}, "number"), ({"category": "x"}, "no day"),
            ({**good, "category": ""}, "empty"), ({**good, "category": "c" * 101}, "too long"), ({**good, "category": 7}, "number category"),
            ({"day": "2026-11-04"}, "no category"), ([good], "array"), ("x", "string"), (None, "null"),
        ]
        for body, why in bad:
            status, got = self.post(body)
            self.assertEqual(status, 400, why)
            self.assertIsInstance(got["error"], str, why)
        today = self.today.isoformat()
        self.assertEqual(self.post({"category": "c" * 100, "day": today}), (200, {"c" * 100: today}))
        self.assertEqual(self.marks(), {"c" * 100: today})  # none of the refused ones wrote

    def test_refuses_what_is_not_json_or_too_big(self):
        self.assertEqual(self.post(b"{nope", length=5)[0], 400)
        self.assertEqual(self.post(b"\xff\xfe")[0], 400)
        self.assertEqual(self.post(b"[" * 3000)[0], 400)  # deeper than the JSON parser goes
        self.assertEqual(self.post(b"")[0], 400)
        self.assertEqual(self.post({"category": "x" * app.MAX_BODY, "day": None})[0], 400)
        self.assertEqual(self.post({"category": "x", "day": None}, ctype="text/plain")[0], 400)  # a form post from another site
        self.assertEqual(self.post({"category": "x", "day": None}, ctype=None)[0], 400)
        self.assertEqual(self.post({"category": "x", "day": "2026-11-04"}, ctype="application/json; charset=utf-8")[0], 200)
        self.assertEqual(self.marks(), {"x": "2026-11-04"})

    def test_checks_the_host(self):
        h = http.client.HTTPConnection("127.0.0.1", self.httpd.server_address[1])
        h.request("POST", "/api/errors/fix", body=b"{}", headers={"Host": "example.com", "Content-Type": "application/json"})
        self.assertEqual(h.getresponse().status, 403)
        self.assertEqual(self.post({"category": "x", "day": None}, host="localhost:8765")[0], 301)
        self.assertEqual(self.marks(), {})

    IMPORT = "/api/errors/fixes/import"

    def test_import_adds_what_the_store_lacks_and_keeps_what_it_has(self):
        self.post({"category": "kept", "day": "2026-11-01"})
        self.assertEqual(self.post({"fixes": {"kept": "2026-10-01", "new": "2026-10-02"}}, path=self.IMPORT),
                         (200, {"kept": "2026-11-01", "new": "2026-10-02"}))
        self.assertEqual(self.marks(), {"kept": "2026-11-01", "new": "2026-10-02"})
        self.assertEqual(self.post({"fixes": {}}, path=self.IMPORT), (200, {"kept": "2026-11-01", "new": "2026-10-02"}))

    def test_import_skips_an_entry_that_is_not_valid_and_takes_the_rest(self):
        tomorrow = (self.today + timedelta(days=1)).isoformat()
        got = self.post({"fixes": {"ok": "2026-11-04", "": "2026-11-04", "c" * 101: "2026-11-04", "future": tomorrow, "notdate": "2026-02-30",
                                   "basic": "20261104", "num": 20261104, "none": None, "list": ["2026-11-04"], "c" * 100: "2026-11-03"}},
                         path=self.IMPORT)
        self.assertEqual(got, (200, {"ok": "2026-11-04", "c" * 100: "2026-11-03"}))
        self.assertEqual(self.marks(), got[1])

    def test_import_refuses_what_is_not_valid_as_a_body(self):
        big = {"fixes": {f"c{i}": "2026-11-04" for i in range(app.MAX_IMPORT + 1)}}
        for body, why in [({}, "no fixes"), ({"fixes": [["x", "2026-11-04"]]}, "array"), ({"fixes": "x"}, "string"), ({"fixes": None}, "null"),
                          ([], "array body"), (big, "too many")]:
            self.assertEqual(self.post(body, path=self.IMPORT)[0], 400, why)
        self.assertEqual(self.post({"fixes": {}}, ctype="text/plain", path=self.IMPORT)[0], 400)
        self.assertEqual(self.post(b"x" * (app.MAX_IMPORT_BODY + 1), path=self.IMPORT)[0], 400)
        self.assertEqual(self.post(b"{nope", path=self.IMPORT)[0], 400)
        self.assertEqual(self.post({"fixes": {"x": "2026-11-04"}}, host="example.com", path=self.IMPORT)[0], 403)
        # The body of the single write is still capped at 4096 bytes, the import's is larger.
        self.assertEqual(self.post({"category": "x", "day": None, "pad": "p" * app.MAX_BODY})[0], 400)
        self.assertEqual(self.post({"fixes": {"x": "2026-11-04"}, "pad": "p" * app.MAX_BODY}, path=self.IMPORT)[0], 200)
        self.assertEqual(self.marks(), {"x": "2026-11-04"})

    def test_import_waits_for_a_running_ingest(self):
        self.app.lock.acquire()
        done = []
        t = threading.Thread(target=lambda: done.append(self.post({"fixes": {"x": "2026-11-04"}}, path=self.IMPORT)))
        t.start()
        time.sleep(0.3)
        self.assertEqual((done, self.marks()), ([], {}))
        self.app.lock.release()
        t.join(5)
        self.assertEqual((done, self.marks()), ([(200, {"x": "2026-11-04"})], {"x": "2026-11-04"}))

    def test_other_posts_are_not_found(self):
        self.assertEqual(self.post({}, path="/api/errors/other")[0], 404)

    def test_waits_for_a_running_ingest(self):
        """The ingest holds app.lock while it writes: a marker waits for it and is stored right after."""
        self.app.lock.acquire()
        done = []
        t = threading.Thread(target=lambda: done.append(self.post({"category": "x", "day": "2026-11-04"})))
        t.start()
        time.sleep(0.3)
        self.assertEqual((done, self.marks()), ([], {}))
        self.app.lock.release()
        t.join(5)
        self.assertEqual((done, self.marks()), ([(200, {"x": "2026-11-04"})], {"x": "2026-11-04"}))

    def test_stays_consistent_next_to_a_busy_ingest(self):
        stop = threading.Event()

        def ingest():
            while not stop.is_set():
                self.app.ingest(usage=False)
        t = threading.Thread(target=ingest)
        t.start()
        try:
            for i in range(30):
                self.assertEqual(self.post({"category": f"c{i % 3}", "day": "2026-11-04" if i % 2 else None})[0], 200)
        finally:
            stop.set()
            t.join(10)
        self.assertEqual(self.marks(), {"c0": "2026-11-04", "c2": "2026-11-04"})  # the last write for each of the three


class LoopTest(unittest.TestCase):
    """App.loop: everything every INTERVAL; transcripts every LIVE_INTERVAL only while a Live page is connected."""

    def run_loop(self, steps):
        calls = []

        def ingest(con, roots, log=None, usage=True):
            calls.append(usage)
            return dict(files=0, lines=0, inserted=0, sessions=set(), seconds=0)

        a = app.App(None, {}, pollers=[])
        with mock.patch.object(app, "INTERVAL", 0.5), mock.patch.object(app, "LIVE_INTERVAL", 0.05), \
                mock.patch.object(store, "ingest", side_effect=ingest):
            t = threading.Thread(target=a.loop)
            t.start()
            seen = []
            for step in steps:
                step(a)
                n = len(calls)
                time.sleep(0.4)
                seen.append(calls[n:])
            a.stop(t)
        return seen

    def test_fast_pass_only_while_watched(self):
        idle, watched, after = self.run_loop([lambda a: None, lambda a: a.watch(1), lambda a: a.watch(-1)])
        self.assertNotIn(False, idle)
        self.assertGreaterEqual(watched.count(False), 4)  # every 50 ms over 400 ms
        self.assertLessEqual(watched.count(True), 1)  # usage data stays on INTERVAL
        self.assertLessEqual(after.count(False), 1)  # at most the pass already waiting when the page left

    def test_changes_since(self):
        a = app.App(None, {}, pollers=[])
        a.publish({"s1"})
        a.publish({"s2", "s1"})
        self.assertEqual(a.changes_since(0, 0), (2, {"s1", "s2"}))
        self.assertEqual(a.changes_since(1, 0), (2, {"s1", "s2"}))
        self.assertEqual(a.changes_since(2, 0.01), (2, frozenset()))
        for i in range(70):
            a.publish({f"x{i}"})
        self.assertEqual(a.changes_since(2, 0), (72, None))  # older than the log: refetch everything


class LiveEventsTest(unittest.TestCase):
    """/api/live/events: one changed notice per ingest that stored lines, ids only, and the count of Live pages."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.root = os.path.join(self.tmp, "projects")
        os.makedirs(os.path.join(self.root, "proj"))
        self.con = store.open_store(os.path.join(self.tmp, "d", "x.duckdb"))
        self.app = app.App(self.con, dict(claude=self.root, codex=os.path.join(self.tmp, "codex")), pollers=[])
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), app.handler(self.app))
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def tearDown(self):
        self.app.stopping.set()  # end open streams, so no handler thread outlives the connection
        with self.app.changed:
            self.app.changed.notify_all()
        self.wait(lambda: self.app.watchers == 0)
        self.httpd.shutdown()
        self.httpd.server_close()
        self.con.close()

    def connect(self):
        h = http.client.HTTPConnection("127.0.0.1", self.httpd.server_address[1], timeout=5)
        h.request("GET", "/api/live/events", headers={"Host": f"{app.HOST}:{app.PORT}"})
        r = h.getresponse()
        self.assertEqual((r.status, r.getheader("Content-Type")), (200, "text/event-stream"))
        self.assertEqual(r.readline(), b"retry: 2000\n")
        r.readline()
        self.wait(lambda: self.app.watchers == 1)
        return h, r

    def wait(self, cond):
        end = time.monotonic() + 3
        while not cond():
            self.assertLess(time.monotonic(), end, "timed out")
            time.sleep(0.01)

    def append(self, name, sid, text):
        with open(os.path.join(self.root, "proj", name), "a") as fh:
            fh.write(json.dumps(dict(type="user", uuid=f"{sid}-{text}", sessionId=sid, timestamp="2026-11-10T10:00:00Z",
                                     message=dict(role="user", content=text))) + "\n")

    def test_notice_names_the_session_and_holds_no_text(self):
        h, r = self.connect()
        self.append("a.jsonl", "s1", "SENTINEL-secret")
        self.app.ingest(usage=False)
        self.assertEqual(r.readline(), b"event: changed\n")
        data = r.readline()
        self.assertEqual(json.loads(data[len(b"data: "):]), dict(sessions=["s1"]))
        self.assertNotIn(b"SENTINEL", data)
        h.close()

    def test_last_change_moves_only_when_lines_land(self):
        self.app.ingest(usage=False)
        self.assertIsNone(self.app.state["last_change"])
        self.append("a.jsonl", "s1", "hello")
        with mock.patch.object(app, "datetime", mock.Mock(now=lambda tz: datetime(2026, 11, 10, 10, tzinfo=tz))):
            self.app.ingest(usage=False)
        self.assertEqual(self.app.state["last_change"], "2026-11-10T10:00:00+00:00")
        self.app.ingest(usage=False)
        self.assertEqual(self.app.state["last_change"], "2026-11-10T10:00:00+00:00")
        self.assertNotEqual(self.app.state["last_ingest"], self.app.state["last_change"])

    def test_last_change_moves_when_a_limit_poll_stores_a_reading(self):
        class Poll:
            state = dict(last_ok=None)
            def due(self): return True
            def run(self, con, lock): self.state["last_ok"] = "2026-11-10T10:00:00+00:00"
        self.app.pollers = [Poll()]
        self.app.poll()
        first = self.app.state["last_change"]
        self.assertIsNotNone(first)
        with mock.patch.object(app, "datetime", mock.Mock(now=lambda tz: datetime(2030, 1, 1, tzinfo=tz))):
            self.app.poll()  # the poll stored nothing new
        self.assertEqual(self.app.state["last_change"], first)

    def test_no_notice_when_nothing_new(self):
        with mock.patch.object(app, "KEEPALIVE", 0.2):
            h, r = self.connect()
            self.app.ingest(usage=False)
            self.assertEqual(r.readline(), b": keep-alive\n")
            h.close()

    def test_closing_the_page_lowers_the_count(self):
        with mock.patch.object(app, "KEEPALIVE", 0.05):
            h, r = self.connect()
            r.close()
            h.close()
            self.wait(lambda: self.app.watchers == 0)

    def test_stop_returns_with_a_page_connected(self):
        loop = threading.Thread(target=self.app.loop)
        loop.start()
        h, r = self.connect()
        self.app.stop(loop)
        self.assertFalse(loop.is_alive())
        self.wait(lambda: self.app.watchers == 0)
        h.close()


if __name__ == "__main__":
    unittest.main()
