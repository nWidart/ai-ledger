// The Insights page's own keys in the URL, typed. The shared ones (project, range, source, auto) are validateRoot's.
/** Present only when valid. A type, not an interface, so a value of it can be given to formatSearch as it is. */
export type InsightsSearch = {
  /** Outcome filter: a raw category name. */
  outcome?: string;
  /** Only sessions with friction (friction=1). */
  friction?: true;
  /** Drill filters: a raw category name (help, goal, fr) or a family key (goalf, frf). */
  help?: string; goal?: string; fr?: string; goalf?: string; frf?: string;
};

const NAMES = ["outcome", "help", "goal", "fr", "goalf", "frf"] as const;

/** Keeps the valid page-only values of a query string, given as the URL writes them or already typed. Never throws; an
 *  invalid value and any other key is dropped, and nothing is defaulted. */
export function validateSearch(raw: Readonly<Record<string, unknown>>): InsightsSearch {
  const out: InsightsSearch = {};
  for (const k of NAMES) { const v = raw[k]; if (typeof v === "string" && v !== "") out[k] = v; }
  // formatSearch writes true as 1 and drops false, so those are the typed forms of friction=1 and no friction.
  if (raw.friction === "1" || raw.friction === true) out.friction = true;
  return out;
}
