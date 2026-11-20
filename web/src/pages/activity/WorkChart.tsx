import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { DailyWorkRow, UsagePayload } from "../../api";
import { useColors } from "../../colors";
import { dayLabel, niceStep, num, plural } from "../../format";
import { dayAxis, LOW_CALLS, lowVolume, peakLabelAt, roomForLabels, textScale, tipAt, useWidth } from "../../components/chart";
import { ChartTable, DataTable } from "../../components/DataTable";
import { HowMeasured } from "../../components/HowMeasured";
import type { Kind } from "../cost/cost";
import { busy, failRate, METRICS, monday, workBuckets, workKinds, workStack, type WorkMetric } from "./work";

const H = 240;
const BAR = "var(--series-1)", FAIL = "var(--critical)";
const FEW = "too few calls for a steady rate"; // as the Errors chart words it

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

export interface WorkPanelProps {
  d: UsagePayload;
  metric: WorkMetric;
  onMetric: (m: WorkMetric) => void;
  /** A day was selected (click, or Enter while reading with the arrow keys). Weeks cannot be. */
  onDay: (day: string) => void;
}

/** The work chart in the payload's buckets, stacked by project. */
export function WorkPanel({ d, metric, onMetric, onDay }: WorkPanelProps) {
  useColors();
  const rows = useMemo(() => workBuckets(d), [d]);
  const kinds = workKinds(d, rows, metric);
  return <WorkBars rows={rows} week={d.work_bucket === "week"} view={d} kinds={kinds} stack={workStack(rows, d.work_projects, kinds, metric)}
    metric={metric} onMetric={onMetric} onDay={onDay} />;
}

const MARGIN = { t: 22, r: 44, b: 26, l: 52 }; // room on the right for the rate axis

interface WorkBarsProps extends Omit<WorkPanelProps, "d"> {
  rows: DailyWorkRow[];
  week: boolean;
  view: WorkView;
  /** The stacked projects, none for plain bars; stack: each bar's value per kind. */
  kinds: Kind[];
  stack: Record<string, number>[];
}

/** Work per day or week: the chosen count as bars (stacked by project when there are several), errors per 100 tool calls
 *  as a line against its own right-hand axis. */
function WorkBars({ rows, week, view, kinds, stack, metric, onMetric, onDay }: WorkBarsProps) {
  const box = useRef<HTMLDivElement>(null), tip = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null);
  const W = useWidth(box);
  // The bar read (an index) is state; the pointer's position is not, so a move inside one bar re-renders nothing: the
  // tooltip is only moved by hand.
  const [at, setAt] = useState<number | null>(null), pos = useRef({ x: 0, y: 0 });
  const place = () => {
    if (!tip.current || !box.current) return;
    const p = tipAt(box.current, tip.current, pos.current.x, pos.current.y);
    tip.current.style.left = p.left + "px"; tip.current.style.top = p.top + "px";
  };
  useEffect(() => setAt(null), [rows, metric]);
  useLayoutEffect(() => { if (at != null) place(); }, [at]);

  const M = METRICS.find(x => x.k === metric)!, unit = week ? "week" : "day";
  const ts = textScale();
  const a = useMemo(() => dayAxis(W, H, rows.length, Math.max(...rows.map(p => p[metric]), 0), niceStep, MARGIN, ts), [W, rows, metric, ts]);
  // Week labels are longer, so fewer of them fit.
  const every = week ? Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor(a.iw / (100 * ts))))) : a.every;
  // The rate axis has as many steps as the count axis, so its ticks sit on the same grid lines.
  // No bar with a tool call: no rate to draw, so no line, axis or legend key.
  // A bar with few calls (when others have enough) has a noisy rate: it gets a hollow dot and is left out of the scale, so one
  // quiet day's 2 of 4 can't flatten the busy days. The line still runs through it; a rate above the axis stops at its top.
  const rates = rows.map(failRate), hasRate = rates.some(r => r != null), n = Math.round(a.yMax / a.step);
  const low = useMemo(() => lowVolume(rows.map(p => p.calls)), [rows]), hasLow = low.some(Boolean);
  const rStep = niceStep((Math.max(...rates.map((r, i) => (low[i] ? 0 : r ?? 0)), 0) * 1.08 || 1) / n), ry = (v: number) => a.m.t + a.ih - Math.min(v, rStep * n) / (rStep * n) * a.ih;
  const rDigits = Math.max(0, -Math.floor(Math.log10(rStep))); // a step of 0.5 reads "0.5", not "1"
  const line = rates.map((v, i) => (v == null ? "" : `${rates[i - 1] != null ? "L" : "M"}${a.cx(i).toFixed(1)},${ry(v).toFixed(1)}`)).join("");
  const lone = rates.flatMap((v, i) => (v != null && !low[i] && rates[i - 1] == null && rates[i + 1] == null ? [i] : [])); // no line reaches these
  const plain = useMemo<Kind>(() => ({ k: metric, label: M.label, c: BAR }), [metric, M.label]);
  // A bar's parts, bottom first; zero parts left out.
  const parts = useCallback((i: number): [Kind, number][] =>
    (kinds.length ? kinds.map((k): [Kind, number] => [k, stack[i]?.[k.k] ?? 0]) : [[plain, rows[i]![metric]] as [Kind, number]]).filter(([, v]) => v > 0),
  [kinds, stack, plain, rows, metric]);
  const peak = rows.reduce((b, p, i) => (p[metric] > rows[b]![metric] ? i : b), 0), pk = rows[peak];
  const indexAt = (clientX: number) => {
    const r = svg.current!.getBoundingClientRect(), px = (clientX - r.left) * W / r.width;
    return Math.max(0, Math.min(rows.length - 1, Math.floor((px - a.m.l) / a.bw)));
  };
  const pick = (i: number) => { const p = rows[i]; if (!week && p && busy(p)) { setAt(null); onDay(p.day); } };
  const onMove = (ev: PointerEvent) => {
    const i = indexAt(ev.clientX);
    pos.current = { x: ev.clientX, y: ev.clientY };
    if (i === at) place(); else setAt(i); // a new bar: the layout effect places the tooltip once it shows that bar
  };
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") return setAt(null);
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
    const x = a.x(i), segs = parts(i);
    let base = 0;
    return <g key={p.day}>
      {i % every === 0 && <text x={x + a.w / 2} y={H - 6 * ts} textAnchor="middle" fontSize={11 * ts} fill="var(--text-muted)">{bucketLabel(p.day, week)}</text>}
      {/* One group per bar, so the whole stack grows from the baseline when data lands. */}
      {segs.length > 0 && <g className="bar-seg" style={{ ["--i" as string]: Math.min(i, 60) }}>{segs.map(([k, v], j) => {
        const top = a.y(base + v), h = v / a.yMax * a.ih;
        base += v;
        // 2px surface gap between stacked segments; the top segment gets rounded corners.
        const hh = Math.max(0, h - (j ? 2 : 0));
        return j === segs.length - 1 && hh > 4
          ? <path key={k.k} d={`M${x},${top + hh} V${top + 3} q0,-3 3,-3 H${x + a.w - 3} q3,0 3,3 V${top + hh} Z`} fill={k.c} />
          : <rect key={k.k} x={x} y={top} width={a.w} height={hh} fill={k.c} />;
      })}</g>}
    </g>;
  }), [rows, a, every, week, parts, ts]);
  const ticks: number[] = [];
  for (let v = 0; v <= n; v++) ticks.push(v);
  const cur = at != null ? rows[at] : undefined, curParts = at != null && kinds.length ? parts(at).reverse() : [];
  const name = (day: string) => bucketLabel(day, week, true, view);
  const what = `${M.label}${kinds.length ? " by project" : ""}${hasRate ? " and errors per 100 tool calls" : ""} per ${unit}, ${plural(rows.length, unit)}`;
  const label = pk && pk[metric] > 0
    ? `${what}, ${M.label.toLowerCase()} peaking at ${num(pk[metric])} ${week ? "in the week of" : "on"} ${dayLabel(pk.day, true)}${week ? weekCut(pk.day, view) : ""}. `
      + (week ? "Use the left and right arrow keys to read each week. Choose a shorter range to pick a day." : "Use the left and right arrow keys to read each day and Enter to list its sessions.")
    : `${what}, no ${M.label.toLowerCase()} yet.`;

  return (
    <section className="panel sect work" id="work" aria-labelledby="workTitle">
      <div className="chart-head">
        <div><h2 id="workTitle">Work per {unit}</h2>
          <div className="hint">{M.label}{kinds.length ? " by project" : ""} per {week ? "week" : "day"}{hasRate
            ? ", errors per 100 tool calls on the right axis" : ""}. {week ? "Choose a shorter range to pick a day." : "Select a day to list its sessions."}
            <HowMeasured what="work per day">{kinds.length ? "Projects with a color of their own are drawn apart, the rest in Other. " : ""}{week
              ? "Weeks start on Monday. " : "With the keyboard, focus the chart, use the arrow keys and press Enter to list a day's sessions. "}
              {hasRate ? "The line is the failed tool calls per 100 calls, against its own axis." : ""}</HowMeasured></div></div>
        <div className="seg" role="group" aria-label="Chart metric">
          {METRICS.map(x => <button key={x.k} type="button" aria-pressed={x.k === metric} onClick={() => onMetric(x.k)}>{x.label}</button>)}
        </div>
      </div>
      <div className="legend" aria-hidden="true">
        {(kinds.length ? kinds : [plain]).map(k => <span key={k.k} className="key"><i style={{ background: k.c }} />{k.label}</span>)}
        {hasRate && <span className="key"><i className="line fail" />Errors per 100 calls (right axis)</span>}
        {hasLow && <span className="key"><i className="low" />{`Under ${LOW_CALLS} calls`}</span>}
      </div>
      <div className="chart" ref={box} tabIndex={0} role="group" aria-label={label} onKeyDown={onKey} onBlur={() => setAt(null)}>
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {ticks.map(t => <g key={t}><line x1={a.m.l} x2={W - a.m.r} y1={a.y(t * a.step)} y2={a.y(t * a.step)} stroke="var(--grid)" />
            <text x={a.m.l - 6 * ts} y={a.y(t * a.step) + 4 * ts} textAnchor="end" fontSize={11 * ts} fill="var(--text-muted)">{num(t * a.step)}</text>
            {hasRate && <text className="rtick" x={W - a.m.r + 6 * ts} y={ry(t * rStep) + 4 * ts} fontSize={11 * ts} fill="var(--text-muted)">{num(t * rStep, rDigits)}</text>}</g>)}
          {hasRate && roomForLabels(a) && <text transform={`translate(${W - 6 * ts},${a.m.t + a.ih / 2}) rotate(90)`} textAnchor="middle" fontSize={11 * ts} fill="var(--text-muted)">Errors per 100 calls</text>}
          {bars}
          {/* The rate line, haloed in the surface color so it stays readable across the bars. */}
          {hasRate && <>
            <path d={line} fill="none" stroke="var(--surface-1)" strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="round" />
            <path className="rate" d={line} fill="none" stroke={FAIL} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
          </>}
          {lone.map(i => <circle key={i} className="rate" cx={a.cx(i)} cy={ry(rates[i]!)} r="2.5" fill={FAIL} stroke="var(--surface-1)" strokeWidth="1.5" />)}
          {rates.map((r, i) => low[i] && r != null && <circle key={"lo" + i} className="lowc" cx={a.cx(i)} cy={ry(r)} r="3" fill="var(--surface-1)" stroke={FAIL} strokeWidth="1.5" />)}
          {pk && pk[metric] > 0 && roomForLabels(a) && (() => {
            const { x: lx, anchor } = peakLabelAt(a, peak);
            // A wide halo, so the rate line never strikes through the label.
            return <text x={lx} y={a.y(pk[metric]) - 7 * ts} textAnchor={anchor} fontSize={11 * ts} fontWeight="600" fill="var(--text-primary)"
              stroke="var(--surface-1)" strokeWidth="7" strokeLinejoin="round" paintOrder="stroke">Peak {plural(pk[metric], M.one)} · {bucketLabel(pk.day, week)}</text>;
          })()}
          {at != null && <rect x={a.m.l + at * a.bw} width={a.bw} y={a.m.t} height={a.ih} fill="var(--text-primary)" opacity=".06" />}
          <rect x={a.m.l} y={a.m.t} width={a.iw} height={a.ih} fill="transparent" className={week ? "hit" : "hit pick"}
            onPointerMove={onMove} onPointerLeave={() => setAt(null)} onClick={week ? undefined : ev => pick(indexAt(ev.clientX))} />
        </svg>
        <div className="tip" ref={tip} role="tooltip" style={{ display: cur ? "block" : "none" }}>{cur && <>
          <div className="muted">{name(cur.day)}</div>
          {METRICS.map(x => <div key={x.k} className="row"><span>{x.k === metric && !kinds.length && <i style={{ background: BAR }} />}{x.label}</span><b>{num(cur[x.k])}</b></div>)}
          {curParts.length > 0 && <div className="parts">{curParts.map(([k, v]) =>
            <div key={k.k} className="row"><span><i style={{ background: k.c }} />{k.label}</span><b>{num(v)}</b></div>)}</div>}
          <div className="row tot"><span><i style={{ background: FAIL }} />Errors per 100 calls</span><b>{num(failRate(cur), 1)}</b></div>
          <div className="row"><span>Failed tool calls</span><b>{num(cur.failed_calls)}{cur.calls ? ` of ${num(cur.calls)}` : ""}</b></div>
          {low[at!] && <div className="muted">{FEW}</div>}
        </>}</div>
      </div>
      <div className="sr" aria-live="polite">{cur ? `${name(cur.day)}: ${bucketText(cur)}${low[at!] ? `, ${FEW}` : ""}`
        + (curParts.length ? `. ${M.label} by project: ${curParts.map(([k, v]) => `${k.label} ${num(v)}`).join(", ")}` : "") : ""}</div>
      {/* The chart's text alternative: the measure per bucket (by project when stacked), its total and errors per 100 tool calls. */}
      <ChartTable><DataTable name={`${M.label}${kinds.length ? " by project" : ""} and errors per 100 tool calls per ${unit}`} region="scroll tall">
        <thead><tr><th scope="col">{week ? "Week" : "Day"}</th>{kinds.map(k => <th key={k.k} scope="col" className="num">{k.label}</th>)}
          <th scope="col" className="num">{kinds.length ? "Total" : M.label}</th><th scope="col" className="num">Errors per 100 calls</th></tr></thead>
        <tbody>{rows.map((p, i) => <tr key={p.day}><th scope="row">{name(p.day)}</th>
          {kinds.map(k => <td key={k.k} className="num">{num(stack[i]?.[k.k] ?? 0)}</td>)}<td className="num">{num(p[metric])}</td><td className="num">{num(failRate(p), 1)}{low[i] ? ` (${FEW})` : ""}</td></tr>)}</tbody>
      </DataTable></ChartTable>
    </section>
  );
}
