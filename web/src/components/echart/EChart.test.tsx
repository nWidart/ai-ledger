import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef, StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prevented } from "../../testing";
import { setTheme } from "../../theme";
import { EChart, type EChartHandle, type EChartProps, type Shown } from "./EChart";
import type { EChartsOption } from "./echarts";
import { zoomSlider } from "./option";
import { drawn, fakeECharts, type FakeChart } from "./testing";
import type { ChartEnv } from "./tokens";

const LABEL = "Estimated cost per day, 3 days.";
const REPLACE = { replaceMerge: ["series", "xAxis", "yAxis", "grid", "dataZoom"] };
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

  it("animates the first draw only: newer data, a theme and a new view are drawn at once", async () => {
    const moving = (env: ChartEnv): EChartsOption => ({ ...option(env), animation: true });
    const { rerender, unmount } = render(show({ option: moving, view: "a" }));
    const chart = await drawn();
    expect(chart.last).toMatchObject({ animation: true });
    rerender(show({ option: env => moving(env), view: "a" })); // newer data: a bar that appears must not grow
    expect(chart.last).toMatchObject({ animation: false });
    act(() => setTheme("dark"));
    expect(chart.last).toMatchObject({ animation: false });
    rerender(show({ option: moving, view: "b" }));
    expect(chart.last).toMatchObject({ animation: false });
    expect(chart.options.map(o => o.option.animation)).toEqual([true, false, false, false]);

    unmount();
    render(show({ option: moving })); // another chart: its own first draw
    await waitFor(() => expect(fakeECharts.charts).toHaveLength(2));
    expect((await drawn()).options.map(o => o.option.animation)).toEqual([true]);
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

  it("lets no one but itself draw the band: a click on a declined point after Escape leaves none", async () => {
    render(show({ onActivate: () => false }));
    const chart = await drawn();
    // ECharts moves the band itself on a pointer move and on a click, unless its triggers are off.
    expect(chart.last).toMatchObject({ axisPointer: { triggerOn: "none" } });
    chart.fire("mousemove", chart.pointAt(1));
    expect(chart.band).toBe(1);
    key("Escape", document.body);
    expect(chart.band).toBeNull();
    chart.fire("click", chart.pointAt(1)); // the pointer has not moved: nothing is read, so no band may show
    expect(readout()).toBe("");
    expect(tooltip()).toBeNull();
    expect(chart.band).toBeNull();
  });

  it("keeps a chart's own axis-pointer settings beside its own", async () => {
    render(show({ option: env => ({ ...option(env), axisPointer: { link: [{ xAxisIndex: "all" }] } }) }));
    expect((await drawn()).last).toMatchObject({ axisPointer: { link: [{ xAxisIndex: "all" }], triggerOn: "none" } });
  });

  it("clears a pointer's reading on Escape from a control that stops the key, once, and leaves the key to that control", async () => {
    // A toggletip handles Escape and stops it: the key never bubbles to the document.
    const got: string[] = [];
    render(<>{show()}<button type="button" onKeyDown={ev => { got.push(ev.key); ev.stopPropagation(); }}>About Active time</button></>);
    const chart = await drawn();
    chart.fire("mousemove", chart.pointAt(1));
    const other = screen.getByRole("button", { name: "About Active time" });
    expect(fireEvent.keyDown(other, { key: "Escape" })).toBe(true); // not prevented
    expect(readout()).toBe("");
    expect(tooltip()).toBeNull();
    expect(got).toEqual(["Escape"]); // the control still got its key
    expect(bands(chart)).toEqual(["at 1", "leave"]);
    fireEvent.keyDown(other, { key: "Escape" }); // nothing read: the chart no longer listens
    expect(bands(chart)).toEqual(["at 1", "leave"]);
    expect(got).toEqual(["Escape", "Escape"]);
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

describe("EChart zoom", () => {
  // Thirty days with the zoom slider, as Cost draws a 30-day view.
  const MONTH = Array.from({ length: 30 }, (_, i) => `Oct ${i + 1}`);
  const month = (env: ChartEnv): EChartsOption => ({
    xAxis: { type: "category", data: MONTH },
    yAxis: { type: "value", max: 10 },
    series: [{ type: "line", data: MONTH.map((_, i) => i % 10), lineStyle: { color: env.color("var(--proj-1)") } }],
    dataZoom: [zoomSlider(env)],
  });
  const readDay = (i: number) => `${MONTH[i]}: $${i}.00`;
  const readZoom = (s: { from: number; to: number } | null) =>
    s ? `Showing ${MONTH[s.from]} to ${MONTH[s.to]}, ${s.to - s.from + 1} of 30 days.` : "Showing all 30 days.";
  const zoomed = (props: Partial<EChartProps> = {}) =>
    <EChart label={LABEL} height={268} option={month} points={MONTH.length} read={readDay} zoom readZoom={readZoom} {...props} />;
  /** The dataZoom actions the chart was sent, as [startValue, endValue], or "all" for a reset. */
  const zooms = (chart: FakeChart) => chart.actions.filter(a => a.type === "dataZoom")
    .map(a => (a.startValue == null ? "all" : [a.startValue, a.endValue]));
  const zoomSpy = () => vi.fn<(s: Shown | null) => void>();
  /** Reads day i from nothing read: Home, then Right. */
  const readTo = (i: number) => { key("Home"); for (let n = 0; n < i; n++) key("ArrowRight"); };

  it("halves the span with plus and doubles it with minus, around the last point when nothing is read", async () => {
    const onZoom = zoomSpy();
    render(zoomed({ onZoom }));
    const chart = await drawn();
    expect(key("+")).toBe(false);
    expect(chart.shown).toEqual({ from: 15, to: 29 });
    expect(readout()).toBe("Showing Oct 16 to Oct 30, 15 of 30 days.");
    expect(key("=")).toBe(false);
    expect(chart.shown).toEqual({ from: 22, to: 29 });
    expect(key("-")).toBe(false);
    expect(chart.shown).toEqual({ from: 14, to: 29 });
    key("-");
    expect(chart.shown).toEqual({ from: 0, to: 29 });
    expect(readout()).toBe("Showing all 30 days.");
    expect(onZoom.mock.calls).toEqual([[{ from: 15, to: 29 }], [{ from: 22, to: 29 }], [{ from: 14, to: 29 }], [null]]);
    expect(zooms(chart)).toEqual([[15, 29], [22, 29], [14, 29], "all"]);
  });

  it("zooms around the point being read, keeps the reading, and moves the band with the point", async () => {
    render(zoomed());
    const chart = await drawn();
    readTo(19);
    expect(readout()).toBe("Oct 20: $19.00");
    key("+"); // Oct 20 keeps its place in the window: about two thirds along
    expect(chart.shown).toEqual({ from: 10, to: 24 });
    expect(readout()).toBe("Showing Oct 11 to Oct 25, 15 of 30 days.");
    expect(chart.band).toBe(19);
    expect(bands(chart).at(-1)).toBe("at 19"); // sent again at the point's new place
    key("+");
    expect(chart.shown).toEqual({ from: 14, to: 21 });
    expect(chart.band).toBe(19);
    key("ArrowRight"); // the next key reads again
    expect(readout()).toBe("Oct 21: $20.00");
  });

  it("stops at 7 points and at every point", async () => {
    render(zoomed());
    const chart = await drawn();
    expect(key("-")).toBe(false); // every point already: the key is the chart's, and nothing changes
    expect(zooms(chart)).toEqual([]);
    key("+");
    key("+");
    key("+");
    expect(chart.shown).toEqual({ from: 23, to: 29 });
    expect(key("+")).toBe(false);
    expect(zooms(chart)).toHaveLength(3);
    expect(readout()).toBe("Showing Oct 24 to Oct 30, 7 of 30 days.");
  });

  it("takes plus with Shift, and leaves it to the browser with Ctrl, Alt or Meta", async () => {
    render(zoomed());
    const chart = await drawn();
    expect(fireEvent.keyDown(box(), { key: "+", ctrlKey: true })).toBe(true);
    expect(fireEvent.keyDown(box(), { key: "-", metaKey: true })).toBe(true);
    expect(fireEvent.keyDown(box(), { key: "=", altKey: true })).toBe(true);
    expect(zooms(chart)).toEqual([]);
    expect(fireEvent.keyDown(box(), { key: "+", shiftKey: true })).toBe(false);
    expect(chart.shown).toEqual({ from: 15, to: 29 });
    expect(fireEvent.keyDown(box(), { key: "ArrowRight", shiftKey: true })).toBe(true); // Shift is the zoom keys' only
  });

  it("leaves the zoom keys alone without zoom, and before the chart is drawn", async () => {
    const load = fakeECharts.hold();
    const { rerender } = render(zoomed());
    expect(key("+")).toBe(true);
    await load.resolve();
    const chart = await drawn();
    rerender(zoomed({ zoom: false }));
    expect(key("+")).toBe(true);
    expect(zooms(chart)).toEqual([]);
  });

  it("moves the days shown to include the point a key reads, and says the reading and the days shown", async () => {
    const { rerender } = render(zoomed());
    const chart = await drawn();
    const onZoom = zoomSpy();
    rerender(zoomed({ onZoom }));
    chart.zoomTo(5, 14);
    key("End");
    // One message for the one live region: the day the key asked for, then the days now shown.
    expect(readout()).toBe("Oct 30: $29.00 Showing Oct 21 to Oct 30, 10 of 30 days.");
    expect(zooms(chart).at(-1)).toEqual([20, 29]);
    expect(chart.shown).toEqual({ from: 20, to: 29 });
    expect(onZoom.mock.calls.at(-1)).toEqual([{ from: 20, to: 29 }]);
    expect(chart.band).toBe(29);
    key("ArrowLeft");
    expect(zooms(chart)).toHaveLength(1); // inside: nothing moves
    expect(readout()).toBe("Oct 29: $28.00"); // and nothing more to say
    key("Home");
    expect(chart.shown).toEqual({ from: 0, to: 9 });
    expect(readout()).toBe("Oct 1: $0.00 Showing Oct 1 to Oct 10, 10 of 30 days.");
    expect(chart.band).toBe(0);
    key("Escape");
    expect(readout()).toBe("");
  });

  it("moves the days shown without a word when the caller words no zoom", async () => {
    render(zoomed({ readZoom: undefined }));
    const chart = await drawn();
    chart.zoomTo(5, 14);
    key("End");
    expect(chart.shown).toEqual({ from: 20, to: 29 });
    expect(readout()).toBe("Oct 30: $29.00");
  });

  it("reports a drag of the slider, says the days shown, and reads the points it shows", async () => {
    const onZoom = zoomSpy();
    render(zoomed({ onZoom }));
    const chart = await drawn();
    chart.zoomTo(10, 19);
    expect(onZoom.mock.calls).toEqual([[{ from: 10, to: 19 }]]);
    expect(readout()).toBe("Showing Oct 11 to Oct 20, 10 of 30 days.");
    chart.fire("mousemove", chart.pointAt(12));
    expect(readout()).toBe("Oct 13: $12.00");
    chart.zoomTo(10, 19); // the same days: nothing to say
    expect(onZoom).toHaveBeenCalledTimes(1);
    expect(readout()).toBe("Oct 13: $12.00");
    chart.zoomTo(0, 29);
    expect(onZoom.mock.calls.at(-1)).toEqual([null]);
    expect(readout()).toBe("Showing all 30 days.");
    expect(zooms(chart)).toEqual([]); // the slider's own: the wrapper sends nothing back
  });

  it("ends the reading when the slider leaves its point out", async () => {
    render(zoomed());
    const chart = await drawn();
    key("End");
    chart.zoomTo(0, 9);
    expect(readout()).toBe("Showing Oct 1 to Oct 10, 10 of 30 days.");
    expect(tooltip()).toBeNull();
    expect(chart.band).toBeNull();
    expect(chart.shown).toEqual({ from: 0, to: 9 }); // the drag is kept
  });

  it("keeps the days shown on a theme change, and shows every point on a new option function", async () => {
    themedColors();
    const onZoom = zoomSpy();
    const { rerender } = render(zoomed({ onZoom }));
    const chart = await drawn();
    key("+");
    act(() => setTheme("dark"));
    expect(chart.last).toMatchObject({ series: [{ lineStyle: { color: "rgb(93, 155, 242)" } }] });
    expect(chart.shown).toEqual({ from: 15, to: 29 });
    expect(zooms(chart)).toHaveLength(1);
    expect(readout()).toBe("Showing Oct 16 to Oct 30, 15 of 30 days.");
    expect(onZoom).toHaveBeenCalledTimes(1);

    rerender(zoomed({ onZoom, option: env => month(env) }));
    expect(chart.shown).toEqual({ from: 0, to: 29 });
    expect(zooms(chart).at(-1)).toBe("all");
    expect(onZoom.mock.calls.at(-1)).toEqual([null]);
    expect(readout()).toBe(""); // a new drawing: nothing to say
    key("+"); // and it zooms from every point again
    expect(chart.shown).toEqual({ from: 15, to: 29 });
  });

  const short = (env: ChartEnv): EChartsOption => { const { dataZoom: _, ...rest } = month(env); return rest; };

  it("removes the slider when the option drops it, and says nothing of the old zoom", async () => {
    const onZoom = zoomSpy();
    const { rerender } = render(zoomed({ onZoom }));
    const chart = await drawn();
    chart.zoomTo(10, 19);
    expect(readout()).toBe("Showing Oct 11 to Oct 20, 10 of 30 days.");
    rerender(zoomed({ onZoom, option: short }));
    expect(chart.option.dataZoom).toEqual([]);
    expect(chart.shown).toEqual({ from: 0, to: 29 });
    expect(onZoom.mock.calls.at(-1)).toEqual([null]);
    expect(readout()).toBe("");
  });

  it("brings back no zoom, status or reading when the option goes back to a function it had", async () => {
    const onZoom = zoomSpy();
    const { rerender } = render(zoomed({ onZoom }));
    const chart = await drawn();
    key("+");
    rerender(zoomed({ onZoom, option: short }));
    rerender(zoomed({ onZoom, option: month }));
    expect(chart.shown).toEqual({ from: 0, to: 29 });
    expect(onZoom.mock.calls).toEqual([[{ from: 15, to: 29 }], [null]]);
    expect(readout()).toBe("");

    key("End");
    rerender(zoomed({ onZoom, option: short }));
    fireEvent.blur(box()); // nothing read on this drawing
    rerender(zoomed({ onZoom, option: month }));
    expect(readout()).toBe("");
    expect(tooltip()).toBeNull();
  });

  it("leaves the zoom keys to the browser when the option draws no slider, with zoom set", async () => {
    render(zoomed({ option: short }));
    const chart = await drawn();
    expect(key("+")).toBe(true);
    expect(key("-")).toBe(true);
    expect(zooms(chart)).toEqual([]);
    expect(readout()).toBe("");
  });

  it("says nothing when the chart keeps the window it showed", async () => {
    render(zoomed());
    const chart = await drawn();
    // ECharts clamps the window: the fake's action leaves it where it was, as a clamp to the same window does.
    const dispatch = chart.dispatchAction.bind(chart);
    vi.spyOn(chart, "dispatchAction").mockImplementation((p, opt) => { if (p.type !== "dataZoom") dispatch(p, opt); else chart.actions.push(p); });
    expect(key("+")).toBe(false);
    expect(chart.shown).toEqual({ from: 0, to: 29 });
    expect(readout()).toBe("");
  });

  it("shows every point again when zoom turns off, and reads no zoom when it turns on again", async () => {
    const onZoom = zoomSpy();
    const { rerender } = render(zoomed({ onZoom }));
    const chart = await drawn();
    key("+");
    rerender(zoomed({ onZoom, zoom: false }));
    expect(chart.shown).toEqual({ from: 0, to: 29 });
    expect(onZoom.mock.calls.at(-1)).toEqual([null]);
    expect(readout()).toBe("Showing all 30 days."); // the user did not ask for it: said once
    rerender(zoomed({ onZoom, zoom: true }));
    expect(onZoom.mock.calls.at(-1)).toEqual([null]);
    expect(readout()).toBe("Showing all 30 days.");
    key("+");
    expect(chart.shown).toEqual({ from: 15, to: 29 });
  });

  it("reports each step of a slider drag, and says the days shown once, when the drag ends", async () => {
    const onZoom = zoomSpy();
    render(zoomed({ onZoom }));
    const chart = await drawn();
    chart.fire("mousedown", [200, 250]); // on the slider, under the grid
    chart.zoomTo(10, 29);
    chart.zoomTo(10, 24);
    chart.zoomTo(10, 19);
    expect(onZoom.mock.calls).toEqual([[{ from: 10, to: 29 }], [{ from: 10, to: 24 }], [{ from: 10, to: 19 }]]);
    expect(readout()).toBe(""); // not while the drag goes on
    fireEvent.pointerUp(document.body); // the pointer lets go anywhere in the page, over the chart or not
    expect(readout()).toBe("Showing Oct 11 to Oct 20, 10 of 30 days.");
    chart.fire("mousedown", [200, 250]);
    fireEvent.pointerUp(document.body); // a press that moves nothing says nothing new
    chart.fire("mousemove", chart.pointAt(12));
    chart.fire("mousedown", chart.pointAt(12));
    fireEvent.pointerCancel(document.body);
    expect(readout()).toBe("Oct 13: $12.00");
  });

  it("says nothing on release when the view changed under a drag", async () => {
    const onZoom = zoomSpy();
    const { rerender } = render(zoomed({ onZoom, view: "30 days" }));
    const chart = await drawn();
    chart.fire("mousedown", [200, 250]);
    chart.zoomTo(10, 19); // a step of the drag: said on release
    rerender(zoomed({ onZoom, view: "30 days, from another first day" })); // a refresh moved the view's first day
    expect(chart.shown).toEqual({ from: 0, to: 29 });
    fireEvent.pointerUp(document.body);
    expect(readout()).toBe(""); // the drag changed the old view: the new one has nothing to say of it

    chart.fire("mousedown", [200, 250]); // a drag on the new view is said as ever
    chart.zoomTo(5, 14);
    fireEvent.pointerUp(document.body);
    expect(readout()).toBe("Showing Oct 6 to Oct 15, 10 of 30 days.");
  });

  it("lets go of the document once the pointer is up, and on unmount", async () => {
    const { unmount } = render(zoomed());
    const chart = await drawn();
    const on = vi.spyOn(document, "addEventListener"), off = vi.spyOn(document, "removeEventListener");
    const count = (spy: typeof on) => spy.mock.calls.filter(([name]) => String(name).startsWith("pointer")).length;
    chart.fire("mousedown", [200, 250]);
    expect(count(on)).toBe(2);
    fireEvent.pointerUp(document.body);
    expect(count(off)).toBe(2);
    chart.fire("mousedown", [200, 250]);
    unmount();
    expect(count(off)).toBe(4);
  });

  it("keeps one handle across renders, which reads the chart as it is now", async () => {
    const handles: (EChartHandle | null)[] = [];
    const ref = (h: EChartHandle | null) => { handles.push(h); };
    const { rerender } = render(zoomed({ ref }));
    const chart = await drawn();
    key("+");
    rerender(zoomed({ ref, readZoom: s => (s ? "zoomed" : "every day") }));
    expect(handles).toHaveLength(1);
    act(() => handles[0]!.reset());
    expect(chart.shown).toEqual({ from: 0, to: 29 });
    expect(readout()).toBe("every day");
  });

  it("shows every point again on reset(), and focuses the box on focus()", async () => {
    const ref = createRef<EChartHandle>(), onZoom = zoomSpy();
    render(<>{zoomed({ ref, onZoom })}<button type="button">Show all days</button></>);
    const chart = await drawn();
    act(() => ref.current!.reset()); // not zoomed: nothing to do
    expect(zooms(chart)).toEqual([]);
    chart.zoomTo(10, 19);
    screen.getByRole("button").focus();
    act(() => { ref.current!.reset(); ref.current!.focus(); });
    expect(chart.shown).toEqual({ from: 0, to: 29 });
    expect(zooms(chart)).toEqual(["all"]);
    expect(onZoom.mock.calls.at(-1)).toEqual([null]);
    expect(readout()).toBe("Showing all 30 days.");
    expect(document.activeElement).toBe(box());
  });

  // The view: what the user chose. While it is the same, a new option function is the same chart with newer data.
  const days = (n: number) => Array.from({ length: n }, (_, i) => `Oct ${i + 1}`);
  /** The chart's option for n days, a new function each call, as a refetch gives one. */
  const fresh = (n = 30, slider = true) => (env: ChartEnv): EChartsOption => ({
    ...month(env), xAxis: { type: "category", data: days(n) },
    series: [{ type: "line", data: days(n).map((_, i) => i % 10), lineStyle: { color: env.color("var(--proj-1)") } }],
    dataZoom: slider ? [zoomSlider(env)] : [],
  });
  const viewed = (props: Partial<EChartProps> = {}) => zoomed({ view: "30 days by project", option: fresh(), ...props });
  /** Counts the changes to the live region's text since the last call: what a screen reader would say. */
  const spoken = () => {
    const seen = new MutationObserver(() => {});
    seen.observe(document.querySelector(".sr[aria-live=polite]")!, { childList: true, characterData: true, subtree: true });
    return () => seen.takeRecords().length;
  };

  it("keeps the zoom and the reading when the same view draws newer data, and says nothing", async () => {
    const onZoom = zoomSpy();
    const { rerender } = render(viewed({ onZoom }));
    const chart = await drawn();
    key("+");
    expect(readout()).toBe("Showing Oct 16 to Oct 30, 15 of 30 days.");
    const said = spoken(), draws = chart.options.length;
    rerender(viewed({ onZoom }));
    expect(chart.options).toHaveLength(draws + 1); // drawn again
    expect(chart.shown).toEqual({ from: 15, to: 29 });
    expect(zooms(chart)).toEqual([[15, 29]]); // nothing sent: the chart kept its window
    expect(onZoom).toHaveBeenCalledTimes(1);
    expect(readout()).toBe("Showing Oct 16 to Oct 30, 15 of 30 days.");
    expect(said()).toBe(0);

    chart.fire("mousemove", chart.pointAt(20));
    expect(readout()).toBe("Oct 21: $20.00");
    const actions = bands(chart).length;
    expect(said()).toBe(1);
    rerender(viewed({ onZoom }));
    expect(readout()).toBe("Oct 21: $20.00");
    expect(said()).toBe(0); // the same words: a refresh every minute must not repeat them
    expect(chart.band).toBe(20);
    expect(bands(chart).slice(actions)).toEqual(["at 20"]); // the redraw dropped the band: back on its point
    expect(chart.shown).toEqual({ from: 15, to: 29 });
    key("+"); // and the zoom goes on from where it was, around the day being read
    expect(chart.shown).toEqual({ from: 17, to: 24 });
  });

  it("says the reading again when the newer data changed its words", async () => {
    const { rerender } = render(viewed());
    await drawn();
    key("End");
    const said = spoken();
    rerender(viewed({ read: i => `${MONTH[i]}: $${i + 1}.00` })); // today's figure grew
    expect(readout()).toBe("Oct 30: $30.00");
    expect(said()).toBe(1);
  });

  it("ends the reading and shows every point when the view changes, whatever the option function", async () => {
    const onZoom = zoomSpy(), option = fresh();
    const { rerender } = render(viewed({ onZoom, option }));
    const chart = await drawn();
    chart.zoomTo(10, 19);
    chart.fire("mousemove", chart.pointAt(12));
    rerender(viewed({ onZoom, option, view: "30 days by model" })); // the same function: the key alone makes the view
    expect(chart.shown).toEqual({ from: 0, to: 29 });
    expect(zooms(chart)).toEqual(["all"]);
    expect(onZoom.mock.calls.at(-1)).toEqual([null]);
    expect(readout()).toBe("");
    expect(chart.band).toBeNull();
  });

  it("keeps the window and the cursor on their points when the view gains a point at its end", async () => {
    const onZoom = zoomSpy();
    const { rerender } = render(viewed({ onZoom }));
    const chart = await drawn();
    chart.zoomTo(10, 19);
    chart.fire("mousemove", chart.pointAt(12));
    // ECharts keeps a slider's window as a share of the points: with one more point the same share is other points.
    const set = chart.setOption.bind(chart);
    vi.spyOn(chart, "setOption").mockImplementation((o, opts) => {
      set(o as never, opts as never);
      chart.dispatchAction({ type: "dataZoom", startValue: 11, endValue: 20 }, { silent: true });
    });
    const said = spoken();
    rerender(viewed({ onZoom, option: fresh(31), points: 31 }));
    expect(chart.points).toBe(31);
    expect(zooms(chart).at(-1)).toEqual([10, 19]); // put back on the points it showed
    expect(chart.shown).toEqual({ from: 10, to: 19 });
    expect(onZoom).toHaveBeenCalledTimes(1);
    expect(readout()).toBe("Oct 13: $12.00");
    expect(chart.band).toBe(12);
    expect(said()).toBe(0);
  });

  it("ends a reading whose point is gone, shows every point when the window no longer fits, and brings neither back", async () => {
    const onZoom = zoomSpy();
    const { rerender } = render(viewed({ onZoom }));
    const chart = await drawn();
    chart.zoomTo(20, 29);
    chart.fire("mousemove", chart.pointAt(25));
    expect(readout()).toBe("Oct 26: $25.00");
    const reads: number[] = [];
    const counted = (i: number) => { reads.push(i); return readDay(i); };
    const all = (s: Shown | null) => (s ? "zoomed" : "Showing all 22 days.");
    rerender(viewed({ onZoom, option: fresh(22), points: 22, read: counted, readZoom: all }));
    // The reading is gone with its point, and the zoom ended with no one asking: that is said, once.
    expect(readout()).toBe("Showing all 22 days.");
    expect(tooltip()).toBeNull();
    expect(reads).toEqual([]); // never asked for a point the view no longer has
    expect(chart.band).toBeNull();
    expect(chart.shown).toEqual({ from: 0, to: 21 });
    expect(onZoom.mock.calls.at(-1)).toEqual([null]);

    const said = spoken();
    rerender(viewed({ onZoom, read: counted, readZoom: all }));
    expect(readout()).toBe("Showing all 22 days."); // not derived again: nothing more is said
    expect(said()).toBe(0);
    expect(chart.shown).toEqual({ from: 0, to: 29 });
    expect(onZoom.mock.calls.at(-1)).toEqual([null]);
    expect(reads).toEqual([]);
  });

  it("says the zoom sentence after a reading once: newer figures say the reading alone", async () => {
    const { rerender } = render(viewed());
    const chart = await drawn();
    chart.zoomTo(10, 19);
    key("End");
    expect(readout()).toBe("Oct 30: $29.00 Showing Oct 21 to Oct 30, 10 of 30 days.");
    const said = spoken();
    rerender(viewed()); // the same words: nothing
    expect(said()).toBe(0);
    rerender(viewed({ read: i => `${MONTH[i]}: $${i + 1}.00` })); // today's figure grew
    expect(readout()).toBe("Oct 30: $30.00");
    expect(said()).toBe(1);
    rerender(viewed()); // and the zoom sentence does not come back with a figure that does
    expect(readout()).toBe("Oct 30: $29.00");
    expect(chart.shown).toEqual({ from: 20, to: 29 });
  });

  it("says a key's reading again after a zoom sentence took the region: End, plus, then newer figures", async () => {
    const { rerender } = render(viewed());
    const chart = await drawn();
    key("End");
    key("+");
    expect(readout()).toBe("Showing Oct 16 to Oct 30, 15 of 30 days.");
    const said = spoken();
    rerender(viewed()); // the same figures: nothing
    expect(readout()).toBe("Showing Oct 16 to Oct 30, 15 of 30 days.");
    expect(said()).toBe(0);
    rerender(viewed({ read: i => `${MONTH[i]}: $${i + 1}.00` })); // today's figure grew: the day is said, alone
    expect(readout()).toBe("Oct 30: $30.00");
    expect(said()).toBe(1);
    rerender(viewed({ read: i => `${MONTH[i]}: $${i + 1}.00` }));
    expect(said()).toBe(0);
    expect(chart.shown).toEqual({ from: 15, to: 29 });
  });

  it("leaves a pointer's reading unsaid after a zoom sentence too", async () => {
    const { rerender } = render(viewed());
    const chart = await drawn();
    box().focus();
    chart.fire("mousemove", chart.pointAt(29)); // the pointer reads today, with the focus in the box
    key("+");
    expect(readout()).toBe("Showing Oct 16 to Oct 30, 15 of 30 days.");
    const said = spoken();
    rerender(viewed({ read: i => `${MONTH[i]}: $${i + 1}.00` }));
    expect(readout()).toBe("Showing Oct 16 to Oct 30, 15 of 30 days.");
    expect(said()).toBe(0);
  });

  it("drops a zoom sentence that a redraw made untrue, and never says it with the old count", async () => {
    /** The wording for a view of n days. */
    const of = (n: number) => (s: Shown | null) => (s ? `Showing ${MONTH[s.from]} to ${MONTH[s.to]}, ${s.to - s.from + 1} of ${n} days.` : `Showing all ${n} days.`);
    const { rerender } = render(viewed());
    const chart = await drawn();
    key("+");
    expect(readout()).toBe("Showing Oct 16 to Oct 30, 15 of 30 days.");
    rerender(viewed({ option: fresh(31), points: 31, readZoom: of(31) })); // a 31st day arrives
    expect(chart.shown).toEqual({ from: 15, to: 29 });
    expect(readout()).toBe(""); // dropped, not reworded: a new sentence would be spoken with no one asking

    key("Home"); // a key's reading, with the zoom sentence after it
    expect(readout()).toBe("Oct 1: $0.00 Showing Oct 1 to Oct 15, 15 of 31 days.");
    rerender(viewed({ option: fresh(32), points: 32, readZoom: of(32) }));
    expect(readout()).toBe("Oct 1: $0.00");
    expect(chart.shown).toEqual({ from: 0, to: 14 });
  });

  it("leaves a pointer's reading unsaid when newer figures change it, and shows them in the tooltip", async () => {
    const tips = (more: number) => (i: number) => <b>{MONTH[i]} is ${i + more}</b>;
    const { rerender } = render(viewed({ tip: tips(0) }));
    const chart = await drawn();
    chart.fire("mousemove", chart.pointAt(29));
    expect(readout()).toBe("Oct 30: $29.00");
    const said = spoken();
    rerender(viewed({ tip: tips(1), read: i => `${MONTH[i]}: $${i + 1}.00` }));
    expect(tooltip()!.textContent).toBe("Oct 30 is $30");
    expect(readout()).toBe("Oct 30: $29.00"); // the pointer rests there while the user reads elsewhere: not a word
    expect(said()).toBe(0);
    chart.fire("mousemove", chart.pointAt(28)); // the next reading is said as ever
    expect(readout()).toBe("Oct 29: $29.00");

    box().focus();
    key("End"); // the keyboard's reading, with the focus in the box, follows its figures
    expect(readout()).toBe("Oct 30: $30.00");
    rerender(viewed({ tip: tips(2), read: i => `${MONTH[i]}: $${i + 2}.00` }));
    expect(readout()).toBe("Oct 30: $31.00");
  });

  it("drops the zoom when the same view stops drawing the slider, says so once, and keeps the reading open", async () => {
    const onZoom = zoomSpy();
    const { rerender } = render(viewed({ onZoom, tip: i => <b>{MONTH[i]}</b> }));
    const chart = await drawn();
    chart.zoomTo(10, 19);
    chart.fire("mousemove", chart.pointAt(12));
    rerender(viewed({ onZoom, option: fresh(30, false), tip: i => <b>{MONTH[i]}</b> }));
    expect(chart.option.dataZoom).toEqual([]);
    expect(onZoom.mock.calls.at(-1)).toEqual([null]);
    expect(readout()).toBe("Showing all 30 days.");
    expect(tooltip()!.textContent).toBe("Oct 13");
    expect(chart.band).toBe(12);
    expect(key("+")).toBe(true); // no slider: the key is the browser's
    rerender(viewed({ onZoom })); // the slider is back, on every point
    expect(chart.shown).toEqual({ from: 0, to: 29 });
    expect(onZoom).toHaveBeenCalledTimes(2);
  });
});
