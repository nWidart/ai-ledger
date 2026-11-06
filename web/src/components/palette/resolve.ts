// From the palette's chips and the current location to the URL one commit writes, the footer that says so, and how each
// chip fared. Pure: no React, no DOM. Pages already read every key written here; nothing new goes in the hash.
import { viewOf, type View } from "../../api";
import { DEFAULT_RANGE, SHARED_KEYS, applyPatch, formatHash, parseHash, type HashState } from "../../hash";
import { SOURCE_LABELS } from "../Filters";
import { PAGES } from "../Nav";
import { isFilter, rangeName, sourceLabel, type Chip, type Command, type FilterKind } from "./suggest";

export interface Here { path: string; hash: HashState }
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
  footer: string;
  /** One per chip, in chip order. */
  status: ChipStatus[];
  /** The API view the filters describe, for the suggestions. */
  view: View;
}

const HOSTS_SHEETS = ["/usage", "/cost", "/errors"];
// Errors' view keys (pages/errors/view.ts): with none of them in the hash, Errors shows its saved view instead.
const ERRORS_KEYS = ["project", "range", "source", "sub", "noise", "gran", "cat", "ex"];
const HASH_KEY: Record<FilterKind, string> = { project: "project", source: "source", range: "range", automated: "auto" };
const pageLabel = (path: string) => PAGES.find(p => p.path === path)?.label ?? path;
const isPage = (path: string) => PAGES.some(p => p.path === path);

/** Chips for the filters the hash sets: project, source, range (only when the hash names one) and the automated toggle. */
export function prefill(h: HashState): Chip[] {
  const out: Chip[] = [];
  if (h.project) out.push({ kind: "project", value: h.project, label: h.project, prefilled: true });
  if (h.source) out.push({ kind: "source", value: h.source, label: SOURCE_LABELS[h.source], prefilled: true });
  if (h.raw.range != null && String(h.range) === h.raw.range) out.push({ kind: "range", value: String(h.range), label: rangeName(h.range), prefilled: true });
  if (h.auto) out.push({ kind: "automated", value: "1", label: "automated", prefilled: true });
  return out;
}

/**
 * Where the chips lead from here. Filters hold one value per key and sheets and commands one slot each: a later chip
 * replaces an earlier one. A page chip sets the page and a category chip sets Errors, the last one winning; a sheet the
 * winning page cannot host is dropped. With no page, a sheet stays on a page that hosts it, else goes to Activity.
 */
export function resolve(chips: readonly Chip[], here: Here): Resolved {
  const status: ChipStatus[] = chips.map(() => ({ state: "applied" }));
  const cur = isPage(here.path) ? here.path : "/usage";
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
  if (sheet && (sheet.kind === "category" ? chosen !== "/errors" : chosen != null && !HOSTS_SHEETS.includes(chosen))) {
    status[si!] = { state: "dropped" };
    si = undefined;
  }
  const open = si == null ? null : chips[si]!;
  const path = chosen ?? (open && !HOSTS_SHEETS.includes(cur) ? "/usage" : cur);

  // The hash: staying keeps every key, moving carries the shared ones (as the nav does); then the filters and the sheet.
  let raw: Record<string, string> = {};
  if (path === cur) raw = { ...here.hash.raw };
  else for (const k of SHARED_KEYS) if (here.hash.raw[k]) raw[k] = here.hash.raw[k]!;
  const value = (k: FilterKind) => { const i = slot.get(k); return i == null ? null : chips[i]!.value; };
  raw = applyPatch(raw, Object.fromEntries((Object.keys(HASH_KEY) as FilterKind[]).map(k => [HASH_KEY[k], value(k)])));
  if ((raw.project ?? "") !== (here.hash.raw.project ?? "") || (raw.source ?? "") !== (here.hash.raw.source ?? "")) raw = applyPatch(raw, { session: null, inspect: null });
  if (open) {
    raw = applyPatch(raw, { inspect: null, tool: null, mcp: null, skill: null, session: null });
    raw = applyPatch(raw, open.kind === "category" ? { cat: open.value, ex: null } : { [open.kind]: open.value });
  }
  if (path === "/errors" && !ERRORS_KEYS.some(k => k in raw)) raw.range = String(DEFAULT_RANGE);
  const href = path + formatHash(raw), moved = href !== here.path + formatHash(here.hash.raw);
  const ci = slot.get("command"), command = ci == null ? null : (chips[ci]!.value as Command);

  // The footer: the action, then the filters that apply, then anything that will not.
  const st = parseHash(formatHash(raw));
  let action = "";
  if (open) {
    action = open.kind === "category" ? `open Errors on ${open.label}` : open.kind === "session" ? `open session ${open.label}` : `open ${open.label} inspector`;
    if (open.kind !== "category" && path !== cur) action += ` on ${pageLabel(path)}`;
  } else if (path !== cur) action = `open ${pageLabel(path)}`;
  else if (moved) action = `update ${pageLabel(path)}`;
  if (command === "copy") action = action ? `${action}, then copy its link` : "copy the link to this view";
  if (command === "refresh") action = action ? `${action}, then refresh data` : "refresh data";
  const parts = [action ? `Enter: ${action}` : "Enter: close, nothing changed"];
  if (action && (moved || command === "copy")) {
    if (st.project) parts.push(st.project);
    if (st.source) parts.push(sourceLabel(st.source));
    parts.push(st.range ? rangeName(st.range) : "all time");
    if (st.auto) parts.push(path === "/errors" ? "Errors always includes automated sessions" : "automated sessions");
  }
  chips.forEach((c, i) => { if (status[i]!.state === "dropped") parts.push(`${c.label} not applied on ${pageLabel(path)}`); });
  return { path, raw, href, moved, changed: moved || command != null, command, footer: parts.join(" · "), status, view: viewOf(st) };
}
