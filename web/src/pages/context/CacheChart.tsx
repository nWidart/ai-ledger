import { useCallback, useMemo, useState } from "react";
import type { CacheBucket, ContextPayload } from "../../api";
import { textScale } from "../../components/chart";
import { ChartTable } from "../../components/DataTable";
import { EChart, type Shown } from "../../components/echart/EChart";
import type { ChartEnv } from "../../components/echart/tokens";
import { useZoomReset } from "../../components/echart/zoomReset";
import { Table, type Column } from "../../components/table/Table";
import { dayLabel, num, pct, plural } from "../../format";
import { cacheLayout, cacheModel, cacheOption, cacheZoomWords, hitRatio, type Slot, waste } from "./cacheTracks";
import { BREAK_CAUSES, causesText, short } from "./context";
import "./CacheChart.css";

type Series = ContextPayload["cost"]["series"];

const breaks = (r: CacheBucket) => r.model_switch + r.expired + r.other;
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

/** Per day or week, the prompt tokens not read from the cache (uncached input, cache writes) as stacked bars, the cache breaks by
 *  cause on a strip under them, and the cache-hit ratio on its own thin track, all over the same slots. Cache reads join the bars
 *  only when the user turns them on. The figures and the drawing are cacheTracks.ts's; this component holds the legend, the
 *  toggle, the label, the words of the reading, the tooltip, the caption and the data table, and draws through <EChart>, which
 *  owns the keys, the pointer, the tooltip's place, the live region and the zoom. */
export function CacheChart({ series, view }: { series: Series; view: string }) {
  const [reads, setReads] = useState(false);
  const weekly = series.bucket === "week", rows = series.rows;
  const columns = useMemo(() => tableColumns(weekly), [weekly]);
  const m = useMemo(() => cacheModel(series, reads), [series, reads]);
  // The text scale the box's height is worked out from, read here, and the option is laid out at the same one: the wrapper
  // reads the scale again on each of its own renders, which would lay the drawing out for a box it is not in.
  const scale = textScale();
  const option = useCallback((env: ChartEnv) => cacheOption(m, { ...env, textScale: scale }), [m, scale]);
  // A point is its slot's first day; a day and a week share keys, so the bucket is part of the view. The toggle is not: it
  // redraws the same points, and the reading and the zoom stay.
  const pointKeys = useMemo(() => m.slots.map(s => s.day), [m.slots]);
  const { ref, onZoom, button: showAll } = useZoomReset();
  if (!rows.length) return <p className="empty">No request in this view.</p>;

  const { slots, zoom } = m, n = slots.length, unit = weekly ? "week" : "day";
  const when = (s: Slot, long = false) => (weekly ? "Week of " : "") + dayLabel(s.day, long);
  const all = rows.reduce((t, r) => ({ input: t.input + r.input, cache_read: t.cache_read + r.cache_read, cache_write: t.cache_write + r.cache_write, b: t.b + breaks(r) }),
    { input: 0, cache_read: 0, cache_write: 0, b: 0 });
  const overall = hitRatio(all);
  const label = `Cache waste ${when(slots[0]!, true)} to ${dayLabel(slots[n - 1]!.day, true)}: ${short(waste(all))} tokens not read from the cache `
    + `(${short(all.input)} uncached input, ${short(all.cache_write)} cache write), ${overall == null ? "no prompt tokens" : `${pct(overall)} of prompt tokens read from the cache`}, `
    + `${plural(all.b, "cache break")}. Use the left and right arrow keys to read each ${unit}, Escape to dismiss it.${zoom ? " Plus and minus zoom." : ""}`;

  // A slot with no row is read too (decision 4): the keys and the pointer stop on it, and it says it has no request.
  const read = (i: number) => {
    const s = slots[i]!, r = s.row;
    if (!r) return `${when(s, true)}: no request.`;
    return `${when(s, true)}: ${short(r.input)} uncached input, ${short(r.cache_write)} cache write, ${short(r.cache_read)} cache read, `
      + `cache-hit ratio ${pct(hitRatio(r))}, breaks: ${causesText(r)}`;
  };
  const tip = (i: number) => {
    const s = slots[i]!, r = s.row;
    return <>
      <div className="head">{when(s, true)}</div>
      {r ? <>
        <div className="row"><span>Uncached input</span><b>{short(r.input)}</b></div>
        <div className="row"><span>Cache write</span><b>{short(r.cache_write)}</b></div>
        <div className="row sum"><span>Not from cache</span><b>{short(waste(r))}</b></div>
        <div className="row"><span>Cache read</span><b>{short(r.cache_read)}</b></div>
        <div className="row"><span>Cache-hit ratio</span><b>{pct(hitRatio(r))}</b></div>
        <div className="row"><span>Breaks</span><b>{causesText(r)}</b></div></> : <div>No request</div>}
    </>;
  };
  const readZoom = (s: Shown | null) => cacheZoomWords(m, s);

  return (
    <div className="cache-chart">
      <div className="legend">
        <span className="key"><i className="seg-input" />Uncached input</span>
        <span className="key"><i className="seg-write" />Cache write</span>
        {BREAK_CAUSES.map(([k]) => <span key={k} className="key"><i className={`seg-${k}`} />{causeLabel(k)} (breaks)</span>)}
        <span className="key"><i className="line" />Cache-hit ratio</span>
        <button type="button" className="key toggle" aria-pressed={reads} onClick={() => setReads(!reads)}><i className="seg-read" />Cache reads</button>
        {showAll(weekly ? "Show all weeks" : "Show all days")}
      </div>
      <EChart ref={ref} label={label} height={cacheLayout(m, scale).height} option={option} view={[view, series.bucket].join("|")}
        points={n} pointKeys={pointKeys} tip={tip} read={read} zoom={zoom} onZoom={onZoom} readZoom={readZoom} />
      <div className="caption muted small">A break's cause is inferred from the gap and the model of the previous request, not reported by the provider.
        {reads ? "" : " Cache reads are left out of the bars until you turn them on."}{weekly ? " Each bar is a week, labelled by its first day." : ""}</div>
      <ChartTable><Table name="Cache use by bucket" region="scroll tall" rows={rows} columns={columns} rowId={r => r.day} /></ChartTable>
    </div>
  );
}
