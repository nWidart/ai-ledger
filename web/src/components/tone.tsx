// Project table cells compared with the median project (Activity's project metrics, Cost's cost by project).
import type { ReactNode } from "react";
import { mult, num } from "../format";
import "./tone.css";

// How far a project sits from the median project on one metric. better: "up" when a higher value is better.
// Ratios count when they are 1.5x off the median (points: 10 points); counts when 2 or more and above it.
type Kind = "ratio" | "points" | "count";
interface Tone { worse: boolean; above: boolean; by?: string; zero?: boolean }
export function toneOf(v: number | null, med: number | null, better: "up" | "down", kind: Kind): Tone | null {
  if (v == null || med == null) return null;
  if (kind === "points") { const d = v - med; return Math.abs(d) < .1 ? null : { worse: (d < 0) === (better === "up"), above: d > 0, by: `${num(Math.abs(d) * 100)} points` }; }
  if (kind === "count") return v >= 2 && v > med ? { worse: true, above: true, by: `${num(v - med)} more` } : null;
  if (!med) return null;
  // Zero has no multiple of the median ("∞× better"): it is said in absolute terms by the caller's zeroText.
  if (v === 0) return { worse: better === "up", above: false, zero: true };
  const r = v / med;
  if (r < 1.5 && r > 1 / 1.5) return null;
  return { worse: (r > 1) === (better === "down"), above: r > 1, by: mult(r > 1 ? r : 1 / r) };
}
/** A number cell tinted, weighted and marked when far from the median, so color is never the only cue. */
export function Toned({ v, text, med, better, kind, medText, zeroText }: {
  v: number | null; text: ReactNode; med: number | null; better: "up" | "down"; kind: Kind; medText: string; zeroText?: string;
}) {
  const t = toneOf(v, med, better, kind);
  if (!t) return <td className="num">{text}</td>;
  const what = t.zero ? `${zeroText || `zero; median ${medText}`}, ${t.worse ? "worse" : "better"}`
    : `${t.above ? "above" : "below"} the median (${medText}) by ${t.by}, ${t.worse ? "worse" : "better"}`;
  return <td className={`num tone ${t.worse ? "worse" : "better"}`} title={what}>{text}<span className="mk" aria-hidden="true">{t.above ? "▲" : "▼"}</span><span className="sr">, {what}</span></td>;
}
export const ToneKey = () => <div className="tone-key">Compared with the median project: <span className="worse">worse ▲▼</span><span className="better">better ▲▼</span>
  ▲ above, ▼ below the median. Hover a tinted cell for how far.</div>;
