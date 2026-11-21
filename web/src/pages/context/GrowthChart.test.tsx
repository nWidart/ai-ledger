import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { GrowthPoint } from "../../api";
import { setOrder } from "../../colors";
import { GrowthChart, readShare, readTurn } from "./GrowthChart";
import { prevented, renderApp } from "../../testing";

const pt = (turn: number, median: number, sessions = 9): GrowthPoint => ({ turn, median, p25: median * .7, p75: median * 1.4, sessions });
const view = [1, 2, 3, 4, 5].map(t => pt(t, 20_000 + t * 10_000));
const sp = (turn: number, median: number, sessions = 7): GrowthPoint => ({ turn, median, p25: median * .7, p75: median * 1.3, sessions });
const shareView = [1, 2, 3, 4].map(t => sp(t, .1 + t * .1));
const foo = { project: "foo", sessions: 6, curve: view.map(p => ({ ...p, median: p.median * 1.2 })), share_curve: shareView.map(p => ({ ...p, median: p.median * 1.1 })) };
const bar = { project: "bar", sessions: 5, curve: view.slice(0, 3).map(p => ({ ...p, median: p.median * .6 })), share_curve: [] };

describe("GrowthChart", () => {
  it("draws the view's median with its band and one line per project", () => {
    setOrder(["foo", "bar"]);
    const { container } = renderApp(<GrowthChart curve={view} projects={[foo, bar]} />);
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
    renderApp(<GrowthChart curve={view} projects={[foo]} />);
    const chart = screen.getByRole("group");
    const label = chart.getAttribute("aria-label")!;
    expect(label).toContain("70k at turn 5");
    expect(label).toContain("30k tokens at turn 1");
    expect(label).toContain("1 project drawn separately");
    expect(label).toContain("9 sessions");
  });

  it("leaves keys with Alt, Ctrl, Meta or Shift to the browser", () => {
    renderApp(<GrowthChart curve={view} projects={[foo]} />);
    expect(prevented(screen.getByRole("group"))).toEqual([]);
    expect(document.querySelector(".readout")!.textContent).toBe("");
  });

  it("reads a turn with the arrow keys, and dismisses it with Escape or on blur", () => {
    renderApp(<GrowthChart curve={view} projects={[foo]} />);
    const chart = screen.getByRole("group");
    act(() => chart.focus());
    fireEvent.keyDown(chart, { key: "ArrowRight" });
    expect(document.querySelector(".readout")!.textContent).toBe(`${readTurn(view[0]!)}; foo ${"36k"}`);
    fireEvent.keyDown(chart, { key: "Escape" });
    expect(document.querySelector(".readout")!.textContent).toBe("");
    fireEvent.keyDown(chart, { key: "End" });
    expect(document.querySelector(".readout")!.textContent).toContain("Turn 5: median 70k tokens (25th to 75th percentile 49k to 98k), 9 sessions");
    fireEvent.blur(chart);
    expect(document.querySelector(".readout")!.textContent).toBe("");
  });

  it("offers every turn as a table, closed until asked for, with each project's median", async () => {
    renderApp(<GrowthChart curve={view} projects={[foo, bar]} />);
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
    const { container } = renderApp(<GrowthChart curve={long} projects={[]} />);
    // jsdom has no layout: the plot rect starts at the left margin and spans the inner width, as in the browser.
    const rect = container.querySelector("svg rect")!;
    rect.getBoundingClientRect = () => ({ left: 52, right: 786, width: 734, top: 12, bottom: 230, height: 218, x: 52, y: 12, toJSON: () => ({}) });
    fireEvent.pointerMove(rect, { clientX: 52 + 25 / 100 * 734 });
    expect(document.querySelector(".readout")!.textContent).toMatch(/^Turn 26:/);
  });

  it("draws a curve of one point, and nothing without one", () => {
    const { container, rerender } = renderApp(<GrowthChart curve={[pt(1, 12_000)]} projects={[]} />);
    expect(container.querySelectorAll("path.curve.view")).toHaveLength(2);
    expect(screen.getByRole("group").getAttribute("aria-label")).toContain("12k tokens");
    rerender(<GrowthChart curve={[]} projects={[]} />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("draws a strip with one bar per turn, taller for more sessions", () => {
    const fading = [pt(1, 20_000, 20), pt(2, 30_000, 10), pt(3, 40_000, 5)];
    const { container } = renderApp(<GrowthChart curve={fading} projects={[]} />);
    const bars = [...container.querySelectorAll("rect.strip-bar")].map(r => Number(r.getAttribute("height")));
    expect(bars).toHaveLength(3);
    expect(bars[0]).toBeGreaterThan(bars[1]!);
    expect(bars[1]).toBeGreaterThan(bars[2]!);
    expect(container.querySelector(".strip")!.textContent).toContain("Sessions still running at each turn");
    expect(container.querySelector(".strip")!.textContent).toContain("20 at turn 1 to 5 at turn 3");
  });

  it("offers the share switch only with a share curve", () => {
    const { rerender } = renderApp(<GrowthChart curve={view} projects={[foo]} />);
    expect(screen.queryByRole("button", { name: "Share of window" })).toBeNull();
    rerender(<GrowthChart curve={view} projects={[foo]} share={[]} />);
    expect(screen.queryByRole("button", { name: "Share of window" })).toBeNull();
    rerender(<GrowthChart curve={view} projects={[foo]} share={shareView} />);
    expect(screen.getByRole("button", { name: "Tokens" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Share of window" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("switches to share: the 80% line, percentage axis, share readout and table", async () => {
    setOrder(["foo", "bar"]);
    const { container } = renderApp(<GrowthChart curve={view} projects={[foo, bar]} share={shareView} />);
    expect(container.querySelector("g.limit")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Share of window" }));
    expect(screen.getByRole("button", { name: "Share of window" }).getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector("g.limit")!.textContent).toBe("80% of the window");
    expect(container.querySelector("svg")!.textContent).toMatch(/\d+%/);
    // bar has no share curve: only foo is drawn.
    expect(container.querySelectorAll("path.curve.proj")).toHaveLength(1);
    expect(container.querySelectorAll("rect.strip-bar")).toHaveLength(shareView.length);
    const chart = screen.getByRole("group", { name: /^Median share/ });
    expect(chart.getAttribute("aria-label")).toContain("Median share of the window");
    fireEvent.keyDown(chart, { key: "End" });
    expect(document.querySelector(".readout")!.textContent).toBe(`${readShare(shareView[3]!)}; foo 55%`);
    expect(document.querySelector(".readout")!.textContent).toContain("median 50% of the window");
    await userEvent.click(screen.getByRole("button", { name: "Show data table" }));
    const table = screen.getByRole("table", { name: "Median share of the window at each turn" });
    expect(within(table).getAllByRole("columnheader").map(h => h.textContent)).toEqual(["Turn", "Median", "25th percentile", "75th percentile", "Sessions", "foo"]);
    expect(within(within(table).getAllByRole("row")[1]!).getAllByRole("cell").map(c => c.textContent)).toEqual(["20%", "14%", "26%", "7", "22%"]);
    await userEvent.click(screen.getByRole("button", { name: "Tokens" }));
    expect(container.querySelector("g.limit")).toBeNull();
  });

  it("isolates a project with its own band, and restores every project", async () => {
    setOrder(["foo", "bar"]);
    const { container } = renderApp(<GrowthChart curve={view} projects={[foo, bar]} />);
    const fooKey = screen.getByRole("button", { name: /^foo/ }), barKey = screen.getByRole("button", { name: /^bar/ });
    expect(fooKey.getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelectorAll("path.band")).toHaveLength(1);
    await userEvent.click(fooKey);
    expect(fooKey.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelectorAll("path.curve.proj")).toHaveLength(1);
    expect(container.querySelector("path.curve.proj")!.getAttribute("stroke")).toBe(container.querySelector("path.proj-band")!.getAttribute("fill"));
    // The view's band is hidden, the project's is drawn, and the view's median stays.
    expect(container.querySelectorAll("path.band")).toHaveLength(1);
    expect(container.querySelectorAll("path.proj-band")).toHaveLength(1);
    // Its spread is readable, not only drawn: the label, the readout and the table give the project's quartiles.
    const chart = screen.getByRole("group", { name: /^Median context/ });
    expect(chart.getAttribute("aria-label")).toContain("Showing only foo, with its 25th to 75th percentile band");
    fireEvent.keyDown(chart, { key: "Home" });
    expect(document.querySelector(".readout")!.textContent).toMatch(/foo \S+ \(25th to 75th percentile \S+ to \S+\)/);
    fireEvent.keyDown(chart, { key: "Escape" });
    expect(container.querySelectorAll("path.curve.view")).toHaveLength(2);
    fireEvent.keyDown(screen.getByRole("group", { name: /^Median context/ }), { key: "ArrowRight" });
    expect(document.querySelector(".readout")!.textContent).toMatch(/; foo 36k \(25th to 75th percentile /);
    await userEvent.click(fooKey);
    expect(fooKey.getAttribute("aria-pressed")).toBe("false");
    expect(barKey.getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelectorAll("path.curve.proj")).toHaveLength(2);
    expect(container.querySelectorAll("path.proj-band")).toHaveLength(0);
  });

  it("clears an isolated project that has no share curve when switching mode", async () => {
    setOrder(["foo", "bar"]);
    const { container } = renderApp(<GrowthChart curve={view} projects={[foo, bar]} share={shareView} />);
    await userEvent.click(screen.getByRole("button", { name: /^bar/ }));
    expect(container.querySelectorAll("path.curve.proj")).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Share of window" }));
    expect(container.querySelectorAll("path.curve.proj")).toHaveLength(1);
    expect(container.querySelectorAll("path.proj-band")).toHaveLength(0);
    expect(screen.getByRole("button", { name: /^foo/ }).getAttribute("aria-pressed")).toBe("false");
  });
});
