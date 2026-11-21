import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prevented } from "../../testing";
import { setTheme } from "../../theme";
import { EChart, type EChartProps } from "./EChart";
import type { EChartsOption } from "./echarts";
import { drawn, fakeECharts, type FakeChart } from "./testing";
import type { ChartEnv } from "./tokens";

const LABEL = "Estimated cost per day, 3 days.";
const REPLACE = { replaceMerge: ["series", "xAxis", "yAxis", "grid"] };
const FAILED = "The chart could not be drawn. The data table below has its figures.";

// One line in a token color, at the size the env gives: enough to see what a drawing was made from.
const option = (env: ChartEnv): EChartsOption => ({
  grid: { width: env.width, height: env.height },
  xAxis: { type: "category", data: ["Mon", "Tue", "Wed"] },
  yAxis: { type: "value" },
  series: [{ type: "line", data: [1, 2, 3], lineStyle: { color: env.color("var(--proj-1)") } }],
});
const DAYS = ["Mon", "Tue", "Wed"];
const read = (i: number) => `${DAYS[i]}: $${i + 1}.00`;
const tip = (i: number) => <b>{DAYS[i]} tip</b>;
const show = (props: Partial<EChartProps> = {}) => <EChart label={LABEL} height={240} option={option} points={DAYS.length} read={read} tip={tip} {...props} />;
const box = () => screen.getByRole("group", { name: LABEL });
const plot = () => box().querySelector(".echart-plot")!;
/** The live region's text: the point being read, or "". */
const readout = () => document.querySelector(".sr[aria-live=polite]")!.textContent;
/** The tooltip, while it shows. */
const tooltip = () => screen.queryByRole("tooltip");
const key = (k: string, on: Element = box()) => fireEvent.keyDown(on, { key: k });
/** The band actions the chart was sent, as "at <point>" (read back from the pixel) or "leave". */
const bands = (chart: FakeChart) => chart.actions.filter(a => a.type === "updateAxisPointer")
  .map(a => (a.currTrigger === "leave" ? "leave" : `at ${chart.convertFromPixel({ xAxisIndex: 0 }, Number(a.x))}`));

// The probe's computed color by theme; jsdom resolves no var().
function themedColors() {
  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((el: Element, pseudo?: string | null) =>
    el instanceof HTMLElement && el.dataset.chartProbe !== undefined
      ? { color: document.documentElement.dataset.theme === "dark" ? "rgb(93, 155, 242)" : "rgb(42, 100, 200)" } as CSSStyleDeclaration
      : real(el, pseudo));
}

// A ResizeObserver a test fires, over a box whose width it sets; jsdom lays nothing out.
function fakeBox(width: number) {
  const observers: { els: Element[]; fire: () => void; live: boolean }[] = [];
  vi.stubGlobal("ResizeObserver", class {
    private readonly self = { els: [] as Element[], fire: () => this.cb([], this as unknown as ResizeObserver), live: true };
    constructor(private readonly cb: ResizeObserverCallback) { observers.push(this.self); }
    observe(el: Element) { this.self.els.push(el); }
    unobserve() {}
    disconnect() { this.self.live = false; }
  });
  const client = vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(width);
  return {
    observers,
    /** The box becomes `to` px wide: the observer fires, and the frame it asks for runs. */
    resize: (to: number) => act(async () => {
      client.mockReturnValue(to);
      observers.filter(o => o.live).forEach(o => o.fire());
      await new Promise<void>(done => { requestAnimationFrame(() => done()); });
    }),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setTheme("system");
});

describe("EChart", () => {
  it("is a focusable group with the chart's label and description, around a plot hidden from assistive technology", async () => {
    render(<>{show({ id: "spendChart", className: "cost-chart", describedBy: "spendHint" })}<p id="spendHint">At list prices.</p></>);
    expect(box().id).toBe("spendChart");
    expect(box().className).toBe("echart cost-chart");
    expect(box().tabIndex).toBe(0);
    expect(box().getAttribute("aria-describedby")).toBe("spendHint");
    expect(plot().getAttribute("aria-hidden")).toBe("true");
    const chart = await drawn();
    expect(chart.dom).toBe(plot());
    expect(screen.queryByText(FAILED)).toBeNull();
  });

  it("has its height before the runtime resolves", async () => {
    const load = fakeECharts.hold();
    render(show());
    expect(box().style.height).toBe("240px");
    expect(fakeECharts.loads).toBe(1);
    expect(fakeECharts.charts).toEqual([]);
    expect(plot().childNodes).toHaveLength(0);
    await load.resolve();
    await drawn();
    expect(box().style.height).toBe("240px");
  });

  it("makes the chart with the SVG renderer at the box's size, and draws the option with replaceMerge", async () => {
    fakeBox(600);
    render(show());
    const chart = await drawn();
    expect(chart.init).toEqual({ renderer: "svg", width: 600, height: 240 });
    expect(chart.options).toHaveLength(1);
    expect(chart.options[0]!.opts).toEqual(REPLACE);
    expect(chart.last).toMatchObject({ grid: { width: 600, height: 240 }, xAxis: { data: ["Mon", "Tue", "Wed"] }, series: [{ type: "line" }] });
  });

  it("makes one chart under StrictMode's double mount, and disposes it on unmount", async () => {
    const { unmount } = render(<StrictMode>{show()}</StrictMode>);
    const chart = await drawn();
    expect(fakeECharts.charts).toEqual([chart]);
    unmount();
    expect(chart.disposed).toBe(true);
    expect(fakeECharts.live).toEqual([]);
  });

  it("makes no chart when it unmounts before the runtime resolves", async () => {
    const load = fakeECharts.hold();
    const { unmount } = render(show());
    unmount();
    await load.resolve();
    expect(fakeECharts.charts).toEqual([]);
  });

  it("draws again in the new colors on a theme change, on the same chart", async () => {
    themedColors();
    render(show());
    const chart = await drawn();
    expect(chart.last).toMatchObject({ series: [{ lineStyle: { color: "rgb(42, 100, 200)" } }] });
    const resizes = chart.resizes.length;
    act(() => setTheme("dark"));
    expect(chart.options).toHaveLength(2);
    expect(chart.options[1]).toMatchObject({ option: { series: [{ lineStyle: { color: "rgb(93, 155, 242)" } }] }, opts: REPLACE });
    expect(chart.resizes).toHaveLength(resizes); // a theme is not a size
    expect(fakeECharts.charts).toEqual([chart]);
  });

  it("draws again on a new option function, and not on a render with the same one", async () => {
    const { rerender } = render(show());
    const chart = await drawn();
    rerender(show());
    expect(chart.options).toHaveLength(1);
    const other = (env: ChartEnv): EChartsOption => ({ ...option(env), series: [] });
    rerender(show({ option: other }));
    expect(chart.options).toHaveLength(2);
    expect(chart.options[1]).toMatchObject({ option: { series: [] }, opts: REPLACE });
    expect(fakeECharts.charts).toEqual([chart]);
  });

  it("resizes the chart and draws again at the new size when the box's size changes", async () => {
    const sized = fakeBox(600);
    const { rerender, unmount } = render(show());
    const chart = await drawn();
    expect(sized.observers.map(o => o.els)).toEqual([[box()]]); // one observer, on the box
    await sized.resize(320);
    expect(chart.resizes.at(-1)).toEqual({ width: 320, height: 240 });
    expect(chart.last).toMatchObject({ grid: { width: 320, height: 240 } });
    expect(chart.options.at(-1)!.opts).toEqual(REPLACE);

    rerender(show({ height: 268 }));
    expect(box().style.height).toBe("268px");
    expect(chart.resizes.at(-1)).toEqual({ width: 320, height: 268 });
    expect(chart.last).toMatchObject({ grid: { width: 320, height: 268 } });

    unmount();
    expect(sized.observers.map(o => o.live)).toEqual([false]);
  });

  it("stays made while hidden, and keeps the width it had", async () => {
    const sized = fakeBox(600);
    const { rerender } = render(show());
    const chart = await drawn();
    rerender(show({ hidden: true }));
    expect(screen.getByLabelText(LABEL).hidden).toBe(true); // a hidden group has no accessible name to find it by
    await sized.resize(0); // display: none
    expect(chart.disposed).toBe(false);
    expect(chart.last).toMatchObject({ grid: { width: 600 } });
  });

  it("turns animation off under reduced motion, whatever the option says", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q === "(prefers-reduced-motion: reduce)", media: q, addEventListener() {}, removeEventListener() {} }));
    render(show({ option: env => ({ ...option(env), animation: true }) }));
    expect((await drawn()).last).toMatchObject({ animation: false });
  });

  it("leaves animation to the option when motion is allowed", async () => {
    render(show({ option: env => ({ ...option(env), animation: true }) }));
    expect((await drawn()).last).toMatchObject({ animation: true });
  });

  it("shows the failure text and keeps the group when the runtime fails to load", async () => {
    const load = fakeECharts.hold();
    render(show());
    await load.reject();
    expect(box().textContent).toBe(FAILED);
    expect(box().style.height).toBe("240px");
    expect(box().tabIndex).toBe(0);
    expect(plot().getAttribute("aria-hidden")).toBe("true");
    expect(plot().contains(screen.getByText(FAILED))).toBe(false); // the words are not hidden with the plot
    expect(fakeECharts.charts).toEqual([]);
  });
});

describe("EChart reading", () => {
  it("reads the first point on the first Right and the last on the first Left", async () => {
    const { unmount } = render(show());
    await drawn();
    expect(readout()).toBe("");
    expect(tooltip()).toBeNull();
    expect(key("ArrowRight")).toBe(false); // the page does not scroll
    expect(readout()).toBe("Mon: $1.00");
    expect(tooltip()!.textContent).toBe("Mon tip");
    unmount();

    render(show());
    await drawn();
    key("ArrowLeft");
    expect(readout()).toBe("Wed: $3.00");
    expect(tooltip()!.textContent).toBe("Wed tip");
  });

  it("steps with Left and Right and stops at each end, and jumps with Home and End", async () => {
    render(show());
    await drawn();
    const reads = (keys: string[]) => keys.map(k => { key(k); return readout(); });
    expect(reads(["ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight"])).toEqual(["Mon: $1.00", "Tue: $2.00", "Wed: $3.00", "Wed: $3.00"]);
    expect(reads(["Home", "ArrowLeft", "End", "ArrowLeft"])).toEqual(["Mon: $1.00", "Mon: $1.00", "Wed: $3.00", "Tue: $2.00"]);
    expect(key("Home")).toBe(false);
    expect(key("End")).toBe(false);
  });

  it("leaves keys with a modifier to the browser, and keys it does not read", async () => {
    render(show({ onActivate: () => {} }));
    await drawn();
    expect(prevented(box())).toEqual([]);
    expect(readout()).toBe("");
    expect(key("a")).toBe(true);
    expect(key("ArrowDown")).toBe(true);
    key("ArrowRight");
    expect(prevented(box())).toEqual([]);
    expect(readout()).toBe("Mon: $1.00"); // Alt+Escape did not close it, Ctrl+Enter did not activate it
  });

  it("reads nothing in a chart with no points", async () => {
    render(show({ points: 0 }));
    await drawn();
    expect(key("ArrowRight")).toBe(true);
    expect(readout()).toBe("");
  });

  it("activates the point being read on Enter, and only with a reading open", async () => {
    const onActivate = vi.fn<(i: number) => void>();
    render(show({ onActivate }));
    await drawn();
    expect(key("Enter")).toBe(true);
    expect(onActivate).not.toHaveBeenCalled();
    key("ArrowRight");
    key("ArrowRight");
    expect(key("Enter")).toBe(false);
    expect(onActivate.mock.calls).toEqual([[1]]);
    expect(readout()).toBe(""); // the reading ends with the selection, as it does today
  });

  it("leaves Enter alone in a chart that selects nothing", async () => {
    render(show());
    await drawn();
    key("ArrowRight");
    expect(key("Enter")).toBe(true);
    expect(readout()).toBe("Mon: $1.00");
  });

  it("keeps the reading when the chart declines the activation, by Enter or by a click", async () => {
    // Tue has nothing to open: the handler says so, and the reading stays for the next key.
    const onActivate = vi.fn<(i: number) => boolean | void>(i => i !== 1);
    render(show({ onActivate }));
    const chart = await drawn();
    key("ArrowRight");
    key("ArrowRight");
    expect(key("Enter")).toBe(false); // still the chart's key
    expect(onActivate.mock.calls).toEqual([[1]]);
    expect(readout()).toBe("Tue: $2.00");
    expect(tooltip()!.textContent).toBe("Tue tip");
    expect(chart.band).toBe(1);
    key("ArrowRight");
    expect(readout()).toBe("Wed: $3.00");

    chart.fire("mousemove", chart.pointAt(1));
    chart.fire("click", chart.pointAt(1));
    expect(onActivate.mock.calls).toEqual([[1], [1]]);
    expect(readout()).toBe("Tue: $2.00");
    expect(tooltip()!.textContent).toBe("Tue tip");

    chart.fire("click", chart.pointAt(0)); // accepted: the reading ends
    expect(onActivate.mock.calls).toEqual([[1], [1], [0]]);
    expect(readout()).toBe("");
  });

  it("clears the reading on Escape on the box when an element around it stops the key", async () => {
    // SessionMap's box and Toggletip stop an Escape they handle: it then never reaches the document.
    render(<div onKeyDown={ev => { if (ev.key === "Escape") ev.stopPropagation(); }}>{show()}</div>);
    await drawn();
    key("ArrowRight");
    key("Escape");
    expect(readout()).toBe("");
    expect(tooltip()).toBeNull();
  });

  it("lets Escape go on to what is around the chart, with a reading open or not", async () => {
    const around: string[] = [], onDocument: boolean[] = [];
    const seen = (ev: KeyboardEvent) => { if (ev.key === "Escape") onDocument.push(ev.defaultPrevented); };
    document.addEventListener("keydown", seen);
    try {
      render(<div onKeyDown={ev => { if (ev.key === "Escape") around.push(readout()); }}>{show()}</div>);
      const chart = await drawn();
      expect(key("Escape")).toBe(true); // nothing read: not the chart's key
      key("ArrowRight");
      expect(key("Escape")).toBe(true); // the reading ends, and a sheet around the chart still gets its Escape
      expect(readout()).toBe("");
      expect(around).toHaveLength(2);
      expect(onDocument).toEqual([false, false]);
      expect(bands(chart)).toEqual(["at 0", "leave"]); // cleared once, by the box
    } finally {
      document.removeEventListener("keydown", seen);
    }
  });

  it("clears the reading on Escape, on the box and anywhere in the document, and not with a modifier", async () => {
    render(<>{show()}<button type="button">Elsewhere</button></>);
    await drawn();
    key("ArrowRight");
    key("Escape");
    expect(readout()).toBe("");
    expect(tooltip()).toBeNull();

    key("ArrowRight");
    const other = screen.getByRole("button", { name: "Elsewhere" });
    fireEvent.keyDown(other, { key: "Escape", altKey: true });
    expect(readout()).toBe("Mon: $1.00");
    fireEvent.keyDown(other, { key: "Escape" });
    expect(readout()).toBe("");
    expect(tooltip()).toBeNull();
  });

  it("clears the reading on blur", async () => {
    render(show());
    await drawn();
    key("ArrowRight");
    fireEvent.blur(box());
    expect(readout()).toBe("");
    expect(tooltip()).toBeNull();
  });

  it("reads the point under the pointer inside the grid, with the tooltip beside the pointer, and none outside it", async () => {
    render(show());
    const chart = await drawn();
    chart.fire("mousemove", chart.pointAt(1));
    expect(readout()).toBe("Tue: $2.00");
    expect(tooltip()!.textContent).toBe("Tue tip");
    // tipAt: 14px from the pointer and 10px above it (the fake's point 1 is at 240, 110). jsdom's box has no width, so
    // tipAt takes the pointer for the right edge and puts the tooltip on its left.
    expect([tooltip()!.style.left, tooltip()!.style.top]).toEqual(["226px", "100px"]);
    chart.fire("mousemove", [250, 60]); // the same point: the tooltip follows the pointer
    expect(readout()).toBe("Tue: $2.00");
    expect([tooltip()!.style.left, tooltip()!.style.top]).toEqual(["236px", "50px"]);

    chart.fire("mousemove", [20, 110]); // left of the grid, over the value labels
    expect(readout()).toBe("");
    expect(tooltip()).toBeNull();
    chart.fire("mousemove", chart.pointAt(2));
    expect(readout()).toBe("Wed: $3.00");
    chart.fire("globalout");
    expect(readout()).toBe("");
  });

  it("puts the tooltip over the point a key reads, under the top of the grid", async () => {
    render(show());
    const chart = await drawn();
    key("End");
    // The fake's last point is at x 373.33 and its grid starts at y 10: found within 4px, 20px lower, then tipAt's 14 and 10.
    expect(parseFloat(tooltip()!.style.left)).toBeCloseTo(chart.pointAt(2)[0] - 14, 2);
    expect(tooltip()!.style.top).toBe("22px");
  });

  it("moves a key's tooltip to the drawn point once the chart draws, and again after a redraw that moves the points", async () => {
    const load = fakeECharts.hold();
    render(show());
    key("ArrowRight");
    key("ArrowRight");
    expect([tooltip()!.style.left, tooltip()!.style.top]).toEqual(["386px", "10px"]); // no grid yet: its share of the box
    await load.resolve();
    const chart = await drawn();
    expect(chart.band).toBe(1);
    expect([tooltip()!.style.left, tooltip()!.style.top]).toEqual(["226px", "22px"]); // over the band: the fake's point 1 is at x 240

    chart.grid = { left: 100, top: 30, width: 300, height: 150 }; // what a resize does to the plot
    act(() => setTheme("dark"));
    expect(chart.band).toBe(1);
    expect([tooltip()!.style.left, tooltip()!.style.top]).toEqual(["236px", "42px"]); // point 1 is now at x 250, the grid's top at 30
  });

  it("leaves the pointer's tooltip beside the pointer after a redraw", async () => {
    render(show());
    const chart = await drawn();
    chart.fire("mousemove", [250, 60]);
    act(() => setTheme("dark"));
    expect([tooltip()!.style.left, tooltip()!.style.top]).toEqual(["236px", "50px"]);
  });

  it("shows a hand over a point that a click activates, and the default cursor elsewhere", async () => {
    const { rerender } = render(show({ onActivate: () => {} }));
    const chart = await drawn();
    expect(chart.zr.cursor).toBe("default");
    chart.fire("mousemove", chart.pointAt(1));
    expect(chart.zr.cursor).toBe("pointer");
    chart.fire("mousemove", [250, 60]); // the same point: zrender sets the default again on each move
    expect(chart.zr.cursor).toBe("pointer");
    chart.fire("mousemove", [20, 110]); // over the value labels
    expect(chart.zr.cursor).toBe("default");

    rerender(show()); // a chart that selects nothing
    chart.fire("mousemove", chart.pointAt(1));
    expect(readout()).toBe("Tue: $2.00");
    expect(chart.zr.cursor).toBe("default");
  });

  it("activates the point clicked inside the grid, and none outside it", async () => {
    const onActivate = vi.fn<(i: number) => void>();
    render(show({ onActivate }));
    const chart = await drawn();
    chart.fire("click", [20, 110]);
    expect(onActivate).not.toHaveBeenCalled();
    chart.fire("mousemove", chart.pointAt(2));
    chart.fire("click", chart.pointAt(2));
    expect(onActivate.mock.calls).toEqual([[2]]);
    expect(readout()).toBe("");
  });

  it("moves the band with the cursor: one action a move, one leave a clear", async () => {
    render(show());
    const chart = await drawn();
    expect(bands(chart)).toEqual([]);
    key("ArrowRight");
    expect(bands(chart)).toEqual(["at 0"]);
    expect(chart.band).toBe(0);
    key("End");
    key("End"); // already there: nothing to move
    expect(bands(chart)).toEqual(["at 0", "at 2"]);
    expect(chart.band).toBe(2);
    key("Escape");
    key("Escape");
    expect(bands(chart)).toEqual(["at 0", "at 2", "leave"]);
    expect(chart.band).toBeNull();

    chart.fire("mousemove", chart.pointAt(1));
    chart.fire("mousemove", [250, 60]);
    expect(bands(chart).slice(3)).toEqual(["at 1"]);
    expect(chart.band).toBe(1);
    fireEvent.blur(box());
    chart.fire("globalout");
    expect(bands(chart).slice(3)).toEqual(["at 1", "leave"]);
    expect(chart.band).toBeNull();
  });

  it("reads before the runtime resolves, and the band joins the cursor once the chart has drawn", async () => {
    const load = fakeECharts.hold();
    const onActivate = vi.fn<(i: number) => void>();
    render(show({ onActivate }));
    key("ArrowRight");
    key("ArrowRight");
    expect(readout()).toBe("Tue: $2.00");
    expect(tooltip()!.textContent).toBe("Tue tip");
    // No grid yet: the point's share of the box (the middle of 800px), under its top.
    expect([tooltip()!.style.left, tooltip()!.style.top]).toEqual(["386px", "10px"]);
    key("Escape");
    expect(readout()).toBe("");
    key("End");
    key("Enter");
    expect(onActivate.mock.calls).toEqual([[2]]);
    key("Home");
    fireEvent.blur(box());
    expect(readout()).toBe("");
    expect(fakeECharts.charts).toEqual([]);

    key("ArrowRight");
    await load.resolve();
    const chart = await drawn();
    expect(readout()).toBe("Mon: $1.00");
    expect(bands(chart)).toEqual(["at 0"]);
    expect(chart.band).toBe(0);
  });

  it("ends the reading on a new option function, and keeps it on a theme change, with the band back on its point", async () => {
    const { rerender } = render(show());
    const chart = await drawn();
    key("End");
    act(() => setTheme("dark"));
    expect(readout()).toBe("Wed: $3.00");
    expect(tooltip()!.textContent).toBe("Wed tip");
    expect(bands(chart)).toEqual(["at 2", "at 2"]); // the redraw may have dropped the band: it is sent again
    expect(chart.band).toBe(2);

    // Two points now: the old reading names a point the new drawing does not have.
    const fewer = (env: ChartEnv): EChartsOption => ({ ...option(env), xAxis: { type: "category", data: DAYS.slice(0, 2) } });
    const tips: number[] = [];
    rerender(show({ option: fewer, points: 2, tip: i => { tips.push(i); return tip(i); } }));
    expect(readout()).toBe("");
    expect(tooltip()).toBeNull();
    expect(tips).toEqual([]); // never asked for a point of the old drawing
    expect(bands(chart).at(-1)).toBe("leave");
    expect(chart.band).toBeNull();
    key("ArrowLeft");
    expect(readout()).toBe("Tue: $2.00");
  });

  it("has no tooltip without a tip, and still reads", async () => {
    render(show({ tip: undefined }));
    await drawn();
    key("ArrowRight");
    expect(box().querySelector(".tip")).toBeNull();
    expect(readout()).toBe("Mon: $1.00");
  });

  it("listens to the chart's pointer once, and lets go of the document when the reading ends", async () => {
    const { unmount } = render(<StrictMode>{show()}</StrictMode>);
    const chart = await drawn();
    expect(["mousemove", "click", "globalout"].map(n => chart.zr.listening(n))).toEqual([1, 1, 1]);
    const on = vi.spyOn(document, "addEventListener"), off = vi.spyOn(document, "removeEventListener");
    const count = (spy: typeof on) => spy.mock.calls.filter(([name]) => name === "keydown").length;
    key("ArrowRight");
    key("ArrowRight");
    key("Escape");
    expect(count(off)).toBe(count(on));
    key("ArrowRight");
    unmount();
    expect(count(off)).toBe(count(on));
    expect(chart.disposed).toBe(true);
  });
});
