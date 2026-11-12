import { Fragment, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { Source, UsagePayload } from "../../api";
import { useColors } from "../../colors";
import { dayAxis, peakLabelAt, tipAt, useWidth } from "../../components/chart";
import { big, dayLabel, niceStep, plural, usd, usd0 } from "../../format";
import { costDays, costKinds, isOther, KINDS, STACKS, STACK_WORD, type CostDay, type Kind, type Stack } from "./cost";

const H = 240;
export type CostMetric = "cost" | "tokens";

export interface CostChartProps {
  d: UsagePayload;
  metric: CostMetric;
  onMetric: (m: CostMetric) => void;
  /** Token kinds left out of the tokens chart. */
  hidden: readonly string[];
  onHidden: (ks: string[]) => void;
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
const STACK_HINT: Record<Stack, (one: boolean) => string> = {
  project: one => (one ? "At" : "Projects with a color of their own (the busiest of all time), the rest in Other; select one to filter. At"),
  model: () => "The models that cost the most in this view, the rest in Other. At",
  source: () => "One color per agent; select one to filter. At",
};

const Row = ({ k, v }: { k: Kind; v: string }) => <div className="row"><span><i style={{ background: k.c }} />{k.label}</span><b>{v}</b></div>;

/** Estimated cost per day stacked by project, model or agent (Other in grey), or tokens per day by kind, with a 7-day average line. */
export function CostChart({ d, metric, onMetric, hidden, onHidden, stack, onStack, onProject, onSource, onDay }: CostChartProps) {
  useColors();
  const box = useRef<HTMLDivElement>(null), tip = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null), legend = useRef<HTMLDivElement>(null);
  const W = useWidth(box);
  const [at, setAt] = useState<{ i: number; x: number; y: number } | null>(null);
  useEffect(() => setAt(null), [d, metric, hidden, stack]);
  useLayoutEffect(() => {
    if (!at || !tip.current || !box.current) return;
    const p = tipAt(box.current, tip.current, at.x, at.y);
    tip.current.style.left = p.left + "px"; tip.current.style.top = p.top + "px";
  }, [at]);
  // A project or agent key re-renders the legend for the new view: its first key is the way back.
  const refocus = useRef(false);
  useEffect(() => { if (refocus.current) { refocus.current = false; legend.current?.querySelector("button")?.focus(); } }, [d]);

  const cost = metric === "cost";
  const kinds: Kind[] = cost ? costKinds(d, stack) : KINDS.filter(k => !hidden.includes(k.k));
  const none = !cost && !kinds.length; // every token kind hidden
  const pts: CostDay[] = costDays(d, cost ? kinds : [], stack);
  const total = (p: CostDay) => kinds.reduce((s, k) => s + (p.v[k.k] || 0), 0);
  // The view ends today, a day still in progress: its bar is hatched and the average (the trailing 7-day mean of the plotted
  // total, from the seventh day on) leaves it out, so the line ends yesterday.
  const live = pts.length - 1;
  const avg = pts.map((_, i) => (i < 6 || i === live ? null : pts.slice(i - 6, i + 1).reduce((s, q) => s + total(q), 0) / 7));
  const showAvg = pts.length >= 14;
  const a = dayAxis(W, H, pts.length, Math.max(...pts.map(total), 0), niceStep);
  const fy = cost ? usd : big, ty = cost ? usd0 : big;
  const peak = pts.reduce((b, p, i) => (total(p) > total(pts[b]!) ? i : b), 0), pk = pts[peak];
  const indexAt = (clientX: number) => {
    const r = svg.current!.getBoundingClientRect(), px = (clientX - r.left) * W / r.width;
    return Math.max(0, Math.min(pts.length - 1, Math.floor((px - a.m.l) / a.bw)));
  };
  const pick = (i: number) => { const p = pts[i]; if (p && (p.cost || total(p))) { setAt(null); onDay(p.day); } };
  const onMove = (ev: PointerEvent) => setAt({ i: indexAt(ev.clientX), x: ev.clientX, y: ev.clientY });
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === "Enter" && at) { ev.preventDefault(); return pick(at.i); }
    const step = ({ ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity } as Record<string, number>)[ev.key];
    if (step == null || !pts.length) return;
    ev.preventDefault();
    const from = at?.i ?? (step > 0 ? -1 : pts.length); // first Right picks the first day, first Left the last
    const i = Math.max(0, Math.min(pts.length - 1, from + step));
    const r = svg.current!.getBoundingClientRect(), s = r.width / W;
    setAt({ i, x: r.left + a.cx(i) * s, y: r.top + a.m.t * s + 20 });
  };
  const ticks: number[] = [];
  for (let v = 0; v <= a.yMax + 1e-9; v += a.step) ticks.push(v);

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
    : kinds.map(k => `${k.label} ${big(p.v[k.k])}`).join(", ") + `, total ${big(total(p))}`) + (avgText(i) ? `. ${avgText(i)}` : "");
  const cur = at ? pts[at.i] : undefined;
  const what = cost ? (d.project && stack === "project" ? "Estimated cost" : `Estimated cost by ${STACK_WORD[stack].noun}`) : "Tokens by kind";
  const label = pk ? `${what} per day, ${pts.length} days, peaking at ${fy(total(pk))} on ${dayLabel(pk.day, true)}${soFar(peak)}. Use the left and right arrow keys to read each day and Enter to list its sessions.`
    : `${what} per day, no days yet.`;
  const avgLine = avg.map((v, i) => (v == null ? "" : `${i === 6 ? "M" : "L"}${a.cx(i).toFixed(1)},${a.y(v).toFixed(1)}`)).join("");

  return (
    <section className="panel sect" id="spend" aria-labelledby="chartTitle">
      <div className="chart-head">
        <div><h2 id="chartTitle">{cost ? `Estimated cost per day${stack === "project" ? "" : ` by ${STACK_WORD[stack].noun}`}` : "Tokens per day"}</h2>
          <div className="hint">{cost ? `${STACK_HINT[stack](!!d.project)} API list prices; unpriced models are left out.`
            : "Select a kind to hide it. Cache reads usually dwarf the rest."}{showAvg ? " The 7-day average covers complete days." : ""} Select a day to list its sessions by cost; with the keyboard, focus the chart, use the arrow keys and press Enter.</div></div>
        <div className="chart-ctl">
          {cost && <>
            <span className="muted" id="stackBy">Stack by</span>
            <div className="seg" role="group" aria-labelledby="stackBy">
              {STACKS.map(x => <button key={x} type="button" aria-pressed={x === stack} onClick={() => onStack(x)}>{STACK_WORD[x].label}</button>)}
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
      <div className="chart" ref={box} tabIndex={0} hidden={none} role="img" aria-label={label} onKeyDown={onKey} onBlur={() => setAt(null)}>
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {/* Today's hatch: surface-colored stripes over each segment, so every series color shows through in either theme. */}
          <defs><pattern id="partial-day" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="2.5" height="6" fill="var(--surface-1)" opacity=".6" /></pattern></defs>
          {ticks.map(v => <g key={v}><line x1={a.m.l} x2={W - a.m.r} y1={a.y(v)} y2={a.y(v)} stroke="var(--grid)" />
            <text x={a.m.l - 6} y={a.y(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">{ty(v)}</text></g>)}
          {pts.map((p, i) => {
            const x = a.x(i), segs = kinds.filter(k => (p.v[k.k] ?? 0) > 0);
            let base = 0;
            return <g key={p.day}>
              {i % a.every === 0 && <text x={x + a.w / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--text-muted)">{dayLabel(p.day)}</text>}
              {/* One group per bar, so the whole stack grows from the baseline when data lands. */}
              {segs.length > 0 && <g className="bar-seg" style={{ ["--i" as string]: Math.min(i, 60) }}>{segs.map((k, j) => {
                const v = p.v[k.k]!, top = a.y(base + v), h = v / a.yMax * a.ih;
                base += v;
                // 2px surface gap between stacked segments; the top segment gets rounded corners.
                const hh = Math.max(0, h - (j ? 2 : 0));
                const shape = (fill: string, cls?: string) => j === segs.length - 1 && hh > 4
                  ? <path className={cls} d={`M${x},${top + hh} V${top + 3} q0,-3 3,-3 H${x + a.w - 3} q3,0 3,3 V${top + hh} Z`} fill={fill} />
                  : <rect className={cls} x={x} y={top} width={a.w} height={hh} fill={fill} />;
                return <Fragment key={k.k}>{shape(k.c)}{i === live && shape("url(#partial-day)", "partial")}</Fragment>;
              })}</g>}
            </g>;
          })}
          {/* The average line, haloed in the surface color so it stays readable across bars of any hue. */}
          {showAvg && <>
            <path d={avgLine} fill="none" stroke="var(--surface-1)" strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="round" />
            <path d={avgLine} fill="none" stroke="var(--text-primary)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
          </>}
          {pk && total(pk) > 0 && (() => {
            const { x, anchor } = peakLabelAt(a, peak);
            return <text x={x} y={a.y(total(pk)) - 7} textAnchor={anchor} fontSize="11" fontWeight="600" fill="var(--text-primary)"
              stroke="var(--surface-1)" strokeWidth="3" paintOrder="stroke">Peak {fy(total(pk))} · {dayLabel(pk.day)}{soFar(peak)}</text>;
          })()}
          {at && <rect x={a.m.l + at.i * a.bw} width={a.bw} y={a.m.t} height={a.ih} fill="var(--text-primary)" opacity=".06" />}
          <rect className="hit" x={a.m.l} y={a.m.t} width={a.iw} height={a.ih} fill="transparent" style={{ cursor: "pointer" }}
            onPointerMove={onMove} onPointerLeave={() => setAt(null)} onClick={ev => pick(indexAt(ev.clientX))} />
        </svg>
        <div className="tip" ref={tip} role="tooltip" style={{ display: cur ? "block" : "none" }}>{cur && at && <>
          <div className="muted">{dayLabel(cur.day, true)}{soFar(at.i)}</div>
          {cost ? <>
            {parts(cur).map(k => <Fragment key={k.k}><Row k={k} v={usd(cur.v[k.k])} />
              {isOther(k) && topOther(cur).map(o => <div key={o.name} className="row sub"><span>{o.name}</span><span>{usd(o.cost)}</span></div>)}
              {isOther(k) && moreOther(cur) > 0 && <div className="row sub"><span>{`+ ${moreOther(cur)} more`}</span></div>}
            </Fragment>)}
            <div className={"row" + (parts(cur).length ? " tot" : "")}><span>Total</span><b>{usd(cur.cost)}</b></div>
            {cur.unpriced > 0 && <div className="muted">{plural(cur.unpriced, "unpriced request")}</div>}
          </> : <>
            {kinds.slice().reverse().map(k => <Row key={k.k} k={k} v={big(cur.v[k.k])} />)}
            <div className="row tot"><span>Total</span><b>{big(total(cur))}</b></div>
          </>}
          {avgText(at.i) && <div className="muted">{avgText(at.i)}</div>}
        </>}</div>
      </div>
      <div className="sr" aria-live="polite">{cur && at ? `${dayLabel(cur.day, true)}${soFar(at.i)}: ${text(cur, at.i)}` : ""}</div>
    </section>
  );
}
