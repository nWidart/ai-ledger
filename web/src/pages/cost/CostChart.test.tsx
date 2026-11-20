import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Source, UsagePayload } from "../../api";
import usage from "../../__fixtures__/usage";
import { setOrder } from "../../colors";
import { dayRange, usd } from "../../format";
import { CostChart } from "./CostChart";
import type { Stack } from "./cost";
import { renderApp } from "../../testing";

const day = "2026-11-04";
const base = usage.by_project[0]!;
const proj = (project: string, cost: number) => ({ ...base, project, cost, unpriced: 0 });
const pd = (project: string, cost: number) => ({ day, project, cost, tokens: 1 });
// A owns a hue and is named; B to E are Other, with B the costliest.
const d: UsagePayload = { ...usage, start: day, end: day, range: 1, project: "", daily: [{ ...usage.daily[0]!, day, cost: 19.5, unpriced: 0 }],
  daily_projects: [pd("A", 10), pd("B", 5), pd("C", 3), pd("D", 1), pd("E", 0.5)],
  by_project: [proj("A", 10), proj("B", 5), proj("C", 3), proj("D", 1), proj("E", 0.5)] };

const chart = () => screen.getByRole("group", { name: /Estimated cost by project/ });
const open = () => {
  renderApp(<CostChart d={d} metric="cost" onMetric={() => {}} hidden={[]} onHidden={() => {}} scale="volume" onScale={() => {}} stack="project" onStack={() => {}} onProject={() => {}} onSource={() => {}} onDay={() => {}} />);
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
    renderApp(<CostChart d={{ ...d, daily: [{ ...d.daily[0]!, unpriced }] }} metric="cost" onMetric={() => {}} hidden={[]} onHidden={() => {}} scale="volume" onScale={() => {}} stack="project" onStack={() => {}} onProject={() => {}} onSource={() => {}} onDay={() => {}} />);
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
  const show = (data = long) => renderApp(<CostChart d={data} metric="cost" onMetric={() => {}} hidden={[]} onHidden={() => {}} scale="volume" onScale={() => {}} stack="project" onStack={() => {}} onProject={() => {}} onSource={() => {}} onDay={() => {}} />);

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
    return <CostChart d={data} metric="cost" onMetric={() => {}} hidden={[]} onHidden={() => {}} scale="volume" onScale={() => {}} stack={stack} onStack={setStack} onDay={() => {}} {...calls} />;
  }
  const keys = () => [...document.querySelectorAll(".legend .proj, .legend .key")].map(k => k.textContent);
  const tipRows = () => [...screen.getByRole("tooltip").querySelectorAll(".row:not(.sub)")].map(r => r.textContent);
  const hover = () => { act(() => screen.getByRole("group", { name: /Estimated cost/ }).focus()); fireEvent.keyDown(screen.getByRole("group", { name: /Estimated cost/ }), { key: "Home" }); };
  const sel = (name: string) => userEvent.click(screen.getByRole("button", { name }));
  afterEach(() => vi.clearAllMocks());

  it("is a labelled group, and Escape dismisses the tooltip the arrow keys opened", () => {
    renderApp(<Host data={split} />);
    expect(screen.queryByRole("tooltip")).toBeNull();
    hover();
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("group", { name: /Estimated cost/ }), { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.queryByRole("img", { name: /Estimated cost/ })).toBeNull();
  });

  it("offers a data table that follows the stacking and keeps the day's total", async () => {
    renderApp(<Host data={split} />);
    expect(screen.queryByRole("table")).toBeNull(); // closed on load, and not rendered
    await userEvent.click(screen.getByRole("button", { name: "Show data table" }));
    const heads = () => within(screen.getByRole("table")).getAllByRole("columnheader").map(h => h.textContent);
    expect(screen.getByRole("table", { name: "Estimated cost by project per day" })).toBeTruthy();
    expect(heads()).toEqual(["Day", "A", "Other (4)", "Total"]);
    const row = () => within(screen.getByRole("table")).getAllByRole("row")[1]!;
    expect(within(row()).getByRole("rowheader").textContent).toBe("Nov 4, 2026 so far"); // the view ends that day
    expect([...row().querySelectorAll("td")].map(c => c.textContent)).toEqual([usd(10), usd(9.5), usd(19.5)]);
    await sel("Model");
    expect(screen.getByRole("table", { name: "Estimated cost by model per day" })).toBeTruthy();
    expect(heads()).toEqual(["Day", "opus-4", "sonnet-4", "gpt-6", "Total"]);
    expect([...row().querySelectorAll("td")].at(-1)!.textContent).toBe(usd(19.5));
    await userEvent.click(screen.getByRole("button", { name: "Hide data table" }));
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("restacks the bars and the legend, and names the stacking", async () => {
    renderApp(<Host data={split} />);
    expect(keys().slice(0, 2)).toEqual(["A", "Other (4)"]);
    const fills = () => [...document.querySelectorAll(".bar-seg > *:not(.partial)")].map(e => e.getAttribute("fill"));
    expect(fills()).toHaveLength(2); // A and Other
    await sel("Model");
    expect(screen.getByRole("button", { name: "Model" }).getAttribute("aria-pressed")).toBe("true");
    expect(keys().slice(0, 3)).toEqual(["opus-4", "sonnet-4", "gpt-6"]);
    expect(fills()).toEqual(["var(--series-1)", "var(--series-2)", "var(--series-3)"]);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Estimated cost per day by model");
    expect(screen.getByRole("group", { name: /^Estimated cost by model per day, 1 days/ })).toBeTruthy();
    await sel("Agent");
    expect(keys().slice(0, 2)).toEqual(["Claude Code", "Codex"]);
    expect(screen.getByRole("group", { name: /^Estimated cost by agent per day/ })).toBeTruthy();
  });

  it("keeps the day's total the same in every stacking", async () => {
    renderApp(<Host data={split} />);
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
    renderApp(<Host data={many} first="model" />);
    expect(keys().slice(0, 7)).toEqual(["m1", "m2", "m3", "m4", "m5", "m6", "Other (4)"]);
    hover();
    expect([...screen.getByRole("tooltip").querySelectorAll(".row.sub")].map(r => r.textContent)).toEqual([`m7${usd(4)}`, `m8${usd(3)}`, `m9${usd(2)}`, "+ 1 more"]);
    expect(document.querySelector(".sr")!.textContent).toContain(`Other (4) ${usd(10)} (m7 ${usd(4)}, m8 ${usd(3)}, m9 ${usd(2)}, and 1 more)`);
  });

  it("filters to an agent from its key, and clears the filter from the same key", async () => {
    const { rerender } = renderApp(<Host data={split} first="source" />);
    await userEvent.click(screen.getByRole("button", { name: /Codex/ }));
    expect(calls.onSource).toHaveBeenCalledWith("codex");
    rerender(<Host data={{ ...split, source: "codex", daily_sources: [sd("codex", 0.5)] }} first="source" />);
    const key = screen.getByRole("button", { name: "Codex, show all agents" });
    await userEvent.click(key);
    expect(calls.onSource).toHaveBeenLastCalledWith("");
    expect(calls.onProject).not.toHaveBeenCalled();
  });

  it("keeps model keys plain: no filter", async () => {
    renderApp(<Host data={split} first="model" />);
    expect(document.querySelectorAll(".legend button.proj")).toHaveLength(0);
  });

  it("shows the switch only with the cost metric", () => {
    const { rerender } = renderApp(<CostChart d={split} metric="cost" onMetric={() => {}} hidden={[]} onHidden={() => {}} scale="volume" onScale={() => {}} stack="project" onStack={() => {}} onProject={() => {}} onSource={() => {}} onDay={() => {}} />);
    expect(screen.getByRole("group", { name: "Stack by" })).toBeTruthy();
    rerender(<CostChart d={split} metric="tokens" onMetric={() => {}} hidden={[]} onHidden={() => {}} scale="volume" onScale={() => {}} stack="project" onStack={() => {}} onProject={() => {}} onSource={() => {}} onDay={() => {}} />);
    expect(screen.queryByRole("group", { name: "Stack by" })).toBeNull();
  });

  it("offers all three stackings in a one-project view", async () => {
    renderApp(<Host data={{ ...split, project: "A", by_project: [proj("A", 19.5)] }} />);
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
    renderApp(<Host data={long} first="model" />);
    expect(document.querySelectorAll(".partial")).toHaveLength(1);
    expect(screen.getByText("Today so far")).toBeTruthy();
    act(() => screen.getByRole("group", { name: /Estimated cost by model/ }).focus());
    fireEvent.keyDown(screen.getByRole("group", { name: /Estimated cost by model/ }), { key: "End" });
    expect(document.querySelector(".sr")!.textContent).toContain("so far");
    expect(document.querySelector(".sr")!.textContent).not.toContain("7-day average");
    fireEvent.keyDown(screen.getByRole("group", { name: /Estimated cost by model/ }), { key: "ArrowLeft" });
    expect(document.querySelector(".sr")!.textContent).toContain(`7-day average ${usd(1)}`);
  });
});

describe("tokens chart: Share", () => {
  // Two days: 60 input, 20 output and 120 cache read (30%, 10%, 60% of 200), then a day with no tokens.
  const empty = { input: 0, output: 0, thinking: 0, cache_read: 0, cache_5m: 0, cache_1h: 0 };
  const tokens: UsagePayload = { ...d, start: day, end: "2026-11-05", range: 2,
    daily: [{ ...usage.daily[0]!, ...empty, day, input: 60, output: 20, cache_read: 120, cost: 1, unpriced: 0 }, { ...usage.daily[0]!, ...empty, day: "2026-11-05", cost: 0, unpriced: 0 }] };

  /** The tokens chart with a scale state of its own, as the page keeps it. */
  function Host({ data = tokens, first = "share", hidden = [] }: { data?: UsagePayload; first?: "volume" | "share"; hidden?: string[] }) {
    const [scale, setScale] = useState(first);
    return <CostChart d={data} metric="tokens" onMetric={() => {}} hidden={hidden} onHidden={() => {}} scale={scale} onScale={setScale} stack="project" onStack={() => {}}
      onProject={() => {}} onSource={() => {}} onDay={() => {}} />;
  }
  const chart = (name: RegExp | string) => screen.getByRole("group", { name });
  const read = (name: RegExp | string, key = "Home") => { act(() => chart(name).focus()); fireEvent.keyDown(chart(name), { key }); };
  const axis = () => [...document.querySelectorAll("svg text")].map(t => t.textContent).filter(t => t?.endsWith("%"));

  it("offers the scale only with tokens, Volume first, and switches to Share", async () => {
    renderApp(<Host first="volume" />);
    const scale = screen.getByRole("group", { name: "Scale" });
    expect(within(scale).getByRole("button", { name: "Volume" }).getAttribute("aria-pressed")).toBe("true");
    expect(chart(/^Tokens by kind per day/)).toBeTruthy();
    await userEvent.click(within(scale).getByRole("button", { name: "Share" }));
    expect(chart(/^Token share by kind per day/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Token share per day" })).toBeTruthy();
  });

  it("is not offered in the cost metric", () => {
    renderApp(<CostChart d={tokens} metric="cost" onMetric={() => {}} hidden={[]} onHidden={() => {}} scale="share" onScale={() => {}} stack="project" onStack={() => {}} onProject={() => {}} onSource={() => {}} onDay={() => {}} />);
    expect(screen.queryByRole("group", { name: "Scale" })).toBeNull();
  });

  it("fills the plot with each day's shares on a 0 to 100% axis, and draws no average or peak", () => {
    renderApp(<Host />);
    expect(axis()).toEqual(["0%", "25%", "50%", "75%", "100%"]);
    // The day with tokens is three segments; the day without is none.
    const heights = [...document.querySelectorAll(".bar-seg > :is(rect, path):not(.partial)")].map(s => s.getAttribute("height"));
    expect(document.querySelectorAll(".bar-seg")).toHaveLength(1);
    expect(heights.filter(Boolean).length + document.querySelectorAll(".bar-seg path").length).toBe(3);
    expect(screen.queryByText("7-day average")).toBeNull();
    expect(document.querySelector("svg text[font-weight='600']")).toBeNull();
  });

  it("draws a 1% share above zero height, under the 2px gap between segments", () => {
    const thin: UsagePayload = { ...tokens, daily: [{ ...tokens.daily[0]!, ...empty, input: 98, output: 1, cache_read: 1 }] };
    renderApp(<Host data={thin} />);
    const segs = [...document.querySelectorAll(".bar-seg > rect:not(.partial)")];
    expect(segs).toHaveLength(3);
    for (const s of segs) expect(Number(s.getAttribute("height"))).toBeGreaterThan(0);
  });

  it("gives two 0.1% shares room of their own, so no segment paints over another and the bar still fills the plot", () => {
    const thin: UsagePayload = { ...tokens, daily: [{ ...tokens.daily[0]!, ...empty, input: 998, output: 1, cache_read: 1 }] };
    renderApp(<Host data={thin} />);
    const segs = [...document.querySelectorAll(".bar-seg > rect:not(.partial)")]
      .map(s => ({ y: Number(s.getAttribute("y")), h: Number(s.getAttribute("height")) })).sort((p, q) => p.y - q.y);
    expect(segs).toHaveLength(3);
    for (let i = 1; i < segs.length; i++) expect(segs[i]!.y).toBeGreaterThanOrEqual(segs[i - 1]!.y + segs[i - 1]!.h + 2 - 1e-9);
    for (const s of segs) expect(s.h).toBeGreaterThanOrEqual(1 - 1e-9);
    // Top of the 100% line to the baseline: the 0% and 100% axis labels' rows bound the bar.
    const top = segs[0]!.y, bottom = segs.at(-1)!.y + segs.at(-1)!.h;
    const zero = [...document.querySelectorAll("svg line")].map(l => Number(l.getAttribute("y1")));
    expect(zero).toContain(bottom);
    expect(zero).toContain(top);
  });

  it("reads a day's shares and total in the tooltip and the screen-reader text", () => {
    renderApp(<Host />);
    read(/^Token share/);
    const rows = [...screen.getByRole("tooltip").querySelectorAll(".row")].map(r => r.textContent);
    expect(rows).toContain("Input30.0%");
    expect(rows).toContain("Output10.0%");
    expect(rows).toContain("Cache read60.0%");
    expect(rows.at(-1)).toBe("Total200");
    expect(document.querySelector(".sr")!.textContent).toContain("Input 30.0%, Output 10.0%, Thinking 0.0%, Cache read 60.0%, Cache write 5m 0.0%, Cache write 1h 0.0%, total 200");
    read(/^Token share/, "ArrowRight");
    expect(document.querySelector(".sr")!.textContent).toContain("no tokens");
    expect(screen.getByRole("tooltip").textContent).toContain("–");
  });

  it("takes a hidden kind out of the day's total, so the others still make 100%", () => {
    renderApp(<Host hidden={["cache_read"]} />);
    read(/^Token share/);
    expect(document.querySelector(".sr")!.textContent).toContain("Input 75.0%, Output 25.0%");
    expect(document.querySelector(".sr")!.textContent).toContain("total 80");
  });

  it("lists each day's shares and total tokens in the data table", async () => {
    renderApp(<Host />);
    await userEvent.click(screen.getByRole("button", { name: "Show data table" }));
    const table = screen.getByRole("table", { name: "Token share by kind per day" });
    const head = within(table).getAllByRole("columnheader").map(c => c.textContent);
    expect(head).toEqual(["Day", "Input", "Output", "Thinking", "Cache read", "Cache write 5m", "Cache write 1h", "Total"]);
    const [first, second] = within(table).getAllByRole("row").slice(1).map(r => [...r.querySelectorAll("td")].map(c => c.textContent));
    expect(first).toEqual(["30.0%", "10.0%", "0.0%", "60.0%", "0.0%", "0.0%", "200"]);
    expect(second!.slice(0, 6)).toEqual(Array(6).fill("–"));
  });

  it("keeps Volume's average line and peak label", () => {
    const days = dayRange("2026-10-16", "2026-11-04");
    const long: UsagePayload = { ...tokens, start: days[0]!, end: days.at(-1)!, range: 20,
      daily: days.map(x => ({ ...usage.daily[0]!, ...empty, day: x, input: 1, cost: 1, unpriced: 0 })) };
    renderApp(<Host data={long} first="volume" />);
    expect(screen.getByText("7-day average")).toBeTruthy();
    expect(document.querySelector("svg text[font-weight='600']")).not.toBeNull();
  });
});
