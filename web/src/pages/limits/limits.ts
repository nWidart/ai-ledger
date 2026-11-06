// Text for the Limits page: names, captions and pace, from the /api/limits payload.
import type { LimitWindow, LimitsPayload } from "../../api";
import { num } from "../../format";

/** A timestamp as "Sat 2:00 PM" in the reader's zone: windows are at most weeks long, so the weekday places it. */
export const whenDay = (ts: string | null | undefined): string =>
  ts ? new Date(ts).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }) : "–";

/** A span as "1d 17h", "3h 20m" or "45m". */
export function span(msLeft: number): string {
  const m = Math.max(0, Math.round(msLeft / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  return d ? `${d}d ${h}h` : h ? `${h}h ${mm}m` : `${mm}m`;
}

export const windowName = (w: { provider_label: string; label: string }) => `${w.provider_label} ${w.label}`;

/** "Reaches 100% at Sat 2:00 PM", "Resets first at about 66%", or why there is no forecast. */
export function caption(w: LimitWindow): string {
  const f = w.forecast;
  if (!f) return w.no_forecast ?? "No forecast";
  if (f.hits_at) {
    const late = f.hits_at_late ? whenDay(f.hits_at_late) : "after the reset";
    return `Reaches 100% at ${whenDay(f.hits_at)} (between ${whenDay(f.hits_at_early)} and ${late})`;
  }
  return `Resets first at about ${num(f.at_reset)}% (${num(f.at_reset_low)}–${num(f.at_reset_high)}%)`;
}

/** Headroom and pace: what is left, how long to reset, the pace now against the pace that ends at exactly 100%. */
export function pace(w: LimitWindow, now: string): { left: string; reset: string; rate: string | null; verdict: string | null } {
  const f = w.forecast, ms = Date.parse(w.resets_at) - Date.parse(now);
  const left = w.current == null ? "–" : `${num(100 - w.current)}% left`;
  if (!f || f.pace_target == null) return { left, reset: `${span(ms)} to reset`, rate: null, verdict: null };
  return {
    left, reset: `${span(ms)} to reset`,
    rate: `now ${num(f.pace_now, 1)}% a day; ${num(f.pace_target, 1)}% a day ends at 100%`,
    verdict: f.pace === "ahead" ? "ahead of pace: runs out before the reset" : `behind pace: about ${num(100 - (f.at_reset ?? 100))}% would go unused`,
  };
}

const sameLimit = (w: LimitWindow, b: { provider: string; limit_id: string; scope: string }) =>
  w.provider === b.provider && w.limit_id === b.limit_id && w.scope === b.scope;

export const bindingWindow = (d: LimitsPayload): LimitWindow | undefined =>
  d.binding ? d.windows.find(w => sameLimit(w, d.binding!)) : undefined;
