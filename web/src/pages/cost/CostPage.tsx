import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usageUrl, viewOf, type UsagePayload, type View } from "../../api";
import { setOrder, useColors } from "../../colors";
import { openDrawer } from "../../components/Drawer";
import { Filters } from "../../components/Filters";
import { InsightCard, rankInsights } from "../../components/InsightCard";
import { Ledger, LedgerRow } from "../../components/Ledger";
import { SectionIndex } from "../../components/SectionIndex";
import { ModelLedger } from "../../components/sheets/ProjectSheet";
import { openProjectSheet, openSessionSheet, sessName } from "../../components/sheets/session";
import { UsageSheets } from "../../components/sheets/UsageSheets";
import { useLanding } from "../../components/useLanding";
import { big, num, pct, usd, when } from "../../format";
import { useHashState } from "../../hash";
import { useApi } from "../../useApi";
import { Changes } from "./Changes";
import { costDays, moved } from "./cost";
import { CostChart, type CostMetric } from "./CostChart";
import { ProjectCostDrawer, TokensDrawer, TopSessionsDrawer, type CostSort } from "./drawers";
import { cacheInsight, pairFacts, peakInsight, perCommitInsight, spenderInsight, type CostActs } from "./insights";
import { Lede, Spark } from "./Lede";
import "./cost.css";

const viewName = (v: { project: string; range: number }) => `${v.project || "all projects"}, ${v.range ? `last ${v.range} days` : "all time"}`;
const LEDGER_TOP = 8;
// The chart's metric and hidden token kinds, under the keys the Usage page kept them in.
const METRIC_KEY = "claude-usage-metric", HIDDEN_KEY = "claude-usage-hidden";
const stored = <T,>(k: string, ok: (v: unknown) => v is T, d: T): T => { try { const v: unknown = JSON.parse(localStorage.getItem(k) || "null"); return ok(v) ? v : d; } catch { return d; } };
const store = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage off */ } };
const isMetric = (v: unknown): v is CostMetric => v === "cost" || v === "tokens";
const isList = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === "string");

// Phones show What changed after the chart and its insights, and fold the supporting cards under the chart.
const NARROW = "(max-width: 520px)";
const subscribeNarrow = (f: () => void) => { const m = matchMedia(NARROW); m.addEventListener?.("change", f); return () => m.removeEventListener?.("change", f); };
const useNarrow = () => useSyncExternalStore(subscribeNarrow, () => matchMedia(NARROW).matches, () => false);

/** Where the spend went: by project, or by session when the page shows one project. Top 8, then all. */
function SpendLedger({ d, all, onAll }: { d: UsagePayload; all: boolean; onAll: (all: boolean) => void }) {
  const color = useColors(), bySession = !!d.project, total = d.totals.cost || 1;
  const rs = bySession
    ? d.top_sessions.map(s => ({ key: s.session_id, name: s.title ? sessName(s) : `${when(s.first_ts)}${s.git_branch ? ` · ${s.git_branch}` : ""}`,
        title: `${s.title ? s.title + " · " : ""}${when(s.first_ts)}${s.git_branch ? ` · ${s.git_branch}` : ""}`, cost: s.cost, unpriced: s.unpriced }))
    : d.by_project.map(p => ({ key: p.project ?? "", name: p.project ?? "", title: undefined, cost: p.cost, unpriced: p.unpriced })).sort((a, b) => (b.cost || 0) - (a.cost || 0));
  const max = Math.max(...rs.map(r => r.cost || 0), 0) || 1, shown = all ? rs : rs.slice(0, LEDGER_TOP);
  const count = bySession ? Math.min(rs.length, d.totals.sessions) : rs.length;
  return (
    <section className="panel sect" id="where" aria-labelledby="ledgerTitle">
      <h2 id="ledgerTitle">{bySession ? "Most expensive sessions" : "Where the spend went"}</h2>
      <div className="hint">{bySession ? `Estimated cost per session in ${d.project}, as a share of its ${usd(d.totals.cost)}. Select one for details.`
        : "Estimated cost per project, as a share of the total. Select a project for details."}</div>
      <Ledger empty="No usage in this range.">{shown.map(r => <LedgerRow key={r.key} name={r.name} title={r.title} share={(r.cost || 0) / max}
        project={bySession ? undefined : r.key} color={color(bySession ? d.project : r.key)} pickKey={r.key}
        onPick={() => (bySession ? openSessionSheet(r.key) : openProjectSheet(r.key))}
        value={<>{usd(r.cost)}{r.unpriced > 0 && <> <span className="chip warn" title={`${r.unpriced} requests from unpriced models`}>+?</span></>}</>}
        side={pct((r.cost || 0) / total)} />)}</Ledger>
      {rs.length > LEDGER_TOP && <button type="button" className="linkish more" onClick={() => onAll(!all)}>
        {all ? `Show top ${LEDGER_TOP}` : `Show top ${num(count)} ${bySession ? "sessions" : "projects"}`}</button>}
    </section>
  );
}

/** Cost (/cost): what Claude Code usage cost at API list prices, where it went, and why it changed. */
export function CostPage() {
  const [h, set] = useHashState();
  const want: View = viewOf(h), url = usageUrl(want), viewKey = url;
  const { data, error, loading, retry } = useApi<UsagePayload>(url, { keepPrevious: true });
  useEffect(() => { if (data) setOrder(data.project_order); }, [data]);
  const narrow = useNarrow();

  // Page-only state, reset when the view changes: Show all, the cost-per-commit sort and the day of the sessions drawer.
  const [chgAll, setChgAll] = useState(false), [ledgerAll, setLedgerAll] = useState(false);
  const [sort, setSort] = useState<CostSort | null>(null), [day, setDay] = useState("");
  const lastView = useRef(viewKey);
  useEffect(() => {
    if (lastView.current === viewKey) return;
    lastView.current = viewKey;
    setChgAll(false); setLedgerAll(false); setSort(null); setDay("");
  }, [viewKey]);
  const [metric, setMetricState] = useState<CostMetric>(() => stored(METRIC_KEY, isMetric, "cost"));
  const [hidden, setHiddenState] = useState<string[]>(() => stored(HIDDEN_KEY, isList, []));
  const setMetric = (m: CostMetric) => { setMetricState(m); store(METRIC_KEY, m); };
  const setHidden = (ks: string[]) => { setHiddenState(ks); store(HIDDEN_KEY, ks); };

  const { slow, grow, before, wrap, retryBtn } = useLanding(data, loading, error, ":scope > :is(.insights, .panel, .split, .drawers, .more-ins)");

  const d = data, has = !!d && d.totals.requests > 0;
  const days = useMemo(() => (d ? costDays(d) : []), [d]);
  const showDay = (v: string) => { setDay(v); openDrawer("d-top", true); };
  const acts: CostActs = {
    project: openProjectSheet, session: openSessionSheet, day: showDay,
    compare: (spot, med) => setSort({ spot, med }),
    tokens: () => openDrawer("d-tokens", true),
  };
  const { lead, rest } = d && has
    ? rankInsights([spenderInsight(d, acts), perCommitInsight(d, acts), peakInsight(d, days, acts), cacheInsight(d, acts)])
    : { lead: null, rest: [] };
  const changes = d && <Changes d={d} all={chgAll} onAll={setChgAll} />;
  const showChanges = !!d?.previous && !!d.start && moved(d).length > 0;
  const cls = "wrap pg-cost" + (slow ? " loading" : "") + (grow ? " grow" : "");

  return (
    <div className={cls} ref={wrap} aria-busy={loading || undefined}>
      <header className="top sect" id="overview">
        <div>{d ? <Lede d={d} before={before} /> : <h1 className="lede" id="lede" tabIndex={-1} aria-live="polite">{error ? "Cost could not be loaded." : "Loading cost…"}</h1>}</div>
        <div className="top-side"><Filters projects={d?.projects ?? []} automated />{d && <Spark d={d} />}</div>
      </header>
      {error && <div className="banner" role="alert"><b>Could not load {viewName(want)} ({error.message}).{d ? ` Still showing ${viewName(d)}.` : ""}</b>{" "}
        <button type="button" className="linkish" ref={retryBtn} onClick={retry}>Retry</button></div>}
      {d && d.unpriced.length > 0 && <div className="banner"><b>Unpriced models:</b> {d.unpriced.map((u, k) => <span key={k}>{k ? ", " : ""}<code>{u.model}</code> ({big(u.tokens)} tokens)</span>)}.
        Their tokens are counted; their cost is unknown and left out of totals. Add them to <code>prices.json</code>.</div>}
      <p className="pending" role="status">{loading && d ? `Loading ${viewName(want)}…` : ""}</p>
      {d && <>
        <SectionIndex groups={[
          [{ id: "overview", label: "Overview" }, { id: "changed", label: "Changes", long: "What changed", hidden: !showChanges }, { id: "insights", label: "Insights", hidden: !has },
            { id: "spend", label: "Per day", long: "Cost per day" }, { id: "where", label: "Spend", long: "Where the spend went" }],
          [{ id: "d-tokens", label: "Tokens", long: "Tokens and cache" }, { id: "d-projcost", label: "Projects", long: "Cost by project" },
            { id: "d-top", label: "Sessions", long: "Most expensive sessions" }],
        ]} />
        {!narrow && changes}
        {lead && <section className="insights sect" id="insights" aria-label="What stands out">
          <InsightCard insight={lead} primary />
          {narrow && <div className="mpair">{pairFacts(d).map(f => <div key={f.l}><div className="v">{f.v}{f.of && <span className="muted">{f.of}</span>}</div><div className="l">{f.l}</div></div>)}</div>}
          {!narrow && rest.length > 0 && <div className="support">{rest.map(c => <InsightCard key={c.k} insight={c} />)}</div>}
        </section>}
        <CostChart d={d} metric={metric} onMetric={setMetric} hidden={hidden} onHidden={setHidden} onDay={showDay}
          onProject={p => set({ project: p, session: null, inspect: null })} />
        {narrow && rest.length > 0 && <details className="more-ins"><summary>More insights <span className="muted">({rest.length})</span></summary>
          <div className="support">{rest.map(c => <InsightCard key={c.k} insight={c} />)}</div></details>}
        {narrow && changes}
        <div className="split">
          <SpendLedger d={d} all={ledgerAll} onAll={setLedgerAll} />
          <section className="panel"><h2>Models and effort</h2><div className="hint">Share of requests, with estimated cost.</div><ModelLedger models={d.models} /></section>
        </div>
        <div className="drawers">
          <TokensDrawer t={d.totals} />
          <ProjectCostDrawer rows={d.by_project} selected={d.project} sort={sort} onSort={setSort} />
          <TopSessionsDrawer view={{ project: d.project, range: d.range, automated: d.automated }} top={d.top_sessions} day={day} onDay={setDay} selected={h.session} />
        </div>
      </>}
      <UsageSheets data={d} />
    </div>
  );
}
