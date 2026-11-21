import errno
import io
import json
import os
import shutil
import stat
import sys
import subprocess
import tempfile
import unittest
from datetime import date, datetime, timezone
from unittest import mock

import duckdb

from ai_ledger import metrics, store


def line(**kw):
    return json.dumps(kw) + "\n"


class StoreCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.root = os.path.join(self.tmp, "projects")
        self.roots = dict(claude=self.root, codex=os.path.join(self.tmp, "codex"))  # never the real homes
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


class ErrorMarksTest(StoreCase):
    """error_marks holds what the user told the Errors page; nothing in the transcripts derives it."""

    def marks(self):
        return self.q("SELECT category, fixed_on FROM error_marks ORDER BY 1")

    def test_set_replace_and_remove(self):
        cur = self.con.cursor()
        store.set_error_fix(cur, "x", date(2026, 11, 4))
        store.set_error_fix(cur, "y", date(2026, 11, 3))
        store.set_error_fix(cur, "x", date(2026, 11, 5))
        self.assertEqual(self.marks(), [("x", date(2026, 11, 5)), ("y", date(2026, 11, 3))])
        store.set_error_fix(cur, "x", None)  # the row stays: it records that the store has decided about this type
        store.set_error_fix(cur, "never-marked", None)
        self.assertEqual(self.marks(), [("never-marked", None), ("x", None), ("y", date(2026, 11, 3))])
        store.set_error_fix(cur, "x", date(2026, 11, 6))  # a mark after an undo works
        self.assertEqual(self.marks()[1], ("x", date(2026, 11, 6)))
        self.assertEqual(metrics.error_fixes(cur), {"x": "2026-11-06", "y": "2026-11-03"})

    def test_import_adds_only_a_type_the_store_has_not_decided(self):
        cur = self.con.cursor()
        store.set_error_fix(cur, "kept", date(2026, 11, 1))
        store.set_error_fix(cur, "undone", date(2026, 11, 2))
        store.set_error_fix(cur, "undone", None)
        store.import_error_fixes(cur, {"kept": date(2026, 10, 1), "new": date(2026, 10, 2), "undone": date(2026, 10, 3)})
        self.assertEqual(self.marks(), [("kept", date(2026, 11, 1)), ("new", date(2026, 10, 2)), ("undone", None)])
        store.import_error_fixes(cur, {})
        store.import_error_fixes(cur, {"new": date(2026, 9, 1)})  # a second import changes nothing
        self.assertEqual(self.marks()[1], ("new", date(2026, 10, 2)))

    def test_survive_rebuild_and_reopening(self):
        self.assertNotIn("error_marks", store.DERIVED)
        store.set_error_fix(self.con.cursor(), "x", date(2026, 11, 4))
        store.set_error_muted(self.con.cursor(), "y", True)
        store.rebuild(self.con)
        self.reopen()
        self.assertEqual(self.muted(), [("x", date(2026, 11, 4), False), ("y", None, True)])

    def muted(self):
        return self.q("SELECT category, fixed_on, muted FROM error_marks ORDER BY 1")

    def test_mute_and_unmute_touch_only_muted(self):
        cur = self.con.cursor()
        store.set_error_fix(cur, "x", date(2026, 11, 4))
        store.set_error_muted(cur, "x", True)  # a mute keeps the fix day
        store.set_error_muted(cur, "y", True)  # a type with no row gets one
        self.assertEqual(self.muted(), [("x", date(2026, 11, 4), True), ("y", None, True)])
        store.set_error_fix(cur, "x", date(2026, 11, 5))  # a mark keeps muted
        self.assertEqual(self.muted()[0], ("x", date(2026, 11, 5), True))
        store.set_error_fix(cur, "x", None)  # an undo keeps muted
        self.assertEqual(self.muted()[0], ("x", None, True))
        store.set_error_fix(cur, "y", date(2026, 11, 1))
        store.set_error_muted(cur, "y", False)  # an unmute keeps the fix day, and the row
        store.set_error_muted(cur, "z", False)
        self.assertEqual(self.muted(), [("x", None, True), ("y", date(2026, 11, 1), False), ("z", None, False)])
        self.assertEqual(metrics.error_marks(cur), {"fixes": {"y": "2026-11-01"}, "muted": ["x"]})

    def test_import_adds_the_marker_of_a_type_that_is_only_muted(self):
        cur = self.con.cursor()
        store.set_error_muted(cur, "x", True)  # a mute decides nothing about the fix marker
        store.import_error_fixes(cur, {"x": date(2026, 10, 1), "new": date(2026, 10, 2)})
        self.assertEqual(self.muted(), [("new", date(2026, 10, 2), False), ("x", date(2026, 10, 1), True)])
        self.assertEqual(self.decided(), [("new", True), ("x", True)])

    def test_mute_keeps_a_decision_and_a_mark_makes_one(self):
        cur = self.con.cursor()
        store.set_error_muted(cur, "x", True)
        store.set_error_muted(cur, "y", False)
        self.assertEqual(self.decided(), [("x", False), ("y", False)])
        store.set_error_fix(cur, "x", date(2026, 11, 4))
        store.set_error_fix(cur, "y", None)
        store.set_error_muted(cur, "x", False)
        self.assertEqual(self.decided(), [("x", True), ("y", True)])

    def decided(self):
        return self.q("SELECT category, fix_decided FROM error_marks ORDER BY 1")

    def reopen(self):
        self.con.close()
        self.con = store.open_store(self.db)

    def old_store(self, ddl, rows):
        """Rewrite the store as a file made before fix_decided: the table in an older shape, filled with raw SQL."""
        self.con.close()
        old = duckdb.connect(self.db)
        old.execute("DROP TABLE error_marks")
        old.execute(ddl)
        for r in rows:
            old.execute("INSERT INTO error_marks VALUES (" + ",".join("?" * len(r)) + ")", r)
        old.close()

    def test_a_store_with_two_columns_gets_fix_decided_for_every_row(self):
        self.old_store("CREATE TABLE error_marks (category VARCHAR PRIMARY KEY, fixed_on DATE)", [("a", date(2026, 11, 4)), ("b", None)])
        self.con = store.open_store(self.db)
        self.assertEqual(self.decided(), [("a", True), ("b", True)])  # no muted column: a row without a fix day is an undo
        self.assertEqual(self.muted(), [("a", date(2026, 11, 4), False), ("b", None, False)])
        store.set_error_muted(self.con.cursor(), "a", True)  # the new column takes a mute
        self.assertEqual(metrics.error_marks(self.con.cursor()), {"fixes": {"a": "2026-11-04"}, "muted": ["a"]})

    def test_a_store_with_three_columns_backfills_fix_decided_once(self):
        self.old_store("CREATE TABLE error_marks (category VARCHAR PRIMARY KEY, fixed_on DATE, muted BOOLEAN DEFAULT false)",
                       [("fixed", date(2026, 11, 4), False), ("undone", None, False), ("fixed-muted", date(2026, 11, 3), True),
                        ("muted", None, True)])
        self.con = store.open_store(self.db)
        self.assertEqual(self.decided(), [("fixed", True), ("fixed-muted", True), ("muted", False), ("undone", True)])
        store.set_error_muted(self.con.cursor(), "muted", False)  # a mute then an unmute: a row with no fix day, not muted, undecided
        self.reopen()  # a second open does not backfill: it would read this row as an undo
        self.assertEqual(self.decided()[2], ("muted", False))
        store.import_error_fixes(self.con.cursor(), {"muted": date(2026, 10, 1)})
        self.assertEqual(self.muted()[2], ("muted", date(2026, 10, 1), False))

    def test_the_column_and_its_backfill_are_one_transaction(self):
        """A backfill that fails leaves no column behind, so the next open backfills instead of skipping it."""
        self.old_store("CREATE TABLE error_marks (category VARCHAR PRIMARY KEY, fixed_on DATE, muted VARCHAR)", [("a", None, "not a flag")])
        with self.assertRaises(duckdb.Error):
            store.open_store(self.db)
        raw = duckdb.connect(self.db)
        cols = [c for (c,) in raw.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'error_marks'").fetchall()]
        raw.close()
        self.assertEqual(cols, ["category", "fixed_on", "muted"])
        self.con = duckdb.connect(":memory:")  # the case's cleanup closes self.con


class IngestTest(StoreCase):
    def test_growth_reads_only_new_bytes(self):
        p = self.write("a.jsonl", line(type="user", uuid="u1", sessionId="s"))
        store.ingest(self.con, self.roots)
        before = os.path.getsize(p)
        self.write("a.jsonl", line(type="user", uuid="u2", sessionId="s"))
        stats = store.ingest(self.con, self.roots)
        self.assertEqual(stats["lines"], 1)
        self.assertEqual(self.count(), 2)
        self.assertEqual(self.q("SELECT byte_offset FROM raw_lines WHERE key = 'u2'")[0][0], before)
        self.assertEqual(store.ingest(self.con, self.roots)["files"], 0)

    def test_partial_last_line_waits(self):
        self.write("a.jsonl", line(type="user", uuid="u1") + '{"type": "user", "uu')
        store.ingest(self.con, self.roots)
        self.assertEqual(self.count(), 1)
        self.write("a.jsonl", 'id": "u2"}\n')
        store.ingest(self.con, self.roots)
        self.assertEqual(self.count("key = 'u2' AND parsed"), 1)

    def test_shrink_rereads_without_duplicates(self):
        self.write("a.jsonl", line(type="user", uuid="u1") + line(type="user", uuid="u2"))
        store.ingest(self.con, self.roots)
        self.write("a.jsonl", line(type="user", uuid="u1"), mode="w")
        store.ingest(self.con, self.roots)
        self.assertEqual(self.count(), 2)
        self.write("a.jsonl", line(type="user", uuid="u3"))
        store.ingest(self.con, self.roots)
        self.assertEqual(self.count(), 3)

    def test_duplicate_uuid_across_files(self):
        self.write("a.jsonl", line(type="user", uuid="u1", sessionId="s1"))
        self.write("b.jsonl", line(type="user", uuid="u1", sessionId="s2") + line(type="user", uuid="u9"))
        store.ingest(self.con, self.roots)
        self.assertEqual(self.count("key = 'u1'"), 1)
        self.assertEqual(self.count(), 2)

    def test_duplicate_blob_hash(self):
        blob = line(type="api-request-blob", hash="h1", message={"role": "user", "content": "x"})
        self.write("a.jsonl", blob)
        self.write("b.jsonl", blob + blob)
        store.ingest(self.con, self.roots)
        self.assertEqual(self.count("key = 'blob:h1'"), 1)
        self.assertEqual(self.count(), 1)

    def test_malformed_line_kept_unparsed(self):
        self.write("a.jsonl", "not json\n" + line(type="user", uuid="u1"))
        store.ingest(self.con, self.roots)
        self.assertEqual(self.q("SELECT parsed, json FROM raw_lines WHERE NOT parsed"), [(False, "not json")])
        self.assertEqual(self.count("parsed"), 1)

    def test_lines_kept_verbatim(self):
        text = '{"type":"assistant",  "uuid":"u1", "x": "é"}'
        self.write("a.jsonl", text + "\n")
        store.ingest(self.con, self.roots)
        self.assertEqual(self.q("SELECT json FROM raw_lines")[0][0], text)

    def test_subagent_lines_marked(self):
        self.write("s1/subagents/agent-1.jsonl", line(type="user", uuid="u1"))
        store.ingest(self.con, self.roots)
        self.assertEqual(self.q("SELECT subagent FROM raw_lines")[0][0], True)

    def test_missing_root_skipped(self):
        self.write("a.jsonl", line(type="user", uuid="u1", sessionId="s1"))
        self.assertFalse(os.path.exists(self.roots["codex"]))
        self.assertEqual(store.ingest(self.con, self.roots)["files"], 1)
        self.assertEqual(self.q("SELECT source FROM files UNION ALL SELECT source FROM sessions"), [("claude",), ("claude",)])
        shutil.rmtree(self.root)
        self.assertEqual(store.ingest(self.con, self.roots)["files"], 0)
        self.assertEqual(self.count(), 1)

    def test_deleted_source_keeps_rows(self):
        p = self.write("a.jsonl", line(type="user", uuid="u1") + line(type="user", uuid="u2"))
        store.ingest(self.con, self.roots)
        os.remove(p)
        store.ingest(self.con, self.roots)
        self.assertEqual(self.count(), 2)
        self.assertEqual(self.q("SELECT count(*) FROM files")[0][0], 1)


class TitleTest(StoreCase):
    def ai(self, title, sid="s1"):
        return line(type="ai-title", aiTitle=title, sessionId=sid)

    def custom(self, title, sid="s1"):
        return line(type="custom-title", customTitle=title, sessionId=sid)

    def titles(self):
        return self.q("SELECT session_id, custom, agent FROM session_titles ORDER BY 1")

    def test_custom_title_after_ai_title(self):
        self.write("a.jsonl", self.ai("Fix login redirect") + self.custom("auth bug"))
        store.ingest(self.con, self.roots)
        self.assertEqual(self.titles(), [("s1", "auth bug", "Fix login redirect")])

    def test_custom_title_before_ai_title(self):
        self.write("a.jsonl", self.custom("auth bug"))
        store.ingest(self.con, self.roots)
        self.write("a.jsonl", self.ai("Fix login redirect"))
        store.ingest(self.con, self.roots)
        self.assertEqual(self.titles(), [("s1", "auth bug", "Fix login redirect")])

    def test_renamed_twice(self):
        self.write("a.jsonl", self.custom("draft") + self.custom("release notes"))
        store.ingest(self.con, self.roots)
        self.write("a.jsonl", self.custom("final"))
        store.ingest(self.con, self.roots)
        self.assertEqual(self.titles(), [("s1", "final", None)])

    def test_subagent_title_ignored(self):
        self.write("s1/subagents/agent-1.jsonl", self.ai("Search the repo"))
        store.ingest(self.con, self.roots)
        self.assertEqual(self.titles(), [])

    def test_title_line_makes_no_session(self):
        self.write("a.jsonl", self.ai("Add session titles") + self.custom("") + line(type="ai-title", aiTitle=3, sessionId="s2"))
        store.ingest(self.con, self.roots)
        self.assertEqual(self.q("SELECT count(*) FROM sessions")[0][0], 0)
        self.assertEqual(self.titles(), [("s1", None, "Add session titles")])


class MigrationTest(StoreCase):
    """A store written before a column or table existed gains it on open, empty, keeps its rows, and a second open changes nothing."""

    # Each column or table open_store adds to an older store; error_marks' columns have their own tests: they carry a backfill.
    COLUMNS = [("files", "source"), ("sessions", "source"), ("requests", "speed"), ("requests", "reported_cost"),
               ("requests", "context_tokens"), ("tool_calls", "result_bytes"), ("sessions", "context_window"),
               ("sessions", "first_compaction_ts")]
    TABLES = ["session_runs", "usage_files", "session_facets", "facet_counts", "session_meta"]

    def test_older_store_gains_every_later_column_and_table(self):
        S = dict(sessionId="s1", cwd="/nowhere/foo")
        self.write("a.jsonl", line(type="user", uuid="u1", timestamp="2026-11-01T10:00:00Z", promptId="p1",
                                   message=dict(role="user", content="go"), **S)
                   + line(type="assistant", uuid="a1", timestamp="2026-11-01T10:00:01Z",
                          message=dict(id="m1", model="m", usage=dict(input_tokens=1, output_tokens=2),
                                       content=[dict(type="tool_use", id="t1", name="Bash", input=dict(command="x"))]), **S)
                   + line(type="user", uuid="r1", timestamp="2026-11-01T10:00:02Z", promptId="p1", message=dict(
                       role="user", content=[dict(type="tool_result", tool_use_id="t1", content="ok")]), **S)
                   + line(type="user", uuid="u2", sessionId="s2", timestamp="2026-11-01T10:00:03Z"))
        store.ingest(self.con, self.roots)
        self.assertEqual(self.q("SELECT count(*) FROM requests WHERE reported_cost IS NULL"), [(1,)])  # Claude reports no cost
        for table, col in self.COLUMNS:
            self.con.execute(f"ALTER TABLE {table} DROP COLUMN {col}")
        for t in self.TABLES:
            self.con.execute(f"DROP TABLE {t}")
        counts = lambda: [self.q(f"SELECT count(*) FROM {t}")[0][0]
                          for t in ("raw_lines", "files", "sessions", "requests", "tool_calls", "projects_by_cwd")]
        before = counts()
        self.assertEqual(before, [4, 1, 2, 1, 1, 1])
        self.con.close()
        for _ in range(2):  # opening again adds nothing and breaks nothing
            self.con = store.open_store(self.db)
            self.assertEqual(counts(), before)
            self.assertEqual(self.q("SELECT source, count(*) FROM files GROUP BY 1 UNION ALL "
                                    "SELECT source, count(*) FROM sessions GROUP BY 1"), [("claude", 1), ("claude", 2)])
            for table, col in self.COLUMNS[2:]:
                self.assertEqual(self.q(f"SELECT count({col}) FROM {table}"), [(0,)], col)  # NULL until a rebuild
            for t in self.TABLES:
                self.assertEqual(self.q(f"SELECT count(*) FROM {t}"), [(0,)], t)
            cols = [r[0] for r in self.q("SELECT column_name FROM information_schema.columns WHERE table_name = 'usage_files' "
                                         "ORDER BY ordinal_position")]
            self.assertEqual(cols, ["path", "kind", "session_id", "size", "mtime", "json", "ingested_at"])
            self.con.close()
        self.con = store.open_store(self.db)


class DataDirTest(unittest.TestCase):
    """The default store lives in a per-user data folder, outside the installed code."""

    def data_dir(self, platform, env):
        with mock.patch.object(sys, "platform", platform), mock.patch.dict(os.environ, env, clear=True):
            return store.data_dir()

    def test_data_dir(self):
        self.assertEqual(self.data_dir("darwin", dict(HOME="/home/me", XDG_DATA_HOME="/data/me")),
                         "/home/me/Library/Application Support/ai-ledger")
        self.assertEqual(self.data_dir("linux", dict(HOME="/home/me", XDG_DATA_HOME="/data/me")), "/data/me/ai-ledger")
        self.assertEqual(self.data_dir("linux", dict(HOME="/home/me")), "/home/me/.local/share/ai-ledger")
        self.assertEqual(self.data_dir("linux", dict(HOME="/home/me", XDG_DATA_HOME="")), "/home/me/.local/share/ai-ledger")


class CheckoutStoresTest(unittest.TestCase):
    """Only a source checkout of ai-ledger has earlier stores to move; an installed package has none."""

    def setUp(self):
        self.root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.root)

    def pyproject(self, text):
        with open(os.path.join(self.root, "pyproject.toml"), "w") as fh:
            fh.write(text)

    def test_checkout(self):
        self.pyproject('[project]\nname = "ai-ledger"\n')
        self.assertEqual(store.checkout_stores(self.root), [os.path.join(self.root, "data", "ai-ledger.duckdb"),
                                                            os.path.join(self.root, "data", "claude.duckdb")])

    def test_no_checkout_moves_nothing(self):
        self.assertEqual(store.checkout_stores(self.root), [])  # site-packages: no pyproject.toml above the package
        self.pyproject('[project]\nname = "something-else"\n')
        self.assertEqual(store.checkout_stores(self.root), [])
        self.pyproject("not toml [")
        self.assertEqual(store.checkout_stores(self.root), [])

    def test_this_checkout(self):
        self.assertEqual(store.EARLIER_DBS, store.checkout_stores())
        self.assertEqual(len(store.EARLIER_DBS), 2)


class MoveEarlierStoreTest(unittest.TestCase):
    """The default store moved from the checkout's data/ folder (data/ai-ledger.duckdb, before that data/claude.duckdb)
    to the per-user data folder; nothing stored may be lost."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.data = os.path.join(self.tmp, "checkout", "data")
        os.makedirs(self.data)
        self.earlier = os.path.join(self.data, "ai-ledger.duckdb")
        self.old = os.path.join(self.data, "claude.duckdb")
        self.new = os.path.join(self.tmp, "home", "ai-ledger", "ai-ledger.duckdb")
        patch = mock.patch.multiple(store, DEFAULT_DB=self.new, EARLIER_DBS=[self.earlier, self.old])
        patch.start()
        self.addCleanup(patch.stop)
        self.addCleanup(shutil.rmtree, self.tmp)

    def make(self, path, key):
        con = store.open_store(path)
        con.execute("INSERT INTO raw_lines (key, json) VALUES (?, '{}')", [key])
        con.close()

    def keys(self, con):
        return [r[0] for r in con.execute("SELECT key FROM raw_lines ORDER BY key").fetchall()]

    def test_moves_either_earlier_store(self):
        for earlier in (self.earlier, self.old):
            with self.subTest(earlier=earlier):
                self.make(earlier, "u1")
                con = store.open_store()
                self.assertEqual(self.keys(con), ["u1"])
                con.close()
                self.assertFalse(os.path.exists(earlier))
                self.assertEqual(stat.S_IMODE(os.stat(self.new).st_mode), 0o600)
                self.assertEqual(stat.S_IMODE(os.stat(os.path.dirname(self.new)).st_mode), 0o700)
                os.remove(self.new)

    def test_newest_earlier_name_wins(self):
        self.make(self.earlier, "new-name")
        self.make(self.old, "old-name")
        with mock.patch("sys.stderr", new_callable=io.StringIO) as err:
            con = store.open_store()
        self.assertEqual(self.keys(con), ["new-name"])
        con.close()
        self.assertTrue(os.path.exists(self.old))
        self.assertIn(f"{self.old} also exists and was not moved", err.getvalue())

    def test_other_disk_creates_no_store(self):
        self.make(self.earlier, "u1")
        with mock.patch("os.replace", side_effect=OSError(errno.EXDEV, "Invalid cross-device link")), \
                self.assertRaises(store.StoreNotMoved) as cm:
            store.open_store()
        self.assertFalse(os.path.exists(self.new))
        self.assertTrue(os.path.exists(self.earlier))
        msg = str(cm.exception)
        for part in (self.earlier, self.new, "by hand", "--db"):
            self.assertIn(part, msg)

    def test_other_errors_raise(self):
        self.make(self.earlier, "u1")
        with mock.patch("os.replace", side_effect=PermissionError(errno.EACCES, "denied")), self.assertRaises(PermissionError):
            store.open_store()

    def test_moves_write_ahead_log(self):
        # A process that exits without a checkpoint leaves its last insert only in claude.duckdb.wal.
        script = ("import duckdb, os, sys; from ai_ledger import store; "
                  "c = store.open_store(sys.argv[1]); c.execute(\"SET checkpoint_threshold = '10GB'\"); "
                  "c.execute(\"INSERT INTO raw_lines (key, json) VALUES ('u1', '{}')\"); os._exit(0)")
        subprocess.run([sys.executable, "-c", script, self.old], check=True)
        self.assertTrue(os.path.exists(self.old + ".wal"))
        con = store.open_store()
        self.assertEqual(self.keys(con), ["u1"])
        con.close()
        self.assertFalse(os.path.exists(self.old + ".wal"))

    def test_finishes_move_stopped_before_log(self):
        self.make(self.old, "u1")
        open(self.old + ".wal", "wb").close()
        os.makedirs(os.path.dirname(self.new))
        os.replace(self.old, self.new)  # as if the process died between the two moves
        store.open_store().close()
        self.assertFalse(os.path.exists(self.old + ".wal"))

    def test_both_stores_keep_new_and_leave_earlier(self):
        self.make(self.earlier, "old")
        self.make(self.new, "new")
        with mock.patch("sys.stderr", new_callable=io.StringIO) as err:
            con = store.open_store()
        self.assertEqual(self.keys(con), ["new"])
        con.close()
        self.assertIn(f"{self.earlier} also exists and was not moved", err.getvalue())
        con = store.open_store(self.earlier)
        self.assertEqual(self.keys(con), ["old"])
        con.close()

    def test_explicit_path_moves_nothing(self):
        self.make(self.old, "u1")
        other = os.path.join(self.data, "other.duckdb")
        store.open_store(other).close()
        self.assertTrue(os.path.exists(self.old))
        self.assertFalse(os.path.exists(self.new))

    def test_no_checkout_moves_nothing(self):
        self.make(self.earlier, "u1")
        with mock.patch.object(store, "EARLIER_DBS", []):
            store.open_store().close()
        self.assertTrue(os.path.exists(self.earlier))
        self.assertTrue(os.path.exists(self.new))  # a new, empty store


class LimitStoreTest(StoreCase):
    def test_reset_jitter_is_one_window(self):
        def at(s):
            return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)
        store.write_snapshots(self.con.cursor(), [
            store.snapshot("claude", "weekly_all", "", 10080, at("2026-11-08T05:00:00.355791"), "2026-11-06 15:00:00", 57),
            store.snapshot("claude", "weekly_all", "", 10080, at("2026-11-08T04:59:59.855048"), "2026-11-06 15:05:00", 58)])
        self.assertEqual(self.q("SELECT DISTINCT resets_at FROM limit_snapshots"), [(datetime(2026, 11, 8, 5, 0),)])


class UsageDataStoreTest(StoreCase):
    def test_usage_data_failure_keeps_transcript_ingest(self):
        self.write("a.jsonl", line(type="user", uuid="u1", sessionId="s1"))
        with mock.patch("ai_ledger.insights.ingest", side_effect=RuntimeError("SENTINEL-facet-text")), \
                mock.patch("sys.stderr", new_callable=io.StringIO) as err:
            stats = store.ingest(self.con, dict(self.roots, insights=self.tmp))
        self.assertEqual((stats["files"], stats["usage_files"], stats["usage_skipped"]), (1, 0, 1))
        self.assertEqual(self.count(), 1)
        self.assertIn("RuntimeError", err.getvalue())
        self.assertNotIn("SENTINEL", err.getvalue())


class ChangedSessionsTest(StoreCase):
    def test_reports_sessions_that_gained_lines(self):
        self.write("a.jsonl", line(type="user", uuid="u1", sessionId="s1"))
        self.write("b.jsonl", line(type="user", uuid="v1", sessionId="s2"))
        self.assertEqual(store.ingest(self.con, self.roots)["sessions"], {"s1", "s2"})
        self.write("a.jsonl", line(type="user", uuid="u2", sessionId="s1") + line(type="user", uuid="u3", sessionId="s1"))
        self.assertEqual(store.ingest(self.con, self.roots)["sessions"], {"s1"})
        self.assertEqual(store.ingest(self.con, self.roots)["sessions"], set())

    def test_repeated_lines_change_nothing(self):
        self.write("a.jsonl", line(type="user", uuid="u1", sessionId="s1"))
        store.ingest(self.con, self.roots)
        self.write("a.jsonl", line(type="user", uuid="u1", sessionId="s1"))  # a line already stored
        self.assertEqual(store.ingest(self.con, self.roots)["sessions"], set())

    def test_usage_false_skips_usage_data(self):
        with mock.patch.object(store.insights, "ingest", return_value=dict(usage_files=0, usage_skipped=0)) as usage:
            store.ingest(self.con, self.roots, usage=False)
            usage.assert_not_called()
            store.ingest(self.con, self.roots)
            usage.assert_called_once()


if __name__ == "__main__":
    unittest.main()
