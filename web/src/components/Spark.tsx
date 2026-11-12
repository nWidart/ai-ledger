import type { UsagePayload } from "../api";
import { money, periodCost, sparkPoints } from "../pages/cost/cost";
import { dayLabel, usd } from "../format";

/** Daily cost across twice the range: the previous period dashed, then this one in ink, split by a tick. */
export function Spark({ d }: { d: UsagePayload }) {
  const sp = d.totals.requests ? sparkPoints(d) : null;
  if (!sp) return null;
  const { pts, split } = sp, prev = d.previous;
  const W = 240, H = 48, max = Math.max(...pts.map(p => p.v)) || 1;
  const x = (i: number) => i / (pts.length - 1) * W, y = (v: number) => H - 2 - v / max * (H - 6);
  const line = (a: number, b: number) => pts.slice(a, b).map((p, j) => `${j ? "L" : "M"}${x(a + j).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const area = (a: number, b: number) => `${line(a, b)}L${x(b - 1).toFixed(1)},${H}L${x(a).toFixed(1)},${H}Z`;
  const first = pts[0]!.k;
  return (
    <figure className="spark" role="img" aria-label={prev
      ? `Daily cost sparkline: previous ${d.range} days ${money(periodCost(prev))}, last ${d.range} days ${usd(d.totals.cost)}.`
      : `Daily cost sparkline since ${dayLabel(first, true)}.`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        {prev && <>
          <path d={line(0, split + 1)} fill="none" stroke="var(--text-muted)" strokeWidth="1.25" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
          <line x1={x(split)} x2={x(split)} y1="0" y2={H} stroke="var(--border)" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
        </>}
        <path d={area(split, pts.length)} fill="var(--track)" />
        <path d={line(split, pts.length)} fill="none" stroke="var(--text-primary)" strokeWidth="1.75" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption aria-hidden="true">{prev
        ? <><span>Previous {d.range}d <b>{money(periodCost(prev))}</b></span><span>Last {d.range}d <b>{usd(d.totals.cost)}</b></span></>
        : <><span>{dayLabel(first)}</span><span>Daily cost</span><span>{dayLabel(d.end)}</span></>}</figcaption>
    </figure>
  );
}
