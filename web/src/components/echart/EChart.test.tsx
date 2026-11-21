import { act, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setTheme } from "../../theme";
import { EChart, type EChartProps } from "./EChart";
import type { EChartsOption } from "./echarts";
import { drawn, fakeECharts } from "./testing";
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
const show = (props: Partial<EChartProps> = {}) => <EChart label={LABEL} height={240} option={option} {...props} />;
const box = () => screen.getByLabelText(LABEL); // a hidden group has no accessible name to find it by
const plot = () => box().querySelector(".echart-plot")!;

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
    expect(box().hidden).toBe(true);
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
