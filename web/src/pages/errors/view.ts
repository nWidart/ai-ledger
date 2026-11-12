// The URL hash is the view: project, range, source, sub=0 (no subagents), noise=0 (noise hidden), gran=week, cat (open type), ex (one
// linked example), at (the chart bucket the table and detail narrow to), etool (the tool the open type's detail narrows to; tool is the tool sheet's key). The last view and the list mode live in localStorage under the old
// page's keys and shapes. The applied fixes live in the store; FIXES_KEY is where an older page kept them, read once to move them there (see marks.ts).
import { RANGES, sourceOf, type HashPatch, type Range } from "../../hash";
import type { Fixes, Model, View } from "./model";

const KEYS = ["project", "range", "source", "sub", "noise", "gran", "cat", "ex", "at", "etool"];
export const FIXES_KEY = "claude-errors-fixes", VIEW_KEY = "claude-errors-view", MODE_KEY = "claude-errors-mode";
/** What claude-errors-view holds. */
export interface SavedView { project?: string; range?: number; source?: string; gran?: string; sub?: boolean; noise?: boolean; cat?: string | null }
export type Mode = "inc" | "flat";

export const store = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage off */ } },
  remove(k: string) { try { localStorage.removeItem(k); } catch { /* storage off */ } },
};
export const loadFixes = (): Fixes => {
  const f = store.get<unknown>(FIXES_KEY, {});
  return f && typeof f === "object" && !Array.isArray(f)
    ? Object.fromEntries(Object.entries(f).filter((x): x is [string, string] => typeof x[1] === "string")) : {};
};
export const loadMode = (): Mode => (store.get<string>(MODE_KEY, "inc") === "flat" ? "flat" : "inc");

const isRange = (n: number): n is Range => (RANGES as readonly number[]).includes(n);
export const DEFAULT_VIEW: View = { project: "", source: "", range: 30, gran: "day", sub: true, noise: false, cat: null, focus: null, at: null, tool: null };

/** The view from the hash. Any view key makes the hash the whole view: omitted keys take their defaults, and the saved view
 *  only fills an empty hash. A bare #ex= link means all time. linked: the hash names a known example. dead: it names one the
 *  model lacks, which is not all time: it keeps its range, or 30 days. Nothing is dead until the model loads (m undefined),
 *  so the notice never flashes while the payload is on its way. */
export function readView(raw: Readonly<Record<string, string>>, saved: SavedView, m: Pick<Model, "cats" | "byId"> | undefined): { view: View; linked: boolean; dead: boolean } {
  if (!KEYS.some(k => k in raw)) {
    const r = Number(saved.range);
    return { linked: false, dead: false, view: { ...DEFAULT_VIEW, project: typeof saved.project === "string" ? saved.project : "", range: isRange(r) ? r : 30,
      source: sourceOf(saved.source),
      gran: saved.gran === "week" ? "week" : "day", sub: saved.sub !== false, noise: saved.noise === true,
      cat: saved.cat && m?.cats[saved.cat] ? saved.cat : null } };
  }
  const r = "range" in raw ? +raw.range! : NaN, ex = raw.ex && m ? m.byId[raw.ex] : undefined, cat = raw.cat, dead = !!m && !!raw.ex && !ex;
  return { linked: !!ex, dead, view: { project: raw.project || "", source: sourceOf(raw.source), sub: raw.sub !== "0", noise: raw.noise === "0", gran: raw.gran === "week" ? "week" : "day",
    range: isRange(r) ? r : "ex" in raw && !("range" in raw) && !dead ? 0 : 30,
    cat: ex ? ex.c : cat && m?.cats[cat] ? cat : null, focus: ex ? ex.id : null, at: /^\d{4}-\d\d-\d\d$/.test(raw.at ?? "") ? raw.at! : null, tool: raw.etool || null } };
}
/** The hash keys for a view (others, such as auto, stay as they are). */
export const viewPatch = (v: View, focus = v.focus): HashPatch => ({
  project: v.project || null, range: v.range, source: v.source || null, sub: v.sub ? null : "0", noise: v.noise ? "0" : null, gran: v.gran === "week" ? "week" : null,
  ex: focus || null, cat: focus ? null : v.cat, at: v.at, etool: v.tool,
});
/** The hash for a view on its own, as the old page wrote it: an example's permalink and Copy URL. */
export function viewHash(v: View, focus = v.focus): string {
  const p = new URLSearchParams();
  if (v.project) p.set("project", v.project);
  p.set("range", String(v.range));
  if (v.source) p.set("source", v.source);
  if (!v.sub) p.set("sub", "0");
  if (v.noise) p.set("noise", "0");
  if (v.gran === "week") p.set("gran", "week");
  if (focus) p.set("ex", focus); else { if (v.cat) p.set("cat", v.cat); if (v.at) p.set("at", v.at); if (v.tool) p.set("etool", v.tool); }
  return "#" + p;
}
export const savedOf = (v: View): SavedView => ({ project: v.project, range: v.range, source: v.source, gran: v.gran, sub: v.sub, noise: v.noise, cat: v.cat });
