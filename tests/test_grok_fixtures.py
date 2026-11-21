import glob
import json
import os
import unittest

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures", "grok")
PATHS = sorted(glob.glob(os.path.join(FIXTURES, "*", "sessions", "*", "*", "updates.jsonl")))


def lines(path):
    with open(path) as fh:
        return [json.loads(raw) for raw in fh]


class GrokFixtures(unittest.TestCase):
    def test_no_home_or_user(self):
        home = os.path.expanduser("~")
        user = os.path.basename(home)
        for path in PATHS:
            with open(path) as fh:
                text = fh.read()
            with self.subTest(path=path):
                self.assertNotIn(home, text)
                self.assertNotIn(user, text)
                self.assertNotIn(user, os.path.relpath(path, FIXTURES))

    def test_event_ids_start_with_session_id(self):
        for path in PATHS:
            folder = os.path.basename(os.path.dirname(path))
            for d in lines(path):
                p = d["params"]
                with self.subTest(path=path, event=p["_meta"]["eventId"]):
                    self.assertEqual(p["sessionId"], folder)
                    self.assertTrue(p["_meta"]["eventId"].startswith(p["sessionId"] + "-"))

    def test_turn_usage_adds_up(self):
        turns = 0
        for path in PATHS:
            for d in lines(path):
                u = d["params"]["update"]
                if u.get("sessionUpdate") != "turn_completed":
                    continue
                turns += 1
                usage = u["usage"]
                for key, value in usage.items():
                    if key in ("modelUsage", "numTurns"):
                        continue
                    with self.subTest(path=path, key=key):
                        self.assertEqual(sum(m[key] for m in usage["modelUsage"].values()), value)
                self.assertEqual(usage["totalTokens"], usage["inputTokens"] + usage["outputTokens"])
        self.assertGreater(turns, 0)


if __name__ == "__main__":
    unittest.main()
