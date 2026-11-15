import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { sortRows, SortTh, type SortBy } from "./Sort";
import { renderApp } from "../testing";

describe("sortRows", () => {
  it("orders a copy both ways, rows with no value last either way", () => {
    const rows = [{ n: "b", v: 2 }, { n: "x", v: null }, { n: "a", v: 3 }, { n: "c", v: 1 }];
    expect(sortRows(rows, r => r.v, true).map(r => r.n)).toEqual(["a", "b", "c", "x"]);
    expect(sortRows(rows, r => r.v, false).map(r => r.n)).toEqual(["c", "b", "a", "x"]);
    expect(sortRows(rows, r => r.n, false).map(r => r.n)).toEqual(["a", "b", "c", "x"]);
    expect(rows[0]!.n).toBe("b");
  });
});

function Table({ init = null }: { init?: SortBy<"a" | "b"> | null }) {
  const [s, set] = useState(init);
  return <table><thead><tr><SortTh k="a" sort={s} onSort={set}>A</SortTh><SortTh k="b" sort={s} onSort={set} asc>B</SortTh></tr></thead></table>;
}

describe("SortTh", () => {
  it("marks only the sorted header, flips on a second click, and is reachable by Tab", async () => {
    renderApp(<Table />);
    const th = (n: string) => screen.getByRole("button", { name: n }).closest("th")!;
    expect([th("A").getAttribute("aria-sort"), th("B").getAttribute("aria-sort")]).toEqual([null, null]);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "A" }));
    await userEvent.keyboard("{Enter}");
    expect([th("A").getAttribute("aria-sort"), th("B").getAttribute("aria-sort")]).toEqual(["descending", null]);
    await userEvent.click(screen.getByRole("button", { name: "A" }));
    expect(th("A").getAttribute("aria-sort")).toBe("ascending");
    // asc: a name column sorts A to Z first.
    await userEvent.click(screen.getByRole("button", { name: "B" }));
    expect([th("A").getAttribute("aria-sort"), th("B").getAttribute("aria-sort")]).toEqual([null, "ascending"]);
  });
});

describe("SortTh title", () => {
  it("scopes the header to its column and puts the explanation behind a toggletip beside the sort button", async () => {
    renderApp(<table><thead><tr><SortTh k="a" sort={null} onSort={() => {}} title="Active time: pauses over 20 minutes left out">Active</SortTh></tr></thead></table>);
    const th = screen.getByRole("columnheader");
    expect(th.getAttribute("scope")).toBe("col");
    expect(th.hasAttribute("title")).toBe(false);
    await userEvent.tab(); // the sort button
    await userEvent.tab(); // the toggletip
    const tt = screen.getByRole("button", { name: "About Active" });
    expect(document.activeElement).toBe(tt);
    await userEvent.keyboard("{Enter}");
    expect(tt.getAttribute("aria-expanded")).toBe("true");
    expect(within(th).getByRole("status").textContent).toBe("Active time: pauses over 20 minutes left out");
    await userEvent.keyboard("{Escape}");
    expect(tt.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(tt);
  });
});
