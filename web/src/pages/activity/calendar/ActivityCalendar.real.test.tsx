import { waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { CalendarPayload, DailyWorkRow, Day } from "../../../api";
import { renderApp } from "../../../testing";
import { ActivityCalendar } from "./ActivityCalendar";
import { calendarFit, calendarModel } from "./calendarDays";

// The calendar's one test on real ECharts (graph-activity-calendar, step 2.4): every other test draws on the fake runtime
// from test-setup, which draws nothing. It checks that the option is one ECharts 6 accepts and draws: a cell per readable
// day at the fit's pixels in the model's shade, the labels, the selection's frame, a redraw for newer figures that leaves no
// path behind, the forced-colors squares, and an unmount that takes the drawing with it. test-setup fails a test on any
// console error or warning, so none is logged.
vi.unmock("../../../components/echart/load");

// jsdom resolves no var(), so every token would compute to black. The color probe answers each token with an rgb() of its
// own, which the drawing's fills and strokes can be told apart by.
const rgb = new Map<string, string>();
const resolved = (token: string) => {
  if (!rgb.has(token)) rgb.set(token, `rgb(${rgb.size + 1}, 100, 200)`);
  return rgb.get(token)!;
};
/** The token a drawn color resolved from; "none" for no paint. */
const tokenOf = (c: string | null) => (c === "none" ? c : [...rgb].find(([, v]) => v === c)?.[0]);

const row = (day: Day, commits: number): DailyWorkRow => ({ day, sessions: 1, prompts: commits, commits, calls: 0, failed_calls: 0 });
// 53 weeks to Wednesday, Nov 18, 2026, recorded from Tuesday, Sep 1: a 343px box shows the newest 26 weeks, from May 25,
// so the cells start in the 15th column. Five days of commits cut at 5, 8 and 40, three shades.
const d: CalendarPayload = {
  project: "", automated: false, source: "", start: "2025-11-17", end: "2026-11-18", first: "2026-09-01",
  days: [row("2026-09-01", 1), row("2026-10-06", 2), row("2026-11-10", 8), row("2026-11-12", 5), row("2026-11-18", 40)],
};
const WIDTH = 343;

const plot = () => document.querySelector<HTMLElement>(".echart-plot")!;
/** A path's box: ECharts' SVG renderer writes a rect as M, then l moves. */
function box(d: string) {
  const xs: number[] = [], ys: number[] = [];
  let x = 0, y = 0;
  for (const [, c, args] of d.matchAll(/([MlZ])([^MlZ]*)/g)) {
    const n = (args!.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    if (c === "M") [x, y] = [n[0]!, n[1]!];
    else if (c === "l") [x, y] = [x + n[0]!, y + n[1]!];
    else continue;
    xs.push(x); ys.push(y);
  }
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}
/** Every drawn path, as its fill's and stroke's tokens with its box. */
const paths = () => [...plot().querySelectorAll("svg path")].map(p =>
  ({ fill: tokenOf(p.getAttribute("fill")), stroke: tokenOf(p.getAttribute("stroke")), ...box(p.getAttribute("d")!) }));
const filled = () => paths().filter(p => p.fill !== "none");
const at = (x: number, y: number) => paths().filter(p => p.x === x && p.y === y);
const texts = () => [...plot().querySelectorAll("svg text")].map(t => t.textContent);

beforeEach(() => {
  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((el: Element, pseudo?: string | null) => {
    if (!(el instanceof HTMLElement) || el.dataset.chartProbe === undefined) return real(el, pseudo);
    return { color: resolved(/;color:(.*)$/.exec(el.getAttribute("style") ?? "")![1]!) } as CSSStyleDeclaration;
  });
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(WIDTH);
});

const calendar = (x: CalendarPayload) =>
  <ActivityCalendar d={x} metric="commits" range={30} selected={{ day: "2026-11-12", days: 1 }} onPick={() => {}} onClear={() => {}} />;
/** The drawn fill at each readable day's cell, against the model's shade for it: the grid ink for none of the measure. */
const shades = (x: CalendarPayload) => {
  const fit = calendarFit(WIDTH, 1), m = calendarModel(x, "commits", fit.weeks, null);
  const drawn = new Map(filled().map(p => [`${p.x} ${p.y}`, p.fill]));
  const cells = m.days.map(c => `${fit.left + c.col * fit.pitch} ${fit.top + c.row * fit.pitch}`);
  return {
    drawn: cells.map(k => drawn.get(k)),
    model: m.days.map(c => (c.shade ? `var(--heat-${c.shade})` : "var(--grid)")),
  };
};

it("draws a cell per readable day in its shade, the labels and the selection, redraws newer figures with no stale path, and unmount removes the svg", async () => {
  const { rerender, unmount } = renderApp(calendar(d));
  // Sep 1 to Nov 18: 79 readable days. The first import of ECharts in a cold worker can take over a second.
  await waitFor(() => expect(filled()).toHaveLength(79), { timeout: 5000 });

  // The first cell, Tuesday Sep 1, in the 15th column; the last, today, in the 26th: 10px squares on a 12px pitch from 30px
  // left and 18px down.
  expect(filled()[0]).toMatchObject({ x: 198, y: 30, w: 10, h: 10 });
  expect(filled().at(-1)).toMatchObject({ x: 330, y: 42, w: 10, h: 10 });

  // Each cell in the model's shade, of the empty ink and three shades.
  const { drawn, model } = shades(d);
  expect(drawn).toEqual(model);
  expect(new Set(drawn)).toEqual(new Set(["var(--grid)", "var(--heat-1)", "var(--heat-3)", "var(--heat-4)"]));

  // The weekday labels and the month labels of the cells' weeks.
  expect(texts()).toEqual(expect.arrayContaining(["Mon", "Wed", "Fri", "Sep", "Oct", "Nov"]));

  // Thursday Nov 12 selected: one unfilled frame in the accent, inside its cell at (318, 54).
  const frame = paths().filter(p => p.stroke);
  expect(frame).toHaveLength(1);
  expect(frame[0]).toMatchObject({ fill: "none", stroke: "var(--accent)" });
  const f = frame[0]!;
  expect([f.x >= 318, f.y >= 54, f.x + f.w <= 328, f.y + f.h <= 64]).toEqual([true, true, true, true]);

  // Newer figures: idle Tuesday Nov 17 has 3 commits. Its cell takes its shade, the rest the new scale's, and no path of
  // the old drawing is left behind.
  const newer = { ...d, days: [...d.days.slice(0, -1), row("2026-11-17", 3), d.days.at(-1)!] };
  rerender(calendar(newer));
  await waitFor(() => expect(at(330, 30)[0]?.fill).toBe("var(--heat-1)"));
  expect(shades(newer).drawn).toEqual(shades(newer).model);
  expect(at(330, 30)).toHaveLength(1);
  expect(paths()).toHaveLength(79 + 1);

  const drawing = plot();
  unmount();
  expect(drawing.querySelector("svg")).toBeNull();
});

it("draws the shades as squares of the text color under forced colors, and an empty day as an unfilled square", async () => {
  vi.spyOn(window, "matchMedia").mockImplementation(q =>
    ({ matches: q === "(forced-colors: active)", media: q, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);
  renderApp(calendar(d));
  await waitFor(() => expect(paths().length).toBeGreaterThan(79), { timeout: 5000 });

  // Wednesday Sep 2 has none: a 9px square edged in GrayText, half a pixel in.
  expect(at(198.5, 42.5)).toEqual([{ fill: "none", stroke: "GrayText", x: 198.5, y: 42.5, w: 9, h: 9 }]);
  // Sep 1 is the lightest step and today the darkest: centred squares in CanvasText, 3px and 10px.
  const step = (x: number, y: number) => filled().find(p => p.x >= x && p.y >= y && p.x + p.w <= x + 10 && p.y + p.h <= y + 10);
  expect(step(198, 30)).toMatchObject({ fill: "CanvasText", w: 3, h: 3 });
  expect(step(330, 42)).toMatchObject({ fill: "CanvasText", w: 10, h: 10 });
});
