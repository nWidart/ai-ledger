import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { ModelRow, UsagePayload } from "../../api";
import { big, dur, num, pct, usd, when } from "../../format";
import { Ledger, LedgerRow } from "../Ledger";
import { FilterButton } from "./FilterButton";
import { appLink, errorsHref, pickRow, sessName } from "./session";

const TOP_MODELS = 8;
/** A share as a whole percentage, "<1%" for a non-zero share that would round to 0%. */
const share = (v: number | null) => (v != null && v > 0 && v < .005 ? "<1%" : pct(v));

/** Models and effort as ledger rows: share of requests, with estimated cost. by="cost" (the Cost page): ranked and drawn by
 *  share of estimated cost, unpriced last, the top TOP_MODELS until Show all. */
export function ModelLedger({ models, by = "requests" }: { models: readonly ModelRow[]; by?: "requests" | "cost" }) {
  const [all, setAll] = useState(false), cost = by === "cost";
  const v = (r: ModelRow) => (cost ? r.cost ?? 0 : r.requests);
  const rs = cost ? models.slice().sort((a, b) => (b.cost ?? -1) - (a.cost ?? -1)) : models;
  const sum = rs.reduce((s, r) => s + v(r), 0) || 1, max = Math.max(...rs.map(v), 0) || 1;
  const shown = cost && !all ? rs.slice(0, TOP_MODELS) : rs;
  return <>
    <Ledger empty="No requests in this range.">{shown.map(r => <LedgerRow key={r.model + "|" + r.effort}
      name={r.model.replace(/^claude-/, "") + (r.effort && r.effort !== "(none)" ? ` · ${r.effort}` : "")}
      title={`${r.model}, ${r.effort} effort, ${num(r.requests)} requests, ${big(r.tokens)} tokens`}
      share={v(r) / max} value={cost && r.cost == null ? "–" : share(v(r) / sum)}
      side={r.cost == null ? <span className="chip warn">unpriced</span> : usd(r.cost)} />)}</Ledger>
    {cost && rs.length > TOP_MODELS && <button type="button" className="linkish more" onClick={() => setAll(!all)}>
      {all ? `Show top ${TOP_MODELS}` : `Show all ${num(rs.length)}`}</button>}
  </>;
}

export const Facts = ({ facts }: { facts: [ReactNode, ReactNode][] }) =>
  <div className="facts">{facts.map(([v, l], k) => <div key={k}><div className="v">{v}</div><div className="l">{l}</div></div>)}</div>;

/** Where to put the reader back when they return from a session to this project sheet. */
export interface BackTo { scroll: number; v: string }

export interface ProjectSheetProps {
  name: string;
  d: UsagePayload | undefined;
  error?: Error | undefined;
  retry: () => void;
  range: number;
  pageProject: string;
  onSession: (id: string, el: HTMLElement) => void;
  backTo?: RefObject<BackTo | null>;
}

/** The project sheet's body: its summary over the page's range, models and its most expensive sessions. */
/** Back from a session: the scroll and the row it was opened from (after the sheet's own scroll-to-top for new content). */
export function useBackTo(d: unknown, backTo: RefObject<BackTo | null> | undefined, body: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const to = backTo?.current;
    if (!d || !to) return;
    backTo.current = null;
    const dlg = body.current?.closest("dialog");
    if (dlg) dlg.scrollTop = to.scroll;
    body.current?.querySelector<HTMLElement>(`[data-v="${CSS.escape(to.v)}"] button`)?.focus({ preventScroll: true });
  }, [d, backTo, body]);
}

export function ProjectSheet({ name, d, error, retry, range, pageProject, onSession, backTo }: ProjectSheetProps) {
  const body = useRef<HTMLTableSectionElement>(null);
  useBackTo(d, backTo, body);
  if (error) return <div className="empty" role="alert">Could not load this project ({error.message}). <button type="button" className="linkish" onClick={retry}>Retry</button></div>;
  if (!d) return <div className="empty" role="status">Loading…</div>;
  const t = d.totals, top = d.top_sessions.slice(0, 8);
  return <>
    <div className="hint">{d.start ? `Last ${range} days` : "All time"}, from the range filter. Estimated at API list prices.</div>
    <div className="actions"><FilterButton project={name} pageProject={pageProject} />
      <a className="btn" href={errorsHref(name, range, undefined, { source: d.source })} onClick={appLink}>Open its errors</a></div>
    <Facts facts={[
      [usd(t.cost), "est. cost"], [num(t.sessions), "sessions"], [big(t.tokens), "tokens"], [pct(t.cache_hit_ratio, 1), "cache hit"],
      [pct(t.subagent_token_share), "tokens from subagents"], [t.commits ? usd(t.cost_per_commit) : "n/a", `per commit, ${num(t.commits)} commits`],
      [num(t.errors_per_100_calls, 1), "errors per 100 calls"], [num(t.error_loops), "error loops"],
    ]} />
    <h3>Models and effort</h3>
    <ModelLedger models={d.models} />
    <h3>Most expensive sessions</h3>
    <div className="scroll"><table><thead><tr><th>Session</th><th>Branch</th><th className="num" title="Active time: pauses over 20 minutes left out">Active</th><th className="num">Est. cost</th></tr></thead>
      <tbody ref={body}>{top.length ? top.map(s => <tr key={s.session_id} {...pickRow(s.session_id, onSession)}>
        <td className="when sess"><button type="button" className="cellbtn" title={s.title || s.session_id}>{sessName(s)}</button><div className="muted small">{when(s.first_ts)}</div></td>
        <td className="name">{s.git_branch || "–"}</td><td className="num">{dur(s.duration_s)}</td><td className="num">{usd(s.cost)}</td></tr>)
        : <tr><td colSpan={4} className="empty">No sessions in this range.</td></tr>}</tbody>
    </table></div>
  </>;
}
