import type { UsagePayload } from "../../api";
import { useCountUp } from "../../components/chart";
import { agentName } from "../../components/Filters";
import { ProjectDot } from "../../components/ProjectDot";
import { big, dayLabel, num, plural, usd, usd0 } from "../../format";
import { compareText, money, periodCost, planText, thinHistory } from "./cost";

const span = (a: string, b: string) => `${dayLabel(a)} – ${dayLabel(b, true)}`;
const same = (v: number) => v;

/** The heading answers "what did this period cost, and how does that compare?": "$3,429 estimated cost · 17.8× the previous
 *  30 days", with the exact windows under it, each with its count of days with a prompt: a thin previous window explains
 *  a big multiple. */
export function Lede({ d, before }: { d: UsagePayload; before: UsagePayload | undefined }) {
  const t = d.totals, prev = d.previous, cmp = compareText(d), plan = planText(d);
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
    {t.requests > 0 && <p className="sub">{reach}, {big(t.tokens)} tokens in {num(t.requests)} requests. Cost is estimated at API list prices{d.unpriced.length ? " and leaves out unpriced models" : ""}.{d.run_rate && ` On pace for about ${usd0(d.run_rate.projected)} this month.`}{plan && <> {plan}</>}</p>}
  </>;
}
