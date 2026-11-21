import { memo, useMemo, useRef } from "react";
import { DataTable } from "../../components/DataTable";
import { sortRows, SortTh, type SortBy } from "../../components/Sort";
import { Toggletip } from "../../components/Toggletip";
import { dur, num as fmt } from "../../format";
import { tableFocus, useErrors } from "./context";
import { errorText } from "./marks";
import { subjectAttrs } from "../../components/menu/subject";
import { bucketLabel, bucketOf, compare, emptyTypes, MIN_PCT_ERRORS, RECOVERED_NOTE, typeRows, yearLabel, type TypeKey, type TypeRow } from "./model";
import { Spark } from "./Spark";

const ERRS = "Errors: the type's failed calls. Rate: its errors per 100 tool calls in the view. The bar is its share of the view's errors.";
const LOST = "Time lost: time in retry loops, from each incident's first failure to its last. An incident counts whole when any of its failures is in the view. "
  + `Not recovered: the share of the type's incidents whose outcome is not recovered. ${RECOVERED_NOTE}`;
const TREND = "Trend: the type's error rate over the range; a green tick marks the day its fix was applied. Change sorts by the change in error rate, "
  + "in points: the rate after minus the rate before, also for the counts shown as 0 → 48. Only – (no comparison) sorts last.";

/** The view's types in four columns that fit the master pane: the type with its marks; errors and rate with the share bar; time lost with
 *  the share not recovered; the rate trend with the change. By errors until a header sorts them (ties keep that order; a type with no
 *  value for the column comes last either way), narrowed by the filter box to the labels and ids that contain its text. The swatch ties a
 *  row to its chart layer; types folded into Other get Other's grey. A click anywhere on a row opens or closes the type (the type button's
 *  clicks and keys bubble to it). Its toolbar holds the subagent and noise toggles: they filter the whole page, and this is where their
 *  rows come and go. */
export const TypeTable = memo(function TypeTable() {
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
  // The table fits its pane at every width (a fixed layout), so a sorted header is never off to the side.
  const sort = setTypeSort;
  // Rows mount again when the filters change, so their share bars grow in.
  const key = JSON.stringify([f.start, v.project, v.source, v.sub, v.noise, v.gran, v.at]);
  // An empty table has no type button: the chart takes the focus.
  const clear = () => { update({ at: null }, true); after(() => tableFocus()?.focus()); };
  // A mute's feedback is the open detail's own; once the type has left the view the detail is gone, so it shows here.
  const pending = [...muting].filter(([c]) => c !== v.cat), failed = markErrors.filter(e => e.kind === "mute" && e.cat !== v.cat);
  return (
    <section className="panel types">
      <div className="row between">
        <h2>Error types</h2>
        {v.at && <button type="button" className="chip bucket" id="atClr" aria-label={`Selected: ${bucketLabel(m, v)}. Show the whole range`} onClick={clear}>{bucketLabel(m, v)} <span aria-hidden="true">✕</span></button>}
      </div>
      {(pending.length > 0 || failed.length > 0) && <div id="muteNote">
        {pending.map(([c, on]) => <div key={c} className="muted xs mb8">{on ? "Muting" : "Unmuting"} {name(c)}… Saving…</div>)}
        {failed.map(e => <div key={e.cat} className="outnote"><span className="fixerr">{e.unknown ? errorText(e, name(e.cat)) : e.mute === false ? `Could not unmute ${name(e.cat)}. It is still muted.` : `Could not mute ${name(e.cat)}. It is back in the list.`}</span> <button type="button" onClick={() => { dismissError(e.cat, "mute"); after(() => tableFocus()?.focus()); }}>Dismiss</button></div>)}
      </div>}
      <div className="hint muted xs mb8">{v.at && <>With a {v.gran} selected, the types, Errors, Rate, the share, Time lost and Not recovered follow it; Trend and Change stay range-wide. </>}Change: the type's error rate {cmp}, as in the summary; counts when either side has under {MIN_PCT_ERRORS} errors. Click a row for fixes and examples.</div>
      <div className="ttools">
        {(all.length > 0 || typeQ !== "") && <div className="tfilter">
          <input type="search" ref={box} aria-label="Filter types" placeholder="Filter types…" value={typeQ} onChange={e => filter(e.target.value)} />
          <span id="typeCount" className="muted">{count(typeQ)}</span></div>}
        {/* The view's toggles: they filter the summary and the chart too, and keep their URL keys (sub, noise). */}
        <div className="row tchecks">
          <label className="chk"><input type="checkbox" id="fSub" checked={v.sub} onChange={e => update({ sub: e.target.checked }, true)} /> <span><span className="long">Include </span>subagents</span></label>
          <span className="row nowrap"><label className="chk"><input type="checkbox" id="fNoise" checked={v.noise} onChange={e => update({ noise: e.target.checked }, true)} /> <span>Hide noise and muted</span></label>
            <Toggletip term="hiding noise and muted types">Leaves out harness errors, user rejections and the types you muted</Toggletip></span>
        </div>
      </div>
      <DataTable name="Error types" region="tscroll">
        <colgroup><col className="c-type" /><col className="c-n" /><col className="c-lost" /><col className="c-trend" /></colgroup>
        <thead><tr>
          <SortTh k="type" sort={typeSort} onSort={sort} asc>Type</SortTh>
          <SortCol cls="num c-n" sort={typeSort} onSort={sort} keys={[["n", "Errors"], ["rate", "Rate"]]} tip={ERRS} />
          <SortCol cls="num c-lost" sort={typeSort} onSort={sort} keys={[["lost", "Time lost"], ["unrec", "Not recovered"]]} tip={LOST} />
          <SortCol cls="num c-trend" sort={typeSort} onSort={sort} head="Trend" keys={[["change", "Change"]]} tip={TREND} />
        </tr></thead>
        <tbody id="catBody">
          {rows.length ? rows.map(({ cid, n, lost, rate, inc, bad, unrec, share, color, pts, delta }) => {
            const fix = fixes[cid], tick = fix ? pts.findIndex(p => p.k === bucketOf(fix, v.gran)) : -1, isMuted = m.muted.has(cid);
            return <tr key={cid + key} data-c={cid} {...subjectAttrs("category", cid)} className={(v.cat === cid ? "sel " : "") + (isMuted ? "is-muted" : "")} onClick={() => pick(v.cat === cid ? null : cid, v.cat !== cid)}>
              <td className="c-type"><button type="button" className="tbtn" data-c={cid} aria-expanded={v.cat === cid} aria-controls="detail">
                <i className="sw" style={{ background: color }} aria-hidden="true" />{m.cats[cid]!.label}</button>
                {isMuted || fix ? <span className="marks">{isMuted ? <span className="chip muted-type">Muted</span> : null}
                  {fix ? <span className="chip fixed">✓ Fix applied {yearLabel(m, fix)}</span> : null}</span> : null}</td>
              <td className="num c-n"><div className="l1"><b className="c-count">{fmt(n)}</b> <span className="c-rate">{rate == null ? "–" : `${fmt(rate, 2)}%`}</span></div>
                <div className="share c-share"><div className="bar" aria-hidden="true"><i style={{ width: `${share * 100}%`, background: color }} />
                  {share < .03 ? <b className="tick" style={{ background: color }} /> : null}</div><span>{fmt(share * 100, share < .01 ? 1 : 0)}%<span className="sr"> of errors</span></span></div></td>
              <td className="num c-lost"><div className="l1">{lost ? dur(lost / 1000) : "–"}</div>
                <div className="l2 c-unrec">{unrec == null ? "–" : `${fmt(unrec, 0)}% not recovered`}{inc > 0 && <span className="sr">, {fmt(bad)} of {fmt(inc)} incident{inc === 1 ? "" : "s"}</span>}</div></td>
              <td className="num c-trend"><Spark pts={pts} marks={tick >= 0 ? [tick] : []} />
                <div className={"l2 c-change " + delta.cls}>{delta.text}{delta.title && <span className="sr">. {delta.title}</span>}{tick >= 0 && <span className="sr">. The trend marks the fix.</span>}</div></td>
            </tr>;
          }) : <tr><td colSpan={4} className="empty">{all.length ? `No types match “${typeQ.trim()}”.` : emptyTypes(m, v, f)}{typeQ !== "" && <> <button type="button" onClick={() => { filter(""); box.current?.focus(); }}>Clear filter</button></>}</td></tr>}
        </tbody>
      </DataTable>
    </section>
  );
});

/** A header that sorts its column by one figure or another, each a button on its own line (head: a plain label above them). The header
 *  carries aria-sort while either sorts the table; the sorting button carries its arrow. One toggletip explains the column. */
function SortCol({ cls, sort, onSort, keys, head, tip }: {
  cls: string; sort: SortBy<TypeKey>; onSort: (s: SortBy<TypeKey>) => void; keys: [TypeKey, string][]; head?: string; tip: string;
}) {
  const on = keys.find(([k]) => k === sort.key);
  const tt = <Toggletip term={head ?? keys[0]![1]}>{tip}</Toggletip>;
  return <th scope="col" className={cls} aria-sort={on ? (sort.desc ? "descending" : "ascending") : undefined}>
    {head && <div className="sk"><span className="hd">{head}</span>{tt}</div>}
    {keys.map(([k, label], i) => {
      const cur = sort.key === k;
      return <div key={k} className="sk">
        <button type="button" className={"sortbtn" + (cur ? " on" : "")} data-sort={k} onClick={() => onSort({ key: k, desc: cur ? !sort.desc : true })}>{label}
          <span className="sortmark" aria-hidden="true">{cur ? (sort.desc ? "↓" : "↑") : ""}</span></button>
        {i === 0 && !head && tt}
      </div>;
    })}
  </th>;
}
