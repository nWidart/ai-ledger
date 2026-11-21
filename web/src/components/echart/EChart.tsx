// The one chart component (design decision 5). It owns the box (a focusable, labelled group at its height from the first
// render), the ECharts instance (loaded lazily, made once, disposed on unmount) and what the chart is drawn from: the
// option the caller builds from the environment, drawn again when the option, the theme, the media or the box's size
// changes. ECharts draws into the plot, which assistive technology does not see.
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import type { ECharts, EChartsOption } from "./echarts";
import { loadECharts, type Runtime } from "./load";
import { useChartEnv, type ChartEnv } from "./tokens";
import "./EChart.css";

export interface EChartProps {
  /** The group's accessible name: what the chart shows and how to read it. */
  label: string;
  /** The id of the hint that describes the chart, if it has one. */
  describedBy?: string;
  id?: string;
  className?: string;
  hidden?: boolean;
  /** The box's height in px. The box has it from the first render. */
  height: number;
  /** Builds the ECharts option. Pure. Memoize it on the chart's data: a new function is a new drawing. */
  option: (env: ChartEnv) => EChartsOption;
}

/** The width a chart is drawn at until its box is laid out, while the box is hidden, and in jsdom, which lays nothing out. */
const UNMEASURED = 800;
/** The components a drawing replaces whole, so a series or an axis the new option leaves out is gone. The others merge:
 *  the zoom window stays, since no option names its start or its end. */
const REPLACE = ["series", "xAxis", "yAxis", "grid"];

export function EChart({ label, describedBy, id, className, hidden, height, option }: EChartProps) {
  const box = useRef<HTMLDivElement>(null), plot = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(UNMEASURED);
  const env = useChartEnv(width, height);
  // The live chart: null until the runtime has loaded, and after disposal.
  const [chart, setChart] = useState<ECharts | null>(null);
  const [failed, setFailed] = useState(false);

  // The box's width, read once it is laid out and again a frame after each resize. A hidden box has no width: the chart
  // keeps the one it had.
  useLayoutEffect(() => {
    const el = box.current!;
    let frame = 0;
    const fit = () => { if (el.clientWidth) setWidth(el.clientWidth); };
    fit();
    const observer = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(fit); });
    observer.observe(el);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);

  // The chart is given its size, never left to measure the plot: the drawing and the env then agree, and a chart made
  // while its box is hidden still has one. The first run repeats the size init() took, which changes nothing.
  useEffect(() => { chart?.resize({ width, height }); }, [chart, width, height]);

  // Reduced motion is the wrapper's to keep, so no option builder can forget it.
  useEffect(() => {
    if (!chart) return;
    const drawing = option(env);
    chart.setOption(env.motion ? drawing : { ...drawing, animation: false }, { replaceMerge: REPLACE });
  }, [chart, option, env]);

  // Last, so that on unmount every other cleanup still has a live chart. The load is asynchronous: StrictMode's first
  // mount is gone before it resolves and makes no chart.
  const make = useEffectEvent((runtime: Runtime) => runtime.init(plot.current!, null, { renderer: "svg", width, height }));
  useEffect(() => {
    let gone = false, made: ECharts | undefined;
    loadECharts().then(runtime => {
      if (gone) return;
      made = make(runtime);
      setChart(made);
    }, () => { if (!gone) setFailed(true); });
    return () => {
      gone = true;
      made?.dispose(); // with its listeners and its svg
      setChart(null);
    };
  }, []);

  return (
    <div ref={box} id={id} className={className ? `echart ${className}` : "echart"} hidden={hidden} role="group" tabIndex={0}
      aria-label={label} aria-describedby={describedBy} style={{ height }}>
      <div ref={plot} className="echart-plot" aria-hidden="true" />
      {failed && <p className="echart-failed">The chart could not be drawn. The data table below has its figures.</p>}
    </div>
  );
}
