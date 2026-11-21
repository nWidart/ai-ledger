import { describe, expect, it } from "vitest";
import { loadECharts } from "./load";
import { fakeECharts, type FakeChart } from "./testing";

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
