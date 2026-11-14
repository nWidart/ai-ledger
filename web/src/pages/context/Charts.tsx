// Two small charts: the weekly trend of the median start, and the peak fill of sessions by window size.
import type { ContextPayload } from "../../api";
import { dayLabel, num, pct, plural } from "../../format";
import { FILL_LABELS, short, windowLabel } from "./context";

/** The median starting context per week of session start, as bars; the figure reads its own text for a screen reader. */
export function StartTrend({ trend }: { trend: ContextPayload["starting"]["trend"] }) {
  if (!trend.length) return null;
  const W = 520, H = 96, m = { t: 14, b: 18, l: 0 }, max = Math.max(...trend.map(t => t.median)) || 1, ih = H - m.t - m.b;
  const bw = W / trend.length, w = Math.min(36, bw * .7), first = trend[0]!, lastW = trend[trend.length - 1]!;
  return (
    <figure className="trend" role="img" aria-label={`Median starting context per week: ${short(first.median)} tokens the week of ${dayLabel(first.week, true)}`
      + (trend.length > 1 ? `, ${short(lastW.median)} the week of ${dayLabel(lastW.week, true)}` : "") + `, over ${plural(trend.length, "week")} with sessions.`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        {trend.map((t, i) => {
          const h = Math.max(2, t.median / max * ih), x = i * bw + (bw - w) / 2;
          return <g key={t.week}><title>{`Week of ${dayLabel(t.week, true)}: median ${num(t.median)} tokens, ${plural(t.sessions, "session")}`}</title>
            <rect x={x} y={m.t + ih - h} width={w} height={h} rx="2" fill="var(--text-secondary)" opacity={.55 + .45 * t.median / max} />
            <text x={x + w / 2} y={m.t + ih - h - 3} textAnchor="middle" fontSize="10.5" fill="var(--text-secondary)">{short(t.median)}</text></g>;
        })}
      </svg>
      <figcaption aria-hidden="true"><span>Week of {dayLabel(first.week)}</span><span>Median start per week of session start</span>{trend.length > 1 && <span>{dayLabel(lastW.week)}</span>}</figcaption>
    </figure>
  );
}

const TONE = ["var(--text-muted)", "var(--text-muted)", "var(--text-muted)", "var(--warning)", "var(--critical)"];

/** Per window size, how many sessions peaked in each fifth of it: one row of five bars. Counts add up to the window's sessions. */
export function FillBars({ fill }: { fill: ContextPayload["growth"]["fill"] }) {
  return (
    <div className="fills">{fill.map(f => {
      const max = Math.max(...f.bins, 1);
      return <div key={f.window} className="fill" role="group" aria-label={`${windowLabel(f.window)} window, ${plural(f.sessions, "session")}`}>
        <div className="fw"><b>{windowLabel(f.window)}</b> window<span className="muted"> · {plural(f.sessions, "session")}</span></div>
        <ol className="bins">{f.bins.map((n, i) => <li key={i} title={`${plural(n, "session")} (${pct(f.sessions ? n / f.sessions : 0)}) peaked at ${FILL_LABELS[i]} of the window`}>
          <b>{num(n)}</b><span className="bar" aria-hidden="true"><i style={{ height: `${n ? Math.max(6, n / max * 100) : 0}%`, background: TONE[i] }} /></span>
          <span className="l">{FILL_LABELS[i]}</span></li>)}</ol>
      </div>;
    })}</div>
  );
}
