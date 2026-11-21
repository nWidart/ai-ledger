import type { ReactNode } from "react";
import { Toggletip } from "./Toggletip";
import "./Sort.css";

/** A table's sort: the column and its direction. */
export interface SortBy<K extends string = string> { key: K; desc: boolean }

/** Whether a sort value is there: null, undefined and NaN are no value, and sort last. */
export const hasValue = (v: unknown): v is number | string => v != null && !(typeof v === "number" && Number.isNaN(v));
/** rows ordered by get, as a copy (ties keep their order); rows with no value come last in either direction. */
export function sortRows<T>(rows: readonly T[], get: (r: T) => number | string | null | undefined, desc: boolean): T[] {
  return rows.slice().sort((a, b) => {
    const x = get(a), y = get(b);
    if (!hasValue(x) || !hasValue(y)) return +!hasValue(x) - +!hasValue(y);
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return desc ? -c : c;
  });
}

/** What a header's toggletip explains, for its name: the header text, or "this column" when the header is not plain text. */
export const headerTerm = (header: ReactNode) => typeof header === "string" ? header : "this column";

/** Whether a sort is the list form (several keys, first key first) rather than one key or none. */
export const isSortList = <K extends string>(s: SortBy<K> | readonly SortBy<K>[] | null | undefined): s is readonly SortBy<K>[] => Array.isArray(s);

/** The sort after a press on key's header, as a new list (the given one is left alone). Without add, the key alone: reversed when it
 *  is the only key, else in its first direction (descFirst). With add, the key cycles as the last key: added in its first direction,
 *  reversed on a second press, removed on a third; at max keys, a new key replaces the last one so the first keys stay. */
export function nextSort<K extends string>(list: readonly SortBy<K>[], key: K, descFirst: boolean, add: boolean, max = 3): SortBy<K>[] {
  const i = list.findIndex(s => s.key === key), on = list[i], first = { key, desc: descFirst };
  if (!add) return [on && list.length === 1 ? { key, desc: !on.desc } : first];
  if (!on) return [...list.slice(0, Math.max(0, max - 1)), first];
  return on.desc === descFirst ? list.map(s => s === on ? { key, desc: !descFirst } : s) : list.filter(s => s !== on);
}

/** A header cell that sorts by k: most first (asc: A to Z first), flipping on a second click. Only the sorted one carries aria-sort.
 *  sort: one key, or a list of keys (first key first). With several keys, each sorted header shows its rank after its arrow and its
 *  button's name ends with ", sort N of M" (and the direction after the first key); only the first key's header carries aria-sort.
 *  onSort: this header alone as the next sort, and whether Shift was held (a Shift-click selects no text under a list sort).
 *  title: what the column means, behind a toggletip beside the sort button (a title on the header would be hover-only).
 *  term: what the toggletip explains, for its name "About {term}" (default: the header text).
 *  after: more of the header outside the sort button, as a column's scale, so the button's name stays the column's. */
export function SortTh<K extends string>({ k, sort, onSort, asc, className, title, term, after, children }: {
  k: K; sort: SortBy<K> | readonly SortBy<K>[] | null; onSort: (s: SortBy<K>, shift: boolean) => void; asc?: boolean; className?: string; title?: string;
  term?: string; after?: ReactNode; children: ReactNode;
}) {
  const list = isSortList(sort) ? sort : sort ? [sort] : [], i = list.findIndex(s => s.key === k), on = list[i], many = list.length > 1;
  const dir = on && (on.desc ? "descending" : "ascending");
  return <th scope="col" className={className} data-sort={k} aria-sort={i === 0 ? dir : undefined}>
    <button type="button" className="sortbtn" onMouseDown={isSortList(sort) ? e => {
      // No text selection; the prevented default would also keep focus where it was, so the button takes it itself.
      if (e.shiftKey) { e.preventDefault(); e.currentTarget.focus(); }
    } : undefined}
      onClick={e => onSort({ key: k, desc: on ? !on.desc : !asc }, e.shiftKey)}>{children}
      <span className="sortmark" aria-hidden="true">{on ? (on.desc ? "↓" : "↑") + (many ? String(i + 1) : "") : ""}</span>
      {on && many && <span className="sr">{`, sort ${i + 1} of ${list.length}${i ? `, ${dir}` : ""}`}</span>}</button>
    {title && <Toggletip term={term ?? headerTerm(children)}>{title}</Toggletip>}{after}</th>;
}
