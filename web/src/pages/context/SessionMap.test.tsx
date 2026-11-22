import { act, fireEvent, screen, within } from "@testing-library/react";
import { renderApp } from "../../testing";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SessionPoint } from "../../api";
import { setOrder } from "../../colors";
import { drawn } from "../../components/echart/testing";
import { useState } from "react";
import type { Quad } from "./context";
import { mapFit, mapModel } from "./mapDots";
import { QUAD_LIST_MAX, SessionMap } from "./SessionMap";

// The model, the fit, the picking and the drawing are mapDots.test.ts's. Here what a user reaches through the component, on
// the fake runtime, which draws nothing: the label, the sentences, the tooltip, the ring, the sheet, the quadrants, the table.

const pt = (id: string, o: Partial<SessionPoint> = {}): SessionPoint =>
  ({ session_id: id, project: "foo", source: "claude", first_ts: "2026-11-04T10:00:00.000Z", start: 10_000, peak: 50_000, window: 200_000, turns: 8, compactions: 0, title: null, ...o });
const heavy = pt("heavy000001", { first_ts: "2026-11-05T10:00:00.000Z", start: 60_000, peak: 180_000 });
const over = pt("over0000002", { first_ts: "2026-11-03T10:00:00.000Z", start: 20_000, peak: 230_000, compactions: 2 });
const calm = pt("calm0000003", { first_ts: "2026-11-04T10:00:00.000Z", project: "bar", source: "codex" });
const points = [heavy, over, calm];
const hash = () => new URLSearchParams(location.search.slice(1));
const chartOf = () => screen.getByRole("group", { name: /^Session map/ });
const box = () => document.querySelector<HTMLElement>(".map-box")!;
// The map's own region; the wrapper's beside it stays empty.
const live = () => document.querySelector(".map-live")!.textContent;
const tip = () => screen.queryByRole("tooltip");
const mark = () => document.querySelector(".map-mark circle");
const press = (key: string) => fireEvent.keyDown(chartOf(), { key });
/** Where the fit puts a session's dot, in px from the box's top left (jsdom lays the box out at 0, 0 and 800px). */
const pixel = (pts: SessionPoint[], id: string, dx = 0, dy = 0) => {
  const f = mapFit(mapModel(pts), 800, 1, () => 0), d = f.dots[f.model.points.findIndex(p => p.session_id === id)]!;
  return { clientX: d.x + dx, clientY: d.y + dy };
};
const plot = (pts: SessionPoint[] = points) => mapFit(mapModel(pts), 800, 1, () => 0).plot;
/** The map with its quadrant held as the Pressure section holds it. */
function Map({ map, start = null, view = "v" }: { map: Parameters<typeof SessionMap>[0]["map"]; start?: Quad | null; view?: string }) {
  const [quad, setQuad] = useState<Quad | null>(start);
  return <SessionMap view={view} map={map} quad={quad} onQuad={setQuad} />;
}

beforeEach(() => { history.replaceState(null, "", location.pathname); setOrder(["foo", "bar"]); });
afterEach(() => setOrder([]));

describe("SessionMap", () => {
  it("states the count, and the newest N of M when the view has more, and draws again in a new project order", async () => {
    const { rerender } = renderApp(<Map map={{ total: 3, points }} />);
    // jsdom resolves every var() to one color, so the fills cannot tell two orders apart: a new order is a new drawing.
    const chart = await drawn(), draws = chart.options.length;
    rerender(<Map map={{ total: 3, points }} />);
    expect(chart.options.length).toBe(draws); // the same drawing
    act(() => setOrder(["bar"])); // foo loses its hue, with the same payload
    expect(chart.options.length).toBe(draws + 1);
    expect(screen.getByText(/^3 sessions\./)).toBeTruthy();
    rerender(<Map map={{ total: 3412, points }} />);
    expect(screen.getByText(/Showing the newest 3 of 3,412 sessions/)).toBeTruthy();
    expect(screen.getByText(/left out/)).toBeTruthy();
    expect(chartOf().getAttribute("aria-label")).toContain("3 sessions shown, 2 at or over 80% of their window, 1 of those started at or over 30k");
    expect(live()).toBe("");
  });

  it("steps through sessions oldest to newest with the keys, with the tooltip and the ring, and ends with Escape", () => {
    renderApp(<Map map={{ total: 3, points }} />);
    act(() => chartOf().focus());
    expect(press("ArrowRight")).toBe(false); // prevented: the page does not scroll
    // over, Nov 3: a peak over its window, drawn at 100%, reads its real share; compacted twice.
    expect(live()).toContain("peak 230k tokens");
    expect(tip()!.textContent).toContain("230k (115%)");
    expect(tip()!.textContent).toContain("Compactions2");
    const at = pixel(points, "over0000002");
    expect([mark()!.getAttribute("cx"), mark()!.getAttribute("cy"), mark()!.getAttribute("r")]).toEqual([String(at.clientX), String(at.clientY), "10.5"]);
    press("ArrowRight");
    expect(live()).toMatch(/^#calm0000: bar, Codex/); // calm, Nov 4
    expect(mark()!.getAttribute("r")).toBe("8"); // no ring: the mark sits closer
    press("End");
    expect(live()).toContain("peak 180k tokens"); // heavy, Nov 5
    press("ArrowLeft");
    expect(live()).toMatch(/^#calm0000: bar, Codex/);
    expect(fireEvent.keyDown(chartOf(), { key: "ArrowLeft", altKey: true })).toBe(true); // Alt+Left is the browser's
    expect(live()).toMatch(/^#calm0000/);
    press("Escape");
    expect([live(), tip(), mark()]).toEqual(["", null, null]);
  });

  it("keeps a key's reading on its session through newer data, says it again when its words change, and ends it with its session or the view", () => {
    const { rerender } = renderApp(<Map map={{ total: 3, points }} />);
    act(() => chartOf().focus());
    press("ArrowRight");
    press("ArrowRight"); // calm, the second oldest
    // An older session moves calm's index; a newer one adds a dot: the reading stays on calm, and says nothing new.
    const older = pt("old00000004", { first_ts: "2026-11-01T10:00:00.000Z" }), newer = pt("new00000005", { first_ts: "2026-11-06T10:00:00.000Z" });
    const said = document.querySelector(".map-live span");
    rerender(<Map map={{ total: 5, points: [...points, older, newer] }} />);
    expect(live()).toMatch(/^#calm0000: bar, Codex/);
    expect(document.querySelector(".map-live span")).toBe(said);
    const at = pixel([...points, older, newer], "calm0000003");
    expect([mark()!.getAttribute("cx"), mark()!.getAttribute("cy")]).toEqual([String(at.clientX), String(at.clientY)]);
    // Newer figures for calm: said again with its new words.
    rerender(<Map map={{ total: 5, points: [heavy, over, { ...calm, turns: 9 }, older, newer] }} />);
    expect(live()).toContain("9 turns");
    // calm leaves the map: the reading ends.
    rerender(<Map map={{ total: 4, points: [heavy, over, older, newer] }} />);
    expect([live(), tip()]).toEqual(["", null]);
    // Another view ends a reading too.
    press("Home");
    expect(live()).toMatch(/^#old00000/);
    rerender(<Map map={{ total: 4, points: [heavy, over, older, newer] }} view="w" />);
    expect([live(), tip()]).toEqual(["", null]);
  });

  it("reads the nearest dot under the pointer within 12px, and Escape from elsewhere ends it", () => {
    renderApp(<Map map={{ total: 3, points }} start="lean" />);
    fireEvent.mouseMove(box(), pixel(points, "calm0000003", 7, 9)); // 11.4px away
    expect(tip()!.textContent).toMatch(/^#calm0000/);
    expect(live()).toMatch(/^#calm0000: bar, Codex/);
    expect(box().classList.contains("hand")).toBe(true);
    fireEvent.mouseMove(box(), pixel(points, "calm0000003", 0, 13));
    expect([tip(), live()]).toEqual([null, ""]);
    fireEvent.mouseMove(box(), pixel(points, "heavy000001"));
    expect(tip()!.textContent).toMatch(/^#heavy000/);
    // Escape from another control ends the reading, and leaves the quadrant.
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(tip()).toBeNull();
    expect(screen.getByRole("button", { name: /^Lean/ }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.mouseMove(box(), pixel(points, "heavy000001"));
    fireEvent.mouseLeave(box());
    expect([tip(), box().classList.contains("hand")]).toEqual([null, false]);
  });

  it("opens the session on Enter and on a click near its dot", () => {
    renderApp(<Map map={{ total: 3, points }} />);
    press("Enter");
    expect(hash().get("session")).toBeNull();
    press("End");
    press("Enter");
    expect(hash().get("session")).toBe("heavy000001");
    fireEvent.click(box(), pixel(points, "calm0000003", 5, 3));
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

  it("names a session by its title in the tooltip, the live region and the table, with its short id under it", async () => {
    const titled = pt("titled00005", { title: "Fix the login redirect", first_ts: "2026-11-06T10:00:00.000Z" });
    renderApp(<Map map={{ total: 4, points: [...points, titled] }} />);
    press("End");
    expect(tip()!.textContent).toMatch(/^Fix the login redirect/);
    expect(live()).toMatch(/^Fix the login redirect: foo, Claude Code/);
    await userEvent.click(screen.getByRole("button", { name: "Show data table" }));
    const row = within(screen.getByRole("table", { name: "Sessions on the map" })).getByRole("rowheader", { name: /Fix the login redirect/ });
    expect(row.textContent).toBe("Fix the login redirect#titled00");
    expect(within(screen.getByRole("table", { name: "Sessions on the map" })).getByRole("rowheader", { name: "#calm0000" })).toBeTruthy();
  });

  it("counts the four quadrants the 30k and 80% lines make on their buttons", () => {
    renderApp(<Map map={{ total: 3, points }} />);
    const buttons = within(screen.getByRole("group", { name: /^Quadrants/ })).getAllByRole("button");
    // heavy: 60k start at 90%; over: 20k start at 115%; calm: 10k at 25%.
    expect(buttons.map(b => b.textContent)).toEqual([
      "Lean 11 session, a light start and room left", "Heavy start 00 sessions, a heavy start and room left",
      "Grew full 11 session, a light start and a peak at 80% or more", "Heavy and full 11 session, a heavy start and a peak at 80% or more"]);
    // The visible count is hidden from the name, which says it once with its noun.
    expect(screen.getByRole("button", { name: "Heavy and full 1 session, a heavy start and a peak at 80% or more" })).toBeTruthy();
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

  it("selects a quadrant by keyboard, lists its sessions and clears with Escape", async () => {
    renderApp(<Map map={{ total: 3, points }} />);
    const grew = screen.getByRole("button", { name: /^Grew full/ });
    act(() => grew.focus());
    await userEvent.keyboard("{Enter}");
    expect(grew.getAttribute("aria-pressed")).toBe("true");
    const list = screen.getByRole("region", { name: "Sessions in Grew full" });
    expect(within(list).getAllByRole("button").map(b => b.getAttribute("data-session"))).toEqual(["over0000002"]);
    await userEvent.keyboard("{Escape}");
    expect(grew.getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByRole("region", { name: /^Sessions in/ })).toBeNull();
    // One Escape on the map dismisses the reading and clears the quadrant together.
    await userEvent.click(screen.getByRole("button", { name: /^Lean/ }));
    act(() => chartOf().focus());
    press("Home");
    expect(live()).not.toBe("");
    press("Escape");
    expect(live()).toBe("");
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

  it("selects the quadrant under a click away from any dot, again clears it, and a click outside the plot does nothing", () => {
    renderApp(<Map map={{ total: 3, points }} />);
    const { x, y, width } = plot();
    fireEvent.click(box(), { clientX: x + width - 2, clientY: y + 2 }); // top right: a heavy start, at 80% or more
    expect(screen.getByRole("button", { name: /^Heavy and full/ }).getAttribute("aria-pressed")).toBe("true");
    expect(hash().get("session")).toBeNull();
    fireEvent.click(box(), { clientX: x / 2, clientY: y + 2 }); // in the left margin
    expect(screen.getByRole("button", { name: /^Heavy and full/ }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(box(), { clientX: x + width - 2, clientY: y + 2 });
    expect(screen.queryAllByRole("button", { pressed: true })).toHaveLength(0);
  });

  it("renders only an empty state without points", () => {
    renderApp(<Map map={{ total: 0, points: [] }} />);
    expect(screen.getByText("No session in this view has a measured start, a known window and a peak.")).toBeTruthy();
    expect(screen.queryByRole("group")).toBeNull();
  });
});
