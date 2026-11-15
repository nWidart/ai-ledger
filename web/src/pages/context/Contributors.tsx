import { useState } from "react";
import type { ContextPayload, FillRow } from "../../api";
import { DataTable } from "../../components/DataTable";
import { openToolSheet, pickRow } from "../../components/sheets/session";
import { num } from "../../format";
import { Est } from "./cells";
import { RESULT_LARGE_BYTES, bytes, share } from "./context";
import "./Contributors.css";

type Fills = ContextPayload["fills"];
type Kind = "tool" | "mcp";

/** The rows the chart names; the rest fold into "Other". */
export const TOP_ROWS = 10;

/** Where `v` sits on a log scale from `lo` to `hi`, as 0 to 1 (clamped). Equal ratios are equal distances. */
export function logPos(v: number, lo: number, hi: number): number {
  if (!(hi > lo) || lo <= 0) return 0;
  return Math.min(1, Math.max(0, (Math.log(Math.max(v, lo)) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))));
}

/** The shared range scale: a power of ten at or below the smallest median and at or above the largest 95th percentile, always spanning the large-result line. */
export function rangeScale(rows: { p50_bytes: number | null; p95_bytes: number | null }[]): { lo: number; hi: number } {
  const p50 = rows.flatMap(r => (r.p50_bytes != null && r.p95_bytes != null ? [Math.max(1, r.p50_bytes)] : []));
  const p95 = rows.flatMap(r => (r.p50_bytes != null && r.p95_bytes != null ? [Math.max(1, r.p95_bytes)] : []));
  const lo = 10 ** Math.floor(Math.log10(Math.min(...p50, RESULT_LARGE_BYTES)) + 1e-9);
  let hi = 10 ** Math.ceil(Math.log10(Math.max(...p95, RESULT_LARGE_BYTES)) - 1e-9);
  if (hi <= lo) hi = lo * 10;
  return { lo, hi };
}

/** The ten largest rows and one folded "Other" row (a total, no range) when there are more. */
function ranked(rows: FillRow[], kind: Kind): { name: string; row: FillRow; other: boolean }[] {
  const top = rows.slice(0, TOP_ROWS).map(row => ({ name: row.name, row, other: false }));
  const rest = rows.slice(TOP_ROWS);
  if (!rest.length) return top;
  const sum = (f: (r: FillRow) => number) => rest.reduce((s, r) => s + f(r), 0);
  const noun = kind === "mcp" ? (rest.length === 1 ? "MCP server" : "MCP servers") : rest.length === 1 ? "tool" : "tools";
  const row: FillRow = { name: "Other", calls: sum(r => r.calls), with_bytes: sum(r => r.with_bytes), bytes: sum(r => r.bytes), est_tokens: sum(r => r.est_tokens), p50_bytes: null, p95_bytes: null, max_bytes: null };
  return [...top, { name: `Other (${rest.length} ${noun})`, row, other: true }];
}

/** Main-thread and subagent results as the two parts of one bar. */
function Split({ main, sub }: { main: number; sub: number }) {
  const all = main + sub;
  return (
    <div className="ctr-split">
      <div className="ctr-split-bar" aria-hidden="true">
        <span className="ctr-main" data-testid="ctr-main" style={{ width: `${main / all * 100}%` }} />
        <span className="ctr-sub" data-testid="ctr-sub" style={{ width: `${sub / all * 100}%` }} />
      </div>
      <ul className="ctr-split-legend">
        <li><i className="ctr-key ctr-main" aria-hidden="true" /> Main thread: <b>{bytes(main)}</b> ({share(main / all)}), <Est tokens={Math.floor(main / 4)} /></li>
        <li><i className="ctr-key ctr-sub" aria-hidden="true" /> Subagents: <b>{bytes(sub)}</b> ({share(sub / all)})</li>
      </ul>
    </div>
  );
}

/** What fills context: the main-thread and subagent split, then the ten largest tools or MCP servers by total size, each beside the range of its typical result. */
export function Contributors({ fills }: { fills: Fills }) {
  const [pick, setPick] = useState<Kind>("tool");
  const hasMcp = fills.mcp.length > 0, kind: Kind = hasMcp ? pick : "tool";
  const list = kind === "mcp" ? fills.mcp : fills.tools;
  const rows = ranked(list, kind);
  const max = Math.max(...rows.map(r => r.row.bytes), 1);
  const { lo, hi } = rangeScale(rows.map(r => r.row));
  const at = (v: number) => `${logPos(v, lo, hi) * 100}%`;
  const noun = kind === "mcp" ? "MCP server" : "Tool";
  return (
    <div className="contributors">
      {fills.main_bytes + fills.subagent_bytes > 0 && <>
        <Split main={fills.main_bytes} sub={fills.subagent_bytes} />
        <p className="hint">Results of calls made inside subagent transcripts never entered the main thread's context.</p>
      </>}
      {hasMcp && <div className="seg ctr-switch" role="group" aria-label="Group tool results">
        {(["tool", "mcp"] as const).map(k => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setPick(k)}>{k === "tool" ? "By tool" : "By MCP server"}</button>)}
      </div>}
      {rows.length === 0 ? <p className="empty">No tool result with a known size in this view.</p> :
        <DataTable name={`Largest contributors ${kind === "mcp" ? "by MCP server" : "by tool"}`} className="ctr-table">
          <thead><tr>
            <th scope="col">{noun}</th>
            <th scope="col" className="ctr-total">Total result size
              <span className="ctr-scale" aria-hidden="true"><span>0</span><span>{bytes(max)}</span></span></th>
            <th scope="col" className="ctr-range">Typical result: median to 95th percentile (log scale)
              <span className="ctr-scale" aria-hidden="true"><span>{bytes(lo)}</span><span>dashed: {bytes(RESULT_LARGE_BYTES)}</span><span>{bytes(hi)}</span></span></th>
          </tr></thead>
          <tbody>{rows.map(({ name, row, other }) => {
            const range = row.p50_bytes != null && row.p95_bytes != null ? { p50: Math.max(1, row.p50_bytes), p95: Math.max(1, row.p95_bytes) } : null;
            return <tr key={name} {...(other ? {} : pickRow(name, v => openToolSheet(kind, v)))}>
              <th scope="row" className="name">{other ? name : <button type="button" className="cellbtn" title={name}>{name}</button>}</th>
              <td className="ctr-total">
                <span className="ctr-bar" aria-hidden="true"><i data-testid="ctr-total-bar" style={{ width: `${Math.max(1, row.bytes / max * 100)}%` }} /></span>
                <span className="ctr-fig">{bytes(row.bytes)} <span className="muted">· <Est tokens={row.est_tokens} /></span></span>
              </td>
              <td className="ctr-range">
                <span className="ctr-track" aria-hidden="true">
                  {range && <span className="ctr-rbar" data-testid="ctr-range-bar" style={{ left: at(range.p50), width: `${Math.max(.6, (logPos(range.p95, lo, hi) - logPos(range.p50, lo, hi)) * 100)}%` }} />}
                  {range && <span className="ctr-med" style={{ left: at(range.p50) }} />}
                  <span className="ctr-mark" data-testid="ctr-mark" style={{ left: at(RESULT_LARGE_BYTES) }} />
                </span>
                <span className="ctr-fig muted">{range ? `median ${bytes(row.p50_bytes)} · 95th ${bytes(row.p95_bytes)}` : other ? `${num(row.calls)} calls` : "no result size"}</span>
              </td>
            </tr>;
          })}</tbody>
        </DataTable>}
    </div>
  );
}
