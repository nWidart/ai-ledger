import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { ContextPayload, GrowthPoint } from "../../api";
import { useColors } from "../../colors";
import { useWidth } from "../../components/chart";
import { ChartTable, DataTable } from "../../components/DataTable";
import { niceStep, num, plural } from "../../format";
import { short } from "./context";

type Curves = ContextPayload["growth"]["by_project_curves"];
const H = 260, M = { t: 12, r: 14, b: 30, l: 52 };

/** What a curve reads at a turn, in words: "Turn 12: median 45k tokens (25th to 75th percentile 30k to 60k), 9 sessions". */
export const readTurn = (p: GrowthPoint) =>
  `Turn ${num(p.turn)}: median ${short(p.median)} tokens (25th to 75th percentile ${short(p.p25)} to ${short(p.p75)}), ${plural(p.sessions, "session")}`;

/** The view's median context at each turn with its 25th to 75th percentile band, and the busiest projects' medians over it.
 *  x is the turn, y the prompt tokens of that turn; a point needs at least 5 sessions, so a curve stops where the sessions run out. */
export function GrowthChart({ curve, projects }: { curve: GrowthPoint[]; projects: Curves }) {
  const color = useColors(), box = useRef<HTMLDivElement>(null), W = useWidth(box);
  const [at, setAt] = useState<number | null>(null); // an index into curve
  if (!curve.length) return null;
  const last = curve[curve.length - 1]!, xMax = Math.max(2, last.turn, ...projects.map(p => p.curve.at(-1)?.turn ?? 0));
  const top = Math.max(...curve.map(p => p.p75), ...projects.flatMap(p => p.curve.map(c => c.median)), 1) * 1.06;
  const step = niceStep(top / 4), yMax = Math.ceil(top / step) * step, iw = W - M.l - M.r, ih = H - M.t - M.b;
  const x = (turn: number) => M.l + (turn - 1) / (xMax - 1) * iw, y = (v: number) => M.t + ih - v / yMax * ih;
  const line = (c: GrowthPoint[]) => c.map((p, i) => `${i ? "L" : "M"}${x(p.turn).toFixed(1)},${y(p.median).toFixed(1)}`).join("");
  const band = `${curve.map((p, i) => `${i ? "L" : "M"}${x(p.turn).toFixed(1)},${y(p.p75).toFixed(1)}`).join("")}${curve.slice().reverse()
    .map(p => `L${x(p.turn).toFixed(1)},${y(p.p25).toFixed(1)}`).join("")}Z`;
  const yTicks: number[] = [], xStep = niceStep(xMax / 6), xTicks = [1];
  for (let v = 0; v <= yMax + 1e-9; v += step) yTicks.push(v);
  for (let t = xStep; t <= xMax; t += xStep) if (t > 1) xTicks.push(t);

  const cur = at == null ? null : curve[at]!;
  const readout = cur && [readTurn(cur), ...projects.flatMap(p => { const c = p.curve.find(q => q.turn === cur.turn); return c ? [`${p.project ?? "(no project)"} ${short(c.median)}`] : []; })].join("; ");
  const label = (curve.length > 1
    ? `Median context at each turn: ${short(curve[0]!.median)} tokens at turn ${curve[0]!.turn}, ${short(last.median)} at turn ${last.turn}, the last turn with 5 or more sessions (${plural(last.sessions, "session")}). `
    : `Median context at turn ${last.turn}, the only turn with 5 or more sessions: ${short(last.median)} tokens (${plural(last.sessions, "session")}). `)
    + `The band shows the 25th to 75th percentile, ${short(last.p25)} to ${short(last.p75)} at turn ${last.turn}.`
    + (projects.length ? ` ${plural(projects.length, "project")} drawn separately.` : "") + " Use the left and right arrow keys to read each turn, Escape to dismiss it.";
  const near = (ev: PointerEvent) => {
    // The pointer's x in the svg's own units: the plot rect starts at M.l and is iw wide, so offset and scale within it.
    const r = ev.currentTarget.getBoundingClientRect(), px = M.l + (ev.clientX - r.left) * iw / r.width;
    let best = 0;
    curve.forEach((p, i) => { if (Math.abs(x(p.turn) - px) < Math.abs(x(curve[best]!.turn) - px)) best = i; });
    return best;
  };
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") return setAt(null);
    const d = ({ ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity } as Record<string, number>)[ev.key];
    if (d == null) return;
    ev.preventDefault();
    setAt(Math.max(0, Math.min(curve.length - 1, (at ?? (d > 0 ? -1 : curve.length)) + d)));
  };

  return (
    <div className="growth">
      <div className="legend">
        <span className="key"><i className="line" />Median, all sessions in view</span>
        <span className="key"><i className="band" />25th to 75th percentile</span>
        {projects.map(p => <span key={p.project ?? ""} className="key">
          <i style={{ background: color(p.project) }} />{p.project ?? "(no project)"}<span className="muted"> · {plural(p.sessions, "session")}</span></span>)}
      </div>
      <div className="chart" ref={box} tabIndex={0} role="group" aria-label={label} onKeyDown={onKey} onBlur={() => setAt(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {yTicks.map(v => <g key={v}><line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
            <text x={M.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">{short(v)}</text></g>)}
          {xTicks.map(t => <text key={t} x={x(t)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--text-muted)">{t}</text>)}
          <path className="band" d={band} fill="var(--text-secondary)" opacity=".16" stroke="none" />
          {projects.map(p => <path key={p.project ?? ""} className="curve proj" d={line(p.curve)} fill="none" stroke={color(p.project)} strokeWidth="1.5" strokeLinejoin="round" />)}
          <path className="curve view" d={line(curve)} fill="none" stroke="var(--surface-1)" strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="round" />
          <path className="curve view" d={line(curve)} fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(last.turn)} cy={y(last.median)} r="3.5" fill="var(--text-primary)" stroke="var(--surface-1)" strokeWidth="1.5" />
          {cur && <><line x1={x(cur.turn)} x2={x(cur.turn)} y1={M.t} y2={M.t + ih} stroke="var(--text-muted)" strokeDasharray="3 3" />
            <circle cx={x(cur.turn)} cy={y(cur.median)} r="4" fill="var(--text-primary)" stroke="var(--surface-1)" strokeWidth="1.5" /></>}
          <rect x={M.l} y={M.t} width={iw} height={ih} fill="transparent" onPointerMove={ev => setAt(near(ev))} onPointerLeave={() => setAt(null)} />
        </svg>
      </div>
      <div className="axis-note muted small">Turn in the session (a main-thread request that carries the context) · tokens the model read at that turn</div>
      <div className="readout" aria-live="polite">{readout ?? ""}</div>
      {/* The chart's text alternative: the view's median and band at each turn, and each drawn project's median. */}
      <ChartTable><DataTable name="Median context at each turn" region="scroll tall">
        <thead><tr><th scope="col">Turn</th><th scope="col" className="num">Median</th><th scope="col" className="num">25th percentile</th><th scope="col" className="num">75th percentile</th>
          <th scope="col" className="num">Sessions</th>{projects.map(p => <th key={p.project ?? ""} scope="col" className="num">{p.project ?? "(no project)"}</th>)}</tr></thead>
        <tbody>{curve.map(p => <tr key={p.turn}><th scope="row" className="num">{num(p.turn)}</th><td className="num">{short(p.median)}</td><td className="num">{short(p.p25)}</td><td className="num">{short(p.p75)}</td>
          <td className="num">{num(p.sessions)}</td>{projects.map(q => { const c = q.curve.find(r => r.turn === p.turn); return <td key={q.project ?? ""} className="num">{c ? short(c.median) : "–"}</td>; })}</tr>)}</tbody>
      </DataTable></ChartTable>
    </div>
  );
}
