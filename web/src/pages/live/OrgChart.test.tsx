import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LiveAgent, LivePayload } from "../../api";
import live from "../../__fixtures__/live";
import { OrgChart } from "./OrgChart";
import { treeOf, type TreeNode } from "./tree";

const NOW = Date.parse("2026-11-10T11:00:00.000Z");
const ago = (sec: number) => new Date(NOW - sec * 1000).toISOString();
const agent = (id: string, o: Partial<LiveAgent> = {}): LiveAgent => ({ id, kind: "agent", parent: null, name: "Agent", description: null, status: "running",
  start: ago(60), end: null, tools: 0, errors: 0, cost: null, model: null, provider: null, ...o });

describe("OrgChart", () => {
  it("draws a session as nested lists of cards, parent then children in the tab order, each named by its node", async () => {
    // Six children under the session (five agents and the fold): a column; one under a: a row.
    const s = { ...(live as LivePayload).sessions[0]!, session_id: "s", agents_more: 0, agents: [
      agent("a", { description: "Map the parsers", start: ago(90), tools: 8, errors: 2, cost: 0.05, model: "claude-haiku-5-5" }),
      agent("b", { parent: "a", start: ago(80) }), ...["c", "e", "f", "g"].map((id, i) => agent(id, { start: ago(70 - i) })),
      agent("d", { status: "done", start: ago(100), end: ago(95) }),
    ] };
    const [group] = treeOf([s], NOW);
    const select = vi.fn<(n: TreeNode) => void>(), toggle = vi.fn<(n: TreeNode) => void>();
    const chartOf = (folds: Map<string, boolean>) => <><h2 id="g">working</h2><OrgChart roots={group!.roots} labelledBy="g" folds={folds} toggle={toggle}
      select={select} current="s" now={NOW} sheet={id => `/live?sheet=${id}`} /></>;
    const { rerender } = render(chartOf(new Map()));
    const chart = screen.getByRole("list", { name: "working" });
    // Each item by its card, with the lists it sits in under the chart and the class of the list of its children.
    expect([...chart.querySelectorAll("li")].map(li => [li.firstElementChild!.id, depth(li, chart), li.querySelector(":scope > ul")?.className ?? null]))
      .toEqual([["node:s", 0, "column"], ["node:s/a", 1, "row"], ["node:s/b", 2, null], ...["c", "e", "f", "g"].map(id => [`node:s/${id}`, 1, null]), ["fold:s/", 1, null]]);
    const tabs: string[] = [];
    for (let i = 0; i < 8; i++) { await userEvent.tab(); tabs.push(document.activeElement!.id); }
    expect(tabs).toEqual(["node:s", "node:s/a", "node:s/b", "node:s/c", "node:s/e", "node:s/f", "node:s/g", "fold:s/"]);
    const card = screen.getByRole("button", { name: "Agent: Map the parsers. running. 8 tool calls. 2 errors. Duration 1m 30s. Cost $0.05. Model haiku-5-5." });
    expect([card.id, document.getElementById("node:s")!.getAttribute("aria-current"), screen.getByRole("button", { name: "1 finished subagent" }).getAttribute("aria-expanded")])
      .toEqual(["node:s/a", "true", "false"]);
    await userEvent.click(card);
    expect(select.mock.calls.map(([n]) => n.key)).toEqual(["node:s/a"]);
    // A node collapsed in the Outline: one card in place of its children opens it again.
    rerender(chartOf(new Map([["node:s/a", false]])));
    expect(document.getElementById("node:s/b")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Show 1 hidden agent" }));
    expect(toggle.mock.calls.map(([n]) => n.key)).toEqual(["node:s/a"]);
  });
});

/** How many lists stand between an item and the chart's own list. */
const depth = (li: Element, chart: Element) => {
  let n = 0;
  for (let at = li.parentElement; at && at !== chart; at = at.parentElement) if (at.tagName === "UL") n++;
  return n;
};
