import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { ContextPayload } from "../../api";
import { useWidth } from "../../components/chart";
import { ChartTable, DataTable } from "../../components/DataTable";
import { dayLabel, niceStep, num, plural } from "../../format";
import { short, START_LARGE_TOKENS, TREND_MIN_SESSIONS } from "./context";
import "./StartTrend.css";

type Trend = ContextPayload["starting"]["trend"];
type Week = Trend[number];
const H = 180, M = { t: 10, r: 14, b: 26, l: 52 };

/** What the chart reads at a week, in words: "Week of Nov 2: median 24k tokens (25th to 75th percentile 20k to 31k), 9 sessions". */
export const readWeek = (w: Week) =>
  `Week of ${dayLabel(w.week)}: median ${short(w.median)} tokens (25th to 75th percentile ${short(w.p25)} to ${short(w.p75)}), ${plural(w.sessions, "session")}`
  + (w.sessions < TREND_MIN_SESSIONS ? ", which rests on few sessions" : "");

/** The view's median starting context per week of session start with its 25th to 75th percentile band. Weeks sit by date, so a week
 *  with no session is a gap in the spacing; a week under TREND_MIN_SESSIONS sessions is drawn as a hollow, faded dot. */
export function StartTrend({ trend }: { trend: Trend }) {
  const box = useRef<HTMLDivElement>(null), W = useWidth(box);
  const [at, setAt] = useState<number | null>(null);
  if (!trend.length) return null;
  const first = trend[0]!, last = trend[trend.length - 1]!, t0 = Date.parse(first.week + "T00:00:00Z"), span = Date.parse(last.week + "T00:00:00Z") - t0;
  const iw = W - M.l - M.r, ih = H - M.t - M.b;
  const xs = trend.map(w => span ? M.l + (Date.parse(w.week + "T00:00:00Z") - t0) / span * iw : M.l + iw / 2);
  const top = Math.max(...trend.map(w => w.p75), ...trend.map(w => w.median), 1) * 1.08;
  const step = niceStep(top / 3), yMax = Math.ceil(top / step) * step, y = (v: number) => M.t + ih - v / yMax * ih;
  const yTicks: number[] = [];
  for (let v = 0; v <= yMax + 1e-9; v += step) yTicks.push(v);
  const f = (v: number) => v.toFixed(1);
  const line = trend.map((w, i) => `${i ? "L" : "M"}${f(xs[i]!)},${f(y(w.median))}`).join("");
  const band = `${trend.map((w, i) => `${i ? "L" : "M"}${f(xs[i]!)},${f(y(w.p75))}`).join("")}${trend.map((_, i) => `L${f(xs[trend.length - 1 - i]!)},${f(y(trend[trend.length - 1 - i]!.p25))}`).join("")}Z`;
  // Label weeks left to right, skipping any whose label would sit within 64px of the last one drawn.
  const ticks: number[] = [];
  xs.forEach((x, i) => { if (!ticks.length || x - xs[ticks[ticks.length - 1]!]! >= 64) ticks.push(i); });

  const cur = at == null ? null : trend[at]!;
  const label = (trend.length > 1
    ? `Median starting context per week: ${short(first.median)} tokens the week of ${dayLabel(first.week)}, ${short(last.median)} the week of ${dayLabel(last.week)}. `
    : `Median starting context, the only week: ${short(first.median)} tokens the week of ${dayLabel(first.week)}. `)
    + `The band shows the 25th to 75th percentile. Use the left and right arrow keys to read each week, Escape to dismiss it.`;
  const near = (ev: PointerEvent) => {
    const r = ev.currentTarget.getBoundingClientRect(), px = M.l + (ev.clientX - r.left) * iw / r.width;
    let best = 0;
    xs.forEach((x, i) => { if (Math.abs(x - px) < Math.abs(xs[best]! - px)) best = i; });
    return best;
  };
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") return setAt(null);
    const d = ({ ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity } as Record<string, number>)[ev.key];
    if (d == null) return;
    ev.preventDefault();
    setAt(Math.max(0, Math.min(trend.length - 1, (at ?? (d > 0 ? -1 : trend.length)) + d)));
  };

  return (
    <div className="start-trend">
      <div className="legend">
        <span className="key"><i className="line" />Median start</span>
        <span className="key"><i className="band" />25th to 75th percentile</span>
        <span className="key muted">hollow dot: fewer than {TREND_MIN_SESSIONS} sessions</span>
      </div>
      <div className="chart" ref={box} tabIndex={0} role="group" aria-label={label} onKeyDown={onKey} onBlur={() => setAt(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {yTicks.map(v => <g key={v}><line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
            <text x={M.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">{short(v)}</text></g>)}
          {ticks.map(i => <text key={trend[i]!.week} x={xs[i]} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--text-muted)">{dayLabel(trend[i]!.week)}</text>)}
          {START_LARGE_TOKENS <= yMax && <g className="threshold"><line x1={M.l} x2={W - M.r} y1={y(START_LARGE_TOKENS)} y2={y(START_LARGE_TOKENS)} stroke="var(--text-muted)" strokeDasharray="4 3" />
            <text x={W - M.r} y={y(START_LARGE_TOKENS) - 4} textAnchor="end" fontSize="10.5" fill="var(--text-muted)">{short(START_LARGE_TOKENS)}</text></g>}
          {trend.length > 1 && <>
            <path className="band" d={band} fill="var(--text-secondary)" opacity=".16" stroke="none" />
            <path className="trend-line" d={line} fill="none" stroke="var(--surface-1)" strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="round" />
            <path className="trend-line" d={line} fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </>}
          {trend.map((w, i) => w.sessions < TREND_MIN_SESSIONS
            ? <circle key={w.week} className="dot few" cx={xs[i]} cy={y(w.median)} r="3.5" fill="var(--surface-1)" stroke="var(--text-primary)" strokeWidth="1.5" opacity=".6" />
            : <circle key={w.week} className="dot" cx={xs[i]} cy={y(w.median)} r="3" fill="var(--text-primary)" stroke="var(--surface-1)" strokeWidth="1.5" />)}
          {cur && <><line x1={xs[at!]} x2={xs[at!]} y1={M.t} y2={M.t + ih} stroke="var(--text-muted)" strokeDasharray="3 3" />
            <circle cx={xs[at!]} cy={y(cur.median)} r="5" fill="none" stroke="var(--text-primary)" strokeWidth="1.5" /></>}
          <rect x={M.l} y={M.t} width={iw} height={ih} fill="transparent" onPointerMove={ev => setAt(near(ev))} onPointerLeave={() => setAt(null)} />
        </svg>
      </div>
      <div className="readout" aria-live="polite">{cur ? readWeek(cur) : ""}</div>
      <ChartTable><DataTable name="Median starting context per week of session start">
        <thead><tr><th scope="col">Week of</th><th scope="col" className="num">Median</th><th scope="col" className="num">25th percentile</th><th scope="col" className="num">75th percentile</th><th scope="col" className="num">Sessions</th></tr></thead>
        <tbody>{trend.map(w => <tr key={w.week}><th scope="row">{dayLabel(w.week, true)}</th><td className="num">{short(w.median)}</td><td className="num">{short(w.p25)}</td><td className="num">{short(w.p75)}</td><td className="num">{num(w.sessions)}</td></tr>)}</tbody>
      </DataTable></ChartTable>
    </div>
  );
}
