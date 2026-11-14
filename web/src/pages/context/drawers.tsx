// Context's tables behind drawers: the largest tool results and the sessions where caching broke.
import type { ContextPayload } from "../../api";
import { Drawer } from "../../components/Drawer";
import { openSessionSheet, pickRow, sessName, shortId } from "../../components/sheets/session";
import { num, usd, when } from "../../format";
import { Est, Proj, SourceName } from "./cells";
import { bytes, causesText } from "./context";

type D = ContextPayload;

const SessionCell = ({ id, title }: { id: string; title: string | null }) =>
  <td className="when sess"><button type="button" className="cellbtn" data-session={id} title={title || id}>{sessName({ session_id: id, title })}</button>
    {title && <div className="muted small">{shortId(id)}</div>}</td>;

/** The 25 largest main-thread tool results, each opening its session. */
export function LargestDrawer({ rows }: { rows: D["fills"]["largest"] }) {
  return (
    <Drawer id="d-largest" title="Largest tool results" count={num(rows.length)} description="The biggest results the main thread read, with the session that holds them">
      <div className="hint">Sizes are as the transcript stores them; estimated tokens are the bytes divided by 4. Select a row to open its session.</div>
      <div className="scroll tall"><table>
        <thead><tr><th>Tool</th><th>Input</th><th className="num">Size</th><th className="num">Estimated tokens</th><th>When</th><th>Project</th><th>Session</th></tr></thead>
        <tbody>{rows.length ? rows.map(r => <tr key={r.id} {...pickRow(r.session_id, openSessionSheet)}>
          <td className="name" title={r.mcp_server ? `${r.tool} (MCP server ${r.mcp_server})` : r.tool}>{r.tool}{r.mcp_server && <div className="muted small">{r.mcp_server}</div>}</td>
          <td className="name input" title={r.input}>{r.input ? <code>{r.input}</code> : "–"}</td>
          <td className="num">{bytes(r.bytes)}</td><td className="num"><Est tokens={r.est_tokens} /></td><td className="when">{when(r.ts)}</td>
          <td className="name"><Proj project={r.project} /><div className="muted small"><SourceName source={r.source} /></div></td>
          <SessionCell id={r.session_id} title={r.title} /></tr>)
          : <tr><td colSpan={7} className="empty">No tool result with a known size in this view.</td></tr>}</tbody>
      </table></div>
    </Drawer>
  );
}

/** Sessions with a cache break, most uncached tokens first. */
export function BreaksDrawer({ cost }: { cost: D["cost"] }) {
  const rows = cost.breaks;
  return (
    <Drawer id="d-breaks" title="Sessions where caching broke" count={num(cost.break_sessions)} description="Breaks by cause, with the uncached tokens they cost">
      <div className="hint">A break is a main-thread request after the first turn with at least 20,000 prompt tokens, less than half of them read from the cache.
        A model switch is a different model from the previous request's; expired means more than 5 minutes since it, the usual cache lifetime rather than a measurement;
        other covers a changed prompt or tool set.{cost.break_sessions > rows.length ? ` Showing the ${num(rows.length)} with the most uncached tokens of ${num(cost.break_sessions)}.` : ""}</div>
      <div className="scroll tall"><table>
        <thead><tr><th>Session</th><th>Project</th><th className="num">Breaks</th><th>By cause</th><th className="num">Uncached tokens</th><th className="num">Their input cost</th></tr></thead>
        <tbody>{rows.length ? rows.map(r => <tr key={r.session_id} {...pickRow(r.session_id, openSessionSheet)}>
          <SessionCell id={r.session_id} title={r.title} />
          <td className="name"><Proj project={r.project} /><div className="muted small"><SourceName source={r.source} /></div></td>
          <td className="num">{num(r.breaks)}</td><td>{causesText(r)}</td><td className="num">{num(r.uncached_tokens)}</td><td className="num">{usd(r.cost)}</td></tr>)
          : <tr><td colSpan={6} className="empty">No session in this view has a cache break.</td></tr>}</tbody>
      </table></div>
    </Drawer>
  );
}
