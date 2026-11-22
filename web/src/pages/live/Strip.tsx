import type { LiveSession, LiveState } from "../../api";
import { Toggletip } from "../../components/Toggletip";
import { big, num, pct, plural, usd } from "../../format";
import { INFERRED_WHY, stateText } from "./live";
import { Pulse } from "./Pulse";

/** The near-full line, as the session sheet's (metrics.NEAR_LIMIT). */
export const NEAR_FULL = 0.8;

/** A state's tag, with its detail as hover text; plain: the page shows the detail beside it, so no hover text. why: an
 *  inferred state's "(inferred)" is a toggletip that gives the reason, for where the page shows it nowhere else. quiet:
 *  "(inferred)" is for screen readers only, where the tag has no room for it. */
export function StateTag({ st, now, plain, why, quiet }: { st: LiveState; now: number; plain?: boolean; why?: boolean; quiet?: boolean }) {
  const t = stateText(st, now), reason = st.inferred ? INFERRED_WHY[st.kind] : undefined;
  return <span className={"state st-" + st.kind} title={plain ? undefined : reason ?? t.detail}>
    <i aria-hidden="true" />{t.label}{st.inferred && (why && reason
      ? <> <Toggletip label="(inferred)" name="Why inferred" className="inf">{reason}</Toggletip></>
      : quiet ? <>{" "}<span className="sr">(inferred)</span></> : <span className="inf"> (inferred)</span>)}</span>;
}

/** The selected session in one strip above its stream, about this conversation only. A head row: its state with the
 *  detail, then its figures. Under it two equal columns: its context window, with a mark at each compaction, and its
 *  pulse of the last 10 minutes. The columns stack on a narrow screen and in a pinned stream on the Wall. */
export function Strip({ s, st, now }: { s: LiveSession; st: LiveState; now: number }) {
  const t = stateText(st, now), share = s.context != null && s.window ? s.context / s.window : null;
  const packed = s.compactions.filter(c => c.pre), n = s.compactions.length;
  return <div className="strip" role="group" aria-label="Session status">
    <div className="head">
      <span className={"it now" + (st.kind === "wait" ? " warn" : st.kind === "ended" ? " ended" : "")}><StateTag st={st} now={now} plain why />
        <span className="muted det">{t.detail}</span></span>
      <span className="figs">
        <span className="it"><span className="k">Cost</span> <b>{usd(s.cost)}</b></span>
        <span className="it"><span className="k">Tools</span> <b>{num(s.tools)}</b></span>
        <span className="it"><span className="k">Errors</span> <b className={s.errors ? "bad" : undefined}>{num(s.errors)}</b></span>
        <span className="it"><span className="k">Cache read</span> <b>{pct(s.cache_read)}</b>
          <Toggletip term="cache read">The share of this session's prompt tokens read from the prompt cache, at a fraction of the input price.</Toggletip></span>
      </span>
    </div>
    <div className="col ctx">
      <span className="it"><span className="k">Context</span> {share != null
        ? <span><b>{big(s.context)}</b> / {big(s.window)} · {pct(share)}</span>
        : <span><b>{s.context != null ? big(s.context) : "–"}</b> tokens · window not known for {s.model ?? "this model"}</span>}
        {n > 0 && <> <span className="muted">· {plural(n, "compaction")}
          {packed.length > 0 && <span className="sr">, at {packed.map(c => big(c.pre)).join(", ")} tokens</span>}</span></>}</span>
      {share != null && <span className={"meter" + (share > NEAR_FULL ? " warn" : "")} role="meter" aria-label="Context used" aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={Math.round(share * 100)}>
        <i style={{ width: `${Math.min(100, share * 100)}%` }} />
        {packed.map((c, i) => <span key={i} className="mark" aria-hidden="true" title={`compacted at ${big(c.pre)} tokens`}
          style={{ left: `${Math.min(100, (c.pre! / s.window!) * 100)}%` }} />)}
      </span>}
    </div>
    <div className="col">
      <span className="k" aria-hidden="true">Last 10 min</span>
      <Pulse p={s.pulse} />
    </div>
  </div>;
}
