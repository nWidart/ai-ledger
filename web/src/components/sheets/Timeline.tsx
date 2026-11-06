import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { SessionDetail } from "../../api";
import { big, dur, num, plural } from "../../format";
import { appLink, errorsHref, EV_TOP, nearestIndex, readRequest, timelineModel, type TimelineModel, type TlEvent } from "./session";

const evTime = (tl: TimelineModel, e: TlEvent) =>
  e.t1 - e.t > 60e3 ? `${tl.fmtT(e.t)}–${new Date(e.t1).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}` : tl.fmtT(e.t);
function EvName({ tl, e }: { tl: TimelineModel; e: TlEvent }) {
  if (e.kind === "compact") return <>Context compacted</>;
  if (e.kind === "commit") return <>Commit <small>{(tl.cmd[e.call.id] || "").replace(/\s+/g, " ").slice(0, 80)}</small></>;
  const tools = [...new Set(e.calls.map(c => c.tool))], cats = [...new Set(e.calls.map(c => c.category).filter(Boolean))], n = e.calls.length;
  return <>{tools.slice(0, 2).join(", ")}{tools.length > 2 ? ` +${tools.length - 2}` : ""} failed{n > 1 ? ` ${n}× in a row` : ""}
    {cats.length > 0 && <> <small>{cats.slice(0, 2).join(", ")}</small></>}</>;
}

/** The session timeline: context per request, the 80% line, compactions, commits and a tool-call strip, read with the
 *  arrow keys; below it the failures, compactions and commits as a list that marks each on the timeline. */
export function Timeline({ s, project }: { s: SessionDetail; project: string | null }) {
  const box = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null), list = useRef<HTMLOListElement>(null);
  const [width, setWidth] = useState(() => Math.min(640, innerWidth) - 40);
  useLayoutEffect(() => {
    const el = box.current!, fit = () => { if (el.clientWidth) setWidth(el.clientWidth); };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const tl = useMemo(() => timelineModel(s, width), [s, width]);
  const [at, setAt] = useState<number | null>(null), [sel, setSel] = useState<number | null>(null), [all, setAll] = useState(false);
  const focusMore = useRef(false), evH = useId();
  useEffect(() => {
    if (!all || !focusMore.current) return;
    focusMore.current = false;
    list.current?.querySelector<HTMLButtonElement>(`[data-ev="${EV_TOP}"]`)?.focus();
  }, [all]);
  if (!tl) return <div ref={box} className="tl"><div className="empty">Not enough activity to draw a timeline.</div></div>;

  const { W, H, m, iw, pb, sy, sh, x, y, yMax, limit, near, nearShown, reqs, calls, comps, fails, commits, gaps, events } = tl;
  const xs = reqs.map(r => x(r.t)), rules = commits.length <= 12; // many commits: diamonds only, no rules
  const errHref = (id: string) => errorsHref(project, null, id);
  const pxOf = (clientX: number) => { const b = svg.current!.getBoundingClientRect(); return (clientX - b.left) * W / b.width; };
  const onMove = (ev: PointerEvent) => { if (reqs.length) setAt(nearestIndex(xs, pxOf(ev.clientX))); };
  // A click on the strip or the plot picks the nearest event, so the ticks still lead somewhere.
  const onClick = (ev: { clientX: number }) => {
    if (!events.length) return;
    const px = pxOf(ev.clientX);
    let best = 0;
    events.forEach((e, k) => { if (Math.abs(x(e.t) - px) < Math.abs(x(events[best]!.t) - px)) best = k; });
    if (Math.abs(x(events[best]!.t) - px) <= 16) setSel(best);
  };
  const onKey = (ev: KeyboardEvent) => {
    const step = ({ ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity } as Record<string, number>)[ev.key];
    if (step == null || !reqs.length) return;
    ev.preventDefault();
    const n = (ev.shiftKey && Math.abs(step) === 1 ? 10 : 1) * step;
    setAt(Math.max(0, Math.min(reqs.length - 1, (at ?? (step > 0 ? -1 : reqs.length)) + n)));
  };
  const line = reqs.map((r, k) => `${k ? "L" : "M"}${x(r.t).toFixed(1)},${y(r.context).toFixed(1)}`).join("");
  const se = sel != null ? events[sel] : undefined, cur = at != null ? reqs[at] : undefined;
  const failRuns = events.filter(e => e.kind === "fail").length;

  return <>
    <div className="tl" ref={box}>
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} height={H} tabIndex={0} role="group" onKeyDown={onKey} onClick={onClick}
        aria-label={`Session timeline. ${tl.summary} Use the left and right arrow keys to read each request.`}>
        <line x1={m.l} x2={W - m.r} y1={pb} y2={pb} stroke="var(--border)" />
        <line x1={m.l} x2={W - m.r} y1={y(yMax / 2)} y2={y(yMax / 2)} stroke="var(--grid)" />
        <text x={m.l - 6} y={pb + 4} textAnchor="end" fontSize="10.5" fill="var(--text-muted)">0</text>
        <text x={m.l - 6} y={y(yMax / 2) + 4} textAnchor="end" fontSize="10.5" fill="var(--text-muted)">{big(yMax / 2)}</text>
        {nearShown && near != null && <>
          <line x1={m.l} x2={W - m.r} y1={y(near)} y2={y(near)} stroke="var(--critical)" strokeDasharray="5 4" strokeWidth="1.25" />
          <text x={W - m.r} y={y(near) - 4} textAnchor="end" fontSize="10.5" fill="var(--critical-text)">80% of {big(limit)}</text>
        </>}
        {/* Breaks where idle time was squeezed out. */}
        {gaps.map(g => <g key={g.a}><title>{dur((g.b - g.a) / 1000)} idle</title>
          <rect x={g.bx - 3} y={m.t} width="6" height={sy + sh - m.t} fill="var(--surface-2)" />
          <path d={`M${g.bx - 4},${pb + 3} l3,-6 l2,6 l3,-6`} fill="none" stroke="var(--text-muted)" /></g>)}
        {comps.map((t, k) => <g key={k}>
          <line x1={x(t)} x2={x(t)} y1={m.t} y2={pb} stroke="var(--warning)" strokeDasharray="3 3" strokeWidth="1.5" />
          <text x={x(t) + 3} y={m.t + 8} fontSize="10.5" fill="var(--warning-text)">compacted</text></g>)}
        {reqs.length > 0 && <>
          <path d={`${line}L${x(reqs.at(-1)!.t).toFixed(1)},${pb}L${x(reqs[0]!.t).toFixed(1)},${pb}Z`} fill="var(--series-1-soft)" />
          <path d={line} fill="none" stroke="var(--series-1)" strokeWidth="1.75" strokeLinejoin="round" />
        </>}
        {commits.map(c => <g key={c.id}>
          {rules && <line x1={x(c.t)} x2={x(c.t)} y1={m.t} y2={pb} stroke="var(--good)" opacity=".45" />}
          <path d={`M${x(c.t)},${pb - 5} l5,5 l-5,5 l-5,-5 Z`} fill="var(--good)" stroke="var(--surface-1)"><title>Commit at {tl.fmtT(c.t)}: {tl.cmd[c.id] || ""}</title></path>
        </g>)}
        {/* Tool-call strip: successes as faint ticks, failures in red. The ticks are only a picture; the event list below holds the targets. */}
        <rect x={m.l} y={sy} width={iw} height={sh} rx="4" fill="var(--surface-2)" />
        {calls.filter(c => !c.is_error).map(c => <rect key={c.id} x={x(c.t) - .5} y={sy + 6} width="1" height={sh - 12} fill="var(--text-muted)" opacity=".5" />)}
        {fails.map(c => <rect key={c.id} x={x(c.t) - 1} y={sy + 2} width="2" height={sh - 4} rx="1" fill="var(--critical)" />)}
        {/* The selected event's band, under the hit layer. */}
        {se && <>
          <rect className="tl-mark" x={Math.min(x(se.t), x(se.t1)) - 4} y={m.t} width={Math.abs(x(se.t1) - x(se.t)) + 8} height={sy + sh + 2 - m.t} fill="var(--accent)" opacity=".16" />
          <line x1={x(se.t)} x2={x(se.t)} y1={m.t} y2={sy + sh + 2} stroke="var(--accent)" strokeWidth="1.5" />
        </>}
        <text x={m.l} y={H - 4} fontSize="10.5" fill="var(--text-muted)">{tl.fmtT(tl.start)}</text>
        <text x={W - m.r} y={H - 4} textAnchor="end" fontSize="10.5" fill="var(--text-muted)">{tl.fmtT(tl.end)}</text>
        <text x={m.l - 6} y={sy + sh / 2 + 4} textAnchor="end" fontSize="10.5" fill="var(--text-muted)">tools</text>
        {cur && at != null && <>
          <line x1={xs[at]} x2={xs[at]} y1={m.t} y2={pb} stroke="var(--text-primary)" opacity=".35" />
          <circle cx={xs[at]} cy={y(cur.context)} r="3.5" fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth="2" />
        </>}
        <rect x={m.l} y={m.t} width={iw} height={tl.ph} fill="transparent" onPointerMove={onMove} />
      </svg>
    </div>
    <div className="tl-read" aria-live="polite">{at != null && reqs[at] ? readRequest(tl, at) : tl.summary}</div>
    <div className="tl-key" aria-hidden="true">
      <span><i style={{ width: 14, borderTop: "2px solid var(--series-1)" }} />Context per request</span>
      {nearShown ? <span><i style={{ width: 14, borderTop: "2px dashed var(--critical)" }} />80% of the context window</span>
        : limit ? <span>80% line ({big(near)}) is off the scale</span> : null}
      {comps.length > 0 && <span><i style={{ width: 0, height: 10, borderLeft: "2px dashed var(--warning)" }} />Compaction</span>}
      {commits.length > 0 && <span><i style={{ width: 8, height: 8, background: "var(--good)", transform: "rotate(45deg)" }} />Commit</span>}
      <span><i style={{ width: 1, height: 10, background: "var(--text-muted)" }} />Tool call</span>
      {fails.length > 0 && <span><i style={{ width: 2, height: 12, background: "var(--critical)" }} />Failed call</span>}
      {gaps.length > 0 && <span>⌇ idle time squeezed out</span>}
      {s.truncated && <span>Long session: only the first rows are drawn</span>}
    </div>
    {events.length > 0 && <>
      <div className="evhead"><h4 id={evH}>Events</h4><span className="c">{[
        fails.length > 0 && `${plural(failRuns, "failure run")} (${plural(fails.length, "failed call")})`,
        comps.length > 0 && plural(comps.length, "compaction"), commits.length > 0 && plural(commits.length, "commit")].filter(Boolean).join(", ")}</span></div>
      <div className="tl-sel" aria-live="polite">
        {se ? <><b>Selected</b><span>{evTime(tl, se)}</span><span><EvName tl={tl} e={se} /></span>
          {se.kind === "fail" && <a href={errHref(se.calls[0]!.id)} onClick={appLink}>Open in Errors</a>}</>
          : <span className="muted">Select an event to mark it on the timeline.</span>}
      </div>
      <ol className="evlist" aria-labelledby={evH} ref={list}>{events.map((e, k) => (
        <li key={k} className={`ev ${e.kind}`} hidden={k >= EV_TOP && !all && k !== sel}>
          <button type="button" className="evbtn" data-ev={k} aria-pressed={sel === k} onClick={() => setSel(k)}>
            <i className="mk" aria-hidden="true" /><span className="tm">{evTime(tl, e)}</span><span className="nm"><EvName tl={tl} e={e} /></span>
          </button>
          {e.kind === "fail" && <a className="evlink" href={errHref(e.calls[0]!.id)} onClick={appLink} aria-label="Open the first of these failures in Errors">Errors →</a>}
        </li>))}
      </ol>
      {events.length > EV_TOP && !all && <button type="button" className="linkish small" onClick={() => { focusMore.current = true; setAll(true); }}>Show all {num(events.length)} events</button>}
    </>}
  </>;
}
