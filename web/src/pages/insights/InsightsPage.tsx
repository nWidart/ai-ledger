import { Fragment, useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { insightsUrl, viewOf, type FacetTally, type InsightSession, type InsightsPayload, type View } from "../../api";
import { Drawer } from "../../components/Drawer";
import { Judged, label, outcomeLabel, outcomeTone } from "../../components/facets";
import { Filters, viewName } from "../../components/Filters";
import { Ledger, LedgerRow } from "../../components/Ledger";
import { ProjectName } from "../../components/ProjectDot";
import { jumpTo, SectionIndex } from "../../components/SectionIndex";
import { sessName, shortId } from "../../components/sheets/session";
import { useLanding } from "../../components/useLanding";
import { dayLabel, num, pct, plural, when } from "../../format";
import { formatHash, navigate, setHash, useHashState } from "../../hash";
import { useApi } from "../../useApi";
import { DRILL_KEYS, drillsOf, passes, pickProps, toggleDrill, type DrillKind } from "./drill";
import { countOf, headline } from "./insights";
import "./insights.css";

// Session-type strip colors, in the payload's fixed order; unknown types share the last.
const TYPE_COLORS = ["var(--proj-2)", "var(--proj-4)", "var(--proj-5)", "var(--proj-1)", "var(--proj-other)"];

/** A category name with spaces, its raw name in the title. */
const Cat = ({ name }: { name: string }) => <span title={name}>{label(name)}</span>;

/** Session href on Activity, in view v's project, range, source and automated toggle; without a view, all time, so an old
 *  session is inside the range. */
export const sessionHref = (id: string, v?: View) => "/usage" + formatHash({ project: v?.project ?? "", range: String(v?.range ?? 0),
  source: v?.source ?? "", auto: v?.automated ? "1" : "", session: id });
// Ledgers with free-form names (goals, friction, satisfaction) show this many rows until asked for all.
const TOP = 12;
// Sessions listed until asked for all.
const SESSIONS_TOP = 25;

function Coverage({ d, view, drawer }: { d: InsightsPayload; view: View; drawer: boolean }) {
  const c = d.coverage;
  if (view.source === "codex") return null;
  const newest = <>{c.newest_facet && <> The newest analysis was written <b className="when">{when(c.newest_facet)}</b>.</>}
    {drawer && <> Coverage <button type="button" className="linkish" onClick={() => jumpTo("d-coverage")}>by project and run</button>.</>}</>;
  return <>
    {c.not_analysed > 0 && <p className="cov" role="status" id="coverage">
      <b>{num(c.analysed)} of {plural(c.claude_sessions, "Claude Code session")}</b> in this view analysed ({pct(c.analysed / c.claude_sessions)}).
      Each <code>/insights</code> run in Claude Code analyses more.{newest}</p>}
    {c.not_analysed === 0 && c.analysed > 0 && <p className="cov" id="coverage">Every Claude Code session in this view with a transcript is analysed.{newest}</p>}
    {view.source === "" && c.codex_sessions > 0 && <p className="cov">{plural(c.codex_sessions, "Codex session")} in this view {c.codex_sessions === 1 ? "is" : "are"} not
      analysed: <code>/insights</code> covers Claude Code only.</p>}
  </>;
}

function Lede({ d, view }: { d: InsightsPayload; view: View }) {
  const c = d.coverage;
  if (view.source === "codex") return <p className="lede" id="lede" tabIndex={-1}><code>/insights</code> analyses only Claude Code sessions.</p>;
  if (!c.stored_facets) return <p className="lede" id="lede" tabIndex={-1}>No <code>/insights</code> data found.</p>;
  if (!c.facets) return <p className="lede" id="lede" tabIndex={-1}>No analysed sessions in this view.</p>;
  const h = headline(d);
  return <p className="lede" id="lede" tabIndex={-1} aria-live="polite"><b>{num(h.full)} of {num(h.n)}</b> analysed sessions fully achieved their
    goal; {h.top ? <><b><Cat name={h.top} /></b> caused the most friction.</> : <>no friction reported.</>}</p>;
}

function Sub({ d, view }: { d: InsightsPayload; view: View }) {
  const c = d.coverage;
  if (view.source === "codex") return <p className="sub">{viewName(view)}. Codex writes no facets: {plural(c.codex_sessions, "Codex session")} in this view,
    none analysed. Pick Claude Code or All to see the judgments.</p>;
  if (!c.stored_facets) return <p className="sub">The app reads <code>{c.dir ?? "~/.claude/usage-data"}</code>. Run <code>/insights</code> in Claude Code,
    then Refresh.</p>;
  return <p className="sub">{viewName(view)}. Every figure on this page comes from <code>/insights</code> facets: a model's reading of each session,
    not a measurement. Codex sessions have no facets. A session counts here by its start time; Activity counts a session with a request in the range, so the two totals can differ slightly.</p>;
}

function Vitals({ d }: { d: InsightsPayload }) {
  const c = d.coverage, n = c.facets, full = countOf(d.outcomes, "fully_achieved"), mostly = countOf(d.outcomes, "mostly_achieved");
  const partly = countOf(d.outcomes, "partially_achieved"), not = countOf(d.outcomes, "not_achieved");
  const dis = d.satisfaction.find(s => s.name === "dissatisfied")?.sessions ?? 0;
  const unclear = n - full - mostly - partly - not; // unclear_from_transcript, or an outcome this page does not know
  return (
    <section className="vitals sect" id="vitals" aria-label="Outcomes at a glance">
      <div className="vital"><div className="v">{num(n)}</div><div className="l">Sessions analysed</div>
        <div className="d">{num(c.analysed)} of {num(c.claude_sessions)} stored Claude Code sessions{c.orphans > 0 && `, ${num(c.orphans)} without transcript`}
          {unclear > 0 && `; ${num(unclear)} with no clear outcome`}</div></div>
      <div className="vital good"><div className="v">{num(full + mostly)} <small>{pct((full + mostly) / n)}</small></div><div className="l">Fully or mostly achieved</div>
        <div className="d">{num(full)} fully, {num(mostly)} mostly</div></div>
      <div className="vital"><div className="v">{num(partly)}</div><div className="l">Partially</div><div className="d">some of the goal met</div></div>
      <div className="vital bad"><div className="v">{num(not)}</div><div className="l">Not achieved</div><div className="d">goal abandoned or failed</div></div>
      <div className="vital bad"><div className="v">{num(dis)}</div><div className="l">Dissatisfied</div><div className="d">sessions where the user pushed back</div></div>
    </section>
  );
}

const sessionsSide = (r: FacetTally) => plural(r.sessions, "session");

/** A ledger of the first TOP rows, with a control to show them all. */
function TopLedger<T>({ rows, empty, noun, row }: { rows: T[]; empty: string; noun: string; row: (r: T) => ReactNode }) {
  const [all, setAll] = useState(false);
  return <>
    <Ledger empty={empty}>{(all ? rows : rows.slice(0, TOP)).map(row)}</Ledger>
    {rows.length > TOP && <button type="button" className="linkish more" onClick={() => setAll(!all)}>
      {all ? `Show the top ${TOP}` : `Show all ${num(rows.length)} ${noun}`}</button>}
  </>;
}

function Friction({ d }: { d: InsightsPayload }) {
  const [h] = useHashState(), max = d.friction[0]?.n ?? 0;
  return (
    <section className="panel sect" id="friction" aria-labelledby="frictionTitle">
      <h2 id="frictionTitle">Friction categories <Judged /></h2>
      <p className="hint">What got in the way, by times reported, with the sessions that reported it. A session can carry several.</p>
      <TopLedger rows={d.friction} empty="No friction reported in this view." noun="categories" row={r => <LedgerRow key={r.name} name={label(r.name)}
        title={r.name} share={max ? r.n / max : 0} value={num(r.n)} side={sessionsSide(r)} {...pickProps(h.raw, "fr", r.name, r.sessions)} />} />
    </section>
  );
}

function Goals({ d }: { d: InsightsPayload }) {
  const [h] = useHashState(), max = d.goals[0]?.n ?? 0;
  return (
    <Drawer id="d-goals" title={<>Goals <Judged /></>}>
      <p className="hint">What each session set out to do.</p>
      <TopLedger rows={d.goals} empty="No goals recorded in this view." noun="goals" row={r => <LedgerRow key={r.name} name={label(r.name)} title={r.name}
        share={max ? r.n / max : 0} value={num(r.n)} side={sessionsSide(r)} {...pickProps(h.raw, "goal", r.name, r.sessions)} />} />
    </Drawer>
  );
}

function SessionTypes({ d }: { d: InsightsPayload }) {
  const types = d.session_types.filter(t => t.n > 0), color = (i: number) => TYPE_COLORS[Math.min(i, TYPE_COLORS.length - 1)];
  return (
    <Drawer id="d-types" title={<>Session types <Judged /></>}>
      {types.length ? <>
        <div className="strip" aria-hidden="true">{types.map((t, i) => <i key={t.name} style={{ flex: t.n, background: color(i) }} />)}</div>
        <ul className="key">{types.map((t, i) => <li key={t.name}><i className="sw" style={{ background: color(i) }} /><Cat name={t.name} /> <b>{num(t.n)}</b></li>)}</ul>
      </> : <p className="empty">No session types recorded in this view.</p>}
    </Drawer>
  );
}

/** How much of the view /insights analysed, by project and by run. Counts of sessions and facets, so not model-judged. */
function CoverageDrawer({ d }: { d: InsightsPayload }) {
  const { by_project, runs } = d.coverage, max = Math.max(0, ...runs.map(r => r.facets));
  return (
    <Drawer id="d-coverage" title="Coverage">
      <h3>By project</h3>
      <p className="hint">Claude Code sessions of this view that /insights analysed, busiest project first. A project with none analysed has no judgments at all.</p>
      <TopLedger rows={by_project} empty="No Claude Code sessions in this view." noun="projects" row={r => {
        const share = r.sessions ? r.analysed / r.sessions : 0;
        return <LedgerRow key={r.project} name={r.project} project={r.project} share={share} value={`${num(r.analysed)} of ${num(r.sessions)}`}
          side={r.analysed ? pct(share) : <span className="none">none analysed</span>} />;
      }} />
      <h3>By run</h3>
      <p className="hint">A run is the facets written within an hour of each other, newest first, with those in this view. A session analysed again counts in its latest run.</p>
      <Ledger empty="No runs in this view.">{runs.map(r => <LedgerRow key={r.at} name={when(r.at)} share={max ? r.facets / max : 0}
        value={num(r.facets)} side={r.facets === 1 ? "facet" : "facets"} />)}</Ledger>
    </Drawer>
  );
}

/** What /insights is and how much one run covers, from the store. Process text, not a judgment, so not tagged model-judged. */
function HowItWorks({ d }: { d: InsightsPayload }) {
  const { dir, newest_facet: newest, run_sizes: z } = d.coverage;
  return (
    <Drawer id="d-how" title="How this works">
      <p><code>/insights</code> is a Claude Code command. A model reads each session's transcript and writes one judgment file, a facet, per
        session. This app only reads those files and never calls a model.</p>
      <p>The app reads <code>{dir ?? "~/.claude/usage-data"}</code>.{newest && <> The last run wrote <b className="when">{when(newest)}</b>.</>}</p>
      {z && <p>{z.runs === 1 ? <>The one run so far wrote {plural(z.min, "session")}.</>
        : <>The last {z.runs} runs each wrote between {num(z.min)} and {num(z.max)} sessions (median {num(z.median, z.median % 1 ? 1 : 0)}).</>}</p>}
      <p>For more coverage, run <code>/insights</code> again in Claude Code, then Refresh.</p>
    </Drawer>
  );
}

/** The share of analysed sessions fully or mostly achieved, per week of session start. Shown from 2 weeks. */
function Trend({ d }: { d: InsightsPayload }) {
  if (d.trend.length < 2) return null;
  return (
    <section className="panel sect" id="trend" aria-labelledby="trendTitle">
      <h2 id="trendTitle">Outcome trend <Judged /></h2>
      <p className="hint">Share of analysed sessions fully or mostly achieved, per week. Weeks are by session start, and a week with few sessions swings.</p>
      <Ledger empty="No weeks in this view.">{d.trend.map(w => <LedgerRow key={w.week} name={`Week of ${dayLabel(w.week)}`} title={w.week}
        share={w.n ? w.achieved / w.n : 0} value={pct(w.n ? w.achieved / w.n : 0)} side={`${num(w.achieved)} of ${num(w.n)}`} />)}</Ledger>
    </section>
  );
}

function Outcomes({ d }: { d: InsightsPayload }) {
  const [h] = useHashState(), n = d.coverage.facets;
  return (
    <section className="panel sect" id="outcomes" aria-labelledby="outcomesTitle">
      <h2 id="outcomesTitle">Outcomes <Judged /></h2>
      <p className="hint">Whether each session met its goal, as judged by a model from the transcript. Share of the {plural(n, "analysed session")}.</p>
      <Ledger empty="No outcomes in this view.">{d.outcomes.map(o => <LedgerRow key={o.name} name={outcomeLabel(o.name)} title={o.name}
        share={n ? o.n / n : 0} value={pct(n ? o.n / n : 0)} side={num(o.n)} {...pickProps(h.raw, "outcome", o.name, o.n)} />)}</Ledger>
    </section>
  );
}

function Feelings({ d }: { d: InsightsPayload }) {
  const [h] = useHashState(), n = d.coverage.facets, smax = Math.max(0, ...d.satisfaction.map(s => s.n));
  return (
    <section className="panel sect" id="satisfaction" aria-labelledby="feelTitle">
      <h2 id="feelTitle">Satisfaction and helpfulness <Judged /></h2>
      <p className="hint">User satisfaction signals the model saw, summed over the sessions.</p>
      <TopLedger rows={d.satisfaction} empty="No satisfaction signals in this view." noun="signals" row={s => <LedgerRow key={s.name} name={label(s.name)}
        title={s.name} share={smax ? s.n / smax : 0} value={num(s.n)} side={sessionsSide(s)} />} />
      <h3>Claude's helpfulness</h3>
      <p className="hint">Sessions per rating, from essential to unhelpful.</p>
      <Ledger empty="No ratings in this view.">{d.helpfulness.map(x => <LedgerRow key={x.name} name={label(x.name)} title={x.name}
        share={n ? x.n / n : 0} value={num(x.n)} side={pct(n ? x.n / n : 0)} {...pickProps(h.raw, "help", x.name, x.n)} />)}</Ledger>
    </section>
  );
}

const plain = (e: MouseEvent) => !(e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);

/** One session as a card: title, outcome and chips on the first line, the model's summary below, friction detail on expand. */
function SessionCard({ s, view, raw }: { s: InsightSession; view: View; raw: Readonly<Record<string, string>> }) {
  /** A chip or badge that sets, or clears, the filter of its kind. */
  const pick = (kind: DrillKind, name: string, text: ReactNode, cls: string) =>
    <button type="button" className={cls + (raw[kind] === name ? " on" : "")} title={name} aria-pressed={raw[kind] === name} onClick={() => toggleDrill(kind, name)}>{text}</button>;
  const open = (e: MouseEvent<HTMLAnchorElement>) => { if (plain(e)) { e.preventDefault(); navigate(e.currentTarget.getAttribute("href")!); } };
  return (
    <li className="scard">
      <div className="top">
        <span className="ttl">{s.in_store
          ? <a href={sessionHref(s.session_id, view)} title={`${s.title ? s.title + " · " : ""}Open session ${s.session_id} in Activity`} onClick={open}>{sessName(s)}</a>
          : <span title={s.title ?? s.session_id}>{sessName(s)}</span>}
          {(s.title || !s.in_store) && <span className="muted small"> {s.title && shortId(s.session_id)}{s.title && !s.in_store && " · "}
            {!s.in_store && <span title="This session's transcript is not in the store">no transcript</span>}</span>}</span>
        {s.outcome != null ? pick("outcome", s.outcome, outcomeLabel(s.outcome), "badge " + outcomeTone(s.outcome))
          : <span className={"badge " + outcomeTone(s.outcome)}>{outcomeLabel(s.outcome)}</span>}
        {s.satisfaction.includes("dissatisfied") && <span className="dis">dissatisfied</span>}
        {s.goals.map(g => <Fragment key={g}>{pick("goal", g, label(g), "chip")}</Fragment>)}
        {s.friction.map(f => <Fragment key={f}>{pick("fr", f, label(f), "chip warn")}</Fragment>)}
        <span className="meta"><span className="when">{when(s.start)}</span> · <ProjectName project={s.project} /></span>
      </div>
      {s.brief_summary && <p className="sum">{s.brief_summary}</p>}
      {s.friction_detail && <details className="fd"><summary>Friction detail</summary><p>{s.friction_detail}</p></details>}
    </li>
  );
}

/** Whether a session reports friction: a category or friction text. */
const hasFriction = (s: InsightSession) => s.friction.length > 0 || !!s.friction_detail;

// Outcomes worst first; one /insights adds later, and none, rank with "unclear".
const OUTCOME_RANK: Record<string, number> = { not_achieved: 0, partially_achieved: 1, unclear_from_transcript: 2, mostly_achieved: 3, fully_achieved: 4 };
const UNKNOWN_RANK = OUTCOME_RANK.unclear_from_transcript!;
const newestFirst = (a: InsightSession, b: InsightSession) => (b.start ?? "").localeCompare(a.start ?? "");
/** The orders of the list: the select's text, the hint's words and the comparison. */
const SORTS = {
  newest: { label: "Newest", words: "newest first", cmp: newestFirst },
  oldest: { label: "Oldest", words: "oldest first", cmp: (a: InsightSession, b: InsightSession) => -newestFirst(a, b) },
  outcome: { label: "Outcome", words: "worst outcome first, newest first within an outcome",
    cmp: (a: InsightSession, b: InsightSession) => (OUTCOME_RANK[a.outcome ?? ""] ?? UNKNOWN_RANK) - (OUTCOME_RANK[b.outcome ?? ""] ?? UNKNOWN_RANK) || newestFirst(a, b) },
} as const;
type SortId = keyof typeof SORTS;

/** The list's filters as the URL holds them. */
const filtersOf = (raw: Readonly<Record<string, string>>) => ({ friction: raw.friction === "1", outcome: raw.outcome ?? "" });

function Sessions({ d, view, sort, onSort }: { d: InsightsPayload; view: View; sort: SortId; onSort: (s: SortId) => void }) {
  const [h] = useHashState(), { friction, outcome } = filtersOf(h.raw), drills = drillsOf(h.raw), [all, setAll] = useState(false);
  const filtered = friction || drills.length > 0;
  const rows = d.sessions.filter(s => (!friction || hasFriction(s)) && passes(s, drills)).sort(SORTS[sort].cmp);
  const listed = all ? rows : rows.slice(0, SESSIONS_TOP);
  // Each outcome the view has; the one in the URL too, so the select never shows another than the list is narrowed to.
  const outcomes = d.outcomes.filter(o => o.n > 0).map(o => o.name);
  if (outcome && !outcomes.includes(outcome)) outcomes.push(outcome);
  const chips = [...drills.map(x => ({ key: x.kind, text: x.chip })), ...(friction ? [{ key: "friction", text: "Only sessions with friction" }] : [])];
  return (
    <section className="panel log sect" id="log" aria-labelledby="logTitle">
      <div className="log-head">
        <h2 id="logTitle">Analysed sessions <Judged /></h2>
        <div className="log-ctl">
          <label>Sort <select value={sort} onChange={e => onSort(e.target.value as SortId)}>
            {(Object.keys(SORTS) as SortId[]).map(k => <option key={k} value={k}>{SORTS[k].label}</option>)}</select></label>
          <label>Outcome <select value={outcome} onChange={e => setHash({ outcome: e.target.value }, { push: true })}>
            <option value="">All outcomes</option>{outcomes.map(o => <option key={o} value={o}>{outcomeLabel(o)}</option>)}</select></label>
          <label className="chk"><input type="checkbox" checked={friction} onChange={e => setHash({ friction: e.target.checked }, { push: true })} /> Only sessions with friction</label>
        </div>
      </div>
      {chips.length > 0 && <div className="fchips" role="group" aria-label="Active filters">
        {chips.map(c => <button key={c.key} type="button" className="chip fx" aria-label={"Remove filter " + c.text}
          onClick={() => setHash({ [c.key]: null }, { push: true })}>{c.text} <span aria-hidden="true">✕</span></button>)}
        {chips.length > 1 && <button type="button" className="linkish" onClick={() => setHash(Object.fromEntries([...DRILL_KEYS, "friction"].map(k => [k, null])), { push: true })}>Clear filters</button>}
      </div>}
      <p className="hint"><span className="count">{filtered ? `${num(rows.length)} of ${plural(d.sessions.length, "session")}` : plural(rows.length, "session")}</span>,
        {" "}{SORTS[sort].words}{d.truncated ? `: the newest ${num(d.sessions.length)} of the view` : ""}. The summary and friction detail are the model's words.
        {d.truncated && filtered && ` Filters cover only the newest ${num(d.sessions.length)} analysed sessions of the view, so a ledger count can exceed the sessions listed.`}</p>
      {listed.length ? <ul className="scards" role="list">{listed.map(s => <SessionCard key={s.session_id} s={s} view={view} raw={h.raw} />)}</ul>
        : <p className="empty">{drills.length ? "No session in this view matches the filters." : friction ? "No session in this view reports friction." : "No analysed sessions in this view."}</p>}
      {rows.length > SESSIONS_TOP && <button type="button" className="linkish more" onClick={() => setAll(!all)}>
        {all ? `Show the first ${SESSIONS_TOP}` : `Show all ${num(rows.length)} sessions`}</button>}
    </section>
  );
}

/** Insights (/insights): how Claude Code's /insights judged the view's sessions (outcome, satisfaction, helpfulness,
 *  friction, goals and session types), the analysed sessions, and how much of the view is not analysed yet, by project and by run. */
export function InsightsPage() {
  const [h] = useHashState();
  const want = viewOf(h);
  const url = insightsUrl(want), { data: d, error, loading, retry } = useApi<InsightsPayload>(url, { keepPrevious: true });
  const [shown, setShown] = useState(want);
  // Held here, not in Sessions: the list unmounts for a view with no analysed session, and the choice lasts the page visit.
  const [sort, setSort] = useState<SortId>("newest");
  useEffect(() => { if (d && !loading && !error) setShown(want); }, [d, loading, error, url]); // want is read through url
  const { slow, grow, wrap, retryBtn } = useLanding(d, url, loading, error, ":scope > :is(.grid2, .panel, .vitals, .drawers)");
  const howto = d && shown.source !== "codex" && d.coverage.stored_facets > 0;
  const figures = d && shown.source !== "codex" && d.coverage.facets > 0;
  return (
    <div className={"wrap pg-insights" + (slow ? " loading" : "") + (grow ? " grow" : "")} ref={wrap} aria-busy={loading || undefined}>
      <header className="top sect" id="overview">
        <h1 className="kicker">Insights <Judged /></h1>
        <Filters projects={d?.projects ?? []} automated />
      </header>
      {error && <div className="banner" role="alert"><b>Could not load insights for {viewName(want)} ({error.message}).{d ? ` Still showing ${viewName(shown)}.` : ""}</b>{" "}
        <button type="button" className="linkish" ref={retryBtn} onClick={retry}>Retry</button></div>}
      <p className="pending" role="status">{loading && d ? `Loading insights for ${viewName(want)}…` : ""}</p>
      {!d ? <p className="lede" id="lede" tabIndex={-1}>{error ? "Insights could not be loaded." : "Loading insights…"}</p> : <>
        <Coverage d={d} view={shown} drawer={!!figures} />
        <Lede d={d} view={shown} />
        <Sub d={d} view={shown} />
        {(figures || howto) && <SectionIndex groups={[
          figures ? [{ id: "overview", label: "Overview" }, { id: "outcomes", label: "Outcomes" }, { id: "friction", label: "Friction" },
            ...(d.trend.length > 1 ? [{ id: "trend", label: "Trend" }] : []),
            { id: "satisfaction", label: "Satisfaction", long: "Satisfaction and helpfulness" }, { id: "log", label: "Sessions", long: "Analysed sessions" }]
            : [{ id: "overview", label: "Overview" }],
          [...(figures ? [{ id: "d-goals", label: "Goals" }, { id: "d-types", label: "Session types" }, { id: "d-coverage", label: "Coverage" }] : []),
            ...(howto ? [{ id: "d-how", label: "How this works" }] : [])],
        ]} />}
        {figures && <>
          <Vitals d={d} />
          <div className="grid2">
            <Outcomes d={d} />
            <Friction d={d} />
          </div>
          <Trend d={d} />
          <Feelings d={d} />
          <Sessions d={d} view={shown} sort={sort} onSort={setSort} />
          <div className="drawers"><Goals d={d} /><SessionTypes d={d} /><CoverageDrawer d={d} />{howto && <HowItWorks d={d} />}</div>
        </>}
        {!figures && howto && <div className="drawers"><HowItWorks d={d} /></div>}
      </>}
    </div>
  );
}
