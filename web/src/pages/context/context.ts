// Context's figures from the payload: labels, byte sizes and the rebuild notice. Pure helpers; the page and the tips use them.
import type { ContextPayload, TipId } from "../../api";
import { big, num, pct, plural } from "../../format";

/** The five peak-fill bins of `growth.fill`, as the API orders them. */
export const FILL_LABELS = ["<25%", "25–50%", "50–80%", "80–90%", "≥90%"] as const;
/** A curve point needs this many sessions (the server's GROWTH_MIN_SESSIONS). */
export const CURVE_MIN_SESSIONS = 5;
/** A project's median start at or over this fires the large-start tip (the server's START_LARGE_TOKENS). */
export const START_LARGE_TOKENS = 30_000;
/** A week of the starting trend with fewer sessions than this rests on few sessions. */
export const TREND_MIN_SESSIONS = 3;
/** A peak at or over this share of the window is near the limit (the server's metrics.NEAR_LIMIT). */
export const NEAR_LIMIT = .8;
/** A main-thread tool result at or over this many bytes fires the large-results tip (the server's RESULT_LARGE_BYTES). */
export const RESULT_LARGE_BYTES = 100_000;

/** A size in bytes as "812 B", "250 KB" or "1.4 MB" (decimal units, as the figures are counts, not memory). */
export function bytes(n: number | null | undefined): string {
  if (n == null) return "–";
  if (n < 1e3) return `${num(n)} B`;
  if (n < 1e6) return `${num(n / 1e3, n < 1e4 ? 1 : 0)} KB`;
  if (n < 1e9) return `${num(n / 1e6, n < 1e7 ? 1 : 0)} MB`;
  return `${num(n / 1e9, 1)} GB`;
}

/** A token count as "30k", "258.4k" or "1M": `big` without a trailing .0. */
export const short = (n: number | null | undefined): string => big(n).replace(/[.,]0(?=[kMB]$)/, "");
/** A share of a window as "4.5%" under 10%, else "10%": the small ones are the ones that differ. */
export const share = (x: number | null | undefined): string => (x == null ? "–" : pct(x, x < .1 ? 1 : 0));
/** A window as "200k" or "1M". */
export const windowLabel = short;

/** Text with `code` spans (as the tips' advice is written) as parts: code flags the ones between backticks. */
export function codeParts(text: string): { code: boolean; text: string }[] {
  return text.split("`").map((t, i) => ({ code: i % 2 === 1, text: t })).filter(p => p.text);
}

/** What kind of finding each tip is, as its card's kicker. */
export const TIP_KICKERS: Record<TipId, string> = {
  large_start: "Starting context", frequent_compactions: "Compactions", near_limit: "Window limit",
  large_results: "Tool results", cache_breaks: "Prompt cache", long_tier: "Long prompts",
};

/** The causes of a cache break, in the order the page lists them. */
export const BREAK_CAUSES = [["model_switch", "model switch"], ["expired", "expired"], ["other", "other"]] as const;
/** "2 model switches, 1 expired"; causes with no break are left out. */
export function causesText(r: { model_switch: number; expired: number; other: number }): string {
  const parts = BREAK_CAUSES.filter(([k]) => r[k] > 0).map(([k, name]) => (k === "model_switch" ? plural(r[k], "model switch", "model switches") : `${num(r[k])} ${name}`));
  return parts.join(", ") || "–";
}

/** The rebuild notice's facts, or null when every figure the page leans on is filled. */
export function rebuildFacts(c: ContextPayload["coverage"]): { calls: number; withBytes: number; compacted: number; withFirst: number } | null {
  return c.rebuild_needed ? { calls: c.calls, withBytes: c.with_bytes, compacted: c.compacted, withFirst: c.with_first_compaction } : null;
}
