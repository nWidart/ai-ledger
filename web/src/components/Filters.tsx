import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { Link } from "@tanstack/react-router";
import type { Source } from "../api";
import { DEFAULT_RANGE, RANGES, SOURCES, navigate, parseSearch, rootState, setSearch, sharedSearch, usePathname, useSearchOf, validateRoot } from "../url";
import { ProjectDot } from "./ProjectDot";
import { useLastStatus } from "./refresh";
import { Toggletip } from "./Toggletip";
import "./Filters.css";

export interface ProjectOption { value: string; label?: string }
/** The project list a picker offers, busiest first. */
export type ProjectList = readonly (string | ProjectOption)[];
/** Which of the shared filters a page shows: each only where it changes what the page shows (ScopeBar's scopeOf). A filter
 *  left out keeps its URL value for the other pages, and is never written. */
export interface FilterSet {
  /** The project picker (Limits has none: limits are per account). */
  project: boolean;
  /** The time range (Live has none; Limits shows RangeFilter in the section the range applies to). */
  range: boolean;
  /** The source (Activity's Judgments view has none: only Claude Code sessions are judged). */
  source: boolean;
  /** "Include automated sessions" (Errors is never filtered). Its hint names the automated projects file, from the app's status. */
  automated: boolean;
}
export interface FiltersProps extends Partial<FilterSet> {
  /** The picker's projects. The URL's project is listed even when missing here (say an automated project while automated
   *  sessions are left out: naming it in the filter includes it). */
  projects: ProjectList;
  /** End with the Brief link (BriefLink) when a project is picked; the narrow scope bar draws it beside its button instead. */
  brief?: boolean;
}

const rangeLabel = (r: number) => (r ? `${r}d` : "All");
export const SOURCE_LABELS: Record<Source, string> = { claude: "Claude Code", codex: "Codex" };
/** A view in words for banners and status lines: "atlas-api, Codex, last 30 days". */
export const viewName = (v: { project: string; range: number; source: Source | "" }) =>
  [v.project || "all projects", v.source && SOURCE_LABELS[v.source], v.range ? `last ${v.range} days` : "all time"].filter(Boolean).join(", ");
/** Who did the work, for page text: the selected agent, or "agent" for every source. */
export const agentName = (source: Source | "") => (source ? SOURCE_LABELS[source] : "agent");

// What the filters show of the URL; a session or sheet key is not in it, so opening a sheet does not render them.
// badSource: the URL names a source that is not valid. shared: the shared query string the Project page link carries.
const filterSearch = (raw: Readonly<Record<string, string>>) => {
  const s = validateRoot(raw), { project, range, source, auto } = rootState(s);
  return { project, range, source, auto, badSource: !!raw.source && !s.source, shared: sharedSearch(raw) };
};

/** The time range segment, writing the URL: in Filters, or alone where a page's range applies to one section. */
export function RangeFilter() {
  const { range } = useSearchOf(filterSearch);
  return <div className="seg" id="fRange" role="group" aria-label="Time range">
    {RANGES.map(r => (
      <button key={r} type="button" aria-pressed={range === r} onClick={() => setSearch({ range: r })}>{rangeLabel(r)}</button>
    ))}
  </div>;
}

/** How many of the filters a page shows are off their default: the narrow scope bar's count. */
export const useChangedFilters = (set: FilterSet): number => useSearchOf(raw => {
  const { project, range, source, auto } = rootState(validateRoot(raw));
  return [set.project && !!project, set.range && range !== DEFAULT_RANGE, set.source && !!source, set.automated && auto].filter(Boolean).length;
});

/** Project picker with its color dot and clear button, range and source segments, the automated toggle, all writing the URL,
 *  then the Brief link to the project's page. */
export function Filters({ projects, automated = false, project = true, range = true, source = true, brief = true }: FiltersProps) {
  const h = useSearchOf(filterSearch), { badSource } = h, set = setSearch;
  const autoFile = useLastStatus()?.automated_file?.path;
  // An unknown source reads as All; the URL drops it so a copied link says what the page shows.
  useEffect(() => { if (badSource) setSearch({ source: null }, { push: false }); }, [badSource]);
  const opts = projects.map(p => (typeof p === "string" ? { value: p } : p));
  if (h.project && !opts.some(o => o.value === h.project)) opts.unshift({ value: h.project });
  // On the Project page, a view with no project opens Activity in its place (router.tsx, needProject).
  const clear = () => {
    setSearch({ project: null, session: null });
    document.getElementById("fProject")?.focus();
  };
  return (
    <div className="filters" role="group" aria-label="Filters">
      {project && <span className="filters-project">
        <ProjectPicker project={h.project} options={opts} onPick={project => set({ project, session: null, inspect: null })} />
        {h.project && <button type="button" className="filters-clear" aria-label="Clear project filter" title="Show all projects" onClick={clear}>✕</button>}
      </span>}
      {range && <RangeFilter />}
      {source && <div className="seg" id="fSource" role="group" aria-label="Source">
        {(["", ...SOURCES] as const).map(s => (
          <button key={s} type="button" aria-pressed={h.source === s} onClick={() => set({ source: s, session: null, inspect: null })}>{s ? SOURCE_LABELS[s] : "All"}</button>
        ))}
      </div>}
      {automated && <span className="filters-auto">
        <label className="chk">
          <input type="checkbox" id="fAuto" checked={h.auto} onChange={e => set({ auto: e.target.checked })} />
          <span>Include automated <span className="long">sessions</span></span>
        </label>
        <Toggletip term="automated sessions">{"Sessions that tools start in the background, such as claude-mem's observer-sessions." + (autoFile ? ` Add more projects in ${autoFile}.` : "")}</Toggletip>
      </span>}
      {project && brief && <BriefLink />}
    </div>
  );
}

/** Brief: with a project picked, the link to its Project page with the same view; none on the Project page itself. */
export function BriefLink() {
  const { project, shared } = useSearchOf(filterSearch), path = usePathname();
  if (!project || path === "/project") return null;
  // A plain click goes through navigate (url.ts holds the app's rules for a page switch); Link skips its own navigation
  // when the event is default-prevented. A modified click is the browser's.
  const go = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate("/project" + shared);
  };
  // The visible text is "Brief"; the name starts with it and says whose page it opens.
  return (
    <Link to="/project" search={parseSearch(shared) as never} className="filters-brief" aria-label={`Brief, ${project} project page`} onClick={go}>
      Brief<span aria-hidden="true">→</span>
    </Link>
  );
}

const ALL: ProjectOption = { value: "", label: "All projects" };
const labelOf = (o: ProjectOption) => o.label ?? o.value;

/** One filterable dropdown: the field shows the selected project; typing lists the matches first, then "All projects". */
function ProjectPicker({ project, options, onPick }: { project: string; options: ProjectOption[]; onPick: (project: string) => void }) {
  const items = [ALL, ...options], selected = items.find(o => o.value === project) ?? ALL, name = labelOf(selected);
  // `typed` tells the user's text from the selected project's name, which lists everything.
  const [text, setText] = useState(name), [typed, setTyped] = useState(false), [seen, setSeen] = useState(name), [open, setOpen] = useState(false);
  if (seen !== name) { setSeen(name); setText(name); setTyped(false); } // the URL changed: show its project
  const needle = text.trim().toLowerCase(), hits = typed && needle ? options.filter(o => labelOf(o).toLowerCase().includes(needle)) : null;
  // The name in the field stays selected until the user types, so typing replaces it.
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!typed && document.activeElement === field.current) field.current?.select(); }, [typed, text]);
  return (
    <Combobox.Root items={hits ? [...hits, ALL] : items} filter={null} autoHighlight={!!hits?.length} value={selected} inputValue={text}
      itemToStringLabel={labelOf} isItemEqualToValue={(a, b) => a.value === b.value}
      onValueChange={o => o && onPick(o.value)}
      // Emptying the field is typing too (Base UI then reports "input-clear" and leaves the popup closed): list everything.
      onInputValueChange={(v, d) => { const t = d.reason === "input-change" || d.reason === "input-clear"; setTyped(t); setText(t ? v : name); if (t) setOpen(true); }}
      open={open} onOpenChange={o => { setOpen(o); if (!o) { setText(name); setTyped(false); } }}>
      <span className={"pick-project" + (project ? "" : " all")} id="fProjectWrap">
        <ProjectDot project={project} />
        <Combobox.Input id="fProject" aria-label="Project" className="pick-field" ref={field} onFocus={e => e.currentTarget.select()}
          // A click would put the caret in the selected name (Chromium does it after mouseup): keep the name selected.
          onMouseUp={e => { if (!typed) e.preventDefault(); }} onClick={e => { if (!typed) e.currentTarget.select(); }} />
        <span className="pick-chev" aria-hidden="true" />
      </span>
      <Combobox.Portal>
        <Combobox.Positioner className="pick-pos" sideOffset={4} align="start">
          <Combobox.Popup className="pick-pop">
            <Combobox.List>
              {(o: ProjectOption) => <Combobox.Item key={o.value} value={o} className="pick-opt">{labelOf(o)}</Combobox.Item>}
            </Combobox.List>
            {hits && !hits.length && <div className="pick-none muted small" role="status">No project matches</div>}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
