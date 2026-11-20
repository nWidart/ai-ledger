import type { Totals } from "../../api";
import { ChartTable, DataTable } from "../../components/DataTable";
import { big, pct, usd } from "../../format";
import { tokenPairs, type TokenPair } from "./cost";

/** The kind where the share of tokens and the share of cost are furthest apart, said in one sentence; none when they are all close
 *  (under 5 points) or no request is priced. */
function lede(pairs: readonly TokenPair[]): string | null {
  const priced = pairs.filter(p => p.costShare != null);
  const far = priced.reduce<TokenPair | null>((b, p) => (!b || gap(p) > gap(b) ? p : b), null);
  return far && gap(far) >= .05 ? `${far.label} is ${pct(far.tokenShare, 1)} of tokens and ${pct(far.costShare, 1)} of estimated cost.` : null;
}
const gap = (p: TokenPair) => Math.abs(p.tokenShare - (p.costShare ?? 0));

/** Each billed token kind's share of tokens beside its share of estimated cost: a bar to the left of the kind's name for tokens and a
 *  bar to the right for cost, each on its own 0 to 100% scale, with the shares as text. The bars are a picture of the figures: each row
 *  reads as one sentence, and the data table holds the exact tokens and cost. t: the view's or a project's totals. */
export function TokenPairs({ t }: { t: Totals }) {
  const pairs = tokenPairs(t), known = pairs.some(p => p.costShare != null), sentence = lede(pairs);
  return (
    <div className="tpairs">
      <div className="hint">{known ? sentence : "No request in this view is priced, so each kind's share of cost is unknown."}</div>
      <div className="tp-head" aria-hidden="true"><span>Share of tokens</span><span /><span>Share of estimated cost</span></div>
      <ul className="tp-chart" aria-label="Share of tokens beside share of estimated cost, by kind">
        {pairs.map(p => <li key={p.key} className="tp-row">
          <span className="sr">{p.label}: {pct(p.tokenShare, 1)} of tokens, {p.costShare == null ? "cost unknown" : `${pct(p.costShare, 1)} of estimated cost`}</span>
          <span className="tp-l" aria-hidden="true"><b>{pct(p.tokenShare, 1)}</b><span className="tp-bar"><i style={{ width: `${p.tokenShare * 100}%`, background: p.c }} /></span></span>
          <span className="tp-name" aria-hidden="true"><i style={{ background: p.c }} />{p.label}</span>
          <span className="tp-r" aria-hidden="true"><span className="tp-bar">{p.costShare != null && <i style={{ width: `${p.costShare * 100}%`, background: p.c }} />}</span>
            <b>{p.costShare == null ? "–" : pct(p.costShare, 1)}</b></span>
        </li>)}
      </ul>
      <ChartTable><DataTable name="Tokens and estimated cost by kind" region="scroll">
        <thead><tr><th scope="col">Kind</th><th scope="col" className="num">Tokens</th><th scope="col" className="num">Share of tokens</th>
          <th scope="col" className="num">Est. cost</th><th scope="col" className="num">Share of cost</th></tr></thead>
        <tbody>{pairs.flatMap(p => [
          <tr key={p.key}><th scope="row">{p.label}</th><td className="num">{big(p.tokens)}</td><td className="num">{pct(p.tokenShare, 1)}</td>
            <td className="num">{usd(p.cost)}</td><td className="num">{p.costShare == null ? "–" : pct(p.costShare, 1)}</td></tr>,
          ...p.parts.map(x => <tr key={p.key + x.label} className="part"><th scope="row">{x.label}{p.key === "output" ? " (in output)" : " cache write"}</th><td className="num">{big(x.tokens)}</td>
            <td className="num" /><td className="num">{x.cost == null ? "" : usd(x.cost)}</td><td className="num" /></tr>),
        ])}</tbody>
      </DataTable></ChartTable>
    </div>
  );
}
