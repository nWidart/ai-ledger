import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type { SessionPoint } from "../../api";
import { setOrder } from "../../colors";
import { SessionMap, drawnShare, logFraction, startDomain, startTicks } from "./SessionMap";

const pt = (id: string, o: Partial<SessionPoint> = {}): SessionPoint =>
  ({ session_id: id, project: "foo", source: "claude", first_ts: "2026-11-04T10:00:00.000Z", start: 10_000, peak: 50_000, window: 200_000, turns: 8, compactions: 0, ...o });
const heavy = pt("heavy000001", { first_ts: "2026-11-05T10:00:00.000Z", start: 60_000, peak: 180_000 });
const over = pt("over0000002", { first_ts: "2026-11-03T10:00:00.000Z", start: 20_000, peak: 230_000, compactions: 2 });
const calm = pt("calm0000003", { first_ts: "2026-11-04T10:00:00.000Z", project: "bar", source: "codex" });
const points = [heavy, over, calm];
const hash = () => new URLSearchParams(location.hash.slice(1));
const num = (el: Element | null, a: string) => Number(el!.getAttribute(a));
const dotOf = (c: HTMLElement, id: string) => c.querySelector(`g[data-id="${id}"] circle.dot`)!;

beforeEach(() => { location.hash = ""; setOrder(["foo", "bar"]); });

describe("log scale", () => {
  it("gives equal distances to equal ratios", () => {
    const d = startDomain([1_000, 100_000]);
    expect(d).toEqual([1_000, 100_000]);
    expect(logFraction(2_000, d) - logFraction(1_000, d)).toBeCloseTo(logFraction(20_000, d) - logFraction(10_000, d));
  });
  it("rounds the domain out, always spanning 30k, and ticks inside it", () => {
    expect(startDomain([4_000, 8_000])).toEqual([2_000, 50_000]);
    expect(startTicks([1_000, 20_000])).toEqual([1_000, 2_000, 5_000, 10_000, 20_000]);
  });
});

describe("SessionMap", () => {
  it("puts a 60k start peaking at 90% right of the 30k line and above the 80% line", () => {
    const { container } = render(<SessionMap map={{ total: 3, points }} />);
    const d = dotOf(container, "heavy000001"), lx = num(container.querySelector(".ref-x"), "x1"), ly = num(container.querySelector(".ref-y"), "y1");
    expect(num(d, "cx")).toBeGreaterThan(lx);
    expect(num(d, "cy")).toBeLessThan(ly);
    expect(num(dotOf(container, "calm0000003"), "cx")).toBeLessThan(lx);
    expect(num(dotOf(container, "calm0000003"), "cy")).toBeGreaterThan(ly);
  });

  it("draws a peak over its window at 100% and shows the real share", () => {
    const { container } = render(<SessionMap map={{ total: 3, points }} />);
    expect(drawnShare(over)).toBe(1);
    // A peak of 100% of the window and one of 115% sit at the same height: the plot's top edge.
    const { container: c2 } = render(<SessionMap map={{ total: 1, points: [pt("full00000004", { start: 20_000, peak: 200_000 })] }} />);
    expect(num(dotOf(container, "over0000002"), "cy")).toBe(num(dotOf(c2, "full00000004"), "cy"));
    fireEvent.keyDown(container.querySelector("[role=group]")!, { key: "Home" });
    expect(container.querySelector("[role=tooltip]")!.textContent).toContain("230k (115%)");
  });

  it("rings compacted sessions only", () => {
    const { container } = render(<SessionMap map={{ total: 3, points }} />);
    expect(container.querySelectorAll("circle.ring")).toHaveLength(1);
    expect(container.querySelector('g[data-id="over0000002"] circle.ring')).not.toBeNull();
    expect(container.querySelector('g[data-id="calm0000003"] circle.ring')).toBeNull();
    fireEvent.keyDown(screen.getByRole("group"), { key: "Home" });
    expect(screen.getByRole("tooltip").textContent).toContain("Compactions2");
  });

  it("states the count, and the newest N of M when the view has more", () => {
    const { rerender } = render(<SessionMap map={{ total: 3, points }} />);
    expect(screen.getByText(/^3 sessions\./)).toBeTruthy();
    rerender(<SessionMap map={{ total: 3412, points }} />);
    expect(screen.getByText(/Showing the newest 3 of 3,412 sessions/)).toBeTruthy();
    expect(screen.getByText(/left out/)).toBeTruthy();
    expect(screen.getByRole("group").getAttribute("aria-label")).toContain("3 sessions shown, 2 at or over 80% of their window, 1 of those started at or over 30k");
  });

  it("steps through points oldest to newest with the arrow keys and clears with Escape", () => {
    render(<SessionMap map={{ total: 3, points }} />);
    const chart = screen.getByRole("group"), readout = () => document.querySelector(".readout")!.textContent!;
    act(() => chart.focus());
    fireEvent.keyDown(chart, { key: "ArrowRight" });
    expect(readout()).toContain("peak 230k tokens"); // over, Nov 3
    fireEvent.keyDown(chart, { key: "ArrowRight" });
    expect(readout()).toMatch(/^bar, Codex/); // calm, Nov 4
    fireEvent.keyDown(chart, { key: "End" });
    expect(readout()).toContain("peak 180k tokens"); // heavy, Nov 5
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    expect(readout()).toMatch(/^bar, Codex/);
    fireEvent.keyDown(chart, { key: "Escape" });
    expect(readout()).toBe("");
  });

  it("keeps the page's filters when a session opens", () => {
    location.hash = "#project=foo&range=30";
    render(<SessionMap map={{ total: 3, points }} />);
    const chart = screen.getByRole("group");
    fireEvent.keyDown(chart, { key: "End" });
    fireEvent.keyDown(chart, { key: "Enter" });
    expect([hash().get("project"), hash().get("range"), hash().get("session")]).toEqual(["foo", "30", "heavy000001"]);
  });

  it("opens the session on Enter and on a click near its dot", () => {
    const { container } = render(<SessionMap map={{ total: 3, points }} />);
    const chart = screen.getByRole("group");
    fireEvent.keyDown(chart, { key: "Enter" });
    expect(hash().get("session")).toBeNull();
    fireEvent.keyDown(chart, { key: "End" });
    fireEvent.keyDown(chart, { key: "Enter" });
    expect(hash().get("session")).toBe("heavy000001");
    // jsdom has no layout: the plot rect's box maps 1:1 to the svg's own units.
    const rect = container.querySelector("rect.hit")!, d = dotOf(container, "calm0000003");
    const left = num(rect, "x"), top = num(rect, "y"), width = num(rect, "width"), height = num(rect, "height");
    rect.getBoundingClientRect = () => ({ left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON: () => ({}) });
    fireEvent.click(rect, { clientX: num(d, "cx") + 5, clientY: num(d, "cy") + 3 });
    expect(hash().get("session")).toBe("calm0000003");
    fireEvent.click(rect, { clientX: left + 1, clientY: top + 1 }); // nothing near: no change
    expect(hash().get("session")).toBe("calm0000003");
  });

  it("opens a session from its row in the data table", async () => {
    render(<SessionMap map={{ total: 3, points }} />);
    await userEvent.click(screen.getByRole("button", { name: "Show data table" }));
    const table = screen.getByRole("table", { name: "Sessions on the map" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);
    await userEvent.click(within(rows[0]!).getByRole("button"));
    expect(hash().get("session")).toBe("over0000002");
  });

  it("renders only an empty state without points", () => {
    const { container } = render(<SessionMap map={{ total: 0, points: [] }} />);
    expect(screen.getByText("No session in this view has a measured start, a known window and a peak.")).toBeTruthy();
    expect(container.querySelector("svg")).toBeNull();
  });
});
