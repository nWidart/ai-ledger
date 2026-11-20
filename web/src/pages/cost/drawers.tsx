import type { ReactNode } from "react";
import { type Totals, type TitledSessionRow, type View } from "../../api";
import { ExportButtons } from "../../components/ExportButtons";
import { dayStamp } from "../../components/export";
import { DataTable } from "../../components/DataTable";
import { Drawer } from "../../components/Drawer";
import { Toggletip } from "../../components/Toggletip";
import { ProjectName } from "../../components/ProjectDot";
import { openSessionSheet, pickRow, sessName, shortId } from "../../components/sheets/session";
import { big, dayLabel, dur, num, pct, plural, usd, when } from "../../format";
import { queries } from "../../queries";
import { useApi } from "../../useApi";

/** "+?" after a cost that leaves out n requests from unpriced models. */
export const Unpriced = ({ n }: { n: number }) => n ? <> <span className="chip warn" title={`${plural(n, "request")} from unpriced models`}><span aria-hidden="true">+?</span>
  <span className="sr">plus an unknown cost for {plural(n, "request")} from unpriced models</span></span></> : null;
export const NA = () => <span className="muted">n/a</span>;

/** Tokens and cache: cache efficiency, subagent and per-outcome cost, then each billed kind by estimated cost and token share. */
export function TokensDrawer({ t }: { t: Totals }) {
  const all = t.tokens || 1, known = t.cost != null;
  // Thinking is billed as output, so Output and Thinking share one cost; each row is a billed kind, biggest cost first.
  const bill = [
    { label: "Input", c: "var(--series-1)", cost: t.cost_input, tokens: t.input },
    { label: "Output + thinking", c: "var(--series-2)", cost: t.cost_output, tokens: t.output, note: `${big(t.thinking)} of the tokens are thinking, billed as output` },
    { label: "Cache read", c: "var(--series-4)", cost: t.cost_cache_read, tokens: t.cache_read },
    { label: "Cache write 5m", c: "var(--series-5)", cost: t.cost_cache_5m, tokens: t.cache_5m },
    { label: "Cache write 1h", c: "var(--series-6)", cost: t.cost_cache_1h, tokens: t.cache_1h },
  ].sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0));
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
      <dl className="totals by-kind">
        {bill.map(k => <div key={k.label}><dt><i style={{ background: k.c }} aria-hidden="true" />{k.label}</dt>
          <dd>{usd(k.cost)}<small className="cost-share">{known && t.cost ? `${pct((k.cost ?? 0) / t.cost, 1)} of ${usd(t.cost)} estimated cost` : "cost unknown"}</small>
            <small>{big(k.tokens)} tokens, {pct(k.tokens / all, 1)} of {big(t.tokens)}</small>{k.note && <small>{k.note}</small>}</dd></div>)}
        <div><dt>Requests</dt><dd>{num(t.requests)}<small>{num(t.main_requests)} from the main thread</small></dd></div>
      </dl>
    </Drawer>
  );
}

/** A value rounded to 4 decimals for export; null stays an empty cell. */
export const r4 = (n: number | null): number | null => (n == null ? null : Math.round(n * 1e4) / 1e4);
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
      <DataTable name="Most expensive sessions" region="scroll tall">
        <thead><tr><th scope="col">Session</th><th scope="col">Project</th><th scope="col" className="num opt">Active<Toggletip term="Active time">Active time: pauses over 20 minutes left out</Toggletip></th>
          <th scope="col" className="num opt">Prompts</th><th scope="col" className="num opt">Commits</th><th scope="col" className="num">Cost / commit</th><th scope="col" className="num">Est. cost</th></tr></thead>
        <tbody className={busy ? "stale" : undefined} aria-busy={busy || undefined}>
          {error ? <tr><td colSpan={7} className="empty" role="alert">Could not load sessions ({error.message}). <button type="button" className="linkish"
            onClick={retry}>Retry</button></td></tr>
            : rows.length ? rows.map(s => <tr key={s.session_id} {...pickRow(s.session_id, openSessionSheet, { kind: "session", value: s.session_id }, s.session_id === selected ? "sel" : "")}>
              <th scope="row" className="when sess"><button type="button" className="cellbtn" title={s.title || s.session_id}>{sessName(s)}</button>
                <div className="muted small">{when(s.first_ts)}{s.git_branch ? ` · ${s.git_branch}` : ""}{s.title ? ` · ${shortId(s.session_id)}` : ""}</div></th>
              <td className="name"><ProjectName project={s.project} /></td><td className="num opt">{dur(s.duration_s)}</td><td className="num opt">{num(s.prompts)}</td>
              <td className="num opt">{num(s.commits)}</td><td className="num">{s.commits && s.cost != null ? usd(s.cost / s.commits) : <NA />}</td>
              <td className="num">{usd(s.cost)}<Unpriced n={s.unpriced} /></td></tr>)
            : !busy ? <tr><td colSpan={7} className="empty">{day ? "No sessions on that day." : "No sessions in this range."}</td></tr> : null}
        </tbody>
      </DataTable>
    </Drawer>
  );
}
