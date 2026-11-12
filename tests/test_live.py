import json
import os
import unittest
from unittest import mock
from datetime import datetime, timedelta, timezone

from ai_ledger import live, store
from test_codex import CodexCase, LIVE, NAME, THREAD, meta
from test_derive import S, assistant, prompt, result, tool_use
from test_store import StoreCase, line

NOW = datetime(2026, 11, 10, 10, 1, 0, tzinfo=timezone.utc)
PRICES = {"claude-opus-5-5": dict(input=4, output=20, cache_read=0.2, cache_5m=5, cache_1h=8, context=1000000)}


def at(seconds):
    """A transcript timestamp `seconds` after 10:00:00 on 2026-11-10."""
    return (datetime(2026, 11, 10, 10, 0, 0) + timedelta(seconds=seconds)).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def events(text, source="claude", lane_file=None):
    """Events assembled from transcript text, as live.state sees them: the main thread's, or those of the subagent whose
    lines lane_file holds."""
    rows = []
    for i, raw in enumerate(text.splitlines()):
        d = json.loads(raw)
        rows.append((f"k{i}", lane_file or "/x/a.jsonl", d.get("timestamp"), lane_file is not None, source, raw))
    return live.assemble(rows)[0]


def codex_line(ordinal, seconds, kind, **payload):
    return line(timestamp=at(seconds), ordinal=ordinal, type=kind, payload=payload)


class StateTest(unittest.TestCase):
    def state(self, text, source="claude", last=None, now=NOW):
        evs = events(text, source)
        last = last or max(e["ts"] for e in evs)
        return live.state(evs, now, source, last)

    def test_tool_running(self):
        st = self.state(prompt("u1", at(0), "p1", "go") + assistant("a1", "m1", at(50), [tool_use("t1", "Read", file_path="x.py")]))
        self.assertEqual(st, dict(kind="tool", tool="Read", since="2026-11-10T10:00:50.000Z", inferred=False, long=False))

    def test_turn_ended(self):
        text = (prompt("u1", at(0), "p1", "go") + assistant("a1", "m1", at(5), [tool_use("t1", "Read", file_path="x")])
                + result("r1", at(6), "t1", "ok") + assistant("a2", "m2", at(8), [dict(type="text", text="Done.")]))
        self.assertEqual(self.state(text)["kind"], "you")

    def test_prompt_sent_is_inferred_thinking(self):
        st = self.state(assistant("a1", "m1", at(5), [dict(type="text", text="Done.")]) + prompt("u1", at(30), "p2", "more"))
        self.assertEqual((st["kind"], st["inferred"]), ("thinking", True))

    def test_tool_result_newest_is_thinking(self):
        text = assistant("a1", "m1", at(5), [tool_use("t1", "Read", file_path="x")]) + result("r1", at(6), "t1", "ok")
        self.assertEqual(self.state(text)["kind"], "thinking")

    def test_quiet_session_is_idle_even_with_a_pending_call(self):
        text = assistant("a1", "m1", at(0), [tool_use("t1", "Bash", command="sleep 999")])
        st = self.state(text, now=NOW + timedelta(minutes=6))
        self.assertEqual(st["kind"], "idle")

    def test_slow_shell_call_is_likely_waiting(self):
        st = self.state(assistant("a1", "m1", at(15), [tool_use("t1", "Bash", command="git push")]))
        self.assertEqual(st, dict(kind="wait", tool="Bash", since="2026-11-10T10:00:15.000Z", inferred=True, long=False))

    def test_slow_background_shell_call_is_likely_waiting(self):  # a background call returns at once: one still pending waits
        st = self.state(assistant("a1", "m1", at(15), [tool_use("t1", "Bash", command="npm run dev", run_in_background=True)]))
        self.assertEqual(st, dict(kind="wait", tool="Bash", since="2026-11-10T10:00:15.000Z", inferred=True, long=False))

    def test_slow_shell_call_with_a_long_timeout_is_running(self):
        pending = lambda **inp: self.state(assistant("a1", "m1", at(15), [tool_use("t1", "Bash", command="make test", **inp)]))
        self.assertEqual((pending(timeout=600000)["kind"], pending(timeout=600000)["long"]), ("tool", True))
        self.assertEqual((pending(timeout=120000)["kind"], pending(timeout=120000)["long"]), ("wait", False))  # not above 120 s
        self.assertEqual(pending(timeout="600000")["kind"], "wait")

    def test_long_call_hides_no_likely_wait(self):
        text = (assistant("a1", "m1", at(10), [tool_use("t1", "Bash", command="make test", timeout=600000)])
                + assistant("a2", "m2", at(15), [tool_use("t2", "Bash", command="git push")]))
        self.assertEqual((self.state(text)["kind"], self.state(text)["since"]), ("wait", "2026-11-10T10:00:15.000Z"))

    def test_newer_call_does_not_hide_a_likely_wait(self):
        text = (assistant("a1", "m1", at(15), [tool_use("t1", "Bash", command="git push")])
                + assistant("a2", "m2", at(50), [tool_use("t2", "Read", file_path="x.py")]))
        self.assertEqual(self.state(text), dict(kind="wait", tool="Bash", since="2026-11-10T10:00:15.000Z", inferred=True, long=False))
        text = assistant("a1", "m1", at(45), [tool_use("t1", "Bash", command="ls")]) + assistant("a2", "m2", at(50), [tool_use("t2", "Read", file_path="x")])
        self.assertEqual(self.state(text)["tool"], "Read")

    def test_slow_codex_exec_is_likely_waiting(self):
        text = codex_line(1, 15, "response_item", type="custom_tool_call", name="exec", call_id="c1", input="run")
        self.assertEqual(self.state(text, "codex")["kind"], "wait")

    def test_slow_web_fetch_is_running(self):
        st = self.state(assistant("a1", "m1", at(15), [tool_use("t1", "WebFetch", url="https://example.com")]))
        self.assertEqual((st["kind"], st["inferred"]), ("tool", False))

    def test_codex_turn_in_progress_is_thinking_not_inferred(self):
        text = (codex_line(1, 0, "event_msg", type="task_started", turn_id="t1", model_context_window=272000)
                + codex_line(2, 1, "event_msg", type="item_completed", turn_id="t1", item=dict(type="UserMessage", content=[dict(type="text", text="go")])))
        self.assertEqual(self.state(text, "codex"), dict(kind="thinking", tool=None, since="2026-11-10T10:00:00.000Z", inferred=False, long=False))

    def test_codex_turn_complete_is_your_turn(self):
        text = (codex_line(1, 0, "event_msg", type="task_started", turn_id="t1")
                + codex_line(2, 9, "event_msg", type="task_complete", turn_id="t1"))
        self.assertEqual(self.state(text, "codex")["kind"], "you")

    def test_codex_turn_started_in_a_thread_file_is_thinking(self):  # a file that continues the main thread has no lane
        evs = events(codex_line(1, 0, "event_msg", type="task_started", turn_id="t1")
                     + codex_line(2, 9, "event_msg", type="task_complete", turn_id="t1"), "codex")
        evs += events(codex_line(1, 12, "event_msg", type="task_started", turn_id="t2"), "codex")
        st = live.state(evs, NOW, "codex", max(e["ts"] for e in evs))
        self.assertEqual((st["kind"], st["since"], st["inferred"], evs[-1]["lane"]), ("thinking", "2026-11-10T10:00:12.000Z", False, None))

    def lanes(self, main, sub, source="codex", now=NOW):
        """The state of a session whose main thread holds the lines main and a subagent the lines sub."""
        lane_file = "/x/agent-a1.jsonl" if source == "claude" else NAME.replace(THREAD, "0a0f9999-0000-7000-8000-000000000002")
        evs = events(main, source) + events(sub, source, lane_file=lane_file)
        evs.sort(key=lambda e: e["ts"])
        return live.state(evs, now, source, max(e["ts"] for e in evs))

    def test_codex_child_turn_end_leaves_a_working_parent_as_it_is(self):
        st = self.lanes(codex_line(1, 0, "event_msg", type="task_started", turn_id="t1"),
                        codex_line(1, 1, "event_msg", type="task_started", turn_id="u1") + codex_line(2, 5, "event_msg", type="task_complete", turn_id="u1"))
        self.assertEqual(st, dict(kind="thinking", tool=None, since="2026-11-10T10:00:00.000Z", inferred=False, long=False))

    def test_codex_subagent_at_work_keeps_the_session_thinking(self):
        main = codex_line(1, 0, "event_msg", type="task_started", turn_id="t1") + codex_line(2, 9, "event_msg", type="task_complete", turn_id="t1")
        started = codex_line(1, 12, "event_msg", type="task_started", turn_id="u1")
        self.assertEqual(self.lanes(main, started), dict(kind="thinking", tool=None, since="2026-11-10T10:00:12.000Z", inferred=True, long=False))
        done = started + codex_line(2, 15, "event_msg", type="task_complete", turn_id="u1")
        self.assertEqual(self.lanes(main, done), dict(kind="you", tool=None, since="2026-11-10T10:00:09.000Z", inferred=False, long=False))
        older = codex_line(1, 3, "event_msg", type="task_started", turn_id="u1")  # the main thread wrote after it
        self.assertEqual(self.lanes(main, older)["kind"], "you")

    def test_subagent_pending_call_is_running_a_tool(self):
        main = codex_line(1, 0, "event_msg", type="task_started", turn_id="t1") + codex_line(2, 9, "event_msg", type="task_complete", turn_id="t1")
        st = self.lanes(main, codex_line(1, 12, "response_item", type="function_call", name="update_plan", call_id="c1", arguments="{}") + codex_line(
            2, 13, "event_msg", type="task_started", turn_id="u1"))
        self.assertEqual((st["kind"], st["tool"]), ("tool", "update_plan"))

    def test_claude_subagent_between_calls_keeps_the_session_thinking(self):
        main = prompt("u1", at(0), "p1", "go") + assistant("a1", "m1", at(5), [dict(type="text", text="Running it in the background.")])
        call = assistant("b1", "m2", at(10), [tool_use("t1", "Read", file_path="x")])
        between = call + result("r1", at(11), "t1", "ok")
        at_work = self.lanes(main, between, "claude")
        self.assertEqual(at_work, dict(kind="thinking", tool=None, since="2026-11-10T10:00:11.000Z", inferred=True, long=False))
        done = between + assistant("b2", "m3", at(12), [dict(type="text", text="Done.")])
        self.assertEqual(self.lanes(main, done, "claude")["kind"], "you")
        self.assertEqual(self.lanes(main, call, "claude")["kind"], "tool")  # the pending call keeps its own state
        older = assistant("b3", "m4", at(2), [tool_use("t2", "Read", file_path="x")]) + result("r2", at(3), "t2", "ok")
        self.assertEqual(self.lanes(main, older, "claude")["kind"], "you")

    def test_closed_session_is_ended_whatever_its_lines_say(self):
        text = prompt("u1", at(0), "p1", "go") + assistant("a1", "m1", at(5), [tool_use("t1", "Bash", command="sleep 999")])
        evs = events(text)
        for now in (NOW, NOW + timedelta(minutes=6)):  # a pending call, then a quiet session
            self.assertEqual(live.state(evs, now, "claude", evs[-1]["ts"], closed=True),
                             dict(kind="ended", tool=None, since="2026-11-10T10:00:05.000Z", inferred=False, long=False))


class QuietTest(unittest.TestCase):
    """Which tool calls only read: the Live page can hide them."""

    def quiet(self, text, source="claude"):
        return [live.public(e, False)["quiet"] for e in events(text, source) if e["k"] == "tool"]

    def bash(self, *cmds):
        return self.quiet(assistant("a1", "m1", at(1), [tool_use(f"t{i}", "Bash", command=c) for i, c in enumerate(cmds)]))

    def test_tools_that_only_read(self):
        text = assistant("a1", "m1", at(1), [tool_use("t1", "Grep", pattern="x"), tool_use("t2", "Read", file_path="x.py"),
                                             tool_use("t3", "Glob", pattern="*.py"), tool_use("t4", "Edit", file_path="x.py"),
                                             tool_use("t5", "WebFetch", url="https://example.com")])
        self.assertEqual(self.quiet(text), [True, True, True, False, False])

    def test_shell_call_whose_every_command_reads(self):
        self.assertEqual(self.bash("rg TODO src", "cd web && rg -n 'a|b' src | head -5", "cat a.py; echo ---; sed -n '1,9p' b.py | nl",
                                   "ls -la 2>/dev/null", "find . -name \"*.py\" | sort | wc -l", "bash -lc 'grep -rn \"x > y\" src'",
                                   "rg -n TODO src 2>&1 | head -5", "ls web &&\ncat a.py\n"), [True] * 8)

    def test_shell_wrapper_read_as_its_script_only_in_its_exact_shape(self):
        self.assertEqual(self.bash("sh -c 'ls'", "zsh -c 'ls'", "bash -lc 'ls *.py | wc -l'"), [True] * 3)
        self.assertEqual(self.bash("bash -c -c 'rm -rf build'", "bash -ic 'ls'", "bash -lc 'ls' x", "dash -c 'ls'"), [False] * 4)
        # A glob outside the quotes is the outer shell's: it makes the script from file names, and a file can be named
        # `cat a;rm -rf build`.
        self.assertEqual(self.bash("bash -c 'cat '*", "sh -c 'ls '?", "zsh -lc 'cat a'[bc]"), [False] * 3)

    def test_command_with_flags_that_write_reads_under_its_listed_flags(self):
        self.assertEqual(self.bash("sed -n '1,50p' a.py", "sed -n '10p;20p' a.py", "nl -ba a.py | sed -n 10,40p", "rg -n TODO src",
                                   "rg -l --hidden TODO", "rg -uu -g '*.{ts,tsx}' -e 'a[0-9]*' -C3 --type=py src", "rg ';' src",
                                   "sort a.txt", "sort -rn -k2,2 -t, a.txt", "find . -name '*.py'", "find src -type f",
                                   "find . -maxdepth 2 -mtime -7 -print", "rg '#include' src", "rg '^def ' src"), [True] * 14)

    def test_shell_call_that_writes_or_runs_more(self):
        self.assertEqual(self.bash("git commit -m wip", "rg TODO src && rm notes.md", "cat a > b", "ls >> log", "sed -i s/a/b/ x.py",
                                   "sed -ni.bak 1p x.py", "find . -name '*.pyc' -delete", "find . -exec rm {} +", "sort -o x x",
                                   "cat $(make list)", "cat \"$(make list)\"", "rg x | xargs rm", ""), [False] * 13)
        self.assertEqual(self.bash("cat a 2>err.log", "rg x | tee out.txt", "cat `make list`", "(rm -rf build)", "cat <(rm -rf build)",
                                   "env FOO=1 rm notes.md", "FOO=1 rm notes.md", "sed --in-place s/a/b/ x.py", "sort --output=x x",
                                   "find . -execdir rm {} +", "find . -ok rm {} +", "find . -fprint out.txt", "ls\nrm -rf build",
                                   "bash -lc 'rm -rf build'", "./cat a.py", "ls >&log"), [False] * 16)

    def test_flag_or_sed_script_not_listed_as_reading(self):
        self.assertEqual(self.bash("sed -n 'w out.txt' a.py", "sed 1e a.py", "rg --pre ./x.sh TODO", "sort --compress-program=./x.sh a",
                                   "sed --in-pl s/a/b/ x.py", "sort --outp=x x"), [False] * 6)
        self.assertEqual(self.bash("sed 1p a.py", "sed -n -e 1p a.py", "sed -n 1,5d a.py", "sed -n 's/a/b/p' a.py", "sed -n '1p;w out' a.py",
                                   "sed -n '$p' a.py", "sed -n", "rg -z TODO", "rg -nz TODO", "rg --hostname-bin=./x TODO", "rg --hid TODO",
                                   "sort -T /tmp a", "sort -uo x x", "sort --rev a", "find . -fprintf x %p", "find . -newerXY x"), [False] * 16)

    def test_shell_line_it_cannot_read_for_certain(self):  # each hides its rm or its write from a rule that reads less exactly
        hidden = "bash -lc 'sort a %s cat -o x'" % ";".translate(live.MASK)  # the character that stands for a quoted ;
        self.assertEqual(self.bash("cat notes.txt & rm -rf build", "echo \"Don't touch $HOME\"; rm -rf dist; echo \"that's all\"",
                                   "cat <<EOF\nls it's\nEOF\nrm -rf dist; echo 'ok'", "echo it\\'s; rm -rf dist; echo it\\'s",
                                   "ls # it's\nrm -rf build # it's", "sort a ';' cat -o x", "sort a \\; cat -o x", hidden,
                                   "cat 'a.py", "sed 1,5p a.py # -n"), [False] * 10)

    def test_word_the_shell_may_expand_into_a_flag(self):  # a file can be named -o or -delete
        self.assertEqual(self.bash("sort *", "sort a?.txt", "rg TODO [a-c]*", "find * -name x", "sort {-o,x} a", "sed -n 1p *.py",
                                   "sort ^a", "sort a#-o x"), [False] * 8)  # zsh with EXTENDED_GLOB: every file but a, and -o after no a
        self.assertEqual(self.bash("cat *", "ls *.py | wc -l", "grep -rn TODO src/*.py"), [True] * 3)  # no flag of theirs writes

    def test_codex_shell_call(self):
        call = lambda i, **args: codex_line(i, i, "response_item", type="function_call", name="exec_command", call_id=f"c{i}",
                                            arguments=json.dumps(dict(args, workdir="/nowhere/foo", yield_time_ms=1000)))
        cut = "rg TODO " + "src " * 100 + "&& rm notes.md"
        text = (call(1, cmd="rg TODO src") + call(2, cmd="rg TODO src && rm notes.md") + call(3, cmd=cut)
                + codex_line(4, 4, "response_item", type="custom_tool_call", name="exec", call_id="c4", input="rg TODO src")
                + call(5, command=cut) + call(6, command="rg TODO src"))
        # The third call's summary is cut before its rm, and exec runs a script, not a command line: neither can be judged.
        # The last two name no cmd: their summary is a line Codex may have cut, as the fifth's is.
        self.assertEqual(self.quiet(text, "codex"), [True, False, False, False, False, False])


class LiveCase(StoreCase):
    def ingest(self):
        store.ingest(self.con, self.roots, usage=False)

    def cur(self):
        return self.con.cursor()


class SessionsTest(LiveCase):
    def setUp(self):
        super().setUp()
        self.write("s1.jsonl", prompt("u1", at(30), "p1", "go") + assistant("a1", "m1", at(40), [tool_use("t1", "Read", file_path="x")]))
        self.write("s2.jsonl", (prompt("v1", at(-200), "q1", "hi") + assistant("b1", "n1", at(-180), [dict(type="text", text="ok")])).replace('"s1"', '"s2"').replace("/nowhere/foo", "/nowhere/bar"))
        self.write("old.jsonl", prompt("w1", "2026-11-10T07:00:00.000Z", "r1", "old").replace('"s1"', '"s3"'))
        self.ingest()

    def test_active_newest_first_with_cut_off(self):
        got = live.sessions(self.cur(), now=NOW, prices=PRICES)
        self.assertEqual([s["session_id"] for s in got["sessions"]], ["s1", "s2"])
        s1 = got["sessions"][0]
        self.assertEqual((s1["state"]["kind"], s1["latest"]["tool"], s1["window"], s1["requests"]), ("tool", "Read", 1000000, 1))

    def test_list_reads_no_call_for_quiet(self):  # the list sends no event, and reading a shell line costs a parse
        with mock.patch.object(live, "quiet") as quiet:
            live.sessions(self.cur(), now=NOW, prices=PRICES)
            quiet.assert_not_called()
            self.assertEqual([e["quiet"] for e in live.session(self.cur(), "s1", now=NOW, prices=PRICES)["events"] if e["k"] == "tool"],
                             [quiet.return_value])

    def test_start_time_is_the_first_line(self):
        got = live.sessions(self.cur(), now=NOW, prices=PRICES)
        self.assertEqual([(s["first_ts"], s["last_ts"]) for s in got["sessions"]],
                         [("2026-11-10T10:00:30.000Z", "2026-11-10T10:00:40.000Z"), ("2026-11-10T09:56:40.000Z", "2026-11-10T09:57:00.000Z")])

    def test_closed_session_is_ended_until_it_writes_again(self):
        kinds = lambda: {s["session_id"]: s["state"]["kind"] for s in live.sessions(self.cur(), now=NOW, prices=PRICES)["sessions"]}
        self.assertEqual(kinds(), dict(s1="tool", s2="you"))
        self.write("s2.jsonl", line(type="cost-state", sessionId="s2", totalCostUSD=0.1))  # Claude Code writes it as it exits
        self.ingest()
        self.assertEqual(kinds(), dict(s1="tool", s2="ended"))
        self.assertEqual(live.session(self.cur(), "s2", now=NOW, prices=PRICES)["state"],
                         dict(kind="ended", tool=None, since="2026-11-10T09:57:00.000Z", inferred=False, long=False))
        self.write("s2.jsonl", prompt("v2", at(20), "q2", "again").replace('"s1"', '"s2"'))  # resumed
        self.ingest()
        self.assertEqual(kinds()["s2"], "thinking")

    def two_files(self, sid, first, second):
        """The state kind of a session whose lines are in two main files."""
        for name, text in ((sid, first), (sid + "b", second)):
            self.write(f"{name}.jsonl", text.replace('"s1"', f'"{sid}"'))
        self.ingest()
        return {s["session_id"]: s["state"]["kind"] for s in live.sessions(self.cur(), now=NOW, prices=PRICES)["sessions"]}[sid]

    def test_closed_follows_the_main_file_that_wrote_last(self):
        earlier = "".join(prompt(f"k{i}", at(i), f"kp{i}", "go") for i in range(3))  # more lines than the file that closes
        closing = prompt("k9", at(10), "kp9", "more") + line(type="cost-state", sessionId="s1")
        self.assertEqual(self.two_files("s6", earlier, closing), "ended")

    def test_close_line_in_an_earlier_main_file_ends_no_session(self):
        close = line(type="cost-state", sessionId="s1")
        self.assertEqual(self.two_files("s7", prompt("n0", at(0), "np0", "go") + close, prompt("n9", at(10), "np9", "more")), "thinking")
        self.assertEqual(self.two_files("s8", prompt("o0", at(0), "op0", "go"), close), "thinking")  # no timed line in the close line's file

    def test_subagent_lines_reopen_no_closed_session(self):
        self.write("s2.jsonl", line(type="cost-state", sessionId="s2", totalCostUSD=0.1))
        self.write("s2/subagents/agent-a7.jsonl", line(type="assistant", uuid="x1", timestamp=at(10), message=dict(
            id="sm1", model="claude-opus-5-5", content=[dict(type="text", text="late")]), **dict(S, sessionId="s2", isSidechain=True, agentId="a7")))
        self.ingest()
        s2, = [s for s in live.sessions(self.cur(), now=NOW, prices=PRICES)["sessions"] if s["session_id"] == "s2"]
        self.assertEqual(s2["state"]["kind"], "ended")

    def test_cost_matches_the_session_sheet(self):
        from ai_ledger import metrics
        s1 = live.sessions(self.cur(), now=NOW, prices=PRICES)["sessions"][0]
        sheet = metrics.session(self.cur(), "s1", prices=PRICES)
        self.assertAlmostEqual(s1["cost"], sum(m["cost"] for m in sheet["models"]))

    def test_filters(self):
        self.con.execute("UPDATE sessions SET source = 'codex' WHERE session_id = 's2'")
        self.assertEqual([s["session_id"] for s in live.sessions(self.cur(), source="codex", now=NOW, prices=PRICES)["sessions"]], ["s2"])
        project = live.sessions(self.cur(), now=NOW, prices=PRICES)["sessions"][0]["project"]
        self.assertEqual(len(live.sessions(self.cur(), project=project, now=NOW, prices=PRICES)["sessions"]), 1)
        with self.assertRaises(ValueError):
            live.sessions(self.cur(), source="grok", now=NOW)

    def test_automated_session_hidden_by_default(self):
        self.con.execute("UPDATE sessions SET project = 'observer-sessions' WHERE session_id = 's2'")
        self.assertEqual([s["session_id"] for s in live.sessions(self.cur(), now=NOW, prices=PRICES)["sessions"]], ["s1"])
        self.assertEqual(len(live.sessions(self.cur(), automated=True, now=NOW, prices=PRICES)["sessions"]), 2)

    def test_empty_state_names_the_newest_session(self):
        got = live.sessions(self.cur(), now=NOW + timedelta(hours=1), prices=PRICES)
        self.assertEqual((got["sessions"], got["newest"]["session_id"]), ([], "s1"))


class TitleTest(LiveCase):
    def setUp(self):
        super().setUp()
        self.write("s1.jsonl", prompt("u1", at(30), "p1", "SENTINEL prompt. More") + line(type="ai-title", aiTitle="Add session titles", sessionId="s1"))
        self.write("s2.jsonl", prompt("v1", at(20), "q1", "SENTINEL other. More").replace('"s1"', '"s2"'))
        self.ingest()

    def listed(self, text=False):
        return {s["session_id"]: (s["title"], s["title_from"]) for s in live.sessions(self.cur(), now=NOW, prices=PRICES, text=text)["sessions"]}

    def test_agent_title(self):
        self.assertEqual(self.listed()["s1"], ("Add session titles", "agent"))
        self.assertEqual(self.listed(text=True)["s1"], ("Add session titles", "agent"))

    def test_prompt_title_only_with_text(self):
        self.assertEqual(self.listed()["s2"], (None, None))
        self.assertEqual(self.listed(text=True)["s2"], ("SENTINEL other.", "prompt"))
        detail = lambda text: live.session(self.cur(), "s2", now=NOW, prices=PRICES, text=text)
        self.assertNotIn("SENTINEL", json.dumps(live.sessions(self.cur(), now=NOW, prices=PRICES)) + json.dumps(detail(False)))
        self.assertEqual((detail(True)["title"], detail(True)["title_from"]), ("SENTINEL other.", "prompt"))
        self.assertEqual(live.session(self.cur(), "s1", now=NOW, prices=PRICES)["title"], "Add session titles")

    def test_title_arrives_during_the_session(self):
        self.write("s2.jsonl", line(type="ai-title", aiTitle="Fix Cost test", sessionId="s2"))
        self.ingest()
        self.assertEqual(self.listed()["s2"], ("Fix Cost test", "agent"))


class SessionTest(LiveCase):
    def run_session(self, **kw):
        return live.session(self.cur(), kw.pop("sid", "s1"), now=kw.pop("now", NOW), prices=PRICES, **kw)

    def test_first_load_and_catch_up(self):
        self.write("s1.jsonl", prompt("u1", at(0), "p1", "SECRET prompt") + assistant("a1", "m1", at(1), [tool_use("t1", "Bash", command="ls")]))
        self.ingest()
        first = self.run_session()
        self.assertEqual([e["k"] for e in first["events"]], ["prompt", "tool"])
        self.assertFalse(first["truncated"])
        self.write("s1.jsonl", result("r1", at(3), "t1", "a\nb") + assistant("a2", "m2", at(4), [tool_use("t2", "Read", file_path="x"),
                                                                                                 tool_use("t3", "Grep", pattern="y")]))
        self.ingest()
        later = self.run_session(after=first["cursor"])
        tools = [e for e in later["events"] if e["k"] == "tool"]
        self.assertEqual([(t["id"], t["end"] is not None) for t in tools], [("t1", True), ("t2", False), ("t3", False)])
        self.write("s1.jsonl", assistant("a3", "m3", at(200), [tool_use("t4", "Read", file_path="z")]))
        self.ingest()
        self.assertEqual([e["key"] for e in self.run_session(after=at(200))["events"]], ["a3#1"])  # nothing from a minute before

    def test_catch_up_reads_a_line_written_late(self):
        self.write("s1.jsonl", assistant("a1", "m1", at(0), [tool_use("t1", "Read", file_path="x")]))
        self.write("s1/subagents/agent-a7.jsonl", line(type="assistant", uuid="x1", timestamp=at(20), message=dict(
            id="sm1", model="claude-opus-5-5", content=[tool_use("st1", "Grep", pattern="x")]), **dict(S, isSidechain=True, agentId="a7")))
        self.ingest()
        first = self.run_session()
        self.assertEqual(first["cursor"], at(20))
        self.write("s1.jsonl", result("r1", at(4), "t1", "ok"))  # stamped before the cursor, stored after it
        self.ingest()
        t1, = [e for e in self.run_session(after=first["cursor"])["events"] if e["id"] == "t1"]
        self.assertEqual(t1["end"], "2026-11-10T10:00:04.000Z")

    def test_call_finishing_with_a_failure_is_sent_again(self):
        self.write("s1.jsonl", assistant("a1", "m1", at(1), [tool_use("t1", "Bash", command="make")]))
        self.ingest()
        first = self.run_session()
        self.write("s1.jsonl", result("r1", at(9), "t1", "Exit code 2\nboom", error=True))
        self.ingest()
        t1, = [e for e in self.run_session(after=first["cursor"])["events"] if e["k"] == "tool"]
        self.assertEqual((t1["failed"], t1["error"], t1["end"]), (True, "Exit code 2\nboom", "2026-11-10T10:00:09.000Z"))

    def test_result_for_a_call_older_than_the_cursor(self):
        self.write("s1.jsonl", assistant("a1", "m1", at(1), [tool_use("t1", "Bash", command="make")])
                   + assistant("a2", "m2", at(4), [dict(type="text", text="still running")]))
        self.ingest()
        first = self.run_session()
        self.assertEqual(first["cursor"], at(4))
        self.write("s1.jsonl", result("r1", at(9), "t1", "ok"))
        self.ingest()
        t1, = [e for e in self.run_session(after=first["cursor"])["events"] if e["k"] == "tool"]
        self.assertEqual((t1["id"], t1["key"], t1["end"]), ("t1", "a1#1", "2026-11-10T10:00:09.000Z"))

    def test_first_load_keeps_the_newest_events(self):
        body = "".join(prompt(f"u{i}", at(i), f"p{i}", "go") for i in range(live.FIRST_LOAD + 20))
        self.write("s1.jsonl", body)
        self.ingest()
        got = self.run_session(now=NOW + timedelta(minutes=10))
        self.assertEqual((len(got["events"]), got["truncated"], got["events"][-1]["key"]), (live.FIRST_LOAD, True, f"u{live.FIRST_LOAD + 19}#0"))

    def test_first_load_counts_shown_events_only(self):
        body = "".join(assistant(f"a{i}", f"m{i}", at(i), [tool_use(f"t{i}", "Read", file_path="x")]) for i in range(live.FIRST_LOAD))
        self.write("s1.jsonl", prompt("u0", at(-1), "p0", "go") + body)
        self.ingest()
        got = self.run_session(now=NOW + timedelta(minutes=10))
        self.assertEqual((len(got["events"]), got["truncated"], got["events"][0]["k"]), (live.FIRST_LOAD, True, "tool"))
        self.assertNotIn("request", {e["k"] for e in got["events"]})

    def test_tool_input_in_full_only_with_text(self):
        self.write("s1.jsonl", assistant("a1", "m1", at(1), [tool_use("t1", "Agent", description="find callers", prompt="SECRET brief " * 50),
                                                             tool_use("t2", "Bash", command="echo " + "x" * 400 + " SECRET")]))
        self.ingest()
        plain = self.run_session()
        self.assertNotIn("SECRET", json.dumps(plain) + json.dumps(live.sessions(self.cur(), now=NOW, prices=PRICES)))
        agent, bash = plain["events"]
        self.assertEqual((agent["summary"], len(bash["summary"])), ("find callers", live.INPUT_CAP + 1))
        agent, bash = self.run_session(text=True)["events"]
        self.assertEqual((agent["summary"], bash["summary"][-6:]), ("SECRET brief " * 50, "SECRET"))

    def test_no_tool_input_field_longer_than_the_cap_without_text(self):
        strings = lambda v: [v] if isinstance(v, str) else [s for x in (v.values() if isinstance(v, dict) else v if isinstance(v, list) else []) for s in strings(x)]
        self.write("s1.jsonl", prompt("u1", at(0), "p1", "go") + assistant("a1", "m1", at(1), [
            tool_use("t1", "Agent", description="find " + "x" * 1995, prompt="SECRET brief")]))
        self.ingest()
        plain, wall = self.run_session(), live.sessions(self.cur(), now=NOW, prices=PRICES)
        self.assertEqual(plain["events"][1]["summary"], "find " + "x" * (live.INPUT_CAP - 5) + "…")
        self.assertEqual(max(map(len, strings(plain))), live.INPUT_CAP + 1)
        self.assertLessEqual(max(map(len, strings(wall))), live.INPUT_CAP + 1)
        self.assertEqual(wall["sessions"][0]["latest"]["summary"], "find " + "x" * 195)
        self.assertEqual(len(self.run_session(text=True)["events"][1]["description"]), 2000)

    def test_shell_description_beside_its_command_cut_without_text(self):
        self.write("s1.jsonl", assistant("a1", "m1", at(1), [tool_use("t1", "Bash", command="cd /long/path && uv run pytest", description="Run the Python tests"),
                                                             tool_use("t2", "Bash", command="ls", description="list " + "x" * 395),
                                                             tool_use("t3", "Bash", command="ls")]))
        self.ingest()
        run, wordy, bare = self.run_session()["events"]
        self.assertEqual((run["description"], run["summary"]), ("Run the Python tests", "cd /long/path && uv run pytest"))
        self.assertEqual((wordy["description"], bare["description"]), ("list " + "x" * (live.INPUT_CAP - 5) + "…", None))
        self.assertEqual(len(self.run_session(text=True)["events"][1]["description"]), 400)

    def test_wall_latest_action_is_a_shell_calls_description(self):
        def latest(text=False, tool="Bash", **inp):
            return live.latest_action(events(assistant("a1", "m1", at(1), [tool_use("t1", tool, **inp)])), text)
        self.assertEqual(latest(command="cd /long/path && uv run pytest", description="Run the Python tests"),
                         dict(kind="tool", tool="Bash", summary="Run the Python tests", lane=None))
        wordy = dict(command="ls", description="list " + "x" * 395)  # cut as an input is, with text and without
        self.assertEqual((latest(**wordy)["summary"], latest(text=True, **wordy)["summary"]), ("list " + "x" * 195,) * 2)
        self.assertEqual(latest(command="git status")["summary"], "git status")  # no description: the command
        self.assertEqual(latest(tool="Read", file_path="x.py", description="the parser")["summary"], "x.py")  # not a shell call
        self.write("s1.jsonl", prompt("u1", at(0), "p1", "go") + assistant("a1", "m1", at(1), [
            tool_use("t1", "Bash", command="uv run pytest", description="Run the Python tests")]))
        self.ingest()
        self.assertEqual(live.sessions(self.cur(), now=NOW, prices=PRICES)["sessions"][0]["latest"]["summary"], "Run the Python tests")

    def test_text_only_on_request(self):
        self.write("s1.jsonl", prompt("u1", at(0), "p1", "SECRET prompt") + assistant("a1", "m1", at(1), [
            dict(type="text", text="SECRET reply"), tool_use("t1", "Bash", command="cat .env")]) + result("r1", at(2), "t1", "SECRET=" + "x" * 5000))
        self.ingest()
        plain = self.run_session()
        self.assertNotIn("SECRET", json.dumps(plain))
        prompt_ev, = [e for e in plain["events"] if e["k"] == "prompt"]
        tool_ev, = [e for e in plain["events"] if e["k"] == "tool"]
        self.assertEqual((prompt_ev["words"], tool_ev["chars"], tool_ev["output"]), (2, 5007, None))
        full = self.run_session(text=True)
        tool_ev, = [e for e in full["events"] if e["k"] == "tool"]
        self.assertEqual((len(tool_ev["output"]), tool_ev["cut"]), (live.TEXT_CAP, True))
        self.assertIn("SECRET reply", json.dumps(full))

    def test_subagent_lane_tied_to_its_call(self):
        self.write("s1.jsonl", assistant("a1", "m1", at(1), [tool_use("t1", "Agent", description="find callers", prompt="look")]))
        sub = dict(S, isSidechain=True, agentId="a7")
        lines = "".join(line(type="assistant", uuid=f"x{i}", timestamp=at(2 + i), message=dict(
            id=f"sm{i}", model="claude-opus-5-5", usage=dict(input_tokens=1, output_tokens=1),
            content=[tool_use(f"st{i}", "Grep", pattern="x")]), **sub) + line(
            type="user", uuid=f"y{i}", timestamp=at(2 + i), message=dict(role="user", content=[dict(type="tool_result", tool_use_id=f"st{i}", content="r")]), **sub)
            for i in range(3))
        self.write("s1/subagents/agent-a7.jsonl", lines)
        self.ingest()
        running = self.run_session()
        self.assertEqual(sum(1 for e in running["events"] if e["lane"] == "a7" and e["k"] == "tool"), 3)
        call = lambda got: next(e for e in got["events"] if e["k"] == "tool" and e["id"] == "t1")
        self.assertEqual((call(running)["agent"], call(running)["end"]), (None, None))
        self.write("s1.jsonl", line(type="user", uuid="r1", timestamp=at(9), promptId="p1", toolUseResult=dict(agentId="a7"),
                                    message=dict(role="user", content=[dict(type="tool_result", tool_use_id="t1", content="done")]), **S))
        self.ingest()
        self.assertEqual((call(self.run_session())["agent"], call(self.run_session())["description"]), ("a7", "find callers"))

    def test_running_subagent_tied_through_its_meta_file(self):
        self.write("s1.jsonl", assistant("a1", "m1", at(1), [tool_use("t1", "Agent", description="find callers", prompt="look")]))
        sub = dict(S, isSidechain=True, agentId="a7")
        step = lambda i: line(type="assistant", uuid=f"x{i}", timestamp=at(2 + i * 100), message=dict(
            id=f"sm{i}", model="claude-opus-5-5", content=[tool_use(f"st{i}", "Grep", pattern="x")]), **sub)
        self.write("s1/subagents/agent-a7.jsonl", step(0))
        self.write("s1/subagents/agent-a7.meta.json", json.dumps(dict(agentType="Explore", description="find callers", toolUseId="t1")), mode="w")
        self.ingest()
        first = self.run_session()
        call, = [e for e in first["events"] if e["k"] == "tool" and e["lane"] is None]
        self.assertEqual((call["id"], call["agent"], call["end"]), ("t1", "a7", None))
        self.write("s1/subagents/agent-a7.jsonl", step(1))  # the call itself is now older than the catch-up reads
        self.ingest()
        later = self.run_session(after=first["cursor"], now=NOW + timedelta(minutes=2))
        self.assertEqual([(e["id"], e["agent"]) for e in later["events"] if e["lane"] is None], [("t1", "a7")])

    def test_long_call_marked_on_its_event(self):
        self.write("s1.jsonl", assistant("a1", "m1", at(1), [tool_use("t1", "Bash", command="npm run dev", run_in_background=True),
                                                             tool_use("t2", "Bash", command="make", timeout=300000),
                                                             tool_use("t3", "Bash", command="ls", timeout=5000)]))
        self.ingest()
        self.assertEqual([e["long"] for e in self.run_session()["events"]], [False, True, False])

    def test_read_only_calls_marked_quiet(self):
        self.write("s1.jsonl", assistant("a1", "m1", at(1), [tool_use("t1", "Grep", pattern="x"), tool_use("t2", "Bash", command="git commit -m wip")]))
        self.ingest()
        self.assertEqual([(e["tool"], e["quiet"]) for e in self.run_session()["events"]], [("Grep", True), ("Bash", False)])

    def test_lane_cost_and_model(self):
        self.write("s1.jsonl", assistant("a1", "m1", at(1), [tool_use("t1", "Agent", description="find callers", prompt="look")]))
        step = lambda agent, i, model, block=0, **usage: line(type="assistant", uuid=f"{agent}x{i}{block}", timestamp=at(2 + i), message=dict(
            id=f"{agent}m{i}", model=model, usage=usage, content=[tool_use(f"{agent}t{i}{block}", "Grep", pattern="x")]),
            **dict(S, isSidechain=True, agentId=agent))
        self.write("s1/subagents/agent-a7.jsonl", step("a7", 0, "claude-opus-5-5", input_tokens=1000000) + step("a7", 1, "claude-opus-5-5", output_tokens=1000000)
                   + step("a7", 1, "claude-opus-5-5", block=1, output_tokens=1000000))  # one request on two lines counts once
        self.write("s1/subagents/agent-b2.jsonl", step("b2", 0, "claude-opus-5-5", input_tokens=500000) + step("b2", 1, "mystery-1", input_tokens=9))
        self.write("s1/subagents/agent-c3.jsonl", step("c3", 0, "mystery-1", input_tokens=9))  # the lanes' lines share their times
        self.ingest()
        got = self.run_session()
        self.assertEqual(got["lanes"], dict(a7=dict(cost=24.0, model="claude-opus-5-5"), b2=dict(cost=2.0, model="mystery-1"),
                                            c3=dict(cost=None, model="mystery-1")))  # priced at $4 and $20 per million; mystery-1 has no price
        self.assertEqual({e["lane"] for e in got["events"]} - {None}, set(got["lanes"]))
        self.assertAlmostEqual(got["cost"], 26.0008)  # the main thread's request on top of the lanes'
        self.assertEqual(self.run_session(after=got["cursor"])["lanes"], got["lanes"])  # whole on a catch-up too

    def test_no_lanes_without_subagents(self):
        self.write("s1.jsonl", assistant("a1", "m1", at(1), [dict(type="text", text="hi")]))
        self.ingest()
        self.assertEqual(self.run_session()["lanes"], {})

    def test_figures(self):
        self.write("s1.jsonl", assistant("a1", "m1", at(30), [dict(type="text", text="hi")])
                   + line(type="system", subtype="compact_boundary", uuid="c1", timestamp=at(31), compactMetadata=dict(preTokens=150000), **S)
                   + assistant("a2", "m2", at(50), [dict(type="text", text="hi")], input_tokens=1000, cache_read_input_tokens=54000,
                               cache_creation_input_tokens=0, cache_creation=dict()))
        self.ingest()
        got = self.run_session()
        self.assertEqual((got["context"], got["window"]), (55000, 1000000))
        self.assertEqual(got["compactions"], [dict(ts="2026-11-10T10:00:31.000Z", pre=150000)])
        self.assertEqual((got["requests"], got["spark"]["per_minute"]), (2, 180 + 55020))
        self.assertGreater(got["cache_read"], 0.9)

    def test_unknown_window(self):
        self.write("s1.jsonl", assistant("a1", "m1", at(30), [dict(type="text", text="hi")], model="mystery-1"))
        self.ingest()
        got = self.run_session()
        self.assertEqual((got["context"], got["window"]), (160, None))

    def test_unknown_session_and_bad_cursor(self):
        self.assertIsNone(self.run_session(sid="nope"))
        self.write("s1.jsonl", prompt("u1", at(0), "p1", "go"))
        self.ingest()
        with self.assertRaises(ValueError):
            self.run_session(after="yesterday")


class CodexSessionTest(CodexCase):
    def test_same_event_kinds_as_claude(self):
        self.place(NAME, meta(THREAD).replace("2026-11-06T10:00:00.000Z", at(0))
                   + codex_line(1, 1, "event_msg", type="task_started", turn_id="t1", model_context_window=272000)
                   + codex_line(2, 2, "event_msg", type="item_completed", turn_id="t1", item=dict(type="UserMessage", content=[dict(type="text", text="go")]))
                   + codex_line(3, 3, "response_item", type="function_call", name="spawn_agent", call_id="c0", arguments=json.dumps(dict(task_name="review")))
                   + codex_line(4, 4, "response_item", type="function_call_output", call_id="c0", output=json.dumps(dict(task_name="review")))
                   + codex_line(5, 5, "response_item", type="custom_tool_call", name="exec", call_id="c1", input="run tests")
                   + codex_line(6, 6, "token_usage_record", turn_id="t1", response_id="r1", usage=dict(input_tokens=900, output_tokens=40)))
        self.ingest()
        got = live.session(self.con.cursor(), THREAD, now=NOW - timedelta(seconds=50), prices=PRICES)  # exec pending 5 s
        self.assertEqual([e["k"] for e in got["events"]], ["turn_start", "prompt", "tool", "tool"])
        exec_ev = got["events"][3]
        self.assertEqual((exec_ev["tool"], exec_ev["end"]), ("exec", None))
        self.assertEqual((got["state"]["kind"], got["window"]), ("tool", 272000))
        self.assertEqual((exec_ev["long"], got["state"]["long"], got["lanes"]), (False, False, {}))
        self.assertEqual([e["quiet"] for e in got["events"] if e["k"] == "tool"], [False, False])

    def test_read_only_shell_calls_marked_quiet(self):
        call = lambda i, cmd: codex_line(i, i, "response_item", type="function_call", name="exec_command", call_id=f"c{i}", arguments=json.dumps(dict(cmd=cmd)))
        self.place(NAME, meta(THREAD).replace("2026-11-06T10:00:00.000Z", at(0)) + call(1, "rg TODO src") + call(2, "rg TODO src && rm notes.md"))
        self.ingest()
        got = live.session(self.con.cursor(), THREAD, now=NOW, prices=PRICES)
        self.assertEqual([e["quiet"] for e in got["events"]], [True, False])

    def test_thread_lane_cost_and_model(self):
        thread = "0a0f9999-0000-7000-8000-000000000002"
        self.place(NAME, meta(THREAD).replace("2026-11-06T10:00:00.000Z", at(0))
                   + codex_line(1, 1, "turn_context", turn_id="t1", model="claude-opus-5-5")
                   + codex_line(2, 2, "token_usage_record", turn_id="t1", response_id="r1", usage=dict(input_tokens=1000000, output_tokens=0)))
        self.place(NAME.replace(THREAD, thread), meta(THREAD, thread).replace("2026-11-06T10:00:00.000Z", at(3))
                   + codex_line(1, 4, "turn_context", turn_id="u1", model="claude-opus-5-5")
                   + codex_line(2, 5, "response_item", type="function_call", name="exec_command", call_id="c1", arguments=json.dumps(dict(cmd="ls")))
                   + codex_line(3, 6, "token_usage_record", turn_id="u1", response_id="r2", usage=dict(input_tokens=500000, output_tokens=0)))
        self.ingest()
        got = live.session(self.con.cursor(), THREAD, now=NOW, prices=PRICES)
        self.assertEqual(got["lanes"], {thread: dict(cost=2.0, model="claude-opus-5-5")})
        self.assertEqual([e["lane"] for e in got["events"] if e["k"] == "tool"], [thread])
        self.assertAlmostEqual(got["cost"], 6.0)

    def test_thread_turn_marks_carry_its_lane(self):  # no call names a Codex lane: the page tells it done by these
        thread = "0a0f9999-0000-7000-8000-000000000002"
        child = NAME.replace(THREAD, thread)
        self.place(NAME, meta(THREAD).replace("2026-11-06T10:00:00.000Z", at(0)) + codex_line(1, 1, "event_msg", type="task_started", turn_id="t1"))
        self.place(child, meta(THREAD, thread).replace("2026-11-06T10:00:00.000Z", at(3))
                   + codex_line(1, 4, "event_msg", type="task_started", turn_id="u1")
                   + codex_line(2, 5, "response_item", type="function_call", name="exec_command", call_id="c1", arguments=json.dumps(dict(cmd="ls"))))
        self.ingest()
        marks = lambda got: [(e["k"], e["lane"]) for e in got["events"]]
        first = live.session(self.con.cursor(), THREAD, now=NOW, prices=PRICES)
        self.assertEqual(marks(first), [("turn_start", None), ("turn_start", thread), ("tool", thread)])
        self.place(child, codex_line(3, 6, "response_item", type="function_call_output", call_id="c1", output="a.py")
                   + codex_line(4, 7, "event_msg", type="task_complete", turn_id="u1"), mode="a")
        self.ingest()
        later = live.session(self.con.cursor(), THREAD, after=first["cursor"], now=NOW, prices=PRICES)
        self.assertEqual(marks(later)[-1], ("turn_end", thread))

    def test_continuation_file_is_main_thread_work_not_a_lane(self):
        later = "0a0f9999-0000-7000-8000-000000000002"
        self.place(NAME, meta(THREAD).replace("2026-11-06T10:00:00.000Z", at(0)) + codex_line(1, 1, "event_msg", type="task_started", turn_id="t1"))
        self.place(NAME.replace(THREAD, f"{THREAD}_{later}"), meta(THREAD).replace("2026-11-06T10:00:00.000Z", at(3))
                   + codex_line(1, 4, "turn_context", turn_id="u1", model="claude-opus-5-5")
                   + codex_line(2, 5, "response_item", type="function_call", name="exec_command", call_id="c1", arguments=json.dumps(dict(cmd="ls")))
                   + codex_line(3, 6, "token_usage_record", turn_id="u1", response_id="r2", usage=dict(input_tokens=500000, output_tokens=0)))
        self.ingest()
        got = live.session(self.con.cursor(), THREAD, now=NOW, prices=PRICES)
        self.assertEqual(([e["lane"] for e in got["events"]], got["lanes"]), ([None, None], {}))
        self.assertEqual(self.q("SELECT count(*), count(*) FILTER (WHERE NOT subagent) FROM requests"), [(1, 1)])

    def test_forked_subagent_copied_history_shows_nothing(self):
        thread = "0a0f9999-0000-7000-8000-000000000002"
        child_meta = json.loads(meta(THREAD, thread))
        child_meta["payload"]["subagent_history_start_ordinal"] = 5  # the lines below 5 copy the parent's history
        call = lambda i, secs, cid: codex_line(i, secs, "response_item", type="function_call", name="exec_command", call_id=cid, arguments=json.dumps(dict(cmd="ls")))
        history = (codex_line(1, 1, "event_msg", type="task_started", turn_id="t1")
                   + codex_line(2, 2, "event_msg", type="item_completed", turn_id="t1", item=dict(type="UserMessage", content=[dict(type="text", text="go")]))
                   + call(3, 3, "c1") + codex_line(4, 4, "response_item", type="function_call_output", call_id="c1", output="a"))
        self.place(NAME, meta(THREAD).replace("2026-11-06T10:00:00.000Z", at(0)) + history + codex_line(5, 5, "event_msg", type="task_complete", turn_id="t1"))
        self.place(NAME.replace(THREAD, thread), json.dumps(child_meta | dict(timestamp=at(1))) + "\n" + history
                   + codex_line(5, 6, "event_msg", type="task_started", turn_id="u1") + call(6, 7, "c9"))
        self.ingest()
        marks = lambda got: [(e["k"], e["lane"]) for e in got["events"]]
        got = live.session(self.con.cursor(), THREAD, now=NOW, prices=PRICES)
        self.assertEqual(marks(got), [("turn_start", None), ("prompt", None), ("tool", None), ("turn_end", None),
                                      ("turn_start", thread), ("tool", thread)])
        self.assertEqual(live.session(self.con.cursor(), THREAD, after=at(0), now=NOW, prices=PRICES)["events"], got["events"])
        listed, = live.sessions(self.con.cursor(), now=NOW, prices=PRICES)["sessions"]
        self.assertEqual((listed["latest"]["lane"], listed["latest"]["summary"]), (thread, json.dumps(dict(cmd="ls"))))

    def prompted(self, text=""):
        return codex_line(1, 1, "event_msg", type="item_completed", turn_id="t1", item=dict(type="UserMessage", content=[dict(type="text", text="go")]))

    def test_continuation_file_turn_counts_for_the_main_thread(self):
        later = "0a0f9999-0000-7000-8000-000000000002"
        self.place(NAME, meta(THREAD).replace("2026-11-06T10:00:00.000Z", at(0)) + self.prompted()
                   + codex_line(2, 2, "event_msg", type="task_started", turn_id="t1") + codex_line(3, 9, "event_msg", type="task_complete", turn_id="t1"))
        self.place(NAME.replace(THREAD, f"{THREAD}_{later}"), meta(THREAD).replace("2026-11-06T10:00:00.000Z", at(11))
                   + codex_line(1, 12, "event_msg", type="task_started", turn_id="t2"))
        self.ingest()
        want = dict(kind="thinking", tool=None, since="2026-11-10T10:00:12.000Z", inferred=False, long=False)
        self.assertEqual(live.session(self.con.cursor(), THREAD, now=NOW, prices=PRICES)["state"], want)
        self.assertEqual(live.sessions(self.con.cursor(), now=NOW, prices=PRICES)["sessions"][0]["state"], want)

    def child_of(self, thread, lines):
        self.place(NAME.replace(THREAD, thread), meta(THREAD, thread).replace("2026-11-06T10:00:00.000Z", at(3)) + lines)

    def test_subagent_traffic_does_not_push_the_main_thread_out_of_the_state(self):
        self.place(NAME, meta(THREAD).replace("2026-11-06T10:00:00.000Z", at(0)) + self.prompted()
                   + codex_line(2, 2, "event_msg", type="task_started", turn_id="t1"))
        self.child_of("0a0f9999-0000-7000-8000-000000000002", "".join(codex_line(i, 10, "turn_context", turn_id="u1") for i in range(1, 260)))
        self.ingest()
        want = dict(kind="thinking", tool=None, since="2026-11-10T10:00:02.000Z", inferred=False, long=False)
        self.assertEqual(live.session(self.con.cursor(), THREAD, now=NOW, prices=PRICES)["state"], want)
        self.assertEqual(live.sessions(self.con.cursor(), now=NOW, prices=PRICES)["sessions"][0]["state"], want)

    def test_long_turn_still_reads_thinking(self):
        self.place(NAME, meta(THREAD).replace("2026-11-06T10:00:00.000Z", at(0)) + self.prompted()
                   + codex_line(2, 2, "event_msg", type="task_started", turn_id="t1")
                   + "".join(codex_line(i, 10, "turn_context", turn_id="t1") for i in range(3, 300)))
        self.ingest()
        want = dict(kind="thinking", tool=None, since="2026-11-10T10:00:02.000Z", inferred=False, long=False)
        self.assertEqual(live.session(self.con.cursor(), THREAD, now=NOW, prices=PRICES)["state"], want)
        self.assertEqual(live.sessions(self.con.cursor(), now=NOW, prices=PRICES)["sessions"][0]["state"], want)

    def test_child_turn_end_leaves_a_working_parent_as_it_is_in_a_store(self):
        self.place(NAME, meta(THREAD).replace("2026-11-06T10:00:00.000Z", at(0)) + self.prompted()
                   + codex_line(2, 2, "event_msg", type="task_started", turn_id="t1"))
        self.child_of("0a0f9999-0000-7000-8000-000000000002", codex_line(1, 4, "event_msg", type="task_started", turn_id="u1")
                      + codex_line(2, 8, "event_msg", type="task_complete", turn_id="u1"))
        self.ingest()
        self.assertEqual(live.session(self.con.cursor(), THREAD, now=NOW, prices=PRICES)["state"]["kind"], "thinking")
        self.assertFalse(live.sessions(self.con.cursor(), now=NOW, prices=PRICES)["sessions"][0]["state"]["inferred"])

    def inner(self, ordinal, secs, cid, status="failed", cmd="ls nowhere"):
        """An item_completed line of a command an exec script ran."""
        return codex_line(ordinal, secs, "event_msg", type="item_completed", turn_id="t1", item=dict(
            type="CommandExecution", id=cid, command=["/bin/zsh", "-lc", cmd], status=status, exit_code=2 if status == "failed" else 0,
            aggregated_output="no such file", duration=dict(secs=0, nanos=5000000)))

    def test_failed_command_inside_an_exec_script_is_a_row(self):
        thread = "0a0f9999-0000-7000-8000-000000000002"
        exec_call = lambda cid, secs: codex_line(2, secs, "response_item", type="custom_tool_call", name="exec", call_id=cid, input="run it")
        self.place(NAME, meta(THREAD).replace("2026-11-06T10:00:00.000Z", at(0)) + self.prompted() + exec_call("c1", 2)
                   + self.inner(3, 3, "inner1") + self.inner(4, 4, "inner2", status="completed", cmd="ls")  # a success: nothing
                   + codex_line(5, 5, "response_item", type="custom_tool_call_output", call_id="c1", output="done"))
        self.child_of(thread, self.inner(1, 6, "inner3", cmd="rg x"))
        self.ingest()
        got = live.session(self.con.cursor(), THREAD, now=NOW, prices=PRICES)
        self.assertEqual([(e["tool"], e["id"], e["lane"], e["failed"]) for e in got["events"] if e["k"] == "tool"],
                         [("exec", "c1", None, False), ("exec_command", "inner1", None, True), ("exec_command", "inner3", thread, True)])
        failed = got["events"][2]
        self.assertEqual((failed["summary"], failed["error"], failed["start"], failed["end"], failed["ts"]),
                         ("ls nowhere", "Exit code 2\nno such file", "2026-11-10T10:00:03.000Z", "2026-11-10T10:00:03.000Z", "2026-11-10T10:00:03.000Z"))
        self.assertTrue(failed["key"].endswith("#0") and failed["key"].startswith("codex:"))
        again = live.session(self.con.cursor(), THREAD, after=at(2), now=NOW, prices=PRICES)  # a catch-up holds the same key
        self.assertEqual([e["key"] for e in again["events"] if e.get("id") == "inner1"], [failed["key"]])

    def test_failed_inner_call_changes_no_state(self):
        self.place(NAME, meta(THREAD).replace("2026-11-06T10:00:00.000Z", at(0)) + self.prompted()
                   + codex_line(2, 2, "event_msg", type="task_started", turn_id="t1")
                   + codex_line(3, 3, "response_item", type="custom_tool_call", name="update_plan", call_id="c1", input="plan") + self.inner(4, 4, "inner1"))
        self.ingest()
        want = dict(kind="tool", tool="update_plan", since="2026-11-10T10:00:03.000Z", inferred=False, long=False)
        self.assertEqual(live.session(self.con.cursor(), THREAD, now=NOW, prices=PRICES)["state"], want)
        self.assertEqual(live.sessions(self.con.cursor(), now=NOW, prices=PRICES)["sessions"][0]["state"], want)

    def test_failed_item_of_a_known_call_marks_that_call_and_adds_no_row(self):
        self.place(NAME, meta(THREAD).replace("2026-11-06T10:00:00.000Z", at(0)) + self.prompted()
                   + codex_line(2, 2, "response_item", type="function_call", name="exec_command", call_id="c1", arguments=json.dumps(dict(cmd="ls nowhere")))
                   + self.inner(3, 3, "c1"))
        self.ingest()
        tools = [e for e in live.session(self.con.cursor(), THREAD, now=NOW, prices=PRICES)["events"] if e["k"] == "tool"]
        self.assertEqual([(e["id"], e["failed"], e["error"]) for e in tools], [("c1", True, "Exit code 2\nno such file")])

    def test_failed_item_of_a_call_before_the_rows_marks_that_call(self):
        self.place(NAME, meta(THREAD).replace("2026-11-06T10:00:00.000Z", at(0)) + self.prompted()
                   + codex_line(2, 2, "response_item", type="function_call", name="exec_command", call_id="c1", arguments=json.dumps(dict(cmd="ls nowhere"))))
        self.ingest()
        first = live.session(self.con.cursor(), THREAD, now=NOW, prices=PRICES)
        self.place(NAME, self.inner(3, 130, "c1"), mode="a")
        self.ingest()
        later = live.session(self.con.cursor(), THREAD, after=at(125), now=NOW, prices=PRICES)
        self.assertEqual([(e["id"], e["failed"]) for e in later["events"] if e["k"] == "tool"], [("c1", True)])
        self.assertEqual(len(first["events"]), 2)

    def spawn(self, ordinal, secs, thread, call="c3"):
        return codex_line(ordinal, secs, "event_msg", type="item_completed", turn_id="t1", item=dict(
            type="SubAgentActivity", id=call, kind="started", agent_thread_id=thread, agent_path="/root/a"))

    def test_spawn_call_names_its_codex_lane(self):
        thread = "0a0f9999-0000-7000-8000-000000000002"
        self.place(NAME, meta(THREAD).replace("2026-11-06T10:00:00.000Z", at(0)) + self.prompted()
                   + codex_line(2, 3, "response_item", type="function_call", name="spawn_agent", call_id="c3", arguments=json.dumps(dict(task_name="review")))
                   + self.spawn(3, 4, thread))
        self.child_of(thread, codex_line(1, 5, "response_item", type="function_call", name="update_plan", call_id="c9", arguments="{}"))
        self.ingest()
        got = live.session(self.con.cursor(), THREAD, now=NOW, prices=PRICES)
        tools = {e["id"]: e for e in got["events"] if e["k"] == "tool"}
        self.assertEqual((tools["c3"]["agent"], tools["c3"]["end"], tools["c9"]["lane"]), (thread, None, thread))
        self.assertEqual([e["k"] for e in got["events"]], ["prompt", "tool", "tool"])  # the start item shows no event of its own

    def test_spawn_call_before_the_rows_is_sent_again_naming_its_lane(self):
        thread = "0a0f9999-0000-7000-8000-000000000002"
        self.place(NAME, meta(THREAD).replace("2026-11-06T10:00:00.000Z", at(0)) + self.prompted()
                   + codex_line(2, 3, "response_item", type="function_call", name="spawn_agent", call_id="c3", arguments=json.dumps(dict(task_name="review"))))
        self.ingest()
        self.assertIsNone(live.session(self.con.cursor(), THREAD, now=NOW, prices=PRICES)["events"][1]["agent"])
        self.place(NAME, self.spawn(3, 130, thread), mode="a")
        self.ingest()
        later = live.session(self.con.cursor(), THREAD, after=at(125), now=NOW, prices=PRICES)
        call, = [e for e in later["events"] if e["k"] == "tool"]
        self.assertEqual((call["id"], call["agent"], call["end"]), ("c3", thread, None))

    def test_thread_lanes_whose_requests_share_a_time(self):
        threads = ["0a0f9999-0000-7000-8000-000000000002", "0a0f9999-0000-7000-8000-000000000003"]
        self.place(NAME, meta(THREAD).replace("2026-11-06T10:00:00.000Z", at(0)))
        for thread, rid, tokens in zip(threads, ("r2", "r3"), (500000, 250000)):
            self.place(NAME.replace(THREAD, thread), meta(THREAD, thread).replace("2026-11-06T10:00:00.000Z", at(3))
                       + codex_line(1, 4, "turn_context", turn_id="u1", model="claude-opus-5-5")
                       + codex_line(2, 6, "token_usage_record", turn_id="u1", response_id=rid, usage=dict(input_tokens=tokens, output_tokens=0)))
        self.ingest()
        got = live.session(self.con.cursor(), THREAD, now=NOW, prices=PRICES)  # the line that names the request decides its lane
        self.assertEqual(got["lanes"], {threads[0]: dict(cost=2.0, model="claude-opus-5-5"), threads[1]: dict(cost=1.0, model="claude-opus-5-5")})
        self.assertAlmostEqual(got["cost"], 3.0)

    def test_closed_is_never_read_from_a_codex_transcript(self):
        self.place(NAME, meta(THREAD).replace("2026-11-06T10:00:00.000Z", at(0))
                   + codex_line(1, 1, "event_msg", type="task_started", turn_id="t1")
                   + codex_line(2, 9, "event_msg", type="task_complete", turn_id="t1")
                   + line(type="cost-state", ordinal=3))  # no Codex line says the session closed
        self.ingest()
        self.assertEqual(live.session(self.con.cursor(), THREAD, now=NOW, prices=PRICES)["state"]["kind"], "you")


class PageCase(LiveCase):
    """The store behind the Live page fixtures: one session per state, a lane, a failure, a compaction and a Codex turn.
    All text is made up."""

    def codex(self, name, text):
        d = os.path.join(self.roots["codex"], LIVE)
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, name), "w") as fh:
            fh.write(text)

    def build(self):
        sub = dict(S, isSidechain=True, agentId="a7")
        self.write("s1.jsonl", prompt("u1", at(0), "p1", "Add a fast ingest pass while the Live page is open")
                   + line(type="ai-title", aiTitle="Fast ingest pass while Live is open", sessionId="s1")
                   + assistant("a1", "m1", at(2), [dict(type="text", text="Reading the ingest loop first."),
                                                   tool_use("t1", "Read", file_path="store.py")])
                   + result("r1", at(3), "t1", "def ingest(con, roots):\n    ...")
                   + assistant("a2", "m2", at(4), [tool_use("t2", "Agent", description="find callers of ingest", prompt="look")])
                   + line(type="user", uuid="r2", timestamp=at(12), promptId="p1", toolUseResult=dict(agentId="a7"),
                          message=dict(role="user", content=[dict(type="tool_result", tool_use_id="t2", content="3 callers")]), **S)
                   + line(type="system", subtype="compact_boundary", uuid="c1", timestamp=at(13), compactMetadata=dict(preTokens=180000), **S)
                   + assistant("a3", "m3", at(14), [tool_use("t3", "Bash", command="uv run python -m unittest", description="Run the Python tests")])
                   + result("r3", at(20), "t3", "FAIL: test_hot_pass\nAssertionError: 3 != 1", error=True)
                   + assistant("a4", "m4", at(22), [tool_use("t4", "Bash", command="git push origin feat/live-page")]))
        self.write("s1/subagents/agent-a7.jsonl", "".join(
            line(type="assistant", uuid=f"x{i}", timestamp=at(5 + i * 2), message=dict(
                id=f"sm{i}", model="claude-opus-5-5", usage=dict(input_tokens=400, output_tokens=60),
                content=[tool_use(f"st{i}", "Grep", pattern=p)]), **sub)
            + line(type="user", uuid=f"y{i}", timestamp=at(6 + i * 2), message=dict(role="user", content=[
                dict(type="tool_result", tool_use_id=f"st{i}", content="app.py:45")]), **sub)
            for i, p in enumerate(("store.ingest", "INTERVAL", "def loop"))))
        other = lambda text, sid, cwd: text.replace('"s1"', f'"{sid}"').replace("/nowhere/foo", cwd)
        self.write("s2.jsonl", other(assistant("b1", "n1", at(30), [dict(type="text", text="The header shows a relative time.")])
                                     + prompt("v1", at(55), "q2", "Freeze the clock in the snapshot test"), "s2", "/nowhere/jobdesk"))
        self.write("s3.jsonl", other(prompt("w1", at(10), "q3", "Rename the theme tokens")
                                     + line(type="custom-title", sessionId="s1",
                                            customTitle="Rename the theme tokens across every page, the charts and the print stylesheet")
                                     + assistant("e1", "o1", at(40), [dict(type="text", text="Renamed 14 tokens.")]), "s3", "/nowhere/sketchbook"))
        # Only command output in its prompt and no title line: no title.
        self.write("s4.jsonl", other(prompt("z1", "2026-11-10T09:53:00.000Z", "q4", "<local-command-stdout>zsh reloaded</local-command-stdout>"),
                                     "s4", "/nowhere/dotfiles"))
        self.write("s5.jsonl", other(prompt("h1", at(15), "q5", "Sort the reading list") + assistant("i1", "j1", at(35), [dict(type="text", text="Sorted.")])
                                     + line(type="cost-state", sessionId="s1", totalCostUSD=0.02), "s5", "/nowhere/notes"))
        thread = "0a0f7777-0000-7000-8000-000000000007"
        self.codex(f"rollout-2026-11-10T10-00-00-{thread}.jsonl", meta(thread).replace("2026-11-06T10:00:00.000Z", at(0)).replace("/nowhere/foo", "/nowhere/graft")
                   + codex_line(1, 20, "event_msg", type="task_started", turn_id="t1", model_context_window=272000)
                   + codex_line(2, 21, "event_msg", type="item_completed", turn_id="t1", item=dict(type="UserMessage", content=[dict(type="text", text="Bump the rollout parser")]))
                   + codex_line(3, 25, "response_item", type="function_call", name="exec_command", call_id="k1", arguments=json.dumps(dict(cmd="rg response_item src/")))
                   + codex_line(4, 26, "response_item", type="function_call_output", call_id="k1", output="src/rollout.rs:41")
                   + codex_line(5, 27, "token_usage_record", turn_id="t1", response_id="r1", usage=dict(input_tokens=22000, cached_input_tokens=20000, output_tokens=300)))
        self.ingest()
        return thread


def page_fixtures():
    """The Live payloads the page tests render, at NOW: the active list with and without text, a Claude Code session with
    and without text, and a Codex session. Titles: foo from the agent, sketchbook renamed (too long for a tile), jobdesk and
    graft from their first prompt, dotfiles none."""
    case = PageCase()
    case.setUp()
    try:
        thread = case.build()
        cur = case.con.cursor()
        return dict(list=live.sessions(cur, now=NOW, prices=PRICES), list_text=live.sessions(cur, now=NOW, prices=PRICES, text=True),
                    claude=live.session(cur, "s1", now=NOW, prices=PRICES),
                    text=live.session(cur, "s1", text=True, now=NOW, prices=PRICES),
                    codex=live.session(cur, thread, now=NOW, prices=PRICES))
    finally:
        case.tearDown()


class PageFixtureTest(unittest.TestCase):
    def test_every_state_and_shape(self):
        got = page_fixtures()
        states = {s["project"]: s["state"]["kind"] for s in got["list"]["sessions"]}
        self.assertEqual(states, {"foo": "wait", "jobdesk": "thinking", "sketchbook": "you", "dotfiles": "idle", "graft": "thinking",
                                  "notes": "ended"})
        self.assertEqual({k: v["model"] for k, v in got["claude"]["lanes"].items()}, dict(a7="claude-opus-5-5"))
        self.assertAlmostEqual(got["claude"]["lanes"]["a7"]["cost"], 0.0084)
        self.assertEqual({e["lane"] for e in got["claude"]["events"]} - {None}, {"a7"})
        self.assertTrue(any(e.get("failed") for e in got["claude"]["events"]))
        self.assertNotIn("Freeze", json.dumps(got["list"]) + json.dumps(got["claude"]))
        titles = lambda key: {s["project"]: (s["title"], s["title_from"]) for s in got[key]["sessions"]}
        self.assertEqual(titles("list"), {"foo": ("Fast ingest pass while Live is open", "agent"),
                                          "sketchbook": ("Rename the theme tokens across every page, the charts and the print stylesheet", "agent"),
                                          "jobdesk": (None, None), "graft": (None, None), "dotfiles": (None, None), "notes": (None, None)})
        self.assertEqual(titles("list_text")["jobdesk"], ("Freeze the clock in the snapshot test", "prompt"))
        self.assertEqual(titles("list_text")["dotfiles"], (None, None))


if __name__ == "__main__":
    unittest.main()
