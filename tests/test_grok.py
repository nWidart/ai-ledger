import os
import shutil
from datetime import datetime

from ai_ledger import store  # first: store imports the source modules
from ai_ledger import grok
from test_store import StoreCase

FIXTURES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "grok")
LABELS = ("probe", "long-turn", "compaction", "cancelled", "tools")
SESSION = {"probe": "0a1f0001-0000-7000-8000-000000000001", "long-turn": "0a1f0002-0000-7000-8000-000000000001",
           "compaction": "0a1f0003-0000-7000-8000-000000000001", "cancelled": "0a1f0004-0000-7000-8000-000000000001",
           "tools": "0a1f0005-0000-7000-8000-000000000001"}
CHILD = "0a1f0001-0000-7000-8000-000000000002"


class GrokCase(StoreCase):
    def setUp(self):
        super().setUp()
        self.home = os.path.join(self.tmp, "grok")
        self.roots = dict(grok=self.home)  # never the real homes

    def put(self, label):
        """Copies the fixture label's sessions into the test Grok home; returns the paths of its logs."""
        shutil.copytree(os.path.join(FIXTURES, label), self.home, dirs_exist_ok=True)
        return grok.files(self.home)

    def ingest(self):
        return store.ingest(self.con, self.roots)

    def lines_of(self, *labels):
        n = 0
        for label in labels:
            for p in grok.files(os.path.join(FIXTURES, label)):
                with open(p) as fh:
                    n += sum(1 for _ in fh)
        return n


class IngestTest(GrokCase):
    def test_missing_home_is_skipped(self):
        stats = self.ingest()
        self.assertEqual((stats["files"], self.count()), (0, 0))

    def test_each_line_is_stored_once(self):
        for label in LABELS:
            self.put(label)
        self.ingest()
        n = self.lines_of(*LABELS)
        self.assertEqual(self.count(), n)
        self.assertEqual(self.ingest()["files"], 0)
        self.assertEqual(self.count(), n)

    def test_truncated_file_read_again(self):
        path, = self.put("long-turn")
        with open(path, "rb") as fh:
            data = fh.read()
        self.ingest()
        n = self.count()
        with open(path, "wb") as fh:
            fh.write(data[:len(data) // 2])
        self.ingest()
        with open(path, "wb") as fh:
            fh.write(data)
        self.ingest()
        self.assertEqual(self.count(), n)
        self.assertEqual(self.count("starts_with(key, 'grok:')"), n)

    def test_repeated_event_ids_are_both_stored(self):
        self.put("probe")
        self.ingest()
        for n in (3, 5):
            eid = f"{SESSION['probe']}-{n}"
            self.assertEqual(self.count(f"uuid = '{eid}'"), 2, eid)

    def test_files_sort_child_after_parent(self):
        paths = self.put("probe")
        self.assertEqual([os.path.basename(os.path.dirname(p)) for p in paths], [SESSION["probe"], CHILD])


class FieldsTest(GrokCase):
    def test_types_and_times(self):
        self.put("probe")
        self.ingest()
        types = {r[0] for r in self.q("SELECT DISTINCT type FROM raw_lines")}
        self.assertTrue({"turn_completed", "tool_call", "tool_call_update", "user_message_chunk", "session_end",
                         "user_prompt_submit", "subagent_spawned"} <= types, types)
        self.assertNotIn("hook_execution", types)
        for (ts,) in self.q("SELECT ts FROM raw_lines"):
            self.assertRegex(ts, r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$")
            datetime.fromisoformat(store.ts_of(ts))
        self.assertEqual(grok.iso(1795261348503), "2026-11-21T11:42:28.503Z")

    def test_session_rows(self):
        for label in LABELS:
            self.put(label)
        self.ingest()
        rows = dict((r[0], r[1:]) for r in self.q("SELECT session_id, cwd, source, first_ts, last_ts, project FROM sessions"))
        for label, sid in SESSION.items():
            with self.subTest(label=label):
                cwd, source, first, last, project = rows[sid]
                self.assertEqual((cwd, source, project), ("/work/app", "grok", "app"))
                times = sorted(store.ts_of(r[0]) for r in self.q("SELECT ts FROM raw_lines WHERE session_id = ?", sid))
                self.assertEqual((first, last), (datetime.fromisoformat(times[0]), datetime.fromisoformat(times[-1])))

    def test_rebuild_keeps_sessions(self):
        for label in LABELS:
            self.put(label)
        self.ingest()
        before = self.q("SELECT * FROM sessions ORDER BY session_id")
        store.rebuild(self.con)
        self.assertEqual(self.q("SELECT * FROM sessions ORDER BY session_id"), before)

    def test_key_without_meta_falls_back_to_offset(self):
        self.assertEqual(grok.key({"params": {}}, "/x/updates.jsonl", 7), "/x/updates.jsonl:7")
        self.assertEqual(grok.key({"params": {"_meta": {"eventId": "s-1", "agentTimestampMs": 5}}}, "/x", 0), "grok:s-1:5")
