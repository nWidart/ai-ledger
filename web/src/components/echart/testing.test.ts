import { describe, expect, it } from "vitest";
import { loadECharts, preloadECharts } from "./load";
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
  it("stands in for the load module, and records each chart it makes", async () => {
    preloadECharts();
    const chart = await chartOf();
    expect(fakeECharts.loads).toBe(1);
    expect(fakeECharts.preloads).toBe(1);
    expect(chart.init).toEqual({ renderer: "svg" });
    expect(chart.options).toHaveLength(1);
    expect(fakeECharts.live).toEqual([chart]);
  });

  it("maps points to pixels and back over its grid", async () => {
    const chart = await chartOf(10);
    // The default grid is 400px wide from x 40: ten bands of 40px.
    expect(chart.convertToPixel({ xAxisIndex: 0 }, 3)).toBe(180);
    expect(chart.convertFromPixel({ xAxisIndex: 0 }, 181)).toBe(3);
    expect(chart.convertToPixel({ gridIndex: 0 }, [0, 50])).toEqual([60, 110]);
    expect(chart.convertFromPixel({ gridIndex: 0 }, chart.pointAt(9))).toEqual([9, 50]);
    expect(chart.containPixel({ gridIndex: 0 }, chart.pointAt(4))).toBe(true);
    expect(chart.containPixel({ gridIndex: 0 }, [20, 100])).toBe(false);
    expect(() => chart.convertToPixel({ gridIndex: 1 }, 0)).toThrow("one grid");
  });

  it("moves the band by action and hides it on leave", async () => {
    const chart = await chartOf();
    chart.dispatchAction({ type: "updateAxisPointer", currTrigger: "mousemove", x: chart.pointAt(6)[0], y: 100 });
    expect(chart.band).toBe(6);
    chart.dispatchAction({ type: "updateAxisPointer", currTrigger: "leave" });
    expect(chart.band).toBeNull();
    expect(chart.actions.map(a => a.currTrigger)).toEqual(["mousemove", "leave"]);
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
    chart.setOption({ dataZoom: [] });
    expect(chart.shown).toEqual({ from: 0, to: 29 });
  });

  it("fires zrender events to the handlers on getZr()", async () => {
    const chart = await chartOf();
    const seen: { type: string; offsetX: number; offsetY: number }[] = [];
    const zr = chart.getZr();
    const onMove = (e: never) => { seen.push(e); };
    zr.on("mousemove", onMove);
    chart.fire("mousemove", chart.pointAt(2));
    expect(seen).toEqual([expect.objectContaining({ type: "mousemove", offsetX: 140, offsetY: 110 })]);
    zr.off("mousemove", onMove);
    expect(zr.listening("mousemove")).toBe(0);
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

  it("holds the load until the test settles it", async () => {
    const load = fakeECharts.hold();
    let got: unknown = "waiting";
    void loadECharts().then(r => { got = r; }, (e: unknown) => { got = e; });
    await Promise.resolve();
    expect(got).toBe("waiting");
    await load.reject(new Error("offline"));
    expect(got).toEqual(new Error("offline"));
    await expect(loadECharts()).resolves.toHaveProperty("init");
  });
});
