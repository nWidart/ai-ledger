import { useEffect } from "react";
import { viewOf } from "../../api";
import { setOrder } from "../../colors";
import { Filters } from "../../components/Filters";
import { ProjectName } from "../../components/ProjectDot";
import { UsageSheets } from "../../components/sheets/UsageSheets";
import { useLanding } from "../../components/useLanding";
import { queries } from "../../queries";
import { formatSearch, useView } from "../../url";
import { useApi } from "../../useApi";
import { ActivityBlock, ContextBlock, CostBlock, ErrorsBlock, InsightsBlock, LimitsBlock, SessionsBlock, type Scope } from "./blocks";
import "./project.css";

/** Project (/project?project=<name>): one project across the dashboards. Every block reads the payload of its own page with the
 *  project as the filter (no endpoint of its own), so its figures are that page's and the caches are shared; each loads, fails,
 *  retries and says it is empty on its own, and the heading, the filters and the blocks show at once, without waiting for any request.
 *  Two columns on a wide screen (Activity, Cost and Context; then Errors, Plan limits, Sessions and Session judgments), one on a
 *  narrow one. Without a project there is no page: the route sends it to Activity. */
export function ProjectPage() {
  const [h] = useView();
  const want = viewOf(h), project = h.project;
  // The six requests start together, here, so a cold visit does not wait for one block to start the next. No keepPrevious: figures
  // of the project just left must never sit under another project's name.
  const usage = useApi(project ? queries.usage(want) : null);
  const errors = useApi(project ? queries.errors : null);
  const context = useApi(project ? queries.context(want) : null);
  const insights = useApi(project ? queries.insights(want) : null);
  const limits = useApi(project ? queries.limits(want) : null);
  const live = useApi(project ? queries.liveList(want) : null);
  const d = usage.data;
  useEffect(() => { if (d) setOrder(d.project_order); }, [d]);
  const { slow, grow, wrap } = useLanding(d, project + "|" + h.range + "|" + h.source + "|" + h.auto, usage.loading, usage.error, ":scope .panel");
  const scope: Scope = { project, range: h.range, source: h.source, auto: h.auto,
    search: formatSearch({ project, range: String(h.range), source: h.source, auto: h.auto ? "1" : "" }) };
  // Only an answered usage request can say the project has no request in the view; until then, or when it failed, the blocks show.
  const idle = !!d && d.totals.requests === 0;
  // The picker lists the projects of any payload that came, so one failed request does not empty it.
  const projects = d?.projects ?? limits.data?.projects ?? insights.data?.projects ?? [];
  const cls = "wrap pg-project" + (slow && d ? " loading" : "") + (grow ? " grow" : "");

  return (
    <main id="content" className={cls} ref={wrap} aria-busy={usage.loading || undefined}>
      <header className="top sect" id="overview">
        <h1 className="lede" id="lede" tabIndex={-1}><ProjectName project={project} /></h1>
        <div className="top-side"><Filters projects={projects} automated autoFile={d?.automated_file.path} /></div>
      </header>
      {idle ? <p className="empty none" role="status">No use of {project} in this view. Pick a longer range, another source or include automated sessions.</p> : <div className="cols">
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
      </div>}
      <UsageSheets data={d} />
    </main>
  );
}
