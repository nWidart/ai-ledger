import { waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { color } from "../../../colors";
import { textScale } from "../../../components/chart";
import { renderApp } from "../../../testing";
import { quadrantFit, quadrantModel, type QuadRow } from "./quadrant";
import { SessionQuadrant } from "./SessionQuadrant";

// The quadrant's one test on real ECharts (graph-project-quadrant, step 2.4): every other test draws on the fake runtime
// from test-setup, which draws nothing. The geometry, the colors per dot and the forced-colors values are the model's and
// the option's tests'; here only what the drawing proves: one dot path per session, at the fit's pixel; the two dashed
// guides at the medians, and none under three dots; the axis and lane labels as text; filled and hollow dots told apart;
// no stale path after newer rows; and forced colors reaching the drawing. Nothing logged: test-setup fails the test on it.
vi.unmock("../../../components/echart/load");

// jsdom resolves no var(), so every token would compute to black. The color probe answers each token with an rgb() of its
// own, which the drawing's fills and strokes can be told apart by.
const rgb = new Map<string, string>();
const resolved = (token: string) => {
  if (!rgb.has(token)) rgb.set(token, `rgb(${rgb.size + 1}, 100, 200)`);
  return rgb.get(token)!;
};
/** The token a drawn color resolved from: the renderer writes rgb() with or without spaces. */
const tokenOf = (c: string | null) => (c ? [...rgb].find(([, v]) => v === c || v.replaceAll(" ", "") === c)?.[0] : undefined);

const WIDTH = 343, PROJECT = "atlas-api";
const row = (session_id: string, cost: number, tool_calls: number, commits = 0): QuadRow =>
  ({ session_id, title: null, first_ts: "2026-11-03T14:20:00Z", cost, unpriced: 0, tool_calls, commits });
// A session at $0 and one at 0 tool calls: both lanes are shown. The medians are c's: $1.10 and 30 tool calls.
const ROWS = [row("a", 0, 12), row("b", .3, 0, 1), row("c", 1.1, 30), row("d", 4.2, 41, 2), row("e", 9, 80)];

const quadrant = (rows: readonly QuadRow[]) => <SessionQuadrant rows={rows} totalSessions={rows.length} project={PROJECT} view="v" />;
const fitOf = (rows: readonly QuadRow[]) => quadrantFit(quadrantModel(rows, rows.length), WIDTH, textScale());
const svg = () => document.querySelector(".quad-box .echart-plot svg");
const paths = () => [...document.querySelectorAll(".quad-box .echart-plot svg path")];
/** The dots: the renderer writes a circle as an arc from its rightmost point, "M x y A r r …". */
const dots = () => paths().flatMap(p => {
  const m = /^M(-?[\d.]+) (-?[\d.]+)A4 4/.exec(p.getAttribute("d") ?? "");
  return m ? [{ x: Number(m[1]) - 4, y: Number(m[2]), fill: tokenOf(p.getAttribute("fill")), stroke: tokenOf(p.getAttribute("stroke")) }] : [];
});
/** The guides: the dashed lines, as their "M x1 y1L x2 y2" numbers. */
const guides = () => paths().filter(p => p.getAttribute("stroke-dasharray") === "5,4")
  .map(p => (p.getAttribute("d")!.match(/-?[\d.]+/g) ?? []).map(Number));
const texts = () => [...svg()!.querySelectorAll("text")].map(t => t.textContent);

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(WIDTH);
  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((el: Element, pseudo?: string | null) => {
    if (!(el instanceof HTMLElement) || el.dataset.chartProbe === undefined) return real(el, pseudo);
    return { color: resolved(/;color:(.*)$/.exec(el.getAttribute("style") ?? "")![1]!) } as CSSStyleDeclaration;
  });
});

it("draws a dot per session at the fit's pixel, the guides at the medians, the labels, and redraws newer rows with no stale path", async () => {
  const { rerender } = renderApp(quadrant(ROWS));
  // A cold load of ECharts can take more than a second on a busy machine.
  await waitFor(() => expect(dots()).toHaveLength(ROWS.length), { timeout: 5000 });
  const fit = fitOf(ROWS);
  // The session at 0 tool calls sits on the zero lane, at the fit's pixel.
  const lane = fit.dots[quadrantModel(ROWS, ROWS.length).dots.findIndex(d => d.row.session_id === "b")]!;
  const drawn = dots().find(d => Math.abs(d.x - lane.px) <= .5 && Math.abs(d.y - lane.py) <= .5);
  expect(drawn, `no dot at ${lane.px}, ${lane.py}: ${JSON.stringify(dots())}`).toBeDefined();
  // Filled in the project's hue, hollow in the surface.
  expect(new Set(dots().map(d => d.fill))).toEqual(new Set([color(PROJECT), "var(--surface-1)"]));
  // One vertical guide through the cost median, one horizontal through the calls median.
  const { px, py } = fit.guides!;
  expect(guides().map(([x1, y1, x2, y2]) => (x1 === x2 ? `x ${Math.round(x1! - px)}` : y1 === y2 ? `y ${Math.round(y1! - py)}` : "?")).sort())
    .toEqual(["x 0", "y 0"]);
  // Both lanes' zeros, and a tick on each axis.
  expect(texts()).toEqual(expect.arrayContaining(["$0", "0", "$1", "10"]));

  // Newer rows, with one more session: one more dot, none left behind.
  const newer = [...ROWS, row("f", 2, 20, 1)];
  rerender(quadrant(newer));
  await waitFor(() => expect(dots()).toHaveLength(newer.length));
  // Two sessions: two dots and no guide.
  rerender(quadrant(ROWS.slice(3)));
  await waitFor(() => expect(dots()).toHaveLength(2));
  expect(guides()).toEqual([]);
}, 10_000);

it("draws the dots in the system's text color under forced colors", async () => {
  const media = window.matchMedia;
  vi.spyOn(window, "matchMedia").mockImplementation(q => ({ ...media(q), matches: q === "(forced-colors: active)" }));
  renderApp(quadrant(ROWS));
  await waitFor(() => expect(dots()).toHaveLength(ROWS.length), { timeout: 5000 });
  expect(dots().filter(d => d.fill !== "CanvasText" && d.stroke !== "CanvasText")).toEqual([]);
}, 10_000);
