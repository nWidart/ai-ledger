import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { ContextPayload, GrowthPoint } from "../../api";
import { useColors } from "../../colors";
import { useWidth } from "../../components/chart";
import { ChartTable, DataTable } from "../../components/DataTable";
import { niceStep, num, pct, plural } from "../../format";
import { NEAR_LIMIT, share as shareText, short } from "./context";
import "./GrowthChart.css";

type Curves = ContextPayload["growth"]["by_project_curves"];
const H = 260, M = { t: 12, r: 14, b: 30, l: 52 };
/** The survival strip under the x-axis: its gap, bar height and the text row. */
const STRIP = { gap: 6, bar: 22, text: 18 };
type Mode = "tokens" | "share";
const key = (p: { project: string | null }) => p.project ?? "";

/** What a curve reads at a turn, in words: "Turn 12: median 45k tokens (25th to 75th percentile 30k to 60k), 9 sessions". */
export const readTurn = (p: GrowthPoint) =>
  `Turn ${num(p.turn)}: median ${short(p.median)} tokens (25th to 75th percentile ${short(p.p25)} to ${short(p.p75)}), ${plural(p.sessions, "session")}`;

/** The same, for a share curve (fractions of the window). */
export const readShare = (p: GrowthPoint) =>
  `Turn ${num(p.turn)}: median ${shareText(p.median)} of the window (25th to 75th percentile ${shareText(p.p25)} to ${shareText(p.p75)}), ${plural(p.sessions, "session")}`;

/** The view's median context at each turn with its 25th to 75th percentile band, and the busiest projects' medians over it.
 *  x is the turn, y the prompt tokens of that turn (or, with `share`, the fraction of the window); a point needs at least 5 sessions,
 *  so a curve stops where the sessions run out. A strip under the axis shows how many sessions are still running at each turn.
 *  A project key isolates that project and its own band. */
export function GrowthChart({ curve, projects, share }: { curve: GrowthPoint[]; projects: Curves; share?: GrowthPoint[] }) {
  const color = useColors(), box = useRef<HTMLDivElement>(null), W = useWidth(box);
  const [at, setAt] = useState<number | null>(null); // an index into the curve in view
  const [mode, setMode] = useState<Mode>("tokens"), [sel, setSel] = useState<string | null>(null);
  if (!curve.length) return null;
  const canShare = !!share?.length, m: Mode = mode === "share" && canShare ? "share" : "tokens", isShare = m === "share";
  const cv = isShare ? share! : curve, fmt = isShare ? shareText : short;
  const drawn = projects.map(p => ({ project: p.project, sessions: p.sessions, c: isShare ? p.share_curve : p.curve })).filter(p => p.c.length);
  const only = sel == null ? null : drawn.find(p => key(p) === sel) ?? null;
  const shown = only ? [only] : drawn;
  const pick = (next: Mode) => {
    setMode(next); setAt(null);
    if (sel != null && !projects.some(p => key(p) === sel && (next === "share" ? p.share_curve : p.curve).length)) setSel(null);
  };
  const last = cv[cv.length - 1]!, first = cv[0]!;
  const xMax = Math.max(2, last.turn, ...shown.map(p => p.c.at(-1)?.turn ?? 0));
  const top = Math.max(...(only ? [] : cv.map(p => p.p75)), ...cv.map(p => p.median), ...shown.flatMap(p => p.c.map(c => only ? c.p75 : c.median)), isShare ? NEAR_LIMIT : 0, 1e-9) * 1.06;
  const step = niceStep(top / 4), yMax = Math.ceil(top / step) * step, iw = W - M.l - M.r, ih = H - M.t - M.b;
  const x = (turn: number) => M.l + (turn - 1) / (xMax - 1) * iw, y = (v: number) => M.t + ih - v / yMax * ih;
  const line = (c: GrowthPoint[]) => c.map((p, i) => `${i ? "L" : "M"}${x(p.turn).toFixed(1)},${y(p.median).toFixed(1)}`).join("");
  const bandOf = (c: GrowthPoint[]) => `${c.map((p, i) => `${i ? "L" : "M"}${x(p.turn).toFixed(1)},${y(p.p75).toFixed(1)}`).join("")}${c.slice().reverse()
    .map(p => `L${x(p.turn).toFixed(1)},${y(p.p25).toFixed(1)}`).join("")}Z`;
  const yTicks: number[] = [], xStep = niceStep(xMax / 6), xTicks = [1];
  for (let v = 0; v <= yMax + 1e-9; v += step) yTicks.push(v);
  for (let t = xStep; t <= xMax; t += xStep) if (t > 1) xTicks.push(t);
  // The survival strip: one bar per point of the curve in view, by its sessions.
  const maxSessions = Math.max(...cv.map(p => p.sessions), 1), stripTop = H + STRIP.gap, barW = Math.max(1, Math.min(10, iw / cv.length * .7));
  const svgH = H + STRIP.gap + STRIP.bar + STRIP.text;

  const cur = at == null ? null : cv[at] ?? null;
  const readout = cur && [(isShare ? readShare : readTurn)(cur), ...shown.flatMap(p => { const c = p.c.find(q => q.turn === cur.turn); return c ? [`${p.project ?? "(no project)"} ${fmt(c.median)}`] : []; })].join("; ");
  const label = (isShare
    ? (cv.length > 1
      ? `Median share of the window at each turn: ${fmt(first.median)} at turn ${first.turn}, ${fmt(last.median)} at turn ${last.turn}, the last turn with 5 or more sessions with a known window (${plural(last.sessions, "session")}). `
      : `Median share of the window at turn ${last.turn}, the only turn with 5 or more sessions with a known window: ${fmt(last.median)} (${plural(last.sessions, "session")}). `)
      + `The dashed line marks ${pct(NEAR_LIMIT)} of the window. `
    : (cv.length > 1
      ? `Median context at each turn: ${fmt(first.median)} tokens at turn ${first.turn}, ${fmt(last.median)} at turn ${last.turn}, the last turn with 5 or more sessions (${plural(last.sessions, "session")}). `
      : `Median context at turn ${last.turn}, the only turn with 5 or more sessions: ${fmt(last.median)} tokens (${plural(last.sessions, "session")}). `))
    + (only ? `Showing only ${only.project ?? "(no project)"}, with its 25th to 75th percentile band, ${fmt(only.c.at(-1)!.p25)} to ${fmt(only.c.at(-1)!.p75)} at turn ${only.c.at(-1)!.turn}.`
      : `The band shows the 25th to 75th percentile, ${fmt(last.p25)} to ${fmt(last.p75)} at turn ${last.turn}.` + (drawn.length ? ` ${plural(drawn.length, "project")} drawn separately.` : ""))
    + ` Sessions still running: ${num(first.sessions)} at turn ${first.turn}, ${num(last.sessions)} at turn ${last.turn}.`
    + " Use the left and right arrow keys to read each turn, Escape to dismiss it.";
  const near = (ev: PointerEvent) => {
    // The pointer's x in the svg's own units: the plot rect starts at M.l and is iw wide, so offset and scale within it.
    const r = ev.currentTarget.getBoundingClientRect(), px = M.l + (ev.clientX - r.left) * iw / r.width;
    let best = 0;
    cv.forEach((p, i) => { if (Math.abs(x(p.turn) - px) < Math.abs(x(cv[best]!.turn) - px)) best = i; });
    return best;
  };
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") return setAt(null);
    const d = ({ ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity } as Record<string, number>)[ev.key];
    if (d == null) return;
    ev.preventDefault();
    setAt(Math.max(0, Math.min(cv.length - 1, (at ?? (d > 0 ? -1 : cv.length)) + d)));
  };

  return (
    <div className="growth">
      {canShare && <div className="seg growth-mode" role="group" aria-label="Chart measure">
        {([["tokens", "Tokens"], ["share", "Share of window"]] as const).map(([k, t]) => <button key={k} type="button" aria-pressed={k === m} onClick={() => pick(k)}>{t}</button>)}
      </div>}
      <div className="legend">
        <span className="key"><i className="line" />Median, all sessions in view</span>
        {!only && <span className="key"><i className="band" />25th to 75th percentile</span>}
        {drawn.map(p => <button key={key(p)} type="button" className="key proj" aria-pressed={only === p} title={only === p ? "Show every project" : `Show only ${p.project ?? "(no project)"}`}
          onClick={() => setSel(only === p ? null : key(p))}>
          <i style={{ background: color(p.project) }} />{p.project ?? "(no project)"}<span className="muted"> · {plural(p.sessions, "session")}</span></button>)}
      </div>
      <div className="chart" ref={box} tabIndex={0} role="group" aria-label={label} onKeyDown={onKey} onBlur={() => setAt(null)}>
        <svg className="growth-svg" viewBox={`0 0 ${W} ${svgH}`} aria-hidden="true">
          {yTicks.map(v => <g key={v}><line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
            <text x={M.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">{isShare ? pct(v) : short(v)}</text></g>)}
          {xTicks.map(t => <text key={t} x={x(t)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--text-muted)">{t}</text>)}
          {!only && <path className="band" d={bandOf(cv)} fill="var(--text-secondary)" opacity=".16" stroke="none" />}
          {only && <path className="band proj-band" d={bandOf(only.c)} fill={color(only.project)} opacity=".18" stroke="none" />}
          {isShare && <g className="limit"><line x1={M.l} x2={W - M.r} y1={y(NEAR_LIMIT)} y2={y(NEAR_LIMIT)} stroke="var(--text-muted)" strokeDasharray="5 4" />
            <text x={W - M.r} y={y(NEAR_LIMIT) - 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">{pct(NEAR_LIMIT)} of the window</text></g>}
          {shown.map(p => <path key={key(p)} className="curve proj" d={line(p.c)} fill="none" stroke={color(p.project)} strokeWidth={only ? 3 : 1.5} strokeLinejoin="round" />)}
          <path className="curve view" d={line(cv)} fill="none" stroke="var(--surface-1)" strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="round" />
          <path className="curve view" d={line(cv)} fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(last.turn)} cy={y(last.median)} r="3.5" fill="var(--text-primary)" stroke="var(--surface-1)" strokeWidth="1.5" />
          {cur && <><line x1={x(cur.turn)} x2={x(cur.turn)} y1={M.t} y2={M.t + ih} stroke="var(--text-muted)" strokeDasharray="3 3" />
            <circle cx={x(cur.turn)} cy={y(cur.median)} r="4" fill="var(--text-primary)" stroke="var(--surface-1)" strokeWidth="1.5" /></>}
          <rect x={M.l} y={M.t} width={iw} height={ih} fill="transparent" onPointerMove={ev => setAt(near(ev))} onPointerLeave={() => setAt(null)} />
          <g className="strip">
            {cv.map(p => { const h = Math.max(1, p.sessions / maxSessions * STRIP.bar);
              return <rect key={p.turn} className="strip-bar" x={x(p.turn) - barW / 2} y={stripTop + STRIP.bar - h} width={barW} height={h} fill="var(--text-muted)" opacity=".55" />; })}
            <text x={M.l} y={stripTop + STRIP.bar + 13} fontSize="11" fill="var(--text-muted)">Sessions still running at each turn</text>
            <text x={W - M.r} y={stripTop + STRIP.bar + 13} textAnchor="end" fontSize="11" fill="var(--text-muted)">{num(first.sessions)} at turn {first.turn} to {num(last.sessions)} at turn {last.turn}</text>
          </g>
        </svg>
      </div>
      <div className="axis-note muted small">{isShare ? "Turn in the session (a main-thread request that carries the context) · share of the model's context window at that turn"
        : "Turn in the session (a main-thread request that carries the context) · tokens the model read at that turn"}</div>
      <div className="readout" aria-live="polite">{readout ?? ""}</div>
      {/* The chart's text alternative: the view's median and band at each turn, and each drawn project's median. */}
      <ChartTable><DataTable name={isShare ? "Median share of the window at each turn" : "Median context at each turn"} region="scroll tall">
        <thead><tr><th scope="col">Turn</th><th scope="col" className="num">Median</th><th scope="col" className="num">25th percentile</th><th scope="col" className="num">75th percentile</th>
          <th scope="col" className="num">Sessions</th>{shown.map(p => <th key={key(p)} scope="col" className="num">{p.project ?? "(no project)"}</th>)}</tr></thead>
        <tbody>{cv.map(p => <tr key={p.turn}><th scope="row" className="num">{num(p.turn)}</th><td className="num">{fmt(p.median)}</td><td className="num">{fmt(p.p25)}</td><td className="num">{fmt(p.p75)}</td>
          <td className="num">{num(p.sessions)}</td>{shown.map(q => { const c = q.c.find(r => r.turn === p.turn); return <td key={key(q)} className="num">{c ? fmt(c.median) : "–"}</td>; })}</tr>)}</tbody>
      </DataTable></ChartTable>
    </div>
  );
}
