import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { TrendWeek } from "../../../api";
import { textScale, tipAt, useWidth } from "../../../components/chart";
import { ChartTable, DataTable } from "../../../components/DataTable";
import { HowMeasured } from "../../../components/HowMeasured";
import { dayLabel, num, pct, plural } from "../../../format";
import { FEW_SESSIONS, FEW_TEXT, isFew, TREND_PARTS, trendCounts, trendText } from "./figures";

const H = 240, M = { t: 20, r: 8, b: 26, l: 40 }; // chart.css draws the plot 240px tall
const weekName = (w: TrendWeek, long = false) => `Week of ${dayLabel(w.week, long)}`;

/** The outcome mix per week of session start, as bars that each fill the plot (100%), stacked best outcome first, with the
 *  week's analysed sessions over each bar. A week with few sessions is drawn faint: its mix swings on one session. Shown from
 *  2 weeks. Read by pointer or with the arrow keys; the table below holds the same figures. */
export function OutcomeTrend({ weeks }: { weeks: TrendWeek[] }) {
  const box = useRef<HTMLDivElement>(null), tip = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null);
  const W = useWidth(box), ts = textScale();
  // The week read (an index) is state; the pointer's position is not, so a move inside one bar re-renders nothing.
  const [at, setAt] = useState<number | null>(null), pos = useRef({ x: 0, y: 0 });
  const place = () => {
    if (!tip.current || !box.current) return;
    const p = tipAt(box.current, tip.current, pos.current.x, pos.current.y);
    tip.current.style.left = p.left + "px"; tip.current.style.top = p.top + "px";
  };
  useEffect(() => setAt(null), [weeks]);
  useLayoutEffect(() => { if (at != null) place(); }, [at]);

  const m = { t: M.t * ts, r: M.r, b: M.b * ts, l: M.l * ts }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  const bw = iw / Math.max(1, weeks.length), gap = Math.min(6, bw * .25), w = Math.max(1, bw - gap);
  const x = (i: number) => m.l + i * bw + gap / 2, y = (share: number) => m.t + ih - share * ih;
  const every = Math.max(1, Math.ceil(weeks.length / Math.max(2, Math.floor(iw / (100 * ts)))));
  const few = weeks.some(isFew);
  const indexAt = (clientX: number) => {
    const r = svg.current!.getBoundingClientRect(), px = (clientX - r.left) * W / r.width;
    return Math.max(0, Math.min(weeks.length - 1, Math.floor((px - m.l) / bw)));
  };
  const onMove = (ev: PointerEvent) => {
    const i = indexAt(ev.clientX);
    pos.current = { x: ev.clientX, y: ev.clientY };
    if (i === at) place(); else setAt(i);
  };
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") return setAt(null);
    const step = ({ ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity } as Record<string, number>)[ev.key];
    if (step == null) return;
    ev.preventDefault();
    const from = at ?? (step > 0 ? -1 : weeks.length); // first Right reads the first week, first Left the last
    const i = Math.max(0, Math.min(weeks.length - 1, from + step));
    const r = svg.current!.getBoundingClientRect(), s = r.width / W;
    pos.current = { x: r.left + (x(i) + w / 2) * s, y: r.top + m.t * s + 20 };
    if (i === at) place(); else setAt(i);
  };
  // At most 26 weeks of five parts: cheap enough to draw again when the week read changes.
  const bars = weeks.map((wk, i) => {
    let base = 0;
    return <g key={wk.week} className={isFew(wk) ? "bar-seg few" : "bar-seg"} style={{ ["--i" as string]: Math.min(i, 60) }}>
      {trendCounts(wk).map((n, j) => {
        if (!n) return null;
        const share = n / wk.n, top = y(base + share), h = Math.max(0, share * ih - (base ? 2 : 0)); // 2px of surface between parts
        base += share;
        return <rect key={TREND_PARTS[j]!.k} x={x(i)} y={top} width={w} height={h} fill={TREND_PARTS[j]!.c} />;
      })}
      {/* The sample size: every bar is as tall as the next, so the count says how much each one stands on. */}
      <text x={x(i) + w / 2} y={m.t - 6 * ts} textAnchor="middle" fontSize={11 * ts} fill="var(--text-muted)">{num(wk.n)}</text>
      {i % every === 0 && <text x={x(i) + w / 2} y={H - 6 * ts} textAnchor="middle" fontSize={11 * ts} fill="var(--text-muted)">{dayLabel(wk.week)}</text>}
    </g>;
  });
  const cur = at != null ? weeks[at] : undefined;
  const total = weeks.reduce((n, wk) => n + wk.n, 0), achieved = weeks.reduce((n, wk) => n + wk.achieved, 0);
  const name = `Outcome mix per week of session start, ${plural(weeks.length, "week")}: ${pct(total ? achieved / total : 0)} of ${plural(total, "analysed session")} fully or mostly achieved. `
    + "Use the left and right arrow keys to read each week.";

  return (
    <section className="panel sect trend" id="trend" aria-labelledby="trendTitle">
      <h2 id="trendTitle">Outcome trend</h2>
      <p className="hint">Each week's analysed sessions by outcome, as shares of that week. The figure over a bar is its sessions.
        <HowMeasured what="the outcome trend">Weeks are by session start and begin on Monday. Every bar is 100% of its week, so a
          week of {FEW_SESSIONS - 1} sessions is as tall as a week of 40: read the figure over it. A week with fewer
          than {FEW_SESSIONS} sessions is drawn faint.</HowMeasured></p>
      <div className="legend" aria-hidden="true">
        {TREND_PARTS.map(p => <span key={p.k} className="key"><i style={{ background: p.c }} />{p.label}</span>)}
        {few && <span className="key"><i className="few" />{`Under ${FEW_SESSIONS} sessions`}</span>}
      </div>
      <div className="chart" ref={box} tabIndex={0} role="group" aria-label={name} onKeyDown={onKey} onBlur={() => setAt(null)}>
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {[0, .25, .5, .75, 1].map(t => <g key={t}><line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
            <text x={m.l - 6 * ts} y={y(t) + 4 * ts} textAnchor="end" fontSize={11 * ts} fill="var(--text-muted)">{pct(t)}</text></g>)}
          {bars}
          {at != null && <rect x={m.l + at * bw} width={bw} y={m.t} height={ih} fill="var(--text-primary)" opacity=".06" />}
          <rect x={m.l} y={m.t} width={iw} height={ih} fill="transparent" className="hit" onPointerMove={onMove} onPointerLeave={() => setAt(null)} />
        </svg>
        <div className="tip" ref={tip} role="tooltip" style={{ display: cur ? "block" : "none" }}>{cur && <>
          <div className="muted">{weekName(cur, true)}</div>
          {trendCounts(cur).map((n, j) => n > 0 && <div key={TREND_PARTS[j]!.k} className="row">
            <span><i style={{ background: TREND_PARTS[j]!.c }} />{TREND_PARTS[j]!.label}</span><b>{num(n)} · {pct(n / cur.n)}</b></div>)}
          <div className="row tot"><span>Analysed sessions</span><b>{num(cur.n)}</b></div>
          {isFew(cur) && <div className="muted">{FEW_TEXT}</div>}
        </>}</div>
      </div>
      <div className="sr" aria-live="polite">{cur ? `${weekName(cur, true)}: ${trendText(cur)}` : ""}</div>
      {/* The chart's text alternative: each week's sessions, and its count and share per outcome. */}
      <ChartTable><DataTable name="Analysed sessions by outcome per week" region="scroll tall">
        <thead><tr><th scope="col">Week</th><th scope="col" className="num">Sessions</th>
          {TREND_PARTS.map(p => <th key={p.k} scope="col" className="num">{p.label}</th>)}</tr></thead>
        <tbody>{weeks.map(wk => <tr key={wk.week}><th scope="row">{weekName(wk, true)}</th>
          <td className="num">{num(wk.n)}{isFew(wk) ? " (few)" : ""}</td>
          {trendCounts(wk).map((n, j) => <td key={TREND_PARTS[j]!.k} className="num">{num(n)} · {pct(wk.n ? n / wk.n : 0)}</td>)}</tr>)}</tbody>
      </DataTable></ChartTable>
    </section>
  );
}
