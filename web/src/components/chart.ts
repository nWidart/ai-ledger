// Helpers for the hand-written day charts (Activity's work chart, Cost's spend chart) and the motion they share.
import { useEffect, useLayoutEffect, useState, type RefObject } from "react";
import "./chart.css";

/** Motion is opt-out: every animation checks this (and the CSS sits behind the same media query). */
export const motion = () => !matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A figure counting up from the one shown before, so a range change reads as a change. round: integers by default. */
export function useCountUp(to: number, from: number | undefined, round: (v: number) => number = Math.round): number {
  const [v, setV] = useState(to);
  useEffect(() => {
    if (from == null || from === to || !motion()) { setV(to); return; }
    const t0 = performance.now(), D = 600;
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / D);
      setV(k < 1 ? round(from + (to - from) * (1 - (1 - k) ** 3)) : to);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // round is a formatter, not data.
  }, [to, from]);
  return v;
}

/** The element's width, kept current as it resizes (fallback until it is laid out, and in tests). */
export function useWidth(ref: RefObject<HTMLElement | null>, fallback = 800): number {
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => { if (el.clientWidth) setW(el.clientWidth); };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/** Plot geometry for one bar per day: x of day i, bar width, y of a value, round axis ticks. */
export interface DayAxis { W: number; H: number; m: { t: number; r: number; b: number; l: number }; iw: number; ih: number; bw: number; gap: number; w: number;
  yMax: number; step: number; x: (i: number) => number; cx: (i: number) => number; y: (v: number) => number; every: number }
export function dayAxis(W: number, H: number, n: number, max: number, niceStep: (raw: number) => number, m = { t: 22, r: 8, b: 26, l: 52 }): DayAxis {
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const top = max * 1.08 || 1, step = niceStep(top / 4), yMax = Math.ceil(top / step) * step;
  const bw = iw / Math.max(1, n), gap = Math.min(4, bw * .25), w = Math.max(1, bw - gap);
  return { W, H, m, iw, ih, bw, gap, w, yMax, step, every: Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 64)))),
    x: i => m.l + i * bw + gap / 2, cx: i => m.l + (i + .5) * bw, y: v => m.t + ih - v / yMax * ih };
}

/** Where a tooltip goes inside its positioned container: right of the point, or left of it near the right edge. */
export function tipAt(box: HTMLElement, tip: HTMLElement, clientX: number, clientY: number): { left: number; top: number } {
  const r = box.getBoundingClientRect();
  const right = clientX + 14 + tip.offsetWidth > Math.min(innerWidth, r.right + 8);
  return { left: Math.max(4 - r.left, (right ? clientX - tip.offsetWidth - 14 : clientX + 14) - r.left), top: clientY - r.top - 10 };
}

/** Where the peak day's label goes over its bar: centred, or kept inside the plot at either edge. */
export function peakLabelAt(a: DayAxis, i: number): { x: number; anchor: "start" | "middle" | "end" } {
  const px = a.cx(i), near = 56, anchor = px < a.m.l + near ? "start" : px > a.W - a.m.r - near ? "end" : "middle";
  return { anchor, x: anchor === "start" ? Math.max(a.m.l, px - a.w / 2) : anchor === "end" ? Math.min(a.W - a.m.r, px + a.w / 2) : px };
}
