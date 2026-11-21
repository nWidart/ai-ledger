import type { MouseEvent } from "react";
import type { ListedSessionRow } from "../../api";
import { headerTerm } from "../../components/Sort";
import { openSessionSheet, sessName } from "../../components/sheets/session";
import { SessionCell } from "../../components/table/cells";
import { Table, type Column } from "../../components/table/Table";
import { Toggletip } from "../../components/Toggletip";

/** A figure of the comparison: a Sessions column, read for one session at a time. */
export type Figure<K extends string> = Column<ListedSessionRow, K>;

// The row header holds the figure's toggletip too, so abbr gives the plain name a screen reader says with each cell.
const FIGURE: Column<Figure<string>> = {
  id: "figure", header: <span className="sr">Figure</span>,
  cell: f => <>{f.header}{f.tip && <Toggletip term={f.tipTerm ?? headerTerm(f.header)}>{f.tip}</Toggletip>}</>,
  cellProps: f => ({ abbr: headerTerm(f.header) }),
};

// A click focuses the name before it opens the sheet, so the sheet returns focus to it: Safari's click does not focus a button,
// and the sheet's fallback finds the session's row in the list, not this name.
const focusName = (e: MouseEvent<HTMLElement>) => (e.target as Element).closest<HTMLElement>(".cellbtn")?.focus();

/** The selected sessions side by side: the Sessions table turned on its side, a row per figure (its name, and its toggletip, as the
 *  row header) and a column per session, in the order given. Each cell is the figure's own cell and cellProps, so its format, "bad"
 *  mark and title are the table's; a column the table hides, by the user's choice or the width, still has its row here.
 *  A session's header holds its name, which opens its sheet (the sheet returns focus to it), and its Remove button (data-remove:
 *  the session, for the caller's focus); abbr names the column by the session alone. The rows come from the caller, so the
 *  comparison makes no request. */
export function Comparison<K extends string>({ id, sessions, figures, onRemove }: {
  id: string; sessions: readonly ListedSessionRow[]; figures: readonly Figure<K>[]; onRemove: (s: ListedSessionRow) => void;
}) {
  const columns: Column<Figure<K>>[] = [FIGURE as Column<Figure<K>>, ...sessions.map((s): Column<Figure<K>> => ({
    id: `s:${s.session_id}`, header: sessName(s),
    th: () => <th key={s.session_id} scope="col" abbr={sessName(s)} className="cmp-sess" onClickCapture={focusName}>
      <SessionCell s={s} subject onOpen={openSessionSheet} />
      <button type="button" className="linkish cmp-rm" data-remove={s.session_id} aria-label={`Remove ${sessName(s)} from the comparison`}
        onClick={() => onRemove(s)}>Remove</button></th>,
    cell: f => f.cell ? f.cell(s) : f.value?.(s),
    cellProps: f => { const own = f.cellProps?.(s); return { ...own, className: [f.align === "num" && "num", own?.className].filter(Boolean).join(" ") || undefined }; },
  }))];
  return <div id={id} className="cmp">
    <Table name="Session comparison" rows={figures} columns={columns} rowId={f => f.id} />
    {sessions.some(s => s.model_ms == null) && <p className="hint">– : the session records no model time (Codex and older Claude Code sessions).</p>}
  </div>;
}
