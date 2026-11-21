// The URL holds the view: the page in the path, its state in the query string (/usage?project=…&range=…). The router owns
// the URL and the history; this module holds what the router has no option for: which changes Back retraces (a filter or a
// sheet pushes an entry, everything else replaces it), the count of sheet entries that lets Close go back past them, and
// the day that is dropped with its view. Keys and values are the ones the pages wrote in the hash before the query string,
// written plainly (ex=12345, session=true, never JSON-quoted), so a link in the old form is the same link with # for ?.
import { useRouterState, type AnyRouter } from "@tanstack/react-router";
import type { Source } from "./api";

export const RANGES = [7, 14, 30, 90, 0] as const;
export type Range = (typeof RANGES)[number];
export const DEFAULT_RANGE: Range = 30;
export const SOURCES = ["claude", "codex"] as const satisfies readonly Source[];

/** The keys every page shares and the sheets that open over it, typed; a key is present only when it holds a valid value,
 *  so range says whether the URL names one. A type, not an interface, so a value of it can be given to formatSearch as it is.
 *  A page's own keys are typed by the search.ts beside it. */
export type RootSearch = {
  project?: string;
  /** 7, 14, 30, 90 or 0 (all time). */
  range?: Range;
  /** The coding agent; absent is all of them. */
  source?: Source;
  /** Include automated sessions (auto=1). */
  auto?: true;
  /** The open project sheet. */
  inspect?: string;
  /** The open tool, MCP server or skill sheet; at most one is set. */
  tool?: string; mcp?: string; skill?: string;
  /** The open session sheet; on Live, the session the stream follows (see sheetKey). */
  session?: string;
  /** Live: the open session sheet. */
  sheet?: string;
};
/** A change to the view. null, "" and false remove a key; true writes "1"; undefined leaves it as it is. */
export type SearchPatch = { [k: string]: string | number | boolean | null | undefined };

// Back retraces changes to these; other keys replace unless the caller asks to push.
const PUSH_KEYS = ["project", "range", "source", "auto", "inspect", "tool", "mcp", "skill", "session", "sheet", "ex", "cat"];
// Written in this order (as the pages wrote them), with any other keys between gran and inspect.
const HEAD = ["project", "range", "source", "auto", "sub", "noise", "gran"], TAIL = ["inspect", "tool", "mcp", "skill", "session", "sheet", "ex", "cat"];
/** The key of the session sheet on a page: session, except on Live, where session names the session the stream follows. */
export const sheetKey = (path: string): "session" | "sheet" => (path === "/live" ? "sheet" : "session");
// The keys that open a sheet on a page.
const sheetKeys = (path: string): string[] => ["inspect", "tool", "mcp", "skill", sheetKey(path)];
/** Project, range, source and the automated toggle travel between pages; page-only keys stay behind. */
export const SHARED_KEYS = ["project", "range", "source", "auto"] as const;

const isRange = (n: number): n is Range => (RANGES as readonly number[]).includes(n);
/** A source value, or "" (all) when missing or unknown. */
/** A real calendar day as YYYY-MM-DD: 2026-02-30 is not one. */
export const isDay = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) && new Date(s).toISOString().startsWith(s);
export const sourceOf =(v: string | null | undefined): Source | "" => ((SOURCES as readonly string[]).includes(v ?? "") ? (v as Source) : "");

/** The text after one leading ? or #, as strings; a repeated key keeps its last value. The router reads the URL with this. */
export function parseSearch(str: string): Record<string, string> {
  const out: Record<string, string> = {};
  new URLSearchParams(str.replace(/^[?#]/, "")).forEach((v, k) => { out[k] = v; });
  return out;
}

/** "?a=b&…" in the canonical key order; "" when nothing is written. true is 1; undefined, null, "" and false are left out
 *  (0 is a value: range=0 is all time). The router writes the URL with this, and so does every href built by hand. */
export function formatSearch(search: Readonly<Record<string, unknown>>): string {
  const keys = Object.keys(search), rest = keys.filter(k => !HEAD.includes(k) && !TAIL.includes(k));
  const p = new URLSearchParams();
  for (const k of [...HEAD, ...rest, ...TAIL]) {
    const v = search[k];
    if (v === undefined || v === null || v === "" || v === false) continue;
    p.set(k, v === true ? "1" : String(v));
  }
  const s = String(p);
  return s ? "?" + s : "";
}

const STRINGS = ["project", "inspect", "tool", "mcp", "skill", "session", "sheet"] as const;

/** Keeps the valid values of the shared keys, given as the URL writes them or already typed (the router calls it with
 *  both). Never throws; an invalid value, and any other key, is dropped, and no default is filled in. */
export function validateRoot(raw: Readonly<Record<string, unknown>>): RootSearch {
  const out: RootSearch = {};
  const str = (k: string) => (typeof raw[k] === "string" && raw[k] !== "" ? (raw[k] as string) : undefined);
  const r = typeof raw.range === "string" && raw.range !== "" ? +raw.range : raw.range;
  if (str("project")) out.project = str("project");
  if (typeof r === "number" && isRange(r)) out.range = r;
  const source = sourceOf(str("source"));
  if (source) out.source = source;
  if (raw.auto === "1" || raw.auto === true) out.auto = true;
  for (const k of STRINGS.slice(1)) { const v = str(k); if (v) out[k] = v; }
  return out;
}

/** The shared keys with their defaults, as the pages read them: 30 days, all sources, no sheet. */
export const rootState = (s: RootSearch) => ({
  project: s.project ?? "", range: s.range ?? DEFAULT_RANGE, source: (s.source ?? "") as Source | "", auto: s.auto ?? false,
  inspect: s.inspect ?? "", tool: s.tool ?? "", mcp: s.mcp ?? "", skill: s.skill ?? "", session: s.session ?? "", sheet: s.sheet ?? "",
});
type ViewState = ReturnType<typeof rootState>;
/** The view a URL's keys describe, with defaults for what is missing or not valid. */
export const parseView = (raw: Readonly<Record<string, unknown>>): ViewState => rootState(validateRoot(raw));

// Page-only keys that belong to one view (Activity's selected day): a write that changes the parsed project, range or
// source drops them in the same write, so Back returns to the view with its day. Writing the value a key already reads
// as (range=30 with no range, an unknown source cleaned to All) changes no view and keeps them.
const VIEW_SCOPED = ["day"];
const viewKey = (raw: Readonly<Record<string, string>>) => {
  const { project, range, source } = parseView(raw);
  return [project, range, source].join("\0");
};

export function applyPatch(raw: Readonly<Record<string, string>>, patch: SearchPatch): Record<string, string> {
  const out = { ...raw };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (v === null || v === "" || v === false) delete out[k];
    else out[k] = v === true ? "1" : String(v);
  }
  if (viewKey(raw) !== viewKey(out)) for (const k of VIEW_SCOPED) delete out[k];
  return out;
}

// The one router of the app (or of the test that is running): makeRouter binds it, so the functions below can be called
// from event handlers and plain modules, not only from components.
let router: AnyRouter;
// What a navigation is to a page: Back, Forward, a link (go) or an address typed in. A setSearch is the page's own write.
const navs = new Set<() => void>(), heard = new WeakSet<AnyRouter>();
const navigated = () => navs.forEach(f => f());
export const bindRouter = (r: AnyRouter) => {
  router = r;
  if (heard.has(r)) return;
  heard.add(r);
  r.history.subscribe(({ action }: { action: { type: string } }) => { if (action.type !== "PUSH" && action.type !== "REPLACE") navigated(); });
};
/** Calls f when the URL changes by a navigation, not by a setSearch; returns a function that stops it. */
export const onNavigate = (f: () => void) => { navs.add(f); return () => { navs.delete(f); }; };
// The history is read, not the router's state: it is current the moment a write returns, so two writes in one handler
// see each other. The router batches its writes to the browser's history into a microtask; every write here is flushed, so
// location is current too when the write returns, as it was with pushState.
const here = () => router.history.location;
/** The keys of the current URL, as written. */
export const currentRaw = (): Record<string, string> => parseSearch(here().search);
/** The key of the current page's session sheet (sheetKey). */
export const currentSheetKey = () => sheetKey(here().pathname);

// The sheets count in the entry's state: how many entries back the view had no sheet open, when every push since only opened sheets.
const sheetDepth = (): number | undefined => (here().state as { sheets?: number } | undefined)?.sheets;

/** Changes the view. Pushes when a filter or sheet key changes (or push: true), else replaces; a no-op when nothing changes.
 *  Never moves the scroll position: the page is the same page. */
export function setSearch(patch: SearchPatch, opts: { push?: boolean } = {}) {
  const loc = here(), was = parseSearch(loc.search), next = applyPatch(was, patch), s = formatSearch(next);
  if (s === formatSearch(was)) {
    // The same view spelled another way (keys in another order): rewrite it in the canonical spelling, as a replace. The
    // router reads both spellings as one location and writes nothing for it, so the entry's state is marked: a changed
    // state makes it write, through navigate, which keeps the scroll position as every other view write does.
    if (s !== loc.search) {
      const sheets = sheetDepth();
      void router.navigate({ to: loc.pathname, search: next, hash: true, replace: true, resetScroll: false, state: { ...(sheets ? { sheets } : {}), respelled: true } } as never);
      router.history.flush();
    }
    return;
  }
  const changed = PUSH_KEYS.filter(k => (was[k] ?? "") !== (next[k] ?? ""));
  const push = opts.push ?? changed.length > 0;
  let sheets = sheetDepth();
  if (push) {
    const keys = sheetKeys(loc.pathname), before = keys.some(k => was[k]) ? sheets : 0;
    sheets = keys.some(k => next[k]) && changed.every(k => keys.includes(k)) && before != null ? before + 1 : undefined;
  }
  void router.navigate({ to: loc.pathname, search: next, replace: !push, resetScroll: false, state: sheets ? { sheets } : {} } as never);
  router.history.flush();
}

/** Closes every sheet (patch clears their keys): Back to the view they opened from when this app pushed each of them,
 *  so closing leaves no entry that reopens one; else a replace. */
export function closeSheets(patch: SearchPatch) {
  const n = sheetDepth();
  if (n) router.history.go(-n); else setSearch(patch, { push: false });
}

/** The shared keys of a URL's keys, for a link to another page. */
export function sharedOf(raw: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of SHARED_KEYS) if (raw[k]) out[k] = raw[k];
  return out;
}
/** The shared keys of the current URL as a query string: "?project=foo&range=30" or "". */
export const sharedSearch = (raw: Readonly<Record<string, unknown>> = currentRaw()): string => formatSearch(sharedOf(raw));

/** The keys of the current URL as validate types them, narrowed by select; re-read on every change of the URL. The
 *  component re-renders only when its selection changes: the result is compared deeply, so validate and select may build
 *  a new object on every call. Read from the location, not a route match: it changes in the same task as the write, which an input bound to the URL needs. */
export function useSearchOf<T>(validate: (raw: Readonly<Record<string, string>>) => T): T;
export function useSearchOf<T, U>(validate: (raw: Readonly<Record<string, string>>) => T, select: (search: T) => U): U;
export function useSearchOf<T, U>(validate: (raw: Readonly<Record<string, string>>) => T, select?: (search: T) => U): T | U {
  return useRouterState({
    select: (s: { location: { search: unknown } }) => { const v = validate(s.location.search as Record<string, string>); return select ? select(v) : v; },
    structuralSharing: true,
  } as never) as T | U;
}

/** The shared keys of the URL with their defaults, and the function that changes the view. A change to a page's own key
 *  does not re-render its readers. */
export const useView = (): [ViewState, typeof setSearch] => [useSearchOf(parseView), setSearch];

/** Goes to href (a path and query string) as one history entry, no reload; the new page starts at the top, the same page
 *  stays where it is. A no-op when href is where we are. */
export function go(href: string) {
  const loc = here(), to = new URL(href, "http://app" + loc.pathname + loc.search + loc.hash);
  if (to.pathname + to.search + to.hash === loc.pathname + loc.search + loc.hash) return;
  void router.navigate({ to: to.pathname, search: parseSearch(to.search), hash: to.hash.slice(1), resetScroll: to.pathname !== loc.pathname } as never);
  router.history.flush();
  navigated();
}
/** Client-side page switch: a new history entry, no reload. */
export const navigate = (href: string) => go(href);
export const usePathname = (): string => useRouterState({ select: s => s.location.pathname });
