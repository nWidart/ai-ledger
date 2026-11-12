import base64
import json
import os
import stat
import subprocess
import sys
import unittest
from unittest import mock

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


    def test_tokens_with_escapes(self):
        cases = ['\\"' * 300, "\\\\" * 300, "\\u0000" * 300, "\\ud800" * 300, "a\\/b" * 300, "é" * 300, "\\n" * 300]  # the pattern counts units
        texts = ['{"type":"user","uuid":"u%d","a":"%s","b":"x"}' % (i, c) for i, c in enumerate(cases)]
        for t in texts:
            json.loads(t)
        self.ingest(*texts)
        self.assertEqual(self.full(), {f"u{i}": t for i, t in enumerate(texts)})
        self.assertEqual(self.q("SELECT count(*) FROM raw_lines WHERE packed")[0][0], len(texts))

    def test_long_key(self):
        text = '{"type":"user","uuid":"u1","%s":1}' % ("k" * 300)
        self.ingest(text)
        self.assertTrue(self.stored()["u1"][1])
        self.assertEqual(self.full(), {"u1": text})

    def test_size_boundary(self):
        for n, packed in ((255, False), (256, True), (257, True)):
            text = '{"a":"%s"}' % ("x" * n)
            self.assertEqual(blobs.pack_line(text)[1], packed, n)

    def test_rolled_back_ingest_leaves_no_blobs(self):
        self.write("a.jsonl", line(type="user", uuid="u1", m=big("s")))
        with mock.patch.object(store.Deriver, "flush", side_effect=RuntimeError("boom")):
            with self.assertRaises(RuntimeError):
                store.ingest(self.con, self.roots)
        for t in ("raw_lines", "blobs", "packs", "packs_open"):
            self.assertEqual(self.q(f"SELECT count(*) FROM {t}")[0][0], 0, t)

    def test_stored_hash_of_another_token_keeps_line_whole(self):
        inner = "m" * 600
        text = '{"type":"user","uuid":"u1","a":"%s"}' % inner
        self.con.execute("INSERT INTO blobs VALUES (?, 0, 0, 5, false)", [blobs.digest(inner)])
        self.ingest(text)
        self.assertEqual(self.stored()["u1"], (text, False))

    def test_seal_between_lookup_and_read(self):
        text = line(type="user", uuid="u1", m=big("s")).strip()
        self.ingest(text)
        self.assertGreater(self.q("SELECT count(*) FROM packs_open")[0][0], 0)
        reader, sealer = self.con.cursor(), self.con.cursor()
        real, calls = blobs.get, []

        def get(cur, pack):  # the writer seals after the reader's lookup, before its read
            first = not calls
            calls.append(pack)
            if first:
                blobs.seal(sealer, force=True)
            return real(cur, pack)

        rows = reader.execute("SELECT json, packed FROM raw_lines").fetchall()
        with mock.patch.object(blobs, "get", get):
            self.assertEqual(blobs.expand(reader, rows), [(text,)])
        self.assertEqual(len(calls), 3)  # the read, the seal's own read, the retry


class Base64Test(StoreCase):
    def ingest(self, *texts):
        self.write("a.jsonl", "".join(t + "\n" for t in texts))
        store.ingest(self.con, self.roots)

    def full(self):
        return {r[0]: r[10] for r in store.raw_rows(self.con.cursor())}

    def test_round_trip_with_and_without_padding(self):
        texts = []
        for i, n in enumerate((600, 601, 602)):  # 0, 1 and 2 padding characters
            inner = base64.b64encode(os.urandom(n)).decode()
            texts.append(line(type="user", uuid=f"u{i}", img=inner).strip())
        self.ingest(*texts)
        self.assertEqual(self.q("SELECT count(*) FROM blobs WHERE b64")[0][0], 3)
        self.assertEqual(self.full(), {f"u{i}": t for i, t in enumerate(texts)})

    def test_non_canonical_base64_stays_text(self):
        inner = "A" * 400 + "QR=="  # the last character carries bits that decoding drops
        padless = "A" * 403  # not a multiple of 4
        texts = [line(type="user", uuid="u1", a=inner).strip(), line(type="user", uuid="u2", a=padless).strip()]
        self.ingest(*texts)
        self.assertEqual(self.q("SELECT count(*) FROM blobs WHERE b64")[0][0], 0)
        self.assertEqual(self.q("SELECT count(*) FROM blobs")[0][0], 2)
        self.assertEqual(self.full(), {"u1": texts[0], "u2": texts[1]})

    def test_seal_keeps_every_line(self):
        def make(i, kind):
            inner = base64.b64encode(os.urandom(500)).decode() if kind else f"text{i} " * 100
            return line(type="user", uuid=f"u{i}", a=inner).strip()
        with mock.patch.object(blobs, "SEAL_BYTES", 1000):
            texts = [make(i, i % 2) for i in range(2)]
            self.ingest(*texts)
            self.assertEqual(self.q("SELECT count(*) FROM packs_open")[0][0], 0)  # sealed on the spot
            self.assertGreater(self.q("SELECT count(*) FROM packs")[0][0], 0)
        with mock.patch.object(blobs, "SEAL_BYTES", 1 << 30):
            texts += [make(i, i % 2) for i in range(2, 4)]
            self.write("a.jsonl", "".join(t + "\n" for t in texts[2:]))
            store.ingest(self.con, self.roots)
            self.assertGreater(self.q("SELECT count(*) FROM packs_open")[0][0], 0)
            self.assertEqual(self.full(), {f"u{i}": t for i, t in enumerate(texts)})
            before = self.q("SELECT count(*) FROM blobs")[0][0]
            again = line(type="user", uuid="u9", a=json.loads(texts[0])["a"]).strip()  # stored before the seal
            self.write("a.jsonl", again + "\n")
            store.ingest(self.con, self.roots)
            self.assertEqual(self.q("SELECT count(*) FROM blobs")[0][0], before)
            blobs.seal(self.con.cursor(), force=True)
            self.assertEqual(self.q("SELECT count(*) FROM packs_open")[0][0], 0)
            self.assertEqual(self.full(), {**{f"u{i}": t for i, t in enumerate(texts)}, "u9": again})


class CompactTest(StoreCase):
    def old_store(self):
        """Ingest lines with big repeated strings, then turn the store back into one from before packing."""
        a = base64.b64encode(os.urandom(900)).decode()
        shared = [os.urandom(10000).hex() for _ in range(40)]
        texts = [line(type="user", uuid=f"u{i}", sessionId="s1", timestamp=f"2025-01-01T00:00:{i % 60:02d}Z", cwd="/x", img=a,
                      a=shared[i % 40], b=shared[(i * 7) % 40], c=shared[(i * 11 + 3) % 40], message=dict(content="hi")).strip()
                 for i in range(400)]
        self.write("a.jsonl", "".join(t + "\n" for t in texts) + "not json\n")
        store.ingest(self.con, self.roots)
        c = self.con.cursor()
        rows = list(store.raw_rows(c))
        for r in rows:
            c.execute("UPDATE raw_lines SET json = ?, packed = false WHERE key = ?", [r[10], r[0]])
        for t in ("blobs", "packs", "packs_open"):
            c.execute(f"DELETE FROM {t}")
        c.execute("INSERT INTO error_marks (category, muted) VALUES ('x', true)")
        c.execute("INSERT INTO limit_polls VALUES ('p', '2025-01-01', '{}')")
        c.execute("INSERT INTO usage_files (path, kind, json) VALUES ('f', 'facet', '{}')")
        self.con.close()
        return texts

    def snapshot(self):
        con = store.open_store(self.db)
        try:
            c = con.cursor()
            lines = sorted(store.raw_rows(c), key=lambda r: r[0])
            others = {t: sorted(map(repr, c.execute(f"SELECT * FROM {t}").fetchall()))
                      for t in store.DERIVED + ["files", "error_marks", "limit_polls", "usage_files"]}
            return lines, others, c.execute("SELECT count(*) FROM packs_open").fetchone()[0]
        finally:
            con.close()

    def test_compact_keeps_everything(self):
        self.old_store()
        lines, others, _ = self.snapshot()
        meta = lambda rows: [r[:10] for r in rows]
        stats = store.compact(self.db)
        self.assertLess(stats["after"], stats["before"])
        self.assertEqual(stats["lines"], len(lines))
        got, after, open_rows = self.snapshot()
        self.assertEqual(got, lines)
        self.assertEqual(meta(got), meta(lines))
        self.assertEqual(after, others)
        self.assertEqual(open_rows, 0)
        con = store.open_store(self.db)
        try:
            self.assertEqual(con.execute("SELECT count(*) FILTER (WHERE packed), count(*) FILTER (WHERE NOT packed) FROM raw_lines").fetchone(), (400, 1))
        finally:
            con.close()
        self.assertEqual(stat.S_IMODE(os.stat(self.db).st_mode), 0o600)
        self.assertFalse(os.path.exists(self.db + ".compact"))

    def test_compact_twice_and_leftover(self):
        self.old_store()
        lines = self.snapshot()[0]
        with open(self.db + ".compact", "wb") as fh:
            fh.write(b"crashed")
        store.compact(self.db)
        store.compact(self.db)
        self.assertEqual(self.snapshot()[0], lines)


class CompactChecksTest(CompactTest):
    def test_failed_verification_leaves_old_store(self):
        self.old_store()
        store.open_store(self.db).close()
        with open(self.db, "rb") as fh:
            before = fh.read()
        with mock.patch.object(blobs, "verify", side_effect=ValueError("bad blob")):
            with self.assertRaises(ValueError):
                store.compact(self.db)
        with open(self.db, "rb") as fh:
            self.assertEqual(fh.read(), before)
        self.assertFalse(os.path.exists(self.db + ".compact"))
        self.assertFalse(os.path.exists(self.db + ".compact.wal"))

    def test_store_stays_locked_while_compacting(self):
        self.old_store()
        tried = []

        def log(msg):
            if not tried:
                r = subprocess.run([sys.executable, "-c", f"import duckdb; duckdb.connect({self.db!r})"], capture_output=True, text=True)
                tried.append(r.returncode)

        store.compact(self.db, log=log)
        self.assertEqual(len(tried), 1)
        self.assertNotEqual(tried[0], 0)
        store.open_store(self.db).close()  # free again afterwards


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
