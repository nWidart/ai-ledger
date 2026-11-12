import type { ReactNode } from "react";
import { ProjectDot } from "./ProjectDot";
import "./Ledger.css";

export interface LedgerRowProps {
  name: ReactNode;
  /** Tooltip on the name; defaults to the name when it is text. */
  title?: string;
  /** Bar length, 0 to 1. */
  share: number;
  value: ReactNode;
  side: ReactNode;
  /** A project: its dot before the name. */
  project?: string | null;
  /** The bar's color (a project's, or the neutral default). */
  color?: string;
  /** Makes the row a button; gets the button, to return focus to it later. */
  onPick?: (el: HTMLButtonElement) => void;
  /** With onPick: this row is the active choice (marks the row, aria-pressed on its button). */
  active?: boolean;
  /** data-v on the row, so a re-rendered page can find the row again. */
  pickKey?: string;
}

/** One row of a ledger: name, share bar, value and a side figure. A selectable row is a real button. */
export function LedgerRow({ name, title, share, value, side, project, color, onPick, active, pickKey }: LedgerRowProps) {
  const cells = <>
    <span className="n" title={title ?? (typeof name === "string" ? name : undefined)}>{project != null && <ProjectDot project={project} />}{name}</span>
    <span className="bar" aria-hidden="true"><span style={{ width: `${Math.max(share * 100, share > 0 ? 1 : 0)}%`, ...(color ? { background: color } : {}) }} /></span>
    <span className="v">{value}</span><span className="s">{side}</span>
  </>;
  return onPick
    ? <li className={active ? "pick on" : "pick"} data-v={pickKey}><button type="button" className="rowbtn" aria-pressed={active} onClick={e => onPick(e.currentTarget)}>{cells}</button></li>
    : <li data-v={pickKey}>{cells}</li>;
}

/** A ranked list of LedgerRows; empty: what to say when there are none. */
export function Ledger({ children, empty, id }: { children: ReactNode; empty: ReactNode; id?: string }) {
  const has = Array.isArray(children) ? children.length > 0 : children != null && children !== false;
  return <ol className="ledger" id={id}>{has ? children : <li className="empty">{empty}</li>}</ol>;
}
