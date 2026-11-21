import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { getInstanceByDom } from "echarts/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyWorkRow, UsagePayload } from "../../api";
import usage from "../../__fixtures__/usage";
import { color, setOrder } from "../../colors";
import { dayRange } from "../../format";
import { renderApp } from "../../testing";
import type { WorkMetric } from "./work";
import { WorkPanel } from "./WorkChart";
import { workLayout, workModel, type WorkPick } from "./workTracks";

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
/** A dot's centre: the renderer writes a circle as an arc from its rightmost point, "M x y A r r …". */
const centreX = (e: Element) => {
  const [, x, r] = /^M(-?[\d.]+) -?[\d.]+A([\d.]+)/.exec(e.getAttribute("d") ?? "")!;
  return Number(x) - Number(r);
};
const by = (fill: string, stroke: string) => paths().filter(p => tokenOf(p.getAttribute("fill")) === fill && tokenOf(p.getAttribute("stroke")) === stroke);
const rateLine = () => paths().filter(p => p.getAttribute("fill") === "none" && tokenOf(p.getAttribute("stroke")) === "var(--critical)");
const solid = () => by("var(--critical)", "var(--surface-1)");
const hollow = () => by("var(--surface-1)", "var(--critical)");
/** The reading band: the cursor ink (the text color) at 6%, written as the color and a fill opacity, with no frame. */
const band = () => paths().filter(p => tokenOf(p.getAttribute("fill")) === "var(--text-primary)" && p.getAttribute("fill-opacity") === "0.06");
/** The selection's mark: the accent at 16%, in an accent frame. */
const selection = () => paths().filter(p => tokenOf(p.getAttribute("fill")) === "var(--accent)" && p.getAttribute("fill-opacity") === "0.16"
  && tokenOf(p.getAttribute("stroke")) === "var(--accent)");

beforeEach(() => {
  setOrder(PROJECTS);
  COLORS = PROJECTS.map(color);
  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((el: Element, pseudo?: string | null) => {
    if (!(el instanceof HTMLElement) || el.dataset.chartProbe === undefined) return real(el, pseudo);
    return { color: resolved(/;color:(.*)$/.exec(el.getAttribute("style") ?? "")![1]!) } as CSSStyleDeclaration;
  });
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
  const dotX = centreX(hollow()[0]!);
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
});

// Tool calls on two days next to each other: one line between them, no dot. A zoom that leaves one of them out leaves the
// other alone in the days shown, at either edge of the window: ECharts filters the neighbour out and draws the line as a
// move with no length, so the point is a dot, over its bar.
it("draws a dot on a rate point whose neighbour the zoom leaves out, over its bar, at either edge of the window", async () => {
  const pair = rows.map((r, i) => ({ ...r, ...(i === 11 || i === 12 ? { calls: 100, failed_calls: 3 } : { calls: 0, failed_calls: 0 }) }));
  const { unmount } = renderApp(panel({ ...d, work: pair }));
  await waitFor(() => expect(segments()).toHaveLength(60));
  expect(rateLine()).toHaveLength(1);
  expect(solid()).toHaveLength(0);
  for (const [from, alone] of [[12, 12], [5, 11]] as const) {
    act(() => { getInstanceByDom(plot())!.dispatchAction({ type: "dataZoom", startValue: from, endValue: from + 6 }); });
    // Seven days in the plot's 732px from x 52: the dot over the middle of the day alone.
    const mid = 52 + (alone - from + .5) * 732 / 7;
    await waitFor(() => expect(solid().map(centreX)).toEqual([expect.closeTo(mid, 0)]));
    expect(segments().filter(s => Math.abs(s.cx - mid) <= .5)).toHaveLength(3);
  }
  unmount();
});

// The pointer reads a day through the frame, which spans both tracks and the gap between them: over the bars, the gap and
// the rate track it reads the day under it, with one band; under the frame, over the day labels, it reads nothing. The
// fake runtime has one grid and cannot tell the tracks apart, so this is real ECharts' to show.
it("reads the day under the pointer over the bars, the gap between the tracks and the rate track, and nothing under them", async () => {
  const { unmount } = renderApp(panel(d));
  await waitFor(() => expect(segments()).toHaveLength(60));
  const root = plot().firstElementChild!, tip = () => screen.queryByRole("tooltip");
  // Day 4's middle: the plot's 732px from x 52, in 20 bands. The bars run 20 to 140, the gap to 156, the rate track to 192.
  const x = 52 + 4.5 * 732 / 20;
  const over = (y: number) => act(() => { fireEvent.mouseMove(root, { clientX: x, clientY: y }); });
  for (const y of [80, 148, 174]) {
    over(205); // each from nothing read, so no reading is left over from the one before
    await waitFor(() => expect(tip()).toBeNull());
    await waitFor(() => expect(band()).toHaveLength(0));
    over(y);
    await waitFor(() => expect(tip()?.textContent).toContain("Oct 21, 2026"));
    await waitFor(() => expect(band()).toHaveLength(1));
  }
  unmount();
});

// The selected day, read: its mark keeps the selection's tint and frame. ECharts' pointer highlights the items on the
// axis it reads (axisTrigger.js, dispatchHighDownActually), the frame's: the selection mark is the one series there, and
// a highlight would lift its colors. Two guards stop it, each enough alone: the frame's pointer triggers no highlight
// (`triggerEmphasis: false` in categoryAxis) and the mark has no highlight state (`emphasisDisabled` in selectionMark).
// The bars are on a track's axis, which the pointer never reads, so no highlight reaches them.
it("keeps the selection's colors on the selected day while it is read", async () => {
  const { unmount } = renderApp(panel(d));
  await waitFor(() => expect(segments()).toHaveLength(60));
  expect(selection()).toHaveLength(1);
  act(() => group().focus());
  for (let i = 0; i <= 2; i++) fireEvent.keyDown(group(), { key: "ArrowRight" }); // day 0, 1, then the selected day 2
  await waitFor(() => expect(screen.getByRole("tooltip").textContent).toContain("Oct 19, 2026"));
  await waitFor(() => expect(band()).toHaveLength(1));
  await new Promise(settled => setTimeout(settled, 100)); // the highlight is drawn on a later frame than the band
  expect(selection()).toHaveLength(1);
  unmount();
});

// A chart of several tracks lays out its frame and its tracks by their own places (tracksOption): ECharts' own fit would
// shrink the frame alone, the one grid with visible labels, once its newest label reaches the box's right edge, and the
// band, the selection and the pointer's reading would sit apart from the bars. "Week of …" labels in a phone's width
// reach it, as they do at twice the text size.
describe("by week in a narrow box", () => {
  /** n weeks of work to Monday Nov 16, every week with work; the newest is selected. */
  const weeks = (n: number): UsagePayload => {
    const mondays = dayRange("2025-01-06", "2026-11-16").filter((_, i) => i % 7 === 0).slice(-n);
    const work = mondays.map(day => ({ day, sessions: 3, prompts: 3, commits: 3, calls: 100, failed_calls: 2 }));
    return { ...usage, range: 0, start: null, end: "2026-11-16", project: "", source: "", work_bucket: "week", work, daily_work: work, work_projects: [] };
  };
  const NEWEST: WorkPick = { day: "2026-11-16", week: true };
  const sized = (width: number, fontSize: string) => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width);
    document.documentElement.style.fontSize = fontSize;
  };
  afterEach(() => { document.documentElement.style.fontSize = ""; });

  it.each([
    { n: 11, width: 343, fontSize: "16px" },
    { n: 13, width: 600, fontSize: "32px" },
  ])("keeps the frame's axis on the tracks' axes: $n weeks, $width px, at $fontSize", async ({ n, width, fontSize }) => {
    sized(width, fontSize);
    const { unmount } = renderApp(<WorkPanel d={weeks(n)} metric="commits" onMetric={() => {}} selected={NEWEST} onPick={() => {}} onClear={() => {}} />);
    await waitFor(() => expect(filled("var(--series-1)")).toHaveLength(n));
    const chart = getInstanceByDom(plot())!;
    expect(chart.getWidth()).toBe(width);
    for (const i of [0, n - 1]) {
      const xs = [0, 1, 2].map(a => chart.convertToPixel({ xAxisIndex: a }, i) as number);
      expect(Math.max(...xs) - Math.min(...xs), `point ${i} on x axes 0, 1, 2: ${xs.join(", ")}`).toBeLessThanOrEqual(.5);
    }
    // What the user sees: the newest week's frame around its bar, and its label, which ends inside the box.
    const newest = filled("var(--series-1)").map(p => box(p.getAttribute("d")!)).reduce((a, b) => (b.cx > a.cx ? b : a));
    expect(Math.abs(box(selection()[0]!.getAttribute("d")!).cx - newest.cx)).toBeLessThanOrEqual(.5);
    const label = [...plot().querySelectorAll("svg text")].find(t => t.textContent === "Week of Nov 16")!;
    expect(label.getAttribute("text-anchor")).toBe("end");
    expect(Number(/translate\(([\d.]+)/.exec(label.getAttribute("transform") ?? "")?.[1] ?? label.getAttribute("x"))).toBeLessThanOrEqual(width);
    unmount();
  });

  // The peak label, measured as the browser draws it, by a canvas of 5px a character at 11px ("Peak 9 commits · Week of
  // Sep 28" is 150px; Chromium's real measure of such a label matches its drawn SVG text within 0.02px). Centred over a bar
  // two from either end of the 275px plot, it would leave the plot by 12.5px.
  it.each([...Array(11).keys()])("keeps the peak label inside the plot with the peak at week %d of 11, in 343px", async peak => {
    const per = (t: string, font: string) => t.length * 5 * parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)![1]!) / 11;
    const ctx = { font: "", measureText(t: string) { return { width: per(t, this.font) }; } };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    sized(343, "16px");
    const data = weeks(11);
    data.work = data.work.map((r, i) => ({ ...r, commits: i === peak ? 9 : 3 }));
    data.daily_work = data.work;
    const { unmount } = renderApp(<WorkPanel d={data} metric="commits" onMetric={() => {}} selected={null} onPick={() => {}} onClear={() => {}} />);
    await waitFor(() => expect(filled("var(--series-1)")).toHaveLength(11));
    const text = [...plot().querySelectorAll("svg text")].find(t => t.textContent?.startsWith("Peak "))!;
    expect(text.textContent).toMatch(/^Peak 9 commits · Week of /);
    const x = Number(/translate\(([\d.]+)/.exec(text.getAttribute("transform") ?? "")?.[1] ?? text.getAttribute("x"));
    const w = per(text.textContent!, /font-size:\s*([\d.]+px)/.exec(text.getAttribute("style") ?? "")![1]!);
    const left = x - { start: 0, middle: w / 2, end: w }[text.getAttribute("text-anchor") as "start" | "middle" | "end"];
    const layout = workLayout(workModel(data, "commits", null), 1);
    expect(left, `left end, plot from ${layout.left}px`).toBeGreaterThanOrEqual(layout.left);
    expect(left + w, `right end, plot to ${343 - layout.right}px`).toBeLessThanOrEqual(343 - layout.right);
    // Over its bar or beside it: the peak bar's middle is under the label.
    const bar = filled("var(--series-1)").map(p => box(p.getAttribute("d")!)).sort((a, b) => a.top - b.top)[0]!;
    expect(bar.cx).toBeGreaterThanOrEqual(left);
    expect(bar.cx).toBeLessThanOrEqual(left + w);
    unmount();
  });
});
