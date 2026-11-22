import { useCallback, useMemo, useState } from "react";
import type { ContextPayload, GrowthPoint } from "../../api";
import { useColors } from "../../colors";
import { textScale } from "../../components/chart";
import { ChartTable } from "../../components/DataTable";
import { EChart } from "../../components/echart/EChart";
import type { ChartEnv } from "../../components/echart/tokens";
import { Table, type Column } from "../../components/table/Table";
import { num, pct, plural } from "../../format";
import { NEAR_LIMIT, share as shareText, short } from "./context";
import { growthLayout, growthModel, growthOption, projectKey, type GrowthMode, type GrowthProject } from "./growthCurves";
import "./GrowthChart.css";

type Curves = ContextPayload["growth"]["by_project_curves"];
const noProject = (p: { project: string | null }) => p.project ?? "(no project)";

/** The chart's data table: the view's median and band at each turn, then one column per drawn project (its median, and with one isolated its band). */
const tableColumns = (shown: GrowthProject[], only: GrowthProject | null, fmt: (v: number) => string): Column<GrowthPoint>[] => [
  { id: "turn", header: "Turn", cellProps: () => ({ className: "num" }), cell: p => num(p.turn) },
  { id: "median", header: "Median", align: "num", cell: p => fmt(p.median) },
  { id: "p25", header: "25th percentile", align: "num", cell: p => fmt(p.p25) },
  { id: "p75", header: "75th percentile", align: "num", cell: p => fmt(p.p75) },
  { id: "sessions", header: "Sessions", align: "num", cell: p => num(p.sessions) },
  ...shown.map((q): Column<GrowthPoint> => ({ id: `project:${projectKey(q)}`, header: noProject(q), align: "num", cell: p => {
    const c = q.curve.find(r => r.turn === p.turn);
    return c ? fmt(c.median) + (only ? ` (${fmt(c.p25)} to ${fmt(c.p75)})` : "") : "–";
  } })),
];

/** What a curve reads at a turn, in words: "Turn 12: median 45k tokens (25th to 75th percentile 30k to 60k), 9 sessions". */
export const readTurn = (p: GrowthPoint) =>
  `Turn ${num(p.turn)}: median ${short(p.median)} tokens (25th to 75th percentile ${short(p.p25)} to ${short(p.p75)}), ${plural(p.sessions, "session")}`;

/** The same, for a share curve (fractions of the window). */
export const readShare = (p: GrowthPoint) =>
  `Turn ${num(p.turn)}: median ${shareText(p.median)} of the window (25th to 75th percentile ${shareText(p.p25)} to ${shareText(p.p75)}), ${plural(p.sessions, "session")}`;

/** The view's median context at each turn with its 25th to 75th percentile band, and the busiest projects' medians over it.
 *  x is the turn, y the prompt tokens of that turn (or, with `share`, the fraction of the window); a point needs at least 5 sessions,
 *  so a curve stops where the sessions run out. A strip under the curve shows how many sessions are still running at each turn.
 *  A project key isolates that project and its own band. The figures and the drawing are growthCurves.ts's; this component
 *  holds the switch, the legend, the words of the reading and the data table, and draws through <EChart>, which owns the
 *  keys, the pointer, the tooltip and the live readout. `view` is the page's key. */
export function GrowthChart({ curve, projects, share, view }: { curve: GrowthPoint[]; projects: Curves; share?: GrowthPoint[]; view: string }) {
  const color = useColors();
  const [mode, setMode] = useState<GrowthMode>("tokens"), [sel, setSel] = useState<string | null>(null);
  const canShare = !!share?.length, m: GrowthMode = mode === "share" && canShare ? "share" : "tokens", isShare = m === "share", fmt = isShare ? shareText : short;
  // The projects' hues, as growthModel reads them: the page sets the order after the payload lands, so the model is made again then.
  const hues = projects.map(p => color(p.project)).join(" ");
  // The isolated project is the model's input, not the view's: isolating redraws the same view and keeps the reading.
  const model = useMemo(() => (curve.length ? growthModel(curve, projects, share, m, sel, color) : null),
    // hues: a new project order is a new drawing
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [curve, projects, share, m, sel, color, hues]);
  // The text scale the box's height is worked out from, and the option is laid out at the same one.
  const scale = textScale();
  const option = useCallback((env: ChartEnv) => growthOption(model!, { ...env, textScale: scale }), [model, scale]);
  // Each turn in order: a turn's index is its number less one, so these never move a point, but the reading goes by them.
  const keys = useMemo(() => model?.points.map(p => String(p.turn)) ?? [], [model]);
  const only = model?.isolated ?? null, shown = model?.projects, columns = useMemo(() => tableColumns(shown ?? [], only, fmt), [shown, only, fmt]);
  if (!model) return null;
  const { points: cv, legend: drawn } = model;
  const pick = (next: GrowthMode) => {
    setMode(next);
    if (sel != null && !projects.some(p => projectKey(p) === sel && (next === "share" ? p.share_curve : p.curve).length)) setSel(null);
  };
  const last = cv[cv.length - 1]!, first = cv[0]!;
  // The turn's sentence, then each drawn project's median at that turn (with one isolated, its band too).
  const read = (i: number) => [(isShare ? readShare : readTurn)(cv[i]!), ...model.projects.flatMap(q => {
    const c = q.points[i];
    return c ? [`${noProject(q)} ${fmt(c.median)}` + (only ? ` (25th to 75th percentile ${fmt(c.p25)} to ${fmt(c.p75)})` : "")] : [];
  })].join("; ");
  const tip = (i: number) => {
    const p = cv[i]!;
    return <>
      <div className="muted">Turn {num(p.turn)}</div>
      <div className="row"><span><i style={{ background: "var(--text-primary)" }} />Median</span><b>{fmt(p.median)}</b></div>
      <div className="row"><span>25th to 75th percentile</span><b>{fmt(p.p25)} to {fmt(p.p75)}</b></div>
      <div className="row"><span>Sessions</span><b>{num(p.sessions)}</b></div>
      {model.projects.flatMap(q => {
        const c = q.points[i];
        return c ? [<div key={projectKey(q)} className="row"><span><i style={{ background: q.color }} />{noProject(q)}</span>
          <b>{fmt(c.median)}{only ? ` (${fmt(c.p25)} to ${fmt(c.p75)})` : ""}</b></div>] : [];
      })}
    </>;
  };
  const label = (isShare
    ? (cv.length > 1
      ? `Median share of the window at each turn: ${fmt(first.median)} at turn ${first.turn}, ${fmt(last.median)} at turn ${last.turn}, the last turn with 5 or more sessions with a known window (${plural(last.sessions, "session")}). `
      : `Median share of the window at turn ${last.turn}, the only turn with 5 or more sessions with a known window: ${fmt(last.median)} (${plural(last.sessions, "session")}). `)
      + `The dashed line marks ${pct(NEAR_LIMIT)} of the window. `
    : (cv.length > 1
      ? `Median context at each turn: ${fmt(first.median)} tokens at turn ${first.turn}, ${fmt(last.median)} at turn ${last.turn}, the last turn with 5 or more sessions (${plural(last.sessions, "session")}). `
      : `Median context at turn ${last.turn}, the only turn with 5 or more sessions: ${fmt(last.median)} tokens (${plural(last.sessions, "session")}). `))
    + (only ? `Showing only ${noProject(only)}, with its 25th to 75th percentile band, ${fmt(only.curve.at(-1)!.p25)} to ${fmt(only.curve.at(-1)!.p75)} at turn ${only.curve.at(-1)!.turn}.`
      : `The band shows the 25th to 75th percentile, ${fmt(last.p25)} to ${fmt(last.p75)} at turn ${last.turn}.` + (drawn.length ? ` ${plural(drawn.length, "project")} drawn separately.` : ""))
    + ` Sessions still running: ${num(first.sessions)} at turn ${first.turn}, ${num(last.sessions)} at turn ${last.turn}.`
    + " Use the left and right arrow keys to read each turn, Escape to dismiss it.";

  return (
    <div className="growth">
      {canShare && <div className="seg growth-mode" role="group" aria-label="Chart measure">
        {([["tokens", "Tokens"], ["share", "Share of window"]] as const).map(([k, t]) => <button key={k} type="button" aria-pressed={k === m} onClick={() => pick(k)}>{t}</button>)}
      </div>}
      <div className="legend">
        <span className="key"><i className="line" />Median, all sessions in view</span>
        {!only && <span className="key"><i className="band" />25th to 75th percentile</span>}
        {drawn.map(p => <button key={projectKey(p)} type="button" className="key proj" aria-pressed={only === p} title={only === p ? "Show every project" : `Show only ${noProject(p)}`}
          onClick={() => setSel(only === p ? null : projectKey(p))}>
          <i style={{ background: p.color }} />{noProject(p)}<span className="muted"> · {plural(p.sessions, "session")}</span></button>)}
      </div>
      {/* The measure is in the view: switching it ends the reading. The isolated project is not. */}
      <EChart label={label} height={growthLayout(scale).height} option={option} view={[view, m].join("|")} pointKeys={keys} points={cv.length} tip={tip} read={read} />
      <div className="axis-note muted small">{isShare ? "Turn in the session (a main-thread request that carries the context) · share of the model's context window at that turn"
        : "Turn in the session (a main-thread request that carries the context) · tokens the model read at that turn"}</div>
      {/* The chart's text alternative: the view's median and band at each turn, and each drawn project's median. */}
      <ChartTable><Table name={isShare ? "Median share of the window at each turn" : "Median context at each turn"} region="scroll tall" rows={cv} columns={columns} rowId={p => String(p.turn)} /></ChartTable>
    </div>
  );
}
