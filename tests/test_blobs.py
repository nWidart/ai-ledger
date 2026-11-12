import json
import os
import unittest

import duckdb

from ai_ledger import blobs, store
from test_store import StoreCase, line


def big(c, n=600):
    return c * n


class BlobsTest(StoreCase):
    def lines(self):
        return {r[0]: r[1] for r in self.q("SELECT key, json FROM raw_lines")}

    def stored(self):
        return {r[0]: (r[1], r[2]) for r in self.q("SELECT key, json, packed FROM raw_lines")}

    def full(self):
        return {r[0]: r[10] for r in store.raw_rows(self.con.cursor())}

    def ingest(self, *texts):
        self.write("a.jsonl", "".join(t + "\n" for t in texts))
        store.ingest(self.con, self.roots)

    def test_round_trip(self):
        text = line(type="user", uuid="u1", message=dict(content=big("é\\\"x") + "\n" + "tail"), n=1).strip()
        self.ingest(text)
        got, packed = self.stored()["u1"]
        self.assertTrue(packed)
        self.assertLess(len(got), 200)
        self.assertEqual(json.loads(got)["uuid"], "u1")
        self.assertEqual(self.full(), {"u1": text})

    def test_reference_text_stays_whole(self):
        text = json.dumps(dict(type="user", uuid="u1", a="~b~", b='"~b~' + "0" * 32, c=big("z")))
        self.ingest(text)
        self.assertEqual(self.stored()["u1"], (text, False))

    def test_unparsed_line_stays_whole(self):
        text = '{"type": "user", "a": "' + big("q")
        self.ingest(text)
        self.assertEqual(self.q("SELECT json, packed, parsed FROM raw_lines"), [(text, False, False)])
        self.assertEqual(self.q("SELECT count(*) FROM blobs")[0][0], 0)

    def test_regex_spanning_non_string_text_stays_whole(self):
        text = '{"type":"user","uuid":"u1","a":"x","n":[' + ",".join(["1"] * 200) + '],"b":"y"}'
        self.assertGreater(len(text), 400)
        self.ingest(text)
        self.assertEqual(self.stored()["u1"], (text, False))
        self.assertEqual(self.full(), {"u1": text})

    def test_same_string_stored_once(self):
        a = line(type="user", uuid="u1", m=big("s")).strip()
        b = line(type="user", uuid="u2", m=big("s"), other=big("t")).strip()
        self.ingest(a, b)
        self.assertEqual(self.q("SELECT count(*) FROM blobs")[0][0], 2)
        self.assertEqual(self.full(), {"u1": a, "u2": b})
        self.write("a.jsonl", line(type="user", uuid="u3", m=big("s")))  # a later chunk finds it stored
        store.ingest(self.con, self.roots)
        self.assertEqual(self.q("SELECT count(*) FROM blobs")[0][0], 2)

    def test_old_format_rows_still_read(self):
        path = os.path.join(self.tmp, "old.duckdb")
        con = duckdb.connect(path)
        con.execute(store.RAW_SCHEMA.replace(", packed BOOLEAN DEFAULT false", ""))
        text = line(type="user", uuid="u1", m=big("o")).strip()
        con.execute("INSERT INTO raw_lines (key, file, line_no, byte_offset, parsed, json) VALUES ('u1', 'f', 0, 0, true, ?)", [text])
        con.close()
        con = store.open_store(path)
        try:
            self.assertEqual([r[10] for r in store.raw_rows(con.cursor())], [text])
            self.assertEqual(con.execute("SELECT packed FROM raw_lines").fetchall(), [(False,)])
        finally:
            con.close()

    def test_missing_blob_raises(self):
        text = line(type="user", uuid="u1", m=big("s")).strip()
        self.ingest(text)
        self.con.execute("DELETE FROM blobs")
        with self.assertRaises(LookupError):
            list(store.raw_rows(self.con.cursor()))

    def test_rebuild_equal_after_packing(self):
        rows = [json.dumps(dict(type="assistant", uuid="a1", sessionId="s1", timestamp="2025-01-01T00:00:00Z", cwd="/x",
                                message=dict(id="m1", model="claude-sonnet-4", role="assistant", usage=dict(input_tokens=1, output_tokens=2),
                                             content=[dict(type="text", text=big("r"))])))]
        self.ingest(*rows)
        tables = ["sessions", "requests", "tool_calls", "prompts"]
        before = [self.q(f"SELECT * FROM {t} ORDER BY 1") for t in tables]
        self.assertTrue(self.stored()["a1"][1])
        store.rebuild(self.con)
        self.assertEqual([self.q(f"SELECT * FROM {t} ORDER BY 1") for t in tables], before)
        self.assertEqual(self.full(), {"a1": rows[0]})


class PackLineTest(unittest.TestCase):
    def test_pack_line(self):
        inner = "ab\\n" * 100
        text = '{"k":"%s","s":"short"}' % inner
        out, packed, found = blobs.pack_line(text)
        self.assertTrue(packed)
        self.assertEqual(list(found.values()), [inner])
        self.assertEqual(out, '{"k":"~b~%032x","s":"short"}' % blobs.digest(inner))
        self.assertEqual(blobs.pack_line('{"a":"b"}'), ('{"a":"b"}', False, {}))


if __name__ == "__main__":
    unittest.main()
