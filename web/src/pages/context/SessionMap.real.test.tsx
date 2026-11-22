import { fireEvent, screen, waitFor } from "@testing-library/react";
import { getInstanceByDom } from "echarts/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SessionPoint } from "../../api";
import { color, setOrder } from "../../colors";
import { box, probeColors, tokenOf } from "../../components/echart/realTesting";
import { renderApp } from "../../testing";
import { QUADS, short, type Quad } from "./context";
import { mapFit, mapModel } from "./mapDots";
import { SessionMap } from "./SessionMap";

// The session map's test on real ECharts (echart-context, decision 12): every other test draws on the fake runtime, which
// draws nothing, and mapDots.test.ts proves the fit and the option on their own. This one looks at what only a drawing
// shows: ECharts places every dot at the fit's pixel on its log axis, in any box; the ticks, lines, labels and names are
// drawn; the wash, the grid lines, the frame and the dots paint in order; the dots keep their projects' colors; the pointer's
// ring needs no new drawing. Text widths are the browser check's: jsdom has no layout.
vi.unmock("../../components/echart/load");

// 40 sessions from Oct 1, one an hour, starts from 3k to 150k on a log spread, peaks over the whole window; 6 compacted.
// Session 30's peak is over its window: drawn at 100%.
const pt = (i: number): SessionPoint => ({
  session_id: `s${String(i).padStart(10, "0")}`, project: i % 2 ? "bar" : "foo", source: "claude",
  first_ts: new Date(Date.UTC(2026, 9, 1, i)).toISOString(), start: Math.round(3000 * 50 ** (i / 39)),
  peak: i === 30 ? 230_000 : Math.round(200_000 * (((i * 7) % 40) / 40 + .02)), window: 200_000, turns: 8, compactions: i % 7 === 3 ? 1 : 0, title: null,
});
const points = Array.from({ length: 40 }, (_, i) => pt(i));
/** The named dots: the lowest start (foo), one in the middle (bar), the peak over its window (foo). */
const NAMED = [0, 21, 30];
const model = mapModel(points);

const map = (quad: Quad | null) => <SessionMap view="v" map={{ total: 40, points }} quad={quad} onQuad={() => {}} />;
const plot = () => document.querySelector<HTMLElement>(".echart-plot")!;
/** The drawn paths, in paint order, not the clip paths' defs. */
const paths = () => [...plot().querySelectorAll("svg path")].filter(p => !p.closest("clipPath"));
/** A circle's centre and radius: the renderer writes it as an arc from its rightmost point, "M x y A r r …". */
const circles = () => paths().flatMap(el => {
  const m = /^M(-?[\d.]+) (-?[\d.]+)A([\d.]+)/.exec(el.getAttribute("d")!);
  return m ? [{ el, x: Number(m[1]) - Number(m[3]), y: Number(m[2]), r: Number(m[3]) }] : [];
});
const dots = () => circles().filter(c => c.r === 4);
const rings = () => circles().filter(c => c.r === 7.5);
const texts = () => [...plot().querySelectorAll("svg text")].map(t => t.textContent);
const stroked = (token: string) => paths().filter(p => tokenOf(p.getAttribute("stroke")) === token && !circles().some(c => c.el === p));
/** The drawn dot of session i, where the fit puts it in a box `width` px wide at text scale s. */
const dotOf = (i: number, width: number, s: number) => {
  const d = mapFit(model, width, s, () => 0).dots[model.points.findIndex(p => p.session_id === pt(i).session_id)]!;
  const near = dots().filter(c => Math.hypot(c.x - d.x, c.y - d.y) <= .5);
  expect(near, `session ${i}'s dot at ${d.x}, ${d.y}`).toHaveLength(1);
  return { ...near[0]!, fit: d };
};
const drawn = () => waitFor(() => expect(dots()).toHaveLength(40), { timeout: 5000 });

beforeEach(() => { probeColors(); setOrder(["foo", "bar"]); });
afterEach(() => { setOrder([]); document.documentElement.style.fontSize = ""; });

it("draws every dot at the fit's pixel with the ticks, lines and names, washes the selected quadrant, and reads with no new drawing", async () => {
  const { rerender, unmount } = renderApp(map(null));
  await drawn();
  expect(rings()).toHaveLength(6);
  // Each named dot in its project's color: two projects, two fills.
  const fills = NAMED.map(i => tokenOf(dotOf(i, 800, 1).el.getAttribute("fill")));
  expect(fills).toEqual([color("foo"), color("bar"), color("foo")]);
  // The x labels at 1, 2 and 5 times a power of ten; both lines, their labels, the names and the axis titles.
  expect(texts()).toEqual(expect.arrayContaining(["2k", "5k", "10k", "20k", "50k", "100k", "200k", "30k start", "80% of window", ...QUADS.map(q => q.label),
    "Starting context (tokens, log scale)", "Peak share of the window"]));
  expect(paths().filter(p => p.getAttribute("stroke-dasharray") === "5,4")).toHaveLength(2);
  expect(paths().filter(p => tokenOf(p.getAttribute("fill")) === "var(--surface-2)")).toHaveLength(0);

  // Heavy and full selected: its wash, under the grid lines; the dots outside it at 20%, their rings too.
  rerender(map("both"));
  await waitFor(() => expect(paths().filter(p => tokenOf(p.getAttribute("fill")) === "var(--surface-2)")).toHaveLength(1));
  const wash = paths().find(p => tokenOf(p.getAttribute("fill")) === "var(--surface-2)")!, grid = stroked("var(--grid)");
  expect(grid).not.toHaveLength(0);
  expect(paths().indexOf(wash)).toBeLessThan(paths().indexOf(grid[0]!));
  const w = box(wash.getAttribute("d")!), inWash = (c: { x: number; y: number }) => c.x >= w.left && c.x <= w.left + w.width && c.y >= w.top && c.y <= w.top + w.height;
  expect(dots().filter(c => c.el.getAttribute("stroke-opacity") !== "0.2").map(inWash)).toEqual(Array(model.counts.both).fill(true));
  expect(dots().filter(c => c.el.getAttribute("stroke-opacity") === "0.2").map(inWash)).toEqual(Array(40 - model.counts.both).fill(false));
  expect(rings().filter(c => !inWash(c)).every(c => c.el.getAttribute("stroke-opacity") === "0.2")).toBe(true);

  // The pointer on session 21's dot: the ring around it and the tooltip, and the drawing as it was.
  const draw = vi.spyOn(getInstanceByDom(plot())!, "setOption"), at = dotOf(21, 800, 1).fit;
  fireEvent.mouseMove(plot().querySelector("svg")!, { clientX: at.x, clientY: at.y });
  expect(screen.getByRole("tooltip").textContent).toContain(`Starting context${short(pt(21).start)}`);
  const mark = document.querySelector(".map-mark circle")!;
  expect([mark.getAttribute("cx"), mark.getAttribute("cy")]).toEqual([String(at.x), String(at.y)]);
  expect(draw).not.toHaveBeenCalled();

  const drawing = plot();
  unmount();
  expect(drawing.querySelector("svg")).toBeNull();
});

it("edges the dots and draws the rings in the text ink under forced colors, with the frame over the grid lines and under the dots", async () => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q === "(forced-colors: active)", media: q, addEventListener() {}, removeEventListener() {} }));
  try {
    renderApp(map("both"));
    await drawn();
    expect(new Set(dots().map(c => tokenOf(c.el.getAttribute("stroke"))))).toEqual(new Set(["CanvasText"]));
    expect(new Set(rings().map(c => tokenOf(c.el.getAttribute("stroke"))))).toEqual(new Set(["CanvasText"]));
    const frame = paths().filter(p => tokenOf(p.getAttribute("stroke")) === "Highlight" && p.getAttribute("stroke-width") === "2");
    expect(frame).toHaveLength(1);
    const i = paths().indexOf(frame[0]!), grid = stroked("GrayText");
    expect(grid).not.toHaveLength(0);
    expect(Math.max(...grid.map(p => paths().indexOf(p)))).toBeLessThan(i);
    expect(i).toBeLessThan(Math.min(...circles().map(c => paths().indexOf(c.el))));
  } finally {
    vi.unstubAllGlobals();
  }
});

// ECharts' pixel on the log axis stays the fit's in a phone's box, at the default text size and at twice it.
it.each([[16], [32]])("draws the named dots at the fit's pixels in 343px at %ipx text", async px => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(343);
  document.documentElement.style.fontSize = `${px}px`;
  renderApp(map(null));
  await drawn();
  for (const i of NAMED) dotOf(i, 343, px / 16);
});
