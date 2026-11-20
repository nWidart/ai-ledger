import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { LimitWindow, PlanChange } from "../../api";
import { scaleMargins, textScale, useWidth } from "../../components/chart";
import { caption, coneCrosses, hasScenario, nearestPoint, paceRates, planName, readPoints, readText, safePace, tipPlace, whenDay, windowName } from "./limits";

const H0 = 168, M0 = { t: 12, r: 10, b: 24, l: 36 }, TICK = 8; // at the default text size

/** The plan changes that fall inside a window. */
export const planMarks = (w: LimitWindow, events: PlanChange[]) =>
  events.filter(e => e.provider === w.provider && Date.parse(e.at) >= Date.parse(w.start) && Date.parse(e.at) <= Date.parse(w.resets_at));

const KEYS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity };

/** One window from its start to its reset, in at most four encodings: the percent used so far (one line, solid where measured,
 *  faded where estimated), the forecast as a cone from its low to its high bound around its middle (the warning tint when the
 *  high bound reaches 100% before the reset), now, and the safe-pace line from now to 100% at the reset. The 100% grid line and
 *  the reset time frame it; a plan change inside the window is a labelled tick at the top. recent: also draw the last-24-hours
 *  line, and read its value. now: null for a closed window (closedWindow): it runs to its close, which is its resets_at here,
 *  and has no forecast, no now and no safe pace. */
export function LimitChart({ w, now, events, recent: showRecent = false }: { w: LimitWindow; now: string | null; events: PlanChange[]; recent?: boolean }) {
  const box = useRef<HTMLDivElement>(null), tip = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null), W = useWidth(box, 420);
  // The labels' size comes from the stylesheet (rem); the room around them follows it, the plot keeps its height.
  const ts = textScale(), M = scaleMargins(M0, ts), H = H0 + (M.t + M.b) - (M0.t + M0.b);
  // The point being read, and where its tooltip goes (client pixels). key: set by the keyboard, so only that is announced.
  const [read, setRead] = useState<{ i: number; x: number; y: number; key: boolean } | null>(null);
  const pts = useMemo(() => readPoints(w), [w]), nowAt = Math.max(0, w.series.length - 1);
  const t0 = Date.parse(w.start), t1 = Date.parse(w.resets_at), iw = W - M.l - M.r, ih = H - M.t - M.b;
  const x = (t: string) => M.l + Math.min(1, Math.max(0, (Date.parse(t) - t0) / (t1 - t0 || 1))) * iw;
  const y = (p: number) => M.t + ih * (1 - Math.min(100, Math.max(0, p)) / 100);
  const path = (pts: { t: string; v: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const est = path(w.series.map(p => ({ t: p.t, v: p.pct })));
  const measured = w.series.filter(p => p.measured);
  const f = w.forecast, warn = coneCrosses(w) ? " warn" : "", safe = safePace(w, now), rates = paceRates(w);
  const pctOf = (i: number) => { const p = pts[i]!; return p.kind === "past" ? p.pct : p.mid; };
  const recent = showRecent && f && hasScenario(w) ? path(f.curve.flatMap(p => p.recent == null ? [] : [{ t: p.t, v: p.recent }])) : null;
  const band = f && `${path(f.curve.map(p => ({ t: p.t, v: p.hi })))}L${f.curve.slice().reverse().map(p => `${x(p.t).toFixed(1)},${y(p.lo).toFixed(1)}`).join("L")}Z`;
  // The page's one time format; a narrow chart keeps the date of a long window, or the time of a short one.
  const at = W >= 360 * ts ? whenDay : (w.window_minutes ?? 0) >= 1440
    ? (t: string) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : (t: string) => new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  // "now" under its tick, when it clears the start and reset labels (about 110px each at the default size).
  const nowLabel = now != null && x(now) - M.l > 120 * ts && W - M.r - x(now) > 150 * ts;
  const marks = planMarks(w, events), said = (e: PlanChange) => `Plan change from ${e.plan_from} to ${e.plan_to}, ${whenDay(e.at)}`;
  // A click or tap focuses the chart too: it keeps what the pointer shows. Only focus from the keyboard reads now.
  const pointed = useRef(false);
  const cur = read ? pts[read.i] : undefined;
  useLayoutEffect(() => {
    if (!cur || !read || !tip.current || !box.current) return;
    const el = tip.current, r = box.current.getBoundingClientRect();
    el.style.left = "0px"; // the old left would narrow the room the text wraps in
    const p = tipPlace({ w: r.width, h: r.height }, { w: el.offsetWidth, h: el.offsetHeight }, { x: read.x - r.left, y: read.y - r.top });
    el.style.left = p.left + "px"; el.style.top = p.top + "px";
  }, [read, cur]);
  const scale = () => { const r = svg.current!.getBoundingClientRect(); return { r, k: r.width ? r.width / W : 1 }; };
  const onMove = (ev: PointerEvent) => {
    if (!pts.length) return;
    const { r, k } = scale(), px = (ev.clientX - r.left) / k;
    setRead({ i: nearestPoint(pts, t0 + (px - M.l) / iw * (t1 - t0)), x: ev.clientX, y: ev.clientY, key: false });
  };
  const show = (i: number) => {
    const { r, k } = scale();
    setRead({ i, x: r.left + x(pts[i]!.t) * k, y: r.top + y(pctOf(i)) * k, key: true });
  };
  const onKey = (ev: KeyboardEvent) => {
    if (ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return; // Alt+Left is history, Ctrl+Home the page: not ours
    if (ev.key === "Escape") return setRead(null);
    const step = KEYS[ev.key];
    if (step == null) return;
    ev.preventDefault();
    show(Math.max(0, Math.min(pts.length - 1, (read?.i ?? nowAt) + step)));
  };
  // A chart with points is one tab stop: a labelled group around the image, since an image takes no keys.
  const reader = pts.length ? {
    tabIndex: 0, role: "group", onKeyDown: onKey, onPointerDown: () => { pointed.current = true; },
    onPointerCancel: () => { pointed.current = false; }, // a touch scroll ends here with no focus
    onFocus: () => { if (!pointed.current) show(nowAt); pointed.current = false; },
    onBlur: () => { pointed.current = false; setRead(null); },
    "aria-label": `${windowName(w)} chart. Use the left and right arrow keys to read each point, Home and End for the first and last, Escape to clear.`,
  } : {};
  return (
    <div className="lim-chart" ref={box} {...reader}>
      <svg ref={svg} width={W} height={H} role="img" onPointerMove={onMove} onPointerLeave={() => setRead(null)}
        aria-label={[now == null ? `${w.provider_label} ${w.label}: ${w.current ?? "–"}% used when it ended ${whenDay(w.resets_at)}.`
          : `${w.provider_label} ${w.label}: ${w.current ?? "–"}% used. ${caption(w)}.`,
          rates && `Forecast pace ${rates.now}, safe pace ${rates.safe}${rates.hot ? ", running hot" : ""}.`, ...marks.map(e => `${said(e)}.`)].filter(Boolean).join(" ")}>
        {[0, 50, 100].map(p => <g key={p}>
          <line x1={M.l} x2={W - M.r} y1={y(p)} y2={y(p)} className={p === 100 ? "cap" : "grid"} />
          <text x={M.l - 6 * ts} y={y(p) + 4 * ts} textAnchor="end" className="ax">{p}%</text>
        </g>)}
        {band && <path d={band} className={"band" + warn} />}
        {f && <path d={path(f.curve.map(p => ({ t: p.t, v: p.mid })))} className={"fc" + warn} />}
        {safe && <path d={path([safe.from, safe.to])} className="safe" />}
        {recent && <path d={recent} className="recent" />}
        {est && <path d={est} className="est" />}
        {measured.length > 1 && <path d={path(measured.map(p => ({ t: p.t, v: p.pct })))} className="meas" />}
        {measured.length === 1 && <circle cx={x(measured[0]!.t)} cy={y(measured[0]!.pct)} r={2} className="meas-one" />}
        {marks.map(e => <g key={e.at} className="plan"><title>{said(e)}</title>
          <line x1={x(e.at)} x2={x(e.at)} y1={M.t} y2={M.t + TICK * ts} />
          <line x1={x(e.at)} x2={x(e.at)} y1={M.t} y2={M.t + TICK * ts} className="hit" />
          <text x={x(e.at) + (x(e.at) > W / 2 ? -4 : 4) * ts} y={M.t + 8 * ts} textAnchor={x(e.at) > W / 2 ? "end" : "start"}>{`plan: ${planName(e.plan_to)}`}</text></g>)}
        {now != null && <line x1={x(now)} x2={x(now)} y1={M.t} y2={M.t + ih} className="now" />}
        {cur && read && <>
          <line x1={x(cur.t)} x2={x(cur.t)} y1={M.t} y2={M.t + ih} className="guide" />
          <circle cx={x(cur.t)} cy={y(pctOf(read.i))} r={4} className={"pick" + (cur.kind === "forecast" ? " ahead" : "")} />
        </>}
        <text x={M.l} y={H - 6 * ts} className="ax">{at(w.start)}</text>
        <text x={W - M.r} y={H - 6 * ts} textAnchor="end" className="ax">{now == null ? "ended" : "resets"} {at(w.resets_at)}</text>
        {nowLabel && <text x={x(now!)} y={H - 6 * ts} textAnchor="middle" className="ax now-ax">now</text>}
      </svg>
      {pts.length > 0 && <>
        <div className="tip" ref={tip} aria-hidden="true" style={{ display: cur ? "block" : "none" }}>{cur && readText(cur, !!recent)}</div>
        <span className="sr" aria-live="polite">{cur && read?.key ? readText(cur, !!recent) : ""}</span>
      </>}
    </div>
  );
}
