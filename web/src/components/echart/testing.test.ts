import { describe, expect, it } from "vitest";
import { loadECharts } from "./load";
import { fakeECharts, sliderShadowOf, type FakeChart } from "./testing";

// The fake runtime that every chart test runs on: test-setup puts it in place of the load module.
const chartOf = async (points = 10, option: Record<string, unknown> = {}) => {
  const { init } = await loadECharts();
  const dom = document.createElement("div");
  const chart = init(dom, null, { renderer: "svg" });
  chart.setOption({ xAxis: { type: "category", data: Array.from({ length: points }, (_, i) => `d${i}`) }, yAxis: { max: 100 }, ...option });
  return fakeECharts.last as FakeChart;
};

describe("the fake ECharts runtime", () => {
  it("does not clamp a pixel outside the grid to the points shown, as ECharts does not", async () => {
    const chart = await chartOf(10, { dataZoom: [{ type: "slider" }] });
    expect([0, 39, 40, 439, 440, 479].map(x => chart.convertFromPixel({ xAxisIndex: 0 }, x))).toEqual([-1, -1, 0, 9, 10, 10]);
    chart.dispatchAction({ type: "dataZoom", startValue: 2, endValue: 5 }); // four bands of 100px
    expect([0, 40, 439, 440, 500].map(x => chart.convertFromPixel({ xAxisIndex: 0 }, x))).toEqual([1, 2, 5, 6, 6]);
    expect(chart.convertFromPixel({ gridIndex: 0 }, [470, 310])).toEqual([6, -50]);
    // The band itself stays on the points shown, up to the grid's right edge.
    chart.dispatchAction({ type: "updateAxisPointer", currTrigger: "mousemove", x: 440, y: 100 });
    expect(chart.band).toBe(5);
  });

  it("moves the band itself on a pointer move or a click, as ECharts does, unless the option turns its triggers off", async () => {
    const chart = await chartOf();
    chart.fire("mousemove", chart.pointAt(4));
    expect(chart.band).toBe(4);
    chart.fire("mousemove", [20, 100]); // outside the grid
    expect(chart.band).toBeNull();
    chart.fire("click", chart.pointAt(7));
    expect(chart.band).toBe(7);
    chart.fire("mousewheel", chart.pointAt(2));
    expect(chart.band).toBe(2);
    chart.fire("globalout");
    expect(chart.band).toBeNull();
    expect(chart.actions).toEqual([]); // ECharts' own moves are not the wrapper's actions

    chart.setOption({ axisPointer: { triggerOn: "none" } });
    chart.fire("mousemove", chart.pointAt(4));
    chart.fire("click", chart.pointAt(7));
    chart.fire("mousewheel", chart.pointAt(2));
    expect(chart.band).toBeNull();
    chart.dispatchAction({ type: "updateAxisPointer", currTrigger: "mousemove", x: chart.pointAt(6)[0], y: 100 });
    chart.fire("globalout");
    expect(chart.band).toBe(6); // only an action hides what an action showed
  });

  it("keeps a zoom window that an action, a drag and a redraw treat as ECharts does", async () => {
    const chart = await chartOf(30, { dataZoom: [{ type: "slider" }] });
    const zooms: unknown[] = [];
    chart.on("dataZoom", (e: never) => { zooms.push(e); });
    expect(chart.getOption().dataZoom).toEqual([expect.objectContaining({ startValue: 0, endValue: 29, start: 0, end: 100 })]);

    chart.dispatchAction({ type: "dataZoom", startValue: 10, endValue: 19 });
    expect(zooms).toEqual([{ type: "datazoom", startValue: 10, endValue: 19 }]);
    expect(chart.shown).toEqual({ from: 10, to: 19 });
    expect(chart.convertToPixel({ xAxisIndex: 0 }, 10)).toBe(60); // ten bands of 40px again
    chart.dispatchAction({ type: "dataZoom", startValue: 0, endValue: 29 }, { silent: true });
    expect(zooms).toHaveLength(1);

    chart.zoomTo(5, 14);
    expect(zooms.at(-1)).toMatchObject({ type: "datazoom", start: 5 / 29 * 100, end: 14 / 29 * 100 });
    expect(chart.getOption().dataZoom).toEqual([expect.objectContaining({ startValue: 5, endValue: 14 })]);
    expect(chart.actions).toHaveLength(2); // a drag is not the wrapper's action

    chart.setOption({ series: [] }, { replaceMerge: ["series"] });
    expect(chart.shown).toEqual({ from: 5, to: 14 });
    // A redraw that names the slider again merges into it; an empty list removes nothing.
    chart.setOption({ dataZoom: [{ type: "slider", height: 20 }] });
    chart.setOption({ dataZoom: [] });
    expect(chart.shown).toEqual({ from: 5, to: 14 });
    // A new slider starts over, and with none every point shows.
    chart.setOption({ dataZoom: [{ type: "slider" }] }, { replaceMerge: ["dataZoom"] });
    expect(chart.shown).toEqual({ from: 0, to: 29 });
    chart.zoomTo(5, 14);
    chart.setOption({}, { replaceMerge: ["dataZoom"] });
    expect(chart.shown).toEqual({ from: 0, to: 29 });
  });

  // Each step below keeps the items ECharts 6.1 keeps for the same calls (its getOption() in jsdom with the SVG renderer),
  // without the defaults ECharts adds.
  it("merges what replaceMerge does not list by id, then name, then index, and deeply", async () => {
    const chart = await chartOf(10, {
      xAxis: { type: "category", data: ["a", "b"], axisLabel: { color: "red" } },
      textStyle: { fontSize: 11 },
      series: [{ type: "line", id: "a", data: [1] }, { type: "line", name: "B", data: [2] }],
    });
    const series = () => (chart.option.series as Record<string, unknown>[]).map(s => [s.id ?? s.name ?? "-", s.data]);
    chart.setOption({ series: [{ data: [3] }] }); // by index, into "a"
    chart.setOption({ series: [{ name: "B", data: [4] }] }); // by name
    expect(series()).toEqual([["a", [3]], ["B", [4]]]);
    chart.setOption({ series: [{ type: "line", id: "c", data: [5] }, { data: [6] }, { data: [7] }] }); // an id of its own is added
    expect(series()).toEqual([["a", [6]], ["B", [7]], ["c", [5]]]);
    chart.setOption({ series: [] });
    expect(series()).toHaveLength(3);

    chart.setOption({ xAxis: { axisTick: { show: false } }, textStyle: { fontFamily: "X" } });
    expect(chart.option.xAxis).toEqual([{ type: "category", data: ["a", "b"], axisLabel: { color: "red" }, axisTick: { show: false } }]);
    expect(chart.option.textStyle).toEqual({ fontSize: 11, fontFamily: "X" });
  });

  it("keeps only the option's items for a key replaceMerge lists, merging those whose id matches", async () => {
    const chart = await chartOf(10, { series: [{ type: "line", id: "a", name: "A", data: [1] }, { type: "line", name: "B", data: [2] }] });
    const series = () => chart.option.series as Record<string, unknown>[];
    chart.setOption({ series: [{ id: "a", data: [3] }] }, { replaceMerge: ["series"] });
    expect(series()).toEqual([{ type: "line", id: "a", name: "A", data: [3] }]);
    chart.setOption({ series: [{ type: "line", data: [4] }] }, { replaceMerge: ["series"] }); // no id: a new series
    expect(series()).toEqual([{ type: "line", data: [4] }]);
    chart.setOption({ yAxis: { max: 50 } }, { replaceMerge: ["series", "xAxis"] }); // listed and left out: emptied
    expect([series(), chart.option.xAxis, chart.points]).toEqual([[], [], 0]);
    chart.setOption({ xAxis: { data: ["a"] }, yAxis: {} }, { notMerge: true });
    expect(chart.option).toEqual({ xAxis: [{ data: ["a"] }], yAxis: [{}] });
  });

  it("throws on two items with one id, as ECharts does", async () => {
    const chart = await chartOf();
    expect(() => chart.setOption({ series: [{ type: "custom", id: "stack" }, { type: "custom", id: "stack" }] }, { replaceMerge: ["series"] }))
      .toThrow("id duplicates: stack");
  });

  // A chart of several tracks: a frame grid (0) over one grid per track, each grid with its own x and y axis.
  const tracks = (n = 3, points = 10, x: (i: number) => Record<string, unknown> = () => ({})) => ({
    grid: Array.from({ length: n }, (_, i) => ({ id: `g${i}`, top: 10 + i * 60, height: 50, outerBoundsMode: "none" })),
    xAxis: Array.from({ length: n }, (_, i) => ({ type: "category", data: Array.from({ length: points }, (_, p) => `d${p}`), gridIndex: i, ...x(i) })),
    yAxis: Array.from({ length: n }, (_, i) => ({ type: "value", gridIndex: i, max: 100 })),
  });
  const list = (v: unknown) => v as Record<string, unknown>[];
  const zoomed = async (option: Record<string, unknown>) => (await chartOf(10, option)).zoomAxes;

  // The rules below are those of ECharts 6.1 (a slider's zoom on each axis, and the bands drawn, in jsdom with the SVG renderer).
  it("names the x axes the first slider drives, by ECharts' rule", async () => {
    expect(await zoomed({})).toEqual([]); // no slider
    expect(await zoomed({ dataZoom: [{ type: "slider" }] })).toEqual([0]);
    expect(await zoomed({ dataZoom: [{ type: "slider", xAxisIndex: 0 }] })).toEqual([0]);
    expect(await zoomed({ ...tracks(), dataZoom: [{ type: "slider", xAxisIndex: [0, 1, 2] }] })).toEqual([0, 1, 2]);
    expect(await zoomed({ ...tracks(), dataZoom: [{ type: "slider", xAxisIndex: "all" }] })).toEqual([0, 1, 2]);
    // With none named, the first x axis and every other one in its grid, such as a second axis on the grid's top.
    expect(await zoomed({ ...tracks(2, 10, () => ({ gridIndex: 0 })), grid: [{}], yAxis: [{}], dataZoom: [{ type: "slider" }] })).toEqual([0, 1]);
  });

  it("throws for a slider that leaves an x axis out, where ECharts would zoom the others alone", async () => {
    await expect(chartOf(10, { ...tracks(), dataZoom: [{ type: "slider" }] })).rejects.toThrow("does not drive x axis 1, 2");
    await expect(chartOf(10, { ...tracks(), dataZoom: [{ type: "slider", xAxisIndex: 1 }] })).rejects.toThrow("does not drive x axis 0, 2");
    await expect(chartOf(10, { dataZoom: [{ type: "slider", yAxisIndex: 0 }] })).rejects.toThrow("does not drive x axis 0");
    // The merged option counts: a slider added to a chart that already has its tracks.
    const chart = await chartOf(10, tracks());
    expect(() => chart.setOption({ dataZoom: [{ type: "slider" }] })).toThrow("does not drive x axis 1, 2");
    expect(chart.option.dataZoom).toBeUndefined(); // the refused option is not kept
    expect(() => chart.setOption({ dataZoom: [{ type: "slider", xAxisIndex: "all" }] })).not.toThrow();
    expect(chart.zoomAxes).toEqual([0, 1, 2]);
  });

  it("throws for an axis pointer on an x axis after the first, where ECharts draws a second band over its grid", async () => {
    await expect(chartOf(10, tracks(3, 10, i => (i === 1 ? { axisPointer: { show: true } } : {})))).rejects.toThrow("x axis 1 shows an axis pointer");
    const chart = await chartOf(10, tracks(3, 10, i => ({ axisPointer: { show: i === 0 } })));
    expect(() => chart.setOption({ xAxis: [{}, {}, { axisPointer: { show: true } }] })).toThrow("x axis 2 shows an axis pointer");
    expect(list(chart.option.xAxis).map(a => a.axisPointer)).toEqual([{ show: true }, { show: false }, { show: false }]);
  });

  it("throws for grids that ECharts may fit on their own, where it shrinks the frame alone and its axis leaves the tracks'", async () => {
    const fitted = (i: number) => ({ grid: tracks().grid.map((g, j) => (j === i ? { ...g, outerBoundsMode: "auto" } : g)) });
    await expect(chartOf(10, { ...tracks(), ...fitted(0) })).rejects.toThrow('grid 0 has no outerBoundsMode "none"');
    await expect(chartOf(10, { ...tracks(), grid: tracks().grid.map(g => ({ ...g, outerBoundsMode: undefined })) })).rejects.toThrow("grid 0, 1, 2 has no");
    // The merged option counts: a track's grid set back to the default in a later option.
    const chart = await chartOf(10, tracks());
    expect(() => chart.setOption(fitted(2))).toThrow('grid 2 has no outerBoundsMode "none"');
    // One grid cannot drift from itself: it may take ECharts' fit.
    await expect(chartOf(10, { grid: { top: 10 } })).resolves.toBeDefined();
  });

  it("records a refused option nowhere: not in options, not as last", async () => {
    const chart = await chartOf(10, tracks());
    const taken = chart.last;
    const refused = { dataZoom: [{ type: "slider" }] };
    expect(() => chart.setOption(refused)).toThrow("does not drive x axis 1, 2");
    expect(chart.options).toHaveLength(1);
    expect(chart.last).toBe(taken);
    expect(chart.options.map(o => o.option)).not.toContain(refused);
    // So is one with two items of one id, which throws before the rules do.
    expect(() => chart.setOption({ series: [{ id: "a" }, { id: "a" }] })).toThrow("id duplicates: a");
    expect(chart.options).toHaveLength(1);
  });

  // Measured on ECharts 6.1 in jsdom with the SVG renderer: the slider's shadow followed a line on x axis 1 over a trend
  // listed before it on x axis 2, and the trend over a line listed after it on the same axis.
  describe("the slider's trend (sliderShadowOf)", () => {
    const slider = { dataZoom: [{ type: "slider", xAxisIndex: "all" }] };
    const line = (id: string, xAxisIndex: number) => ({ type: "line", id, xAxisIndex });
    const shadow = (series: Record<string, unknown>[], over: Record<string, unknown> = {}) =>
      sliderShadowOf({ ...tracks(), ...slider, series, ...over })?.id;

    it("takes the first line on the lowest-index x axis the slider drives, whatever the order of the series", () => {
      expect(shadow([line("trend", 1), { type: "custom", id: "stack", xAxisIndex: 1 }, line("rate", 2)])).toBe("trend");
      expect(shadow([line("trend", 2), line("rate", 1)])).toBe("rate"); // the axis wins over the order
      expect(shadow([line("rate", 1), line("trend", 1)])).toBe("rate"); // on one axis, the order
      expect(shadow([line("avg", 0), line("trend", 1)])).toBe("avg"); // a line on the frame wins over every track
    });

    it("skips a custom series, and reads a series with no xAxisIndex as on x axis 0", () => {
      expect(shadow([{ type: "custom", id: "mark", xAxisIndex: 0 }, line("trend", 1)])).toBe("trend");
      expect(shadow([{ type: "line", id: "plain" }, line("trend", 1)])).toBe("plain");
      expect(shadow([{ type: "bar", id: "bars", xAxisIndex: 1 }, line("trend", 1)])).toBe("bars");
    });

    it("draws none without a slider, with showDataShadow false, or with no such series; with true, any series", () => {
      expect(sliderShadowOf({ ...tracks(), series: [line("trend", 1)] })).toBeUndefined();
      expect(shadow([line("trend", 1)], { dataZoom: [{ type: "slider", xAxisIndex: "all", showDataShadow: false }] })).toBeUndefined();
      expect(shadow([{ type: "custom", id: "stack", xAxisIndex: 1 }])).toBeUndefined();
      expect(shadow([{ type: "custom", id: "stack", xAxisIndex: 1 }], { dataZoom: [{ type: "slider", xAxisIndex: "all", showDataShadow: true }] })).toBe("stack");
    });

    it("throws for a trend series the slider does not draw, where ECharts draws another series' trend", async () => {
      await expect(chartOf(10, { ...tracks(), ...slider, series: [line("trend", 2), line("rate", 1)] }))
        .rejects.toThrow('the slider draws its trend from series rate, not from "trend"');
      await expect(chartOf(10, { ...tracks(), ...slider, series: [line("trend", 1), line("rate", 2)] })).resolves.toBeTruthy();
      // No slider, no trend to draw: nothing to refuse.
      await expect(chartOf(10, { ...tracks(), series: [line("trend", 2), line("rate", 1)] })).resolves.toBeTruthy();
    });
  });

  it("merges an option of three grids and answers from the first, which is the frame", async () => {
    const chart = await chartOf(10, { ...tracks(3, 12), dataZoom: [{ type: "slider", id: "zoom", xAxisIndex: "all" }] });
    expect([list(chart.option.grid).length, list(chart.option.xAxis).length, list(chart.option.yAxis).length]).toEqual([3, 3, 3]);
    expect(chart.points).toBe(12);
    chart.dispatchAction({ type: "dataZoom", startValue: 2, endValue: 5 });
    expect(chart.convertToPixel({ xAxisIndex: 0 }, 2)).toBe(90); // four bands of 100px
    expect(() => chart.convertToPixel({ xAxisIndex: 1 }, 2)).toThrow("one grid");
    // A redraw that drops a track keeps the frame's points and the zoom window.
    chart.setOption({ ...tracks(2, 12), dataZoom: [{ type: "slider", id: "zoom", xAxisIndex: "all" }] }, { replaceMerge: ["grid", "xAxis", "yAxis"] });
    expect([list(chart.option.grid).length, chart.points, chart.shown]).toEqual([2, 12, { from: 2, to: 5 }]);
  });

  it("keeps the cursor a handler sets, and sets the default again before each pointer move, as zrender does", async () => {
    const chart = await chartOf();
    const zr = chart.getZr();
    expect(chart.zr.cursor).toBe("default");
    zr.setCursorStyle("pointer");
    expect(chart.zr.cursor).toBe("pointer");
    const seen: string[] = [];
    zr.on("mousemove", () => { seen.push(chart.zr.cursor); });
    chart.fire("mousemove", chart.pointAt(2));
    expect(seen).toEqual(["default"]); // a handler that wants a hand asks for it on every move
    expect(chart.zr.cursor).toBe("default");
  });

  it("throws on a disposed chart and on a second live chart on one element", async () => {
    const chart = await chartOf();
    const { init } = await loadECharts();
    expect(() => init(chart.dom)).toThrow("live chart");
    chart.dispose();
    expect(() => chart.resize()).toThrow("disposed");
    expect(fakeECharts.live).toEqual([]);
    expect(() => init(chart.dom)).not.toThrow();
  });
});
