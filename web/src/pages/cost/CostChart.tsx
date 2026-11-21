import { Fragment, useCallback, useEffect, useMemo, useRef } from "react";
import type { Source, UsagePayload } from "../../api";
import { useColors } from "../../colors";
import { ChartTable, DataTable } from "../../components/DataTable";
import { EChart } from "../../components/echart/EChart";
import type { ChartEnv } from "../../components/echart/tokens";
import { big, dayLabel, pct, plural, usd } from "../../format";
import { isOther, KINDS, SCALES, shares, STACKS, STACK_WORD, type CostDay, type Kind, type Stack, type TokenScale } from "./cost";
import { costModel, costOption, type CostMetric } from "./costDaily";

export type { CostMetric } from "./costDaily";

const H = 240;

export interface CostChartProps {
  d: UsagePayload;
  metric: CostMetric;
  onMetric: (m: CostMetric) => void;
  /** Token kinds left out of the tokens chart. */
  hidden: readonly string[];
  onHidden: (ks: string[]) => void;
  /** The tokens chart's scale (each day's volume, or its kinds' shares of the day) and a change of it. */
  scale: TokenScale;
  onScale: (s: TokenScale) => void;
  /** What the cost bars stack by, and a change of it. */
  stack: Stack;
  onStack: (s: Stack) => void;
  /** A project's legend key: filter the page to it ("" clears the filter). */
  onProject: (p: string) => void;
  /** An agent's legend key: filter the page to it ("" clears the filter). */
  onSource: (s: Source | "") => void;
  /** A day was selected (click, or Enter while reading with the arrow keys). */
  onDay: (day: string) => void;
}

// What the hint says about each stacking (one project selected: the project stack has nothing to explain).
// One line with the rest of the hint, so the chart starts high on the page.
const STACK_HINT: Record<Stack, (one: boolean) => string> = {
  project: one => (one ? "At" : "The busiest projects by color, the rest in Other; a key filters. At"),
  model: () => "The costliest models by color, the rest in Other. At",
  source: () => "One color per agent; a key filters. At",
};

const Row = ({ k, v }: { k: Kind; v: string }) => <div className="row"><span><i style={{ background: k.c }} />{k.label}</span><b>{v}</b></div>;

/** Estimated cost per day stacked by project, model or agent (Other in grey), or tokens per day by kind, with a 7-day average line.
 *  The figures and the drawing are costDaily.ts's; this component holds the heading, the switches, the legend, the words of the
 *  reading and the data table, and draws through <EChart>, which owns the keys, the pointer, the tooltip and the readout. */
export function CostChart({ d, metric, onMetric, hidden, onHidden, scale, onScale, stack, onStack, onProject, onSource, onDay }: CostChartProps) {
  useColors();
  const legend = useRef<HTMLDivElement>(null);
  // A project or agent key re-renders the legend for the new view: its first key is the way back.
  const refocus = useRef(false);
  useEffect(() => { if (refocus.current) { refocus.current = false; legend.current?.querySelector("button")?.focus(); } }, [d]);

  const m = useMemo(() => costModel(d, metric, hidden, stack, scale), [d, metric, hidden, stack, scale]);
  // One function per view: a new one is a new drawing, and ends the reading, as a new view did before.
  const option = useCallback((env: ChartEnv) => costOption(m, env), [m]);
  const { cost, share, none, kinds, days: pts, totals, showAvg, avg, live, peak } = m;
  const total = (i: number) => totals[i]!;
  // The readouts and the table read the tokens (pts) and, in Share, each kind's share of them (frac).
  const frac = (p: CostDay, k: Kind) => shares(p.v, kinds)[k.k] ?? 0;
  const fy = cost ? usd : big;
  const pk = peak != null ? pts[peak] : undefined;
  // Enter or a click on a day lists its sessions. A day with nothing in it has none to list: the activation is declined, and
  // the reading stays open.
  const pick = (i: number) => {
    const p = pts[i];
    if (!p || !(p.cost || total(i))) return false;
    onDay(p.day);
    return true;
  };

  // Parts in stack order, top first, as the eye reads the bar; zero parts left out.
  const parts = (p: CostDay) => kinds.slice().reverse().filter(k => (p.v[k.k] ?? 0) > 0);
  // Other's names (projects or models) of a day: the top three by cost, and how many more follow.
  const topOther = (p: CostDay) => (p.other ?? []).slice(0, 3);
  const moreOther = (p: CostDay) => (p.other?.length ?? 0) - 3;
  const otherSr = (p: CostDay) => {
    const items = topOther(p).map(o => `${o.name} ${usd(o.cost)}`);
    if (moreOther(p) > 0) items.push(`and ${moreOther(p)} more`);
    return items.join(", ");
  };
  const partText = (p: CostDay, k: Kind) => `${k.label} ${usd(p.v[k.k])}${isOther(k) && p.other?.length ? ` (${otherSr(p)})` : ""}`;
  // A key that filters the page: a project's (project stack) or an agent's (agent stack); on: that filter is set, and the key clears it.
  const filterOf = (k: Kind) => k.project ? { name: k.project, all: "projects", on: !!d.project, go: () => onProject(d.project ? "" : k.project!) }
    : k.source ? { name: k.label, all: "agents", on: !!d.source, go: () => onSource(d.source ? "" : k.source!) } : null;
  const soFar = (i: number) => (i === live ? " so far" : "");
  const avgText = (i: number) => (showAvg && avg[i] != null ? `7-day average ${fy(avg[i])}` : "");
  const text = (p: CostDay, i: number) => (cost
    ? `${usd(p.cost)} estimated${parts(p).length > 1 || p.other?.length ? ` by ${STACK_WORD[stack].noun}: ` + parts(p).map(k => partText(p, k)).join(", ") : ""}${p.unpriced ? `, ${plural(p.unpriced, "unpriced request")}` : ""}`
    : share ? (total(i) ? kinds.map(k => `${k.label} ${pct(frac(p, k), 1)}`).join(", ") + `, total ${big(total(i))}` : "no tokens")
    : kinds.map(k => `${k.label} ${big(p.v[k.k])}`).join(", ") + `, total ${big(total(i))}`) + (avgText(i) ? `. ${avgText(i)}` : "");
  const read = (i: number) => `${dayLabel(pts[i]!.day, true)}${soFar(i)}: ${text(pts[i]!, i)}`;
  const tip = (i: number) => {
    const cur = pts[i]!;
    return <>
      <div className="muted">{dayLabel(cur.day, true)}{soFar(i)}</div>
      {cost ? <>
        {parts(cur).map(k => <Fragment key={k.k}><Row k={k} v={usd(cur.v[k.k])} />
          {isOther(k) && topOther(cur).map(o => <div key={o.name} className="row sub"><span>{o.name}</span><span>{usd(o.cost)}</span></div>)}
          {isOther(k) && moreOther(cur) > 0 && <div className="row sub"><span>{`+ ${moreOther(cur)} more`}</span></div>}
        </Fragment>)}
        <div className={"row" + (parts(cur).length ? " tot" : "")}><span>Total</span><b>{usd(cur.cost)}</b></div>
        {cur.unpriced > 0 && <div className="muted">{plural(cur.unpriced, "unpriced request")}</div>}
      </> : <>
        {kinds.slice().reverse().map(k => <Row key={k.k} k={k} v={share ? (total(i) ? pct(frac(cur, k), 1) : "–") : big(cur.v[k.k])} />)}
        <div className="row tot"><span>Total</span><b>{big(total(i))}</b></div>
      </>}
      {avgText(i) && <div className="muted">{avgText(i)}</div>}
    </>;
  };
  const what = cost ? (d.project && stack === "project" ? "Estimated cost" : `Estimated cost by ${STACK_WORD[stack].noun}`) : share ? "Token share by kind" : "Tokens by kind";
  const keys = "Use the left and right arrow keys to read each day and Enter to list its sessions.";
  const label = !pk ? `${what} per day, no days yet.` : share ? `${what} per day, ${pts.length} days. ${keys}`
    : `${what} per day, ${pts.length} days, peaking at ${fy(total(peak!))} on ${dayLabel(pk.day, true)}${soFar(peak!)}. ${keys}`;

  return (
    <section className="panel sect" id="spend" aria-labelledby="chartTitle">
      <div className="chart-head">
        <div><h2 id="chartTitle">{cost ? `Estimated cost per day${stack === "project" ? "" : ` by ${STACK_WORD[stack].noun}`}` : share ? "Token share per day" : "Tokens per day"}</h2>
          <div className="hint">{cost ? `${STACK_HINT[stack](!!d.project)} list prices.`
            : share ? "Each bar is the day's tokens split by kind. Select a kind to hide it."
              : "Select a kind to hide it. Cache reads usually dwarf the rest; Share compares the kinds."}{showAvg ? " The 7-day average covers complete days." : ""} Select a day, or use the arrow keys and Enter, for its sessions.</div></div>
        <div className="chart-ctl">
          {cost && <>
            <span className="muted" id="stackBy">Stack by</span>
            <div className="seg" role="group" aria-labelledby="stackBy">
              {STACKS.map(x => <button key={x} type="button" aria-pressed={x === stack} onClick={() => onStack(x)}>{STACK_WORD[x].label}</button>)}
            </div>
          </>}
          {!cost && <>
            <span className="muted" id="scaleBy">Scale</span>
            <div className="seg" role="group" aria-labelledby="scaleBy">
              {SCALES.map(x => <button key={x} type="button" aria-pressed={x === scale} onClick={() => onScale(x)}>{x === "share" ? "Share" : "Volume"}</button>)}
            </div>
          </>}
          <div className="seg" role="group" aria-label="Chart metric">
            {(["cost", "tokens"] as const).map(m => <button key={m} type="button" aria-pressed={m === metric} onClick={() => onMetric(m)}>{m === "cost" ? "Cost" : "Tokens"}</button>)}
          </div>
        </div>
      </div>
      {/* Cost: a project's or an agent's key filters the page to it (again to clear); models, Other and the average line are keys only. Tokens: each kind toggles. */}
      <div className="legend" ref={legend}>
        {cost ? kinds.map(k => { const f = filterOf(k);
          return f
            ? <button key={k.k} type="button" className="proj" title={f.on ? `Show all ${f.all}` : `Filter to ${f.name}`}
              aria-current={f.on ? "true" : undefined} aria-label={f.on ? `${f.name}, show all ${f.all}` : undefined}
              onClick={() => { refocus.current = true; f.go(); }}>
              <i style={{ background: k.c }} /><span>{k.label}</span>{f.on ? " ✕" : ""}</button>
            : <span key={k.k} className="key"><i style={{ background: k.c }} />{k.label}</span>; })
          : KINDS.map(k => <button key={k.k} type="button" aria-pressed={!hidden.includes(k.k)}
            onClick={() => onHidden(hidden.includes(k.k) ? hidden.filter(x => x !== k.k) : [...hidden, k.k])}><i style={{ background: k.c }} />{k.label}</button>)}
        {showAvg && !none && <span className="key"><i className="line" />7-day average</span>}
        {pts.length > 0 && !none && <span className="key"><i className="hatch" />Today so far</span>}
      </div>
      {none && <div className="empty all-hidden" role="status">All token kinds are hidden.{" "}
        <button type="button" className="linkish" onClick={() => onHidden([])}>Show every kind</button></div>}
      <EChart label={label} hidden={none} height={H} option={option} points={pts.length} tip={tip} read={read} onActivate={pick} />
      {/* The chart's text alternative: a figure per day and series in the current stacking, in the chart's units. */}
      {!none && <ChartTable><DataTable name={`${what} per day`} region="scroll tall">
        <thead><tr><th scope="col">Day</th>{kinds.map(k => <th key={k.k} scope="col" className="num">{k.label}</th>)}<th scope="col" className="num">Total</th></tr></thead>
        <tbody>{pts.map((p, i) => <tr key={p.day}><th scope="row">{dayLabel(p.day, true)}{soFar(i)}</th>
          {kinds.map(k => <td key={k.k} className="num">{share ? (total(i) ? pct(frac(p, k), 1) : "–") : fy(p.v[k.k] ?? 0)}</td>)}<td className="num">{cost ? usd(p.cost) : big(total(i))}</td></tr>)}</tbody>
      </DataTable></ChartTable>}
    </section>
  );
}
