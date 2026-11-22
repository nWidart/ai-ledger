import { afterEach, describe, expect, it, vi } from "vitest";
import type { CustomSeriesOption, CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams } from "../../components/echart/echarts";
import type { OptionEnv } from "../../components/echart/option";
import { bandSeries, calendarSlots, fitTitle, thresholdLine } from "./chartParts";

const ink = { text: "ink-text", secondary: "ink-secondary", muted: "ink-muted", grid: "ink-grid", surface: "ink-surface",
  border: "ink-border", cursor: "ink-cursor", accent: "ink-accent", tint: "ink-tint" };
const env = (over: Partial<OptionEnv> = {}): OptionEnv => ({ color: s => s, ink, forced: false, textScale: 1, motion: false, ...over });
const AXES = { xAxisIndex: 1, yAxisIndex: 1 };

// renderItem with a stubbed API over `slots` category slots: a slot's middle at (i + .5) bands from the plot's left, y px up
// from the plot's bottom, one per unit, as ECharts places a category point on a value axis.
interface El { type: string; shape: Record<string, unknown>; style: Record<string, unknown> }
const plot = { x: 52, y: 10, width: 400, height: 140 };
function draw(s: CustomSeriesOption, row: number, slots: number) {
  const data = (s.data as number[][])[row]!, band = plot.width / slots;
  const api = {
    value: (d: number) => data[d]!,
    coord: ([x, v]: number[]) => [plot.x + (x! + .5) * band, plot.y + plot.height - v!],
  } as unknown as CustomSeriesRenderItemAPI;
  return s.renderItem!({ coordSys: { type: "cartesian2d", ...plot } } as unknown as CustomSeriesRenderItemParams, api) as unknown as El;
}

describe("calendarSlots", () => {
  it("walks every day across a month's end, and weeks 7 days apart", () => {
    expect(calendarSlots("2026-10-30", "2026-11-02", "day")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(calendarSlots("2026-10-19", "2026-11-09", "week")).toEqual(["2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09"]);
  });
});

describe("bandSeries", () => {
  // Slots 0–3 and 5 have both values, 4 has none, 6 only one, 7–8 both.
  const lo = [10, 12, 14, 16, null, 20, 5, 30, 32];
  const hi = [40, 42, 44, 46, null, 50, null, 60, 62];
  const band = bandSeries(env(), { id: "band", lo, hi, color: "c", opacity: .16, ...AXES });
  const slots = lo.length, x = (i: number) => plot.x + (i + .5) * (plot.width / slots), y = (v: number) => plot.y + plot.height - v;

  it("draws one polygon per run, through its hi points and back along its lo points, silent under the lines", () => {
    expect(band).toMatchObject({ type: "custom", id: "band", silent: true, z: 1, ...AXES });
    expect(band.data).toHaveLength(3);
    const run = draw(band, 0, slots);
    expect(run).toMatchObject({ type: "polygon", emphasisDisabled: true, style: { fill: "c", opacity: .16 } });
    expect(run.shape.points).toEqual([[x(0), y(40)], [x(1), y(42)], [x(2), y(44)], [x(3), y(46)], [x(3), y(16)], [x(2), y(14)], [x(1), y(12)], [x(0), y(10)]]);
    expect(draw(band, 2, slots).shape.points).toEqual([[x(7), y(60)], [x(8), y(62)], [x(8), y(32)], [x(7), y(30)]]);
  });

  it("draws a lone slot as a round-capped line from its hi to its lo, a little stronger", () => {
    const span = draw(band, 1, slots);
    expect(span).toMatchObject({ type: "line", emphasisDisabled: true, shape: { x1: x(5), y1: y(50), x2: x(5), y2: y(20) } });
    expect(span.style).toMatchObject({ stroke: "c", lineWidth: 7, lineCap: "round" });
    expect(span.style.opacity).toBeCloseTo(.28);
  });

  it("has no item where no slot has both values", () => {
    expect(bandSeries(env(), { id: "band", lo: [1, null], hi: [null, 2], color: "c", opacity: .16, ...AXES }).data).toEqual([]);
  });
});

describe("thresholdLine", () => {
  const line = (value: number, e = env()) => {
    const [rule, label] = (draw(thresholdLine(e, { id: "limit", value, text: "80% of the window", ...AXES }), 0, 1) as unknown as { children: El[] }).children;
    return { rule: rule!, label: label! };
  };

  it("draws a dashed muted line across the plot at the value, its text right-aligned over it", () => {
    expect(thresholdLine(env(), { id: "limit", value: 80, text: "t", ...AXES })).toMatchObject({ type: "custom", id: "limit", silent: true, z: 2, ...AXES });
    const { rule, label } = line(80);
    expect(rule).toMatchObject({ type: "line", emphasisDisabled: true, shape: { x1: plot.x, x2: plot.x + plot.width, y1: 70, y2: 70 } });
    expect(rule.style).toMatchObject({ stroke: "ink-muted", lineWidth: 1, lineDash: [4, 3] });
    expect(label).toMatchObject({ type: "text", emphasisDisabled: true });
    expect(label.style).toMatchObject({ text: "80% of the window", x: plot.x + plot.width, y: 66, align: "right", verticalAlign: "bottom", fill: "ink-muted" });
  });

  it("puts the text under the line where over it would pass the plot's top", () => {
    expect(line(135).label.style).toMatchObject({ y: 19, verticalAlign: "top" });
    // At twice the text the label is 22px tall and 8px off the line: 30px under the top holds it, 29px does not.
    expect(line(110, env({ textScale: 2 })).label.style).toMatchObject({ y: 32, verticalAlign: "bottom" });
    expect(line(111, env({ textScale: 2 })).label.style).toMatchObject({ y: 47, verticalAlign: "top" });
  });
});

describe("fitTitle", () => {
  // A canvas whose text is 4px a character at 11px.
  afterEach(() => vi.restoreAllMocks());
  const stubMeasure = () => vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    font: "", measureText: (t: string) => ({ width: t.length * 4 }),
  } as unknown as CanvasRenderingContext2D);

  it("gives the title with the first figure that fits, else the title alone", () => {
    stubMeasure();
    const title = (w: number) => fitTitle(env(), "Cache breaks", ["most in a day: 4", "most: 4"], w);
    expect(title(400)).toBe("Cache breaks · most in a day: 4"); // 31 characters, 124px
    expect(title(100)).toBe("Cache breaks · most: 4"); // 22 characters, 88px
    expect(title(80)).toBe("Cache breaks");
  });
});
