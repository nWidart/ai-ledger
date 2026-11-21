import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DataTable } from "../DataTable";
import { SortTh, type SortBy } from "../Sort";
import { renderApp } from "../../testing";
import { Table, type Column, type TableProps } from "./Table";

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

  it("leaves rows in the order given under a manual sort, and still marks the header", () => {
    renderApp(<Table name="T" rows={ROWS} columns={COLS} rowId={r => r.n} sort={{ key: "v", desc: true }} onSort={() => {}} manualSort />);
    expect(names()).toEqual(["b", "x", "a", "c"]);
    expect(th("Value").getAttribute("aria-sort")).toBe("descending");
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

  it("marks the current row without a pick", () => {
    renderApp(<Table name="T" rows={ROWS} columns={COLS} rowId={r => r.n} current="c" />);
    expect(screen.getByRole("rowheader", { name: "c" }).closest("tr")!.className).toBe("sel");
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
