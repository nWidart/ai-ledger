import { useEffect } from "react";
import { viewOf } from "../../api";
import { setOrder } from "../../colors";
import { Filters } from "../../components/Filters";
import { ProjectName } from "../../components/ProjectDot";
import { PageSkeleton } from "../../components/PageSkeleton";
import { UsageSheets } from "../../components/sheets/UsageSheets";
import { useLanding } from "../../components/useLanding";
import { queries } from "../../queries";
import { formatSearch, useView } from "../../url";
import { useApi } from "../../useApi";
import { ContextBlock, CostBlock, ErrorsBlock, InsightsBlock, LimitsBlock, SessionsBlock, SummaryBlock, type Scope } from "./blocks";
import "./project.css";

/** Project (/project?project=<name>): one project across the dashboards. Every block reads the payload of its own page with the
 *  project as the filter (no endpoint of its own), so its figures are that page's and the caches are shared; each draws, fails
 *  and retries on its own. Without a project there is no page: the route sends it to Activity. */
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
  const { slow, grow, wrap } = useLanding(d, project + "|" + h.range + "|" + h.source + "|" + h.auto, usage.loading, usage.error, ":scope > .panel");
  const scope: Scope = { project, range: h.range, source: h.source, auto: h.auto,
    search: formatSearch({ project, range: String(h.range), source: h.source, auto: h.auto ? "1" : "" }) };
  // The first load shows the placeholder; a project with no request in the view says so and has no blocks.
  const first = !d && !usage.error, idle = !!d && d.totals.requests === 0;
  const cls = "wrap pg-project" + (slow && !first ? " loading" : "") + (grow ? " grow" : "");

  return (
    <main id="content" className={cls} ref={wrap} aria-busy={usage.loading || undefined}>
      {first ? <PageSkeleton title={`Loading ${project}…`} /> : <header className="top sect" id="overview">
        <h1 className="lede" id="lede" tabIndex={-1}><ProjectName project={project} /></h1>
        <div className="top-side"><Filters projects={d?.projects ?? []} automated autoFile={d?.automated_file.path} /></div>
      </header>}
      {first ? null : idle ? <p className="empty none" role="status">No use of {project} in this view. Pick a longer range, another source or include automated sessions.</p> : <>
        <SummaryBlock usage={usage} live={live} scope={scope} />
        <CostBlock usage={usage} scope={scope} />
        <SessionsBlock usage={usage} scope={scope} />
        <ErrorsBlock errors={errors} scope={scope} />
        <ContextBlock context={context} usage={usage} scope={scope} />
        <InsightsBlock insights={insights} scope={scope} />
        <LimitsBlock limits={limits} scope={scope} />
      </>}
      <UsageSheets data={d} />
    </main>
  );
}
