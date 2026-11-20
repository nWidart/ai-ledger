// Context's tables behind drawers: the largest tool results and the sessions where caching broke.
import type { ContextPayload } from "../../api";
import { DataTable } from "../../components/DataTable";
import { Drawer } from "../../components/Drawer";
import { HowMeasured } from "../../components/HowMeasured";
import { openSessionSheet, pickRow, sessName, shortId } from "../../components/sheets/session";
import { num, usd, when } from "../../format";
import { Est, Proj, SourceName } from "./cells";
import { bytes, causesText } from "./context";

type D = ContextPayload;

/** A session's name as a button, with its short id under a title. row: the row's header cell (when it is the first). */
const SessionCell = ({ id, title, row }: { id: string; title: string | null; row?: boolean }) => {
  const body = <><button type="button" className="cellbtn" data-session={id} title={title || id}>{sessName({ session_id: id, title })}</button>
    {title && <div className="muted small">{shortId(id)}</div>}</>;
  return row ? <th scope="row" className="when sess">{body}</th> : <td className="when sess">{body}</td>;
};

/** The 25 largest main-thread tool results, each opening its session. */
export function LargestDrawer({ rows }: { rows: D["fills"]["largest"] }) {
  return (
    <Drawer id="d-largest" title="Largest tool results" count={num(rows.length)} description="The biggest results the main thread read, with the session that holds them">
      <div className="hint">Sizes are as the transcript stores them; estimated tokens are the bytes divided by 4. Select a row to open its session.</div>
      <DataTable name="Largest tool results" region="scroll tall">
        <thead><tr><th scope="col">Tool</th><th scope="col">Input</th><th scope="col" className="num">Size</th><th scope="col" className="num">Estimated tokens</th><th scope="col">When</th><th scope="col">Project</th><th scope="col">Session</th></tr></thead>
        <tbody>{rows.length ? rows.map(r => <tr key={r.id} {...pickRow(r.session_id, openSessionSheet, { kind: "session", value: r.session_id })}>
          <th scope="row" className="name" title={r.mcp_server ? `${r.tool} (MCP server ${r.mcp_server})` : r.tool}>{r.tool}{r.mcp_server && <div className="muted small">{r.mcp_server}</div>}</th>
          <td className="name input" title={r.input}>{r.input ? <code>{r.input}</code> : "–"}</td>
          <td className="num">{bytes(r.bytes)}</td><td className="num"><Est tokens={r.est_tokens} /></td><td className="when">{when(r.ts)}</td>
          <td className="name"><Proj project={r.project} /><div className="muted small"><SourceName source={r.source} /></div></td>
          <SessionCell id={r.session_id} title={r.title} /></tr>)
          : <tr><td colSpan={7} className="empty">No tool result with a known size in this view.</td></tr>}</tbody>
      </DataTable>
    </Drawer>
  );
}

/** Sessions with a cache break, most uncached tokens first. */
export function BreaksDrawer({ cost }: { cost: D["cost"] }) {
  const rows = cost.breaks;
  return (
    <Drawer id="d-breaks" title="Sessions where caching broke" count={num(cost.break_sessions)} description="Breaks by cause, with the uncached tokens they cost">
      <div className="hint">{cost.break_sessions > rows.length ? `Showing the ${num(rows.length)} with the most uncached tokens of ${num(cost.break_sessions)}.` : "Most uncached tokens first."}
        <HowMeasured what="cache breaks">A break is a main-thread request after the first turn with at least 20,000 prompt tokens, less than half of them read from the cache.
          A model switch is a different model from the previous request's; expired means a longer pause since it than the cache lifetime (5 minutes, or 30 for OpenAI's cache), a rule rather than a measurement;
          other covers a changed prompt or tool set.</HowMeasured></div>
      <DataTable name="Sessions where caching broke" region="scroll tall">
        <thead><tr><th scope="col">Session</th><th scope="col">Project</th><th scope="col" className="num">Breaks</th><th scope="col">By cause</th><th scope="col" className="num">Uncached tokens</th><th scope="col" className="num">Their input cost</th></tr></thead>
        <tbody>{rows.length ? rows.map(r => <tr key={r.session_id} {...pickRow(r.session_id, openSessionSheet, { kind: "session", value: r.session_id })}>
          <SessionCell id={r.session_id} title={r.title} row />
          <td className="name"><Proj project={r.project} /><div className="muted small"><SourceName source={r.source} /></div></td>
          <td className="num">{num(r.breaks)}</td><td>{causesText(r)}</td><td className="num">{num(r.uncached_tokens)}</td><td className="num">{usd(r.cost)}</td></tr>)
          : <tr><td colSpan={6} className="empty">No session in this view has a cache break.</td></tr>}</tbody>
      </DataTable>
    </Drawer>
  );
}
