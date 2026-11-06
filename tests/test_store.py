import json
import os
import shutil
import stat
import sys
import subprocess
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import store  # noqa: E402


def line(**kw):
    return json.dumps(kw) + "\n"


class StoreCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.root = os.path.join(self.tmp, "projects")
        self.db = os.path.join(self.tmp, "data", "ai-ledger.duckdb")
        os.makedirs(os.path.join(self.root, "proj"))
        self.con = store.open_store(self.db)

    def tearDown(self):
        self.con.close()
        shutil.rmtree(self.tmp)

    def write(self, name, text, mode="a"):
        p = os.path.join(self.root, "proj", name)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, mode) as fh:
            fh.write(text)
        return p

    def q(self, sql, *args):
        return self.con.execute(sql, list(args)).fetchall()

    def count(self, where="TRUE"):
        return self.q(f"SELECT count(*) FROM raw_lines WHERE {where}")[0][0]


class SchemaTest(StoreCase):
    def test_schema_and_modes(self):
        cols = {r[0] for r in self.q("SELECT column_name FROM information_schema.columns WHERE table_name = 'raw_lines'")}
        self.assertEqual(cols, {"key", "file", "line_no", "byte_offset", "type", "session_id", "uuid", "ts",
                                "subagent", "parsed", "json"})
        cols = {r[0] for r in self.q("SELECT column_name FROM information_schema.columns WHERE table_name = 'files'")}
        self.assertTrue({"path", "size", "read_offset", "mtime", "last_ingest"} <= cols)
        pk = self.q("SELECT constraint_column_names FROM duckdb_constraints() WHERE table_name = 'raw_lines' "
                    "AND constraint_type = 'PRIMARY KEY'")
        self.assertEqual(pk[0][0], ["key"])
        self.assertEqual(stat.S_IMODE(os.stat(self.db).st_mode), 0o600)
        self.assertEqual(stat.S_IMODE(os.stat(os.path.dirname(self.db)).st_mode), 0o700)


class IngestTest(StoreCase):
    def test_growth_reads_only_new_bytes(self):
        p = self.write("a.jsonl", line(type="user", uuid="u1", sessionId="s"))
        store.ingest(self.con, self.root)
        before = os.path.getsize(p)
        self.write("a.jsonl", line(type="user", uuid="u2", sessionId="s"))
        stats = store.ingest(self.con, self.root)
        self.assertEqual(stats["lines"], 1)
        self.assertEqual(self.count(), 2)
        self.assertEqual(self.q("SELECT byte_offset FROM raw_lines WHERE key = 'u2'")[0][0], before)
        self.assertEqual(store.ingest(self.con, self.root)["files"], 0)

    def test_partial_last_line_waits(self):
        self.write("a.jsonl", line(type="user", uuid="u1") + '{"type": "user", "uu')
        store.ingest(self.con, self.root)
        self.assertEqual(self.count(), 1)
        self.write("a.jsonl", 'id": "u2"}\n')
        store.ingest(self.con, self.root)
        self.assertEqual(self.count("key = 'u2' AND parsed"), 1)

    def test_shrink_rereads_without_duplicates(self):
        self.write("a.jsonl", line(type="user", uuid="u1") + line(type="user", uuid="u2"))
        store.ingest(self.con, self.root)
        self.write("a.jsonl", line(type="user", uuid="u1"), mode="w")
        store.ingest(self.con, self.root)
        self.assertEqual(self.count(), 2)
        self.write("a.jsonl", line(type="user", uuid="u3"))
        store.ingest(self.con, self.root)
        self.assertEqual(self.count(), 3)

    def test_duplicate_uuid_across_files(self):
        self.write("a.jsonl", line(type="user", uuid="u1", sessionId="s1"))
        self.write("b.jsonl", line(type="user", uuid="u1", sessionId="s2") + line(type="user", uuid="u9"))
        store.ingest(self.con, self.root)
        self.assertEqual(self.count("key = 'u1'"), 1)
        self.assertEqual(self.count(), 2)

    def test_duplicate_blob_hash(self):
        blob = line(type="api-request-blob", hash="h1", message={"role": "user", "content": "x"})
        self.write("a.jsonl", blob)
        self.write("b.jsonl", blob + blob)
        store.ingest(self.con, self.root)
        self.assertEqual(self.count("key = 'blob:h1'"), 1)
        self.assertEqual(self.count(), 1)

    def test_malformed_line_kept_unparsed(self):
        self.write("a.jsonl", "not json\n" + line(type="user", uuid="u1"))
        store.ingest(self.con, self.root)
        self.assertEqual(self.q("SELECT parsed, json FROM raw_lines WHERE NOT parsed"), [(False, "not json")])
        self.assertEqual(self.count("parsed"), 1)

    def test_lines_kept_verbatim(self):
        text = '{"type":"assistant",  "uuid":"u1", "x": "é"}'
        self.write("a.jsonl", text + "\n")
        store.ingest(self.con, self.root)
        self.assertEqual(self.q("SELECT json FROM raw_lines")[0][0], text)

    def test_subagent_lines_marked(self):
        self.write("s1/subagents/agent-1.jsonl", line(type="user", uuid="u1"))
        store.ingest(self.con, self.root)
        self.assertEqual(self.q("SELECT subagent FROM raw_lines")[0][0], True)

    def test_deleted_source_keeps_rows(self):
        p = self.write("a.jsonl", line(type="user", uuid="u1") + line(type="user", uuid="u2"))
        store.ingest(self.con, self.root)
        os.remove(p)
        store.ingest(self.con, self.root)
        self.assertEqual(self.count(), 2)
        self.assertEqual(self.q("SELECT count(*) FROM files")[0][0], 1)


class SourceMigrationTest(StoreCase):
    def test_store_without_source_marked_claude(self):
        self.write("a.jsonl", line(type="user", uuid="u1", sessionId="s1", timestamp="2026-11-01T10:00:00Z")
                   + line(type="user", uuid="u2", sessionId="s2", timestamp="2026-11-01T10:00:01Z"))
        store.ingest(self.con, self.root)
        for t in ("files", "sessions"):  # the schema before sources
            self.con.execute(f"ALTER TABLE {t} DROP COLUMN source")
        counts = lambda: [self.q(f"SELECT count(*) FROM {t}")[0][0] for t in ("raw_lines", "files", "sessions")]
        before = counts()
        self.con.close()
        for _ in range(2):  # idempotent
            self.con = store.open_store(self.db)
            self.assertEqual(counts(), before)
            self.assertEqual(self.q("SELECT source, count(*) FROM files GROUP BY 1 UNION ALL "
                                    "SELECT source, count(*) FROM sessions GROUP BY 1"), [("claude", 1), ("claude", 2)])
            self.con.close()
        self.con = store.open_store(self.db)


class MoveEarlierStoreTest(unittest.TestCase):
    """The default store moved from data/claude.duckdb to data/ai-ledger.duckdb; nothing stored may be lost."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.data = os.path.join(self.tmp, "data")
        os.makedirs(self.data)
        self.old = os.path.join(self.data, "claude.duckdb")
        self.new = os.path.join(self.data, "ai-ledger.duckdb")
        patch = mock.patch.multiple(store, DEFAULT_DB=self.new, EARLIER_DB=self.old)
        patch.start()
        self.addCleanup(patch.stop)
        self.addCleanup(shutil.rmtree, self.tmp)

    def make(self, path, key):
        con = store.open_store(path)
        con.execute("INSERT INTO raw_lines (key, json) VALUES (?, '{}')", [key])
        con.close()

    def keys(self, con):
        return [r[0] for r in con.execute("SELECT key FROM raw_lines ORDER BY key").fetchall()]

    def test_moves_earlier_store(self):
        self.make(self.old, "u1")
        con = store.open_store()
        self.assertEqual(self.keys(con), ["u1"])
        con.close()
        self.assertFalse(os.path.exists(self.old))
        self.assertEqual(stat.S_IMODE(os.stat(self.new).st_mode), 0o600)

    def test_moves_write_ahead_log(self):
        # A process that exits without a checkpoint leaves its last insert only in claude.duckdb.wal.
        script = ("import duckdb, os, sys; sys.path.insert(0, sys.argv[2]); import store; "
                  "c = store.open_store(sys.argv[1]); c.execute(\"SET checkpoint_threshold = '10GB'\"); "
                  "c.execute(\"INSERT INTO raw_lines (key, json) VALUES ('u1', '{}')\"); os._exit(0)")
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        subprocess.run([sys.executable, "-c", script, self.old, root], check=True)
        self.assertTrue(os.path.exists(self.old + ".wal"))
        con = store.open_store()
        self.assertEqual(self.keys(con), ["u1"])
        con.close()
        self.assertFalse(os.path.exists(self.old + ".wal"))

    def test_finishes_move_stopped_before_log(self):
        self.make(self.old, "u1")
        open(self.old + ".wal", "wb").close()
        os.replace(self.old, self.new)  # as if the process died between the two moves
        store.open_store().close()
        self.assertFalse(os.path.exists(self.old + ".wal"))

    def test_both_stores_keep_new_and_leave_earlier(self):
        self.make(self.old, "old")
        self.make(self.new, "new")
        con = store.open_store()
        self.assertEqual(self.keys(con), ["new"])
        con.close()
        con = store.open_store(self.old)
        self.assertEqual(self.keys(con), ["old"])
        con.close()

    def test_explicit_path_moves_nothing(self):
        self.make(self.old, "u1")
        other = os.path.join(self.data, "other.duckdb")
        store.open_store(other).close()
        self.assertTrue(os.path.exists(self.old))
        self.assertFalse(os.path.exists(self.new))

    def test_new_store_without_earlier(self):
        store.open_store().close()
        self.assertTrue(os.path.exists(self.new))
        self.assertFalse(os.path.exists(self.old))


if __name__ == "__main__":
    unittest.main()
