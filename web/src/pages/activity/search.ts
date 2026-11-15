// The Activity keys of the query string, typed: q (the sessions table's text filter), near (the near-work flag, near=1) and day
// (one calendar day of that table). The keys every page shares (project, range, source, auto) come from validateRoot.

/** Every field is present only when valid; no default is filled in. A type, not an interface, so a value of it can be given
 *  to a page as it is. */
export type ActivitySearch = { q?: string; near?: true; day?: string };

// A real calendar day as YYYY-MM-DD: 2026-02-30 is not one.
const isDay = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) && new Date(s).toISOString().startsWith(s);

/** Keeps the valid values of the Activity keys. Never throws; an invalid value reads as absent. The router hands validators
 *  the URL's strings or values already typed, so near is "1" or true. */
export function validateSearch(raw: Readonly<Record<string, unknown>>): ActivitySearch {
  const out: ActivitySearch = {};
  if (typeof raw.q === "string" && raw.q !== "") out.q = raw.q;
  if (raw.near === "1" || raw.near === true) out.near = true;
  if (typeof raw.day === "string" && isDay(raw.day)) out.day = raw.day;
  return out;
}
