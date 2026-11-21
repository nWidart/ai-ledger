// Cell renderers that several Tables share. Each draws a cell's content; the Table draws the th or td around it.
import type { ReactNode } from "react";
import { num, pct } from "../../format";
import { subjectAttrs } from "../menu/subject";
import { sessName } from "../sheets/session";
import type { Column } from "./Table";

export interface SessionCellProps {
  s: { session_id: string; title?: string | null };
  /** Marks the button with data-session, for a row the page finds by its session. */
  data?: boolean;
  /** Marks the button as the session for the context menu (a row that is not a pick row has no subject of its own). */
  subject?: boolean;
  /** Opens the session from the button itself, for a row that does not open it. */
  onOpen?: (id: string) => void;
  /** The muted line under the name; nothing when empty. */
  sub?: ReactNode;
}

/** A session as a cell: its name as a native button, the keyboard target of a row that opens it, with an optional muted line under it. */
export function SessionCell({ s, data, subject, onOpen, sub }: SessionCellProps) {
  const id = s.session_id;
  return <><button type="button" className="cellbtn" data-session={data ? id : undefined} {...(subject ? subjectAttrs("session", id) : {})}
    title={s.title || id} onClick={onOpen && (() => onOpen(id))}>{sessName(s)}</button>
    {sub ? <div className="muted small">{sub}</div> : null}</>;
}

type Rate = { calls: number; failure_rate: number | null };

/** Calls and the share that failed, as two columns; a failure rate over 10% reads as bad. */
export const RATE_COLUMNS: readonly Column<Rate>[] = [
  { id: "calls", header: "Calls", align: "num", cell: r => num(r.calls) },
  { id: "failed", header: "Failed", align: "num", cell: r => pct(r.failure_rate, 1),
    cellProps: r => (r.failure_rate ?? 0) > .1 ? { className: "bad" } : {} },
];
