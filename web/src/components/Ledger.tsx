import type { ReactNode } from "react";
import { subjectAttrs, type Subject } from "./menu/subject";
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
  /** A CSS color: a swatch before the name instead of a share bar (for a keyed Ledger; share is then unused). */
  swatch?: string;
  /** Makes the row a button; gets the button, to return focus to it later. */
  onPick?: (el: HTMLButtonElement) => void;
  /** This row is the active choice: marks the row, and with onPick sets aria-pressed on its button. */
  active?: boolean;
  /** data-v on the row, so a re-rendered page can find the row again. */
  pickKey?: string;
  /** The subject the row stands for, so the context menu can act on it (none for an empty value). */
  subject?: Subject;
  /** A button row only: controls after the button in the row's item, never nested in the button. */
  children?: ReactNode;
}

/** One row of a ledger: name, share bar, value and a side figure. A selectable row is a real button. */
export function LedgerRow({ name, title, share, value, side, project, color, swatch, onPick, active, pickKey, subject, children }: LedgerRowProps) {
  const mark = subject ? subjectAttrs(subject.kind, subject.value) : {};
  const cells = <>
    <span className="n" title={title ?? (typeof name === "string" ? name : undefined)}>{swatch != null && <i className="sw" aria-hidden="true" style={{ background: swatch }} />}{project != null && <ProjectDot project={project} />}{name}</span>
    {swatch == null && <span className="bar" aria-hidden="true"><span style={{ width: `${Math.max(share * 100, share > 0 ? 1 : 0)}%`, ...(color ? { background: color } : {}) }} /></span>}
    <span className="v">{value}</span><span className="s">{side}</span>
  </>;
  return onPick
    ? <li className={active ? "pick on" : "pick"} data-v={pickKey} {...mark}><button type="button" className="rowbtn" aria-pressed={active} onClick={e => onPick(e.currentTarget)}>{cells}</button>{children}</li>
    : <li className={active ? "on" : undefined} data-v={pickKey} {...mark}>{cells}</li>;
}

/** A ranked list of LedgerRows; empty: what to say when there are none; keyed: rows with swatches, no bars, as wide as their content. */
export function Ledger({ children, empty, id, keyed }: { children: ReactNode; empty: ReactNode; id?: string; keyed?: boolean }) {
  const has = Array.isArray(children) ? children.length > 0 : children != null && children !== false;
  return <ol className={keyed ? "ledger keyed" : "ledger"} id={id}>{has ? children : <li className="empty">{empty}</li>}</ol>;
}
