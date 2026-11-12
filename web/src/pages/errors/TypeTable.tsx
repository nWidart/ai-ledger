import { num as fmt } from "../../format";
import { useErrors } from "./context";
import { bucketLabel, compare, emptyTypes, MIN_PCT_ERRORS, typeRows, yearLabel } from "./model";
import { Spark } from "./Spark";

/** The view's types by count. The swatch ties a row to its chart layer; types folded into Other get Other's grey. A badge only
 *  once a fix is applied. A click anywhere on a row opens or closes the type (the type button's clicks and keys bubble to it). */
export function TypeTable() {
  const { m, v, f, fixes, pick, update, after } = useErrors(), rows = typeRows(m, v, f), { cmp } = compare(m, v, f);
  // Rows mount again when the filters change, so their share bars grow in.
  const key = JSON.stringify([f.start, v.project, v.source, v.sub, v.noise, v.gran, v.at]);
  // An empty table has no type button: the chart takes the focus.
  const clear = () => { update({ at: null }, true); after(() => (document.querySelector<HTMLElement>("#catBody button") ?? document.getElementById("chart"))?.focus()); };
  return (
    <section className="card types">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2>Error types</h2>
        {v.at && <button type="button" className="chip bucket" id="atClr" aria-label={`Selected: ${bucketLabel(m, v)}. Show the whole range`} onClick={clear}>{bucketLabel(m, v)} <span aria-hidden="true">✕</span></button>}
      </div>
      <div className="hint muted" style={{ fontSize: 12, marginBottom: 8 }}>{v.at && <>Types, errors and share count only the selected {v.gran}; the trend and change stay range-wide. </>}Change: the type's error rate {cmp}, as in the summary; counts when either side has under {MIN_PCT_ERRORS} errors. Click a row for fixes and examples.</div>
      <div className="tscroll"><table>
        <thead><tr><th>Type</th><th className="num">Errors</th><th className="c-share">Share</th><th className="c-trend">Rate trend</th><th className="num">Change</th></tr></thead>
        <tbody id="catBody">
          {rows.length ? rows.map(({ cid, n, share, color, pts, delta }) => (
            <tr key={cid + key} data-c={cid} className={v.cat === cid ? "sel" : ""} onClick={() => pick(v.cat === cid ? null : cid, v.cat !== cid)}>
              <td><button type="button" className="tbtn" data-c={cid} aria-expanded={v.cat === cid} aria-controls="detail">
                <i className="sw" style={{ background: color }} aria-hidden="true" />{m.cats[cid]!.label}</button>
                {fixes[cid] ? <span className="chip fixed">✓ Fix applied {yearLabel(m, fixes[cid])}</span> : null}</td>
              <td className="num">{fmt(n)}</td>
              <td className="c-share"><div className="share"><div className="bar" aria-hidden="true"><i style={{ width: `${share * 100}%`, background: color }} />
                {share < .03 ? <b className="tick" style={{ background: color }} /> : null}</div><span>{fmt(share * 100, share < .01 ? 1 : 0)}%</span></div></td>
              <td className="c-trend"><Spark pts={pts} /></td>
              <td className={"num " + delta.cls} title={delta.title}>{delta.text}</td>
            </tr>
          )) : <tr><td colSpan={5} className="empty">{emptyTypes(m, v, f)}</td></tr>}
        </tbody>
      </table></div>
    </section>
  );
}
