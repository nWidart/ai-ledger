import { useEffect, useMemo, useRef, useState } from "react";
import { usageUrl, viewOf, type View } from "../../api";
import { setOrder } from "../../colors";
import { openDrawer } from "../../components/Drawer";
import { Filters, viewName } from "../../components/Filters";
import { InsightCard, rankInsights } from "../../components/InsightCard";
import { SectionIndex } from "../../components/SectionIndex";
import type { SortBy } from "../../components/Sort";
import { ModelLedger } from "../../components/sheets/ProjectSheet";
import { openSessionSheet } from "../../components/sheets/session";
import { UsageSheets } from "../../components/sheets/UsageSheets";
import { PageSkeleton } from "../../components/PageSkeleton";
import { useLanding } from "../../components/useLanding";
import { big } from "../../format";
import { useView } from "../../url";
import { queries } from "../../queries";
import { useApi } from "../../useApi";
import { costDays, SCALES, STACKS, type Stack, type TokenScale } from "./cost";
import { CostChart, type CostMetric } from "./CostChart";
import { TokensDrawer, TopSessionsDrawer } from "./drawers";
import { peakInsight, perCommitInsight, type CostActs } from "./insights";
import { Lede } from "./Lede";
import { MATRIX_SORT, type MatrixKey } from "./matrix";
import { PlanGauge } from "./PlanGauge";
import { ProjectTable, type CostSpot } from "./ProjectTable";
import "./cost.css";

// The chart's metric, hidden token kinds and cost stacking, under the keys the Usage page kept them in (the stacking is newer).
const METRIC_KEY = "claude-usage-metric", HIDDEN_KEY = "claude-usage-hidden", STACK_KEY = "claude-usage-stack", SCALE_KEY = "claude-usage-token-scale";
const stored = <T,>(k: string, ok: (v: unknown) => v is T, d: T): T => { try { const v: unknown = JSON.parse(localStorage.getItem(k) || "null"); return ok(v) ? v : d; } catch { return d; } };
const store = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage off */ } };
const isMetric = (v: unknown): v is CostMetric => v === "cost" || v === "tokens";
const isStack = (v: unknown): v is Stack => STACKS.includes(v as Stack);
const isScale = (v: unknown): v is TokenScale => SCALES.includes(v as TokenScale);
const isList = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === "string");

/** Cost (/cost): what coding-agent usage (every source, or the one picked) cost at API list prices, where it went, and why it
 *  changed. The heading and the plan gauge, then the daily chart, then one table of the projects. */
export function CostPage() {
  const [h, set] = useView();
  const want: View = viewOf(h), url = usageUrl(want), viewKey = url;
  const { data, error, loading, retry } = useApi(queries.usage(want), { keepPrevious: true });
  useEffect(() => { if (data) setOrder(data.project_order); }, [data]);

  // Page-only state, reset when the view changes: the project table's sort, ring and small projects, and the day of the sessions drawer.
  const [sort, setSort] = useState<SortBy<MatrixKey>>(MATRIX_SORT), [spot, setSpot] = useState<CostSpot | null>(null), [day, setDay] = useState(""), [smallOpen, setSmallOpen] = useState(false);
  const lastView = useRef(viewKey);
  useEffect(() => {
    if (lastView.current === viewKey) return;
    lastView.current = viewKey;
    setSort(MATRIX_SORT); setSpot(null); setDay(""); setSmallOpen(false);
  }, [viewKey]);
  const [metric, setMetricState] = useState<CostMetric>(() => stored(METRIC_KEY, isMetric, "cost"));
  const [hidden, setHiddenState] = useState<string[]>(() => stored(HIDDEN_KEY, isList, []));
  const [stack, setStackState] = useState<Stack>(() => stored(STACK_KEY, isStack, "project"));
  const [scale, setScaleState] = useState<TokenScale>(() => stored(SCALE_KEY, isScale, "volume"));
  const setScale = (s: TokenScale) => { setScaleState(s); store(SCALE_KEY, s); };
  const setStack = (s: Stack) => { setStackState(s); store(STACK_KEY, s); };
  const setMetric = (m: CostMetric) => { setMetricState(m); store(METRIC_KEY, m); };
  const setHidden = (ks: string[]) => { setHiddenState(ks); store(HIDDEN_KEY, ks); };

  const { slow, grow, before, wrap, retryBtn } = useLanding(data, url, loading, error, ":scope > :is(.panel, .split, .drawers)");

  const d = data, has = !!d && d.totals.requests > 0;
  const days = useMemo(() => (d ? costDays(d) : []), [d]);
  const showDay = (v: string) => { setDay(v); openDrawer("d-top", true); };
  const acts: CostActs = {
    session: openSessionSheet, day: showDay,
    compare: (name, med) => { setSort({ key: "cpc", desc: true }); setSpot({ spot: name, med }); },
    tokens: () => openDrawer("d-tokens", true),
  };
  // Only the findings the heading, gauge and table do not already show: cost per commit and the peak day.
  const { lead, rest } = d && has ? rankInsights([perCommitInsight(d, acts), peakInsight(d, days, acts)]) : { lead: null, rest: [] };
  const table = !!d && !d.project;
  // The first load shows the placeholder; the loading look (dimmed figures) belongs to a page that has figures.
  const first = !d && !error;
  const cls = "wrap pg-cost" + (slow && !first ? " loading" : "") + (grow ? " grow" : "");
  const models = d && <section className="panel"><h2>Models and effort</h2><div className="hint">Share of estimated cost, costliest first.</div><ModelLedger key={viewKey} models={d.models} by="cost" /></section>;

  return (
    <main id="content" className={cls} ref={wrap} aria-busy={loading || undefined}>
      {first ? <PageSkeleton title="Loading cost…" /> : <header className="top sect" id="overview">
        <div>{d ? <Lede d={d} before={before} /> : <h1 className="lede" id="lede" tabIndex={-1}>Cost could not be loaded.</h1>}</div>
        <div className="top-side"><Filters projects={d?.projects ?? []} automated />{d && <PlanGauge d={d} />}</div>
      </header>}
      {error && <div className="banner" role="alert"><b>Could not load {viewName(want)} ({error.message}).{d ? ` Still showing ${viewName(d)}.` : ""}</b>{" "}
        <button type="button" className="linkish" ref={retryBtn} onClick={retry}>Retry</button></div>}
      {d && d.unpriced.length > 0 && <div className="banner"><b>Unpriced models:</b> {d.unpriced.map((u, k) => <span key={k}>{k ? ", " : ""}<code>{u.model}</code> ({big(u.tokens)} tokens)</span>)}.
        Their tokens are counted; their cost is unknown and left out of totals. To price them, add them to <code>{d.prices_file.path}</code>,
        in the shape of the packaged <code>prices.json</code>; the next page load uses them, with no rebuild.</div>}
      {d?.prices_file.error && <div className="banner" role="alert"><b>Prices file ignored:</b> <code>{d.prices_file.path}</code> could not be used
        ({d.prices_file.error}). Packaged prices apply until it is fixed.</div>}
      <p className="pending">{loading && d ? `Loading ${viewName(want)}…` : ""}</p>
      {d && <>
        <SectionIndex groups={[
          [{ id: "overview", label: "Overview" }, { id: "spend", label: "Per day", long: "Cost per day" },
            { id: "projects", label: "Projects", long: "Project spend and change", hidden: !table }, { id: "insights", label: "Insights", hidden: !lead }],
          [{ id: "d-tokens", label: "Tokens", long: "Tokens and cache" }, { id: "d-top", label: "Sessions", long: "Most expensive sessions" }],
        ]} />
        <CostChart d={d} metric={metric} onMetric={setMetric} hidden={hidden} onHidden={setHidden} scale={scale} onScale={setScale} onDay={showDay} stack={stack} onStack={setStack}
          onProject={p => set({ project: p, session: null, inspect: null })} onSource={s => set({ source: s, session: null, inspect: null })} />
        {table && <ProjectTable d={d} sort={sort} onSort={setSort} spot={spot} onSpot={setSpot} smallOpen={smallOpen} onSmallOpen={setSmallOpen} />}
        <div className={lead ? "split" : "split solo"}>
          {lead && <section className="insights sect" id="insights" aria-label="What stands out">
            <InsightCard insight={lead} primary />
            {rest.map(c => <InsightCard key={c.k} insight={c} />)}
          </section>}
          {models}
        </div>
        <div className="drawers">
          <TokensDrawer t={d.totals} />
          <TopSessionsDrawer view={{ project: d.project, range: d.range, automated: d.automated, source: d.source }} top={d.top_sessions} day={day} onDay={setDay} selected={h.session} />
        </div>
      </>}
      <UsageSheets data={d} />
    </main>
  );
}
