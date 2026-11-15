// What the context menu offers for a subject, as data: ordered groups of items, each a link, a text to copy or (for mute
// only) a callback. Pure: no React, no DOM. Links come from the palette's resolver with chips for the current filters
// and the subject, so they carry filters, pick a sheet's host page and drop a sheet exactly as a palette commit does.
import type { Source } from "../../api";
import { applyPatch, formatSearch, parseView } from "../../url";
import { HOSTS_SHEETS, prefill, resolve, type Here } from "../palette/resolve";
import { PROJECT_PAGE, type Chip } from "../palette/suggest";
import { shortId } from "../sheets/session";
import { resumeCommand } from "./resume";
import type { Subject } from "./subject";

/** disabled: why the item cannot be picked yet ("Loading…") or at all ("Not available"). */
export type MenuItem =
  | { id: string; label: string; type: "nav"; href: string; disabled?: string }
  | { id: string; label: string; type: "copy"; text: string; disabled?: string }
  | { id: string; label: string; type: "action"; run: () => void; disabled?: string };

/** A session's details from /api/session, as far as they have come. */
export type SessionState =
  | { state: "loading" }
  | { state: "error" }
  | { state: "ready"; source: Source; cwd: string | null; project: string | null };

export interface MenuCtx {
  /** The current path and every key of its URL, as the palette's Here. */
  here: Here;
  /** A session subject's details; missing reads as loading. */
  session?: SessionState | undefined;
  /** The error type's mute toggle: the Errors page gives it, for that type; none elsewhere. */
  mute?: { muted: boolean; toggle: () => void } | null | undefined;
}

export const LOADING = "Loading…", UNAVAILABLE = "Not available";
/** Error types whose noise is fixed: they cannot be muted or unmuted. */
const FIXED_NOISE = ["infra", "user_denied"];
const SHOW_ON = [["/cost", "Cost"], ["/errors", "Errors"], ["/context", "Context"], ["/live", "Live"]] as const;

/** The href a palette commit of these chips writes from here, the current filters kept. */
const via = (here: Here, ...chips: Chip[]) => resolve([...prefill(here.search), ...chips], here).href;
const projectChip = (name: string): Chip => ({ kind: "project", value: name, label: name });
const pageChip = (path: string, label: string): Chip => ({ kind: "page", value: path, label });
const projectPage = (here: Here, name: string) => via(here, projectChip(name), pageChip(PROJECT_PAGE, "Project"));
/** This path with the patch applied, as a write to the current page. */
const patched = (here: Here, patch: Parameters<typeof applyPatch>[1]) => here.path + formatSearch(applyPatch(here.search, patch));

/** The page shows this project's Project page already. */
const onProjectPage = (here: Here, name: string) => here.path === PROJECT_PAGE && parseView(here.search).project === name;

function projectItems(name: string, here: Here): MenuItem[][] {
  const filtered = parseView(here.search).project === name, open: MenuItem[] = [];
  if (!onProjectPage(here, name)) open.push({ id: "project-page", label: "Open project page", type: "nav", href: projectPage(here, name) });
  if (HOSTS_SHEETS.includes(here.path)) {
    open.push({ id: "project-sheet", label: "Open project sheet", type: "nav",
      href: patched(here, { inspect: name, tool: null, mcp: null, skill: null, session: null }) });
  }
  // The sheet's filter button's patch: filter to the project, or clear the filter when the page already shows only it.
  open.push(filtered
    ? { id: "filter", label: "Show all projects", type: "nav", href: patched(here, { project: null, inspect: null, session: null }) }
    : { id: "filter", label: `Filter dashboard to ${name}`, type: "nav", href: patched(here, { project: name, inspect: null, session: null }) });
  const show = SHOW_ON.map(([path, label]): MenuItem => ({
    id: `show-${path.slice(1)}`, label: `Show on ${label}`, type: "nav", href: via(here, projectChip(name), pageChip(path, label)),
  }));
  return [open, show, [{ id: "copy-name", label: "Copy project name", type: "copy", text: name }]];
}

function sessionItems(id: string, here: Here, s: SessionState = { state: "loading" }): MenuItem[][] {
  const wait = s.state === "loading" ? LOADING : s.state === "error" ? UNAVAILABLE : null;
  const open: MenuItem[] = [{ id: "open-session", label: "Open session", type: "nav", href: via(here, { kind: "session", value: id, label: shortId(id) }) }];
  if (wait) open.push({ id: "project-page", label: "Open project page", type: "nav", href: "", disabled: wait });
  else if (s.state === "ready" && s.project && !onProjectPage(here, s.project)) open.push({ id: "project-page", label: "Open project page", type: "nav", href: projectPage(here, s.project) });
  const copy: MenuItem[] = [
    s.state === "ready"
      ? { id: "copy-resume", label: "Copy resume command", type: "copy", text: resumeCommand({ source: s.source, session_id: id, cwd: s.cwd }) }
      : { id: "copy-resume", label: "Copy resume command", type: "copy", text: "", disabled: wait! },
    { id: "copy-id", label: "Copy session ID", type: "copy", text: id },
  ];
  if (wait) copy.push({ id: "copy-cwd", label: "Copy working directory", type: "copy", text: "", disabled: wait });
  else if (s.state === "ready" && s.cwd) copy.push({ id: "copy-cwd", label: "Copy working directory", type: "copy", text: s.cwd });
  return [open, copy];
}

function categoryItems(id: string, ctx: MenuCtx): MenuItem[][] {
  const open: MenuItem[] = [{ id: "open-errors", label: "Open on Errors", type: "nav", href: via(ctx.here, { kind: "category", value: id, label: id }) }];
  if (ctx.mute && ctx.here.path === "/errors" && !FIXED_NOISE.includes(id)) {
    open.push({ id: "mute", label: ctx.mute.muted ? "Unmute" : "Mute this type", type: "action", run: ctx.mute.toggle });
  }
  return [open, [{ id: "copy-name", label: "Copy name", type: "copy", text: id }]];
}

/** The subject's menu: groups of items in order, a separator between groups. */
export function menuItems(subject: Subject, ctx: MenuCtx): MenuItem[][] {
  const { kind, value } = subject;
  switch (kind) {
    case "project": return projectItems(value, ctx.here);
    case "session": return sessionItems(value, ctx.here, ctx.session);
    case "category": return categoryItems(value, ctx);
    default: return [
      [{ id: "open-inspector", label: "Open inspector", type: "nav", href: via(ctx.here, { kind, value, label: value }) }],
      [{ id: "copy-name", label: "Copy name", type: "copy", text: value }],
    ];
  }
}

/** The menu's accessible name: "<name> actions". name: the subject's shown name (a session's title), else its value
 *  (a session's short id). */
export const menuLabel = (subject: Subject, name?: string | null) =>
  `${name || (subject.kind === "session" ? shortId(subject.value) : subject.value)} actions`;
