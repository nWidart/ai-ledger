import { useEffect, useId, useRef, useState } from "react";
import type { LiveSession, LiveState } from "../../api";
import { copyText } from "../../components/export";
import { resumeCommand } from "../../components/menu/resume";
import { Toggletip } from "../../components/Toggletip";
import { big, num, pct, plural, usd, when } from "../../format";
import { INFERRED_WHY, stateText } from "./live";
import { Pulse } from "./Pulse";

/** The near-full line, as the session sheet's (metrics.NEAR_LIMIT). */
export const NEAR_FULL = 0.8;

/** A state's tag, with its detail as hover text; plain: the page shows the detail beside it, so no hover text. why: an
 *  inferred state's "(inferred)" is a toggletip that gives the reason, for where the page shows it nowhere else. */
export function StateTag({ st, now, plain, why }: { st: LiveState; now: number; plain?: boolean; why?: boolean }) {
  const t = stateText(st, now), reason = st.inferred ? INFERRED_WHY[st.kind] : undefined;
  return <span className={"state st-" + st.kind} title={plain ? undefined : reason ?? t.detail}>
    <i aria-hidden="true" />{t.label}{st.inferred && (why && reason
      ? <> <Toggletip label="(inferred)" name="Why inferred" className="inf">{reason}</Toggletip></>
      : <span className="inf"> (inferred)</span>)}</span>;
}

/** Copy resume: the command that resumes the session in its agent, as the session sheet's, said politely. The result
 *  said is the last attempt's: Strip keys this by session, so another session's strip never says it. */
function CopyResume({ s }: { s: LiveSession }) {
  const [state, setState] = useState<"" | "copied" | "failed">("");
  const attempt = useRef(0);
  useEffect(() => {
    if (!state) return;
    const t = setTimeout(() => setState(""), 2000);
    return () => clearTimeout(t);
  }, [state]);
  const cmd = resumeCommand({ source: s.source, session_id: s.session_id, cwd: s.cwd });
  const copy = async () => {
    const n = ++attempt.current;
    setState("");
    const ok = await copyText(cmd);
    if (n === attempt.current) setState(ok ? "copied" : "failed");
  };
  return <>
    <button type="button" className="copy" title={cmd} onClick={copy}>
      {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy resume"}</button>
    <span className="sr" aria-live="polite">{state === "copied" ? "Resume command copied to clipboard." : state === "failed" ? "Could not copy to clipboard." : ""}</span>
  </>;
}

/** The selected session in one strip above its stream: its state with the detail, its context window with a mark at each
 *  compaction, its figures, its plan limits and its pulse; full: also its directory and Copy resume (a pinned stream on
 *  the Wall leaves them to the Stream view). The Errors count is the stream's failed-calls filter, as in its bar. */
export function Strip({ s, st, now, failedOnly, setFailedOnly, full }: {
  s: LiveSession; st: LiveState; now: number; failedOnly: boolean; setFailedOnly: (on: boolean) => void; full?: boolean;
}) {
  const t = stateText(st, now), share = s.context != null && s.window ? s.context / s.window : null, why = useId();
  const packed = s.compactions.filter(c => c.pre);
  return <div className="strip" role="group" aria-label="Session status">
    <span className={"it now" + (st.kind === "wait" ? " warn" : st.kind === "ended" ? " ended" : "")}><StateTag st={st} now={now} plain why />
      <span className="muted det">{t.detail}</span></span>
    <span className="it ctx">
      {share != null ? <>
        <span className={"meter" + (share > NEAR_FULL ? " warn" : "")} role="meter" aria-label="Context used" aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={Math.round(share * 100)}>
          <i style={{ width: `${Math.min(100, share * 100)}%` }} />
          {packed.map((c, i) => <span key={i} className="mark" aria-hidden="true" title={`compacted at ${big(c.pre)} tokens`}
            style={{ left: `${Math.min(100, (c.pre! / s.window!) * 100)}%` }} />)}
        </span>
        <span><b>{big(s.context)}</b> / {big(s.window)} · {pct(share)}</span>
      </> : <span><b>{s.context != null ? big(s.context) : "–"}</b> tokens · window not known for {s.model ?? "this model"}</span>}
      <span className="muted">· {plural(s.compactions.length, "compaction")}
        {packed.length > 0 && <span className="sr">, at {packed.map(c => big(c.pre)).join(", ")} tokens</span>}</span>
    </span>
    <span className="it"><span className="k">Cost</span> <b>{usd(s.cost)}</b></span>
    <span className="it"><span className="k">Tools</span> <b>{num(s.tools)}</b></span>
    <span className="it"><span className="k">Errors</span><button type="button" className={"fig" + (s.errors ? " bad" : "")} aria-pressed={failedOnly}
      aria-label={plural(s.errors, "error")} aria-describedby={why} title="Show failed calls only" onClick={() => setFailedOnly(!failedOnly)}>{num(s.errors)}</button>
      <span className="sr" id={why}>Show failed calls only</span></span>
    <span className="it"><span className="k">Cache read</span> <b>{pct(s.cache_read)}</b>
      <Toggletip term="cache read">The share of this session's prompt tokens read from the prompt cache, at a fraction of the input price.</Toggletip></span>
    {/* A plan limit's reset time is behind a toggletip, which hover, a tap and the keyboard reach alike. */}
    {s.limits.map(l => {
      const near = l.used_percent > NEAR_FULL * 100;
      return <span key={l.label} className={"it lim" + (near ? " warn" : "")}>
        <span className="k">{l.label}</span> <b>{num(l.used_percent)}%</b>{near && <> near</>}
        {l.resets_at && <Toggletip term={`the ${l.label} limit`}>The {l.label} limit resets {when(l.resets_at)}. The Limits page has
          every window.</Toggletip>}</span>;
    })}
    <span className="it"><span className="k" aria-hidden="true">10 min</span> <Pulse p={s.pulse} /></span>
    {full && <span className="it where">
      {s.cwd && <code className="cwd" title={s.cwd}><bdi>{s.cwd}</bdi></code>}
      <CopyResume key={s.session_id} s={s} />
    </span>}
  </div>;
}
