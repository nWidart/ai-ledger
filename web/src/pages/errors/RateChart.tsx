import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { num as fmt, niceStep } from "../../format";
import { useErrors } from "./context";
import { bucketOf, chartData, incSummary, label, linePath, pointRows, pointText, pointWhen, shortLabel, sumCalls, TOPN, typeColor } from "./model";

// Two panels on one time axis, each with its own labeled scale: error rate (line) above, error counts by type (stacked bars) below.
const H = 280, ML = 40, MR = 10, rT = 18, rH = 62, bT = rT + rH + 26, bH = H - bT - 24;
const T = ({ x, y, a = "end", strong, children }: { x: number; y: number; a?: "start" | "middle" | "end"; strong?: boolean; children: ReactNode }) => (
  <text x={x} y={y} textAnchor={a} fontSize="11" fill={strong ? "var(--text-secondary)" : "var(--text-muted)"} fontWeight={strong ? 500 : undefined}>{children}</text>
);

export function RateChart() {
  const { m, v, f, vt, fixes, pick, after } = useErrors();
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
  // A redraw drops the reading.
  useEffect(() => { setHover(null); setLive(""); }, [dataKey, cat, W, fixes]);

  const n = keys.length, iw = (W || 800) - ML - MR, bw = iw / n, cx = (i: number) => ML + (i + .5) * bw;
  const rMax0 = Math.max(.1, ...pts.map(p => p.r || 0)) * 1.1, rStep = niceStep(rMax0 / 2), rMax = Math.ceil(rMax0 / rStep) * rStep;
  const yR = (x: number) => rT + rH - x / rMax * rH;
  const eMax0 = Math.max(1, ...pts.map(p => p.e)) * 1.05, eStep = niceStep(eMax0 / 3), eMax = Math.ceil(eMax0 / eStep) * eStep;
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
      i = j;
    }
    for (let x = 0; x <= rMax + 1e-9; x += rStep)
      g.push(<line key={"rg" + x} x1={ML} x2={Wd - MR} y1={yR(x)} y2={yR(x)} stroke="var(--grid)" />, <T key={"rl" + x} x={ML - 6} y={yR(x) + 4}>{fmt(x, rStep < 1 ? 1 : 0) + "%"}</T>);
    for (let x = 0; x <= eMax + 1e-9; x += eStep)
      g.push(<line key={"eg" + x} x1={ML} x2={Wd - MR} y1={yB(x)} y2={yB(x)} stroke="var(--grid)" />, <T key={"el" + x} x={ML - 6} y={yB(x) + 4}>{fmt(x)}</T>);
    g.push(<T key="rt" x={ML} y={rT - 7} a="start" strong>Error rate, % of tool calls</T>, <T key="bt" x={ML} y={bT - 8} a="start" strong>{`Failed calls per ${per}, by type`}</T>);
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
    // Rate line: solid across buckets with calls; a faint dotted bridge over a no-activity gap, never a lone dot.
    const all = linePath(pts.map(p => p.r), cx, yR);
    const fx = Object.entries(fixes).flatMap(([cid, day]) => {
      const i = keys.indexOf(bucketOf(day, v.gran));
      return i < 0 || !m.cats[cid] ? [] : [[cid, i] as const];
    });
    return { g, rects, all, fx };
  }, [pts, W, fixes, vt]); // the scales and labels follow from these

  const sel = cat ? linePath(pts.map(p => (p.c ? (p.byAll[cat] || 0) / p.c * 100 : null)), cx, yR) : { solid: "", bridge: "" };
  const selColor = cat ? typeColor(cat, vt) : "none";
  const empty = !pts.some(p => p.c);

  const show = (i: number, sx: number, sy: number) => { setHover({ i, sx, sy }); return pointText(m, v, pts[i]!, vt); };
  const hide = () => setHover(null);
  const move = (ev: MouseEvent<SVGRectElement>) => {
    const r = svg.current!.getBoundingClientRect(), px = (ev.clientX - r.left) * (W || 800) / r.width;
    show(Math.max(0, Math.min(n - 1, Math.floor((px - ML) / bw))), ev.clientX, ev.clientY);
  };
  const key = (ev: KeyboardEvent<HTMLDivElement>) => {
    if (empty) return;
    const ci = hover?.i ?? -1, i = ({ ArrowLeft: ci < 0 ? n - 1 : ci - 1, ArrowRight: ci + 1, Home: 0, End: n - 1 } as Record<string, number>)[ev.key];
    if (i == null) return;
    ev.preventDefault();
    const j = Math.max(0, Math.min(n - 1, i)), p = pts[j]!, r = svg.current!.getBoundingClientRect();
    setLive(show(j, r.left + cx(j) * r.width / (W || 800), r.top + (p.r == null ? rT + rH / 2 : yR(p.r)) * r.height / H));
  };
  // The tooltip sits right of the pointer, or left of it near the window's edge.
  useLayoutEffect(() => {
    const tip = tipEl.current;
    if (!tip || !hover) return;
    const tx = hover.sx + 14 + tip.offsetWidth > window.innerWidth ? Math.max(4, hover.sx - tip.offsetWidth - 14) : hover.sx + 14;
    tip.style.left = tx + window.scrollX + "px"; tip.style.top = hover.sy + window.scrollY - 10 + "px";
  }, [hover]);

  const hp = hover && pts[hover.i];
  return <>
    <section className="card chart-card" aria-labelledby="chartTitle">
      <h2 id="chartTitle">{cat ? `Errors by type · ${m.cats[cat]!.label} selected` : "Errors by type"}</h2>
      <div className="hint" id="chartHint">{`Failed tool calls per ${per}, top ${TOPN} types and Other, with the error rate (errors per 100 tool calls) above. Dashed lines mark fixes you applied.`}</div>
      {legend(pts.some(p => !p.c))}
      {selOut()}
      <div id="chart" ref={box} tabIndex={0} role="img" aria-label="Errors by type and error rate. Use the left and right arrow keys to read each point."
        onKeyDown={key} onBlur={hide}>
        {empty ? <div className="empty" style={{ height: 280, display: "grid", placeItems: "center" }}>No tool calls in this range.</div>
          : <svg key={dataKey} ref={svg} viewBox={`0 0 ${W || 800} ${H}`} aria-hidden="true" className={"grow" + (cat ? " has-sel" : "")}>
            {drawn.g}
            <g className="bars" style={{ transformOrigin: `0 ${bT + bH}px` }}>
              {order.map(c => <g key={c} className={"layer" + (c === layer ? " on" : "")} data-c={c} fill={c === "__other" ? "var(--type-other)" : typeColor(c, vt)}>{drawn.rects[c]}</g>)}
            </g>
            <path d={drawn.all.bridge} fill="none" stroke="var(--text-muted)" strokeWidth="1.25" strokeDasharray="1 4" strokeLinecap="round" opacity=".7" />
            <path className="rline" id="rAll" pathLength={1} d={drawn.all.solid} fill="none" stroke={cat ? "var(--text-muted)" : "var(--text-primary)"} strokeWidth={cat ? 1.5 : 2} strokeLinejoin="round" strokeLinecap="round" />
            <path id="rSelB" d={sel.bridge} fill="none" stroke={selColor} strokeWidth="1.25" strokeDasharray="1 4" strokeLinecap="round" opacity=".8" />
            <path id="rSel" d={sel.solid} fill="none" stroke={selColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {drawn.fx.map(([cid, i]) => <g key={cid} className={"fix" + (cid === cat ? " on" : "")} data-c={cid}>
              <line x1={cx(i)} x2={cx(i)} y1={rT} y2={bT + bH} stroke="var(--good)" strokeWidth="1.5" strokeDasharray="4 3" />
              <text x={cx(i) + 4} y={rT + 10} fontSize="11" fill="var(--good-text)">✓ {shortLabel(m.cats[cid]!.label)}</text></g>)}
            <rect id="xh" x={hover ? ML + hover.i * bw : 0} y={rT} height={bT + bH - rT} width={bw} fill="var(--text-primary)" opacity=".06" visibility={hover ? "visible" : "hidden"} />
            <circle id="xd" r="4.5" cx={hp && hp.r != null ? cx(hover.i) : 0} cy={hp && hp.r != null ? yR(hp.r) : 0} fill="var(--text-primary)" stroke="var(--surface-1)" strokeWidth="2"
              visibility={hp && hp.r != null ? "visible" : "hidden"} />
            <rect x={ML} y={rT} width={iw} height={bT + bH - rT} fill="transparent" id="hit" onMouseMove={move} onMouseLeave={hide} />
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
      {!p.c ? <div><b>No activity</b> · no tool calls</div> : <>
        <div className="tot"><b>{fmt(p.r, 2)}%</b> rate · <b>{fmt(p.e)}</b> errors · {fmt(p.c)} calls</div>
        {rows.map(([l, k, c, on]) => <div key={l} className={"trow" + (on ? " on" : "")}><span><i className="sw" style={{ background: c }} />{shortLabel(l)}</span><b>{fmt(k)}</b></div>)}
        {inOther && selN ? <div className="trow on"><span>{shortLabel(m.cats[cat]!.label)}</span><b>{fmt(selN)}</b></div> : null}
      </>}
    </>;
  }

  /** Each type is a button that selects it; Other and the rate line are keys. */
  function legend(gaps: boolean) {
    const s = cat && vt.counts[cat] ? cat : null, sc = s && typeColor(s, vt);
    return (
      <div className={"legend" + (cat ? " has-sel" : "")} id="legend" role="group" aria-label="Error types in the chart">
        {vt.layers.map(c => <button key={c} type="button" data-c={c} aria-pressed={cat === c} onClick={() => pick(cat === c ? null : c)}>
          <i className="sw" style={{ background: typeColor(c, vt) }} /><span>{m.cats[c]!.label}</span><em>{fmt(vt.counts[c])}</em></button>)}
        {Object.keys(vt.counts).length > vt.layers.length && <span className="key"><i className="sw" style={{ background: "var(--type-other)" }} />Other types</span>}
        <span className="key"><i className="sw line" style={s ? { borderTopColor: "var(--text-muted)" } : undefined} />{s ? "Overall rate" : "Error rate"}</span>
        {s && <span className="key"><i className="sw line sel" style={{ borderTopColor: sc! }} />{shortLabel(m.cats[s]!.label)} rate</span>}
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
