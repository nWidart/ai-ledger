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
  /** Builds the ECharts option. Pure. Memoize it on the chart's data: a new function is drawn. */
  option: (env: ChartEnv) => EChartsOption;
  /** What makes this the same view: a key built from what the user chose (the range, the filters, the stacking, the
   *  measure), never from the figures. While it stays the same, a new option function is the same chart with newer data:
   *  it is drawn, and the reading and the zoom stay on the points they were on. When it changes, the reading ends and
   *  every point shows again.
   *  Within a view a point keeps its index, and new points come at the end. So the key must also hold what fixes the
   *  first point (a rolling range's first day): when that moves, it is another view.
   *  Without a key the option function is the view, and each new function ends the reading and the zoom. */
  view?: string;
  /** How many points the keys read: days, weeks, sessions, requests. One per band of the option's first x axis. When a
   *  view loses points, a reading on a point that is gone ends, and a zoom that no longer fits shows every point. */
  points: number;
  /** The tooltip for point i. Without it, the chart has no tooltip. */
  tip?: (i: number) => ReactNode;
  /** The sentence the live region says for point i, when a key or the pointer reads it. A reading a key made is said
   *  again when newer data of the same view changes its words; the pointer's is not, and its tooltip shows them. */
  read: (i: number) => string;
  /** Enter on the point being read, or a click on a point. The reading ends with it, unless the handler returns false:
   *  the point has nothing to open, and the reading stays, so the user is not left with silence. The pointer is a hand
   *  over every point of a chart that has a handler: the wrapper cannot tell which points the handler would decline. */
  onActivate?: (i: number) => boolean | void;
  /** The option draws the zoom slider (`zoomSlider()`): the box takes the zoom keys, plus and `=` to halve the points
   *  shown and minus to double them, and follows the slider. Without it, or while the option draws no slider, no zoom is
   *  read or set, and turning it off shows every point. The window is read as point indexes, so the slider must zoom a
   *  category x axis (one band per point): a value or time axis gives values, not indexes, and is not supported. */
  zoom?: boolean;
  /** The points shown changed, by a key, the slider, `reset()`, a new view, or a redraw that left the zoom no slider or
   *  no room: null when every point shows. A redraw of the same view that keeps the points shown is not a change.
   *  A control that leaves with the zoom (a "Show all" button) can lose the focus here with no one pressing it: the
   *  caller moves it to the box (`focus()`), as its own press does. */
  onZoom?: (shown: Shown | null) => void;
  /** The sentence the live region says after the points shown change: null when every point shows. It is said alone
   *  after a zoom key, the slider or `reset()`, and once after the reading (`read(i)`, then this) when an arrow key,
   *  Home or End moved the points shown to include the point it reads. It is also said, with null, when the zoom ends
   *  in the same view with no one asking (the slider or the room for it is gone). A sentence that a redraw makes
   *  untrue is dropped, never said again with other words. */
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
/** Shows every point, silently, unless the chart already does or has no zoom. */
function unzoom(chart: ECharts) {
  const w = windowOf(chart);
  if (w && ((w.start ?? 0) > 0 || (w.end ?? 100) < 100)) chart.dispatchAction(ALL, { silent: true });
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
/** What the live region holds: a reading's sentence, with the zoom sentence said after it, or the zoom sentence alone. */
type Said = { of: "reading"; keyed: boolean; text: string; zoom: string | null } | { of: "zoom"; text: string };
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
  label, describedBy, id, className, hidden, height, option, view, points, tip, read, onActivate, zoom, onZoom, readZoom, ref,
}: EChartProps) {
  const box = useRef<HTMLDivElement>(null), plot = useRef<HTMLDivElement>(null), tipEl = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(UNMEASURED);
  const env = useChartEnv(width, height);
  // The live chart: null until the runtime has loaded, and after disposal.
  const [chart, setChart] = useState<ECharts | null>(null);
  const [failed, setFailed] = useState(false);
  // The point being read: `at` is the cursor, the index of the point, or null.
  const [reading, setReading] = useState<number | null>(null);
  const at = reading != null && reading < points ? reading : null;
  // The points shown, as the chart last reported them: null while every point shows.
  const [zoomed, setZoomed] = useState<Shown | null>(null);
  const shown = zoom && zoomed && zoomed.to < points ? zoomed : null;
  // What the live region holds: the last thing said, as it was worded. It is set when something is said and never
  // derived from the chart, so a redraw of the same view says nothing by itself. A reading holds its sentence, whether a
  // key made it, and the zoom sentence said after it when that key also moved the points shown.
  const [said, setSaid] = useState<Said | null>(null);
  // The view: the caller's key, or the option function when it gives none. A new view is another chart: nothing is read
  // on it yet, the old point may not exist, and it shows every point (the draw effect resets the chart's window).
  // Turning the zoom off shows every point too (the zoom effect). A point the same view no longer has cannot be read.
  // All cleared here, in the render that sees the change, so no effect runs on the old state, and a view, a zoom or a
  // point that comes back brings nothing back.
  const shows = view ?? option;
  const [drawing, setDrawing] = useState({ view: shows, zoom });
  if (drawing.view !== shows) {
    setDrawing({ view: shows, zoom });
    setReading(null);
    setZoomed(null);
    setSaid(null);
  } else if (drawing.zoom !== zoom) {
    setDrawing({ view: shows, zoom });
    setZoomed(null);
    if (zoomed && readZoom) setSaid({ of: "zoom", text: readZoom(null) }); // the zoom ended with no one asking: said once
  } else if (reading != null && reading >= points) {
    setReading(null);
    if (said?.of === "reading") setSaid(null);
  } else if (said?.of === "reading") {
    // A redraw of the same view. The reading a key made, with the focus in the box, follows its figures: when its words
    // changed it is said again, alone. The pointer's is not: the pointer can rest on a point while the user reads another
    // part of the page, and its tooltip shows the newer figures. The zoom sentence after a reading is said once, and is
    // dropped as soon as it is no longer true.
    const text = said.keyed && at != null ? read(at) : said.text;
    if (text !== said.text) setSaid({ ...said, text, zoom: null });
    else if (said.zoom != null && readZoom?.(shown) !== said.zoom) setSaid({ ...said, zoom: null });
  } else if (said && readZoom?.(shown) !== said.text) {
    // The zoom sentence no longer describes the chart (a point more, another window): dropped, which says nothing. A
    // sentence with the new count would be spoken with no one asking.
    setSaid(null);
  }
  /** A new reading, or none: the live region says it in place of what it held. `keyed`: a key made it. Ending no reading
   *  changes nothing, so a pointer that moves over the slider leaves the sentence the slider's drag set. */
  const readAt = (i: number | null, keyed = false) => {
    if (i == null && reading == null) return;
    setReading(i);
    setSaid(i == null ? null : { of: "reading", keyed, text: read(i), zoom: null });
  };
  /** The live region says the points shown, when the caller words them: alone, or after the reading just made. */
  const say = (now: Shown | null, after = false) => {
    if (!readZoom) return;
    const text = readZoom(now);
    setSaid(was => (after && was?.of === "reading" ? { ...was, zoom: text } : { of: "zoom", text }));
  };
  /** Moves the chart's window to `to` (null: every point) and keeps what the chart then shows. Silent: the datazoom
   *  listener is for the slider. The live region says the points shown, if they changed (ECharts may clamp the window
   *  to the one it had): alone, or with `after` behind the reading the same key just made. */
  const zoomTo = (made: ECharts, to: Shown | null, after = false) => {
    made.dispatchAction(to ? { type: "dataZoom", startValue: to.from, endValue: to.to } : ALL, { silent: true });
    const now = shownOn(made, points);
    if (same(now, shown)) return;
    setZoomed(now);
    say(now, after);
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
    // Plus takes Shift on most layouts; Ctrl+plus is the browser's zoom. Nothing to zoom until the chart has drawn a slider.
    const factor = ZOOMS[ev.key];
    if (factor != null && zoom && chart && windowOf(chart) && !modified(ev, true)) {
      ev.preventDefault();
      const next = zoomAround(shown, points, factor, at ?? points - 1);
      if (!same(next, shown)) {
        pointer.current = null; // the tooltip goes over the point, which the zoom moves
        zoomTo(chart, next);
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
    readAt(i, true);
    // The days shown move, by as little as they can, to include the point read. The one live region says both, the
    // reading first: the user asked for the point, and the move is what else changed.
    if (chart && shown && !inside(i, shown)) {
      const span = shown.to - shown.from, start = i < shown.from ? i : i - span;
      zoomTo(chart, { from: start, to: start + span }, true);
    }
  };

  // One handle for the box's life, so a callback ref runs once; reset() reads the chart as it is when it is called.
  const reset = useEffectEvent(() => { if (chart && shown) zoomTo(chart, null); });
  useImperativeHandle(ref, () => ({ reset: () => reset(), focus: () => box.current?.focus() }), []);

  // Escape ends a reading wherever the focus is: the pointer can open one while the focus is elsewhere. A key from
  // inside the box is the box's own, so the reading ends once. The listener captures: a focused control that handles
  // Escape and stops it (a toggletip) would keep it from a listener on the way up. The key is left to that control.
  const open = at != null;
  const end = useEffectEvent(() => readAt(null));
  useEffect(() => {
    if (!open) return;
    const escape = (ev: globalThis.KeyboardEvent) => {
      if (ev.key === "Escape" && !modified(ev) && !box.current?.contains(ev.target as Node)) end();
    };
    document.addEventListener("keydown", escape, true);
    return () => document.removeEventListener("keydown", escape, true);
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
  // The slider moved the window (the wrapper's own moves are silent): keep what it shows, so the caller hears of each
  // step. A reading the new window leaves out ends, so the band and the cursor never sit apart. The live region speaks
  // once per drag: a drag dispatches a step about every 100ms while the pointer is down, and nothing when it lets go,
  // so the points shown are said on the pointer's release. The release is the document's pointerup: zrender reports a
  // mouseup outside the chart only where it captures the pointer, which it does not where touch events exist. A change
  // with the pointer up, such as a click on the slider's track, is said at once.
  const pressed = useRef(false), unsaid = useRef(false);
  const onSlide = useEffectEvent((made: ECharts) => {
    if (!zoom) return;
    const now = shownOn(made, points);
    if (same(now, shown)) return; // a drag within one point
    setZoomed(now);
    if (at != null && !inside(at, now)) readAt(null);
    if (pressed.current) unsaid.current = true;
    else say(now);
  });
  const onRelease = useEffectEvent(() => {
    pressed.current = false;
    if (unsaid.current) say(shown);
    unsaid.current = false;
  });
  useEffect(() => {
    if (!chart) return;
    const zr = chart.getZr();
    const move = (e: ElementEvent) => onMove(chart, e), click = (e: ElementEvent) => onClick(chart, e), out = () => end();
    const slide = () => onSlide(chart);
    const listen = (on: boolean) => {
      for (const name of ["pointerup", "pointercancel"]) {
        if (on) document.addEventListener(name, up, true);
        else document.removeEventListener(name, up, true);
      }
    };
    const up = () => { listen(false); onRelease(); };
    const down = () => { pressed.current = true; listen(true); };
    zr.on("mousemove", move);
    zr.on("click", click);
    zr.on("globalout", out);
    zr.on("mousedown", down);
    chart.on("datazoom", slide);
    return () => {
      zr.off("mousemove", move);
      zr.off("click", click);
      zr.off("globalout", out);
      zr.off("mousedown", down);
      chart.off("datazoom", slide);
      listen(false);
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

  /** After a redraw of the same view, the window goes back on the points it showed. The slider merges into the old one
   *  by id and keeps its window, but as ECharts holds it: a drag's window is a share of the points, which is other
   *  points once their number changes. A redraw that leaves no slider, or no room for the window, leaves no zoom. */
  const keep = useEffectEvent((made: ECharts) => {
    if (!zoom) return;
    let now = shownOn(made, points);
    if (windowOf(made) && !same(now, shown)) {
      made.dispatchAction(shown ? { type: "dataZoom", startValue: shown.from, endValue: shown.to } : ALL, { silent: true });
      now = shownOn(made, points);
    }
    if (same(now, zoomed)) return;
    setZoomed(now);
    // The zoom ended with no one asking: said once, so no one goes on believing the chart shows fewer days.
    if (zoomed && !now) say(null);
  });
  // The chart is given the caller's option with what the wrapper keeps for itself, so no option builder can forget it:
  // reduced motion, and the band. Only the wrapper's actions draw the band: left to its own triggers, ECharts also draws
  // one on a click, over a point nothing reads (a click on a point the chart declines, with the pointer at rest).
  // Motion is for the chart's first drawing alone: its marks grow once. Every later one is drawn at once, so a bar that
  // newer data adds, or a new view brings, does not grow while the others stand.
  // A new view shows every point: its slider merges into the old one by id and would keep the old window, so the window
  // is reset.
  const drew = useRef(shows), drawn = useRef<ECharts | null>(null);
  useEffect(() => {
    if (!chart) return;
    const made = option(env), first = drawn.current !== chart;
    drawn.current = chart;
    chart.setOption({ ...made, ...(env.motion && first ? {} : { animation: false }), axisPointer: { ...made.axisPointer, triggerOn: "none" } }, { replaceMerge: REPLACE });
    if (drew.current === shows) return keep(chart);
    drew.current = shows;
    unsaid.current = false; // a drag still going changed the old view: its release has nothing to say of this one
    unzoom(chart);
  }, [chart, option, env, shows]);
  // Without zoom, nothing reads or sets the window: a chart left zoomed would have no way back.
  useEffect(() => { if (chart && !zoom) unzoom(chart); }, [chart, zoom]);

  // The caller hears of every change to the points shown, whatever made it: a key, the slider, reset(), a new view, or
  // a redraw that left the zoom no slider or no room.
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

  // What the live region says: the zoom sentence alone, the reading, or the reading and then the zoom sentence.
  const live = !said ? "" : said.of === "reading" && said.zoom != null ? `${said.text} ${said.zoom}` : said.text;

  return (
    <>
      <div ref={box} id={id} className={className ? `echart ${className}` : "echart"} hidden={hidden} role="group" tabIndex={0}
        aria-label={label} aria-describedby={describedBy} style={{ height }} onKeyDown={onKey} onBlur={() => readAt(null)}>
        <div ref={plot} className="echart-plot" aria-hidden="true" />
        {tip && <div ref={tipEl} className="tip" role="tooltip" style={{ display: at == null ? "none" : "block" }}>{at != null && tip(at)}</div>}
        {failed && <p className="echart-failed">The chart could not be drawn. The data table below has its figures.</p>}
      </div>
      {/* One polite region for the reading and the zoom. It holds what was last said, so a redraw of the same view
          repeats nothing; only a key's reading whose figures the newer data changed is said again. */}
      <div className="sr" aria-live="polite">{live}</div>
    </>
  );
}
