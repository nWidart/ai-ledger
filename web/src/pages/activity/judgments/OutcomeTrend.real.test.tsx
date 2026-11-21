import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { TrendWeek } from "../../../api";
import { renderApp } from "../../../testing";
import { OutcomeTrend } from "./OutcomeTrend";
import { TREND_PARTS } from "./figures";

// The outcome trend's one test on real ECharts (echart-activity, decision 11): every other test draws on the fake runtime
// from test-setup. It checks that the option is one ECharts accepts and draws: a bar per week in the parts' colors, half
// width for a week of few sessions, the counts over the bars, one band for a key's reading, a redraw that leaves no path
// of the old figures, and an unmount that takes the drawing with it.
vi.unmock("../../../components/echart/load");

// jsdom resolves no var(), so every token would compute to black. The color probe answers each token with an rgb() of its
// own, which the drawing's fills can be told apart by.
const rgb = new Map<string, string>();
const resolved = (token: string) => {
  if (!rgb.has(token)) rgb.set(token, `rgb(${rgb.size + 1}, 100, 200)`);
  return rgb.get(token)!;
};

const week = (day: string, fully: number, mostly: number, partially: number, not_achieved: number, other = 0): TrendWeek =>
  ({ week: day, n: fully + mostly + partially + not_achieved + other, achieved: fully + mostly, fully, mostly, partially, not_achieved });
// 12 sessions, then 3 (few), then 8 with one of no clear outcome: the five parts between them.
const trend = [week("2026-10-19", 7, 2, 2, 1), week("2026-10-26", 1, 0, 1, 1), week("2026-11-02", 4, 2, 1, 0, 1)];
// Newer figures for the same weeks: the session of no clear outcome is now mostly achieved.
const newer = [trend[0]!, trend[1]!, week("2026-11-02", 4, 3, 1, 0)];

const plot = () => document.querySelector<HTMLElement>(".echart-plot")!;
const PARTS: string[] = TREND_PARTS.map(p => p.c);

/** A filled path's box: ECharts' SVG renderer writes a rect as M, then l moves, and a rounded top with L and A. */
function box(d: string) {
  const xs: number[] = [], ys: number[] = [];
  let x = 0, y = 0;
  for (const [, c, args] of d.matchAll(/([MLlAZ])([^MLlAZ]*)/g)) {
    const n = (args!.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    if (c === "M" || c === "L") [x, y] = [n[0]!, n[1]!];
    else if (c === "l") [x, y] = [x + n[0]!, y + n[1]!];
    else if (c === "A") [x, y] = [n[5]!, n[6]!];
    else continue;
    xs.push(x); ys.push(y);
  }
  return { left: Math.min(...xs), width: Math.max(...xs) - Math.min(...xs) };
}
/** The drawn parts, as the token each one resolved from, with its box. */
const parts = () => {
  const names = new Map([...rgb].map(([token, c]) => [c, token]));
  return [...plot().querySelectorAll("svg path")].flatMap(p => {
    const token = names.get(p.getAttribute("fill") ?? "");
    return token && PARTS.includes(token) ? [{ token, ...box(p.getAttribute("d")!) }] : [];
  });
};
/** Each bar's width, left to right: the parts that share a left edge are one bar. */
const barWidths = () => {
  const bars = new Map<number, number>();
  for (const p of parts()) bars.set(Math.round(p.left), p.width);
  return [...bars].sort(([a], [b]) => a - b).map(([, w]) => w);
};

/** The reading band: the cursor ink (the text color) at 6%, which the renderer writes as rgb() with no spaces and a fill
 *  opacity. */
const band = () => {
  const text = rgb.get("var(--text-primary)")!.replaceAll(" ", "");
  return [...plot().querySelectorAll("svg path")].filter(p => p.getAttribute("fill") === text && p.getAttribute("fill-opacity") === "0.06");
};
/** Right on the focused chart: it reads the first week. */
const readFirst = () => {
  const group = screen.getByRole("group", { name: /^Outcome mix per week/ });
  act(() => group.focus());
  fireEvent.keyDown(group, { key: "ArrowRight" });
};

let errors: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((el: Element, pseudo?: string | null) => {
    if (!(el instanceof HTMLElement) || el.dataset.chartProbe === undefined) return real(el, pseudo);
    return { color: resolved(/;color:(.*)$/.exec(el.getAttribute("style") ?? "")![1]!) } as CSSStyleDeclaration;
  });
  errors = vi.spyOn(console, "error");
});

it("draws a bar per week in the parts' colors, the counts, one band, newer figures with no stale path, and unmount removes the svg", async () => {
  const { rerender, unmount } = renderApp(<OutcomeTrend weeks={trend} view="v" />);
  await waitFor(() => expect(new Set(parts().map(p => p.token))).toEqual(new Set(PARTS)));

  // A bar per week, the one of few sessions half as wide as the others.
  const [a, few, c] = barWidths() as [number, number, number];
  expect(barWidths()).toHaveLength(3);
  expect(c).toBeCloseTo(a, 2); // the renderer writes 4 decimals
  expect(few).toBeCloseTo(a / 2, 2);

  // Each week's sessions over its bar.
  const texts = () => [...plot().querySelectorAll("svg text")].map(t => t.textContent);
  expect(texts()).toEqual(expect.arrayContaining(["12", "3", "8"]));

  // Newer figures for the same weeks: the part of no clear outcome is gone, with no path of it left behind.
  rerender(<OutcomeTrend weeks={newer} view="v" />);
  await waitFor(() => expect(parts().some(p => p.token === "var(--proj-other)")).toBe(false));
  expect(barWidths()).toHaveLength(3);
  expect(texts()).toEqual(expect.arrayContaining(["12", "3", "8"]));

  // Right reads the first week: exactly one band.
  expect(band()).toHaveLength(0);
  readFirst();
  await waitFor(() => expect(band()).toHaveLength(1));

  const drawing = plot();
  expect(drawing.querySelector("svg")).not.toBeNull();
  unmount();
  expect(drawing.querySelector("svg")).toBeNull();
  expect(errors).not.toHaveBeenCalled(); // jsdom's "Not implemented" and React's warnings both come through here
});

// A known defect, kept failing on purpose: the axis pointer highlights the bars under it, and the stack's custom series
// leaves ECharts' emphasis on, so the week read is redrawn in lifted colors that no token gives (rgb(8, 100, 200) becomes
// rgb(8,105,210)). When the stack disables its emphasis this test fails: make it a plain `it`.
it.fails("keeps the week read in its parts' colors", async () => {
  const { unmount } = renderApp(<OutcomeTrend weeks={trend} view="v" />);
  await waitFor(() => expect(new Set(parts().map(p => p.token))).toEqual(new Set(PARTS)));
  const before = parts().length;
  readFirst();
  await waitFor(() => expect(band()).toHaveLength(1));
  await new Promise(settled => setTimeout(settled, 100)); // the highlight is drawn on a later frame than the band
  expect(parts()).toHaveLength(before);
  unmount();
});
