import { useState, type ReactNode } from "react";
import type { ErrorLoop, HookRow, NamedRateRow, ProjectRow, ToolKind, ToolRow, UsagePayload } from "../../api";
import { useColors } from "../../colors";
import { Drawer } from "../../components/Drawer";
import { sortRows, SortTh, type SortBy } from "../../components/Sort";
import { ProjectName } from "../../components/ProjectDot";
import { Toned, ToneKey } from "../../components/tone";
import { appLink, errorsHref, openProjectSheet, openSessionSheet, openToolSheet, pickRow, sessName, shortId, utc } from "../../components/sheets/session";
import { RateCells } from "../../components/sheets/ToolSheet";
import { big, median, ms, num, pct, when } from "../../format";
import { flakyFirst, hookCommand } from "./work";

type ProjectKey = "project" | "sessions" | "tokens" | "subagent_share" | "tokens_per_prompt" | "commits" | "errors_per_100_calls" | "error_loops";

/** Project metrics, work columns: sessions, tokens, subagents, tokens per prompt, commits, errors per 100 calls, error loops.
 *  Sorted in the browser (every project is loaded), sessions first. */
export function ProjectsDrawer({ rows: all, selected }: { rows: ProjectRow[]; selected: string }) {
  const [sort, setSort] = useState<SortBy<ProjectKey>>({ key: "sessions", desc: true });
  const rows = sortRows(all, p => p[sort.key], sort.desc), th = (k: ProjectKey, label: string, asc?: boolean) =>
    <SortTh k={k} sort={sort} onSort={setSort} asc={asc} className={k === "project" ? undefined : "num"}>{label}</SortTh>;
  const color = useColors(), many = rows.length >= 3;
  const m = { err: many ? median(rows.map(p => p.errors_per_100_calls)) : null, loops: many ? median(rows.map(p => p.error_loops)) : null };
  const maxS = Math.max(...rows.map(p => p.sessions), 0) || 1;
  return (
    <Drawer id="d-projects" title="Project metrics" count={num(rows.length)} description="Sessions, subagents, commits and errors per project">
      {many && <ToneKey />}
      <div className="scroll"><table>
        <thead><tr>{th("project", "Project", true)}{th("sessions", "Sessions")}{th("tokens", "Tokens")}{th("subagent_share", "Subagents")}{th("tokens_per_prompt", "Tokens / prompt")}
          {th("commits", "Commits")}{th("errors_per_100_calls", "Errors / 100")}{th("error_loops", "Error loops")}</tr></thead>
        <tbody>{rows.length ? rows.map(p => <tr key={p.project ?? ""} {...pickRow(p.project ?? "", v => openProjectSheet(v), p.project === selected && selected ? "sel" : "")}>
          <td className="name"><ProjectName project={p.project}><button type="button" className="cellbtn" title={p.project ?? ""}>{p.project}</button></ProjectName></td>
          <td className="num"><span className="ibar" aria-hidden="true"><i style={{ width: `${Math.max(2, p.sessions / maxS * 100)}%`, background: color(p.project) }} /></span>{num(p.sessions)}</td>
          <td className="num">{big(p.tokens)}</td><td className="num">{pct(p.subagent_share)}</td><td className="num">{big(p.tokens_per_prompt)}</td><td className="num">{num(p.commits)}</td>
          <Toned v={p.errors_per_100_calls} text={num(p.errors_per_100_calls, 1)} med={m.err} better="down" kind="ratio" medText={num(m.err, 1)} zeroText={`zero errors; median ${num(m.err, 1)} per 100 calls`} />
          <Toned v={p.error_loops} text={num(p.error_loops)} med={m.loops} better="down" kind="count" medText={num(m.loops)} />
        </tr>) : <tr><td colSpan={8} className="empty">No usage in this range.</td></tr>}</tbody>
      </table></div>
    </Drawer>
  );
}

/** Which rows a drawer shows: the range's, or one day's (on: "on Nov 4, 2026"; note: says so and offers the range back). */
export interface RowScope { on: string; note?: ReactNode }
const RANGE: RowScope = { on: "in this range" };
const None = ({ cols, on }: { cols: number; on: string }) => <tr><td colSpan={cols} className="empty">None {on}.</td></tr>;

export type ToolKey = "tool" | "calls" | "failure_rate" | "p50_ms" | "p95_ms";
/** Tools by calls, or by the chosen column (sorted in the browser: every tool is loaded); flaky, until a column is chosen:
 *  the ones failing over 10% of at least 20 calls first (from "Needs attention"). */
export function ToolsDrawer({ tools, flaky, sort, onSort, scope = RANGE }: {
  tools: ToolRow[]; flaky: boolean; sort: SortBy<ToolKey> | null; onSort: (s: SortBy<ToolKey>) => void; scope?: RowScope;
}) {
  const rs = sort ? sortRows(tools, r => r[sort.key], sort.desc) : flaky ? flakyFirst(tools) : tools;
  const th = (k: ToolKey, label: string, asc?: boolean) => <SortTh k={k} sort={sort} onSort={onSort} asc={asc} className={k === "tool" ? undefined : "num"}>{label}</SortTh>;
  return (
    <Drawer id="d-tools" title="Tools" count={num(tools.length)} description="Calls, failure rate and latency from tool_use to tool_result" bodyClassName="scroll tall">
      {scope.note}
      {flaky && !sort && <div className="hint">Tools failing over 10% of at least 20 calls first.</div>}
      <table><thead><tr>{th("tool", "Tool", true)}{th("calls", "Calls")}{th("failure_rate", "Failed")}{th("p50_ms", "p50")}{th("p95_ms", "p95")}</tr></thead>
        <tbody>{rs.length ? rs.map(r => <tr key={r.tool} {...pickRow(r.tool, v => openToolSheet("tool", v))}>
          <td className="name"><button type="button" className="cellbtn" title={r.tool}>{r.tool}</button></td><RateCells r={r} n={r.calls} />
          <td className="num">{ms(r.p50_ms)}</td><td className="num">{ms(r.p95_ms)}</td></tr>) : <None cols={5} on={scope.on} />}</tbody></table>
    </Drawer>
  );
}

export function ExtDrawer({ mcp, skills, hooks, scope = RANGE }: { mcp: NamedRateRow[]; skills: NamedRateRow[]; hooks: HookRow[]; scope?: RowScope }) {
  const rate = (title: string, head: string, kind: ToolKind, rs: NamedRateRow[]) => <div><h3>{title}</h3><div className="scroll tall"><table>
    <thead><tr><th>{head}</th><th className="num">Calls</th><th className="num">Failed</th></tr></thead>
    <tbody>{rs.length ? rs.map(r => <tr key={r.name} {...pickRow(r.name, v => openToolSheet(kind, v))}>
      <td className="name"><button type="button" className="cellbtn" title={r.name}>{r.name}</button></td><RateCells r={r} n={r.calls} /></tr>) : <None cols={3} on={scope.on} />}</tbody></table></div></div>;
  return (
    <Drawer id="d-ext" title="MCP servers, skills and hooks" count={`${num(mcp.length)}, ${num(skills.length)} and ${num(hooks.length)}`} bodyClassName="ext">
      {scope.note && <div style={{ gridColumn: "1 / -1" }}>{scope.note}</div>}
      {rate("MCP servers", "Server", "mcp", mcp)}{rate("Skills", "Skill", "skill", skills)}
      {/* Full width: hook commands are long, and many share a script and differ only by event. */}
      <div className="hooks"><h3>Hooks</h3><div className="scroll tall"><table>
        <thead><tr><th>Hook</th><th className="num">Runs</th><th className="num">Failed</th><th className="num">Avg</th></tr></thead>
        <tbody>{hooks.length ? hooks.map((r, k) => <tr key={k}><td className="name hook" title={[r.name, r.event].filter(Boolean).join(" · ")}>
          {r.name && r.name !== r.event ? <>{hookCommand(r.name)}<div className="muted small">{r.event}</div></> : r.event}</td>
          <RateCells r={r} n={r.runs} /><td className="num">{ms(r.avg_ms)}</td></tr>) : <None cols={4} on={scope.on} />}</tbody></table></div></div>
    </Drawer>
  );
}

/** Error loops: the same tool failing three or more times in a row, each linking to its first failure in Errors.
 *  loops: the newest ones the payload carries; total: every loop in the view. */
export function LoopsDrawer({ loops, total, range, scope = RANGE }: { loops: ErrorLoop[]; total: number; range: number; scope?: RowScope }) {
  return (
    <Drawer id="d-loops" title="Error loops" count={num(total)} description="Same tool failing three or more times in a row">
      {scope.note}
      <div className="hint">{loops.length < total ? `Showing the ${num(loops.length)} newest of ${num(total)}. ` : ""}Links open the first failure in the errors dashboard.</div>
      <div className="scroll tall"><table>
        <thead><tr><th>When</th><th>Project</th><th>Session</th><th>Tool</th><th className="num">Failures</th><th></th></tr></thead>
        <tbody>{loops.length ? loops.map(l => <tr key={l.first_id}><td className="when">{when(utc(l.start_ts))}</td><td className="name"><ProjectName project={l.project} /></td>
          <td className="when sess"><button type="button" className="cellbtn" data-session={l.session_id} title={l.title || l.session_id}
            onClick={() => openSessionSheet(l.session_id)}>{sessName(l)}</button>{l.title && <div className="muted small">{shortId(l.session_id)}</div>}</td>
          <td className="name" title={l.tool}>{l.tool}</td><td className="num">{num(l.failures)}</td>
          <td><a href={errorsHref(l.project, range, l.first_id)} onClick={appLink}>Open in Errors</a></td></tr>)
          : <tr><td colSpan={6} className="empty">No error loops {scope.on}.</td></tr>}</tbody>
      </table></div>
    </Drawer>
  );
}

/** Failed test and build runs, each linking to its error in Errors. tests: the newest ones the payload carries; total: every
 *  failed run in the view. */
export function TestsDrawer({ tests, total, range }: { tests: UsagePayload["failed_tests"]; total: number; range: number }) {
  return (
    <Drawer id="d-tests" title="Failed test runs" count={num(total)} description="Test and build runs that failed">
      <div className="hint">{tests.length < total ? `Showing the ${num(tests.length)} newest of ${num(total)}. ` : ""}Links open the failure in the errors dashboard.</div>
      <div className="scroll tall"><table>
        <thead><tr><th>When</th><th>Project</th><th>Session</th><th>Command</th><th></th></tr></thead>
        <tbody>{tests.length ? tests.map(t => <tr key={t.id}><td className="when">{when(t.ts)}</td><td className="name"><ProjectName project={t.project} /></td>
          <td className="when sess"><button type="button" className="cellbtn" data-session={t.session_id} title={t.title || t.session_id}
            onClick={() => openSessionSheet(t.session_id)}>{sessName(t)}</button>{t.title && <div className="muted small">{shortId(t.session_id)}</div>}</td>
          <td className="name" title={t.command}>{t.command ? <code>{t.command}</code> : "–"}</td>
          <td><a href={errorsHref(t.project, range, t.id, { source: t.source })} onClick={appLink}>Open in Errors</a></td></tr>)
          : <tr><td colSpan={5} className="empty">No failed test runs in this range.</td></tr>}</tbody>
      </table></div>
    </Drawer>
  );
}
