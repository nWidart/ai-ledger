import { describe, expect, it } from "vitest";
import type { LiveAgent, LiveListSession, LivePayload } from "../../api";
import live from "../../__fixtures__/live";
import { faceOf, flip, holder, isOpen, rowsOf, sessionTree, textOf, treeOf, type AgentNode, type Folds, type TreeNode } from "./tree";

const NOW = Date.parse("2026-11-10T11:00:00.000Z");
/** The time `min` minutes before NOW. */
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();
const agent = (id: string, o: Partial<LiveAgent> = {}): LiveAgent => ({ id, kind: "agent", parent: null, name: "Agent", description: null, status: "running",
  start: ago(30), end: null, tools: 0, errors: 0, cost: null, model: null, provider: null, ...o });
const delegation = (id: string, o: Partial<LiveAgent> = {}) =>
  agent(id, { kind: "delegation", name: "mcp__t3-code__delegate_task", status: "started", tools: null, errors: null, ...o });
const base = (live as LivePayload).sessions[0]!;
const session = (agents: LiveAgent[], more = 0): LiveListSession => ({ ...base, session_id: "s", agents, agents_more: more });
/** A tree as indented lines, fold contents included whatever the folds: an agent by id, a fold by its label, the more
 *  row by its count. */
const outline = (n: TreeNode, d = 0): string[] => [
  "  ".repeat(d) + (n.kind === "agent" ? n.agent.id : n.kind === "fold" ? `[${n.label}]` : n.kind === "more" ? `+${n.count}` : n.session),
  ...n.children.flatMap(c => outline(c, d + 1))];
const tree = (agents: LiveAgent[], more = 0) => outline(sessionTree(session(agents, more), NOW));

describe("tree.ts", () => {
  it("nests agents under their parents at any depth, by start, and puts an orphan or a cycle under the session", () => {
    expect(tree([
      agent("c", { parent: "b", start: ago(25) }), agent("a", { start: ago(30) }), agent("b", { parent: "a", start: ago(20) }),
      delegation("d", { start: ago(28) }), agent("e", { parent: "gone", start: ago(29) }), agent("f", { parent: "e", start: ago(3) }),
      agent("x", { parent: "y", start: ago(5) }), agent("y", { parent: "x", start: ago(4) }), agent("z", { parent: "z", start: ago(30) }),
    ], 60)).toEqual(["s", "  a", "    b", "      c", "  z", "  e", "    f", "  d", "  x", "  y", "  +60"]);
  });

  it("folds the agents that are over last under their parent, and keeps a done parent of a running child", () => {
    expect(tree([agent("r1", { start: ago(9) }), ...[1, 2, 3, 4].map(i => agent(`d${i}`, { status: "done", start: ago(20 - i), end: ago(10) })), agent("r2", { start: ago(8) })]))
      .toEqual(["s", "  r1", "  r2", "  [4 finished subagents]", "    d1", "    d2", "    d3", "    d4"]);
    expect(tree([agent("A", { status: "done", end: ago(1) }), agent("B", { parent: "A" })])).toEqual(["s", "  A", "    B"]);
    // All done: the parent goes into the session's fold, its child into its own.
    expect(tree([agent("A", { status: "done", end: ago(1) }), agent("B", { parent: "A", status: "done", end: ago(2) })]))
      .toEqual(["s", "  [1 finished subagent]", "    A", "      [1 finished subagent]", "        B"]);
    expect(tree([agent("r")])).toEqual(["s", "  r"]); // nothing over: no fold
  });

  it("folds a delegation once done or failed, or 10 minutes after its call returned whatever it says", () => {
    expect(tree([
      agent("done", { status: "done", start: ago(40), end: ago(35) }),
      delegation("old", { start: ago(31), end: ago(30) }), delegation("recent", { start: ago(10), end: ago(9) }),
      delegation("sending", { status: "pending", start: ago(60) }), delegation("ok", { status: "done", start: ago(3), end: ago(2) }),
      delegation("bad", { status: "failed", start: ago(2), end: ago(1) }),
    ])).toEqual(["s", "  sending", "  recent", "  [1 finished subagent, 3 earlier delegations]", "    done", "    old", "    ok", "    bad"]);
    expect(tree([agent("done", { status: "done", end: ago(1) }), delegation("old", { end: ago(30) })])[1]).toBe("  [1 finished subagent, 1 earlier delegation]");
    const old = sessionTree(session([delegation("old", { end: ago(30) })]), NOW).children[0]!.children[0] as AgentNode;
    expect([faceOf(old, NOW).state, faceOf(old, NOW).why]).toEqual(["started", "Started: the transcript does not tell when the delegated task ends."]);
  });

  it("shows the rows under the folds, with their level and place, and finds where a hidden node shows", () => {
    const root = sessionTree(session([agent("a", { start: ago(9) }), agent("b", { parent: "a", start: ago(8) }), agent("d", { status: "done", end: ago(1) })]), NOW);
    const rows = (f: Folds) => rowsOf([root], f).map(r => [r.node.key, r.level, r.pos, r.size, r.expanded]);
    const fold = root.children[1]!;
    expect([fold.key, isOpen(fold, new Map()), isOpen(root, new Map())]).toEqual(["fold:s/", false, true]);
    expect(rows(new Map())).toEqual([["node:s", 1, 1, 1, true], ["node:s/a", 2, 1, 2, true], ["node:s/b", 3, 1, 1, undefined], ["fold:s/", 2, 2, 2, false]]);
    expect(holder([root], new Map(), "node:s/d")).toBe("fold:s/");
    const opened = flip(new Map(), fold);
    expect(rows(opened).at(-1)).toEqual(["node:s/d", 3, 1, 1, undefined]);
    expect(holder([root], opened, "node:s/d")).toBe("node:s/d");
    const collapsed = flip(opened, root);
    expect([rows(collapsed), holder([root], collapsed, "node:s/b"), holder([root], collapsed, "node:s/gone")]).toEqual([[["node:s", 1, 1, 1, false]], "node:s", null]);
  });

  it("says each node in words: a session, a subagent, a delegation, a fold and the more row", () => {
    const s: LiveListSession = { ...session([
      agent("a", { description: "Map the parsers", start: new Date(NOW - 90_000).toISOString(), tools: 8, errors: 2, cost: 0.05, model: "claude-haiku-5-5" }),
      delegation("t", { description: "Write the tests", start: ago(20), end: ago(20), model: "gpt-6.1-sol", provider: "codex" }),
      agent("q", { start: ago(1) }),
    ], 60), title: "Add the Tree", project: "ai-ledger", first_ts: ago(12), tools: 40, errors: 2, cost: 1.2, model: "claude-opus-5-5",
      state: { kind: "tool", tool: "Bash", since: new Date(NOW - 12_000).toISOString(), inferred: false, long: false } };
    const [group] = treeOf([s], NOW), root = group!.roots[0]!, [a, q, fold, more] = root.children;
    expect(group!.label).toBe("working");
    expect(textOf(root, NOW)).toBe("Add the Tree. Bash 12s: Bash running for 12s. 2 errors. Project ai-ledger. 40 tool calls. Started 12m 00s ago. Cost $1.20. Model opus-5-5.");
    expect(textOf(a!, NOW)).toBe("Agent: Map the parsers. running. 8 tool calls. 2 errors. Duration 1m 30s. Cost $0.05. Model haiku-5-5.");
    expect(textOf(q!, NOW)).toBe("Agent. running. 0 tool calls. Duration 1m 00s."); // no cost, no model
    expect(textOf(fold!.children[0]!, NOW)).toBe("Delegated task: Write the tests. To codex gpt-6.1-sol. started, the transcript does not tell when the delegated task ends. Sent 20m 00s ago.");
    expect([textOf(fold!, NOW), textOf(more!, NOW)]).toEqual(["1 earlier delegation", "60 older agents not shown"]);
  });
});
