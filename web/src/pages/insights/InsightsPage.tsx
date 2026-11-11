import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { insightsUrl, viewOf, type FacetTally, type InsightSession, type InsightsPayload, type View } from "../../api";
import { Filters, viewName } from "../../components/Filters";
import { Ledger, LedgerRow } from "../../components/Ledger";
import { ProjectName } from "../../components/ProjectDot";
import { sessName, shortId } from "../../components/sheets/session";
import { useLanding } from "../../components/useLanding";
import { num, pct, plural, when } from "../../format";
import { formatHash, navigate, setHash, useHashState } from "../../hash";
import { useApi } from "../../useApi";
import { countOf, headline, label, outcomeLabel, outcomeTone } from "./insights";
import "./insights.css";

const JUDGED_TITLE = "/insights asks a model to read each session's transcript and judge it: these are its opinions, not measurements";
/** The tag every facet figure carries, so nobody reads it as measured. */
const Judged = () => <span className="judged" title={JUDGED_TITLE}>model-judged</span>;
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

function Coverage({ d, view }: { d: InsightsPayload; view: View }) {
  const c = d.coverage;
  if (view.source === "codex") return null;
  const newest = c.newest_facet && <> The newest analysis was written <b className="when">{when(c.newest_facet)}</b>.</>;
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
    not a measurement. Codex sessions have no facets.</p>;
}

function Vitals({ d }: { d: InsightsPayload }) {
  const c = d.coverage, n = c.facets, full = countOf(d.outcomes, "fully_achieved"), mostly = countOf(d.outcomes, "mostly_achieved");
  const dis = d.satisfaction.find(s => s.name === "dissatisfied")?.sessions ?? 0;
  return (
    <section className="vitals" aria-label="Outcomes at a glance">
      <div className="vital"><div className="v">{num(n)}</div><div className="l">Sessions analysed</div>
        <div className="d">{num(c.analysed)} of {num(c.claude_sessions)} stored Claude Code sessions{c.orphans > 0 && `, ${num(c.orphans)} without transcript`}</div></div>
      <div className="vital good"><div className="v">{num(full + mostly)} <small>{pct((full + mostly) / n)}</small></div><div className="l">Fully or mostly achieved</div>
        <div className="d">{num(full)} fully, {num(mostly)} mostly</div></div>
      <div className="vital"><div className="v">{num(countOf(d.outcomes, "partially_achieved"))}</div><div className="l">Partially</div><div className="d">some of the goal met</div></div>
      <div className="vital bad"><div className="v">{num(countOf(d.outcomes, "not_achieved"))}</div><div className="l">Not achieved</div><div className="d">goal abandoned or failed</div></div>
      <div className="vital bad"><div className="v">{num(dis)}</div><div className="l">Dissatisfied</div><div className="d">sessions where the user pushed back</div></div>
    </section>
  );
}

const sessionsSide = (r: FacetTally) => plural(r.sessions, "session");

/** A ledger of the first TOP rows, with a control to show them all. */
function TopLedger({ rows, empty, noun, row }: { rows: FacetTally[]; empty: string; noun: string; row: (r: FacetTally) => ReactNode }) {
  const [all, setAll] = useState(false);
  return <>
    <Ledger empty={empty}>{(all ? rows : rows.slice(0, TOP)).map(row)}</Ledger>
    {rows.length > TOP && <button type="button" className="linkish more" onClick={() => setAll(!all)}>
      {all ? `Show the top ${TOP}` : `Show all ${num(rows.length)} ${noun}`}</button>}
  </>;
}

function Friction({ d }: { d: InsightsPayload }) {
  const max = d.friction[0]?.n ?? 0;
  return (
    <section className="panel" id="friction" aria-labelledby="frictionTitle">
      <h2 id="frictionTitle">Friction categories <Judged /></h2>
      <p className="hint">What got in the way, by times reported, with the sessions that reported it. A session can carry several.</p>
      <TopLedger rows={d.friction} empty="No friction reported in this view." noun="categories" row={r => <LedgerRow key={r.name} name={label(r.name)}
        title={r.name} share={max ? r.n / max : 0} value={num(r.n)} side={sessionsSide(r)} />} />
    </section>
  );
}

function Goals({ d }: { d: InsightsPayload }) {
  const max = d.goals[0]?.n ?? 0;
  return (
    <section className="panel" aria-labelledby="goalsTitle">
      <h2 id="goalsTitle">Goals <Judged /></h2>
      <p className="hint">What each session set out to do.</p>
      <TopLedger rows={d.goals} empty="No goals recorded in this view." noun="goals" row={r => <LedgerRow key={r.name} name={label(r.name)} title={r.name}
        share={max ? r.n / max : 0} value={num(r.n)} side={sessionsSide(r)} />} />
    </section>
  );
}

function SessionTypes({ d }: { d: InsightsPayload }) {
  const types = d.session_types.filter(t => t.n > 0), color = (i: number) => TYPE_COLORS[Math.min(i, TYPE_COLORS.length - 1)];
  return (
    <section className="panel" aria-labelledby="typesTitle">
      <h2 id="typesTitle">Session types <Judged /></h2>
      {types.length ? <>
        <div className="strip" aria-hidden="true">{types.map((t, i) => <i key={t.name} style={{ flex: t.n, background: color(i) }} />)}</div>
        <ul className="key">{types.map((t, i) => <li key={t.name}><i className="sw" style={{ background: color(i) }} /><Cat name={t.name} /> <b>{num(t.n)}</b></li>)}</ul>
      </> : <p className="empty">No session types recorded in this view.</p>}
    </section>
  );
}

function Outcomes({ d }: { d: InsightsPayload }) {
  const n = d.coverage.facets;
  return (
    <section className="panel" id="outcomes" aria-labelledby="outcomesTitle">
      <h2 id="outcomesTitle">Outcomes <Judged /></h2>
      <p className="hint">Whether each session met its goal, as judged by a model from the transcript. Share of the {plural(n, "analysed session")}.</p>
      <Ledger empty="No outcomes in this view.">{d.outcomes.map(o => <LedgerRow key={o.name} name={outcomeLabel(o.name)} title={o.name}
        share={n ? o.n / n : 0} value={pct(n ? o.n / n : 0)} side={num(o.n)} />)}</Ledger>
    </section>
  );
}

function Feelings({ d }: { d: InsightsPayload }) {
  const n = d.coverage.facets, smax = Math.max(0, ...d.satisfaction.map(s => s.n));
  return (
    <section className="panel" aria-labelledby="feelTitle">
      <h2 id="feelTitle">Satisfaction and helpfulness <Judged /></h2>
      <p className="hint">User satisfaction signals the model saw, summed over the sessions.</p>
      <TopLedger rows={d.satisfaction} empty="No satisfaction signals in this view." noun="signals" row={s => <LedgerRow key={s.name} name={label(s.name)}
        title={s.name} share={smax ? s.n / smax : 0} value={num(s.n)} side={sessionsSide(s)} />} />
      <h3>Claude's helpfulness</h3>
      <p className="hint">Sessions per rating, from essential to unhelpful.</p>
      <Ledger empty="No ratings in this view.">{d.helpfulness.map(h => <LedgerRow key={h.name} name={label(h.name)} title={h.name}
        share={n ? h.n / n : 0} value={num(h.n)} side={pct(n ? h.n / n : 0)} />)}</Ledger>
    </section>
  );
}

const plain = (e: MouseEvent) => !(e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);

/** One session: its figures on the first line, the model's summary and friction detail on a full-width second line. */
function SessionRow({ s, view }: { s: InsightSession; view: View }) {
  const open = (e: MouseEvent<HTMLAnchorElement>) => { if (plain(e)) { e.preventDefault(); navigate(e.currentTarget.getAttribute("href")!); } };
  const detail = s.brief_summary || s.friction_detail;
  return <>
    <tr className={detail ? "head" : undefined}>
      <td className="when" data-k="Date">{when(s.start)}</td>
      <td className="sess" data-k="Session">{s.in_store
        ? <a href={sessionHref(s.session_id, view)} title={`${s.title ? s.title + " · " : ""}Open session ${s.session_id} in Activity`} onClick={open}>{sessName(s)}</a>
        : <span title={s.title ?? s.session_id}>{sessName(s)}</span>}
        {(s.title || !s.in_store) && <div className="muted small">{s.title && shortId(s.session_id)}{s.title && !s.in_store && " · "}
          {!s.in_store && <span title="This session's transcript is not in the store">no transcript</span>}</div>}</td>
      <td className="proj" data-k="Project"><ProjectName project={s.project} /></td>
      <td className="out" data-k="Outcome"><span className={"badge " + outcomeTone(s.outcome)} title={s.outcome ?? undefined}>{outcomeLabel(s.outcome)}</span>
        {s.satisfaction.includes("dissatisfied") && <span className="dis">dissatisfied</span>}</td>
      <td className="goal" data-k="Goal">{s.goals.length ? s.goals.map(g => <span key={g} className="chip" title={g}>{label(g)}</span>) : "–"}</td>
      <td className="fr" data-k="Friction">{s.friction.length ? s.friction.map(f => <span key={f} className="chip warn" title={f}>{label(f)}</span>) : "–"}</td>
    </tr>
    {detail && <tr className="notes"><td className="detail" colSpan={6}>{s.brief_summary && <p>{s.brief_summary}</p>}
      {s.friction_detail && <p className="fd"><b>Friction:</b> {s.friction_detail}</p>}</td></tr>}
  </>;
}

/** Whether a session reports friction: a category or friction text. */
const hasFriction = (s: InsightSession) => s.friction.length > 0 || !!s.friction_detail;

function Sessions({ d, view }: { d: InsightsPayload; view: View }) {
  const [h] = useHashState(), only = h.raw.friction === "1", [all, setAll] = useState(false);
  const rows = only ? d.sessions.filter(hasFriction) : d.sessions, listed = all ? rows : rows.slice(0, SESSIONS_TOP);
  return (
    <section className="panel log" id="log" aria-labelledby="logTitle">
      <div className="log-head">
        <h2 id="logTitle">Analysed sessions <Judged /></h2>
        <label className="chk"><input type="checkbox" checked={only} onChange={e => setHash({ friction: e.target.checked }, { push: true })} /> Only sessions with friction</label>
      </div>
      <p className="hint"><span className="count">{only ? `${num(rows.length)} of ${plural(d.sessions.length, "session")}` : plural(rows.length, "session")}</span>,
        newest first{d.truncated ? `: the newest ${num(d.sessions.length)} of the view` : ""}. The summary and friction detail are the model's words.</p>
      <div className="scroll"><table>
        <thead><tr><th>Date</th><th>Session</th><th>Project</th><th>Outcome</th><th>Goal</th><th>Friction</th></tr></thead>
        <tbody>{listed.length ? listed.map(s => <SessionRow key={s.session_id} s={s} view={view} />)
          : <tr><td colSpan={6} className="empty">{only ? "No session in this view reports friction." : "No analysed sessions in this view."}</td></tr>}</tbody>
      </table></div>
      {rows.length > SESSIONS_TOP && <button type="button" className="linkish more" onClick={() => setAll(!all)}>
        {all ? `Show the newest ${SESSIONS_TOP}` : `Show all ${num(rows.length)} sessions`}</button>}
    </section>
  );
}

/** Insights (/insights): how Claude Code's /insights judged the view's sessions (outcome, satisfaction, helpfulness,
 *  friction, goals and session types), the analysed sessions, and how much of the view is not analysed yet. */
export function InsightsPage() {
  const [h] = useHashState();
  const want = viewOf(h);
  const url = insightsUrl(want), { data: d, error, loading, retry } = useApi<InsightsPayload>(url, { keepPrevious: true });
  const [shown, setShown] = useState(want);
  useEffect(() => { if (d && !loading && !error) setShown(want); }, [d, loading, error, url]); // want is read through url
  const { slow, grow, wrap, retryBtn } = useLanding(d, loading, error, ":scope > :is(.grid2, .panel, .vitals)");
  const figures = d && shown.source !== "codex" && d.coverage.facets > 0;
  return (
    <div className={"wrap pg-insights" + (slow ? " loading" : "") + (grow ? " grow" : "")} ref={wrap} aria-busy={loading || undefined}>
      <header className="top">
        <h1 className="kicker">Insights <Judged /></h1>
        <Filters projects={d?.projects ?? []} automated />
      </header>
      {error && <div className="banner" role="alert"><b>Could not load insights for {viewName(want)} ({error.message}).{d ? ` Still showing ${viewName(shown)}.` : ""}</b>{" "}
        <button type="button" className="linkish" ref={retryBtn} onClick={retry}>Retry</button></div>}
      <p className="pending" role="status">{loading && d ? `Loading insights for ${viewName(want)}…` : ""}</p>
      {!d ? <p className="lede" id="lede" tabIndex={-1}>{error ? "Insights could not be loaded." : "Loading insights…"}</p> : <>
        <Coverage d={d} view={shown} />
        <Lede d={d} view={shown} />
        <Sub d={d} view={shown} />
        {figures && <>
          <Vitals d={d} />
          <div className="grid2">
            <Friction d={d} />
            <div className="stack"><Goals d={d} /><SessionTypes d={d} /></div>
          </div>
          <div className="grid2">
            <Outcomes d={d} />
            <Feelings d={d} />
          </div>
          <Sessions d={d} view={shown} />
        </>}
      </>}
    </div>
  );
}
