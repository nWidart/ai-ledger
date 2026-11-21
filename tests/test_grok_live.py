import copy
import json
from datetime import timedelta

from test_grok import CHILD, SESSION, GrokCase  # first: it imports store before the source modules
from ai_ledger import grok, live, metrics

PRICES = {"grok-4.7-build": {"context": 256000}}


def kind(d):
    """The sessionUpdate of line d, or its hook's event_name."""
    return grok.line_type(d)


class GrokLiveCase(GrokCase):
    def lines(self, label, sid=None):
        """The fixture's lines of session sid (the label's main session by default), parsed, in file order."""
        self.put(label)
        with open(self.path(label, sid)) as fh:
            return [json.loads(x) for x in fh]

    def path(self, label, sid=None):
        return next(p for p in grok.files(self.home) if grok.ids(p)[0] == (sid or SESSION[label]))

    def store(self, label, lines, sid=None):
        """Writes lines as the log of session sid in the test home, and ingests."""
        with open(self.path(label, sid), "w") as fh:
            fh.writelines(json.dumps(d) + "\n" for d in lines)
        self.ingest()

    def at(self, d, seconds=0):
        """The time of line d, plus seconds."""
        return live.parse_ts(grok.iso(grok.meta(d)["agentTimestampMs"])) + timedelta(seconds=seconds)

    def until(self, lines, k, n=1):
        """lines up to, not including, the n-th line of kind k."""
        found = [i for i, d in enumerate(lines) if kind(d) == k]
        return lines[:found[n - 1]]

    def one(self, label, now, text=False):
        return live.session(self.con.cursor(), SESSION[label], now=now, prices=PRICES, text=text)


class TurnStateTest(GrokLiveCase):
    def test_turn_in_progress_is_thinking_not_inferred(self):
        lines = self.until(self.lines("long-turn"), "turn_completed")
        self.store("long-turn", lines)
        st = self.one("long-turn", self.at(lines[-1], 5))["state"]
        prompt = next(d for d in lines if kind(d) == "user_message_chunk")
        self.assertEqual((st["kind"], st["inferred"], st["since"]), ("thinking", False, live.iso(self.at(prompt))))

    def test_your_turn_after_turn_completed(self):
        lines = self.until(self.lines("long-turn"), "session_end")
        self.store("long-turn", lines)
        end = next(d for d in lines if kind(d) == "turn_completed")
        st = self.one("long-turn", self.at(lines[-1], 5))["state"]
        self.assertEqual((st["kind"], st["inferred"], st["since"]), ("you", False, live.iso(self.at(end))))

    def test_prompt_in_two_chunks_is_one_prompt(self):
        lines = self.until(self.lines("long-turn"), "session_end")
        self.store("long-turn", lines)
        chunks = [grok.chunk_text(grok.update(d)).strip() for d in lines if kind(d) == "user_message_chunk"]
        self.assertEqual(len(chunks), 2)
        events = self.one("long-turn", self.at(lines[-1], 5), text=True)["events"]
        self.assertEqual([e["text"] for e in events if e["k"] == "prompt"], ["\n".join(chunks)])

    def test_reply_chunks_make_one_reply(self):
        lines = self.until(self.lines("long-turn"), "session_end")
        i = next(i for i, d in enumerate(lines) if kind(d) == "agent_message_chunk")
        more = copy.deepcopy(lines[i])
        more["params"]["_meta"]["eventId"] += "0"
        more["params"]["_meta"]["agentTimestampMs"] += 1
        more["params"]["update"]["content"]["text"] = " and more"
        thought = copy.deepcopy(next(d for d in lines if kind(d) == "agent_thought_chunk"))
        thought["params"]["_meta"]["eventId"] += "1"
        thought["params"]["_meta"]["agentTimestampMs"] = more["params"]["_meta"]["agentTimestampMs"]
        self.store("long-turn", lines[:i + 1] + [thought, more] + lines[i + 1:])
        replies = [e["text"] for e in self.one("long-turn", self.at(lines[-1], 5), text=True)["events"] if e["k"] == "reply"]
        self.assertEqual(replies[0], grok.chunk_text(grok.update(lines[i])) + " and more")
        self.assertEqual(len(replies), sum(kind(d) == "agent_message_chunk" for d in lines))

    def test_reply_across_the_catch_up_window_is_one_event(self):
        # A reply's chunks 65 s apart (one model call): the second poll's window starts after the first chunk, and still
        # sends the reply whole under the key the first poll gave it, so the page replaces it.
        lines = self.until(self.lines("long-turn"), "session_end")
        i = next(i for i, d in enumerate(lines) if kind(d) == "agent_message_chunk")
        head, start = lines[i], grok.meta(lines[i])["agentTimestampMs"]

        def chunk(base, n, ms, text=None):
            d = copy.deepcopy(base)
            grok.meta(d).update(eventId=grok.meta(d)["eventId"] + n, agentTimestampMs=start + ms)
            if text is not None:
                grok.update(d)["content"]["text"] = text
            return d
        thought = chunk(next(d for d in lines if kind(d) == "agent_thought_chunk"), "7", 61_000)
        grok.meta(thought)["streamStartMs"] = grok.meta(head)["streamStartMs"]
        tail = chunk(head, "8", 65_000, " and more")
        first = [d for d in lines[:i + 1] if grok.meta(d)["agentTimestampMs"] <= start] + [thought]
        self.store("long-turn", first)
        cur = self.con.cursor()
        poll1 = live.session(cur, SESSION["long-turn"], now=self.at(tail, 5), prices=PRICES, text=True)
        self.assertGreater(live.parse_ts(poll1["cursor"]) - live.OVERLAP, self.at(head))  # the head is out of the next window
        self.store("long-turn", first + [tail])
        poll2 = live.session(cur, SESSION["long-turn"], after=poll1["cursor"], now=self.at(tail, 5), prices=PRICES, text=True)
        merged = {e["key"]: e for e in poll1["events"]}  # as the page merges a catch-up: by key
        merged.update({e["key"]: e for e in poll2["events"]})
        whole = grok.chunk_text(grok.update(head)) + " and more"
        self.assertEqual([e["text"] for e in merged.values() if e["k"] == "reply"].count(whole), 1)
        self.assertNotIn(" and more", [e["text"] for e in merged.values() if e["k"] == "reply"])
        self.assertEqual([e["text"] for e in poll2["events"] if e["k"] == "reply"], [whole])
        self.assertNotIn("since", poll2["events"][0])

    def test_cancelled_turn_is_an_interrupt_and_your_turn(self):
        lines = self.until(self.lines("cancelled"), "session_end")
        self.store("cancelled", lines)
        one = self.one("cancelled", self.at(lines[-1], 5))
        self.assertEqual((one["state"]["kind"], one["state"]["inferred"]), ("you", False))
        self.assertEqual([e["k"] for e in one["events"] if e["lane"] is None][-2:], ["interrupt", "turn_end"])

    def test_slow_shell_call_is_a_likely_approval_wait(self):
        lines = self.until(self.lines("probe"), "session_end", 2)  # turn 2's sleep 60 has only its in-progress update
        self.store("probe", lines)
        call = [d for d in lines if kind(d) == "tool_call"][-1]
        self.assertEqual(grok.update(call)["rawInput"]["command"], "sleep 60")
        st = self.one("probe", self.at(call, 45))["state"]
        self.assertEqual(st, dict(kind="wait", tool="run_terminal_command", since=live.iso(self.at(call)), inferred=True, long=False))


class ChunkTextTest(GrokLiveCase):
    def chunks(self, k, texts):
        """Events of synthetic chunk lines of kind k (a fixture line's copy each, one millisecond apart) with texts."""
        base = next(d for d in self.lines("long-turn") if kind(d) == k)
        rows = []
        for i, text in enumerate(texts):
            d = copy.deepcopy(base)
            grok.meta(d)["eventId"] += f"9{i}"
            grok.meta(d)["agentTimestampMs"] += i if k == "agent_message_chunk" else 0  # a prompt's chunks share their time
            grok.update(d)["content"]["text"] = text
            rows.append((f"k{i}", "/x/updates.jsonl", grok.iso(grok.meta(d)["agentTimestampMs"]), False, "grok", json.dumps(d)))
        return [e for e in live.assemble(rows)[0] if e["k"] in ("reply", "prompt")]

    def test_whitespace_chunk_of_a_reply_is_kept(self):
        self.assertEqual([e["text"] for e in self.chunks("agent_message_chunk", ["one", " ", "two"])], ["one two"])
        self.assertEqual([e["text"] for e in self.chunks("agent_message_chunk", ["one", "\n", "two\n"])], ["one\ntwo"])

    def test_reply_of_whitespace_only_gives_no_event(self):
        self.assertEqual(self.chunks("agent_message_chunk", [" ", "\n"]), [])

    def test_prompt_chunks_keep_their_own_whitespace(self):
        self.assertEqual([e["text"] for e in self.chunks("user_message_chunk", [" one ", " ", "two "])], ["one \n \ntwo"])
        self.assertEqual(self.chunks("user_message_chunk", [" ", ""]), [])


class ToolUseTest(GrokLiveCase):
    def calls(self, **inputs):
        """Events of synthetic run_terminal_command calls made from a fixture call: one per name, its rawInput replaced."""
        base = next(d for d in self.lines("probe") if kind(d) == "tool_call"
                    and grok.tool_of(grok.update(d))[0] == "run_terminal_command")
        rows = []
        for i, (name, raw) in enumerate(inputs.items()):
            d = copy.deepcopy(base)
            d["params"]["update"].update(toolCallId=name, rawInput=raw)
            rows.append((f"k{i}", "/x/updates.jsonl", grok.iso(grok.meta(d)["agentTimestampMs"]), False, "grok", json.dumps(d)))
        return {e["id"]: live.public(e, False) for e in live.assemble(rows)[0]}

    def test_shell_call_read_only_by_its_command(self):
        evs = self.calls(a=dict(command="rg TODO src"), b=dict(command="rg TODO src && rm notes.md"), c=dict(cmd="rg TODO src"))
        self.assertEqual((evs["a"]["quiet"], evs["b"]["quiet"], evs["c"]["quiet"]), (True, False, False))

    def test_timeout_makes_a_long_call_and_background_does_not(self):
        evs = self.calls(a=dict(command="make test", timeout_ms=600000), b=dict(command="make test", timeout_ms=5000),
                         c=dict(command="npm run dev", timeout_ms=600000, is_background=True),
                         d=dict(command="npm run dev", timeout_ms=600000, background=True),
                         e=dict(command="sleep 60", block_until_ms=600000))
        self.assertEqual({k: e["long"] for k, e in evs.items()}, dict(a=True, b=False, c=False, d=False, e=False))

    def test_shell_call_carries_its_description(self):
        evs = self.calls(a=dict(command="ls", description="List files"))
        self.assertEqual(evs["a"]["description"], "List files")

    def test_read_tools_are_read_only(self):
        lines = self.until(self.lines("compaction"), "session_end")
        self.store("compaction", lines)
        quiet = {e["tool"]: e["quiet"] for e in self.one("compaction", self.at(lines[-1], 5))["events"] if e["k"] == "tool"}
        self.assertEqual((quiet["read_file"], quiet["search_replace"]), (True, False))

    def test_failed_shell_command_marked_completed_fails(self):
        self.put("probe")
        self.ingest()
        (last,) = self.con.execute("SELECT last_ts FROM sessions WHERE session_id = ?", [SESSION["probe"]]).fetchone()
        evs = self.one("probe", live.aware(last) + timedelta(seconds=1))["events"]
        failed = {e["summary"]: e["failed"] for e in evs if e["k"] == "tool" and e["tool"] == "run_terminal_command"}
        self.assertEqual((failed["ls missing-dir"], failed["git commit -m x"]), (True, False))


class SubagentTest(GrokLiveCase):
    def test_child_session_is_a_lane_of_its_parent(self):
        self.put("probe")
        self.ingest()
        cur = self.con.cursor()
        (last,) = cur.execute("SELECT last_ts FROM sessions WHERE session_id = ?", [SESSION["probe"]]).fetchone()
        now = live.aware(last) + timedelta(seconds=1)
        evs = self.one("probe", now)["events"]
        tools = [e for e in evs if e["k"] == "tool"]
        self.assertEqual([(e["tool"], e["lane"]) for e in tools if e["lane"]], [("read_file", CHILD)])
        spawn, = [e for e in tools if e["tool"] == "spawn_subagent"]
        self.assertEqual((spawn["agent"], spawn["lane"], spawn["summary"]), (CHILD, None, spawn["description"]))
        self.assertEqual([k for k in (e["k"] for e in evs if e["lane"] == CHILD) if k in ("turn_start", "turn_end")],
                         ["turn_start", "turn_end"])
        self.assertEqual([s["session_id"] for s in live.sessions(cur, now=now, prices={})["sessions"]], [SESSION["probe"]])

    def test_child_session_end_does_not_close_the_parent(self):
        child = self.lines("probe", CHILD)
        lines = self.until(self.lines("probe"), "subagent_finished")  # the spawn call has no result yet
        self.assertEqual(kind(child[-1]), "session_end")
        self.store("probe", lines)
        self.assertNotIn(SESSION["probe"], live.closed(self.con.cursor(), [SESSION["probe"]]))
        self.assertEqual(self.one("probe", self.at(child[-1], 1))["state"]["kind"], "tool")


class ClosedTest(GrokLiveCase):
    def test_session_end_closes_and_a_resumed_turn_reopens(self):
        lines = self.lines("probe")
        first = self.until(lines, "session_start", 2)  # turn 1, its session_end and the stop hook after it
        self.assertEqual([kind(d) for d in first[-2:]], ["session_end", "stop"])
        self.store("probe", first)
        st = self.one("probe", self.at(first[-1], 5))["state"]
        self.assertEqual((st["kind"], st["since"], st["inferred"]), ("ended", live.iso(self.at(first[-1])), False))
        resumed = lines[:len(first) + 1]  # the resumed run's session_start
        self.store("probe", resumed)
        self.assertEqual(self.one("probe", self.at(resumed[-1], 5))["state"]["kind"], "you")
        self.store("probe", lines)
        st = self.one("probe", self.at(lines[-1], 5))["state"]
        self.assertEqual((st["kind"], st["since"]), ("ended", live.iso(self.at(lines[-1]))))


class FiguresTest(GrokLiveCase):
    def test_figures_change_when_a_turn_ends(self):
        lines = self.lines("tools")
        before = self.until(lines, "turn_completed", 3)
        self.store("tools", before)
        cur = self.con.cursor()
        now = self.at(before[-1], 5)
        mid = self.one("tools", now)
        (turn2,) = cur.execute("SELECT arg_max(context_tokens, ts) FROM requests "
                               "WHERE session_id = ? AND NOT subagent", [SESSION["tools"]]).fetchone()
        self.assertEqual((mid["state"]["kind"], mid["context"]), ("thinking", turn2))
        self.store("tools", self.until(lines, "session_start", 3))
        done = self.one("tools", now)
        self.assertNotEqual(done["context"], turn2)
        self.assertAlmostEqual(done["cost"] - mid["cost"], 0.065869)
        self.assertEqual(done["requests"] - mid["requests"], 2)

    def test_context_is_what_the_last_call_stated(self):
        # The parent's turn holds its subagent's calls, so a request's share of the turn's input is no context size: the
        # gauge, the pulse and the session timeline read the size the call stated.
        lines = self.until(self.lines("probe"), "turn_completed")  # turn 1, the one finished turn
        self.ingest()
        cur = self.con.cursor()
        sid = SESSION["probe"]
        last_call = max((d for d in lines if grok.update(d).get("sessionUpdate") in grok.CALL_TYPES
                         and "streamStartMs" in grok.meta(d)), key=lambda d: grok.meta(d)["streamStartMs"])
        stream = grok.meta(last_call)["streamStartMs"]
        stated = max(grok.meta(d)["totalTokens"] for d in lines if grok.meta(d).get("streamStartMs") == stream)
        self.assertEqual(stated, 23170)
        (share,) = cur.execute("SELECT arg_max(input + cache_read + cache_5m + cache_1h, ts) FROM requests").fetchone()
        self.assertNotEqual(share, stated)
        (last,) = cur.execute("SELECT last_ts FROM sessions WHERE session_id = ?", [sid]).fetchone()
        now = live.aware(last) + timedelta(seconds=1)
        self.assertEqual(live.session(cur, sid, now=now, prices=PRICES)["context"], stated)
        self.assertEqual(live.sessions(cur, now=now, prices=PRICES)["sessions"][0]["context"], stated)
        (end,) = cur.execute("SELECT max(ts) FROM requests").fetchone()
        pulse = live.pulse(cur, sid, live.aware(end) + timedelta(seconds=1))
        self.assertEqual(pulse["context"][-1]["tokens"], stated)
        timeline = metrics.session(cur, sid, prices=PRICES)
        self.assertEqual(timeline["requests"][-1]["context"], stated)
        self.assertEqual(max(r["context"] for r in timeline["timeline"]), max(r["context"] for r in timeline["requests"]))

    def test_window_and_compaction(self):
        self.put("compaction")
        self.ingest()
        (last,) = self.con.execute("SELECT last_ts FROM sessions WHERE session_id = ?", [SESSION["compaction"]]).fetchone()
        one = self.one("compaction", live.aware(last) + timedelta(seconds=1))
        self.assertEqual((one["model"], one["window"]), ("grok-4.7-build", 256000))
        self.assertEqual([c["pre"] for c in one["compactions"]], [204942])
        self.assertGreater(one["context"], 0)


class LiveSmokeTest(GrokCase):
    def test_live_payloads_hold_a_grok_session(self):
        """The Live payloads answer for a stored Grok session with a subagent, whatever they read of its turns."""
        self.put("probe")
        self.ingest()
        cur = self.con.cursor()
        sid = SESSION["probe"]
        (last,) = cur.execute("SELECT last_ts FROM sessions WHERE session_id = ?", [sid]).fetchone()
        now = live.aware(last) + timedelta(seconds=1)
        listed = live.sessions(cur, now=now, prices={})
        self.assertEqual([(s["session_id"], s["source"]) for s in listed["sessions"]], [(sid, "grok")])
        self.assertIsInstance(live.waiting(cur, now=now), int)
        one = live.session(cur, sid, now=now, prices={}, text=True)
        self.assertEqual((one["session_id"], one["source"]), (sid, "grok"))
        self.assertEqual(live.session(cur, sid, after=one["cursor"], now=now, prices={})["cursor"], one["cursor"])
        self.assertEqual(metrics.session(cur, sid, prices={})["compaction_ts"], [])
