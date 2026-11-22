// Context's sections: starting context, growth, window pressure, what fills context and cost.
import { useState } from "react";
import type { ContextPayload } from "../../api";
import { HowMeasured } from "../../components/HowMeasured";
import { openProjectSheet } from "../../components/sheets/session";
import { Table, type Column, type RowPick } from "../../components/table/Table";
import { dur, num, pct, plural, usd, usd0 } from "../../format";
import { Proj } from "./cells";
import { CacheChart } from "./CacheChart";
import { CURVE_MIN_SESSIONS, QUADS, quadOf, START_LARGE_TOKENS, short, type Quad } from "./context";
import { Contributors } from "./Contributors";
import { GrowthChart } from "./GrowthChart";
import { fillOf, PressureBars } from "./PressureBars";
import { SessionMap } from "./SessionMap";
import { StartRanges } from "./StartRanges";
import { StartTrend } from "./StartTrend";

type D = ContextPayload;

/** Each session's first turn: the range of the start per project (10th to 90th percentile), the share of the window, and the weekly trend. */
export function Starting({ d, view }: { d: D; view: string }) {
  const s = d.starting, c = d.coverage;
  return (
    <section className="panel sect" id="starting" aria-labelledby="startTitle">
      <h2 id="startTitle">Starting context</h2>
      <div className="hint">What the model read before any work, per project: 10th to 90th percentile, median ticked.
        <HowMeasured what="starting context" docs="concepts/windows#the-context-window">The prompt tokens of each session's first turn, from the system prompt and tool definitions to the project's instructions.
          The median is the typical start; the 10th percentile approximates the fixed overhead, since the sessions with the smallest first prompt start with little else.
          The dashed line is the {short(START_LARGE_TOKENS)}-token mark the large-start tip uses.
          {" "}{num(s.sessions)} of {plural(c.sessions, "session")} in this view have a measured start; {num(c.with_window)} have a known window, which is all a share of the window can cover.</HowMeasured></div>
      <StartRanges starting={s} />
      {s.trend.length > 0 && <><h3>Median start by week</h3><StartTrend trend={s.trend} view={view} /></>}
    </section>
  );
}

const Tile = ({ v, unit, l, dsc }: { v: string; unit?: string; l: string; dsc: string }) =>
  <div className="vital"><div className="v">{v}{unit && <small> {unit}</small>}</div><div className="l">{l}</div><div className="d">{dsc}</div></div>;

type GrowthRow = D["growth"]["by_project"][number];
// Growth by project: a row opens the project's sheet; a row with no project opens nothing.
const PROJECT_PICK: RowPick<{ project: string | null }> = {
  value: p => p.project || null, open: v => openProjectSheet(v), subject: p => p.project ? { kind: "project", value: p.project } : undefined,
};
const GROWTH_COLUMNS: Column<GrowthRow>[] = [
  { id: "project", header: "Project", cell: p => <Proj project={p.project} button={!!p.project} />, cellProps: () => ({ className: "name" }) },
  { id: "sessions", header: "Sessions", align: "num", cell: p => num(p.sessions) },
  { id: "added", header: "Added per prompt", align: "num", cell: p => num(p.added_per_prompt) },
  { id: "compacted", header: "Compacted", align: "num", cell: p => num(p.compacted) },
  { id: "turns", header: "Turns to first compaction", align: "num", cell: p => num(p.turns_to_compaction) },
  { id: "minutes", header: "Active time to it", align: "num", cell: p => p.minutes_to_compaction == null ? "–" : dur(p.minutes_to_compaction * 60) },
];

/** How fast context grows and how far sessions get before the first compaction. */
export function Growth({ d, view }: { d: D; view: string }) {
  const g = d.growth, tc = g.to_compaction, c = d.coverage, by = g.by_project;
  const tiles = tc.sessions > 0;
  return (
    <section className="panel sect" id="growth" aria-labelledby="growthTitle">
      <h2 id="growthTitle">Growth</h2>
      <div className="hint">The median context at each turn, over the sessions that reach it.
        <HowMeasured what="growth" docs="reference/glossary#context">A point needs at least {CURVE_MIN_SESSIONS} sessions, so a curve stops where they run out.
          The strip under the chart counts how many sessions each turn rests on; the switch above it shows the curve as a share of the model's window instead of tokens.</HowMeasured></div>
      {g.curve.length ? <GrowthChart curve={g.curve} projects={g.by_project_curves} share={g.share_curve} view={view} />
        : <p className="empty">No turn is shared by {CURVE_MIN_SESSIONS} or more sessions in this view, so there is no curve yet.</p>}
      <div className="vitals" style={{ ["--n" as string]: tiles ? 4 : 2 }}>
        <Tile v={num(g.added_per_prompt)} unit="tokens" l="Added per prompt" dsc="Median per session: the rises between turns over its prompts. A fall, as after a compaction, adds nothing." />
        <Tile v={num(c.compacted)} l={`${c.compacted === 1 ? "Session" : "Sessions"} compacted`}
          dsc={`Of ${plural(c.sessions, "session")}${tiles ? `; ${num(tc.sessions)} with a recorded first compaction` : ""}`} />
        {tiles && <>
          <Tile v={num(tc.turns)} unit="turns" l="Before the first compaction" dsc="Median number of turns" />
          <Tile v={dur((tc.minutes ?? 0) * 60)} l="Active time before it" dsc="Median; pauses over 20 minutes left out" />
        </>}
      </div>
      {!tiles && <p className="hint">{c.compacted > 0
        ? `${plural(c.compacted, "session")} compacted, but none has a recorded first compaction yet, so there is no way-to-compaction figure.`
        : "No session in this view compacted, so there is no figure for the way to a first compaction."}</p>}
      {by.length > 1 && <Table name="Growth by project" rows={by} columns={GROWTH_COLUMNS} rowId={p => `project:${p.project ?? ""}`} pick={PROJECT_PICK} />}
    </section>
  );
}

/** How full sessions peak, by window size, and every session by its start and its peak. A quadrant selected on the map narrows the
 *  bars to its sessions on the map. */
export function Pressure({ d, view }: { d: D; view: string }) {
  const g = d.growth, c = d.coverage, m = d.sessions_map;
  const [quad, setQuad] = useState<Quad | null>(null);
  const q = quad && QUADS.find(x => x.id === quad)!;
  const pts = q ? m.points.filter(p => quadOf(p) === q.id) : m.points;
  const fill = q ? fillOf(pts) : g.fill;
  return (
    <section className="panel sect" id="pressure" aria-labelledby="pressureTitle">
      <h2 id="pressureTitle">Window pressure</h2>
      <div className="hint">How many sessions peaked in each band of their model's window.
        <HowMeasured what="window pressure" docs="concepts/windows#the-context-window">Sessions are grouped by the size of their model's window. {num(c.with_window)} of {plural(c.sessions, "session")} have a known window.</HowMeasured></div>
      {q && <p className="lead-line quad-note" role="status">Narrowed to <b>{q.label}</b>: {plural(pts.length, "session")} on the map with {q.what}.{" "}
        <button type="button" className="linkish" onClick={() => setQuad(null)}>Show every session</button></p>}
      {fill.length ? <PressureBars key={quad ?? ""} fill={fill} points={pts} /> : <p className="empty">{q ? `No session on the map is in ${q.label}.` : "No session in this view has a known window."}</p>}
      <h3>Sessions by start and peak</h3>
      <div className="hint">Each dot is a session: how much context it started with, and how much of its window it filled at its peak. Select a quadrant to narrow the bars above.</div>
      <SessionMap map={m} quad={quad} onQuad={setQuad} view={view} />
    </section>
  );
}

/** What the tool results put in context: the largest contributors with the spread of their results, every tool and MCP server
 *  one "Show all" away, the subagents' results kept apart. */
export function Fills({ d }: { d: D }) {
  const f = d.fills, c = d.coverage;
  return (
    <section className="panel sect" id="fills" aria-labelledby="fillsTitle">
      <h2 id="fillsTitle">What fills context</h2>
      <div className="hint">Main-thread tool result sizes, summed by tool or MCP server.
        <HowMeasured what="what fills context" docs="reference/glossary#context">Each result's size is as the transcript stores it. Token counts are the bytes divided by 4, an estimate.
          {" "}Sizes are known for {num(c.with_bytes)} of {plural(c.calls, "completed call")}.</HowMeasured></div>
      <Contributors fills={f} />
    </section>
  );
}

/** A row of Cost by project: a project's, or the whole view's. */
type CostRow = Pick<D["cost"], "cost" | "cache_read_cost" | "long_cost" | "long_requests" | "cache_hit_ratio"> & { project: string | null; whole: boolean };
// long_cost is null with no long-tier request and with no priced request alike; the total's null says which.
const longCost = (r: CostRow) => (r.long_requests ? usd(r.long_cost) : r.cost == null ? "–" : usd0(0));
const WHOLE_ROW = { className: "all" };
const COST_COLUMNS: Column<CostRow>[] = [
  { id: "project", header: "Project", cell: r => r.whole ? "Whole view" : <Proj project={r.project} button={!!r.project} />, cellProps: () => ({ className: "name" }) },
  { id: "cost", header: "Estimated cost", align: "num", cell: r => usd(r.cost) },
  { id: "cache", header: "Cache reads", align: "num", cell: r => usd(r.cache_read_cost) },
  { id: "long", header: "Long-prompt tier", align: "num", cell: longCost },
  { id: "requests", header: "Long-tier requests", align: "num", cell: r => num(r.long_requests) },
  { id: "ratio", header: "Cache-hit ratio", tip: "Cache read tokens over all prompt tokens", tipTerm: "cache-hit ratio", align: "num", cell: r => pct(r.cache_hit_ratio) },
];

/** Cost as the Cost page counts it: the view and each project, the cache reads and the long-prompt tier. */
export function CostSection({ d, view }: { d: D; view: string }) {
  const c = d.cost, whole: CostRow = { ...c, project: "", whole: true };
  return (
    <section className="panel sect" id="cost" aria-labelledby="costTitle">
      <h2 id="costTitle">Cost</h2>
      <div className="hint">Estimated at API list prices, as on the Cost page.
        <HowMeasured what="cost" docs="concepts/cost-estimates">An unpriced model reads as unknown (–), never as zero. The long-prompt tier prices the whole request higher once the prompt passes a model's threshold.</HowMeasured></div>
      <h3>Cache use over time</h3>
      <CacheChart series={c.series} view={view} />
      <h3>By project</h3>
      <Table name="Cost by project" rows={c.by_project.length > 1 ? c.by_project.map((p): CostRow => ({ ...p, whole: false })) : []} columns={COST_COLUMNS}
        rowId={r => r.whole ? "total" : `project:${r.project ?? ""}`} pinned={[whole]} pick={PROJECT_PICK} rowProps={r => r.whole ? WHOLE_ROW : {}} />
    </section>
  );
}
