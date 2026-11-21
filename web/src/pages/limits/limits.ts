// Text for the Limits page: names, captions and pace, from the /api/limits payload.
import type { LimitHistoryRow, LimitPoint, LimitWindow, LimitsAlert, LimitsPayload, LimitsPeak } from "../../api";
import { num, plural, usd } from "../../format";
import { formatSearch, RANGES, sourceOf, type Range } from "../../url";

/** A timestamp as "Sat, Nov 7, 2:00 PM" in the reader's zone: every time on the page reads this way. */
export const whenDay = (ts: string | null | undefined): string =>
  ts ? new Date(ts).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "–";

/** The nav's Limits pill in words, for the tab's accessible name and its hover text: "Highest open window: Codex weekly at 72%",
 *  or "at an estimated 72%" when the percent is not a reading. */
export const peakText = (p: Pick<LimitsPeak, "provider_label" | "label" | "current" | "measured">): string =>
  `Highest open window: ${windowName(p)} at ${p.measured ? "" : "an estimated "}${num(p.current)}%`;

/** The nav's Limits alert as one sentence, which is the tab's accessible name after "Limits alert: " and the pill's hover text: "Claude Code
 *  weekly is at its limit until Sat, Nov 7, 2:00 PM", "… is forecast to run out …" or "… is at 92%", and " (and 2 more)" when other
 *  windows are in alert too. A figure that is an estimate, not a reading, says so ("is estimated to be at its limit", "is at an
 *  estimated 92%"); a forecast is one already. */
export function alertText(a: LimitsAlert): string {
  const name = windowName(a);
  const what = a.kind === "at_limit" ? `is ${a.measured ? "" : "estimated to be "}at its limit until ${whenDay(a.at)}`
    : a.kind === "runs_out" ? `is forecast to run out ${whenDay(a.at)}` : `is at ${a.measured ? "" : "an estimated "}${num(a.current)}%`;
  return `${name} ${what}${a.count > 1 ? ` (and ${a.count - 1} more)` : ""}`;
}

/** What the nav's Limits alert is, apart from its wording: its kind, provider, window and whether its figure is measured. The nav
 *  says the alert aloud when this changes, not when the time, the percent or the count in its sentence do (the forecast time
 *  drifts on every cycle). "" for no alert. */
export const alertKey = (a: LimitsAlert | null | undefined): string => a ? JSON.stringify([a.kind, a.provider, a.label, a.measured]) : "";

/** A span as "1d 17h", "3h 20m" or "45m". */
export function span(msLeft: number): string {
  const m = Math.max(0, Math.round(msLeft / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  return d ? `${d}d ${h}h` : h ? `${h}h ${mm}m` : `${mm}m`;
}

/** A plan as the page shows it, its tier included: Claude's "max/default_claude_max_20x" (subscription/rate limit tier) reads
 *  "max 20x", and a tier with no multiplier follows in brackets ("pro (default_claude_ai)"). */
export function planName(plan: string | null): string | null {
  if (plan == null) return null;
  const at = plan.indexOf("/"), sub = at < 0 ? plan : plan.slice(0, at), tier = at < 0 ? "" : plan.slice(at + 1);
  if (!tier) return sub;
  const x = /_(\d+x)$/.exec(tier)?.[1];
  return x ? `${sub} ${x}` : `${sub} (${tier})`;
}

export const windowName = (w: { provider_label: string; label: string }) => `${w.provider_label} ${w.label}`;

/** A percent at a reset, for a line that has no hit: never "100" unless it is 100, so 99.5 to 99.9 reads 99. */
const atReset = (v: number): number => (v >= 99.5 && v < 100 ? 99 : v);
export const resetPct = (v: number | null): string => num(v == null ? v : atReset(v));

/** "At its limit until …", "Reaches 100% at Sat 2:00 PM", "Resets first at about 66%", or why there is no forecast. */
export function caption(w: LimitWindow): string {
  if (w.at_limit) return `At its limit until ${whenDay(w.resets_at)}`;
  const f = w.forecast;
  if (!f) return w.no_forecast ?? "No forecast";
  if (f.hits_at) {
    const late = f.hits_at_late ? whenDay(f.hits_at_late) : "after the reset";
    return `Reaches 100% at ${whenDay(f.hits_at)} (between ${whenDay(f.hits_at_early)} and ${late})`;
  }
  const lo = resetPct(f.at_reset_low), hi = resetPct(f.at_reset_high);
  return `Resets first at about ${resetPct(f.at_reset)}%${lo === hi ? "" : ` (${lo}–${hi}%)`}`;
}

/** The second forecast line, "If the last 24 hours continue: reaches 100% at Sat 2:00 PM" or "… about 41% at its reset";
 *  null for a window at its limit or without a forecast or scenario. */
export function recentText(w: LimitWindow): string | null {
  const f = w.forecast;
  if (w.at_limit || !f || f.recent_pace == null) return null;
  return `If the last 24 hours continue: ${f.recent_hits_at ? `reaches 100% at ${whenDay(f.recent_hits_at)}` : `about ${resetPct(f.recent_at_reset)}% at its reset`}`;
}

/** Whether the window's chart draws the last-24-hours line: the one condition the chart and the chart key share. */
export const hasScenario = (w: LimitWindow): boolean => !!w.forecast?.curve.some(p => p.recent != null);

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

/** What a scoped limit is of the weekly allowance: "This limit is 50% of the weekly allowance; 21% of the weekly allowance is
 *  used through it". null for a window without a share. */
export function shareText(w: LimitWindow): string | null {
  const s = w.weekly_share;
  return s ? `This limit is ${num(s.allowance)}% of the weekly allowance; ${num(s.used)}% of the weekly allowance is used through it` : null;
}

/** The week's use by surface: "All of this week's use so far came from Claude Code" when exactly one surface has any, else
 *  "This week's use by surface: Chats 60%, Claude Code 40%" (every surface with use, most first; one that rounds to nothing
 *  reads "<1%", and none reads 100% beside another). null without a breakdown or with no use yet. */
export function surfacesText(w: LimitWindow): string | null {
  const used = (w.surfaces?.rows ?? []).filter(r => r.percent > 0).sort((a, b) => b.percent - a.percent);
  if (!used.length) return null;
  if (used.length === 1) return `All of this week's use so far came from ${used[0]!.label}`;
  const pct = (p: number) => (Math.round(p) < 1 ? "<1%" : `${num(Math.min(99, Math.round(p)))}%`);
  return `This week's use by surface: ${used.map(r => `${r.label} ${pct(r.percent)}`).join(", ")}`;
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
    verdict: f.pace === "ahead" ? "ahead of pace: runs out before the reset" : `behind pace: about ${num(100 - atReset(f.at_reset ?? 100))}% would go unused`,
  };
}

/** The card header's one status: "runs out <time>" when the forecast's middle reaches 100% before the reset, "at its limit until
 *  <time>", "about N% at reset", or "no forecast". out: the critical style, for a window that stops the user. */
export function status(w: LimitWindow): { text: string; out: boolean } {
  if (w.at_limit) return { text: `at its limit until ${whenDay(w.resets_at)}`, out: true };
  const f = w.forecast;
  if (!f) return { text: "no forecast", out: false };
  if (f.hits_at) return { text: `runs out ${whenDay(f.hits_at)}`, out: true };
  return { text: `about ${resetPct(f.at_reset)}% at reset`, out: false };
}

/** The footer's headroom: "12% left · 1d 17h", the percent left and the time to reset. */
export function headroom(w: LimitWindow, now: string): string {
  const p = pace(w, now);
  return `${p.left} · ${span(Date.parse(w.resets_at) - Date.parse(now))}`;
}

/** The footer's pace: the forecast's pace against the safe pace, the one that ends at exactly 100% at reset ("18%/d" and
 *  "7%/d"; per hour for a window shorter than a day). hot: the forecast's pace is above the safe one. null for a window at its
 *  limit or without a forecast. */
export function paceRates(w: LimitWindow): { now: string; safe: string; hot: boolean } | null {
  const f = w.forecast;
  if (w.at_limit || !f || f.pace_target == null) return null;
  const hourly = (w.window_minutes ?? 1440) < 1440, k = hourly ? 1 / 24 : 1, unit = hourly ? "%/h" : "%/d";
  return { now: pct1(f.pace_now * k) + unit, safe: pct1(f.pace_target * k) + unit, hot: f.pace === "ahead" };
}

/** The safe-pace line: from now at the percent used now, straight to 100% at the reset, so its slope is the pace that ends at
 *  exactly 100%. A curve steeper than it runs hot. null for a closed window (now null), a window at its limit, one with no
 *  reading, and one whose reset has passed. */
export function safePace(w: LimitWindow, now: string | null): { from: { t: string; v: number }; to: { t: string; v: number } } | null {
  if (now == null || w.at_limit || w.current == null || w.current >= 100 || Date.parse(w.resets_at) <= Date.parse(now)) return null;
  return { from: { t: now, v: w.current }, to: { t: w.resets_at, v: 100 } };
}

/** The safe-pace line's percent at t, or null outside it (before now, after the reset, or no line). */
export function safeAt(line: ReturnType<typeof safePace>, t: string): number | null {
  if (!line) return null;
  const t0 = Date.parse(line.from.t), t1 = Date.parse(line.to.t), at = Date.parse(t);
  if (at < t0 || at > t1) return null;
  return line.from.v + (line.to.v - line.from.v) * (at - t0) / (t1 - t0);
}

/** Whether the forecast cone reaches 100% before the reset: its high bound does (hits_at_early). The cone then takes the
 *  warning tint, even when the middle resets first: the tint says "might", the header says "runs out". A window at its limit
 *  has no cone. */
export const coneCrosses = (w: LimitWindow): boolean => !w.at_limit && !!w.forecast?.hits_at_early;

/** The rows of a chart's data table: the readable points nearest to CHART_ROWS times spread from the window's start to its
 *  reset, and the point at now, in time order, each once; safe: the safe-pace percent at a time after now. */
export const CHART_ROWS = 12;
export function chartRows(w: LimitWindow, now: string | null): { p: ReadPoint; now: boolean; safe: number | null }[] {
  const pts = readPoints(w);
  if (!pts.length) return [];
  const t0 = Date.parse(w.start), t1 = Date.parse(w.resets_at), line = safePace(w, now), nowAt = now == null ? -1 : w.series.length - 1;
  const picks = new Set(Array.from({ length: CHART_ROWS }, (_, i) => nearestPoint(pts, t0 + (t1 - t0) * i / (CHART_ROWS - 1))));
  if (nowAt >= 0) picks.add(nowAt);
  return [...picks].sort((a, b) => a - b).map(i => {
    const p = pts[i]!;
    return { p, now: i === nowAt, safe: p.kind === "forecast" ? safeAt(line, p.t) : null };
  });
}

/** One point a reader can land on: a past reading or estimate, or a forecast point after now. */
export type ReadPoint =
  | { kind: "past"; t: string; pct: number; measured: boolean }
  | { kind: "forecast"; t: string; mid: number; lo: number; hi: number; recent: number | null };

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

/** A point's percent and kind, as the readout and the data table give it: "42% · measured", or "forecast 71% (60–85%)" with
 *  the likely range when it reads wider than a point. */
export function pointText(p: ReadPoint): string {
  if (p.kind === "past") return `${pct1(p.pct)}% · ${p.measured ? "measured" : "estimated"}`;
  const lo = pct1(p.lo), hi = pct1(p.hi);
  return `forecast ${pct1(p.mid)}%${lo === hi ? "" : ` (${lo}–${hi}%)`}`;
}

/** "Sat, Nov 7, 2:00 PM · 42% · measured", or "… · forecast 71% (60–85%)"; with recent (the last 24 h pace line is drawn),
 *  a forecast point ends with " · last 24 h pace 72.3%" when it has a scenario value. */
export function readText(p: ReadPoint, recent = false): string {
  const scenario = recent && p.kind === "forecast" && p.recent != null ? ` · last 24 h pace ${pct1(p.recent)}%` : "";
  return `${whenDay(p.t)} · ${pointText(p)}${scenario}`;
}

/** Where a tooltip goes inside its box, in box pixels: right of the point (left of it near the right edge), kept inside
 *  the box's width, and down into it when it fits. A tip wider than the box sits at the left edge (the text wraps to the box);
 *  one taller than the box sits at the top and is clipped below. */
export function tipPlace(box: { w: number; h: number }, tip: { w: number; h: number }, at: { x: number; y: number }): { left: number; top: number } {
  const w = Math.min(tip.w, box.w), flip = at.x + 14 + w > box.w;
  return { left: Math.max(0, Math.min(box.w - w, flip ? at.x - 14 - w : at.x + 14)), top: Math.max(0, Math.min(box.h - tip.h, at.y - 10)) };
}

const sameLimit = (w: LimitWindow, b: { provider: string; limit_id: string; scope: string }) =>
  w.provider === b.provider && w.limit_id === b.limit_id && w.scope === b.scope;

export const bindingWindow = (d: LimitsPayload): LimitWindow | undefined =>
  d.binding ? d.windows.find(w => sameLimit(w, d.binding!)) : undefined;

/** The smallest Cost range preset that covers the window's start. Cost's range of N days is today and the N-1 dates before it,
 *  from the start of the first date, so count the dates from the window's start date through the date of now, inclusive: 7, 14,
 *  30 or 90 when that many dates or fewer, else 0 (all time). Cost's dates are the store's local days; the reader's local
 *  dates are the closest the page has, and match them when the browser and the store share a zone. */
export function usedRange(w: LimitWindow, now: string): Range {
  const date = (ts: string) => { const d = new Date(ts); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
  const dates = Math.round((date(now) - date(w.start)) / 86400000) + 1;
  return RANGES.find(r => r !== 0 && dates <= r) ?? 0;
}

export const usedRangeName = (range: Range): string => (range ? `last ${range} days` : "all time");

/** The Cost page filtered to the window's source and its nearest range preset, and to one project when given. The drawer counts
 *  automated and helper sessions, and Cost leaves them out unless auto=1, so the link asks for them. */
export const usedHref = (w: LimitWindow, now: string, project = ""): string =>
  "/cost" + formatSearch({ project, range: String(usedRange(w, now)), source: sourceOf(w.provider), auto: "1" });

/** A share as a whole percent: "54%", and "<1%" for a share that rounds to nothing. */
export const sharePct = (share: number): string => (share > 0 && share < 0.005 ? "<1%" : `${Math.round(share * 100)}%`);

/** The closed summary's hint, "ai-ledger 54%": the window's top project and its share; null when no project is named. */
export function usedHint(u: NonNullable<LimitWindow["used"]>): string | null {
  const top = u.projects[0];
  return top ? `${top.project} ${sharePct(top.share)}` : null;
}

// ---------- the strips of past windows ----------

/** The bars one limit's strip shows: its most recent closed windows. */
export const STRIP_BARS = 60;
/** The shortest bar, as a percent of the strip's height: a window at 0% is still something to point at. */
export const MIN_BAR = 6;

/** A closed window's identity: a window is its limit and its start. */
export const barKey = (h: LimitHistoryRow): string => `${h.provider}|${h.limit_id}|${h.scope}|${h.start}`;

/** Why a window ended early, in the words of a bar's name: "a plan change" or "an early reset". */
const earlyBy = (h: LimitHistoryRow): string => (h.reason?.startsWith("plan change") ? "a plan change" : "an early reset");

/** The bar's accessible name and tooltip, so the colour and the hatching are never the only signal: "Claude Code weekly, ended
 *  Sat, Nov 7, 2:00 PM: 82%, hit its limit for 3h 20m, ended early by a plan change, estimated". */
export function barName(h: LimitHistoryRow): string {
  return [`${windowName(h)}, ended ${whenDay(h.closed_at)}: ${num(h.final)}%`,
    h.hit && `hit its limit${h.hit_minutes != null ? ` for ${span(h.hit_minutes * 60000)}` : ""}`,
    h.early && `ended early by ${earlyBy(h)}`, h.estimated && "estimated"].filter(Boolean).join(", ");
}

/** The note after a strip that does not show all its limit's windows, or null when it does. */
export const stripNote = (shown: number, total: number): string | null => (shown < total ? `${shown} most recent of ${total}; the table lists all` : null);

/** provider and label: those of its newest window, to find its unused row. hits: its windows in the range that hit their limit,
 *  all of them, not only the bars shown. */
export interface Strip { key: string; name: string; provider: string; label: string; bars: LimitHistoryRow[]; total: number; hits: number }

type Unused = LimitsPayload["unused"][number];

/** A strip's summary, "avg 47% unused · 2 hits" ("no full-length windows · …" when every window ended early or there is no
 *  unused row), and its title: how many windows the average covers, how many are estimated and how many ended early and are
 *  left out. The unused rows are per provider and label, so the strip takes the row of its newest window's label. */
export function stripSummary(s: Strip, unused: Unused[]): { text: string; title: string } {
  const u = unused.find(r => r.provider === s.provider && r.label === s.label), hits = plural(s.hits, "hit");
  if (!u || u.avg_unused == null) return { text: `no full-length windows · ${hits}`, title: "Every window in the range ended early, so there is no average." };
  return { text: `avg ${num(u.avg_unused)}% unused · ${hits}`,
    title: `Average share left unused at reset over ${plural(u.windows, "full-length window")}${u.estimated ? `, ${num(u.estimated)} estimated` : ""}`
      + `${u.early ? `; left out: ${plural(u.early, "window")} that ended early, by an early reset or a plan change` : ""}.` };
}

/** One strip per limit with closed windows (provider, limit id and scope: two limits can share a label), in the order the open
 *  windows use: provider (in the given order, the payload's providers; any other last), then longest window first, then scope.
 *  A strip is named as its newest window is, so a limit whose label changed is still one strip. Bars run oldest to newest, the
 *  STRIP_BARS most recent. */
export function historyStrips(history: LimitHistoryRow[], providers: string[]): Strip[] {
  const by = new Map<string, LimitHistoryRow[]>();
  for (const h of history) { const k = `${h.provider}|${h.limit_id}|${h.scope}`; by.set(k, [...(by.get(k) ?? []), h]); }
  const rank = (p: string) => { const i = providers.indexOf(p); return i < 0 ? providers.length : i; };
  const order = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  return [...by.entries()].map(([key, rows]) => {
    const old = rows.slice().sort((a, b) => Date.parse(a.closed_at) - Date.parse(b.closed_at) || Date.parse(a.start) - Date.parse(b.start));
    const newest = old.at(-1)!;
    return { sort: { rank: rank(newest.provider), minutes: Math.max(...rows.map(h => h.window_minutes ?? 0)), scope: newest.scope },
      strip: { key, name: windowName(newest), provider: newest.provider, label: newest.label, bars: old.slice(-STRIP_BARS),
        total: rows.length, hits: rows.filter(h => h.hit).length } };
  }).sort((a, b) => a.sort.rank - b.sort.rank || b.sort.minutes - a.sort.minutes || order(a.sort.scope, b.sort.scope) || order(a.strip.key, b.strip.key))
    .map(x => x.strip);
}

/** A closed window as the open-window chart takes a window: it runs from its start to its close, ends at its final percent,
 *  and has no forecast. */
export function closedWindow(h: LimitHistoryRow, series: LimitPoint[]): LimitWindow {
  return { provider: h.provider, provider_label: h.provider_label, limit_id: h.limit_id, scope: h.scope, label: h.label,
    window_minutes: h.window_minutes, plan: h.plan, start: h.start, resets_at: h.closed_at, current: h.final, measured: !h.estimated,
    last_snapshot: null, series, calibration: null, forecast: null, no_forecast: null, hit_start: null, at_limit: h.hit, used: null,
    weekly_share: null, surfaces: null };
}

/** The panel heading's notes for a picked window: the hit, the early end, and that it is rebuilt. */
export function windowNotes(h: LimitHistoryRow): string[] {
  return [h.hit && `at its limit${h.hit_minutes != null ? ` for ${span(h.hit_minutes * 60000)}` : ""}`,
    h.early && `ended early by ${earlyBy(h)}`, h.estimated && "estimated from counted usage"].filter((x): x is string => !!x);
}
