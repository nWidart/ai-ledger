import { memo, type ReactNode } from "react";
import { agentName } from "../../components/Filters";
import { HowMeasured } from "../../components/HowMeasured";
import { ProjectDot } from "../../components/ProjectDot";
import { num as fmt } from "../../format";
import { useErrors } from "./context";
import { label, summary } from "./model";

const Vital = ({ v, l, note, cls = "" }: { v: ReactNode; l: string; note: string; cls?: string }) => (
  <div className="vital"><div className={"v " + cls}>{v}</div><div className="l">{l}</div><div className="d">{note}</div></div>
);
/** A share as a percent: 0 decimals, 1 under 1% (so 0.4% is not 0%). */
const pct = (x: number) => { const p = x * 100; return fmt(p, p > 0 && p < 1 ? 1 : 0) + "%"; };
const UNCAT_HOW = "The share of errors in the catch-all types, Other, Other non-zero exit and MCP tool error: the errors no specific rule matched.";

/** The briefing (the period's answer as one sentence), the date span, the uncategorized share and the vitals. Every width shows all of
 *  them, as on the other pages: a narrow screen puts the vitals two to a row. */
export const Summary = memo(function Summary() {
  const { m, v, f, fixes } = useErrors(), s = summary(m, v, f, fixes);
  const { totalCalls, n, r, r0, r1, d, cmp, why, top, vt, inc, uncat } = s, idle = !totalCalls;
  // The split names each agent only when the view shows several; a source filter already names one.
  const split = !v.source && uncat.bySource.length > 1 ? ` (${uncat.bySource.map(([src, , sh]) => `${agentName(src)} ${pct(sh)}`).join(", ")})` : "";
  const where = v.project ? <> in <b><ProjectDot project={v.project} />{v.project}</b></> : null;
  // The last ingest is the navigation's to show.
  const gen = v.range ? `${label(f.start, true)} to ${label(m.lastDay, true)}` : `All time to ${label(m.lastDay, true)}`;
  const types = Object.keys(vt.counts).length;
  // The lede holds two figures, the failed calls and their rate; the change and the top type are vitals.
  return <>
    <h1 className="lede" id="lede" tabIndex={-1}>
      {!totalCalls ? <>No tool calls{where} in this period.</>
        : !n ? <><b>No failed tool calls</b>{where} out of {fmt(totalCalls)}.</>
        : <><b>{fmt(n)}</b> failed tool call{n === 1 ? "" : "s"}{where} (<b>{fmt(r, 1)}%</b>).</>}
    </h1>
    <p className="sub" id="gen">{gen}</p>
    {n ? <p className="sub" id="uncat"><span className="uncat-v">{`Uncategorized: ${pct(uncat.share)} of errors${split}`}</span>
      <HowMeasured what="uncategorized">{UNCAT_HOW}</HowMeasured></p> : null}
    <section className="vitals" id="kpis" aria-label="Summary">
      <Vital v={d == null ? "–" : `${d > 0 ? "+" : ""}${fmt(d, 0)}%`} l="Change" cls={d == null ? "" : d < -1 ? "delta-down" : d > 1 ? "delta-up" : ""}
        note={idle ? "No tool calls in this period." : why ? `${why}, nothing to compare.` : r0 == null || r1 == null ? "Not enough calls to compare." : `Error rate ${cmp}: ${fmt(r0, 1)}% → ${fmt(r1, 1)}%.`} />
      <Vital v={n ? fmt(inc.n) : "–"} l="Incidents" note={n ? `${fmt(n)} error${n === 1 ? "" : "s"} in ${fmt(inc.n)} incident${inc.n === 1 ? "" : "s"}, ${fmt(inc.pct, 0)}% did not recover. ${fmt(types)} error types.` : "No errors in this period."} />
      <Vital v={top ? m.cats[top]!.label : "–"} l="Top type" cls="txt" note={top ? `${fmt(vt.counts[top]! / n * 100, 0)}% of errors.` : "No errors in this period."} />
      <Vital v={fmt(s.nFix)} l="Fixes applied" note={`${fmt(s.withFix)} open type${s.withFix === 1 ? " has" : "s have"} a ready-made fix.`} />
    </section>
  </>;
});
