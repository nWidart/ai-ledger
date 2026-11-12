import type { SessionInsight as Insight, View } from "../../api";
import { Judged, label, outcomeLabel, outcomeTone } from "../facets";
import { appLink, insightsHref } from "./session";

/** A session's /insights judgment beside its measured figures: the model's outcome, ratings, categories and words, tagged
 *  model-judged, with a link to the Insights page in the view. */
export function SessionInsight({ i, view }: { i: Insight; view: View }) {
  const rating = (name: string, v: string | null) => v && <span>{name} <b title={v}>{label(v)}</b></span>;
  return <>
    <h3>/insights judgment <Judged /></h3>
    <div className="insight">
      <div className="insight-line">
        <span className={"badge " + outcomeTone(i.outcome)} title={i.outcome ?? undefined}>{outcomeLabel(i.outcome)}</span>
        {i.satisfaction.includes("dissatisfied") && <span className="dis">dissatisfied</span>}
        {rating("helpfulness", i.helpfulness)}{rating("session type", i.session_type)}
      </div>
      {(i.goals.length > 0 || i.friction.length > 0) && <div className="insight-chips">
        {i.goals.map(g => <span key={g} className="chip" title={g}>{label(g)}</span>)}
        {i.friction.map(f => <span key={f} className="chip warn" title={f}>{label(f)}</span>)}</div>}
      {i.brief_summary && <p>{i.brief_summary}</p>}
      {i.friction_detail && <p><b>Friction:</b> {i.friction_detail}</p>}
      <a href={insightsHref(view)} onClick={appLink}>Open in Insights</a>
    </div>
  </>;
}
