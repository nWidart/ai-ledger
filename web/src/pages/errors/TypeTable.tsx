import { useMemo, useRef } from "react";
import { sortRows, SortTh, type SortBy } from "../../components/Sort";
import { num as fmt } from "../../format";
import { tableFocus, useErrors } from "./context";
import { errorText } from "./marks";
import { bucketLabel, compare, dur, emptyTypes, MIN_PCT_ERRORS, RECOVERED_NOTE, typeRows, yearLabel, type TypeKey, type TypeRow } from "./model";
import { Spark } from "./Spark";

const LOST = "Time in retry loops: from each incident's first failure to its last. An incident counts whole when any of its failures is in the view.";
const CHANGE = "Sorts by the change in error rate, in points: the rate after minus the rate before, also for the counts shown as 0 → 48. Only – (no comparison) sorts last.";
const UNREC = `The share of the type's incidents whose outcome is not recovered. ${RECOVERED_NOTE}`;
/** The view's types, by errors until a header sorts them (ties keep that order; a type with no value for the column comes last either way),
 *  narrowed by the filter box to the labels and ids that contain its text. The swatch ties a row to its chart layer; types folded into Other get Other's grey. A badge only
 *  once a fix is applied or the type is muted (a muted type's row is dimmed, with the word as well). A click anywhere on a row opens or closes the type (the type button's clicks and keys bubble to it). */
export function TypeTable() {
  const { m, v, f, fixes, pick, update, after, say, muting, markErrors, dismissError, typeSort, setTypeSort, typeQ, setTypeQ } = useErrors();
  // The rows and the comparison are the costly part and don't depend on the sort or the filter text: typing re-sorts memoized rows. They read
  // the view's filters and bucket (f follows the first five), the granularity (series), the open type (its color) and the subagent toggle.
  const { all, cmp } = useMemo(() => ({ all: typeRows(m, v, f), cmp: compare(m, v, f).cmp }), [m, f, v.project, v.source, v.range, v.sub, v.noise, v.gran, v.at, v.cat]);
  const name = (c: string) => m.cats[c]?.label ?? c, box = useRef<HTMLInputElement>(null);
  // A column with no value in a row (no time lost, no incident, no calls, no comparison: the cell shows –) sorts that row last either way.
  const get: Record<TypeKey, (r: TypeRow) => number | string | null> = { type: r => name(r.cid), n: r => r.n, lost: r => r.lost || null, rate: r => r.rate, unrec: r => r.unrec, change: r => r.delta.pts };
  const hit = (q: string) => { const l = q.trim().toLowerCase(); return (r: TypeRow) => !l || name(r.cid).toLowerCase().includes(l) || r.cid.toLowerCase().includes(l); };
  const rows = sortRows(all.filter(hit(typeQ)), get[typeSort.key], typeSort.desc);
  const count = (q: string) => { const t = `type${all.length === 1 ? "" : "s"}`; return q.trim() ? `${fmt(all.filter(hit(q)).length)} of ${fmt(all.length)} ${t}` : `${fmt(all.length)} ${t}`; };
  const filter = (q: string) => { setTypeQ(q); say(count(q)); };
  // A sorted column on a narrow screen may sit past the table's scroll: bring its header into view.
  const sort = (s: SortBy<TypeKey>) => { setTypeSort(s); after(() => document.querySelector(".types th[aria-sort] button")?.scrollIntoView?.({ block: "nearest", inline: "nearest" })); };
  const th = (k: TypeKey, label: string, cls?: string, title?: string, asc?: boolean) => <SortTh k={k} sort={typeSort} onSort={sort} asc={asc} className={cls} title={title}>{label}</SortTh>;
  // Rows mount again when the filters change, so their share bars grow in.
  const key = JSON.stringify([f.start, v.project, v.source, v.sub, v.noise, v.gran, v.at]);
  // An empty table has no type button: the chart takes the focus.
  const clear = () => { update({ at: null }, true); after(() => tableFocus()?.focus()); };
  // A mute's feedback is the open detail's own; once the type has left the view the detail is gone, so it shows here.
  const pending = [...muting].filter(([c]) => c !== v.cat), failed = markErrors.filter(e => e.kind === "mute" && e.cat !== v.cat);
  return (
    <section className="card types">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2>Error types</h2>
        {v.at && <button type="button" className="chip bucket" id="atClr" aria-label={`Selected: ${bucketLabel(m, v)}. Show the whole range`} onClick={clear}>{bucketLabel(m, v)} <span aria-hidden="true">✕</span></button>}
      </div>
      {(pending.length > 0 || failed.length > 0) && <div id="muteNote">
        {pending.map(([c, on]) => <div key={c} className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{on ? "Muting" : "Unmuting"} {name(c)}… Saving…</div>)}
        {failed.map(e => <div key={e.cat} className="outnote"><span className="fixerr">{e.unknown ? errorText(e, name(e.cat)) : e.mute === false ? `Couldn't unmute ${name(e.cat)}. It is still muted.` : `Couldn't mute ${name(e.cat)}. It is back in the list.`}</span> <button type="button" onClick={() => { dismissError(e.cat, "mute"); after(() => tableFocus()?.focus()); }}>Dismiss</button></div>)}
      </div>}
      <div className="hint muted" style={{ fontSize: 12, marginBottom: 8 }}>{v.at && <>With a {v.gran} selected, the types, Errors, Time lost, Rate, Didn't recover and Share follow it; Rate trend and Change stay range-wide. </>}Change: the type's error rate {cmp}, as in the summary; counts when either side has under {MIN_PCT_ERRORS} errors. Click a row for fixes and examples.</div>
      {(all.length > 0 || typeQ !== "") && <div className="tfilter">
        <input type="search" ref={box} aria-label="Filter types" placeholder="Filter types…" value={typeQ} onChange={e => filter(e.target.value)} />
        <span id="typeCount" className="muted">{count(typeQ)}</span></div>}
      <div className="tscroll"><table>
        <thead><tr>{th("type", "Type", undefined, undefined, true)}{th("n", "Errors", "num")}{th("lost", "Time lost", "num c-lost", LOST)}{th("rate", "Rate", "num c-rate", "Errors per 100 tool calls")}
          {th("unrec", "Didn't recover", "num c-unrec", UNREC)}<th className="c-share">Share</th><th className="c-trend">Rate trend</th>{th("change", "Change", "num", CHANGE)}</tr></thead>
        <tbody id="catBody">
          {rows.length ? rows.map(({ cid, n, lost, rate, inc, bad, unrec, share, color, pts, delta }) => (
            <tr key={cid + key} data-c={cid} className={(v.cat === cid ? "sel " : "") + (m.muted.has(cid) ? "is-muted" : "")} onClick={() => pick(v.cat === cid ? null : cid, v.cat !== cid)}>
              <td><button type="button" className="tbtn" data-c={cid} aria-expanded={v.cat === cid} aria-controls="detail">
                <i className="sw" style={{ background: color }} aria-hidden="true" />{m.cats[cid]!.label}</button>
                {m.muted.has(cid) ? <span className="chip muted-type">Muted</span> : null}
                {fixes[cid] ? <span className="chip fixed">✓ Fix applied {yearLabel(m, fixes[cid])}</span> : null}</td>
              <td className="num">{fmt(n)}</td>
              <td className="num c-lost" title={lost ? LOST : undefined}>{lost ? dur(lost) : "–"}</td>
              <td className="num c-rate">{rate == null ? "–" : `${fmt(rate, 2)}%`}</td>
              <td className="num c-unrec" title={inc ? `${fmt(bad)} of ${fmt(inc)} incident${inc === 1 ? "" : "s"}` : undefined}>{unrec == null ? "–" : `${fmt(unrec, 0)}%`}</td>
              <td className="c-share"><div className="share"><div className="bar" aria-hidden="true"><i style={{ width: `${share * 100}%`, background: color }} />
                {share < .03 ? <b className="tick" style={{ background: color }} /> : null}</div><span>{fmt(share * 100, share < .01 ? 1 : 0)}%</span></div></td>
              <td className="c-trend"><Spark pts={pts} /></td>
              <td className={"num " + delta.cls} title={delta.title}>{delta.text}</td>
            </tr>
          )) : <tr><td colSpan={8} className="empty">{all.length ? `No types match “${typeQ.trim()}”.` : emptyTypes(m, v, f)}{typeQ !== "" && <> <button type="button" onClick={() => { filter(""); box.current?.focus(); }}>Clear filter</button></>}</td></tr>}
        </tbody>
      </table></div>
    </section>
  );
}
