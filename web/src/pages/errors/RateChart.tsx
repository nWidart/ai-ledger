import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { num as fmt, niceStep } from "../../format";
import { useErrors } from "./context";
import { bucketLabel, bucketOf, chartData, incSummary, label, linePath, LOW_CALLS, noCalls, pointRows, pointText, pointWhen, selectable, shortLabel, sumCalls, TOPN, typeColor } from "./model";

// Two panels on one time axis, each with its own labeled scale: error rate (line) above, error counts by type (stacked bars) below.
const H = 320, ML = 40, MR = 10, rT = 18, rH = 100, bT = rT + rH + 26, bH = H - bT - 24;
const T = ({ x, y, a = "end", strong, children }: { x: number; y: number; a?: "start" | "middle" | "end"; strong?: boolean; children: ReactNode }) => (
  <text x={x} y={y} textAnchor={a} fontSize="11" fill={strong ? "var(--text-secondary)" : "var(--text-muted)"} fontWeight={strong ? 500 : undefined}>{children}</text>
);

export function RateChart() {
  const { m, v, f, vt, fixes, pick, after, update, say } = useErrors();
  const box = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null), tipEl = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(0);
  const [hover, setHover] = useState<{ i: number; sx: number; sy: number } | null>(null), [live, setLive] = useState("");
  const { keys, pts } = useMemo(() => chartData(m, v, f, vt), [m, v, f, vt]);
  const dataKey = JSON.stringify([f.start, v.project, v.source, v.sub, v.noise, v.gran, vt.extra]);
  const cat = v.cat, per = v.gran === "week" ? "week" : "day";

  // Width from the box; a resize redraws after it settles.
  useLayoutEffect(() => {
    const el = box.current!;
    setW(el.clientWidth || 800);
    let t = 0;
    const ro = new ResizeObserver(() => { clearTimeout(t); t = window.setTimeout(() => setW(el.clientWidth || 800), 120); });
    ro.observe(el);
    return () => { ro.disconnect(); clearTimeout(t); };
  }, []);
  // The keyboard's current point, by its bucket key: it outlives the reading (selecting a point can close the open type, which
  // drops the reading) and a redraw that shifts the points, and resolves to a point only while the chart still has that key.
  const cur = useRef<string | null>(null);
  // A redraw drops the reading.
  useEffect(() => { setHover(null); setLive(""); }, [dataKey, cat, W, fixes, pts]);

  const n = keys.length, iw = (W || 800) - ML - MR, bw = iw / n, cx = (i: number) => ML + (i + .5) * bw;
  // The rate panel shows the selected type's rate on its own scale, or the overall rate. Buckets with under LOW_CALLS calls
  // (when others have more) are marked and left out of the scale: one quiet day's 3 of 12 can't flatten the rest.
  const rates = pts.map(p => (cat ? (p.c ? (p.byAll[cat] || 0) / p.c * 100 : null) : p.r));
  const low = pts.map(p => p.c > 0 && p.c < LOW_CALLS && pts.some(q => q.c >= LOW_CALLS));
  const rMax0 = Math.max(.1, ...rates.map((r, i) => (low[i] ? 0 : r || 0))) * 1.1, rStep = niceStep(rMax0 / 3), rMax = Math.ceil(rMax0 / rStep) * rStep;
  const yR = (x: number) => rT + rH - Math.min(x, rMax) / rMax * rH;
  // Counts are whole: whole steps.
  const eMax0 = Math.max(1, ...pts.map(p => p.e)) * 1.05, eStep = Math.max(1, niceStep(eMax0 / 3)), eMax = Math.ceil(eMax0 / eStep) * eStep;
  const yB = (x: number) => bT + bH - x / eMax * bH;
  const order = [...vt.layers, "__other"];
  const layer = cat && (vt.layers.includes(cat) ? cat : "__other");

  const drawn = useMemo(() => {
    const Wd = W || 800, g: ReactNode[] = [];
    // No activity: faint bands over buckets without a single tool call, labeled when there's room.
    for (let i = 0; i < n; i++) {
      if (pts[i]!.c) continue;
      let j = i;
      while (j + 1 < n && !pts[j + 1]!.c) j++;
      const x0 = ML + i * bw, w = (j - i + 1) * bw;
      g.push(<rect key={"na" + i} x={x0} y={rT} width={w} height={bT + bH - rT} fill="var(--surface-2)" opacity=".75" />);
      if (w > 64) g.push(<T key={"nt" + i} x={x0 + w / 2} y={bT + bH / 2} a="middle">no activity</T>);
      // A folded stretch: a break in the axis, two slashes on its baseline.
      for (let k = i; k <= j; k++) if (pts[k]!.to) g.push(<T key={"fold" + k} x={cx(k)} y={bT + bH + 4} a="middle">//</T>);
      i = j;
    }
    for (let x = 0; x <= rMax + 1e-9; x += rStep)
      g.push(<line key={"rg" + x} x1={ML} x2={Wd - MR} y1={yR(x)} y2={yR(x)} stroke="var(--grid)" />, <T key={"rl" + x} x={ML - 6} y={yR(x) + 4}>{fmt(x, rStep < 1 ? 1 : 0) + "%"}</T>);
    for (let x = 0; x <= eMax + 1e-9; x += eStep)
      g.push(<line key={"eg" + x} x1={ML} x2={Wd - MR} y1={yB(x)} y2={yB(x)} stroke="var(--grid)" />, <T key={"el" + x} x={ML - 6} y={yB(x) + 4}>{fmt(x)}</T>);
    g.push(<T key="rt" x={ML} y={rT - 7} a="start" strong>{cat ? `${shortLabel(m.cats[cat]!.label)} rate, % of tool calls` : "Error rate, % of tool calls"}</T>, <T key="bt" x={ML} y={bT - 8} a="start" strong>{`Failed calls per ${per}, by type`}</T>);
    const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 70))));
    keys.forEach((k, i) => { if (i % every === 0) g.push(<T key={"x" + k} x={cx(i)} y={H - 6} a="middle">{label(k)}</T>); });
    // Stacked bars: biggest type on the baseline, Other on top; a 2px surface gap between segments.
    const bwid = Math.max(1, Math.min(26, bw * .72)), rects: Record<string, ReactNode[]> = Object.fromEntries(order.map(c => [c, []]));
    pts.forEach((p, i) => {
      let acc = 0;
      for (const c of order) {
        const val = c === "__other" ? p.other : p.by[c] || 0;
        if (!val) continue;
        const y0 = yB(acc), y1 = yB(acc + val), h = y0 - y1, gap = h > 4 ? 2 : 0;
        rects[c]!.push(<rect key={i} x={(cx(i) - bwid / 2).toFixed(1)} y={y1.toFixed(1)} width={bwid.toFixed(1)} height={Math.max(.8, h - gap).toFixed(1)} rx="1.5" />);
        acc += val;
      }
    });
    // Rate line: solid across buckets with calls; a faint dotted bridge over a no-activity gap. Low-volume buckets get a hollow mark.
    const all = linePath(rates, cx, yR);
    rates.forEach((r, i) => { if (low[i] && r != null) g.push(<circle key={"lo" + i} className="lowc" cx={cx(i)} cy={yR(r)} r="3" fill="var(--surface-1)" stroke="var(--text-muted)" strokeWidth="1.25" />); });
    const fx = Object.entries(fixes).flatMap(([cid, day]) => {
      const i = keys.indexOf(bucketOf(day, v.gran));
      return i < 0 || !m.cats[cid] ? [] : [[cid, i] as const];
    });
    return { g, rects, all, fx };
  }, [pts, W, fixes, vt, cat]); // the scales and labels follow from these

  const lineColor = cat ? typeColor(cat, vt) : "var(--text-primary)";
  const sel = v.at ? pts.findIndex(p => p.k === v.at && selectable(p)) : -1;
  const empty = !pts.some(p => p.c), noErrors = !pts.some(p => p.e);

  const show = (i: number, sx: number, sy: number) => { setHover({ i, sx, sy }); return pointText(m, v, pts[i]!, vt); };
  const hide = () => setHover(null), blur = () => { hide(); cur.current = null; };
  const at = (ev: MouseEvent<SVGRectElement>) => {
    const r = svg.current!.getBoundingClientRect(), px = (ev.clientX - r.left) * (W || 800) / r.width;
    return Math.max(0, Math.min(n - 1, Math.floor((px - ML) / bw)));
  };
  const move = (ev: MouseEvent<SVGRectElement>) => { cur.current = null; show(at(ev), ev.clientX, ev.clientY); };
  // Selects a bucket for the type table and the detail, or clears it when it is the selected one. A folded stretch has no calls to explain.
  const toggle = (i: number) => {
    const p = pts[i]!;
    if (!selectable(p)) return say("A stretch without tool calls can't be selected.");
    const on = v.at === p.k;
    update({ at: on ? null : p.k }, true);
    say(on ? "Selection cleared: the table and detail cover the whole range." : `Selected ${pointWhen(v, p)}: the table and detail show only its errors.`);
  };
  const key = (ev: KeyboardEvent<HTMLDivElement>) => {
    const pick = ev.key === "Enter" || ev.key === " ";
    if (pick) ev.preventDefault(); // Space would scroll the page
    if (empty) return;
    const k = cur.current == null ? -1 : pts.findIndex(p => p.k === cur.current), ci = k >= 0 ? k : hover?.i ?? -1;
    if (pick) return ci >= 0 ? toggle(ci) : undefined;
    const i = ({ ArrowLeft: ci < 0 ? n - 1 : ci - 1, ArrowRight: ci + 1, Home: 0, End: n - 1 } as Record<string, number>)[ev.key];
    if (i == null) return;
    ev.preventDefault();
    const j = Math.max(0, Math.min(n - 1, i)), y = rates[j], r = svg.current!.getBoundingClientRect();
    cur.current = pts[j]!.k;
    setLive(show(j, r.left + cx(j) * r.width / (W || 800), r.top + (y == null ? rT + rH / 2 : yR(y)) * r.height / H));
  };
  // The tooltip sits right of the pointer, or left of it near the window's edge; above it near the bottom edge.
  useLayoutEffect(() => {
    const tip = tipEl.current;
    if (!tip || !hover) return;
    const tx = hover.sx + 14 + tip.offsetWidth > window.innerWidth ? Math.max(4, hover.sx - tip.offsetWidth - 14) : hover.sx + 14;
    const ty = hover.sy - 10 + tip.offsetHeight > window.innerHeight - 4 ? Math.max(4, hover.sy - tip.offsetHeight - 14) : hover.sy - 10;
    tip.style.left = tx + window.scrollX + "px"; tip.style.top = ty + window.scrollY + "px";
  }, [hover]);

  const hp = hover && pts[hover.i], hr = hover ? rates[hover.i] : null;
  return <>
    <section className="card chart-card" aria-labelledby="chartTitle">
      <h2 id="chartTitle">{cat ? `Errors by type · ${m.cats[cat]!.label} selected` : "Errors by type"}</h2>
      <div className="hint" id="chartHint">{`Failed tool calls per ${per}, top ${TOPN} types and Other, with ${cat ? "the selected type's" : "the"} error rate (errors per 100 tool calls) above. Dashed lines mark fixes you applied.`}</div>
      {!noErrors && legend(pts.some(p => !p.c), low.some(Boolean))}
      {selOut()}
      <div id="chart" ref={box} tabIndex={0} role="application" aria-roledescription="chart" aria-describedby="chartHint" aria-label={`Errors by type and error rate. Use the left and right arrow keys to read each point, Enter or Space to select the ${per} for the table and examples.${v.at ? ` Selected: ${bucketLabel(m, v)}.` : ""}`}
        onKeyDown={key} onBlur={blur}>
        {empty || noErrors ? <div className="empty">{empty ? "No tool calls in this range." : `No failed tool calls in this range, out of ${fmt(sumCalls(v, f.calls))}.`}</div>
          : <svg key={dataKey} ref={svg} viewBox={`0 0 ${W || 800} ${H}`} aria-hidden="true" className={"grow" + (cat ? " has-sel" : "")}>
            {drawn.g}
            <g className="bars" style={{ transformOrigin: `0 ${bT + bH}px` }}>
              {order.map(c => <g key={c} className={"layer" + (c === layer ? " on" : "")} data-c={c} fill={c === "__other" ? "var(--type-other)" : typeColor(c, vt)}>{drawn.rects[c]}</g>)}
            </g>
            <path d={drawn.all.bridge} fill="none" stroke={cat ? lineColor : "var(--text-muted)"} strokeWidth="1.25" strokeDasharray="1 4" strokeLinecap="round" opacity=".7" />
            <path className="rline" id={cat ? "rSel" : "rAll"} pathLength={1} d={drawn.all.solid} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {drawn.fx.map(([cid, i]) => <g key={cid} className={"fix" + (cid === cat ? " on" : "")} data-c={cid}>
              <line x1={cx(i)} x2={cx(i)} y1={rT} y2={bT + bH} stroke="var(--good)" strokeWidth="1.5" strokeDasharray="4 3" />
              <text x={cx(i) + 4} y={rT + 10} fontSize="11" fill="var(--good-text)">✓ {shortLabel(m.cats[cid]!.label)}</text></g>)}
            <rect id="xh" x={hover ? ML + hover.i * bw : 0} y={rT} height={bT + bH - rT} width={bw} fill="var(--text-primary)" opacity=".06" visibility={hover ? "visible" : "hidden"} />
            <circle id="xd" r="4.5" cx={hp && hr != null ? cx(hover.i) : 0} cy={hp && hr != null ? yR(hr) : 0} fill={lineColor} stroke="var(--surface-1)" strokeWidth="2"
              visibility={hp && hr != null ? "visible" : "hidden"} />
            {sel >= 0 && <g id="atMark" data-at={v.at}>
              <rect x={ML + sel * bw} y={rT} width={bw} height={bT + bH - rT} fill="var(--text-primary)" opacity=".08" stroke="var(--text-primary)" strokeWidth="1.5" />
              <path d={`M${cx(sel) - 5},${bT + bH + 12}L${cx(sel) + 5},${bT + bH + 12}L${cx(sel)},${bT + bH + 4}Z`} fill="var(--text-primary)" /></g>}
            <rect x={ML} y={rT} width={iw} height={bT + bH - rT} fill="transparent" id="hit" onMouseMove={move} onMouseLeave={hide} onClick={ev => toggle(at(ev))} style={{ cursor: "pointer" }} />
          </svg>}
      </div>
      <div className="sr" id="chartLive" aria-live="polite">{live}</div>
    </section>
    <div className="tip" id="tip" role="tooltip" ref={tipEl} style={{ display: hp ? "block" : "none" }}>
      {hp && tip(hover.i)}
    </div>
  </>;

  // Render helpers, not components: their buttons keep their identity (and focus) across renders.
  function tip(i: number) {
    const p = pts[i]!, rows = pointRows(m, v, p, vt), selN = (cat && p.byAll[cat]) || 0, inOther = cat && !vt.layers.includes(cat);
    return <>
      <div className="muted">{pointWhen(v, p)}</div>
      {!p.c && !p.e ? <div><b>No activity</b> · no tool calls</div> : <>
        {p.c ? <div className="tot"><b>{fmt(p.r, 2)}%</b> rate · <b>{fmt(p.e)}</b> errors · {fmt(p.c)} calls{low[i] ? " · too few calls for a steady rate" : ""}</div>
          : <div className="tot">{noCalls(v, p)}</div>}
        {rows.map(([l, k, c, on]) => <div key={l} className={"trow" + (on ? " on" : "")}><span><i className="sw" style={{ background: c }} />{shortLabel(l)}</span><b>{fmt(k)}</b></div>)}
        {inOther && selN ? <div className="trow on"><span>{shortLabel(m.cats[cat]!.label)}</span><b>{fmt(selN)}</b></div> : null}
      </>}
    </>;
  }

  /** Each type is a button that selects it; Other and the rate line are keys. */
  function legend(gaps: boolean, lows: boolean) {
    const s = cat && vt.counts[cat] ? cat : null, sc = s && typeColor(s, vt);
    return (
      <div className={"legend" + (cat ? " has-sel" : "")} id="legend" role="group" aria-label="Error types in the chart">
        {vt.layers.map(c => <button key={c} type="button" data-c={c} aria-pressed={cat === c} onClick={() => pick(cat === c ? null : c)}>
          <i className="sw" style={{ background: typeColor(c, vt) }} /><span>{m.cats[c]!.label}</span><em>{fmt(vt.counts[c])}</em></button>)}
        {Object.keys(vt.counts).length > vt.layers.length && <span className="key"><i className="sw" style={{ background: "var(--type-other)" }} />Other types</span>}
        {s ? <span className="key"><i className="sw line sel" style={{ borderTopColor: sc! }} />{shortLabel(m.cats[s]!.label)} rate</span>
          : <span className="key"><i className="sw line" />Error rate</span>}
        {lows && <span className="key"><i className="sw low" />{`Under ${LOW_CALLS} calls`}</span>}
        {gaps && <span className="key"><i className="sw nodata" />No activity</span>}
      </div>
    );
  }

  /** The selection stays named here while it lasts: its count, share, rate and incidents in this view. */
  function selOut() {
    const s = cat && vt.counts[cat] ? cat : null;
    if (!s) return <div className="selout" id="selOut" hidden />;
    const k = vt.counts[s]!, tot = Object.values(vt.counts).reduce((a, b) => a + b, 0), calls = sumCalls(v, f.calls), is = incSummary(m, f.errs.filter(e => e.c === s));
    return (
      <div className="selout" id="selOut">
        <span className="muted">Selected</span><b><i className="sw" style={{ background: typeColor(s, vt) }} aria-hidden="true" />{m.cats[s]!.label}</b>
        <span className="muted">{fmt(k)} error{k === 1 ? "" : "s"} · {fmt(k / tot * 100, 0)}% of errors · {calls ? fmt(k / calls * 100, 2) + "% of tool calls" : "no calls"} · {fmt(is.n)} incident{is.n === 1 ? "" : "s"}</span>
        <button type="button" id="selClr" onClick={() => { pick(null); after(() => document.querySelector<HTMLElement>("#catBody button")?.focus()); }}>Clear selection</button>
      </div>
    );
  }
}
