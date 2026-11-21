// From the palette's chips and the current location to the URL one commit writes, the footer that says so, and how each
// chip fared. Pure: no React, no DOM. Pages already read every key written here; nothing new goes in the URL.
import { viewOf, type View } from "../../api";
import { DOCS, docsForRoute, docsUrl, type DocsKey } from "../../docs";
import { DEFAULT_RANGE, SHARED_KEYS, applyPatch, formatSearch, judged, parseView, rootState, sheetKey, validateRoot } from "../../url";
import { SOURCE_LABELS } from "../Filters";
import { PAGES } from "../Nav";
import { JUDGMENTS_PAGE, PROJECT_PAGE, isFilter, rangeName, sourceLabel, type Chip, type Command, type FilterKind } from "./suggest";

/** search: every key of the current URL, as written (page-only ones too). */
export interface Here { path: string; search: Readonly<Record<string, string>> }
export type ChipStatus = { state: "applied" } | { state: "replaced"; by: string } | { state: "dropped" };
export interface Resolved {
  path: string;
  raw: Record<string, string>;
  href: string;
  /** The view differs from the current one. */
  moved: boolean;
  /** Enter does something: the view moves or a command runs. */
  changed: boolean;
  command: Command | null;
  /** The docs page a docs command opens in a new tab, or null. */
  docs: string | null;
  footer: string;
  /** One per chip, in chip order. */
  status: ChipStatus[];
  /** The API view the filters describe, for the suggestions. */
  view: View;
}

// Errors' view keys (pages/errors/view.ts): with none of them in the URL, Errors shows its saved view instead.
const ERRORS_KEYS = ["project", "range", "source", "sub", "noise", "gran", "cat", "ex"];
const HASH_KEY: Record<FilterKind, string> = { project: "project", source: "source", range: "range", automated: "auto" };
// A page as a page chip names it: a path, or JUDGMENTS_PAGE for Activity's Judgments view, which is a destination of its own.
const pageLabel = (page: string) => (page === PROJECT_PAGE ? "Project" : page === JUDGMENTS_PAGE ? "Judgments" : PAGES.find(p => p.path === page)?.label ?? page);
const isPage = (path: string) => path === PROJECT_PAGE || PAGES.some(p => p.path === path);
/** The page a location shows; a path that is no page reads as Activity. */
const pageOf = (here: Here) => (here.path === "/usage" && here.search.view === "judgments" ? JUDGMENTS_PAGE : isPage(here.path) ? here.path : "/usage");

/** Chips for the filters the URL sets: project, source, range (only when the URL names one) and the automated toggle. */
export function prefill(search: Readonly<Record<string, string>>): Chip[] {
  const s = validateRoot(search), h = rootState(s), out: Chip[] = [];
  if (h.project) out.push({ kind: "project", value: h.project, label: h.project, prefilled: true });
  if (h.source) out.push({ kind: "source", value: h.source, label: SOURCE_LABELS[h.source], prefilled: true });
  if (s.range !== undefined && String(s.range) === search.range) out.push({ kind: "range", value: String(h.range), label: rangeName(h.range), prefilled: true });
  if (h.auto) out.push({ kind: "automated", value: "1", label: "automated", prefilled: true });
  return out;
}

/**
 * Where the chips lead from here. Filters hold one value per key and sheets and commands one slot each: a later chip
 * replaces an earlier one. A page chip sets the page and a category chip sets Errors, the last one winning. Every page hosts
 * the project, tool and session sheets (the app's shell mounts them), so such a sheet opens on the winning page, or stays on
 * the current one with no page chip; an error type's sheet is Errors' own, and a page chip for another page drops it.
 */
export function resolve(chips: readonly Chip[], here: Here): Resolved {
  const status: ChipStatus[] = chips.map(() => ({ state: "applied" }));
  const cur = pageOf(here);
  const slot = new Map<string, number>(), setters: number[] = [];
  chips.forEach((c, i) => {
    const key = isFilter(c.kind) ? c.kind : c.kind === "command" ? "command" : c.kind === "page" ? null : "sheet";
    if (key) {
      const was = slot.get(key);
      if (was != null) status[was] = { state: "replaced", by: c.label };
      slot.set(key, i);
    }
    if (c.kind === "page" || c.kind === "category") setters.push(i);
  });
  const lastSetter = setters.at(-1), chosen = lastSetter == null ? null : chips[lastSetter]!.kind === "page" ? chips[lastSetter]!.value : "/errors";
  for (const i of setters) {
    if (chips[i]!.kind === "page" && chips[i]!.value !== chosen) status[i] = { state: "replaced", by: pageLabel(chosen!) };
  }
  let si = slot.get("sheet");
  const sheet = si == null ? null : chips[si]!;
  if (sheet?.kind === "category" && chosen !== "/errors") {
    status[si!] = { state: "dropped" };
    si = undefined;
  }
  const open = si == null ? null : chips[si]!;
  const page = chosen ?? cur, path = page === JUDGMENTS_PAGE ? "/usage" : page;
  // The session sheet's key on the page: on Live, session names the session the stream follows (url.ts sheetKey).
  const sk = sheetKey(path);

  // The URL: staying keeps every key, moving carries the shared ones (as the nav does); then the filters and the sheet.
  // Activity's two views are two pages here: a move between them leaves the other view's own keys behind.
  let raw: Record<string, string> = {};
  if (page === cur) raw = { ...here.search };
  else for (const k of SHARED_KEYS) if (here.search[k]) raw[k] = here.search[k]!;
  if (page === JUDGMENTS_PAGE) raw.view = "judgments";
  const value = (k: FilterKind) => { const i = slot.get(k); return i == null ? null : chips[i]!.value; };
  raw = applyPatch(raw, Object.fromEntries((Object.keys(HASH_KEY) as FilterKind[]).map(k => [HASH_KEY[k], value(k)])));
  // A new project or source closes the sheets of the old one. On Live it also drops the followed session, unless the same commit
  // opens a sheet: that asks for a sheet over the stream, which keeps following.
  if ((raw.project ?? "") !== (here.search.project ?? "") || (raw.source ?? "") !== (here.search.source ?? "")) {
    raw = applyPatch(raw, { ...(open && sk !== "session" ? {} : { session: null }), [sk]: null, inspect: null });
  }
  if (open) {
    raw = applyPatch(raw, { inspect: null, tool: null, mcp: null, skill: null, [sk]: null });
    // Opening a type is an explicit request: it wins over a selected chart bucket, which the palette cannot see the errors of.
    raw = applyPatch(raw, open.kind === "category" ? { cat: open.value, ex: null, etool: null, at: null }
      : { [open.kind === "session" ? sk : open.kind]: open.value });
  }
  if (path === "/errors" && !ERRORS_KEYS.some(k => k in raw)) raw.range = String(DEFAULT_RANGE);
  const href = path + formatSearch(raw), moved = href !== here.path + formatSearch(here.search);
  const ci = slot.get("command"), command = ci == null ? null : (chips[ci]!.value as Command);
  // "This page" is the page the commit shows, as the navigation's Docs link will point there once it lands.
  const docsKey: DocsKey | null = command === "docs" ? docsForRoute(path, raw) : command?.startsWith("docs:") ? (command.slice(5) as DocsKey) : null;
  const docs = docsKey && Object.hasOwn(DOCS, docsKey) ? docsUrl(docsKey) : null;

  // The footer: the action, then the filters that apply, then anything that will not.
  const st = parseView(raw);
  let action = "";
  if (open) {
    action = open.kind === "category" ? `open Errors on ${open.label}` : open.kind === "session" ? `open session ${open.label}` : `open ${open.label} inspector`;
    if (open.kind !== "category" && page !== cur) action += ` on ${pageLabel(page)}`;
  } else if (page !== cur) action = `open ${pageLabel(page)}`;
  else if (moved) action = `update ${pageLabel(page)}`;
  if (command === "copy") action = action ? `${action}, then copy its link` : "copy the link to this view";
  if (command === "refresh") action = action ? `${action}, then refresh data` : "refresh data";
  if (docs) {
    const opens = `open the ${docsKey === "home" ? "docs home" : DOCS[docsKey!].title + " docs"} in a new tab`;
    action = action ? `${action}, then ${opens}` : opens;
  }
  const parts = [action ? `Enter: ${action}` : "Enter: close, nothing changed"];
  if (action && (moved || command === "copy")) {
    if (st.project) parts.push(st.project);
    if (st.source) parts.push(sourceLabel(st.source));
    parts.push(st.range ? rangeName(st.range) : "all time");
    if (st.auto) parts.push(path === "/errors" ? "Errors always includes automated sessions" : "automated sessions");
  }
  // Judgments has none for a source other than Claude Code alone: Activity then shows Overview, and says why on its view switch.
  if (page === JUDGMENTS_PAGE && !judged(st.source) && action) parts.push(`${sourceLabel(st.source)} has no judgments: Overview opens`);
  chips.forEach((c, i) => { if (status[i]!.state === "dropped") parts.push(`${c.label} not applied on ${pageLabel(page)}`); });
  return { path, raw, href, moved, changed: moved || command != null, command, docs, footer: parts.join(" · "), status, view: viewOf(st) };
}
