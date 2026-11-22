// The session map: one dot per session, placed by its starting context (log scale) and its peak share of the window. The 30k-start
// and 80%-peak lines cut it into four named quadrants; selecting one narrows the window pressure bars and lists its sessions.
// The model, the fit, the picking and the drawing are mapDots.ts's (echart-context, decision 9). The wrapper draws and reads
// nothing (`points={0}`); this component reads: the sessions oldest first, by key and by pointer, with its own tooltip, ring
// and live region. All of them place a dot at the fit's pixel, as the option draws it, so they work before the drawing has
// loaded and when it fails to.
import { useCallback, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { ContextPayload, SessionPoint } from "../../api";
import { useColors } from "../../colors";
import { tipAt, useWidth } from "../../components/chart";
import { ChartTable } from "../../components/DataTable";
import { EChart } from "../../components/echart/EChart";
import { labelWidth } from "../../components/echart/option";
import { useChartEnv, type ChartEnv } from "../../components/echart/tokens";
import { subjectAttrs } from "../../components/menu/subject";
import { openSessionSheet, sessName, shortId } from "../../components/sheets/session";
import { Table, type Column, type RowPick } from "../../components/table/Table";
import { num, plural, when } from "../../format";
import { Proj, SourceName } from "./cells";
import { dotAt, mapFit, mapModel, mapOption, quadAtPixel } from "./mapDots";
import { QUADS, quadOf, share, short, windowLabel, type Quad } from "./context";
import { SOURCE_LABELS } from "../../components/Filters";
import { modified } from "../../components/keys";
import "./SessionMap.css";

type SessionsMap = ContextPayload["sessions_map"];
/** The legend's dot and ring, as mapDots draws them. */
const R = 4, RING = 7.5;
/** The most sessions a selected quadrant lists. */
export const QUAD_LIST_MAX = 20;
/** How far each key moves the reading through the sessions, oldest first. */
const STEPS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity };

/** A point in one sentence, as the live region says it (the tooltip carries the same fields). */
export const readPoint = (p: SessionPoint): string =>
  `${sessName(p)}: ${p.project ?? "(no project)"}, ${SOURCE_LABELS[p.source]}, started ${when(p.first_ts)}: starting context ${short(p.start)} tokens, peak ${short(p.peak)} tokens, `
  + `${share(p.peak / p.window)} of a ${windowLabel(p.window)} window, ${plural(p.turns, "turn")}, ${plural(p.compactions, "compaction")}`;

/** The session read, by its id: whether a key read it, its sentence as last said, and a count that makes the live region say
 *  it again. */
interface Reading { id: string; keyed: boolean; text: string; n: number }

const QUAD = Object.fromEntries(QUADS.map(q => [q.id, q])) as Record<Quad, typeof QUADS[number]>;

// The chart's data table: one row per session; the row opens the session's sheet. The session is the row header: its name as a button, with its short id under a title.
const COLUMNS: Column<SessionPoint>[] = [
  { id: "session", header: "Session", cellProps: () => ({ className: "when sess" }), cell: p => <>
    <button type="button" className="cellbtn" data-session={p.session_id} title={p.title || p.session_id}>{sessName(p)}</button>
    {p.title && <div className="muted small">{shortId(p.session_id)}</div>}</> },
  { id: "project", header: "Project", cell: p => <Proj project={p.project} /> },
  { id: "agent", header: "Agent", cell: p => <SourceName source={p.source} /> },
  { id: "started", header: "Started", cell: p => when(p.first_ts) },
  { id: "start", header: "Starting context", align: "num", cell: p => short(p.start) },
  { id: "peak", header: "Peak share", align: "num", cell: p => share(p.peak / p.window) },
  { id: "window", header: "Window", align: "num", cell: p => windowLabel(p.window) },
  { id: "turns", header: "Turns", align: "num", cell: p => num(p.turns) },
  { id: "compactions", header: "Compactions", align: "num", cell: p => num(p.compactions) },
  { id: "quadrant", header: "Quadrant", cell: p => QUAD[quadOf(p)].label },
];
const PICK: RowPick<SessionPoint> = { value: p => p.session_id, open: v => openSessionSheet(v), subject: p => ({ kind: "session", value: p.session_id }) };

/** Every session of the view with a measured start, a known window and a peak, as a dot. quad: the selected quadrant (null for none);
 *  onQuad selects one, or clears it with null. view: what the user chose, never the figures: a new view ends the reading. */
export function SessionMap({ map, quad, onQuad, view }: { map: SessionsMap; quad: Quad | null; onQuad: (q: Quad | null) => void; view: string }) {
  const color = useColors(), box = useRef<HTMLDivElement>(null), tipEl = useRef<HTMLDivElement>(null), width = useWidth(box);
  const quadsRef = useRef<HTMLDivElement>(null);
  /** Clears the quadrant from its controls: Clear goes away with it, so focus moves to the quadrant that was pressed, not to the body. */
  const clearQuad = () => {
    const group = quadsRef.current;
    if (group?.contains(document.activeElement)) group.querySelector<HTMLButtonElement>(`button[data-quad="${quad}"]`)?.focus();
    onQuad(null);
  };
  // The environment measures the quadrants' names: it changes when the page's web font has loaded, and the names are measured
  // again. Its text scale, read once per render, is the one the fit and the drawing share. Its height is the wrapper's concern.
  const env = useChartEnv(width, 0), s = env.textScale;
  const model = useMemo(() => mapModel(map.points), [map.points]);
  const fit = useMemo(() => mapFit(model, width, s, (t, w) => labelWidth(env, t, w)), [model, width, s, env]);
  const option = useCallback((e: ChartEnv) => mapOption(fit, { ...e, textScale: s }, { quad, color }), [fit, s, quad, color]);
  const pts = model.points, counts = model.counts;
  const order = useMemo(() => new Map(pts.map((p, i) => [p.session_id, i])), [pts]);

  // The reading, held by the session's id. A new view ends it, and so do newer figures without its session, in the render
  // that sees them: `at` is null then, so nothing below looks up a dot the model no longer holds. A reading a key made is
  // said again when newer figures change its words; the pointer's is not, and its tooltip shows the newer figures.
  const [reading, setReading] = useState<Reading | null>(null);
  const [seen, setSeen] = useState(view);
  const found = reading && seen === view ? order.get(reading.id) : undefined;
  const at = found ?? null, cur = at != null ? pts[at]! : null, shown = cur ? reading : null;
  const text = cur ? readPoint(cur) : null;
  if (seen !== view) {
    setSeen(view);
    setReading(null);
  } else if (reading && at == null) setReading(null);
  else if (reading?.keyed && text !== reading.text) setReading({ ...reading, text: text!, n: reading.n + 1 });

  /** Reads session i, or none, and says it. A key that reads the session already read says it again. */
  const read = (i: number | null, keyed = false) => {
    if (i == null) return setReading(null);
    const p = pts[i]!;
    setReading(was => ({ id: p.session_id, keyed, text: readPoint(p), n: (was?.n ?? 0) + 1 }));
  };

  // Where the pointer's reading points, in client px; null for a key's, which points at the dot.
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const placeTip = () => {
    const el = box.current, tip = tipEl.current;
    if (!el || !tip || at == null) return;
    const r = el.getBoundingClientRect(), d = fit.dots[at]!, p = pointer.current ?? { x: r.left + d.x, y: r.top + d.y };
    const pos = tipAt(el, tip, p.x, p.y);
    tip.style.left = `${pos.left}px`;
    tip.style.top = `${pos.top}px`;
  };
  const place = useEffectEvent(placeTip);
  useLayoutEffect(() => place(), [shown, fit]);

  /** The pointer's place in the box, which is the origin of the fit's pixels: read at the event, so a scroll is counted. */
  const inBox = (ev: MouseEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  };
  // A hand over the plot, where a click opens a session or selects a quadrant.
  const [hand, setHand] = useState(false);
  const onMove = (ev: MouseEvent) => {
    const { x, y } = inBox(ev), i = dotAt(fit, x, y);
    setHand(quadAtPixel(fit, x, y) != null || i != null);
    if (i == null) { pointer.current = null; return read(null); }
    pointer.current = { x: ev.clientX, y: ev.clientY };
    if (i === at) placeTip();
    else read(i);
  };
  const onLeave = () => { setHand(false); pointer.current = null; read(null); };
  // A dot opens its session; the plot away from any dot selects the quadrant under the pointer, or clears it when it is selected.
  const onClick = (ev: MouseEvent) => {
    const { x, y } = inBox(ev), i = dotAt(fit, x, y);
    if (i != null) return openSessionSheet(pts[i]!.session_id);
    const q = quadAtPixel(fit, x, y);
    if (q) onQuad(q === quad ? null : q);
  };
  const onKey = (ev: KeyboardEvent) => {
    if (modified(ev)) return; // Alt+Left is history, Ctrl+Home the page: not ours
    // One Escape dismisses the reading and clears the quadrant, so the bars never stay narrowed behind a dismissed reading.
    if (ev.key === "Escape") { read(null); if (quad) onQuad(null); return; }
    if (ev.key === "Enter") { if (cur) { ev.preventDefault(); openSessionSheet(cur.session_id); } return; }
    const d = STEPS[ev.key];
    if (d == null) return;
    ev.preventDefault();
    pointer.current = null;
    read(Math.max(0, Math.min(pts.length - 1, (at ?? (d > 0 ? -1 : pts.length)) + d)), true);
  };

  // Escape ends a reading wherever the focus is: the pointer can open one while the focus is elsewhere. A key from inside the
  // box is the box's own. It never clears the quadrant from there: Escape in a sheet or a menu is theirs. Capturing, as the
  // wrapper's: a control that stops Escape would keep it from a listener on the way up. The key goes on to that control.
  // Attached as the tooltip is drawn, before the paint: an Escape pressed as it shows must find the listener.
  const reads = shown != null;
  const end = useEffectEvent(() => read(null));
  useLayoutEffect(() => {
    if (!reads) return;
    const escape = (ev: globalThis.KeyboardEvent) => {
      if (ev.key === "Escape" && !modified(ev) && !box.current?.contains(ev.target as Node)) end();
    };
    document.addEventListener("keydown", escape, true);
    return () => document.removeEventListener("keydown", escape, true);
  }, [reads]);

  if (!pts.length) return <p className="muted session-map-empty">No session in this view has a measured start, a known window and a peak.</p>;

  const label = `Session map: ${plural(pts.length, "session")} shown, ${num(counts.full + counts.both)} at or over 80% of their window, ${num(counts.both)} of those started at or over 30k tokens. `
    + "Use the left and right arrow keys to step through sessions from oldest to newest, Enter to open one, Escape to dismiss it and clear the selected quadrant.";
  const count = map.total <= pts.length ? plural(pts.length, "session") : `Showing the newest ${num(pts.length)} of ${num(map.total)} sessions`;
  const inQuad = quad ? pts.filter(p => quadOf(p) === quad).reverse() : []; // newest first
  const dot = at != null ? fit.dots[at]! : null;

  return (
    <div className="session-map">
      <p className="smcount">{count}. <span className="muted">Sessions without a measured start, a known window or a peak are left out.</span></p>
      <div className="legend">
        <span className="key"><svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r={R} fill="var(--text-secondary)" fillOpacity=".75" /></svg>A session, in its project's colour</span>
        <span className="key"><svg width="18" height="18" aria-hidden="true"><circle cx="9" cy="9" r={R} fill="var(--text-secondary)" fillOpacity=".75" /><circle cx="9" cy="9" r={RING} fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" /></svg>Ring: compacted at least once</span>
      </div>
      <div ref={box} className={hand ? "map-box hand" : "map-box"} onKeyDown={onKey} onMouseMove={onMove} onMouseLeave={onLeave} onClick={onClick}
        onBlur={ev => { if (!box.current?.contains(ev.relatedTarget as Node | null)) read(null); }}>
        <EChart label={label} height={fit.height} option={option} view={view} points={0} read={() => ""} />
        {dot && cur && <svg className="map-mark" aria-hidden="true" width={width} height={fit.height}>
          <circle cx={dot.x} cy={dot.y} r={cur.compactions > 0 ? RING + 3 : R + 4} /></svg>}
        {/* The app's stylesheet hides a .tip until its chart shows it. */}
        {cur && <div ref={tipEl} className="tip" role="tooltip" style={{ display: "block" }}>
          <div className="tname"><b>{sessName(cur)}</b></div>
          <div className="muted">{cur.project ?? "(no project)"} · {SOURCE_LABELS[cur.source]} · {when(cur.first_ts)}</div>
          <div className="row"><span>Starting context</span><b>{short(cur.start)}</b></div>
          <div className="row"><span>Peak</span><b>{short(cur.peak)} ({share(cur.peak / cur.window)})</b></div>
          <div className="row"><span>Window</span><b>{windowLabel(cur.window)}</b></div>
          <div className="row"><span>Turns</span><b>{num(cur.turns)}</b></div>
          <div className="row"><span>Compactions</span><b>{num(cur.compactions)}</b></div>
        </div>}
        {/* The map's one polite region: the wrapper's beside it stays empty. A new span says a sentence again, even the same words. */}
        <div className="sr map-live" aria-live="polite">{shown && <span key={shown.n}>{shown.text}</span>}</div>
      </div>
      <div className="quads" ref={quadsRef} role="group" aria-label="Quadrants: select one to narrow the window pressure bars to its sessions"
        onKeyDown={ev => { if (ev.key === "Escape" && quad) { ev.stopPropagation(); clearQuad(); } }}>
        {QUADS.map(q => <button key={q.id} type="button" aria-pressed={quad === q.id} data-quad={q.id} onClick={() => onQuad(quad === q.id ? null : q.id)}>
          <b>{q.label}</b> <span className="n" aria-hidden="true">{num(counts[q.id])}</span><span className="sr">{plural(counts[q.id], "session")},</span> <span className="what">{q.what}</span></button>)}
        {quad && <button type="button" className="linkish clear" onClick={clearQuad}>Clear</button>}
      </div>
      {quad && <div className="qlist" role="region" aria-label={`Sessions in ${QUAD[quad].label}`}>
        <p className="muted small">{inQuad.length > QUAD_LIST_MAX ? `The ${num(QUAD_LIST_MAX)} newest of ${plural(inQuad.length, "session")}` : plural(inQuad.length, "session")} on the map
          with {QUAD[quad].what}, newest first. The window pressure bars above count these alone.</p>
        {inQuad.length > 0 && <ul>{inQuad.slice(0, QUAD_LIST_MAX).map(p => <li key={p.session_id}>
          <button type="button" className="cellbtn qsess" data-session={p.session_id} {...subjectAttrs("session", p.session_id)} title={p.title || p.session_id} onClick={() => openSessionSheet(p.session_id)}>
            <span className="qname">{sessName(p)}</span>
            <span className="muted">{p.project ?? "no project"} · {SOURCE_LABELS[p.source]} · {when(p.first_ts)} · starts {short(p.start)} · peak {share(p.peak / p.window)}</span>
          </button></li>)}</ul>}
      </div>}
      {/* The chart's text alternative: one row per session shown. */}
      <ChartTable><Table name="Sessions on the map" region="scroll tall" rows={pts} columns={COLUMNS} rowId={p => p.session_id} pick={PICK} /></ChartTable>
    </div>
  );
}
