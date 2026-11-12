import type { ReactNode } from "react";
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

/** A header cell that sorts by k: most first (asc: A to Z first), flipping on a second click. Only the sorted one carries aria-sort. */
export function SortTh<K extends string>({ k, sort, onSort, asc, className, title, children }: {
  k: K; sort: SortBy<K> | null; onSort: (s: SortBy<K>) => void; asc?: boolean; className?: string; title?: string; children: ReactNode;
}) {
  const on = sort?.key === k;
  return <th className={className} title={title} aria-sort={on ? (sort.desc ? "descending" : "ascending") : undefined}>
    <button type="button" className="sortbtn" onClick={() => onSort({ key: k, desc: on ? !sort.desc : !asc })}>{children}
      <span className="sortmark" aria-hidden="true">{on ? (sort.desc ? "↓" : "↑") : ""}</span></button></th>;
}
