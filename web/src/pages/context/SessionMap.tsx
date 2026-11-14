// The session map: one dot per session, placed by its starting context (log scale) and its peak share of the window.
import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import type { ContextPayload, SessionPoint } from "../../api";
import { useColors } from "../../colors";
import { tipAt, useWidth } from "../../components/chart";
import { ChartTable, DataTable } from "../../components/DataTable";
import { openSessionSheet, pickRow, shortId } from "../../components/sheets/session";
import { num, plural, when } from "../../format";
import { Proj, SourceName } from "./cells";
import { NEAR_LIMIT, START_LARGE_TOKENS, share, short, windowLabel } from "./context";
import { SOURCE_LABELS } from "../../components/Filters";
import "./SessionMap.css";

type SessionsMap = ContextPayload["sessions_map"];
const H = 320, M = { t: 14, r: 16, b: 46, l: 52 };
/** A pointer picks the nearest dot within this many pixels. */
const PICK_PX = 12;
const R = 4, RING = 7.5;
const STEPS = [1, 2, 5, 10];

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
  `${p.project ?? "(no project)"}, ${SOURCE_LABELS[p.source]}, started ${when(p.first_ts)}: starting context ${short(p.start)} tokens, peak ${short(p.peak)} tokens, `
  + `${share(p.peak / p.window)} of a ${windowLabel(p.window)} window, ${plural(p.turns, "turn")}, ${plural(p.compactions, "compaction")}`;

const byDate = (a: SessionPoint, b: SessionPoint) => (a.first_ts ?? "").localeCompare(b.first_ts ?? "") || a.session_id.localeCompare(b.session_id);

/** Every session of the view with a measured start, a known window and a peak, as a dot. */
export function SessionMap({ map }: { map: SessionsMap }) {
  const color = useColors(), box = useRef<HTMLDivElement>(null), tip = useRef<HTMLDivElement>(null), W = useWidth(box);
  const [at, setAt] = useState<number | null>(null), pos = useRef({ x: 0, y: 0 });
  const pts = useMemo(() => map.points.slice().sort(byDate), [map.points]);
  const dom = useMemo(() => startDomain(pts.map(p => p.start)), [pts]);
  useLayoutEffect(() => {
    if (at == null || !tip.current || !box.current) return;
    const p = tipAt(box.current, tip.current, pos.current.x, pos.current.y);
    tip.current.style.left = p.left + "px"; tip.current.style.top = p.top + "px";
  }, [at]);
  if (!pts.length) return <p className="muted session-map-empty">No session in this view has a measured start, a known window and a peak.</p>;

  const iw = W - M.l - M.r, ih = H - M.t - M.b;
  const x = (v: number) => M.l + logFraction(v, dom) * iw, y = (r: number) => M.t + ih - Math.min(1, r) * ih;
  const xTicks = startTicks(dom), yTicks = [0, .2, .4, .6, .8, 1];
  const cur = at == null ? null : pts[at]!;
  const over = pts.filter(p => p.peak / p.window >= NEAR_LIMIT), overLarge = over.filter(p => p.start >= START_LARGE_TOKENS);
  const label = `Session map: ${plural(pts.length, "session")} shown, ${num(over.length)} at or over 80% of their window, ${num(overLarge.length)} of those started at or over 30k tokens. `
    + "Use the left and right arrow keys to step through sessions from oldest to newest, Enter to open one, Escape to dismiss it.";
  const count = map.total <= pts.length ? plural(pts.length, "session") : `Showing the newest ${num(pts.length)} of ${num(map.total)} sessions`;

  /** The dot nearest a pointer within PICK_PX, or null. */
  const nearest = (ev: { clientX: number; clientY: number; currentTarget: Element }): number | null => {
    const r = ev.currentTarget.getBoundingClientRect(), kx = r.width ? iw / r.width : 1, ky = r.height ? ih / r.height : 1;
    const px = M.l + (ev.clientX - r.left) * kx, py = M.t + (ev.clientY - r.top) * ky;
    let best: number | null = null, d2 = (PICK_PX * Math.max(kx, ky)) ** 2;
    pts.forEach((p, i) => { const d = (x(p.start) - px) ** 2 + (y(drawnShare(p)) - py) ** 2; if (d <= d2) { d2 = d; best = i; } });
    return best;
  };
  const onMove = (ev: PointerEvent<SVGRectElement>) => { pos.current = { x: ev.clientX, y: ev.clientY }; setAt(nearest(ev)); if (tip.current && box.current && at != null) { const p = tipAt(box.current, tip.current, ev.clientX, ev.clientY); tip.current.style.left = p.left + "px"; tip.current.style.top = p.top + "px"; } };
  const onClick = (ev: MouseEvent<SVGRectElement>) => { const i = nearest(ev); if (i != null) openSessionSheet(pts[i]!.session_id); };
  const step = (i: number) => {
    setAt(i);
    const b = box.current?.getBoundingClientRect(), p = pts[i]!;
    if (b) pos.current = { x: b.left + (x(p.start) / W) * b.width, y: b.top + y(drawnShare(p)) };
  };
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") return setAt(null);
    if (ev.key === "Enter") { if (cur) { ev.preventDefault(); openSessionSheet(cur.session_id); } return; }
    const d = ({ ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity } as Record<string, number>)[ev.key];
    if (d == null) return;
    ev.preventDefault();
    step(Math.max(0, Math.min(pts.length - 1, (at ?? (d > 0 ? -1 : pts.length)) + d)));
  };

  return (
    <div className="session-map">
      <p className="smcount">{count}. <span className="muted">Sessions without a measured start, a known window or a peak are left out.</span></p>
      <div className="legend">
        <span className="key"><svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r={R} fill="var(--text-secondary)" fillOpacity=".75" /></svg>A session, in its project's colour</span>
        <span className="key"><svg width="18" height="18" aria-hidden="true"><circle cx="9" cy="9" r={R} fill="var(--text-secondary)" fillOpacity=".75" /><circle cx="9" cy="9" r={RING} fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" /></svg>Ring: compacted at least once</span>
      </div>
      <div className="chart" ref={box} tabIndex={0} role="group" aria-label={label} onKeyDown={onKey} onBlur={() => setAt(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {yTicks.map(v => <g key={v}><line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
            <text x={M.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">{Math.round(v * 100)}%</text></g>)}
          {xTicks.map(t => <g key={t}><line x1={x(t)} x2={x(t)} y1={M.t} y2={M.t + ih} stroke="var(--grid)" />
            <text x={x(t)} y={M.t + ih + 16} textAnchor="middle" fontSize="11" fill="var(--text-muted)">{short(t)}</text></g>)}
          <text x={M.l + iw / 2} y={H - 6} textAnchor="middle" fontSize="11.5" fill="var(--text-secondary)">Starting context (tokens, log scale)</text>
          <text transform={`translate(12 ${M.t + ih / 2}) rotate(-90)`} textAnchor="middle" fontSize="11.5" fill="var(--text-secondary)">Peak share of the window</text>
          <line className="ref-x" x1={x(START_LARGE_TOKENS)} x2={x(START_LARGE_TOKENS)} y1={M.t} y2={M.t + ih} stroke="var(--text-muted)" strokeDasharray="5 4" />
          <text x={x(START_LARGE_TOKENS) + 4} y={M.t + ih - 6} fontSize="11" fill="var(--text-secondary)" stroke="var(--surface-1)" strokeWidth="3" paintOrder="stroke">30k start</text>
          <line className="ref-y" x1={M.l} x2={W - M.r} y1={y(NEAR_LIMIT)} y2={y(NEAR_LIMIT)} stroke="var(--text-muted)" strokeDasharray="5 4" />
          <text x={W - M.r - 4} y={y(NEAR_LIMIT) + 13} textAnchor="end" fontSize="11" fill="var(--text-secondary)" stroke="var(--surface-1)" strokeWidth="3" paintOrder="stroke">80% of window</text>
          {pts.map((p, i) => <g key={p.session_id} className={"pt" + (i === at ? " on" : "")} data-id={p.session_id}>
            {p.compactions > 0 && <circle className="ring" cx={x(p.start)} cy={y(drawnShare(p))} r={RING} fill="none" stroke={color(p.project)} strokeWidth="1.5" />}
            <circle className="dot" cx={x(p.start)} cy={y(drawnShare(p))} r={R} fill={color(p.project)} fillOpacity=".75" stroke="var(--surface-1)" strokeWidth="1" />
          </g>)}
          {cur && <circle className="cursor" cx={x(cur.start)} cy={y(drawnShare(cur))} r={cur.compactions > 0 ? RING + 3 : R + 4} fill="none" stroke="var(--text-primary)" strokeWidth="1.5" />}
          <rect className="hit" x={M.l} y={M.t} width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setAt(null)} onClick={onClick} />
        </svg>
        <div className="tip" ref={tip} role="tooltip" style={{ display: cur ? "block" : "none" }}>{cur && <>
          <div><b>{cur.project ?? "(no project)"}</b> <span className="muted">· {SOURCE_LABELS[cur.source]}</span></div>
          <div className="muted">{when(cur.first_ts)}</div>
          <div className="row"><span>Starting context</span><b>{short(cur.start)}</b></div>
          <div className="row"><span>Peak</span><b>{short(cur.peak)} ({share(cur.peak / cur.window)})</b></div>
          <div className="row"><span>Window</span><b>{windowLabel(cur.window)}</b></div>
          <div className="row"><span>Turns</span><b>{num(cur.turns)}</b></div>
          <div className="row"><span>Compactions</span><b>{num(cur.compactions)}</b></div>
        </>}</div>
      </div>
      <div className="readout" aria-live="polite">{cur ? readPoint(cur) : ""}</div>
      {/* The chart's text alternative: one row per session shown. */}
      <ChartTable><DataTable name="Sessions on the map" region="scroll tall">
        <thead><tr><th scope="col">Session</th><th scope="col">Project</th><th scope="col">Agent</th><th scope="col">Started</th><th scope="col" className="num">Starting context</th>
          <th scope="col" className="num">Peak share</th><th scope="col" className="num">Window</th><th scope="col" className="num">Turns</th><th scope="col" className="num">Compactions</th></tr></thead>
        <tbody>{pts.map(p => <tr key={p.session_id} {...pickRow(p.session_id, v => openSessionSheet(v))}>
          <td><button type="button" className="cellbtn">{shortId(p.session_id)}</button></td><td><Proj project={p.project} /></td><td><SourceName source={p.source} /></td>
          <td>{when(p.first_ts)}</td><td className="num">{short(p.start)}</td><td className="num">{share(p.peak / p.window)}</td><td className="num">{windowLabel(p.window)}</td>
          <td className="num">{num(p.turns)}</td><td className="num">{num(p.compactions)}</td></tr>)}</tbody>
      </DataTable></ChartTable>
    </div>
  );
}
