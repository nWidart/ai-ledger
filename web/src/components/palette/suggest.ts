// The palette's suggestion rows: filters (#) from the palette payload and the static ranges, destinations (>) from the
// pages, the payload's tools, MCP servers, skills and error categories, the session search, and the commands.
import type { PalettePayload, Source, TitledSessionRow } from "../../api";
import { pct, plural, when } from "../../format";
import { RANGES } from "../../url";
import { SOURCE_LABELS } from "../Filters";
import { PAGES } from "../Nav";
import { shortId } from "../sheets/session";
import { EXACT, PREFIX, bestMatch, byScore, match, type Ranges } from "./match";
import type { Term } from "./terms";

export type FilterKind = "project" | "source" | "range" | "automated";
export type Kind = FilterKind | "page" | "tool" | "mcp" | "skill" | "session" | "category" | "command";
export type Command = "refresh" | "copy";

const ORDER: Kind[] = ["project", "source", "range", "automated", "page", "tool", "mcp", "skill", "category", "session", "command"];
export const isFilter = (k: Kind): k is FilterKind => k === "project" || k === "source" || k === "range" || k === "automated";
export const BADGES: Record<Kind, string> = {
  project: "Project", source: "Source", range: "Range", automated: "Filter", page: "Page", tool: "Tool", mcp: "MCP server",
  skill: "Skill", session: "Session", category: "Error type", command: "Command",
};
/** Rows per kind and in all; project-page rows. */
export const PER_KIND = 8, MAX_ROWS = 20, MAX_SESSIONS = 5, MAX_PROJECT_PAGES = 3;

/** A picked term. value: the project, source, range in days, page path, subject name, session id, category id or command. */
export interface Chip { kind: Kind; value: string; label: string; prefilled?: boolean }
export interface Row extends Chip {
  id: string;
  sigil: "#" | ">";
  /** The text shown, with the matched spans in ranges. */
  text: string;
  ranges: Ranges;
  /** Counts as shown ("3 calls", "33% failed"). */
  detail: string[];
  rank: number;
  count: number;
  /** A project-page row: picking it adds this project's filter with the Project page. */
  project?: string;
}
export interface SuggestData { palette?: PalettePayload | undefined; sessions?: readonly TitledSessionRow[] | undefined }

/** The Project page's path: a page the palette can open, though it is no tab. */
export const PROJECT_PAGE = "/project";
export const rangeName = (r: number) => (r ? `${r}d` : "all");
export const rangeLabel = (r: number) => (r ? `Last ${r} days` : "All time");
export const sourceLabel = (s: string) => SOURCE_LABELS[s as Source] ?? s;
const failed = (r: { calls: number; failure_rate: number | null }) => [plural(r.calls, "call"), `${pct(r.failure_rate)} failed`];

interface Candidate { kind: Kind; value: string; label: string; texts: string[]; detail?: string[]; count?: number; display?: number }

/** Every candidate row before matching. */
function candidates(data: SuggestData, sessions: boolean, project: boolean): Candidate[] {
  const p = data.palette, out: Candidate[] = [];
  for (const r of p?.projects ?? []) out.push({ kind: "project", value: r.name, label: r.name, texts: [r.name], detail: [plural(r.sessions, "session")], count: r.sessions });
  const bySource = new Map(p?.sources.map(r => [r.source, r.sessions]));
  for (const s of Object.keys(SOURCE_LABELS) as Source[]) {
    const n = bySource.get(s) ?? 0;
    out.push({ kind: "source", value: s, label: SOURCE_LABELS[s], texts: [s, SOURCE_LABELS[s]], detail: [plural(n, "session")], count: n, display: 1 });
  }
  for (const r of RANGES) out.push({ kind: "range", value: String(r), label: rangeName(r), texts: [rangeName(r), rangeLabel(r)], detail: [rangeLabel(r)] });
  out.push({ kind: "automated", value: "1", label: "automated", texts: ["automated", "Include automated sessions"], detail: ["Include automated sessions"] });
  for (const pg of PAGES) out.push({ kind: "page", value: pg.path, label: pg.label, texts: [pg.label, pg.path.slice(1)] });
  // The Project page is no tab: it is offered when a project is named, by a chip (the palette opens with one for the view's project).
  if (project) out.push({ kind: "page", value: PROJECT_PAGE, label: "Project", texts: ["Project", "project"] });
  for (const [kind, rows] of [["tool", p?.tools], ["mcp", p?.mcp], ["skill", p?.skills]] as const) {
    for (const r of rows ?? []) out.push({ kind, value: r.name, label: r.name, texts: [r.name], detail: failed(r), count: r.calls });
  }
  for (const r of p?.categories ?? []) {
    if (r.id == null) continue;
    const label = r.label || r.id;
    out.push({ kind: "category", value: r.id, label, texts: [label, r.id], detail: [plural(r.errors, "error"), "on Errors"], count: r.errors });
  }
  if (sessions) {
    for (const s of (data.sessions ?? []).slice(0, MAX_SESSIONS)) {
      const label = s.title || shortId(s.session_id);
      out.push({ kind: "session", value: s.session_id, label, texts: [label, s.session_id, s.project ?? "", s.git_branch ?? ""],
        detail: [s.project ?? "", when(s.first_ts)].filter(Boolean) });
    }
  }
  out.push({ kind: "command", value: "refresh", label: "Refresh", texts: ["refresh", "Refresh data"], detail: ["Ingest new transcripts now"] });
  out.push({ kind: "command", value: "copy", label: "Copy link", texts: ["copy link"], detail: ["Apply, then copy the view's URL"] });
  return out;
}

/** Whether the session search runs for this term: two characters or more, and it could name a session. */
export const searchesSessions = (t: Term) => t.sigil !== "#" && t.text.trim().length >= 2;

/**
 * The rows for the term under the caret, best first: at most PER_KIND per kind and MAX_ROWS in all. # lists filters, plus
 * "open inspector (>)" for a tool, MCP server or skill it names exactly (tools are not filters); > lists the rest; no sigil
 * lists every kind. Rows already picked as chips are left out. path: the current page, to leave out a project page
 * that is already open.
 */
export function suggest(term: Term, data: SuggestData, chips: readonly Chip[] = [], path = ""): Row[] {
  const picked = new Set(chips.map(c => c.kind + "\0" + c.value)), rows = projectPages(term, data, chips, path);
  const chosen = chips.findLast(c => c.kind === "project")?.value;
  // The generic Project row would open the same page as the chosen project's own row.
  const generic = !!chosen && !rows.some(r => r.project === chosen);
  for (const c of candidates(data, searchesSessions(term) && !!term.text.trim(), generic)) {
    const filter = isFilter(c.kind), subject = c.kind === "tool" || c.kind === "mcp" || c.kind === "skill";
    if (term.sigil === "#" && !filter && !subject) continue;
    if (term.sigil === ">" && filter) continue;
    if (picked.has(c.kind + "\0" + c.value)) continue;
    const m = bestMatch(term.text, c.texts);
    if (!m) continue;
    const offer = term.sigil === "#" && subject;
    if (offer && m.rank !== EXACT) continue;
    // Marks only when the shown text is the one that matched (an inspector offer starts with the name).
    const on = c.display ?? 0;
    rows.push({
      id: `${c.kind}:${c.value}`, kind: c.kind, value: c.value, label: c.label, sigil: filter ? "#" : ">",
      text: offer ? `${c.label} · open inspector (>)` : c.texts[on]!, ranges: m.on === on ? m.ranges : [], detail: c.detail ?? [],
      rank: m.rank, count: c.count ?? 0,
    });
  }
  rows.sort((a, b) => a.rank - b.rank || ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || byScore({ ...a, name: a.text }, { ...b, name: b.text }));
  const per = new Map<Kind, number>(), out: Row[] = [];
  for (const r of rows) {
    const n = per.get(r.kind) ?? 0;
    if (n >= PER_KIND) continue;
    per.set(r.kind, n + 1);
    out.push(r);
    if (out.length >= MAX_ROWS) break;
  }
  return out;
}

/**
 * The best matching projects' pages, for typed text with no sigil or after >: none for empty text, which would push the
 * pages out of their group. Bare text never matches exactly, so a typed name auto-chips as the filter. A project whose
 * page the chips already lead to is left out: picking it would change nothing.
 */
function projectPages(term: Term, data: SuggestData, chips: readonly Chip[], path: string): Row[] {
  if (term.sigil === "#" || !term.text) return [];
  const chosen = chips.findLast(c => c.kind === "project")?.value, setter = chips.findLast(c => c.kind === "page" || c.kind === "category");
  const open = setter ? setter.kind === "page" && setter.value === PROJECT_PAGE : path === PROJECT_PAGE;
  return (data.palette?.projects ?? []).flatMap(p => {
    const m = open && p.name === chosen ? null : match(term.text, p.name);
    return m ? [{ name: p.name, rank: term.sigil ? m.rank : Math.max(m.rank, PREFIX), count: p.sessions, ranges: m.ranges }] : [];
  }).sort(byScore).slice(0, MAX_PROJECT_PAGES).map((p): Row => ({
    id: `projectpage:${p.name}`, kind: "page", value: PROJECT_PAGE, label: "Project", project: p.name, sigil: ">",
    text: `${p.name} · open project page`, ranges: p.ranges, detail: [plural(p.count, "session")], rank: p.rank, count: p.count,
  }));
}

/** The option's accessible name: "Bash, tool, 3 calls, 33% failed". A project-page row's text already says "page". */
export const rowName = (r: Row) => [r.text, ...(r.project ? [] : [BADGES[r.kind].toLowerCase()]), ...r.detail].join(", ");
/** The palette payload has no tool calls at all for the view. */
export const noToolCalls = (p: PalettePayload | undefined) => !!p && !p.tools.length;
