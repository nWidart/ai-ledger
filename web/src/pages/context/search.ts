// The Context key of the query string, typed: tip (the open tip's id). The keys every page shares come from validateRoot.

/** The field is present only when valid. A type, not an interface, so a value of it can be given to a page as it is. */
export type ContextSearch = { tip?: string };

/** Keeps the valid values of the Context keys. Never throws; an empty or non-string value reads as absent. */
export function validateSearch(raw: Readonly<Record<string, unknown>>): ContextSearch {
  const out: ContextSearch = {};
  if (typeof raw.tip === "string" && raw.tip !== "") out.tip = raw.tip;
  return out;
}
