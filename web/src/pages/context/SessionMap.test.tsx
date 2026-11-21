import { act, fireEvent, screen, within } from "@testing-library/react";
import { renderApp } from "../../testing";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type { SessionPoint } from "../../api";
import { setOrder } from "../../colors";
import { useState } from "react";
import type { Quad } from "./context";
import { QUAD_LIST_MAX, SessionMap, drawnShare, fitLines, logFraction, startDomain, startTicks } from "./SessionMap";

const pt = (id: string, o: Partial<SessionPoint> = {}): SessionPoint =>
  ({ session_id: id, project: "foo", source: "claude", first_ts: "2026-11-04T10:00:00.000Z", start: 10_000, peak: 50_000, window: 200_000, turns: 8, compactions: 0, title: null, ...o });
const heavy = pt("heavy000001", { first_ts: "2026-11-05T10:00:00.000Z", start: 60_000, peak: 180_000 });
const over = pt("over0000002", { first_ts: "2026-11-03T10:00:00.000Z", start: 20_000, peak: 230_000, compactions: 2 });
const calm = pt("calm0000003", { first_ts: "2026-11-04T10:00:00.000Z", project: "bar", source: "codex" });
const points = [heavy, over, calm];
const hash = () => new URLSearchParams(location.search.slice(1));
const num = (el: Element | null, a: string) => Number(el!.getAttribute(a));
const dotOf = (c: HTMLElement, id: string) => c.querySelector(`g[data-id="${id}"] circle.dot`)!;
const chartOf = () => screen.getByRole("group", { name: /^Session map/ });
/** The map with its quadrant held as the Pressure section holds it; picked records each selection. */
const picked: (Quad | null)[] = [];
function Map({ map, start = null }: { map: Parameters<typeof SessionMap>[0]["map"]; start?: Quad | null }) {
  const [quad, setQuad] = useState<Quad | null>(start);
  return <SessionMap map={map} quad={quad} onQuad={q => { picked.push(q); setQuad(q); }} />;
}

beforeEach(() => { history.replaceState(null, "", location.pathname); setOrder(["foo", "bar"]); });

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
    const { container } = renderApp(<Map map={{ total: 3, points }} />);
    const d = dotOf(container, "heavy000001"), lx = num(container.querySelector(".ref-x"), "x1"), ly = num(container.querySelector(".ref-y"), "y1");
    expect(num(d, "cx")).toBeGreaterThan(lx);
    expect(num(d, "cy")).toBeLessThan(ly);
    expect(num(dotOf(container, "calm0000003"), "cx")).toBeLessThan(lx);
    expect(num(dotOf(container, "calm0000003"), "cy")).toBeGreaterThan(ly);
  });

  it("draws a peak over its window at 100% and shows the real share", () => {
    const { container } = renderApp(<Map map={{ total: 3, points }} />);
    expect(drawnShare(over)).toBe(1);
    // A peak of 100% of the window and one of 115% sit at the same height: the plot's top edge.
    const { container: c2 } = renderApp(<Map map={{ total: 1, points: [pt("full00000004", { start: 20_000, peak: 200_000 })] }} />);
    expect(num(dotOf(container, "over0000002"), "cy")).toBe(num(dotOf(c2, "full00000004"), "cy"));
    fireEvent.keyDown(container.querySelector("[role=group]")!, { key: "Home" });
    expect(container.querySelector("[role=tooltip]")!.textContent).toContain("230k (115%)");
  });

  it("rings compacted sessions only", () => {
    const { container } = renderApp(<Map map={{ total: 3, points }} />);
    expect(container.querySelectorAll("circle.ring")).toHaveLength(1);
    expect(container.querySelector('g[data-id="over0000002"] circle.ring')).not.toBeNull();
    expect(container.querySelector('g[data-id="calm0000003"] circle.ring')).toBeNull();
    fireEvent.keyDown(chartOf(), { key: "Home" });
    expect(screen.getByRole("tooltip").textContent).toContain("Compactions2");
  });

  it("states the count, and the newest N of M when the view has more", () => {
    const { rerender } = renderApp(<Map map={{ total: 3, points }} />);
    expect(screen.getByText(/^3 sessions\./)).toBeTruthy();
    rerender(<Map map={{ total: 3412, points }} />);
    expect(screen.getByText(/Showing the newest 3 of 3,412 sessions/)).toBeTruthy();
    expect(screen.getByText(/left out/)).toBeTruthy();
    expect(chartOf().getAttribute("aria-label")).toContain("3 sessions shown, 2 at or over 80% of their window, 1 of those started at or over 30k");
  });

  it("steps through points oldest to newest with the arrow keys and clears with Escape", () => {
    renderApp(<Map map={{ total: 3, points }} />);
    const chart = chartOf(), readout = () => document.querySelector(".readout")!.textContent!;
    act(() => chart.focus());
    fireEvent.keyDown(chart, { key: "ArrowRight" });
    expect(readout()).toContain("peak 230k tokens"); // over, Nov 3
    fireEvent.keyDown(chart, { key: "ArrowRight" });
    expect(readout()).toMatch(/^#calm0000: bar, Codex/); // calm, Nov 4
    fireEvent.keyDown(chart, { key: "End" });
    expect(readout()).toContain("peak 180k tokens"); // heavy, Nov 5
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    expect(readout()).toMatch(/^#calm0000: bar, Codex/);
    fireEvent.keyDown(chart, { key: "Escape" });
    expect(readout()).toBe("");
  });

  it("keeps the page's filters when a session opens", () => {
    history.replaceState(null, "", "?project=foo&range=30");
    renderApp(<Map map={{ total: 3, points }} />);
    const chart = chartOf();
    fireEvent.keyDown(chart, { key: "End" });
    fireEvent.keyDown(chart, { key: "Enter" });
    expect([hash().get("project"), hash().get("range"), hash().get("session")]).toEqual(["foo", "30", "heavy000001"]);
  });

  it("opens the session on Enter and on a click near its dot", () => {
    const { container } = renderApp(<Map map={{ total: 3, points }} />);
    const chart = chartOf();
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
    renderApp(<Map map={{ total: 3, points }} />);
    await userEvent.click(screen.getByRole("button", { name: "Show data table" }));
    const table = screen.getByRole("table", { name: "Sessions on the map" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);
    await userEvent.click(within(rows[0]!).getByRole("button"));
    expect(hash().get("session")).toBe("over0000002");
  });

  it("names a session by its title in the tooltip, the readout and the table, with its short id under it", async () => {
    const titled = pt("titled00005", { title: "Fix the login redirect", first_ts: "2026-11-06T10:00:00.000Z" });
    renderApp(<Map map={{ total: 4, points: [...points, titled] }} />);
    fireEvent.keyDown(chartOf(), { key: "End" });
    expect(screen.getByRole("tooltip").textContent).toMatch(/^Fix the login redirect/);
    expect(document.querySelector(".readout")!.textContent).toMatch(/^Fix the login redirect: foo, Claude Code/);
    await userEvent.click(screen.getByRole("button", { name: "Show data table" }));
    const row = within(screen.getByRole("table", { name: "Sessions on the map" })).getByRole("rowheader", { name: /Fix the login redirect/ });
    expect(row.textContent).toBe("Fix the login redirect#titled00");
    expect(within(screen.getByRole("table", { name: "Sessions on the map" })).getByRole("rowheader", { name: "#calm0000" })).toBeTruthy();
  });

  it("labels the four quadrants the 30k and 80% lines make", () => {
    const { container } = renderApp(<Map map={{ total: 3, points }} />);
    expect([...container.querySelectorAll("text.quad-label")].map(t => t.textContent)).toEqual(["Lean", "Heavy start", "Grew full", "Heavy and full"]);
    const buttons = within(screen.getByRole("group", { name: /^Quadrants/ })).getAllByRole("button");
    // heavy: 60k start at 90%; over: 20k start at 115%; calm: 10k at 25%.
    expect(buttons.map(b => b.textContent)).toEqual([
      "Lean 11 session, a light start and room left", "Heavy start 00 sessions, a heavy start and room left",
      "Grew full 11 session, a light start and a peak at 80% or more", "Heavy and full 11 session, a heavy start and a peak at 80% or more"]);
    // The visible count is hidden from the name, which says it once with its noun.
    expect(screen.getByRole("button", { name: "Heavy and full 1 session, a heavy start and a peak at 80% or more" })).toBeTruthy();
  });

  it("wraps a quadrant's name to the room beside the 30k line", () => {
    expect(fitLines("Grew full", 200, 11)).toEqual({ lines: ["Grew full"], fs: 11 });
    expect(fitLines("Grew full", 40, 11)).toEqual({ lines: ["Grew", "full"], fs: 11 });
    expect(fitLines("Heavy and full", 50, 11).lines).toEqual(["Heavy", "and", "full"]);
    const tight = fitLines("Heavy and full", 30, 11);
    expect(tight.fs).toBeLessThan(11);
    expect(tight.fs).toBeGreaterThanOrEqual(11 * .8);
  });

  it("lists only the newest 20 sessions of a selected quadrant, and counts the rest", async () => {
    const many = Array.from({ length: 25 }, (_, i) => pt(`lean${String(i).padStart(7, "0")}`, { first_ts: `2026-11-${String(i + 1).padStart(2, "0")}T10:00:00.000Z` }));
    renderApp(<Map map={{ total: 25, points: many }} />);
    await userEvent.click(screen.getByRole("button", { name: /^Lean/ }));
    const list = screen.getByRole("region", { name: "Sessions in Lean" });
    const ids = within(list).getAllByRole("button").map(b => b.getAttribute("data-session"));
    expect(ids).toHaveLength(QUAD_LIST_MAX);
    // Each is its session's subject for the context menu, as every other session link is.
    for (const b of within(list).getAllByRole("button")) expect(b.getAttribute("data-subject")).toBe(`session:${b.getAttribute("data-session")}`);
    expect(ids[0]).toBe("lean0000024");
    expect(ids.at(-1)).toBe("lean0000005");
    expect(within(list).getByText(/^The 20 newest of 25 sessions on the map/)).toBeTruthy();
  });

  it("selects a quadrant by keyboard, lists its sessions, dims the rest and clears with Escape", async () => {
    const { container } = renderApp(<Map map={{ total: 3, points }} />);
    const grew = screen.getByRole("button", { name: /^Grew full/ });
    act(() => grew.focus());
    await userEvent.keyboard("{Enter}");
    expect(grew.getAttribute("aria-pressed")).toBe("true");
    const list = screen.getByRole("region", { name: "Sessions in Grew full" });
    expect(within(list).getAllByRole("button").map(b => b.getAttribute("data-session"))).toEqual(["over0000002"]);
    expect(container.querySelector('g[data-id="heavy000001"]')!.classList.contains("out")).toBe(true);
    expect(container.querySelector('g[data-id="over0000002"]')!.classList.contains("out")).toBe(false);
    await userEvent.keyboard("{Escape}");
    expect(grew.getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByRole("region", { name: /^Sessions in/ })).toBeNull();
    // One Escape on the map dismisses the reading and clears the quadrant together.
    await userEvent.click(screen.getByRole("button", { name: /^Lean/ }));
    act(() => chartOf().focus());
    fireEvent.keyDown(chartOf(), { key: "Home" });
    expect(document.querySelector(".readout")!.textContent).not.toBe("");
    fireEvent.keyDown(chartOf(), { key: "Escape" });
    expect(document.querySelector(".readout")!.textContent).toBe("");
    expect(screen.getByRole("button", { name: /^Lean/ }).getAttribute("aria-pressed")).toBe("false");
  });

  it("moves focus from Clear to the quadrant it cleared, not to the page", async () => {
    renderApp(<Map map={{ total: 3, points }} />);
    await userEvent.click(screen.getByRole("button", { name: /^Grew full/ }));
    const clear = screen.getByRole("button", { name: "Clear" });
    act(() => clear.focus());
    await userEvent.keyboard("{Enter}");
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^Grew full/ }));
    // Escape from Clear does the same.
    await userEvent.keyboard("{Enter}");
    act(() => screen.getByRole("button", { name: "Clear" }).focus());
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^Grew full/ }));
    expect(screen.queryAllByRole("button", { pressed: true })).toHaveLength(0);
  });

  it("selects the quadrant under a click away from any dot, and Clear clears it", async () => {
    const { container } = renderApp(<Map map={{ total: 3, points }} />);
    const rect = container.querySelector("rect.hit")!;
    const left = num(rect, "x"), top = num(rect, "y"), width = num(rect, "width"), height = num(rect, "height");
    rect.getBoundingClientRect = () => ({ left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON: () => ({}) });
    fireEvent.click(rect, { clientX: left + width - 2, clientY: top + 2 }); // top right: a heavy start, at 80% or more
    expect(screen.getByRole("button", { name: /^Heavy and full/ }).getAttribute("aria-pressed")).toBe("true");
    expect(hash().get("session")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryAllByRole("button", { pressed: true })).toHaveLength(0);
  });

  it("renders only an empty state without points", () => {
    const { container } = renderApp(<Map map={{ total: 0, points: [] }} />);
    expect(screen.getByText("No session in this view has a measured start, a known window and a peak.")).toBeTruthy();
    expect(container.querySelector("svg")).toBeNull();
  });
});
