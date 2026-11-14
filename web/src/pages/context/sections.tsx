// Context's sections: starting context, growth, what fills context and cost.
import type { ContextPayload, FillRow } from "../../api";
import { DataTable } from "../../components/DataTable";
import { openProjectSheet, openToolSheet, pickRow } from "../../components/sheets/session";
import { Toggletip } from "../../components/Toggletip";
import { dur, num, pct, plural, usd, usd0 } from "../../format";
import { Proj, Est } from "./cells";
import { CacheChart } from "./CacheChart";
import { CURVE_MIN_SESSIONS, bytes, START_LARGE_TOKENS, short } from "./context";
import { Contributors } from "./Contributors";
import { GrowthChart } from "./GrowthChart";
import { PressureBars } from "./PressureBars";
import { SessionMap } from "./SessionMap";
import { StartRanges } from "./StartRanges";
import { StartTrend } from "./StartTrend";

type D = ContextPayload;

/** Each session's first turn: the range of the start per project (10th to 90th percentile), the share of the window, and the weekly trend. */
export function Starting({ d }: { d: D }) {
  const s = d.starting, c = d.coverage;
  return (
    <section className="panel sect" id="starting" aria-labelledby="startTitle">
      <h2 id="startTitle">Starting context</h2>
      <div className="hint">The prompt tokens of each session's first turn: what the model read before any work, from the system prompt and tool definitions to the project's instructions.
        The median is the typical start; the 10th percentile approximates the fixed overhead, since the sessions with the smallest first prompt start with little else.
        The bar spans the 10th to the 90th percentile, with a tick at the median; the dashed line is the {short(START_LARGE_TOKENS)}-token mark the large-start tip uses.
        {" "}{num(s.sessions)} of {plural(c.sessions, "session")} in this view have a measured start; {num(c.with_window)} have a known window, which is all a share of the window can cover.</div>
      <StartRanges starting={s} />
      {s.trend.length > 0 && <><h3>Median start by week</h3><StartTrend trend={s.trend} /></>}
    </section>
  );
}

const Tile = ({ v, unit, l, dsc }: { v: string; unit?: string; l: string; dsc: string }) =>
  <div className="vital"><div className="v">{v}{unit && <small> {unit}</small>}</div><div className="l">{l}</div><div className="d">{dsc}</div></div>;

/** How fast context grows and how far sessions get before the first compaction. */
export function Growth({ d }: { d: D }) {
  const g = d.growth, tc = g.to_compaction, c = d.coverage, by = g.by_project;
  const tiles = tc.sessions > 0;
  return (
    <section className="panel sect" id="growth" aria-labelledby="growthTitle">
      <h2 id="growthTitle">Growth</h2>
      <div className="hint">The median context at each turn of a session, over the sessions that reach it. A point needs at least {CURVE_MIN_SESSIONS} sessions, so a curve stops where they run out.
        The strip under the chart counts how many sessions each turn rests on; the switch above it shows the curve as a share of the model's window instead of tokens.</div>
      {g.curve.length ? <GrowthChart curve={g.curve} projects={g.by_project_curves} share={g.share_curve} />
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
      {by.length > 1 && <DataTable name="Growth by project">
        <thead><tr><th scope="col">Project</th><th scope="col" className="num">Sessions</th><th scope="col" className="num">Added per prompt</th><th scope="col" className="num">Compacted</th>
          <th scope="col" className="num">Turns to first compaction</th><th scope="col" className="num">Active time to it</th></tr></thead>
        <tbody>{by.map(p => <tr key={`project:${p.project ?? ""}`} {...(p.project ? pickRow(p.project, v => openProjectSheet(v)) : {})}>
          <th scope="row" className="name"><Proj project={p.project} button={!!p.project} /></th><td className="num">{num(p.sessions)}</td><td className="num">{num(p.added_per_prompt)}</td>
          <td className="num">{num(p.compacted)}</td><td className="num">{num(p.turns_to_compaction)}</td>
          <td className="num">{p.minutes_to_compaction == null ? "–" : dur(p.minutes_to_compaction * 60)}</td></tr>)}</tbody>
      </DataTable>}
    </section>
  );
}

/** How full sessions peak, by window size, and every session by its start and its peak. */
export function Pressure({ d }: { d: D }) {
  const g = d.growth, c = d.coverage, m = d.sessions_map;
  return (
    <section className="panel sect" id="pressure" aria-labelledby="pressureTitle">
      <h2 id="pressureTitle">Window pressure</h2>
      <div className="hint">How full sessions peak, by the size of their model's window: how many peaked in each band of it. {num(c.with_window)} of {plural(c.sessions, "session")} have a known window.</div>
      {g.fill.length ? <PressureBars fill={g.fill} points={m.points} /> : <p className="empty">No session in this view has a known window.</p>}
      <h3>Sessions by start and peak</h3>
      <div className="hint">Each dot is a session: how much context it started with, and how much of its window it filled at its peak.</div>
      <SessionMap map={m} />
    </section>
  );
}

/** Tool results by tool or MCP server: the main thread's summed size, with an estimated token count. */
function FillTable({ rows, head, kind }: { rows: FillRow[]; head: string; kind: "tool" | "mcp" }) {
  return <DataTable name={`Tool results ${kind === "mcp" ? "by MCP server" : "by tool"}`} region="scroll tall">
    <thead><tr><th scope="col">{head}</th><th scope="col" className="num">Calls</th><th scope="col" className="num">Median</th><th scope="col" className="num">95th percentile</th><th scope="col" className="num">Largest</th><th scope="col" className="num">Total</th>
      <th scope="col" className="num">Estimated tokens</th></tr></thead>
    <tbody>{rows.map(r => <tr key={r.name} {...pickRow(r.name, v => openToolSheet(kind, v))}>
      <th scope="row" className="name"><button type="button" className="cellbtn" title={r.name}>{r.name}</button></th>
      <td className="num">{num(r.calls)}{r.with_bytes < r.calls && <Toggletip term="calls">{num(r.with_bytes)} with a result size</Toggletip>}</td>
      <td className="num">{bytes(r.p50_bytes)}</td><td className="num">{bytes(r.p95_bytes)}</td><td className="num">{bytes(r.max_bytes)}</td><td className="num">{bytes(r.bytes)}</td>
      <td className="num"><Est tokens={r.est_tokens} /></td></tr>)}</tbody>
  </DataTable>;
}

/** What the tool results put in context: the largest contributors with the spread of their results, then every tool and MCP server, the subagents' results kept apart. */
export function Fills({ d }: { d: D }) {
  const f = d.fills, c = d.coverage;
  return (
    <section className="panel sect" id="fills" aria-labelledby="fillsTitle">
      <h2 id="fillsTitle">What fills context</h2>
      <div className="hint">The size of each main-thread tool result as the transcript stores it, summed by tool and by MCP server. Token counts are the bytes divided by 4, an estimate.
        {" "}Sizes are known for {num(c.with_bytes)} of {plural(c.calls, "completed call")}.</div>
      <Contributors fills={f} />
      {f.tools.length > 0 && <><h3>By tool</h3><FillTable rows={f.tools} head="Tool" kind="tool" /></>}
      {f.mcp.length > 0 && <><h3>By MCP server</h3><FillTable rows={f.mcp} head="MCP server" kind="mcp" /></>}
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
      <h3>Cache use over time</h3>
      <CacheChart series={c.series} />
      <h3>By project</h3>
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
