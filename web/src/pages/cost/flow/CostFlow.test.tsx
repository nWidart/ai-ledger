import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "../../../testing";
import { CostFlow, type CostFlowProps } from "./CostFlow";
import { flowFit, flowLayout, flowModel } from "./flowModel";

// What the graph draws is flowModel.test.ts's to test, and the key table and the pointer test flowReading.test.ts's. Here
// what a user reaches through the component, on the fake runtime, which draws nothing: the label, the sentences, the
// tooltip, the mark, the sheet, the key and the table.

/** Each model's kinds as shares of its cost: input, output, cache read. */
const SPLIT: Record<string, [number, number, number]> = {
  "claude-opus-4-5": [.4, .5, .1], "claude-sonnet-4-5": [.5, .5, 0], "gpt-5.1-codex": [1, 0, 0], "claude-haiku-4-5": [0, 1, 0],
};
type Pair = [string | null, string | null, number];
/** A model not in SPLIT, or with no name, has its cost reported. */
function view(pairs: Pair[], over: Partial<CostFlowProps["d"]> = {}): CostFlowProps["d"] {
  const cost = new Map<string | null, number>();
  for (const [, m, c] of pairs) cost.set(m, (cost.get(m) ?? 0) + c);
  const models = [...cost].map(([model, c]) => {
    const [i, o, r] = SPLIT[model ?? ""] ?? [0, 0, 0];
    return { model, cost: c, cost_input: c * i, cost_output: c * o, cost_cache_read: c * r, cost_cache_5m: 0, cost_cache_1h: 0 };
  });
  const sum = (f: (m: (typeof models)[number]) => number) => models.reduce((s, m) => s + f(m), 0);
  return { project: "", range: 30, start: "2026-10-23", source: "", automated: true, unpriced: [],
    totals: { requests: pairs.length, cost: sum(m => m.cost), cost_input: sum(m => m.cost_input), cost_output: sum(m => m.cost_output),
      cost_cache_read: sum(m => m.cost_cache_read), cost_cache_5m: 0, cost_cache_1h: 0 },
    cost_flow: { pairs: pairs.map(([project, model, c]) => ({ project, model, cost: c })), models }, ...over };
}
// $210 over seven projects, fig and gale folded into Other, and four models.
const PAIRS: Pair[] = [
  ["atlas-api", "claude-opus-4-5", 24], ["atlas-api", "claude-sonnet-4-5", 18], ["atlas-api", "gpt-5.1-codex", 12], ["atlas-api", "claude-haiku-4-5", 6],
  ["beacon", "claude-opus-4-5", 30], ["beacon", "claude-sonnet-4-5", 20], ["comet", "claude-opus-4-5", 40], ["dune", "claude-sonnet-4-5", 30],
  ["eagle", "gpt-5.1-codex", 20], ["fig", "claude-opus-4-5", 5.75], ["gale", "claude-haiku-4-5", 4.25],
];
const d = view(PAIRS);

const group = () => screen.getByRole("group", { name: /^Estimated cost/ });
// The flow's own region; the wrapper's beside it stays empty.
const live = () => document.querySelector(".flow-live")!.textContent;
const tipRows = () => [...screen.getByRole("tooltip").children].map(r => r.textContent);
const show = (data = d, onProject = vi.fn<(name: string) => void>()) => {
  const r = renderApp(<CostFlow d={data} onProject={onProject} />);
  return { ...r, onProject };
};
const press = (...keys: string[]) => keys.map(key => fireEvent.keyDown(group(), { key }));
const focused = (data = d) => {
  const r = show(data);
  act(() => group().focus());
  return r;
};

const KEYS = "Use up and down to move in a column, right and left to follow a band to the next column, Home and End for the first and last.";

afterEach(() => { document.documentElement.style.fontSize = ""; });

describe("cost flow: the group's label", () => {
  it("names the three columns, the total and the keys, and what unpriced requests leave out", () => {
    show(view(PAIRS, { unpriced: [{ model: "m-unknown", requests: 10, tokens: 1 }, { model: "m-new", requests: 2, tokens: 1 }] }));
    expect(group().getAttribute("aria-label")).toBe("Estimated cost from project to model to token kind, $210 in all: 7 projects, 4 models and 3 kinds, "
      + `each band as wide as its cost. 12 requests from unpriced models are not drawn: their cost is unknown. ${KEYS} Enter on a project opens its sheet.`);
    expect(screen.getByText(/^Not drawn:/).textContent).toBe("Not drawn: 12 requests from unpriced models (m-unknown, m-new), whose cost is unknown.");
  });

  it("names the project and two columns with one project selected, and leaves out Enter", () => {
    show(view(PAIRS.filter(p => p[0] === "atlas-api"), { project: "atlas-api" }));
    expect(group().getAttribute("aria-label")).toBe(`Estimated cost on atlas-api from model to token kind, $60 in all: 4 models and 3 kinds, each band as wide as its cost. ${KEYS}`);
    expect(screen.getByText(/^From model to token kind on atlas-api/)).toBeTruthy();
  });
});

describe("cost flow: reading", () => {
  it("reads the costliest project on Right, with its sentence, its tooltip and the mark on its bar", () => {
    focused();
    press("ArrowRight");
    expect(live()).toBe("Project atlas-api: $60, 28.6% of $210. To opus-4-5 $24, sonnet-4-5 $18, gpt-5.1-codex $12 and 1 more.");
    expect(tipRows()).toEqual(["Project", "atlas-api$60", "Share of cost28.6%", "To", "opus-4-5$24", "sonnet-4-5$18", "gpt-5.1-codex$12", "+ 1 more"]);
    const bar = flowLayout(flowModel(d), flowFit(800, 1, 3))!.columns[0]!.nodes[0]!;
    const mark = document.querySelector(".flow-mark rect")!;
    expect([mark.getAttribute("x"), mark.getAttribute("y")]).toEqual([String(bar.x - 2), String(bar.y - 2)]);
  });

  it("follows a band to its model, and Down compares the bands of the same project", () => {
    focused();
    press("ArrowRight", "ArrowRight");
    expect(live()).toBe("atlas-api to opus-4-5: $24, 11.4% of $210 and 40.0% of atlas-api.");
    expect(document.querySelector(".flow-mark path")).not.toBeNull();
    const [down, up] = press("ArrowDown", "ArrowUp");
    expect([down, up]).toEqual([false, false]); // prevented: the page does not scroll under the graph
    press("ArrowDown");
    expect(live()).toBe("atlas-api to sonnet-4-5: $18, 8.6% of $210 and 30.0% of atlas-api.");
    press("ArrowRight");
    expect(live()).toBe("Model sonnet-4-5: $68, 32.4% of $210. From dune $30, beacon $20, atlas-api $18. To Input $34, Output + thinking $34.");
  });

  it("reads a band under the pointer, ends the reading when the pointer leaves, and reads a tiny node where it is drawn", () => {
    const { rerender } = show();
    const b = flowLayout(flowModel(d), flowFit(800, 1, 3))!.bands.find(x => x.id === "p:atlas-api|m:claude-opus-4-5")!;
    fireEvent.mouseMove(group(), { clientX: (b.x0 + b.x1) / 2, clientY: (b.y0 + b.y1) / 2 + b.h / 2 });
    expect(live()).toBe("atlas-api to opus-4-5: $24, 11.4% of $210 and 40.0% of atlas-api.");
    expect(tipRows()).toEqual(["Fromatlas-api", "Toopus-4-5", "Est. cost$24", "Share of cost11.4%", "Share of atlas-api40.0%"]);
    fireEvent.mouseLeave(document.querySelector(".flow-box")!);
    expect(live()).toBe("");
    expect(screen.queryByRole("tooltip")).toBeNull();
    // $0.05 of opus's input was a cache write: a 0.04px node, drawn 2px tall.
    const tiny = { ...d, cost_flow: { ...d.cost_flow, models: d.cost_flow.models.map(m =>
      m.model === "claude-opus-4-5" ? { ...m, cost_input: m.cost_input! - .05, cost_cache_5m: .05 } : m) } };
    rerender(<CostFlow d={tiny} onProject={() => {}} />);
    const n = flowLayout(flowModel(tiny), flowFit(800, 1, 3))!.columns[2]!.nodes.find(x => x.id === "k:write")!;
    expect(n.height).toBeLessThan(.1);
    fireEvent.mouseMove(group(), { clientX: n.x + 4, clientY: n.y + n.height / 2 + .9 });
    expect(live()).toMatch(/^Cache write: \$0\.05,/);
  });

  it("opens a project's sheet on Enter, and on a model, Other or a band does nothing and keeps the reading", () => {
    const { onProject } = focused();
    press("ArrowRight", "Enter");
    expect(onProject.mock.calls).toEqual([["atlas-api"]]);
    // Other, then atlas-api's top band, then the model it reaches.
    for (const [keys, said] of [[["End"], /^Other, 2 projects: \$10, 4\.8% of \$210; the largest fig \$5\.75, gale \$4\.25\./],
      [["Home", "ArrowRight"], /^atlas-api to opus-4-5:/], [["ArrowRight"], /^Model opus-4-5:/]] as const) {
      press(...keys, "Enter");
      expect(live()).toMatch(said);
    }
    expect(onProject).toHaveBeenCalledTimes(1);
  });

  it("ends a reading on Escape, and on Escape elsewhere a tooltip the pointer opened", () => {
    focused();
    press("ArrowRight", "Escape");
    expect(live()).toBe("");
    act(() => group().blur());
    const bar = flowLayout(flowModel(d), flowFit(800, 1, 3))!.columns[1]!.nodes[0]!;
    fireEvent.mouseMove(group(), { clientX: bar.x + 4, clientY: bar.y + 4 });
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("keeps the item read through newer figures and says its new sentence, and ends quietly on newer figures without it", () => {
    const { rerender } = focused();
    press("ArrowRight");
    rerender(<CostFlow d={view([["atlas-api", "claude-opus-4-5", 34], ...PAIRS.slice(1)])} onProject={() => {}} />);
    expect(live()).toBe("Project atlas-api: $70, 31.8% of $220. To opus-4-5 $34, sonnet-4-5 $18, gpt-5.1-codex $12 and 1 more.");
    // atlas-api now under 1% of the cost: folded into Other, so no node of its own.
    rerender(<CostFlow d={view([["atlas-api", "claude-opus-4-5", 1], ...PAIRS.slice(4)])} onProject={() => {}} />);
    expect([live(), screen.queryByRole("tooltip"), document.querySelector(".flow-mark")]).toEqual(["", null, null]);
  });
});

describe("cost flow: what it shows", () => {
  it.each([
    { view: view([], { totals: { ...d.totals, requests: 0, cost: null } }), text: "No usage in this view, so no cost to follow." },
    { view: view([], { totals: { ...d.totals, cost: null } }), text: "No request in this view is priced, so there is no cost to follow." },
    { view: view([["atlas-api", "claude-opus-4-5", 0]]), text: "The priced requests in this view cost $0.00, so there is no cost to follow." },
  ])("says why there is no flow: $text", ({ view: v, text }) => {
    show(v);
    expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByRole("group", { name: /^Estimated cost/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Show data table" })).toBeNull();
  });

  it("names the models in a key in a 343px box at a text scale of 2", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(343);
    document.documentElement.style.fontSize = "32px";
    show();
    expect(within(screen.getByRole("list", { name: "Model" })).getAllByRole("listitem")[0]!.textContent).toBe("opus-4-5 $100");
  });

  it("reads a model with no name and lists it in the data table, its cost under Reported", () => {
    const v = view([...PAIRS, ["atlas-api", null, 20]]);
    show(v);
    const n = flowLayout(flowModel(v), flowFit(800, 1, 3))!.columns[1]!.nodes.find(x => x.label === "(no model name)")!;
    fireEvent.mouseMove(group(), { clientX: n.x + 4, clientY: n.y + n.height / 2 });
    expect(live()).toBe("Model (no model name): $20, 8.7% of $230. From atlas-api $20. To Reported $20.");
    expect(tipRows().slice(0, 2)).toEqual(["Model", "(no model name)$20"]);
    fireEvent.click(screen.getByRole("button", { name: "Show data table" }));
    const rows = within(screen.getByRole("table", { name: "Estimated cost from project to model to token kind" })).getAllByRole("row");
    expect(rows.map(r => r.textContent)).toEqual(expect.arrayContaining(["Project to modelatlas-api(no model name)$20.008.7%", "Model to token kind(no model name)Reported$20.008.7%"]));
  });

  it("lists every pair of a project folded into Other in the data table, to the cent", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Show data table" }));
    const rows = within(screen.getByRole("table", { name: "Estimated cost from project to model to token kind" })).getAllByRole("row");
    expect(rows.map(r => r.textContent)).toContain("Project to modelfigopus-4-5$5.752.7%");
  });
});
