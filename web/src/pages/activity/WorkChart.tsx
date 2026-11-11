import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { DailyWorkRow, UsagePayload } from "../../api";
import { useColors } from "../../colors";
import { dayLabel, niceStep, num, plural } from "../../format";
import { dayAxis, peakLabelAt, tipAt, useWidth } from "../../components/chart";
import type { Kind } from "../cost/cost";
import { busy, failRate, METRICS, workBuckets, workKinds, workStack, type WorkMetric } from "./work";
import { WorkHours } from "./WorkHours";

const H = 240;
const BAR = "var(--series-1)", FAIL = "var(--critical)";

/** One day read aloud: "12 commits, 40 prompts, 6 sessions, 9 failed calls". */
export const dayText = (p: DailyWorkRow) =>
  `${plural(p.commits, "commit")}, ${plural(p.prompts, "prompt")}, ${plural(p.sessions, "session")}, ${plural(p.failed_calls, "failed call")}`;

export interface WorkChartProps {
  days: DailyWorkRow[];
  metric: WorkMetric;
  onMetric: (m: WorkMetric) => void;
  /** A day was selected (click, or Enter while reading with the arrow keys). */
  onDay: (day: string) => void;
}

/** Work per day: the chosen count as bars, failed tool calls as a line on the same scale. */
export function WorkChart({ days, metric, onMetric, onDay }: WorkChartProps) {
  const box = useRef<HTMLDivElement>(null), tip = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null);
  const W = useWidth(box);
  const [at, setAt] = useState<{ i: number; x: number; y: number } | null>(null);
  useEffect(() => setAt(null), [days, metric]);
  useLayoutEffect(() => {
    if (!at || !tip.current || !box.current) return;
    const p = tipAt(box.current, tip.current, at.x, at.y);
    tip.current.style.left = p.left + "px"; tip.current.style.top = p.top + "px";
  }, [at]);

  const M = METRICS.find(x => x.k === metric)!;
  const max = Math.max(...days.map(p => Math.max(p[metric], p.failed_calls)), 0);
  const a = dayAxis(W, H, days.length, max, niceStep);
  const peak = days.reduce((b, p, i) => (p[metric] > days[b]![metric] ? i : b), 0), pk = days[peak];
  const fail = days.map((p, i) => `${i ? "L" : "M"}${a.cx(i).toFixed(1)},${a.y(p.failed_calls).toFixed(1)}`).join("");
  const indexAt = (clientX: number) => {
    const r = svg.current!.getBoundingClientRect(), px = (clientX - r.left) * W / r.width;
    return Math.max(0, Math.min(days.length - 1, Math.floor((px - a.m.l) / a.bw)));
  };
  const pick = (i: number) => { const p = days[i]; if (p && busy(p)) { setAt(null); onDay(p.day); } };
  const onMove = (ev: PointerEvent) => setAt({ i: indexAt(ev.clientX), x: ev.clientX, y: ev.clientY });
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === "Enter" && at) { ev.preventDefault(); return pick(at.i); }
    const step = ({ ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity } as Record<string, number>)[ev.key];
    if (step == null || !days.length) return;
    ev.preventDefault();
    const from = at?.i ?? (step > 0 ? -1 : days.length); // first Right picks the first day, first Left the last
    const i = Math.max(0, Math.min(days.length - 1, from + step));
    const r = svg.current!.getBoundingClientRect(), s = r.width / W;
    setAt({ i, x: r.left + a.cx(i) * s, y: r.top + a.m.t * s + 20 });
  };
  const ticks: number[] = [];
  for (let v = 0; v <= a.yMax + 1e-9; v += a.step) ticks.push(v);
  const cur = at ? days[at.i] : undefined;
  const label = pk && pk[metric] > 0
    ? `${M.label} and failed tool calls per day, ${days.length} days, ${M.label.toLowerCase()} peaking at ${num(pk[metric])} on ${dayLabel(pk.day, true)}. Use the left and right arrow keys to read each day and Enter to list its sessions.`
    : `${M.label} and failed tool calls per day, ${days.length} days, no ${M.label.toLowerCase()} yet.`;

  return (
    <section className="panel sect work" id="work" aria-labelledby="workTitle">
      <div className="chart-head">
        <div><h2 id="workTitle">Work per day</h2>
          <div className="hint">{M.label} and failed tool calls per day, on one scale. Select a day to list its sessions; with the keyboard, focus the chart, use the arrow keys and press Enter.</div></div>
        <div className="seg" role="group" aria-label="Chart metric">
          {METRICS.map(x => <button key={x.k} type="button" aria-pressed={x.k === metric} onClick={() => onMetric(x.k)}>{x.label}</button>)}
        </div>
      </div>
      <div className="legend" aria-hidden="true">
        <span className="key"><i style={{ background: BAR }} />{M.label}</span>
        <span className="key"><i className="line" style={{ borderTopColor: FAIL }} />Failed tool calls</span>
      </div>
      <div className="chart" ref={box} tabIndex={0} role="img" aria-label={label} onKeyDown={onKey} onBlur={() => setAt(null)}>
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {ticks.map(v => <g key={v}><line x1={a.m.l} x2={W - a.m.r} y1={a.y(v)} y2={a.y(v)} stroke="var(--grid)" />
            <text x={a.m.l - 6} y={a.y(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">{num(v)}</text></g>)}
          {days.map((p, i) => {
            const x = a.x(i), v = p[metric], top = a.y(v), h = a.y(0) - top;
            return <g key={p.day}>
              {i % a.every === 0 && <text x={x + a.w / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--text-muted)">{dayLabel(p.day)}</text>}
              {v > 0 && <g className="bar-seg" style={{ ["--i" as string]: Math.min(i, 60) }}>{h > 4
                ? <path d={`M${x},${top + h} V${top + 3} q0,-3 3,-3 H${x + a.w - 3} q3,0 3,3 V${top + h} Z`} fill={BAR} />
                : <rect x={x} y={top} width={a.w} height={h} fill={BAR} />}</g>}
            </g>;
          })}
          {/* The failed-calls line, haloed in the surface color so it stays readable across the bars. */}
          {days.length > 1 && <>
            <path d={fail} fill="none" stroke="var(--surface-1)" strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="round" />
            <path d={fail} fill="none" stroke={FAIL} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
          </>}
          {pk && pk[metric] > 0 && (() => {
            const { x: lx, anchor } = peakLabelAt(a, peak);
            // A wide halo, so the failed-calls line never strikes through the label.
            return <text x={lx} y={a.y(pk[metric]) - 7} textAnchor={anchor} fontSize="11" fontWeight="600" fill="var(--text-primary)"
              stroke="var(--surface-1)" strokeWidth="7" strokeLinejoin="round" paintOrder="stroke">Peak {plural(pk[metric], M.one)} · {dayLabel(pk.day)}</text>;
          })()}
          {at && <rect x={a.m.l + at.i * a.bw} width={a.bw} y={a.m.t} height={a.ih} fill="var(--text-primary)" opacity=".06" />}
          <rect className="hit" x={a.m.l} y={a.m.t} width={a.iw} height={a.ih} fill="transparent" style={{ cursor: "pointer" }}
            onPointerMove={onMove} onPointerLeave={() => setAt(null)} onClick={ev => pick(indexAt(ev.clientX))} />
        </svg>
        <div className="tip" ref={tip} role="tooltip" style={{ display: cur ? "block" : "none" }}>{cur && <>
          <div className="muted">{dayLabel(cur.day, true)}</div>
          {METRICS.map(x => <div key={x.k} className="row"><span>{x.k === metric && <i style={{ background: BAR }} />}{x.label}</span><b>{num(cur[x.k])}</b></div>)}
          <div className="row tot"><span><i style={{ background: FAIL }} />Failed tool calls</span><b>{num(cur.failed_calls)}</b></div>
        </>}</div>
      </div>
      <div className="sr" aria-live="polite">{cur ? `${dayLabel(cur.day, true)}: ${dayText(cur)}` : ""}</div>
    </section>
  );
}

/** A bar's name: its day, or the week it starts ("Week of Oct 5"); long: with the year. */
export const bucketLabel = (day: string, week: boolean, long = false) => (week ? `Week of ${dayLabel(day, long)}` : dayLabel(day, long));
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

/** The work chart in the payload's buckets, stacked by project, then prompts by weekday and hour. */
export function WorkPanel({ d, metric, onMetric, onDay }: WorkPanelProps) {
  useColors();
  const rows = useMemo(() => workBuckets(d), [d]);
  const kinds = workKinds(d, rows, metric);
  return <>
    <WorkBars rows={rows} week={d.work_bucket === "week"} kinds={kinds} stack={workStack(rows, d.work_projects, kinds, metric)}
      metric={metric} onMetric={onMetric} onDay={onDay} />
    <WorkHours cells={d.work_hours} />
  </>;
}

const MARGIN = { t: 22, r: 44, b: 26, l: 52 }; // room on the right for the rate axis

interface WorkBarsProps extends Omit<WorkPanelProps, "d"> {
  rows: DailyWorkRow[];
  week: boolean;
  /** The stacked projects, none for plain bars; stack: each bar's value per kind. */
  kinds: Kind[];
  stack: Record<string, number>[];
}

/** Work per day or week: the chosen count as bars (stacked by project when there are several), errors per 100 tool calls
 *  as a line against its own right-hand axis. */
function WorkBars({ rows, week, kinds, stack, metric, onMetric, onDay }: WorkBarsProps) {
  const box = useRef<HTMLDivElement>(null), tip = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null);
  const W = useWidth(box);
  const [at, setAt] = useState<{ i: number; x: number; y: number } | null>(null);
  useEffect(() => setAt(null), [rows, metric]);
  useLayoutEffect(() => {
    if (!at || !tip.current || !box.current) return;
    const p = tipAt(box.current, tip.current, at.x, at.y);
    tip.current.style.left = p.left + "px"; tip.current.style.top = p.top + "px";
  }, [at]);

  const M = METRICS.find(x => x.k === metric)!, unit = week ? "week" : "day";
  const a = dayAxis(W, H, rows.length, Math.max(...rows.map(p => p[metric]), 0), niceStep, MARGIN);
  // Week labels are longer, so fewer of them fit.
  const every = week ? Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor(a.iw / 100)))) : a.every;
  // The rate axis has as many steps as the count axis, so its ticks sit on the same grid lines.
  const rates = rows.map(failRate), n = Math.round(a.yMax / a.step);
  const rStep = niceStep((Math.max(...rates.map(r => r ?? 0), 0) * 1.08 || 1) / n), ry = (v: number) => a.m.t + a.ih - v / (rStep * n) * a.ih;
  const rDigits = Math.max(0, -Math.floor(Math.log10(rStep))); // a step of 0.5 reads "0.5", not "1"
  const line = rates.map((v, i) => (v == null ? "" : `${rates[i - 1] != null ? "L" : "M"}${a.cx(i).toFixed(1)},${ry(v).toFixed(1)}`)).join("");
  const lone = rates.flatMap((v, i) => (v != null && rates[i - 1] == null && rates[i + 1] == null ? [i] : [])); // no line reaches these
  const plain: Kind = { k: metric, label: M.label, c: BAR };
  // A bar's parts, bottom first; zero parts left out.
  const parts = (i: number): [Kind, number][] =>
    (kinds.length ? kinds.map((k): [Kind, number] => [k, stack[i]?.[k.k] ?? 0]) : [[plain, rows[i]![metric]] as [Kind, number]]).filter(([, v]) => v > 0);
  const peak = rows.reduce((b, p, i) => (p[metric] > rows[b]![metric] ? i : b), 0), pk = rows[peak];
  const indexAt = (clientX: number) => {
    const r = svg.current!.getBoundingClientRect(), px = (clientX - r.left) * W / r.width;
    return Math.max(0, Math.min(rows.length - 1, Math.floor((px - a.m.l) / a.bw)));
  };
  const pick = (i: number) => { const p = rows[i]; if (!week && p && busy(p)) { setAt(null); onDay(p.day); } };
  const onMove = (ev: PointerEvent) => setAt({ i: indexAt(ev.clientX), x: ev.clientX, y: ev.clientY });
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === "Enter" && at) { ev.preventDefault(); return pick(at.i); }
    const step = ({ ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity } as Record<string, number>)[ev.key];
    if (step == null || !rows.length) return;
    ev.preventDefault();
    const from = at?.i ?? (step > 0 ? -1 : rows.length); // first Right picks the first bar, first Left the last
    const i = Math.max(0, Math.min(rows.length - 1, from + step));
    const r = svg.current!.getBoundingClientRect(), s = r.width / W;
    setAt({ i, x: r.left + a.cx(i) * s, y: r.top + a.m.t * s + 20 });
  };
  const ticks: number[] = [];
  for (let v = 0; v <= n; v++) ticks.push(v);
  const cur = at ? rows[at.i] : undefined, curParts = at && kinds.length ? parts(at.i).reverse() : [];
  const what = `${M.label}${kinds.length ? " by project" : ""} and errors per 100 tool calls per ${unit}, ${plural(rows.length, unit)}`;
  const label = pk && pk[metric] > 0
    ? `${what}, ${M.label.toLowerCase()} peaking at ${num(pk[metric])} ${week ? "in the week of" : "on"} ${dayLabel(pk.day, true)}. `
      + (week ? "Use the left and right arrow keys to read each week. Choose a shorter range to pick a day." : "Use the left and right arrow keys to read each day and Enter to list its sessions.")
    : `${what}, no ${M.label.toLowerCase()} yet.`;

  return (
    <section className="panel sect work" id="work" aria-labelledby="workTitle">
      <div className="chart-head">
        <div><h2 id="workTitle">Work per {unit}</h2>
          <div className="hint">{M.label}{kinds.length ? " by project (the five with the most, the rest in Other)" : ""} per {week ? "week, from Monday" : "day"}, with
            errors per 100 tool calls against the right-hand axis. {week
              ? "Choose a shorter range to pick a day."
              : "Select a day to list its sessions; with the keyboard, focus the chart, use the arrow keys and press Enter."}</div></div>
        <div className="seg" role="group" aria-label="Chart metric">
          {METRICS.map(x => <button key={x.k} type="button" aria-pressed={x.k === metric} onClick={() => onMetric(x.k)}>{x.label}</button>)}
        </div>
      </div>
      <div className="legend" aria-hidden="true">
        {(kinds.length ? kinds : [plain]).map(k => <span key={k.k} className="key"><i style={{ background: k.c }} />{k.label}</span>)}
        <span className="key"><i className="line" style={{ borderTopColor: FAIL }} />Errors per 100 calls (right axis)</span>
      </div>
      <div className="chart" ref={box} tabIndex={0} role="img" aria-label={label} onKeyDown={onKey} onBlur={() => setAt(null)}>
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {ticks.map(t => <g key={t}><line x1={a.m.l} x2={W - a.m.r} y1={a.y(t * a.step)} y2={a.y(t * a.step)} stroke="var(--grid)" />
            <text x={a.m.l - 6} y={a.y(t * a.step) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">{num(t * a.step)}</text>
            <text x={W - a.m.r + 6} y={ry(t * rStep) + 4} fontSize="11" fill="var(--text-muted)">{num(t * rStep, rDigits)}</text></g>)}
          <text transform={`translate(${W - 6},${a.m.t + a.ih / 2}) rotate(90)`} textAnchor="middle" fontSize="11" fill="var(--text-muted)">Errors per 100 calls</text>
          {rows.map((p, i) => {
            const x = a.x(i), segs = parts(i);
            let base = 0;
            return <g key={p.day}>
              {i % every === 0 && <text x={x + a.w / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--text-muted)">{bucketLabel(p.day, week)}</text>}
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
          })}
          {/* The rate line, haloed in the surface color so it stays readable across the bars. */}
          <path d={line} fill="none" stroke="var(--surface-1)" strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="round" />
          <path className="rate" d={line} fill="none" stroke={FAIL} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
          {lone.map(i => <circle key={i} className="rate" cx={a.cx(i)} cy={ry(rates[i]!)} r="2.5" fill={FAIL} stroke="var(--surface-1)" strokeWidth="1.5" />)}
          {pk && pk[metric] > 0 && (() => {
            const { x: lx, anchor } = peakLabelAt(a, peak);
            // A wide halo, so the rate line never strikes through the label.
            return <text x={lx} y={a.y(pk[metric]) - 7} textAnchor={anchor} fontSize="11" fontWeight="600" fill="var(--text-primary)"
              stroke="var(--surface-1)" strokeWidth="7" strokeLinejoin="round" paintOrder="stroke">Peak {plural(pk[metric], M.one)} · {bucketLabel(pk.day, week)}</text>;
          })()}
          {at && <rect x={a.m.l + at.i * a.bw} width={a.bw} y={a.m.t} height={a.ih} fill="var(--text-primary)" opacity=".06" />}
          <rect className="hit" x={a.m.l} y={a.m.t} width={a.iw} height={a.ih} fill="transparent" style={week ? undefined : { cursor: "pointer" }}
            onPointerMove={onMove} onPointerLeave={() => setAt(null)} onClick={week ? undefined : ev => pick(indexAt(ev.clientX))} />
        </svg>
        <div className="tip" ref={tip} role="tooltip" style={{ display: cur ? "block" : "none" }}>{cur && <>
          <div className="muted">{bucketLabel(cur.day, week, true)}</div>
          {METRICS.map(x => <div key={x.k} className="row"><span>{x.k === metric && !kinds.length && <i style={{ background: BAR }} />}{x.label}</span><b>{num(cur[x.k])}</b></div>)}
          {curParts.length > 0 && <div className="parts">{curParts.map(([k, v]) =>
            <div key={k.k} className="row"><span><i style={{ background: k.c }} />{k.label}</span><b>{num(v)}</b></div>)}</div>}
          <div className="row tot"><span><i style={{ background: FAIL }} />Errors per 100 calls</span><b>{num(failRate(cur), 1)}</b></div>
          <div className="row"><span>Failed tool calls</span><b>{num(cur.failed_calls)}{cur.calls ? ` of ${num(cur.calls)}` : ""}</b></div>
        </>}</div>
      </div>
      <div className="sr" aria-live="polite">{cur ? `${bucketLabel(cur.day, week, true)}: ${bucketText(cur)}`
        + (curParts.length ? `. ${M.label} by project: ${curParts.map(([k, v]) => `${k.label} ${num(v)}`).join(", ")}` : "") : ""}</div>
    </section>
  );
}
