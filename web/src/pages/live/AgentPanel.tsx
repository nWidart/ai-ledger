import type { LiveSession, LiveState } from "../../api";
import { big, num, pct, plural, usd, when } from "../../format";
import { INFERRED_WHY, stateText } from "./live";

/** The near-full line, as the session sheet's (metrics.NEAR_LIMIT). */
export const NEAR_FULL = 0.8;

export function StateTag({ st, now }: { st: LiveState; now: number }) {
  const t = stateText(st, now);
  return <span className={"state st-" + st.kind} title={st.inferred ? INFERRED_WHY[st.kind] : t.detail}>
    <i aria-hidden="true" />{t.label}{st.inferred && <span className="inf"> (inferred)</span>}</span>;
}

function Spark({ points }: { points: number[] }) {
  const w = 260, h = 44, max = Math.max(1, ...points), step = w / Math.max(1, points.length - 1);
  const pts = points.map((v, i) => `${(i * step).toFixed(1)},${(h - 2 - (v / max) * (h - 6)).toFixed(1)}`);
  return <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
    <path className="a" d={`M${pts.join("L")}L${w},${h}L0,${h}Z`} /><path className="l" d={`M${pts.join("L")}`} />
  </svg>;
}

/** The selected session from the agent's side: what it does now, its context window, its figures, tokens over the last
 *  minute and its source's plan limits. The Errors count is the stream's failed-calls filter (failedOnly), as in the
 *  stream's own bar. */
export function AgentPanel({ s, st, now, failedOnly, setFailedOnly }: {
  s: LiveSession; st: LiveState; now: number; failedOnly: boolean; setFailedOnly: (on: boolean) => void;
}) {
  const t = stateText(st, now), share = s.context != null && s.window ? s.context / s.window : null;
  return <aside className="panel head" aria-label="Agent">
    <section className="sec"><h2>Doing now</h2>
      <div className={"now" + (st.kind === "wait" ? " warn" : st.kind === "ended" ? " ended" : "")}><StateTag st={st} now={now} /><div className="muted">{t.detail}</div>
        {st.inferred && <div className="why">{INFERRED_WHY[st.kind]}</div>}</div>
    </section>
    <section className="sec" aria-label="Context window"><h2>Context window</h2>
      <div className="big">{s.context != null ? big(s.context) : "–"}{s.window ? <span className="of"> / {big(s.window)}</span> : null}</div>
      {share != null && <>
        <div className={"meter" + (share > NEAR_FULL ? " warn" : "")} role="meter" aria-label="Context used" aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={Math.round(share * 100)}>
          <i style={{ width: `${Math.min(100, share * 100)}%` }} />
          {s.compactions.filter(c => c.pre).map((c, i) => <span key={i} className="mark" title={`compacted at ${big(c.pre)} tokens`}
            style={{ left: `${Math.min(100, (c.pre! / s.window!) * 100)}%` }} />)}
        </div>
        <div className="row"><span>{pct(share)} used</span><span>{s.compactions.length} compaction{s.compactions.length === 1 ? "" : "s"}</span></div>
      </>}
      {share == null && <div className="row"><span>window not known for {s.model ?? "this model"}</span><span>{s.compactions.length} compactions</span></div>}
    </section>
    <section className="sec" aria-label="This session"><h2>This session</h2>
      <div className="kv">
        <div><span>Cost</span><b>{usd(s.cost)}</b></div><div><span>Requests</span><b>{num(s.requests)}</b></div>
        <div><span>Tool calls</span><b>{num(s.tools)}</b></div><div><span>Errors</span><button type="button" className={"fig" + (s.errors ? " bad" : "")} aria-pressed={failedOnly} aria-label={plural(s.errors, "error")}
          title="Show failed calls only" onClick={() => setFailedOnly(!failedOnly)}>{num(s.errors)}</button></div>
        <div><span>Cache read</span><b>{pct(s.cache_read)}</b></div><div><span>Model</span><b className="model">{s.model ?? "–"}</b></div>
      </div>
    </section>
    <section className="sec" aria-label="Tokens"><h2>Tokens · last minute, cache reads included</h2>
      <div className="row"><span>{big(s.spark.per_minute)} / min</span></div><Spark points={s.spark.points} />
    </section>
    {s.limits.length > 0 && <section className="sec" aria-label="Plan limits"><h2>Plan limits</h2>
      {s.limits.map(l => <div key={l.label} className="limit">
        <div className={"meter" + (l.used_percent > NEAR_FULL * 100 ? " warn" : "")}><i style={{ width: `${Math.min(100, l.used_percent)}%` }} /></div>
        <div className="row"><span>{l.label} · {num(l.used_percent)}%</span><span>{l.resets_at ? `resets ${when(l.resets_at)}` : ""}</span></div>
      </div>)}
    </section>}
  </aside>;
}
