import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { DailyWorkRow } from "../../api";
import { dayLabel, niceStep, num, plural } from "../../format";
import { dayAxis, peakLabelAt, tipAt, useWidth } from "../../components/chart";
import { busy, METRICS, type WorkMetric } from "./work";

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
            return <text x={lx} y={a.y(pk[metric]) - 7} textAnchor={anchor} fontSize="11" fontWeight="600" fill="var(--text-primary)"
              stroke="var(--surface-1)" strokeWidth="3" paintOrder="stroke">Peak {plural(pk[metric], M.one)} · {dayLabel(pk.day)}</text>;
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
