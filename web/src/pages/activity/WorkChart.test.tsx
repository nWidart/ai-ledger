import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyWorkRow, UsagePayload } from "../../api";
import usage from "../../__fixtures__/usage";
import { color, setOrder } from "../../colors";
import type { SeriesOption } from "../../components/echart/echarts";
import { drawn } from "../../components/echart/testing";
import { dayRange } from "../../format";
import { renderApp } from "../../testing";
import { failRate, workBuckets, workKinds, workStack, type WorkMetric } from "./work";
import { WorkPanel } from "./WorkChart";
import type { WorkPick } from "./workTracks";

// What the chart draws (the stack, the rate line and its dots, the scales, the layout, the mark) is workTracks.test.ts's to
// test. Here: what a user reaches, and that the component hands the wrapper the current view's option.
const row = (day: string, o: Partial<DailyWorkRow> = {}): DailyWorkRow => ({ day, sessions: 1, prompts: 1, commits: 0, calls: 0, failed_calls: 0, ...o });
type WP = UsagePayload["work_projects"][number];
const wp = (day: string, project: string | null, o: Partial<WP> = {}): WP => ({ day, project, sessions: 1, prompts: 1, commits: 0, calls: 0, failed_calls: 0, ...o });

// Seven projects over two days: a gets the most commits, g the most prompts; the bars add up their rows.
const projects = ["a", "b", "c", "d", "e", "f", "g"];
const split: WP[] = ["2026-11-04", "2026-11-05"].flatMap((day, j) => projects.map((p, i) => wp(day, p, { commits: 7 - i + j, prompts: i + 1 })));
const sum = (day: string, k: WorkMetric) => split.filter(r => r.day === day).reduce((s, r) => s + r[k], 0);
const two = ["2026-11-04", "2026-11-05"].map(day => row(day, { sessions: 7, commits: sum(day, "commits"), prompts: sum(day, "prompts"), calls: 10, failed_calls: 1 }));
const many: UsagePayload = { ...usage, work: two, daily_work: two, work_projects: split };

// Ten weeks to Wednesday Nov 11, work in two of them.
const weekly: UsagePayload = {
  ...usage, range: 0, start: null, end: "2026-11-11", work_bucket: "week",
  work: [row("2026-09-07", { commits: 3, calls: 10, failed_calls: 1 }), row("2026-10-19", { commits: 5, calls: 20, failed_calls: 2 })],
  work_projects: [wp("2026-09-07", "foo", { commits: 3 }), wp("2026-10-19", "foo", { commits: 5 })],
};

const panel = (d: UsagePayload, metric: WorkMetric = "commits", selected: WorkPick | null = null, pickable = true) => {
  const onPick = vi.fn<(p: WorkPick) => void>(), onClear = vi.fn<() => void>();
  const view = renderApp(<WorkPanel d={d} metric={metric} onMetric={() => {}} selected={selected} onPick={pickable ? onPick : undefined} onClear={onClear} />);
  return { onPick, onClear, ...view };
};
const chart = () => screen.getByRole("group", { name: /per (day|week)/ });
const sr = () => document.querySelector("#work div.sr[aria-live]")!.textContent;
/** The series of the fake runtime's last drawing. */
const series = async () => (await drawn()).last!.series as SeriesOption[];
const mark = async () => (await series()).find(s => s.id === "selected") as { data: number[][] } | undefined;

beforeEach(() => {
  // The tooltip is placed inside the box; jsdom lays nothing out.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, right: 800, bottom: 240, width: 800, height: 240, x: 0, y: 0, toJSON: () => ({}) });
});

describe("work buckets", () => {
  it("fill every Monday from the first week with a session to the week of the end", () => {
    const ws = workBuckets(weekly);
    expect(ws.map(r => r.day)).toEqual(["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09"]);
    expect(ws[1]).toEqual({ day: "2026-09-14", sessions: 0, prompts: 0, commits: 0, calls: 0, failed_calls: 0 });
    expect(ws.reduce((s, r) => s + r.commits, 0)).toBe(8);
  });

  it("keep days for a day bucket", () => {
    expect(workBuckets(usage).map(r => r.day)).toEqual(["2026-11-04", "2026-11-05"]);
  });

  it("rate failures per 100 calls, with no rate without calls", () => {
    expect(failRate(row("x", { calls: 4, failed_calls: 2 }))).toBe(50);
    expect(failRate(row("x", { calls: 200, failed_calls: 6 }))).toBe(3);
    expect(failRate(row("x"))).toBeNull();
  });
});

describe("chart by project", () => {
  // a, c, e and g own a hue; b, d and f are grey, so they fold into Other.
  beforeEach(() => setOrder(["a", "c", "e", "g"]));
  afterEach(() => setOrder([]));

  it("names only the projects with a hue, by the metric, and folds the rest into Other", () => {
    const rows = workBuckets(many), ks = workKinds(many, rows, "commits");
    expect(ks.map(k => k.label)).toEqual(["a", "c", "e", "g", "Other (3)"]);
    expect(ks.map(k => k.c)).toEqual(["a", "c", "e", "g"].map(color).concat(color("")));
    expect(new Set(ks.map(k => k.c)).size).toBe(5);
    expect(workKinds(many, rows, "prompts").map(k => k.label)).toEqual(["g", "e", "c", "a", "Other (3)"]);
  });

  it("adds each stack up to its bar, Other holding the rest", () => {
    const rows = workBuckets(many);
    for (const metric of ["commits", "prompts", "sessions"] as const) {
      const ks = workKinds(many, rows, metric), st = workStack(rows, many.work_projects, ks, metric);
      rows.forEach((r, i) => expect(Object.values(st[i]!).reduce((s, v) => s + v, 0)).toBe(r[metric]));
    }
    // Other holds b, d and f: 6 + 4 + 2 commits on the first day.
    expect(workStack(rows, many.work_projects, workKinds(many, rows, "commits"), "commits")[0]!["p:"]).toBe(12);
  });

  it("puts a project with no name in Other without taking a named place", () => {
    const anon: UsagePayload = { ...many, work_projects: [...split, wp("2026-11-04", null, { commits: 50 })],
      work: two.map((r, i) => (i ? r : { ...r, commits: r.commits + 50 })) };
    const rows = workBuckets(anon), ks = workKinds(anon, rows, "commits");
    expect(ks.map(k => k.label)).toEqual(["a", "c", "e", "g", "Other (4)"]);
    expect(workStack(rows, anon.work_projects, ks, "commits")[0]!["p:"]).toBe(62);
  });

  it("draws plain bars for one project, or when no project has a hue", () => {
    const rows = workBuckets(many);
    expect(workKinds({ ...many, project: "a" }, rows, "commits")).toEqual([]);
    expect(workKinds(weekly, workBuckets(weekly), "commits")).toEqual([]);
    setOrder([]);
    expect(workKinds(many, rows, "commits")).toEqual([]);
    panel(many);
    expect([...document.querySelectorAll("#work .legend .key")].map(k => k.textContent)).toEqual(["Commits", "Errors per 100 calls (lower track)"]);
  });

  it("names the stacked projects in the legend, and draws the view's buckets in that stack", async () => {
    panel(many);
    expect([...document.querySelectorAll("#work .legend .key")].map(k => k.textContent)).toEqual(["a", "c", "e", "g", "Other (3)", "Errors per 100 calls (lower track)"]);
    // The option handed to the wrapper: two buckets of five kinds (each data row is [bucket, total, ...values]).
    const stack = (await series()).find(s => s.id === "stack")!.data as number[][];
    expect(stack.map(r => r.length - 2)).toEqual([5, 5]);
    cleanup();
    panel({ ...many, project: "a" });
    expect([...document.querySelectorAll("#work .legend .key")].map(k => k.textContent)).toEqual(["Commits", "Errors per 100 calls (lower track)"]);
  });

  it("stacks the projects once the page sets their order, after the payload lands", async () => {
    setOrder([]);
    panel(many);
    expect([...document.querySelectorAll("#work .legend .key")].map(k => k.textContent)).toEqual(["Commits", "Errors per 100 calls (lower track)"]);
    act(() => setOrder(["a", "c", "e", "g"]));
    expect([...document.querySelectorAll("#work .legend .key")].map(k => k.textContent)).toEqual(["a", "c", "e", "g", "Other (3)", "Errors per 100 calls (lower track)"]);
    expect(((await series()).find(s => s.id === "stack")!.data as number[][])[0]!.length - 2).toBe(5);
  });
});

describe("work data table", () => {
  beforeEach(() => setOrder(["a", "c", "e", "g"]));
  afterEach(() => setOrder([]));
  const open = () => userEvent.click(screen.getByRole("button", { name: "Show data table" }));
  const NAME = /errors per 100 tool calls per (day|week)$/; // the hours heat map is a table too
  const table = () => within(screen.getByRole("table", { name: NAME }));

  it("is closed and absent on load, and opens and closes from its button", async () => {
    panel(many);
    const btn = screen.getByRole("button", { name: "Show data table" });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("table", { name: NAME })).toBeNull();
    await userEvent.click(btn);
    expect(screen.getByRole("button", { name: "Hide data table" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("table", { name: "Commits by project and errors per 100 tool calls per day" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Hide data table" }));
    expect(screen.queryByRole("table", { name: NAME })).toBeNull();
  });

  it("lists each day with the measure by project, its total and the error rate", async () => {
    panel(many);
    await open();
    expect(table().getAllByRole("columnheader").map(h => h.textContent)).toEqual(["Day", "a", "c", "e", "g", "Other (3)", "Total", "Errors per 100 calls"]);
    const rows = table().getAllByRole("row").slice(1), first = workBuckets(many)[0]!;
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByRole("rowheader").textContent).toBe("Nov 4, 2026");
    const cells = [...rows[0]!.querySelectorAll("td")].map(c => c.textContent);
    expect(cells.at(-2)).toBe(String(first.commits));
    expect(cells.at(-1)).toBe("10.0"); // 1 failed call in 10
    expect(cells.slice(0, 5).reduce((s, v) => s + Number(v), 0)).toBe(first.commits); // the parts add up to the bar
  });

  it("follows the chosen measure, and shows plain bars as one column", async () => {
    panel({ ...many, project: "a" }, "prompts");
    await open();
    expect(table().getAllByRole("columnheader").map(h => h.textContent)).toEqual(["Day", "Prompts", "Errors per 100 calls"]);
    expect(screen.getByRole("table", { name: "Prompts and errors per 100 tool calls per day" })).toBeTruthy();
  });

  it("labels each week as the chart does, with a dash for a week without calls", async () => {
    panel(weekly);
    await open();
    expect(screen.getByRole("table", { name: /per week$/ })).toBeTruthy();
    const rows = table().getAllByRole("row").slice(1);
    expect(rows).toHaveLength(10);
    expect(within(rows[0]!).getByRole("rowheader").textContent).toBe("Week of Sep 7, 2026");
    expect(within(rows.at(-1)!).getByRole("rowheader").textContent).toBe("Week of Nov 9, 2026, so far");
    expect(rows[1]!.querySelectorAll("td")[1]!.textContent).toBe("–");
  });
});

describe("failure rate line", () => {
  const gap = [row("2026-11-03", { calls: 4, failed_calls: 2 }), row("2026-11-04"), row("2026-11-05", { calls: 200, failed_calls: 6 })];
  const d: UsagePayload = { ...usage, end: "2026-11-05", work: gap, work_projects: gap.map(r => ({ ...r, project: "foo" })) };

  it("reads a bucket's count and rate together", () => {
    panel(d);
    act(() => chart().focus());
    fireEvent.keyDown(chart(), { key: "End" });
    expect(sr()).toBe("Nov 5, 2026: 0 commits, 1 prompt, 1 session, 6 failed calls of 200, 3.0 per 100");
  });

  it("says a bar with few calls in the tooltip, table and key", async () => {
    const rows = [row("2026-11-04", { calls: 4, failed_calls: 2 }), row("2026-11-05", { calls: 200, failed_calls: 6 }), row("2026-11-06", { calls: 100, failed_calls: 5 })];
    panel({ ...usage, end: "2026-11-06", work: rows, work_projects: [] });
    expect(document.querySelector("#work .legend")!.textContent).toBe("CommitsErrors per 100 calls (lower track)Under 50 calls");
    act(() => chart().focus());
    fireEvent.keyDown(chart(), { key: "Home" });
    expect(within(screen.getByRole("tooltip")).getByText("too few calls for a steady rate")).toBeTruthy();
    expect(sr()).toContain("2 failed calls of 4, 50.0 per 100, too few calls for a steady rate");
    fireEvent.keyDown(chart(), { key: "ArrowRight" });
    expect(within(screen.getByRole("tooltip")).queryByText("too few calls for a steady rate")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Show data table" }));
    const cells = within(screen.getByRole("table", { name: "Commits and errors per 100 tool calls per day" })).getAllByRole("cell").filter((_, i) => i % 2 === 1); // each row: commits, rate
    expect(cells.map(c => c.textContent)).toEqual(["50.0 (too few calls for a steady rate)", "3.0", "5.0"]);
  });

  it("keys no few-calls dot when every bar has few calls", () => {
    const rows = [row("2026-11-04", { calls: 4, failed_calls: 2 }), row("2026-11-05", { calls: 10, failed_calls: 1 })];
    panel({ ...usage, work: rows, work_projects: [] });
    expect(document.querySelector("#work .legend")!.textContent).not.toContain("Under");
  });

  it("keys no rate track when no bar has a tool call, and draws none", async () => {
    const idle = [row("2026-11-04", { commits: 2 }), row("2026-11-05")];
    panel({ ...usage, work: idle, work_projects: [] });
    expect(document.querySelector("#work .legend")!.textContent).toBe("Commits");
    expect(chart().getAttribute("aria-label")).toMatch(/^Commits per day, 2 days/);
    expect((await series()).map(s => s.id)).not.toContain("rate");
  });

  it("gives the rate and the failed count in the tooltip", () => {
    panel(d);
    act(() => chart().focus());
    fireEvent.keyDown(chart(), { key: "Home" });
    const tip = within(screen.getByRole("tooltip"));
    expect(tip.getByText("Errors per 100 calls").nextSibling!.textContent).toBe("50.0");
    expect(tip.getByText("Failed tool calls").nextSibling!.textContent).toBe("2 of 4");
    fireEvent.keyDown(chart(), { key: "ArrowRight" });
    expect(tip.getByText("Errors per 100 calls").nextSibling!.textContent).toBe("–");
  });
});

describe("chart pointer", () => {
  it("moves the tooltip with the pointer inside one bar, and re-reads it on the next", async () => {
    panel(many);
    const fake = await drawn(), tip = () => screen.getByRole("tooltip") as HTMLElement;
    const [x, y] = fake.pointAt(0);
    fake.fire("mousemove", [x, y]);
    const first = within(tip()).getByText(/^[A-Z][a-z]{2} \d+, 2026$/).textContent;
    expect([tip().style.left, tip().style.top]).toEqual([`${x + 14}px`, `${y - 10}px`]);
    fake.fire("mousemove", [x + 1, y + 10]);
    expect([tip().style.left, tip().style.top]).toEqual([`${x + 15}px`, `${y}px`]);
    expect(within(tip()).getByText(first!)).toBeTruthy();
    fake.fire("mousemove", fake.pointAt(1));
    expect(within(tip()).queryByText(first!)).toBeNull();
    fake.fire("globalout");
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});

describe("chart keys", () => {
  it("is a labelled group, and Escape dismisses the tooltip the arrow keys opened", () => {
    panel(many);
    expect(screen.queryByRole("tooltip")).toBeNull();
    act(() => chart().focus());
    fireEvent.keyDown(chart(), { key: "Home" });
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.keyDown(chart(), { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.queryByRole("img", { name: /per (day|week)/ })).toBeNull();
  });

  it("dismisses the tooltip the pointer opened on Escape while the focus is elsewhere, keeping the selection", async () => {
    const { onClear } = panel(many, "commits", { day: "2026-11-04", week: false });
    const metric = screen.getByRole("button", { name: "Prompts" });
    act(() => metric.focus());
    const fake = await drawn();
    fake.fire("mousemove", fake.pointAt(0));
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.keyDown(metric, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(onClear).not.toHaveBeenCalled();
  });

  it("selects nothing on Enter or a click while the chart takes no pick", async () => {
    const { onPick } = panel(weekly, "commits", null, false);
    act(() => chart().focus());
    fireEvent.keyDown(chart(), { key: "Home" });
    expect(fireEvent.keyDown(chart(), { key: "Enter" })).toBe(true); // left to the browser
    const fake = await drawn();
    fake.fire("click", fake.pointAt(6));
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByRole("tooltip")).toBeTruthy(); // the reading stays
    expect(sr()).not.toContain("selected");
  });

  it("keeps the bar being read when newer data arrives for the same view", () => {
    const { rerender } = panel(many);
    act(() => chart().focus());
    fireEvent.keyDown(chart(), { key: "Home" });
    const reading = sr();
    const newer = { ...many, work: many.work.map((r, i) => (i ? { ...r, commits: r.commits + 1 } : r)) };
    rerender(<WorkPanel d={newer} metric="commits" onMetric={() => {}} selected={null} onPick={() => {}} onClear={() => {}} />);
    expect(screen.getByRole("tooltip").textContent).toContain("Nov 4, 2026");
    expect(sr()).toBe(reading);
  });
});

describe("weekly buckets", () => {
  it("label weeks, and select one by keyboard or click", async () => {
    const { onPick } = panel(weekly);
    expect(chart().getAttribute("aria-label")).toMatch(/^Commits per week, with errors per 100 tool calls on a track below, 10 weeks, commits peaking at 5 in the week of Oct 19, 2026/);
    expect(chart().getAttribute("aria-label")).toMatch(/Enter to select it and Escape to clear the selection\.$/);
    expect(document.querySelector("#work .hint")!.textContent).toMatch(/Select a week to narrow the tabs/);
    expect(screen.getByRole("button", { name: "How measured: work per week" })).toBeTruthy();
    act(() => chart().focus());
    fireEvent.keyDown(chart(), { key: "Home" });
    expect(within(screen.getByRole("tooltip")).getByText("Week of Sep 7, 2026")).toBeTruthy();
    fireEvent.keyDown(chart(), { key: "Enter" });
    expect(onPick).toHaveBeenLastCalledWith({ day: "2026-09-07", week: true });
    // Reading stops at a pick, and the live region says what it did.
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(sr()).toBe("Week of Sep 7, 2026 selected; the tabs below show its days.");
    // The seventh bar is the week of Oct 19.
    const fake = await drawn();
    fake.fire("click", fake.pointAt(6));
    expect(onPick).toHaveBeenLastCalledWith({ day: "2026-10-19", week: true });
    // An idle week selects nothing.
    fake.fire("click", fake.pointAt(1));
    expect(onPick).toHaveBeenCalledTimes(2);
  });

  it("show the selection as a chip, cleared by its button or by Escape once no bucket is read", async () => {
    const { onClear } = panel(weekly, "commits", { day: "2026-10-19", week: true });
    const chip = document.querySelector("#work .chart-head .daychip")!;
    expect(chip.textContent).toBe("Week of Oct 19✕");
    expect((await mark())!.data).toEqual([[6, 0]]);
    await userEvent.click(screen.getByRole("button", { name: "Clear week of Oct 19, 2026" }));
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(chart());
    fireEvent.keyDown(chart(), { key: "Home" });
    fireEvent.keyDown(chart(), { key: "Escape" }); // ends the reading only
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(fireEvent.keyDown(chart(), { key: "Escape" })).toBe(false); // prevented
    expect(onClear).toHaveBeenCalledTimes(2);
  });

  it("show no chip and clear nothing on Escape without a selection", () => {
    const { onClear } = panel(weekly);
    expect(document.querySelector("#work .daychip")).toBeNull();
    act(() => chart().focus());
    expect(fireEvent.keyDown(chart(), { key: "Escape" })).toBe(true); // not prevented
    expect(onClear).not.toHaveBeenCalled();
  });

  it("say when the view covers part of a week", () => {
    panel({ ...weekly, start: "2026-09-09" });
    act(() => chart().focus());
    fireEvent.keyDown(chart(), { key: "Home" });
    expect(within(screen.getByRole("tooltip")).getByText("Week of Sep 7, 2026, from Sep 9")).toBeTruthy();
    fireEvent.keyDown(chart(), { key: "End" });
    expect(within(screen.getByRole("tooltip")).getByText("Week of Nov 9, 2026, so far")).toBeTruthy();
    expect(sr()).toMatch(/^Week of Nov 9, 2026, so far: 0 commits/);
    fireEvent.keyDown(chart(), { key: "ArrowLeft" });
    expect(within(screen.getByRole("tooltip")).getByText("Week of Nov 2, 2026")).toBeTruthy();
  });

  it("call the week that holds the end of the view so far on every weekday, Sunday too", () => {
    for (const end of ["2026-11-09", "2026-11-11", "2026-11-15"]) {
      cleanup();
      panel({ ...weekly, end });
      act(() => chart().focus());
      fireEvent.keyDown(chart(), { key: "End" });
      expect(within(screen.getByRole("tooltip")).getByText("Week of Nov 9, 2026, so far")).toBeTruthy();
      fireEvent.keyDown(chart(), { key: "ArrowLeft" });
      expect(within(screen.getByRole("tooltip")).getByText("Week of Nov 2, 2026")).toBeTruthy();
    }
  });

  it("days can be picked with a click", async () => {
    const { onPick } = panel(usage);
    expect(chart().getAttribute("aria-label")).toMatch(/^Commits per day, with errors per 100 tool calls on a track below, 2 days/);
    const fake = await drawn();
    fake.fire("click", fake.pointAt(0));
    expect(onPick).toHaveBeenCalledWith({ day: "2026-11-04", week: false });
    expect(document.querySelector("#work .hint")!.textContent).toMatch(/Select a day to narrow the tabs/);
  });

  it("name a selected day on its chip", async () => {
    panel(usage, "commits", { day: "2026-11-04", week: false });
    expect(document.querySelector("#work .daychip")!.textContent).toBe("Nov 4✕");
    expect(screen.getByRole("button", { name: "Clear Nov 4, 2026" })).toBeTruthy();
    expect((await mark())!.data).toEqual([[0, 0]]);
  });

  it("name a week a link holds on a chart by day, marking no bar", async () => {
    panel(usage, "commits", { day: "2026-11-02", week: true });
    expect(document.querySelector("#work .daychip")!.textContent).toBe("Week of Nov 2✕");
    expect(await mark()).toBeUndefined();
  });
});

// The page's part of a selection: the chart and its chip follow the selection the page holds.
function Host({ d, start = null }: { d: UsagePayload; start?: WorkPick | null }) {
  const [metric, setMetric] = useState<WorkMetric>("commits"), [selected, setSelected] = useState<WorkPick | null>(start);
  return <WorkPanel d={d} metric={metric} onMetric={setMetric} selected={selected} onPick={setSelected} onClear={() => setSelected(null)} />;
}

describe("what a selection says", () => {
  it("says a selection once, a selection of the same bar again in other words, and a clear by Escape", async () => {
    renderApp(<Host d={usage} />);
    act(() => chart().focus());
    fireEvent.keyDown(chart(), { key: "Home" });
    fireEvent.keyDown(chart(), { key: "Enter" });
    expect(sr()).toBe("Nov 4, 2026 selected; the tabs below show its figures.");
    expect((await mark())!.data).toEqual([[0, 0]]);
    fireEvent.keyDown(chart(), { key: "Home" });
    fireEvent.keyDown(chart(), { key: "Enter" });
    expect(sr()).toBe("Nov 4, 2026 is still selected; the tabs below show its figures.");
    fireEvent.keyDown(chart(), { key: "End" });
    fireEvent.keyDown(chart(), { key: "Enter" });
    expect(sr()).toBe("Nov 5, 2026 selected; the tabs below show its figures.");
    fireEvent.keyDown(chart(), { key: "Escape" });
    expect(sr()).toBe("Selection cleared; the tabs below show the whole range.");
    expect(document.querySelector("#work .daychip")).toBeNull();
  });

  it("leaves the status empty after a reading that follows a selection ends", () => {
    renderApp(<Host d={usage} />);
    act(() => chart().focus());
    fireEvent.keyDown(chart(), { key: "Home" });
    fireEvent.keyDown(chart(), { key: "Enter" });
    fireEvent.keyDown(chart(), { key: "End" });
    expect(sr()).toMatch(/^Nov 5, 2026: /);
    fireEvent.keyDown(chart(), { key: "Escape" });
    expect(sr()).toBe("");
  });

  it("says nothing for a selection the page opens with", () => {
    renderApp(<Host d={usage} start={{ day: "2026-11-04", week: false }} />);
    expect(document.querySelector("#work .daychip")!.textContent).toBe("Nov 4✕");
    expect(sr()).toBe("");
  });
});

describe("zoom", () => {
  /** A view by day from `from` to `to`, a commit and 60 calls a day. */
  const view = (from: string, to: string, week = false): UsagePayload => {
    const keys = dayRange(from, to).filter((_, i) => !week || i % 7 === 0), rows = keys.map(day => row(day, { commits: 1, calls: 60, failed_calls: 1 }));
    return { ...usage, range: week ? 0 : keys.length, start: week ? null : from, end: to, work_bucket: week ? "week" : "day", work: rows, daily_work: rows, work_projects: [] };
  };
  const month = view("2026-10-06", "2026-11-04");
  const slider = async () => ((await drawn()).last!.dataZoom as unknown[] | undefined) ?? [];
  const showAll = (name = "Show all days") => screen.queryByRole("button", { name });
  const hint = () => document.querySelector("#work .hint")!.textContent;

  it("draws no slider and says no zoom keys under 14 bars", async () => {
    renderApp(<Host d={view("2026-10-23", "2026-11-04")} />);
    expect(await slider()).toEqual([]);
    expect(chart().style.height).toBe("216px");
    expect(chart().getAttribute("aria-label")).not.toContain("plus and minus");
    expect(hint()).not.toContain("zoom");
    act(() => chart().focus());
    expect(fireEvent.keyDown(chart(), { key: "+" })).toBe(true);
  });

  it("draws the slider, 28px more, and names the zoom keys from 14 bars", async () => {
    renderApp(<Host d={view("2026-10-22", "2026-11-04")} />);
    expect(await slider()).toHaveLength(1);
    expect(chart().style.height).toBe("244px");
    expect(chart().getAttribute("aria-label")).toContain("and plus and minus to zoom.");
    expect(hint()).toContain("Plus and minus zoom.");
  });

  it("zooms in by plus, says the days shown, and keeps the data table to every day", async () => {
    renderApp(<Host d={month} />);
    const fake = await drawn();
    act(() => chart().focus());
    fireEvent.keyDown(chart(), { key: "End" });
    for (let i = 0; i < 15; i++) fireEvent.keyDown(chart(), { key: "ArrowLeft" }); // Oct 20
    fireEvent.keyDown(chart(), { key: "+", shiftKey: true });
    const { from, to } = fake.shown;
    expect(to - from + 1).toBe(15);
    expect(sr()).toMatch(/^Showing \w+ \d+ to \w+ \d+, 15 of 30 days\.$/);
    await userEvent.click(screen.getByRole("button", { name: "Show data table" }));
    expect(within(screen.getByRole("table", { name: /per day$/ })).getAllByRole("row")).toHaveLength(31);
  });

  it("shows 'Show all days' while zoomed; it shows every day, goes away and returns the focus to the chart", async () => {
    renderApp(<Host d={month} />);
    const fake = await drawn();
    expect(showAll()).toBeNull();
    fake.zoomTo(5, 14);
    expect(sr()).toBe("Showing Oct 11 to Oct 20, 10 of 30 days.");
    await userEvent.click(showAll()!);
    expect(fake.shown).toEqual({ from: 0, to: 29 });
    expect(showAll()).toBeNull();
    expect(document.activeElement).toBe(chart());
    expect(sr()).toBe("Showing all 30 days.");
  });

  it("words weeks as weeks", async () => {
    renderApp(<Host d={view("2026-06-01", "2026-10-12", true)} />); // 20 Mondays
    const fake = await drawn();
    expect(await slider()).toHaveLength(1);
    fake.zoomTo(14, 19);
    expect(sr()).toBe("Showing the weeks of Sep 7 to Oct 12, 6 of 20 weeks.");
    await userEvent.click(showAll("Show all weeks")!);
    expect(sr()).toBe("Showing all 20 weeks.");
  });

  it("keeps the zoom through a selection, and shows every day for another measure", async () => {
    renderApp(<Host d={month} />);
    const fake = await drawn();
    fake.zoomTo(5, 14);
    fake.fire("click", fake.pointAt(9));
    expect(document.querySelector("#work .daychip")!.textContent).toBe("Oct 15✕");
    expect(fake.shown).toEqual({ from: 5, to: 14 });
    expect(showAll()).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Prompts" }));
    expect(fake.shown).toEqual({ from: 0, to: 29 });
    expect(showAll()).toBeNull();
  });
});
