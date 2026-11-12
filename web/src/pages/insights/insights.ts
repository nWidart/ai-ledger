// Figures for the Insights page.
import type { FacetCount, InsightsPayload } from "../../api";

export const countOf = (rows: FacetCount[], name: string) => rows.find(r => r.name === name)?.n ?? 0;

/** The view's headline: how many analysed sessions met their goal, and what got in the way most. */
export function headline(d: InsightsPayload) {
  const n = d.coverage.facets, full = countOf(d.outcomes, "fully_achieved"), top = d.friction[0];
  return { full, n, top: top?.name ?? null };
}
