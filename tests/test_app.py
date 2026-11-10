import http.client
import json
import os
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest import mock
from http.server import ThreadingHTTPServer

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import app  # noqa: E402
import store  # noqa: E402

USAGE_DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "usage-data")


class AppTest(unittest.TestCase):
    """The pages and assets come from the committed build in web/dist; the host check guards all of them."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        cls.con = store.open_store(os.path.join(cls.tmp, "d", "x.duckdb"))
        store.insert(cls.con.cursor(), "sessions", ["session_id", "project", "first_ts", "last_ts"],
                     [("s1", "foo", "2026-11-04 10:00:00", "2026-11-04 11:00:00")])
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

    def get(self, path, host=f"{app.HOST}:{app.PORT}"):
        h = http.client.HTTPConnection("127.0.0.1", self.httpd.server_address[1])
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

    def test_insights(self):
        self.assertIn("/insights", app.PAGES)
        status, _, body = self.get("/api/insights?range=0")
        got = json.loads(body)
        self.assertEqual((status, got["coverage"]["facets"], got["coverage"]["dir"]), (200, 3, USAGE_DATA))
        self.assertEqual(len(got["sessions"]), 3)
        status, _, body = self.get("/api/insights?source=grok")
        self.assertEqual((status, json.loads(body)), (400, dict(error="unknown source: grok")))

    def test_ingest_command_reads_usage_data(self):
        tmp = tempfile.mkdtemp()
        r = subprocess.run([sys.executable, os.path.join(store.HERE, "app.py"), "ingest", "--db", os.path.join(tmp, "x.duckdb"),
                            "--projects", os.path.join(tmp, "p"), "--codex", os.path.join(tmp, "c"), "--usage-data", USAGE_DATA],
                           capture_output=True, text=True, timeout=60)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("'usage_files': 6, 'usage_skipped': 2", r.stdout)
        self.assertNotIn("SENTINEL", r.stdout + r.stderr)

    def test_foreign_host_refused(self):
        self.assertEqual(self.get("/usage", host="example.com")[0], 403)
        self.assertEqual(self.get("/assets/x.js", host="evil:8765")[0], 403)


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
