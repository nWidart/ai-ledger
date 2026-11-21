// The Context keys of the query string, typed: tip (the open tip's id) and tab (the tab shown; Overhead and pressure when absent).
// The keys every page shares come from validateRoot.

/** Context's tabs, in order. The first is the default and is never written to the URL. */
export const TABS = ["overhead", "growth", "cache"] as const;
export type ContextTab = typeof TABS[number];

/** The fields are present only when valid. A type, not an interface, so a value of it can be given to a page as it is. */
export type ContextSearch = { tip?: string; tab?: Exclude<ContextTab, "overhead"> };

/** Keeps the valid values of the Context keys. Never throws; an empty, unknown or non-string value reads as absent. */
export function validateSearch(raw: Readonly<Record<string, unknown>>): ContextSearch {
  const out: ContextSearch = {};
  if (typeof raw.tip === "string" && raw.tip !== "") out.tip = raw.tip;
  if (raw.tab === "growth" || raw.tab === "cache") out.tab = raw.tab;
  return out;
}
