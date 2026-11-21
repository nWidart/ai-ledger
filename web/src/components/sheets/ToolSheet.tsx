import { useMemo, useRef, type ReactNode, type RefObject } from "react";
import type { RateRow, ToolKind, ToolPayload } from "../../api";
import { dayLabel, dayRange, ms, num, pct, plural, when } from "../../format";
import { agentName } from "../Filters";
import { ProjectName } from "../ProjectDot";
import { RATE_COLUMNS, SessionCell } from "../table/cells";
import { Table, type Column, type RowPick } from "../table/Table";
import { Facts, useBackTo, type BackTo } from "./ProjectSheet";
import { appLink, errorsHref, openToolSheet, sessName, shortId, utc } from "./session";

export const TOOL_KINDS: Record<ToolKind, string> = { tool: "Tool", mcp: "MCP server", skill: "Skill" };

/** Calls and the share that failed, as table cells; a failure rate over 10% reads as bad. */
export const RateCells = ({ r, n }: { r: { failure_rate: number | null }; n: number }) =>
  <><td className="num">{num(n)}</td><td className={"num" + ((r.failure_rate ?? 0) > .1 ? " bad" : "")}>{pct(r.failure_rate, 1)}</td></>;

/** "up from 5.0%" against the previous period; worse marks a move that way as bad ("unchanged" when both read the same). */
export function Vs({ cur, prev, fmt, worse }: { cur: number | null; prev: number | null | undefined; fmt: (n: number) => string; worse?: "up" | "down" }) {
  if (cur == null || prev == null) return null;
  const d = fmt(cur) === fmt(prev) ? "" : cur > prev ? "up" : "down";
  return <span className={d && d === worse ? "bad" : undefined}>, {d ? `${d} from ${fmt(prev)}` : "unchanged"}</span>;
}

/** Calls per day as stacked bars, failed at the base, in the style of the Errors sparks. */
function Days({ d }: { d: ToolPayload }) {
  const first = d.start ?? d.daily[0]!.day, by = new Map(d.daily.map(r => [r.day, r]));
  const days = dayRange(first, d.end), max = Math.max(...d.daily.map(r => r.ok + r.failed), 1);
  const W = 600, H = 56, bw = W / days.length, h = (n: number) => n / max * (H - 2);
  const firstFail = d.daily.find(r => r.failed)?.day;
  const label = `Calls per day, ${dayLabel(first)} to ${dayLabel(d.end)}: at most ${plural(max, "call")} a day`
    + (firstFail ? `, failures from ${dayLabel(firstFail)}.` : ", none failed.");
  return <div className="days">
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
      {days.map((k, i) => {
        const r = by.get(k);
        if (!r) return null;
        const x = (i * bw + bw * .1).toFixed(1), w = Math.max(1, bw * .8).toFixed(1);
        return <g key={k}><title>{`${dayLabel(k)}: ${num(r.ok)} succeeded, ${num(r.failed)} failed`}</title>
          <rect x={x} width={w} y={(H - h(r.failed)).toFixed(1)} height={h(r.failed).toFixed(1)} fill="var(--critical)" />
          <rect x={x} width={w} y={(H - h(r.failed) - h(r.ok)).toFixed(1)} height={h(r.ok).toFixed(1)} fill="var(--text-muted)" opacity=".55" /></g>;
      })}
    </svg>
    <div className="tl-key" aria-hidden="true"><span><i className="k-ok" />Succeeded</span>
      <span><i className="k-fail-box" />Failed</span></div>
  </div>;
}

const Stat = ({ v, l }: { v: ReactNode; l: ReactNode }) => <span><b>{v}</b> {l}</span>;
const rate = (r: RateRow) => `${plural(r.calls, "call")}, ${pct(r.failure_rate, 1)} failed`;
const NONE = "None in this view.";
const NAME = () => ({ className: "name" });

type ToolCalls = Pick<RateRow, "calls" | "failure_rate"> & { tool: string; p50_ms: number | null };
/** A tool's calls, failures and p50 latency; the row opens the tool's sheet. The session sheet shares them. */
export const TOOL_COLUMNS: readonly Column<ToolCalls>[] = [
  { id: "tool", header: "Tool", cellProps: NAME, cell: r => <button type="button" className="cellbtn">{r.tool}</button> },
  ...RATE_COLUMNS,
  { id: "p50", header: "p50", align: "num", cell: r => ms(r.p50_ms) },
];
export const TOOL_PICK: RowPick<ToolCalls> = { value: r => r.tool, open: v => openToolSheet("tool", v), subject: r => ({ kind: "tool", value: r.tool }) };
const PROJECT_COLUMNS: readonly Column<ToolPayload["projects"][number]>[] = [
  { id: "project", header: "Project", cellProps: NAME, cell: r => <ProjectName project={r.project} /> }, ...RATE_COLUMNS];
const PATTERN_COLUMNS: readonly Column<NonNullable<ToolPayload["patterns"]>[number]>[] = [
  { id: "pattern", header: "Pattern", cellProps: NAME, cell: r => <code>{r.pattern}</code> }, ...RATE_COLUMNS];

type Call = ToolPayload["recent"][number];
const errHref = (d: ToolPayload, ex?: string, cat?: string | null) => errorsHref(d.project, d.range, ex, { source: d.source, cat });
const recentColumns = (kind: ToolKind, d: ToolPayload): Column<Call>[] => [
  { id: "session", header: "Session", cellProps: () => ({ className: "when sess" }),
    cell: c => <SessionCell s={c} sub={<>{when(c.ts)}{c.title ? ` · ${shortId(c.session_id)}` : ""}</>} /> },
  { id: "project", header: "Project", cellProps: NAME, cell: c => <ProjectName project={c.project} /> },
  { id: "input", header: "Input", cellProps: NAME, cell: c => <><code>{c.input}</code>{kind !== "tool" && <div className="muted small">{c.tool}</div>}</> },
  { id: "result", header: <span className="sr">Result</span>, cellProps: () => ({ className: "when" }),
    cell: c => c.is_error ? <a href={errHref(d, c.id)} onClick={appLink}>In Errors</a> : <span className="muted small">{ms(c.duration_ms)}</span> },
];

export interface ToolSheetProps {
  kind: ToolKind;
  name: string;
  d: ToolPayload | undefined;
  error?: Error | undefined;
  retry: () => void;
  onSession: (id: string, el: HTMLElement) => void;
  backTo?: RefObject<BackTo | null>;
}

/** The sheet of one tool, MCP server or skill over the page's view: use, inputs, failures and recovery, recent calls. */
export function ToolSheet({ kind, name, d, error, retry, onSession, backTo }: ToolSheetProps) {
  const body = useRef<HTMLDivElement>(null);
  useBackTo(d, backTo, body);
  const recent = useMemo(() => d && recentColumns(kind, d), [kind, d]);
  const recentPick = useMemo<RowPick<Call>>(() => ({ value: c => c.id, open: (_, el, c) => onSession(c.session_id, el),
    subject: c => ({ kind: "session", value: c.session_id }) }), [onSession]);
  if (error) return <div className="empty" role="alert">Could not load this {TOOL_KINDS[kind].toLowerCase()} ({error.message}). <button type="button" className="linkish" onClick={retry}>Retry</button></div>;
  if (!d) return <div className="empty" role="status">Loading…</div>;
  const t = d.totals, p = d.previous, err = (ex?: string, cat?: string | null) => errHref(d, ex, cat);
  const hint = <div className="hint">{d.start ? `Last ${d.range} days` : "All time"}, from the range filter{d.project ? `, project ${d.project}` : ""}
    {d.source ? `, ${agentName(d.source)} only` : ""}.{p ? ` Compared with the ${d.range} days before.` : ""}
    {kind === "skill" ? " Counts the calls that invoked the skill, not the calls made while it ran." : ""}</div>;
  if (!t.calls) return <>{hint}<div className="empty">No {name} calls in this view.</div></>;
  const r = d.recovery, hasTypes = d.categories.length > 0, hasAfter = r.incidents > 0, hasLoops = d.error_loops.length > 0;
  return <div ref={body}>
    {hint}
    <Facts facts={[
      [num(t.calls), <>calls<Vs cur={t.calls} prev={p?.calls} fmt={num} /></>],
      [pct(t.failure_rate, 1), <>failed<Vs cur={t.failure_rate} prev={p?.failure_rate} fmt={n => pct(n, 1)} worse="up" /></>],
      [ms(t.p50_ms), "p50 latency"], [ms(t.p95_ms), "p95 latency"], [pct(t.subagent_share), "from subagents"],
    ]} />
    <div className="pair"><div><h3>Calls per day</h3>
      <Days d={d} /></div>
    <div><h3>Where</h3>
    <div className="statline">
      {d.sources.map(s => <span key={s.source}>{agentName(s.source)}: {rate(s)}</span>)}
      {d.threads.map(s => <span key={String(s.subagent)}>{s.subagent ? "Subagents" : "Main thread"}: {rate(s)}</span>)}
    </div>
    <Table name="Projects" rows={d.projects} columns={PROJECT_COLUMNS} rowId={r => r.project ?? ""} /></div></div>
    {d.tools && <><h3>Tools</h3><Table name="Tools" rows={d.tools} columns={TOOL_COLUMNS} rowId={r => r.tool} pick={TOOL_PICK} empty={NONE} /></>}
    {d.patterns && <><h3>Inputs</h3><Table name="Inputs" rows={d.patterns} columns={PATTERN_COLUMNS} rowId={r => r.pattern} empty={NONE} /></>}
    {d.shell && <><h3>Tests and commits</h3><div className="statline">
      <Stat v={num(d.shell.test_runs)} l={d.shell.test_runs === 1 ? "test run" : "test runs"} />
      <Stat v={pct(d.shell.pass_rate)} l="passed" />
      <Stat v={num(d.shell.commits)} l={d.shell.commits === 1 ? "commit" : "commits"} /></div></>}
    {(hasTypes || hasAfter || hasLoops) && <div className="pair">
    {hasTypes && <section aria-labelledby="tool-types"><h3 id="tool-types">Failures by type</h3>
      {d.categories.map(c => <div key={c.id ?? ""} className="tcat">
        <b>{c.label ?? "Uncategorized"}</b> <span className="muted">{plural(c.errors, "failure")}</span>
        {c.id && <> · <a href={err(undefined, c.id)} onClick={appLink}>Open in Errors</a></>}
        {c.why && <div className="muted small">{c.why}</div>}{c.fix && <div className="small">Fix: {c.fix}</div>}
      </div>)}</section>}
    {(hasAfter || hasLoops) && <div>
    {hasAfter && <><h3>After a failure</h3><div className="statline">
      <Stat v={num(r.incidents)} l={r.incidents === 1 ? "incident" : "incidents"} /><Stat v={num(r.recovered)} l="recovered" />
      <Stat v={num(r.failed_again)} l="failed again" /><Stat v={num(r.gave_up)} l="gave up" /></div></>}
    {hasLoops && <><h3>Error loops</h3>{d.error_loops.map(l => (
      <div key={l.first_id} data-v={l.first_id}>{l.tool} failed {l.failures}× in a row in{" "}
        <button type="button" className="linkish" title={l.title || l.session_id} onClick={e => onSession(l.session_id, e.currentTarget)}>{sessName(l)}</button>, {when(utc(l.start_ts))}.{" "}
        <a href={err(l.first_id)} onClick={appLink}>Open in Errors</a></div>))}</>}</div>}</div>}
    <h3>Recent calls</h3>
    <Table name="Recent calls" className="recent" rows={d.recent} columns={recent!} rowId={c => c.id} pick={recentPick} />
  </div>;
}
