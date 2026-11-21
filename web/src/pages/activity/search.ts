// The Activity keys of the query string, typed: view (the page's view: Overview when absent, Judgments), and Overview's q (the
// sessions table's text filter), near (the near-work flag, near=1), day (one calendar day of the work chart), week (the
// Monday of one of its weeks; Overview drops one its view does not reach) and tab (the workbench tab: Sessions when absent). The Judgments view's own keys are in
// judgments/search.ts. The keys every page shares (project, range, source, auto) come from validateRoot.
import { isDay } from "../../url";
import { validateSearch as judgmentsSearch, type InsightsSearch } from "./judgments/search";

/** The workbench tabs; sessions, the default, has no key. */
export const TABS = ["sessions", "projects", "tools", "loops"] as const;
export type WorkTab = (typeof TABS)[number];

/** Every field is present only when valid; no default is filled in. A type, not an interface, so a value of it can be given
 *  to a page as it is. */
export type ActivitySearch = { view?: "judgments"; q?: string; near?: true; day?: string; week?: string; tab?: Exclude<WorkTab, "sessions"> };

/** Keeps the valid values of the Activity keys. Never throws; an invalid value reads as absent. The router hands validators
 *  the URL's strings or values already typed, so near is "1" or true. A day and a week together keep the day: only one
 *  selection is written at a time. */
export function validateSearch(raw: Readonly<Record<string, unknown>>): ActivitySearch {
  const out: ActivitySearch = {};
  if (raw.view === "judgments") out.view = "judgments";
  if (typeof raw.q === "string" && raw.q !== "") out.q = raw.q;
  if (raw.near === "1" || raw.near === true) out.near = true;
  if (typeof raw.day === "string" && isDay(raw.day)) out.day = raw.day;
  else if (typeof raw.week === "string" && isDay(raw.week) && new Date(raw.week + "T00:00:00Z").getUTCDay() === 1) out.week = raw.week;
  if (raw.tab === "projects" || raw.tab === "tools" || raw.tab === "loops") out.tab = raw.tab;
  return out;
}

/** The route's validator: Activity's keys and the Judgments view's. */
export const validateRoute = (raw: Readonly<Record<string, unknown>>): ActivitySearch & InsightsSearch => ({ ...validateSearch(raw), ...judgmentsSearch(raw) });

/** The keys only Overview reads, and those only Judgments reads, as a patch that clears them: a switch of view leaves the
 *  other view's keys behind. */
export const NO_OVERVIEW_KEYS = { q: null, near: null, day: null, week: null, tab: null } as const;
export const NO_JUDGMENTS_KEYS = { outcome: null, friction: null, help: null, goal: null, fr: null, goalf: null, frf: null } as const;
