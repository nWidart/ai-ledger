// Window grids: the Project page's grid of a typical session, as small multiples for the view's busiest projects, or the one full
// grid (split by the project's /context snapshot, when there is one) with a project selected.
import type { ContextPayload } from "../../api";
import { HowMeasured } from "../../components/HowMeasured";
import { ProjectName } from "../../components/ProjectDot";
import { num, plural } from "../../format";
import { ContextGrid, GridDefs } from "../project/ContextGrid";
import { contextGrid, typicalGrid, type ContextGridModel } from "../project/project";

type D = ContextPayload;
/** The most projects drawn as small multiples. */
export const GRID_PROJECTS = 6;

/** The projects with a grid (a known start and peak share of the window), most sessions first, at most GRID_PROJECTS, and how many
 *  projects have one in all. */
export function projectGrids(d: D): { grids: { project: string | null; model: ContextGridModel }[]; total: number } {
  const peaks = new Map(d.growth.peak.by_project.map(p => [p.project, p]));
  const all = d.starting.by_project.flatMap(s => {
    const p = peaks.get(s.project);
    const model = p ? typicalGrid({ start: s.median, startShare: s.window_share, peak: p.median, peakShare: p.window_share, window: s.window,
      sessions: Math.max(s.sessions, p.sessions) }) : null;
    return model ? [{ project: s.project, model, sessions: s.sessions }] : [];
  }).sort((a, b) => b.sessions - a.sessions);
  return { grids: all.slice(0, GRID_PROJECTS).map(({ project, model }) => ({ project, model })), total: all.length };
}

export function Grids({ d }: { d: D }) {
  const one = !!d.project;
  const { grids, total } = projectGrids(d);
  const single = one ? contextGrid(d) : null;
  if (one ? !single && !d.overhead : !grids.length) return null;
  return (
    <section className="panel sect" id="grids" aria-labelledby="gridsTitle">
      <h2 id="gridsTitle">Window of a typical session</h2>
      <div className="hint">{one ? "The median start, what the median peak adds, and the free space, in cells of half a percent of the window."
        : total > grids.length ? `The ${num(grids.length)} projects with the most sessions, of ${plural(total, "project")} with a known window.`
          : "Per project, most sessions first: the median start, the median peak and the free space."}
        <HowMeasured what="window grids">Each cell is half a percent of the project's most common window. The start is the median share of the window the
          first turn takes; the peak is the median share at the session's fullest. Sessions with no known window take no part.</HowMeasured></div>
      {one ? <ContextGrid model={single} snapshot={d.overhead} />
        : <div className="grid-multiples"><GridDefs />
          {grids.map(g => <ContextGrid key={g.project ?? ""} model={g.model}
            compact={{ title: g.project == null ? <span className="muted">(no project)</span> : <ProjectName project={g.project}>{g.project}</ProjectName>, name: g.project ?? "(no project)" }} />)}
        </div>}
    </section>
  );
}
