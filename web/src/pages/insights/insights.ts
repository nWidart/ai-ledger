// Figures for the Insights page.
import type { FacetCount, InsightsPayload, SessionFigures } from "../../api";
import { dur, num, plural } from "../../format";

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
