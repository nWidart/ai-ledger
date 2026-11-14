import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { GrowthPoint } from "../../api";
import { setOrder } from "../../colors";
import { GrowthChart, readTurn } from "./GrowthChart";

const pt = (turn: number, median: number, sessions = 9): GrowthPoint => ({ turn, median, p25: median * .7, p75: median * 1.4, sessions });
const view = [1, 2, 3, 4, 5].map(t => pt(t, 20_000 + t * 10_000));
const foo = { project: "foo", sessions: 6, curve: view.map(p => ({ ...p, median: p.median * 1.2 })) };
const bar = { project: "bar", sessions: 5, curve: view.slice(0, 3).map(p => ({ ...p, median: p.median * .6 })) };

describe("GrowthChart", () => {
  it("draws the view's median with its band and one line per project", () => {
    setOrder(["foo", "bar"]);
    const { container } = render(<GrowthChart curve={view} projects={[foo, bar]} />);
    expect(container.querySelectorAll("path.curve.proj")).toHaveLength(2);
    // The median is drawn twice, a halo under the ink line.
    expect(container.querySelectorAll("path.curve.view")).toHaveLength(2);
    expect(container.querySelectorAll("path.band")).toHaveLength(1);
    expect(container.querySelector("path.band")!.getAttribute("d")).toMatch(/Z$/);
    // A project's line takes its project color.
    expect(container.querySelector("path.curve.proj")!.getAttribute("stroke")).toMatch(/^var\(--proj-\d\)$/);
    expect(screen.getAllByText("foo").length).toBeGreaterThan(0);
  });

  it("describes itself, naming the median at the last turn shown", () => {
    render(<GrowthChart curve={view} projects={[foo]} />);
    const chart = screen.getByRole("group");
    const label = chart.getAttribute("aria-label")!;
    expect(label).toContain("70k at turn 5");
    expect(label).toContain("30k tokens at turn 1");
    expect(label).toContain("1 project drawn separately");
    expect(label).toContain("9 sessions");
  });

  it("reads a turn with the arrow keys", () => {
    render(<GrowthChart curve={view} projects={[foo]} />);
    const chart = screen.getByRole("group");
    act(() => chart.focus());
    fireEvent.keyDown(chart, { key: "ArrowRight" });
    expect(document.querySelector(".readout")!.textContent).toBe(`${readTurn(view[0]!)}; foo ${"36k"}`);
    fireEvent.keyDown(chart, { key: "End" });
    expect(document.querySelector(".readout")!.textContent).toContain("Turn 5: median 70k tokens (25th to 75th percentile 49k to 98k), 9 sessions");
    fireEvent.blur(chart);
    expect(document.querySelector(".readout")!.textContent).toBe("");
  });

  it("dismisses the reading with Escape", () => {
    render(<GrowthChart curve={view} projects={[]} />);
    const chart = screen.getByRole("group");
    fireEvent.keyDown(chart, { key: "ArrowRight" });
    expect(document.querySelector(".readout")!.textContent).not.toBe("");
    fireEvent.keyDown(chart, { key: "Escape" });
    expect(document.querySelector(".readout")!.textContent).toBe("");
  });

  it("offers every turn as a table, closed until asked for, with each project's median", async () => {
    render(<GrowthChart curve={view} projects={[foo, bar]} />);
    expect(screen.queryByRole("table")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Show data table" }));
    const table = screen.getByRole("table", { name: "Median context at each turn" });
    expect(within(table).getAllByRole("columnheader").map(h => h.textContent)).toEqual(["Turn", "Median", "25th percentile", "75th percentile", "Sessions", "foo", "bar"]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(view.length);
    expect(within(rows[0]!).getByRole("rowheader").textContent).toBe("1");
    expect(within(rows[0]!).getAllByRole("cell").map(c => c.textContent)).toEqual(["30k", "21k", "42k", "9", "36k", "18k"]);
    // bar's curve stops after turn 3.
    expect(within(rows[4]!).getAllByRole("cell").at(-1)!.textContent).toBe("–");
    expect(screen.getByRole("button", { name: "Hide data table" }).getAttribute("aria-expanded")).toBe("true");
  });

  it("reads the turn under the pointer, away from the endpoints", () => {
    const long = Array.from({ length: 101 }, (_, i) => pt(i + 1, 10_000 + i * 100));
    const { container } = render(<GrowthChart curve={long} projects={[]} />);
    // jsdom has no layout: the plot rect starts at the left margin and spans the inner width, as in the browser.
    const rect = container.querySelector("svg rect")!;
    rect.getBoundingClientRect = () => ({ left: 52, right: 786, width: 734, top: 12, bottom: 230, height: 218, x: 52, y: 12, toJSON: () => ({}) });
    fireEvent.pointerMove(rect, { clientX: 52 + 25 / 100 * 734 });
    expect(document.querySelector(".readout")!.textContent).toMatch(/^Turn 26:/);
  });

  it("draws a curve of one point, and nothing without one", () => {
    const { container, rerender } = render(<GrowthChart curve={[pt(1, 12_000)]} projects={[]} />);
    expect(container.querySelectorAll("path.curve.view")).toHaveLength(2);
    expect(screen.getByRole("group").getAttribute("aria-label")).toContain("12k tokens");
    rerender(<GrowthChart curve={[]} projects={[]} />);
    expect(container.querySelector("svg")).toBeNull();
  });
});
