import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LimitWindow, LimitsPayload } from "../../api";
import limits from "../../__fixtures__/limits";
import { LimitChart } from "./LimitChart";
import { readPoints, readText } from "./limits";

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
  render(<LimitChart w={win} now="2026-11-07T11:00:00.000Z" events={[]} />);
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

  it("draws the last-24-hours line only when the curve carries it, and reads it in the tooltip", () => {
    draw();
    expect(document.querySelector(".lim-chart .recent")).toBeNull();
    cleanup();
    const withRecent = { ...w, forecast: { ...w.forecast!, curve: curve.map((p, i) => ({ ...p, recent: 42 + i * 29 })) } };
    const g = draw(withRecent)!;
    expect(document.querySelectorAll(".lim-chart .recent")).toHaveLength(1);
    act(() => g.focus());
    fireEvent.keyDown(g, { key: "End" });
    expect(tip().textContent).toBe(readText(readPoints(withRecent).at(-1)!));
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
