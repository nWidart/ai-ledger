// Words for the Insights page: /insights writes free-form snake_case labels; the page shows them with spaces.
import type { FacetCount, InsightsPayload } from "../../api";

/** A category name as shown: underscores turned into spaces. The raw name goes in the title. */
export const label = (name: string | null | undefined) => (name ?? "").replace(/_/g, " ");

/** Outcome names as the page words them; an outcome /insights adds later shows under its raw name. */
export const OUTCOME_LABELS: Record<string, string> = {
  fully_achieved: "Fully achieved", mostly_achieved: "Mostly achieved", partially_achieved: "Partially achieved",
  not_achieved: "Not achieved", unclear_from_transcript: "Unclear",
};
export const outcomeLabel = (o: string | null) => (o == null ? "–" : OUTCOME_LABELS[o] ?? o);
/** The badge tone of an outcome: met, part met, not met, or neither. */
export const outcomeTone = (o: string | null) =>
  o === "fully_achieved" || o === "mostly_achieved" ? "full" : o === "partially_achieved" ? "part" : o === "not_achieved" ? "not" : "other";

export const countOf = (rows: FacetCount[], name: string) => rows.find(r => r.name === name)?.n ?? 0;

/** The view's headline: how many analysed sessions met their goal, and what got in the way most. */
export function headline(d: InsightsPayload) {
  const n = d.coverage.facets, full = countOf(d.outcomes, "fully_achieved"), top = d.friction[0];
  return { full, n, top: top?.name ?? null };
}
