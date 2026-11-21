import { useState } from "react";
import type { ErrorLoop, HookRow, NamedRateRow, ProjectRow, ToolKind, ToolRow, UsagePayload } from "../../api";
import { useColors } from "../../colors";
import { DataTable } from "../../components/DataTable";
import { subjectAttrs } from "../../components/menu/subject";
import { sortRows, SortTh, type SortBy } from "../../components/Sort";
import { ProjectName } from "../../components/ProjectDot";
import { Toned, ToneKey } from "../../components/tone";
import { appLink, errorsHref, openProjectSheet, openSessionSheet, openToolSheet, pickRow, sessName, shortId, utc } from "../../components/sheets/session";
import { RateCells } from "../../components/sheets/ToolSheet";
import { big, median, ms, num, pct, when } from "../../format";
import { flakyFirst, hookCommand } from "./work";

export type ProjectKey = "project" | "sessions" | "tokens" | "subagent_share" | "tokens_per_prompt" | "commits" | "errors_per_100_calls" | "error_loops";
/** Project metrics open by sessions, most first. */
export const PROJECT_SORT: SortBy<ProjectKey> = { key: "sessions", desc: true };

/** Project metrics, work columns: sessions, tokens, subagents, tokens per prompt, commits, errors per 100 calls, error loops.
 *  Sorted in the browser (every project is loaded); sort: the page's, so the Subagents vital can set it. on: the days shown. */
export function ProjectsTable({ rows: all, selected, sort, onSort, on }: {
  rows: ProjectRow[]; selected: string; sort: SortBy<ProjectKey>; onSort: (s: SortBy<ProjectKey>) => void; on: string;
}) {
  const rows = sortRows(all, p => p[sort.key], sort.desc), th = (k: ProjectKey, label: string, asc?: boolean) =>
    <SortTh k={k} sort={sort} onSort={onSort} asc={asc} className={k === "project" ? undefined : "num"}>{label}</SortTh>;
  const color = useColors(), many = rows.length >= 3;
  const m = { err: many ? median(rows.map(p => p.errors_per_100_calls)) : null, loops: many ? median(rows.map(p => p.error_loops)) : null };
  const maxS = Math.max(...rows.map(p => p.sessions), 0) || 1;
  return (
    <div id="projects">
      {many && <ToneKey />}
      <DataTable name="Project metrics">
        <thead><tr>{th("project", "Project", true)}{th("sessions", "Sessions")}{th("tokens", "Tokens")}{th("subagent_share", "Subagents")}{th("tokens_per_prompt", "Tokens / prompt")}
          {th("commits", "Commits")}{th("errors_per_100_calls", "Errors / 100")}{th("error_loops", "Error loops")}</tr></thead>
        <tbody>{rows.length ? rows.map(p => <tr key={p.project ?? ""} {...pickRow(p.project ?? "", v => openProjectSheet(v), { kind: "project", value: p.project ?? "" }, p.project === selected && selected ? "sel" : "")}>
          <th scope="row" className="name"><ProjectName project={p.project}><button type="button" className="cellbtn" title={p.project ?? ""}>{p.project}</button></ProjectName></th>
          <td className="num"><span className="ibar" aria-hidden="true"><i style={{ width: `${Math.max(2, p.sessions / maxS * 100)}%`, background: color(p.project) }} /></span>{num(p.sessions)}</td>
          <td className="num">{big(p.tokens)}</td><td className="num">{pct(p.subagent_share)}</td><td className="num">{big(p.tokens_per_prompt)}</td><td className="num">{num(p.commits)}</td>
          <Toned v={p.errors_per_100_calls} text={num(p.errors_per_100_calls, 1)} med={m.err} better="down" kind="ratio" medText={num(m.err, 1)} zeroText={`zero errors; median ${num(m.err, 1)} per 100 calls`} />
          <Toned v={p.error_loops} text={num(p.error_loops)} med={m.loops} better="down" kind="count" medText={num(m.loops)} />
        </tr>) : <tr><td colSpan={8} className="empty">No usage {on}.</td></tr>}</tbody>
      </DataTable>
    </div>
  );
}

const None = ({ cols, on }: { cols: number; on: string }) => <tr><td colSpan={cols} className="empty">None {on}.</td></tr>;

export type ToolKey = "tool" | "calls" | "failure_rate" | "p50_ms" | "p95_ms";
/** Tools by calls, or by the chosen column (sorted in the browser: every tool is loaded); flaky, until a column is chosen:
 *  the ones failing over 10% of at least 20 calls first (from "Needs attention"). */
export function ToolsTable({ tools, flaky, sort, onSort, on }: {
  tools: ToolRow[]; flaky: boolean; sort: SortBy<ToolKey> | null; onSort: (s: SortBy<ToolKey>) => void; on: string;
}) {
  const rs = sort ? sortRows(tools, r => r[sort.key], sort.desc) : flaky ? flakyFirst(tools) : tools;
  const th = (k: ToolKey, label: string, asc?: boolean) => <SortTh k={k} sort={sort} onSort={onSort} asc={asc} className={k === "tool" ? undefined : "num"}>{label}</SortTh>;
  return (
    <div id="tools">
      <h3>Tools <span className="count">{num(tools.length)}</span></h3>
      <div className="hint">Calls, failure rate and latency from tool_use to tool_result.{flaky && !sort ? " Tools failing over 10% of at least 20 calls first." : ""}</div>
      <DataTable name="Tools" region="scroll tall"><thead><tr>{th("tool", "Tool", true)}{th("calls", "Calls")}{th("failure_rate", "Failed")}{th("p50_ms", "p50")}{th("p95_ms", "p95")}</tr></thead>
        <tbody>{rs.length ? rs.map(r => <tr key={r.tool} {...pickRow(r.tool, v => openToolSheet("tool", v), { kind: "tool", value: r.tool })}>
          <th scope="row" className="name"><button type="button" className="cellbtn" title={r.tool}>{r.tool}</button></th><RateCells r={r} n={r.calls} />
          <td className="num">{ms(r.p50_ms)}</td><td className="num">{ms(r.p95_ms)}</td></tr>) : <None cols={5} on={on} />}</tbody></DataTable>
    </div>
  );
}

/** MCP servers and skills side by side, hooks on a full-width row below. */
export function ExtTables({ mcp, skills, hooks, on }: { mcp: NamedRateRow[]; skills: NamedRateRow[]; hooks: HookRow[]; on: string }) {
  const rate = (title: string, head: string, kind: ToolKind, rs: NamedRateRow[]) => <div><h3>{title} <span className="count">{num(rs.length)}</span></h3><DataTable name={title} region="scroll tall">
    <thead><tr><th scope="col">{head}</th><th scope="col" className="num">Calls</th><th scope="col" className="num">Failed</th></tr></thead>
    <tbody>{rs.length ? rs.map(r => <tr key={r.name} {...pickRow(r.name, v => openToolSheet(kind, v), { kind, value: r.name })}>
      <th scope="row" className="name"><button type="button" className="cellbtn" title={r.name}>{r.name}</button></th><RateCells r={r} n={r.calls} /></tr>) : <None cols={3} on={on} />}</tbody></DataTable></div>;
  return (
    <div className="ext" id="ext">
      {rate("MCP servers", "Server", "mcp", mcp)}{rate("Skills", "Skill", "skill", skills)}
      {/* Full width: hook commands are long, and many share a script and differ only by event. */}
      <div className="hooks"><h3>Hooks <span className="count">{num(hooks.length)}</span></h3><DataTable name="Hooks" region="scroll tall">
        <thead><tr><th scope="col">Hook</th><th scope="col" className="num">Runs</th><th scope="col" className="num">Failed</th><th scope="col" className="num">Avg</th></tr></thead>
        <tbody>{hooks.length ? hooks.map((r, k) => <tr key={k}><th scope="row" className="name hook" title={[r.name, r.event].filter(Boolean).join(" · ")}>
          {r.name && r.name !== r.event ? <>{hookCommand(r.name)}<div className="muted small">{r.event}</div></> : r.event}</th>
          <RateCells r={r} n={r.runs} /><td className="num">{ms(r.avg_ms)}</td></tr>) : <None cols={4} on={on} />}</tbody></DataTable></div>
    </div>
  );
}

/** The rows a preview shows before "Show all". */
export const PREVIEW = 5;

/** A list's first PREVIEW rows, or all of them once expanded, with the button that expands it (none when it holds no more)
 *  and what an expanded list cut by the payload says. rows: the newest the payload carries; total: every one in the view;
 *  label: what the list holds, for the button ("loops"); id: the list's box, which the button controls. */
function usePreview<T>(rows: readonly T[], total: number, label: string, id: string) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, PREVIEW);
  const more = rows.length > PREVIEW && <button type="button" className="linkish more" aria-expanded={all} aria-controls={id} onClick={() => setAll(!all)}>
    {all ? "Show fewer" : rows.length < total ? `Show the ${num(rows.length)} newest ${label}` : `Show all ${num(total)}`}</button>;
  const cut = (all || rows.length <= PREVIEW) && rows.length < total ? `Showing the ${num(rows.length)} newest of ${num(total)}. ` : "";
  return { shown, more, cut };
}

/** Error loops: the same tool failing three or more times in a row, each linking to its first failure in Errors. Previews the
 *  newest PREVIEW. loops: the newest ones the payload carries; total: every loop in the days shown. */
export function LoopsList({ loops, total, range, on }: { loops: ErrorLoop[]; total: number; range: number; on: string }) {
  const { shown, more, cut } = usePreview(loops, total, "loops", "loops-table");
  return (
    <div className="preview" id="loops">
      <h3 id="loops-h" tabIndex={-1}>Error loops <span className="count">{num(total)}</span></h3>
      <div className="hint">Same tool failing three or more times in a row. {cut}Links open the first failure in Errors.</div>
      <div id="loops-table"><DataTable name="Error loops" region="scroll">
        <thead><tr><th scope="col">When</th><th scope="col">Project</th><th scope="col">Session</th><th scope="col">Tool</th><th scope="col" className="num">Failures</th><th scope="col"><span className="sr">Link</span></th></tr></thead>
        <tbody>{shown.length ? shown.map(l => <tr key={l.first_id}><td className="when">{when(utc(l.start_ts))}</td><td className="name"><ProjectName project={l.project} /></td>
          <td className="when sess"><button type="button" className="cellbtn" data-session={l.session_id} {...subjectAttrs("session", l.session_id)} title={l.title || l.session_id}
            onClick={() => openSessionSheet(l.session_id)}>{sessName(l)}</button>{l.title && <div className="muted small">{shortId(l.session_id)}</div>}</td>
          <td className="name" title={l.tool}>{l.tool}</td><td className="num">{num(l.failures)}</td>
          <td><a href={errorsHref(l.project, range, l.first_id)} onClick={appLink}>Open in Errors</a></td></tr>)
          : <tr><td colSpan={6} className="empty">No error loops {on}.</td></tr>}</tbody>
      </DataTable></div>
      {more}
    </div>
  );
}

/** Failed test and build runs, each linking to its error in Errors. Previews the newest PREVIEW. tests: the newest ones the
 *  payload carries; total: every failed run in the days shown. */
export function TestsList({ tests, total, range, on }: { tests: UsagePayload["failed_tests"]; total: number; range: number; on: string }) {
  const { shown, more, cut } = usePreview(tests, total, "runs", "tests-table");
  return (
    <div className="preview" id="tests">
      <h3 id="tests-h" tabIndex={-1}>Failed test runs <span className="count">{num(total)}</span></h3>
      <div className="hint">Test and build runs that failed. {cut}Links open the failure in Errors.</div>
      <div id="tests-table"><DataTable name="Failed test runs" region="scroll">
        <thead><tr><th scope="col">When</th><th scope="col">Project</th><th scope="col">Session</th><th scope="col">Command</th><th scope="col"><span className="sr">Link</span></th></tr></thead>
        <tbody>{shown.length ? shown.map(t => <tr key={t.id}><td className="when">{when(t.ts)}</td><td className="name"><ProjectName project={t.project} /></td>
          <td className="when sess"><button type="button" className="cellbtn" data-session={t.session_id} {...subjectAttrs("session", t.session_id)} title={t.title || t.session_id}
            onClick={() => openSessionSheet(t.session_id)}>{sessName(t)}</button>{t.title && <div className="muted small">{shortId(t.session_id)}</div>}</td>
          <td className="name" title={t.command}>{t.command ? <code>{t.command}</code> : "–"}</td>
          <td><a href={errorsHref(t.project, range, t.id, { source: t.source })} onClick={appLink}>Open in Errors</a></td></tr>)
          : <tr><td colSpan={5} className="empty">No failed test runs {on}.</td></tr>}</tbody>
      </DataTable></div>
      {more}
    </div>
  );
}
