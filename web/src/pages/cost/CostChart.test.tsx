import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Source, UsagePayload } from "../../api";
import usage from "../../__fixtures__/usage";
import { setOrder } from "../../colors";
import { dayRange, usd } from "../../format";
import { CostChart } from "./CostChart";
import type { Stack } from "./cost";

const day = "2026-11-04";
const base = usage.by_project[0]!;
const proj = (project: string, cost: number) => ({ ...base, project, cost, unpriced: 0 });
const pd = (project: string, cost: number) => ({ day, project, cost, tokens: 1 });
// A owns a hue and is named; B to E are Other, with B the costliest.
const d: UsagePayload = { ...usage, start: day, end: day, range: 1, project: "", daily: [{ ...usage.daily[0]!, day, cost: 19.5, unpriced: 0 }],
  daily_projects: [pd("A", 10), pd("B", 5), pd("C", 3), pd("D", 1), pd("E", 0.5)],
  by_project: [proj("A", 10), proj("B", 5), proj("C", 3), proj("D", 1), proj("E", 0.5)] };

const chart = () => screen.getByRole("img", { name: /Estimated cost by project/ });
const open = () => {
  render(<CostChart d={d} metric="cost" onMetric={() => {}} hidden={[]} onHidden={() => {}} stack="project" onStack={() => {}} onProject={() => {}} onSource={() => {}} onDay={() => {}} />);
  act(() => chart().focus());
  fireEvent.keyDown(chart(), { key: "Home" });
};

beforeEach(() => {
  // The plot reads its size from the svg; jsdom lays nothing out.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, right: 800, bottom: 240, width: 800, height: 240, x: 0, y: 0, toJSON: () => ({}) });
  setOrder(["A"]);
});
afterEach(() => setOrder([]));

describe("cost tooltip: Other's projects", () => {
  it("lists the top three under Other, then + 1 more", () => {
    open();
    const rows = [...screen.getByRole("tooltip").querySelectorAll(".row.sub")].map(r => r.textContent);
    expect(rows).toEqual([`B${usd(5)}`, `C${usd(3)}`, `D${usd(1)}`, "+ 1 more"]);
  });

  it("reads the same list in the screen-reader text", () => {
    open();
    expect(document.querySelector(".sr")!.textContent).toContain(`Other (4) ${usd(9.5)} (B ${usd(5)}, C ${usd(3)}, D ${usd(1)}, and 1 more)`);
  });
});

describe("cost chart: unpriced requests", () => {
  const read = (unpriced: number) => {
    render(<CostChart d={{ ...d, daily: [{ ...d.daily[0]!, unpriced }] }} metric="cost" onMetric={() => {}} hidden={[]} onHidden={() => {}} stack="project" onStack={() => {}} onProject={() => {}} onSource={() => {}} onDay={() => {}} />);
    act(() => chart().focus());
    fireEvent.keyDown(chart(), { key: "Home" });
    return document.querySelector(".sr")!.textContent;
  };
  it("says 1 unpriced request in the singular", () => {
    const text = read(1);
    expect(text).toContain(", 1 unpriced request");
    expect(text).not.toContain("1 unpriced requests");
    expect(screen.getByRole("tooltip").textContent).toContain("1 unpriced request");
    expect(screen.getByRole("tooltip").textContent).not.toContain("1 unpriced requests");
  });
  it("says 3 unpriced requests in the plural", () => expect(read(3)).toContain(", 3 unpriced requests"));
});

describe("cost chart: today so far", () => {
  // 20 days ending today ($1 a day, today $40): the average covers complete days only.
  const days = dayRange("2026-10-16", "2026-11-04");
  const long: UsagePayload = { ...d, start: days[0]!, end: days.at(-1)!, range: 20,
    daily: days.map((x, i) => ({ ...usage.daily[0]!, day: x, cost: i === 19 ? 40 : 1, unpriced: 0 })),
    daily_projects: days.map((x, i) => ({ day: x, project: "A", cost: i === 19 ? 40 : 1, tokens: 1 })), by_project: [proj("A", 59)] };
  const show = (data = long) => render(<CostChart d={data} metric="cost" onMetric={() => {}} hidden={[]} onHidden={() => {}} stack="project" onStack={() => {}} onProject={() => {}} onSource={() => {}} onDay={() => {}} />);

  it("hatches only today's bar and keys it in the legend", () => {
    show();
    expect(document.querySelectorAll(".partial")).toHaveLength(1);
    expect(document.querySelector(".partial")!.getAttribute("fill")).toBe("url(#partial-day)");
    expect(screen.getByText("Today so far")).toBeTruthy();
  });

  it("labels today 'so far' in the tooltip and the screen-reader text, and yesterday not", () => {
    show();
    act(() => chart().focus());
    fireEvent.keyDown(chart(), { key: "End" });
    expect(screen.getByRole("tooltip").textContent).toContain("so far");
    expect(document.querySelector(".sr")!.textContent).toContain("so far");
    fireEvent.keyDown(chart(), { key: "ArrowLeft" });
    expect(document.querySelector(".sr")!.textContent).not.toContain("so far");
  });

  it("leaves today out of the average: the line ends yesterday and has no point for today", () => {
    show();
    act(() => chart().focus());
    fireEvent.keyDown(chart(), { key: "End" });
    expect(document.querySelector(".sr")!.textContent).not.toContain("7-day average");
    fireEvent.keyDown(chart(), { key: "ArrowLeft" });
    expect(document.querySelector(".sr")!.textContent).toContain(`7-day average ${usd(1)}`); // not dragged up by today's $40
    const line = document.querySelectorAll("svg path[stroke='var(--text-primary)']")[0]!.getAttribute("d")!;
    expect(line.split("L")).toHaveLength(13); // the 7th to the 19th day
  });
});

describe("cost chart: stack by", () => {
  const md = (model: string, cost: number) => ({ day, model, cost });
  const sd = (source: Source, cost: number) => ({ day, source, cost });
  // The day's $19.5 by model (the prefix stripped in labels) and by agent.
  const split: UsagePayload = { ...d, daily_models: [md("claude-opus-4", 12), md("claude-sonnet-4", 7), md("gpt-6", 0.5)],
    daily_sources: [sd("claude", 19), sd("codex", 0.5)] };
  // Ten models, $10 down to $1: six get a series color, the four others share Other.
  const tens = Array.from({ length: 10 }, (_, i) => md(`m${i + 1}`, 10 - i));
  const many: UsagePayload = { ...split, daily: [{ ...usage.daily[0]!, day, cost: 55, unpriced: 0 }], daily_models: tens };
  const calls = { onSource: vi.fn(), onProject: vi.fn() };

  /** The chart with a stack state of its own, as the page keeps it. */
  function Host({ data, first }: { data: UsagePayload; first?: Stack }) {
    const [stack, setStack] = useState<Stack>(first ?? "project");
    return <CostChart d={data} metric="cost" onMetric={() => {}} hidden={[]} onHidden={() => {}} stack={stack} onStack={setStack} onDay={() => {}} {...calls} />;
  }
  const keys = () => [...document.querySelectorAll(".legend .proj, .legend .key")].map(k => k.textContent);
  const tipRows = () => [...screen.getByRole("tooltip").querySelectorAll(".row:not(.sub)")].map(r => r.textContent);
  const hover = () => { act(() => screen.getByRole("img", { name: /Estimated cost/ }).focus()); fireEvent.keyDown(screen.getByRole("img", { name: /Estimated cost/ }), { key: "Home" }); };
  const sel = (name: string) => userEvent.click(screen.getByRole("button", { name }));
  afterEach(() => vi.clearAllMocks());

  it("restacks the bars and the legend, and names the stacking", async () => {
    render(<Host data={split} />);
    expect(keys().slice(0, 2)).toEqual(["A", "Other (4)"]);
    const fills = () => [...document.querySelectorAll(".bar-seg > *:not(.partial)")].map(e => e.getAttribute("fill"));
    expect(fills()).toHaveLength(2); // A and Other
    await sel("Model");
    expect(screen.getByRole("button", { name: "Model" }).getAttribute("aria-pressed")).toBe("true");
    expect(keys().slice(0, 3)).toEqual(["opus-4", "sonnet-4", "gpt-6"]);
    expect(fills()).toEqual(["var(--series-1)", "var(--series-2)", "var(--series-3)"]);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Estimated cost per day by model");
    expect(screen.getByRole("img", { name: /^Estimated cost by model per day, 1 days/ })).toBeTruthy();
    await sel("Agent");
    expect(keys().slice(0, 2)).toEqual(["Claude Code", "Codex"]);
    expect(screen.getByRole("img", { name: /^Estimated cost by agent per day/ })).toBeTruthy();
  });

  it("keeps the day's total the same in every stacking", async () => {
    render(<Host data={split} />);
    for (const name of ["Project", "Model", "Agent"]) {
      await sel(name);
      hover();
      expect(screen.getByRole("tooltip").querySelector(".tot")!.textContent).toBe(`Total${usd(19.5)}`);
      expect(document.querySelector(".sr")!.textContent).toContain(`${usd(19.5)} estimated by ${{ Project: "project", Model: "model", Agent: "agent" }[name]}: `);
    }
    await sel("Model");
    hover();
    expect(tipRows()).toEqual([`gpt-6${usd(0.5)}`, `sonnet-4${usd(7)}`, `opus-4${usd(12)}`, `Total${usd(19.5)}`]);
  });

  it("lists the top three models inside Other, then + 1 more", async () => {
    render(<Host data={many} first="model" />);
    expect(keys().slice(0, 7)).toEqual(["m1", "m2", "m3", "m4", "m5", "m6", "Other (4)"]);
    hover();
    expect([...screen.getByRole("tooltip").querySelectorAll(".row.sub")].map(r => r.textContent)).toEqual([`m7${usd(4)}`, `m8${usd(3)}`, `m9${usd(2)}`, "+ 1 more"]);
    expect(document.querySelector(".sr")!.textContent).toContain(`Other (4) ${usd(10)} (m7 ${usd(4)}, m8 ${usd(3)}, m9 ${usd(2)}, and 1 more)`);
  });

  it("filters to an agent from its key, and clears the filter from the same key", async () => {
    const { rerender } = render(<Host data={split} first="source" />);
    await userEvent.click(screen.getByRole("button", { name: /Codex/ }));
    expect(calls.onSource).toHaveBeenCalledWith("codex");
    rerender(<Host data={{ ...split, source: "codex", daily_sources: [sd("codex", 0.5)] }} first="source" />);
    const key = screen.getByRole("button", { name: "Codex, show all agents" });
    await userEvent.click(key);
    expect(calls.onSource).toHaveBeenLastCalledWith("");
    expect(calls.onProject).not.toHaveBeenCalled();
  });

  it("keeps model keys plain: no filter", async () => {
    render(<Host data={split} first="model" />);
    expect(document.querySelectorAll(".legend button.proj")).toHaveLength(0);
  });

  it("shows the switch only with the cost metric", () => {
    const { rerender } = render(<CostChart d={split} metric="cost" onMetric={() => {}} hidden={[]} onHidden={() => {}} stack="project" onStack={() => {}} onProject={() => {}} onSource={() => {}} onDay={() => {}} />);
    expect(screen.getByRole("group", { name: "Stack by" })).toBeTruthy();
    rerender(<CostChart d={split} metric="tokens" onMetric={() => {}} hidden={[]} onHidden={() => {}} stack="project" onStack={() => {}} onProject={() => {}} onSource={() => {}} onDay={() => {}} />);
    expect(screen.queryByRole("group", { name: "Stack by" })).toBeNull();
  });

  it("offers all three stackings in a one-project view", async () => {
    render(<Host data={{ ...split, project: "A", by_project: [proj("A", 19.5)] }} />);
    expect(keys()[0]).toBe("A ✕");
    await sel("Model");
    expect(keys().slice(0, 3)).toEqual(["opus-4", "sonnet-4", "gpt-6"]);
  });

  // 20 days ending today ($1 a day, today $40), all on one model.
  it("still hatches today and leaves it out of the average when stacked by model", async () => {
    const days = dayRange("2026-10-16", "2026-11-04");
    const long: UsagePayload = { ...d, start: days[0]!, end: days.at(-1)!, range: 20,
      daily: days.map((x, i) => ({ ...usage.daily[0]!, day: x, cost: i === 19 ? 40 : 1, unpriced: 0 })),
      daily_projects: days.map((x, i) => ({ day: x, project: "A", cost: i === 19 ? 40 : 1, tokens: 1 })), by_project: [proj("A", 59)],
      daily_models: days.map((x, i) => ({ day: x, model: "claude-opus-4", cost: i === 19 ? 40 : 1 })) };
    render(<Host data={long} first="model" />);
    expect(document.querySelectorAll(".partial")).toHaveLength(1);
    expect(screen.getByText("Today so far")).toBeTruthy();
    act(() => screen.getByRole("img", { name: /Estimated cost by model/ }).focus());
    fireEvent.keyDown(screen.getByRole("img", { name: /Estimated cost by model/ }), { key: "End" });
    expect(document.querySelector(".sr")!.textContent).toContain("so far");
    expect(document.querySelector(".sr")!.textContent).not.toContain("7-day average");
    fireEvent.keyDown(screen.getByRole("img", { name: /Estimated cost by model/ }), { key: "ArrowLeft" });
    expect(document.querySelector(".sr")!.textContent).toContain(`7-day average ${usd(1)}`);
  });
});
