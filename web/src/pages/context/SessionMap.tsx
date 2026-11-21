// The session map: one dot per session, placed by its starting context (log scale) and its peak share of the window. The 30k-start
// and 80%-peak lines cut it into four named quadrants; selecting one narrows the window pressure bars and lists its sessions.
import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import type { ContextPayload, SessionPoint } from "../../api";
import { useColors } from "../../colors";
import { scaleMargins, textScale, tipAt, useWidth } from "../../components/chart";
import { ChartTable, DataTable } from "../../components/DataTable";
import { openSessionSheet, pickRow, sessName, shortId } from "../../components/sheets/session";
import { num, plural, when } from "../../format";
import { Proj, SourceName } from "./cells";
import { NEAR_LIMIT, QUADS, quadAt, quadOf, START_LARGE_TOKENS, share, short, windowLabel, type Quad } from "./context";
import { SOURCE_LABELS } from "../../components/Filters";
import "./SessionMap.css";

type SessionsMap = ContextPayload["sessions_map"];
const H = 320, M0 = { t: 14, r: 16, b: 46, l: 52 }; // the margins at the default text size
/** A pointer picks the nearest dot within this many pixels. */
const PICK_PX = 12;
const R = 4, RING = 7.5;
const STEPS = [1, 2, 5, 10];
/** The most sessions a selected quadrant lists. */
export const QUAD_LIST_MAX = 20;

/** The round value (1, 2, 5 times a power of ten) at or below v. */
export function roundDown(v: number): number {
  const p = 10 ** Math.floor(Math.log10(v));
  return p * [...STEPS].reverse().find(m => m * p <= v * (1 + 1e-9))!;
}
/** The round value at or above v. */
export function roundUp(v: number): number {
  const p = 10 ** Math.floor(Math.log10(v));
  return p * STEPS.find(m => m * p >= v * (1 - 1e-9))!;
}
/** The x domain: round values around the starts, always spanning the 30k line. */
export function startDomain(starts: number[]): [number, number] {
  const lo = Math.max(1, Math.min(START_LARGE_TOKENS, ...starts)), hi = Math.max(START_LARGE_TOKENS, ...starts);
  const a = roundDown(lo), b = roundUp(hi);
  return [a, b > a ? b : a * 10];
}
/** Where a start sits on the log axis, 0 at the domain's low end and 1 at its high end. */
export const logFraction = (v: number, [lo, hi]: [number, number]): number => (Math.log(Math.max(v, lo)) - Math.log(lo)) / (Math.log(hi) - Math.log(lo));
/** The round ticks (1, 2, 5 times a power of ten) inside the domain. */
export function startTicks([lo, hi]: [number, number]): number[] {
  const out: number[] = [];
  for (let p = 10 ** Math.floor(Math.log10(lo)); p <= hi * (1 + 1e-9); p *= 10)
    for (const m of [1, 2, 5]) if (m * p >= lo * (1 - 1e-9) && m * p <= hi * (1 + 1e-9)) out.push(m * p);
  return out;
}
/** A point's share of its window as drawn: a peak over the window sits at 100%. */
export const drawnShare = (p: SessionPoint): number => Math.min(1, p.peak / p.window);

/** A point in one sentence, as the readout says it (the tooltip carries the same fields). */
export const readPoint = (p: SessionPoint): string =>
  `${sessName(p)}: ${p.project ?? "(no project)"}, ${SOURCE_LABELS[p.source]}, started ${when(p.first_ts)}: starting context ${short(p.start)} tokens, peak ${short(p.peak)} tokens, `
  + `${share(p.peak / p.window)} of a ${windowLabel(p.window)} window, ${plural(p.turns, "turn")}, ${plural(p.compactions, "compaction")}`;

const byDate = (a: SessionPoint, b: SessionPoint) => (a.first_ts ?? "").localeCompare(b.first_ts ?? "") || a.session_id.localeCompare(b.session_id);
const QUAD = Object.fromEntries(QUADS.map(q => [q.id, q])) as Record<Quad, typeof QUADS[number]>;

/** A session as a table's header cell: its name as a button, with its short id under a title. */
const SessionTh = ({ p }: { p: SessionPoint }) => <th scope="row" className="when sess">
  <button type="button" className="cellbtn" data-session={p.session_id} title={p.title || p.session_id}>{sessName(p)}</button>
  {p.title && <div className="muted small">{shortId(p.session_id)}</div>}</th>;

/** Every session of the view with a measured start, a known window and a peak, as a dot. quad: the selected quadrant (null for none);
 *  onQuad selects one, or clears it with null. */
export function SessionMap({ map, quad, onQuad }: { map: SessionsMap; quad: Quad | null; onQuad: (q: Quad | null) => void }) {
  const color = useColors(), box = useRef<HTMLDivElement>(null), tip = useRef<HTMLDivElement>(null), W = useWidth(box);
  const [at, setAt] = useState<number | null>(null), pos = useRef({ x: 0, y: 0 });
  const pts = useMemo(() => map.points.slice().sort(byDate), [map.points]);
  const dom = useMemo(() => startDomain(pts.map(p => p.start)), [pts]);
  const counts = useMemo(() => {
    const c: Record<Quad, number> = { lean: 0, heavy: 0, full: 0, both: 0 };
    for (const p of pts) c[quadOf(p)]++;
    return c;
  }, [pts]);
  useLayoutEffect(() => {
    if (at == null || !tip.current || !box.current) return;
    const p = tipAt(box.current, tip.current, pos.current.x, pos.current.y);
    tip.current.style.left = p.left + "px"; tip.current.style.top = p.top + "px";
  }, [at]);
  if (!pts.length) return <p className="muted session-map-empty">No session in this view has a measured start, a known window and a peak.</p>;

  const ts = textScale(), M = scaleMargins(M0, ts); // labels and the room around them follow the browser's text size
  const iw = W - M.l - M.r, ih = H - M.t - M.b;
  const x = (v: number) => M.l + logFraction(v, dom) * iw, y = (r: number) => M.t + ih - Math.min(1, r) * ih;
  const xTicks = startTicks(dom), yTicks = [0, .2, .4, .6, .8, 1];
  const cur = at == null ? null : pts[at]!;
  const label = `Session map: ${plural(pts.length, "session")} shown, ${num(counts.full + counts.both)} at or over 80% of their window, ${num(counts.both)} of those started at or over 30k tokens. `
    + "Use the left and right arrow keys to step through sessions from oldest to newest, Enter to open one, Escape to dismiss it or clear the selected quadrant.";
  const count = map.total <= pts.length ? plural(pts.length, "session") : `Showing the newest ${num(pts.length)} of ${num(map.total)} sessions`;
  const inQuad = quad ? pts.filter(p => quadOf(p) === quad).reverse() : []; // newest first

  /** Where a pointer is in the plot's coordinates. */
  const at2 = (ev: { clientX: number; clientY: number; currentTarget: Element }) => {
    const r = ev.currentTarget.getBoundingClientRect(), kx = r.width ? iw / r.width : 1, ky = r.height ? ih / r.height : 1;
    return { px: M.l + (ev.clientX - r.left) * kx, py: M.t + (ev.clientY - r.top) * ky, k: Math.max(kx, ky) };
  };
  /** The dot nearest a pointer within PICK_PX, or null. */
  const nearest = (ev: { clientX: number; clientY: number; currentTarget: Element }): number | null => {
    const { px, py, k } = at2(ev);
    let best: number | null = null, d2 = (PICK_PX * k) ** 2;
    pts.forEach((p, i) => { const d = (x(p.start) - px) ** 2 + (y(drawnShare(p)) - py) ** 2; if (d <= d2) { d2 = d; best = i; } });
    return best;
  };
  const onMove = (ev: PointerEvent<SVGRectElement>) => { pos.current = { x: ev.clientX, y: ev.clientY }; setAt(nearest(ev)); if (tip.current && box.current && at != null) { const p = tipAt(box.current, tip.current, ev.clientX, ev.clientY); tip.current.style.left = p.left + "px"; tip.current.style.top = p.top + "px"; } };
  // A dot opens its session; the plot away from any dot selects the quadrant under the pointer, or clears it when it is selected.
  const onClick = (ev: MouseEvent<SVGRectElement>) => {
    const i = nearest(ev);
    if (i != null) return openSessionSheet(pts[i]!.session_id);
    const { px, py } = at2(ev);
    const q = quadAt(px >= x(START_LARGE_TOKENS) ? START_LARGE_TOKENS : 0, py <= y(NEAR_LIMIT) ? NEAR_LIMIT : 0);
    onQuad(q === quad ? null : q);
  };
  const step = (i: number) => {
    setAt(i);
    const b = box.current?.getBoundingClientRect(), p = pts[i]!;
    if (b) pos.current = { x: b.left + (x(p.start) / W) * b.width, y: b.top + (y(drawnShare(p)) / W) * b.width };
  };
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") { if (at != null) setAt(null); else if (quad) onQuad(null); return; }
    if (ev.key === "Enter") { if (cur) { ev.preventDefault(); openSessionSheet(cur.session_id); } return; }
    const d = ({ ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity } as Record<string, number>)[ev.key];
    if (d == null) return;
    ev.preventDefault();
    step(Math.max(0, Math.min(pts.length - 1, (at ?? (d > 0 ? -1 : pts.length)) + d)));
  };
  // Each quadrant's name in its outer corner.
  const corner = (q: typeof QUADS[number]) => ({ x: q.heavy ? W - M.r - 6 : M.l + 6, y: q.full ? M.t + 13 * ts : M.t + ih - 7 * ts, anchor: q.heavy ? "end" as const : "start" as const });
  const halo = { stroke: "var(--surface-1)", strokeWidth: 3, paintOrder: "stroke" } as const;

  return (
    <div className="session-map">
      <p className="smcount">{count}. <span className="muted">Sessions without a measured start, a known window or a peak are left out.</span></p>
      <div className="legend">
        <span className="key"><svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r={R} fill="var(--text-secondary)" fillOpacity=".75" /></svg>A session, in its project's colour</span>
        <span className="key"><svg width="18" height="18" aria-hidden="true"><circle cx="9" cy="9" r={R} fill="var(--text-secondary)" fillOpacity=".75" /><circle cx="9" cy="9" r={RING} fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" /></svg>Ring: compacted at least once</span>
      </div>
      <div className="chart" ref={box} tabIndex={0} role="group" aria-label={label} onKeyDown={onKey} onBlur={() => setAt(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {quad && <rect className="quad-on" x={QUAD[quad].heavy ? x(START_LARGE_TOKENS) : M.l} y={QUAD[quad].full ? M.t : y(NEAR_LIMIT)}
            width={QUAD[quad].heavy ? W - M.r - x(START_LARGE_TOKENS) : x(START_LARGE_TOKENS) - M.l} height={QUAD[quad].full ? y(NEAR_LIMIT) - M.t : M.t + ih - y(NEAR_LIMIT)} />}
          {yTicks.map(v => <g key={v}><line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
            <text x={M.l - 6 * ts} y={y(v) + 4 * ts} textAnchor="end" fontSize={11 * ts} fill="var(--text-muted)">{Math.round(v * 100)}%</text></g>)}
          {xTicks.map(t => <g key={t}><line x1={x(t)} x2={x(t)} y1={M.t} y2={M.t + ih} stroke="var(--grid)" />
            <text x={x(t)} y={M.t + ih + 16 * ts} textAnchor="middle" fontSize={11 * ts} fill="var(--text-muted)">{short(t)}</text></g>)}
          <text x={M.l + iw / 2} y={H - 6 * ts} textAnchor="middle" fontSize={11.5 * ts} fill="var(--text-secondary)">Starting context (tokens, log scale)</text>
          <text transform={`translate(${12 * ts} ${M.t + ih / 2}) rotate(-90)`} textAnchor="middle" fontSize={11.5 * ts} fill="var(--text-secondary)">{/* The full title is about 6.5 text-sized units per character along the axis; a shorter one when the plot is too short for it. */}
            {ih >= 24 * 6.5 * ts ? "Peak share of the window" : "Peak share"}</text>
          <line className="ref-x" x1={x(START_LARGE_TOKENS)} x2={x(START_LARGE_TOKENS)} y1={M.t} y2={M.t + ih} stroke="var(--text-muted)" strokeDasharray="5 4" />
          <text x={x(START_LARGE_TOKENS) + 4} y={y(.5)} fontSize={11 * ts} fill="var(--text-secondary)" {...halo}>30k start</text>
          <line className="ref-y" x1={M.l} x2={W - M.r} y1={y(NEAR_LIMIT)} y2={y(NEAR_LIMIT)} stroke="var(--text-muted)" strokeDasharray="5 4" />
          <text x={x(START_LARGE_TOKENS) - 4} y={y(NEAR_LIMIT) + 13 * ts} textAnchor="end" fontSize={11 * ts} fill="var(--text-secondary)" {...halo}>80% of window</text>
          {pts.map((p, i) => <g key={p.session_id} className={"pt" + (i === at ? " on" : "") + (quad && quadOf(p) !== quad ? " out" : "")} data-id={p.session_id}>
            {p.compactions > 0 && <circle className="ring" cx={x(p.start)} cy={y(drawnShare(p))} r={RING} fill="none" stroke={color(p.project)} strokeWidth="1.5" />}
            <circle className="dot" cx={x(p.start)} cy={y(drawnShare(p))} r={R} fill={color(p.project)} fillOpacity=".75" stroke="var(--surface-1)" strokeWidth="1" />
          </g>)}
          {QUADS.map(q => { const c = corner(q); return <text key={q.id} className={"quad-label" + (q.id === quad ? " on" : "")} data-quad={q.id} x={c.x} y={c.y}
            textAnchor={c.anchor} fontSize={11 * ts} fontWeight="600" {...halo}>{q.label}</text>; })}
          {cur && <circle className="cursor" cx={x(cur.start)} cy={y(drawnShare(cur))} r={cur.compactions > 0 ? RING + 3 : R + 4} fill="none" stroke="var(--text-primary)" strokeWidth="1.5" />}
          <rect className="hit" x={M.l} y={M.t} width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setAt(null)} onClick={onClick} />
        </svg>
        <div className="tip" ref={tip} role="tooltip" style={{ display: cur ? "block" : "none" }}>{cur && <>
          <div className="tname"><b>{sessName(cur)}</b></div>
          <div className="muted">{cur.project ?? "(no project)"} · {SOURCE_LABELS[cur.source]} · {when(cur.first_ts)}</div>
          <div className="row"><span>Starting context</span><b>{short(cur.start)}</b></div>
          <div className="row"><span>Peak</span><b>{short(cur.peak)} ({share(cur.peak / cur.window)})</b></div>
          <div className="row"><span>Window</span><b>{windowLabel(cur.window)}</b></div>
          <div className="row"><span>Turns</span><b>{num(cur.turns)}</b></div>
          <div className="row"><span>Compactions</span><b>{num(cur.compactions)}</b></div>
        </>}</div>
      </div>
      <div className="readout" aria-live="polite">{cur ? readPoint(cur) : ""}</div>
      <div className="quads" role="group" aria-label="Quadrants: select one to narrow the window pressure bars to its sessions"
        onKeyDown={ev => { if (ev.key === "Escape" && quad) { ev.stopPropagation(); onQuad(null); } }}>
        {QUADS.map(q => <button key={q.id} type="button" aria-pressed={quad === q.id} data-quad={q.id} onClick={() => onQuad(quad === q.id ? null : q.id)}>
          <b>{q.label}</b> <span className="n">{num(counts[q.id])}</span><span className="sr">{plural(counts[q.id], "session")}, </span><span className="what">{q.what}</span></button>)}
        {quad && <button type="button" className="linkish clear" onClick={() => onQuad(null)}>Clear</button>}
      </div>
      {quad && <div className="qlist" role="region" aria-label={`Sessions in ${QUAD[quad].label}`}>
        <p className="muted small">{inQuad.length > QUAD_LIST_MAX ? `The ${num(QUAD_LIST_MAX)} newest of ${plural(inQuad.length, "session")}` : plural(inQuad.length, "session")} on the map
          with {QUAD[quad].what}, newest first. The window pressure bars above count these alone.</p>
        {inQuad.length > 0 && <ul>{inQuad.slice(0, QUAD_LIST_MAX).map(p => <li key={p.session_id}>
          <button type="button" className="cellbtn qsess" data-session={p.session_id} title={p.title || p.session_id} onClick={() => openSessionSheet(p.session_id)}>
            <span className="qname">{sessName(p)}</span>
            <span className="muted">{p.project ?? "no project"} · {SOURCE_LABELS[p.source]} · {when(p.first_ts)} · starts {short(p.start)} · peak {share(p.peak / p.window)}</span>
          </button></li>)}</ul>}
      </div>}
      {/* The chart's text alternative: one row per session shown. */}
      <ChartTable><DataTable name="Sessions on the map" region="scroll tall">
        <thead><tr><th scope="col">Session</th><th scope="col">Project</th><th scope="col">Agent</th><th scope="col">Started</th><th scope="col" className="num">Starting context</th>
          <th scope="col" className="num">Peak share</th><th scope="col" className="num">Window</th><th scope="col" className="num">Turns</th><th scope="col" className="num">Compactions</th>
          <th scope="col">Quadrant</th></tr></thead>
        <tbody>{pts.map(p => <tr key={p.session_id} {...pickRow(p.session_id, v => openSessionSheet(v), { kind: "session", value: p.session_id })}>
          <SessionTh p={p} /><td><Proj project={p.project} /></td><td><SourceName source={p.source} /></td>
          <td>{when(p.first_ts)}</td><td className="num">{short(p.start)}</td><td className="num">{share(p.peak / p.window)}</td><td className="num">{windowLabel(p.window)}</td>
          <td className="num">{num(p.turns)}</td><td className="num">{num(p.compactions)}</td><td>{QUAD[quadOf(p)].label}</td></tr>)}</tbody>
      </DataTable></ChartTable>
    </div>
  );
}
