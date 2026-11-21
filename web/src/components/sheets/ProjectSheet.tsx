import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import type { ModelRow, Source, Totals, UsagePayload } from "../../api";
import { big, dur, num, pct, usd, when } from "../../format";
import { money, sgn } from "../../pages/cost/cost";
import { Spark } from "../Spark";
import { Ledger, LedgerRow } from "../Ledger";
import { SessionCell } from "../table/cells";
import { Table, type Column, type RowPick } from "../table/Table";
import { FilterButton } from "./FilterButton";
import { usePathname } from "../../url";
import { appLink, errorsHref, projectHref } from "./session";

const TOP_MODELS = 8;
/** A share as a whole percentage, "<1%" for a non-zero share that would round to 0%. */
const share = (v: number | null) => (v != null && v > 0 && v < .005 ? "<1%" : pct(v));

/** Models, effort and fast mode as ledger rows: share of requests, with estimated cost. by="cost" (the Cost page): ranked and drawn by
 *  share of estimated cost, unpriced last, the top TOP_MODELS until Show all. */
export function ModelLedger({ models, by = "requests" }: { models: readonly ModelRow[]; by?: "requests" | "cost" }) {
  const [all, setAll] = useState(false), cost = by === "cost";
  const v = (r: ModelRow) => (cost ? r.cost ?? 0 : r.requests);
  const rs = cost ? models.slice().sort((a, b) => (b.cost ?? -1) - (a.cost ?? -1)) : models;
  const sum = rs.reduce((s, r) => s + v(r), 0) || 1, max = Math.max(...rs.map(v), 0) || 1;
  const shown = cost && !all ? rs.slice(0, TOP_MODELS) : rs;
  return <>
    <Ledger empty="No requests in this range.">{shown.map(r => <LedgerRow key={r.model + "|" + r.effort + "|" + r.fast}
      name={r.model.replace(/^claude-/, "") + (r.effort && r.effort !== "(none)" ? ` · ${r.effort}` : "") + (r.fast ? " · fast" : "")}
      title={`${r.model}, ${r.effort} effort${r.fast ? ", fast mode" : ""}, ${num(r.requests)} requests, ${big(r.tokens)} tokens`}
      share={v(r) / max} value={cost && r.cost == null ? "–" : share(v(r) / sum)}
      side={r.cost == null ? <span className="chip warn">unpriced</span> : usd(r.cost)} />)}</Ledger>
    {cost && rs.length > TOP_MODELS && <button type="button" className="linkish more" onClick={() => setAll(!all)}>
      {all ? `Show top ${TOP_MODELS}` : `Show all ${num(rs.length)}`}</button>}
  </>;
}

export const Facts = ({ facts }: { facts: [ReactNode, ReactNode][] }) =>
  <div className="facts">{facts.map(([v, l], k) => <div key={k}><div className="v">{v}</div><div className="l">{l}</div></div>)}</div>;

/** The project's eight summary figures, as the project sheet and the Project page show them. */
export const summaryFacts = (t: Totals): [ReactNode, ReactNode][] => [
  [usd(t.cost), "est. cost"], [num(t.sessions), "sessions"], [big(t.tokens), "tokens"], [pct(t.cache_hit_ratio, 1), "cache hit"],
  [pct(t.subagent_token_share), "tokens from subagents"], [t.commits ? usd(t.cost_per_commit) : "n/a", `per commit, ${num(t.commits)} commits`],
  [num(t.errors_per_100_calls, 1), "errors per 100 calls"], [num(t.error_loops), "error loops"],
];

/** Where to put the reader back when they return from a session to this project sheet. */
export interface BackTo { scroll: number; v: string }

export interface ProjectSheetProps {
  name: string;
  d: UsagePayload | undefined;
  error?: Error | undefined;
  retry: () => void;
  range: number;
  /** The page's source filter, for the links, which need no payload. */
  source: Source | "";
  pageProject: string;
  /** The page shows automated sessions. */
  automated?: boolean;
  onSession: (id: string, el: HTMLElement) => void;
  backTo?: RefObject<BackTo | null>;
}

/** The project's change against the previous period: both costs, the change (marked new without earlier usage) and the daily
 *  cost of both windows. d is the project's own payload, so its previous period and daily series are the project's. None for all time. */
export function ChangeDetail({ d, name }: { d: UsagePayload; name: string }) {
  const c = d.changes?.find(x => x.project === name);
  if (!d.previous || !d.start || !c) return null;
  return <>
    <h3>Change vs the previous {d.range} days</h3>
    <Facts facts={[[money(c.prev_cost), `previous ${d.range} days`], [money(c.cost), `last ${d.range} days`],
      [<>{sgn(c.delta)}{c.new && <> <span className="chip new">new</span></>}</>, c.new ? "no usage before" : "change"]]} />
    <Spark d={d} />
  </>;
}

type TopSession = UsagePayload["top_sessions"][number];
const TOP_COLUMNS: readonly Column<TopSession>[] = [
  { id: "session", header: "Session", cellProps: () => ({ className: "when sess" }), cell: s => <SessionCell s={s} sub={<>{when(s.first_ts)}</>} /> },
  { id: "branch", header: "Branch", cellProps: () => ({ className: "name" }), cell: s => s.git_branch || "–" },
  { id: "active", header: "Active", tip: "Active time: pauses over 20 minutes left out", tipTerm: "Active time", align: "num", cell: s => dur(s.duration_s) },
  { id: "cost", header: "Est. cost", align: "num", cell: s => usd(s.cost) },
];

/** The most expensive sessions as a named table; a row opens its session through onSession. body: the tbody's ref, for useBackTo. */
export function TopSessions({ top, onSession, body }: { top: UsagePayload["top_sessions"]; onSession: (id: string, el: HTMLElement) => void; body?: RefObject<HTMLTableSectionElement | null> }) {
  const pick = useMemo<RowPick<TopSession>>(() => ({ value: s => s.session_id, open: (v, el) => onSession(v, el),
    subject: s => ({ kind: "session", value: s.session_id }) }), [onSession]);
  return <Table name="Most expensive sessions" rows={top} columns={TOP_COLUMNS} rowId={s => s.session_id} pick={pick} body={{ ref: body }}
    empty="No sessions in this range." />;
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
    const row = body.current?.querySelector<HTMLElement>(`[data-v="${CSS.escape(to.v)}"] button`);
    row?.focus({ preventScroll: true });
    row?.scrollIntoView?.({ block: "nearest" }); // a tool sheet widened or narrowed meanwhile has moved the row
  }, [d, backTo, body]);
}

export function ProjectSheet({ name, d, error, retry, range, source, pageProject, automated = false, onSession, backTo }: ProjectSheetProps) {
  const path = usePathname(), body = useRef<HTMLTableSectionElement>(null);
  useBackTo(d, backTo, body);
  // The way on needs only the view, so it shows while the figures load or fail, and stays the same node when they arrive.
  return <>
    {d && !error && <div className="hint">{d.start ? `Last ${range} days` : "All time"}, from the range filter. Estimated at API list prices.</div>}
    <div className="actions"><FilterButton project={name} pageProject={pageProject} />
      {!(path === "/project" && name === pageProject) &&
        <a className="btn" href={projectHref(name, range, source, automated)} onClick={appLink}>Open project page</a>}
      <a className="btn" href={errorsHref(name, range, undefined, { source })} onClick={appLink}>Open its errors</a></div>
    {error ? <div className="empty" role="alert">Could not load this project ({error.message}). <button type="button" className="linkish" onClick={retry}>Retry</button></div>
      : !d ? <div className="empty" role="status">Loading…</div>
      : <>
        <Facts facts={summaryFacts(d.totals)} />
        <ChangeDetail d={d} name={name} />
        <h3>Models and effort</h3>
        <ModelLedger models={d.models} />
        <h3>Most expensive sessions</h3>
        <TopSessions top={d.top_sessions.slice(0, 8)} onSession={onSession} body={body} />
      </>}
  </>;
}
