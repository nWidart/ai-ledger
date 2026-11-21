import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { nextSort, sortRows, SortTh, type SortBy } from "./Sort";
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
    expect(within(th).getByRole("tooltip").textContent).toBe("Active time: pauses over 20 minutes left out");
    await userEvent.keyboard("{Escape}");
    expect(tt.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(tt);
  });
});

describe("nextSort", () => {
  type L = SortBy<"a" | "b" | "c" | "d">[];
  const A: L[number] = { key: "a", desc: true }, B: L[number] = { key: "b", desc: false }, C: L[number] = { key: "c", desc: true };

  it("replaces the sort with the pressed column in its first direction", () => {
    expect(nextSort([], "a", true, false)).toEqual([A]);
    expect(nextSort([A], "b", false, false)).toEqual([B]);
    // Without add, a key that is not the only one starts again in its first direction, alone.
    expect(nextSort([{ key: "a", desc: false }, B], "a", true, false)).toEqual([A]);
    expect(nextSort([A, B], "b", false, false)).toEqual([B]);
  });

  it("reverses the only key, and never removes it without add", () => {
    expect(nextSort([A], "a", true, false)).toEqual([{ key: "a", desc: false }]);
    expect(nextSort([{ key: "a", desc: false }], "a", true, false)).toEqual([A]);
  });

  it("adds a key last, reverses it on a second press and removes it on a third", () => {
    const added = nextSort([A], "b", false, true);
    expect(added).toEqual([A, B]);
    const reversed = nextSort(added, "b", false, true);
    expect(reversed).toEqual([A, { key: "b", desc: true }]);
    expect(nextSort(reversed, "b", false, true)).toEqual([A]);
    // The first key cycles the same way and leaves the later ones in place.
    expect(nextSort([A, B], "a", true, true)).toEqual([{ key: "a", desc: false }, B]);
    expect(nextSort([{ key: "a", desc: false }, B], "a", true, true)).toEqual([B]);
  });

  it("returns an empty list after removing the only key", () => {
    const once = nextSort([], "a", true, true);
    expect(once).toEqual([A]);
    const twice = nextSort(once, "a", true, true);
    expect(twice).toEqual([{ key: "a", desc: false }]);
    expect(nextSort(twice, "a", true, true)).toEqual([]);
  });

  it("replaces the last key at the cap, three by default, and keeps the first ones", () => {
    expect(nextSort([A, B, C], "d", true, true)).toEqual([A, B, { key: "d", desc: true }]);
    expect(nextSort([A, B], "c", true, true, 2)).toEqual([A, C]);
    expect(nextSort([A, B], "c", true, true, 3)).toEqual([A, B, C]);
    // At the cap, a key already in the sort still cycles.
    expect(nextSort([A, B, C], "b", false, true)).toEqual([A, { key: "b", desc: true }, C]);
  });

  it("leaves the given list alone", () => {
    const list: L = [A, B];
    nextSort(list, "c", true, true);
    nextSort(list, "b", false, true);
    expect(list).toEqual([A, B]);
  });
});

type ABC = "a" | "b" | "c";
const heads = (sort: SortBy<ABC> | readonly SortBy<ABC>[] | null, onSort: (s: SortBy<ABC>, shift: boolean) => void = () => {}) =>
  <table><thead><tr><SortTh k="a" sort={sort} onSort={onSort}>A</SortTh><SortTh k="b" sort={sort} onSort={onSort} asc>B</SortTh>
    <SortTh k="c" sort={sort} onSort={onSort}>C</SortTh></tr></thead></table>;

describe("SortTh with several keys", () => {
  it("shows each sorted header's arrow and rank, says its rank in the button's name, and puts aria-sort on the first key only", () => {
    renderApp(heads([{ key: "b", desc: false }, { key: "a", desc: true }]));
    const b = screen.getByRole("button", { name: "B, sort 1 of 2" }), a = screen.getByRole("button", { name: "A, sort 2 of 2, descending" });
    expect([b.closest("th")!.getAttribute("aria-sort"), a.closest("th")!.hasAttribute("aria-sort")]).toEqual(["ascending", false]);
    expect([b.querySelector(".sortmark")!.textContent, a.querySelector(".sortmark")!.textContent]).toEqual(["↑1", "↓2"]);
    expect(b.querySelector(".sortmark")!.getAttribute("aria-hidden")).toBe("true");
    expect(a.querySelector(".sr")!.textContent).toBe(", sort 2 of 2, descending");
    const c = screen.getByRole("button", { name: "C" });
    expect([c.closest("th")!.hasAttribute("aria-sort"), c.querySelector(".sortmark")!.textContent, c.querySelector(".sr")]).toEqual([false, "", null]);
  });

  it("says an ascending later key and the count of three keys", () => {
    renderApp(heads([{ key: "c", desc: true }, { key: "a", desc: true }, { key: "b", desc: false }]));
    expect(screen.getByRole("button", { name: "C, sort 1 of 3" }).querySelector(".sortmark")!.textContent).toBe("↓1");
    expect(screen.getByRole("button", { name: "A, sort 2 of 3, descending" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "B, sort 3 of 3, ascending" }).querySelector(".sortmark")!.textContent).toBe("↑3");
  });

  it("draws a list of one key, or none, as the single sort does", () => {
    const html = (sort: SortBy<ABC> | readonly SortBy<ABC>[] | null) => { const { container, unmount } = render(heads(sort)); const h = container.innerHTML; unmount(); return h; };
    expect(html([{ key: "a", desc: true }])).toBe(html({ key: "a", desc: true }));
    expect(html([{ key: "b", desc: false }])).toBe(html({ key: "b", desc: false }));
    expect(html([])).toBe(html(null));
    expect(html({ key: "a", desc: true })).not.toContain('class="sr"');
  });

  it("reports the press with Shift: a click, a Shift-click and Shift+Enter", async () => {
    const onSort = vi.fn<(s: SortBy<ABC>, shift: boolean) => void>(), user = userEvent.setup();
    renderApp(heads([{ key: "a", desc: true }, { key: "b", desc: false }], onSort));
    await user.click(screen.getByRole("button", { name: "C" }));
    expect(onSort).toHaveBeenLastCalledWith({ key: "c", desc: true }, false);
    await user.keyboard("{Shift>}");
    await user.click(screen.getByRole("button", { name: "C" }));
    await user.keyboard("{/Shift}");
    expect(onSort).toHaveBeenLastCalledWith({ key: "c", desc: true }, true);
    screen.getByRole("button", { name: "B, sort 2 of 2, ascending" }).focus();
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(onSort).toHaveBeenLastCalledWith({ key: "b", desc: true }, true);
    await user.keyboard("{Enter}");
    expect(onSort).toHaveBeenLastCalledWith({ key: "b", desc: true }, false);
  });

  it("keeps a Shift-click from selecting text, and leaves other presses and the single sort alone", () => {
    const { unmount } = render(heads([{ key: "a", desc: true }]));
    const btn = () => screen.getByRole("button", { name: "A" });
    expect(fireEvent.mouseDown(btn(), { shiftKey: true })).toBe(false); // default prevented
    expect(fireEvent.mouseDown(btn())).toBe(true);
    unmount();
    render(heads({ key: "a", desc: true }));
    expect(fireEvent.mouseDown(btn(), { shiftKey: true })).toBe(true);
  });
});
