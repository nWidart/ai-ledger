// The Errors keys of the query string, typed: sub=0 (no subagents), noise=0 (noise hidden), gran=week, cat (open type), ex (one
// linked example), at (the chart bucket) and etool (the tool the open type's detail narrows to). The keys every page shares
// (project, range, source) come from validateRoot.

/** Every field is present only when valid, and holds its URL text so formatSearch writes it back as it came: a flag is "0" or
 *  "1" (formatSearch drops false), gran only "week" (day is the default). A type, not an interface, so formatSearch takes it. */
export type ErrorsSearch = { sub?: "0" | "1"; noise?: "0" | "1"; gran?: "week"; cat?: string; ex?: string; at?: string; etool?: string };

// The router hands validators the URL's strings or values already typed (a flag as true/false, or a number).
const flag = (v: unknown): "0" | "1" | undefined => v === "0" || v === 0 || v === false ? "0" : v === "1" || v === 1 || v === true ? "1" : undefined;
const text = (v: unknown) => (typeof v === "string" && v !== "" ? v : undefined);

/** Keeps the valid values of the Errors keys. Never throws; an invalid value reads as absent, and no default is filled in. */
export function validateSearch(raw: Readonly<Record<string, unknown>>): ErrorsSearch {
  const out: ErrorsSearch = {}, sub = flag(raw.sub), noise = flag(raw.noise), at = text(raw.at);
  if (sub) out.sub = sub;
  if (noise) out.noise = noise;
  if (raw.gran === "week") out.gran = "week";
  for (const k of ["cat", "ex", "etool"] as const) { const v = text(raw[k]); if (v) out[k] = v; }
  if (at && /^\d{4}-\d\d-\d\d$/.test(at)) out.at = at;
  return out;
}
