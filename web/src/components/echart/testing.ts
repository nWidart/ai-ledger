// Tests only: a stand-in for the ECharts runtime (design decision 10). test-setup mocks components/echart/load with
// fakeLoad, so a chart under test draws on a FakeChart that records what the wrapper asks of it and answers the questions
// the wrapper asks back, with no layout and no drawing. A test that needs real ECharts unmocks the load module.
//
// The fake has one grid, at fakeECharts.grid, over a category x axis (the points are the first x axis's `data`) and a value
// y axis from 0 to its `max` (1 when the option names none). The zoom window is kept in point indexes. It imitates:
// - setOption: each key the option names replaces the one before, as `replaceMerge` does for the keys it lists; the zoom
//   window survives unless the option's dataZoom names `startValue` and `endValue`.
// - dispatchAction: "dataZoom" moves the window and then fires "datazoom" with the payload, unless silent, as ECharts
//   does; "updateAxisPointer" moves `band` to the point under x, and `currTrigger: "leave"` hides it.
// - convertToPixel, convertFromPixel and containPixel over the grid, for a `gridIndex`, `xAxisIndex`, `yAxisIndex` or
//   `seriesIndex` finder of 0.
// - getOption: components as arrays, each dataZoom with the window as `startValue`, `endValue`, `start` and `end`.
// It is stricter than ECharts in one way: a call on a disposed chart, or a second live chart on one element, throws where
// ECharts would log a warning, since either is a wrapper bug.
import { act, waitFor } from "@testing-library/react";
import type { ECharts, ElementEvent, Payload, SetOptionOpts } from "./echarts";
import type { Runtime } from "./load";
import type * as Load from "./load";

/** The plot area, in px from the box's top left. */
export interface Grid { left: number; top: number; width: number; height: number }

type Handler = (event: unknown) => void;
type Finder = string | Record<string, unknown>;
type Option = Record<string, unknown>;
type Window = { from: number; to: number };

const COMPONENTS = ["dataZoom", "grid", "series", "xAxis", "yAxis"];
const list = (v: unknown): Option[] => (v == null ? [] : Array.isArray(v) ? v : [v]) as Option[];
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

class Listeners {
  private handlers = new Map<string, Handler[]>();
  on(name: string, handler: Handler) { this.handlers.set(name, [...this.listeners(name), handler]); }
  off(name?: string, handler?: Handler) {
    if (name == null) this.handlers.clear();
    else this.handlers.set(name, handler ? this.listeners(name).filter(h => h !== handler) : []);
  }
  trigger(name: string, event: unknown) { for (const h of this.listeners(name)) h(event); }
  listeners(name: string) { return this.handlers.get(name) ?? []; }
}

/** The chart's zrender: the pointer events the wrapper listens to ("mousemove", "click", "globalout"). */
export class FakeZr {
  readonly events = new Listeners();
  on(name: string, handler: (event: never) => void) { this.events.on(name, handler as Handler); return this; }
  off(name?: string, handler?: (event: never) => void) { this.events.off(name, handler as Handler | undefined); }
  trigger(name: string, event?: unknown) { this.events.trigger(name, event); }
  /** How many handlers listen to `name`. */
  listening(name: string) { return this.events.listeners(name).length; }
}

export class FakeChart {
  /** Every setOption call, in order, as it was given. */
  readonly options: { option: Option; opts: SetOptionOpts }[] = [];
  /** Every dispatchAction payload, in order. */
  readonly actions: Payload[] = [];
  /** Every resize call's options. */
  readonly resizes: ({ width?: number | "auto"; height?: number | "auto" } | undefined)[] = [];
  disposed = false;
  /** The point the axis-pointer band is over, or null while it is hidden. */
  band: number | null = null;
  /** The plot area; a test may move it before it fires events. */
  grid: Grid;
  readonly zr = new FakeZr();
  private readonly events = new Listeners();
  private current: Option = {};
  private window: Window | null = null;

  constructor(readonly dom: HTMLElement, readonly theme: unknown, readonly init: { renderer?: string } & Option) {
    this.grid = { ...fakeECharts.grid };
  }

  /** The option as the chart holds it now: the last value of each key setOption named. */
  get option(): Option { return this.current; }
  /** The last option given, for a test that reads one drawing. */
  get last(): Option | undefined { return this.options.at(-1)?.option; }
  /** How many points the category axis has. */
  get points(): number { return list(list(this.current.xAxis)[0]?.data).length; }
  /** The first and last point shown: the zoom window, or every point. */
  get shown(): Window {
    const n = this.points;
    if (!this.window || !list(this.current.dataZoom).length) return { from: 0, to: n - 1 };
    const from = clamp(this.window.from, 0, n - 1);
    return { from, to: clamp(this.window.to, from, n - 1) };
  }

  // ECharts' methods.

  getDom() { return this.dom; }
  getZr() { this.alive("getZr"); return this.zr; }
  isDisposed() { return this.disposed; }
  on(name: string, handler: (event: never) => void) { this.alive("on"); this.events.on(name.toLowerCase(), handler as Handler); return this; }
  off(name?: string, handler?: (event: never) => void) { this.events.off(name?.toLowerCase(), handler as Handler | undefined); return this; }

  setOption(option: Option, notMerge?: boolean | SetOptionOpts, lazyUpdate?: boolean) {
    this.alive("setOption");
    const opts: SetOptionOpts = typeof notMerge === "object" ? notMerge : { notMerge, lazyUpdate };
    this.options.push({ option, opts });
    this.current = opts.notMerge ? { ...option } : { ...this.current, ...option };
    const zoom = list(option.dataZoom)[0];
    if (opts.notMerge || !list(this.current.dataZoom).length) this.window = null;
    if (typeof zoom?.startValue === "number" && typeof zoom.endValue === "number") this.window = { from: zoom.startValue, to: zoom.endValue };
  }

  getOption(): Option {
    const out: Option = { ...this.current };
    for (const key of COMPONENTS) if (key in out) out[key] = list(out[key]).map(c => ({ ...c }));
    const { from, to } = this.shown, last = Math.max(1, this.points - 1);
    for (const zoom of list(out.dataZoom)) Object.assign(zoom, { startValue: from, endValue: to, start: from / last * 100, end: to / last * 100 });
    return out;
  }

  dispatchAction(payload: Payload, opt?: boolean | { silent?: boolean }) {
    this.alive("dispatchAction");
    this.actions.push(payload);
    if (payload.type === "updateAxisPointer") {
      this.band = payload.currTrigger === "leave" ? null : this.pointAtPixel(Number(payload.x), Number(payload.y));
    } else if (payload.type === "dataZoom") {
      this.moveWindow(payload);
      if (!(typeof opt === "boolean" ? opt : opt?.silent)) this.events.trigger("datazoom", { ...payload, type: "datazoom" });
    }
  }

  convertToPixel(finder: Finder, value: number | number[]): number | number[] {
    const axis = this.axisOf(finder, "convertToPixel");
    if (Array.isArray(value)) { const [i = NaN, v = NaN] = value; return [this.xPixel(i), this.yPixel(v)]; }
    return axis === "y" ? this.yPixel(value) : this.xPixel(value);
  }

  convertFromPixel(finder: Finder, value: number | number[]): number | number[] {
    const axis = this.axisOf(finder, "convertFromPixel");
    if (Array.isArray(value)) { const [x = NaN, y = NaN] = value; return [this.xPoint(x), this.yValue(y)]; }
    return axis === "y" ? this.yValue(value) : this.xPoint(value);
  }

  containPixel(finder: Finder, [x = NaN, y = NaN]: number[]): boolean {
    this.axisOf(finder, "containPixel");
    const g = this.grid;
    return x >= g.left && x <= g.left + g.width && y >= g.top && y <= g.top + g.height;
  }

  resize(opts?: { width?: number | "auto"; height?: number | "auto" }) { this.alive("resize"); this.resizes.push(opts); }

  dispose() {
    this.alive("dispose");
    this.disposed = true;
    this.events.off();
    this.zr.events.off();
  }

  // What a test does.

  /** The middle of point i, in px: where a pointer over it would be. */
  pointAt(i: number): [number, number] { return [this.xPixel(i), this.grid.top + this.grid.height / 2]; }

  /** A zrender pointer event at [x, y], such as `fire("mousemove", chart.pointAt(3))` or `fire("globalout")`. */
  fire(name: ElementEvent["type"], [x, y]: number[] = [0, 0]) {
    const event = {
      type: name, offsetX: x, offsetY: y, event: new MouseEvent(name === "globalout" ? "mouseout" : name),
      target: undefined, topTarget: undefined, cancelBubble: false, which: 1, stop() {},
    };
    act(() => { this.zr.trigger(name, event); });
  }

  /** An ECharts event, as `chart.on(name)` gets it. */
  emit(name: string, params: Option = {}) {
    act(() => { this.events.trigger(name.toLowerCase(), { type: name.toLowerCase(), ...params }); });
  }

  /** A drag of the zoom slider to show points from..to: the window moves and "datazoom" fires in percent, as the
   *  slider sends it. The wrapper reads the points from getOption(). Nothing is added to `actions`. */
  zoomTo(from: number, to: number) {
    const last = Math.max(1, this.points - 1);
    this.window = { from, to };
    this.emit("datazoom", { dataZoomId: "slider", start: from / last * 100, end: to / last * 100 });
  }

  /** How many handlers listen to the ECharts event `name`. */
  listening(name: string) { return this.events.listeners(name.toLowerCase()).length; }

  private alive(method: string) {
    if (this.disposed) throw new Error(`FakeChart.${method}() on a disposed chart`);
  }

  private axisOf(finder: Finder, method: string): "x" | "y" | "grid" {
    this.alive(method);
    const f = typeof finder === "string" ? { [`${finder}Index`]: 0 } : finder;
    const index = (key: string) => (key in f ? f[key] : undefined);
    const used = ["gridIndex", "xAxisIndex", "yAxisIndex", "seriesIndex"].filter(k => index(k) != null);
    if (!used.length) throw new Error(`FakeChart.${method}(): the fake knows only gridIndex, xAxisIndex, yAxisIndex and seriesIndex`);
    if (used.some(k => k !== "seriesIndex" && index(k) !== 0)) throw new Error(`FakeChart.${method}(): the fake has one grid and one axis of each kind`);
    return used.includes("xAxisIndex") ? "x" : used.includes("yAxisIndex") ? "y" : "grid";
  }

  /** The width of one point's band, in px, over the points shown. */
  private step(): number {
    const { from, to } = this.shown;
    return this.grid.width / Math.max(1, to - from + 1);
  }
  private xPixel(i: number) { return this.grid.left + (i - this.shown.from + .5) * this.step(); }
  private xPoint(x: number) {
    const { from, to } = this.shown;
    return to < from ? NaN : clamp(from + Math.floor((x - this.grid.left) / this.step()), from, to);
  }
  private yMax() {
    const max = list(this.current.yAxis)[0]?.max;
    return typeof max === "number" && max > 0 ? max : 1;
  }
  private yPixel(v: number) { return this.grid.top + this.grid.height * (1 - v / this.yMax()); }
  private yValue(y: number) { return (this.grid.top + this.grid.height - y) / this.grid.height * this.yMax(); }
  private pointAtPixel(x: number, y: number) { return this.containPixel({ gridIndex: 0 }, [x, y]) ? this.xPoint(x) : null; }

  private moveWindow(p: Payload) {
    const last = Math.max(0, this.points - 1);
    const at = (value: unknown, percent: unknown, fallback: number) =>
      typeof value === "number" ? value : typeof percent === "number" ? Math.round(percent / 100 * last) : fallback;
    const { from, to } = this.shown;
    this.window = { from: at(p.startValue, p.start, from), to: at(p.endValue, p.end, to) };
  }
}

type Settle = { ok: true } | { ok: false; error: unknown };

function init(...[dom, theme, opts]: Parameters<Runtime["init"]>): ECharts {
  if (!dom) throw new Error("FakeChart: init() needs an element");
  if (fakeECharts.live.some(c => c.dom === dom)) throw new Error("FakeChart: init() on an element that has a live chart");
  const chart = new FakeChart(dom, theme, { ...opts });
  fakeECharts.charts.push(chart);
  return chart as unknown as ECharts;
}
const runtime: Runtime = { init };
let held: Promise<Runtime> | undefined;

const DEFAULT_GRID: Grid = { left: 40, top: 10, width: 400, height: 200 };

/** The fake runtime's state, reset after each test (test-setup). */
export const fakeECharts = {
  /** Every chart made, in order, disposed ones too. */
  charts: [] as FakeChart[],
  /** How many times loadECharts() and preloadECharts() ran. */
  loads: 0,
  preloads: 0,
  /** The plot area each new chart starts with. */
  grid: { ...DEFAULT_GRID },
  /** The chart made last. */
  get last(): FakeChart | undefined { return this.charts.at(-1); },
  /** The charts not disposed. */
  get live(): FakeChart[] { return this.charts.filter(c => !c.disposed); },
  /** Makes loadECharts() wait until the test settles the load, so it can look at a chart before its runtime is there. */
  hold() {
    let settle!: (outcome: Settle) => void;
    const promise = new Promise<Runtime>((resolve, reject) => { settle = o => (o.ok ? resolve(runtime) : reject(o.error)); });
    promise.catch(() => {}); // a test may reject a load nothing waits for
    held = promise;
    const end = (outcome: Settle) => act(async () => {
      if (held === promise) held = undefined;
      settle(outcome);
      await promise.catch(() => {});
    });
    return {
      /** The runtime arrives: the charts waiting for it draw. */
      resolve: () => end({ ok: true }),
      /** The chunk fails to load. Later loads succeed again, as a retry would. */
      reject: (error: unknown = new Error("chunk failed to load")) => end({ ok: false, error }),
    };
  },
  reset() {
    this.charts = [];
    this.loads = 0;
    this.preloads = 0;
    this.grid = { ...DEFAULT_GRID };
    held = undefined;
  },
};

/** The load module that test-setup mocks components/echart/load with. */
export const fakeLoad: typeof Load = {
  loadECharts: () => { fakeECharts.loads++; return held ?? Promise.resolve(runtime); },
  preloadECharts: () => { fakeECharts.preloads++; },
};

/** The chart made last, once it has drawn: wait for it after a render. */
export const drawn = (): Promise<FakeChart> => waitFor(() => {
  const chart = fakeECharts.last;
  if (!chart || chart.disposed || !chart.options.length) throw new Error("no chart has drawn yet");
  return chart;
});
