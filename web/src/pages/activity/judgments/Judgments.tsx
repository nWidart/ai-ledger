import { Fragment, useEffect, useId, useState, type ReactNode } from "react";
import { insightsUrl, viewOf, type FrictionFamily, type FrictionWeight, type InsightSession, type InsightsPayload, type View } from "../../../api";
import { Drawer, jumpTo } from "../../../components/Drawer";
import { label, outcomeLabel, outcomeTone } from "../../../components/facets";
import { viewName } from "../../../components/Filters";
import { useScopeProjects } from "../../../components/ScopeBar";
import { HowMeasured } from "../../../components/HowMeasured";
import { Ledger, LedgerRow } from "../../../components/Ledger";
import { ProjectName } from "../../../components/ProjectDot";
import { sessionLink, sessionSheetHref, sessName, shortId } from "../../../components/sheets/session";
import { DocsLink } from "../../../components/DocsLink";
import { PageSkeleton } from "../../../components/PageSkeleton";
import { useLanding } from "../../../components/useLanding";
import { dur, num, pct, plural, when } from "../../../format";
import { setSearch, useSearchOf, useView } from "../../../url";
import { validateSearch, type InsightsSearch } from "./search";
import { queries } from "../../../queries";
import { useApi } from "../../../useApi";
import { armFocus, DRILL_KEYS, drillsOf, focusList, passes, pickProps, takeFocus, toggleDrill, type DrillKind } from "./drill";
import { byWeight, countOf, headline, measured, stored, weightOf, WEIGHTS, weightSide, weightValue, type Weight } from "./figures";
import { OutcomeTrend } from "./OutcomeTrend";
import "./judgments.css";

// Session-type strip colors, in the payload's fixed order; unknown types share the last.
const TYPE_COLORS = ["var(--proj-2)", "var(--proj-4)", "var(--proj-5)", "var(--proj-1)", "var(--proj-other)"];

/** A category name with spaces, its raw name in the title. */
const Cat = ({ name }: { name: string }) => <span title={name}>{label(name)}</span>;

/** The Judgments view in view v and its filters with session id's sheet open over it: the href of a session card's link. */
const sessionHref = (id: string, v: View, raw: InsightsSearch) =>
  sessionSheetHref("/usage", { project: v.project, range: String(v.range), source: v.source, auto: v.automated, view: "judgments", ...raw }, id);
// Ledgers with free-form names (goals, friction, satisfaction) show this many rows until asked for all.
const TOP = 12;
// Sessions listed until asked for all.
const SESSIONS_TOP = 25;

function Coverage({ d, drawer }: { d: InsightsPayload; drawer: boolean }) {
  const c = d.coverage;
  const newest = <>{c.newest_facet && <> The newest analysis was written <b className="when">{when(c.newest_facet)}</b>.</>}
    {drawer && <> Coverage <button type="button" className="linkish" onClick={() => jumpTo("d-coverage")}>by project and run</button>.</>}</>;
  return <>
    {c.not_analysed > 0 && <p className="cov" role="status" id="coverage">
      <b>{num(c.analysed)} of {plural(c.claude_sessions, "Claude Code session")}</b> in this view analysed ({pct(c.analysed / c.claude_sessions)}){c.orphans > 0 && `; ${num(c.orphans)} more ${c.orphans === 1 ? "has a facet" : "have facets"} but no transcript`}.
      Each <code>/insights</code> run in Claude Code analyses more.{newest}</p>}
    {c.not_analysed === 0 && c.analysed > 0 && <p className="cov" id="coverage">Every Claude Code session in this view with a transcript is analysed.{newest}</p>}
  </>;
}

function Lede({ d }: { d: InsightsPayload }) {
  const c = d.coverage;
  if (!c.stored_facets) return <h1 className="lede" id="lede" tabIndex={-1}>{d.meta.sessions > 0 ? <>No <code>/insights</code> judgments found.</>
    : <>No <code>/insights</code> data found.</>}</h1>;
  if (!c.facets) return <h1 className="lede" id="lede" tabIndex={-1}>No analysed sessions in this view.</h1>;
  const h = headline(d);
  return <h1 className="lede" id="lede" tabIndex={-1} aria-live="polite"><b>{num(h.full)} of {num(h.n)}</b> analysed sessions fully achieved their
    goal; {h.top ? <><b><Cat name={h.top} /></b> caused the most friction.</> : <>no friction reported.</>}</h1>;
}

/** The view in words. Judgments has no source filter: every figure is of Claude Code sessions, whatever the URL's source. */
const judgedName = (v: View) => `${viewName({ ...v, source: "" })}, Claude Code sessions`;

function Sub({ d, view }: { d: InsightsPayload; view: View }) {
  const c = d.coverage;
  if (!c.stored_facets) return <p className="sub">The app reads <code>{c.dir ?? "~/.claude/usage-data"}</code>. Run <code>/insights</code> in Claude Code,
    then Refresh.{d.meta.sessions > 0 && " The session figures below are counted from transcripts."}</p>;
  return <p className="sub">{judgedName(view)}. Model-judged: a model's reading of each session, not a measurement.
    <HowMeasured what="the judgments" docs="reference/glossary#judgments">The figures come from <code>/insights</code> facets, except Session figures and Coverage, which are counted, and each
      session's cost, peak context and tool errors, which are measured from its transcript. <code>/insights</code> judges Claude Code sessions only: Codex
      writes no facets, so this view has no source filter. A session counts here by its start time; Overview counts a session with a request in the range,
      so the two totals can differ slightly.</HowMeasured></p>;
}

function Vitals({ d }: { d: InsightsPayload }) {
  const n = d.coverage.facets, full = countOf(d.outcomes, "fully_achieved"), mostly = countOf(d.outcomes, "mostly_achieved");
  const partly = countOf(d.outcomes, "partially_achieved"), not = countOf(d.outcomes, "not_achieved");
  const dis = d.satisfaction.find(s => s.name === "dissatisfied")?.sessions ?? 0;
  const unclear = n - full - mostly - partly - not; // unclear_from_transcript, or an outcome this page does not know
  return (
    <section className="vitals sect" id="vitals" aria-label="Outcomes at a glance">
      <div className="vital good"><div className="v">{num(full + mostly)} <small>{pct((full + mostly) / n)}</small></div><div className="l">Fully or mostly achieved</div>
        <div className="d">{num(mostly)} mostly{unclear > 0 && `; ${num(unclear)} with no clear outcome`}</div></div>
      <div className="vital"><div className="v">{num(partly)}</div><div className="l">Partially</div><div className="d">some of the goal met</div></div>
      <div className="vital bad"><div className="v">{num(not)}</div><div className="l">Not achieved</div><div className="d">goal abandoned or failed</div></div>
      <div className="vital bad"><div className="v">{num(dis)}</div><div className="l">Dissatisfied</div><div className="d">sessions where the user pushed back</div></div>
    </section>
  );
}

const sessionsSide = (r: { sessions: number }) => plural(r.sessions, "session");

/** A ledger of the first TOP rows, with a control to show them all. */
function TopLedger<T>({ rows, empty, noun, row }: { rows: T[]; empty: string; noun: string; row: (r: T) => ReactNode }) {
  const [all, setAll] = useState(false);
  return <>
    <Ledger empty={empty}>{(all ? rows : rows.slice(0, TOP)).map(row)}</Ledger>
    {rows.length > TOP && <button type="button" className="linkish more" onClick={() => setAll(!all)}>
      {all ? `Show the top ${TOP}` : `Show all ${num(rows.length)} ${noun}`}</button>}
  </>;
}

const FAMILY_HINT = "Similar labels are grouped into families by keyword; a family with several labels expands to them as /insights wrote them.";

/** A ledger row's bar, value and side figure. */
interface Cells { share: number; value: string; side: string }

/** A row of a family ledger. With 2 or more labels it filters by the family (`family` kind) and has an expander, a separate button,
 *  that lists the labels as /insights wrote them, each filtering by its raw name (`raw` kind). A family of one label is that label's
 *  plain row, with the raw filter. cells: what a family or a label shows. */
function FamilyRow<R extends { n: number; sessions: number }>({ f, cells, raw, kind }: {
  f: R & { family: string; members: (R & { name: string })[] }; cells: (r: R) => Cells; raw: InsightsSearch; kind: { raw: DrillKind; family: DrillKind } }) {
  const [open, setOpen] = useState(false), id = useId();
  if (f.members.length === 1) {
    const m = f.members[0]!;
    return <LedgerRow name={label(m.name)} title={m.name} {...cells(f)} {...pickProps(raw, kind.raw, m.name, f.sessions)} />;
  }
  return (
    <LedgerRow name={label(f.family)} title={f.family} {...cells(f)} {...pickProps(raw, kind.family, f.family, f.sessions)}>
      <button type="button" className="linkish exp" aria-expanded={open} aria-controls={id} aria-label={`${f.members.length} labels in ${label(f.family)}`}
        onClick={() => setOpen(!open)}>{f.members.length} labels <span aria-hidden="true">{open ? "▴" : "▾"}</span></button>
      <ol className="ledger members" id={id} hidden={!open} aria-label={`Labels in ${label(f.family)}`}>
        {open && f.members.map(m => <LedgerRow key={m.name} name={label(m.name)} title={m.name} {...cells(m)} {...pickProps(raw, kind.raw, m.name, m.sessions)} />)}
      </ol>
    </LedgerRow>
  );
}

/** A row by its count: the bar against the top count, the count, and its sessions. */
const byCount = (max: number) => (r: { n: number; sessions: number }): Cells => ({ share: max ? r.n / max : 0, value: num(r.n), side: sessionsSide(r) });

/** Friction families weighed by what the sessions that reported them cost, how long they ran, or how often they were reported:
 *  the choice orders the rows and sets each bar and value; the two other figures and the sessions stand beside it. */
function Friction({ d, weight, onWeight }: { d: InsightsPayload; weight: Weight; onWeight: (w: Weight) => void }) {
  const raw = useSearchOf(validateSearch), rows = byWeight(d.friction_families, weight);
  const max = Math.max(0, ...rows.map(f => weightOf(f, weight)));
  const cells = (r: { n: number; sessions: number } & FrictionWeight): Cells =>
    ({ share: max ? weightOf(r, weight) / max : 0, value: weightValue(r, weight), side: weightSide(r, weight) });
  return (
    <section className="panel sect friction" id="friction" aria-labelledby="frictionTitle">
      <div className="chart-head">
        <div><h2 id="frictionTitle">Friction categories</h2>
          <p className="hint">What got in the way, weighed by the sessions that reported it.<HowMeasured what="friction" docs="reference/glossary#judgments">Cost and active time are those of
            the whole sessions that reported a friction, not of the friction alone, and each session counts once in a row. A session with no transcript in
            the store adds no cost or time; one with no price adds no cost, but its active time counts. Reports are the times a friction was reported; a session can report several. {FAMILY_HINT}</HowMeasured></p></div>
        <div className="seg" role="group" aria-label="Weigh friction by">
          {WEIGHTS.map(w => <button key={w.k} type="button" aria-pressed={w.k === weight} onClick={() => onWeight(w.k)}>{w.label}</button>)}
        </div>
      </div>
      <TopLedger rows={rows} empty="No friction reported in this view." noun="friction families" row={(f: FrictionFamily) =>
        <FamilyRow key={f.family} f={f} cells={cells} raw={raw} kind={{ raw: "fr", family: "frf" }} />} />
    </section>
  );
}

function Goals({ d }: { d: InsightsPayload }) {
  const raw = useSearchOf(validateSearch), cells = byCount(d.goal_families[0]?.n ?? 0);
  return (
    <Drawer id="d-goals" title="Goals">
      <p className="hint">What each session set out to do.<HowMeasured what="goals" docs="reference/glossary#judgments">{FAMILY_HINT}</HowMeasured></p>
      <TopLedger rows={d.goal_families} empty="No goals recorded in this view." noun="goal families" row={f =>
        <FamilyRow key={f.family} f={f} cells={cells} raw={raw} kind={{ raw: "goal", family: "goalf" }} />} />
    </Drawer>
  );
}

function SessionTypes({ d }: { d: InsightsPayload }) {
  const types = d.session_types.filter(t => t.n > 0), color = (i: number) => TYPE_COLORS[Math.min(i, TYPE_COLORS.length - 1)];
  return (
    <Drawer id="d-types" title="Session types">
      {types.length ? <>
        <div className="strip" aria-hidden="true">{types.map((t, i) => <i key={t.name} style={{ flex: t.n, background: color(i) }} />)}</div>
        <ul className="key">{types.map((t, i) => <li key={t.name}><i className="sw" style={{ background: color(i) }} /><Cat name={t.name} /> <b>{num(t.n)}</b></li>)}</ul>
      </> : <p className="empty">No session types recorded in this view.</p>}
    </Drawer>
  );
}

/** What /insights counted from each session's transcript: lines, files, pushes, duration, response time and languages. A measurement,
 *  not a judgment, so not tagged model-judged; it covers every session with a session-meta row, not only the judged ones. */
function SessionFigures({ d }: { d: InsightsPayload }) {
  const m = d.meta, max = m.languages[0]?.n ?? 0;
  const vital = (v: ReactNode, l: string) => <div className="vital"><div className="v">{v}</div><div className="l">{l}</div></div>;
  return (
    <Drawer id="d-figures" title="Session figures">
      <p className="hint">Counted by <code>/insights</code> from each transcript for {plural(m.sessions, "session")}, which can be more sessions than were judged.
        Response time is the median of session medians.</p>
      <div className="vitals figs">
        {vital(num(m.lines_added), "Lines added")}{vital(num(m.lines_removed), "Lines removed")}{vital(num(m.files_modified), "Files modified")}
        {vital(num(m.git_pushes), "Git pushes")}{vital(dur(m.duration_p50_min == null ? null : m.duration_p50_min * 60), "Median session duration")}
        {vital(dur(m.response_p50_s), "Median response time")}
      </div>
      <h3>Languages</h3>
      <p className="hint">Summed counts, with the sessions that named each language.</p>
      <TopLedger rows={m.languages} empty="No languages counted in this view." noun="languages" row={r => <LedgerRow key={r.name} name={r.name}
        share={max ? r.n / max : 0} value={num(r.n)} side={sessionsSide(r)} />} />
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
        return <LedgerRow key={r.project} name={r.project} project={r.project} subject={{ kind: "project", value: r.project }} share={share} value={`${num(r.analysed)} of ${num(r.sessions)}`}
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

function Outcomes({ d }: { d: InsightsPayload }) {
  const raw = useSearchOf(validateSearch), n = d.coverage.facets;
  return (
    <section className="panel sect" id="outcomes" aria-labelledby="outcomesTitle">
      <h2 id="outcomesTitle">Outcomes</h2>
      <p className="hint">Whether each session met its goal, judged by a model from the transcript.<HowMeasured what="outcomes" docs="reference/glossary#judgments">Shares are of
        the {plural(n, "analysed session")}.</HowMeasured></p>
      <Ledger empty="No outcomes in this view.">{d.outcomes.map(o => <LedgerRow key={o.name} name={outcomeLabel(o.name)} title={o.name}
        share={n ? o.n / n : 0} value={pct(n ? o.n / n : 0)} side={num(o.n)} {...pickProps(raw, "outcome", o.name, o.n)} />)}</Ledger>
    </section>
  );
}

function Feelings({ d }: { d: InsightsPayload }) {
  const raw = useSearchOf(validateSearch), n = d.coverage.facets, smax = Math.max(0, ...d.satisfaction.map(s => s.n));
  return (
    <section className="panel sect" id="satisfaction" aria-labelledby="feelTitle">
      <h2 id="feelTitle">Satisfaction and helpfulness</h2>
      <p className="hint">User satisfaction signals the model saw, summed over the sessions.</p>
      <TopLedger rows={d.satisfaction} empty="No satisfaction signals in this view." noun="signals" row={s => <LedgerRow key={s.name} name={label(s.name)}
        title={s.name} share={smax ? s.n / smax : 0} value={num(s.n)} side={sessionsSide(s)} />} />
      <h3>Claude's helpfulness</h3>
      <p className="hint">Sessions per rating, from essential to unhelpful.</p>
      <Ledger empty="No ratings in this view.">{d.helpfulness.map(x => <LedgerRow key={x.name} name={label(x.name)} title={x.name}
        share={n ? x.n / n : 0} value={num(x.n)} side={pct(n ? x.n / n : 0)} {...pickProps(raw, "help", x.name, x.n)} />)}</Ledger>
    </section>
  );
}

/** One session as a card: title, outcome and chips on the first line, the model's summary below, friction detail on expand. */
function SessionCard({ s, view, raw }: { s: InsightSession; view: View; raw: InsightsSearch }) {
  const line = s.meta ? measured(s.meta) : "", figs = stored(s);
  /** A chip or badge that sets, or clears, the filter of its kind. */
  const pick = (kind: DrillKind, name: string, text: ReactNode, cls: string) =>
    <button type="button" className={cls + (raw[kind] === name ? " on" : "")} title={name} aria-pressed={raw[kind] === name} onClick={() => toggleDrill(kind, name)}>{text}</button>;
  return (
    <li className="scard">
      <div className="top">
        <span className="ttl">{s.in_store
          ? <a href={sessionHref(s.session_id, view, raw)} title={`${s.title ? s.title + " · " : ""}Open session ${s.session_id}`} {...sessionLink(s.session_id)}>{sessName(s)}</a>
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
      {/* Measured from the stored transcript, apart from the model's words: cost, peak context and failed tool calls. */}
      {figs.length > 0 && <p className="stored" title="Measured from the stored transcript, over the whole session">{figs.map((p, i) => <Fragment key={p.text}>
        {i > 0 && " · "}<span className={p.warn ? "warn" : undefined}>{p.text}</span></Fragment>)}</p>}
      {line && <p className="measured" title="Counted by /insights from the transcript">{line}</p>}
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
const filtersOf = (search: InsightsSearch) => ({ friction: search.friction === true, outcome: search.outcome ?? "" });

function Sessions({ d, view, sort, onSort }: { d: InsightsPayload; view: View; sort: SortId; onSort: (s: SortId) => void }) {
  const search = useSearchOf(validateSearch), { friction, outcome } = filtersOf(search), drills = drillsOf(search), [all, setAll] = useState(false);
  const filtered = friction || drills.length > 0;
  const rows = d.sessions.filter(s => (!friction || hasFriction(s)) && passes(s, drills, d)).sort(SORTS[sort].cmp);
  const listed = all ? rows : rows.slice(0, SESSIONS_TOP);
  // Each outcome the view has; the one in the URL too, so the select never shows another than the list is narrowed to.
  const outcomes = d.outcomes.filter(o => o.n > 0).map(o => o.name);
  if (outcome && !outcomes.includes(outcome)) outcomes.push(outcome);
  // After a click changed the filters (not a URL change, Back or the select), focus the heading: the clicked chip may be gone.
  const key = [...DRILL_KEYS.map(k => search[k] ?? ""), friction].join("\0");
  useEffect(() => { const to = takeFocus(); if (to) focusList(to); }, [key]);
  const drop = (keys: string[]) => { armFocus("heading"); setSearch(Object.fromEntries(keys.map(k => [k, null])), { push: true }); };
  const chips = [...drills.map(x => ({ key: x.kind, text: x.chip })), ...(friction ? [{ key: "friction", text: "Only sessions with friction" }] : [])];
  return (
    <section className="panel log sect" id="log" aria-labelledby="logTitle">
      <div className="log-head">
        <h2 id="logTitle" tabIndex={-1}>Analysed sessions</h2>
        <div className="log-ctl">
          <label>Sort <select value={sort} onChange={e => onSort(e.target.value as SortId)}>
            {(Object.keys(SORTS) as SortId[]).map(k => <option key={k} value={k}>{SORTS[k].label}</option>)}</select></label>
          <label>Outcome <select value={outcome} onChange={e => setSearch({ outcome: e.target.value }, { push: true })}>
            <option value="">All outcomes</option>{outcomes.map(o => <option key={o} value={o}>{outcomeLabel(o)}</option>)}</select></label>
          <label className="chk"><input type="checkbox" checked={friction} onChange={e => setSearch({ friction: e.target.checked }, { push: true })} /> Only sessions with friction</label>
        </div>
      </div>
      {chips.length > 0 && <div className="fchips" role="group" aria-label="Active filters">
        {chips.map(c => <button key={c.key} type="button" className="chip fx" aria-label={"Remove filter " + c.text}
          onClick={() => drop([c.key])}>{c.text} <span aria-hidden="true">✕</span></button>)}
        {chips.length > 1 && <button type="button" className="linkish" onClick={() => drop([...DRILL_KEYS, "friction"])}>Clear filters</button>}
      </div>}
      <p className="hint"><span className="count">{filtered ? `${num(rows.length)} of ${plural(d.sessions.length, "session")}` : plural(rows.length, "session")}</span>,
        {" "}{SORTS[sort].words}{d.truncated ? `: the newest ${num(d.sessions.length)} of the view` : ""}. The summary and friction detail are the model's words.
        {d.truncated && filtered && ` Filters cover only the newest ${num(d.sessions.length)} analysed sessions of the view, so a ledger count can exceed the sessions listed.`}</p>
      {listed.length ? <ul className="scards" role="list">{listed.map(s => <SessionCard key={s.session_id} s={s} view={view} raw={search} />)}</ul>
        : <p className="empty">{drills.length ? "No session in this view matches the filters." : friction ? "No session in this view reports friction." : "No analysed sessions in this view."}</p>}
      {rows.length > SESSIONS_TOP && <button type="button" className="linkish more" onClick={() => setAll(!all)}>
        {all ? `Show the first ${SESSIONS_TOP}` : `Show all ${num(rows.length)} sessions`}</button>}
    </section>
  );
}

/** Activity's Judgments view (/usage?view=judgments): how Claude Code's /insights judged the view's sessions (outcome,
 *  satisfaction, helpfulness, friction, goals and session types), the analysed sessions with what the store measured of each, and
 *  how much of the view is not analysed yet, by project and by run. Only Claude Code sessions are judged, so the view asks for
 *  every source and shows no source filter; Activity never shows it for a Codex-only view.
 *  views: Activity's view switch, drawn in the header where Overview draws it. */
export function Judgments({ views }: { views: ReactNode }) {
  const [h] = useView();
  // The URL's source stays for the other pages and for this view's links; the request names none.
  const here = viewOf(h), want: View = { ...here, source: "" };
  const url = insightsUrl(want), { data: d, error, loading, retry } = useApi(queries.insights(want), { keepPrevious: true });
  useScopeProjects(d?.projects ?? []);
  const [shown, setShown] = useState(want);
  // Held here, not in Sessions or Friction: they unmount for a view with no analysed session, and the choices last the page visit.
  const [sort, setSort] = useState<SortId>("newest"), [weight, setWeight] = useState<Weight>("cost");
  useEffect(() => { if (d && !loading && !error) setShown(want); }, [d, loading, error, url]); // want is read through url
  const { slow, grow, wrap, retryBtn } = useLanding(d, url, loading, error, ":scope > :is(.grid2, .panel, .vitals, .drawers)");
  const howto = d && d.coverage.stored_facets > 0;
  const figures = d && d.coverage.facets > 0;
  // The first load shows the placeholder; the loading look (dimmed figures) belongs to a page that has figures.
  const first = !d && !error;
  const counted = d && d.meta.sessions > 0;
  return (
    <main id="content" className={"wrap pg-judgments" + (slow && !first ? " loading" : "") + (grow ? " grow" : "")} ref={wrap} aria-busy={loading || undefined}>
      {/* Drawn through every state, as Overview draws it: a switch keeps its focus while this view's first request is pending. */}
      {views}
      {first ? <PageSkeleton title="Loading judgments…" /> : <>
        <header className="top sect" id="overview">
          <div>{d ? <Lede d={d} /> : <h1 className="lede" id="lede" tabIndex={-1}>Judgments could not be loaded.</h1>}</div>
        </header>
      </>}
      {error && <div className="banner" role="alert"><b>Could not load judgments for {judgedName(want)} ({error.message}).{d ? ` Still showing ${judgedName(shown)}.` : ""}</b>{" "}
        <button type="button" className="linkish" ref={retryBtn} onClick={retry}>Retry</button>{" "}<DocsLink docs="reference/troubleshooting">Troubleshooting</DocsLink></div>}
      <p className="pending">{loading && d ? `Loading judgments for ${judgedName(want)}…` : ""}</p>
      {d && <>
        <Sub d={d} view={shown} />
        <Coverage d={d} drawer={!!figures} />
        {figures && <>
          <Vitals d={d} />
          <div className="grid2">
            <Outcomes d={d} />
            <Friction d={d} weight={weight} onWeight={setWeight} />
          </div>
          {d.trend.length > 1 && <OutcomeTrend weeks={d.trend} />}
          <Feelings d={d} />
          <Sessions d={d} view={{ ...shown, source: here.source }} sort={sort} onSort={setSort} />
          <div className="drawers"><Goals d={d} /><SessionTypes d={d} />{counted && <SessionFigures d={d} />}<CoverageDrawer d={d} />{howto && <HowItWorks d={d} />}</div>
        </>}
        {!figures && (counted || howto) && <div className="drawers">{counted && <SessionFigures d={d} />}{howto && <HowItWorks d={d} />}</div>}
      </>}
    </main>
  );
}
