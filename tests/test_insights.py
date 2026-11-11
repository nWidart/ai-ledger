"""Claude Code /insights data: reading usage-data files, deriving facets and session meta, and the Insights payload.
Every facet here is synthetic (tests/fixtures/usage-data and the helpers below)."""
import contextlib
import io
import json
import os
import shutil
import subprocess
import tempfile
import unittest
from datetime import date
from unittest import mock

from ai_ledger import insights, store

FIXTURES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "usage-data")
SENTINEL = "SENTINEL-facet-text"
A = "0000aaaa-0000-4000-8000-00000000000"  # the fixture session ids: A + "1" to A + "4"
TODAY = date(2026, 11, 6)


def facet(sid, outcome="fully_achieved", friction=None, goals=None, satisfaction=None, helpfulness="very_helpful",
          session_type="single_task", summary="Synthetic summary", detail=""):
    return dict(session_id=sid, underlying_goal="Synthetic goal", goal_categories=goals or {}, outcome=outcome,
                user_satisfaction_counts=satisfaction or {}, claude_helpfulness=helpfulness, session_type=session_type,
                friction_counts=friction or {}, friction_detail=detail, primary_success="Synthetic success", brief_summary=summary)


def meta(sid, path, start, times=()):
    return dict(session_id=sid, project_path=path, start_time=start, duration_minutes=10, lines_added=5, lines_removed=1,
                files_modified=1, git_pushes=0, languages=dict(Python=1), user_response_times=list(times),
                destructive_command_count=0, bash_would_prompt_count=0, first_prompt="Synthetic prompt")


class InsightsCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.usage = os.path.join(self.tmp, "usage-data")
        shutil.copytree(FIXTURES, self.usage)
        self.roots = dict(claude=os.path.join(self.tmp, "projects"), codex=os.path.join(self.tmp, "codex"), insights=self.usage)
        self.db = os.path.join(self.tmp, "data", "x.duckdb")
        self.con = store.open_store(self.db)
        store.unreadable.clear()

    def tearDown(self):
        self.con.close()
        shutil.rmtree(self.tmp)
        store.unreadable.clear()

    def q(self, sql, *args):
        return self.con.execute(sql, list(args)).fetchall()

    def ingest(self):
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            stats = store.ingest(self.con, self.roots)
        return stats, err.getvalue()

    def put(self, sub, name, obj, text=None):
        p = os.path.join(self.usage, sub, name)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        st = os.stat(p) if os.path.exists(p) else None
        with open(p, "w") as fh:
            fh.write(text if text is not None else json.dumps(obj))
        if st:  # a rewrite in the same second must still look changed
            os.utime(p, (st.st_atime, st.st_mtime + 5))
        return p

    def session(self, sid, project, first_ts, source="claude"):
        store.insert(self.con.cursor(), "sessions", ["session_id", "project", "first_ts", "last_ts", "source"],
                     [(sid, project, first_ts, first_ts, source)])

    def payload(self, **kw):
        return insights.payload(self.con.cursor(), today=TODAY, usage_dir=self.usage, **kw)


class FixtureTest(unittest.TestCase):
    def test_fixtures_parse_as_intended(self):
        def load(n):
            with open(os.path.join(FIXTURES, "facets", n)) as fh:
                return json.load(fh)
        ok = {n: load(n)["outcome"] for n in sorted(os.listdir(os.path.join(FIXTURES, "facets")))
              if n not in (A + "4.json", "no-session-id.json")}
        self.assertEqual(ok, {A + "1.json": "fully_achieved", A + "2.json": "partially_achieved", A + "3.json": "abandoned"})
        with self.assertRaises(ValueError):
            load(A + "4.json")
        self.assertNotIn("session_id", load("no-session-id.json"))
        self.assertTrue(os.path.exists(os.path.join(FIXTURES, "report.html")))

    def test_no_real_session_id(self):
        real = os.path.expanduser("~/.claude/usage-data")
        if not os.path.isdir(real):
            self.skipTest("no usage-data directory")
        names = {os.path.splitext(n)[0] for d in ("facets", "session-meta") if os.path.isdir(os.path.join(real, d))
                 for n in os.listdir(os.path.join(real, d))}
        mine = {A + str(i) for i in range(1, 5)}
        for root, _, fs in os.walk(FIXTURES):
            for n in fs:
                with open(os.path.join(root, n)) as fh:
                    mine |= {x for x in names if x in fh.read()}
        self.assertEqual(mine & names, set())


class IngestTest(InsightsCase):
    def test_first_ingest_stores_facets_and_meta_and_skips_bad_files(self):
        stats, err = self.ingest()
        self.assertEqual((stats["usage_files"], stats["usage_skipped"]), (6, 2))
        self.assertEqual(self.q("SELECT kind, count(*) FROM usage_files GROUP BY 1 ORDER BY 1"), [("facet", 3), ("meta", 3)])
        with open(os.path.join(FIXTURES, "facets", A + "2.json")) as fh:
            self.assertEqual(self.q("SELECT json FROM usage_files WHERE path LIKE ?", f"%facets/{A}2.json")[0][0], fh.read())
        self.assertEqual(self.q("SELECT count(*) FROM usage_files WHERE path LIKE '%report%'")[0][0], 0)
        self.assertEqual(self.q("SELECT count(*) FROM session_facets")[0][0], 3)
        self.assertIn("no-session-id.json", err)

    def test_second_ingest_reads_nothing(self):
        self.ingest()
        stats, _ = self.ingest()
        self.assertEqual((stats["usage_files"], stats["usage_skipped"]), (0, 0))

    def test_rewritten_facet_replaces_its_row(self):
        self.ingest()
        self.put("facets", A + "2.json", facet(A + "2", outcome="fully_achieved"))
        stats, _ = self.ingest()
        self.assertEqual(stats["usage_files"], 1)
        self.assertEqual(self.q("SELECT outcome FROM session_facets WHERE session_id = ?", A + "2"), [("fully_achieved",)])
        self.assertEqual(self.q("SELECT count(*) FROM usage_files WHERE session_id = ? AND kind = 'facet'", A + "2")[0][0], 1)

    def test_fixed_malformed_file_is_stored_next_time(self):
        self.ingest()
        self.put("facets", A + "4.json", facet(A + "4"))
        stats, _ = self.ingest()
        self.assertEqual((stats["usage_files"], stats["usage_skipped"]), (1, 0))
        self.assertEqual(self.q("SELECT count(*) FROM session_facets WHERE session_id = ?", A + "4")[0][0], 1)

    def test_missing_directory_gives_zero_counts(self):
        shutil.rmtree(self.usage)
        stats, err = self.ingest()
        self.assertEqual((stats["usage_files"], stats["usage_skipped"]), (0, 0))
        self.assertEqual(err, "")

    def test_deleted_file_keeps_its_row(self):
        self.ingest()
        shutil.rmtree(os.path.join(self.usage, "facets"))
        self.ingest()
        self.assertEqual(self.q("SELECT count(*) FROM session_facets")[0][0], 3)
        self.assertEqual(self.q("SELECT count(*) FROM usage_files WHERE kind = 'facet'")[0][0], 3)

    def test_logs_hold_paths_never_content(self):
        lines = []
        err = io.StringIO()
        with contextlib.redirect_stderr(err), contextlib.redirect_stdout(io.StringIO()) as out:
            store.ingest(self.con, self.roots, log=lines.append)
        text = "\n".join(lines) + err.getvalue() + out.getvalue()
        self.assertIn(A + "2.json", text)
        self.assertIn(A + "4.json", text)
        self.assertNotIn(SENTINEL, text)
        self.assertNotIn("SENTINEL", text)


class DeriveTest(InsightsCase):
    def counts(self, sid):
        return self.q("SELECT kind, name, n FROM facet_counts WHERE session_id = ? ORDER BY 1, 2", sid)

    def test_rewritten_facet_leaves_no_stale_counts(self):
        self.ingest()
        self.assertEqual([r for r in self.counts(A + "2") if r[0] == "friction"], [("friction", "buggy_code", 1), ("friction", "wrong_approach", 3)])
        self.put("facets", A + "2.json", facet(A + "2", friction=dict(environment=2)))
        self.ingest()
        self.assertEqual(self.counts(A + "2"), [("friction", "environment", 2)])

    def test_non_integer_count_dropped(self):
        self.put("facets", A + "5.json", facet(A + "5", friction=dict(a=2, b="3", c=1.5, d=True, e=0, f=-1)))
        self.ingest()
        self.assertEqual(self.counts(A + "5"), [("friction", "a", 2)])

    def test_median_response_time_stored_not_the_list(self):
        self.ingest()
        self.assertEqual(self.q("SELECT response_p50_s FROM session_meta WHERE session_id = ?", A + "1"), [(10.0,)])
        self.assertEqual(self.q("SELECT response_p50_s FROM session_meta WHERE session_id = ?", A + "2"), [(5.0,)])
        self.assertEqual(self.q("SELECT response_p50_s FROM session_meta WHERE session_id = ?", A + "3"), [(None,)])
        cols = {r[0] for r in self.q("SELECT column_name FROM information_schema.columns WHERE table_name = 'session_meta'")}
        self.assertNotIn("user_response_times", cols)
        self.assertEqual(self.q("SELECT lines_added, lines_removed, files_modified, git_pushes, languages, permission_mode FROM session_meta "
                                "WHERE session_id = ?", A + "2"), [(120, 30, 4, 1, '{"TypeScript": 4}', "acceptEdits")])


class ProjectTest(InsightsCase):
    def project_of(self, sid):
        return next(r["project"] for r in self.payload()["sessions"] if r["session_id"] == sid)

    def test_stored_session_project_wins(self):
        self.session(A + "1", "atlas", "2026-11-03 09:00:00")
        self.ingest()
        self.assertEqual(self.project_of(A + "1"), "atlas")
        self.assertTrue(next(r for r in self.payload()["sessions"] if r["session_id"] == A + "1")["in_store"])

    def test_worktree_layout_without_transcript(self):
        self.ingest()
        self.assertEqual(self.project_of(A + "2"), "demo-app")  # .../demo-app/.claude/worktrees/flaky-date
        self.assertEqual(self.project_of(A + "3"), "sketchbook")

    def test_git_worktree_maps_to_its_repository(self):
        repo, wt = os.path.join(self.tmp, "repos", "ledger"), os.path.join(self.tmp, "repos", "ledger-feature")
        os.makedirs(repo)
        git = lambda *a: subprocess.run(["git", *a], cwd=repo, check=True, capture_output=True)
        git("init", "-q")
        git("-c", "user.email=t@example.com", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "x")
        git("worktree", "add", "-q", wt)
        self.put("session-meta", A + "6.json", meta(A + "6", wt, "2026-11-04T10:00:00.000Z"))
        self.put("facets", A + "6.json", facet(A + "6"))
        with mock.patch.object(store, "TEMP_PREFIXES", ()):  # the test's repository lives in a temp folder
            self.ingest()
        self.assertEqual(self.project_of(A + "6"), "ledger")

    def test_neither_counts_as_unknown(self):
        self.put("facets", A + "7.json", facet(A + "7"))
        self.ingest()
        self.assertEqual(self.project_of(A + "7"), "(unknown)")


class RebuildTest(InsightsCase):
    def test_rebuild_without_the_directory_gives_the_same_rows(self):
        self.ingest()
        tables = ("session_facets", "facet_counts", "session_meta")
        rows = lambda: {t: sorted(self.q(f"SELECT * FROM {t}"), key=str) for t in tables}
        before = rows()
        shutil.rmtree(self.usage)
        store.rebuild(self.con)
        self.assertEqual(rows(), before)
        self.assertTrue(before["session_facets"])


class PayloadTest(InsightsCase):
    def mix(self):
        """150 facets: 117 fully, 24 mostly, 7 partially, 1 not achieved, 1 unclear; all in the store under project foo."""
        outcomes = ["fully_achieved"] * 117 + ["mostly_achieved"] * 24 + ["partially_achieved"] * 7 + ["not_achieved", "unclear_from_transcript"]
        for i, o in enumerate(outcomes):
            sid = f"0000bbbb-0000-4000-8000-{i:012d}"
            self.session(sid, "foo", f"2026-11-0{1 + i % 5} 10:00:00")
            self.put("facets", sid + ".json", facet(sid, outcome=o, helpfulness=["very_helpful", "essential", "moderately_helpful"][min(i % 10, 2)]))

    def test_outcome_mix(self):
        shutil.rmtree(os.path.join(self.usage, "facets"))
        self.mix()
        self.ingest()
        d = self.payload()
        n = d["coverage"]["facets"]
        self.assertEqual(n, 150)
        self.assertEqual([(o["name"], o["n"], round(100 * o["n"] / n)) for o in d["outcomes"]],
                         [("fully_achieved", 117, 78), ("mostly_achieved", 24, 16), ("partially_achieved", 7, 5),
                          ("not_achieved", 1, 1), ("unclear_from_transcript", 1, 1)])

    def test_unknown_outcome_kept(self):
        self.ingest()
        self.assertEqual(self.payload()["outcomes"][-1], dict(name="abandoned", n=1))

    def test_satisfaction_summed(self):
        self.put("facets", A + "5.json", facet(A + "5", satisfaction=dict(satisfied=1, dissatisfied=2)))
        self.ingest()
        got = {r["name"]: (r["n"], r["sessions"]) for r in self.payload()["satisfaction"]}
        self.assertEqual(got, dict(satisfied=(2, 2), likely_satisfied=(2, 1), dissatisfied=(3, 2), unclear=(1, 1)))

    def test_helpfulness_in_fixed_order(self):
        self.ingest()
        self.assertEqual([(r["name"], r["n"]) for r in self.payload()["helpfulness"]],
                         [("essential", 1), ("very_helpful", 0), ("moderately_helpful", 1), ("slightly_helpful", 1), ("unhelpful", 0)])

    def test_friction_ranked_with_sessions(self):
        self.ingest()
        self.assertEqual(self.payload()["friction"], [dict(name="buggy_code", n=3, sessions=2), dict(name="wrong_approach", n=3, sessions=1)])

    def test_goals_and_session_types(self):
        self.ingest()
        d = self.payload()
        self.assertEqual(d["goals"][0], dict(name="fix_bug", n=2, sessions=1))
        self.assertEqual({g["name"] for g in d["goals"]}, {"fix_bug", "write_tests", "implement_feature", "explore_idea"})
        self.assertEqual([(t["name"], t["n"]) for t in d["session_types"]],
                         [("multi_task", 0), ("iterative_refinement", 1), ("single_task", 1), ("quick_question", 1)])

    def test_filters_narrow_every_list(self):
        self.session(A + "1", "observer-sessions", "2026-11-03 09:00:00")
        self.ingest()
        d = self.payload()
        self.assertEqual({r["project"] for r in d["sessions"]}, {"demo-app", "sketchbook"})  # automated left out
        self.assertEqual(len(self.payload(automated=True)["sessions"]), 3)
        d = self.payload(project="demo-app")
        self.assertEqual([r["session_id"] for r in d["sessions"]], [A + "2"])
        self.assertEqual([f["name"] for f in d["friction"]], ["wrong_approach", "buggy_code"])
        self.assertEqual(sum(o["n"] for o in d["outcomes"]), 1)
        d = self.payload(range_days=2)  # Nov 5 and 6: only the sketchbook session
        self.assertEqual([r["session_id"] for r in d["sessions"]], [A + "3"])
        self.assertEqual(d["friction"], [dict(name="buggy_code", n=2, sessions=1)])
        self.assertEqual(d["goals"], [dict(name="explore_idea", n=1, sessions=1)])

    def test_orphans_listed_without_link(self):
        self.session(A + "1", "demo-app", "2026-11-03 09:00:00")
        self.ingest()
        d = self.payload()
        self.assertEqual([(r["session_id"], r["in_store"]) for r in d["sessions"]], [(A + "3", False), (A + "2", False), (A + "1", True)])
        self.assertEqual((d["coverage"]["analysed"], d["coverage"]["orphans"]), (1, 2))
        r = d["sessions"][1]
        self.assertEqual((r["outcome"], r["friction"], r["goals"], r["start"]), ("partially_achieved", ["wrong_approach", "buggy_code"],
                                                                                 ["fix_bug", "write_tests"], "2026-11-04T14:30:00.000Z"))

    def test_coverage_counts_claude_and_codex_apart(self):
        self.session(A + "1", "demo-app", "2026-11-03 09:00:00")
        self.session("c1", "demo-app", "2026-11-03 10:00:00")
        self.session("c2", "demo-app", "2026-11-03 11:00:00")
        self.session("x1", "demo-app", "2026-11-03 12:00:00", source="codex")
        self.ingest()
        c = self.payload()["coverage"]
        self.assertEqual((c["claude_sessions"], c["analysed"], c["not_analysed"], c["codex_sessions"]), (3, 1, 2, 1))
        self.assertEqual(c["dir"], self.usage)
        self.assertEqual(c["stored_facets"], 3)
        self.assertTrue(c["newest_facet"].endswith("Z"))

    def test_codex_source_returns_coverage_only(self):
        self.session("x1", "demo-app", "2026-11-03 12:00:00", source="codex")
        self.ingest()
        d = self.payload(source="codex")
        self.assertEqual(d["coverage"]["codex_sessions"], 1)
        self.assertEqual(d["coverage"]["claude_sessions"], 0)
        for k in ("outcomes", "helpfulness", "session_types", "satisfaction", "friction", "goals", "sessions"):
            self.assertEqual(d[k], [], k)

    def test_unknown_source_raises(self):
        with self.assertRaises(ValueError):
            self.payload(source="grok")

    def test_goal_and_success_text_not_sent(self):
        self.ingest()
        text = json.dumps(self.payload(), default=str)
        self.assertNotIn("underlying_goal", text)
        self.assertNotIn("primary_success", text)
        self.assertNotIn("The toggle shipped with tests", text)

    def test_no_facets(self):
        d = self.payload()
        self.assertEqual((d["coverage"]["stored_facets"], d["coverage"]["newest_facet"], d["outcomes"]), (0, None, []))


if __name__ == "__main__":
    unittest.main()
