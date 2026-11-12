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
from datetime import date, timedelta
from unittest import mock

from ai_ledger import insights, metrics, store

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
        store.insert(self.con.cursor(), "prompts", ["prompt_id", "session_id", "ts"], [(f"p-{sid}", sid, first_ts)])

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

    def test_families_group_raw_rows(self):
        self.put("facets", A + "5.json", facet(A + "5", goals=dict(create_pull_request=2, open_pr=1, fix_bug=1),
                                                friction=dict(broken_build=1, buggy_code=2, mood=1)))
        self.put("facets", A + "6.json", facet(A + "6", goals=dict(open_pr=3), friction=dict(broken_build=1)))
        self.ingest()
        d = self.payload()
        self.assertEqual(d["goals"][0], dict(name="open_pr", n=4, sessions=2))  # the raw rows stay
        pr = next(f for f in d["goal_families"] if f["family"] == "pull_request")
        self.assertEqual(pr, dict(family="pull_request", n=6, sessions=2, members=[dict(name="open_pr", n=4, sessions=2),
                                                                                  dict(name="create_pull_request", n=2, sessions=1)]))
        bug = next(f for f in d["friction_families"] if f["family"] == "buggy_code")  # A5 carries two members: 4 sessions, not 3 + 2
        self.assertEqual((bug["n"], bug["sessions"], [m["name"] for m in bug["members"]]), (7, 4, ["buggy_code", "broken_build"]))
        self.assertEqual([f["family"] for f in d["friction_families"]], ["buggy_code", "wrong_approach", "mood"])
        self.assertEqual(sum(f["n"] for f in d["goal_families"]), sum(g["n"] for g in d["goals"]))
        self.assertEqual([f["family"] for f in d["goal_families"]][:2], ["pull_request", "fix_bug"])

    def test_families_follow_the_view(self):
        self.ingest()
        d = self.payload(range_days=2)  # only the sketchbook session
        self.assertEqual(d["friction_families"], [dict(family="buggy_code", n=2, sessions=1, members=[dict(name="buggy_code", n=2, sessions=1)])])
        self.assertEqual(d["goal_families"], [dict(family="research", n=1, sessions=1, members=[dict(name="explore_idea", n=1, sessions=1)])])

    def test_families_empty_without_facets(self):
        self.ingest()
        d = self.payload(project="nope")
        self.assertEqual((d["goals"], d["friction"], d["goal_families"], d["friction_families"]), ([], [], [], []))
        d = self.payload(source="codex")
        self.assertEqual((d["goal_families"], d["friction_families"]), ([], []))

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

    def test_coverage_leaves_automated_sessions_out(self):
        self.session(A + "1", "observer-sessions", "2026-11-03 09:00:00")
        self.session("c1", "observer-sessions", "2026-11-03 10:00:00")
        self.session("c2", "demo-app", "2026-11-03 11:00:00")
        self.ingest()
        for auto in (False, True):
            c = self.payload(automated=auto)["coverage"]
            self.assertEqual((c["claude_sessions"], c["analysed"], c["not_analysed"]), (1, 0, 1), auto)
        c = self.payload(project="observer-sessions")["coverage"]  # named, it counts
        self.assertEqual((c["claude_sessions"], c["analysed"], c["not_analysed"]), (2, 1, 1))

    def test_sessions_carry_their_title(self):
        self.session(A + "1", "demo-app", "2026-11-03 09:00:00")
        store.insert(self.con.cursor(), "session_titles", ["session_id", "custom", "agent"], [(A + "1", None, "Synthetic title")])
        self.ingest()
        self.assertEqual({r["session_id"]: r["title"] for r in self.payload()["sessions"]}, {A + "1": "Synthetic title", A + "2": None, A + "3": None})

    def test_codex_source_returns_coverage_only(self):
        self.session("x1", "demo-app", "2026-11-03 12:00:00", source="codex")
        self.ingest()
        d = self.payload(source="codex")
        self.assertEqual(d["coverage"]["codex_sessions"], 1)
        self.assertEqual(d["coverage"]["claude_sessions"], 0)
        for k in ("outcomes", "helpfulness", "session_types", "satisfaction", "friction", "goals", "goal_families", "friction_families", "sessions"):
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

    def test_session_payload_carries_its_insight(self):
        self.session(A + "2", "demo-app", "2026-11-03 09:00:00")
        self.ingest()
        got = metrics.session(self.con.cursor(), A + "2", prices={})["insight"]
        self.assertEqual(got, dict(
            outcome="partially_achieved", helpfulness="moderately_helpful", session_type="iterative_refinement",
            brief_summary="Synthetic: chased a flaky date test. SENTINEL-facet-text",
            friction_detail="Synthetic: patched the wrong time zone helper first. SENTINEL-facet-text",
            goals=["fix_bug", "write_tests"], friction=["wrong_approach", "buggy_code"], satisfaction=["likely_satisfied", "dissatisfied"]))
        row = next(r for r in self.payload()["sessions"] if r["session_id"] == A + "2")  # the Insights page's row says the same
        self.assertEqual(got, {k: row[k] for k in got})

    def test_session_payload_without_a_facet_has_no_insight(self):
        self.session("c1", "demo-app", "2026-11-03 10:00:00")
        self.session("x1", "demo-app", "2026-11-03 12:00:00", source="codex")
        self.ingest()
        for sid in ("c1", "x1"):
            self.assertIsNone(metrics.session(self.con.cursor(), sid, prices={})["insight"], sid)

    def test_session_insight_leaves_goal_and_success_text_out(self):
        self.session(A + "1", "demo-app", "2026-11-03 09:00:00")
        self.ingest()
        text = json.dumps(metrics.session(self.con.cursor(), A + "1", prices={}), default=str)
        self.assertNotIn("underlying_goal", text)
        self.assertNotIn("primary_success", text)
        self.assertNotIn("The toggle shipped with tests", text)

    def test_no_facets(self):
        d = self.payload()
        self.assertEqual((d["coverage"]["stored_facets"], d["coverage"]["newest_facet"], d["outcomes"]), (0, None, []))


class CoverageBreakdownTest(InsightsCase):
    """coverage.by_project and coverage.runs. The fixture facets are A1 to A3; file_mtime is set per test."""

    def mtimes(self, *stamps):
        for sid, ts in zip((A + "1", A + "2", A + "3"), stamps):
            self.con.execute("UPDATE session_facets SET file_mtime = ? WHERE session_id = ?", [ts, sid])

    def projects(self, **kw):
        return self.payload(**kw)["coverage"]["by_project"]

    def runs(self, **kw):
        return self.payload(**kw)["coverage"]["runs"]

    def test_by_project_lists_each_project_busiest_first_then_by_name(self):
        for i in range(3):
            self.session(f"b{i}", "busy", "2026-11-03 10:00:00")
        self.session(A + "1", "demo-app", "2026-11-03 09:00:00")
        self.session("c1", "demo-app", "2026-11-03 10:00:00")
        self.session("z1", "zeta", "2026-11-03 10:00:00")
        self.session("a1", "alpha", "2026-11-03 10:00:00")
        self.ingest()
        d = self.payload()
        self.assertEqual(d["coverage"]["by_project"], [dict(project="busy", sessions=3, analysed=0), dict(project="demo-app", sessions=2, analysed=1),
                                                       dict(project="alpha", sessions=1, analysed=0), dict(project="zeta", sessions=1, analysed=0)])
        self.assertEqual(sum(r["sessions"] for r in d["coverage"]["by_project"]), d["coverage"]["claude_sessions"])
        self.assertEqual(sum(r["analysed"] for r in d["coverage"]["by_project"]), d["coverage"]["analysed"])

    def test_by_project_keeps_every_project_without_a_cap(self):
        for i in range(30):
            self.session(f"s{i}", f"proj-{i:02d}", "2026-11-03 10:00:00")
        self.ingest()
        self.assertEqual(len(self.projects()), 30)

    def test_by_project_follows_the_view_and_leaves_automated_and_codex_out(self):
        self.session(A + "1", "demo-app", "2026-11-03 09:00:00")
        self.session("old", "demo-app", "2026-09-01 09:00:00")
        self.session("o1", "observer-sessions", "2026-11-03 10:00:00")
        self.session("x1", "demo-app", "2026-11-03 12:00:00", source="codex")
        self.ingest()
        for auto in (False, True):
            self.assertEqual(self.projects(range_days=7, automated=auto), [dict(project="demo-app", sessions=1, analysed=1)], auto)
        self.assertEqual(self.projects(), [dict(project="demo-app", sessions=2, analysed=1)])
        self.assertEqual(self.projects(project="observer-sessions"), [dict(project="observer-sessions", sessions=1, analysed=0)])  # named, it counts
        self.assertEqual(self.projects(source="claude"), self.projects())

    def test_codex_source_and_an_empty_store_give_no_breakdown(self):
        self.session("x1", "demo-app", "2026-11-03 12:00:00", source="codex")
        self.assertEqual(self.payload()["coverage"]["runs"], [])
        self.assertEqual(self.payload()["coverage"]["by_project"], [])  # no stored facets
        self.ingest()
        d = self.payload(source="codex")["coverage"]
        self.assertEqual((d["by_project"], d["runs"]), ([], []))

    def test_facets_within_an_hour_of_each_other_are_one_run(self):
        self.ingest()
        self.mtimes("2026-11-05 10:00:00", "2026-11-05 10:30:00", "2026-11-05 11:30:00")  # a gap of exactly one hour stays in the run
        self.assertEqual(self.runs(), [dict(at="2026-11-05T11:30:00.000Z", facets=3)])

    def test_a_gap_over_an_hour_starts_a_new_run_newest_first(self):
        self.ingest()
        self.mtimes("2026-11-05 10:00:00", "2026-11-05 11:00:00", "2026-11-06 12:00:00")
        self.assertEqual(self.runs(), [dict(at="2026-11-06T12:00:00.000Z", facets=1), dict(at="2026-11-05T11:00:00.000Z", facets=2)])
        self.mtimes("2026-11-05 10:00:00", "2026-11-05 11:00:00", "2026-11-05 12:00:01")
        self.assertEqual([r["facets"] for r in self.runs()], [1, 2])

    def test_a_run_counts_only_its_facets_in_the_view_and_keeps_its_identity(self):
        self.session(A + "1", "p1", "2026-11-03 09:00:00")
        self.session(A + "2", "p2", "2026-11-03 09:00:00")
        self.session(A + "3", "p3", "2026-11-03 09:00:00")
        self.ingest()
        self.mtimes("2026-11-05 10:00:00", "2026-11-05 10:30:00", "2026-11-06 12:00:00")
        self.assertEqual(self.runs(), [dict(at="2026-11-06T12:00:00.000Z", facets=1), dict(at="2026-11-05T10:30:00.000Z", facets=2)])
        self.assertEqual(self.runs(project="p2"), [dict(at="2026-11-05T10:30:00.000Z", facets=1)])  # the run of p1 and p2 keeps its end
        self.assertEqual(self.runs(project="p3"), [dict(at="2026-11-06T12:00:00.000Z", facets=1)])
        self.assertEqual(self.runs(project="nope"), [])  # a run with no facet in the view is left out

    def test_runs_leave_automated_sessions_out(self):
        self.session(A + "1", "observer-sessions", "2026-11-03 09:00:00")
        self.session(A + "2", "demo-app", "2026-11-03 09:00:00")
        self.ingest()
        self.mtimes("2026-11-05 10:00:00", "2026-11-05 10:30:00", "2026-11-05 10:40:00")
        for auto in (False, True):
            self.assertEqual([r["facets"] for r in self.runs(automated=auto)], [2], auto)  # A2 and the orphan A3

    def test_undated_facets_are_left_out_of_the_runs(self):
        self.session(A + "1", "p1", "2026-11-03 09:00:00")
        self.session(A + "2", "p2", "2026-11-03 09:00:00")
        self.ingest()
        self.mtimes("2026-11-05 10:00:00", None, "2026-11-05 10:30:00")
        self.assertEqual(self.runs(), [dict(at="2026-11-05T10:30:00.000Z", facets=2)])  # A1 and A3; A2 has no time
        self.assertEqual(self.runs(project="p1"), [dict(at="2026-11-05T10:30:00.000Z", facets=1)])
        self.assertEqual(self.runs(project="p2"), [])  # its only facet is undated

    def test_runs_stop_at_twenty(self):
        self.ingest()
        self.con.execute("INSERT INTO session_facets (session_id, file_mtime) SELECT 'extra-' || i, TIMESTAMP '2026-10-01 00:00:00' + i * INTERVAL 1 DAY "
                         "FROM range(30) t(i)")
        self.mtimes("2026-09-01 00:00:00", "2026-09-02 00:00:00", "2026-09-03 00:00:00")
        runs = self.runs()
        self.assertEqual((len(runs), insights.RUNS), (20, 20))
        self.assertEqual(runs[0]["at"], "2026-10-30T00:00:00.000Z")
        self.assertEqual(runs[-1]["at"], "2026-10-11T00:00:00.000Z")


class RunSizesTest(InsightsCase):
    """coverage.run_sizes: the sizes of the newest 20 runs over the whole store."""

    def sizes(self, **kw):
        return self.payload(**kw)["coverage"]["run_sizes"]

    def stamp(self, *stamps):
        for sid, ts in zip((A + "1", A + "2", A + "3"), stamps):
            self.con.execute("UPDATE session_facets SET file_mtime = ? WHERE session_id = ?", [ts, sid])

    def test_one_run(self):
        self.ingest()
        self.stamp("2026-11-05 10:00:00", "2026-11-05 10:10:00", "2026-11-05 10:20:00")
        self.assertEqual(self.sizes(), dict(runs=1, min=3, median=3, max=3))

    def test_several_runs(self):
        self.ingest()
        self.con.execute("INSERT INTO session_facets (session_id, file_mtime) VALUES ('x1', TIMESTAMP '2026-11-01 10:00:00')")
        self.stamp("2026-11-05 10:00:00", "2026-11-05 10:10:00", "2026-11-06 12:00:00")
        self.assertEqual(self.sizes(), dict(runs=3, min=1, median=1, max=2))
        self.con.execute("INSERT INTO session_facets (session_id, file_mtime) VALUES ('x2', TIMESTAMP '2026-11-06 12:05:00')")
        self.assertEqual(self.sizes(), dict(runs=3, min=1, median=2, max=2))

    def test_none_without_a_dated_facet(self):
        self.assertIsNone(self.sizes())
        self.ingest()
        self.stamp(None, None, None)
        self.assertIsNone(self.sizes())

    def test_filters_do_not_change_it(self):
        self.session(A + "1", "p1", "2026-11-03 09:00:00")
        self.ingest()
        self.stamp("2026-11-05 10:00:00", "2026-11-05 10:10:00", "2026-11-06 12:00:00")
        want = dict(runs=2, min=1, median=1.5, max=2)
        for kw in ({}, dict(project="p1"), dict(project="nope"), dict(range_days=1), dict(automated=True)):
            self.assertEqual(self.sizes(**kw), want, kw)

    def test_codex_source_has_none(self):
        self.ingest()
        self.assertIsNone(self.sizes(source="codex"))


class TrendTest(InsightsCase):
    """trend: the view's facets per week of session start, as [{week, n, achieved}], oldest first."""

    def setUp(self):
        super().setUp()
        for sub in ("facets", "session-meta"):  # only the facets a test adds
            shutil.rmtree(os.path.join(self.usage, sub), ignore_errors=True)

    def add(self, i, start, outcome="fully_achieved", project="p"):
        sid = f"0000cccc-0000-4000-8000-{i:012d}"
        if start:
            self.session(sid, project, start)
        self.put("facets", sid + ".json", facet(sid, outcome=outcome))

    def trend(self, **kw):
        return self.payload(**kw)["trend"]

    def test_weeks_start_on_local_monday(self):
        self.con.execute("SET GLOBAL TimeZone = 'Pacific/Auckland'")  # UTC+13 in November: local Monday 2 Nov starts at 1 Nov 11:00 UTC
        self.add(1, "2026-11-01 10:59:00")  # Sunday 23:59 local
        self.add(2, "2026-11-01 11:01:00", "mostly_achieved")  # Monday 00:01 local
        self.add(3, "2026-11-08 10:59:00", "not_achieved")  # Sunday 23:59 local
        self.add(4, "2026-11-08 11:00:00", "partially_achieved")  # Monday 00:00 local
        self.ingest()
        self.assertEqual(self.trend(), [dict(week="2026-10-26", n=1, achieved=1), dict(week="2026-11-02", n=2, achieved=1),
                                        dict(week="2026-11-09", n=1, achieved=0)])

    def test_follows_the_view(self):
        self.add(1, "2026-10-20 12:00:00", project="p1")
        self.add(2, "2026-11-03 12:00:00", project="p2")
        self.ingest()
        self.assertEqual([w["week"] for w in self.trend(project="p1")], ["2026-10-19"])
        self.assertEqual(self.trend(project="nope"), [])
        self.assertEqual([w["week"] for w in self.trend(range_days=7)], ["2026-11-02"])

    def test_keeps_the_newest_26_weeks(self):
        for i in range(30):
            self.add(i, (date(2026, 1, 5) + timedelta(weeks=i)).isoformat() + " 12:00:00")
        self.ingest()
        t = self.trend()
        self.assertEqual((len(t), t[0]["week"], t[-1]["week"]), (26, "2026-02-02", "2026-07-27"))

    def test_sessions_without_a_start_are_left_out(self):
        self.add(1, None)
        self.add(2, "2026-11-03 12:00:00")
        self.ingest()
        self.assertEqual(self.trend(), [dict(week="2026-11-02", n=1, achieved=1)])

    def test_empty_for_codex_and_without_facets(self):
        self.assertEqual(self.trend(), [])
        self.add(1, "2026-11-03 12:00:00")
        self.ingest()
        self.assertEqual(self.trend(source="codex"), [])


class SessionMetaTest(InsightsCase):
    """payload meta (the view's session figures) and each listed session's meta. Session meta is counted from the transcript,
    for more sessions than have a facet. Only the files a test adds are ingested."""

    def setUp(self):
        super().setUp()
        for sub in ("facets", "session-meta"):
            shutil.rmtree(os.path.join(self.usage, sub), ignore_errors=True)

    def add(self, i, path="/Users/example/Sites/demo-app", start="2026-11-03T09:00:00.000Z", times=(), facet_too=False, **over):
        sid = f"0000dddd-0000-4000-8000-{i:012d}"
        self.put("session-meta", sid + ".json", {**meta(sid, path, start, times), **over})
        if facet_too:
            self.put("facets", sid + ".json", facet(sid))
        return sid

    def figures(self, **kw):
        return self.payload(**kw)["meta"]

    def test_sums_treat_null_as_zero_and_count_every_row(self):
        self.add(1, lines_added=100, lines_removed=10, files_modified=3, git_pushes=1)
        self.add(2, lines_added=None, lines_removed=5, files_modified=None, git_pushes=2)
        self.ingest()
        got = self.figures()
        self.assertEqual({k: got[k] for k in ("sessions", "lines_added", "lines_removed", "files_modified", "git_pushes")},
                         dict(sessions=2, lines_added=100, lines_removed=15, files_modified=3, git_pushes=3))

    def test_duration_median_is_over_rows_with_a_duration_and_averages_the_middle_pair(self):
        for i, d in enumerate((10, 20, 30, 40)):
            self.add(i, duration_minutes=d)
        self.add(9, duration_minutes=None)
        self.ingest()
        self.assertEqual(self.figures()["duration_p50_min"], 25)
        self.add(10, duration_minutes=100)
        self.ingest()
        self.assertEqual(self.figures()["duration_p50_min"], 30)

    def test_response_time_is_the_median_of_the_session_medians(self):
        self.add(1, times=[1, 2, 3, 100])  # 2.5
        self.add(2, times=[10])  # 10
        self.add(3, times=[])  # no median: left out, not counted as 0
        self.ingest()
        self.assertEqual(self.figures()["response_p50_s"], 6.25)

    def test_medians_are_null_when_no_row_has_the_value(self):
        self.add(1, duration_minutes=None, times=[])
        self.ingest()
        got = self.figures()
        self.assertEqual((got["sessions"], got["duration_p50_min"], got["response_p50_s"]), (1, None, None))

    def test_languages_are_summed_most_counted_first_ties_by_name(self):
        self.add(1, languages=dict(Python=5, TypeScript=2, Go=2))
        self.add(2, languages=dict(Python=1, TypeScript=3, Rust=0, Zig="x", Bad=-1))
        self.add(3, languages={})
        self.ingest()
        self.assertEqual(self.figures()["languages"], [dict(name="Python", n=6, sessions=2), dict(name="TypeScript", n=5, sessions=2),
                                                       dict(name="Go", n=2, sessions=1)])

    def test_malformed_languages_text_is_skipped_without_failing_the_payload(self):
        a, b, c, d = (self.add(i, languages=dict(Python=2), lines_added=7) for i in range(4))
        self.ingest()
        for sid, text in ((b, "not json"), (c, "[1, 2]"), (d, '{"Go": "many", "Rust": true}')):
            self.con.execute("UPDATE session_meta SET languages = ? WHERE session_id = ?", [text, sid])
        got = self.figures()
        self.assertEqual((got["sessions"], got["lines_added"], got["languages"]), (4, 28, [dict(name="Python", n=2, sessions=1)]))

    def test_a_meta_row_without_a_facet_counts_and_a_facet_without_meta_does_not(self):
        self.add(1)
        sid = self.add(2, facet_too=True)
        self.put("facets", "0000dddd-0000-4000-8000-000000000003.json", facet("0000dddd-0000-4000-8000-000000000003"))
        self.ingest()
        d = self.payload()
        self.assertEqual((d["coverage"]["facets"], d["meta"]["sessions"]), (2, 2))
        self.assertEqual(self.figures(project="nope")["sessions"], 0)
        self.assertIsNotNone(next(r for r in d["sessions"] if r["session_id"] == sid)["meta"])

    def test_a_project_only_session_meta_names_is_offered_after_the_facet_only_ones(self):
        self.session("s1", "stored-app", "2026-11-03 09:00:00")
        self.add(1, path="/Users/example/Sites/meta-only-app")
        self.add(2, path="/Users/example/Sites/another-meta-app")
        self.add(3, path="/Users/example/Sites/with-facet", facet_too=True)
        self.ingest()
        got = self.payload()["projects"]
        self.assertEqual(got[-3:], ["with-facet", "another-meta-app", "meta-only-app"])
        self.assertEqual(len(got), len(set(got)))
        self.assertEqual(self.figures(project="meta-only-app")["sessions"], 1)

    def test_figures_show_in_a_view_with_no_facet(self):
        self.add(1, lines_added=9)
        self.ingest()
        d = self.payload()
        self.assertEqual((d["coverage"]["facets"], d["sessions"], d["meta"]["sessions"], d["meta"]["lines_added"]), (0, [], 1, 9))

    def test_project_and_start_come_from_the_stored_session_else_the_meta(self):
        stored = self.add(1, path="/Users/example/Sites/meta-says", start="2026-01-01T09:00:00.000Z", lines_added=1)
        self.session(stored, "store-says", "2026-11-03 09:00:00")
        self.add(2, path="/Users/example/Sites/orphan-app", start="2026-11-04T09:00:00.000Z", lines_added=10)
        self.ingest()
        self.assertEqual(self.figures(project="store-says")["lines_added"], 1)
        self.assertEqual(self.figures(project="meta-says")["sessions"], 0)
        self.assertEqual(self.figures(project="orphan-app")["lines_added"], 10)
        self.assertEqual(self.figures(range_days=7)["sessions"], 2)  # the stored session started 3 Nov, not 1 Jan
        self.assertEqual(self.figures(range_days=2)["lines_added"], 0)  # 2 days back from 6 Nov: only 5 and 6 Nov
        self.assertEqual(self.figures(range_days=3)["lines_added"], 10)  # the orphan's start: 4 Nov

    def test_automated_sessions_are_left_out_unless_asked_for(self):
        sid = self.add(1, lines_added=1)
        auto = metrics.AUTOMATED_PROJECTS[0]
        self.session(sid, auto, "2026-11-03 09:00:00")
        self.add(2, lines_added=10)
        self.ingest()
        self.assertEqual(self.figures()["lines_added"], 10)
        self.assertEqual(self.figures(automated=True)["lines_added"], 11)
        self.assertEqual(self.figures(project=auto)["lines_added"], 1)

    def test_codex_source_and_a_store_without_meta_have_empty_figures(self):
        empty = dict(sessions=0, lines_added=0, lines_removed=0, files_modified=0, git_pushes=0, duration_p50_min=None,
                     response_p50_s=None, languages=[])
        self.assertEqual(self.figures(), empty)
        self.add(1)
        self.ingest()
        self.assertEqual(self.figures(source="codex"), empty)
        self.assertEqual(self.figures(source="claude")["sessions"], 1)

    def test_a_listed_session_carries_its_meta_or_null(self):
        a = self.add(1, facet_too=True, duration_minutes=35, lines_added=120, lines_removed=30, files_modified=4, git_pushes=1)
        self.put("facets", "0000dddd-0000-4000-8000-000000000002.json", facet("0000dddd-0000-4000-8000-000000000002"))
        self.add(3, duration_minutes=None, lines_added=None)
        self.ingest()
        rows = {r["session_id"]: r["meta"] for r in self.payload()["sessions"]}
        self.assertEqual(rows[a], dict(duration_minutes=35, lines_added=120, lines_removed=30, files_modified=4, git_pushes=1))
        self.assertIsNone(rows["0000dddd-0000-4000-8000-000000000002"])
        self.assertEqual(set(rows), {a, "0000dddd-0000-4000-8000-000000000002"})

    def test_a_listed_orphan_keeps_its_meta_under_a_project_filter(self):
        a = self.add(1, facet_too=True, path="/Users/example/Sites/orphan-app", lines_added=3)
        self.ingest()
        got = self.payload(project="orphan-app")
        self.assertEqual([r["meta"]["lines_added"] for r in got["sessions"]], [3])
        self.assertEqual(got["meta"]["sessions"], 1)
        self.assertEqual(a, got["sessions"][0]["session_id"])


if __name__ == "__main__":
    unittest.main()
