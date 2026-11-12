import { useEffect, useRef, useState, type ReactNode } from "react";
import { sessionsUrl, type ProjectRow, type SessionsPage, type Totals, type TitledSessionRow, type View } from "../../api";
import { useColors } from "../../colors";
import { motion } from "../../components/chart";
import { ExportButtons } from "../../components/ExportButtons";
import { dayStamp } from "../../components/export";
import { Drawer } from "../../components/Drawer";
import { ProjectName } from "../../components/ProjectDot";
import { openProjectSheet, openSessionSheet, pickRow, sessName, shortId } from "../../components/sheets/session";
import { sortRows, SortTh, type SortBy } from "../../components/Sort";
import { Toned, ToneKey } from "../../components/tone";
import { big, dayLabel, dur, mult, num, pct, plural, usd, when } from "../../format";
import { getJson } from "../../useApi";
import { COMPARE_PROMPTS, OUTLIER_SHARE, perCommit, perPrompt, projectMedians } from "./insights";

const Unpriced = ({ n }: { n: number }) => n ? <> <span className="chip warn" title={`${n} requests from unpriced models`}>+?</span></> : null;
const NA = () => <span className="muted">n/a</span>;

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

/** From "Compare projects": ring this project, and say how far it sits from the median. The table is sorted by cost per commit. */
export interface CostSpot { spot: string; med: number }
export type ProjectKey = "project" | "cost" | "tokens" | "hit" | "w1h" | "sub" | "commits" | "cpc" | "cpp";
export const COST_SORT: SortBy<ProjectKey> = { key: "cost", desc: true };

/** A value rounded to 4 decimals for export; null stays an empty cell. */
const r4 = (n: number | null): number | null => (n == null ? null : Math.round(n * 1e4) / 1e4);
const PROJECT_HEAD = ["Project", "Est. cost (USD)", "Tokens", "Cache hit", "1h writes", "Subagent cost share", "Commits", "Cost per commit (USD)", "Cost per prompt (USD)"];
const SESSION_HEAD = ["Session id", "Title", "Project", "Started", "Branch", "Active seconds", "Prompts", "Commits", "Cost per commit (USD)", "Est. cost (USD)"];

const GET: Record<ProjectKey, (p: ProjectRow) => number | string | null> = {
  project: p => p.project, cost: p => p.cost, tokens: p => p.tokens, hit: p => p.cache_hit_ratio, w1h: p => p.write_1h_share,
  sub: p => p.subagent_cost_share, commits: p => p.commits, cpc: perCommit, cpp: perPrompt,
};

/** Cost by project: cost, cost per commit and per prompt, cache hit, 1-hour writes and subagent cost share, sortable by any column. The
 *  per-prompt, per-commit and cache-hit cells are compared with the median of the projects big enough to compare. */
export function ProjectCostDrawer({ rows, selected, sort, onSort, spot: pin, onSpot, smallOpen, onSmallOpen }: {
  rows: ProjectRow[]; selected: string; sort: SortBy<ProjectKey>; onSort: (s: SortBy<ProjectKey>) => void; spot: CostSpot | null; onSpot: (s: CostSpot | null) => void;
  smallOpen: boolean; onSmallOpen: (open: boolean) => void;
}) {
  const color = useColors(), el = useRef<HTMLTableSectionElement>(null);
  const sorted = sortRows(rows, GET[sort.key], sort.desc), m = projectMedians(rows), many = m.n >= 3;
  // Projects too small to compare fold into one row (3+ of them, beside at least one big one); sorting never lifts them above the big ones.
  const small = sorted.filter(p => !m.big.has(p)), fold = small.length >= 3 && m.big.size > 0;
  const head = fold ? sorted.filter(p => m.big.has(p)) : sorted, ps = fold ? [...head, ...small] : sorted;
  const forced = fold && small.some(p => (selected && p.project === selected) || p.project === pin?.spot), open = fold && (smallOpen || forced);
  const sum = (f: (p: ProjectRow) => number | null) => small.reduce((a, p) => a + (f(p) ?? 0), 0);
  const smallCost = small.every(p => p.cost == null) ? null : sum(p => p.cost); // unknown when every folded project's is
  const exported = ps.map(p => [p.project, r4(p.cost), p.tokens, r4(p.cache_hit_ratio), r4(p.write_1h_share), r4(p.subagent_cost_share), p.commits,
    r4(perCommit(p)), r4(perPrompt(p))]);
  const maxCost = Math.max(...ps.map(p => p.cost || 0), 0) || 1, spot = pin ? ps.find(p => p.project === pin.spot) : undefined;
  const th = (k: ProjectKey, label: string, asc?: boolean) =>
    <SortTh k={k} sort={sort} onSort={s => { onSort(s); onSpot(null); }} asc={asc} className={k === "project" ? undefined : "num"}>{label}</SortTh>;
  // The outlier row in view and focused, once the drawer shows it.
  useEffect(() => {
    if (!pin) return;
    const d = document.getElementById("d-projcost") as HTMLDetailsElement | null;
    if (!d) return;
    d.open = true;
    const row = el.current?.querySelector<HTMLElement>(`tr[data-v="${CSS.escape(pin.spot)}"]`);
    (row ?? d).scrollIntoView?.({ behavior: motion() ? "smooth" : "auto", block: row ? "center" : "start" });
    (row?.querySelector("button") ?? d.querySelector("summary"))?.focus({ preventScroll: true });
  }, [pin]);
  const row = (p: ProjectRow) => { const cmp = m.big.has(p); return <tr key={p.project ?? ""} {...pickRow(p.project ?? "", v => openProjectSheet(v),
          [p.project === selected && selected ? "sel" : "", spot === p ? "spot" : ""].filter(Boolean).join(" "))}>
          <td className="name"><ProjectName project={p.project}><button type="button" className="cellbtn" title={p.project ?? ""}>{p.project ?? "(no project)"}</button></ProjectName></td>
          <td className="num"><span className="ibar" aria-hidden="true"><i style={{ width: `${Math.max(2, (p.cost || 0) / maxCost * 100)}%`, background: color(p.project) }} /></span>
            {usd(p.cost)}<Unpriced n={p.unpriced} /></td>
          <td className="num">{big(p.tokens)}</td>
          <Toned v={p.cache_hit_ratio} text={pct(p.cache_hit_ratio)} med={cmp ? m.hit : null} better="up" kind="points" medText={pct(m.hit)} />
          <td className="num">{pct(p.write_1h_share)}</td><td className="num">{pct(p.subagent_cost_share)}</td><td className="num">{num(p.commits)}</td>
          {!p.commits ? <td className="num"><NA /></td> : perCommit(p) == null ? <td className="num">{usd(null)}</td>
            : <Toned v={perCommit(p)} text={usd(perCommit(p))} med={cmp && p.commits >= 3 ? m.cpc : null} better="down" kind="ratio" medText={usd(m.cpc)} zeroText={`no cost; median ${usd(m.cpc)} per commit`} />}
          <Toned v={perPrompt(p)} text={usd(perPrompt(p))} med={cmp ? m.cpp : null} better="down" kind="ratio" medText={usd(m.cpp)} zeroText={`no cost; median ${usd(m.cpp)} per prompt`} />
        </tr>; };
  const bucket = <tr key="small-projects" className="small-bucket"><td className="name"><b>Small projects ({small.length})</b>{" "}
    <button type="button" className="linkish" aria-expanded={open} disabled={forced} title={forced ? "A selected or ringed project is small" : undefined}
      onClick={() => onSmallOpen(!open)}>{open ? "Hide small projects" : `Show ${small.length} small projects`}</button></td>
    <td className="num">{usd(smallCost)}<Unpriced n={sum(p => p.unpriced)} /></td><td className="num">{big(sum(p => p.tokens))}</td>
    <td /><td /><td /><td className="num">{num(sum(p => p.commits))}</td><td /><td /></tr>;
  const r = spot && perCommit(spot) != null && pin ? perCommit(spot)! / pin.med : null;
  return (
    <Drawer id="d-projcost" title="Cost by project" count={num(rows.length)} description="Cost, cost per commit and per prompt, cache hit, 1-hour writes and subagent cost">
      {pin && <div className="proj-note" role="status"><span>Sorted by cost per commit, highest first.</span>
        {spot && <span><ProjectName project={spot.project}><b>{spot.project}</b></ProjectName>: <b>{usd(perCommit(spot))}</b> per commit over {plural(spot.commits, "commit")}
          {r ? `, ${mult(r)} the median project with 3+ commits (${usd(pin.med)})` : ""}.</span>}
        <button type="button" className="linkish" onClick={() => { onSort(COST_SORT); onSpot(null); document.querySelector<HTMLElement>("#d-projcost summary")?.focus(); }}>Sort by cost again</button></div>}
      {many && <ToneKey note={`median of the ${m.n} projects with ${pct(OUTLIER_SHARE)}+ of cost or ${COMPARE_PROMPTS}+ prompts`} />}
      {ps.length > 0 && <div className="tools-row"><ExportButtons name={`ai-ledger-cost-projects-${dayStamp()}.csv`} headers={PROJECT_HEAD} rows={exported} /></div>}
      <div className="scroll"><table>
        <thead><tr>{th("project", "Project", true)}{th("cost", "Est. cost")}{th("tokens", "Tokens")}{th("hit", "Cache hit")}{th("w1h", "1h writes")}{th("sub", "Subagent cost")}
          {th("commits", "Commits")}{th("cpc", "Cost / commit")}{th("cpp", "Cost / prompt")}</tr></thead>
        <tbody ref={el}>{ps.length ? <>{head.map(row)}{fold && bucket}{open && small.map(row)}</> : <tr><td colSpan={9} className="empty">No usage in this range.</td></tr>}</tbody>
      </table></div>
    </Drawer>
  );
}

/** The view's most expensive sessions; day: every session active that day (from the chart or the peak-day card), loaded
 *  from the server with its figures for that day, costliest first, so their costs add up to the day's bar. */
export function TopSessionsDrawer({ view, top, day, onDay, selected }: {
  view: View; top: TitledSessionRow[]; day: string; onDay: (day: string) => void; selected: string;
}) {
  const [st, setSt] = useState<{ day: string; rows?: TitledSessionRow[]; total?: number; error?: string }>({ day: "" });
  const [tick, setTick] = useState(0), seq = useRef(0);
  const viewKey = `${view.project}|${view.range}|${view.automated}|${view.source}`;
  useEffect(() => {
    const my = ++seq.current;
    if (!day) { setSt({ day: "" }); return; }
    setSt({ day });
    getJson<SessionsPage>(sessionsUrl(view, { day })).then(d => {
      if (my === seq.current) setSt({ day, rows: d.sessions, total: d.total });
    }, (e: Error) => { if (my === seq.current) setSt({ day, error: e.message }); });
    // view is read through viewKey.
  }, [day, viewKey, tick]);
  const rows = day ? st.rows ?? [] : top, busy = !!day && !st.rows && !st.error;
  let hint: ReactNode;
  if (!day) hint = `The ${plural(top.length, "most expensive session")} in this view, by estimated cost. Select a session for details.`;
  else if (st.error) hint = "";
  else if (busy) hint = `Loading sessions active on ${dayLabel(day, true)}…`;
  else hint = `${plural(st.total ?? 0, "session")} active on ${dayLabel(day, true)}, by their estimated cost on that day. Select a session for details.`;
  return (
    <Drawer id="d-top" title="Most expensive sessions" count={num(day ? st.total : top.length)} description="Estimated cost, duration and commits per session">
      {(day || rows.length > 0) && <div className="tools-row">
        {day && <span className="daychip"><span>Active on {dayLabel(day, true)}</span>
          <button type="button" aria-label="Show the most expensive sessions on every day" title="Every day"
            onClick={() => { onDay(""); document.querySelector<HTMLElement>("#d-top summary")?.focus(); }}>✕</button></span>}
        {rows.length > 0 && <ExportButtons name={`ai-ledger-cost-sessions-${day || dayStamp()}.csv`} headers={SESSION_HEAD} rows={rows.map(s => [s.session_id, s.title ?? null,
          s.project, s.first_ts, s.git_branch, s.duration_s, s.prompts, s.commits, r4(s.commits && s.cost != null ? s.cost / s.commits : null), r4(s.cost)])} />}
      </div>}
      <div className="hint" aria-live="polite">{hint}</div>
      <div className="scroll tall"><table>
        <thead><tr><th>Session</th><th>Project</th><th className="num opt" title="Active time: pauses over 20 minutes left out">Active</th><th className="num opt">Prompts</th><th className="num opt">Commits</th>
          <th className="num">Cost / commit</th><th className="num">Est. cost</th></tr></thead>
        <tbody className={busy ? "stale" : undefined} aria-busy={busy || undefined}>
          {st.error && day ? <tr><td colSpan={7} className="empty" role="alert">Could not load sessions ({st.error}). <button type="button" className="linkish"
            onClick={() => setTick(t => t + 1)}>Retry</button></td></tr>
            : rows.length ? rows.map(s => <tr key={s.session_id} {...pickRow(s.session_id, openSessionSheet, s.session_id === selected ? "sel" : "")}>
              <td className="when sess"><button type="button" className="cellbtn" title={s.title || s.session_id}>{sessName(s)}</button>
                <div className="muted small">{when(s.first_ts)}{s.git_branch ? ` · ${s.git_branch}` : ""}{s.title ? ` · ${shortId(s.session_id)}` : ""}</div></td>
              <td className="name"><ProjectName project={s.project} /></td><td className="num opt">{dur(s.duration_s)}</td><td className="num opt">{num(s.prompts)}</td>
              <td className="num opt">{num(s.commits)}</td><td className="num">{s.commits && s.cost != null ? usd(s.cost / s.commits) : <NA />}</td>
              <td className="num">{usd(s.cost)}<Unpriced n={s.unpriced} /></td></tr>)
            : !busy ? <tr><td colSpan={7} className="empty">{day ? "No sessions on that day." : "No sessions in this range."}</td></tr> : null}
        </tbody>
      </table></div>
    </Drawer>
  );
}
