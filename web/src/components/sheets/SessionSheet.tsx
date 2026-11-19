import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { SessionDetail, View } from "../../api";
import { big, dur, ms, num, pct, plural, usd, when } from "../../format";
import { queries } from "../../queries";
import { ApiError } from "../../useApi";
import { copyText } from "../export";
import { resumeCommand } from "../menu/resume";
import { DataTable } from "../DataTable";
import { ProjectDot } from "../ProjectDot";
import { Toggletip } from "../Toggletip";
import { appLink, errorsHref, openProjectSheet, openToolSheet, pickRow } from "./session";
import { FilterButton } from "./FilterButton";
import { SessionInsight } from "./SessionInsight";
import { Timeline } from "./Timeline";

/** A session's cost: unknown when no model is priced, a labelled subtotal when only some are. */
export function sessCost(models: SessionDetail["models"]): [string, string] {
  const priced = models.filter(r => r.cost != null), unpriced = models.length - priced.length;
  const sum = priced.reduce((a, r) => a + r.cost!, 0);
  return !priced.length ? ["Unknown", "est. cost, no model priced"]
    : unpriced ? [usd(sum) + "+", `est. cost of priced models; ${plural(unpriced, "model")} unpriced`] : [usd(sum), "est. cost"];
}

/** A labelled line of text with a Copy button; the outcome is announced politely, the live region present before it speaks. */
function CopyLine({ label, text }: { label: string; text: string }) {
  const [state, setState] = useState<"" | "copied" | "failed">("");
  useEffect(() => {
    if (!state) return;
    const t = setTimeout(() => setState(""), 2000);
    return () => clearTimeout(t);
  }, [state]);
  return <p className="copyline"><span className="small muted">{label}</span> <code className="sid">{text}</code>{" "}
    <button type="button" className="linkish small" onClick={async () => setState(await copyText(text) ? "copied" : "failed")}>
      {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy"}<span className="sr"> {label.toLowerCase()}</span></button>
    <span className="sr" aria-live="polite">{state === "copied" ? "Copied to clipboard." : state === "failed" ? "Could not copy to clipboard." : ""}</span></p>;
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
  /** The page's filters, for the link to Insights. */
  view: View;
}

/** The session sheet's body: the whole session, whatever the range filter says. */
export function SessionSheet({ id, s, error, retry, range, pageProject, view }: SessionSheetProps) {
  // The session payload caps the first prompt; the whole text is a query, fetched once the user asks. Not enabled, it still
  // answers from the cache, so a sheet reopened on the session shows the text it loaded before without a request.
  const [askedId, setAskedId] = useState<string>(), asked = askedId === id;
  const prompt = useQuery({ ...queries.prompt(id), enabled: asked });
  const full = prompt.data?.text, busy = prompt.isFetching, failed = prompt.isError && !busy;
  const pre = useRef<HTMLPreElement>(null);
  // The text lands only after the user asked (or it was cached already, which asks for nothing): focus it then.
  const landed = asked && full != null;
  useEffect(() => { if (landed) requestAnimationFrame(() => pre.current?.focus({ preventScroll: true })); }, [landed]);
  if (error) return error instanceof ApiError && error.status === 404
    ? <div className="empty">This session was not found.</div>
    : <div className="empty" role="alert">Could not load this session ({error.message}). <button type="button" className="linkish" onClick={retry}>Retry</button></div>;
  if (!s) return <div className="empty" role="status">Loading session…</div>;

  const i = s.info, tokens = s.models.reduce((a, r) => a + r.tokens, 0), [cost, costNote] = sessCost(s.models);
  const cut = s.first_prompt_cut && full == null;
  const status = busy ? "Loading the whole prompt…" : failed ? ` Could not load it (${prompt.error?.message}).` : landed ? `Showing all ${num(full.length)} characters.` : "";

  return <>
    <div className="hint"><span className="chip">Whole session, not limited by the range filter</span><br />
      Project <ProjectDot project={i.project} /><button type="button" className="linkish" onClick={() => openProjectSheet(i.project)}>{i.project}</button>
      {i.git_branch ? ` on ${i.git_branch}` : ""}, {when(i.first_ts)} to {when(i.last_ts)}.</div>
    <div className="actions"><FilterButton project={i.project} pageProject={pageProject} /></div>
    {s.first_prompt && <details className="sd">
      <summary>Source<span className="c">the first prompt as recorded{cut ? `, first ${num(s.first_prompt.length - 1)} characters` : full != null ? `, all ${num(full.length)} characters` : ""}</span></summary>
      <pre className="fp-raw" ref={pre} tabIndex={-1}>{full ?? s.first_prompt}</pre>
      {cut && <button type="button" className="linkish small" disabled={busy} onClick={() => { if (asked) void prompt.refetch(); else setAskedId(id); }}>{failed ? "Retry loading the whole prompt" : "Show the whole prompt"}</button>}
      <span className="small muted" role="status">{status}</span>
    </details>}
    <div className="statline">
      <Stat v={cost} l={costNote} /><Stat v={big(tokens)} l="tokens" />
      <Stat v={num(s.prompts.prompts)} l={`prompts${s.prompts.interrupted ? `, ${num(s.prompts.interrupted)} interrupted` : ""}`} />
      <Stat v={big(i.peak_context)} l={`peak context${i.context_limit && i.peak_context != null ? ` (${pct(i.peak_context / i.context_limit)})` : ""}`} />
      <Stat v={num(i.compactions)} l={i.compactions === 1 ? "compaction" : "compactions"} />
      <Stat v={num(s.commits.length)} l={s.commits.length === 1 ? "commit" : "commits"} />
      <Stat v={dur(i.active_s)} l={<>active<Toggletip term="active time">Pauses over 20 minutes left out</Toggletip></>} />
      {/* Claude Code's cost-state line: none of these for a session without one (every Codex session). */}
      {i.model_ms != null && <>
        <Stat v={dur(i.model_ms / 1000)} l={<>model time<Toggletip term="model and tool time">From Claude Code's own record of the session, subagent work included</Toggletip></>} />
        {i.tool_ms != null && <Stat v={dur(i.tool_ms / 1000)} l="tool time" />}
        {i.output_per_s != null && <Stat v={num(i.output_per_s)} l="output tok/s" />}
        {i.lines_added != null && i.lines_removed != null && <Stat v={`+${num(i.lines_added)} / −${num(i.lines_removed)}`} l="lines" />}
      </>}
    </div>
    {s.insight && <SessionInsight i={s.insight} view={view} />}
    <h3>Timeline</h3>
    <Timeline s={s} project={i.project} />
    {s.error_loops.length > 0 && <><h3>Error loops</h3>{s.error_loops.map(l => (
      <div key={l.first_id}>{l.tool} failed {l.failures}× in a row. <a href={errorsHref(i.project, range, l.first_id)} onClick={appLink}>Open in Errors</a></div>))}</>}
    {s.commits.length > 0 && <details className="sd"><summary>Commits<span className="c">{num(s.commits.length)}</span></summary>
      {s.commits.map(c => <div key={c.tool_use_id} className="muted commit"><code>{c.command}</code></div>)}</details>}
    <div className="pair"><details className="sd"><summary>Models<span className="c">{num(s.models.length)}</span></summary><DataTable name="Models">
      <thead><tr><th scope="col">Model</th><th scope="col" className="num">Requests</th><th scope="col" className="num">Tokens</th><th scope="col" className="num">Est. cost</th></tr></thead>
      <tbody>{s.models.map((r, k) => <tr key={k}>
        <th scope="row" className="name">{(r.model ?? "").replace(/^claude-/, "")}<div className="muted small">{[r.effort !== "(none)" && r.effort, r.subagent ? "subagent" : "main thread"].filter(Boolean).join(" · ")}</div></th>
        <td className="num">{num(r.requests)}</td><td className="num">{big(r.tokens)}</td><td className="num">{usd(r.cost)}</td></tr>)}</tbody>
    </DataTable></details>
    <details className="sd"><summary>Tools<span className="c">{num(s.tools.length)}</span></summary><DataTable name="Tools">
      <thead><tr><th scope="col">Tool</th><th scope="col" className="num">Calls</th><th scope="col" className="num">Failed</th><th scope="col" className="num">p50</th></tr></thead>
      <tbody>{s.tools.length ? s.tools.map(r => <tr key={r.tool} {...pickRow(r.tool, v => openToolSheet("tool", v), { kind: "tool", value: r.tool })}>
        <th scope="row" className="name"><button type="button" className="cellbtn">{r.tool}</button></th><td className="num">{num(r.calls)}</td>
        <td className={"num" + ((r.failure_rate ?? 0) > .1 ? " bad" : "")}>{pct(r.failure_rate, 1)}</td><td className="num">{ms(r.p50_ms)}</td></tr>)
        : <tr><td colSpan={4} className="empty">No tool calls.</td></tr>}</tbody>
    </DataTable></details></div>
    <p><code className="muted sid">{i.session_id}</code></p>
    {i.cwd && <CopyLine label="Directory" text={i.cwd} />}
    <CopyLine label="Resume" text={resumeCommand({ source: i.source, session_id: i.session_id, cwd: i.cwd })} />
  </>;
}
