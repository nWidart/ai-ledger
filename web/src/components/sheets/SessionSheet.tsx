import { useRef, useState, type ReactNode } from "react";
import { promptUrl, type SessionDetail } from "../../api";
import { big, dur, ms, num, pct, plural, usd, when } from "../../format";
import { ApiError, getJson } from "../../useApi";
import { ProjectDot } from "../ProjectDot";
import { appLink, errorsHref, openProjectSheet } from "./session";
import { FilterButton } from "./FilterButton";
import { Timeline } from "./Timeline";

// The session payload caps the first prompt; the whole text comes from /api/prompt on demand, remembered by session.
const fullPrompts = new Map<string, string>();

/** A session's cost: unknown when no model is priced, a labelled subtotal when only some are. */
export function sessCost(models: SessionDetail["models"]): [string, string] {
  const priced = models.filter(r => r.cost != null), unpriced = models.length - priced.length;
  const sum = priced.reduce((a, r) => a + r.cost!, 0);
  return !priced.length ? ["Unknown", "est. cost, no model priced"]
    : unpriced ? [usd(sum) + "+", `est. cost of priced models; ${plural(unpriced, "model")} unpriced`] : [usd(sum), "est. cost"];
}

const Stat = ({ v, l }: { v: ReactNode; l: ReactNode }) => <span><b>{v}</b> {l}</span>;

export interface SessionSheetProps {
  id: string;
  s: SessionDetail | undefined;
  error?: Error | undefined;
  retry: () => void;
  /** The page's range, for links to Errors. */
  range: number;
  /** The project the page is filtered to, so the filter button can offer to clear it. */
  pageProject: string;
}

/** The session sheet's body: the whole session, whatever the range filter says. */
export function SessionSheet({ id, s, error, retry, range, pageProject }: SessionSheetProps) {
  const [full, setFull] = useState(() => fullPrompts.get(id));
  const [fp, setFp] = useState<{ busy?: boolean; failed?: boolean; status: string }>({ status: "" });
  const pre = useRef<HTMLPreElement>(null);
  if (error) return error instanceof ApiError && error.status === 404
    ? <div className="empty">This session was not found.</div>
    : <div className="empty" role="alert">Could not load this session ({error.message}). <button type="button" className="linkish" onClick={retry}>Retry</button></div>;
  if (!s) return <div className="empty" role="status">Loading session…</div>;

  const i = s.info, tokens = s.models.reduce((a, r) => a + r.tokens, 0), [cost, costNote] = sessCost(s.models);
  const cut = s.first_prompt_cut && full == null;
  const loadPrompt = () => {
    setFp({ busy: true, status: "Loading the whole prompt…" });
    getJson<{ text: string }>(promptUrl(id)).then(({ text }) => {
      fullPrompts.set(id, text);
      setFull(text);
      setFp({ status: `Showing all ${num(text.length)} characters.` });
      requestAnimationFrame(() => pre.current?.focus({ preventScroll: true }));
    }, (e: Error) => setFp({ failed: true, status: ` Could not load it (${e.message}).` }));
  };
  const long = i.first_ts && i.last_ts ? (Date.parse(i.last_ts) - Date.parse(i.first_ts)) / 1000 : null;

  return <>
    <div className="hint"><span className="chip">Whole session, not limited by the range filter</span><br />
      Project <ProjectDot project={i.project} /><button type="button" className="linkish" onClick={() => openProjectSheet(i.project)}>{i.project}</button>
      {i.git_branch ? ` on ${i.git_branch}` : ""}, {when(i.first_ts)} to {when(i.last_ts)}.</div>
    <div className="actions"><FilterButton project={i.project} pageProject={pageProject} /></div>
    {s.first_prompt && <details className="sd">
      <summary>Source<span className="c">the first prompt as recorded{cut ? `, first ${num(s.first_prompt.length - 1)} characters` : full != null ? `, all ${num(full.length)} characters` : ""}</span></summary>
      <pre className="fp-raw" ref={pre} tabIndex={-1}>{full ?? s.first_prompt}</pre>
      {cut && <button type="button" className="linkish small" disabled={fp.busy} onClick={loadPrompt}>{fp.failed ? "Retry loading the whole prompt" : "Show the whole prompt"}</button>}
      <span className="small muted" role="status">{fp.status}</span>
    </details>}
    <div className="statline">
      <Stat v={cost} l={costNote} /><Stat v={big(tokens)} l="tokens" />
      <Stat v={num(s.prompts.prompts)} l={`prompts${s.prompts.interrupted ? `, ${num(s.prompts.interrupted)} interrupted` : ""}`} />
      <Stat v={big(i.peak_context)} l={`peak context${i.context_limit && i.peak_context != null ? ` (${pct(i.peak_context / i.context_limit)})` : ""}`} />
      <Stat v={num(i.compactions)} l={i.compactions === 1 ? "compaction" : "compactions"} />
      <Stat v={num(s.commits.length)} l={s.commits.length === 1 ? "commit" : "commits"} />
      <Stat v={dur(long)} l="long" />
    </div>
    <h3>Timeline</h3>
    <Timeline s={s} project={i.project} />
    {s.error_loops.length > 0 && <><h3>Error loops</h3>{s.error_loops.map(l => (
      <div key={l.first_id}>{l.tool} failed {l.failures}× in a row. <a href={errorsHref(i.project, range, l.first_id)} onClick={appLink}>Open in Errors</a></div>))}</>}
    {s.commits.length > 0 && <details className="sd"><summary>Commits<span className="c">{num(s.commits.length)}</span></summary>
      {s.commits.map(c => <div key={c.tool_use_id} className="muted commit"><code>{c.command}</code></div>)}</details>}
    <details className="sd"><summary>Models<span className="c">{num(s.models.length)}</span></summary><div className="scroll"><table>
      <thead><tr><th>Model</th><th className="num">Requests</th><th className="num">Tokens</th><th className="num">Est. cost</th></tr></thead>
      <tbody>{s.models.map((r, k) => <tr key={k}>
        <td>{(r.model ?? "").replace(/^claude-/, "")}<div className="muted small">{[r.effort !== "(none)" && r.effort, r.subagent ? "subagent" : "main thread"].filter(Boolean).join(" · ")}</div></td>
        <td className="num">{num(r.requests)}</td><td className="num">{big(r.tokens)}</td><td className="num">{usd(r.cost)}</td></tr>)}</tbody>
    </table></div></details>
    <details className="sd"><summary>Tools<span className="c">{num(s.tools.length)}</span></summary><div className="scroll"><table>
      <thead><tr><th>Tool</th><th className="num">Calls</th><th className="num">Failed</th><th className="num">p50</th></tr></thead>
      <tbody>{s.tools.length ? s.tools.map(r => <tr key={r.tool}><td className="name">{r.tool}</td><td className="num">{num(r.calls)}</td>
        <td className={"num" + ((r.failure_rate ?? 0) > .1 ? " bad" : "")}>{pct(r.failure_rate, 1)}</td><td className="num">{ms(r.p50_ms)}</td></tr>)
        : <tr><td colSpan={4} className="empty">No tool calls.</td></tr>}</tbody>
    </table></div></details>
    <p><code className="muted sid">{i.session_id}</code></p>
  </>;
}
