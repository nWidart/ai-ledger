import { useEffect } from "react";
import { contextUrl, viewOf, type ContextPayload, type TipId } from "../../api";
import { setOrder } from "../../colors";
import { agentName, Filters, viewName } from "../../components/Filters";
import { InsightCard } from "../../components/InsightCard";
import { ProjectDot } from "../../components/ProjectDot";
import { SectionIndex } from "../../components/SectionIndex";
import { UsageSheets } from "../../components/sheets/UsageSheets";
import { useLanding } from "../../components/useLanding";
import { num, plural } from "../../format";
import { setHash, useHashState } from "../../hash";
import { useApi } from "../../useApi";
import { rebuildFacts, share } from "./context";
import { BreaksDrawer, LargestDrawer } from "./drawers";
import { CostSection, Fills, Growth, Pressure, Starting } from "./sections";
import { tipInsight, TipSessions } from "./tips";
import "./context.css";

/** The heading answers "how much context do sessions start with?": the view's median start, its share of the window and the
 *  sessions that compacted. Every source reads "session", never one agent's name. */
function Lede({ d }: { d: ContextPayload }) {
  const s = d.starting, c = d.coverage;
  const where = d.project ? <> in <span className="proj"><ProjectDot project={d.project} />{d.project}</span></> : null;
  if (s.median == null) return <h1 className="lede" id="lede" tabIndex={-1} aria-live="polite">No {agentName(d.source)} session{where} with a measured start {d.range ? `in the last ${d.range} days` : "yet"}.</h1>;
  return <>
    <h1 className="lede" id="lede" tabIndex={-1} aria-live="polite">A typical session{where} starts with <span className="amt">{num(s.median)} tokens</span> of context
      {s.window_share != null && <>, <span className="unit">{share(s.window_share)} of its window</span></>}.
      <span className="delta">{c.compacted ? `${num(c.compacted)} of ${plural(c.sessions, "session")} compacted.` : "No session compacted."}</span></h1>
    <p className="sub">The prompt tokens of each session's first turn, over {plural(s.sessions, "session")} with a measured start. Nothing is read from <code>CLAUDE.md</code>, <code>AGENTS.md</code> or any
      configuration file; every figure comes from the transcripts. Token figures taken from tool result sizes are estimates.</p>
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

/** Context (/context): how much of the model's window sessions start with, how fast it grows, what fills it, what that costs,
 *  and the tips those figures give. Every source maps onto the same figures. */
export function ContextPage() {
  const [h] = useHashState();
  const want = viewOf(h), url = contextUrl(want);
  const { data: d, error, loading, retry } = useApi<ContextPayload>(url, { keepPrevious: true });
  useEffect(() => { if (d) setOrder(d.project_order); }, [d]);
  const { slow, grow, wrap, retryBtn } = useLanding(d, url, loading, error, ":scope > :is(.panel, .tips, .drawers)");
  // A tip the payload does not have (an old link, another view) shows nothing.
  const tip = d?.tips.find(t => t.id === h.raw.tip);
  const openTip = (id: TipId) => setHash({ tip: id }, { push: true });
  const closeTip = () => setHash({ tip: null }, { push: false });
  const cls = "wrap pg-context" + (slow ? " loading" : "") + (grow ? " grow" : "");

  return (
    <main id="content" className={cls} ref={wrap} aria-busy={loading || undefined}>
      <header className="top sect" id="overview">
        <div>{d ? <Lede d={d} /> : <h1 className="lede" id="lede" tabIndex={-1}>{error ? "Context could not be loaded." : "Loading context…"}</h1>}</div>
        <div className="top-side"><Filters projects={d?.projects ?? []} automated autoFile={d?.automated_file.path} /></div>
      </header>
      {error && <div className="banner" role="alert"><b>Could not load {viewName(want)} ({error.message}).{d ? ` Still showing ${viewName(d)}.` : ""}</b>{" "}
        <button type="button" className="linkish" ref={retryBtn} onClick={retry}>Retry</button></div>}
      <p className="pending">{loading && d ? `Loading ${viewName(want)}…` : ""}</p>
      {d && <>
        <RebuildNotice d={d} />
        <SectionIndex groups={[
          [{ id: "overview", label: "Overview" }, { id: "tips", label: "Tips" }, { id: "starting", label: "Start", long: "Starting context" }, { id: "growth", label: "Growth" }, { id: "pressure", label: "Pressure", long: "Window pressure" },
            { id: "fills", label: "Fills", long: "What fills context" }, { id: "cost", label: "Spend", long: "Cost" }],
          [{ id: "d-largest", label: "Results", long: "Largest tool results" }, { id: "d-breaks", label: "Cache breaks", long: "Sessions where caching broke" }],
        ]} />
        <section className="tips sect" id="tips" aria-labelledby="tipsTitle">
          <h2 id="tipsTitle">Tips</h2>
          <div className="hint">From fixed rules over this view's figures: thresholds are set in the app, and nothing is learned or generated. Most severe first.</div>
          {d.tips.length
            ? <div className="insights">{d.tips.map(t => <InsightCard key={t.id} primary insight={tipInsight(t, openTip)} />)}</div>
            : <p className="empty">Nothing stands out in this view.</p>}
        </section>
        {tip && <div className="drawers tip-drawer"><TipSessions tip={tip} onClose={closeTip} /></div>}
        <Starting d={d} />
        <Growth d={d} />
        <Pressure d={d} />
        <Fills d={d} />
        <CostSection d={d} />
        <div className="drawers"><LargestDrawer rows={d.fills.largest} /><BreaksDrawer cost={d.cost} /></div>
      </>}
      <UsageSheets data={undefined} />
    </main>
  );
}
