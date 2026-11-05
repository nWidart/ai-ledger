import json
import os
import shutil
import stat
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import store  # noqa: E402


def line(**kw):
    return json.dumps(kw) + "\n"


class StoreCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.root = os.path.join(self.tmp, "projects")
        self.db = os.path.join(self.tmp, "data", "claude.duckdb")
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


if __name__ == "__main__":
    unittest.main()
