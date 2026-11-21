import type { Totals } from "../../api";
import { ChartTable, DataTable } from "../../components/DataTable";
import { num, pct } from "../../format";
import { kindCost, tokenPairs, type TokenPair } from "./cost";

/** A dollar figure to the cent, for the exact table ($10.49, not $10). */
const cents = (n: number | null) => (n == null ? "–" : "$" + num(n, 2));

/** One sentence above the chart: the kind whose share of tokens and share of cost are furthest apart (the costliest on a tie), however
 *  close; or why no kind has a share of cost (no request priced, or the priced ones cost nothing). */
function lede(pairs: readonly TokenPair[], cost: number | null, reported: boolean): string {
  if (cost == null) return reported ? "No request in this view is priced from the price table, so each kind's share of cost is unknown."
    : "No request in this view is priced, so each kind's share of cost is unknown.";
  if (cost === 0) return "The priced requests in this view cost $0.00, so no kind has a share of estimated cost.";
  const far = pairs.reduce((b, p) => (gap(p) > gap(b) + TIE ? p : b));
  return `${far.label} is ${pct(far.tokenShare, 1)} of tokens and ${pct(far.costShare, 1)} of estimated cost.`;
}
const gap = (p: TokenPair) => Math.abs(p.tokenShare - (p.costShare ?? 0));
/** Gaps closer than this are a tie, so a float's rounding (0.7 − 0.6 against 0.4 − 0.3) does not pass over the costlier kind. */
const TIE = 1e-9;

/** A share as a bar: no fill at 0, so an empty track reads as 0.0%. */
const fill = (share: number | null, c: string) => (share ? <i style={{ width: `${share * 100}%`, background: c }} /> : null);

/** Each billed token kind's share of tokens beside its share of estimated cost: a bar to the left of the kind's name for tokens and a
 *  bar to the right for cost, each on its own 0 to 100% scale, with the shares as text. The bars are a picture of the figures: each row
 *  reads as one sentence, and the data table holds the exact tokens and cost. t: the view's or a project's totals. */
export function TokenPairs({ t }: { t: Totals }) {
  const pairs = tokenPairs(t), est = kindCost(t), reported = (t.cost ?? 0) - (est ?? 0);
  // A cost the agent reported (Grok) has no split by kind: said when it is at least a cent, so the breakdown is not read as the whole cost.
  const out = reported >= 0.005;
  return (
    <div className="tpairs">
      <div className="hint">{lede(pairs, est, out)}</div>
      {out && <p className="hint">{cents(reported)} of this view's {cents(t.cost)} is the cost Grok reported, with no split by kind, so it is not in this breakdown.</p>}
      <div className="tp-head" aria-hidden="true"><span>Share of tokens</span><span /><span>Share of estimated cost</span></div>
      <ul className="tp-chart" aria-label="Share of tokens beside share of estimated cost, by kind">
        {pairs.map(p => <li key={p.key} className="tp-row">
          <span className="sr">{p.label}: {pct(p.tokenShare, 1)} of tokens, {p.costShare == null ? "cost unknown" : `${pct(p.costShare, 1)} of estimated cost`}</span>
          <span className="tp-l" aria-hidden="true"><b>{pct(p.tokenShare, 1)}</b><span className="tp-bar">{fill(p.tokenShare, p.c)}</span></span>
          <span className="tp-name" aria-hidden="true"><i style={{ background: p.c }} />{p.label}</span>
          <span className="tp-r" aria-hidden="true"><span className="tp-bar">{fill(p.costShare, p.c)}</span><b>{pct(p.costShare, 1)}</b></span>
        </li>)}
      </ul>
      <ChartTable><DataTable name="Tokens and estimated cost by kind" region="scroll">
        <thead><tr><th scope="col">Kind</th><th scope="col" className="num">Tokens</th><th scope="col" className="num">Share of tokens</th>
          <th scope="col" className="num">Est. cost</th><th scope="col" className="num">Share of cost</th></tr></thead>
        <tbody>{pairs.flatMap(p => [
          <tr key={p.key}><th scope="row">{p.label}</th><td className="num">{num(p.tokens)}</td><td className="num">{pct(p.tokenShare, 1)}</td>
            <td className="num">{cents(p.cost)}</td><td className="num">{pct(p.costShare, 1)}</td></tr>,
          ...p.parts.map(x => <tr key={p.key + x.label} className="part"><th scope="row">{x.label}{p.key === "output" ? " (in output)" : " cache write"}</th><td className="num">{num(x.tokens)}</td>
            <td className="num" /><td className="num">{x.cost == null ? "" : cents(x.cost)}</td><td className="num" /></tr>),
        ])}</tbody>
      </DataTable></ChartTable>
    </div>
  );
}
