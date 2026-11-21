import { useEffect } from "react";
import { contextUrl, viewOf, type ContextPayload, type TipId } from "../../api";
import { setOrder } from "../../colors";
import { agentName, Filters, viewName } from "../../components/Filters";
import { HowMeasured } from "../../components/HowMeasured";
import { ProjectDot } from "../../components/ProjectDot";
import { jumpTo } from "../../components/SectionIndex";
import { UsageSheets } from "../../components/sheets/UsageSheets";
import { PageSkeleton } from "../../components/PageSkeleton";
import { useLanding } from "../../components/useLanding";
import { num, plural } from "../../format";
import { currentRaw, setSearch, useSearchOf, useView } from "../../url";
import { queries } from "../../queries";
import { useApi } from "../../useApi";
import { rebuildFacts, share } from "./context";
import { validateSearch, type ContextTab } from "./search";
import { BreaksDrawer, LargestDrawer } from "./drawers";
import { Grids } from "./Grids";
import { CostSection, Fills, Growth, Pressure, Starting } from "./sections";
import { Tabs, type TabDef } from "./Tabs";
import { TipSessions, TipStrip } from "./tips";
import "./context.css";

/** The heading answers "how much context do sessions start with?": the view's median start and its share of the window, two
 *  figures (the sessions that compacted are Growth's). Every source reads "session", never one agent's name. */
function Lede({ d }: { d: ContextPayload }) {
  const s = d.starting;
  const where = d.project ? <> in <span className="proj"><ProjectDot project={d.project} />{d.project}</span></> : null;
  if (s.median == null) return <h1 className="lede" id="lede" tabIndex={-1} aria-live="polite">No {agentName(d.source)} session{where} with a measured start {d.range ? `in the last ${d.range} days` : "yet"}.</h1>;
  return <>
    <h1 className="lede" id="lede" tabIndex={-1} aria-live="polite">A typical session{where} starts with <span className="amt">{num(s.median)} tokens</span> of context
      {s.window_share != null && <>, <span className="unit">{share(s.window_share)} of its window</span></>}.</h1>
    <p className="sub">Every figure comes from the transcripts.<HowMeasured what="context">The prompt tokens of each session's first turn, over {plural(s.sessions, "session")} with a measured
      start. Nothing is read from <code>CLAUDE.md</code>, <code>AGENTS.md</code> or any configuration file. Token figures taken from tool result sizes are estimates.</HowMeasured></p>
  </>;
}

/** Says the store holds sessions from before this version, and how to fill their figures. */
function RebuildNotice({ d }: { d: ContextPayload }) {
  const f = rebuildFacts(d.coverage);
  if (!f) return null;
  const sizes = f.withBytes < f.calls, firsts = f.withFirst < f.compacted;
  return <div className="banner" id="rebuild" role="status"><b>The store holds sessions from before this version.</b>{" "}
    {sizes && <>{num(f.withBytes)} of {num(f.calls)} tool calls carry a result size. </>}
    {firsts && <>{num(f.withFirst)} of {plural(f.compacted, "compacted session")} record when they first compacted. </>}
    Stop the app and run <code>ai-ledger rebuild</code> to fill the missing figures; the figures below cover the rows that have them.</div>;
}

const TAB_DEFS: TabDef<ContextTab>[] = [{ id: "overhead", label: "Overhead and pressure" }, { id: "growth", label: "Growth and bloat" }, { id: "cache", label: "Cache health" }];
/** The tab of each section and drawer, for a link to one. */
const TAB_OF: Record<string, ContextTab> = {
  starting: "overhead", grids: "overhead", pressure: "overhead", growth: "growth", fills: "growth", "d-largest": "growth", cost: "cache", "d-breaks": "cache",
};

/** Context (/context): how much of the model's window sessions start with, how fast it grows, what fills it, what that costs,
 *  and the tips those figures give, in three tabs under the tips. Every source maps onto the same figures. */
export function ContextPage() {
  const [h] = useView();
  const search = useSearchOf(validateSearch);
  const want = viewOf(h), url = contextUrl(want);
  const { data: d, error, loading, retry } = useApi(queries.context(want), { keepPrevious: true });
  useEffect(() => { if (d) setOrder(d.project_order); }, [d]);
  const { slow, grow, wrap, retryBtn } = useLanding(d, url, loading, error, ":scope > :is(.tips, .drawers), :scope .tabpanel > :is(.panel, .drawers)");
  // A tip the payload does not have (an old link, another view) shows nothing.
  const tip = d?.tips.find(t => t.id === search.tip);
  const openTip = (id: TipId) => setSearch({ tip: id }, { push: true });
  const closeTip = () => setSearch({ tip: null }, { push: false });
  // The tab is part of the view, as a filter is: changing it replaces the history entry.
  const tab: ContextTab = search.tab ?? "overhead";
  const setTab = (t: ContextTab) => setSearch({ tab: t === "overhead" ? null : t }, { push: false });
  // A link to a section from before the tabs (#pressure, #d-breaks) opens the tab that holds it, keeping the fragment so a reload
  // opens it again, then scrolls to it, without moving focus (a direct load does not). Once the page has figures, and again
  // whenever only the fragment changes.
  const loaded = !!d;
  useEffect(() => {
    if (!loaded) return;
    const go = () => {
      const id = location.hash.slice(1), t = TAB_OF[id];
      if (!t) return;
      if (t !== (validateSearch(currentRaw()).tab ?? "overhead")) setSearch({ tab: t === "overhead" ? null : t }, { push: false, keepHash: true });
      requestAnimationFrame(() => jumpTo(id, false));
    };
    go();
    addEventListener("hashchange", go);
    return () => removeEventListener("hashchange", go);
  }, [loaded]);
  // The first load shows the placeholder; the loading look (dimmed figures) belongs to a page that has figures.
  const first = !d && !error;
  const cls = "wrap pg-context" + (slow && !first ? " loading" : "") + (grow ? " grow" : "");

  return (
    <main id="content" className={cls} ref={wrap} aria-busy={loading || undefined}>
      {first ? <PageSkeleton title="Loading context…" /> : <header className="top sect" id="overview">
        <div>{d ? <Lede d={d} /> : <h1 className="lede" id="lede" tabIndex={-1}>Context could not be loaded.</h1>}</div>
        <div className="top-side"><Filters projects={d?.projects ?? []} automated /></div>
      </header>}
      {error && <div className="banner" role="alert"><b>Could not load {viewName(want)} ({error.message}).{d ? ` Still showing ${viewName(d)}.` : ""}</b>{" "}
        <button type="button" className="linkish" ref={retryBtn} onClick={retry}>Retry</button></div>}
      <p className="pending">{loading && d ? `Loading ${viewName(want)}…` : ""}</p>
      {d && <>
        <RebuildNotice d={d} />
        <TipStrip tips={d.tips} onSessions={openTip} />
        {tip && <div className="drawers tip-drawer"><TipSessions tip={tip} onClose={closeTip} /></div>}
        <Tabs tabs={TAB_DEFS} current={tab} onChange={setTab} label="Context">
          {tab === "overhead" && <><Starting d={d} /><Grids d={d} /><Pressure d={d} /></>}
          {tab === "growth" && <><Growth d={d} /><Fills d={d} /><div className="drawers"><LargestDrawer rows={d.fills.largest} /></div></>}
          {tab === "cache" && <><CostSection d={d} /><div className="drawers"><BreaksDrawer cost={d.cost} /></div></>}
        </Tabs>
      </>}
      <UsageSheets data={undefined} />
    </main>
  );
}
