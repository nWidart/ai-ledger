import { useEffect, useRef, useState, type ReactNode } from "react";
import { sessionsUrl, type ProjectRow, type SessionsPage, type Totals, type TitledSessionRow, type View } from "../../api";
import { useColors } from "../../colors";
import { motion } from "../../components/chart";
import { Drawer } from "../../components/Drawer";
import { ProjectName } from "../../components/ProjectDot";
import { openProjectSheet, openSessionSheet, pickRow, sessName, shortId } from "../../components/sheets/session";
import { Toned, ToneKey } from "../../components/tone";
import { big, dayLabel, dur, median, mult, num, pct, plural, usd, when } from "../../format";
import { getJson } from "../../useApi";
import { KINDS } from "./cost";

const Unpriced = ({ n }: { n: number }) => n ? <> <span className="chip warn" title={`${n} requests from unpriced models`}>+?</span></> : null;
const NA = () => <span className="muted">n/a</span>;

/** Tokens and cache: cache efficiency, subagent and per-outcome cost, then every token kind with its share. */
export function TokensDrawer({ t }: { t: Totals }) {
  const all = t.tokens || 1;
  const kind: Record<string, number> = { input: t.input, text_out: t.output - t.thinking, thinking: t.thinking, cache_read: t.cache_read, cache_5m: t.cache_5m, cache_1h: t.cache_1h };
  const vitals: [string, string, string][] = [
    [pct(t.cache_hit_ratio, 1), "Cache hit", `of input tokens came from cache. ${pct(t.write_1h_share)} of cache writes use the 1-hour lifetime.`],
    [pct(t.subagent_cost_share), "Subagent cost", `of estimated cost came from subagents${t.sub_cost ? `, ${usd(t.sub_cost)}` : ""}; ${pct(t.subagent_token_share)} of tokens.`],
    [usd(t.cost_per_prompt), "Per prompt", `${big(t.tokens_per_prompt)} tokens for each of ${plural(t.prompts, "prompt")}.`],
    [t.commits ? usd(t.cost_per_commit) : "n/a", "Per commit", t.commits ? `${big(t.tokens_per_commit)} tokens for each of ${plural(t.commits, "commit")}.` : "No commits in this range."],
  ];
  return (
    <Drawer id="d-tokens" title="Tokens and cache" count={big(t.tokens)} description="Tokens by kind, cache reads and writes, per-prompt cost">
      <section className="vitals" aria-label="Efficiency">
        {vitals.map(([v, l, n]) => <div className="vital" key={l}><div className="v">{v}</div><div className="l">{l}</div><div className="d">{n}</div></div>)}
      </section>
      <dl className="totals">
        {KINDS.map(k => <div key={k.k}><dt><i style={{ background: k.c }} aria-hidden="true" />{k.label}</dt>
          <dd>{big(kind[k.k])}<small>{pct((kind[k.k] ?? 0) / all, 1)} of {big(t.tokens)} tokens</small></dd></div>)}
        <div><dt>Requests</dt><dd>{num(t.requests)}<small>{num(t.main_requests)} from the main thread</small></dd></div>
      </dl>
    </Drawer>
  );
}

/** From "Compare projects": sort by cost per commit, ring this project, and say how far it sits from the median. */
export interface CostSort { spot: string; med: number }

const cpp = (p: ProjectRow) => (p.cost != null && p.prompts ? p.cost / p.prompts : null);
const cpc = (p: ProjectRow) => (p.commits && p.cost_per_commit != null ? p.cost_per_commit : null);

/** Cost by project: cost, cost per commit and per prompt, cache hit, 1-hour writes and subagent cost share, each compared with the median project. */
export function ProjectCostDrawer({ rows, selected, sort, onSort }: { rows: ProjectRow[]; selected: string; sort: CostSort | null; onSort: (s: CostSort | null) => void }) {
  const color = useColors(), many = rows.length >= 3, el = useRef<HTMLTableSectionElement>(null);
  // Sorted by cost per commit (from "Compare projects"): highest first, projects without commits last.
  const ps = sort ? rows.slice().sort((a, b) => (cpc(b) ?? -1) - (cpc(a) ?? -1)) : rows;
  // Cost per commit only compares projects with 3+ commits, as the outlier card does.
  const m = { hit: many ? median(ps.map(p => p.cache_hit_ratio)) : null, cpp: many ? median(ps.map(cpp)) : null,
    cpc: many ? median(ps.filter(p => p.commits >= 3).map(cpc)) : null };
  const maxCost = Math.max(...ps.map(p => p.cost || 0), 0) || 1, spot = sort ? ps.find(p => p.project === sort.spot) : undefined;
  // The outlier row in view and focused, once the drawer shows it.
  useEffect(() => {
    if (!sort) return;
    const d = document.getElementById("d-projcost") as HTMLDetailsElement | null;
    if (!d) return;
    d.open = true;
    const row = el.current?.querySelector<HTMLElement>(`tr[data-v="${CSS.escape(sort.spot)}"]`);
    (row ?? d).scrollIntoView?.({ behavior: motion() ? "smooth" : "auto", block: row ? "center" : "start" });
    (row?.querySelector("button") ?? d.querySelector("summary"))?.focus({ preventScroll: true });
  }, [sort]);
  const r = spot && cpc(spot) != null && sort ? cpc(spot)! / sort.med : null;
  return (
    <Drawer id="d-projcost" title="Cost by project" count={num(rows.length)} description="Cost, cost per commit and per prompt, cache hit, 1-hour writes and subagent cost">
      {sort && <div className="proj-note" role="status"><span>Sorted by cost per commit, highest first.</span>
        {spot && <span><ProjectName project={spot.project}><b>{spot.project}</b></ProjectName>: <b>{usd(cpc(spot))}</b> per commit over {plural(spot.commits, "commit")}
          {r ? `, ${mult(r)} the median project with 3+ commits (${usd(sort.med)})` : ""}.</span>}
        <button type="button" className="linkish" onClick={() => { onSort(null); document.querySelector<HTMLElement>("#d-projcost summary")?.focus(); }}>Sort by cost again</button></div>}
      {many && <ToneKey />}
      <div className="scroll"><table>
        <thead><tr><th>Project</th><th className="num">Est. cost</th><th className="num">Tokens</th><th className="num">Cache hit</th><th className="num">1h writes</th><th className="num">Subagent cost</th>
          <th className="num">Commits</th><th className="num" aria-sort={sort ? "descending" : "none"}>Cost / commit</th><th className="num">Cost / prompt</th></tr></thead>
        <tbody ref={el}>{ps.length ? ps.map(p => <tr key={p.project ?? ""} {...pickRow(p.project ?? "", v => openProjectSheet(v),
          [p.project === selected && selected ? "sel" : "", spot === p ? "spot" : ""].filter(Boolean).join(" "))}>
          <td className="name"><ProjectName project={p.project}><button type="button" className="cellbtn" title={p.project ?? ""}>{p.project}</button></ProjectName></td>
          <td className="num"><span className="ibar" aria-hidden="true"><i style={{ width: `${Math.max(2, (p.cost || 0) / maxCost * 100)}%`, background: color(p.project) }} /></span>
            {usd(p.cost)}<Unpriced n={p.unpriced} /></td>
          <td className="num">{big(p.tokens)}</td>
          <Toned v={p.cache_hit_ratio} text={pct(p.cache_hit_ratio)} med={m.hit} better="up" kind="points" medText={pct(m.hit)} />
          <td className="num">{pct(p.write_1h_share)}</td><td className="num">{pct(p.subagent_cost_share)}</td><td className="num">{num(p.commits)}</td>
          {cpc(p) == null ? <td className="num"><NA /></td>
            : <Toned v={cpc(p)} text={usd(cpc(p))} med={p.commits >= 3 ? m.cpc : null} better="down" kind="ratio" medText={usd(m.cpc)} zeroText={`no cost; median ${usd(m.cpc)} per commit`} />}
          <Toned v={cpp(p)} text={usd(cpp(p))} med={m.cpp} better="down" kind="ratio" medText={usd(m.cpp)} zeroText={`no cost; median ${usd(m.cpp)} per prompt`} />
        </tr>) : <tr><td colSpan={9} className="empty">No usage in this range.</td></tr>}</tbody>
      </table></div>
    </Drawer>
  );
}

const byCost = (rs: TitledSessionRow[]) => rs.slice().sort((a, b) => (b.cost ?? -1) - (a.cost ?? -1));

/** The view's most expensive sessions; day: only the sessions active that day (from the chart or the peak-day card), loaded
 *  from the server and sorted by cost. */
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
      if (my === seq.current) setSt({ day, rows: byCost(d.sessions), total: d.total });
    }, (e: Error) => { if (my === seq.current) setSt({ day, error: e.message }); });
    // view is read through viewKey.
  }, [day, viewKey, tick]);
  const rows = day ? st.rows ?? [] : top, busy = !!day && !st.rows && !st.error;
  let hint: ReactNode;
  if (!day) hint = `The ${plural(top.length, "most expensive session")} in this view, by estimated cost. Select a session for details.`;
  else if (st.error) hint = "";
  else if (busy) hint = `Loading sessions active on ${dayLabel(day, true)}…`;
  else hint = `${plural(st.total ?? 0, "session")} active on ${dayLabel(day, true)}, by their estimated cost in this view${rows.length < (st.total ?? 0) ? ` (the ${num(rows.length)} newest)` : ""}. Select a session for details.`;
  return (
    <Drawer id="d-top" title="Most expensive sessions" count={num(top.length)} description="Estimated cost, duration and commits per session">
      {day && <div className="tools-row"><span className="daychip"><span>Active on {dayLabel(day, true)}</span>
        <button type="button" aria-label="Show the most expensive sessions on every day" title="Every day"
          onClick={() => { onDay(""); document.querySelector<HTMLElement>("#d-top summary")?.focus(); }}>✕</button></span></div>}
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
