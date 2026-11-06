import http.client
import os
import sys
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import app  # noqa: E402
import store  # noqa: E402


class AppTest(unittest.TestCase):
    """The pages and assets come from the committed build in web/dist; the host check guards all of them."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        cls.con = store.open_store(os.path.join(cls.tmp, "d", "x.duckdb"))
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), app.handler(app.App(cls.con, dict(claude=cls.tmp))))
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

    def test_foreign_host_refused(self):
        self.assertEqual(self.get("/usage", host="example.com")[0], 403)
        self.assertEqual(self.get("/assets/x.js", host="evil:8765")[0], 403)


if __name__ == "__main__":
    unittest.main()
