import type { LiveListSession } from "../../api";
import { SOURCE_LABELS } from "../../components/Filters";
import { ProjectName } from "../../components/ProjectDot";
import { num, pct, usd } from "../../format";
import { NEAR_FULL, StateTag } from "./AgentPanel";
import { groupSessions, stateNow } from "./live";

/** One tile per active session, grouped as the rail is; picking one opens it in the stream. A tile names its session
 *  (data-session), as a rail entry does: LivePage keeps the keyboard focus on one that changes group. */
export function Wall({ sessions, now, pick }: { sessions: LiveListSession[]; now: number; pick: (id: string) => void }) {
  return <section className="walls" aria-label="Active sessions">{groupSessions(sessions, now).map(g => <div key={g.id} className="group">
    <h3>{g.label} · {g.sessions.length}</h3>
    <div className="wall" role="list" aria-label={g.label}>{g.sessions.map(s => {
      const st = stateNow(s.state, now), share = s.context != null && s.window ? s.context / s.window : null;
      const act = !s.latest ? "" : s.latest.kind === "prompt" ? "▸ prompt" : `${s.latest.lane ? "⤷ " : ""}${s.latest.tool} · ${s.latest.summary ?? ""}`;
      return <div role="listitem" key={s.session_id}>
        <button type="button" data-session={s.session_id} className={"panel tile st-" + st.kind} onClick={() => pick(s.session_id)} aria-label={`Open ${s.title ?? s.project ?? "session"}`}>
          <span className="top"><ProjectName project={s.project} /><StateTag st={st} now={now} /></span>
          {s.title && <span className="ttl" title={s.title}>{s.title}</span>}
          <code className="act">{act}</code>
          {share != null && <span className={"meter" + (share > NEAR_FULL ? " warn" : "")}><i style={{ width: `${Math.min(100, share * 100)}%` }} /></span>}
          <span className="row"><span>{share != null ? `context ${pct(share)} · ` : ""}{num(s.tools)} tools{s.errors ? <> · <span className="bad">{num(s.errors)} errors</span></> : null}</span>
            <span>{usd(s.cost)}</span></span>
          <span className="row muted"><code>{s.branch ?? "–"}</code><span>{SOURCE_LABELS[s.source]} · {s.model ?? "–"}</span></span>
        </button>
      </div>;
    })}</div>
  </div>)}</section>;
}
