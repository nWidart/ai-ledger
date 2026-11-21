from datetime import timedelta

from ai_ledger import live, metrics
from test_grok import SESSION, GrokCase


class LiveSmokeTest(GrokCase):
    def test_live_payloads_hold_a_grok_session(self):
        """The Live payloads answer for a stored Grok session with a subagent, whatever they read of its turns."""
        self.put("probe")
        self.ingest()
        cur = self.con.cursor()
        sid = SESSION["probe"]
        (last,) = cur.execute("SELECT last_ts FROM sessions WHERE session_id = ?", [sid]).fetchone()
        now = live.aware(last) + timedelta(seconds=1)
        listed = live.sessions(cur, now=now, prices={})
        self.assertEqual([(s["session_id"], s["source"]) for s in listed["sessions"]], [(sid, "grok")])
        self.assertIsInstance(live.waiting(cur, now=now), int)
        one = live.session(cur, sid, now=now, prices={}, text=True)
        self.assertEqual((one["session_id"], one["source"]), (sid, "grok"))
        self.assertEqual(live.session(cur, sid, after=one["cursor"], now=now, prices={})["cursor"], one["cursor"])
        self.assertEqual(metrics.session(cur, sid, prices={})["compaction_ts"], [])
