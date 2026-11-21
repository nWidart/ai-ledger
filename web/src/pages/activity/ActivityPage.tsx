import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { usageUrl, viewOf, type SessionSort, type Span, type Totals, type UsagePayload, type View } from "../../api";
import { setOrder } from "../../colors";
import { motion, useCountUp } from "../../components/chart";
import { agentName, viewName } from "../../components/Filters";
import { useScopeProjects } from "../../components/ScopeBar";
import { InsightCard, type Insight, type InsightItem } from "../../components/InsightCard";
import { ProjectDot } from "../../components/ProjectDot";
import type { SortBy } from "../../components/Sort";
import { appLink, errorsHref } from "../../components/sheets/session";
import { Vs } from "../../components/sheets/ToolSheet";
import { DocsLink } from "../../components/DocsLink";
import { PageSkeleton } from "../../components/PageSkeleton";
import { useLanding } from "../../components/useLanding";
import { dayLabel, dur, num, pct, plural } from "../../format";
import { judged, setSearch, usePathname, useSearchOf, useView } from "../../url";
import { noFacets } from "../../components/facets";
import { queries } from "../../queries";
import { useApi } from "../../useApi";
import { Judgments } from "./judgments/Judgments";
import { SessionsPanel, type SessFilter } from "./SessionsPanel";
import { NO_JUDGMENTS_KEYS, validateSearch, type ActivitySearch, type WorkTab } from "./search";
import { ViewSwitch } from "./ViewSwitch";
import { ExtTables, LoopsList, PROJECT_SORT, ProjectsTable, TestsList, ToolsTable, type ProjectKey, type ToolKey } from "./tables";
import { firstWorkDay, flakyTools, reaches, shortTool, spanDays, type WorkMetric } from "./work";
import { CHART_ID, WorkPanel, type WorkPick } from "./WorkChart";
import { panelId, Workbench } from "./Workbench";
import "./activity.css";

const METRIC_KEY = "claude-activity-metric";
const loadMetric = (): WorkMetric => { try { const v = localStorage.getItem(METRIC_KEY); return v === "prompts" || v === "sessions" ? v : "commits"; } catch { return "commits"; } };

/** The chart's selection in the query string: a day (day=), or a week by its Monday (week=); none for the range. */
interface Selection { day: string; days: Span }
const selectionOf = (s: ActivitySearch): Selection | null => (s.day ? { day: s.day, days: 1 } : s.week ? { day: s.week, days: 7 } : null);
/** The sessions table's limits, kept in the query string (q, near=1) with the selection, so a reload or a shared link restores them. */
const sessOf = (s: ActivitySearch, sel: Selection | null): SessFilter => ({ q: s.q ?? "", near: s.near ?? false, day: sel?.day ?? "", days: sel?.days ?? 1 });
// Replace, not push: typing a search adds no Back entries.
const setSess = (f: Pick<SessFilter, "q" | "near">) => setSearch({ q: f.q, near: f.near }, { push: false });
const setTab = (t: WorkTab) => setSearch({ tab: t === "sessions" ? null : t }, { push: false });

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

/** The heading answers "what got done?": commits from prompts, two figures; sessions and active days are the Sessions vital's.
 *  No cost here; that is Cost's. */
function Lede({ d, before }: { d: UsagePayload; before: UsagePayload | undefined }) {
  const t = d.totals, p = d.previous, commits = useCountUp(t.commits, before?.totals.commits);
  const where = d.project ? <> <span className="unit">on <span className="proj"><ProjectDot project={d.project} />{d.project}</span></span></> : null;
  const since = d.range ? "" : ` since ${dayLabel(firstWorkDay(d) ?? d.end, true)}`;
  return <h1 className="lede" id="lede" aria-live="polite" tabIndex={-1}>{t.requests
    ? <><span className="amt">{plural(commits, "commit")}</span> <span className="unit">from {plural(t.prompts, "prompt")}</span>{where}{since}
      <span className="chg"><Vs cur={t.commits} prev={p?.commits} fmt={n => plural(n, "commit")} /></span></>
    : <>No {agentName(d.source)} activity{where} {d.range ? `in the last ${d.range} days` : "yet"}.</>}</h1>;
}

/** a / b, or null when there is nothing to divide by (a previous period with no calls, say). */
const ratio = (a: number, b: number) => (b ? a / b : null);
const tokS = (n: number) => `${num(n)} tok/s`;

/** Under the lede: how often the user stopped the agent, and how much it did per prompt. */
function Interrupted({ d }: { d: UsagePayload }) {
  const t = d.totals, p = d.previous;
  return <p className="sub" id="interrupted">{pct(t.interruption_rate, 1)} of prompts interrupted ({num(t.interrupted)} of {num(t.prompts)})<Vs cur={t.interruption_rate} prev={p && ratio(p.interrupted, p.prompts)}
    fmt={n => pct(n, 1)} worse="up" />; {num(t.turns_per_prompt, 1)} turns and {num(t.tool_calls_per_prompt, 1)} tool calls per prompt.</p>;
}

/** The time note of the Output speed vital: the model and tool time. Grok records model time and no tool time, so with Grok
 *  sessions in the view the tool time is that of the Claude Code sessions alone, or there is none. */
const timeNote = (t: Totals): string => {
  const model = dur(t.model_ms / 1000), n = plural(t.timed_sessions, "session");
  if (t.tool_ms == null) return `${model} waiting on the model, in ${n}, which record no tool time.`;
  if (t.session_sources.includes("grok")) return `${model} waiting on the model, in ${n}, and ${dur(t.tool_ms / 1000)} running tools in the Claude Code ones.`;
  return `${model} waiting on the model and ${dur(t.tool_ms / 1000)} running tools, in ${n}.`;
};
/** The Sessions vital's time: the median session, the active time in all and the thinking, when recorded. Thinking stands
 *  apart from Output speed: a view can record thinking but no model time. */
const sessionTime = (t: Totals): string =>
  `median session ${dur(t.median_session_seconds)}, ${dur(t.session_seconds)} active in all${t.thinking_ms ? `, ${dur(t.thinking_ms / 1000)} thinking` : ""}.`;

/** Output speed per chart bucket as a small line; none with fewer than two points. Hidden from assistive technology: the
 *  vital says the figure and its change. */
export function SpeedSpark({ trend }: { trend: UsagePayload["speed_trend"] }) {
  if (trend.length < 2) return null;
  const W = 72, H = 18, max = Math.max(...trend.map(r => r.output_per_s)), min = Math.min(...trend.map(r => r.output_per_s));
  const y = (v: number) => H - 2 - (max > min ? (v - min) / (max - min) : .5) * (H - 4);
  const pts = trend.map((r, i) => `${(i / (trend.length - 1) * W).toFixed(1)},${y(r.output_per_s).toFixed(1)}`).join(" ");
  return <svg className="spark" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
    <polyline points={pts} fill="none" stroke="var(--series-1)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}

/** Where a vital leads: a tab (a button), or a page (a link). */
type Dest = { run: () => void } | { href: string };
interface Vital { v: string; l: string; n: ReactNode; cur: number | null; prev?: number | null; worse?: "up" | "down"; fmt: (n: number) => string; to: Dest; extra?: ReactNode }

/** Work vitals: how smoothly the work went, each against the period before (none for All, or with nothing to divide by there),
 *  and each a way to the place that explains it. */
function Vitals({ d, go }: { d: UsagePayload; go: { sessions: () => void; tests: () => void; subagents: () => void; speed: () => void } }) {
  const t = d.totals, p = d.previous;
  // A view whose sessions are all Codex ones has no model time to divide by: Codex transcripts do not record it.
  const codexOnly = d.source === "codex" || (t.session_sources.length > 0 && t.session_sources.every(s => s === "codex"));
  const errors = errorsHref(d.project, d.range, undefined, { source: d.source });
  const vs: Vital[] = [
    { v: num(t.sessions), l: "Sessions", cur: t.sessions, prev: p?.sessions, fmt: n => plural(n, "session"), to: { run: go.sessions },
      n: <>{plural(t.active_days, "active day")}<Vs cur={t.active_days} prev={p?.active_days} fmt={n => plural(n, "active day")} />
        {!d.project && d.by_project.length > 1 ? `, across ${plural(d.by_project.length, "project")}` : ""}; {sessionTime(t)}</> },
    { v: num(t.errors_per_100_calls, 1), l: "Errors per 100 calls", n: `${num(t.errors)} failed of ${plural(t.calls, "tool call")}.`, to: { href: errors },
      cur: t.errors_per_100_calls, prev: p && ratio(100 * p.errors, p.calls), worse: "up", fmt: n => num(n, 1) },
    { v: t.test_runs ? pct(t.tests_passed / t.test_runs) : "n/a", l: "Test runs passed", to: { run: go.tests },
      n: t.test_runs ? `${num(t.tests_passed)} passed, ${num(t.tests_failed)} failed of ${plural(t.test_runs, "test or build run")}.` : "No test or build runs in this range.",
      cur: ratio(t.tests_passed, t.test_runs), prev: p && ratio(p.tests_passed, p.test_runs), worse: "down", fmt: pct },
    { v: pct(t.subagent_token_share), l: "Subagents", n: "of tokens came from subagents.", to: { run: go.subagents },
      cur: t.subagent_token_share, prev: p && ratio(p.sub_tokens, p.tokens), fmt: pct },
  ];
  // Whole-session output over model time, timed sessions only (Claude Code records it; Codex does not: a note instead).
  if (!codexOnly) vs.push({ v: t.output_per_s == null ? "n/a" : tokS(t.output_per_s), l: "Output speed", to: { run: go.speed },
    n: t.output_per_s == null ? "No session in this view records model time." : timeNote(t), extra: <SpeedSpark trend={d.speed_trend} />,
    cur: t.output_per_s, prev: p?.output_per_s, worse: "down", fmt: tokS });
  return <section className="vitals-wrap sect" id="vitals" aria-label="Work health">
    <div className="vitals" style={{ ["--n" as string]: vs.length }}>
      {vs.map(x => {
        const body = <><div className="v">{x.v}{x.extra}</div><div className="l">{x.l}<Vs cur={x.cur} prev={x.prev} fmt={x.fmt} worse={x.worse} /></div><div className="d">{x.n}</div></>;
        return "href" in x.to
          ? <a key={x.l} className="vital" href={x.to.href} onClick={appLink}>{body}</a>
          : <button key={x.l} type="button" className="vital" onClick={x.to.run}>{body}</button>;
      })}
    </div>
    {codexOnly && <p className="vitals-note">Output speed: Codex transcripts record no model time.</p>}
  </section>;
}

/** Activity (/usage): two views of the same sessions, picked by the view switch and kept in the URL. Overview is what the
 *  coding agents did and where they struggled, measured; Judgments (view=judgments) is how /insights judged them. A view of one
 *  agent other than Claude Code has no judgments, so it always shows Overview, with the switch saying why. */
export function ActivityPage() {
  const [h] = useView(), inUrl = useSearchOf(validateSearch, s => s.view === "judgments");
  // The URL changes before the route does. While the app leaves Activity for another page, whose URL names no view, the view
  // stays the one shown: leaving Judgments must not draw Overview for a moment, and start its request only to abandon it.
  // Kept as state set while rendering: the usual way to hold the last value of something derived.
  const here = usePathname() === "/usage", [last, setLast] = useState(inUrl);
  if (here && last !== inUrl) setLast(inUrl);
  const asked = here ? inUrl : last, unjudged = h.source && !judged(h.source) ? noFacets(h.source) : undefined;
  const judgments = asked && !unjudged;
  // A link to the judgments of such a source opens Overview: the URL drops the view, so a copied link says what the page shows.
  useEffect(() => { if (here && asked && unjudged) setSearch({ view: null, ...NO_JUDGMENTS_KEYS }, { push: false }); }, [here, asked, unjudged]);
  const views = <ViewSwitch view={judgments ? "judgments" : "overview"} unjudged={unjudged} />;
  return judgments ? <Judgments views={views} /> : <Overview views={views} />;
}

/** Activity's Overview: what the coding agents did (all of them, or the one the source filter picks) and where they struggled.
 *  views: the page's view switch, drawn over the heading. */
function Overview({ views }: { views: ReactNode }) {
  const [h] = useView();
  const search = useSearchOf(validateSearch);
  const want: View = viewOf(h), url = usageUrl(want), viewKey = url;
  const { data, error, loading, previous, retry } = useApi(queries.usage(want), { keepPrevious: true });
  useEffect(() => { if (data) setOrder(data.project_order); }, [data]);
  useScopeProjects(data?.projects ?? []);

  // Page-only state: flaky tools first resets when the view changes; the sorts stay.
  const sel = selectionOf(search), sess = sessOf(search, sel), tab: WorkTab = search.tab ?? "sessions";
  const [flaky, setFlaky] = useState(false), [toolSort, setToolSort] = useState<SortBy<ToolKey> | null>(null);
  const [sessSort, setSessSort] = useState<SortBy<SessionSort> | null>(null), [projSort, setProjSort] = useState<SortBy<ProjectKey>>(PROJECT_SORT);
  const [metric, setMetricState] = useState<WorkMetric>(loadMetric);
  const setMetric = (m: WorkMetric) => { setMetricState(m); try { localStorage.setItem(METRIC_KEY, m); } catch { /* storage off */ } };
  const lastView = useRef(viewKey);
  useEffect(() => {
    if (lastView.current === viewKey) return;
    lastView.current = viewKey;
    setFlaky(false);
  }, [viewKey]);
  // A selected day or week narrows every tab to its days; the lede, attention, chart and vitals stay range-wide.
  const dayApi = useApi(sel ? queries.day(want, sel.day, sel.days) : null), dv = sel ? dayApi.data : undefined;
  // The payload on screen is the previous view's while a new view loads: the chart then takes no pick, which would write
  // that view's day or week into the new one.
  const d = data, current = !!d && !previous;
  // A week in the URL that the view does not reach is dropped, once the view's own figures are in.
  useEffect(() => {
    if (d && current && search.week && !reaches(search.week, d)) setSearch({ week: null }, { push: false });
  }, [current, search.week, d]);

  // Opening a tab from elsewhere (a vital, an attention action) brings it into view and moves the focus into it: to the
  // element named, or the panel. Done once the tab's panel is drawn, then forgotten, so a later tab change moves nothing.
  // Every such action reports the range, so it clears the selection: the tab then shows the figures it was opened for.
  const [goal, setGoal] = useState<{ tab: WorkTab; to: string } | null>(null);
  const go = (t: WorkTab, to = panelId(t), patch: Record<string, string | true | null> = {}) => {
    setSearch({ tab: t === "sessions" ? null : t, day: null, week: null, ...patch }, { push: false });
    setGoal({ tab: t, to });
  };
  useLayoutEffect(() => {
    if (!goal || goal.tab !== tab) return;
    const el = document.getElementById(goal.to) ?? document.getElementById(panelId(tab));
    el?.scrollIntoView?.({ behavior: motion() ? "smooth" : "auto", block: "start" });
    el?.focus({ preventScroll: true });
    setGoal(null);
  }, [goal, tab]);

  const { slow, grow, before, wrap, retryBtn } = useLanding(data, url, loading, error, ":scope > :is(.insights, .panel, .vitals-wrap, .workbench)");
  // The attention actions and the vitals show the table in the order they promise.
  const acts = {
    loops: () => go("loops", "loops-h"),
    near: () => { setSessSort(null); go("sessions", undefined, { q: null, near: true }); },
    flaky: () => { setFlaky(true); setToolSort(null); go("tools"); },
    tests: () => go("loops", "tests-h"),
  };
  const toVital = {
    sessions: () => go("sessions"),
    tests: () => go("loops", "tests-h"),
    subagents: () => { setProjSort({ key: "subagent_share", desc: true }); go("projects"); },
    speed: () => { setSessSort({ key: "output_per_s", desc: true }); go("sessions"); },
  };
  // A pick lists the bucket's sessions as such: the search, the near-limit filter and the sort go. Only the current view's
  // chart takes one.
  const pick = (p: WorkPick) => {
    setSearch({ q: null, near: null, ...(p.week ? { week: p.day, day: null } : { day: p.day, week: null }) }, { push: false });
    setSessSort(null);
  };
  const clear = () => setSearch({ day: null, week: null }, { push: false });
  // The panel's own clear removes its button: the focus goes to the chart, as the chip's does.
  const clearToChart = () => { clear(); document.getElementById(CHART_ID)?.focus(); };
  const has = !!d && d.totals.requests > 0;
  // The days a selection counts, as the server clips them: a week the view cuts short names the days it keeps.
  const [from, to] = sel && d ? spanDays(sel, d) : ["", ""];
  const named = !from ? "" : from === to ? dayLabel(from, true) : `${dayLabel(from)} – ${dayLabel(to, true)}`;
  // What a narrowed tab says: the days it shows, or that it still shows the range while they load or failed to.
  const on = sel && dv ? (from === to ? `on ${named}` : `from ${dayLabel(from)} to ${dayLabel(to, true)}`) : "in this range";
  const note = sel ? <div className="hint scope">{dv || tab === "sessions" ? `${named} only. ` : dayApi.error ? `Could not load ${named} (${dayApi.error.message}); showing the whole range. `
    : `Loading ${named}…; showing the whole range. `}<button type="button" className="linkish" onClick={clearToChart}>Show the whole range</button></div> : undefined;
  // The first load shows the placeholder; the loading look (dimmed figures) belongs to a page that has figures.
  const first = !d && !error;
  const cls = "wrap pg-activity" + (slow && !first ? " loading" : "") + (grow ? " grow" : "");

  return (
    <main id="content" className={cls} ref={wrap} aria-busy={loading || undefined}>
      {/* Drawn through every state, so a switch made while this view's first request is pending keeps its focus. */}
      {views}
      {first ? <PageSkeleton title="Loading activity…" /> : <>
        <header className="top sect" id="overview">
          <div>{d ? <Lede d={d} before={before} /> : <h1 className="lede" id="lede" tabIndex={-1}>Activity could not be loaded.</h1>}
            {d && has && <Interrupted d={d} />}</div>
        </header>
      </>}
      {error && <div className="banner" role="alert"><b>Could not load {viewName(want)} ({error.message}).{d ? ` Still showing ${viewName(d)}.` : ""}</b>{" "}
        <button type="button" className="linkish" ref={retryBtn} onClick={retry}>Retry</button>{" "}<DocsLink docs="reference/troubleshooting">Troubleshooting</DocsLink></div>}
      <p className="pending">{loading && d ? `Loading ${viewName(want)}…` : ""}</p>
      {d && <>
        {has && <section className="insights sect" id="attention" aria-label="What needs attention"><InsightCard insight={attentionInsight(d, acts)} primary /></section>}
        <WorkPanel d={d} metric={metric} onMetric={setMetric} selected={sel && { day: sel.day, week: sel.days === 7 }} onPick={current ? pick : undefined} onClear={clear} />
        {has && <Vitals d={d} go={toVital} />}
        <Workbench tab={tab} onTab={setTab} note={note}>
          {tab === "sessions" && <SessionsPanel view={{ project: d.project, range: d.range, automated: d.automated, source: d.source }} filter={sess} onFilter={setSess}
            sort={sessSort} onSort={setSessSort} selected={h.session} />}
          {tab === "projects" && <ProjectsTable rows={(dv ?? d).by_project} selected={d.project} sort={projSort} onSort={setProjSort} on={on} />}
          {tab === "tools" && <>
            <ToolsTable tools={(dv ?? d).tools} flaky={flaky} sort={toolSort} onSort={setToolSort} on={on} />
            <ExtTables mcp={(dv ?? d).mcp} skills={(dv ?? d).skills} hooks={(dv ?? d).hooks} on={on} />
          </>}
          {tab === "loops" && <div className="loops-tests">
            <LoopsList loops={(dv ?? d).error_loops} total={dv ? dv.error_loops_total : d.totals.error_loops} range={d.range} on={on} />
            <TestsList tests={(dv ?? d).failed_tests} total={dv ? dv.tests_failed : d.totals.tests_failed} range={d.range} on={on} />
          </div>}
        </Workbench>
      </>}
    </main>
  );
}
