import { useState, type ReactNode } from "react";
import { agentName } from "../../components/Filters";
import { ProjectDot } from "../../components/ProjectDot";
import { num as fmt } from "../../format";
import { useErrors } from "./context";
import { label, RECOVERED_NOTE, summary } from "./model";

const Vital = ({ v, l, note, cls = "" }: { v: ReactNode; l: string; note: string; cls?: string }) => (
  <div className="vital"><div className={"v " + cls}>{v}</div><div className="l">{l}</div><div className="d">{note}</div></div>
);
/** A share as a percent: 0 decimals, 1 under 1% (so 0.4% is not 0%). */
const pct = (x: number) => { const p = x * 100; return fmt(p, p > 0 && p < 1 ? 1 : 0) + "%"; };
const UNCAT_TITLE = "Share of errors in catch-all types (Other, Other non-zero exit, MCP tool error): errors no specific rule matched";

/** The briefing (the period's answer as one sentence) and the vitals; on a phone the rest of the summary waits behind More. */
export function Summary() {
  const { m, v, f, fixes } = useErrors(), s = summary(m, v, f, fixes), [more, setMore] = useState(false);
  const { totalCalls, n, r, r0, r1, d, cmp, why, top, vt, inc, uncat } = s, idle = !totalCalls;
  // The split names each agent only when the view shows several; a source filter already names one.
  const split = !v.source && uncat.bySource.length > 1 ? ` (${uncat.bySource.map(([src, , sh]) => `${agentName(src)} ${pct(sh)}`).join(", ")})` : "";
  const arrow = d == null ? null : Math.abs(d) < 1 ? `, flat ${cmp}` : <>, <span className={d < 0 ? "dn" : "up"}>{d < 0 ? "↓" : "↑"}{fmt(Math.abs(d), 0)}%</span> {cmp}</>;
  const where = v.project ? <> in <b><ProjectDot project={v.project} />{v.project}</b></> : null;
  const gen = (v.range ? `${label(f.start, true)} to ${label(m.lastDay, true)}` : `All time to ${label(m.lastDay, true)}`)
    + (m.data.generated ? ` · Ingested ${new Date(m.data.generated).toLocaleString()}` : "");
  const types = Object.keys(vt.counts).length;
  return <>
    <h1 className="lede" id="lede" tabIndex={-1}>
      {!totalCalls ? <>No tool calls{where} in this period.</>
        : !n ? <><b>No failed tool calls</b>{where} out of {fmt(totalCalls)}.</>
        : <><b>{fmt(n)}</b> failed tool call{n === 1 ? "" : "s"}{where} (<b>{fmt(r, 1)}%</b>){arrow}.
          {top ? <> <b>{m.cats[top]!.label}</b> is {fmt(vt.counts[top]! / n * 100, 0)}% of them.</> : null}</>}
    </h1>
    <p className={"sub folded" + (more ? " open" : "")} id="gen">{gen}</p>
    {n ? <p className={"sub folded" + (more ? " open" : "")} id="uncat" title={UNCAT_TITLE}>{`Uncategorized: ${pct(uncat.share)} of errors${split}`}</p> : null}
    <section className={"vitals" + (more ? " open" : "")} id="kpis" aria-label="Summary">
      <Vital v={idle ? "–" : fmt(r, 1) + "%"} l="Error rate" note={idle ? "No tool calls in this period." : `${fmt(n)} of ${fmt(totalCalls)} tool calls failed.`} />
      <Vital v={d == null ? "–" : `${d > 0 ? "+" : ""}${fmt(d, 0)}%`} l="Change" cls={d == null ? "" : d < -1 ? "delta-down" : d > 1 ? "delta-up" : ""}
        note={why ? `${why}, nothing to compare.` : r0 == null || r1 == null ? "Not enough calls to compare." : `Error rate ${cmp}: ${fmt(r0, 1)}% → ${fmt(r1, 1)}%.`} />
      <Vital v={n ? fmt(inc.n) : "–"} l="Incidents" note={n ? `${fmt(n)} error${n === 1 ? "" : "s"} in ${fmt(inc.n)} incident${inc.n === 1 ? "" : "s"}, ${fmt(inc.pct, 0)}% didn't recover. ${RECOVERED_NOTE} ${fmt(types)} error types.` : "No errors in this period."} />
      <Vital v={fmt(s.nFix)} l="Fixes applied" note={`${fmt(s.withFix)} open type${s.withFix === 1 ? " has" : "s have"} a ready-made fix.`} />
    </section>
    <button type="button" className="linkbtn moresum" id="moreSum" aria-expanded={more} aria-controls="kpis gen uncat" onClick={() => setMore(o => !o)}>
      {more ? "Less summary" : "More summary"}
    </button>
  </>;
}
