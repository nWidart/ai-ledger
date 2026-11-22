import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { box, centreX, probeColors, tokenOf } from "../../components/echart/realTesting";
import { renderApp } from "../../testing";
import { StartTrend } from "./StartTrend";

// The weekly start chart on real ECharts (echart-context, decision 12): the other tests draw on the fake runtime, which
// draws nothing, and startWeeks.test.ts proves the model and the option. This one looks at the SVG ECharts writes, in a
// phone's box: the band's runs and span, the median broken at the empty weeks, the hollow and solid dots, the 30k line,
// the newest week's label, and the reading band on an empty week.
vi.unmock("../../components/echart/load");

// 12 weeks from Sep 7: a run of 5 (the third of 2 sessions), an empty week, a lone week, an empty week, a run of 4.
const wk = (i: number) => ({ week: new Date(Date.UTC(2026, 8, 7 + 7 * i)).toISOString().slice(0, 10), median: 22_000 + i * 2000, p25: 18_000, p75: 30_000 + i * 2000, sessions: i === 2 ? 2 : 9 });
const trend = [0, 1, 2, 3, 4, 6, 8, 9, 10, 11].map(wk);

const plot = () => document.querySelector<HTMLElement>(".echart-plot")!;
const paths = () => [...plot().querySelectorAll("svg path")].filter(p => !p.closest("clipPath"));
const paint = (p: Element) => [tokenOf(p.getAttribute("fill")), tokenOf(p.getAttribute("stroke"))].join(" on ");
const dots = () => paths().filter(p => /A3 |A2\.5 /.test(p.getAttribute("d")!)).map(paint);
/** The median: the text-colored line, not a dot's ring. */
const median = () => paths().find(p => tokenOf(p.getAttribute("stroke")) === "var(--text-primary)" && !/A/.test(p.getAttribute("d")!))!;

beforeEach(() => {
  probeColors();
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(343);
});

it("draws the band's runs and span, the median in parts, the dots, the 30k line and the newest label, and reads an empty week", async () => {
  const { unmount } = renderApp(<StartTrend view="v" trend={trend} />);
  await waitFor(() => expect(dots()).toHaveLength(2));
  // Two runs as polygons, the lone week as a 7px span.
  const band = paths().filter(p => tokenOf(p.getAttribute("fill")) === "var(--text-secondary)" || tokenOf(p.getAttribute("stroke")) === "var(--text-secondary)");
  expect(band.map(p => p.getAttribute("stroke-width") ?? "polygon")).toEqual(["polygon", "7", "polygon"]);
  // The median broken at both empty weeks: the two runs and the lone week's point.
  const parts = median().getAttribute("d")!.split("M").slice(1).map(s => [...`M${s}`.matchAll(/[ML](-?[\d.]+) /g)].map(m => Number(m[1])));
  expect(parts.map(xs => xs.length)).toEqual([5, 1, 4]);
  // The week of 2 sessions hollow (the surface in a ring of the ink), the lone week solid; each on its week's point.
  expect(dots()).toEqual(["var(--surface-1) on var(--text-primary)", "var(--text-primary) on var(--surface-1)"]);
  const centres = paths().filter(p => /A/.test(p.getAttribute("d")!)).map(centreX);
  expect(centres.map(x => Math.round(x))).toEqual([parts[0]![2]!, parts[1]![0]!].map(Math.round));

  // The dashed 30k line, with its label at the plot's right edge over it.
  const dashed = paths().filter(p => p.getAttribute("stroke-dasharray") === "4,3");
  expect(dashed).toHaveLength(1);
  const label = [...plot().querySelectorAll("svg text")].find(t => t.textContent === "30k" && t.hasAttribute("x"))!, line = box(dashed[0]!.getAttribute("d")!);
  expect(Number(label.getAttribute("x"))).toBe(line.left + line.width);
  expect(Number(label.getAttribute("y"))).toBeLessThan(line.top);

  // The newest week labelled, right-aligned on its point: ECharts' thinning drops it in 343px otherwise.
  const weeks = [...plot().querySelectorAll("svg text")].filter(t => /^[A-Z][a-z]{2} \d+$/.test(t.textContent!));
  expect([weeks.at(-1)!.textContent, weeks.at(-1)!.getAttribute("text-anchor")]).toEqual(["Nov 23", "end"]);

  // Home, then Right to the first empty week: one band, centred between its neighbours' points.
  const group = screen.getByRole("group", { name: /^Median starting context/ });
  act(() => group.focus());
  for (const key of ["Home", "ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight"]) fireEvent.keyDown(group, { key });
  const cursor = () => paths().filter(p => tokenOf(p.getAttribute("fill")) === "var(--text-primary)" && p.getAttribute("fill-opacity") === "0.06");
  await waitFor(() => expect(cursor()).toHaveLength(1));
  expect(box(cursor()[0]!.getAttribute("d")!).cx).toBeCloseTo((parts[0]![4]! + parts[1]![0]!) / 2, 1);
  // The text doubles; a key redraws the chart in the same box, so at the scale that box was laid out for.
  document.documentElement.style.fontSize = "32px";
  fireEvent.keyDown(group, { key: "ArrowLeft" });
  await waitFor(() => expect(box(cursor()[0]!.getAttribute("d")!).cx).toBeCloseTo(parts[0]![4]!, 1));
  expect(Number(median().getAttribute("d")!.match(/M(-?[\d.]+) /)![1])).toBeCloseTo(parts[0]![0]!, 1);
  document.documentElement.style.fontSize = "";

  const drawing = plot();
  unmount();
  expect(drawing.querySelector("svg")).toBeNull();
});
