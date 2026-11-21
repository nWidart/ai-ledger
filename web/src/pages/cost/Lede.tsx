import type { UsagePayload } from "../../api";
import { useCountUp } from "../../components/chart";
import { agentName } from "../../components/Filters";
import { HowMeasured } from "../../components/HowMeasured";
import { ProjectDot } from "../../components/ProjectDot";
import { big, dayLabel, num, plural, usd } from "../../format";
import { agentNames, compareText, gaugeFigures, money, periodCost, thinHistory } from "./cost";

const span = (a: string, b: string) => `${dayLabel(a)} – ${dayLabel(b, true)}`;
const same = (v: number) => v;

/** The heading answers "what did this period cost, and how does that compare?" in two figures: "$3,429 estimated cost ·
 *  17.8× the previous 30 days". The line under it names the windows; "How measured" holds their days with a prompt (a thin
 *  previous window explains a big multiple), the view's reach and how the estimate and the gauge are computed. */
export function Lede({ d, before }: { d: UsagePayload; before: UsagePayload | undefined }) {
  const t = d.totals, prev = d.previous, cmp = compareText(d), g = gaugeFigures(d);
  // The figure counts up from the one shown before, so a range change reads as a change.
  const shown = useCountUp(t.cost ?? 0, before?.totals.cost ?? undefined, same);
  const where = d.project ? <> <span className="unit">on <span className="proj"><ProjectDot project={d.project} />{d.project}</span></span></> : null;
  const first = d.daily[0]?.day || d.end, since = d.range ? "" : ` since ${dayLabel(first, true)}`;
  const reach = d.project ? plural(t.sessions, "session") : `${plural(t.sessions, "session")} in ${plural(d.by_project.length, "project")}`;
  const thin = thinHistory(d);
  return <>
    <h1 className="lede" id="lede" aria-live="polite" tabIndex={-1}>{t.requests
      ? <><span className="amt">{usd(t.cost == null ? null : shown)}</span> <span className="unit">estimated cost</span>{where}{since}
        {cmp && <><span className="sr">, </span><span className="delta"><span aria-hidden="true">{cmp.text}</span><span className="sr">{cmp.sr}</span></span></>}</>
      : <>No {agentName(d.source)} usage{where} {d.range ? `in the last ${d.range} days` : "yet"}.</>}</h1>
    {t.requests > 0 && <p className="windows">{d.start
      ? <>{span(d.start, d.end)}{prev && <> <span className="muted">vs</span> {span(prev.start, prev.end)}</>}{thin && <> <span className="chip warn">thin history</span></>}</>
      : <>All time {span(first, d.end)}</>}
      <HowMeasured what="cost" docs="concepts/cost-estimates">
        {d.start ? <>
          <span className="tt-p">This period, {span(d.start, d.end)}: {num(t.active_days)} of {d.range} days with prompts.</span>
          {prev && <span className="tt-p">Previous period, {span(prev.start, prev.end)}: {money(periodCost(prev))}, {num(prev.active_days)} of {d.range} days with prompts.
            {thin && " It has prompts on fewer than half as many days, so older transcripts may be missing: read the change as \"more than before\"."}</span>}
        </> : <span className="tt-p">All time, {span(first, d.end)}: {plural(t.active_days, "day")} with prompts.</span>}
        <span className="tt-p">{reach}, {big(t.tokens)} tokens in {num(t.requests)} requests.</span>
        <span className="tt-p">Cost is estimated at API list prices{d.unpriced.length ? " and leaves out unpriced models" : ""}. It is not a bill.</span>
        {g && <span className="tt-p">The month's pace is its cost so far, to yesterday, plus the mean daily cost of the last 7 complete days times the {plural(d.run_rate!.days_left, "day")} left.
          It follows the project, agent and automated filters, not the range.</span>}
        {g?.plan && <span className="tt-p">The plan multiple divides the pace by the plans' monthly price{g.counted ? `, counting ${agentNames(g.counted)} use only, since no plan is known for the other agents` : ""}.</span>}
      </HowMeasured></p>}
  </>;
}
