// Context's tables behind drawers: the largest tool results and the sessions where caching broke.
import type { ContextPayload, Source } from "../../api";
import { Drawer } from "../../components/Drawer";
import { HowMeasured } from "../../components/HowMeasured";
import { openSessionSheet, shortId } from "../../components/sheets/session";
import { SessionCell } from "../../components/table/cells";
import { Table, type Column, type RowPick } from "../../components/table/Table";
import { num, usd, when } from "../../format";
import { Est, Proj, SourceName } from "./cells";
import { bytes, causesText } from "./context";

type D = ContextPayload;

type Largest = D["fills"]["largest"][number];
type Break = D["cost"]["breaks"][number];
const NAME = () => ({ className: "name" });

/** A session's column: its name as a button, with its short id under a title. */
const sessionColumn = <T extends { session_id: string; title: string | null }>(rowHeader?: boolean): Column<T> => ({
  id: "session", header: "Session", rowHeader, cellProps: () => ({ className: "when sess" }),
  cell: r => <SessionCell s={r} data sub={r.title && shortId(r.session_id)} />,
});
/** The project, with the source under it. */
const projectColumn = <T extends { project: string | null; source: Source }>(): Column<T> => ({
  id: "project", header: "Project", cellProps: NAME, cell: r => <><Proj project={r.project} /><div className="muted small"><SourceName source={r.source} /></div></>,
});
const SESSION_PICK: RowPick<{ session_id: string }> = { value: r => r.session_id, open: openSessionSheet, subject: r => ({ kind: "session", value: r.session_id }) };

const LARGEST_COLUMNS: readonly Column<Largest>[] = [
  { id: "tool", header: "Tool", cellProps: r => ({ className: "name", title: r.mcp_server ? `${r.tool} (MCP server ${r.mcp_server})` : r.tool }),
    cell: r => <>{r.tool}{r.mcp_server && <div className="muted small">{r.mcp_server}</div>}</> },
  { id: "input", header: "Input", cellProps: r => ({ className: "name input", title: r.input }), cell: r => r.input ? <code>{r.input}</code> : "–" },
  { id: "size", header: "Size", align: "num", cell: r => bytes(r.bytes) },
  { id: "tokens", header: "Estimated tokens", align: "num", cell: r => <Est tokens={r.est_tokens} /> },
  { id: "when", header: "When", cellProps: () => ({ className: "when" }), cell: r => when(r.ts) },
  projectColumn(),
  // Not the row's header: the tool is.
  sessionColumn(false),
];

const BREAK_COLUMNS: readonly Column<Break>[] = [
  sessionColumn(),
  projectColumn(),
  { id: "breaks", header: "Breaks", align: "num", cell: r => num(r.breaks) },
  { id: "causes", header: "By cause", cell: causesText },
  { id: "uncached", header: "Uncached tokens", align: "num", cell: r => num(r.uncached_tokens) },
  { id: "cost", header: "Their input cost", align: "num", cell: r => usd(r.cost) },
];

/** The 25 largest main-thread tool results, each opening its session. */
export function LargestDrawer({ rows }: { rows: D["fills"]["largest"] }) {
  return (
    <Drawer id="d-largest" title="Largest tool results" count={num(rows.length)} description="The biggest results the main thread read, with the session that holds them">
      <div className="hint">Sizes are as the transcript stores them; estimated tokens are the bytes divided by 4. Select a row to open its session.</div>
      <Table name="Largest tool results" region="scroll tall" rows={rows} columns={LARGEST_COLUMNS} rowId={r => r.id} pick={SESSION_PICK}
        empty="No tool result with a known size in this view." />
    </Drawer>
  );
}

/** Sessions with a cache break, most uncached tokens first. */
export function BreaksDrawer({ cost }: { cost: D["cost"] }) {
  const rows = cost.breaks;
  return (
    <Drawer id="d-breaks" title="Sessions where caching broke" count={num(cost.break_sessions)} description="Breaks by cause, with the uncached tokens they cost">
      <div className="hint">{cost.break_sessions > rows.length ? `Showing the ${num(rows.length)} with the most uncached tokens of ${num(cost.break_sessions)}.` : "Most uncached tokens first."}
        <HowMeasured what="cache breaks" docs="reference/glossary#context">A break is a main-thread request after the first turn with at least 20,000 prompt tokens, less than half of them read from the cache.
          A model switch is a different model from the previous request's; expired means a longer pause since it than the cache lifetime (5 minutes, or 30 for OpenAI's cache), a rule rather than a measurement;
          other covers a changed prompt or tool set.</HowMeasured></div>
      <Table name="Sessions where caching broke" region="scroll tall" rows={rows} columns={BREAK_COLUMNS} rowId={r => r.session_id} pick={SESSION_PICK}
        empty="No session in this view has a cache break." />
    </Drawer>
  );
}
