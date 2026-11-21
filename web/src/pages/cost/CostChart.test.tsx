import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Source, UsagePayload } from "../../api";
import usage from "../../__fixtures__/usage";
import { setOrder } from "../../colors";
import type { SeriesOption } from "../../components/echart/echarts";
import { drawn } from "../../components/echart/testing";
import { dayRange, usd } from "../../format";
import { CostChart } from "./CostChart";
import type { Stack } from "./cost";
import { renderApp } from "../../testing";

// What the chart draws is costDaily.test.ts's to test. Here only that the component hands the wrapper the current view's
// option: how many kinds the stack in the fake runtime's last option draws (each data row is [day, total, ...values]).
const drawnKinds = async () => {
  const series = (await drawn()).last!.series as SeriesOption[];
  return ((series.find(s => s.id === "stack")!.data as number[][])[0]!.length) - 2;
};

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

beforeEach(() => setOrder(["A"]));
afterEach(() => setOrder([]));

describe("cost tooltip: Other's projects", () => {
  it("lists the top three under Other, then + 1 more, in the tooltip and the screen-reader text", () => {
    open();
    const rows = [...screen.getByRole("tooltip").querySelectorAll(".row.sub")].map(r => r.textContent);
    expect(rows).toEqual([`B${usd(5)}`, `C${usd(3)}`, `D${usd(1)}`, "+ 1 more"]);
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
});

describe("cost chart: today so far", () => {
  // 20 days ending today ($1 a day, today $40): the average covers complete days only.
  const days = dayRange("2026-10-16", "2026-11-04");
  const long: UsagePayload = { ...d, start: days[0]!, end: days.at(-1)!, range: 20,
    daily: days.map((x, i) => ({ ...usage.daily[0]!, day: x, cost: i === 19 ? 40 : 1, unpriced: 0 })),
    daily_projects: days.map((x, i) => ({ day: x, project: "A", cost: i === 19 ? 40 : 1, tokens: 1 })), by_project: [proj("A", 59)] };
  const show = (data = long) => renderApp(<CostChart d={data} metric="cost" onMetric={() => {}} hidden={[]} onHidden={() => {}} scale="volume" onScale={() => {}} stack="project" onStack={() => {}} onProject={() => {}} onSource={() => {}} onDay={() => {}} />);

  it("keys today in the legend, and labels it 'so far' in the tooltip and the screen-reader text, and yesterday not", () => {
    show();
    expect(screen.getByText("Today so far")).toBeTruthy();
    act(() => chart().focus());
    fireEvent.keyDown(chart(), { key: "End" });
    expect(screen.getByRole("tooltip").textContent).toContain("so far");
    expect(document.querySelector(".sr")!.textContent).toContain("so far");
    fireEvent.keyDown(chart(), { key: "ArrowLeft" });
    expect(document.querySelector(".sr")!.textContent).not.toContain("so far");
  });

  it("leaves today out of the average it reads", () => {
    show();
    act(() => chart().focus());
    fireEvent.keyDown(chart(), { key: "End" });
    expect(document.querySelector(".sr")!.textContent).not.toContain("7-day average");
    fireEvent.keyDown(chart(), { key: "ArrowLeft" });
    expect(document.querySelector(".sr")!.textContent).toContain(`7-day average ${usd(1)}`); // not dragged up by today's $40
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
    expect(await drawnKinds()).toBe(2); // A and Other
    await sel("Model");
    expect(screen.getByRole("button", { name: "Model" }).getAttribute("aria-pressed")).toBe("true");
    expect(keys().slice(0, 3)).toEqual(["opus-4", "sonnet-4", "gpt-6"]);
    expect(document.querySelectorAll(".legend button.proj")).toHaveLength(0); // model keys filter nothing
    expect(await drawnKinds()).toBe(3);
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

  it("shows the stack switch only with the cost metric, and the scale only with tokens", () => {
    const { rerender } = renderApp(<CostChart d={split} metric="cost" onMetric={() => {}} hidden={[]} onHidden={() => {}} scale="share" onScale={() => {}} stack="project" onStack={() => {}} onProject={() => {}} onSource={() => {}} onDay={() => {}} />);
    expect(screen.getByRole("group", { name: "Stack by" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Scale" })).toBeNull();
    rerender(<CostChart d={split} metric="tokens" onMetric={() => {}} hidden={[]} onHidden={() => {}} scale="share" onScale={() => {}} stack="project" onStack={() => {}} onProject={() => {}} onSource={() => {}} onDay={() => {}} />);
    expect(screen.queryByRole("group", { name: "Stack by" })).toBeNull();
    expect(screen.getByRole("group", { name: "Scale" })).toBeTruthy();
  });

  it("offers all three stackings in a one-project view", async () => {
    renderApp(<Host data={{ ...split, project: "A", by_project: [proj("A", 19.5)] }} />);
    expect(keys()[0]).toBe("A ✕");
    await sel("Model");
    expect(keys().slice(0, 3)).toEqual(["opus-4", "sonnet-4", "gpt-6"]);
  });
});

describe("tokens chart: Share", () => {
  // Two days: 60 input, 20 output and 120 cache read (30%, 10%, 60% of 200), then a day with no tokens.
  const empty = { input: 0, output: 0, thinking: 0, cache_read: 0, cache_5m: 0, cache_1h: 0 };
  const tokens: UsagePayload = { ...d, start: day, end: "2026-11-05", range: 2,
    daily: [{ ...usage.daily[0]!, ...empty, day, input: 60, output: 20, cache_read: 120, cost: 1, unpriced: 0 }, { ...usage.daily[0]!, ...empty, day: "2026-11-05", cost: 0, unpriced: 0 }] };

  /** The tokens chart with a scale state of its own, as the page keeps it. */
  function Host({ data = tokens, first = "share" }: { data?: UsagePayload; first?: "volume" | "share" }) {
    const [scale, setScale] = useState(first);
    return <CostChart d={data} metric="tokens" onMetric={() => {}} hidden={[]} onHidden={() => {}} scale={scale} onScale={setScale} stack="project" onStack={() => {}}
      onProject={() => {}} onSource={() => {}} onDay={() => {}} />;
  }
  const chart = (name: RegExp | string) => screen.getByRole("group", { name });
  const read = (name: RegExp | string, key = "Home") => { act(() => chart(name).focus()); fireEvent.keyDown(chart(name), { key }); };

  it("offers the scale only with tokens, Volume first, and switches to Share", async () => {
    renderApp(<Host first="volume" />);
    const scale = screen.getByRole("group", { name: "Scale" });
    expect(within(scale).getByRole("button", { name: "Volume" }).getAttribute("aria-pressed")).toBe("true");
    expect(chart(/^Tokens by kind per day/)).toBeTruthy();
    await userEvent.click(within(scale).getByRole("button", { name: "Share" }));
    expect(chart(/^Token share by kind per day/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Token share per day" })).toBeTruthy();
  });

  it("keys Volume's 7-day average, and none in Share", () => {
    const days = dayRange("2026-10-16", "2026-11-04");
    const long: UsagePayload = { ...tokens, start: days[0]!, end: days.at(-1)!, range: 20,
      daily: days.map(x => ({ ...usage.daily[0]!, ...empty, day: x, input: 1, cost: 1, unpriced: 0 })) };
    const { unmount } = renderApp(<Host data={long} first="volume" />);
    expect(screen.getByText("7-day average")).toBeTruthy();
    unmount();
    renderApp(<Host data={long} />);
    expect(screen.queryByText("7-day average")).toBeNull();
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

  it("opens a day with tokens on Enter, and keeps the reading open on a day with none", async () => {
    const onDay = vi.fn<(day: string) => void>();
    renderApp(<CostChart d={tokens} metric="tokens" onMetric={() => {}} hidden={[]} onHidden={() => {}} scale="share" onScale={() => {}} stack="project" onStack={() => {}}
      onProject={() => {}} onSource={() => {}} onDay={onDay} />);
    read(/^Token share/, "End");
    fireEvent.keyDown(chart(/^Token share/), { key: "Enter" });
    expect(onDay).not.toHaveBeenCalled();
    expect(screen.getByRole("tooltip")).toBeTruthy();
    expect(document.querySelector(".sr")!.textContent).toContain("no tokens");
    const chartRuntime = await drawn();
    chartRuntime.fire("click", chartRuntime.pointAt(1));
    expect(onDay).not.toHaveBeenCalled();
    fireEvent.keyDown(chart(/^Token share/), { key: "Home" });
    fireEvent.keyDown(chart(/^Token share/), { key: "Enter" });
    expect(onDay).toHaveBeenCalledWith(day);
    expect(screen.queryByRole("tooltip")).toBeNull();
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
});

describe("cost chart: zoom", () => {
  // 30 days, Oct 6 to Nov 4, the cost rising $1 a day: Oct 11 is day 5, Oct 20 day 14.
  const view = (from: string, to: string): UsagePayload => {
    const days = dayRange(from, to);
    return { ...d, start: days[0]!, end: days.at(-1)!, range: days.length,
      daily: days.map((x, i) => ({ ...usage.daily[0]!, day: x, cost: i + 1, unpriced: 0 })),
      daily_projects: days.map((x, i) => ({ day: x, project: "A", cost: i + 1, tokens: 1 })), by_project: [proj("A", 465)],
      daily_models: days.map((x, i) => ({ day: x, model: "claude-opus-4", cost: i + 1 })) };
  };
  const month = view("2026-10-06", "2026-11-04");
  function Host({ data = month }: { data?: UsagePayload }) {
    const [stack, setStack] = useState<Stack>("project");
    return <CostChart d={data} metric="cost" onMetric={() => {}} hidden={[]} onHidden={() => {}} scale="volume" onScale={() => {}} stack={stack} onStack={setStack}
      onProject={() => {}} onSource={() => {}} onDay={() => {}} />;
  }
  const group = () => screen.getByRole("group", { name: /^Estimated cost/ });
  const sr = () => document.querySelector(".sr")!.textContent;
  const showAll = () => screen.queryByRole("button", { name: "Show all days" });
  const hint = () => document.querySelector("#spend .hint")!.textContent;
  const slider = async () => ((await drawn()).last!.dataZoom as unknown[] | undefined) ?? [];
  /** The slider dragged to days from..to. */
  const drag = async (from: number, to: number) => (await drawn()).zoomTo(from, to);

  it("draws no slider and takes no zoom key under 14 days; from 14 days the slider, 28px more, and the zoom keys named", async () => {
    const { unmount } = renderApp(<Host data={view("2026-10-24", "2026-11-05")} />);
    expect(await slider()).toEqual([]);
    expect(group().style.height).toBe("240px");
    expect(group().getAttribute("aria-label")).not.toContain("plus and minus");
    expect(hint()).not.toContain("zoom");
    act(() => group().focus());
    expect(fireEvent.keyDown(group(), { key: "+" })).toBe(true);
    expect(fireEvent.keyDown(group(), { key: "-" })).toBe(true);
    unmount();
    renderApp(<Host data={view("2026-10-22", "2026-11-04")} />);
    expect(await slider()).toHaveLength(1);
    expect(group().style.height).toBe("268px");
    expect(group().getAttribute("aria-label")).toContain("plus and minus");
    expect(hint()).toContain("zoom");
  });

  it("says the days a drag of the slider shows, and keeps the label, the heading and the data table to every day", async () => {
    renderApp(<Host />);
    const label = group().getAttribute("aria-label"), heading = screen.getByRole("heading", { level: 2 }).textContent;
    await drag(5, 14);
    expect(sr()).toBe("Showing Oct 11 to Oct 20, 10 of 30 days.");
    expect(group().getAttribute("aria-label")).toBe(label);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(heading);
    await userEvent.click(screen.getByRole("button", { name: "Show data table" }));
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(31);
  });

  it("shows 'Show all days' while zoomed; it shows every day, goes away and returns the focus to the chart", async () => {
    renderApp(<Host />);
    expect(showAll()).toBeNull();
    await drag(5, 14);
    await userEvent.click(showAll()!);
    const chart = await drawn();
    expect(chart.shown).toEqual({ from: 0, to: 29 });
    expect(showAll()).toBeNull();
    expect(document.activeElement).toBe(group());
    expect(sr()).toBe("Showing all 30 days.");
  });

  it("shows every day again when a rolling range moves on a day, and moves the focus from 'Show all days' to the chart", async () => {
    const { rerender } = renderApp(<Host />);
    const chart = await drawn();
    await drag(5, 14);
    act(() => showAll()!.focus());
    rerender(<Host data={{ ...view("2026-10-07", "2026-11-05"), range: 30 }} />); // midnight: the range moved on a day
    expect(chart.shown).toEqual({ from: 0, to: 29 }); // its first day is another view's
    expect(showAll()).toBeNull();
    expect(document.activeElement).toBe(group());

    // With the focus elsewhere, it stays there.
    await drag(5, 14);
    const metric = screen.getByRole("button", { name: "Tokens" });
    act(() => metric.focus());
    rerender(<Host data={{ ...view("2026-10-08", "2026-11-06"), range: 30 }} />);
    expect(showAll()).toBeNull();
    expect(document.activeElement).toBe(metric);
  });

  it("moves the focus from 'Show all days' to the chart when the view falls under 14 days and loses its slider", async () => {
    const { rerender } = renderApp(<Host />);
    await drag(5, 14);
    act(() => showAll()!.focus());
    rerender(<Host data={view("2026-10-24", "2026-11-05")} />); // 13 days: no zoom any more
    expect(showAll()).toBeNull();
    expect(await slider()).toEqual([]);
    expect(document.activeElement).toBe(group());
  });

  it("shows every day again when an all-time view gains an earlier first day, as after an ingest of older transcripts", async () => {
    const all = (from: string): UsagePayload => ({ ...view(from, "2026-11-04"), range: 0, start: null });
    const { rerender } = renderApp(<Host data={all("2026-10-06")} />);
    const chart = await drawn();
    await drag(5, 14);
    rerender(<Host data={all("2026-10-05")} />);
    expect(chart.shown).toEqual({ from: 0, to: 30 });
    expect(showAll()).toBeNull();
  });

  it("keeps the zoom on its days when an all-time view gains a day at its end", async () => {
    const all = (to: string): UsagePayload => ({ ...view("2026-10-06", to), range: 0, start: null });
    const { rerender } = renderApp(<Host data={all("2026-11-04")} />);
    const chart = await drawn();
    await drag(5, 14);
    rerender(<Host data={all("2026-11-05")} />);
    expect(chart.points).toBe(31);
    expect(chart.shown).toEqual({ from: 5, to: 14 }); // Oct 11 to Oct 20 still
    expect(showAll()).toBeTruthy();
  });

  it("keeps the zoom when a token kind is hidden or shown, on the whole view's new value axis", async () => {
    function Tokens() {
      const [hidden, setHidden] = useState<string[]>([]);
      const data: UsagePayload = { ...month, daily: month.daily.map(r => ({ ...r, input: 100, output: 50, thinking: 10, cache_read: 1000, cache_5m: 0, cache_1h: 0 })) };
      return <CostChart d={data} metric="tokens" onMetric={() => {}} hidden={hidden} onHidden={setHidden} scale="volume" onScale={() => {}} stack="project" onStack={() => {}}
        onProject={() => {}} onSource={() => {}} onDay={() => {}} />;
    }
    renderApp(<Tokens />);
    const chart = await drawn();
    const max = () => (chart.last!.yAxis as { max: number }).max;
    await drag(5, 14);
    const before = max();
    await userEvent.click(screen.getByRole("button", { name: "Cache read" }));
    expect(max()).toBeLessThan(before); // the axis is the whole view's, without the hidden kind
    expect(chart.shown).toEqual({ from: 5, to: 14 });
    expect(showAll()).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Cache read" }));
    expect(max()).toBe(before);
    expect(chart.shown).toEqual({ from: 5, to: 14 });
  });

  it("shows every day again after a stack switch or a new view", async () => {
    const { rerender } = renderApp(<Host />);
    const chart = await drawn();
    await drag(5, 14);
    await userEvent.click(screen.getByRole("button", { name: "Model" }));
    expect(chart.shown).toEqual({ from: 0, to: 29 });
    expect(showAll()).toBeNull();
    await drag(5, 14);
    expect(showAll()).toBeTruthy();
    rerender(<Host data={view("2026-10-16", "2026-11-04")} />);
    expect(chart.shown).toEqual({ from: 0, to: 19 });
    expect(showAll()).toBeNull();
  });
});

// The page sets the project order after its payload lands (and the nav's status poll sets it too), so the chart can be drawn
// before the order it colors by: it follows the order when it arrives, with the same payload, in the same view.
describe("cost chart: project order", () => {
  // 20 days, A and B $1 a day each.
  const days = dayRange("2026-10-16", "2026-11-04");
  const two: UsagePayload = { ...d, start: days[0]!, end: days.at(-1)!, range: 20,
    daily: days.map(x => ({ ...usage.daily[0]!, day: x, cost: 2, unpriced: 0 })),
    daily_projects: days.flatMap(x => [pd("A", 1), pd("B", 1)].map(r => ({ ...r, day: x }))), by_project: [proj("A", 20), proj("B", 20)] };
  const NONE: string[] = []; // the page holds the hidden kinds in state: one array while they do not change
  const chartOf = (data: UsagePayload) => <CostChart d={data} metric="cost" onMetric={() => {}} hidden={NONE} onHidden={() => {}} scale="volume" onScale={() => {}}
    stack="project" onStack={() => {}} onProject={() => {}} onSource={() => {}} onDay={() => {}} />;
  const keys = () => [...document.querySelectorAll("#spend .legend > :is(button, .key)")].map(k => k.textContent);
  const group = () => screen.getByRole("group", { name: /^Estimated cost/ });

  it("stacks the projects in their colors once the order arrives, with the same payload", async () => {
    setOrder([]);
    renderApp(chartOf(d));
    expect(keys()).toEqual(["Other (5)", "Today so far"]);
    expect(await drawnKinds()).toBe(1);
    act(() => setOrder(["A"]));
    expect(keys()).toEqual(["A", "Other (4)", "Today so far"]);
    expect(await drawnKinds()).toBe(2);
  });

  it("keeps the day read and the zoom through an order change, and draws nothing again for an unrelated render", async () => {
    setOrder(["A"]);
    const { rerender } = renderApp(chartOf(two));
    const chart = await drawn();
    chart.zoomTo(5, 14);
    act(() => group().focus());
    fireEvent.keyDown(group(), { key: "End" });
    fireEvent.keyDown(group(), { key: "ArrowLeft" }); // Nov 3, inside the days shown after End moved them
    const reading = document.querySelector(".sr")!.textContent, shown = chart.shown, draws = chart.options.length;
    expect(reading).toMatch(/^Nov 3, 2026: /);
    rerender(chartOf(two));
    expect(chart.options.length).toBe(draws); // the same drawing
    act(() => setOrder(["A", "B"]));
    expect(chart.options.length).toBeGreaterThan(draws); // a new drawing, in the same view
    expect(keys().slice(0, 2)).toEqual(["A", "B"]);
    expect(chart.shown).toEqual(shown);
    expect(screen.getByRole("tooltip").textContent).toContain("Nov 3, 2026");
    // The day read is still Nov 3. A key made the reading, and its words changed (B is no longer in Other): said again.
    expect(reading).toContain("Other (1)");
    expect(document.querySelector(".sr")!.textContent).toMatch(/^Nov 3, 2026: /);
    expect(document.querySelector(".sr")!.textContent).not.toContain("Other");
  });
});
