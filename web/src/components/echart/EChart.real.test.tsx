import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getInstanceByDom } from "echarts/core";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { dayRange } from "../../format";
import { EChart, type Shown } from "./EChart";
import type { EChartsOption } from "./echarts";
import { baseOption, categoryAxis, FRAME_AXES, lineSeries, valueAxis, zoomSlider } from "./option";
import { box, probeColors, tokenOf } from "./realTesting";
import type { ChartEnv } from "./tokens";

// The wrapper's point keys on real ECharts (echart-point-keys, decision 9): the wrapper tests run on the fake runtime,
// which draws nothing. Here two days join at the front of a chart of 30, and the test reads what ECharts drew: the day
// labels, the band, the slider's handle, and each write of the tooltip's left edge as it is made.
vi.unmock("./load");

const DAYS = dayRange("2026-10-01", "2026-11-01"); // 32 days: the chart starts on the third, then the first two join
const option = (keys: readonly string[]) => (env: ChartEnv): EChartsOption => ({
  ...baseOption(env),
  grid: { left: 40, right: 20, top: 20, bottom: 40 },
  xAxis: categoryAxis(env, keys, k => k.slice(5)),
  yAxis: valueAxis(env, { max: 10, step: 5, format: String }),
  series: [lineSeries(env, { id: "cost", data: keys.map((_, i) => i % 10), color: "var(--proj-1)", ...FRAME_AXES })],
  dataZoom: [zoomSlider(env)],
});
const onZoom = vi.fn<(s: Shown | null) => void>();
const chart = (keys: readonly string[]) => <EChart label="Cost per day" height={300} option={option(keys)} view="30 days" points={keys.length}
  pointKeys={keys} tip={i => keys[i]} read={i => `${keys[i]} read`} zoom onZoom={onZoom}
  readZoom={s => (s ? `Showing ${keys[s.from]} to ${keys[s.to]}, ${s.to - s.from + 1} of ${keys.length}.` : `Showing all ${keys.length}.`)} />;

const plot = () => document.querySelector<HTMLElement>(".echart-plot")!;
const group = () => screen.getByRole("group");
const key = (k: string) => fireEvent.keyDown(group(), { key: k });
const live = () => document.querySelector(".sr[aria-live=polite]")!.textContent;
const tip = () => screen.getByRole("tooltip", { hidden: true });
/** Paints now what ECharts would paint on the next frame. */
const paint = () => act(() => getInstanceByDom(plot())!.getZr().flush());
const paths = () => [...plot().querySelectorAll("svg path")].filter(p => !p.closest("clipPath"));
/** The day labels drawn, as "MM-DD". */
const labels = () => [...plot().querySelectorAll("svg text")].map(t => t.textContent).filter(t => /^\d\d-\d\d$/.test(t ?? ""));
/** The band's box: the only path in the cursor ink. */
const band = () => paths().filter(p => tokenOf(p.getAttribute("fill")) === "var(--text-primary)").map(p => box(p.getAttribute("d")!));
/** The left handle: the slider draws each handle at 10 times its icon, at its middle's x and its bottom's y. */
const handle = () => Math.min(...paths().map(p => /^matrix\(10,0,0,-10,([\d.]+),/.exec(p.getAttribute("transform") ?? "")?.[1]).filter(x => x != null).map(Number));
/** Each write of the tooltip's left edge, in px, as it is made. */
const lefts = () => {
  const set = vi.spyOn(tip().style, "left", "set");
  return () => set.mock.calls.map(([v]) => parseFloat(v));
};
/** A mouse event on zrender's root, at a place in the plot (jsdom puts the plot at the page's top left). */
const mouse = (type: string, x: number, y = 286) => act(() => {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperties(e, { offsetX: { value: x }, offsetY: { value: y } });
  plot().querySelector("svg")!.parentElement!.dispatchEvent(e);
});
const release = (x: number) => { mouse("mouseup", x); fireEvent.pointerUp(document); };
const drawn = async () => {
  const r = render(chart(DAYS.slice(2)));
  await waitFor(() => expect(labels()).not.toHaveLength(0), { timeout: 5000 }); // the first test loads the runtime
  act(() => group().focus());
  return r.rerender;
};
/** Day 25 read by the keys in a zoomed chart; two days join: the same days, the same band, one write of the tooltip, to
 *  where it was, and nothing new in the live region. Returns what was drawn before. */
const joinKeepsTheReading = (rerender: (ui: ReactNode) => void) => {
  for (let k = 0; k < 8; k++) key("ArrowLeft");
  paint();
  const was = { ends: [labels()[0], labels().at(-1)], band: band(), tip: tip().textContent, live: live() };
  const left = parseFloat(tip().style.left), written = lefts();
  rerender(chart(DAYS));
  paint();
  expect({ ends: [labels()[0], labels().at(-1)], band: band(), tip: tip().textContent, live: live() }).toEqual(was);
  expect(written()).toEqual([expect.closeTo(left, 6)]);
  return was;
};
const READ = { ends: ["10-18", "11-01"], tip: "2026-10-25", live: "2026-10-25 read" };

beforeEach(() => { probeColors(); onZoom.mockClear(); });

it("keeps a key's reading and a window a key made on their days when two days join", async () => {
  const rerender = await drawn();
  key("+"); // the newest 15 days
  expect(joinKeepsTheReading(rerender)).toMatchObject(READ);
});

// ECharts holds a dragged window as a share of the points: after the join it would show other days until the wrapper
// sends the window again.
it("keeps a key's reading and a window a drag made on their days when two days join", async () => {
  const rerender = await drawn();
  paint();
  const x = handle();
  mouse("mousedown", x);
  mouse("mousemove", x + 370);
  release(x + 370);
  expect(onZoom).toHaveBeenLastCalledWith({ from: 15, to: 29 });
  expect(joinKeepsTheReading(rerender)).toMatchObject(READ);
});

it("puts a pointer's tooltip over its day's band when two days join and move the day from under the pointer", async () => {
  const rerender = await drawn();
  mouse("mousemove", 400, 140); // day 17
  paint();
  const [was] = band();
  const written = lefts();
  rerender(chart(DAYS));
  paint();
  const [now] = band();
  expect(tip().textContent).toBe("2026-10-17");
  expect(now!.cx).toBeCloseTo(Number(getInstanceByDom(plot())!.convertToPixel({ xAxisIndex: 0 }, DAYS.indexOf("2026-10-17"))), 1);
  expect(now!.cx - was!.cx).toBeCloseTo(23.9, 1);
  // jsdom gives the tooltip no width, so it goes 14px left of the point it is placed for: the band's middle.
  expect(written()).toEqual([expect.closeTo(now!.cx - 14, 1)]);
});

it("goes on with a drag when two days join under it, and says the days shown once, on the release", async () => {
  const rerender = await drawn();
  key("+");
  paint();
  const x = handle();
  mouse("mousedown", x);
  mouse("mousemove", x - 60);
  mouse("mousemove", x - 120);
  expect(onZoom).toHaveBeenLastCalledWith({ from: 10, to: 29 });
  rerender(chart(DAYS));
  paint();
  expect(onZoom).toHaveBeenLastCalledWith({ from: 12, to: 31 }); // the same days
  const jumped = handle();
  mouse("mousemove", x - 180);
  paint();
  expect(handle()).toBeCloseTo(jumped - 60, 1);
  expect(onZoom).toHaveBeenLastCalledWith({ from: 9, to: 31 });
  expect(live()).toBe(""); // the zoom sentence the drag made untrue was dropped; nothing said since
  const region = document.querySelector(".sr[aria-live=polite]")!, seen = new MutationObserver(() => {});
  seen.observe(region, { childList: true, characterData: true, subtree: true });
  release(x - 180);
  expect(live()).toBe("Showing 2026-10-10 to 2026-11-01, 23 of 32.");
  expect(seen.takeRecords()).toHaveLength(1);
});

it("draws seven days from the second when a window on the first seven loses its first day", async () => {
  const rerender = await drawn();
  key("+"); key("+"); key("+"); key("Home"); // the 7 first days, the first read
  paint();
  expect(labels()).toEqual(DAYS.slice(2, 9).map(d => d.slice(5)));
  rerender(chart(DAYS.slice(3)));
  paint();
  expect(labels()).toEqual(DAYS.slice(3, 10).map(d => d.slice(5)));
});
