import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import session from "../../../__fixtures__/session";
import type { SessionDetail } from "../../../api";
import { renderApp } from "../../../testing";
import { textScale } from "../../chart";
import { box, probeColors, tokenOf } from "../../echart/realTesting";
import { timelineModel } from "../session";
import { spansLayout, type SpansLayout } from "./spans";
import { spanBox } from "./spansOption";
import { readSpan } from "./spansReading";
import { SessionSpans } from "./SessionSpans";

// The section's one test on real ECharts (graph-session-flamechart, step 1.7): every other test draws on the fake runtime
// from test-setup, which draws nothing. The shapes and colors per kind are spansOption.test.ts's, on a stubbed api; here
// only what the drawing proves on ECharts 6: one path per span in the box the layout gives it, the hollow bar, the ring,
// the clipped bar's point in the right margin, the break band, the lane labels as text, the mark on the bar the live region
// names, no stale path after newer data, and forced colors reaching the drawing. Nothing logged: test-setup fails on it.
vi.unmock("../../echart/load");

type Call = SessionDetail["calls"][number];
const T0 = Date.parse("2026-11-04T14:00:00.000Z");
const at = (min: number) => new Date(T0 + min * 60e3).toISOString();
/** A call on the main thread from start to end, in minutes after T0. */
const call = (id: string, start: number, end: number | null, o: Partial<Call> = {}): Call => ({
  id, tool: "Bash", start_ts: at(start), end_ts: end == null ? null : at(end), is_error: (end == null ? null : false) as boolean,
  category: null, subagent: false, is_commit: false, lane: 0, input: "", ...o,
});
// Main thread: an ok bar, a failed wide one, a failed narrow one, a call with no result, a call that runs past the axis's
// end (clipped) through 32 minutes with nothing starting (a squeezed gap), and the last call, with no duration, where the
// axis ends. Subagent 1: one bar, and a call that starts where the axis ends and runs past it.
const CALLS = [
  call("ok", 0, 2),
  call("wide", 2.5, 6, { is_error: true }),
  call("narrow", 6.5, 6.51, { is_error: true }),
  call("open", 7, null),
  call("clipped", 7.5, 50),
  call("still", 40, 40),
  call("sub", 1, 1.5, { subagent: true, lane: 1 }),
  call("edge", 40, 45, { subagent: true, lane: 1 }),
];
const WIDTH = 343, LINE = 1.5, MARK = 3;
const detail = (calls = CALLS): SessionDetail => ({ ...session, requests: [], compaction_ts: [], calls });
const layoutOf = (s: SessionDetail) => spansLayout(timelineModel(s, WIDTH, textScale()), s.calls, WIDTH, textScale())!;
const spans = (s: SessionDetail) => <SessionSpans s={s} />;

/** Every drawn path, as its paint's tokens with its box. */
const drawn = () => [...document.querySelectorAll(".spans-box .echart-plot svg path")].map(p => {
  const d = p.getAttribute("d")!, paint = (a: string) => tokenOf(p.getAttribute(a)) ?? p.getAttribute(a);
  return { d, fill: paint("fill"), stroke: paint("stroke"), ...box(d) };
});
/** The break band and its ⌇ start at the lanes' label line, above every span (a failure tick rises 2px above its row). */
const breaks = (l: SpansLayout) => drawn().filter(p => p.top < l.lanes[0]!.top - 2);
const spanPaths = (l: SpansLayout) => drawn().filter(p => p.top >= l.lanes[0]!.top - 2);
const near = (a: number, b: number) => Math.abs(a - b) <= .5;
/** The path each span is drawn as: one whose box is the span's box, a hollow bar's an outline inside it, a ring's an arc
 *  from its rightmost point ("M cx+r cy A r r …"). */
const pathsOf = (l: SpansLayout) => l.spans.map(sp => {
  const b = spanBox(l, sp), i = sp.kind === "failed" && b.height === 8 ? LINE / 2 : 0;
  return spanPaths(l).filter(p => (b.ring ? /^M(-?[\d.]+) (-?[\d.]+)A3 3/.exec(p.d)?.slice(1).map(Number).every((v, k) => near(v, k ? b.y + 3 : b.x + 6)) === true
    : near(p.left, b.x + i) && near(p.top, b.y + i) && near(p.width, b.width - 2 * i) && near(p.height, b.height - 2 * i)));
});
/** One path per span, and no other. */
const drawsEachSpanOnce = (l: SpansLayout) => {
  expect(pathsOf(l).map(ps => ps.length)).toEqual(l.spans.map(() => 1));
  expect(spanPaths(l)).toHaveLength(l.spans.length);
};
const texts = () => [...document.querySelectorAll(".spans-box .echart-plot svg text")].map(t => t.textContent);

beforeEach(() => {
  probeColors();
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(WIDTH);
});

it("draws each span in its box, the shapes, the break and the labels, marks the bar it reads, and redraws newer data", async () => {
  const s = detail(), l = layoutOf(s);
  const { rerender } = renderApp(spans(s));
  // A cold load of ECharts can take more than a second on a busy machine.
  await waitFor(() => expect(spanPaths(l)).toHaveLength(l.spans.length), { timeout: 5000 });
  drawsEachSpanOnce(l);
  const [ok, wide, , open, clipped, , , edge] = pathsOf(l).map(ps => ps[0]!);
  expect([ok!.fill, wide!.fill, wide!.stroke]).toEqual(["var(--series-1)", "var(--surface-1)", "var(--critical)"]);
  // The ring is a circle: one arc of radius 3 back to where it starts, unfilled.
  const [mx, my, ax, ay] = /^M([\d.]+) ([\d.]+)A3 3 0 1 1 ([\d.]+) ([\d.]+)$/.exec(open!.d)!.slice(1).map(Number);
  expect([near(mx!, ax!) && near(my!, ay!), open!.fill]).toEqual([true, "none"]);
  // The clipped bars, also the one that starts at the axis's end: five points, at least 6px long, the point in the right
  // margin 2px before the box's edge.
  expect([clipped, edge].map(p => [p!.d.match(/[ML]/g)!.length, p!.width >= 6, near(p!.left + p!.width, WIDTH - 2)])).toEqual([[5, true, true], [5, true, true]]);
  // The break band, 6px wide around the gap's break.
  expect(l.breaks).toHaveLength(1);
  expect(breaks(l).filter(p => p.fill === "var(--surface-2)").map(p => [near(p.cx, l.breaks[0]!), p.width])).toEqual([[true, 6]]);
  expect(texts()).toEqual(expect.arrayContaining(["Main thread", "Subagent 1"]));

  // A key reads the main thread's first call: the mark sits around the bar the live region names, MARK px outside it.
  act(() => screen.getByRole("group", { name: /^Tool calls of this session by thread/ }).focus());
  fireEvent.keyDown(screen.getByRole("group", { name: /^Tool calls of this session by thread/ }), { key: "ArrowRight" });
  const named = l.spans.findIndex(sp => readSpan(l, sp.id) === document.querySelector(".spans-live")!.textContent);
  const bar = pathsOf(l)[named]![0]!, mark = document.querySelector(".spans-mark rect")!;
  const [x, y, w, h] = ["x", "y", "width", "height"].map(a => Number(mark.getAttribute(a)));
  expect([x! + MARK, y! + MARK, w! - 2 * MARK, h! - 2 * MARK].map((v, k) => near(v, [bar.left, bar.top, bar.width, bar.height][k]!)),
    `mark ${[x, y, w, h]} on ${JSON.stringify(bar)}`).toEqual([true, true, true, true]);

  // Newer data, with one more call: one more path, none left behind.
  const newer = detail([...CALLS, call("late", 3, 4, { subagent: true, lane: 1 })]), n = layoutOf(newer), before = drawn().length;
  rerender(spans(newer));
  await waitFor(() => expect(spanPaths(n)).toHaveLength(n.spans.length));
  drawsEachSpanOnce(n);
  expect(drawn()).toHaveLength(before + 1);}, 10_000);
