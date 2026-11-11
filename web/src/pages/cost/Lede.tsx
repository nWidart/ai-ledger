import type { UsagePayload } from "../../api";
import { useCountUp } from "../../components/chart";
import { agentName } from "../../components/Filters";
import { ProjectDot } from "../../components/ProjectDot";
import { big, dayLabel, num, plural, usd } from "../../format";
import { compareText, money, periodCost, sparkPoints, thinHistory } from "./cost";

const span = (a: string, b: string) => `${dayLabel(a)} – ${dayLabel(b, true)}`;
const same = (v: number) => v;

/** The heading answers "what did this period cost, and how does that compare?": "$3,429 estimated cost · 17.8× the previous
 *  30 days", with the exact windows under it, each with its count of days with a prompt: a thin previous window explains
 *  a big multiple. */
export function Lede({ d, before }: { d: UsagePayload; before: UsagePayload | undefined }) {
  const t = d.totals, prev = d.previous, cmp = compareText(d);
  // The figure counts up from the one shown before, so a range change reads as a change.
  const shown = useCountUp(t.cost ?? 0, before?.totals.cost ?? undefined, same);
  const where = d.project ? <> <span className="unit">on <span className="proj"><ProjectDot project={d.project} />{d.project}</span></span></> : null;
  const first = d.daily[0]?.day || d.end, since = d.range ? "" : ` since ${dayLabel(first, true)}`;
  const reach = d.project ? plural(t.sessions, "session") : `${plural(t.sessions, "session")} in ${plural(d.by_project.length, "project")}`;
  return <>
    <h1 className="lede" id="lede" aria-live="polite" tabIndex={-1}>{t.requests
      ? <><span className="amt">{usd(t.cost == null ? null : shown)}</span> <span className="unit">estimated cost</span>{where}{since}
        {cmp && <><span className="sr">, </span><span className="delta"><span aria-hidden="true">{cmp.text}</span><span className="sr">{cmp.sr}</span></span></>}</>
      : <>No {agentName(d.source)} usage{where} {d.range ? `in the last ${d.range} days` : "yet"}.</>}</h1>
    {t.requests > 0 && <p className="windows">{d.start
      ? <><span>This period <b>{span(d.start, d.end)}</b> · {num(t.active_days)} of {d.range} days with prompts</span>
        {prev && <span>Previous <b>{span(prev.start, prev.end)}</b> · {money(periodCost(prev))} · {num(prev.active_days)} of {d.range} days with prompts
          {thinHistory(d) && <> <span className="chip warn">thin history</span></>}</span>}</>
      : <span>All time <b>{span(first, d.end)}</b> · {plural(t.active_days, "day")} with prompts</span>}</p>}
    {t.requests > 0 && <p className="sub">{reach}, {big(t.tokens)} tokens in {num(t.requests)} requests. Cost is estimated at API list prices{d.unpriced.length ? " and leaves out unpriced models" : ""}.</p>}
  </>;
}

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
