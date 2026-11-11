import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyWorkRow, UsagePayload } from "../../api";
import usage from "../../__fixtures__/usage";
import { failRate, workBuckets, workKinds, workStack, type WorkMetric } from "./work";
import { WorkPanel } from "./WorkChart";
import { WorkHours } from "./WorkHours";

const row = (day: string, o: Partial<DailyWorkRow> = {}): DailyWorkRow => ({ day, sessions: 1, prompts: 1, commits: 0, calls: 0, failed_calls: 0, ...o });
type WP = UsagePayload["work_projects"][number];
const wp = (day: string, project: string | null, o: Partial<WP> = {}): WP => ({ day, project, sessions: 1, prompts: 1, commits: 0, calls: 0, failed_calls: 0, ...o });

// Seven projects over two days: a gets the most commits, g the fewest; the bars add up their rows.
const projects = ["a", "b", "c", "d", "e", "f", "g"];
const split: WP[] = ["2026-11-04", "2026-11-05"].flatMap((day, j) => projects.map((p, i) => wp(day, p, { commits: 7 - i + j, prompts: i + 1 })));
const sum = (day: string, k: WorkMetric) => split.filter(r => r.day === day).reduce((s, r) => s + r[k], 0);
const two = ["2026-11-04", "2026-11-05"].map(day => row(day, { sessions: 7, commits: sum(day, "commits"), prompts: sum(day, "prompts") }));
const many: UsagePayload = { ...usage, work: two, daily_work: two, work_projects: split };

// Ten weeks to Wednesday Nov 11, work in two of them.
const weekly: UsagePayload = {
  ...usage, range: 0, start: null, end: "2026-11-11", work_bucket: "week",
  work: [row("2026-09-07", { commits: 3, calls: 10, failed_calls: 1 }), row("2026-10-19", { commits: 5, calls: 20, failed_calls: 2 })],
  work_projects: [wp("2026-09-07", "foo", { commits: 3 }), wp("2026-10-19", "foo", { commits: 5 })],
};

const panel = (d: UsagePayload, metric: WorkMetric = "commits", onDay = vi.fn()) => {
  render(<WorkPanel d={d} metric={metric} onMetric={() => {}} onDay={onDay} />);
  return onDay;
};
const chart = () => screen.getByRole("img", { name: /per (day|week)/ });

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
  it("stacks the top 5 by the metric plus Other, and each stack adds up to its bar", () => {
    const rows = workBuckets(many);
    for (const metric of ["commits", "prompts", "sessions"] as const) {
      const ks = workKinds(many, rows, metric), st = workStack(rows, many.work_projects, ks, metric);
      expect(ks).toHaveLength(6);
      expect(ks.at(-1)).toMatchObject({ k: "p:", label: "Other (2)" });
      rows.forEach((r, i) => expect(Object.values(st[i]!).reduce((s, v) => s + v, 0)).toBe(r[metric]));
    }
    expect(workKinds(many, rows, "commits").slice(0, 5).map(k => k.project)).toEqual(["a", "b", "c", "d", "e"]);
    expect(workKinds(many, rows, "prompts").slice(0, 5).map(k => k.project)).toEqual(["g", "f", "e", "d", "c"]);
    // Other holds f and g: 2 + 1 commits on the first day.
    expect(workStack(rows, many.work_projects, workKinds(many, rows, "commits"), "commits")[0]!["p:"]).toBe(3);
  });

  it("draws plain bars for one project", () => {
    const rows = workBuckets(many);
    expect(workKinds({ ...many, project: "a" }, rows, "commits")).toEqual([]);
    expect(workKinds(weekly, workBuckets(weekly), "commits")).toEqual([]);
  });

  it("names the stacked projects in the legend", () => {
    panel(many);
    const legend = document.querySelector("#work .legend")!;
    expect([...legend.querySelectorAll(".key")].map(k => k.textContent)).toEqual(["a", "b", "c", "d", "e", "Other (2)", "Errors per 100 calls (right axis)"]);
    cleanup();
    panel({ ...many, project: "a" });
    expect([...document.querySelectorAll("#work .legend .key")].map(k => k.textContent)).toEqual(["Commits", "Errors per 100 calls (right axis)"]);
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
    // Each lone point gets a dot, since no line reaches it.
    expect(svg.querySelectorAll("circle.rate")).toHaveLength(2);
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
    render(<WorkHours cells={cells} />);
    const box = document.getElementById("hours")!;
    expect(within(box).getByRole("heading").textContent).toBe("Prompts by hour");
    const table = within(box).getByRole("table", { name: "Prompts by weekday and hour" });
    const rows = table.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(7);
    expect([...rows].map(r => r.querySelector("th")!.textContent)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    rows.forEach(r => expect(r.querySelectorAll("td")).toHaveLength(24));
    const late = rows[1]!.querySelectorAll("td")[23]!;
    expect(late.getAttribute("title")).toBe("Tuesday 23:00: 30 prompts");
    expect(late.textContent).toBe("30");
    expect(rows[0]!.querySelectorAll("td")[0]!.getAttribute("title")).toBe("Monday 0:00: 0 prompts");
    expect(box.textContent).toMatch(/Busiest hour: Tuesdays at 23:00, 30 prompts\. Busiest day: Tuesday, 34 prompts\. 46 prompts in all\./);
  });

  it("reads a cell on focus", () => {
    render(<WorkHours cells={cells} />);
    const table = screen.getByRole("table");
    act(() => table.focus());
    fireEvent.keyDown(table, { key: "ArrowDown" });
    fireEvent.keyDown(table, { key: "End" });
    expect(document.querySelector("#hours .readout")!.textContent).toBe("Tuesday 23:00: 30 prompts");
  });

  it("shows the empty state without data", () => {
    render(<WorkHours cells={[]} />);
    expect(document.querySelector("#hours table")).toBeNull();
    expect(document.querySelector("#hours .empty")!.textContent).toBe("No prompts in this range.");
  });

  it("sits under the chart in the work panel", () => {
    panel(usage);
    expect(document.getElementById("work")!.compareDocumentPosition(document.getElementById("hours")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
