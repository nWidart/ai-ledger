"""The built frontend in src/ai_ledger/web/ (built by `npm run build` in web/, not committed) ships no devtools."""
import os
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "src", "ai_ledger", "web")


class WebBuildTest(unittest.TestCase):
    def test_build_ships_no_devtools(self):
        # The Query and Router devtools are development only; the built app must ship none of them (its CSP allows
        # nothing new).
        self.assertTrue(os.path.exists(os.path.join(BUILD, "index.html")),
                        "src/ai_ledger/web/ is missing: run `npm ci && npm run build` in web/")
        markers = [b"react-query-devtools", b"ReactQueryDevtools", b"tsqd-", b"router-devtools", b"TanStackRouterDevtools"]
        leaks = []
        for root, _, files in os.walk(BUILD):
            for name in files:
                path = os.path.join(root, name)
                with open(path, "rb") as fh:
                    data = fh.read()
                for marker in markers:
                    if marker in data:
                        leaks.append(f"{os.path.relpath(path, ROOT)} contains {marker.decode()}")
        self.assertEqual(leaks, [], "the devtools leaked into the build: " + "; ".join(leaks))


if __name__ == "__main__":
    unittest.main()
