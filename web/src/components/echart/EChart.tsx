// The one chart component (design decision 5). It owns the box (a focusable, labelled group at its height from the first
// render), the ECharts instance (loaded lazily, made once, disposed on unmount) and what the chart is drawn from: the
// option the caller builds from the environment, drawn again when the option, the theme, the media or the box's size
// changes. ECharts draws into the plot, which assistive technology does not see.
// The reading is React's (decision 1): the point the keys or the pointer read, the tooltip and the live readout need no
// chart, so they work while the runtime loads and when it fails. ECharts only draws the band over the point being read.
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { tipAt } from "../chart";
import { modified } from "../keys";
import type { ECharts, EChartsOption, ElementEvent } from "./echarts";
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
  /** Builds the ECharts option. Pure. Memoize it on the chart's data: a new function is a new drawing, and ends the reading. */
  option: (env: ChartEnv) => EChartsOption;
  /** How many points the keys read: days, weeks, sessions, requests. One per band of the option's first x axis. */
  points: number;
  /** The tooltip for point i. Without it, the chart has no tooltip. */
  tip?: (i: number) => ReactNode;
  /** The sentence the live region says for point i. */
  read: (i: number) => string;
  /** Enter on the point being read, or a click on a point. The reading ends with it, unless the handler returns false:
   *  the point has nothing to open, and the reading stays, so the user is not left with silence. The pointer is a hand
   *  over every point of a chart that has a handler: the wrapper cannot tell which points the handler would decline. */
  onActivate?: (i: number) => boolean | void;
}

/** The width a chart is drawn at until its box is laid out, while the box is hidden, and in jsdom, which lays nothing out. */
const UNMEASURED = 800;
/** The components a drawing replaces whole, so a series or an axis the new option leaves out is gone. The others merge:
 *  the zoom window stays, since no option names its start or its end. */
const REPLACE = ["series", "xAxis", "yAxis", "grid"];
const GRID = { gridIndex: 0 }, X_AXIS = { xAxisIndex: 0 };
/** How far each key moves the cursor. */
const STEPS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity };
/** A key's tooltip points this far under the top of the grid, as the hand-written charts have it. */
const KEY_DROP = 20;

/** Where the chart draws point i, in px from the plot's top left: the middle of its band, at the top of the grid, which is
 *  found within 4px by going down the plot. A point the chart does not show is at the plot's top. */
function drawnAt(chart: ECharts, i: number, height: number): [number, number] {
  const x = Number(chart.convertToPixel(X_AXIS, i));
  for (let y = 0; y < height; y += 4) if (chart.containPixel(GRID, [x, y])) return [x, y];
  return [x, 0];
}

/** Puts the tooltip beside the place it points at (px from the plot's top left). */
function placeTip(box: HTMLElement, plot: HTMLElement, tip: HTMLElement | null, at: { x: number; y: number }) {
  if (!tip) return;
  const r = plot.getBoundingClientRect(), p = tipAt(box, tip, r.left + at.x, r.top + at.y);
  tip.style.left = `${p.left}px`;
  tip.style.top = `${p.top}px`;
}

export function EChart({ label, describedBy, id, className, hidden, height, option, points, tip, read, onActivate }: EChartProps) {
  const box = useRef<HTMLDivElement>(null), plot = useRef<HTMLDivElement>(null), tipEl = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(UNMEASURED);
  const env = useChartEnv(width, height);
  // The live chart: null until the runtime has loaded, and after disposal.
  const [chart, setChart] = useState<ECharts | null>(null);
  const [failed, setFailed] = useState(false);
  // The point being read, with the drawing it was read on: a new option function is a new drawing, where nothing is read
  // yet and the old point may not exist. `at` is the cursor: the index of the point, or null.
  const [reading, setReading] = useState<{ on: EChartProps["option"]; i: number } | null>(null);
  const at = reading && reading.on === option && reading.i < points ? reading.i : null;
  // Where the pointer's reading points, in px from the plot's top left; null for a key's reading, which points at the
  // point itself. Not state: a pointer move inside one point re-renders nothing, the tooltip is only moved.
  const pointer = useRef<{ x: number; y: number } | null>(null);
  /** Puts the tooltip where the reading of point i points: beside the pointer, or over the point as the chart draws it
   *  now. Before the chart is there, the point is at its share of the box's width. */
  const place = useEffectEvent((i: number) => {
    let to = pointer.current;
    if (!to) {
      const [x, y] = chart ? drawnAt(chart, i, height) : [(i + .5) / points * width, 0];
      to = { x, y: y + KEY_DROP };
    }
    placeTip(box.current!, plot.current!, tipEl.current, to);
  });
  // Each key sets a new reading, so its tooltip is placed even when the point is the one the pointer was reading.
  useLayoutEffect(() => { if (at != null) place(at); }, [reading, at]);
  /** Enter or a click on point i: the reading ends, unless the chart declines. False in a chart that selects nothing. */
  const activate = (i: number) => {
    if (!onActivate) return false;
    if (onActivate(i) !== false) setReading(null);
    return true;
  };

  const onKey = (ev: KeyboardEvent) => {
    if (modified(ev)) return; // Alt+Left is history, Ctrl+Home the page: not ours
    // Here as well as on the document: an element around the chart may stop the key before it gets there. The key goes
    // on, as it does from the hand-written charts: what is around the chart may have its own use for Escape.
    if (ev.key === "Escape") return setReading(null);
    if (ev.key === "Enter") { if (at != null && activate(at)) ev.preventDefault(); return; }
    const step = STEPS[ev.key];
    if (step == null || !points) return;
    ev.preventDefault();
    const from = at ?? (step > 0 ? -1 : points); // the first Right reads the first point, the first Left the last
    pointer.current = null;
    setReading({ on: option, i: Math.max(0, Math.min(points - 1, from + step)) });
  };

  // Escape ends a reading wherever the focus is: the pointer can open one while the focus is elsewhere. A key from
  // inside the box is the box's own.
  const open = at != null;
  useEffect(() => {
    if (!open) return;
    const end = (ev: globalThis.KeyboardEvent) => {
      if (ev.key === "Escape" && !modified(ev) && !box.current?.contains(ev.target as Node)) setReading(null);
    };
    document.addEventListener("keydown", end);
    return () => document.removeEventListener("keydown", end);
  }, [open]);

  // The pointer: a move inside the grid reads the point under it, with the tooltip beside the pointer; a click there
  // activates that point; anywhere else nothing is read. containPixel decides what is inside: outside the grid
  // convertFromPixel answers with points that do not exist.
  const under = (made: ECharts, e: ElementEvent) => {
    if (!made.containPixel(GRID, [e.offsetX, e.offsetY])) return null;
    const i = Number(made.convertFromPixel(X_AXIS, e.offsetX));
    return i >= 0 && i < points ? i : null;
  };
  const onMove = useEffectEvent((made: ECharts, e: ElementEvent) => {
    const i = under(made, e);
    if (i == null) return setReading(null);
    // A hand where a click activates. On every move: zrender sets its own cursor again before each one, which also
    // gives the default cursor everywhere else.
    if (onActivate) made.getZr().setCursorStyle("pointer");
    pointer.current = { x: e.offsetX, y: e.offsetY };
    if (i === at) place(i); else setReading({ on: option, i }); // a new point: placed once the tooltip shows that point
  });
  const onClick = useEffectEvent((made: ECharts, e: ElementEvent) => {
    const i = under(made, e);
    if (i != null) activate(i);
  });
  useEffect(() => {
    if (!chart) return;
    const zr = chart.getZr();
    const move = (e: ElementEvent) => onMove(chart, e), click = (e: ElementEvent) => onClick(chart, e), out = () => setReading(null);
    zr.on("mousemove", move);
    zr.on("click", click);
    zr.on("globalout", out);
    return () => {
      zr.off("mousemove", move);
      zr.off("click", click);
      zr.off("globalout", out);
    };
  }, [chart]);

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

  // The band follows the cursor, here and nowhere else, whatever moved it: a key, the pointer, Escape, a new drawing.
  // It runs after the draw above and again after each one: a redraw drops ECharts' band and can move the points. A
  // key's tooltip goes with the band, so the two never sit over different points.
  const banded = useRef(false);
  useEffect(() => {
    if (!chart) return;
    if (at != null) {
      const [x, y] = drawnAt(chart, at, env.height);
      chart.dispatchAction({ type: "updateAxisPointer", currTrigger: "mousemove", x, y });
      place(at);
    } else if (banded.current) chart.dispatchAction({ type: "updateAxisPointer", currTrigger: "leave" });
    banded.current = at != null;
  }, [chart, at, option, env]);

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
    <>
      <div ref={box} id={id} className={className ? `echart ${className}` : "echart"} hidden={hidden} role="group" tabIndex={0}
        aria-label={label} aria-describedby={describedBy} style={{ height }} onKeyDown={onKey} onBlur={() => setReading(null)}>
        <div ref={plot} className="echart-plot" aria-hidden="true" />
        {tip && <div ref={tipEl} className="tip" role="tooltip" style={{ display: at == null ? "none" : "block" }}>{at != null && tip(at)}</div>}
        {failed && <p className="echart-failed">The chart could not be drawn. The data table below has its figures.</p>}
      </div>
      <div className="sr" aria-live="polite">{at != null ? read(at) : ""}</div>
    </>
  );
}
