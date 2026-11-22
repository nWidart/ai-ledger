import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { GrowthPoint } from "../../api";
import { color, setOrder } from "../../colors";
import { labelWidth, type OptionEnv } from "../../components/echart/option";
import { box, probeColors, textX, tokenOf } from "../../components/echart/realTesting";
import { renderApp } from "../../testing";
import { GrowthChart } from "./GrowthChart";
import { growthLayout } from "./growthCurves";

// The growth chart on real ECharts (echart-context, decision 12): the other tests draw on the fake runtime, which draws
// nothing, and growthCurves.test.ts proves the model and the option. This one looks at the SVG ECharts writes: the band,
// the lines in their colors, the strip under the curve's points, the labels, the reading band over both tracks, the 80%
// line, the isolation, a curve of one turn, and the strip's title in a phone's box. Text widths are jsdom's estimate.
vi.unmock("../../components/echart/load");

// 40 turns, 60 sessions down to 21; foo over all of them, bar to turn 25 only.
const pt = (turn: number, median: number, sessions: number): GrowthPoint => ({ turn, median, p25: median * .7, p75: median * 1.4, sessions });
const curve = Array.from({ length: 40 }, (_, i) => pt(i + 1, 20_000 + i * 3000, 60 - i));
const share = curve.map(p => ({ ...p, median: p.median / 2e5, p25: p.p25 / 2e5, p75: p.p75 / 2e5 }));
const foo = { project: "foo", sessions: 30, curve: curve.map(p => ({ ...p, median: p.median * 1.2 })), share_curve: share };
const bar = { project: "bar", sessions: 20, curve: curve.slice(0, 25).map(p => ({ ...p, median: p.median * .6 })), share_curve: [] };

const plot = () => document.querySelector<HTMLElement>(".echart-plot")!;
const paths = () => [...plot().querySelectorAll("svg path")].filter(p => !p.closest("clipPath"));
const texts = () => [...plot().querySelectorAll("svg text")];
const filled = (token: string) => paths().filter(p => tokenOf(p.getAttribute("fill")) === token);
const stroked = (token: string) => paths().filter(p => tokenOf(p.getAttribute("stroke")) === token);
/** A line's points, as the renderer writes them: "M x y L x y …". */
const vertices = (p: Element) => [...p.getAttribute("d")!.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(m => Number(m[1]));
/** The strip's bars, once their entry animation has ended. */
const strip = () => filled("var(--text-muted)").filter(p => p.getAttribute("fill-opacity") === "0.55");
const settled = (bars: number) => waitFor(() => {
  expect(strip()).toHaveLength(bars);
  expect(strip().every(p => !p.hasAttribute("transform"))).toBe(true);
}, { timeout: 5000 });

beforeEach(() => { probeColors(); setOrder(["foo", "bar"]); });
afterEach(() => { setOrder([]); document.documentElement.style.fontSize = ""; });

it("draws the band, the project lines, the median over its halo, the strip under its points, and reads, isolates and shares", async () => {
  renderApp(<GrowthChart view="v" curve={curve} projects={[foo, bar]} share={share} />);
  await settled(40);
  expect(filled("var(--text-secondary)")).toHaveLength(1);
  expect([color("foo"), color("bar")].map(c => stroked(c).map(p => vertices(p).length))).toEqual([[40], [25]]);
  const [halo] = stroked("var(--surface-1)"), [median] = stroked("var(--text-primary)");
  expect(halo!.getAttribute("stroke-width")).toBe("4.5");
  expect(paths().indexOf(halo!)).toBeLessThan(paths().indexOf(median!));
  const xs = vertices(median!);
  expect(strip().map((p, i) => Math.abs(box(p.getAttribute("d")!).cx - xs[i]!) < .5)).toEqual(Array(40).fill(true));
  // The turn labels under the frame: turn 1, the round turns, and the last right-aligned on its point.
  const labels = texts().filter(t => /^\d+$/.test(t.textContent!) && t.getAttribute("y"));
  expect(labels.map(t => t.textContent)).toEqual(["1", "10", "20", "30", "40"]);
  expect(labels.at(-1)!.getAttribute("text-anchor")).toBe("end");

  // Right reads turn 1: one band, over the frame from the curve's top to the strip's bottom.
  const group = screen.getByRole("group", { name: /^Median context/ }), { frame } = growthLayout(1);
  act(() => group.focus());
  fireEvent.keyDown(group, { key: "ArrowRight" });
  const cursor = () => paths().filter(p => tokenOf(p.getAttribute("fill")) === "var(--text-primary)" && p.getAttribute("fill-opacity") === "0.06");
  await waitFor(() => expect(cursor()).toHaveLength(1));
  const b = box(cursor()[0]!.getAttribute("d")!);
  expect([b.top, b.top + b.height]).toEqual([frame.top, frame.top + frame.height]);

  // foo isolated: its line alone, 3px, and the band in its color.
  fireEvent.click(screen.getByRole("button", { name: /^foo/ }));
  await waitFor(() => expect(stroked(color("bar"))).toHaveLength(0));
  expect(stroked(color("foo")).map(p => p.getAttribute("stroke-width"))).toEqual(["3"]);
  expect([filled("var(--text-secondary)").length, filled(color("foo")).length]).toEqual([0, 1]);

  // The share of the window: the dashed 80% line and its label.
  fireEvent.click(screen.getByRole("button", { name: "Share of window" }));
  await waitFor(() => expect(paths().filter(p => p.getAttribute("stroke-dasharray") === "4,3")).toHaveLength(1));
  expect(texts().map(t => t.textContent)).toContain("80% of the window");
});

it("draws a curve of one turn as one dot", async () => {
  renderApp(<GrowthChart view="v" curve={curve.slice(0, 1)} projects={[]} />);
  await settled(1);
  expect(filled("var(--text-primary)").filter(p => /A2\.5 /.test(p.getAttribute("d")!))).toHaveLength(1);
});

// The strip's title keeps inside a phone's box, at the default text size and at twice it.
it.each([[16], [32]])("ends the strip's title inside 343px at %ipx text", async px => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(343);
  document.documentElement.style.fontSize = `${px}px`;
  renderApp(<GrowthChart view="v" curve={curve} projects={[foo, bar]} />);
  await settled(40);
  const title = texts().find(t => t.textContent!.startsWith("Sessions"))!;
  expect(textX(title) + labelWidth({ textScale: px / 16 } as OptionEnv, title.textContent!, 500)).toBeLessThanOrEqual(343);
});
