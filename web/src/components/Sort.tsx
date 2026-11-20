import type { ReactNode } from "react";
import { Toggletip } from "./Toggletip";
import "./Sort.css";

/** A table's sort: the column and its direction. */
export interface SortBy<K extends string = string> { key: K; desc: boolean }

const has = (v: unknown): v is number | string => v != null && !(typeof v === "number" && Number.isNaN(v));
/** rows ordered by get, as a copy (ties keep their order); rows with no value come last in either direction. */
export function sortRows<T>(rows: readonly T[], get: (r: T) => number | string | null | undefined, desc: boolean): T[] {
  return rows.slice().sort((a, b) => {
    const x = get(a), y = get(b);
    if (!has(x) || !has(y)) return +!has(x) - +!has(y);
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return desc ? -c : c;
  });
}

/** A header cell that sorts by k: most first (asc: A to Z first), flipping on a second click. Only the sorted one carries aria-sort.
 *  title: what the column means, behind a toggletip beside the sort button (a title on the header would be hover-only).
 *  after: more of the header outside the sort button, as a column's scale, so the button's name stays the column's. */
export function SortTh<K extends string>({ k, sort, onSort, asc, className, title, after, children }: {
  k: K; sort: SortBy<K> | null; onSort: (s: SortBy<K>) => void; asc?: boolean; className?: string; title?: string; after?: ReactNode; children: ReactNode;
}) {
  const on = sort?.key === k;
  return <th scope="col" className={className} data-sort={k} aria-sort={on ? (sort.desc ? "descending" : "ascending") : undefined}>
    <button type="button" className="sortbtn" onClick={() => onSort({ key: k, desc: on ? !sort.desc : !asc })}>{children}
      <span className="sortmark" aria-hidden="true">{on ? (sort.desc ? "↓" : "↑") : ""}</span></button>
    {title && <Toggletip term={typeof children === "string" ? children : "this column"}>{title}</Toggletip>}{after}</th>;
}
