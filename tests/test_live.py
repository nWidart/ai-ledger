import json
import os
import shutil
import unittest
from datetime import datetime, timedelta, timezone
from unittest import mock

from ai_ledger import live, store
from test_codex import CodexCase, LIVE, NAME, THREAD, meta, meta_at
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


def reads(call, source="claude"):
    """call()'s answer, the sorted keys of the lines whose stored JSON a Lines read for it, and how many lines of the
    source it parsed into live items."""
    src = store.SOURCES[source]
    parse = mock.Mock(wraps=src.live_items)
    with mock.patch.object(live.Lines, "fetch", autospec=True, side_effect=live.Lines.fetch) as fetch, \
            mock.patch.dict(store.SOURCES, {source: src._replace(live_items=parse)}):
        got = call()
    return got, sorted(k for c in fetch.call_args_list for k in c.args[2]), parse.call_count


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

    def test_a_claude_turn_follows_its_newest_mark(self):
        text = (prompt("u1", at(0), "p1", "go") + assistant("a1", "m1", at(5), [tool_use("t1", "Read", file_path="x")])
                + result("r1", at(6), "t1", "ok") + assistant("a2", "m2", at(8), [dict(type="text", text="Done.")]))
        self.assertEqual(self.state(text)["kind"], "you")  # a reply ends the turn
        st = self.state(assistant("a1", "m1", at(5), [dict(type="text", text="Done.")]) + prompt("u1", at(30), "p2", "more"))
        self.assertEqual((st["kind"], st["inferred"]), ("thinking", True))  # a prompt sent
        text = assistant("a1", "m1", at(5), [tool_use("t1", "Read", file_path="x")]) + result("r1", at(6), "t1", "ok")
        self.assertEqual(self.state(text)["kind"], "thinking")  # a tool result

    def test_quiet_session_is_idle_even_with_a_pending_call(self):
        text = assistant("a1", "m1", at(0), [tool_use("t1", "Bash", command="sleep 999")])
        st = self.state(text, now=NOW + timedelta(minutes=6))
        self.assertEqual(st["kind"], "idle")

    def test_slow_shell_call_is_likely_waiting(self):
        st = self.state(assistant("a1", "m1", at(15), [tool_use("t1", "Bash", command="git push")]))
        self.assertEqual(st, dict(kind="wait", tool="Bash", since="2026-11-10T10:00:15.000Z", inferred=True, long=False))
        # A background call returns at once: one still pending waits.
        st = self.state(assistant("a1", "m1", at(15), [tool_use("t1", "Bash", command="npm run dev", run_in_background=True)]))
        self.assertEqual(st, dict(kind="wait", tool="Bash", since="2026-11-10T10:00:15.000Z", inferred=True, long=False))
        # Codex's exec runs a script that calls the shell.
        text = codex_line(1, 15, "response_item", type="custom_tool_call", name="exec", call_id="c1", input="run")
        self.assertEqual(self.state(text, "codex")["kind"], "wait")

    def test_slow_call_that_waits_on_no_approval_is_running(self):
        pending = lambda **inp: self.state(assistant("a1", "m1", at(15), [tool_use("t1", "Bash", command="make test", **inp)]))
        self.assertEqual((pending(timeout=600000)["kind"], pending(timeout=600000)["long"]), ("tool", True))
        self.assertEqual((pending(timeout=120000)["kind"], pending(timeout=120000)["long"]), ("wait", False))  # not above 120 s
        self.assertEqual(pending(timeout="600000")["kind"], "wait")
        st = self.state(assistant("a1", "m1", at(15), [tool_use("t1", "WebFetch", url="https://example.com")]))  # no shell call
        self.assertEqual((st["kind"], st["inferred"]), ("tool", False))

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

    def test_codex_turn_in_progress_is_thinking_not_inferred(self):
        text = (codex_line(1, 0, "event_msg", type="task_started", turn_id="t1", model_context_window=272000)
                + codex_line(2, 1, "event_msg", type="item_completed", turn_id="t1", item=dict(type="UserMessage", content=[dict(type="text", text="go")])))
        self.assertEqual(self.state(text, "codex"), dict(kind="thinking", tool=None, since="2026-11-10T10:00:00.000Z", inferred=False, long=False))
        text = (codex_line(1, 0, "event_msg", type="task_started", turn_id="t1")
                + codex_line(2, 9, "event_msg", type="task_complete", turn_id="t1"))
        self.assertEqual(self.state(text, "codex")["kind"], "you")  # a completed turn is your turn

    def lanes(self, main, sub, source="codex", now=NOW):
        """The state of a session whose main thread holds the lines main and a subagent the lines sub."""
        lane_file = "/x/agent-a1.jsonl" if source == "claude" else NAME.replace(THREAD, "0a0f9999-0000-7000-8000-000000000002")
        evs = events(main, source) + events(sub, source, lane_file=lane_file)
        evs.sort(key=lambda e: e["ts"])
        return live.state(evs, now, source, max(e["ts"] for e in evs))

    def test_codex_subagent_at_work_keeps_the_session_thinking(self):
        main = codex_line(1, 0, "event_msg", type="task_started", turn_id="t1") + codex_line(2, 9, "event_msg", type="task_complete", turn_id="t1")
        started = codex_line(1, 12, "event_msg", type="task_started", turn_id="u1")
        self.assertEqual(self.lanes(main, started), dict(kind="thinking", tool=None, since="2026-11-10T10:00:12.000Z", inferred=True, long=False))
        done = started + codex_line(2, 15, "event_msg", type="task_complete", turn_id="u1")
        self.assertEqual(self.lanes(main, done), dict(kind="you", tool=None, since="2026-11-10T10:00:09.000Z", inferred=False, long=False))
        older = codex_line(1, 3, "event_msg", type="task_started", turn_id="u1")  # the main thread wrote after it
        self.assertEqual(self.lanes(main, older)["kind"], "you")

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
        self.assertEqual((s1["state"]["kind"], s1["window"], s1["requests"]), ("tool", 1000000, 1))
        listed = lambda lines=None: live.sessions(self.cur(), now=NOW, prices=PRICES, lines=lines)
        kept = live.Lines()
        self.assertEqual(listed(kept), got)
        # Three new lines: a repeated read parses those only, and answers as a read with nothing kept.
        self.write("s1.jsonl", result("r1", at(41), "t1", "x") + assistant("a2", "m2", at(42), [dict(type="text", text="ok")])
                   + prompt("u2", at(43), "p2", "more"))
        self.ingest()
        again, fetched, parsed = reads(lambda: listed(kept))
        self.assertEqual((again, fetched, parsed, again["sessions"][0]["state"]["kind"]), (listed(), ["a2", "r1", "u2"], 3, "thinking"))
        # Past either bound, kept lines are dropped: a read that needs them reads them again, and answers the same.
        for bound in ("KEPT_BYTES", "KEPT_LINES"):
            with self.subTest(bound=bound), mock.patch.object(live, bound, 1):
                kept = live.Lines()
                listed(kept)
                got, fetched, _ = reads(lambda: listed(kept))
                self.assertEqual((got, bool(fetched)), (again, True))

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
        # A close line in an earlier main file ends no session.
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
            live.sessions(self.cur(), source="gemini", now=NOW)
        # An automated session is hidden by default.
        self.con.execute("UPDATE sessions SET project = 'observer-sessions' WHERE session_id = 's2'")
        self.assertEqual([s["session_id"] for s in live.sessions(self.cur(), now=NOW, prices=PRICES)["sessions"]], ["s1"])
        self.assertEqual(len(live.sessions(self.cur(), automated=True, now=NOW, prices=PRICES)["sessions"]), 2)

    def test_empty_state_names_the_newest_session(self):
        got = live.sessions(self.cur(), now=NOW + timedelta(hours=1), prices=PRICES)
        self.assertEqual((got["sessions"], got["newest"]["session_id"]), ([], "s1"))

    def test_waiting_counts_your_turn_and_likely_approval_waits(self):
        self.assertEqual(live.waiting(self.cur(), now=NOW), 1)  # s2 is in your turn; s1 runs Read
        self.write("s4.jsonl", (prompt("x1", at(0), "y1", "go") + assistant("c1", "o1", at(5), [tool_use("t9", "Bash", command="make")])).replace('"s1"', '"s4"'))
        self.ingest()
        self.assertEqual(live.waiting(self.cur(), now=NOW), 2)  # a shell call pending past 30 s
        kinds = [s["state"]["kind"] for s in live.sessions(self.cur(), now=NOW, prices=PRICES)["sessions"]]
        self.assertEqual(sum(k in live.WAITING for k in kinds), 2)  # as the list says

    def test_waiting_covers_every_project_and_source_and_leaves_automated_sessions_out(self):
        self.assertEqual(live.waiting(self.cur(), now=NOW + timedelta(hours=1)), 0)  # no active session
        self.con.execute("UPDATE sessions SET source = 'codex' WHERE session_id = 's2'")
        self.assertEqual(live.waiting(self.cur(), now=NOW), 1)
        self.con.execute("UPDATE sessions SET project = 'observer-sessions' WHERE session_id = 's2'")
        self.assertEqual(live.waiting(self.cur(), now=NOW), 0)


class TitleTest(LiveCase):
    def setUp(self):
        super().setUp()
        self.write("s1.jsonl", prompt("u1", at(30), "p1", "SENTINEL prompt. More") + line(type="ai-title", aiTitle="Add session titles", sessionId="s1"))
        self.write("s2.jsonl", prompt("v1", at(20), "q1", "SENTINEL other. More").replace('"s1"', '"s2"'))
        self.ingest()

    def listed(self, text=False):
        return {s["session_id"]: (s["title"], s["title_from"]) for s in live.sessions(self.cur(), now=NOW, prices=PRICES, text=text)["sessions"]}

    def test_prompt_title_only_with_text(self):
        self.assertEqual(self.listed()["s1"], ("Add session titles", "agent"))  # the agent's title, with text or without
        self.assertEqual(self.listed(text=True)["s1"], ("Add session titles", "agent"))
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
        kept = live.Lines()
        first = self.run_session(lines=kept)
        self.assertEqual([e["k"] for e in first["events"]], ["prompt", "tool"])
        self.assertFalse(first["truncated"])
        self.write("s1.jsonl", result("r1", at(3), "t1", "a\nb") + assistant("a2", "m2", at(4), [tool_use("t2", "Read", file_path="x"),
                                                                                                 tool_use("t3", "Grep", pattern="y")]))
        self.ingest()
        # With the lines kept, the state and the window parse only the 2 new lines, from the text the catch-up read.
        later, fetched, parsed = reads(lambda: self.run_session(after=first["cursor"], lines=kept))
        self.assertEqual((later, fetched, parsed), (self.run_session(after=first["cursor"]), [], 2))
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
        kept = live.Lines()
        first = self.run_session(lines=kept)
        self.assertEqual(first["cursor"], at(20))
        self.write("s1.jsonl", result("r1", at(4), "t1", "ok"))  # stamped before the cursor, stored after it
        self.ingest()
        t1, = [e for e in self.run_session(after=first["cursor"])["events"] if e["id"] == "t1"]
        self.assertEqual(t1["end"], "2026-11-10T10:00:04.000Z")
        listed = lambda lines=None: live.sessions(self.cur(), automated=True, now=NOW, prices=PRICES, lines=lines)["sessions"]
        got, fetched, _ = reads(lambda: listed(kept))  # the active list reads it, with lines kept
        self.assertEqual((got, len(got), fetched), (listed(), 1, ["r1"]))

    def test_call_finishing_with_a_failure_is_sent_again(self):
        # The call is older than the cursor; its result, a failure, comes after it. The catch-up sends the call again, under its own key.
        self.write("s1.jsonl", assistant("a1", "m1", at(1), [tool_use("t1", "Bash", command="make")])
                   + assistant("a2", "m2", at(4), [dict(type="text", text="still running")]))
        self.ingest()
        first = self.run_session()
        self.assertEqual(first["cursor"], at(4))
        self.write("s1.jsonl", result("r1", at(9), "t1", "Exit code 2\nboom", error=True))
        self.ingest()
        t1, = [e for e in self.run_session(after=first["cursor"])["events"] if e["k"] == "tool"]
        self.assertEqual((t1["id"], t1["key"], t1["failed"], t1["error"], t1["end"]),
                         ("t1", "a1#1", True, "Exit code 2\nboom", "2026-11-10T10:00:09.000Z"))

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

    def test_figures(self):
        self.write("s1.jsonl", assistant("a1", "m1", at(30), [dict(type="text", text="hi")])
                   + line(type="system", subtype="compact_boundary", uuid="c1", timestamp=at(31), compactMetadata=dict(preTokens=150000), **S)
                   + assistant("a2", "m2", at(50), [dict(type="text", text="hi")], input_tokens=1000, cache_read_input_tokens=54000,
                               cache_creation_input_tokens=0, cache_creation=dict()))
        self.ingest()
        got = self.run_session()
        self.assertEqual((got["context"], got["window"]), (55000, 1000000))
        self.assertEqual(got["compactions"], [dict(ts="2026-11-10T10:00:31.000Z", pre=150000)])
        self.assertEqual(got["requests"], 2)
        self.assertEqual(got["pulse"]["context"], [dict(ts=at(30), tokens=160), dict(ts=at(50), tokens=55000)])  # what each read, no output
        self.assertGreater(got["cache_read"], 0.9)

    def test_pulse(self):
        sub = dict(S, isSidechain=True, agentId="a7")
        self.write("s1.jsonl", assistant("a0", "m0", at(-700), [dict(type="text", text="hi")], input_tokens=30000, cache_read_input_tokens=0,
                                         cache_creation_input_tokens=0, cache_creation=dict())  # before the span: the oldest ignored
                   + assistant("a1", "m1", at(-600), [tool_use("t1", "Bash", command="ls")], input_tokens=40000, cache_read_input_tokens=0,
                               cache_creation_input_tokens=0, cache_creation=dict())  # 11 minutes before NOW: the starting level
                   + result("r1", at(-590), "t1", "x")  # ended before the span: no tick
                   + assistant("a2", "m2", at(40), [tool_use("t2", "Bash", command="ls"), tool_use("t3", "Read", file_path="x")],
                               input_tokens=2000, cache_read_input_tokens=60000, cache_creation_input_tokens=0, cache_creation=dict())
                   + result("r2", at(42), "t2", "boom", error=True) + result("r3", at(43), "t3", "ok"))
        self.write("s1/subagents/agent-a7.jsonl", line(type="assistant", uuid="x1", timestamp=at(45), message=dict(
            id="sm1", model="claude-opus-5-5", content=[tool_use("st1", "Grep", pattern="x")],
            usage=dict(input_tokens=999999, output_tokens=1)), **sub)
            + line(type="user", uuid="x2", timestamp=at(50), message=dict(role="user", content=[
                dict(type="tool_result", tool_use_id="st1", content="no", is_error=True)]), **sub))
        self.ingest()
        p = self.run_session()["pulse"]
        self.assertEqual((p["start"], p["end"]), ("2026-11-10T09:51:00.000Z", "2026-11-10T10:01:00.000Z"))
        self.assertEqual(p["context"], [dict(ts=at(-600), tokens=40000), dict(ts=at(40), tokens=62000)])  # no subagent request
        self.assertEqual(p["ticks"], [dict(ts=at(42), failed=True), dict(ts=at(43), failed=False), dict(ts=at(50), failed=True)])

    def test_pulse_ends_at_now(self):  # a request or a call stamped after now falls past the pulse's end: none counts
        none = dict(input_tokens=0, cache_read_input_tokens=0, cache_creation_input_tokens=0, cache_creation=dict())
        self.write("s1.jsonl", assistant("a1", "m1", at(40), [tool_use("t1", "Bash", command="ls")], **dict(none, input_tokens=40000))
                   + result("r1", at(45), "t1", "x")
                   + assistant("a2", "m2", at(71), [tool_use("t2", "Read", file_path="x")], **dict(none, input_tokens=90000))
                   + result("r2", at(72), "t2", "ok"))
        self.ingest()
        p = self.run_session()["pulse"]  # NOW is 10:01:00, at(71) 10:01:11
        self.assertEqual(p["end"], "2026-11-10T10:01:00.000Z")
        self.assertEqual((p["context"], p["ticks"]), ([dict(ts=at(40), tokens=40000)], [dict(ts=at(45), failed=False)]))

    def test_unknown_window(self):
        self.write("s1.jsonl", assistant("a1", "m1", at(30), [dict(type="text", text="hi")], model="mystery-1"))
        self.ingest()
        got = self.run_session()
        self.assertEqual((got["context"], got["window"]), (160, None))


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

    def test_aborted_turn_ends_its_open_call(self):
        # A call with no output when the turn is aborted is over: it ends, failed, as the interruption, also on a
        # catch-up whose window starts after the call.
        self.place(NAME, meta(THREAD).replace("2026-11-06T10:00:00.000Z", at(0))
                   + codex_line(1, 1, "event_msg", type="task_started", turn_id="t1")
                   + codex_line(2, 2, "response_item", type="function_call", name="exec_command", call_id="c1", arguments=json.dumps(dict(cmd="sleep 600")))
                   + codex_line(3, 70, "event_msg", type="agent_message", message="still going"))
        self.ingest()
        cur, kept = self.con.cursor(), live.Lines()
        first = live.session(cur, THREAD, now=NOW, prices=PRICES, lines=kept)
        self.assertEqual([e["end"] for e in first["events"] if e["k"] == "tool"], [None])
        self.place(NAME, codex_line(4, 80, "event_msg", type="turn_aborted", turn_id="t1", reason="interrupted"), mode="a")
        self.ingest()
        for after in ("", first["cursor"]):
            got = live.session(cur, THREAD, after=after, now=NOW, prices=PRICES, lines=kept)
            ev, = [e for e in got["events"] if e["k"] == "tool"]
            self.assertEqual((ev["id"], ev["end"], ev["failed"], ev["error"]), ("c1", at(80), True, live.INTERRUPTED))
            self.assertEqual(got["state"]["kind"], "you")
        # The marks the list reads, and the turn start before a cut that open_before reads: the same with the lines kept.
        marks = lambda **kw: sorted(live.turn_mark_rows(cur, [THREAD], store.SOURCES["codex"].turns, **kw))
        for kw, n in ((dict(), 2), (dict(starts=True, before=at(80)), 1)):
            self.assertEqual((marks(lines=kept, **kw), len(marks(**kw))), (marks(**kw), n))

    def test_window_the_same_on_a_first_load_a_catch_up_and_the_list(self):
        # An unpriced model: only the turn's start states the window, and it is older than a catch-up's one-minute overlap.
        self.place(NAME, meta(THREAD).replace("2026-11-06T10:00:00.000Z", at(0))
                   + codex_line(1, 1, "event_msg", type="task_started", turn_id="t1", model_context_window=272000)
                   + codex_line(2, 2, "turn_context", turn_id="t1", model="mystery-1")
                   + codex_line(3, 3, "token_usage_record", turn_id="t1", response_id="r1", usage=dict(input_tokens=900, output_tokens=40))
                   + codex_line(4, 100, "event_msg", type="task_complete", turn_id="t1")
                   + codex_line(5, 110, "response_item", type="custom_tool_call", name="exec", call_id="c1", input="run tests"))
        self.ingest()
        cur, now = self.con.cursor(), NOW + timedelta(seconds=60)
        first = live.session(cur, THREAD, now=now, prices=PRICES)
        caught = live.session(cur, THREAD, after=first["cursor"], now=now, prices=PRICES)
        listed = live.sessions(cur, automated=True, now=now, prices=PRICES)["sessions"][0]  # the test store reads it as automated
        self.assertEqual("turn_start" in [e["k"] for e in caught["events"]], False)
        self.assertEqual((first["window"], caught["window"], listed["window"]), (272000, 272000, 272000))

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
        kept = live.Lines()
        self.assertEqual(live.forked(self.con.cursor(), [THREAD], kept), {thread: 5})
        self.assertEqual(reads(lambda: live.forked(self.con.cursor(), [THREAD], kept), "codex")[:2], ({thread: 5}, []))  # read once

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

    CHILD = "0a0f9999-0000-7000-8000-000000000002"

    def fork(self, lines, start=None, **extra):
        """The file of subagent CHILD, forked from THREAD: its own session_meta, then lines."""
        if start is not None:
            extra["subagent_history_start_ordinal"] = start
        return self.place(NAME.replace(THREAD, self.CHILD), meta_at(0, at(1), THREAD, self.CHILD, **extra) + lines)

    def marks(self):
        got = live.session(self.con.cursor(), THREAD, now=NOW, prices=PRICES)
        return [(e["k"], e["lane"]) for e in got["events"]]

    def test_forked_copied_history_stays_hidden_when_its_lines_are_stored_under_another_path(self):
        started = lambda i, secs: codex_line(i, secs, "event_msg", type="task_started", turn_id="t1")
        self.place(NAME, meta_at(0, at(0), THREAD))
        self.fork(started(1, 1), start=4)
        self.ingest()
        full = meta_at(0, at(1), THREAD, self.CHILD, subagent_history_start_ordinal=4) + started(1, 1) + started(2, 2) \
            + meta_at(3, at(2), THREAD) + started(4, 6)
        self.place(NAME.replace(THREAD, self.CHILD), full, where="archived_sessions", zst=True)
        shutil.rmtree(os.path.join(self.home, LIVE))
        self.place(NAME, meta_at(0, at(0), THREAD))
        self.ingest()
        self.assertEqual(self.marks(), [("turn_start", self.CHILD)])

    def test_forked_start_ordinal_that_is_null_or_only_mentioned_is_ignored(self):
        for extra in (dict(subagent_history_start_ordinal=None), dict(instructions="mentions subagent_history_start_ordinal")):
            with self.subTest(extra=extra):
                self.place(NAME, meta_at(0, at(0), THREAD))
                self.fork(codex_line(1, 2, "event_msg", type="task_started", turn_id="u1"), **extra)
                self.ingest()
                self.assertEqual(self.marks(), [("turn_start", self.CHILD)])

    def test_subagent_turn_older_than_the_shared_window_still_counts_as_at_work(self):
        self.place(NAME, meta_at(0, at(0), THREAD) + self.prompted() + codex_line(2, 2, "event_msg", type="task_started", turn_id="t1")
                   + codex_line(3, 3, "event_msg", type="task_complete", turn_id="t1"))
        self.fork(codex_line(1, 10, "event_msg", type="task_started", turn_id="u1")
                  + "".join(codex_line(i, 11 + i // 10, "turn_context", turn_id="u1") for i in range(2, 300)))
        self.ingest()
        self.assertEqual(live.session(self.con.cursor(), THREAD, now=NOW, prices=PRICES)["state"]["kind"], "thinking")
        self.assertEqual(live.sessions(self.con.cursor(), now=NOW, prices=PRICES)["sessions"][0]["state"]["kind"], "thinking")

    def test_spawn_call_older_than_the_loaded_rows_is_sent_again_naming_its_lane(self):
        spawn = codex_line(2, 3, "response_item", type="function_call", name="spawn_agent", call_id="c3", arguments="{}")
        started = codex_line(3, 4, "event_msg", type="item_completed", turn_id="t1",
                             item=dict(type="SubAgentActivity", id="c3", kind="started", agent_thread_id=self.CHILD))
        chatter = "".join(codex_line(i, 5 + i // 1000, "turn_context", turn_id="t1") for i in range(4, 3200)) \
            + "".join(codex_line(i, 20, "response_item", type="function_call", name="update_plan", call_id=f"x{i}", arguments="{}") for i in range(3200, 3300))
        self.place(NAME, meta_at(0, at(0), THREAD) + spawn + started + chatter)
        self.fork(codex_line(1, 30, "response_item", type="function_call", name="update_plan", call_id="k1", arguments="{}"))
        self.ingest()
        got = live.session(self.con.cursor(), THREAD, now=NOW, prices=PRICES)
        self.assertEqual([(e["id"], e["agent"]) for e in got["events"] if e["k"] == "tool" and e["id"] in ("c3", "k1")],
                         [("c3", self.CHILD), ("k1", None)])

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


PROMPT_MD = """## Add a fast ingest pass while the Live page is open

Keep the rail readable at a glance:

- keep each **title** whole on two lines
- never cut a `state` tag

See [the council notes](https://example.com/council) first."""
REPLY_MD = """### Plan

1. Measure the rail at **1280 px**.
2. Clamp titles with `line-clamp: 2`.

| Part | Width | Cut |
| --- | ---: | --- |
| title | 220 px | no |
| state tag | 96 px | no |

```css
.rail .ttl { line-clamp: 2; }
```

Details in [the design doc](https://example.com/design)."""
LONG_COMMAND = ("cd /Users/example/Sites/projects/ai-ledger && uv run pytest tests/test_live.py tests/test_web_fixtures.py -q -x "
                "--no-header -p no:cacheprovider 2>&1 | tee /Users/example/Library/Caches/ai-ledger/pytest-live.log")
DELEGATE = dict(target=dict(provider="codex", model="gpt-6.2-sol", options=dict(reasoningEffort="high")),
                isolation="worktree", task=("Review the Live page fixtures in tests/test_live.py against real sessions: titles, "
                                            "branches, long MCP names and Markdown replies. Report each gap with the file and line."))


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
        # Shapes as real sessions have them: a prompt and a reply in Markdown, a shell command at the 200-character mark
        # with absolute paths and an MCP call with a long JSON input.
        self.write("s1.jsonl", prompt("u1", at(0), "p1", PROMPT_MD)
                   + line(type="ai-title", aiTitle="Fast ingest pass while the Live page stays open and polling", sessionId="s1")
                   + assistant("a1", "m1", at(2), [dict(type="text", text=REPLY_MD), tool_use("t1", "Read", file_path="store.py"),
                                                   tool_use("t0", "mcp__t3-code__delegate_task", **DELEGATE)])
                   + result("r1", at(3), "t1", "def ingest(con, roots):\n    ...")
                   + result("r0", at(3), "t0", json.dumps(dict(taskId="task_7f3a", status="queued")))
                   + assistant("a2", "m2", at(4), [tool_use("t2", "Agent", description="find callers of ingest", prompt="look")])
                   + line(type="user", uuid="r2", timestamp=at(12), promptId="p1", toolUseResult=dict(agentId="a7"),
                          message=dict(role="user", content=[dict(type="tool_result", tool_use_id="t2", content="3 callers")]), **S)
                   + line(type="system", subtype="compact_boundary", uuid="c1", timestamp=at(13), compactMetadata=dict(preTokens=180000), **S)
                   + assistant("a3", "m3", at(14), [tool_use("t3", "Bash", command=LONG_COMMAND, description="Run the Python tests")])
                   + result("r3", at(20), "t3", "FAIL: test_hot_pass\nAssertionError: 3 != 1", error=True)
                   + assistant("a4", "m4", at(22), [tool_use("t4", "Bash", command="git push origin feat/live-page")]))
        self.write("s1/subagents/agent-a7.jsonl", "".join(
            line(type="assistant", uuid=f"x{i}", timestamp=at(5 + i * 2), message=dict(
                id=f"sm{i}", model="claude-opus-5-5", usage=dict(input_tokens=400, output_tokens=60),
                content=[tool_use(f"st{i}", "Grep", pattern=p)]), **sub)
            + line(type="user", uuid=f"y{i}", timestamp=at(6 + i * 2), message=dict(role="user", content=[
                dict(type="tool_result", tool_use_id=f"st{i}", content="app.py:45")]), **sub)
            for i, p in enumerate(("store.ingest", "INTERVAL", "def loop"))))
        def other(text, sid, cwd, title=None, branch="main"):
            named = line(type="ai-title", aiTitle=title, sessionId="s1") if title else ""
            return (text + named).replace('"s1"', f'"{sid}"').replace("/nowhere/foo", cwd).replace('"gitBranch": "main"', f'"gitBranch": "{branch}"')
        self.write("s2.jsonl", other(assistant("b1", "n1", at(30), [dict(type="text", text="The header shows a relative time.")])
                                     + prompt("v1", at(55), "q2", "Freeze the clock in the snapshot test so the header stops drifting"), "s2", "/nowhere/jobdesk"))
        self.write("s3.jsonl", other(prompt("w1", at(10), "q3", "Rename the theme tokens")
                                     + line(type="custom-title", sessionId="s1",
                                            customTitle="Rename the theme tokens across every page, the charts and the print stylesheet")
                                     + assistant("e1", "o1", at(40), [dict(type="text", text="Renamed 14 tokens.")]), "s3", "/nowhere/sketchbook"))
        self.write("s4.jsonl", other(prompt("z1", "2026-11-10T09:53:00.000Z", "q4", "<local-command-stdout>zsh reloaded</local-command-stdout>"),
                                     "s4", "/nowhere/dotfiles", "Reload the zsh config and find what slows every new prompt"))
        self.write("s5.jsonl", other(prompt("h1", at(15), "q5", "Sort the reading list") + assistant("i1", "j1", at(35), [dict(type="text", text="Sorted.")])
                                     + line(type="cost-state", sessionId="s1", totalCostUSD=0.02), "s5", "/nowhere/notes",
                                     "Sort the reading list by topic and drop the finished books"))
        # Six more at work, as a busy morning has them: a long MCP call running, a long shell call, a 30-character branch.
        self.write("s6.jsonl", other(prompt("k1", at(40), "q6", "Delegate the fixture review")
                                     + assistant("l1", "p1", at(50), [tool_use("lt1", "mcp__t3-code__delegate_task", **DELEGATE)]),
                                     "s6", "/nowhere/ai-ledger", "Delegate the Live fixture review to a second model and merge it", "feat/live-rail-state-tag-width"))
        self.write("s7.jsonl", other(prompt("k2", at(45), "q7", "Profile the ingest"), "s7", "/nowhere/ingest-bench",
                                     "Profile the ingest of a 2 GB transcript folder and find the hot loop", "perf/ingest-profile"))
        fail = lambda i, secs: (assistant(f"l3{i}", f"p3{i}", at(secs), [tool_use(f"lt3{i}", "Bash", command="uv run pytest -x tests/test_jobs.py")])
                                + result(f"m3{i}", at(secs + 1), f"lt3{i}", "FAILED tests/test_jobs.py::test_archived - assert 200 == 404", error=True, prompt="q8"))
        self.write("s8.jsonl", other(prompt("k3", at(5), "q8", "Fix the API") + fail(1, 10) + fail(2, 16) + fail(3, 22)
                                     + assistant("l3", "p3", at(30), [tool_use("lt3", "Read", file_path="/nowhere/jobdesk-api/app/routes/jobs.py")])
                                     + result("m3", at(31), "lt3", "def list_jobs(): ...", prompt="q8"),
                                     "s8", "/nowhere/jobdesk-api", "Return a 404 for archived jobs instead of an empty list", "fix/archived-jobs-404"))
        self.write("s9.jsonl", other(prompt("k4", at(35), "q9", "Check the docs")
                                     + assistant("l4", "p4", at(40), [tool_use("lt4", "WebFetch", url="https://example.com/docs/release-notes")]),
                                     "s9", "/nowhere/infra", "Check the provider release notes before bumping the runner image"))
        self.write("s10.jsonl", other(prompt("k5", at(15), "q10", "Run the suite")
                                      + assistant("l5", "p5", at(20), [tool_use("lt5", "Bash", command=LONG_COMMAND, timeout=600000)]),
                                      "s10", "/nowhere/site", "Run the full docs build and fix every broken link it reports", "docs/broken-links"))
        self.write("s11.jsonl", other(prompt("k6", at(52), "q11", "Ship it"), "s11", "/nowhere/mobile",
                                      "Ship the offline mode behind a flag and write its release note"))
        thread = "0a0f7777-0000-7000-8000-000000000007"
        self.codex(f"rollout-2026-11-10T10-00-00-{thread}.jsonl", meta(thread).replace("2026-11-06T10:00:00.000Z", at(0)).replace("/nowhere/foo", "/nowhere/graft")
                   + codex_line(1, 20, "event_msg", type="task_started", turn_id="t1", model_context_window=272000)
                   + codex_line(2, 20, "turn_context", turn_id="t1", model="gpt-6.2-sol",
                                collaboration_mode=dict(mode="default", settings=dict(model="gpt-6.2-sol", reasoning_effort="high")))
                   + codex_line(3, 21, "event_msg", type="item_completed", turn_id="t1", item=dict(type="UserMessage", content=[dict(type="text", text="Bump the rollout parser")]))
                   + codex_line(4, 25, "response_item", type="function_call", name="exec_command", call_id="k1", arguments=json.dumps(dict(cmd="rg response_item src/")))
                   + codex_line(5, 26, "response_item", type="function_call_output", call_id="k1", output="src/rollout.rs:41")
                   + codex_line(6, 27, "token_usage_record", turn_id="t1", response_id="r1", usage=dict(input_tokens=22000, cached_input_tokens=20000, output_tokens=300)))
        with open(os.path.join(self.roots["codex"], "session_index.jsonl"), "w") as fh:
            fh.write(line(id=thread, thread_name="Bump the rollout parser to the new response_item shapes", updated_at=at(21)))
        self.ingest()
        return thread


def page_fixtures():
    """The Live payloads the page tests render, at NOW: the active list with and without text, a Claude Code session with
    and without text, and a Codex session. Titles: sketchbook renamed (too long for a tile), jobdesk from its first prompt,
    every other one from its agent."""
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
                                  "notes": "ended", "ai-ledger": "tool", "ingest-bench": "thinking", "jobdesk-api": "thinking",
                                  "infra": "tool", "site": "tool", "mobile": "thinking"})
        listed = {s["project"]: s for s in got["list"]["sessions"]}
        self.assertEqual((listed["ai-ledger"]["state"]["tool"], listed["ai-ledger"]["branch"]), ("mcp__t3-code__delegate_task", "feat/live-rail-state-tag-width"))
        self.assertEqual((listed["jobdesk-api"]["errors"], listed["graft"]["model"], listed["graft"]["cost"]), (3, "gpt-6.2-sol", None))
        self.assertEqual({k: v["model"] for k, v in got["claude"]["lanes"].items()}, dict(a7="claude-opus-5-5"))
        self.assertAlmostEqual(got["claude"]["lanes"]["a7"]["cost"], 0.0084)
        self.assertEqual({e["lane"] for e in got["claude"]["events"]} - {None}, {"a7"})
        self.assertTrue(any(e.get("failed") for e in got["claude"]["events"]))
        self.assertNotIn("Freeze", json.dumps(got["list"]) + json.dumps(got["claude"]))
        titles = lambda key: {s["project"]: (s["title"], s["title_from"]) for s in got[key]["sessions"]}
        self.assertEqual({p: t for p, t in titles("list").items() if t[1] != "agent"}, {"jobdesk": (None, None)})
        self.assertTrue(all(40 <= len(t) <= 80 for t, _ in titles("list_text").values()))
        self.assertEqual(titles("list_text")["jobdesk"], ("Freeze the clock in the snapshot test so the header stops drifting", "prompt"))


if __name__ == "__main__":
    unittest.main()
