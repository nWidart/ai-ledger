import { memo, useCallback, useMemo, useState, type CSSProperties } from "react";
import { FEW_CALLS, LOW_CALLS, textScale } from "../../components/chart";
import { ChartTable } from "../../components/DataTable";
import { EChart, type Shown } from "../../components/echart/EChart";
import type { ChartEnv } from "../../components/echart/tokens";
import { useZoomReset } from "../../components/echart/zoomReset";
import { modified } from "../../components/keys";
import { Table, type Column } from "../../components/table/Table";
import { num as fmt } from "../../format";
import { useErrors } from "./context";
import { bucketLabel, type ChartPt, idle, incSummary, noCalls, pointRows, pointText, pointWhen, selectable, shortLabel, sumCalls, TOPN, typeColor } from "./model";
import { rateLayout, rateModel, rateOption, rateZoomWords } from "./rateTracks";

/** A row of the chart's data table: a bucket, its rate and whether it has few calls. */
interface TableRow { p: ChartPt; rate: number | null; low: boolean }

const CLEARED = "Selection cleared: the table and detail cover the whole range.";
/** What a click, Enter or Space on a folded stretch says. Two true sentences, alternating: the same text twice says nothing. */
const FOLDED = ["A stretch without tool calls cannot be selected.", "This stretch has no tool calls to select."] as const;

/** The error rate above the failed calls stacked by type, on one time axis (echart-errors). The figures and the drawing are
 *  rateTracks.ts's; this component holds the heading, the Day / Week switch, the legend, the selection panel, the words of
 *  the reading, the tooltip and the data table, and draws through <EChart>, which owns the keys, the pointer, the tooltip's
 *  place, the readout and the zoom. */
export const RateChart = memo(function RateChart() {
  const { m, v, f, vt, fixes, pick, after, update } = useErrors();
  // Everything the model reads: the view (the type and the bucket selection included), the filtered data, the view's types
  // and the applied fixes.
  const rm = useMemo(() => rateModel(m, v, f, vt, fixes), [m, v, f, vt, fixes]);
  // The text scale the box's height is worked out from, read here, and the option is laid out at the same one: the wrapper
  // reads the scale again on each of its own renders (a reading), which would lay the drawing out for a box it is not in.
  const scale = textScale();
  const option = useCallback((env: ChartEnv) => rateOption(rm, { ...env, textScale: scale }), [rm, scale]);
  const { pts, rates, low, zoom } = rm, cat = v.cat, per = v.gran === "week" ? "week" : "day";
  const { ref: box, onZoom, button: showAll } = useZoomReset();

  // What the last click, Enter or Space on the chart did, and the selection it left ("" for none). The status is that
  // sentence only while the selection drawn is the one it names, so it arrives in the render that draws it, whenever the
  // URL lands. A selection that changes from outside the chart (the chip, Back, a type opened over the bucket, a filter)
  // empties it, and the sentence is never said later out of context.
  const drawnAt = rm.selected == null ? "" : pts[rm.selected]!.k;
  const [status, setStatus] = useState({ text: "", of: drawnAt });
  const [seen, setSeen] = useState(drawnAt);
  if (seen !== drawnAt) {
    setSeen(drawnAt);
    if (status.of !== drawnAt) setStatus({ text: "", of: drawnAt });
  }
  // Selects a bucket for the type table and the detail, or clears it when it is the selected one. A folded stretch has no
  // calls to explain. False in every case: the reading stays, so the same key or click acts on the same point again.
  const activate = (i: number) => {
    const p = pts[i];
    if (!p) return false;
    if (!selectable(p)) {
      setStatus({ text: status.text === FOLDED[0] ? FOLDED[1] : FOLDED[0], of: drawnAt });
      return false;
    }
    const on = drawnAt === p.k;
    setStatus(on ? { text: CLEARED, of: "" } : { text: `Selected ${pointWhen(v, p)}: the table and detail show only its errors.`, of: p.k });
    update({ at: on ? null : p.k }, true);
    return false;
  };
  const read = (i: number) => pointText(m, v, pts[i]!, vt, low[i]);
  const readZoom = (s: Shown | null) => rateZoomWords(rm, s);

  // The chart's data table: per bucket its calls, failed calls and rate (the selected type's when one is), then each type layer and Other.
  const tableRows = useMemo(() => pts.map((p, i): TableRow => ({ p, rate: rates[i] ?? null, low: !!low[i] })), [pts, rates, low]);
  const other = pts.some(p => p.other);
  const columns = useMemo((): Column<TableRow>[] => [
    { id: "when", header: per === "week" ? "Week" : "Day", cell: r => `${pointWhen(v, r.p)}${r.p.k === v.at && !r.p.to ? " (selected)" : ""}` },
    { id: "calls", header: "Tool calls", align: "num", cell: r => fmt(r.p.c) },
    { id: "failed", header: "Failed calls", align: "num", cell: r => fmt(r.p.e) },
    { id: "rate", header: cat ? `${shortLabel(m.cats[cat]!.label)} rate` : "Error rate", align: "num",
      cell: r => r.rate == null ? "–" : `${fmt(r.rate, 2)}%${r.low ? ` (${FEW_CALLS})` : ""}` },
    ...vt.layers.map((c): Column<TableRow> => ({ id: `type:${c}`, header: shortLabel(m.cats[c]!.label), align: "num", cell: r => fmt(r.p.by[c] || 0) })),
    ...(other ? [{ id: "other", header: "Other types", align: "num", cell: (r: TableRow) => fmt(r.p.other) } as const] : []),
  ], [m, v, vt, cat, per, other]);

  const empty = rm.bare === "empty", noErrors = rm.bare != null && !empty;
  const keys = `Use the left and right arrow keys to read each point, Enter or Space to select the ${per} for the table and examples${zoom ? ", and plus and minus to zoom" : ""}.`;
  const label = `Errors by type and error rate. ${keys}${v.at ? ` Selected: ${bucketLabel(m, v)}.` : ""}`;
  return (
    <section className="panel chart-card" aria-labelledby="chartTitle">
      {/* The chart's own option in its header, as on Activity and Cost; the URL keeps it under gran. */}
      <div className="chart-head">
        <div><h2 id="chartTitle">{cat ? `Errors by type · ${m.cats[cat]!.label} selected` : "Errors by type"}</h2>
          <div className="hint" id="chartHint">{`Failed tool calls per ${per}, top ${TOPN} types and Other, with ${cat ? "the selected type's" : "the"} error rate (errors per 100 tool calls) above. Dashed lines mark fixes you applied.${zoom ? " Plus and minus zoom." : ""}`}</div></div>
        <div className="seg" id="fGran" role="group" aria-label="Granularity">
          {(["day", "week"] as const).map(g => <button key={g} type="button" aria-pressed={v.gran === g} onClick={() => update({ gran: g }, true)}>{g === "day" ? "Day" : "Week"}</button>)}
        </div>
      </div>
      {!noErrors && legend(pts.some(idle), low.some(Boolean))}
      {selOut()}
      {/* One stable element around the chart and the message that replaces it: the page's observer watches it, since the
          two boxes are different elements and an observer on one would go stale when they swap. */}
      <div id="chartView">
        {/* Space never scrolls the page under the message either, as under the chart (keys.space); a modified Space is the browser's. */}
        {rm.bare ? <div id="chart" className="echart" tabIndex={0} role="group" aria-label={label} aria-describedby="chartHint"
          onKeyDown={e => { if (e.key === " " && !modified(e)) e.preventDefault(); }}>
          <div className="empty">{empty ? "No tool calls in this range." : `No failed tool calls in this range, out of ${fmt(sumCalls(v, f.calls))}.`}</div></div>
          : <EChart ref={box} id="chart" label={label} describedBy="chartHint" height={rateLayout(rm, scale).height} option={option} view={rm.view}
            points={pts.length} tip={tip} read={read} keys={{ space: true }} onActivate={activate} status={status.of === drawnAt ? status.text : ""}
            zoom={zoom} onZoom={onZoom} readZoom={readZoom} />}
      </div>
      {!rm.bare && table()}
    </section>
  );

  // Render helpers, not components: their buttons keep their identity (and focus) across renders.
  function tip(i: number) {
    const p = pts[i]!, rows = pointRows(m, v, p, vt), selN = (cat && p.byAll[cat]) || 0, inOther = cat && !vt.layers.includes(cat);
    return <>
      <div className="muted">{pointWhen(v, p)}</div>
      {idle(p) ? <div><b>No activity</b> · no tool calls</div> : <>
        {p.c ? <div className="tot"><b>{fmt(p.r, 2)}%</b> rate · <b>{fmt(p.e)}</b> errors · {fmt(p.c)} calls{low[i] ? ` · ${FEW_CALLS}` : ""}</div>
          : <div className="tot">{noCalls(v, p)}</div>}
        {rows.map(([l, k, c, on]) => <div key={l} className={"trow" + (on ? " on" : "")}><span><i className="sw" style={{ background: c }} />{shortLabel(l)}</span><b>{fmt(k)}</b></div>)}
        {inOther && selN ? <div className="trow on"><span>{shortLabel(m.cats[cat]!.label)}</span><b>{fmt(selN)}</b></div> : null}
      </>}
    </>;
  }

  /** The chart's text alternative, as under Activity's and Cost's charts: per bucket its calls, failed calls and the rate the line draws
   *  (the selected type's when one is), then the failed calls of each type layer and Other. */
  function table() {
    return <ChartTable><Table name={`Failed tool calls by type and ${cat ? `${m.cats[cat]!.label} rate` : "error rate"} per ${per}`} region="scroll tall"
      rows={tableRows} columns={columns} rowId={r => r.p.k} /></ChartTable>;
  }

  /** Each type is a button that selects it; Other and the rate line are keys. "Show all" ends the row while the chart is zoomed. */
  function legend(gaps: boolean, lows: boolean) {
    const s = cat && vt.counts[cat] ? cat : null, sc = s && typeColor(s, vt);
    return (
      <div className={"legend" + (cat ? " has-sel" : "")} id="legend" role="group" aria-label="Error types in the chart">
        {vt.layers.map(c => <button key={c} type="button" data-c={c} aria-pressed={cat === c} onClick={() => pick(cat === c ? null : c)}>
          <i className="sw" style={{ background: typeColor(c, vt) }} /><span>{m.cats[c]!.label}</span><em>{fmt(vt.counts[c])}</em></button>)}
        {Object.keys(vt.counts).length > vt.layers.length && <span className="key"><i className="sw" style={{ background: "var(--type-other)" }} />Other types</span>}
        {s ? <span className="key"><i className="sw line sel" style={{ borderTopColor: sc! }} />{shortLabel(m.cats[s]!.label)} rate</span>
          : <span className="key"><i className="sw line" />Error rate</span>}
        {/* The ring takes the line's color through a custom property, not an inline border: the forced-colors rule still decides there. */}
        {lows && <span className="key"><i className="sw low" style={{ "--low-ring": rm.line } as CSSProperties} />{`Under ${LOW_CALLS} calls`}</span>}
        {gaps && <span className="key"><i className="sw nodata" />No activity</span>}
        {showAll(per === "week" ? "Show all weeks" : "Show all days")}
      </div>
    );
  }

  /** The selection stays named here while it lasts: its count, share, rate and incidents in this view. */
  function selOut() {
    const s = cat && vt.counts[cat] ? cat : null;
    if (!s) return <div className="selout" id="selOut" hidden />;
    const k = vt.counts[s]!, tot = Object.values(vt.counts).reduce((a, b) => a + b, 0), calls = sumCalls(v, f.calls), is = incSummary(m, f.errs.filter(e => e.c === s));
    return (
      <div className="selout" id="selOut">
        <span className="muted">Selected</span><b><i className="sw" style={{ background: typeColor(s, vt) }} aria-hidden="true" />{m.cats[s]!.label}</b>
        <span className="muted">{fmt(k)} error{k === 1 ? "" : "s"} · {fmt(k / tot * 100, 0)}% of errors · {calls ? fmt(k / calls * 100, 2) + "% of tool calls" : "no calls"} · {fmt(is.n)} incident{is.n === 1 ? "" : "s"}</span>
        <button type="button" id="selClr" onClick={() => { pick(null); after(() => document.querySelector<HTMLElement>("#catBody button")?.focus()); }}>Clear selection</button>
      </div>
    );
  }
});
