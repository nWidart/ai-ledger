// The Activity keys of the query string, typed: view (the page's view: Overview when absent, Judgments), and Overview's q (the
// sessions table's text filter), near (the near-work flag, near=1) and day (one calendar day of that table). The Judgments
// view's own keys are in judgments/search.ts. The keys every page shares (project, range, source, auto) come from validateRoot.
import { validateSearch as judgmentsSearch, type InsightsSearch } from "./judgments/search";

/** Every field is present only when valid; no default is filled in. A type, not an interface, so a value of it can be given
 *  to a page as it is. */
export type ActivitySearch = { view?: "judgments"; q?: string; near?: true; day?: string };

// A real calendar day as YYYY-MM-DD: 2026-02-30 is not one.
const isDay = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) && new Date(s).toISOString().startsWith(s);

/** Keeps the valid values of the Activity keys. Never throws; an invalid value reads as absent. The router hands validators
 *  the URL's strings or values already typed, so near is "1" or true. */
export function validateSearch(raw: Readonly<Record<string, unknown>>): ActivitySearch {
  const out: ActivitySearch = {};
  if (raw.view === "judgments") out.view = "judgments";
  if (typeof raw.q === "string" && raw.q !== "") out.q = raw.q;
  if (raw.near === "1" || raw.near === true) out.near = true;
  if (typeof raw.day === "string" && isDay(raw.day)) out.day = raw.day;
  return out;
}

/** The route's validator: Activity's keys and the Judgments view's. */
export const validateRoute = (raw: Readonly<Record<string, unknown>>): ActivitySearch & InsightsSearch => ({ ...validateSearch(raw), ...judgmentsSearch(raw) });

/** The keys only Overview reads, and those only Judgments reads, as a patch that clears them: a switch of view leaves the
 *  other view's keys behind. */
export const NO_OVERVIEW_KEYS = { q: null, near: null, day: null } as const;
export const NO_JUDGMENTS_KEYS = { outcome: null, friction: null, help: null, goal: null, fr: null, goalf: null, frf: null } as const;
