import { useId, useState, type ReactNode } from "react";
import "./DataTable.css";

/** A wrapper that scrolls sideways: a named region that takes focus, so the keyboard can scroll it. */
function ScrollRegion({ label, className = "scroll", children }: { label: string; className?: string; children: ReactNode }) {
  return <div className={className} tabIndex={0} role="region" aria-label={label}>{children}</div>;
}

/** A data table in a named scroll region; the table carries the same name (an aria-label, not a caption: the heading above it
 *  already shows the text). region: the wrapper's classes. */
export function DataTable({ name, className, region, children }: { name: string; className?: string; region?: string; children: ReactNode }) {
  return <ScrollRegion label={name} className={region}><table className={className} aria-label={name}>{children}</table></ScrollRegion>;
}

/** "Show data table" under a chart: a disclosure, closed on every load, that renders its table (the chart's text alternative) only while open. */
export function ChartTable({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false), id = useId();
  return <div className="chart-table">
    <button type="button" className="linkish" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(!open)}>{open ? "Hide data table" : "Show data table"}</button>
    {open && <div id={id}>{children}</div>}
  </div>;
}
