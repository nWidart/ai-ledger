import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { LiveAgent, LiveListSession, LivePayload } from "../../api";
import live from "../../__fixtures__/live";
import { Outline } from "./Outline";
import { flip, textOf, treeOf, type Folds, type TreeNode } from "./tree";

const NOW = Date.parse("2026-11-10T11:00:00.000Z");
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();
const agent = (id: string, o: Partial<LiveAgent> = {}): LiveAgent => ({ id, kind: "agent", parent: null, name: "Agent", description: null, status: "running",
  start: ago(30), end: null, tools: 0, errors: 0, cost: null, model: null, provider: null, ...o });
/** A working session with subagent a, a's subagent b, a recent delegation t and a done subagent d in the session's fold. */
const s: LiveListSession = { ...(live as LivePayload).sessions[0]!, session_id: "s", title: "Add the Tree", project: "ai-ledger",
  state: { kind: "tool", tool: "Bash", since: ago(0), inferred: false, long: false }, agents: [
    agent("a", { description: "Map the parsers", start: ago(9), tools: 8, errors: 2 }), agent("b", { parent: "a", start: ago(8) }),
    agent("t", { kind: "delegation", name: "mcp__t3-code__delegate_task", description: "Write the tests", status: "started", start: ago(5), end: ago(5),
      tools: null, errors: null, model: "gpt-6.1-sol" }),
    agent("d", { status: "done", start: ago(20), end: ago(15) }),
  ] };
const [group] = treeOf([s], NOW), roots = group!.roots, [a, t] = roots[0]!.children;

/** One group's Outline under its heading, with the folds the page would keep. */
function Group({ select = () => {} }: { select?: (n: TreeNode) => void }) {
  const [folds, setFolds] = useState<Folds>(() => new Map());
  return <><h2 id="g">working · 1</h2>
    <Outline roots={roots} labelledBy="g" folds={folds} toggle={n => setFolds(f => flip(f, n))} select={n => { select(n); if (n.kind === "fold") setFolds(f => flip(f, n)); }}
      current="s" now={NOW} sheet={id => `/live?sheet=${id}`} /></>;
}
const item = (key: string) => document.getElementById(key)!;
const rowOf = (key: string) => ["aria-level", "aria-posinset", "aria-setsize", "aria-expanded"].map(k => item(key).getAttribute(k));

describe("Outline", () => {
  it("draws a group as a tree named by its heading, a row per node with its level, place and state, children in a group", () => {
    render(<Group />);
    const tree = screen.getByRole("tree", { name: "working · 1" });
    expect(within(tree).getAllByRole("treeitem").map(r => r.id)).toEqual(["node:s", "node:s/a", "node:s/b", "node:s/t", "fold:s/"]);
    expect([rowOf("node:s"), rowOf("node:s/a"), rowOf("node:s/b"), rowOf("node:s/t"), rowOf("fold:s/")]).toEqual([
      ["1", "1", "1", "true"], ["2", "1", "3", "true"], ["3", "1", "1", null], ["2", "2", "3", null], ["2", "3", "3", "false"]]);
    expect(within(item("node:s")).getAllByRole("group").map(g => g.parentElement!.id)).toEqual(["node:s", "node:s/a"]);
    // Each row is named by its node in words; the drawn parts are hidden.
    for (const n of [roots[0]!, a!, t!]) expect(within(tree).getByRole("treeitem", { name: textOf(n, NOW) }).id).toBe(n.key);
    expect(item("node:s").getAttribute("aria-current")).toBe("true");
    expect(item("node:s/a").querySelector(".desc")!.getAttribute("title")).toBe("Map the parsers");
  });

  it("walks the rows by keyboard from the URL's session, with one tab stop, and selects with Enter", async () => {
    const select = vi.fn<(n: TreeNode) => void>();
    render(<Group select={select} />);
    const stops = () => [...document.querySelectorAll("[role=treeitem][tabindex='0']")].map(r => r.id), at = () => document.activeElement!.id;
    expect(stops()).toEqual(["node:s"]);
    await userEvent.tab();
    const walk = async (keys: string) => { await userEvent.keyboard(keys); return at(); };
    expect(await walk("{ArrowRight}")).toBe("node:s/a"); // expanded: to the first child
    expect(await walk("{ArrowRight}")).toBe("node:s/b");
    expect(await walk("{ArrowLeft}")).toBe("node:s/a"); // a leaf: to its parent
    expect([await walk("{ArrowLeft}"), rowOf("node:s/a")[3], item("node:s/b")]).toEqual(["node:s/a", "false", null]); // collapses
    expect([await walk("{ArrowDown}"), await walk("{ArrowUp}"), await walk("{End}")]).toEqual(["node:s/t", "node:s/a", "fold:s/"]);
    expect([await walk("{ArrowRight}"), rowOf("fold:s/")[3]]).toEqual(["fold:s/", "true"]); // the fold opens
    expect([await walk("{ArrowRight}"), await walk("{End}"), await walk("{Home}"), await walk("{ArrowUp}")]).toEqual(["node:s/d", "node:s/d", "node:s", "node:s"]);
    expect(await walk("{ArrowDown}{Enter}")).toBe("node:s/a");
    expect(select.mock.lastCall![0].key).toBe("node:s/a");
    expect(stops()).toEqual(["node:s/a"]);
    // Space selects too: on the fold row, it folds it.
    await walk("{End}{ArrowLeft}{ }");
    expect([at(), rowOf("fold:s/")[3]]).toEqual(["fold:s/", "false"]);
  });
});
