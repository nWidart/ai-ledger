import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { getInstanceByDom } from "echarts/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../__fixtures__/errors";
import type { ErrorRow, ErrorsPayload } from "../../api";
import { box, centreX, probeColors, textX, tokenOf } from "../../components/echart/realTesting";
import { dayRange } from "../../format";
import { ingested, renderPage } from "../../testing";
import { ErrorsPage } from "./ErrorsPage";

// The rate chart's test on real ECharts (echart-errors, decision 12): every other test draws on the fake runtime from
// test-setup, which draws nothing. This one looks at what only a drawing shows: both tracks and their titles, the marks on
// the frame (the no-activity bands, the fix markers, the selection) at their points, both tracks zoomed together, the
// marks the zoom leaves out, the dimmed types, the colors kept while a point is read, and the drawing taken away.
vi.unmock("../../components/echart/load");

const A = "worktree", B = "worktree_verify", C = "sleep_poll";
/** The types' layers, by their all-time count: A, then B, then C. */
const LAYERS = ["var(--type-1)", "var(--type-2)", "var(--type-3)"];
type Day = { calls: number; errs: [string, number][] };
/** A payload of one project, its calls and its errors per day, the server's error_days built from them, and the fixes. */
function payload(days: string[], on: (i: number) => Day, fixes: Record<string, string>): ErrorsPayload {
  const rows = days.map((d, i) => ({ d, ...on(i) }));
  const errors: ErrorRow[] = rows.flatMap(({ d, errs }) => errs.flatMap(([c, n]) => Array.from({ length: n }, (_, j) => ({
    id: `${d}-${c}-${j}`, ts: `${d}T10:00:00Z`, p: "foo", s: "s1", t: "Bash", c, i: "ls", e: "boom", r: "", sub: 0 as const, src: "claude" as const, d, n: null,
  }))));
  return { ...fixture, today: days.at(-1)!, project_order: ["foo"], incidents: [], muted: [], errors, fixes,
    calls: rows.flatMap(({ d, calls }) => (calls ? [[d, "foo", calls, 0, "claude"] as ErrorsPayload["calls"][number]] : [])),
    error_days: rows.flatMap(({ d, errs }) => errs.map(([c, n]) => [d, "foo", c, n, 0, "claude"] as ErrorsPayload["error_days"][number])) };
}
const ALL: [string, number][] = [[A, 3], [B, 2], [C, 1]];

// 20 days. Days 7 to 9 have neither calls nor errors (one run of no activity); days 12 and 14 have errors and no calls, so
// day 13's rate stands alone (a solid dot); day 15 has few calls (a hollow dot, its rate over the scale's top). A's fix
// went in on day 5, B's and C's on the newest day. Day 3 is selected.
const days = dayRange("2026-10-17", "2026-11-05");
const quiet = (i: number) => i >= 7 && i <= 9;
const d20 = payload(days, i => (quiet(i) ? { calls: 0, errs: [] } : i === 12 || i === 14 ? { calls: 0, errs: ALL } : i === 15 ? { calls: 10, errs: [[A, 1]] }
  : { calls: 100, errs: ALL }), { [A]: days[5]!, [B]: days[19]!, [C]: days[19]! });

const json = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
const serve = (p: ErrorsPayload) => vi.stubGlobal("fetch", vi.fn((url: string) => json(url.startsWith("/api/errors") ? p : {})));
const page = async (p: ErrorsPayload, search: string) => {
  serve(p);
  history.replaceState(null, "", `/errors?${search}`);
  const { client } = renderPage(<ErrorsPage />);
  await screen.findByRole("heading", { level: 1, name: /failed tool calls/ });
  return client;
};

const plot = () => document.querySelector<HTMLElement>("#chart .echart-plot")!;
const chart = () => getInstanceByDom(plot())!;
const group = () => document.getElementById("chart")!;
/** The drawn paths, not the clip paths' defs. */
const paths = () => [...plot().querySelectorAll("svg path")].filter(p => !p.closest("clipPath"));
const texts = (t: string) => [...plot().querySelectorAll("svg text")].filter(e => e.textContent === t);
const d = (p: Element) => box(p.getAttribute("d")!);
const by = (fill: string, stroke: string) => paths().filter(p => tokenOf(p.getAttribute("fill")) === fill && tokenOf(p.getAttribute("stroke")) === stroke);
/** The bars' segments, as the layer each one is drawn in, with its box and its opacity. */
const segments = () => paths().flatMap(p => {
  const t = tokenOf(p.getAttribute("fill"));
  return t && LAYERS.includes(t) ? [{ token: t, o: p.getAttribute("fill-opacity"), ...d(p) }] : [];
});
/** The bars at x: one segment per layer of its point. */
const barAt = (x: number) => segments().filter(s => Math.abs(s.cx - x) <= .5);
const stroked = (dash: string) => paths().filter(p => p.getAttribute("stroke-dasharray") === dash);
const rateLine = () => paths().filter(p => p.getAttribute("fill") === "none" && !p.hasAttribute("stroke-dasharray") && tokenOf(p.getAttribute("stroke")) === "var(--text-primary)");
const bridge = () => stroked("1,4");
const solid = () => by("var(--text-primary)", "var(--surface-1)");
const hollow = () => by("var(--surface-1)", "var(--text-primary)");
const idleBands = () => paths().filter(p => tokenOf(p.getAttribute("fill")) === "var(--surface-2)");
const fixLines = () => stroked("4,3");
const fixLabels = () => [...plot().querySelectorAll("svg text")].filter(e => e.textContent?.startsWith("✓ "));
/** The reading band: the cursor ink (the text color) at 6%. */
const band = () => paths().filter(p => tokenOf(p.getAttribute("fill")) === "var(--text-primary)" && p.getAttribute("fill-opacity") === "0.06");
/** The selection's mark: the accent at 16%, in an accent frame. */
const selection = () => paths().filter(p => tokenOf(p.getAttribute("fill")) === "var(--accent)" && p.getAttribute("fill-opacity") === "0.16"
  && tokenOf(p.getAttribute("stroke")) === "var(--accent)");

/** At the default text size in 800px the plot runs 738px from x 52 (rateLayout's margins). The middle of point i of the n
 *  shown from `from`. */
const PLOT = { left: 52, width: 738 };
const at = (i: number, n = 20, from = 0) => PLOT.left + (i - from + .5) * PLOT.width / n;
/** Points i on the frame's axis and on both tracks' axes have one x. */
const together = (...points: number[]) => {
  for (const i of points) {
    const xs = [0, 1, 2].map(a => chart().convertToPixel({ xAxisIndex: a }, i) as number);
    expect(Math.max(...xs) - Math.min(...xs), `point ${i} on x axes 0, 1, 2: ${xs.join(", ")}`).toBeLessThanOrEqual(.5);
  }
};
const zoomTo = (startValue: number, endValue: number) => act(() => { chart().dispatchAction({ type: "dataZoom", startValue, endValue }); });

beforeEach(() => probeColors());

it("draws both tracks and the marks on the frame, zooms both together, dims the other types, and swaps the drawing for the message", async () => {
  const client = await page(d20, `range=30&at=${days[3]}`);
  // The bars: 16 days of three types, day 15 of one, in the types' colors.
  await waitFor(() => expect(segments()).toHaveLength(49));
  expect(new Set(segments().map(s => s.token))).toEqual(new Set(LAYERS));
  for (const t of ["Error rate, % of tool calls", "Failed calls per day, by type"]) expect(texts(t)).toHaveLength(1);
  // The rate line above the bars, and the bridge: one dotted path with a single move, painted before (under) the line.
  expect(rateLine()).toHaveLength(1);
  const line = d(rateLine()[0]!);
  expect(line.top + line.height).toBeLessThan(Math.min(...segments().map(s => s.top)));
  expect(bridge()).toHaveLength(1);
  expect(bridge()[0]!.getAttribute("d")!.match(/M/g)).toHaveLength(1);
  expect(paths().indexOf(bridge()[0]!)).toBeLessThan(paths().indexOf(rateLine()[0]!));
  // One hollow dot over day 15's bar, one solid over day 13's.
  expect(hollow().map(centreX)).toEqual([expect.closeTo(at(15), 0)]);
  expect(solid().map(centreX)).toEqual([expect.closeTo(at(13), 0)]);
  expect(barAt(at(15))).toHaveLength(1);
  expect(barAt(at(13))).toHaveLength(3);
  // The run of days 7 to 9: one band from day 7's left edge to day 9's right, its words in its middle.
  expect(idleBands()).toHaveLength(1);
  const run = d(idleBands()[0]!);
  expect(run.left).toBeCloseTo(at(6.5), 1);
  expect(run.left + run.width).toBeCloseTo(at(9.5), 1);
  expect(texts("no activity").map(textX)).toEqual([expect.closeTo(run.cx, 1)]);
  // Each fix: one dashed line over its point, with its label. Day 5's label right of it; the newest day's two stacked left
  // of theirs, ending inside the plot.
  expect(fixLines().map(p => d(p).cx)).toEqual([expect.closeTo(at(5), 0), expect.closeTo(at(19), 0), expect.closeTo(at(19), 0)]);
  const labels = fixLabels().map(t => ({ x: textX(t), y: Number(t.getAttribute("y")), anchor: t.getAttribute("text-anchor") }));
  expect(labels).toHaveLength(3);
  expect(labels[0]).toMatchObject({ x: expect.closeTo(at(5) + 4, 1), anchor: "start" });
  for (const l of labels.slice(1)) expect(l).toMatchObject({ x: expect.closeTo(at(19) - 4, 1), anchor: "end" });
  expect(Math.abs(labels[2]!.y - labels[1]!.y)).toBeCloseTo(13, 1);
  expect(labels[2]!.x).toBeLessThanOrEqual(PLOT.left + PLOT.width);
  // The selected day: one frame around its bar, no wider than its band.
  expect(selection()).toHaveLength(1);
  const frame = d(selection()[0]!);
  expect(frame.cx).toBeCloseTo(at(3), 0);
  expect(frame.width).toBeLessThanOrEqual(PLOT.width / 20);

  // Right reads day 0: exactly one band.
  act(() => group().focus());
  fireEvent.keyDown(group(), { key: "ArrowRight" });
  await waitFor(() => expect(band()).toHaveLength(1));
  expect(d(band()[0]!).cx).toBeCloseTo(at(0), 0);
  fireEvent.keyDown(group(), { key: "Escape" });
  await waitFor(() => expect(band()).toHaveLength(0));

  // Plus with nothing read: the newest ten days, on both tracks at one x. Day 15's dot is still over its bar; the selected
  // day 3, the run and the fix on day 5 are left out, and the newest day's two fixes are still drawn.
  fireEvent.keyDown(group(), { key: "+" });
  await waitFor(() => expect(segments()).toHaveLength(28));
  together(10, 19);
  expect(hollow().map(centreX)).toEqual([expect.closeTo(at(15, 10, 10), 0)]);
  expect(barAt(at(15, 10, 10))).toHaveLength(1);
  expect(selection()).toHaveLength(0);
  expect(idleBands()).toHaveLength(0);
  expect(fixLines().map(p => d(p).cx)).toEqual([expect.closeTo(at(19, 10, 10), 0), expect.closeTo(at(19, 10, 10), 0)]);
  // Minus: every day again, with the selection's frame.
  fireEvent.keyDown(group(), { key: "-" });
  await waitFor(() => expect(segments()).toHaveLength(49));
  expect(selection()).toHaveLength(1);

  // Days 8 to 14: the run the window cuts is one band from the plot's left edge, with its words. Days 11 to 17: day 11's
  // neighbour is left out, so its rate is a dot over its bar, as is day 13's.
  zoomTo(8, 14);
  await waitFor(() => expect(idleBands().map(p => d(p).left)).toEqual([expect.closeTo(PLOT.left, 1)]));
  expect(d(idleBands()[0]!).width).toBeCloseTo(2 * PLOT.width / 7, 1);
  expect(texts("no activity")).toHaveLength(1);
  zoomTo(11, 17);
  await waitFor(() => expect(solid().map(centreX).sort((a, b) => a - b)).toEqual([expect.closeTo(at(11, 7, 11), 0), expect.closeTo(at(13, 7, 11), 0)]));
  expect(barAt(at(11, 7, 11))).toHaveLength(3);
  expect(idleBands()).toHaveLength(0);
  zoomTo(0, 19);

  // B selected: every other layer and every other type's fix drawn at 20%.
  fireEvent.click(document.querySelector(`#legend button[data-c="${B}"]`)!);
  await waitFor(() => expect(segments().filter(s => s.o === "0.2").map(s => s.token)).not.toHaveLength(0));
  expect(new Set(segments().filter(s => s.o === "0.2").map(s => s.token))).toEqual(new Set(["var(--type-1)", "var(--type-3)"]));
  expect(segments().filter(s => s.token === "var(--type-2)").every(s => s.o == null)).toBe(true);
  expect(fixLines().map(p => p.getAttribute("stroke-opacity"))).toEqual(["0.2", null, "0.2"]); // A's, B's, C's
  expect(fixLabels().map(t => t.getAttribute("fill-opacity"))).toEqual(["0.2", null, "0.2"]);

  // A payload without errors: the message in place of the drawing, which is taken away.
  const drawing = plot();
  serve({ ...d20, errors: [], error_days: [] });
  ingested(client);
  await screen.findByText(/^No failed tool calls in this range/);
  expect(drawing.querySelector("svg")).toBeNull();
});

// Read by the keyboard, a point keeps its colors: ECharts' pointer highlights the items on the axis it reads, the frame's,
// where the selection, the bands and the fixes sit. The frame's pointer triggers no highlight (`triggerEmphasis: false`),
// so nothing but the band changes. The bars are on a track's axis, which the pointer never reads.
it("changes no color of a bar or a mark while a point is read", async () => {
  await page(d20, `range=30&at=${days[3]}`);
  await waitFor(() => expect(segments()).toHaveLength(49));
  const paints = () => paths().filter(p => !band().includes(p))
    .map(p => ["fill", "stroke", "fill-opacity", "stroke-opacity", "opacity"].map(a => p.getAttribute(a)).join(" ")).sort();
  const before = paints();
  act(() => group().focus());
  for (const [n, point] of [[4, 3], [2, 5], [2, 7]] as const) { // the selected day, day 5's fix, the run
    for (let k = 0; k < n; k++) fireEvent.keyDown(group(), { key: "ArrowRight" });
    await waitFor(() => expect(band().map(p => d(p).cx)).toEqual([expect.closeTo(at(point), 0)]));
    await new Promise(settled => setTimeout(settled, 100)); // the highlight is drawn on a later frame than the band
    expect(paints(), `day ${point} read`).toEqual(before);
  }
});

// A folded stretch is one point: its "//" sits on the frame's bottom line at the middle of its band.
it("draws a fold's mark on its band", async () => {
  const month = dayRange("2026-10-07", "2026-11-05"), fold = (i: number) => i >= 5 && i <= 14;
  await page(payload(month, i => (fold(i) ? { calls: 0, errs: [] } : { calls: 100, errs: ALL }), {}), "range=30");
  // 5 days, the fold, 15 days: 21 points, each of three types but the fold.
  await waitFor(() => expect(segments()).toHaveLength(60));
  const mark = texts("//");
  expect(mark.map(textX)).toEqual([expect.closeTo(at(5, 21), 1)]);
  expect(Number(mark[0]!.getAttribute("y"))).toBeCloseTo(18 + 278, 1); // the frame's bottom line: its top, plus both tracks and the gap
  expect(idleBands().map(p => d(p).cx)).toEqual([expect.closeTo(at(5, 21), 1)]);
});

// The frame and the tracks keep one x at a phone's width and at twice the text size, zoomed or not, so the frame's marks
// stay on the bars. tracksOption keeps ECharts from fitting the frame alone (outerBoundsMode); this chart's bucket labels
// are short and reach no edge in these boxes, so these tests see a frame that drifts by any cause, and the browser check
// sees the fit itself.
describe("in a narrow box", () => {
  const sized = (width: number, fontSize: string) => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width);
    document.documentElement.style.fontSize = fontSize;
  };
  afterEach(() => { document.documentElement.style.fontSize = ""; });
  /** The selected point's frame is on its bar, no wider than its band, and the newest label ends inside the box. */
  const framed = (width: number, newest: string) => {
    const frame = d(selection()[0]!), x = (i: number) => chart().convertToPixel({ xAxisIndex: 0 }, i) as number;
    expect(barAt(frame.cx).length, `bars under the frame at ${frame.cx}`).toBeGreaterThan(0);
    expect(frame.width).toBeLessThanOrEqual(x(1) - x(0));
    const label = texts(newest)[0]!;
    expect(label.getAttribute("text-anchor")).toBe("end");
    expect(textX(label)).toBeLessThanOrEqual(width);
  };

  // 11 weeks to the week of Nov 2, the fourth without activity; the newest is selected and has B's fix.
  it("keeps the frame on the tracks with 11 weeks in 343px", async () => {
    sized(343, "16px");
    const span = dayRange("2026-08-24", "2026-11-05"), week = (i: number) => Math.floor(i / 7);
    await page(payload(span, i => (week(i) === 3 ? { calls: 0, errs: [] } : { calls: 100, errs: [[A, 1], [B, 1]] }), { [B]: "2026-11-03" }),
      "range=90&gran=week&at=2026-11-02");
    await waitFor(() => expect(segments()).toHaveLength(20));
    expect(chart().getWidth()).toBe(343);
    together(0, 10);
    framed(343, "Nov 2");
    // The quiet week: its band, too narrow for its words.
    expect(idleBands()).toHaveLength(1);
    expect(texts("no activity")).toHaveLength(0);
    // The fix's label ends inside the plot, left of its line.
    const [fix] = fixLabels();
    expect(fix!.getAttribute("text-anchor")).toBe("end");
    expect(textX(fix!)).toBeLessThan(d(fixLines()[0]!).cx);
  });

  // The 20 days at twice the text size in 343px, zoomed: both tracks keep one x for the points shown.
  it("zooms both tracks together at 200% text in 343px", async () => {
    sized(343, "32px");
    await page(d20, "range=30&at=2026-11-05");
    await waitFor(() => expect(segments()).toHaveLength(49));
    together(0, 19);
    framed(343, "Nov 5");
    act(() => group().focus());
    fireEvent.keyDown(group(), { key: "+" });
    await waitFor(() => expect(segments()).toHaveLength(28));
    together(10, 19);
    framed(343, "Nov 5");
  });
});
