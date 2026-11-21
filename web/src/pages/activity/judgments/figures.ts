// Figures for Activity's Judgments view.
import type { FacetCount, FrictionFamily, FrictionWeight, InsightSession, InsightsPayload, SessionFigures, TrendWeek } from "../../../api";
import { dur, num, pct, plural, usd, usd0 } from "../../../format";

export const countOf = (rows: FacetCount[], name: string) => rows.find(r => r.name === name)?.n ?? 0;

/** The view's headline: how many analysed sessions met their goal, and what got in the way most: the top friction family when
 *  it groups 2 or more labels, else the top label as written. */
export function headline(d: InsightsPayload) {
  const n = d.coverage.facets, full = countOf(d.outcomes, "fully_achieved"), fam = d.friction_families[0];
  return { full, n, top: fam && fam.members.length > 1 ? fam.family : d.friction[0]?.name ?? null };
}

/** A session's measured figures as one line ("+120 −30 lines · 4 files · 35m · 1 push"), leaving out a part that is null or 0;
 *  "" when nothing is left. */
export function measured(m: SessionFigures): string {
  const has = (n: number | null): n is number => n != null && n > 0;
  const lines = [has(m.lines_added) && `+${num(m.lines_added)}`, has(m.lines_removed) && `−${num(m.lines_removed)}`].filter(Boolean).join(" ");
  return [lines && `${lines} lines`, has(m.files_modified) && plural(m.files_modified, "file"), has(m.duration_minutes) && dur(m.duration_minutes * 60),
    has(m.git_pushes) && plural(m.git_pushes, "push", "pushes")].filter(Boolean).join(" · ");
}

/** The share of the context window Activity counts as near the limit (metrics.py NEAR_LIMIT). */
export const NEAR_LIMIT = .8;
/** What the store measured of a session, as a card's parts: its cost, its peak context as a share of the window, and its failed
 *  tool calls. A part the store does not know (no price, no window) is left out; a session with no transcript has none. warn:
 *  the part is worth a look (a peak near the limit, a failed call). */
export function stored(s: Pick<InsightSession, "cost" | "errors" | "context_share">): { text: string; warn: boolean }[] {
  return [
    s.cost != null && { text: usd(s.cost), warn: false },
    s.context_share != null && { text: `peak context ${pct(s.context_share)}`, warn: s.context_share >= NEAR_LIMIT },
    s.errors != null && { text: plural(s.errors, "tool error"), warn: s.errors > 0 },
  ].filter((p): p is { text: string; warn: boolean } => !!p);
}

// ---------- outcome trend ----------
/** The parts of a week's bar, best outcome first (the bottom of the stack): its key in the payload, its name, and its color. The
 *  last holds what the four outcomes leave of n: sessions with no clear outcome, or with one /insights added later. */
export const TREND_PARTS = [
  { k: "fully", label: "Fully achieved", c: "var(--good)" },
  { k: "mostly", label: "Mostly achieved", c: "var(--good-text)" }, // the darker green in light, the lighter in dark: apart from "fully" and from the surface in both
  { k: "partially", label: "Partially achieved", c: "var(--warning)" },
  { k: "not_achieved", label: "Not achieved", c: "var(--critical)" },
  { k: "other", label: "No clear outcome", c: "var(--proj-other)" },
] as const;
export type TrendKey = (typeof TREND_PARTS)[number]["k"];
/** A week's sessions per part, in TREND_PARTS' order. */
export const trendCounts = (w: TrendWeek): number[] => [w.fully, w.mostly, w.partially, w.not_achieved, Math.max(0, w.n - w.fully - w.mostly - w.partially - w.not_achieved)];
/** A week with fewer analysed sessions than this swings on one session: its bar is drawn faint and its reading says so. */
export const FEW_SESSIONS = 5;
export const FEW_TEXT = "few sessions: one session moves this bar a lot";
export const isFew = (w: TrendWeek) => w.n < FEW_SESSIONS;
/** One week read aloud: "12 analysed sessions: 7 fully achieved (58%), 2 mostly achieved (17%), …", zero parts left out. */
export const trendText = (w: TrendWeek): string => {
  const parts = trendCounts(w).map((n, i) => (n ? `${num(n)} ${TREND_PARTS[i]!.label.toLowerCase()} (${pct(n / w.n)})` : "")).filter(Boolean);
  return `${plural(w.n, "analysed session")}: ${parts.join(", ")}${isFew(w) ? `; ${FEW_TEXT}` : ""}`;
};

// ---------- friction weights ----------
/** What a friction row is weighed by: the cost or the active time of the sessions that reported it, or how often it was reported. */
export type Weight = "cost" | "time" | "reports";
export const WEIGHTS: { k: Weight; label: string }[] = [{ k: "cost", label: "Cost" }, { k: "time", label: "Active time" }, { k: "reports", label: "Reports" }];
type Weighed = { n: number } & FrictionWeight;
export const weightOf = (r: Weighed, w: Weight): number => (w === "cost" ? r.cost : w === "time" ? r.active_s : r.n);
/** A row's figures in words: the chosen weight first, as its value, then the two others. */
export const weightValue = (r: Weighed, w: Weight): string => (w === "cost" ? usd0(r.cost) : w === "time" ? dur(r.active_s) : num(r.n));
export const weightSide = (r: Weighed & { sessions: number }, w: Weight): string =>
  [w !== "cost" && usd0(r.cost), w !== "time" && dur(r.active_s), plural(r.sessions, "session")].filter(Boolean).join(" · ");
/** Families heaviest first under w. Reports is the payload's order; a tie keeps it (most reported first). */
export const byWeight = (rows: readonly FrictionFamily[], w: Weight): FrictionFamily[] =>
  w === "reports" ? [...rows] : [...rows].sort((a, b) => weightOf(b, w) - weightOf(a, w));
