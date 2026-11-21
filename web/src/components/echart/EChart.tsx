// The one chart component (design decision 5). It owns the box (a focusable, labelled group at its height from the first
// render), the ECharts instance (loaded lazily, made once, disposed on unmount) and what the chart is drawn from: the
// option the caller builds from the environment, drawn again when the option, the theme, the media or the box's size
// changes. ECharts draws into the plot, which assistive technology does not see.
// The reading is React's (decision 1): the point the keys or the pointer read, the tooltip and the live readout need no
// chart, so they work while the runtime loads and when it fails. ECharts only draws the band over the point being read.
// The zoom (decision 8) is ECharts' window: its slider, or the wrapper's dataZoom action, moves it, and the wrapper reads
// it back from the chart after each move. React keeps a copy for the keys, the caller and the live region.
import { useEffect, useEffectEvent, useImperativeHandle, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { tipAt } from "../chart";
import { modified } from "../keys";
import type { ECharts, EChartsOption, ElementEvent } from "./echarts";
import { loadECharts, type Runtime } from "./load";
import { MIN_SHOWN } from "./option";
import { useChartEnv, type ChartEnv } from "./tokens";
import "./EChart.css";

/** The points a zoom shows, first and last, as indexes of every point. */
export interface Shown { from: number; to: number }

/** What a chart can ask of its box from outside it. */
export interface EChartHandle {
  /** Shows every point again, and says so in the live region. Nothing happens when every point shows. */
  reset(): void;
  /** Focuses the box, such as after a "Show all days" button that leaves with the reset. */
  focus(): void;
}

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
  /** Builds the ECharts option. Pure. Memoize it on the chart's data: a new function is a new drawing, which ends the
   *  reading and shows every point again. */
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
  /** The option draws the zoom slider (`zoomSlider()`): the box takes the zoom keys, plus and `=` to halve the points
   *  shown and minus to double them, and follows the slider. Without it, no zoom is read or set. */
  zoom?: boolean;
  /** The points shown changed, by a key, the slider, `reset()` or a new drawing: null when every point shows. */
  onZoom?: (shown: Shown | null) => void;
  /** The sentence the live region says after the user changes the points shown: null when every point shows. */
  readZoom?: (shown: Shown | null) => string;
  /** `reset()` shows every point again; `focus()` focuses the box. */
  ref?: Ref<EChartHandle>;
}

/** The width a chart is drawn at until its box is laid out, while the box is hidden, and in jsdom, which lays nothing out. */
const UNMEASURED = 800;
/** The components a drawing replaces whole, so a series, an axis or a slider the new option leaves out is gone. An item
 *  with the id of one drawn before merges into it: the slider's fixed id (`zoomSlider()`) keeps the zoom window, since
 *  no option names its start or its end. */
const REPLACE = ["series", "xAxis", "yAxis", "grid", "dataZoom"];
const GRID = { gridIndex: 0 }, X_AXIS = { xAxisIndex: 0 };
/** How far each key moves the cursor. */
const STEPS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity };
/** What each zoom key does to the number of points shown. */
const ZOOMS: Record<string, number> = { "+": .5, "=": .5, "-": 2 };
/** The dataZoom action that shows every point. */
const ALL = { type: "dataZoom", start: 0, end: 100 };

type Range = { start?: number; end?: number; startValue?: unknown; endValue?: unknown };
/** The chart's zoom window as its first dataZoom holds it, or undefined when the option draws none. */
const windowOf = (chart: ECharts) => (chart.getOption().dataZoom as Range[] | undefined)?.[0];
/** The points a chart of n points shows: null when it shows every point, or has no zoom. */
function shownOn(chart: ECharts, n: number): Shown | null {
  const w = windowOf(chart);
  if (typeof w?.startValue !== "number" || typeof w.endValue !== "number") return null;
  const from = Math.max(0, Math.round(w.startValue)), to = Math.min(n - 1, Math.round(w.endValue));
  return from <= 0 && to >= n - 1 ? null : { from, to };
}
const same = (a: Shown | null, b: Shown | null) => a?.from === b?.from && a?.to === b?.to;
const inside = (i: number, s: Shown | null) => !s || (i >= s.from && i <= s.to);

/** The points shown after a zoom key of factor f (ZOOMS) on a chart of n points showing `s`, around point c: c keeps its
 *  place along the window, or the window is centred on it when it is outside. Null when every point shows; `s` itself
 *  when the span cannot change. */
function zoomAround(s: Shown | null, n: number, f: number, c: number): Shown | null {
  const cur = s ?? { from: 0, to: n - 1 }, span = cur.to - cur.from + 1;
  const next = Math.min(n, Math.max(Math.min(MIN_SHOWN, n), f < 1 ? Math.ceil(span * f) : span * f));
  if (next === span) return s;
  if (next === n) return null;
  const at = inside(c, cur) ? c - Math.round((c - cur.from) / Math.max(1, span - 1) * (next - 1)) : c - Math.floor((next - 1) / 2);
  const from = Math.max(0, Math.min(n - next, at));
  return { from, to: from + next - 1 };
}
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

export function EChart({
  label, describedBy, id, className, hidden, height, option, points, tip, read, onActivate, zoom, onZoom, readZoom, ref,
}: EChartProps) {
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
  // The points shown, as the chart last reported them, with the drawing they were shown on: a new drawing shows every
  // point (the draw effect resets the chart's window). `shown` is null while every point shows.
  const [zoomed, setZoomed] = useState<{ on: EChartProps["option"]; shown: Shown } | null>(null);
  const shown = zoom && zoomed?.on === option && zoomed.shown.to < points ? zoomed.shown : null;
  // What the live region says after a zoom change, until the next reading, on the drawing it was said on.
  const [status, setStatus] = useState<{ on: EChartProps["option"]; text: string } | null>(null);
  /** A new reading, or none: the live region says it in place of the zoom status. Ending no reading changes nothing, so
   *  a pointer that moves over the slider leaves the status the slider's drag set. */
  const readAt = (i: number | null) => {
    if (i == null && at == null) return;
    setReading(i == null ? null : { on: option, i });
    setStatus(null);
  };
  /** Moves the chart's window to `to` (null: every point) and keeps what the chart then shows. Silent: the datazoom
   *  listener is for the slider. With `say`, the live region says the points shown. */
  const zoomTo = (made: ECharts, to: Shown | null, say: boolean) => {
    made.dispatchAction(to ? { type: "dataZoom", startValue: to.from, endValue: to.to } : ALL, { silent: true });
    const now = shownOn(made, points);
    setZoomed(now && { on: option, shown: now });
    if (say && readZoom) setStatus({ on: option, text: readZoom(now) });
  };
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
    if (onActivate(i) !== false) readAt(null);
    return true;
  };

  const onKey = (ev: KeyboardEvent) => {
    // Plus takes Shift on most layouts; Ctrl+plus is the browser's zoom. Nothing to zoom until the chart has drawn.
    const factor = ZOOMS[ev.key];
    if (factor != null && zoom && chart && !modified(ev, true)) {
      ev.preventDefault();
      const next = zoomAround(shown, points, factor, at ?? points - 1);
      if (!same(next, shown)) {
        pointer.current = null; // the tooltip goes over the point, which the zoom moves
        zoomTo(chart, next, true);
      }
      return;
    }
    if (modified(ev)) return; // Alt+Left is history, Ctrl+Home the page: not ours
    // Here as well as on the document: an element around the chart may stop the key before it gets there. The key goes
    // on, as it does from the hand-written charts: what is around the chart may have its own use for Escape.
    if (ev.key === "Escape") return readAt(null);
    if (ev.key === "Enter") { if (at != null && activate(at)) ev.preventDefault(); return; }
    const step = STEPS[ev.key];
    if (step == null || !points) return;
    ev.preventDefault();
    const from = at ?? (step > 0 ? -1 : points); // the first Right reads the first point, the first Left the last
    const i = Math.max(0, Math.min(points - 1, from + step));
    pointer.current = null;
    readAt(i);
    // The days shown move, by as little as they can, to include the point read; the reading is said, not the zoom.
    if (chart && shown && !inside(i, shown)) {
      const span = shown.to - shown.from, start = i < shown.from ? i : i - span;
      zoomTo(chart, { from: start, to: start + span }, false);
    }
  };

  useImperativeHandle(ref, () => ({
    reset: () => { if (chart && shown) zoomTo(chart, null, true); },
    focus: () => box.current?.focus(),
  }));

  // Escape ends a reading wherever the focus is: the pointer can open one while the focus is elsewhere. A key from
  // inside the box is the box's own.
  const open = at != null;
  const end = useEffectEvent(() => readAt(null));
  useEffect(() => {
    if (!open) return;
    const escape = (ev: globalThis.KeyboardEvent) => {
      if (ev.key === "Escape" && !modified(ev) && !box.current?.contains(ev.target as Node)) end();
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
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
    if (i == null) return readAt(null);
    // A hand where a click activates. On every move: zrender sets its own cursor again before each one, which also
    // gives the default cursor everywhere else.
    if (onActivate) made.getZr().setCursorStyle("pointer");
    pointer.current = { x: e.offsetX, y: e.offsetY };
    if (i === at) place(i); else readAt(i); // a new point: placed once the tooltip shows that point
  });
  const onClick = useEffectEvent((made: ECharts, e: ElementEvent) => {
    const i = under(made, e);
    if (i != null) activate(i);
  });
  // The slider moved the window (the wrapper's own moves are silent): keep what it shows and say it. A reading the new
  // window leaves out ends, so the band and the cursor never sit apart.
  const onSlide = useEffectEvent((made: ECharts) => {
    if (!zoom) return;
    const now = shownOn(made, points);
    if (same(now, shown)) return; // a drag within one point
    setZoomed(now && { on: option, shown: now });
    if (at != null && !inside(at, now)) readAt(null);
    if (readZoom) setStatus({ on: option, text: readZoom(now) });
  });
  useEffect(() => {
    if (!chart) return;
    const zr = chart.getZr();
    const move = (e: ElementEvent) => onMove(chart, e), click = (e: ElementEvent) => onClick(chart, e), out = () => end();
    const slide = () => onSlide(chart);
    zr.on("mousemove", move);
    zr.on("click", click);
    zr.on("globalout", out);
    chart.on("datazoom", slide);
    return () => {
      zr.off("mousemove", move);
      zr.off("click", click);
      zr.off("globalout", out);
      chart.off("datazoom", slide);
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

  // Reduced motion is the wrapper's to keep, so no option builder can forget it. A new option function is a new drawing:
  // its slider merges into the old one by id and would keep the old window, so the window is reset to every point.
  const drew = useRef(option);
  useEffect(() => {
    if (!chart) return;
    const drawing = option(env);
    chart.setOption(env.motion ? drawing : { ...drawing, animation: false }, { replaceMerge: REPLACE });
    if (drew.current === option) return;
    drew.current = option;
    const w = windowOf(chart);
    if (w && ((w.start ?? 0) > 0 || (w.end ?? 100) < 100)) chart.dispatchAction(ALL, { silent: true });
  }, [chart, option, env]);

  // The caller hears of every change to the points shown, whatever made it: a key, the slider, reset() or a new drawing.
  const told = useRef<Shown | null>(null);
  const tell = useEffectEvent(() => onZoom?.(shown));
  useEffect(() => {
    if (same(told.current, shown)) return;
    told.current = shown;
    tell();
  }, [shown]);

  // The band follows the cursor, here and nowhere else, whatever moved it: a key, the pointer, Escape, a new drawing.
  // It runs after the draw above and again after each one, and after a zoom: a redraw drops ECharts' band, and a redraw
  // or a zoom can move the points. A key's tooltip goes with the band, so the two never sit over different points.
  const banded = useRef(false);
  useEffect(() => {
    if (!chart) return;
    if (at != null) {
      const [x, y] = drawnAt(chart, at, env.height);
      chart.dispatchAction({ type: "updateAxisPointer", currTrigger: "mousemove", x, y });
      place(at);
    } else if (banded.current) chart.dispatchAction({ type: "updateAxisPointer", currTrigger: "leave" });
    banded.current = at != null;
  }, [chart, at, option, env, shown]);

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
        aria-label={label} aria-describedby={describedBy} style={{ height }} onKeyDown={onKey} onBlur={() => readAt(null)}>
        <div ref={plot} className="echart-plot" aria-hidden="true" />
        {tip && <div ref={tipEl} className="tip" role="tooltip" style={{ display: at == null ? "none" : "block" }}>{at != null && tip(at)}</div>}
        {failed && <p className="echart-failed">The chart could not be drawn. The data table below has its figures.</p>}
      </div>
      <div className="sr" aria-live="polite">{status?.on === option ? status.text : at != null ? read(at) : ""}</div>
    </>
  );
}
