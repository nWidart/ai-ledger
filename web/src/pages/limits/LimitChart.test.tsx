import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LimitWindow, LimitsPayload } from "../../api";
import limits from "../../__fixtures__/limits";
import { LimitChart, percentRuns } from "./LimitChart";
import { closedWindow, readPoints, readText } from "./limits";
import { renderApp } from "../../testing";

const fixture = limits as LimitsPayload;
const claude = fixture.windows[0]!;
const past = [
  { t: "2026-11-07T10:00:00.000Z", pct: 40, measured: true },
  { t: "2026-11-07T11:00:00.000Z", pct: 42, measured: false },
];
const curve = [
  { t: "2026-11-07T11:00:00.000Z", mid: 42, lo: 42, hi: 42, recent: null },
  { t: "2026-11-07T12:00:00.000Z", mid: 50, lo: 45, hi: 60, recent: null },
  { t: "2026-11-07T13:00:00.000Z", mid: 58, lo: 58, hi: 58, recent: null },
];
const w: LimitWindow = { ...claude, start: "2026-11-07T00:00:00.000Z", resets_at: "2026-11-08T00:00:00.000Z", series: past,
  forecast: { ...claude.forecast!, curve } };
const pts = readPoints(w), say = (i: number) => readText(pts[i]!);
const draw = (win: LimitWindow = w) => {
  renderApp(<LimitChart w={win} now="2026-11-07T11:00:00.000Z" events={[]} />);
  return screen.queryByRole("group");
};
// jsdom has no layout: the chart is 420 wide with a 36px left margin and a 374px plot, so clientX is the plot's own x.
const clientX = (t: string) => 36 + (Date.parse(t) - Date.parse(w.start)) / (Date.parse(w.resets_at) - Date.parse(w.start)) * 374;
const tip = () => document.querySelector(".tip") as HTMLElement;
const plot = () => document.querySelector(".lim-chart svg") as SVGSVGElement;

describe("LimitChart readout", () => {
  it("keeps the summary on the image and makes the group around it the one tab stop", () => {
    const g = draw()!;
    expect(g.tabIndex).toBe(0);
    expect(g.getAttribute("aria-label")).toMatch(/Claude Code weekly.*arrow/);
    expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(/^Claude Code weekly: 90% used\./);
    expect(g.contains(screen.getByRole("img"))).toBe(true);
  });

  it("shows the point nearest the pointer, and clears when the pointer leaves", () => {
    draw();
    expect(tip().style.display).toBe("none");
    fireEvent.pointerMove(plot(), { clientX: clientX(past[0]!.t) + 5, clientY: 60 });
    expect(tip().textContent).toBe(say(0));
    expect(tip().style.display).toBe("block");
    expect(document.querySelector(".lim-chart .guide")).toBeTruthy();
    expect(document.querySelector(".lim-chart .pick")).toBeTruthy();
    fireEvent.pointerMove(plot(), { clientX: clientX(curve[1]!.t) + 5, clientY: 60 });
    expect(tip().textContent).toBe(say(2));
    fireEvent.pointerLeave(plot());
    expect(tip().style.display).toBe("none");
    expect(document.querySelector(".lim-chart .guide")).toBeNull();
  });

  it("clamps a pointer left of the first point and right of the last", () => {
    draw();
    fireEvent.pointerMove(plot(), { clientX: 0, clientY: 60 });
    expect(tip().textContent).toBe(say(0));
    fireEvent.pointerMove(plot(), { clientX: 419, clientY: 60 });
    expect(tip().textContent).toBe(say(3));
  });

  it("does not announce pointer moves", () => {
    draw();
    fireEvent.pointerMove(plot(), { clientX: 100, clientY: 60 });
    expect(document.querySelector("[aria-live]")!.textContent).toBe("");
  });

  it("reads now on focus, steps with the arrows, jumps with Home and End, and clears on Escape and blur", () => {
    const g = draw()!, live = () => document.querySelector("[aria-live]")!.textContent;
    act(() => g.focus());
    expect(tip().textContent).toBe(say(1));
    expect(live()).toBe(say(1));
    fireEvent.keyDown(g, { key: "ArrowRight" });
    expect(tip().textContent).toBe(say(2));
    expect(tip().textContent).toMatch(/forecast 50% \(45–60%\)$/);
    expect(live()).toBe(say(2));
    fireEvent.keyDown(g, { key: "End" });
    expect(tip().textContent).toBe(say(3));
    fireEvent.keyDown(g, { key: "ArrowRight" });
    expect(tip().textContent).toBe(say(3)); // stays on the last point
    fireEvent.keyDown(g, { key: "Home" });
    expect(tip().textContent).toBe(say(0));
    fireEvent.keyDown(g, { key: "ArrowLeft" });
    expect(tip().textContent).toBe(say(0));
    fireEvent.keyDown(g, { key: "ArrowRight" });
    expect(tip().textContent).toBe(say(1));
    fireEvent.keyDown(g, { key: "Escape" });
    expect(tip().style.display).toBe("none");
    expect(live()).toBe("");
    fireEvent.keyDown(g, { key: "ArrowLeft" }); // reading again starts from now
    expect(tip().textContent).toBe(say(0));
    act(() => g.blur());
    expect(tip().style.display).toBe("none");
  });

  it("reads measured and estimated points by their own flag", () => {
    const g = draw()!;
    act(() => g.focus());
    fireEvent.keyDown(g, { key: "Home" });
    expect(tip().textContent).toMatch(/ · 40% · measured$/);
    fireEvent.keyDown(g, { key: "ArrowRight" });
    expect(tip().textContent).toMatch(/ · 42% · estimated$/);
  });

  it("draws the last-24-hours line only when asked and the curve carries it, and reads it in the tooltip only then", () => {
    const withRecent = { ...w, forecast: { ...w.forecast!, curve: curve.map((p, i) => ({ ...p, recent: 42 + i * 29 })) } };
    renderApp(<LimitChart w={w} now="2026-11-07T11:00:00.000Z" events={[]} recent />);
    expect(document.querySelector(".lim-chart .recent")).toBeNull(); // asked, but no scenario
    cleanup();
    let g = draw(withRecent)!; // a scenario, not asked
    expect(document.querySelector(".lim-chart .recent")).toBeNull();
    act(() => g.focus());
    fireEvent.keyDown(g, { key: "End" });
    expect(tip().textContent).toMatch(/forecast 58%$/);
    cleanup();
    renderApp(<LimitChart w={withRecent} now="2026-11-07T11:00:00.000Z" events={[]} recent />);
    g = screen.getByRole("group");
    expect(document.querySelectorAll(".lim-chart .recent")).toHaveLength(1);
    act(() => g.focus());
    fireEvent.keyDown(g, { key: "End" });
    expect(tip().textContent).toBe(readText(readPoints(withRecent).at(-1)!, true));
    expect(tip().textContent).toMatch(/forecast 58% · last 24 h pace 100%$/);
    expect(plot().getAttribute("aria-label")).not.toMatch(/last 24/);
  });

  it("ends at the last past point without a forecast", () => {
    const g = draw({ ...w, forecast: null })!;
    act(() => g.focus());
    fireEvent.keyDown(g, { key: "End" });
    expect(tip().textContent).toBe(say(1));
    expect(tip().textContent).not.toMatch(/forecast/);
  });

  it("has no readout and no tab stop when there is nothing to read", () => {
    const g = draw({ ...w, series: [], forecast: null });
    expect(g).toBeNull();
    expect(screen.getByRole("img")).toBeTruthy();
    fireEvent.pointerMove(plot(), { clientX: 100, clientY: 60 });
    expect(document.querySelector(".tip")).toBeNull();
  });

  it("keeps what the pointer shows when a click or tap focuses the chart, and announces nothing", () => {
    const g = draw()!, live = () => document.querySelector("[aria-live]")!.textContent;
    fireEvent.pointerMove(plot(), { clientX: clientX(past[0]!.t), clientY: 60 });
    fireEvent.pointerDown(plot());
    act(() => g.focus());
    expect(tip().textContent).toBe(say(0));
    expect(live()).toBe("");
    fireEvent.keyDown(g, { key: "ArrowRight" }); // keys go on from the point shown
    expect(tip().textContent).toBe(say(1));
    expect(live()).toBe(say(1));
  });

  it("reads now on keyboard focus even after an earlier click", () => {
    const g = draw()!;
    fireEvent.pointerDown(plot());
    act(() => g.focus());
    act(() => g.blur());
    act(() => g.focus());
    expect(tip().textContent).toBe(say(1));
  });

  it("does not let a cancelled pointer (a touch scroll) suppress the next keyboard focus", () => {
    const g = draw()!, live = () => document.querySelector("[aria-live]")!.textContent;
    fireEvent.pointerDown(plot());
    fireEvent.pointerCancel(plot()); // the browser took the touch for a scroll: no focus follows
    act(() => g.focus());
    expect(tip().textContent).toBe(say(1));
    expect(live()).toBe(say(1));
  });

  it("leaves modified keys to the browser and the readout alone", () => {
    const g = draw()!;
    act(() => g.focus());
    for (const init of [{ key: "ArrowLeft", altKey: true }, { key: "Home", ctrlKey: true }, { key: "End", metaKey: true }, { key: "ArrowRight", shiftKey: true }]) {
      expect(fireEvent.keyDown(g, init)).toBe(true); // true: not default-prevented
      expect(tip().textContent).toBe(say(1));
    }
    expect(fireEvent.keyDown(g, { key: "ArrowRight" })).toBe(false); // a plain key is ours
  });
});

describe("LimitChart encodings", () => {
  const now = "2026-11-07T11:00:00.000Z";
  const path = (cls: string) => document.querySelector(`.lim-chart .${cls}`);

  it("draws the line, the cone, now and the safe pace, with no reading dots", () => {
    draw({ ...w, current: 42, at_limit: false });
    for (const cls of ["meas-one", "est", "band", "fc", "now", "safe"]) expect(path(cls)).toBeTruthy(); // one measured reading: a mark, not a line
    expect(document.querySelector(".lim-chart circle.dot")).toBeNull();
    // The safe pace runs from now at 42% (x 191.8 of 36 + 11/24 of 374; y 12 + 132 * .58) to 100% at the reset (the plot's top right).
    expect(path("safe")!.getAttribute("d")).toBe(`M${(36 + 374 * 11 / 24).toFixed(1)},${(12 + 132 * 0.58).toFixed(1)}L410.0,12.0`);
  });

  it("draws an estimate between two readings dashed, with no solid line over it", () => {
    const t = (h: number) => `2026-11-07T${String(h).padStart(2, "0")}:00:00.000Z`;
    const series = [{ t: t(8), pct: 10, measured: true }, { t: t(9), pct: 20, measured: true }, { t: t(10), pct: 25, measured: false },
      { t: t(11), pct: 40, measured: true }];
    const { runs, lone } = percentRuns(series);
    expect(runs.map(r => [r.meas, r.map(p => p.pct)])).toEqual([[true, [10, 20]], [false, [20, 25, 40]]]);
    expect(lone.map(p => p.pct)).toEqual([40]); // its only neighbour is an estimate: a mark
    draw({ ...w, series });
    const d = (cls: string) => [...document.querySelectorAll(`.lim-chart .${cls}`)].map(e => e.getAttribute("d")!.split(/[ML]/).length - 1);
    expect(d("meas")).toEqual([2]); // 10 to 20, not 20 to 40
    expect(d("est")).toEqual([3]);
    expect(document.querySelectorAll(".lim-chart .meas-one")).toHaveLength(1);
  });

  it("tints the cone when its high bound reaches 100% before the reset, and not otherwise", () => {
    draw({ ...w, at_limit: false, forecast: { ...w.forecast!, hits_at_early: "2026-11-07T20:00:00.000Z" } });
    expect(path("band")!.classList.contains("warn")).toBe(true);
    expect(path("fc")!.classList.contains("warn")).toBe(true);
    cleanup();
    draw({ ...w, at_limit: false, forecast: { ...w.forecast!, hits_at: null, hits_at_early: null } });
    expect(path("band")!.classList.contains("warn")).toBe(false);
  });

  it("has no safe pace at the limit, and says the paces in its name", () => {
    draw({ ...w, at_limit: true });
    expect(path("safe")).toBeNull();
    cleanup();
    draw({ ...w, at_limit: false, window_minutes: 10080, forecast: { ...w.forecast!, pace_now: 18, pace_target: 7, pace: "ahead" } });
    expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(/Forecast pace 18%\/d, safe pace 7%\/d, running hot\.$/);
  });

  it("marks a plan change with a short labelled tick at the top, not a line across the plot", () => {
    renderApp(<LimitChart w={w} now={now} events={[{ kind: "plan_change", provider: w.provider, at: "2026-11-07T06:00:00.000Z", plan_from: "plus", plan_to: "max/default_claude_max_20x" }]} />);
    const tick = document.querySelector(".lim-chart .plan line")!;
    expect(Number(tick.getAttribute("y2")) - Number(tick.getAttribute("y1"))).toBe(8);
    expect(document.querySelector(".lim-chart .plan text")!.textContent).toBe("plan: max 20x");
  });
});

describe("LimitChart tooltip placement", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps a long tooltip inside the chart box", () => {
    // A 200px-wide box whose tooltip is 320px wide (as if its text did not wrap), read from the middle of the plot.
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ left: 10, top: 10, right: 210, bottom: 178, width: 200, height: 168, x: 10, y: 10, toJSON: () => ({}) });
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(320);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(20);
    draw();
    fireEvent.pointerMove(plot(), { clientX: 110, clientY: 14 });
    expect(tip().style.left).toBe("0px");
    expect(tip().style.top).toBe("0px");
  });
});

describe("LimitChart for a closed window", () => {
  const row = { ...(limits as LimitsPayload).history[0]!, start: "2026-11-07T00:00:00.000Z", closed_at: "2026-11-07T12:00:00.000Z", final: 42, hit: false, estimated: false };
  const closed = closedWindow(row, past);
  const events = [{ kind: "plan_change" as const, provider: row.provider, at: "2026-11-07T06:00:00.000Z", plan_from: "plus", plan_to: "prolite" }];
  const drawClosed = () => { renderApp(<LimitChart w={closed} now={null} events={events} />); return screen.getByRole("group"); };

  it("has no now line, no safe pace and no forecast, and ends at its close", () => {
    drawClosed();
    expect(document.querySelector(".lim-chart .now")).toBeNull();
    expect(document.querySelector(".lim-chart .safe")).toBeNull();
    expect(document.querySelector(".lim-chart .fc")).toBeNull();
    expect(document.querySelector(".lim-chart .band")).toBeNull();
    expect(plot().textContent).toMatch(/ended /);
    expect(plot().textContent).not.toMatch(/resets /);
  });

  it("says what it ended at, and marks the plan change inside it", () => {
    drawClosed();
    expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(/^Codex weekly: 42% used when it ended .*\. Plan change from plus to prolite, /);
    expect(document.querySelectorAll(".lim-chart .plan")).toHaveLength(1);
  });

  it("reads its points from the keyboard, starting at the last", () => {
    const g = drawClosed(), pts = readPoints(closed);
    act(() => g.focus());
    expect(tip().textContent).toBe(readText(pts.at(-1)!));
    fireEvent.keyDown(g, { key: "Home" });
    expect(tip().textContent).toBe(readText(pts[0]!));
  });
});
