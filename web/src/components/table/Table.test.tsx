import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState, type ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { DataTable } from "../DataTable";
import { isSortList, SortTh, type SortBy } from "../Sort";
import { renderApp } from "../../testing";
import { Table, type Column, type RowAttrs, type TableProps } from "./Table";

interface R { n: string; v: number | null }
type K = "n" | "v";
const COLS: Column<R, K>[] = [
  { id: "n", header: "Name", value: r => r.n, sort: "asc" },
  { id: "v", header: "Value", value: r => r.v, align: "num", sort: "desc" },
];
const ROWS: R[] = [{ n: "b", v: 2 }, { n: "x", v: null }, { n: "a", v: 3 }, { n: "c", v: 1 }];

/** The rows' first cells, top to bottom. */
const names = () => [...document.querySelectorAll("tbody tr")].map(tr => tr.firstElementChild!.textContent);
const th = (n: string) => screen.getByRole("button", { name: n }).closest("th")!;

function Sorted({ init = null, ...rest }: { init?: SortBy<K> | null } & Pick<TableProps<R, K>, "pinned" | "after">) {
  const [sort, setSort] = useState(init);
  return <Table name="Things" rows={ROWS} columns={COLS} rowId={r => r.n} sort={sort} onSort={setSort} {...rest} />;
}

describe("Table markup", () => {
  it("names the table and its region, scopes headers to columns and the first cell to the row, and aligns numbers", () => {
    renderApp(<Table name="Things" region="scroll tall" className="matrix" rows={ROWS} columns={COLS} rowId={r => r.n} />);
    const region = screen.getByRole("region", { name: "Things" });
    expect(region.className).toBe("scroll tall");
    expect(region.tabIndex).toBe(0);
    const table = within(region).getByRole("table", { name: "Things" });
    expect(table.className).toBe("matrix");
    expect(within(table).getAllByRole("columnheader").map(h => [h.getAttribute("scope"), h.className])).toEqual([["col", ""], ["col", "num"]]);
    expect(within(table).getByRole("rowheader", { name: "b" }).getAttribute("scope")).toBe("row");
    expect(within(table).getAllByRole("cell").map(c => c.className)).toEqual(["num", "num", "num", "num"]);
    expect(within(table).getAllByRole("cell")[1]!.textContent).toBe(""); // no value, no text
  });

  it("draws the same DOM as a hand-written table", () => {
    const cols: Column<R, K>[] = [{ id: "n", header: "Name", value: r => r.n }, { id: "v", header: "Value", align: "num", cell: r => `${r.v} k` }];
    const rows = [{ n: "a", v: 1 }, { n: "b", v: 2 }];
    const a = render(<Table name="T" rows={rows} columns={cols} rowId={r => r.n} />).container.innerHTML;
    const b = render(<DataTable name="T"><thead><tr><th scope="col">Name</th><th scope="col" className="num">Value</th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.n}><th scope="row">{r.n}</th><td className="num">{r.v} k</td></tr>)}</tbody></DataTable>).container.innerHTML;
    expect(a).toBe(b);
  });

  it("draws sortable headers as SortTh does", () => {
    const a = render(<Table name="T" rows={[]} columns={COLS} rowId={r => r.n} sort={{ key: "v", desc: true }} onSort={() => {}} />).container.querySelector("thead")!.outerHTML;
    const b = render(<table><thead><tr><SortTh k="n" sort={{ key: "v", desc: true }} onSort={() => {}} asc>Name</SortTh>
      <SortTh k="v" sort={{ key: "v", desc: true }} onSort={() => {}} className="num">Value</SortTh></tr></thead></table>).container.querySelector("thead")!.outerHTML;
    expect(a).toBe(b);
  });

  it("emits the narrow-width classes, the column's class, and row headers where asked", () => {
    const cols: Column<R>[] = [{ id: "a", header: "A", value: r => r.n, rowHeader: false }, { id: "b", header: "B", value: r => r.n, hide: 0, rowHeader: true },
      { id: "c", header: "C", value: r => r.v, align: "num", hide: 1, className: "spend" }, { id: "d", header: "D", value: r => r.v, hide: 2 }];
    renderApp(<Table name="T" rows={[{ n: "a", v: 1 }]} columns={cols} rowId={r => r.n} />);
    expect(screen.getAllByRole("columnheader").map(h => h.className)).toEqual(["", "opt", "num opt1 spend", "opt2"]);
    const cells = [...document.querySelectorAll("tbody tr > *")];
    expect(cells.map(c => [c.tagName, c.className])).toEqual([["TD", ""], ["TH", "opt"], ["TD", "num opt1 spend"], ["TD", "opt2"]]);
  });

  it("puts a column's explanation behind a toggletip and draws more of the header after it", async () => {
    const cols: Column<R>[] = [{ id: "a", header: "Active", value: r => r.n, tip: "Active time: pauses over 20 minutes left out", tipTerm: "Active time", after: <span className="scale">h</span> }];
    renderApp(<Table name="T" rows={[]} columns={cols} rowId={r => r.n} />);
    const h = screen.getByRole("columnheader");
    expect(h.querySelector(".scale")).not.toBeNull();
    await userEvent.click(within(h).getByRole("button", { name: "About Active time" }));
    expect(within(h).getByRole("tooltip").textContent).toBe("Active time: pauses over 20 minutes left out");
  });

  it("draws a custom header cell with the column's classes and the sort", () => {
    const cols: Column<R, K>[] = [{ id: "n", header: "Name", value: r => r.n },
      { id: "v", header: "Value", align: "num", th: h => <th scope="col" className={h.className}>{h.sort?.key}<small>two</small></th> }];
    renderApp(<Table name="T" rows={[]} columns={cols} rowId={r => r.n} sort={{ key: "v", desc: true }} onSort={() => {}} />);
    const h = screen.getAllByRole("columnheader")[1]!;
    expect([h.className, h.textContent]).toEqual(["num", "vtwo"]);
  });

  it("draws a colgroup before the head when a column has a col class, and none otherwise", () => {
    const { rerender } = renderApp(<Table name="T" rows={ROWS} columns={[{ ...COLS[0]!, col: "c-name" }, COLS[1]!]} rowId={r => r.n} />);
    expect(document.querySelector("table")!.firstElementChild!.outerHTML).toBe('<colgroup><col class="c-name"><col></colgroup>');
    rerender(<Table name="T" rows={ROWS} columns={COLS} rowId={r => r.n} />);
    expect(document.querySelector("colgroup")).toBeNull();
  });

  it("shows the empty state in one full-width row, and nothing when given none", () => {
    const { rerender } = renderApp(<Table name="T" rows={[]} columns={COLS} rowId={r => r.n} empty="No usage." />);
    const td = screen.getByRole("cell");
    expect([td.className, td.getAttribute("colspan"), td.textContent]).toEqual(["empty", "2", "No usage."]);
    rerender(<Table name="T" rows={[]} columns={COLS} rowId={r => r.n} />);
    expect(document.querySelectorAll("tbody tr")).toHaveLength(0);
  });

  it("passes props to the tbody", () => {
    const ref = createRef<HTMLTableSectionElement>();
    renderApp(<Table name="T" rows={ROWS} columns={COLS} rowId={r => r.n} body={{ ref, "aria-busy": true, inert: true }} />);
    expect(ref.current!.tagName).toBe("TBODY");
    expect(ref.current!.getAttribute("aria-busy")).toBe("true");
    expect(ref.current!.hasAttribute("inert")).toBe(true);
  });
});

describe("Table types", () => {
  it("needs a value to sort a column by, and a sort with its onSort", () => {
    // @ts-expect-error: a sortable column needs a value to sort by
    const noValue: Column<R, K> = { id: "v", header: "Value", sort: "desc", cell: r => r.v };
    // @ts-expect-error: a sort needs its onSort
    const noOnSort = <Table name="T" rows={ROWS} columns={COLS} rowId={r => r.n} sort={{ key: "v", desc: true }} />;
    // @ts-expect-error: an onSort needs its sort
    const noSort = <Table name="T" rows={ROWS} columns={COLS} rowId={r => r.n} onSort={() => {}} />;
    expect([noValue, noOnSort, noSort]).toHaveLength(3);
  });

  it("ties the list form of the sort to an onSort that takes a list", () => {
    const list: SortBy<K>[] = [{ key: "v", desc: true }];
    const ok = [<Table key={0} name="T" rows={ROWS} columns={COLS} rowId={r => r.n} sort={list} onSort={(l: SortBy<K>[]) => l} sortAdd sortMax={2} />,
      <Table key={1} name="T" rows={ROWS} columns={COLS} rowId={r => r.n} sort={list} onSort={l => l.map(s => s.key)} />];
    // @ts-expect-error: a list needs its onSort
    const noOnSort = <Table name="T" rows={ROWS} columns={COLS} rowId={r => r.n} sort={list} />;
    // @ts-expect-error: a list's onSort gets a list, not one key
    const oneKey = <Table name="T" rows={ROWS} columns={COLS} rowId={r => r.n} sort={list} onSort={(s: SortBy<K>) => s.key} />;
    // @ts-expect-error: a single sort cannot add keys
    const addOne = <Table name="T" rows={ROWS} columns={COLS} rowId={r => r.n} sort={null} onSort={(s: SortBy<K>) => s} sortAdd />;
    // @ts-expect-error: no sort, no cap
    const capNone = <Table name="T" rows={ROWS} columns={COLS} rowId={r => r.n} sortMax={2} />;
    expect([...ok, noOnSort, oneKey, addOne, capNone]).toHaveLength(6);
  });

  it("lets a wrapper forward TableProps in either form, and the props type refuses what both forms refuse", () => {
    const list: SortBy<K>[] = [{ key: "v", desc: true }];
    function Wrap(props: TableProps<R, K>) { return <Table {...props} />; }
    type Props = ComponentProps<typeof Table<R, K>>;
    const base = { name: "T", rows: ROWS, columns: COLS, rowId: (r: R) => r.n };
    const one: Props = { ...base, sort: null, onSort: (s: SortBy<K>) => s };
    const many: Props = { ...base, sort: list, onSort: (l: SortBy<K>[]) => l, sortAdd: true, sortMax: 2 };
    const none: Props = base;
    const ok = [<Wrap key={0} {...one} />, <Wrap key={1} {...many} />, <Wrap key={2} {...none} />];
    // @ts-expect-error: a list needs its onSort
    const listNoOnSort: TableProps<R, K> = { ...base, sort: list };
    // @ts-expect-error: a list's onSort gets a list, not one key
    const listOneKey: TableProps<R, K> = { ...base, sort: list, onSort: (s: SortBy<K>) => s.key };
    // @ts-expect-error: a single sort cannot add keys
    const oneAdd: TableProps<R, K> = { ...base, sort: null, onSort: (s: SortBy<K>) => s, sortAdd: true };
    // @ts-expect-error: no sort, no cap
    const capNone: TableProps<R, K> = { ...base, sortMax: 2 };
    // @ts-expect-error: a sort needs its onSort
    const sortNoOnSort: TableProps<R, K> = { ...base, sort: { key: "v", desc: true } };
    // @ts-expect-error: an onSort needs its sort
    const onSortNoSort: TableProps<R, K> = { ...base, onSort: (s: SortBy<K>) => s };
    expect([...ok, listNoOnSort, listOneKey, oneAdd, capNone, sortNoOnSort, onSortNoSort]).toHaveLength(9);
  });
});

describe("Table sorting by several keys", () => {
  interface P { n: string; a: number | null; b: number | null }
  type PK = "n" | "a" | "b";
  // The columns, for a table whose sort keys may also hold X.
  const pc = <X extends string = never>(): Column<P, PK | X>[] => [{ id: "n", header: "Name", value: r => r.n, sort: "asc" },
    { id: "a", header: "A", value: r => r.a, align: "num", sort: "desc" }, { id: "b", header: "B", value: r => r.b, align: "num", sort: "desc" }];
  const PC = pc();
  const PR: P[] = [{ n: "p", a: 1, b: 2 }, { n: "q", a: 1, b: null }, { n: "r", a: 1, b: 3 }, { n: "s", a: null, b: 5 }, { n: "t", a: 2, b: 1 },
    { n: "u", a: null, b: null }, { n: "w", a: 1, b: 2 }];
  const list = (sort: readonly SortBy<PK>[], rest: Partial<Pick<TableProps<P, PK>, "manualSort" | "columns">> = {}) =>
    <Table name="T" rows={PR} columns={PC} rowId={r => r.n} sort={sort} onSort={() => {}} {...rest} />;

  it("marks each sorted header with its arrow and rank, and only the first with aria-sort", () => {
    renderApp(list([{ key: "b", desc: true }, { key: "n", desc: false }]));
    const b = screen.getByRole("button", { name: "B, sort 1 of 2" }), n = screen.getByRole("button", { name: "Name, sort 2 of 2, ascending" });
    expect([b.closest("th")!.getAttribute("aria-sort"), n.closest("th")!.hasAttribute("aria-sort")]).toEqual(["descending", false]);
    expect([b.querySelector(".sortmark")!.textContent, n.querySelector(".sortmark")!.textContent]).toEqual(["↓1", "↑2"]);
    expect(screen.getByRole("button", { name: "A" }).closest("th")!.hasAttribute("aria-sort")).toBe(false);
    expect(document.querySelectorAll("[aria-sort]")).toHaveLength(1);
  });

  it("sorts rows by each key in turn, rows with no value last for each key, ties in their order, in both directions", () => {
    const { rerender } = renderApp(list([{ key: "a", desc: true }, { key: "b", desc: true }]));
    expect(names()).toEqual(["t", "r", "p", "w", "q", "s", "u"]);
    rerender(list([{ key: "a", desc: false }, { key: "b", desc: false }]));
    expect(names()).toEqual(["p", "w", "r", "q", "t", "s", "u"]);
    rerender(list([{ key: "b", desc: true }, { key: "n", desc: true }]));
    expect(names()).toEqual(["s", "r", "w", "p", "t", "u", "q"]);
  });

  it("leaves rows in the order given under a manual sort, and still marks the headers", () => {
    renderApp(list([{ key: "a", desc: true }, { key: "b", desc: true }], { manualSort: true }));
    expect(names()).toEqual(["p", "q", "r", "s", "t", "u", "w"]);
    expect(screen.getByRole("button", { name: "A, sort 1 of 2" }).closest("th")!.getAttribute("aria-sort")).toBe("descending");
  });

  it("hands onSort the next list: one column on a press, an added one on Shift or with sortAdd, the last replaced at sortMax", async () => {
    const onSort = vi.fn<(s: SortBy<PK>[]) => void>(), user = userEvent.setup();
    const sort: SortBy<PK>[] = [{ key: "a", desc: true }];
    const { rerender } = renderApp(<Table name="T" rows={PR} columns={PC} rowId={r => r.n} sort={sort} onSort={onSort} />);
    await user.click(screen.getByRole("button", { name: "Name" }));
    expect(onSort).toHaveBeenLastCalledWith([{ key: "n", desc: false }]);
    await user.click(screen.getByRole("button", { name: "A" }));
    expect(onSort).toHaveBeenLastCalledWith([{ key: "a", desc: false }]);
    await user.keyboard("{Shift>}");
    await user.click(screen.getByRole("button", { name: "B" }));
    await user.keyboard("{/Shift}");
    expect(onSort).toHaveBeenLastCalledWith([{ key: "a", desc: true }, { key: "b", desc: true }]);
    rerender(<Table name="T" rows={PR} columns={PC} rowId={r => r.n} sort={sort} onSort={onSort} sortAdd />);
    screen.getByRole("button", { name: "Name" }).focus();
    await user.keyboard("{Enter}");
    expect(onSort).toHaveBeenLastCalledWith([{ key: "a", desc: true }, { key: "n", desc: false }]);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Name" }));
    rerender(<Table name="T" rows={PR} columns={PC} rowId={r => r.n} sort={sort} onSort={onSort} sortAdd sortMax={1} />);
    await user.click(screen.getByRole("button", { name: "B" }));
    expect(onSort).toHaveBeenLastCalledWith([{ key: "b", desc: true }]);
    expect(onSort).toHaveBeenCalledTimes(5);
    expect(names()).toEqual(["t", "p", "q", "r", "w", "s", "u"]); // controlled: the rows follow the sort given
  });

  it("gives a custom header cell the first key and an onSort that sorts by one key", async () => {
    const onSort = vi.fn<(s: SortBy<PK>[]) => void>();
    const cols: Column<P, PK>[] = [PC[0]!, { ...PC[1]!, th: h => <th scope="col" className={h.className}>
      <button type="button" onClick={() => h.onSort?.({ key: "b", desc: false })}>{`first ${h.sort?.key}`}</button></th> }, PC[2]!];
    renderApp(<Table name="T" rows={PR} columns={cols} rowId={r => r.n} sort={[{ key: "b", desc: true }, { key: "a", desc: true }]} onSort={onSort} sortAdd />);
    await userEvent.click(screen.getByRole("button", { name: "first b" }));
    expect(onSort).toHaveBeenCalledWith([{ key: "b", desc: false }]);
  });

  it("ranks and sorts only by the keys a column sorts by, unless the rows come sorted", async () => {
    const cols: Column<P, PK | "x">[] = [...pc<"x">(), { id: "x", header: "X", value: r => r.a }];
    const sort: SortBy<PK | "x">[] = [{ key: "x", desc: true }, { key: "b", desc: true }];
    const onSort = vi.fn<(s: SortBy<PK | "x">[]) => void>(), user = userEvent.setup();
    const { rerender } = renderApp(<Table name="T" rows={PR} columns={cols} rowId={r => r.n} sort={sort} onSort={onSort} />);
    expect(names()).toEqual(["s", "r", "p", "w", "t", "q", "u"]);
    const b = screen.getByRole("button", { name: "B" });
    expect([b.closest("th")!.getAttribute("aria-sort"), b.querySelector(".sortmark")!.textContent]).toEqual(["descending", "↓"]);
    await user.keyboard("{Shift>}");
    await user.click(screen.getByRole("button", { name: "A" }));
    await user.keyboard("{/Shift}");
    expect(onSort).toHaveBeenLastCalledWith([{ key: "b", desc: true }, { key: "a", desc: true }]); // the next list holds no key it cannot sort by
    // Under a manual sort the server ordered by every key: the list stays as given.
    rerender(<Table name="T" rows={PR} columns={cols} rowId={r => r.n} sort={sort} onSort={onSort} manualSort />);
    const mb = screen.getByRole("button", { name: "B, sort 2 of 2, descending" });
    expect([mb.closest("th")!.hasAttribute("aria-sort"), mb.querySelector(".sortmark")!.textContent]).toEqual([false, "↓2"]);
    expect(document.querySelectorAll("[aria-sort]")).toHaveLength(0);
  });

  it("re-sorts on a new sort whose ids and directions would read the same joined into a string", () => {
    interface Q { n: string; ab: number; a: number; b: number; ma: number }
    type QK = "n" | "a,b" | "a" | "b" | "-a";
    const cols: Column<Q, QK>[] = [{ id: "n", header: "Name", value: r => r.n }, { id: "a,b", header: "AB", value: r => r.ab, sort: "asc" },
      { id: "a", header: "A", value: r => r.a, sort: "asc" }, { id: "b", header: "B", value: r => r.b, sort: "asc" }, { id: "-a", header: "MA", value: r => r.ma, sort: "asc" }];
    const rows: Q[] = [{ n: "p", ab: 3, a: 1, b: 2, ma: 1 }, { n: "q", ab: 1, a: 2, b: 1, ma: 3 }, { n: "r", ab: 2, a: 1, b: 1, ma: 2 }];
    const t = (sort: SortBy<QK>[]) => <Table name="T" rows={rows} columns={cols} rowId={r => r.n} sort={sort} onSort={() => {}} />;
    const { rerender } = renderApp(t([{ key: "a,b", desc: false }]));
    expect(names()).toEqual(["q", "r", "p"]);
    rerender(t([{ key: "a", desc: false }, { key: "b", desc: false }]));
    expect(names()).toEqual(["r", "p", "q"]);
    rerender(t([{ key: "a", desc: true }]));
    expect(names()).toEqual(["q", "p", "r"]);
    rerender(t([{ key: "-a", desc: false }]));
    expect(names()).toEqual(["p", "r", "q"]);
  });

  it("orders rows tied on an infinite value by the next key, and keeps such ties in their order under one key", () => {
    const rows: P[] = [{ n: "p", a: Infinity, b: 1 }, { n: "q", a: Infinity, b: 3 }, { n: "r", a: 1, b: 5 }, { n: "s", a: -Infinity, b: 1 }, { n: "t", a: -Infinity, b: 2 }];
    const { rerender } = renderApp(<Table name="T" rows={rows} columns={PC} rowId={r => r.n} sort={[{ key: "a", desc: true }, { key: "b", desc: true }]} onSort={() => {}} />);
    expect(names()).toEqual(["q", "p", "r", "t", "s"]);
    rerender(<Table name="T" rows={rows} columns={PC} rowId={r => r.n} sort={{ key: "a", desc: true }} onSort={() => {}} />);
    expect(names()).toEqual(["p", "q", "r", "s", "t"]);
    rerender(<Table name="T" rows={rows} columns={PC} rowId={r => r.n} sort={{ key: "a", desc: false }} onSort={() => {}} />);
    expect(names()).toEqual(["s", "t", "r", "p", "q"]);
  });

  it("sorts a list by a column's extra key, then by the next key", () => {
    const [n, a] = pc<"z">();
    const cols: Column<P, PK | "z">[] = [n!, { ...a!, sorts: { z: r => r.b }, th: h => <th scope="col" className={h.className}>A and Z</th> }];
    renderApp(<Table name="T" rows={PR} columns={cols} rowId={r => r.n} sort={[{ key: "z", desc: true }, { key: "a", desc: true }]} onSort={() => {}} />);
    // z (b's value) most first, no value last; ties on z ordered by a, most first.
    expect(names()).toEqual(["s", "r", "p", "w", "t", "q", "u"]);
    const rows: P[] = [{ n: "p", a: 1, b: 2 }, { n: "q", a: 3, b: 2 }, { n: "r", a: null, b: 2 }, { n: "s", a: 2, b: 2 }];
    renderApp(<Table name="U" rows={rows} columns={cols} rowId={r => r.n} sort={[{ key: "z", desc: true }, { key: "a", desc: true }]} onSort={() => {}} />);
    expect([...screen.getByRole("table", { name: "U" }).querySelectorAll("tbody tr")].map(tr => tr.firstElementChild!.textContent)).toEqual(["q", "s", "p", "r"]);
  });

  it("draws a list of one key, and an empty list, with the single sort's DOM", () => {
    const html = (sort: SortBy<K> | readonly SortBy<K>[] | null, add?: boolean) => {
      const props = { name: "T", rows: ROWS, columns: COLS, rowId: (r: R) => r.n, pinned: [{ n: "total", v: 9 }] };
      const { container, unmount } = render(isSortList(sort) ? <Table {...props} sort={sort} onSort={() => {}} sortAdd={add} sortMax={add ? 2 : undefined} />
        : <Table {...props} sort={sort} onSort={() => {}} />);
      const h = container.innerHTML; unmount(); return h;
    };
    for (const desc of [true, false]) for (const key of ["n", "v"] as const) expect(html([{ key, desc }])).toBe(html({ key, desc }));
    expect(html([])).toBe(html(null));
    expect(html([{ key: "v", desc: true }], true)).toBe(html({ key: "v", desc: true }));
    expect(html({ key: "v", desc: true })).not.toContain('class="sr"'); // a single sort says no rank
  });
});

describe("Table sorting", () => {
  it("puts a sortable column's explanation behind a toggletip beside its sort button, next in the keyboard order", async () => {
    const cols: Column<R, K>[] = [{ ...COLS[0]!, tip: "What the thing is called" },
      { ...COLS[1]!, header: "Active", tip: "Active time: pauses over 20 minutes left out", tipTerm: "Active time" }];
    renderApp(<Table name="T" rows={[]} columns={cols} rowId={r => r.n} sort={null} onSort={() => {}} />);
    const [name, active] = screen.getAllByRole("columnheader");
    expect([active!.getAttribute("scope"), active!.hasAttribute("title"), active!.dataset.sort]).toEqual(["col", false, "v"]);
    await userEvent.tab(); // the region
    await userEvent.tab();
    expect(document.activeElement).toBe(within(name!).getByRole("button", { name: "Name" }));
    await userEvent.tab();
    expect(document.activeElement).toBe(within(name!).getByRole("button", { name: "About Name" }));
    await userEvent.tab();
    expect(document.activeElement).toBe(within(active!).getByRole("button", { name: "Active" }));
    await userEvent.tab();
    const tt = within(active!).getByRole("button", { name: "About Active time" });
    expect(document.activeElement).toBe(tt);
    await userEvent.keyboard("{Enter}");
    expect(tt.getAttribute("aria-expanded")).toBe("true");
    expect(within(active!).getByRole("tooltip").textContent).toBe("Active time: pauses over 20 minutes left out");
    await userEvent.keyboard("{Escape}");
    expect(tt.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(tt);
  });

  it("orders rows both ways, rows with no value last either way, and leaves the given rows alone", async () => {
    renderApp(<Sorted init={{ key: "v", desc: true }} />);
    expect(names()).toEqual(["a", "b", "c", "x"]);
    await userEvent.click(screen.getByRole("button", { name: "Value" }));
    expect(names()).toEqual(["c", "b", "a", "x"]);
    await userEvent.click(screen.getByRole("button", { name: "Name" }));
    expect(names()).toEqual(["a", "b", "c", "x"]);
    expect(ROWS[0]!.n).toBe("b");
  });

  it("puts NaN with the rows that have no value, and keeps ties in their order in both directions", () => {
    const rows = [{ n: "p", v: 1 }, { n: "q", v: NaN }, { n: "r", v: 2 }, { n: "s", v: 1 }, { n: "t", v: null }, { n: "u", v: 2 }];
    const { rerender } = renderApp(<Table name="T" rows={rows} columns={COLS} rowId={r => r.n} sort={{ key: "v", desc: true }} onSort={() => {}} />);
    expect(names()).toEqual(["r", "u", "p", "s", "q", "t"]);
    rerender(<Table name="T" rows={rows} columns={COLS} rowId={r => r.n} sort={{ key: "v", desc: false }} onSort={() => {}} />);
    expect(names()).toEqual(["p", "s", "r", "u", "q", "t"]);
  });

  it("marks only the sorted header, starts most first, flips on a second click, and is reachable by Tab", async () => {
    renderApp(<Sorted />);
    expect(names()).toEqual(["b", "x", "a", "c"]); // no sort: the order given
    expect([th("Name").getAttribute("aria-sort"), th("Value").getAttribute("aria-sort")]).toEqual([null, null]);
    await userEvent.tab(); // the region
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Name" }));
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    expect([th("Name").getAttribute("aria-sort"), th("Value").getAttribute("aria-sort")]).toEqual([null, "descending"]);
    expect(th("Value").dataset.sort).toBe("v");
    await userEvent.click(screen.getByRole("button", { name: "Value" }));
    expect(th("Value").getAttribute("aria-sort")).toBe("ascending");
    // asc: a name column sorts A to Z first.
    await userEvent.click(screen.getByRole("button", { name: "Name" }));
    expect([th("Name").getAttribute("aria-sort"), th("Value").getAttribute("aria-sort")]).toEqual(["ascending", null]);
  });

  it("is controlled: a click asks for a sort and the rows follow the sort it is given", async () => {
    const onSort = vi.fn<(s: SortBy<K>) => void>();
    renderApp(<Table name="T" rows={ROWS} columns={COLS} rowId={r => r.n} sort={null} onSort={onSort} />);
    await userEvent.click(screen.getByRole("button", { name: "Value" }));
    expect(onSort).toHaveBeenCalledWith({ key: "v", desc: true });
    expect(names()).toEqual(["b", "x", "a", "c"]);
    expect(th("Value").hasAttribute("aria-sort")).toBe(false);
  });

  it("sorts by an extra key that is also a display-only column's id, in either column order", () => {
    interface P { n: string; a: number; score: number }
    const rows: P[] = [{ n: "p", a: 1, score: 2 }, { n: "q", a: 2, score: 3 }, { n: "r", a: 3, score: 1 }];
    const a: Column<P, "n" | "a" | "score"> = { id: "a", header: "A", sort: "desc", value: r => r.a, sorts: { score: r => r.score },
      th: h => <th scope="col" className={h.className}>A and score</th> };
    const shown: Column<P, "n" | "a" | "score"> = { id: "score", header: "Score", align: "num", cell: r => r.score };
    const name: Column<P, "n" | "a" | "score"> = { id: "n", header: "Name", value: r => r.n };
    for (const cols of [[name, a, shown], [name, shown, a]]) {
      const { unmount } = renderApp(<Table name="T" rows={rows} columns={cols} rowId={r => r.n} sort={{ key: "score", desc: true }} onSort={() => {}} />);
      expect(names()).toEqual(["q", "p", "r"]);
      unmount();
    }
  });

  it("draws plain headers for columns that do not sort, and sorts nothing by them", () => {
    const cols: Column<R, K>[] = [{ id: "n", header: "Name", value: r => r.n }, COLS[1]!];
    renderApp(<Table name="T" rows={ROWS} columns={cols} rowId={r => r.n} sort={{ key: "n", desc: false }} onSort={() => {}} />);
    expect(screen.queryByRole("button", { name: "Name" })).toBeNull();
    expect(names()).toEqual(["b", "x", "a", "c"]);
  });
});

describe("Table rows", () => {
  it("keeps pinned rows on top, unsorted, and draws later rows with the table's columns", () => {
    renderApp(<Sorted init={{ key: "v", desc: false }} pinned={[{ n: "total", v: 99 }, { n: "zero", v: 0 }]}
      after={row => <>{row({ n: "fold", v: 5 }, 0)}<tr className="bucket"><td colSpan={2}>more</td></tr></>} />);
    expect(names()).toEqual(["total", "zero", "c", "b", "a", "x", "fold", "more"]);
    expect(screen.getByRole("rowheader", { name: "fold" }).nextElementSibling!.className).toBe("num");
  });

  it("opens what a row stands for, marks it for the context menu, and marks the current row", async () => {
    const open = vi.fn<(v: string, el: HTMLElement, r: R) => void>();
    renderApp(<Table name="T" rows={ROWS} columns={[{ ...COLS[0]!, cell: r => <button type="button" className="cellbtn">{r.n}</button> }, COLS[1]!]}
      rowId={r => r.n} current="a" pick={{ value: r => r.n === "x" ? null : `p-${r.n}`, open, subject: r => ({ kind: "project", value: r.n }) }} />);
    const tr = (n: string) => screen.getByRole("button", { name: n }).closest("tr")!;
    expect([tr("b").className, tr("b").dataset.v, tr("b").dataset.subject]).toEqual(["pick", "p-b", "project:b"]);
    expect(tr("a").className).toBe("pick sel");
    expect([tr("x").className, tr("x").hasAttribute("data-v")]).toEqual(["", false]);
    await userEvent.click(tr("c").querySelector("td")!);
    expect(open).toHaveBeenCalledWith("p-c", screen.getByRole("button", { name: "c" }), ROWS[3]);
  });

  it("does not open a row from a click on a checkbox or a label in it, and still opens it from a plain cell and its button", async () => {
    const open = vi.fn<(v: string, el: HTMLElement, r: R) => void>();
    const columns: Column<R>[] = [
      { id: "pick", header: "Pick", rowHeader: false, cell: r => <label><input type="checkbox" aria-label={`Pick ${r.n}`} /> <span>tick {r.n}</span></label> },
      { id: "n", header: "Name", rowHeader: true, cell: r => <button type="button" className="cellbtn">{r.n}</button> },
      { id: "note", header: "Note", cell: r => <label>note {r.n}</label> },
      { id: "v", header: "Value", value: r => r.v, align: "num" },
    ];
    renderApp(<Table name="T" rows={ROWS} columns={columns} rowId={r => r.n} pick={{ value: r => `p-${r.n}`, open }} />);
    const box = screen.getByRole<HTMLInputElement>("checkbox", { name: "Pick b" });
    await userEvent.click(box);
    expect(box.checked).toBe(true);
    await userEvent.click(screen.getByText("tick b"));
    expect(box.checked).toBe(false);
    await userEvent.click(screen.getByText("note b"));
    expect(open).not.toHaveBeenCalled();
    // The checkbox cell comes first and is no row header; the button's cell is.
    expect(screen.getByRole("rowheader", { name: "b" }).previousElementSibling!.tagName).toBe("TD");
    await userEvent.click(box.closest("tr")!.querySelector("td.num")!);
    expect(open).toHaveBeenCalledWith("p-b", screen.getByRole("button", { name: "b" }), ROWS[0]);
    await userEvent.click(screen.getByRole("button", { name: "a" }));
    expect(open).toHaveBeenLastCalledWith("p-a", screen.getByRole("button", { name: "a" }), ROWS[2]);
    expect(open).toHaveBeenCalledTimes(2);
  });

  it("sets a row's own attributes, its class after pick and sel, and lets a pick's own win", async () => {
    const own = vi.fn<() => void>(), open = vi.fn<(v: string, el: HTMLElement, r: R) => void>();
    renderApp(<Table name="T" rows={ROWS} columns={COLS} rowId={r => r.n} current="a" rowProps={r => ({ "data-c": r.n, className: r.v ? undefined : "none", onClick: own })}
      pick={{ value: r => r.n === "b" ? "p-b" : null, open }} />);
    const tr = (n: string) => screen.getByRole("rowheader", { name: n }).closest("tr")!;
    expect([tr("a").dataset.c, tr("a").className, tr("x").className, tr("c").hasAttribute("class")]).toEqual(["a", "sel", "none", false]);
    expect([tr("b").dataset.c, tr("b").className, tr("b").dataset.v]).toEqual(["b", "pick", "p-b"]);
    await userEvent.click(tr("c").querySelector("td")!);
    expect(own).toHaveBeenCalledTimes(1);
    await userEvent.click(tr("b").querySelector("td")!);
    expect([own.mock.calls.length, open.mock.calls.length]).toEqual([1, 1]);
  });

  // React's duplicate-key warning fails the test (test-setup.ts).
  it("keeps its own row keys: a key from rowProps never replaces the row's id", () => {
    renderApp(<Table name="T" rows={ROWS} columns={COLS} rowId={r => r.n} rowProps={() => ({ key: "same" }) as RowAttrs} />);
    expect(names()).toEqual(["b", "x", "a", "c"]);
  });

  it("re-sorts when a column's value changes on the same rows and sort", () => {
    const rows = [{ n: "a", v: 1 }, { n: "b", v: 2 }], sort = { key: "v" as const, desc: false };
    const cols = (f: (v: number) => number): Column<R, K>[] => [{ id: "n", header: "Name", value: r => r.n }, { id: "v", header: "Value", value: r => f(r.v!), sort: "desc" }];
    const { rerender } = renderApp(<Table name="T" rows={rows} columns={cols(v => v)} rowId={r => r.n} sort={sort} onSort={() => {}} />);
    const values = () => [...document.querySelectorAll("tbody td")].map(td => td.textContent);
    expect(values()).toEqual(["1", "2"]);
    rerender(<Table name="T" rows={rows} columns={cols(v => -v)} rowId={r => r.n} sort={sort} onSort={() => {}} />);
    expect(values()).toEqual(["-2", "-1"]);
    expect(names()).toEqual(["b", "a"]);
  });

  it("leaves a cell with no value empty: null, undefined or NaN", () => {
    const rows = [{ n: "a", v: null }, { n: "b", v: NaN }, { n: "c", v: 0 }];
    renderApp(<Table name="T" rows={rows} columns={COLS} rowId={r => r.n} />);
    expect(screen.getAllByRole("cell").map(td => td.textContent)).toEqual(["", "", "0"]);
  });

  it("sets a cell's own attributes and classes per row, after the column's", () => {
    const cols: Column<R, K>[] = [COLS[0]!, { ...COLS[1]!, hide: 0, cellProps: r => ({ className: r.v ? "bad" : undefined, title: `${r.v ?? "no"} failed` }) }];
    renderApp(<Table name="T" rows={[{ n: "a", v: 2 }, { n: "b", v: 0 }]} columns={cols} rowId={r => r.n} />);
    expect(screen.getAllByRole("cell").map(td => [td.className, td.title])).toEqual([["num opt bad", "2 failed"], ["num opt", "0 failed"]]);
    expect(screen.getAllByRole("columnheader")[1]!.hasAttribute("title")).toBe(false);
  });
});
