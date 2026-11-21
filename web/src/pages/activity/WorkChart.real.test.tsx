import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { DailyWorkRow, UsagePayload } from "../../api";
import usage from "../../__fixtures__/usage";
import { color, setOrder } from "../../colors";
import { dayRange } from "../../format";
import { renderApp } from "../../testing";
import type { WorkMetric } from "./work";
import { WorkPanel } from "./WorkChart";
import type { WorkPick } from "./workTracks";

// The work chart's one test on real ECharts (echart-activity, decision 11): every other test draws on the fake runtime
// from test-setup. It checks that the option is one ECharts accepts and draws: the bars in the projects' colors on one
// track and the rate line with its dots on the other, one band over both tracks for a key's reading, the selection's
// frame apart from it, a zoom that narrows both tracks together, a redraw that leaves no path of the old drawing, and an
// unmount that takes the drawing with it.
vi.unmock("../../components/echart/load");

// jsdom resolves no var(), so every token would compute to black. The color probe answers each token with an rgb() of its
// own, which the drawing's fills and strokes can be told apart by.
const rgb = new Map<string, string>();
const resolved = (token: string) => {
  if (!rgb.has(token)) rgb.set(token, `rgb(${rgb.size + 1}, 100, 200)`);
  return rgb.get(token)!;
};
/** The token a drawn color resolved from: the renderer writes rgb() with or without spaces. */
const tokenOf = (c: string | null) => (c ? [...rgb].find(([, v]) => v === c || v.replaceAll(" ", "") === c)?.[0] : undefined);

// 20 days, three projects with a hue, a commit each a day. Day 15 has few calls (a hollow dot); day 12 has calls between two
// days without (a solid dot); the rest 100 calls. Day 2 is selected.
const PROJECTS = ["foo", "bar", "baz"];
/** The projects' colors, once the order is set (each project's slot comes from its name). */
let COLORS: string[] = [];
const days = dayRange("2026-10-17", "2026-11-05");
const calls = (i: number) => (i === 15 ? { calls: 4, failed_calls: 1 } : i === 11 || i === 13 ? {} : { calls: 100, failed_calls: 2 + i % 3 });
const row = (day: string, i: number): DailyWorkRow => ({ day, sessions: 3, prompts: 3, commits: 3, calls: 0, failed_calls: 0, ...calls(i) });
const rows = days.map(row);
const d: UsagePayload = { ...usage, range: 20, start: days[0]!, end: days.at(-1)!, project: "", source: "", work_bucket: "day", work: rows, daily_work: rows,
  // Every prompt is foo's: by prompts the bars are plain.
  work_projects: rows.flatMap(r => PROJECTS.map((project, j) => ({ ...r, project, sessions: 1, commits: 1, prompts: j ? 0 : 3, calls: 0, failed_calls: 0 }))) };
const idle: UsagePayload = { ...d, work: rows.map(r => ({ ...r, calls: 0, failed_calls: 0 })) };
const SELECTED: WorkPick = { day: days[2]!, week: false };

const panel = (data: UsagePayload, metric: WorkMetric = "commits") =>
  <WorkPanel d={data} metric={metric} onMetric={() => {}} selected={SELECTED} onPick={() => {}} onClear={() => {}} />;
const plot = () => document.querySelector<HTMLElement>("#work .echart-plot")!;
const group = () => screen.getByRole("group", { name: /per day/ });
const paths = () => [...plot().querySelectorAll("svg path")];

/** A path's box: ECharts' SVG renderer writes a rect as M, then l moves, a rounded top with L and A, a circle with A and C. */
function box(dd: string) {
  const xs: number[] = [], ys: number[] = [];
  let x = 0, y = 0;
  for (const [, c, args] of dd.matchAll(/([MLlACZ])([^MLlACZ]*)/g)) {
    const n = (args!.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g) ?? []).map(Number);
    if (c === "M" || c === "L") [x, y] = [n[0]!, n[1]!];
    else if (c === "l") [x, y] = [x + n[0]!, y + n[1]!];
    else if (c === "A") [x, y] = [n[5]!, n[6]!];
    else if (c === "C") [x, y] = [n[4]!, n[5]!];
    else continue;
    xs.push(x); ys.push(y);
  }
  const left = Math.min(...xs), top = Math.min(...ys);
  return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top, cx: (left + Math.max(...xs)) / 2 };
}
const filled = (token: string) => paths().filter(p => tokenOf(p.getAttribute("fill")) === token);
/** The bars' segments, as the project each one is drawn in, with its box. */
const segments = () => paths().flatMap(p => {
  const t = tokenOf(p.getAttribute("fill"));
  return t && COLORS.includes(t) ? [{ token: t, ...box(p.getAttribute("d")!) }] : [];
});
const by = (fill: string, stroke: string) => paths().filter(p => tokenOf(p.getAttribute("fill")) === fill && tokenOf(p.getAttribute("stroke")) === stroke);
const rateLine = () => paths().filter(p => p.getAttribute("fill") === "none" && tokenOf(p.getAttribute("stroke")) === "var(--critical)");
const solid = () => by("var(--critical)", "var(--surface-1)");
const hollow = () => by("var(--surface-1)", "var(--critical)");
/** The reading band: the cursor ink (the text color) at 6%, written as the color and a fill opacity, with no frame. */
const band = () => paths().filter(p => tokenOf(p.getAttribute("fill")) === "var(--text-primary)" && p.getAttribute("fill-opacity") === "0.06");
/** The selection's mark: the accent at 16%, in an accent frame. */
const selection = () => paths().filter(p => tokenOf(p.getAttribute("fill")) === "var(--accent)" && p.getAttribute("fill-opacity") === "0.16"
  && tokenOf(p.getAttribute("stroke")) === "var(--accent)");

let errors: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  setOrder(PROJECTS);
  COLORS = PROJECTS.map(color);
  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((el: Element, pseudo?: string | null) => {
    if (!(el instanceof HTMLElement) || el.dataset.chartProbe === undefined) return real(el, pseudo);
    return { color: resolved(/;color:(.*)$/.exec(el.getAttribute("style") ?? "")![1]!) } as CSSStyleDeclaration;
  });
  errors = vi.spyOn(console, "error");
});
afterEach(() => setOrder([]));

it("draws both tracks, one band over them, the selection apart from it, a zoom of both, redraws with no stale path, and unmount removes the svg", async () => {
  expect(new Set(COLORS).size).toBe(3);
  const { rerender, unmount } = renderApp(panel(d));
  // The bars: 20 days of three projects, in the projects' colors; the rate line and its two dots on the track below.
  await waitFor(() => expect(segments()).toHaveLength(60));
  expect(new Set(segments().map(s => s.token))).toEqual(new Set(COLORS));
  expect(rateLine()).toHaveLength(1);
  expect(hollow()).toHaveLength(1);
  expect(solid()).toHaveLength(1);
  const barsBottom = Math.max(...segments().map(s => s.top + s.height)), line = box(rateLine()[0]!.getAttribute("d")!);
  expect(line.top).toBeGreaterThan(barsBottom); // the rate track is under the bars
  // The selected day: one frame, over the whole height of both tracks, around its bar.
  expect(selection()).toHaveLength(1);
  const frame = box(selection()[0]!.getAttribute("d")!), bar2 = segments().filter(s => Math.abs(s.cx - frame.cx) < 1);
  expect(bar2).toHaveLength(3);
  expect(frame.top).toBeLessThanOrEqual(Math.min(...segments().map(s => s.top)) + 1);
  expect(frame.top + frame.height).toBeGreaterThanOrEqual(line.top + line.height - 1);

  // Right reads the first day: exactly one band, from the top of the bars to the bottom of the rate track, not the frame.
  expect(band()).toHaveLength(0);
  act(() => group().focus());
  fireEvent.keyDown(group(), { key: "ArrowRight" });
  await waitFor(() => expect(band()).toHaveLength(1));
  const b = box(band()[0]!.getAttribute("d")!);
  // The frame is inset by half its line.
  expect(Math.abs(b.top - frame.top)).toBeLessThanOrEqual(1);
  expect(Math.abs(b.top + b.height - (frame.top + frame.height))).toBeLessThanOrEqual(1);
  expect(b.cx).toBeLessThan(frame.cx); // day 0, left of the selected day 2
  expect(selection()).toHaveLength(1);
  expect(band()[0]!.getAttribute("stroke")).not.toBe(selection()[0]!.getAttribute("stroke"));
  fireEvent.keyDown(group(), { key: "Escape" });
  await waitFor(() => expect(band()).toHaveLength(0));

  // 20 days draw the slider: its two handles, solid in the accent.
  expect(by("var(--accent)", "var(--accent)").filter(p => !p.hasAttribute("fill-opacity"))).toHaveLength(2);
  // Plus with nothing read: the newest ten days. Both tracks zoomed: the hollow dot (day 15) is still over the middle of
  // its bar; the selected day 2 is left out, and so is its frame.
  fireEvent.keyDown(group(), { key: "+" });
  await waitFor(() => expect(segments()).toHaveLength(30));
  // A symbol is a unit circle, placed by its transform: matrix(sx, 0, 0, sy, x, y).
  const dotX = Number(/matrix\(([^)]*)\)/.exec(hollow()[0]!.getAttribute("transform")!)![1]!.split(",")[4]);
  const under = segments().filter(s => s.left <= dotX && s.left + s.width >= dotX);
  expect(under).toHaveLength(3);
  expect(Math.abs(under[0]!.cx - dotX)).toBeLessThanOrEqual(.5);
  expect(selection()).toHaveLength(0);

  // Prompts are foo's alone: plain bars in the first series color, with no project's path left, every day shown again.
  rerender(panel(d, "prompts"));
  await waitFor(() => expect(filled("var(--series-1)")).toHaveLength(20));
  expect(segments()).toHaveLength(0);

  // A payload without tool calls: no rate track, no dot.
  rerender(panel(idle, "prompts"));
  await waitFor(() => expect(rateLine()).toHaveLength(0));
  expect(hollow()).toHaveLength(0);
  expect(solid()).toHaveLength(0);
  expect(filled("var(--series-1)")).toHaveLength(20);

  const drawing = plot();
  expect(drawing.querySelector("svg")).not.toBeNull();
  unmount();
  expect(drawing.querySelector("svg")).toBeNull();
  expect(errors).not.toHaveBeenCalled(); // jsdom's "Not implemented" and React's warnings both come through here
});

// The outcome trend's known defect (the axis pointer lifts the colors of the bar under it, since the stack leaves ECharts'
// emphasis on) does not show here: the pointer is the frame's axis, and the stack sits on a track's, so it is not lifted.
it("keeps the day read in its projects' colors", async () => {
  const { unmount } = renderApp(panel(d));
  await waitFor(() => expect(segments()).toHaveLength(60));
  act(() => group().focus());
  fireEvent.keyDown(group(), { key: "ArrowRight" });
  await waitFor(() => expect(band()).toHaveLength(1));
  await new Promise(settled => setTimeout(settled, 100)); // the highlight is drawn on a later frame than the band
  expect(segments()).toHaveLength(60);
  unmount();
});
