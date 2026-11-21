// The blocks of the Project page. Each reads one payload another page reads, with the project as the filter, and draws, fails and
// retries on its own (Block). Figures come from the other pages' own components and model functions.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "../../components/chart";
import { askedFor } from "../../components/refresh";
import type { ContextPayload, ErrorsPayload, InsightsPayload, LimitsPayload, LivePayload, Totals, UsagePayload } from "../../api";
import { DataTable } from "../../components/DataTable";
import { Judged, label as facetLabel, NO_FACETS, outcomeLabel } from "../../components/facets";
import { Ledger, LedgerRow } from "../../components/Ledger";
import { ChangeDetail, Facts, ModelLedger, TopSessions } from "../../components/sheets/ProjectSheet";
import { appLink, errorsHref, judgmentsHref, openSessionSheet } from "../../components/sheets/session";
import { big, dur, num, pct, plural, usd } from "../../format";
import type { ApiState } from "../../useApi";
import { share } from "../context/context";
import { TokenPairs } from "../cost/TokenPairs";
import { makeModel } from "../errors/model";
import { sharePct } from "../limits/limits";
import { subjectAttrs } from "../../components/menu/subject";
import { Toggletip } from "../../components/Toggletip";
import { ContextGrid } from "./ContextGrid";
import { MeasureNow } from "./MeasureNow";
import { contextGrid, errorsBlock, limitsBlock } from "./project";

/** The page's view in words and links: the project and the shared keys, as a query string for another page. */
export interface Scope { project: string; range: number; source: "claude" | "codex" | ""; auto: boolean; search: string }

const FRICTION_TOP = 3;

/** True once loading has gone on for 150 ms, as the app's other pages time their loading look. */
function useSlow(loading: boolean) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setSlow(true), 150);
    return () => { clearTimeout(t); setSlow(false); };
  }, [loading]);
  return loading && slow;
}

/** How a block takes in new data, as useLanding does for a whole page, but for this block alone, so a payload that changed moves only
 *  the blocks that read it. When the block's data changes for a new view (view), after Refresh or after a failure, its bars grow in
 *  and, over earlier figures, it fades in; new data an ingest brought in the background swaps in quietly. An answer equal to the last
 *  keeps its reference (the query cache shares it), so a refresh that changed nothing moves nothing. */
function useLand(data: unknown, view: string, error: Error | undefined) {
  const client = useQueryClient(), ref = useRef<HTMLElement>(null);
  const shown = useRef({ data, view }), failed = useRef(false);
  useEffect(() => { if (error) failed.current = true; }, [error]);
  useLayoutEffect(() => {
    const was = shown.current;
    shown.current = { data, view };
    if (data === undefined || data === was.data) return;
    const quiet = was.data !== undefined && was.view === view && !askedFor(client) && !failed.current;
    failed.current = false;
    const el = ref.current;
    if (quiet || !motion() || !el) return;
    // Classes set here, not through className, so restarting the animation re-renders nothing.
    el.classList.remove("grow", "fade-in");
    void el.offsetWidth;
    el.classList.add("grow");
    if (was.data !== undefined) el.classList.add("fade-in");
    const t = setTimeout(() => el.classList.remove("grow"), 1100);
    return () => { clearTimeout(t); el.classList.remove("grow"); };
    // view is read with data, not watched: it changes before its answer comes, and the landing waits for that answer.
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  return ref;
}

/** One block: its heading with the link to its page, then its body once its data is in. A failed request says so with Retry
 *  and, when the block already has figures (a refresh failed), keeps them. The block is aria-busy while its request, or another it
 *  reads a line from (also), is under way; one of them taking a while dims its figures, and no other block's. The loading line is
 *  plain text, not a live region: aria-busy says it. href names the view, so the block lands anew when it changes. */
function Block<T>({ id, title, page, href, off, state, also = [], children }: { id: string; title: string; page: string; href: string; state: ApiState<T>;
  /** Why the page cannot show this view: said in the link's place. */
  off?: string; also?: readonly ApiState<unknown>[]; children: (d: T) => ReactNode }) {
  const { data, error, retry } = state;
  const loading = state.loading || also.some(s => s.loading), slow = useSlow(loading);
  const ref = useLand(data, href, error);
  return (
    <section ref={ref} className={"panel sect" + (slow && data ? " loading" : "")} id={id} aria-labelledby={id + "Title"} aria-busy={loading || undefined}>
      <header className="blk-head">
        <h2 id={id + "Title"}>{title}</h2>
        {off ? <span className="blk-off">{off}</span> : <a className="blk-open" href={href} onClick={appLink}>Open in {page}</a>}
      </header>
      {error && <div className="empty" role="alert">Could not load {title.toLowerCase()} ({error.message}). <button type="button" className="linkish" onClick={retry}>Retry</button></div>}
      {data ? children(data) : !error && !off && <p className="empty">Loading…</p>}
    </section>
  );
}

/** A usage block's body when the project has no request in the view (the page says so above the blocks). */
const noRequests = <p className="empty">No requests in this view.</p>;

/** What the project did: eight figures the project sheet does not show (the sheet has cost, sessions, tokens and error counts), as
 *  Activity counts them, and a link to Live while sessions of it are running (a note with Retry when Live did not answer, so a failure
 *  does not read as no session, and a plain "Checking…" line while Live has not answered). A figure the store cannot give reads n/a. */
export const activityFacts = (t: Totals): [ReactNode, ReactNode][] => {
  const na = (v: number | null, f: (n: number) => string) => (v == null ? "n/a" : f(v));
  return [
    [num(t.prompts), "prompts"], [num(t.commits), "commits"], [num(t.active_days), "active days"],
    [num(t.requests), `requests, ${num(t.main_requests)} from the main thread`], [na(t.median_session_seconds, dur), "median session"],
    [na(t.cost_per_prompt, usd), "estimated cost per prompt"], [na(t.turns_per_prompt, n => num(n, 1)), "turns per prompt"],
    [na(t.interruption_rate, n => pct(n, 1)), "of prompts interrupted"],
  ];
};
export function ActivityBlock({ usage, live, scope }: { usage: ApiState<UsagePayload>; live: ApiState<LivePayload>; scope: Scope }) {
  const n = live.data?.sessions.length ?? 0;
  // The line stays in the page whatever it says, so Retry can put focus on it: the request clears its error, and the button goes.
  const line = useRef<HTMLParagraphElement>(null);
  const retry = () => { line.current?.focus(); live.retry(); };
  return (
    <Block id="activity" title="Activity" page="Activity" href={"/usage" + scope.search} state={usage} also={[live]}>
      {d => <>
        <div className="hint">{d.start ? `Last ${d.range} days` : "All time"}, from the range filter.</div>
        {d.totals.requests ? <Facts facts={activityFacts(d.totals)} /> : noRequests}
        <p className={"live-now" + (n > 0 ? "" : " muted")} ref={line} tabIndex={-1}>
          {live.error ? <>Could not load the sessions active now. <button type="button" className="linkish" onClick={retry}>Retry</button></>
            : !live.data && live.loading ? "Checking for active sessions…"
            : n > 0 && <a href={"/live" + scope.search} onClick={appLink}>{plural(n, "session")} active now</a>}
        </p>
      </>}
    </Block>
  );
}

/** The change against the previous period with the daily cost of both (the estimated cost alone for all time), the models by
 *  estimated cost, and each token kind's share of tokens beside its share of cost. */
export function CostBlock({ usage, scope }: { usage: ApiState<UsagePayload>; scope: Scope }) {
  return (
    <Block id="cost" title="Cost" page="Cost" href={"/cost" + scope.search} state={usage}>
      {d => <>
        <div className="hint">Estimated at API list prices.</div>
        {!d.totals.requests ? noRequests : <>
          {d.previous && d.start && d.changes?.some(c => c.project === scope.project) ? <ChangeDetail d={d} name={scope.project} />
            : <Facts facts={[[usd(d.totals.cost), d.start ? `est. cost, last ${d.range} days` : "est. cost, all time"]]} />}
          <h3>Models by estimated cost</h3>
          <ModelLedger key={scope.search} models={d.models} by="cost" />
          <h3>Tokens beside cost</h3>
          <TokenPairs t={d.totals} />
        </>}
      </>}
    </Block>
  );
}

/** The eight most expensive sessions; a row opens its session sheet over the page. */
export function SessionsBlock({ usage, scope }: { usage: ApiState<UsagePayload>; scope: Scope }) {
  return (
    <Block id="sessions" title="Sessions" page="Activity" href={"/usage" + scope.search} state={usage}>
      {d => !d.totals.requests ? noRequests : <>
        <div className="hint">The eight most expensive sessions of the project in this view. Select one for details.</div>
        <TopSessions top={d.top_sessions.slice(0, 8)} onSession={openSessionSheet} />
      </>}
    </Block>
  );
}

/** The project's failed calls, their rate and the top error types, as the Errors page counts them by default. */
export function ErrorsBlock({ errors, scope }: { errors: ApiState<ErrorsPayload>; scope: Scope }) {
  const model = useMemo(() => (errors.data ? makeModel(errors.data) : undefined), [errors.data]);
  const b = useMemo(() => (model ? errorsBlock(model, scope) : undefined), [model, scope.project, scope.range, scope.source]);
  const state: ApiState<NonNullable<typeof b>> = { ...errors, data: b };
  return (
    <Block id="errors" title="Errors" page="Errors" href={errorsHref(scope.project, scope.range, undefined, { source: scope.source })} state={state}>
      {e => <>
        {!scope.auto && <div className="hint">Errors counts automated sessions too, whatever the filter says.</div>}
        {e.errors === 0 ? <p className="empty">No errors in this view.</p> : <>
          <Facts facts={[[num(e.errors), "failed tool calls"], [e.rate == null ? "n/a" : `${num(e.rate, 1)}%`, `error rate, ${num(e.calls)} calls`]]} />
          <DataTable name="Top error types">
            <thead><tr><th scope="col">Type</th><th scope="col" className="num">Errors</th><th scope="col" className="num">Rate</th><th scope="col" className="num">Change {e.cmp}</th></tr></thead>
            <tbody>{e.types.map(t => <tr key={t.cid} {...subjectAttrs("category", t.cid)}>
              <th scope="row" className="name"><a href={errorsHref(scope.project, scope.range, undefined, { source: scope.source, cat: t.cid })} onClick={appLink}>{t.label}</a></th>
              <td className="num">{num(t.n)}</td><td className="num">{t.rate == null ? "–" : `${num(t.rate, 2)}%`}</td>
              <td className={"num " + t.delta.cls}>{t.delta.title
                ? <Toggletip className="chg" label={t.delta.text} name={`Change: ${t.delta.text}`}>{t.delta.title}</Toggletip> : t.delta.text}</td></tr>)}</tbody>
          </DataTable>
        </>}
      </>}
    </Block>
  );
}

/** Starting context, its share of the window, growth per prompt, turns to the first compaction, and the sessions near the limit.
 *  Measure now shows for a project with Claude Code sessions in the view, or with a snapshot already. */
export function ContextBlock({ context, usage, scope }: { context: ApiState<ContextPayload>; usage: ApiState<UsagePayload>; scope: Scope }) {
  const na = (v: ReactNode) => v ?? "n/a";
  const claude = !!usage.data?.daily_sources.some(r => r.source === "claude");
  return (
    <Block id="context" title="Context" page="Context" href={"/context" + scope.search} state={context} also={[usage]}>
      {c => <>
        <ContextGrid model={contextGrid(c)} snapshot={c.overhead} />
        <Facts facts={[
        [c.starting.median == null ? "n/a" : big(c.starting.median), "median starting context, tokens"],
        [c.starting.window_share == null ? "n/a" : share(c.starting.window_share), "of the window at the start"],
        [c.growth.added_per_prompt == null ? "n/a" : big(c.growth.added_per_prompt), "tokens added per prompt"],
        [c.growth.to_compaction.turns == null ? "n/a" : num(c.growth.to_compaction.turns), "turns to the first compaction"],
        [na(usage.data && num(usage.data.totals.near_limit)), "sessions near the context limit"],
      ]} />
        {(claude || c.overhead) && <MeasureNow key={scope.project} project={scope.project} />}
      </>}
    </Block>
  );
}

/** How many sessions /insights analysed, their outcomes and the top friction; a model's judgment, so tagged as on Activity's
 *  Judgments view, which it opens. With the source on Codex alone there is no such view, as Activity's switch says: the block
 *  says why in the link's place. */
export function InsightsBlock({ insights, scope }: { insights: ApiState<InsightsPayload>; scope: Scope }) {
  const href = judgmentsHref({ project: scope.project, range: scope.range, source: scope.source, automated: scope.auto });
  // On Codex alone the page asks for no judgments; figures kept from another source must not show under it.
  const codex = scope.source === "codex";
  return (
    <Block id="insights" title="Session judgments" page="Judgments" href={href} off={codex ? NO_FACETS : undefined}
      state={codex ? { ...insights, data: undefined, error: undefined, loading: false } : insights}>
      {d => {
        const c = d.coverage, n = c.facets, top = d.friction_families.slice(0, FRICTION_TOP), max = top[0]?.n ?? 0;
        if (!c.analysed) return <p className="empty">No session is analysed by <code>/insights</code> in this view.</p>;
        return <>
          <p className="blk-lede"><b>{num(c.analysed)} of {num(c.claude_sessions)}</b> Claude Code sessions analysed <Judged /></p>
          <h3>Outcomes</h3>
          <Ledger empty="No outcomes in this view.">{d.outcomes.map(o => <LedgerRow key={o.name} name={outcomeLabel(o.name)} title={o.name}
            share={n ? o.n / n : 0} value={pct(n ? o.n / n : 0)} side={num(o.n)} />)}</Ledger>
          <h3>Top friction</h3>
          <Ledger empty="No friction reported in this view.">{top.map(f => <LedgerRow key={f.family} name={facetLabel(f.family)} title={f.family}
            share={max ? f.n / max : 0} value={num(f.n)} side={plural(f.sessions, "session")} />)}</Ledger>
        </>;
      }}
    </Block>
  );
}

/** The project's share of each open window that names it, and its commits per point. Left out when there is nothing to show. */
export function LimitsBlock({ limits, scope }: { limits: ApiState<LimitsPayload>; scope: Scope }) {
  const b = useMemo(() => (limits.data ? limitsBlock(limits.data, scope.project) : undefined), [limits.data, scope.project]);
  // Nothing until the data is in: the block shows with rows, or with its error and Retry.
  if (!limits.error && !b) return null;
  const state: ApiState<NonNullable<typeof b>> = { ...limits, data: b ?? undefined };
  return (
    <Block id="limits" title="Plan limits" page="Limits" href={"/limits" + scope.search} state={state}>
      {l => <>
        {l.windows.length > 0 && <>
          <h3>Share of each open window</h3>
          <Ledger empty="">{l.windows.map(w => <LedgerRow key={w.key} name={w.name} share={w.share} value={sharePct(w.share)}
            side={w.points != null ? `≈ ${num(w.points, 1)} points` : ""} />)}</Ledger>
        </>}
        {l.commits.length > 0 && <>
          <h3>Commits per point</h3>
          <DataTable name="Commits per point">
            <thead><tr><th scope="col">Limit</th><th scope="col" className="num">Points</th><th scope="col" className="num">Commits</th><th scope="col" className="num">Commits a point</th></tr></thead>
            <tbody>{l.commits.map(c => <tr key={c.key}><th scope="row">{c.name}</th><td className="num">{num(c.points, 1)}</td><td className="num">{num(c.commits)}</td>
              <td className="num">{num(c.commitsPerPoint, 2)}</td></tr>)}</tbody>
          </DataTable>
        </>}
      </>}
    </Block>
  );
}
