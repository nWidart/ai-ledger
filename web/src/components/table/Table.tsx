import { createSortedRowModel, rowSortingFeature, tableFeatures, useTable, type ColumnDef, type RowData, type SortFn, type SortingState } from "@tanstack/react-table";
import { Fragment, useMemo, type ComponentPropsWithoutRef, type ComponentPropsWithRef, type ReactNode } from "react";
import { DataTable } from "../DataTable";
import type { Subject } from "../menu/subject";
import { pickRow } from "../sheets/session";
import { hasValue, headerTerm, SortTh, type SortBy } from "../Sort";
import { Toggletip } from "../Toggletip";

/** What a column sorts by and shows by default. null, undefined and NaN read as "no value". */
export type CellValue = number | string | null | undefined;

/** One column of a Table, as data. A sortable column needs the value it sorts by. */
export type Column<T, K extends string = string> = ColumnBase<T, K> & (
  | {
    /** Sortable, starting in this direction on the first click: "desc" (most first) or "asc" (A to Z first). Default: not sortable. */
    sort: "desc" | "asc";
    /** The row's value: what the column sorts by, and the cell when there is no cell renderer. */
    value: (row: T) => CellValue;
  }
  | { sort?: undefined; value?: (row: T) => CellValue });

interface ColumnBase<T, K extends string> {
  /** The column's id, and its key in the table's sort. */
  id: K;
  header: ReactNode;
  /** What the column means, behind a toggletip in the header (a title would be hover-only). */
  tip?: string;
  /** What the toggletip explains, for its name "About {tipTerm}" (default: the header text). */
  tipTerm?: string;
  /** More of the header after its label, outside the sort button, as a column's scale. */
  after?: ReactNode;
  cell?: (row: T) => ReactNode;
  /** The cell's own attributes for a row, as a title; its className adds to the column's classes. */
  cellProps?: (row: T) => Omit<ComponentPropsWithoutRef<"td">, "children">;
  /** "num" right-aligns the header and cells (class num). Default: start. */
  align?: "start" | "num";
  /** Classes on the header and every cell of the column. */
  className?: string;
  /** Hidden on narrow screens, by priority: 0 goes last (class opt), 1 before it (opt1), 2 first (opt2). The page CSS hides them. */
  hide?: 0 | 1 | 2;
  /** The cell is the row's header, a th scoped to the row. Default: only the first column. */
  rowHeader?: boolean;
  /** Renders the whole header cell instead (a th scoped to the column), for a header the defaults cannot draw. */
  th?: (head: HeadContext<K>) => ReactNode;
  /** More sort keys than the column's own id, each with the value it sorts by: for a header (th) with a sort button per figure. */
  sorts?: { [S in K]?: (row: T) => CellValue };
  /** The class of the column's col: any column with one draws a colgroup before the head, as for a fixed layout's widths. */
  col?: string;
}

/** What a custom header cell gets: the column's classes and the table's sort. */
export interface HeadContext<K extends string> { className: string | undefined; sort: SortBy<K> | null; onSort?: (s: SortBy<K>) => void }

/** A row that opens something (a sheet): value, the row's data-v (null: the row opens nothing); open, run with the row's button;
 *  subject, what the row is for the context menu. */
export interface RowPick<T> {
  value: (row: T) => string | null | undefined;
  open: (value: string, el: HTMLElement, row: T) => void;
  subject?: (row: T) => Subject | undefined;
}

/** A sort and its handler come together: a sort no header can show or change would leave the order unannounced. */
type TableSort<K extends string> =
  | {
    /** The sort, owned by the caller; null: rows in the order given. */
    sort: SortBy<K> | null;
    onSort: (s: SortBy<K>) => void;
  }
  | { sort?: undefined; onSort?: undefined };

export type TableProps<T extends RowData, K extends string = string> = TableBase<T, K> & TableSort<K>;

/** What rowProps may set on a row's tr. */
export type RowAttrs = Omit<ComponentPropsWithoutRef<"tr">, "children"> & { [data: `data-${string}`]: string | undefined };

interface TableBase<T extends RowData, K extends string> {
  /** The table's name, on the table and on the scroll region around it. */
  name: string;
  rows: readonly T[];
  columns: readonly Column<T, K>[];
  /** The row's id, for its key and for current. It must be unique across pinned, body and later rows: each set counts its index
   *  from 0, so an id built from the index alone repeats. */
  rowId: (row: T, index: number) => string;
  /** Rows come sorted (by the server): the sort only marks the headers. */
  manualSort?: boolean;
  /** Shown in one full-width row when there are no rows. */
  empty?: ReactNode;
  /** Rows above the others, never sorted, such as totals. */
  pinned?: readonly T[];
  /** More rows after the others, such as a fold or a bucket; a function gets the table's row renderer (index: for rowId), for rows of the same columns. */
  after?: ReactNode | ((row: (r: T, index: number) => ReactNode) => ReactNode);
  /** The id of the selected row (class sel). */
  current?: string | null;
  pick?: RowPick<T>;
  /** The row's own attributes, as data-* or a click; its className comes after pick and sel, and a pick's own attributes win. */
  rowProps?: (row: T) => RowAttrs;
  /** The scroll region's classes (DataTable's region). */
  region?: string;
  className?: string;
  /** Props for the tbody, as inert, aria-busy or a ref. */
  body?: ComponentPropsWithRef<"tbody">;
}

const features = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel() });
const OPT = ["opt", "opt1", "opt2"] as const;
// Ascending only: the table flips it for a descending sort. Rows with no value are undefined, and sortUndefined puts them last.
const compare: SortFn<typeof features, RowData> = (a, b, id) => {
  const x = a.getValue<number | string>(id), y = b.getValue<number | string>(id);
  return typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
};
const classes = <T, K extends string>(c: Column<T, K>) =>
  [c.align === "num" && "num", c.hide != null && OPT[c.hide], c.className].filter(Boolean).join(" ") || undefined;

/** A data table built from column definitions: native table markup in a named, focusable scroll region (DataTable), sortable by
 *  any column that allows it. The sort is the caller's; rows with no value come last either way and ties keep their order. */
export function Table<T extends RowData, K extends string = string>({ name, rows, columns, rowId, sort = null, onSort, manualSort, empty, pinned, after,
  current, pick, rowProps, region, className, body }: TableProps<T, K>) {
  const defs = useMemo(() => {
    const def = (id: string, value: ((r: T) => CellValue) | undefined, sortable: boolean): ColumnDef<typeof features, T> => ({
      id, enableSorting: sortable, sortUndefined: "last", sortFn: compare as SortFn<typeof features, T>,
      accessorFn: r => { const v = value?.(r); return hasValue(v) ? v : undefined; },
    });
    return columns.flatMap(c => [def(c.id, c.value, !!c.sort),
      ...Object.entries<((r: T) => CellValue) | undefined>(c.sorts ?? {}).map(([k, value]) => def(k, value, true))]);
  }, [columns]);
  const sorting = useMemo<SortingState>(() => sort ? [{ id: sort.key, desc: sort.desc }] : [], [sort?.key, sort?.desc]); // eslint-disable-line react-hooks/exhaustive-deps
  // TanStack rebuilds its rows, and the values they cache per column id, only for new data: new columns get a fresh copy of the rows.
  const data = useMemo(() => rows.slice(), [rows, defs]); // eslint-disable-line react-hooks/exhaustive-deps
  const table = useTable({ features, columns: defs, data, getRowId: rowId, manualSorting: manualSort, state: { sorting } });

  const head = (c: Column<T, K>) => {
    const cls = classes(c);
    if (c.th) return <Fragment key={c.id}>{c.th({ className: cls, sort, onSort })}</Fragment>;
    if (c.sort && onSort) return <SortTh key={c.id} k={c.id} sort={sort} onSort={onSort} asc={c.sort === "asc"} className={cls} title={c.tip} term={c.tipTerm}
      after={c.after}>{c.header}</SortTh>;
    return <th key={c.id} scope="col" className={cls}>{c.header}{c.tip && <Toggletip term={c.tipTerm ?? headerTerm(c.header)}>{c.tip}</Toggletip>}{c.after}</th>;
  };
  // key: the row's React key, apart from its id so that pinned and later rows cannot collide with the body's.
  const row = (r: T, id: string, key = id) => {
    const v = pick?.value(r), sel = current != null && id === current ? "sel" : "";
    const attrs = pick && v != null ? pickRow(v, (v, el) => pick.open(v, el, r), pick.subject?.(r), sel) : { className: sel || undefined };
    const own = rowProps?.(r), cls = [attrs.className, own?.className].filter(Boolean).join(" ") || undefined;
    return <tr key={key} {...own} {...attrs} className={cls}>{columns.map((c, i) => {
      const value = c.cell ? undefined : c.value?.(r), content = c.cell ? c.cell(r) : hasValue(value) ? value : null;
      const own = c.cellProps?.(r), props = { ...own, className: [classes(c), own?.className].filter(Boolean).join(" ") || undefined };
      return (c.rowHeader ?? i === 0) ? <th key={c.id} scope="row" {...props}>{content}</th> : <td key={c.id} {...props}>{content}</td>;
    })}</tr>;
  };
  const later = (r: T, i: number) => { const id = rowId(r, i); return row(r, id, `after:${id}`); };

  return <DataTable name={name} className={className} region={region}>
    {columns.some(c => c.col) && <colgroup>{columns.map(c => <col key={c.id} className={c.col} />)}</colgroup>}
    <thead><tr>{columns.map(head)}</tr></thead>
    <tbody {...body}>
      {pinned?.map((r, i) => { const id = rowId(r, i); return row(r, id, `pinned:${id}`); })}
      {table.getRowModel().rows.map(r => row(r.original, r.id))}
      {!rows.length && !pinned?.length && empty != null && <tr><td colSpan={columns.length} className="empty">{empty}</td></tr>}
      {typeof after === "function" ? after(later) : after}
    </tbody>
  </DataTable>;
}
