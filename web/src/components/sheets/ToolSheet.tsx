import { useRef, type ReactNode, type RefObject } from "react";
import type { RateRow, ToolKind, ToolPayload } from "../../api";
import { dayLabel, dayRange, ms, num, pct, plural, when } from "../../format";
import { agentName } from "../Filters";
import { ProjectName } from "../ProjectDot";
import { Facts, useBackTo, type BackTo } from "./ProjectSheet";
import { appLink, errorsHref, openToolSheet, pickRow, sessName, shortId, utc } from "./session";

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
    <div className="tl-key" aria-hidden="true"><span><i style={{ width: 10, height: 10, background: "var(--text-muted)", opacity: .55 }} />Succeeded</span>
      <span><i style={{ width: 10, height: 10, background: "var(--critical)" }} />Failed</span></div>
  </div>;
}

const Stat = ({ v, l }: { v: ReactNode; l: ReactNode }) => <span><b>{v}</b> {l}</span>;
const rate = (r: RateRow) => `${plural(r.calls, "call")}, ${pct(r.failure_rate, 1)} failed`;
const None = ({ cols }: { cols: number }) => <tr><td colSpan={cols} className="empty">None in this view.</td></tr>;

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
  if (error) return <div className="empty" role="alert">Could not load this {TOOL_KINDS[kind].toLowerCase()} ({error.message}). <button type="button" className="linkish" onClick={retry}>Retry</button></div>;
  if (!d) return <div className="empty" role="status">Loading…</div>;
  const t = d.totals, p = d.previous, err = (ex?: string, cat?: string | null) => errorsHref(d.project, d.range, ex, { source: d.source, cat });
  const hint = <div className="hint">{d.start ? `Last ${d.range} days` : "All time"}, from the range filter{d.project ? `, project ${d.project}` : ""}
    {d.source ? `, ${agentName(d.source)} only` : ""}.{p ? ` Compared with the ${d.range} days before.` : ""}
    {kind === "skill" ? " Counts the calls that invoked the skill, not the calls made while it ran." : ""}</div>;
  if (!t.calls) return <>{hint}<div className="empty">No {name} calls in this view.</div></>;
  const r = d.recovery;
  return <div ref={body}>
    {hint}
    <Facts facts={[
      [num(t.calls), <>calls<Vs cur={t.calls} prev={p?.calls} fmt={num} /></>],
      [pct(t.failure_rate, 1), <>failed<Vs cur={t.failure_rate} prev={p?.failure_rate} fmt={n => pct(n, 1)} worse="up" /></>],
      [ms(t.p50_ms), "p50 latency"], [ms(t.p95_ms), "p95 latency"], [pct(t.subagent_share), "from subagents"],
    ]} />
    <h3>Calls per day</h3>
    <Days d={d} />
    <h3>Where</h3>
    <div className="statline">
      {d.sources.map(s => <span key={s.source}>{agentName(s.source)}: {rate(s)}</span>)}
      {d.threads.map(s => <span key={String(s.subagent)}>{s.subagent ? "Subagents" : "Main thread"}: {rate(s)}</span>)}
    </div>
    <div className="scroll"><table><thead><tr><th>Project</th><th className="num">Calls</th><th className="num">Failed</th></tr></thead>
      <tbody>{d.projects.map(r => <tr key={r.project ?? ""}><td className="name"><ProjectName project={r.project} /></td><RateCells r={r} n={r.calls} /></tr>)}</tbody></table></div>
    {d.tools && <><h3>Tools</h3><div className="scroll"><table>
      <thead><tr><th>Tool</th><th className="num">Calls</th><th className="num">Failed</th><th className="num">p50</th></tr></thead>
      <tbody>{d.tools.length ? d.tools.map(r => <tr key={r.tool} {...pickRow(r.tool, v => openToolSheet("tool", v))}>
        <td className="name"><button type="button" className="cellbtn">{r.tool}</button></td><RateCells r={r} n={r.calls} /><td className="num">{ms(r.p50_ms)}</td></tr>)
        : <None cols={4} />}</tbody></table></div></>}
    {d.patterns && <><h3>Inputs</h3><div className="scroll"><table>
      <thead><tr><th>Pattern</th><th className="num">Calls</th><th className="num">Failed</th></tr></thead>
      <tbody>{d.patterns.length ? d.patterns.map(r => <tr key={r.pattern}><td className="name"><code>{r.pattern}</code></td><RateCells r={r} n={r.calls} /></tr>)
        : <None cols={3} />}</tbody></table></div></>}
    {d.shell && <><h3>Tests and commits</h3><div className="statline">
      <Stat v={num(d.shell.test_runs)} l={d.shell.test_runs === 1 ? "test run" : "test runs"} />
      <Stat v={pct(d.shell.pass_rate)} l="passed" />
      <Stat v={num(d.shell.commits)} l={d.shell.commits === 1 ? "commit" : "commits"} /></div></>}
    {d.categories.length > 0 && <section aria-labelledby="tool-types"><h3 id="tool-types">Failures by type</h3>
      {d.categories.map(c => <div key={c.id ?? ""} className="tcat">
        <b>{c.label ?? "Uncategorized"}</b> <span className="muted">{plural(c.errors, "failure")}</span>
        {c.id && <> · <a href={err(undefined, c.id)} onClick={appLink}>Open in Errors</a></>}
        {c.why && <div className="muted small">{c.why}</div>}{c.fix && <div className="small">Fix: {c.fix}</div>}
      </div>)}</section>}
    {r.incidents > 0 && <><h3>After a failure</h3><div className="statline">
      <Stat v={num(r.incidents)} l={r.incidents === 1 ? "incident" : "incidents"} /><Stat v={num(r.recovered)} l="recovered" />
      <Stat v={num(r.failed_again)} l="failed again" /><Stat v={num(r.gave_up)} l="gave up" /></div></>}
    {d.error_loops.length > 0 && <><h3>Error loops</h3>{d.error_loops.map(l => (
      <div key={l.first_id} data-v={l.first_id}>{l.tool} failed {l.failures}× in a row in{" "}
        <button type="button" className="linkish" title={l.title || l.session_id} onClick={e => onSession(l.session_id, e.currentTarget)}>{sessName(l)}</button>, {when(utc(l.start_ts))}.{" "}
        <a href={err(l.first_id)} onClick={appLink}>Open in Errors</a></div>))}</>}
    <h3>Recent calls</h3>
    <div className="scroll"><table className="recent"><thead><tr><th>Session</th><th>Project</th><th>Input</th><th></th></tr></thead>
      <tbody>{d.recent.map(c => <tr key={c.id} {...pickRow(c.id, (_, el) => onSession(c.session_id, el))}>
        <td className="when sess"><button type="button" className="cellbtn" title={c.title || c.session_id}>{sessName(c)}</button>
          <div className="muted small">{when(c.ts)}{c.title ? ` · ${shortId(c.session_id)}` : ""}</div></td>
        <td className="name"><ProjectName project={c.project} /></td>
        <td className="name"><code>{c.input}</code>{kind !== "tool" && <div className="muted small">{c.tool}</div>}</td>
        <td className="when">{c.is_error ? <a href={err(c.id)} onClick={appLink}>In Errors</a> : <span className="muted small">{ms(c.duration_ms)}</span>}</td></tr>)}</tbody></table></div>
  </div>;
}
