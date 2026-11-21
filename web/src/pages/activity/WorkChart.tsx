import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { DailyWorkRow, UsagePayload } from "../../api";
import { useColors } from "../../colors";
import { dayLabel, niceStep, num, plural } from "../../format";
import { dayAxis, FEW_CALLS, LOW_CALLS, lowVolume, peakLabelAt, roomForLabels, stackHeights, textScale, tipAt, useWidth } from "../../components/chart";
import { ChartTable } from "../../components/DataTable";
import { HowMeasured } from "../../components/HowMeasured";
import { Table, type Column } from "../../components/table/Table";
import type { Kind } from "../cost/cost";
import { busy, failRate, METRICS, monday, workBuckets, workKinds, workStack, type WorkMetric } from "./work";
import { modified } from "../../components/keys";

const H = 216;
// The rate track under the bars: its height and the gap between the two tracks, before scaling with the text.
const RATE_H = 36, TRACK_GAP = 16;
const BAR = "var(--series-1)", FAIL = "var(--critical)";

/** The days of a view: a week bar it cuts short is partial. */
export interface WorkView { start: string | null; end: string }
/** What a partial week bar covers: ", from Sep 9" when the view starts after its Monday, ", so far" for the week that holds
 *  the end of the view (still growing, even on its Sunday); "" for a whole week. */
const weekCut = (day: string, v: WorkView) =>
  v.start && v.start > day ? `, from ${dayLabel(v.start)}` : monday(v.end) === day ? ", so far" : "";
/** A bar's name: its day, or the week it starts ("Week of Oct 5"); long: with the year, and how much of a week the view
 *  covers when it cuts it short ("Week of Nov 9, 2026, so far"). */
export const bucketLabel = (day: string, week: boolean, long = false, v?: WorkView) =>
  (week ? `Week of ${dayLabel(day, long)}${long && v ? weekCut(day, v) : ""}` : dayLabel(day, long));
/** One bar read aloud: "12 commits, 40 prompts, 6 sessions, 9 failed calls of 120, 7.5 per 100". */
const bucketText = (p: DailyWorkRow) => `${plural(p.commits, "commit")}, ${plural(p.prompts, "prompt")}, ${plural(p.sessions, "session")}, `
  + `${plural(p.failed_calls, "failed call")}${p.calls ? ` of ${num(p.calls)}, ${num(failRate(p), 1)} per 100` : ""}`;

/** The id of the chart's focusable box. */
export const CHART_ID = "work-chart";

/** The chart's selection: a day, or a week by its Monday. */
export interface WorkPick { day: string; week: boolean }

export interface WorkPanelProps {
  d: UsagePayload;
  metric: WorkMetric;
  onMetric: (m: WorkMetric) => void;
  /** The selection (a day, or a week by its Monday); none for the whole range. A link can name a day on a chart by week or
   *  a week on a chart by day: the chip still names it, and no bar is marked. */
  selected: WorkPick | null;
  /** A bucket was selected (click, or Enter while reading with the arrow keys): a day, or a week on a chart by week. None:
   *  the chart takes no pick (it still shows the previous view while a new one loads). */
  onPick?: (p: WorkPick) => void;
  /** The selection was cleared, by its chip or Escape on the chart. */
  onClear: () => void;
}

/** The work chart in the payload's buckets, stacked by project. */
export function WorkPanel({ d, ...props }: WorkPanelProps) {
  useColors();
  const rows = useMemo(() => workBuckets(d), [d]);
  const kinds = workKinds(d, rows, props.metric);
  return <WorkBars rows={rows} week={d.work_bucket === "week"} view={d} kinds={kinds} stack={workStack(rows, d.work_projects, kinds, props.metric)} {...props} />;
}

const MARGIN = { t: 20, r: 16, b: 24 + TRACK_GAP + RATE_H, l: 52 }; // room under the bars for the rate track and the bucket labels

interface WorkBarsProps extends Omit<WorkPanelProps, "d"> {
  rows: DailyWorkRow[];
  week: boolean;
  view: WorkView;
  /** The stacked projects, none for plain bars; stack: each bar's value per kind. */
  kinds: Kind[];
  stack: Record<string, number>[];
}

/** A row of the chart's data table: a bucket with its label, its stacked parts and whether it has few calls. */
interface WorkRow { p: DailyWorkRow; label: string; stack: Record<string, number> | undefined; few: boolean }

/** The rate track's scale: its top (a nice value over the highest steady rate) and the digits its label needs. Buckets with few
 *  calls (when others have enough) are left out, so one quiet day's 2 of 4 can't flatten the busy days. */
export function rateScale(rates: readonly (number | null)[], low: readonly boolean[]): { top: number; digits: number } {
  const top = niceStep(Math.max(...rates.map((r, i) => (low[i] ? 0 : r ?? 0)), 0) * 1.08 || 1);
  return { top, digits: Math.max(0, -Math.floor(Math.log10(top))) };
}

/** Work per day or week on two tracks over one x-axis: the chosen count as bars (stacked by project when there are several),
 *  and under them errors per 100 tool calls as a line against its own scale. */
function WorkBars({ rows, week, view, kinds, stack, metric, onMetric, selected, onPick, onClear }: WorkBarsProps) {
  const box = useRef<HTMLDivElement>(null), tip = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null);
  const W = useWidth(box);
  // The bar read (an index) is state; the pointer's position is not, so a move inside one bar re-renders nothing: the
  // tooltip is only moved by hand.
  const [at, setAt] = useState<number | null>(null), pos = useRef({ x: 0, y: 0 });
  // What the last pick or clear did, read out once.
  const [said, setSaid] = useState("");
  const place = () => {
    if (!tip.current || !box.current) return;
    const p = tipAt(box.current, tip.current, pos.current.x, pos.current.y);
    tip.current.style.left = p.left + "px"; tip.current.style.top = p.top + "px";
  };
  useEffect(() => setAt(null), [rows, metric]);
  useLayoutEffect(() => { if (at != null) place(); }, [at]);
  // Escape dismisses an open tooltip wherever the focus is: the pointer can open it while the focus is elsewhere.
  useEffect(() => {
    if (at == null) return;
    const off = (ev: globalThis.KeyboardEvent) => { if (ev.key === "Escape" && !modified(ev)) setAt(null); };
    document.addEventListener("keydown", off);
    return () => document.removeEventListener("keydown", off);
  }, [at]);

  const M = METRICS.find(x => x.k === metric)!, unit = week ? "week" : "day";
  const ts = textScale();
  const a = useMemo(() => dayAxis(W, H, rows.length, Math.max(...rows.map(p => p[metric]), 0), niceStep, MARGIN, ts), [W, rows, metric, ts]);
  // Week labels are longer, so fewer of them fit.
  const every = week ? Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor(a.iw / (100 * ts))))) : a.every;
  // The rate track sits under the bars: rt its top, rh its height. No bucket with a tool call: no rate to draw, so no track.
  // A bucket with few calls (when others have enough) gets a hollow dot and is left out of the scale. The line still runs
  // through it; a rate above the scale stops at the track's top.
  const rt = a.m.t + a.ih + TRACK_GAP * ts, rh = RATE_H * ts;
  const rates = rows.map(failRate), hasRate = rates.some(r => r != null);
  const low = useMemo(() => lowVolume(rows.map(p => p.calls)), [rows]), hasLow = low.some(Boolean);
  const rs = rateScale(rates, low), ry = (v: number) => rt + rh - Math.min(v, rs.top) / rs.top * rh;
  const line = rates.map((v, i) => (v == null ? "" : `${rates[i - 1] != null ? "L" : "M"}${a.cx(i).toFixed(1)},${ry(v).toFixed(1)}`)).join("");
  const lone = rates.flatMap((v, i) => (v != null && !low[i] && rates[i - 1] == null && rates[i + 1] == null ? [i] : [])); // no line reaches these
  // The data table: one row per bucket, its figure per kind (by project when stacked), the total and the rate.
  const tableRows = useMemo(() => rows.map((p, i): WorkRow => ({ p, label: bucketLabel(p.day, week, true, view), stack: stack[i], few: !!low[i] })), [rows, week, view, stack, low]);
  const columns = useMemo((): Column<WorkRow>[] => [
    { id: "day", header: week ? "Week" : "Day", cell: r => r.label },
    ...kinds.map((k): Column<WorkRow> => ({ id: `kind:${k.k}`, header: k.label, align: "num", cell: r => num(r.stack?.[k.k] ?? 0) })),
    { id: "total", header: kinds.length ? "Total" : M.label, align: "num", cell: r => num(r.p[metric]) },
    { id: "rate", header: "Errors per 100 calls", align: "num", cell: r => num(failRate(r.p), 1) + (r.few ? ` (${FEW_CALLS})` : "") },
  ], [week, kinds, M.label, metric]);
  const plain = useMemo<Kind>(() => ({ k: metric, label: M.label, c: BAR }), [metric, M.label]);
  // A bar's parts, bottom first; zero parts left out.
  const parts = useCallback((i: number): [Kind, number][] =>
    (kinds.length ? kinds.map((k): [Kind, number] => [k, stack[i]?.[k.k] ?? 0]) : [[plain, rows[i]![metric]] as [Kind, number]]).filter(([, v]) => v > 0),
  [kinds, stack, plain, rows, metric]);
  const peak = rows.reduce((b, p, i) => (p[metric] > rows[b]![metric] ? i : b), 0), pk = rows[peak];
  const sel = selected && selected.week === week ? rows.findIndex(p => p.day === selected.day) : -1;
  const name = (day: string) => bucketLabel(day, week, true, view);
  const indexAt = (clientX: number) => {
    const r = svg.current!.getBoundingClientRect(), px = (clientX - r.left) * W / r.width;
    return Math.max(0, Math.min(rows.length - 1, Math.floor((px - a.m.l) / a.bw)));
  };
  const pick = (i: number) => {
    const p = rows[i];
    if (!p || !busy(p) || !onPick) return;
    setAt(null);
    setSaid(`${name(p.day)} selected; the tabs below show its ${week ? "days" : "figures"}.`);
    onPick({ day: p.day, week });
  };
  const clear = () => { setSaid("Selection cleared; the tabs below show the whole range."); onClear(); };
  const onMove = (ev: PointerEvent) => {
    const i = indexAt(ev.clientX);
    pos.current = { x: ev.clientX, y: ev.clientY };
    if (i === at) place(); else setAt(i); // a new bar: the layout effect places the tooltip once it shows that bar
  };
  const onKey = (ev: KeyboardEvent) => {
    if (modified(ev)) return; // Alt+Left is history, Ctrl+Home the page: not ours
    // Escape ends a reading first, then clears the selection. Handled here only: Escape elsewhere (a sheet) keeps it.
    if (ev.key === "Escape") {
      if (at != null) return setAt(null);
      if (selected) { ev.preventDefault(); clear(); }
      return;
    }
    if (ev.key === "Enter" && at != null) { ev.preventDefault(); return pick(at); }
    const step = ({ ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity } as Record<string, number>)[ev.key];
    if (step == null || !rows.length) return;
    ev.preventDefault();
    const from = at ?? (step > 0 ? -1 : rows.length); // first Right picks the first bar, first Left the last
    const i = Math.max(0, Math.min(rows.length - 1, from + step));
    const r = svg.current!.getBoundingClientRect(), s = r.width / W;
    pos.current = { x: r.left + a.cx(i) * s, y: r.top + a.m.t * s + 20 };
    if (i === at) place(); else setAt(i);
  };
  // The bars and their axis labels: drawn again only with the data, the size or the metric, not on every pointer move.
  const bars = useMemo(() => rows.map((p, i) => {
    const x = a.x(i), segs = parts(i), vals = segs.map(([, v]) => v);
    // 2px surface gap between stacked segments; the top segment gets rounded corners. A positive segment keeps at least 1px, as on
    // Cost: the slots make room for that pixel and the gap below it, and the others shrink to keep the bar its height.
    const slots = stackHeights(vals, vals.reduce((s, v) => s + v, 0) / a.yMax * a.ih, segs.map((_, j) => (j ? 3 : 1)));
    let base = a.y(0);
    return <g key={p.day}>
      {i % every === 0 && <text x={x + a.w / 2} y={H - 6 * ts} textAnchor="middle" fontSize={11 * ts} fill="var(--text-muted)">{bucketLabel(p.day, week)}</text>}
      {/* One group per bar, so the whole stack grows from the baseline when data lands. */}
      {segs.length > 0 && <g className="bar-seg" style={{ ["--i" as string]: Math.min(i, 60) }}>{segs.map(([k], j) => {
        const top = base - slots[j]!, hh = slots[j]! - (j ? 2 : 0);
        base = top;
        return j === segs.length - 1 && hh > 4
          ? <path key={k.k} d={`M${x},${top + hh} V${top + 3} q0,-3 3,-3 H${x + a.w - 3} q3,0 3,3 V${top + hh} Z`} fill={k.c} />
          : <rect key={k.k} x={x} y={top} width={a.w} height={hh} fill={k.c} />;
      })}</g>}
    </g>;
  }), [rows, a, every, week, parts, ts]);
  const n = Math.round(a.yMax / a.step), ticks: number[] = [];
  for (let v = 0; v <= n; v++) ticks.push(v);
  const cur = at != null ? rows[at] : undefined, curParts = at != null && kinds.length ? parts(at).reverse() : [];
  const what = `${M.label}${kinds.length ? " by project" : ""} per ${unit}${hasRate ? ", with errors per 100 tool calls on a track below" : ""}, ${plural(rows.length, unit)}`;
  const label = pk && pk[metric] > 0
    ? `${what}, ${M.label.toLowerCase()} peaking at ${num(pk[metric])} ${week ? "in the week of" : "on"} ${dayLabel(pk.day, true)}${week ? weekCut(pk.day, view) : ""}. `
      + `Use the left and right arrow keys to read each ${unit}, Enter to select it and Escape to clear the selection.`
    : `${what}, no ${M.label.toLowerCase()} yet.`;
  const full = (y0: number, y1: number) => ({ y: y0, height: y1 - y0 });
  const band = full(a.m.t, hasRate ? rt + rh : a.m.t + a.ih);

  return (
    <section className="panel sect work" id="work" aria-labelledby="workTitle">
      <div className="chart-head">
        <div><h2 id="workTitle">Work per {unit}</h2>
          <div className="hint">{M.label}{kinds.length ? " by project" : ""} per {unit}{hasRate ? ", errors per 100 tool calls below" : ""}. Select a {unit} to narrow the tabs.
            <HowMeasured what={`work per ${unit}`} docs="reference/glossary#activity">{kinds.length ? "Projects with a color of their own are drawn apart, the rest in Other. " : ""}{week
              ? "Weeks start on Monday. " : ""}With the keyboard, focus the chart, use the arrow keys and press Enter to select a {unit}; Escape clears it.
              {hasRate ? " The lower track is the failed tool calls per 100 calls, against its own scale." : ""}</HowMeasured></div></div>
        <div className="head-side">
          {selected && <span className="daychip"><span>{bucketLabel(selected.day, selected.week)}</span>
            <button type="button" aria-label={`Clear ${bucketLabel(selected.day, selected.week, true).replace(/^W/, "w")}`} title="Show the whole range"
              onClick={() => { clear(); box.current?.focus(); }}>✕</button></span>}
          <div className="seg" role="group" aria-label="Chart metric">
            {METRICS.map(x => <button key={x.k} type="button" aria-pressed={x.k === metric} onClick={() => onMetric(x.k)}>{x.label}</button>)}
          </div>
        </div>
      </div>
      <div className="legend" aria-hidden="true">
        {(kinds.length ? kinds : [plain]).map(k => <span key={k.k} className="key"><i style={{ background: k.c }} />{k.label}</span>)}
        {hasRate && <span className="key"><i className="line fail" />Errors per 100 calls (lower track)</span>}
        {hasLow && <span className="key"><i className="low" />{`Under ${LOW_CALLS} calls`}</span>}
      </div>
      <div className="chart" id={CHART_ID} ref={box} tabIndex={0} role="group" aria-label={label} onKeyDown={onKey} onBlur={() => setAt(null)}>
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {ticks.map(t => <g key={t}><line x1={a.m.l} x2={W - a.m.r} y1={a.y(t * a.step)} y2={a.y(t * a.step)} stroke="var(--grid)" />
            <text x={a.m.l - 6 * ts} y={a.y(t * a.step) + 4 * ts} textAnchor="end" fontSize={11 * ts} fill="var(--text-muted)">{num(t * a.step)}</text></g>)}
          {sel >= 0 && <rect className="selb" x={a.m.l + sel * a.bw} width={a.bw} {...band} fill="var(--accent)" opacity=".12" />}
          {bars}
          {hasRate && <g className="rtrack">
            {[0, rs.top].map(v => <g key={v}><line x1={a.m.l} x2={W - a.m.r} y1={ry(v)} y2={ry(v)} stroke="var(--grid)" />
              {/* The top label hangs under its line, clear of the bars' 0 above it. */}
              <text className="rtick" x={a.m.l - 6 * ts} y={ry(v) + (v ? 9 : 3) * ts} textAnchor="end" fontSize={11 * ts} fill="var(--text-muted)">{num(v, v ? rs.digits : 0)}</text></g>)}
            <path className="rate" d={line} fill="none" stroke={FAIL} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
            {lone.map(i => <circle key={i} className="rate" cx={a.cx(i)} cy={ry(rates[i]!)} r="2.5" fill={FAIL} stroke="var(--surface-1)" strokeWidth="1.5" />)}
            {rates.map((r, i) => low[i] && r != null && <circle key={"lo" + i} className="lowc" cx={a.cx(i)} cy={ry(r)} r="3" fill="var(--surface-1)" stroke={FAIL} strokeWidth="1.5" />)}
          </g>}
          {pk && pk[metric] > 0 && roomForLabels(a) && (() => {
            const { x: lx, anchor } = peakLabelAt(a, peak);
            return <text x={lx} y={a.y(pk[metric]) - 7 * ts} textAnchor={anchor} fontSize={11 * ts} fontWeight="600" fill="var(--text-primary)"
              stroke="var(--surface-1)" strokeWidth="7" strokeLinejoin="round" paintOrder="stroke">Peak {plural(pk[metric], M.one)} · {bucketLabel(pk.day, week)}</text>;
          })()}
          {at != null && <rect x={a.m.l + at * a.bw} width={a.bw} {...band} fill="var(--text-primary)" opacity=".06" />}
          <rect x={a.m.l} width={a.iw} {...band} fill="transparent" className="hit pick"
            onPointerMove={onMove} onPointerLeave={() => setAt(null)} onClick={ev => pick(indexAt(ev.clientX))} />
        </svg>
        <div className="tip" ref={tip} role="tooltip" style={{ display: cur ? "block" : "none" }}>{cur && <>
          <div className="muted">{name(cur.day)}</div>
          {METRICS.map(x => <div key={x.k} className="row"><span>{x.k === metric && !kinds.length && <i style={{ background: BAR }} />}{x.label}</span><b>{num(cur[x.k])}</b></div>)}
          {curParts.length > 0 && <div className="parts">{curParts.map(([k, v]) =>
            <div key={k.k} className="row"><span><i style={{ background: k.c }} />{k.label}</span><b>{num(v)}</b></div>)}</div>}
          <div className="row tot"><span><i style={{ background: FAIL }} />Errors per 100 calls</span><b>{num(failRate(cur), 1)}</b></div>
          <div className="row"><span>Failed tool calls</span><b>{num(cur.failed_calls)}{cur.calls ? ` of ${num(cur.calls)}` : ""}</b></div>
          {low[at!] && <div className="muted">{FEW_CALLS}</div>}
        </>}</div>
      </div>
      <div className="sr" aria-live="polite">{cur ? `${name(cur.day)}: ${bucketText(cur)}${low[at!] ? `, ${FEW_CALLS}` : ""}`
        + (curParts.length ? `. ${M.label} by project: ${curParts.map(([k, v]) => `${k.label} ${num(v)}`).join(", ")}` : "") : said}</div>
      {/* The chart's text alternative: the measure per bucket (by project when stacked), its total and errors per 100 tool calls. */}
      <ChartTable><Table name={`${M.label}${kinds.length ? " by project" : ""} and errors per 100 tool calls per ${unit}`} region="scroll tall"
        rows={tableRows} columns={columns} rowId={r => r.p.day} /></ChartTable>
    </section>
  );
}
