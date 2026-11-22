import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GrowthPoint } from "../../api";
import { setOrder } from "../../colors";
import { drawn } from "../../components/echart/testing";
import { renderApp } from "../../testing";
import { GrowthChart, readShare, readTurn } from "./GrowthChart";

// What the chart draws (the band, the lines, the strip, the 80% line, the scales, the layout) is growthCurves.test.ts's to
// test. Here: what a user reaches.
const pt = (turn: number, median: number, sessions = 9): GrowthPoint => ({ turn, median, p25: median * .7, p75: median * 1.4, sessions });
const view = [1, 2, 3, 4, 5].map(t => pt(t, 20_000 + t * 10_000));
const sp = (turn: number, median: number, sessions = 7): GrowthPoint => ({ turn, median, p25: median * .7, p75: median * 1.3, sessions });
const shareView = [1, 2, 3, 4].map(t => sp(t, .1 + t * .1));
const foo = { project: "foo", sessions: 6, curve: view.map(p => ({ ...p, median: p.median * 1.2 })), share_curve: shareView.map(p => ({ ...p, median: p.median * 1.1 })) };
const bar = { project: "bar", sessions: 5, curve: view.slice(0, 3).map(p => ({ ...p, median: p.median * .6 })), share_curve: [] };

const chart = () => screen.getByRole("group", { name: /^Median (context|share)/ });
const sr = () => document.querySelector(".growth div.sr[aria-live]")!.textContent;
const tipRows = () => within(screen.getByRole("tooltip")).getAllByText((_, el) => !!el?.classList.contains("row")).map(r => r.textContent);
const key = (k: string) => fireEvent.keyDown(chart(), { key: k });

beforeEach(() => {
  setOrder(["foo", "bar"]);
  // The tooltip is placed inside the box; jsdom lays nothing out.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, right: 800, bottom: 302, width: 800, height: 302, x: 0, y: 0, toJSON: () => ({}) });
});

describe("GrowthChart", () => {
  it("describes itself, naming the median at the last turn shown", () => {
    renderApp(<GrowthChart view="v" curve={view} projects={[foo]} />);
    const label = chart().getAttribute("aria-label")!;
    expect(label).toContain("70k at turn 5");
    expect(label).toContain("30k tokens at turn 1");
    expect(label).toContain("1 project drawn separately");
    expect(label).toContain("9 sessions");
  });

  it("reads a turn with the keys and its tooltip, keeps it through newer figures, and dismisses it with Escape or on blur", async () => {
    const { rerender } = renderApp(<GrowthChart view="v" curve={view} projects={[foo, bar]} />);
    act(() => chart().focus());
    key("ArrowRight");
    expect(sr()).toBe(readTurn(view[0]!));
    expect(within(screen.getByRole("tooltip")).getByText("Turn 1")).toBeTruthy();
    expect(tipRows()).toEqual(["Median30k", "25th to 75th percentile21k to 42k", "Sessions9", "foo36k", "bar18k"]);
    // bar's curve stops after turn 3: its row goes.
    key("End");
    expect(sr()).toBe("Turn 5: median 70k tokens (25th to 75th percentile 49k to 98k), 9 sessions");
    expect(tipRows().at(-1)).toBe("foo84k");
    // A newer payload of the same view, one more turn and turn 5's figures changed: the reading stays on turn 5, with them.
    rerender(<GrowthChart view="v" curve={[...view.slice(0, 4), pt(5, 80_000), pt(6, 90_000)]} projects={[foo, bar]} />);
    expect(within(screen.getByRole("tooltip")).getByText("Turn 5")).toBeTruthy();
    expect(tipRows()[0]).toBe("Median80k");
    key("Escape");
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(sr()).toBe("");
    expect(document.activeElement).toBe(chart());
    key("Home");
    expect(sr()).toBe(readTurn(view[0]!));
    fireEvent.blur(chart());
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("reads the turn under the pointer", async () => {
    const long = Array.from({ length: 101 }, (_, i) => pt(i + 1, 10_000 + i * 100));
    renderApp(<GrowthChart view="v" curve={long} projects={[]} />);
    const fake = await drawn();
    fake.fire("mousemove", fake.pointAt(25));
    expect(within(screen.getByRole("tooltip")).getByText("Turn 26")).toBeTruthy();
  });

  it("offers every turn as a table, closed until asked for, with each project's median", async () => {
    renderApp(<GrowthChart view="v" curve={view} projects={[foo, bar]} />);
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

  it("describes a curve of one point, and shows nothing without one", () => {
    const { container, rerender } = renderApp(<GrowthChart view="v" curve={[pt(1, 12_000)]} projects={[]} />);
    expect(chart().getAttribute("aria-label")).toContain("the only turn with 5 or more sessions: 12k tokens");
    rerender(<GrowthChart view="v" curve={[]} projects={[]} />);
    expect(container.querySelector(".growth")).toBeNull();
  });

  it("offers the share switch only with a share curve", () => {
    const { rerender } = renderApp(<GrowthChart view="v" curve={view} projects={[foo]} />);
    expect(screen.queryByRole("button", { name: "Share of window" })).toBeNull();
    rerender(<GrowthChart view="v" curve={view} projects={[foo]} share={[]} />);
    expect(screen.queryByRole("button", { name: "Share of window" })).toBeNull();
    rerender(<GrowthChart view="v" curve={view} projects={[foo]} share={shareView} />);
    expect(screen.getByRole("button", { name: "Tokens" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Share of window" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("switches to share, ending the reading: the share label, reading, tooltip and table", async () => {
    renderApp(<GrowthChart view="v" curve={view} projects={[foo, bar]} share={shareView} />);
    act(() => chart().focus());
    key("End");
    expect(screen.getByRole("tooltip")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Share of window" }));
    expect(screen.getByRole("button", { name: "Share of window" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("tooltip")).toBeNull();
    // bar has no share curve: only foo is in the legend.
    expect(screen.queryByRole("button", { name: /^bar/ })).toBeNull();
    expect(chart().getAttribute("aria-label")).toContain("The dashed line marks 80% of the window");
    act(() => chart().focus());
    key("End");
    expect(sr()).toBe(readShare(shareView[3]!));
    expect(sr()).toContain("median 50% of the window");
    expect(tipRows()).toEqual(["Median50%", "25th to 75th percentile35% to 65%", "Sessions7", "foo55%"]);
    await userEvent.click(screen.getByRole("button", { name: "Show data table" }));
    const table = screen.getByRole("table", { name: "Median share of the window at each turn" });
    expect(within(table).getAllByRole("columnheader").map(h => h.textContent)).toEqual(["Turn", "Median", "25th percentile", "75th percentile", "Sessions", "foo"]);
    expect(within(within(table).getAllByRole("row")[1]!).getAllByRole("cell").map(c => c.textContent)).toEqual(["20%", "14%", "26%", "7", "22%"]);
  });

  it("isolates a project with its own band, and restores every project", async () => {
    renderApp(<GrowthChart view="v" curve={view} projects={[foo, bar]} />);
    const fooKey = screen.getByRole("button", { name: /^foo/ }), barKey = screen.getByRole("button", { name: /^bar/ });
    expect(fooKey.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("25th to 75th percentile")).toBeTruthy();
    await userEvent.click(fooKey);
    expect(fooKey.getAttribute("aria-pressed")).toBe("true");
    // The view's band leaves the legend; the project's spread is readable, not only drawn.
    expect(screen.queryByText("25th to 75th percentile")).toBeNull();
    expect(chart().getAttribute("aria-label")).toContain("Showing only foo, with its 25th to 75th percentile band");
    act(() => chart().focus());
    key("Home");
    expect(tipRows()).toHaveLength(4);
    expect(tipRows().at(-1)).toMatch(/^foo36k \(/);
    await userEvent.click(screen.getByRole("button", { name: "Show data table" }));
    expect(within(screen.getByRole("table")).getAllByRole("columnheader").at(-1)!.textContent).toBe("foo");
    await userEvent.click(fooKey);
    expect(fooKey.getAttribute("aria-pressed")).toBe("false");
    expect(barKey.getAttribute("aria-pressed")).toBe("false");
    expect(within(screen.getByRole("table")).getAllByRole("columnheader").slice(-2).map(h => h.textContent)).toEqual(["foo", "bar"]);
  });

  it("clears an isolated project that has no share curve when switching mode", async () => {
    renderApp(<GrowthChart view="v" curve={view} projects={[foo, bar]} share={shareView} />);
    await userEvent.click(screen.getByRole("button", { name: /^bar/ }));
    expect(screen.getByRole("button", { name: /^bar/ }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Share of window" }));
    expect(screen.getByRole("button", { name: /^foo/ }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("25th to 75th percentile")).toBeTruthy();
    // Back to tokens: bar is not isolated again.
    await userEvent.click(screen.getByRole("button", { name: "Tokens" }));
    expect(screen.getByRole("button", { name: /^bar/ }).getAttribute("aria-pressed")).toBe("false");
  });
});
