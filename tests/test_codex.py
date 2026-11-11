import glob
import io
import json
import os
import shutil
import unittest
from datetime import date, datetime
from unittest import mock

from compression import zstd

from ai_ledger import metrics, store
from ai_ledger.codex import live_items as codex_live
from test_store import StoreCase

FIXTURES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "codex")
# Trimmed real lines, one file per thread, named <label>--<rollout file name>. Home paths are /nowhere, ids are fake.
LIVE = "sessions/2026/11/06"
SESSION = {"v0153": "0a0f0003-0000-7000-8000-000000000003", "v0166": "0a0f0030-0000-7000-8000-000000000030"}


def fixture(label):
    path, = glob.glob(os.path.join(FIXTURES, label + "--*"))
    with open(path) as fh:
        return os.path.basename(path).split("--", 1)[1], fh.read()


def line(**kw):
    return json.dumps(kw) + "\n"


def item(ordinal, turn, it, ts="2026-11-06T10:00:00.000Z"):
    return line(timestamp=ts, ordinal=ordinal, type="event_msg", payload=dict(type="item_completed", turn_id=turn, item=it))


def usage(inp, cached, out, write=0, reasoning=0):
    return dict(input_tokens=inp, cached_input_tokens=cached, cache_write_input_tokens=write, output_tokens=out,
                reasoning_output_tokens=reasoning, total_tokens=inp + out)


def record(ordinal, turn, rid, u, ts="2026-11-06T10:00:01.000Z"):
    return line(timestamp=ts, ordinal=ordinal, type="token_usage_record", payload=dict(turn_id=turn, response_id=rid, usage=u))


def context(ordinal, turn, model, effort=None):
    settings = dict(model=model) | (dict(reasoning_effort=effort) if effort else {})
    return line(timestamp="2026-11-06T10:00:00.000Z", ordinal=ordinal, type="turn_context",
                payload=dict(turn_id=turn, model=model, collaboration_mode=dict(mode="default", settings=settings)))


def meta(sid, thread=None):
    return line(timestamp="2026-11-06T10:00:00.000Z", ordinal=0, type="session_meta",
                payload=dict(session_id=sid, id=thread or sid, cwd="/nowhere/foo", originator="codex-tui", cli_version="0.166.0"))


THREAD = "0a0f9999-0000-7000-8000-000000000001"
NAME = f"rollout-2026-11-06T10-00-00-{THREAD}.jsonl"


class CodexCase(StoreCase):
    def setUp(self):
        super().setUp()
        self.home = self.roots["codex"]

    def place(self, name, text, where=LIVE, zst=False, mode="w"):
        """Writes text as a rollout file under the test Codex home; zst compresses it as Codex does."""
        d = os.path.join(self.home, where)
        os.makedirs(d, exist_ok=True)
        p = os.path.join(d, name + (".zst" if zst else ""))
        if zst:
            with open(p, "wb") as fh:
                fh.write(zstd.compress(text.encode()))
        else:
            with open(p, mode) as fh:
                fh.write(text)
        return p

    def put(self, label, **kw):
        return self.place(*fixture(label), **kw)

    def ingest(self):
        return store.ingest(self.con, self.roots)


class FixtureTest(unittest.TestCase):
    def test_fixtures_are_scrubbed_jsonl(self):
        home = os.path.expanduser("~")
        versions = set()
        for path in glob.glob(os.path.join(FIXTURES, "*.jsonl")):
            with open(path) as fh:
                text = fh.read()
            self.assertNotIn(home, text)
            self.assertNotIn("/Users/", text)
            for bad in ("encrypted_content", "base_instructions", "creator_account_id", "creator_user_id", "@gmail"):
                self.assertNotIn(bad, text)
            for raw in text.splitlines():
                d = json.loads(raw)
                if d["type"] == "session_meta":
                    versions.add(d["payload"]["cli_version"].split("-")[0])
        self.assertTrue({"0.139.0", "0.153.0", "0.166.0"} <= versions)


class DiscoveryTest(CodexCase):
    def test_live_session_grows(self):
        name, text = fixture("v0166")
        lines = text.splitlines(keepends=True)
        self.place(name, "".join(lines[:2]))
        self.assertEqual(self.ingest()["lines"], 2)
        self.place(name, "".join(lines[2:]), mode="a")
        self.assertEqual(self.ingest()["lines"], 12)
        self.assertEqual(self.count(), 14)

    def test_archived_session_never_seen_live(self):
        p = self.put("v0139", where="archived_sessions", zst=True)
        stats = self.ingest()
        self.assertEqual((stats["files"], stats["inserted"]), (1, 13))
        self.assertEqual(self.q("SELECT read_offset, size, source FROM files"), [(os.path.getsize(p), os.path.getsize(p), "codex")])
        self.assertEqual(self.q("SELECT session_id, source, cwd FROM sessions"),
                         [("0a0f0001-0000-7000-8000-000000000001", "codex", "/nowhere/Sites/explorations/shopapp")])
        offsets = [r[0] for r in self.q("SELECT byte_offset FROM raw_lines ORDER BY line_no")]
        self.assertEqual(offsets[0], 0)
        self.assertEqual(offsets, sorted(offsets))
        self.assertEqual(self.ingest()["files"], 0)  # unchanged: not decompressed again
        os.utime(p, (1, 1))
        self.assertEqual(self.ingest()["inserted"], 0)  # changed: read whole again, nothing stored twice
        self.assertEqual(self.count(), 13)

    def test_corrupt_archive_skipped(self):
        bad = self.put("v0139", where="archived_sessions", zst=True)
        with open(bad, "r+b") as fh:
            fh.truncate(os.path.getsize(bad) // 2)
        self.put("v0166")
        with mock.patch("sys.stderr", new_callable=io.StringIO) as err:
            self.assertEqual(self.ingest()["files"], 1)  # the good file still ingests
            self.assertEqual(self.ingest()["files"], 0)  # the bad one is not retried while unchanged
        self.assertEqual(err.getvalue().count("cannot read"), 1)
        self.put("v0139", where="archived_sessions", zst=True)  # rewritten whole
        self.assertEqual(self.ingest()["inserted"], 13)

    def test_codex_home_missing(self):
        self.assertFalse(os.path.exists(self.home))
        with open(os.path.join(self.root, "proj", "a.jsonl"), "w") as fh:
            fh.write(json.dumps(dict(type="user", uuid="u1", sessionId="s1")) + "\n")
        self.assertEqual(self.ingest()["files"], 1)

    def test_compressed_live_session_found(self):
        self.put("v0166", zst=True)
        self.ingest()
        self.assertEqual(self.count(), 14)

    def test_keys_by_thread_and_ordinal(self):
        self.put("v0166")
        self.ingest()
        self.assertEqual(self.q("SELECT key, session_id, ts FROM raw_lines WHERE line_no = 0"),
                         [(f"codex:{SESSION['v0166']}:0", SESSION["v0166"], "2026-11-06T06:56:42.480Z")])


class ArchiveTest(CodexCase):
    def derived(self):
        return [self.q(f"SELECT * FROM {t} ORDER BY ALL") for t in ("requests", "tool_calls", "prompts")] + [
            self.q("SELECT count(*), sum(input + cache_read + cache_5m + output) FROM requests")]

    def test_session_archived_after_ingest(self):
        live = self.put("v0166")
        self.ingest()
        before = self.derived(), self.count()
        os.remove(live)
        self.put("v0166", where="archived_sessions", zst=True)
        self.assertEqual(self.ingest()["inserted"], 0)
        self.assertEqual((self.derived(), self.count()), before)
        self.assertEqual(self.q("SELECT count(*) FROM files"), [(2,)])

    def test_archive_adds_lines_missing_live(self):
        name, text = fixture("v0166")
        lines = text.splitlines(keepends=True)
        live = self.place(name, "".join(lines[:5]))  # up to the first agent message: the turn's context is stored
        self.ingest()
        os.remove(live)
        self.place(name, text, where="archived_sessions", zst=True)
        self.assertEqual(self.ingest()["inserted"], 9)
        self.assertEqual(self.q("SELECT count(*), any_value(model), any_value(effort), any_value(session_id) FROM requests"),
                         [(2, "gpt-6.1-sol", "high", SESSION["v0166"])])

    def test_thread_file_continues_session(self):
        self.put("v0153", where="archived_sessions", zst=True)
        name, text = fixture("v0153_thread")
        # The real thread file holds no usage or tools; one of each, as that thread would write them.
        turn = "0a0f0008-0000-7000-8000-000000000008"
        text += record(156, turn, "resp_thread", usage(100, 40, 10), ts="2026-09-25T17:42:00.000Z") + item(157, turn, dict(
            type="CommandExecution", id="call_thread", command=["/bin/zsh", "-lc", "ls"], status="completed", exit_code=0,
            aggregated_output="a\n", duration=dict(secs=1, nanos=0)), ts="2026-09-25T17:42:01.000Z")
        self.place(name, text, where="archived_sessions", zst=True)
        self.ingest()
        self.assertEqual(self.count(), 19 + 12)
        overlap = self.q("SELECT count(*) FROM raw_lines WHERE key LIKE 'codex:%:146'")
        self.assertEqual(overlap, [(2,)])
        self.assertEqual(self.q("SELECT session_id, source FROM sessions"), [(SESSION["v0153"], "codex")])
        self.assertEqual(self.q("SELECT session_id, subagent, model, effort FROM requests WHERE message_id = 'resp_thread'"),
                         [(SESSION["v0153"], True, "gpt-5.6-sol", "low")])
        self.assertEqual(self.q("SELECT session_id, subagent FROM tool_calls WHERE tool_use_id = 'call_thread'"), [(SESSION["v0153"], True)])
        self.assertEqual(self.q("SELECT count(*) FROM requests WHERE NOT subagent"), [(3,)])

    def test_spawned_thread_is_subagent_work(self):
        parent = "0a0f9999-0000-7000-8000-000000000002"
        self.place(NAME, meta(parent, THREAD) + context(1, "t1", "gpt-6-astra", "medium")
                   + record(2, "t1", "r1", usage(100, 0, 10)))
        self.ingest()
        self.assertEqual(self.q("SELECT session_id, subagent FROM requests"), [(parent, True)])
        self.assertEqual(self.q("SELECT session_id, peak_context FROM sessions"), [(parent, 0)])


class TokenTest(CodexCase):
    def test_cached_input(self):
        self.put("v0166")
        self.ingest()
        r = self.q("SELECT input, cache_read, cache_5m, cache_1h, output, input + cache_read + cache_5m + cache_1h + output "
                   "FROM requests WHERE message_id = 'resp_fixture007'")
        self.assertEqual(r, [(12267, 13440, 0, 0, 182, 25889)])

    def test_usage_repeated_in_running_total(self):
        self.put("v0166")  # two token_usage_record lines, each followed by a token_count with the same usage
        self.ingest()
        self.assertEqual(self.q("SELECT count(*), sum(input + cache_read + output) FROM requests"), [(2, 25889 + 30181)])

    def test_cache_write_is_part_of_input(self):
        self.place(NAME, meta(THREAD) + context(1, "t1", "gpt-6-astra") + record(2, "t1", "r1", usage(1000, 300, 50, write=200, reasoning=20)))
        self.ingest()
        self.assertEqual(self.q("SELECT input, cache_read, cache_5m, cache_1h, output, thinking FROM requests"), [(500, 300, 200, 0, 50, 20)])

    def test_cli_without_usage_records(self):
        name, text = fixture("v0139")  # CLI 0.139: usage only in token_count events
        last = text.splitlines()[-2]  # a token_count line; written again under a new ordinal, as Codex repeats them
        again = json.loads(last) | dict(ordinal=400)
        self.place(name, text + json.dumps(again) + "\n", where="archived_sessions", zst=True)
        self.ingest()
        # Each token_count's last_token_usage: the running totals 29,715, 61,831, 94,363 and 348,534 less the previous one.
        self.assertEqual(self.q("SELECT count(*), sum(input + cache_read + output), any_value(model) FROM requests"),
                         [(4, 29715 + 32116 + 32532 + 57151, "gpt-5.5")])


class TurnTest(CodexCase):
    def test_model_changes_between_turns(self):
        self.place(NAME, meta(THREAD) + context(1, "t1", "gpt-6-astra", "medium") + record(2, "t1", "r1", usage(10, 0, 1))
                   + context(3, "t2", "gpt-6.1-sol", "high") + record(4, "t2", "r2", usage(10, 0, 1)))
        self.ingest()
        self.assertEqual(self.q("SELECT message_id, model, effort FROM requests ORDER BY 1"),
                         [("r1", "gpt-6-astra", "medium"), ("r2", "gpt-6.1-sol", "high")])

    def test_effort_not_stated(self):
        self.put("v0139", where="archived_sessions", zst=True)
        self.ingest()
        self.assertEqual(self.q("SELECT DISTINCT effort FROM requests"), [(None,)])
        models = metrics.usage(self.con.cursor(), prices={}, today=date(2026, 6, 16))["models"]
        self.assertEqual([(m["model"], m["effort"]) for m in models], [("gpt-5.5", "(none)")])

    def test_chunk_starting_mid_turn_keeps_model(self):
        name, text = fixture("v0166")
        lines = text.splitlines(keepends=True)
        self.place(name, "".join(lines[:5]))  # session_meta, task_started, turn_context, user and agent messages
        self.ingest()
        self.place(name, "".join(lines[5:]), mode="a")
        self.ingest()
        self.assertEqual(self.q("SELECT DISTINCT model, effort, subagent FROM requests"), [("gpt-6.1-sol", "high", False)])
        self.assertEqual(self.q("SELECT count(*) FROM requests"), [(2,)])

    def test_old_cli_chunk_starting_mid_turn_keeps_model(self):
        name, text = fixture("v0139")  # no token_usage_record: usage comes from token_count
        lines = text.splitlines(keepends=True)
        self.place(name, "".join(lines[:6]))  # through the first token_count
        self.ingest()
        self.place(name, "".join(lines[6:]), mode="a")
        self.ingest()
        self.assertEqual(self.q("SELECT DISTINCT model FROM requests"), [("gpt-5.5",)])
        before = self.q("SELECT * FROM requests ORDER BY ALL")
        store.rebuild(self.con)
        self.assertEqual(self.q("SELECT * FROM requests ORDER BY ALL"), before)

    def test_session_fields_and_peak_context(self):
        self.put("v0166")
        self.put("v0155_heartbeat")
        self.ingest()
        self.assertEqual(self.q("SELECT cwd, git_branch, entrypoint, version, compactions, peak_context, peak_model, source "
                                f"FROM sessions WHERE session_id = '{SESSION['v0166']}'"),
                         [("/nowhere/Sites/projects/claude-errors-dashboard", "feat/visual-pass", "T3 Code", "0.166.0", 0, 30075,
                           "gpt-6.1-sol", "codex")])
        self.assertEqual(self.q("SELECT compactions, first_ts, last_ts FROM sessions WHERE entrypoint = 'codex_work_desktop'"),
                         [(1, datetime.fromisoformat("2026-09-25 20:27:16.697"), datetime.fromisoformat("2026-10-26 16:03:25.295"))])
        sid = self.q("SELECT session_id FROM sessions WHERE entrypoint = 'codex_work_desktop'")[0][0]
        self.assertEqual(len(metrics.session(self.con.cursor(), sid, prices={})["compaction_ts"]), 1)


class ToolTest(CodexCase):
    def calls(self, where="TRUE"):
        return self.q(f"SELECT tool, mcp_server, input_summary, is_error, category, followup, subagent, is_commit, is_test "
                      f"FROM tool_calls WHERE {where} ORDER BY start_ts")

    def test_mcp_call(self):
        self.put("v0166")
        self.ingest()
        self.assertEqual(self.calls("tool LIKE '%preview_status'"),
                         [("mcp__t3-code__preview_status", "t3-code", "{}", False, None, None, False, False, False)])
        failed = self.q("SELECT tool, error, category FROM tool_calls WHERE tool LIKE '%preview_act'")
        self.assertEqual(failed[0][0], "mcp__t3-code__preview_act")
        self.assertTrue(failed[0][1].startswith("Preview automation hover received an invalid selector"))
        self.assertEqual(self.q("SELECT name, calls, errors FROM (SELECT mcp_server AS name, count(*) AS calls, "
                                "count(*) FILTER (WHERE is_error) AS errors FROM tool_calls WHERE mcp_server IS NOT NULL GROUP BY 1)"),
                         [("t3-code", 2, 1)])

    def test_failed_shell_command(self):
        self.put("v0166")
        self.ingest()
        (summary, error, category, followup), = self.q(
            "SELECT input_summary, error, category, followup FROM tool_calls WHERE tool = 'exec_command'")
        self.assertEqual(summary, "git status --short && git diff --stat && rg --files -g AGENTS.md -g '*SKILL*'")
        self.assertTrue(error.startswith("Exit code 1\n M README.md\n M app.py\n"))
        self.assertEqual(category, "chained")  # the existing rules read the Exit code prefix
        self.assertTrue(followup.startswith("I’m using the existing dashboard UX review skill"))
        errors = metrics.errors_payload(self.con.cursor())["errors"]
        self.assertEqual(sorted(e["t"] for e in errors), ["exec_command", "mcp__t3-code__preview_act"])

    def test_failed_chain_category(self):
        self.put("v0153")  # `ls -la .claude && rg ...`: the listing printed, then rg found nothing
        self.ingest()
        self.assertEqual(self.q("SELECT category, error FROM tool_calls WHERE is_error"),
                         [("chained", "Exit code 1\ntotal 8\ndrwxr-xr-x@  3 nowhere  staff   96 Jun 14 20:33 .\n"
                           "drwxr-xr-x  19 nowhere  staff  608 Sep 25 19:15 ..\n"
                           "-rw-r--r--@  1 nowhere  staff  985 Jun 14 20:33 settings.local.json")])

    def test_commit_and_test_commands(self):
        self.put("v0156_commit")
        self.place(NAME, meta(THREAD) + item(1, "t1", dict(type="CommandExecution", id="call_t", command=["/bin/zsh", "-lc", "npm test"],
                                                          status="completed", exit_code=0, aggregated_output="ok")))
        self.ingest()
        self.assertEqual(self.q("SELECT count(*) FILTER (WHERE is_commit), count(*) FILTER (WHERE is_test AND test_passed) FROM tool_calls"),
                         [(1, 1)])
        self.assertIn("git commit", self.q("SELECT input_summary FROM tool_calls WHERE is_commit")[0][0])

    def test_file_change_web_search_and_duration(self):
        self.put("v0139", where="archived_sessions", zst=True)
        self.put("v0166_aborted")
        self.put("v0166")
        self.ingest()
        self.assertEqual(self.q("SELECT tool, count(*) FROM tool_calls WHERE tool IN ('apply_patch', 'web_search') GROUP BY 1 ORDER BY 1"),
                         [("apply_patch", 1), ("web_search", 1)])
        self.assertIn("shop-ui", self.q("SELECT input_summary FROM tool_calls WHERE tool = 'apply_patch'")[0][0])
        done = next(json.loads(x) for x in fixture("v0166")[1].splitlines() if "preview_status" in x)
        took = done["payload"]["item"]["duration"]
        (us,), = self.q("SELECT date_diff('microsecond', start_ts, end_ts) FROM tool_calls WHERE tool LIKE '%preview_status'")
        self.assertAlmostEqual(us, took["secs"] * 1_000_000 + took["nanos"] / 1000, delta=1)

    def test_unified_exec_startup_has_no_duration(self):
        self.place(NAME, meta(THREAD) + item(1, "t1", dict(type="CommandExecution", id="call_u", command=["/bin/zsh", "-lc", "ls"],
                                                          source="unified_exec_startup", status="completed", exit_code=0,
                                                          aggregated_output="a", duration=dict(secs=0, nanos=9000))))
        self.ingest()
        self.assertEqual(self.q("SELECT start_ts = end_ts FROM tool_calls WHERE tool_use_id = 'call_u'"), [(True,)])

    def test_exec_script_is_not_a_tool_call(self):
        self.place(NAME, meta(THREAD) + line(
            timestamp="2026-11-06T10:00:00.000Z", ordinal=1, type="response_item",
            payload=dict(type="custom_tool_call", name="exec", call_id="call_exec", input="await tools.exec_command({cmd: 'ls'})"))
            + line(timestamp="2026-11-06T10:00:01.000Z", ordinal=2, type="response_item",
                   payload=dict(type="custom_tool_call_output", call_id="call_exec", output="a")))
        self.ingest()
        self.assertEqual(self.q("SELECT count(*) FROM tool_calls"), [(0,)])


class PromptTest(CodexCase):
    def prompts(self):
        return self.q("SELECT prompt_id, interrupted FROM prompts ORDER BY ts")

    def test_injected_context(self):
        msg = lambda o, text: item(o, "t1", dict(type="UserMessage", id=f"item-{o}", content=[dict(type="text", text=text)]))
        self.place(NAME, meta(THREAD) + msg(1, "<environment_context>\n  <cwd>/nowhere/foo</cwd>\n</environment_context>")
                   + msg(2, "# AGENTS.md instructions for /nowhere/foo\n\nbe brief") + msg(3, "run it now"))
        self.ingest()
        self.assertEqual(self.q("SELECT prompt_id, ts FROM prompts"), [("t1", datetime.fromisoformat("2026-11-06 10:00:00"))])
        # The session's title comes from the typed message, not the injected ones before it.
        self.assertEqual(metrics.first_prompt(self.con.cursor(), THREAD), "run it now")
        self.assertEqual(metrics.with_titles(self.con.cursor(), [dict(session_id=THREAD)])[0]["title"], "run it now")

    def test_automation_heartbeat(self):
        self.put("v0155_heartbeat")
        self.ingest()
        self.assertEqual(self.prompts(), [("0a0f0016-0000-7000-8000-000000000016", False)])
        self.assertEqual(self.q("SELECT count(*) FROM requests WHERE message_id IN ('resp_fixture002', 'resp_fixture003', 'resp_fixture004')"),
                         [(3,)])

    def test_interrupted_turn(self):
        self.put("v0166_aborted")
        self.ingest()
        self.assertEqual(self.prompts(), [("0a0f0037-0000-7000-8000-000000000037", True)])

    def test_interrupt_in_later_ingest(self):
        name, text = fixture("v0166_aborted")
        lines = text.splitlines(keepends=True)
        self.place(name, "".join(lines[:-1]))
        self.ingest()
        self.assertEqual([r[1] for r in self.prompts()], [False])
        self.place(name, lines[-1], mode="a")
        self.ingest()
        self.assertEqual([r[1] for r in self.prompts()], [True])


class CodexRebuildTest(CodexCase):
    def rows(self):
        return {t: self.q(f"SELECT * FROM {t} ORDER BY ALL") for t in store.DERIVED}

    def test_rebuild_matches_ingest(self):
        for label in ("v0153", "v0153_thread", "v0139"):
            self.put(label, where="archived_sessions", zst=True)
        for label in ("v0155_heartbeat", "v0156_commit", "v0166_aborted"):
            self.put(label)
        name, text = fixture("v0166")
        lines = text.splitlines(keepends=True)
        self.place(name, "".join(lines[:6]))
        self.ingest()
        self.place(name, "".join(lines[6:]), mode="a")
        with open(os.path.join(self.root, "proj", "a.jsonl"), "w") as fh:
            fh.write(json.dumps(dict(type="user", uuid="u1", sessionId="s1", timestamp="2026-11-06T10:00:00Z", cwd="/nowhere/foo",
                                     promptId="p1", message=dict(role="user", content="go"))) + "\n")
        self.ingest()
        before = self.rows()
        store.rebuild(self.con)
        self.assertEqual(self.rows(), before)
        self.assertEqual(self.q("SELECT source, count(*) FROM sessions GROUP BY 1 ORDER BY 1"), [("claude", 1), ("codex", 6)])


class IndexTest(CodexCase):
    OTHER = "0a0f9999-0000-7000-8000-000000000002"

    def index(self, *names, mode="a"):
        text = "".join(line(id=sid, thread_name=name, updated_at=f"2026-11-06T10:00:0{i}.0000000Z") for i, (sid, name) in enumerate(names))
        return self.place(store.codex.INDEX, text, where="", mode=mode)

    def titles(self):
        return self.q("SELECT session_id, custom, agent FROM session_titles ORDER BY 1")

    def test_rename_later_line_wins(self):
        self.place(NAME, meta(THREAD))
        self.index((THREAD, "Review MRI findings"), (THREAD, "Knee MRI review"))
        self.ingest()
        self.assertEqual(self.titles(), [(THREAD, None, "Knee MRI review")])
        self.assertEqual(self.q("SELECT key, session_id, ts FROM raw_lines WHERE file LIKE '%index%' ORDER BY line_no")[0],
                         (f"codex-index:{THREAD}:2026-11-06T10:00:00.0000000Z", THREAD, None))

    def test_index_read_before_its_session(self):
        self.index((THREAD, "Find Kafka Streams UIs"))
        self.ingest()
        self.place(NAME, meta(THREAD))
        self.ingest()
        self.assertEqual(self.titles(), [(THREAD, None, "Find Kafka Streams UIs")])
        self.assertEqual(self.q("SELECT session_id FROM sessions"), [(THREAD,)])

    def test_name_for_a_session_never_stored(self):
        self.place(NAME, meta(THREAD))
        self.index((self.OTHER, "Gone"))
        self.ingest()
        self.assertEqual(self.q("SELECT session_id FROM sessions"), [(THREAD,)])  # every dashboard lists sessions rows
        self.assertNotIn(self.OTHER, metrics.titles(self.con.cursor(), [THREAD]))

    def test_index_missing(self):
        self.place(NAME, meta(THREAD) + item(1, "t1", dict(type="UserMessage", id="item-1", content=[dict(type="text", text="run it now")])))
        self.assertEqual(self.ingest()["files"], 1)
        self.assertEqual(self.titles(), [])
        self.assertEqual(metrics.titles(self.con.cursor(), [THREAD]), {THREAD: ("run it now", "prompt")})

    def test_index_rewritten_whole(self):
        a, b = line(id=THREAD, thread_name="a", updated_at="2026-11-06T10:00:00Z"), line(id=self.OTHER, thread_name="b", updated_at="2026-11-06T10:00:01Z")
        self.place(store.codex.INDEX, a + b, where="")
        self.ingest()
        self.place(store.codex.INDEX, b, where="")  # shorter: read again from the start
        self.ingest()
        self.assertEqual(self.count("starts_with(key, 'codex-index:')"), 2)
        self.assertEqual(self.titles(), [(THREAD, None, "a"), (self.OTHER, None, "b")])

    def test_rebuild_keeps_thread_names(self):
        self.place(NAME, meta(THREAD))
        self.index((THREAD, "Find Kafka Streams UIs"))
        self.ingest()
        store.rebuild(self.con)
        self.assertEqual(self.titles(), [(THREAD, None, "Find Kafka Streams UIs")])


class LimitTest(CodexCase):
    def snaps(self):
        return self.q("SELECT limit_id, window_minutes, strftime(resets_at, '%m-%d %H:%M'), used_percent, plan, reached "
                      "FROM limit_snapshots ORDER BY observed_at, window_minutes")

    def test_both_windows_of_a_plan(self):
        self.put("v0166_aborted")
        self.ingest()
        self.assertEqual(self.snaps()[:2], [("codex_300", 300, "11-06 03:08", 49.0, "plus", False),
                                            ("codex_10080", 10080, "11-11 15:22", 13.0, "plus", False)])
        # The reached limit is the full 5-hour window, not the weekly one at 20%.
        self.assertEqual([r[5] for r in self.snaps()[2:4]], [True, False])

    def test_weekly_only_plan(self):
        self.put("v0166")
        self.ingest()
        self.assertEqual(self.snaps(), [("codex_10080", 10080, "11-13 04:56", p, "prolite", False) for p in (1.0, 1.0, 2.0)])

    def test_repeated_event_stored_once(self):
        name, text = fixture("v0166")
        last = [ln for ln in text.splitlines() if '"token_count"' in ln][-1]
        self.place(name, text + json.dumps(json.loads(last) | dict(ordinal=999)) + "\n")  # a fork repeats it, same time
        self.ingest()
        self.assertEqual(len(self.snaps()), 3)

    def test_rebuild_derives_the_same_snapshots(self):
        name, text = fixture("v0166_aborted")
        lines = text.splitlines(keepends=True)
        self.place(name, "".join(lines[:10]))
        self.ingest()
        self.place(name, "".join(lines[10:]), mode="a")
        self.ingest()
        before = self.snaps()
        self.assertEqual(len(before), 6)
        store.rebuild(self.con)
        self.assertEqual(self.snaps(), before)


if __name__ == "__main__":
    unittest.main()


class LiveItemsTest(unittest.TestCase):
    """codex.live_items: what the Live page shows of one Codex line."""

    def items(self, **kw):
        return codex_live(json.loads(line(timestamp="2026-11-10T10:00:00.000Z", ordinal=1, **kw)))

    def test_exec_call_without_output_yet(self):
        use, = self.items(type="response_item", payload=dict(type="custom_tool_call", name="exec", call_id="c1",
                                                             input="await tools.exec_command({cmd: 'ls'})"))
        self.assertEqual(use, dict(k="tool_use", id="c1", tool="exec", summary="await tools.exec_command({cmd: 'ls'})", description=None))

    def test_function_call_and_output(self):
        use, = self.items(type="response_item", payload=dict(type="function_call", name="exec_command", call_id="c2",
                                                             arguments=json.dumps(dict(cmd="cargo test"))))
        self.assertEqual((use["tool"], use["summary"]), ("exec_command", json.dumps(dict(cmd="cargo test"))))
        res, = self.items(type="response_item", payload=dict(type="function_call_output", call_id="c2", output="ok"))
        self.assertEqual(res, dict(k="tool_result", id="c2", error=None, output="ok", agent=None))

    def test_spawn_agent_names_its_task(self):
        use, = self.items(type="response_item", payload=dict(type="function_call", name="spawn_agent", call_id="c3",
                                                             arguments=json.dumps(dict(task_name="review", message="look"))))
        self.assertEqual(use["description"], "review")

    def test_failed_item_marks_its_call(self):
        res, = self.items(type="event_msg", payload=dict(type="item_completed", turn_id="t1", item=dict(
            type="McpToolCall", id="c4", server="node_repl", tool="js", status="failed", error=dict(message="boom"))))
        self.assertEqual((res["id"], res["error"]), ("c4", "boom"))

    def test_turns_prompts_and_replies(self):
        self.assertEqual(self.items(type="event_msg", payload=dict(type="task_started", turn_id="t1", model_context_window=272000)),
                         [dict(k="turn_start", window=272000)])
        self.assertEqual(self.items(type="event_msg", payload=dict(type="task_complete", turn_id="t1")), [dict(k="turn_end")])
        self.assertEqual(self.items(type="event_msg", payload=dict(type="item_completed", turn_id="t1", item=dict(
            type="UserMessage", content=[dict(type="text", text="Bump the parser")]))), [dict(k="prompt", text="Bump the parser")])
        self.assertEqual(self.items(type="event_msg", payload=dict(type="item_completed", turn_id="t1", item=dict(
            type="UserMessage", content=[dict(type="text", text="<environment_context>")]))), [])
        self.assertEqual(self.items(type="event_msg", payload=dict(type="item_completed", turn_id="t1", item=dict(
            type="AgentMessage", content=[dict(type="text", text="Done")]))), [dict(k="reply", text="Done")])
        self.assertEqual(self.items(type="compacted", payload=dict(message="")), [dict(k="compaction", pre=None)])
        self.assertEqual(self.items(type="world_state", payload=dict()), [])

    def test_usage_record_is_a_request(self):
        self.assertEqual(self.items(type="token_usage_record", payload=dict(turn_id="t1", response_id="r1", usage=usage(900, 600, 40))),
                         [dict(k="request", id="r1", model=None, output=40, context=900)])
