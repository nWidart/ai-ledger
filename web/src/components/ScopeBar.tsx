import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { Popover } from "@base-ui/react/popover";
import { plural } from "../format";
import { usePathname, useSearchOf } from "../url";
import { BriefLink, Filters, useChangedFilters, type FilterSet, type ProjectList } from "./Filters";
import { ProjectDot } from "./ProjectDot";
import "./ScopeBar.css";

const ALL: FilterSet = { project: true, range: true, source: true, automated: true };
/** The shared filters a page shows: each only where it changes what the page shows. Activity, Cost, Context and the Project
 *  page show all four. A path that is no page (on its way to Activity) shows Activity's. */
export function scopeOf(path: string, judgments: boolean): FilterSet {
  switch (path) {
    case "/live": return { ...ALL, range: false }; // a running session has no range
    case "/limits": return { project: false, range: false, source: true, automated: false }; // per account; the range sits in Past windows
    case "/errors": return { ...ALL, automated: false }; // errors leave no automated session out
    case "/usage": return judgments ? { ...ALL, source: false } : ALL; // only Claude Code sessions are judged
    default: return ALL;
  }
}
// Activity's Judgments view, as ActivityPage picks it: asked for in the URL, and not for Codex alone (that shows Overview).
const judgedSearch = (raw: Readonly<Record<string, string>>) => raw.view === "judgments" && raw.source !== "codex";

// The current page's project list. The shell draws the bar before the page's data comes, so the page hands its list over
// once it has one, and takes it back when it leaves.
const NONE: ProjectList = [];
let projects = NONE;
const subs = new Set<() => void>();
const setProjects = (p: ProjectList) => { if (p !== projects) { projects = p; subs.forEach(f => f()); } };
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

/** Gives the scope bar's project picker this page's projects, busiest first, while the page is mounted. A page builds a new
 *  list on every render; the bar hears of it only when it holds other projects. */
export function useScopeProjects(list: ProjectList) {
  const key = JSON.stringify(list);
  useEffect(() => {
    setProjects(JSON.parse(key) as ProjectList);
    return () => setProjects(NONE);
  }, [key]);
}

/** Up to this width, the bar is one Filters button (ScopeBar.css keeps the same step). */
const NARROW = "(max-width: 56em)";
const watchNarrow = (f: () => void) => {
  const m = matchMedia(NARROW);
  m.addEventListener?.("change", f);
  return () => m.removeEventListener?.("change", f);
};
const useNarrow = () => useSyncExternalStore(watchNarrow, () => !!matchMedia(NARROW).matches);

/** The scope bar: the page-wide filters, directly under the navigation and sticky under it, the same place on every page. It
 *  shows only the filters that change the page, and no bar when none does. Narrow, it is one Filters button with the count
 *  of filters off their default, which opens them over the page. Its height is --scope-h, which scroll targets clear. */
export function ScopeBar() {
  const path = usePathname(), judgments = useSearchOf(judgedSearch), set = scopeOf(path, judgments);
  const list = useSyncExternalStore(subscribe, () => projects), narrow = useNarrow();
  const shown = set.project || set.range || set.source || set.automated;
  const bar = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = document.documentElement.style, el = bar.current;
    if (!el) return void root.setProperty("--scope-h", "0px");
    const measure = () => root.setProperty("--scope-h", el.offsetHeight + "px");
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => { ro.disconnect(); root.setProperty("--scope-h", "0px"); };
  }, [shown]);
  if (!shown) return null;
  return (
    <div className="scopebar" ref={bar}>
      <div className="scopebar-in">{narrow ? <FiltersButton set={set} projects={list} /> : <Filters projects={list} {...set} />}</div>
    </div>
  );
}

/** The narrow bar: one button, named with how many filters are set, opening the filters over the page. A disclosure: the
 *  filters keep their own roles. A filter change keeps the list open and focus on the control; Escape and a click outside
 *  close it and give focus back to the button. */
function FiltersButton({ set, projects }: { set: FilterSet; projects: ProjectList }) {
  const n = useChangedFilters(set), project = useSearchOf(raw => (set.project && raw.project) || "");
  return <>
    <Popover.Root>
      <Popover.Trigger className="scopebar-toggle" aria-label={n ? `Filters, ${plural(n, "filter")} set` : "Filters"}>
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M2.5 4h11M4.5 8h7M6.5 12h3" /></svg>
        Filters{n > 0 && <span className="scopebar-count" aria-hidden="true">{n}</span>}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className="scopebar-pos" side="bottom" align="start" sideOffset={6} collisionPadding={8}>
          <Popover.Popup className="scopebar-pop" aria-label="Filters"><Filters projects={projects} {...set} brief={false} /></Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
    {/* The picked project stays in sight with its Brief link: the row has the room, so the bar grows no taller. */}
    {project && <span className="scopebar-chip" title={project}><ProjectDot project={project} /><span>{project}</span></span>}
    {project && <BriefLink />}
  </>;
}
