import { useMemo, useState } from "react";
import type { ErrorLoop, HookRow, NamedRateRow, ProjectRow, ToolKind, ToolRow, UsagePayload } from "../../api";
import { useColors } from "../../colors";
import type { SortBy } from "../../components/Sort";
import { ProjectName } from "../../components/ProjectDot";
import { tint, ToneKey, type ToneInput } from "../../components/tone";
import { appLink, errorsHref, openProjectSheet, openSessionSheet, openToolSheet, shortId, utc } from "../../components/sheets/session";
import { FAILED, RATE_COLUMNS, SessionCell } from "../../components/table/cells";
import { Table, type Column, type RowPick } from "../../components/table/Table";
import { big, median, ms, num, pct, when } from "../../format";
import { flakyFirst, hookCommand } from "./work";

const NAME = () => ({ className: "name" });

export type ProjectKey = "project" | "sessions" | "tokens" | "subagent_share" | "tokens_per_prompt" | "commits" | "errors_per_100_calls" | "error_loops";
/** Project metrics open by sessions, most first. */
export const PROJECT_SORT: SortBy<ProjectKey> = { key: "sessions", desc: true };

type ProjectColumn = Column<ProjectRow, ProjectKey>;
/** A number column tinted, weighted and marked when far from the median project, so color is never the only cue (as Toned). */
function tonedColumn(id: "errors_per_100_calls" | "error_loops", header: string, text: (p: ProjectRow) => string, tone: Omit<ToneInput, "v" | "better">): ProjectColumn {
  const at = (p: ProjectRow) => tint({ ...tone, v: p[id], better: "down" });
  return {
    id, header, align: "num", sort: "desc", value: p => p[id],
    cellProps: p => { const t = at(p); return t ? { className: t.className, title: t.title } : {}; },
    cell: p => <>{text(p)}{at(p)?.mark}</>,
  };
}
const PROJECT_PICK: RowPick<ProjectRow> = { value: p => p.project ?? "", open: v => openProjectSheet(v), subject: p => ({ kind: "project", value: p.project ?? "" }) };

/** Project metrics, work columns: sessions, tokens, subagents, tokens per prompt, commits, errors per 100 calls, error loops.
 *  Sorted in the browser (every project is loaded); sort: the page's, so the Subagents vital can set it. on: the days shown. */
export function ProjectsTable({ rows, selected, sort, onSort, on }: {
  rows: ProjectRow[]; selected: string; sort: SortBy<ProjectKey>; onSort: (s: SortBy<ProjectKey>) => void; on: string;
}) {
  const color = useColors(), many = rows.length >= 3;
  const columns = useMemo((): ProjectColumn[] => {
    const err = many ? median(rows.map(p => p.errors_per_100_calls)) : null, loops = many ? median(rows.map(p => p.error_loops)) : null;
    const maxS = Math.max(...rows.map(p => p.sessions), 0) || 1;
    return [
      { id: "project", header: "Project", sort: "asc", value: p => p.project, cellProps: NAME,
        cell: p => <ProjectName project={p.project}><button type="button" className="cellbtn" title={p.project ?? ""}>{p.project}</button></ProjectName> },
      { id: "sessions", header: "Sessions", align: "num", sort: "desc", value: p => p.sessions,
        cell: p => <><span className="ibar" aria-hidden="true"><i style={{ width: `${Math.max(2, p.sessions / maxS * 100)}%`, background: color(p.project) }} /></span>{num(p.sessions)}</> },
      { id: "tokens", header: "Tokens", align: "num", sort: "desc", value: p => p.tokens, cell: p => big(p.tokens) },
      { id: "subagent_share", header: "Subagents", align: "num", sort: "desc", value: p => p.subagent_share, cell: p => pct(p.subagent_share) },
      { id: "tokens_per_prompt", header: "Tokens / prompt", align: "num", sort: "desc", value: p => p.tokens_per_prompt, cell: p => big(p.tokens_per_prompt) },
      { id: "commits", header: "Commits", align: "num", sort: "desc", value: p => p.commits, cell: p => num(p.commits) },
      tonedColumn("errors_per_100_calls", "Errors / 100", p => num(p.errors_per_100_calls, 1),
        { med: err, kind: "ratio", medText: num(err, 1), zeroText: `zero errors; median ${num(err, 1)} per 100 calls` }),
      tonedColumn("error_loops", "Error loops", p => num(p.error_loops), { med: loops, kind: "count", medText: num(loops) }),
    ];
  }, [rows, many, color]);
  return (
    <div id="projects">
      {many && <ToneKey />}
      <Table name="Project metrics" rows={rows} columns={columns} rowId={p => p.project ?? ""} sort={sort} onSort={onSort} current={selected || null}
        pick={PROJECT_PICK} empty={<>No usage {on}.</>} />
    </div>
  );
}

export type ToolKey = "tool" | "calls" | "failure_rate" | "p50_ms" | "p95_ms";
const TOOL_COLUMNS: readonly Column<ToolRow, ToolKey>[] = [
  { id: "tool", header: "Tool", sort: "asc", value: r => r.tool, cellProps: NAME, cell: r => <button type="button" className="cellbtn" title={r.tool}>{r.tool}</button> },
  { id: "calls", header: "Calls", align: "num", sort: "desc", value: r => r.calls, cell: r => num(r.calls) },
  { ...FAILED, id: "failure_rate", sort: "desc", value: r => r.failure_rate },
  { id: "p50_ms", header: "p50", align: "num", sort: "desc", value: r => r.p50_ms, cell: r => ms(r.p50_ms) },
  { id: "p95_ms", header: "p95", align: "num", sort: "desc", value: r => r.p95_ms, cell: r => ms(r.p95_ms) },
];
const TOOL_PICK: RowPick<ToolRow> = { value: r => r.tool, open: v => openToolSheet("tool", v), subject: r => ({ kind: "tool", value: r.tool }) };

/** Tools by calls, or by the chosen column (sorted in the browser: every tool is loaded); flaky, until a column is chosen:
 *  the ones failing over 10% of at least 20 calls first (from "Needs attention"). */
export function ToolsTable({ tools, flaky, sort, onSort, on }: {
  tools: ToolRow[]; flaky: boolean; sort: SortBy<ToolKey> | null; onSort: (s: SortBy<ToolKey>) => void; on: string;
}) {
  const rows = useMemo(() => !sort && flaky ? flakyFirst(tools) : tools, [tools, flaky, sort]);
  return (
    <div id="tools">
      <h3>Tools <span className="count">{num(tools.length)}</span></h3>
      <div className="hint">Calls, failure rate and latency from tool_use to tool_result.{flaky && !sort ? " Tools failing over 10% of at least 20 calls first." : ""}</div>
      <Table name="Tools" region="scroll tall" rows={rows} columns={TOOL_COLUMNS} rowId={r => r.tool} sort={sort} onSort={onSort} pick={TOOL_PICK} empty={<>None {on}.</>} />
    </div>
  );
}

/** A named rate table's columns: the name as the row's button, its calls and the share that failed. */
const rateColumns = (head: string): readonly Column<NamedRateRow>[] => [
  { id: "name", header: head, cellProps: NAME, cell: r => <button type="button" className="cellbtn" title={r.name}>{r.name}</button> }, ...RATE_COLUMNS];
const RATE_TABLES = {
  mcp: { columns: rateColumns("Server"), pick: { value: r => r.name, open: v => openToolSheet("mcp", v), subject: r => ({ kind: "mcp", value: r.name }) } },
  skill: { columns: rateColumns("Skill"), pick: { value: r => r.name, open: v => openToolSheet("skill", v), subject: r => ({ kind: "skill", value: r.name }) } },
} satisfies Partial<Record<ToolKind, { columns: readonly Column<NamedRateRow>[]; pick: RowPick<NamedRateRow> }>>;

const hookTitle = (r: HookRow) => [r.name, r.event].filter(Boolean).join(" · ");
const HOOK_COLUMNS: readonly Column<HookRow>[] = [
  { id: "hook", header: "Hook", cellProps: r => ({ className: "name hook", title: hookTitle(r) }),
    cell: r => r.name && r.name !== r.event ? <>{hookCommand(r.name)}<div className="muted small">{r.event}</div></> : r.event },
  { id: "runs", header: "Runs", align: "num", cell: r => num(r.runs) },
  { ...FAILED, id: "failed" },
  { id: "avg", header: "Avg", align: "num", cell: r => ms(r.avg_ms) },
];

/** MCP servers and skills side by side, hooks on a full-width row below. */
export function ExtTables({ mcp, skills, hooks, on }: { mcp: NamedRateRow[]; skills: NamedRateRow[]; hooks: HookRow[]; on: string }) {
  const rate = (title: string, kind: keyof typeof RATE_TABLES, rs: NamedRateRow[]) => <div><h3>{title} <span className="count">{num(rs.length)}</span></h3>
    <Table name={title} region="scroll tall" rows={rs} columns={RATE_TABLES[kind].columns} rowId={r => r.name} pick={RATE_TABLES[kind].pick} empty={<>None {on}.</>} /></div>;
  return (
    <div className="ext" id="ext">
      {rate("MCP servers", "mcp", mcp)}{rate("Skills", "skill", skills)}
      {/* Full width: hook commands are long, and many share a script and differ only by event. */}
      <div className="hooks"><h3>Hooks <span className="count">{num(hooks.length)}</span></h3>
        <Table name="Hooks" region="scroll tall" rows={hooks} columns={HOOK_COLUMNS} rowId={(_, i) => String(i)} empty={<>None {on}.</>} /></div>
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
  const shown = useMemo(() => all ? rows : rows.slice(0, PREVIEW), [rows, all]);
  const more = rows.length > PREVIEW && <button type="button" className="linkish more" aria-expanded={all} aria-controls={id} onClick={() => setAll(!all)}>
    {all ? "Show fewer" : rows.length < total ? `Show the ${num(rows.length)} newest ${label}` : `Show all ${num(total)}`}</button>;
  const cut = (all || rows.length <= PREVIEW) && rows.length < total ? `Showing the ${num(rows.length)} newest of ${num(total)}. ` : "";
  return { shown, more, cut };
}

/** A session in a list row that opens nothing itself: its button opens the session, the short id under a titled one. It is the
 *  first column, so the row's header: a row header names only the cells after it. */
const SESSION = { id: "session", header: "Session", cellProps: () => ({ className: "when sess" }),
  cell: (s: { session_id: string; title?: string | null }) => <SessionCell s={s} data subject onOpen={openSessionSheet} sub={s.title && shortId(s.session_id)} /> } as const;
const LINK = <span className="sr">Link</span>;

type Test = UsagePayload["failed_tests"][number];
const loopColumns = (range: number): Column<ErrorLoop>[] => [
  SESSION,
  { id: "when", header: "When", cellProps: () => ({ className: "when" }), cell: l => when(utc(l.start_ts)) },
  { id: "project", header: "Project", cellProps: NAME, cell: l => <ProjectName project={l.project} /> },
  { id: "tool", header: "Tool", cellProps: l => ({ className: "name", title: l.tool }), cell: l => l.tool },
  { id: "failures", header: "Failures", align: "num", cell: l => num(l.failures) },
  { id: "link", header: LINK, cell: l => <a href={errorsHref(l.project, range, l.first_id)} onClick={appLink}>Open in Errors</a> },
];
const testColumns = (range: number): Column<Test>[] => [
  SESSION,
  { id: "when", header: "When", cellProps: () => ({ className: "when" }), cell: t => when(t.ts) },
  { id: "project", header: "Project", cellProps: NAME, cell: t => <ProjectName project={t.project} /> },
  { id: "command", header: "Command", cellProps: t => ({ className: "name", title: t.command }), cell: t => t.command ? <code>{t.command}</code> : "–" },
  { id: "link", header: LINK, cell: t => <a href={errorsHref(t.project, range, t.id, { source: t.source })} onClick={appLink}>Open in Errors</a> },
];

/** Error loops: the same tool failing three or more times in a row, each linking to its first failure in Errors. Previews the
 *  newest PREVIEW. loops: the newest ones the payload carries; total: every loop in the days shown. */
export function LoopsList({ loops, total, range, on }: { loops: ErrorLoop[]; total: number; range: number; on: string }) {
  const { shown, more, cut } = usePreview(loops, total, "loops", "loops-table");
  const columns = useMemo(() => loopColumns(range), [range]);
  return (
    <div className="preview" id="loops">
      <h3 id="loops-h" tabIndex={-1}>Error loops <span className="count">{num(total)}</span></h3>
      <div className="hint">Same tool failing three or more times in a row. {cut}Links open the first failure in Errors.</div>
      <div id="loops-table"><Table name="Error loops" region="scroll" rows={shown} columns={columns} rowId={l => l.first_id} empty={<>No error loops {on}.</>} /></div>
      {more}
    </div>
  );
}

/** Failed test and build runs, each linking to its error in Errors. Previews the newest PREVIEW. tests: the newest ones the
 *  payload carries; total: every failed run in the days shown. */
export function TestsList({ tests, total, range, on }: { tests: UsagePayload["failed_tests"]; total: number; range: number; on: string }) {
  const { shown, more, cut } = usePreview(tests, total, "runs", "tests-table");
  const columns = useMemo(() => testColumns(range), [range]);
  return (
    <div className="preview" id="tests">
      <h3 id="tests-h" tabIndex={-1}>Failed test runs <span className="count">{num(total)}</span></h3>
      <div className="hint">Test and build runs that failed. {cut}Links open the failure in Errors.</div>
      <div id="tests-table"><Table name="Failed test runs" region="scroll" rows={shown} columns={columns} rowId={t => t.id} empty={<>No failed test runs {on}.</>} /></div>
      {more}
    </div>
  );
}
