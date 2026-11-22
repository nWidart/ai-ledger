import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { CacheBucket, ContextPayload } from "../../api";
import { dayAxis, scaleMargins, stackHeights, textScale, tipAt, useWidth } from "../../components/chart";
import { ChartTable } from "../../components/DataTable";
import { Table, type Column } from "../../components/table/Table";
import { dayLabel, niceStep, num, pct, plural } from "../../format";
import { hitRatio, ratioFloor, type Slot, waste } from "./cacheTracks";
import { calendarSlots } from "./chartParts";
import { BREAK_CAUSES, causesText, short } from "./context";
import { modified } from "../../components/keys";
import "./CacheChart.css";

type Series = ContextPayload["cost"]["series"];

/** The tracks' plot heights at the default text size: the waste bars, the breaks strip and the hit-ratio line. */
const WASTE = 180, STRIP = 48, RATIO = 44;
const M0 = { t: 28, r: 8, b: 0, l: 52 }; // the margins at the default text size; the top holds the waste track's title
/** The room above the breaks strip and the ratio track for their titles, and under the ratio track for the day labels. */
const TITLE = 28, DATES = 24;
/** A nonzero segment is drawn at least this tall; each segment after the first in a stack is inset by SEP, so the surface shows between. */
const MIN_H = 2, SEP = 1;

/** A bucket's prompt tokens: uncached input, cache read and cache write. */
const prompt = (r: { input: number; cache_read: number; cache_write: number }) => r.input + r.cache_read + r.cache_write;
/** A rough width of a label in px: wide enough for the digits and lowercase of these titles at their font size. */
const textWidth = (s: string, fs: number, bold = false) => s.length * fs * (bold ? .62 : .56);
const breaks = (r: CacheBucket) => r.model_switch + r.expired + r.other;

/** Every bucket's place by date from the first to the last row: a day (or week) with no row is an empty slot. */
function cacheSlots(series: Series): Slot[] {
  const rows = series.rows;
  if (!rows.length) return [];
  const by = new Map(rows.map(r => [r.day, r]));
  return calendarSlots(rows[0]!.day, rows[rows.length - 1]!.day, series.bucket).map(day => ({ day, row: by.get(day) ?? null }));
}

const CAUSE_NAME = Object.fromEntries(BREAK_CAUSES.map(([k, n]) => [k, n])) as Record<string, string>;
const causeLabel = (k: string) => { const n = CAUSE_NAME[k]!; return n[0]!.toUpperCase() + n.slice(1); };

/** The chart's data table: one row per bucket. */
const tableColumns = (weekly: boolean): Column<CacheBucket>[] => [
  { id: "day", header: weekly ? "Week of" : "Day", cell: r => dayLabel(r.day, true) },
  { id: "input", header: "Uncached input", align: "num", cell: r => short(r.input) },
  { id: "cache_write", header: "Cache write", align: "num", cell: r => short(r.cache_write) },
  { id: "cache_read", header: "Cache read", align: "num", cell: r => short(r.cache_read) },
  { id: "ratio", header: "Cache-hit ratio", align: "num", cell: r => pct(hitRatio(r)) },
  ...BREAK_CAUSES.map(([k]): Column<CacheBucket> => ({ id: k, header: causeLabel(k), align: "num", cell: r => num(r[k]) })),
];

/** Rects stacked up from y0, bottom first, scaled by per: a nonzero part is at least MIN_H tall, and each after the first sits SEP above the last.
 *  The parts share the stack's own height (stackHeights): a thin part takes its minimum from its neighbours, so a full stack stays in its track. */
export function stack(parts: [string, number][], y0: number, per: number): { key: string; y: number; h: number }[] {
  const on = parts.filter(([, v]) => v > 0), vals = on.map(([, v]) => v);
  const slots = stackHeights(vals, vals.reduce((s, v) => s + v, 0) * per, on.map((_, k) => (k ? MIN_H + SEP : MIN_H)));
  let top = y0;
  return on.map(([key], k) => {
    top -= slots[k]!;
    return { key, y: top, h: slots[k]! - (k ? SEP : 0) };
  });
}

/** Per day or week, the prompt tokens not read from the cache (uncached input, cache writes) as stacked bars, the cache breaks by
 *  cause on a strip under them, and the cache-hit ratio on its own thin track, all over the same slots. Cache reads join the bars
 *  only when the user turns them on. */
export function CacheChart({ series }: { series: Series; view: string }) {
  const box = useRef<HTMLDivElement>(null), tip = useRef<HTMLDivElement>(null), W = useWidth(box);
  const [at, setAt] = useState<number | null>(null), pos = useRef({ x: 0, y: 0 });
  const [reads, setReads] = useState(false);
  useLayoutEffect(() => {
    if (at == null || !tip.current || !box.current) return;
    const p = tipAt(box.current, tip.current, pos.current.x, pos.current.y);
    tip.current.style.left = p.left + "px"; tip.current.style.top = p.top + "px";
  }, [at]);
  const slots = cacheSlots(series), weekly = series.bucket === "week", rows = series.rows;
  const columns = useMemo(() => tableColumns(weekly), [weekly]);
  if (!rows.length) return <p className="empty">No request in this view.</p>;

  const n = slots.length, unit = weekly ? "week" : "day";
  const maxY = Math.max(...rows.map(reads ? prompt : waste), 1), maxB = Math.max(...rows.map(breaks), 1);
  // The labels and the room that holds them grow with the browser's text size; the plots keep their height.
  const ts = textScale(), M = scaleMargins(M0, ts), T = TITLE * ts;
  const a = dayAxis(W, WASTE + M.t, n, maxY, niceStep, M0, ts);
  const yTicks: number[] = [];
  for (let v = 0; v <= a.yMax + 1e-9; v += a.step) yTicks.push(v);
  const base = a.y(0), per = a.ih / a.yMax;
  const sy0 = base + T, sy1 = sy0 + STRIP, sh = STRIP / maxB;
  const ry0 = sy1 + T, ry1 = ry0 + RATIO, H = ry1 + DATES * ts;
  const when = (s: Slot, long = false) => (weekly ? "Week of " : "") + dayLabel(s.day, long);

  const line = slots.flatMap((s, i) => { const r = s.row && hitRatio(s.row); return r == null ? [] : [{ i, r }]; });
  const lo = ratioFloor(line.map(p => p.r)), ry = (r: number) => ry1 - (Math.max(lo, r) - lo) / (1 - lo || 1) * RATIO;
  // The line joins neighbouring buckets only: across an empty slot it breaks, so it never reads as a ratio for days with no request.
  const path = line.map((p, k) => `${k && line[k - 1]!.i === p.i - 1 ? "L" : "M"}${a.cx(p.i).toFixed(1)},${ry(p.r).toFixed(1)}`).join("");
  const hit = slots.flatMap(s => s.row ? [s.row] : []);
  const all = hit.reduce((t, r) => ({ input: t.input + r.input, cache_read: t.cache_read + r.cache_read, cache_write: t.cache_write + r.cache_write, b: t.b + breaks(r) }),
    { input: 0, cache_read: 0, cache_write: 0, b: 0 });
  const overall = hitRatio(all);
  const label = `Cache waste ${when(slots[0]!, true)} to ${dayLabel(slots[n - 1]!.day, true)}: ${short(waste(all))} tokens not read from the cache `
    + `(${short(all.input)} uncached input, ${short(all.cache_write)} cache write), ${overall == null ? "no prompt tokens" : `${pct(overall)} of prompt tokens read from the cache`}, `
    + `${plural(all.b, "cache break")}. Use the left and right arrow keys to read each ${unit}, Escape to dismiss it.`;

  const cur = at == null ? null : slots[at]!, row = cur?.row ?? null;
  const read = (s: Slot) => {
    const r = s.row!;
    return `${when(s, true)}: ${short(r.input)} uncached input, ${short(r.cache_write)} cache write, ${short(r.cache_read)} cache read, `
      + `cache-hit ratio ${pct(hitRatio(r))}, breaks: ${causesText(r)}`;
  };
  const show = (i: number, x: number, y: number) => { pos.current = { x, y }; setAt(i); };
  const nearest = (ev: PointerEvent) => {
    // The hit rect is the plot itself, so the pointer's offset in it scales to the plot's width, not the svg's.
    const r = ev.currentTarget.getBoundingClientRect(), px = (ev.clientX - r.left) * a.iw / (r.width || a.iw);
    const i = Math.max(0, Math.min(n - 1, Math.floor(px / a.bw)));
    return slots[i]!.row ? i : null;
  };
  const onKey = (ev: KeyboardEvent) => {
    if (modified(ev)) return; // Alt+Left is history, Ctrl+Home the page: not ours
    if (ev.key === "Escape") return setAt(null);
    const d = ({ ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity } as Record<string, number>)[ev.key];
    if (d == null) return;
    ev.preventDefault();
    const idx = slots.flatMap((s, i) => (s.row ? [i] : []));
    const next = d === Infinity ? idx.at(-1) : d === -Infinity ? idx[0]
      : at == null ? (d > 0 ? idx[0] : idx.at(-1)) : d > 0 ? idx.find(i => i > at) : idx.findLast(i => i < at);
    if (next == null) return;
    const r = box.current!.getBoundingClientRect();
    show(next, r.left + a.cx(next), r.top + M.t + WASTE / 2);
  };

  // A track's title over the plot, and its figure at the right: the figure's shorter form (compact) when the plot is too narrow for
  // both, and the title starts at the left edge rather than the plot's when even that does not fit.
  const fs = 11 * ts, title = (y: number, left: string, right: string, compact = right) => {
    const fits = (x: number, r: string) => x + textWidth(left, fs, true) + 12 * ts + textWidth(r, fs) <= W - M.r;
    const r = fits(M.l, right) ? right : compact, x = fits(M.l, r) ? M.l : 0;
    return <>
      <text x={x} y={y} fontSize={fs} fontWeight="600" fill="var(--text-secondary)">{left}</text>
      <text x={W - M.r} y={y} textAnchor="end" fontSize={fs} fill="var(--text-muted)">{r}</text></>;
  };
  // The total of what the bars draw: the waste, or every prompt token with the cache reads on.
  const drawn = short(reads ? prompt(all) : waste(all));
  return (
    <div className="cache-chart">
      <div className="legend">
        <span className="key"><i className="seg-input" />Uncached input</span>
        <span className="key"><i className="seg-write" />Cache write</span>
        {BREAK_CAUSES.map(([k]) => <span key={k} className="key"><i className={`seg-${k}`} />{causeLabel(k)} (breaks)</span>)}
        <span className="key"><i className="line" />Cache-hit ratio</span>
        <button type="button" className="key toggle" aria-pressed={reads} onClick={() => setReads(!reads)}><i className="seg-read" />Cache reads</button>
      </div>
      <div className="chart" ref={box} tabIndex={0} role="group" aria-label={label} onKeyDown={onKey} onBlur={() => setAt(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} height={H} aria-hidden="true">
          {title(M.t - 10 * ts, reads ? "Prompt tokens" : "Tokens not read from the cache", `${drawn} in this view`, drawn)}
          {yTicks.map(v => <g key={v}><line x1={M.l} x2={W - M.r} y1={a.y(v)} y2={a.y(v)} stroke="var(--grid)" />
            <text x={M.l - 6 * ts} y={a.y(v) + 4 * ts} textAnchor="end" fontSize={fs} fill="var(--text-muted)">{short(v)}</text></g>)}
          {slots.map((s, i) => {
            if (!s.row) return null;
            const r = s.row, parts: [string, number][] = [["seg-input", r.input], ["seg-write", r.cache_write], ...(reads ? [["seg-read", r.cache_read] as [string, number]] : [])];
            return <g key={s.day} className={cur === s ? "on" : undefined}>{stack(parts, base, per).map(p =>
              <rect key={p.key} className={"seg " + p.key} data-seg={p.key} data-day={s.day} x={a.x(i)} y={p.y} width={a.w} height={p.h} />)}</g>;
          })}

          {title(sy0 - 8 * ts, "Cache breaks", all.b ? `most in a ${unit}: ${num(maxB)}` : "none in this view", all.b ? `most: ${num(maxB)}` : "none")}
          <line x1={M.l} x2={W - M.r} y1={sy1} y2={sy1} stroke="var(--grid)" />
          {slots.map((s, i) => s.row && <g key={s.day} className={cur === s ? "on" : undefined}>{stack(BREAK_CAUSES.map(([k]) => [`seg-${k}`, s.row![k]]), sy1, sh).map(p =>
            <rect key={p.key} className={"seg " + p.key} data-cause={p.key.slice(4)} data-day={s.day} x={a.x(i)} y={p.y} width={a.w} height={p.h} />)}</g>)}

          {title(ry0 - 8 * ts, "Cache-hit ratio", overall == null ? "" : `${pct(overall)} in this view`, overall == null ? "" : pct(overall))}
          {[lo, 1].map(v => <g key={v}><line x1={M.l} x2={W - M.r} y1={ry(v)} y2={ry(v)} stroke="var(--grid)" />
            <text x={M.l - 6 * ts} y={ry(v) + 4 * ts} textAnchor="end" fontSize={fs} fill="var(--text-muted)" data-ratio-tick={v}>{pct(v)}</text></g>)}
          {line.length > 0 && <>
            <path className="ratio-halo" d={path} fill="none" stroke="var(--surface-1)" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
            <path className="ratio" d={path} fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {line.map(p => <circle key={p.i} className="ratio-dot" cx={a.cx(p.i)} cy={ry(p.r)} r="3" fill="var(--text-primary)" stroke="var(--surface-1)" strokeWidth="1.5" />)}</>}

          {slots.map((s, i) => {
            // Each date stays inside the plot, so the first never runs into the ratio track's bottom label in the margin.
            if (i % a.every) return null;
            const t = dayLabel(s.day), half = textWidth(t, fs) / 2, x = Math.min(W - M.r - half, Math.max(M.l + half, a.cx(i)));
            return <text key={s.day} x={x} y={ry1 + 16 * ts} textAnchor="middle" fontSize={fs} fill="var(--text-muted)">{t}</text>;
          })}
          {cur && row && <line className="cursor" x1={a.cx(at!)} x2={a.cx(at!)} y1={M.t} y2={ry1} stroke="var(--text-primary)" strokeDasharray="3 3" />}
          <rect x={M.l} y={0} width={a.iw} height={H} fill="transparent"
            onPointerMove={ev => { const i = nearest(ev); if (i == null) setAt(null); else show(i, ev.clientX, ev.clientY); }} onPointerLeave={() => setAt(null)} />
        </svg>
        <div className="tip" ref={tip} role="tooltip" style={{ display: row ? "block" : "none" }}>{row && cur && <>
          <div className="head">{when(cur, true)}</div>
          <div className="row"><span>Uncached input</span><b>{short(row.input)}</b></div>
          <div className="row"><span>Cache write</span><b>{short(row.cache_write)}</b></div>
          <div className="row sum"><span>Not from cache</span><b>{short(waste(row))}</b></div>
          <div className="row"><span>Cache read</span><b>{short(row.cache_read)}</b></div>
          <div className="row"><span>Cache-hit ratio</span><b>{pct(hitRatio(row))}</b></div>
          <div className="row"><span>Breaks</span><b>{causesText(row)}</b></div></>}</div>
      </div>
      <div className="caption muted small">A break's cause is inferred from the gap and the model of the previous request, not reported by the provider.
        {reads ? "" : " Cache reads are left out of the bars until you turn them on."}{weekly ? " Each bar is a week, labelled by its first day." : ""}</div>
      <div className="readout" aria-live="polite">{cur?.row ? read(cur) : ""}</div>
      <ChartTable><Table name="Cache use by bucket" region="scroll tall" rows={hit} columns={columns} rowId={r => r.day} /></ChartTable>
    </div>
  );
}
