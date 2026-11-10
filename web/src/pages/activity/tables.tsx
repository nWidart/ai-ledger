import type { ErrorLoop, HookRow, NamedRateRow, ProjectRow, ToolKind, ToolRow } from "../../api";
import { useColors } from "../../colors";
import { Drawer } from "../../components/Drawer";
import { ProjectName } from "../../components/ProjectDot";
import { Toned, ToneKey } from "../../components/tone";
import { appLink, errorsHref, openProjectSheet, openSessionSheet, openToolSheet, pickRow, sessName, shortId, utc } from "../../components/sheets/session";
import { RateCells } from "../../components/sheets/ToolSheet";
import { big, median, ms, num, pct, when } from "../../format";
import { flakyFirst } from "./work";

/** Project metrics, work columns: sessions, tokens, subagents, tokens per prompt, commits, errors per 100 calls, error loops. */
export function ProjectsDrawer({ rows, selected }: { rows: ProjectRow[]; selected: string }) {
  const color = useColors(), many = rows.length >= 3;
  const m = { err: many ? median(rows.map(p => p.errors_per_100_calls)) : null, loops: many ? median(rows.map(p => p.error_loops)) : null };
  const maxS = Math.max(...rows.map(p => p.sessions), 0) || 1;
  return (
    <Drawer id="d-projects" title="Project metrics" count={num(rows.length)} description="Sessions, subagents, commits and errors per project">
      {many && <ToneKey />}
      <div className="scroll"><table>
        <thead><tr><th>Project</th><th className="num">Sessions</th><th className="num">Tokens</th><th className="num">Subagents</th><th className="num">Tokens / prompt</th>
          <th className="num">Commits</th><th className="num">Errors / 100</th><th className="num">Error loops</th></tr></thead>
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

const None = ({ cols }: { cols: number }) => <tr><td colSpan={cols} className="empty">None in this range.</td></tr>;

/** Tools by calls; flaky: the ones failing over 10% of at least 20 calls first (from "Needs attention"). */
export function ToolsDrawer({ tools, flaky }: { tools: ToolRow[]; flaky: boolean }) {
  const rs = flaky ? flakyFirst(tools) : tools;
  return (
    <Drawer id="d-tools" title="Tools" count={num(tools.length)} description="Calls, failure rate and latency from tool_use to tool_result" bodyClassName="scroll tall">
      {flaky && <div className="hint">Tools failing over 10% of at least 20 calls first.</div>}
      <table><thead><tr><th>Tool</th><th className="num">Calls</th><th className="num">Failed</th><th className="num">p50</th><th className="num">p95</th></tr></thead>
        <tbody>{rs.length ? rs.map(r => <tr key={r.tool} {...pickRow(r.tool, v => openToolSheet("tool", v))}>
          <td className="name"><button type="button" className="cellbtn" title={r.tool}>{r.tool}</button></td><RateCells r={r} n={r.calls} />
          <td className="num">{ms(r.p50_ms)}</td><td className="num">{ms(r.p95_ms)}</td></tr>) : <None cols={5} />}</tbody></table>
    </Drawer>
  );
}

export function ExtDrawer({ mcp, skills, hooks }: { mcp: NamedRateRow[]; skills: NamedRateRow[]; hooks: HookRow[] }) {
  const rate = (title: string, head: string, kind: ToolKind, rs: NamedRateRow[]) => <div><h3>{title}</h3><div className="scroll tall"><table>
    <thead><tr><th>{head}</th><th className="num">Calls</th><th className="num">Failed</th></tr></thead>
    <tbody>{rs.length ? rs.map(r => <tr key={r.name} {...pickRow(r.name, v => openToolSheet(kind, v))}>
      <td className="name"><button type="button" className="cellbtn" title={r.name}>{r.name}</button></td><RateCells r={r} n={r.calls} /></tr>) : <None cols={3} />}</tbody></table></div></div>;
  return (
    <Drawer id="d-ext" title="MCP servers, skills and hooks" count={`${num(mcp.length)}, ${num(skills.length)} and ${num(hooks.length)}`} bodyClassName="grid3">
      {rate("MCP servers", "Server", "mcp", mcp)}{rate("Skills", "Skill", "skill", skills)}
      <div><h3>Hooks</h3><div className="scroll tall"><table>
        <thead><tr><th>Hook</th><th className="num">Runs</th><th className="num">Failed</th><th className="num">Avg</th></tr></thead>
        <tbody>{hooks.length ? hooks.map((r, k) => <tr key={k}><td className="name" title={[r.name, r.event].filter(Boolean).join(" · ")}>{r.name}</td>
          <RateCells r={r} n={r.runs} /><td className="num">{ms(r.avg_ms)}</td></tr>) : <None cols={4} />}</tbody></table></div></div>
    </Drawer>
  );
}

/** Error loops: the same tool failing three or more times in a row, each linking to its first failure in Errors. */
export function LoopsDrawer({ loops, range }: { loops: ErrorLoop[]; range: number }) {
  return (
    <Drawer id="d-loops" title="Error loops" count={num(loops.length)} description="Same tool failing three or more times in a row">
      <div className="hint">Links open the first failure in the errors dashboard.</div>
      <div className="scroll tall"><table>
        <thead><tr><th>When</th><th>Project</th><th>Session</th><th>Tool</th><th className="num">Failures</th><th></th></tr></thead>
        <tbody>{loops.length ? loops.map(l => <tr key={l.first_id}><td className="when">{when(utc(l.start_ts))}</td><td className="name"><ProjectName project={l.project} /></td>
          <td className="when sess"><button type="button" className="cellbtn" data-session={l.session_id} title={l.title || l.session_id}
            onClick={() => openSessionSheet(l.session_id)}>{sessName(l)}</button>{l.title && <div className="muted small">{shortId(l.session_id)}</div>}</td>
          <td className="name" title={l.tool}>{l.tool}</td><td className="num">{num(l.failures)}</td>
          <td><a href={errorsHref(l.project, range, l.first_id)} onClick={appLink}>Open in Errors</a></td></tr>)
          : <tr><td colSpan={6} className="empty">No error loops in this range.</td></tr>}</tbody>
      </table></div>
    </Drawer>
  );
}
