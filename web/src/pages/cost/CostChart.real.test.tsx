import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { UsagePayload } from "../../api";
import usage from "../../__fixtures__/usage";
import { setOrder } from "../../colors";
import { dayRange } from "../../format";
import { renderApp } from "../../testing";
import { CostChart } from "./CostChart";
import type { Stack } from "./cost";

// The one test on real ECharts (design decision 10): every other test draws on the fake runtime from test-setup. It checks
// that the option is one ECharts accepts and draws: SVG paths in the stacking's colors, a stack switch that leaves no path
// of the old stacking, and an unmount that takes the drawing with it.
vi.unmock("../../components/echart/load");

// jsdom resolves no var(), so every token would compute to black. The color probe answers each token with an rgb() of its
// own, which the drawing's fills can be told apart by.
const rgb = new Map<string, string>();
const resolved = (token: string) => {
  if (!rgb.has(token)) rgb.set(token, `rgb(${rgb.size + 1}, 100, 200)`);
  return rgb.get(token)!;
};

const days = dayRange("2026-10-16", "2026-11-04");
const row = usage.daily[0]!;
// 20 days: projects A and B own hues and C is Other; three models; both agents.
const d: UsagePayload = { ...usage, start: days[0]!, end: days.at(-1)!, range: 20, project: "", source: "",
  daily: days.map(day => ({ ...row, day, cost: 6, unpriced: 0 })),
  daily_projects: days.flatMap(day => [{ day, project: "A", cost: 3, tokens: 1 }, { day, project: "B", cost: 2, tokens: 1 }, { day, project: "C", cost: 1, tokens: 1 }]),
  daily_models: days.flatMap(day => [{ day, model: "m1", cost: 3 }, { day, model: "m2", cost: 2 }, { day, model: "m3", cost: 1 }]),
  daily_sources: days.flatMap(day => [{ day, source: "claude" as const, cost: 4 }, { day, source: "codex" as const, cost: 2 }]),
  by_project: ["A", "B", "C"].map((project, i) => ({ ...usage.by_project[0]!, project, cost: 20 * (3 - i), unpriced: 0 })) };

const chart = (stack: Stack) => <CostChart d={d} metric="cost" onMetric={() => {}} hidden={[]} onHidden={() => {}} scale="volume" onScale={() => {}}
  stack={stack} onStack={() => {}} onProject={() => {}} onSource={() => {}} onDay={() => {}} />;
const plot = () => document.querySelector<HTMLElement>(".echart-plot")!;
/** The fills of the drawn paths, as the token each one resolved from. */
const fills = () => {
  const names = new Map([...rgb].map(([token, c]) => [c, token]));
  return new Set([...plot().querySelectorAll("svg path")].map(p => names.get(p.getAttribute("fill") ?? "")).filter(Boolean));
};
/** Waits for the next drawing: ECharts paints on an animation frame. */
const drawnWith = async (want: string[], gone: string[] = []) => waitFor(() => {
  const now = fills();
  expect([...want].filter(t => !now.has(t))).toEqual([]);
  expect(gone.filter(t => now.has(t))).toEqual([]);
});

let errors: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  setOrder(["A", "B"]);
  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((el: Element, pseudo?: string | null) => {
    if (!(el instanceof HTMLElement) || el.dataset.chartProbe === undefined) return real(el, pseudo);
    return { color: resolved(/;color:(.*)$/.exec(el.getAttribute("style") ?? "")![1]!) } as CSSStyleDeclaration;
  });
  errors = vi.spyOn(console, "error");
});
afterEach(() => setOrder([]));

it("draws the stacking's colors on real ECharts, redraws a stack switch without the old paths, and unmount removes the svg", async () => {
  const { rerender, unmount } = renderApp(chart("project"));
  const projects = ["var(--proj-1)", "var(--proj-2)", "var(--proj-3)", "var(--proj-4)", "var(--proj-5)", "var(--proj-6)"];
  await drawnWith(["var(--proj-other)"]);
  const hued = projects.filter(t => fills().has(t));
  expect(hued).toHaveLength(2); // A and B in their hues, C in Other's grey
  expect(plot().querySelectorAll("svg path").length).toBeGreaterThanOrEqual(60); // 20 days of three segments

  rerender(chart("model"));
  await drawnWith(["var(--series-1)", "var(--series-2)", "var(--series-3)"], [...hued, "var(--proj-other)"]);

  rerender(chart("source"));
  await drawnWith(["var(--series-1)", "var(--series-2)"], ["var(--series-3)"]);

  const drawing = plot();
  expect(drawing.querySelector("svg")).not.toBeNull();
  unmount();
  expect(drawing.querySelector("svg")).toBeNull();
  expect(errors).not.toHaveBeenCalled(); // jsdom's "Not implemented" and React's warnings both come through here
});

// By default ECharts' axis pointer highlights the items on the day read: the stack's segments were redrawn in lifted colors
// that no token gives, and the 7-day average got a dot in ECharts' own palette (#b6d634). The band alone shows the reading.
it("keeps the day read in its kinds' colors, and draws nothing new over it but the band", async () => {
  const { unmount } = renderApp(chart("project"));
  await drawnWith(["var(--proj-other)"]);
  // The drawn paths' fills and strokes, as written; not the clip paths' defs.
  const paints = () => [...plot().querySelectorAll("svg path")].filter(p => !p.closest("clipPath"))
    .flatMap(p => [p.getAttribute("fill"), p.getAttribute("stroke")]).filter((c): c is string => !!c && c !== "none");
  // The paths filled with a token's color: the segments, each in its kind's color.
  const segments = () => { const tokens = new Set(rgb.values()); return [...plot().querySelectorAll("svg path")].filter(p => tokens.has(p.getAttribute("fill") ?? "")).length; };
  const before = { segments: segments(), paints: new Set(paints()) };
  const group = screen.getByRole("group", { name: /per day/ });
  act(() => group.focus());
  // Day 18 of 20: under the 7-day average, and not today's hatched bar.
  fireEvent.keyDown(group, { key: "End" });
  fireEvent.keyDown(group, { key: "ArrowLeft" });
  const text = rgb.get("var(--text-primary)")!.replaceAll(" ", "");
  await waitFor(() => expect(paints()).toContain(text)); // the band: the text ink at 6%
  await new Promise(settled => setTimeout(settled, 100)); // a highlight is drawn on a later frame than the band
  expect(segments()).toBe(before.segments);
  expect(paints().filter(c => !before.paints.has(c) && c !== text)).toEqual([]);
  unmount();
});
