import { useRef } from "react";
import type { LimitWindow, PlanChange } from "../../api";
import { useWidth } from "../../components/chart";
import { caption, planName, whenDay } from "./limits";

const H = 168, M = { t: 12, r: 10, b: 24, l: 36 }, DOT_GAP = 7;

/** The plan changes that fall inside a window. */
export const planMarks = (w: LimitWindow, events: PlanChange[]) =>
  events.filter(e => e.provider === w.provider && Date.parse(e.at) >= Date.parse(w.start) && Date.parse(e.at) <= Date.parse(w.resets_at));

/** One window from its start to its reset: the percent used so far (estimates dotted, measured snapshots as dots and a
 *  solid line), the forecast with its band, the 100% line, now, and plan changes inside the window. */
export function LimitChart({ w, now, events }: { w: LimitWindow; now: string; events: PlanChange[] }) {
  const box = useRef<HTMLDivElement>(null), W = useWidth(box, 420);
  const t0 = Date.parse(w.start), t1 = Date.parse(w.resets_at), iw = W - M.l - M.r, ih = H - M.t - M.b;
  const x = (t: string) => M.l + Math.min(1, Math.max(0, (Date.parse(t) - t0) / (t1 - t0 || 1))) * iw;
  const y = (p: number) => M.t + ih * (1 - Math.min(100, Math.max(0, p)) / 100);
  const path = (pts: { t: string; v: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const est = path(w.series.map(p => ({ t: p.t, v: p.pct })));
  const measured = w.series.filter(p => p.measured);
  // Readings every few minutes would merge into a thick dotted line over the measured one: keep a dot every DOT_GAP px.
  let lastX = -Infinity;
  const dots = measured.filter(p => x(p.t) - lastX >= DOT_GAP && (lastX = x(p.t), true));
  const f = w.forecast;
  const band = f && `${path(f.curve.map(p => ({ t: p.t, v: p.hi })))}L${f.curve.slice().reverse().map(p => `${x(p.t).toFixed(1)},${y(p.lo).toFixed(1)}`).join("L")}Z`;
  // The page's one time format; a narrow chart keeps the date of a long window, or the time of a short one.
  const at = W >= 360 ? whenDay : (w.window_minutes ?? 0) >= 1440
    ? (t: string) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : (t: string) => new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const marks = planMarks(w, events), said = (e: PlanChange) => `Plan change from ${e.plan_from} to ${e.plan_to}, ${whenDay(e.at)}`;
  return (
    <div className="lim-chart" ref={box}>
      <svg width={W} height={H} role="img"
        aria-label={[`${w.provider_label} ${w.label}: ${w.current ?? "–"}% used. ${caption(w)}.`, ...marks.map(e => `${said(e)}.`)].join(" ")}>
        {[0, 50, 100].map(p => <g key={p}>
          <line x1={M.l} x2={W - M.r} y1={y(p)} y2={y(p)} className={p === 100 ? "cap" : "grid"} />
          <text x={M.l - 6} y={y(p) + 4} textAnchor="end" className="ax">{p}%</text>
        </g>)}
        {band && <path d={band} className="band" />}
        {f && <path d={path(f.curve.map(p => ({ t: p.t, v: p.mid })))} className="fc" />}
        {est && <path d={est} className="est" />}
        {measured.length > 1 && <path d={path(measured.map(p => ({ t: p.t, v: p.pct })))} className="meas" />}
        {dots.map(p => <circle key={p.t} cx={x(p.t)} cy={y(p.pct)} r={2.6} className="dot" />)}
        {marks.map(e => <g key={e.at} className="plan"><title>{said(e)}</title>
          <line x1={x(e.at)} x2={x(e.at)} y1={M.t} y2={M.t + ih} />
          <line x1={x(e.at)} x2={x(e.at)} y1={M.t} y2={M.t + ih} className="hit" />
          <text x={x(e.at) + (x(e.at) > W / 2 ? -4 : 4)} y={M.t + 10} textAnchor={x(e.at) > W / 2 ? "end" : "start"}>{`plan: ${planName(e.plan_to)}`}</text></g>)}
        <line x1={x(now)} x2={x(now)} y1={M.t} y2={M.t + ih} className="now" />
        <text x={M.l} y={H - 6} className="ax">{at(w.start)}</text>
        <text x={W - M.r} y={H - 6} textAnchor="end" className="ax">resets {at(w.resets_at)}</text>
      </svg>
    </div>
  );
}
