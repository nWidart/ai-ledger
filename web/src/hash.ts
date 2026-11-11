// The URL holds the view: the page in the path, its state in the hash (#project=…&range=…). Back retraces filter changes
// and sheets opening or closing (pushState); everything else replaces the entry. Keys and values are the ones the pages
// have always written, so links copied before the React app open the same view.
import { useMemo, useSyncExternalStore } from "react";
import type { Source } from "./api";

export const RANGES = [7, 14, 30, 90, 0] as const;
export type Range = (typeof RANGES)[number];
export const DEFAULT_RANGE: Range = 30;
export const SOURCES = ["claude", "codex"] as const satisfies readonly Source[];

export interface HashState {
  project: string;
  /** 7, 14, 30, 90 or 0 (all time); 30 when missing or unknown. raw.range says whether the hash had one. */
  range: Range;
  /** Activity and Cost: the open session sheet; inspect: the open project sheet. */
  session: string;
  inspect: string;
  /** The open tool, MCP server or skill sheet; at most one is set. */
  tool: string;
  mcp: string;
  skill: string;
  /** Errors: the linked example and the open type. */
  ex: string;
  cat: string;
  /** Include automated sessions (auto=1). */
  auto: boolean;
  /** The coding agent: "claude", "codex", or "" (all) when missing or unknown. */
  source: Source | "";
  /** Every key as written, page-only ones too (Errors: sub, noise, gran). */
  raw: Readonly<Record<string, string>>;
}
/** A change to the hash. null, "" and false remove a key; true writes "1"; undefined leaves it as it is. */
export type HashPatch = { [k: string]: string | number | boolean | null | undefined };

// Back retraces changes to these; other keys replace unless the caller asks to push.
const PUSH_KEYS = ["project", "range", "source", "auto", "inspect", "tool", "mcp", "skill", "session", "ex", "cat"];
// Written in this order (as the pages wrote them), with any other keys between gran and inspect.
const HEAD = ["project", "range", "source", "auto", "sub", "noise", "gran"], TAIL = ["inspect", "tool", "mcp", "skill", "session", "ex", "cat"];
// The keys that open a sheet.
const SHEET_KEYS = ["inspect", "tool", "mcp", "skill", "session"];
/** Project, range, source and the automated toggle travel between pages; page-only keys stay behind. */
export const SHARED_KEYS = ["project", "range", "source", "auto"] as const;

const isRange = (n: number): n is Range => (RANGES as readonly number[]).includes(n);
/** A hash source value, or "" (all) when missing or unknown. */
export const sourceOf = (v: string | null | undefined): Source | "" => ((SOURCES as readonly string[]).includes(v ?? "") ? (v as Source) : "");

export function parseHash(hash: string): HashState {
  const h = new URLSearchParams(hash.replace(/^#/, "")), raw: Record<string, string> = {};
  h.forEach((v, k) => { raw[k] = v; });
  const r = h.has("range") ? +h.get("range")! : NaN;
  return {
    project: h.get("project") || "", range: isRange(r) ? r : DEFAULT_RANGE, session: h.get("session") || "",
    inspect: h.get("inspect") || "", tool: h.get("tool") || "", mcp: h.get("mcp") || "", skill: h.get("skill") || "", ex: h.get("ex") || "", cat: h.get("cat") || "", auto: h.get("auto") === "1",
    source: sourceOf(h.get("source")), raw,
  };
}

/** The hash string for raw keys, in the canonical order; "" when empty. */
export function formatHash(raw: Readonly<Record<string, string>>): string {
  const keys = Object.keys(raw), rest = keys.filter(k => !HEAD.includes(k) && !TAIL.includes(k));
  const p = new URLSearchParams();
  for (const k of [...HEAD, ...rest, ...TAIL]) if (raw[k] != null && raw[k] !== "") p.set(k, raw[k]);
  const s = String(p);
  return s ? "#" + s : "";
}

export function applyPatch(raw: Readonly<Record<string, string>>, patch: HashPatch): Record<string, string> {
  const out = { ...raw };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (v === null || v === "" || v === false) delete out[k];
    else out[k] = v === true ? "1" : String(v);
  }
  return out;
}

// pushState and replaceState fire no event, so writes here tell subscribers themselves.
const subs = new Set<() => void>();
const emit = () => subs.forEach(f => f());
function subscribe(f: () => void) {
  subs.add(f);
  addEventListener("hashchange", f); addEventListener("popstate", f);
  return () => { subs.delete(f); removeEventListener("hashchange", f); removeEventListener("popstate", f); };
}

// history.state.sheets: how many entries back the view had no sheet open, when every push since only opened sheets.
const sheetDepth = (): number | undefined => (history.state as { sheets?: number } | null)?.sheets;

/** Changes the hash. Pushes when a filter or sheet key changes (or push: true), else replaces; a no-op when nothing changes. */
export function setHash(patch: HashPatch, opts: { push?: boolean } = {}) {
  const was = parseHash(location.hash).raw, next = applyPatch(was, patch), h = formatHash(next);
  if (h === formatHash(was) && h === location.hash) return;
  const changed = PUSH_KEYS.filter(k => (was[k] ?? "") !== (next[k] ?? ""));
  const push = opts.push ?? changed.length > 0;
  const url = location.pathname + location.search + h;
  if (!push) history.replaceState(history.state, "", url);
  else {
    const before = SHEET_KEYS.some(k => was[k]) ? sheetDepth() : 0;
    const sheets = SHEET_KEYS.some(k => next[k]) && changed.every(k => SHEET_KEYS.includes(k)) && before != null ? before + 1 : undefined;
    history.pushState(sheets ? { sheets } : null, "", url);
  }
  emit();
}

/** Closes every sheet (patch clears their keys): Back to the view they opened from when this app pushed each of them,
 *  so closing leaves no entry that reopens one; else a replace. */
export function closeSheets(patch: HashPatch) {
  const n = sheetDepth();
  if (n) history.go(-n); else setHash(patch, { push: false });
}

/** The shared keys of the current hash, for a link to another page: "#project=foo&range=30" or "". */
export function sharedHash(hash = location.hash): string {
  const raw = parseHash(hash).raw, out: Record<string, string> = {};
  for (const k of SHARED_KEYS) if (raw[k]) out[k] = raw[k];
  return formatHash(out);
}

/** The view in the hash, re-read on Back, Forward, hash links and every setHash. */
export function useHashState(): [HashState, typeof setHash] {
  const hash = useSyncExternalStore(subscribe, () => location.hash, () => "");
  return [useMemo(() => parseHash(hash), [hash]), setHash];
}

/** Goes to href (a path and hash) as one history entry, no reload; scrolls to the top when the page changes. A no-op when
 *  href is where we are. */
export function go(href: string) {
  const to = new URL(href, location.href);
  if (to.pathname + to.search + to.hash === location.pathname + location.search + location.hash) return;
  const moved = to.pathname !== location.pathname;
  history.pushState(null, "", href);
  emit();
  if (moved) scrollTo?.(0, 0);
}
/** Client-side page switch: a new history entry, no reload. */
export const navigate = (href: string) => go(href);
export const usePathname = (): string => useSyncExternalStore(subscribe, () => location.pathname, () => "/");
