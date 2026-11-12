import { useEffect, useRef, useState, type ReactNode } from "react";
import { Combobox } from "@base-ui/react/combobox";
import type { Source } from "../api";
import { RANGES, SOURCES, setHash, useHashState } from "../hash";
import { ProjectDot } from "./ProjectDot";
import "./Filters.css";

export interface ProjectOption { value: string; label?: string }
export interface FiltersProps {
  /** The picker's projects, busiest first. The hash's project is listed even when missing here (say an automated
   *  project while automated sessions are left out: naming it in the filter includes it). */
  projects: readonly (string | ProjectOption)[];
  /** Show "Include automated sessions" (Activity and Cost; Errors is never filtered). */
  automated?: boolean;
  /** The file that lists more automated projects, named in the toggle's hint. */
  autoFile?: string;
  /** Show the time range (Live has none: it keeps the range in the URL for the other pages). */
  range?: boolean;
  /** Page-only controls after the range (Errors: granularity, subagents, noise). */
  children?: ReactNode;
}

const rangeLabel = (r: number) => (r ? `${r}d` : "All");
export const SOURCE_LABELS: Record<Source, string> = { claude: "Claude Code", codex: "Codex" };
/** A view in words for banners and status lines: "atlas-api, Codex, last 30 days". */
export const viewName = (v: { project: string; range: number; source: Source | "" }) =>
  [v.project || "all projects", v.source && SOURCE_LABELS[v.source], v.range ? `last ${v.range} days` : "all time"].filter(Boolean).join(", ");
/** Who did the work, for page text: the selected agent, or "agent" for every source. */
export const agentName = (source: Source | "") => (source ? SOURCE_LABELS[source] : "agent");

/** Project picker with its color dot, range and source segments and the automated toggle, all writing the URL hash. */
export function Filters({ projects, automated = false, autoFile, range = true, children }: FiltersProps) {
  const [h, set] = useHashState();
  // An unknown source reads as All; the URL drops it so a copied link says what the page shows.
  const badSource = !!h.raw.source && !h.source;
  useEffect(() => { if (badSource) setHash({ source: null }, { push: false }); }, [badSource]);
  const opts = projects.map(p => (typeof p === "string" ? { value: p } : p));
  if (h.project && !opts.some(o => o.value === h.project)) opts.unshift({ value: h.project });
  return (
    <div className="filters" role="group" aria-label="Filters">
      <ProjectPicker project={h.project} options={opts} onPick={project => set({ project, session: null, inspect: null })} />
      {range && <div className="seg" id="fRange" role="group" aria-label="Time range">
        {RANGES.map(r => (
          <button key={r} type="button" aria-pressed={h.range === r} onClick={() => set({ range: r })}>{rangeLabel(r)}</button>
        ))}
      </div>}
      <div className="seg" id="fSource" role="group" aria-label="Source">
        {(["", ...SOURCES] as const).map(s => (
          <button key={s} type="button" aria-pressed={h.source === s} onClick={() => set({ source: s, session: null, inspect: null })}>{s ? SOURCE_LABELS[s] : "All"}</button>
        ))}
      </div>
      {children}
      {automated && (
        <label className="chk" title={"Sessions that tools start in the background, such as claude-mem's observer-sessions." + (autoFile ? ` Add more projects in ${autoFile}.` : "")}>
          <input type="checkbox" id="fAuto" checked={h.auto} onChange={e => set({ auto: e.target.checked })} />
          <span>Include automated <span className="long">sessions</span></span>
        </label>
      )}
    </div>
  );
}

const ALL: ProjectOption = { value: "", label: "All projects" };
const labelOf = (o: ProjectOption) => o.label ?? o.value;

/** One filterable dropdown: the field shows the selected project; typing lists the matches first, then "All projects". */
function ProjectPicker({ project, options, onPick }: { project: string; options: ProjectOption[]; onPick: (project: string) => void }) {
  const items = [ALL, ...options], selected = items.find(o => o.value === project) ?? ALL, name = labelOf(selected);
  // `typed` tells the user's text from the selected project's name, which lists everything.
  const [text, setText] = useState(name), [typed, setTyped] = useState(false), [seen, setSeen] = useState(name);
  if (seen !== name) { setSeen(name); setText(name); setTyped(false); } // the hash changed: show its project
  const needle = text.trim().toLowerCase(), hits = typed && needle ? options.filter(o => labelOf(o).toLowerCase().includes(needle)) : null;
  // The name in the field stays selected until the user types, so typing replaces it.
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!typed && document.activeElement === field.current) field.current?.select(); }, [typed, text]);
  return (
    <Combobox.Root items={hits ? [...hits, ALL] : items} filter={null} autoHighlight={!!hits?.length} value={selected} inputValue={text}
      itemToStringLabel={labelOf} isItemEqualToValue={(a, b) => a.value === b.value}
      onValueChange={o => o && onPick(o.value)}
      onInputValueChange={(v, d) => { const t = d.reason === "input-change"; setTyped(t); setText(t ? v : name); }}
      onOpenChange={open => { if (!open) { setText(name); setTyped(false); } }}>
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
