// Text for the Limits page: names, captions and pace, from the /api/limits payload.
import type { LimitWindow, LimitsPayload } from "../../api";
import { num, plural, usd } from "../../format";

/** A timestamp as "Sat, Nov 7, 2:00 PM" in the reader's zone: every time on the page reads this way. */
export const whenDay = (ts: string | null | undefined): string =>
  ts ? new Date(ts).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "–";

/** A span as "1d 17h", "3h 20m" or "45m". */
export function span(msLeft: number): string {
  const m = Math.max(0, Math.round(msLeft / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  return d ? `${d}d ${h}h` : h ? `${h}h ${mm}m` : `${mm}m`;
}

/** A plan as the page shows it: Claude's "max/default_claude_max_20x" (subscription/tier) reads "max". */
export const planName = (plan: string | null) => plan?.split("/")[0] ?? null;

export const windowName = (w: { provider_label: string; label: string }) => `${w.provider_label} ${w.label}`;

/** "At its limit until …", "Reaches 100% at Sat 2:00 PM", "Resets first at about 66%", or why there is no forecast. */
export function caption(w: LimitWindow): string {
  if (w.at_limit) return `At its limit until ${whenDay(w.resets_at)}`;
  const f = w.forecast;
  if (!f) return w.no_forecast ?? "No forecast";
  if (f.hits_at) {
    const late = f.hits_at_late ? whenDay(f.hits_at_late) : "after the reset";
    return `Reaches 100% at ${whenDay(f.hits_at)} (between ${whenDay(f.hits_at_early)} and ${late})`;
  }
  const lo = num(f.at_reset_low), hi = num(f.at_reset_high);
  return `Resets first at about ${num(f.at_reset)}%${lo === hi ? "" : ` (${lo}–${hi}%)`}`;
}

/** A window length as the cap-money line names its period: "a week", "per 5 hours", "a window" when unknown. */
const capPeriod = (minutes: number | null): string =>
  minutes === 10080 ? "a week" : minutes === 1440 ? "a day" : minutes === 43200 ? "per 30 days" : minutes === 300 ? "per 5 hours"
  : minutes && minutes % 60 === 0 ? `per ${minutes / 60} hours` : "a window";

/** The whole cap in money at list prices, with the calibration behind it; null while the window is not calibrated. */
export function capText(w: LimitWindow): string | null {
  const c = w.calibration;
  if (!c) return null;
  return `100% ≈ ${usd(c.per_pct * 100)} ${capPeriod(w.window_minutes)} at list prices, from ${plural(Math.round(c.points), "point")} over ${plural(c.windows, "window")}`;
}

/** Headroom and pace: what is left, how long to reset, the usual pace and this window's own against the pace that
 *  ends at exactly 100%. A window at its limit has no pace, only the wait. */
export function pace(w: LimitWindow, now: string): { left: string; reset: string; rate: string | null; verdict: string | null } {
  const f = w.forecast, ms = Date.parse(w.resets_at) - Date.parse(now);
  const left = w.current == null ? "–" : `${num(Math.max(0, 100 - w.current))}% left`, reset = `${span(ms)} to reset`;
  if (w.at_limit) return { left, reset, rate: null, verdict: null }; // the caption says it is at its limit, and until when
  if (!f || f.pace_target == null) return { left, reset, rate: null, verdict: null };
  // Windows shorter than a day read per hour: a 5-hour window at "480% a day" is just 20% an hour.
  const hourly = (w.window_minutes ?? 1440) < 1440, per = hourly ? "an hour" : "a day", k = hourly ? 1 / 24 : 1;
  const rate = (r: number) => `${num(r * k, 1)}% ${per}`;
  const own = f.pace_window == null || f.pace_window_hours == null ? ""
    : `; this window ${rate(f.pace_window)} over its last ${f.pace_window_hours >= 24 ? "day" : span(f.pace_window_hours * 3600000)}`;
  return {
    left, reset,
    rate: `usual pace ${rate(f.pace_usual)}${own}; ${rate(f.pace_target)} would use it all`,
    verdict: f.pace === "ahead" ? "ahead of pace: runs out before the reset" : `behind pace: about ${num(100 - (f.at_reset ?? 100))}% would go unused`,
  };
}

/** One point a reader can land on: a past reading or estimate, or a forecast point after now. */
export type ReadPoint =
  | { kind: "past"; t: string; pct: number; measured: boolean }
  | { kind: "forecast"; t: string; mid: number; lo: number; hi: number };

/** A window's readable points in time order: the past series, then the forecast after its last point (the curve starts at
 *  now, which the series already holds). */
export function readPoints(w: LimitWindow): ReadPoint[] {
  const past = w.series.map((p): ReadPoint => ({ kind: "past", ...p }));
  const last = w.series.length ? Date.parse(w.series[w.series.length - 1]!.t) : -Infinity;
  const ahead = (w.forecast?.curve ?? []).filter(p => Date.parse(p.t) > last).map((p): ReadPoint => ({ kind: "forecast", ...p }));
  return [...past, ...ahead];
}

/** The index of the point nearest in time to ms (the earlier one on a tie), or -1 with no points. */
export function nearestPoint(pts: ReadPoint[], ms: number): number {
  let best = -1, gap = Infinity;
  pts.forEach((p, i) => { const d = Math.abs(Date.parse(p.t) - ms); if (d < gap) { gap = d; best = i; } });
  return best;
}

/** A percent with at most one decimal: "42", "42.3". */
const pct1 = (v: number): string => { const r = Math.round(v * 10) / 10; return Number.isInteger(r) ? num(r) : num(r, 1); };

/** "Sat, Nov 7, 2:00 PM · 42% · measured", or "… · forecast 71% (60–85%)" with the likely range when it reads wider than a point. */
export function readText(p: ReadPoint): string {
  if (p.kind === "past") return `${whenDay(p.t)} · ${pct1(p.pct)}% · ${p.measured ? "measured" : "estimated"}`;
  const lo = pct1(p.lo), hi = pct1(p.hi);
  return `${whenDay(p.t)} · forecast ${pct1(p.mid)}%${lo === hi ? "" : ` (${lo}–${hi}%)`}`;
}

const sameLimit = (w: LimitWindow, b: { provider: string; limit_id: string; scope: string }) =>
  w.provider === b.provider && w.limit_id === b.limit_id && w.scope === b.scope;

export const bindingWindow = (d: LimitsPayload): LimitWindow | undefined =>
  d.binding ? d.windows.find(w => sameLimit(w, d.binding!)) : undefined;
