import type { UsagePayload } from "../../api";
import { mult, usd0 } from "../../format";
import { agentNames, gaugeFigures } from "./cost";

/** The month against the plan: a bullet bar of the cost so far (solid) and the pace projection (light), a tick at the plan's
 *  monthly price, and the pace as a multiple of it. Without a plan: the cost so far and the pace only. Every figure is also
 *  text; the bar is a picture of them. None without a run rate. */
export function PlanGauge({ d }: { d: UsagePayload }) {
  const g = gaugeFigures(d);
  if (!g) return null;
  const top = Math.max(g.pace, g.now, g.plan?.monthly ?? 0) * 1.04 || 1, at = (v: number) => `${Math.min(100, v / top * 100)}%`;
  return (
    <figure className="gauge" aria-labelledby="gaugeTitle">
      <div className="g-head">
        <span id="gaugeTitle" className="g-title">{g.plan ? <>This month vs plan <span className="g-plan">({usd0(g.plan.monthly)}/mo, {g.plan.labels.join(" + ")})</span></> : "This month's pace"}</span>
        {g.plan && <b className="g-badge">{mult(g.plan.multiple)} plan</b>}
      </div>
      <div className="g-bar" aria-hidden="true">
        <i className="g-pace" style={{ width: at(g.pace) }} /><i className="g-now" style={{ width: at(g.now) }} />
        {g.plan && <i className="g-tick" style={{ left: at(g.plan.monthly) }} />}
      </div>
      <figcaption className="g-legend">
        <span><i className="g-key now" aria-hidden="true" /><b>{usd0(g.now)}</b> so far</span>
        <span><i className="g-key pace" aria-hidden="true" />on pace for <b>~{usd0(g.pace)}</b></span>
        {g.plan && <span><i className="g-key tick" aria-hidden="true" />plan <b>{usd0(g.plan.monthly)}</b></span>}
        {g.counted && <span className="g-note">{agentNames(g.counted)} use only</span>}
      </figcaption>
    </figure>
  );
}
