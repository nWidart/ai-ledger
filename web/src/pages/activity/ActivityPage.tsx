import { useEffect, useMemo, useRef, useState } from "react";
import { usageUrl, viewOf, type UsagePayload, type View } from "../../api";
import { setOrder } from "../../colors";
import { motion, useCountUp } from "../../components/chart";
import { openDrawer } from "../../components/Drawer";
import { agentName, Filters, viewName } from "../../components/Filters";
import { InsightCard, type Insight, type InsightItem } from "../../components/InsightCard";
import { ProjectDot } from "../../components/ProjectDot";
import { SectionIndex } from "../../components/SectionIndex";
import { UsageSheets } from "../../components/sheets/UsageSheets";
import { useLanding } from "../../components/useLanding";
import { dayLabel, dur, num, pct, plural } from "../../format";
import { useHashState } from "../../hash";
import { useApi } from "../../useApi";
import { NO_FILTER, SessionsDrawer, type SessFilter } from "./SessionsDrawer";
import { ExtDrawer, LoopsDrawer, ProjectsDrawer, ToolsDrawer } from "./tables";
import { firstWorkDay, flakyTools, shortTool, workDays, type WorkMetric } from "./work";
import { WorkChart } from "./WorkChart";
import "./activity.css";

const METRIC_KEY = "claude-activity-metric";
const loadMetric = (): WorkMetric => { try { const v = localStorage.getItem(METRIC_KEY); return v === "prompts" || v === "sessions" ? v : "commits"; } catch { return "commits"; } };

/** Ways to act on what needs attention: each opens the detail that explains it. */
export interface AttentionActs { loops: () => void; near: () => void; flaky: () => void; tests: () => void }
/** Needs attention: error loops, sessions near the context limit, flaky tools and failed test runs, or that there are none. */
export function attentionInsight(d: UsagePayload, go: AttentionActs): Insight {
  const t = d.totals, items: InsightItem[] = [];
  if (t.error_loops) items.push({ crit: true, body: <><b>{plural(t.error_loops, "error loop")}</b>: a tool failed 3+ times in a row.</>, act: { label: "See loops", run: go.loops } });
  if (d.near_limit.length) items.push({ body: <><b>{plural(d.near_limit.length, "session")}</b> reached 80%+ of the context window.</>,
    act: { label: d.near_limit.length === 1 ? "See it" : "See them", run: go.near } });
  const flaky = flakyTools(d.tools), worst = flaky.slice().sort((a, b) => (b.failure_rate ?? 0) - (a.failure_rate ?? 0))[0];
  if (worst) items.push({ body: <><b>{plural(flaky.length, "tool")}</b> fail over 10% of calls, worst <span title={worst.tool}>{shortTool(worst.tool)}</span> ({pct(worst.failure_rate)}).</>,
    act: { label: "See tools", run: go.flaky } });
  if (t.tests_failed) items.push({ body: <><b>{plural(t.tests_failed, "failed test run")}</b> of {num(t.test_runs)}.</>, act: { label: "See tests", run: go.tests } });
  return { sev: items.some(i => i.crit) ? "critical" : items.length ? "warn" : "good", k: "Needs attention", items,
    t: items.length ? plural(items.length, "thing") + " to look at" : "Nothing needs attention",
    b: items.length ? "" : "No error loops, sessions near the context limit, flaky tools or failed tests in this range." };
}

/** The heading answers "what got done?": commits from prompts, then sessions and active days. No cost here; that is Cost's. */
function Lede({ d, before }: { d: UsagePayload; before: UsagePayload | undefined }) {
  const t = d.totals, commits = useCountUp(t.commits, before?.totals.commits);
  const where = d.project ? <> <span className="unit">on <span className="proj"><ProjectDot project={d.project} />{d.project}</span></span></> : null;
  const since = d.range ? "" : ` since ${dayLabel(firstWorkDay(d) ?? d.end, true)}`;
  return <>
    <h1 className="lede" id="lede" aria-live="polite" tabIndex={-1}>{t.requests
      ? <><span className="amt">{plural(commits, "commit")}</span> <span className="unit">from {plural(t.prompts, "prompt")}</span>{where}{since}
        <span className="sr">, </span><span className="delta">in {plural(t.sessions, "session")}{!d.project && d.by_project.length > 1 ? ` across ${plural(d.by_project.length, "project")}` : ""}, {plural(t.active_days, "active day")}</span></>
      : <>No {agentName(d.source)} activity{where} {d.range ? `in the last ${d.range} days` : "yet"}.</>}</h1>
    {t.requests > 0 && <p className="sub">{num(t.turns_per_prompt, 1)} turns and {num(t.tool_calls_per_prompt, 1)} tool calls per prompt. {plural(t.interrupted, "prompt")} interrupted.</p>}
  </>;
}

/** Work vitals: how smoothly the work went. */
function Vitals({ d }: { d: UsagePayload }) {
  const t = d.totals;
  const vs: [string, string, string, string?][] = [
    [num(t.errors_per_100_calls, 1), "Errors per 100 calls", `${num(t.errors)} failed of ${plural(t.calls, "tool call")}.`],
    [t.test_runs ? pct(t.tests_passed / t.test_runs) : "n/a", "Test runs passed", t.test_runs ? `${num(t.tests_passed)} passed, ${num(t.tests_failed)} failed of ${plural(t.test_runs, "test or build run")}.` : "No test or build runs in this range.", "v-tests"],
    [pct(t.interruption_rate, 1), "Prompts interrupted", `${num(t.interrupted)} of ${plural(t.prompts, "prompt")}.`],
    [pct(t.subagent_token_share), "Subagents", "of tokens came from subagents."],
    [dur(t.median_session_seconds), "Median session", `${plural(t.sessions, "session")}, ${dur(t.session_seconds)} active${t.thinking_ms ? ` and ${dur(t.thinking_ms / 1000)} thinking` : ""} in all.`],
  ];
  return <section className="vitals sect" id="vitals" aria-label="Work health">
    {vs.map(([v, l, n, id]) => <div className="vital" key={l} id={id} tabIndex={id ? -1 : undefined}><div className="v">{v}</div><div className="l">{l}</div><div className="d">{n}</div></div>)}
  </section>;
}

/** Activity (/usage): what the coding agents did (all of them, or the one the source filter picks) and where they struggled. */
export function ActivityPage() {
  const [h] = useHashState();
  const want: View = viewOf(h), url = usageUrl(want), viewKey = url;
  const { data, error, loading, retry } = useApi<UsagePayload>(url, { keepPrevious: true });
  useEffect(() => { if (data) setOrder(data.project_order); }, [data]);

  // Page-only state, reset when the view changes: the sessions table's limits and the tools sort.
  const [sess, setSess] = useState<SessFilter>(NO_FILTER), [flaky, setFlaky] = useState(false);
  const [metric, setMetricState] = useState<WorkMetric>(loadMetric);
  const setMetric = (m: WorkMetric) => { setMetricState(m); try { localStorage.setItem(METRIC_KEY, m); } catch { /* storage off */ } };
  const lastView = useRef(viewKey);
  useEffect(() => {
    if (lastView.current === viewKey) return;
    lastView.current = viewKey;
    setSess(s => ({ ...s, day: "" })); setFlaky(false);
  }, [viewKey]);

  const { slow, grow, before, wrap, retryBtn } = useLanding(data, loading, error, ":scope > :is(.insights, .panel, .vitals, .drawers)");

  const days = useMemo(() => (data ? workDays(data) : []), [data]);
  const sessionsFor = (f: SessFilter) => { setSess(f); openDrawer("d-sessions", true); };
  const showDay = (day: string) => sessionsFor({ q: "", near: false, day });
  const acts = {
    loops: () => openDrawer("d-loops", true),
    near: () => sessionsFor({ q: "", near: true, day: "" }),
    flaky: () => { setFlaky(true); openDrawer("d-tools", true); },
    tests: () => {
      const el = document.getElementById("v-tests");
      el?.scrollIntoView?.({ behavior: motion() ? "smooth" : "auto", block: "center" });
      el?.focus({ preventScroll: true });
    },
  };
  const d = data, has = !!d && d.totals.requests > 0;
  const cls = "wrap pg-activity" + (slow ? " loading" : "") + (grow ? " grow" : "");

  return (
    <div className={cls} ref={wrap} aria-busy={loading || undefined}>
      <header className="top sect" id="overview">
        <div>{d ? <Lede d={d} before={before} /> : <h1 className="lede" id="lede" tabIndex={-1} aria-live="polite">{error ? "Activity could not be loaded." : "Loading activity…"}</h1>}</div>
        <div className="top-side"><Filters projects={d?.projects ?? []} automated /></div>
      </header>
      {error && <div className="banner" role="alert"><b>Could not load {viewName(want)} ({error.message}).{d ? ` Still showing ${viewName(d)}.` : ""}</b>{" "}
        <button type="button" className="linkish" ref={retryBtn} onClick={retry}>Retry</button></div>}
      <p className="pending" role="status">{loading && d ? `Loading ${viewName(want)}…` : ""}</p>
      {d && <>
        <SectionIndex groups={[
          [{ id: "overview", label: "Overview" }, { id: "attention", label: "Attention", hidden: !has }, { id: "vitals", label: "Health", long: "Work health", hidden: !has },
            { id: "work", label: "Work", long: "Work per day" }],
          [{ id: "d-sessions", label: "Sessions" }, { id: "d-projects", label: "Projects", long: "Project metrics" }, { id: "d-tools", label: "Tools" },
            { id: "d-ext", label: "MCP & hooks", long: "MCP & hooks" }, { id: "d-loops", label: "Loops", long: "Error loops" }],
        ]} />
        {has && <section className="insights sect" id="attention" aria-label="What needs attention"><InsightCard insight={attentionInsight(d, acts)} primary /></section>}
        {has && <Vitals d={d} />}
        <WorkChart days={days} metric={metric} onMetric={setMetric} onDay={showDay} />
        <div className="drawers">
          <SessionsDrawer view={{ project: d.project, range: d.range, automated: d.automated, source: d.source }} count={d.totals.sessions} filter={sess} onFilter={setSess}
            selected={h.session} usage={d} />
          <ProjectsDrawer rows={d.by_project} selected={d.project} />
          <ToolsDrawer tools={d.tools} flaky={flaky} />
          <ExtDrawer mcp={d.mcp} skills={d.skills} hooks={d.hooks} />
          <LoopsDrawer loops={d.error_loops} total={d.totals.error_loops} range={d.range} />
        </div>
      </>}
      <UsageSheets data={d} />
    </div>
  );
}
