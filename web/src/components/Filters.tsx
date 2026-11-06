import type { ReactNode } from "react";
import { RANGES, useHashState } from "../hash";
import { ProjectDot } from "./ProjectDot";
import "./Filters.css";

export interface ProjectOption { value: string; label?: string }
export interface FiltersProps {
  /** The picker's projects, busiest first. The hash's project is listed even when missing here (say an automated
   *  project while automated sessions are left out: naming it in the filter includes it). */
  projects: readonly (string | ProjectOption)[];
  /** Show "Include automated sessions" (Activity and Cost; Errors is never filtered). */
  automated?: boolean;
  /** Page-only controls after the range (Errors: granularity, subagents, noise). */
  children?: ReactNode;
}

const rangeLabel = (r: number) => (r ? `${r}d` : "All");

/** Project picker with its color dot, range segments and the automated toggle, all writing the URL hash. */
export function Filters({ projects, automated = false, children }: FiltersProps) {
  const [h, set] = useHashState();
  const opts = projects.map(p => (typeof p === "string" ? { value: p } : p));
  if (h.project && !opts.some(o => o.value === h.project)) opts.unshift({ value: h.project });
  return (
    <div className="filters" role="group" aria-label="Filters">
      <span className={"pick-project" + (h.project ? "" : " all")} id="fProjectWrap">
        <ProjectDot project={h.project} />
        <select id="fProject" aria-label="Project" value={h.project} onChange={e => set({ project: e.target.value, session: null, inspect: null })}>
          <option value="">All projects</option>
          {opts.map(o => <option key={o.value} value={o.value}>{o.label ?? o.value}</option>)}
        </select>
      </span>
      <div className="seg" id="fRange" role="group" aria-label="Time range">
        {RANGES.map(r => (
          <button key={r} type="button" aria-pressed={h.range === r} onClick={() => set({ range: r })}>{rangeLabel(r)}</button>
        ))}
      </div>
      {children}
      {automated && (
        <label className="chk" title="Sessions that tools start in the background, such as claude-mem's observer-sessions">
          <input type="checkbox" id="fAuto" checked={h.auto} onChange={e => set({ auto: e.target.checked })} />
          <span>Include automated <span className="long">sessions</span></span>
        </label>
      )}
    </div>
  );
}
