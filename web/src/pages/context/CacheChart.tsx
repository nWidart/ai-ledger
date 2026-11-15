import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { CacheBucket, ContextPayload } from "../../api";
import { dayAxis, scaleMargins, textScale, tipAt, useWidth } from "../../components/chart";
import { ChartTable, DataTable } from "../../components/DataTable";
import { dayLabel, dayRange, niceStep, num, pct, plural } from "../../format";
import { BREAK_CAUSES, causesText, short } from "./context";
import "./CacheChart.css";

type Series = ContextPayload["cost"]["series"];
/** One place on the calendar axis: the bucket's first day, and its row (null when nothing happened that day or week). */
export interface Slot { day: string; row: CacheBucket | null }

const TOP = 200, STRIP = 48, GAP = 52;
const M0 = { t: 12, r: 44, b: 0, l: 52 }; // the margins at the default text size

/** A bucket's prompt tokens: uncached input, cache read and cache write. */
const prompt = (r: CacheBucket) => r.input + r.cache_read + r.cache_write;
/** cache_read over the prompt tokens, null when the bucket has none. */
export const hitRatio = (r: { input: number; cache_read: number; cache_write: number }): number | null => {
  const t = r.input + r.cache_read + r.cache_write;
  return t ? r.cache_read / t : null;
};
const breaks = (r: CacheBucket) => r.model_switch + r.expired + r.other;

/** Every bucket's place by date from the first to the last row: a day (or week) with no row is an empty slot. */
export function cacheSlots(series: Series): Slot[] {
  const rows = series.rows;
  if (!rows.length) return [];
  const by = new Map(rows.map(r => [r.day, r])), first = rows[0]!.day, last = rows[rows.length - 1]!.day;
  const days = series.bucket === "week"
    ? Array.from({ length: Math.floor((+new Date(last + "T00:00:00Z") - +new Date(first + "T00:00:00Z")) / (7 * 864e5)) + 1 },
      (_, i) => new Date(+new Date(first + "T00:00:00Z") + i * 7 * 864e5).toISOString().slice(0, 10))
    : dayRange(first, last);
  return days.map(day => ({ day, row: by.get(day) ?? null }));
}

const CAUSE_NAME = Object.fromEntries(BREAK_CAUSES.map(([k, n]) => [k, n])) as Record<string, string>;
const causeLabel = (k: string) => { const n = CAUSE_NAME[k]!; return n[0]!.toUpperCase() + n.slice(1); };

/** Prompt tokens per day or week as stacked bars (cache read, cache write, uncached input) with the cache-hit ratio over them,
 *  and the cache breaks by cause in a strip under the same days. */
export function CacheChart({ series }: { series: Series }) {
  const box = useRef<HTMLDivElement>(null), tip = useRef<HTMLDivElement>(null), W = useWidth(box);
  const [at, setAt] = useState<number | null>(null), pos = useRef({ x: 0, y: 0 });
  useLayoutEffect(() => {
    if (at == null || !tip.current || !box.current) return;
    const p = tipAt(box.current, tip.current, pos.current.x, pos.current.y);
    tip.current.style.left = p.left + "px"; tip.current.style.top = p.top + "px";
  }, [at]);
  const slots = cacheSlots(series), weekly = series.bucket === "week", rows = series.rows;
  if (!rows.length) return <p className="empty">No request in this view.</p>;

  const n = slots.length, maxT = Math.max(...rows.map(prompt), 1), maxB = Math.max(...rows.map(breaks), 1);
  // The labels and the room that holds them grow with the browser's text size; the plots keep their height.
  const ts = textScale(), M = scaleMargins(M0, ts), GAPs = GAP * ts;
  const H = TOP + M.t + GAPs + STRIP + 28 * ts;
  const a = dayAxis(W, TOP + M.t, n, maxT, niceStep, M0, ts);
  const yTicks: number[] = [];
  for (let v = 0; v <= a.yMax + 1e-9; v += a.step) yTicks.push(v);
  const ry = (r: number) => M.t + a.ih - r * a.ih;
  const sy = TOP + M.t + GAPs / 2 + 6 * ts, sy1 = sy + STRIP, sh = (v: number) => v / maxB * STRIP;
  const when = (s: Slot, long = false) => (weekly ? "Week of " : "") + dayLabel(s.day, long);

  const line = slots.flatMap((s, i) => { const r = s.row && hitRatio(s.row); return r == null ? [] : [{ i, r }]; });
  // The line joins neighbouring buckets only: across an empty slot it breaks, so it never reads as a ratio for days with no request.
  const path = line.map((p, k) => `${k && line[k - 1]!.i === p.i - 1 ? "L" : "M"}${a.cx(p.i).toFixed(1)},${ry(p.r).toFixed(1)}`).join("");
  const hit = slots.flatMap(s => s.row ? [s.row] : []);
  const all = hit.reduce((t, r) => ({ input: t.input + r.input, cache_read: t.cache_read + r.cache_read, cache_write: t.cache_write + r.cache_write, b: t.b + breaks(r) }),
    { input: 0, cache_read: 0, cache_write: 0, b: 0 });
  const overall = hitRatio(all);
  const label = `Cache use ${when(slots[0]!, true)} to ${dayLabel(slots[n - 1]!.day, true)}: ${overall == null ? "no prompt tokens" : `${pct(overall)} of prompt tokens read from the cache`}, ${plural(all.b, "cache break")}. `
    + "Use the left and right arrow keys to read each " + (weekly ? "week" : "day") + ", Escape to dismiss it.";

  const cur = at == null ? null : slots[at]!, row = cur?.row ?? null;
  const read = (s: Slot) => {
    const r = s.row!, h = hitRatio(r);
    return `${when(s, true)}: ${short(r.cache_read)} cache read, ${short(r.cache_write)} cache write, ${short(r.input)} uncached input, cache-hit ratio ${pct(h)}, breaks: ${causesText(r)}`;
  };
  const show = (i: number, x: number, y: number) => { pos.current = { x, y }; setAt(i); };
  const nearest = (ev: PointerEvent) => {
    // The hit rect is the plot itself, so the pointer's offset in it scales to the plot's width, not the svg's.
    const r = ev.currentTarget.getBoundingClientRect(), px = (ev.clientX - r.left) * a.iw / (r.width || a.iw);
    const i = Math.max(0, Math.min(n - 1, Math.floor(px / a.bw)));
    return slots[i]!.row ? i : null;
  };
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") return setAt(null);
    const d = ({ ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity } as Record<string, number>)[ev.key];
    if (d == null) return;
    ev.preventDefault();
    const idx = slots.flatMap((s, i) => (s.row ? [i] : []));
    const next = d === Infinity ? idx.at(-1) : d === -Infinity ? idx[0]
      : at == null ? (d > 0 ? idx[0] : idx.at(-1)) : d > 0 ? idx.find(i => i > at) : idx.findLast(i => i < at);
    if (next == null) return;
    const r = box.current!.getBoundingClientRect();
    show(next, r.left + a.cx(next), r.top + M.t + TOP / 2);
  };

  const keys: [string, string][] = [["seg-read", "Cache read"], ["seg-write", "Cache write"], ["seg-input", "Uncached input"]];
  return (
    <div className="cache-chart">
      <div className="legend">
        {keys.map(([c, t]) => <span key={c} className="key"><i className={c} />{t}</span>)}
        <span className="key"><i className="line" />Cache-hit ratio</span>
        {BREAK_CAUSES.map(([k]) => <span key={k} className="key"><i className={`seg-${k}`} />{causeLabel(k)} (breaks)</span>)}
      </div>
      <div className="chart" ref={box} tabIndex={0} role="group" aria-label={label} onKeyDown={onKey} onBlur={() => setAt(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} height={H} aria-hidden="true">
          {yTicks.map(v => <g key={v}><line x1={M.l} x2={W - M.r} y1={a.y(v)} y2={a.y(v)} stroke="var(--grid)" />
            <text x={M.l - 6 * ts} y={a.y(v) + 4 * ts} textAnchor="end" fontSize={11 * ts} fill="var(--text-muted)">{short(v)}</text></g>)}
          {[0, .25, .5, .75, 1].map(r => <text key={r} x={W - M.r + 6 * ts} y={ry(r) + 4 * ts} fontSize={11 * ts} fill="var(--text-muted)">{pct(r)}</text>)}
          {slots.map((s, i) => {
            if (!s.row) return null;
            const r = s.row;
            let top = a.y(0);
            const seg = ([["seg-read", r.cache_read], ["seg-write", r.cache_write], ["seg-input", r.input]] as [string, number][]).map(([c, v]) => {
              const h = v / a.yMax * a.ih; top -= h;
              return h > 0 ? <rect key={c} className={c} data-seg={c} data-day={s.day} x={a.x(i)} y={top} width={a.w} height={h} /> : null;
            });
            return <g key={s.day} opacity={cur && cur !== s ? .55 : 1}>{seg}</g>;
          })}
          {line.length > 0 && <>
            <path d={path} fill="none" stroke="var(--surface-1)" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
            <path className="ratio" d={path} fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {line.map(p => <circle key={p.i} cx={a.cx(p.i)} cy={ry(p.r)} r="3" fill="var(--text-primary)" stroke="var(--surface-1)" strokeWidth="1.5" />)}</>}
          <text x={M.l} y={sy - 8 * ts} fontSize={11 * ts} fontWeight="600" fill="var(--text-secondary)">Cache breaks</text>
          <text x={W - M.r} y={sy - 8 * ts} textAnchor="end" fontSize={11 * ts} fill="var(--text-muted)">{all.b ? `most in a ${weekly ? "week" : "day"}: ${num(maxB)}` : "none in this view"}</text>
          <line x1={M.l} x2={W - M.r} y1={sy1} y2={sy1} stroke="var(--grid)" />
          {slots.map((s, i) => {
            if (!s.row) return null;
            let top = sy1;
            return <g key={s.day}>{BREAK_CAUSES.map(([k]) => {
              const h = sh(s.row![k]); top -= h;
              return h > 0 ? <rect key={k} className={`seg-${k}`} data-cause={k} data-day={s.day} x={a.x(i)} y={top} width={a.w} height={h} /> : null;
            })}</g>;
          })}
          {slots.map((s, i) => i % a.every === 0 && <text key={s.day} x={a.cx(i)} y={sy1 + 16 * ts} textAnchor="middle" fontSize={11 * ts} fill="var(--text-muted)">{dayLabel(s.day)}</text>)}
          {cur && row && <line x1={a.cx(at!)} x2={a.cx(at!)} y1={M.t} y2={sy1} stroke="var(--text-muted)" strokeDasharray="3 3" />}
          <rect x={M.l} y={0} width={a.iw} height={H} fill="transparent"
            onPointerMove={ev => { const i = nearest(ev); if (i == null) setAt(null); else show(i, ev.clientX, ev.clientY); }} onPointerLeave={() => setAt(null)} />
        </svg>
        <div className="tip" ref={tip} role="tooltip" style={{ display: row ? "block" : "none" }}>{row && cur && <>
          <div className="head">{when(cur, true)}</div>
          <div className="row"><span>Cache read</span><b>{short(row.cache_read)}</b></div>
          <div className="row"><span>Cache write</span><b>{short(row.cache_write)}</b></div>
          <div className="row"><span>Uncached input</span><b>{short(row.input)}</b></div>
          <div className="row"><span>Cache-hit ratio</span><b>{pct(hitRatio(row))}</b></div>
          <div className="row"><span>Breaks</span><b>{causesText(row)}</b></div></>}</div>
      </div>
      <div className="caption muted small">A break's cause is inferred from the gap and the model of the previous request, not reported by the provider.
        {weekly ? " Each bar is a week, labelled by its first day." : ""}</div>
      <div className="readout" aria-live="polite">{cur?.row ? read(cur) : ""}</div>
      <ChartTable><DataTable name="Cache use by bucket" region="scroll tall">
        <thead><tr><th scope="col">{weekly ? "Week of" : "Day"}</th><th scope="col" className="num">Cache read</th><th scope="col" className="num">Cache write</th><th scope="col" className="num">Uncached input</th>
          <th scope="col" className="num">Cache-hit ratio</th>{BREAK_CAUSES.map(([k]) => <th key={k} scope="col" className="num">{causeLabel(k)}</th>)}</tr></thead>
        <tbody>{hit.map(r => <tr key={r.day}><th scope="row">{dayLabel(r.day, true)}</th><td className="num">{short(r.cache_read)}</td><td className="num">{short(r.cache_write)}</td>
          <td className="num">{short(r.input)}</td><td className="num">{pct(hitRatio(r))}</td>{BREAK_CAUSES.map(([k]) => <td key={k} className="num">{num(r[k])}</td>)}</tr>)}</tbody>
      </DataTable></ChartTable>
    </div>
  );
}
