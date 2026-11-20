import { useEffect, useState } from "react";
import { viewOf } from "../../api";
import { setOrder } from "../../colors";
import { Filters } from "../../components/Filters";
import { ProjectName } from "../../components/ProjectDot";
import { UsageSheets } from "../../components/sheets/UsageSheets";
import { useLanding } from "../../components/useLanding";
import { queries } from "../../queries";
import { formatSearch, useView } from "../../url";
import { useApi, type ApiState } from "../../useApi";
import { ActivityBlock, ContextBlock, CostBlock, ErrorsBlock, InsightsBlock, LimitsBlock, SessionsBlock, type Scope } from "./blocks";
import "./project.css";

/** The request's state with its last answer kept while a new view of the same project loads or fails, so a filter change keeps the
 *  figures on screen (dimmed by the block when it takes a while). A new project starts with none: figures of the project just left
 *  must never sit under another project's name. */
function useKept<T>(s: ApiState<T>, project: string): ApiState<T> {
  const [kept, setKept] = useState<{ project: string; data: T }>();
  if (s.data !== undefined && (s.data !== kept?.data || project !== kept.project)) setKept({ project, data: s.data });
  return s.data === undefined && kept && kept.project === project ? { ...s, data: kept.data } : s;
}

/** Project (/project?project=<name>): one project across the dashboards. Every block reads the payload of its own page with the
 *  project as the filter (no endpoint of its own), so its figures are that page's and the caches are shared; each loads, fails,
 *  retries and says it is empty on its own, and the heading, the filters and the blocks show at once, without waiting for any request.
 *  Two columns on a wide screen (Activity, Cost and Context; then Errors, Plan limits, Sessions and Session judgments), one on a
 *  narrow one. Without a project there is no page: the route sends it to Activity. */
export function ProjectPage() {
  const [h] = useView();
  const want = viewOf(h), project = h.project;
  // The six requests start together, here, so a cold visit does not wait for one block to start the next. A filter change keeps
  // each block's figures until the new ones come (useKept), as on the app's other pages, but only for the same project.
  const usage = useKept(useApi(project ? queries.usage(want) : null), project);
  const errors = useApi(project ? queries.errors : null);
  const context = useKept(useApi(project ? queries.context(want) : null), project);
  const insights = useKept(useApi(project ? queries.insights(want) : null), project);
  const limits = useKept(useApi(project ? queries.limits(want) : null), project);
  const live = useKept(useApi(project ? queries.liveList(want) : null), project);
  const d = usage.data;
  useEffect(() => { if (d) setOrder(d.project_order); }, [d]);
  // Busy, the dimmed look of a slow request, and the landing (bars growing, the fade) are each block's own (Block), so a request
  // leaves the blocks that do not read it alone. The page's landing is only for focus: after a failed usage request, its answer
  // takes focus to the heading. Its fade has no panels to find, as the page passes it no wrap.
  useLanding(d, project + "|" + h.range + "|" + h.source + "|" + h.auto, usage.loading, usage.error, ":scope .panel");
  const scope: Scope = { project, range: h.range, source: h.source, auto: h.auto,
    search: formatSearch({ project, range: String(h.range), source: h.source, auto: h.auto ? "1" : "" }) };
  // Only an answered usage request can say the project has no request in the view. The blocks still show below it: Context can have
  // a snapshot to measure from, and the other requests their own figures or failures.
  const idle = !!d && d.totals.requests === 0;
  // The picker lists the projects of any payload that came, so one failed request does not empty it.
  const projects = d?.projects ?? limits.data?.projects ?? insights.data?.projects ?? [];

  return (
    <main id="content" className="wrap pg-project">
      <header className="top sect" id="overview">
        <h1 className="lede" id="lede" tabIndex={-1}><ProjectName project={project} /></h1>
        <div className="top-side"><Filters projects={projects} automated /></div>
      </header>
      {idle && <p className="empty none" role="status">No use of {project} in this view. Pick a longer range, another source or include automated sessions.</p>}
      <div className="cols">
        <div className="col">
          <ActivityBlock usage={usage} live={live} scope={scope} />
          <CostBlock usage={usage} scope={scope} />
          <ContextBlock context={context} usage={usage} scope={scope} />
        </div>
        <div className="col">
          <ErrorsBlock errors={errors} scope={scope} />
          <LimitsBlock limits={limits} scope={scope} />
          <SessionsBlock usage={usage} scope={scope} />
          <InsightsBlock insights={insights} scope={scope} />
        </div>
      </div>
      <UsageSheets data={d} />
    </main>
  );
}
