// Context's sections: starting context, growth, what fills context and cost.
import type { ContextPayload, FillRow } from "../../api";
import { useColors } from "../../colors";
import { DataTable } from "../../components/DataTable";
import { openProjectSheet, openToolSheet, pickRow } from "../../components/sheets/session";
import { Toggletip } from "../../components/Toggletip";
import { dur, num, pct, plural, usd, usd0 } from "../../format";
import { Proj, Est } from "./cells";
import { FillBars, StartTrend } from "./Charts";
import { CURVE_MIN_SESSIONS, bytes, share, windowLabel } from "./context";
import { GrowthChart } from "./GrowthChart";

type D = ContextPayload;

/** The share bar inside a table cell. */
const Ibar = ({ share, color }: { share: number; color?: string }) =>
  <span className="ibar" aria-hidden="true"><i style={{ width: `${Math.max(2, share * 100)}%`, ...(color ? { background: color } : {}) }} /></span>;

/** Each session's first turn: the median and 10th percentile per project, the share of the window, and the weekly trend. */
export function Starting({ d }: { d: D }) {
  const color = useColors(), s = d.starting, c = d.coverage, max = Math.max(...s.by_project.map(p => p.median), 1);
  return (
    <section className="panel sect" id="starting" aria-labelledby="startTitle">
      <h2 id="startTitle">Starting context</h2>
      <div className="hint">The prompt tokens of each session's first turn: what the model read before any work, from the system prompt and tool definitions to the project's instructions.
        The median is the typical start; the 10th percentile approximates the fixed overhead, since the sessions with the smallest first prompt start with little else.
        {" "}{num(s.sessions)} of {plural(c.sessions, "session")} in this view have a measured start; {num(c.with_window)} have a known window, which is all a share of the window can cover.</div>
      {s.by_project.length ? <DataTable name="Starting context by project">
        <thead><tr><th scope="col">Project</th><th scope="col" className="num">Median</th><th scope="col" className="num">10th percentile</th>
          <th scope="col" className="num">Share of window</th><th scope="col" className="num">Sessions</th></tr></thead>
        <tbody>
          {s.by_project.length > 1 && <tr key="total" className="all"><th scope="row" className="name">Whole view</th><td className="num">{num(s.median)}</td><td className="num">{num(s.p10)}</td>
            <td className="num">{share(s.window_share)}</td><td className="num">{num(s.sessions)}</td></tr>}
          {s.by_project.map(p => <tr key={`project:${p.project ?? ""}`} {...(p.project ? pickRow(p.project, v => openProjectSheet(v)) : {})}>
            <th scope="row" className="name"><Proj project={p.project} button={!!p.project} /></th>
            <td className="num"><Ibar share={p.median / max} color={color(p.project)} />{num(p.median)}</td><td className="num">{num(p.p10)}</td>
            <td className="num">{share(p.window_share)}{p.window != null && p.window_share != null && <span className="muted small"> of {windowLabel(p.window)}</span>}</td>
            <td className="num">{num(p.sessions)}</td></tr>)}
        </tbody>
      </DataTable> : <p className="empty">No session in this view has a measured start.</p>}
      {s.trend.length > 1 && <><h3>Median start by week</h3><StartTrend trend={s.trend} /></>}
    </section>
  );
}

const Tile = ({ v, unit, l, dsc }: { v: string; unit?: string; l: string; dsc: string }) =>
  <div className="vital"><div className="v">{v}{unit && <small> {unit}</small>}</div><div className="l">{l}</div><div className="d">{dsc}</div></div>;

/** How fast context grows, how far sessions get before the first compaction, and how full they peak. */
export function Growth({ d }: { d: D }) {
  const g = d.growth, tc = g.to_compaction, c = d.coverage, by = g.by_project;
  const tiles = tc.sessions > 0;
  return (
    <section className="panel sect" id="growth" aria-labelledby="growthTitle">
      <h2 id="growthTitle">Growth</h2>
      <div className="hint">The median context at each turn of a session, over the sessions that reach it. A point needs at least {CURVE_MIN_SESSIONS} sessions, so a curve stops where they run out.</div>
      {g.curve.length ? <GrowthChart curve={g.curve} projects={g.by_project_curves} />
        : <p className="empty">No turn is shared by {CURVE_MIN_SESSIONS} or more sessions in this view, so there is no curve yet.</p>}
      <div className="vitals" style={{ ["--n" as string]: tiles ? 4 : 1 }}>
        <Tile v={num(g.added_per_prompt)} unit="tokens" l="Added per prompt" dsc="Median per session: the rises between turns over its prompts. A fall, as after a compaction, adds nothing." />
        {tiles && <>
          <Tile v={num(tc.sessions)} l={`${tc.sessions === 1 ? "Session" : "Sessions"} with a compaction`} dsc="With a recorded first compaction" />
          <Tile v={num(tc.turns)} unit="turns" l="Before the first compaction" dsc="Median number of turns" />
          <Tile v={dur((tc.minutes ?? 0) * 60)} l="Active time before it" dsc="Median; pauses over 20 minutes left out" />
        </>}
      </div>
      {!tiles && <p className="hint">{c.compacted > 0
        ? `${plural(c.compacted, "session")} compacted, but none has a recorded first compaction yet, so there is no way-to-compaction figure.`
        : "No session in this view compacted, so there is no figure for the way to a first compaction."}</p>}
      {tiles && by.length > 1 && <DataTable name="Growth by project">
        <thead><tr><th scope="col">Project</th><th scope="col" className="num">Sessions</th><th scope="col" className="num">Added per prompt</th><th scope="col" className="num">Compacted</th>
          <th scope="col" className="num">Turns to first compaction</th><th scope="col" className="num">Active time to it</th></tr></thead>
        <tbody>{by.map(p => <tr key={`project:${p.project ?? ""}`} {...(p.project ? pickRow(p.project, v => openProjectSheet(v)) : {})}>
          <th scope="row" className="name"><Proj project={p.project} button={!!p.project} /></th><td className="num">{num(p.sessions)}</td><td className="num">{num(p.added_per_prompt)}</td>
          <td className="num">{num(p.compacted)}</td><td className="num">{num(p.turns_to_compaction)}</td>
          <td className="num">{p.minutes_to_compaction == null ? "–" : dur(p.minutes_to_compaction * 60)}</td></tr>)}</tbody>
      </DataTable>}
      <h3>Peak fill by window size</h3>
      <div className="hint">How many sessions peaked in each fifth of their model's window. {num(c.with_window)} of {plural(c.sessions, "session")} have a known window.</div>
      {g.fill.length ? <FillBars fill={g.fill} /> : <p className="empty">No session in this view has a known window.</p>}
    </section>
  );
}

/** Tool results by tool or MCP server: the main thread's summed size, with an estimated token count. */
function FillTable({ rows, head, kind }: { rows: FillRow[]; head: string; kind: "tool" | "mcp" }) {
  const max = Math.max(...rows.map(r => r.bytes), 1);
  return <DataTable name={`Tool results ${kind === "mcp" ? "by MCP server" : "by tool"}`} region="scroll tall">
    <thead><tr><th scope="col">{head}</th><th scope="col" className="num">Calls</th><th scope="col" className="num">Median</th><th scope="col" className="num">Largest</th><th scope="col" className="num">Total</th>
      <th scope="col" className="num">Estimated tokens</th></tr></thead>
    <tbody>{rows.map(r => <tr key={r.name} {...pickRow(r.name, v => openToolSheet(kind, v))}>
      <th scope="row" className="name"><Ibar share={r.bytes / max} /><button type="button" className="cellbtn" title={r.name}>{r.name}</button></th>
      <td className="num">{num(r.calls)}{r.with_bytes < r.calls && <Toggletip term="calls">{num(r.with_bytes)} with a result size</Toggletip>}</td>
      <td className="num">{bytes(r.p50_bytes)}</td><td className="num">{bytes(r.max_bytes)}</td><td className="num">{bytes(r.bytes)}</td>
      <td className="num"><Est tokens={r.est_tokens} /></td></tr>)}</tbody>
  </DataTable>;
}

/** What the tool results put in context, by tool and MCP server, and the subagents' results kept apart. */
export function Fills({ d }: { d: D }) {
  const f = d.fills, c = d.coverage;
  return (
    <section className="panel sect" id="fills" aria-labelledby="fillsTitle">
      <h2 id="fillsTitle">What fills context</h2>
      <div className="hint">The size of each main-thread tool result as the transcript stores it, summed by tool and by MCP server. Token counts are the bytes divided by 4, an estimate.
        {" "}Sizes are known for {num(c.with_bytes)} of {plural(c.calls, "completed call")}.</div>
      <p className="lead-line">The main thread read <b>{bytes(f.main_bytes)}</b> of tool results (<Est tokens={Math.floor(f.main_bytes / 4)} />).
        Calls made inside subagent transcripts returned <b>{bytes(f.subagent_bytes)}</b> more, which never entered the main thread's context.</p>
      <h3>By tool</h3>
      {f.tools.length ? <FillTable rows={f.tools} head="Tool" kind="tool" /> : <p className="empty">No tool result with a known size in this view.</p>}
      <h3>By MCP server</h3>
      {f.mcp.length ? <FillTable rows={f.mcp} head="MCP server" kind="mcp" /> : <p className="empty">No MCP server result with a known size in this view.</p>}
    </section>
  );
}

/** Cost as the Cost page counts it: the view and each project, the cache reads and the long-prompt tier. */
export function CostSection({ d }: { d: D }) {
  const c = d.cost, rows = [{ project: "" as string | null, whole: true, ...c }, ...(c.by_project.length > 1 ? c.by_project.map(p => ({ ...p, whole: false })) : [])];
  // long_cost is null with no long-tier request and with no priced request alike; the total's null says which.
  const longCost = (r: { cost: number | null; long_cost: number | null; long_requests: number }) => (r.long_requests ? usd(r.long_cost) : r.cost == null ? "–" : usd0(0));
  return (
    <section className="panel sect" id="cost" aria-labelledby="costTitle">
      <h2 id="costTitle">Cost</h2>
      <div className="hint">Estimated at API list prices, as on the Cost page; an unpriced model reads as unknown (–), never as zero. The long-prompt tier prices the whole request higher once the prompt passes a model's threshold.</div>
      <DataTable name="Cost by project">
        <thead><tr><th scope="col">Project</th><th scope="col" className="num">Estimated cost</th><th scope="col" className="num">Cache reads</th><th scope="col" className="num">Long-prompt tier</th>
          <th scope="col" className="num">Long-tier requests</th><th scope="col" className="num">Cache-hit ratio<Toggletip term="cache-hit ratio">Cache read tokens over all prompt tokens</Toggletip></th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.whole ? "total" : `project:${r.project ?? ""}`} className={r.whole ? "all" : undefined}
          {...(!r.whole && r.project ? pickRow(r.project, v => openProjectSheet(v)) : {})}>
          <th scope="row" className="name">{r.whole ? "Whole view" : <Proj project={r.project} button={!!r.project} />}</th>
          <td className="num">{usd(r.cost)}</td><td className="num">{usd(r.cache_read_cost)}</td><td className="num">{longCost(r)}</td>
          <td className="num">{num(r.long_requests)}</td><td className="num">{pct(r.cache_hit_ratio)}</td></tr>)}</tbody>
      </DataTable>
    </section>
  );
}
