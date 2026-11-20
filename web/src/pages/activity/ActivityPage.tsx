import { useEffect, useRef, useState } from "react";
import { usageUrl, viewOf, type SessionSort, type Totals, type UsagePayload, type View } from "../../api";
import { setOrder } from "../../colors";
import { useCountUp } from "../../components/chart";
import { openDrawer } from "../../components/Drawer";
import { agentName, Filters, viewName } from "../../components/Filters";
import { InsightCard, type Insight, type InsightItem } from "../../components/InsightCard";
import { ProjectDot } from "../../components/ProjectDot";
import { SectionIndex } from "../../components/SectionIndex";
import type { SortBy } from "../../components/Sort";
import { Vs } from "../../components/sheets/ToolSheet";
import { UsageSheets } from "../../components/sheets/UsageSheets";
import { PageSkeleton } from "../../components/PageSkeleton";
import { useLanding } from "../../components/useLanding";
import { dayLabel, dur, num, pct, plural } from "../../format";
import { setSearch, useSearchOf, useView } from "../../url";
import { queries } from "../../queries";
import { useApi } from "../../useApi";
import { SessionsDrawer, type SessFilter } from "./SessionsDrawer";
import { validateSearch, type ActivitySearch } from "./search";
import { ExtDrawer, LoopsDrawer, ProjectsDrawer, TestsDrawer, ToolsDrawer, type RowScope, type ToolKey } from "./tables";
import { firstWorkDay, flakyTools, shortTool, type WorkMetric } from "./work";
import { WorkPanel } from "./WorkChart";
import "./activity.css";

const METRIC_KEY = "claude-activity-metric";
const loadMetric = (): WorkMetric => { try { const v = localStorage.getItem(METRIC_KEY); return v === "prompts" || v === "sessions" ? v : "commits"; } catch { return "commits"; } };

/** The sessions table's limits, kept in the query string (day, q, near=1) so a reload or a shared link restores them. */
const sessOf = (s: ActivitySearch): SessFilter => ({ q: s.q ?? "", near: s.near ?? false, day: s.day ?? "" });
// Replace, not push: typing a search adds no Back entries.
const setSess = (f: SessFilter) => setSearch({ q: f.q, near: f.near, day: f.day }, { push: false });

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
  const t = d.totals, p = d.previous, commits = useCountUp(t.commits, before?.totals.commits);
  const where = d.project ? <> <span className="unit">on <span className="proj"><ProjectDot project={d.project} />{d.project}</span></span></> : null;
  const since = d.range ? "" : ` since ${dayLabel(firstWorkDay(d) ?? d.end, true)}`;
  return <>
    <h1 className="lede" id="lede" aria-live="polite" tabIndex={-1}>{t.requests
      ? <><span className="amt">{plural(commits, "commit")}</span> <span className="unit">from {plural(t.prompts, "prompt")}</span>{where}{since}
        <span className="chg"><Vs cur={t.commits} prev={p?.commits} fmt={n => plural(n, "commit")} /></span>
        <span className="sr">, </span><span className="delta">in {plural(t.sessions, "session")}{!d.project && d.by_project.length > 1 ? ` across ${plural(d.by_project.length, "project")}` : ""}<Vs cur={t.sessions} prev={p?.sessions} fmt={n => plural(n, "session")} />, {plural(t.active_days, "active day")}<Vs cur={t.active_days} prev={p?.active_days} fmt={n => plural(n, "active day")} /></span></>
      : <>No {agentName(d.source)} activity{where} {d.range ? `in the last ${d.range} days` : "yet"}.</>}</h1>
    {t.requests > 0 && <p className="sub">{num(t.turns_per_prompt, 1)} turns and {num(t.tool_calls_per_prompt, 1)} tool calls per prompt. {plural(t.interrupted, "prompt")} interrupted.</p>}
  </>;
}

/** a / b, or null when there is nothing to divide by (a previous period with no calls, say). */
const ratio = (a: number, b: number) => (b ? a / b : null);
const tokS = (n: number) => `${num(n)} tok/s`;

/** The "Median session" note: the active time, then the thinking and the model and tool time when recorded. */
function sessionNote(t: Totals): string {
  const thinking = t.thinking_ms ? ` and ${dur(t.thinking_ms / 1000)} thinking` : "";
  const timed = t.timed_sessions ? `; ${dur(t.model_ms / 1000)} waiting on the model and ${dur(t.tool_ms / 1000)} running tools` : "";
  return `${plural(t.sessions, "session")}, ${dur(t.session_seconds)} active${thinking} in all${timed}.`;
}

/** Work vitals: how smoothly the work went, each against the period before (none for All, or with nothing to divide by there). */
function Vitals({ d }: { d: UsagePayload }) {
  const t = d.totals, p = d.previous;
  // cur and prev are the same figure of this and the previous period; worse: the way a move reads as bad.
  const vs: { v: string; l: string; n: string; id?: string; cur: number | null; prev?: number | null; worse?: "up" | "down"; fmt: (n: number) => string }[] = [
    { v: num(t.errors_per_100_calls, 1), l: "Errors per 100 calls", n: `${num(t.errors)} failed of ${plural(t.calls, "tool call")}.`,
      cur: t.errors_per_100_calls, prev: p && ratio(100 * p.errors, p.calls), worse: "up", fmt: n => num(n, 1) },
    { v: t.test_runs ? pct(t.tests_passed / t.test_runs) : "n/a", l: "Test runs passed", id: "v-tests",
      n: t.test_runs ? `${num(t.tests_passed)} passed, ${num(t.tests_failed)} failed of ${plural(t.test_runs, "test or build run")}.` : "No test or build runs in this range.",
      cur: ratio(t.tests_passed, t.test_runs), prev: p && ratio(p.tests_passed, p.test_runs), worse: "down", fmt: pct },
    { v: pct(t.interruption_rate, 1), l: "Prompts interrupted", n: `${num(t.interrupted)} of ${plural(t.prompts, "prompt")}.`,
      cur: t.interruption_rate, prev: p && ratio(p.interrupted, p.prompts), worse: "up", fmt: n => pct(n, 1) },
    { v: pct(t.subagent_token_share), l: "Subagents", n: "of tokens came from subagents.",
      cur: t.subagent_token_share, prev: p && ratio(p.sub_tokens, p.tokens), fmt: pct },
    { v: dur(t.median_session_seconds), l: "Median session",
      n: sessionNote(t),
      cur: t.median_session_seconds, prev: p?.median_session_seconds, fmt: dur },
    // Whole-session output over model time, timed sessions only (Claude Code records it; Codex does not).
    { v: t.output_per_s == null ? "n/a" : tokS(t.output_per_s), l: "Output speed",
      n: t.output_per_s == null ? "No session in this view records model time." : `Output tokens per second of model time, in ${plural(t.timed_sessions, "session")}.`,
      cur: t.output_per_s, prev: p?.output_per_s, worse: "down", fmt: tokS },
  ];
  return <section className="vitals sect" id="vitals" aria-label="Work health">
    {vs.map(x => <div className="vital" key={x.l} id={x.id} tabIndex={x.id ? -1 : undefined}><div className="v">{x.v}</div>
      <div className="l">{x.l}<Vs cur={x.cur} prev={x.prev} fmt={x.fmt} worse={x.worse} /></div><div className="d">{x.n}</div></div>)}
  </section>;
}

/** Activity (/usage): what the coding agents did (all of them, or the one the source filter picks) and where they struggled. */
export function ActivityPage() {
  const [h] = useView();
  const search = useSearchOf(validateSearch);
  const want: View = viewOf(h), url = usageUrl(want), viewKey = url;
  const { data, error, loading, retry } = useApi(queries.usage(want), { keepPrevious: true });
  useEffect(() => { if (data) setOrder(data.project_order); }, [data]);

  // Page-only state: flaky tools first resets when the view changes; the tools and sessions sorts stay.
  const sess = sessOf(search), [flaky, setFlaky] = useState(false), [toolSort, setToolSort] = useState<SortBy<ToolKey> | null>(null);
  const [sessSort, setSessSort] = useState<SortBy<SessionSort> | null>(null);
  const [metric, setMetricState] = useState<WorkMetric>(loadMetric);
  const setMetric = (m: WorkMetric) => { setMetricState(m); try { localStorage.setItem(METRIC_KEY, m); } catch { /* storage off */ } };
  const lastView = useRef(viewKey);
  useEffect(() => {
    if (lastView.current === viewKey) return;
    lastView.current = viewKey;
    setFlaky(false);
  }, [viewKey]);
  // A selected day narrows tools, MCP & hooks and error loops to it; the rest stays range-wide.
  const day = sess.day, dayApi = useApi(day ? queries.day(want, day) : null), dv = day ? dayApi.data : undefined;

  const { slow, grow, before, wrap, retryBtn } = useLanding(data, url, loading, error, ":scope > :is(.insights, .panel, .vitals, .drawers)");

  // The attention and chart actions show the table in the order they promise.
  const sessionsFor = (f: SessFilter) => { setSess(f); setSessSort(null); openDrawer("d-sessions", true); };
  const showDay = (day: string) => sessionsFor({ q: "", near: false, day });
  const acts = {
    loops: () => openDrawer("d-loops", true),
    near: () => sessionsFor({ q: "", near: true, day: "" }),
    flaky: () => { setFlaky(true); setToolSort(null); openDrawer("d-tools", true); },
    tests: () => openDrawer("d-tests", true),
  };
  const scope: RowScope | undefined = day ? {
    on: dv ? `on ${dayLabel(day, true)}` : "in this range",
    note: <div className="hint">{dv ? `${dayLabel(day, true)} only. ` : dayApi.error ? `Could not load ${dayLabel(day, true)} (${dayApi.error.message}); showing the whole range. `
      : `Loading ${dayLabel(day, true)}…; showing the whole range. `}<button type="button" className="linkish" onClick={() => setSess({ ...sess, day: "" })}>Show the whole range</button></div>,
  } : undefined;
  const d = data, has = !!d && d.totals.requests > 0;
  // The first load shows the placeholder; the loading look (dimmed figures) belongs to a page that has figures.
  const first = !d && !error;
  const cls = "wrap pg-activity" + (slow && !first ? " loading" : "") + (grow ? " grow" : "");

  return (
    <main id="content" className={cls} ref={wrap} aria-busy={loading || undefined}>
      {first ? <PageSkeleton title="Loading activity…" /> : <header className="top sect" id="overview">
        <div>{d ? <Lede d={d} before={before} /> : <h1 className="lede" id="lede" tabIndex={-1}>Activity could not be loaded.</h1>}</div>
        <div className="top-side"><Filters projects={d?.projects ?? []} automated autoFile={d?.automated_file.path} /></div>
      </header>}
      {error && <div className="banner" role="alert"><b>Could not load {viewName(want)} ({error.message}).{d ? ` Still showing ${viewName(d)}.` : ""}</b>{" "}
        <button type="button" className="linkish" ref={retryBtn} onClick={retry}>Retry</button></div>}
      {d?.automated_file.error && <div className="banner" role="alert"><b>Automated projects file ignored:</b> <code>{d.automated_file.path}</code> could not be used
        ({d.automated_file.error}). The file is ignored until it is fixed; only the built-in detection applies.</div>}
      <p className="pending">{loading && d ? `Loading ${viewName(want)}…` : ""}</p>
      {d && <>
        <SectionIndex groups={[
          [{ id: "overview", label: "Overview" }, { id: "attention", label: "Attention", hidden: !has }, { id: "vitals", label: "Health", long: "Work health", hidden: !has },
            { id: "work", label: "Work", long: "Work per day" }, { id: "hours", label: "Hours", long: "Prompts by hour" }],
          [{ id: "d-sessions", label: "Sessions" }, { id: "d-projects", label: "Projects", long: "Project metrics" }, { id: "d-tools", label: "Tools" },
            { id: "d-ext", label: "MCP & hooks", long: "MCP & hooks" }, { id: "d-loops", label: "Loops", long: "Error loops" }, { id: "d-tests", label: "Tests", long: "Failed test runs" }],
        ]} />
        {has && <section className="insights sect" id="attention" aria-label="What needs attention"><InsightCard insight={attentionInsight(d, acts)} primary /></section>}
        {has && <Vitals d={d} />}
        <WorkPanel d={d} metric={metric} onMetric={setMetric} onDay={showDay} />
        <div className="drawers">
          <SessionsDrawer view={{ project: d.project, range: d.range, automated: d.automated, source: d.source }} count={d.totals.sessions} filter={sess} onFilter={setSess} sort={sessSort} onSort={setSessSort}
            selected={h.session} />
          <ProjectsDrawer rows={d.by_project} selected={d.project} />
          <ToolsDrawer tools={(dv ?? d).tools} flaky={flaky} sort={toolSort} onSort={setToolSort} scope={scope} />
          <ExtDrawer mcp={(dv ?? d).mcp} skills={(dv ?? d).skills} hooks={(dv ?? d).hooks} scope={scope} />
          <LoopsDrawer loops={(dv ?? d).error_loops} total={dv ? dv.error_loops_total : d.totals.error_loops} range={d.range} scope={scope} />
          <TestsDrawer tests={d.failed_tests} total={d.totals.tests_failed} range={d.range} />
        </div>
      </>}
      <UsageSheets data={d} />
    </main>
  );
}
