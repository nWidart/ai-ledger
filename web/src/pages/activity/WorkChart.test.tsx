import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyWorkRow, UsagePayload } from "../../api";
import usage from "../../__fixtures__/usage";
import { color, setOrder } from "../../colors";
import { failRate, workBuckets, workKinds, workStack, type WorkMetric } from "./work";
import { WorkPanel } from "./WorkChart";
import { WorkHours } from "./WorkHours";
import { renderApp } from "../../testing";

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

const panel = (d: UsagePayload, metric: WorkMetric = "commits", onDay = vi.fn()) => {
  renderApp(<WorkPanel d={d} metric={metric} onMetric={() => {}} onDay={onDay} />);
  return onDay;
};
const chart = () => screen.getByRole("group", { name: /per (day|week)/ });

beforeEach(() => {
  // The plot reads its size from the svg; jsdom lays nothing out.
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
    expect([...document.querySelectorAll("#work .legend .key")].map(k => k.textContent)).toEqual(["Commits", "Errors per 100 calls (right axis)"]);
  });

  it("names the stacked projects in the legend", () => {
    panel(many);
    expect([...document.querySelectorAll("#work .legend .key")].map(k => k.textContent)).toEqual(["a", "c", "e", "g", "Other (3)", "Errors per 100 calls (right axis)"]);
    cleanup();
    panel({ ...many, project: "a" });
    expect([...document.querySelectorAll("#work .legend .key")].map(k => k.textContent)).toEqual(["Commits", "Errors per 100 calls (right axis)"]);
  });

  it("stacks the segments from the baseline, in one order, scaled to fit", () => {
    panel(many);
    const rows = workBuckets(many), ks = workKinds(many, rows, "commits"), st = workStack(rows, many.work_projects, ks, "commits");
    const bars = [...document.querySelectorAll("#work .bar-seg")];
    expect(bars).toHaveLength(2);
    const base = 240 - 26, plotTop = 22; // the plot's bottom and top edges in the viewBox
    let scale: number | undefined;
    bars.forEach((bar, i) => {
      const segs = [...bar.children].map(seg => {
        const dd = seg.getAttribute("d");
        if (!dd) return { fill: seg.getAttribute("fill"), top: +seg.getAttribute("y")!, bottom: +seg.getAttribute("y")! + +seg.getAttribute("height")! };
        const m = /^M[\d.]+,([\d.]+) V([\d.]+)/.exec(dd)!;
        return { fill: seg.getAttribute("fill"), top: +m[2]! - 3, bottom: +m[1]! };
      });
      // Bottom first, in the legend's order on every bar.
      expect(segs.map(s => s.fill)).toEqual(ks.map(k => k.c));
      expect(segs[0]!.bottom).toBeCloseTo(base);
      segs.slice(1).forEach((s, j) => expect(s.bottom).toBeCloseTo(segs[j]!.top - 2)); // a 2px gap between segments
      const k = (base - segs.at(-1)!.top) / rows[i]!.commits;
      scale ??= k;
      expect(k).toBeCloseTo(scale);
      segs.forEach((s, j) => expect(s.bottom - s.top + (j ? 2 : 0)).toBeCloseTo(st[i]![ks[j]!.k]! * scale!));
      expect(segs.at(-1)!.top).toBeGreaterThanOrEqual(plotTop);
    });
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

  it("draws on a labelled right-hand axis with no point for a bucket without calls", () => {
    panel(d);
    const svg = document.querySelector("#work svg")!;
    expect(svg.textContent).toContain("Errors per 100 calls");
    const line = svg.querySelector("path.rate")!.getAttribute("d")!;
    expect(line.match(/[ML]/g)).toEqual(["M", "M"]);
    // Each lone point gets a dot, since no line reaches it: filled for the busy day, hollow for the 4-call day.
    expect(svg.querySelectorAll("circle.rate")).toHaveLength(1);
    expect(svg.querySelectorAll("circle.lowc")).toHaveLength(1);
  });

  it("ticks the right-hand axis on the count axis's grid lines, with decimals for small steps", () => {
    const ticks = () => [...document.querySelectorAll("#work svg .rtick")].map(t => t.textContent);
    panel(d);
    // Two count steps (no commits: 0 to 1 by 0.5). The 4-call day's 50 is left out, so the top rate is the busy day's 3.
    expect(ticks()).toEqual(["0", "2", "4"]);
    cleanup();
    const low = [row("2026-11-04", { calls: 1000, failed_calls: 1 }), row("2026-11-05", { calls: 1000, failed_calls: 1 })];
    panel({ ...usage, work: low, work_projects: [] });
    expect(ticks()).toEqual(["0.0", "0.1", "0.2"]);
  });

  it("marks a bar with few calls as a hollow dot that sets no axis, and says so in the tooltip, table and key", async () => {
    const rows = [row("2026-11-04", { calls: 4, failed_calls: 2 }), row("2026-11-05", { calls: 200, failed_calls: 6 }), row("2026-11-06", { calls: 100, failed_calls: 5 })];
    panel({ ...usage, end: "2026-11-06", work: rows, work_projects: [] });
    const svg = document.querySelector("#work svg")!;
    // The scale follows the busy days (3 and 5), not the quiet day's 50; the line still runs through the hollow dot.
    expect([...svg.querySelectorAll(".rtick")].map(t => t.textContent)).toEqual(["0", "5", "10"]); // not 0, 50, 100
    expect(svg.querySelector("path.rate")!.getAttribute("d")!.match(/[ML]/g)).toEqual(["M", "L", "L"]);
    expect(svg.querySelectorAll("circle.lowc")).toHaveLength(1);
    expect(document.querySelector("#work .legend")!.textContent).toBe("CommitsErrors per 100 calls (right axis)Under 50 calls");
    act(() => chart().focus());
    fireEvent.keyDown(chart(), { key: "Home" });
    expect(within(screen.getByRole("tooltip")).getByText("too few calls for a steady rate")).toBeTruthy();
    expect(document.querySelector("#work .sr")!.textContent).toContain("2 failed calls of 4, 50.0 per 100, too few calls for a steady rate");
    fireEvent.keyDown(chart(), { key: "ArrowRight" });
    expect(within(screen.getByRole("tooltip")).queryByText("too few calls for a steady rate")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Show data table" }));
    const cells = within(screen.getByRole("table", { name: "Commits and errors per 100 tool calls per day" })).getAllByRole("cell").filter((_, i) => i % 2 === 1); // each row: commits, rate
    expect(cells.map(c => c.textContent)).toEqual(["50.0 (too few calls for a steady rate)", "3.0", "5.0"]);
  });

  it("marks nothing when every bar has few calls: the view scales to its own rates", () => {
    const rows = [row("2026-11-04", { calls: 4, failed_calls: 2 }), row("2026-11-05", { calls: 10, failed_calls: 1 })];
    panel({ ...usage, work: rows, work_projects: [] });
    const svg = document.querySelector("#work svg")!;
    expect(svg.querySelectorAll("circle.lowc")).toHaveLength(0);
    expect([...svg.querySelectorAll(".rtick")].map(t => t.textContent)).toEqual(["0", "50", "100"]);
    expect(document.querySelector("#work .legend")!.textContent).not.toContain("Under");
  });

  it("draws no rate, axis or key when no bar has a tool call", () => {
    const idle = [row("2026-11-04", { commits: 2 }), row("2026-11-05")];
    panel({ ...usage, work: idle, work_projects: [] });
    const svg = document.querySelector("#work svg")!;
    expect(svg.querySelectorAll(".rtick, .rate")).toHaveLength(0);
    expect(svg.textContent).not.toContain("Errors per 100 calls");
    expect(document.querySelector("#work .legend")!.textContent).toBe("Commits");
    expect(chart().getAttribute("aria-label")).toMatch(/^Commits per day, 2 days/);
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
  it("moves the tooltip with the pointer inside one bar, and re-reads it on the next", () => {
    panel(many);
    const hit = document.querySelector<SVGRectElement>("#work .hit")!, tip = () => screen.getByRole("tooltip") as HTMLElement;
    fireEvent.pointerMove(hit, { clientX: 100, clientY: 50 });
    const first = within(tip()).getByText(/^[A-Z][a-z]{2} \d+, 2026$/).textContent;
    expect([tip().style.left, tip().style.top]).toEqual(["114px", "40px"]);
    fireEvent.pointerMove(hit, { clientX: 101, clientY: 60 });
    expect([tip().style.left, tip().style.top]).toEqual(["115px", "50px"]);
    expect(within(tip()).getByText(first!)).toBeTruthy();
    fireEvent.pointerMove(hit, { clientX: 700, clientY: 60 });
    expect(within(tip()).queryByText(first!)).toBeNull();
    fireEvent.pointerLeave(hit);
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
});

describe("weekly buckets", () => {
  it("label weeks and cannot be picked", () => {
    const onDay = panel(weekly);
    expect(chart().getAttribute("aria-label")).toMatch(/^Commits and errors per 100 tool calls per week, 10 weeks, commits peaking at 5 in the week of Oct 19, 2026/);
    expect(document.querySelector("#work svg")!.textContent).toContain("Week of Sep 7");
    expect(document.querySelector("#work .hint")!.textContent).toMatch(/Choose a shorter range to pick a day/);
    act(() => chart().focus());
    fireEvent.keyDown(chart(), { key: "Home" });
    expect(within(screen.getByRole("tooltip")).getByText("Week of Sep 7, 2026")).toBeTruthy();
    fireEvent.keyDown(chart(), { key: "Enter" });
    fireEvent.click(document.querySelector("#work .hit")!, { clientX: 60 });
    expect(onDay).not.toHaveBeenCalled();
  });

  it("say when the view covers part of a week", () => {
    panel({ ...weekly, start: "2026-09-09" });
    act(() => chart().focus());
    fireEvent.keyDown(chart(), { key: "Home" });
    expect(within(screen.getByRole("tooltip")).getByText("Week of Sep 7, 2026, from Sep 9")).toBeTruthy();
    fireEvent.keyDown(chart(), { key: "End" });
    expect(within(screen.getByRole("tooltip")).getByText("Week of Nov 9, 2026, so far")).toBeTruthy();
    expect(document.querySelector("#work .sr")!.textContent).toMatch(/^Week of Nov 9, 2026, so far: 0 commits/);
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

  it("days can be picked with a click", () => {
    const onDay = panel(usage);
    expect(chart().getAttribute("aria-label")).toMatch(/^Commits and errors per 100 tool calls per day, 2 days/);
    fireEvent.click(document.querySelector("#work .hit")!, { clientX: 100 });
    expect(onDay).toHaveBeenCalledWith("2026-11-04");
  });
});

describe("hours", () => {
  const cells = [{ dow: 2, hour: 23, prompts: 30 }, { dow: 2, hour: 9, prompts: 4 }, { dow: 6, hour: 10, prompts: 12 }];

  it("draws a 7x24 grid, Monday first, with the busiest cell named", () => {
    renderApp(<WorkHours cells={cells} />);
    const box = document.getElementById("hours")!;
    expect(within(box).getByRole("heading").textContent).toBe("Prompts by hour");
    const table = within(box).getByRole("table", { name: "Prompts by weekday and hour" });
    const rows = table.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(7);
    expect([...rows].map(r => r.querySelector("th")!.textContent)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    rows.forEach(r => expect(r.querySelectorAll("td")).toHaveLength(24));
    const late = rows[1]!.querySelectorAll("td")[23]!;
    expect(late.getAttribute("title")).toBe("Tuesday 23:00: 30 prompts");
    expect(late.textContent).toBe("30 prompts");
    expect(rows[0]!.querySelectorAll("td")[0]!.getAttribute("title")).toBe("Monday 0:00: 0 prompts");
    expect(box.textContent).toMatch(/Busiest hour: Tuesdays at 23:00, 30 prompts\. Busiest day: Tuesday, 34 prompts\. 46 prompts in all\./);
  });

  it("outlines Monday 0:00 on focus, moves from there and keeps the cell", () => {
    renderApp(<WorkHours cells={cells} />);
    const table = screen.getByRole("table"), readout = () => document.querySelector("#hours .readout")!.textContent;
    const outlined = () => [...table.querySelectorAll("td.at")].map(td => td.getAttribute("title"));
    act(() => table.focus());
    expect(outlined()).toEqual(["Monday 0:00: 0 prompts"]);
    expect(readout()).toBe("Monday 0:00: 0 prompts");
    fireEvent.keyDown(table, { key: "ArrowRight" });
    expect(readout()).toBe("Monday 1:00: 0 prompts");
    fireEvent.keyDown(table, { key: "ArrowDown" });
    fireEvent.keyDown(table, { key: "End" });
    expect(readout()).toBe("Tuesday 23:00: 30 prompts");
    act(() => table.blur());
    expect(outlined()).toEqual([]);
    expect(readout()).toBe("");
    act(() => table.focus());
    expect(readout()).toBe("Tuesday 23:00: 30 prompts");
  });

  it("does not read cells out on hover", () => {
    renderApp(<WorkHours cells={cells} />);
    fireEvent.pointerEnter(screen.getByRole("table").querySelectorAll("tbody tr")[1]!.querySelectorAll("td")[23]!);
    expect(document.querySelector("#hours .readout")!.textContent).toBe("");
  });

  it("counts the ties for the busiest hour and day", () => {
    renderApp(<WorkHours cells={[{ dow: 2, hour: 9, prompts: 5 }, { dow: 4, hour: 9, prompts: 5 }, { dow: 5, hour: 14, prompts: 5 }]} />);
    expect(document.getElementById("hoursSum")!.textContent)
      .toMatch(/^Busiest hour: Tuesdays at 9:00 and 2 others, 5 prompts each\.\s+Busiest day: Tuesday and 2 others, 5 prompts each\. 15 prompts in all\./);
  });

  it("shows the empty state without data", () => {
    renderApp(<WorkHours cells={[]} />);
    expect(document.querySelector("#hours table")).toBeNull();
    expect(document.querySelector("#hours .empty")!.textContent).toBe("No prompts in this range.");
  });

  it("sits under the chart in the work panel", () => {
    panel(usage);
    expect(document.getElementById("work")!.compareDocumentPosition(document.getElementById("hours")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
