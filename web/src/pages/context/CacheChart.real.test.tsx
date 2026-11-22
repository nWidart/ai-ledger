import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { getInstanceByDom } from "echarts/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { CacheBucket } from "../../api";
import { box, centreX, probeColors, textX, tokenOf } from "../../components/echart/realTesting";
import { dayRange } from "../../format";
import { renderApp } from "../../testing";
import { CacheChart } from "./CacheChart";

// The cache chart's test on real ECharts (echart-context, decision 12): every other test draws on the fake runtime, which
// draws nothing, and cacheTracks.test.ts proves the model and the option on their own. This one looks at what only a
// drawing shows: the bars, the breaks and the ratio in their colors on the slots that have a row, nothing on an empty slot,
// the ratio line in parts and a lone day's dot, one reading band over the three tracks, the zoom on every track, the cache
// reads with their edge, and the frame kept on the tracks in a narrow box.
vi.unmock("../../components/echart/load");

// 20 days. Days 5 and 6 are empty side by side, day 8 alone, so day 7's neighbours are both empty: its ratio is one dot.
// Each other day has one break, of a cause in turn.
const days = dayRange("2026-10-17", "2026-11-05"), EMPTY = [5, 6, 8];
const CAUSES = ["model_switch", "expired", "other"] as const;
const rows: CacheBucket[] = days.flatMap((day, i) => (EMPTY.includes(i) ? [] : [{
  day, input: 40_000 + 1000 * i, cache_write: 60_000, cache_read: 800_000 + 10_000 * i, model_switch: 0, expired: 0, other: 0, [CAUSES[i % 3]!]: 1,
}]));
const FULL = days.length - EMPTY.length;
const BARS = ["var(--accent)", "var(--series-1)"], BREAKS = ["var(--cache-switch)", "var(--cache-expired)", "var(--text-muted)"];

const plot = () => document.querySelector<HTMLElement>(".echart-plot")!;
const chart = () => getInstanceByDom(plot())!;
const group = () => screen.getByRole("group", { name: /^Cache waste/ });
const paths = () => [...plot().querySelectorAll("svg path")].filter(p => !p.closest("clipPath"));
/** The parts filled in these tokens, not the slider's handles (a unit shape the renderer scales by a transform). */
const filled = (tokens: string[]) => paths().filter(p => tokens.includes(tokenOf(p.getAttribute("fill"))!) && p.getAttribute("fill-opacity") == null
  && box(p.getAttribute("d")!).width > 1);
const cxs = (tokens: string[]) => filled(tokens).map(p => box(p.getAttribute("d")!).cx);
const ratioLine = () => paths().filter(p => p.getAttribute("fill") === "none" && tokenOf(p.getAttribute("stroke")) === "var(--text-primary)");
/** The ratio line's drawn parts, each as its vertices' x: a move with no line after it draws nothing. */
const parts = () => ratioLine().flatMap(p => p.getAttribute("d")!.split("M").filter(s => s.includes("L"))
  .map(s => [...s.matchAll(/(?:^|L)(-?[\d.]+)/g)].map(m => Number(m[1]))));
const vertices = () => parts().flat();
const dots = () => paths().filter(p => tokenOf(p.getAttribute("fill")) === "var(--text-primary)" && tokenOf(p.getAttribute("stroke")) === "var(--surface-1)");
const band = () => paths().filter(p => tokenOf(p.getAttribute("fill")) === "var(--text-primary)" && p.getAttribute("fill-opacity") === "0.06");
/** The middle of slot i on axis a: the frame's is 0, the tracks' 1 to 3. */
const x = (i: number, a = 1) => chart().convertToPixel({ xAxisIndex: a }, i) as number;
const near = (xs: number[], at: number) => xs.filter(v => Math.abs(v - at) <= .5);
/** The three titles, which a narrow box cuts ("Tokens not read…"). */
const TITLES = [/^Tokens not read/, /^Cache breaks/, /^Cache-hit ratio/];
const titles = () => TITLES.map(t => [...plot().querySelectorAll("svg text")].filter(e => t.test(e.textContent ?? "")));

beforeEach(() => probeColors());
afterEach(() => { document.documentElement.style.fontSize = ""; });

it("draws each track on the slots with a row, reads one band over the tracks, zooms them together, and adds the cache reads", async () => {
  const { unmount } = renderApp(<CacheChart view="v" series={{ bucket: "day", rows }} />);
  await waitFor(() => expect(filled(BARS)).toHaveLength(2 * FULL));
  expect(new Set(filled(BARS).map(p => tokenOf(p.getAttribute("fill"))))).toEqual(new Set(BARS));
  expect(new Set(filled(BREAKS).map(p => tokenOf(p.getAttribute("fill"))))).toEqual(new Set(BREAKS));
  for (const t of titles()) expect(t).toHaveLength(1);
  // Nothing on an empty day; the ratio in two parts around it, and day 7's ratio one solid dot over its bar.
  for (const i of EMPTY) expect([...near(cxs(BARS), x(i)), ...near(cxs(BREAKS), x(i)), ...near(vertices(), x(i))], `day ${i}`).toEqual([]);
  expect(parts().map(p => [p[0], p.at(-1)])).toEqual([[x(0), x(4)], [x(9), x(19)]].map(p => p.map(v => expect.closeTo(v, 1))));
  expect(dots().map(centreX)).toEqual([expect.closeTo(x(7), 0)]);

  // Right reads day 0: one band, from the bars' top to the ratio's bottom. Five more reach day 5, an empty day.
  act(() => group().focus());
  fireEvent.keyDown(group(), { key: "ArrowRight" });
  await waitFor(() => expect(band()).toHaveLength(1));
  // cacheLayout at the default text size: the frame from 20px down, the three tracks and their two gaps (180 + 24 + 48 + 24 + 44).
  const b = box(band()[0]!.getAttribute("d")!);
  expect([b.cx, b.top, b.height]).toEqual([expect.closeTo(x(0), 0), expect.closeTo(20, 0), expect.closeTo(320, 0)]);
  for (let k = 0; k < 5; k++) fireEvent.keyDown(group(), { key: "ArrowRight" });
  await waitFor(() => expect(band().map(p => box(p.getAttribute("d")!).cx)).toEqual([expect.closeTo(x(5), 0)]));
  expect(near(cxs(BARS), x(5))).toEqual([]);
  fireEvent.keyDown(group(), { key: "Escape" });

  // Plus: the newest ten days, on every track; each ratio point still over the middle of its day's bar.
  fireEvent.keyDown(group(), { key: "+" });
  await waitFor(() => expect(filled(BARS)).toHaveLength(20));
  for (const v of vertices()) expect(near(cxs(BARS), v), `ratio point at ${v}`).toHaveLength(2);

  // The cache reads: a third color on every bar shown, each part framed by its edge of the muted ink, inset by half its 1px.
  fireEvent.click(screen.getByRole("button", { name: "Cache reads" }));
  await waitFor(() => expect(filled(["var(--track)"])).toHaveLength(10));
  const edges = paths().filter(p => p.getAttribute("fill") === "none" && tokenOf(p.getAttribute("stroke")) === "var(--text-muted)"
    && p.getAttribute("d")!.endsWith("Z")); // not the slider's trend, an open line in the same ink
  const frame = (p: Element, inset: number) => { const b = box(p.getAttribute("d")!); return [b.cx, b.top - inset, b.height + 2 * inset]; };
  expect(edges.map(p => frame(p, .5))).toEqual(filled(["var(--track)"]).map(p => frame(p, 0).map(v => expect.closeTo(v, 1))));

  const drawing = plot();
  unmount();
  expect(drawing.querySelector("svg")).toBeNull();
});

// The frame (where the band and the pointer sit) and the three tracks keep one x for the newest day in a phone's box, at
// the default text size and at twice it, and each title ends inside the box.
it.each([[16], [32]])("keeps the frame on the tracks and the titles in 343px at %ipx text", async px => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(343);
  document.documentElement.style.fontSize = `${px}px`;
  renderApp(<CacheChart view="v" series={{ bucket: "day", rows }} />);
  await waitFor(() => expect(filled(BARS)).toHaveLength(2 * FULL));
  const xs = [0, 1, 2, 3].map(a => x(19, a));
  expect(Math.max(...xs) - Math.min(...xs), xs.join(", ")).toBeLessThanOrEqual(.5);
  // jsdom has no canvas: zrender and labelWidth both take 0.6em a character.
  for (const [t] of titles()) expect(textX(t!) + t!.textContent!.length * 11 * (px / 16) * .6, t!.textContent!).toBeLessThanOrEqual(343);
});
