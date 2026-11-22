import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { LivePulse } from "../../api";
import { useWidth } from "../../components/chart";
import { modified } from "../../components/keys";
import { plural } from "../../format";
import { pulseMinutes, pulseSummary, tokensShort, type PulseMinute } from "./live";

const H = 40, LINE_TOP = 3, LINE_BOTTOM = 28, TICK_TOP = 32;
const HM = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });

/** One minute in words, for the readout: "10:04 to 10:05: context 52k, 3 calls, 1 failed". */
export const readMinute = (m: PulseMinute) =>
  `${HM.format(m.from)} to ${HM.format(m.to)}: context ${m.context == null ? "–" : tokensShort(m.context)}, ${plural(m.calls, "call")}, ${m.failed} failed`;

/** The session's last 10 minutes: its context as a step line, scaled from its lowest to its highest level so growth
 *  shows in a large window, and a tick per finished call along the foot: an upright line for a success, a ✕ for a
 *  failure, apart in shape as well as color. Drawn at its box's width in pixels, so the ticks keep their shape at any width.
 *  Read by pointer or keyboard one minute at a time, as Context's charts are. */
export function Pulse({ p }: { p: LivePulse }) {
  const [at, setAt] = useState<number | null>(null);
  const box = useRef<HTMLSpanElement>(null), W = useWidth(box, 160);
  const minutes = useMemo(() => pulseMinutes(p), [p]);
  const start = Date.parse(p.start), span = Math.max(1, Date.parse(p.end) - start);
  const x = (ts: string) => Math.min(W, Math.max(0, ((Date.parse(ts) - start) / span) * W));
  const levels = p.context.map(c => c.tokens), lo = Math.min(...levels), hi = Math.max(...levels);
  const y = (v: number) => (hi === lo ? (LINE_TOP + LINE_BOTTOM) / 2 : LINE_BOTTOM - ((v - lo) / (hi - lo)) * (LINE_BOTTOM - LINE_TOP));
  // A step line: each request's context holds until the next one, and the last one to the pulse's end.
  let line = "";
  p.context.forEach((c, i) => { const cx = x(c.ts); line += i === 0 ? `M${cx.toFixed(1)},${y(c.tokens).toFixed(1)}` : `H${cx.toFixed(1)}V${y(c.tokens).toFixed(1)}`; });
  if (line) line += `H${W}`;
  const label = `${pulseSummary(p)} Use the left and right arrow keys to read each minute, Escape to dismiss it.`;
  const onKey = (ev: KeyboardEvent) => {
    if (modified(ev)) return; // Alt+Left is history, Ctrl+Home the page: not ours
    if (ev.key === "Escape") return setAt(null);
    const d = ({ ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity } as Record<string, number>)[ev.key];
    if (d == null) return;
    ev.preventDefault();
    setAt(Math.max(0, Math.min(minutes.length - 1, (at ?? (d > 0 ? -1 : minutes.length)) + d)));
  };
  const near = (ev: PointerEvent) => {
    const r = ev.currentTarget.getBoundingClientRect();
    return Math.min(minutes.length - 1, Math.max(0, Math.floor(((ev.clientX - r.left) / (r.width || W)) * minutes.length)));
  };
  const cur = at == null ? null : minutes[at]!, bw = W / minutes.length;
  return <span className="pulse">
    <span className="chart" ref={box} tabIndex={0} role="group" aria-label={label} onKeyDown={onKey} onBlur={() => setAt(null)}
      onPointerMove={ev => setAt(near(ev))} onPointerLeave={() => setAt(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        {cur && <rect className="cur" x={at! * bw} y={0} width={bw} height={H} />}
        <line className="base" x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} />
        {line && <path className="l" d={line} />}
        {p.ticks.map((t, i) => {
          const tx = x(t.ts);
          return t.failed
            ? <path key={i} className="bad" d={`M${tx - 2.5},${TICK_TOP}l5,5M${tx + 2.5},${TICK_TOP}l-5,5`} />
            : <line key={i} className="ok" x1={tx} x2={tx} y1={TICK_TOP + 2} y2={H - 1} />;
        })}
      </svg>
    </span>
    <span className="readout" aria-live="polite">{cur ? readMinute(cur) : ""}</span>
  </span>;
}
