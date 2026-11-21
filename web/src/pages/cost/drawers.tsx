import type { ReactNode } from "react";
import { type Totals, type TitledSessionRow, type View } from "../../api";
import { ExportButtons } from "../../components/ExportButtons";
import { dayStamp } from "../../components/export";
import { Drawer } from "../../components/Drawer";
import { ProjectName } from "../../components/ProjectDot";
import { openSessionSheet, shortId } from "../../components/sheets/session";
import { SessionCell } from "../../components/table/cells";
import { Table, type Column, type RowPick } from "../../components/table/Table";
import { big, dayLabel, dur, num, pct, plural, usd, when } from "../../format";
import { queries } from "../../queries";
import { useApi } from "../../useApi";
import { TokenPairs } from "./TokenPairs";

/** "+?" after a cost that leaves out n requests from unpriced models. */
export const Unpriced = ({ n }: { n: number }) => n ? <> <span className="chip warn" title={`${plural(n, "request")} from unpriced models`}><span aria-hidden="true">+?</span>
  <span className="sr">plus an unknown cost for {plural(n, "request")} from unpriced models</span></span></> : null;
export const NA = () => <span className="muted">n/a</span>;

/** Tokens and cache: cache efficiency, subagent and per-outcome cost, then each billed kind's share of tokens beside its share of cost. */
export function TokensDrawer({ t }: { t: Totals }) {
  const vitals: [string, string, string][] = [
    [pct(t.cache_hit_ratio, 1), "Cache hit", `of input tokens came from cache. ${pct(t.write_1h_share)} of cache writes use the 1-hour lifetime.`],
    [pct(t.subagent_cost_share), "Subagent cost", `of estimated cost came from subagents${t.sub_cost ? `, ${usd(t.sub_cost)}` : ""}; ${pct(t.subagent_token_share)} of tokens.`],
    [usd(t.cost_per_prompt), "Per prompt", `${big(t.tokens_per_prompt)} tokens for each of ${plural(t.prompts, "prompt")}.`],
    [t.commits ? usd(t.cost_per_commit) : "n/a", "Per commit", t.commits ? `${big(t.tokens_per_commit)} tokens for each of ${plural(t.commits, "commit")}.` : "No commits in this range."],
  ];
  return (
    <Drawer id="d-tokens" title="Tokens and cache" count={big(t.tokens)} description="Estimated cost and tokens by kind, cache reads and writes, per-prompt cost">
      <section className="vitals" aria-label="Efficiency">
        {vitals.map(([v, l, n]) => <div className="vital" key={l}><div className="v">{v}</div><div className="l">{l}</div><div className="d">{n}</div></div>)}
      </section>
      <TokenPairs t={t} />
      <p className="hint requests">{plural(t.requests, "request")}, {num(t.main_requests)} from the main thread.</p>
    </Drawer>
  );
}

/** A value rounded to 4 decimals for export; null stays an empty cell. */
export const r4 = (n: number | null): number | null => (n == null ? null : Math.round(n * 1e4) / 1e4);
const NO_SESSIONS: TitledSessionRow[] = [];
const SESSION_COLUMNS: readonly Column<TitledSessionRow>[] = [
  { id: "session", header: "Session", cellProps: () => ({ className: "when sess" }),
    cell: s => <SessionCell s={s} sub={<>{when(s.first_ts)}{s.git_branch ? ` · ${s.git_branch}` : ""}{s.title ? ` · ${shortId(s.session_id)}` : ""}</>} /> },
  { id: "project", header: "Project", cellProps: () => ({ className: "name" }), cell: s => <ProjectName project={s.project} /> },
  { id: "active", header: "Active", tip: "Active time: pauses over 20 minutes left out", tipTerm: "Active time", align: "num", hide: 0, cell: s => dur(s.duration_s) },
  { id: "prompts", header: "Prompts", align: "num", hide: 0, cell: s => num(s.prompts) },
  { id: "commits", header: "Commits", align: "num", hide: 0, cell: s => num(s.commits) },
  { id: "per_commit", header: "Cost / commit", align: "num", cell: s => s.commits && s.cost != null ? usd(s.cost / s.commits) : <NA /> },
  { id: "cost", header: "Est. cost", align: "num", cell: s => <>{usd(s.cost)}<Unpriced n={s.unpriced} /></> },
];
const SESSION_PICK: RowPick<TitledSessionRow> = { value: s => s.session_id, open: openSessionSheet, subject: s => ({ kind: "session", value: s.session_id }) };
const SESSION_HEAD = ["Session id", "Title", "Project", "Started", "Branch", "Active seconds", "Prompts", "Commits", "Cost per commit (USD)", "Est. cost (USD)"];

/** The view's most expensive sessions; day: every session active that day (from the chart or the peak-day card), loaded
 *  from the server with its figures for that day, costliest first, so their costs add up to the day's bar. */
export function TopSessionsDrawer({ view, top, day, onDay, selected }: {
  view: View; top: TitledSessionRow[]; day: string; onDay: (day: string) => void; selected: string;
}) {
  // No day: nothing to fetch, and the drawer shows the view's top sessions. A new day starts with no data, so the old day's rows never show.
  const { data, error, loading, retry } = useApi(day ? queries.sessions(view, { day }) : null);
  const rows = day ? (data?.sessions ?? []) : top;
  // Loading hint and dimmed rows only while there is nothing to show yet; a background refetch keeps the rows as they are.
  const busy = loading && data === undefined;
  let hint: ReactNode;
  if (!day) hint = `The ${plural(top.length, "most expensive session")} in this view, by estimated cost. Select a session for details.`;
  else if (error) hint = "";
  else if (busy) hint = `Loading sessions active on ${dayLabel(day, true)}…`;
  else hint = `${plural(data?.total ?? 0, "session")} active on ${dayLabel(day, true)}, by their estimated cost on that day. Select a session for details.`;
  return (
    <Drawer id="d-top" title="Most expensive sessions" count={num(day ? data?.total : top.length)} description="Estimated cost, duration and commits per session">
      {(day || rows.length > 0) && <div className="tools-row">
        {day && <span className="daychip"><span>Active on {dayLabel(day, true)}</span>
          <button type="button" aria-label="Show the most expensive sessions on every day" title="Every day"
            onClick={() => { onDay(""); document.querySelector<HTMLElement>("#d-top .drawer-toggle")?.focus(); }}>✕</button></span>}
        {rows.length > 0 && <ExportButtons name={`ai-ledger-cost-sessions-${day || dayStamp()}.csv`} headers={SESSION_HEAD} rows={rows.map(s => [s.session_id, s.title ?? null,
          s.project, s.first_ts, s.git_branch, s.duration_s, s.prompts, s.commits, r4(s.commits && s.cost != null ? s.cost / s.commits : null), r4(s.cost)])} />}
      </div>}
      <div className="hint" aria-live="polite">{hint}</div>
      {/* An error replaces the rows; while loading with nothing to show, no empty state either. */}
      <Table name="Most expensive sessions" region="scroll tall" rows={error ? NO_SESSIONS : rows} columns={SESSION_COLUMNS} rowId={s => s.session_id}
        pick={SESSION_PICK} current={selected} body={{ className: busy ? "stale" : undefined, "aria-busy": busy || undefined }}
        empty={error || busy ? undefined : day ? "No sessions on that day." : "No sessions in this range."}
        after={error && <tr><td colSpan={SESSION_COLUMNS.length} className="empty" role="alert">Could not load sessions ({error.message}). <button type="button" className="linkish"
          onClick={retry}>Retry</button></td></tr>} />
    </Drawer>
  );
}
