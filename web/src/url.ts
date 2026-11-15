// The view in the query string (/usage?project=foo&range=30): pure functions the router is given to read and write it.
// Values are written plainly (ex=12345, session=true, never JSON-quoted) so the keys and values match the hash links
// the pages have always written, and the same text reads back as the same strings.
import type { Source } from "./api";
import { DEFAULT_RANGE, RANGES, sourceOf, type Range } from "./hash";

/** The text after one leading ? or #, as strings; a repeated key keeps its last value. */
export function parseSearch(str: string): Record<string, string> {
  const out: Record<string, string> = {};
  new URLSearchParams(str.replace(/^[?#]/, "")).forEach((v, k) => { out[k] = v; });
  return out;
}

/** "?a=b&…" in the object's key order; "" when nothing is written. true is 1; undefined, null, "" and false are left out
 *  (0 is a value: range=0 is all time). */
export function formatSearch(search: Readonly<Record<string, unknown>>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(search)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    p.set(k, v === true ? "1" : String(v));
  }
  const s = String(p);
  return s ? "?" + s : "";
}

/** The keys every page shares and the sheets that open over it; a key is present only when it holds a value.
 *  A type, not an interface, so a value of it can be given to formatSearch as it is. */
export type RootSearch = {
  project?: string; range?: Range; source?: Source; auto?: true;
  inspect?: string; tool?: string; mcp?: string; skill?: string; session?: string;
};

const STRINGS = ["project", "inspect", "tool", "mcp", "skill", "session"] as const;

/** Keeps the valid values of a query string, in the order the pages write them. Never throws; anything else, and any
 *  other key, is dropped, since the keys of the result are what formatSearch writes. */
export function validateRoot(raw: Record<string, unknown>): RootSearch {
  const out: RootSearch = {};
  const str = (k: string) => (typeof raw[k] === "string" && raw[k] !== "" ? (raw[k] as string) : undefined);
  const r = typeof raw.range === "string" && raw.range !== "" ? +raw.range : raw.range;
  if (str("project")) out.project = str("project");
  if (typeof r === "number" && (RANGES as readonly number[]).includes(r)) out.range = r as Range;
  const source = sourceOf(str("source"));
  if (source) out.source = source;
  if (raw.auto === "1" || raw.auto === true) out.auto = true;
  for (const k of STRINGS.slice(1)) { const v = str(k); if (v) out[k] = v; }
  return out;
}

/** The fields with their defaults, as the pages read them. */
export const rootState = (s: RootSearch) => ({
  project: s.project ?? "", range: s.range ?? DEFAULT_RANGE, source: (s.source ?? "") as Source | "", auto: s.auto ?? false,
  inspect: s.inspect ?? "", tool: s.tool ?? "", mcp: s.mcp ?? "", skill: s.skill ?? "", session: s.session ?? "",
});

/** Project, range, source and the automated toggle, for a link to another page; page-only keys and sheets stay behind. */
export function sharedSearch(s: RootSearch): RootSearch {
  const out: RootSearch = {};
  if (s.project) out.project = s.project;
  if (s.range !== undefined) out.range = s.range;
  if (s.source) out.source = s.source;
  if (s.auto) out.auto = true;
  return out;
}
