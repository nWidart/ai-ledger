import { screen, within } from "@testing-library/react";
import { renderApp } from "../../testing";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type { ContextPayload, FillRow } from "../../api";
import { RESULT_LARGE_BYTES } from "./context";
import { Contributors, logPos, rangeScale } from "./Contributors";

const row = (name: string, bytes: number, o: Partial<FillRow> = {}): FillRow =>
  ({ name, calls: 10, with_bytes: 10, bytes, est_tokens: Math.floor(bytes / 4), p50_bytes: 1_200, p95_bytes: 48_000, max_bytes: 90_000, ...o });
const many = (n: number, prefix = "T") => Array.from({ length: n }, (_, i) => row(`${prefix}${i + 1}`, (n - i) * 10_000));
const fills = (tools: FillRow[], mcp: FillRow[] = [], main = 750_000, sub = 250_000): ContextPayload["fills"] =>
  ({ main_bytes: main, subagent_bytes: sub, tools, mcp, largest: [] });
const hash = () => new URLSearchParams(location.search.slice(1));
const body = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
const cells = (row: HTMLElement) => [...row.querySelectorAll("th[scope=row], td")].map(c => c.textContent);

beforeEach(() => history.replaceState(null, "", "/context"));

describe("Contributors", () => {
  it("shows equal totals with ranges far apart for many small and a few huge results", () => {
    renderApp(<Contributors fills={fills([row("Read", 2_000_000, { calls: 400, p50_bytes: 4_000, p95_bytes: 12_000 }), row("Bash", 2_000_000, { calls: 8, p50_bytes: 200_000, p95_bytes: 900_000 })])} />);
    const [read, bash] = body(), bar = (r: HTMLElement) => r.querySelector<HTMLElement>(".ctr-bar i")!.style.width;
    const left = (r: HTMLElement) => parseFloat(r.querySelector<HTMLElement>("[data-testid=ctr-range-bar]")!.style.left);
    expect(bar(read!)).toBe(bar(bash!));
    expect(left(bash!)).toBeGreaterThan(left(read!) + 30);
  });

  it("shows ten rows and an Other row summing the remaining four of 14 tools", () => {
    const tools = many(14);
    renderApp(<Contributors fills={fills(tools)} />);
    const rows = body();
    expect(rows).toHaveLength(11);
    const other = rows[10]!;
    expect(within(other).getByText("Other (4 tools)")).toBeTruthy();
    expect(other.textContent).toContain("100 KB"); // 40k + 30k + 20k + 10k
    expect(within(other).queryByRole("button")).toBeNull();
    expect(other.querySelector("[data-testid=ctr-range-bar]")).toBeNull();
  });

  it("shows all 14 rows on request, with no Other row, and folds them again", async () => {
    renderApp(<Contributors fills={fills(many(14))} />);
    await userEvent.click(screen.getByRole("button", { name: "Show all 14 tools" }));
    expect(body()).toHaveLength(14);
    expect(screen.queryByText(/^Other/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Show the top 10" }));
    expect(body()).toHaveLength(11);
  });

  it("sorts the ten largest by any column, and keeps the cut by total, the Other row last", async () => {
    const tools = many(12).map((r, i) => ({ ...r, calls: i + 1, max_bytes: (i + 1) * 1_000 })); // T12 has the most calls, T1 the largest total
    renderApp(<Contributors fills={fills(tools)} />);
    const names = () => body().map(r => r.querySelector("th")!.textContent);
    expect(screen.getByRole("button", { name: "Total result size" }).closest("th")!.getAttribute("aria-sort")).toBe("descending");
    expect(names()[0]).toBe("T1");
    await userEvent.click(screen.getByRole("button", { name: "Calls" }));
    expect(names().slice(0, 3)).toEqual(["T10", "T9", "T8"]); // the most calls among the ten largest
    expect(names().at(-1)).toBe("Other (2 tools)"); // T11 and T12, the smallest totals, whatever the sort
    expect(names()).toContain("T1");
    await userEvent.click(screen.getByRole("button", { name: "Tool" }));
    expect(names().slice(0, 3)).toEqual(["T1", "T10", "T2"]);
    await userEvent.click(screen.getByRole("button", { name: "Largest" }));
    expect(names()[0]).toBe("T10");
    expect(cells(body()[0]!).at(-1)).toBe("10 KB");
  });

  it("scales the total bars to the largest named row, with no bar for Other", () => {
    // Other sums 30 small tools to more than the largest named one: it must not shrink the named bars.
    const tools = [row("Big", 100_000), ...many(9, "M").map(r => ({ ...r, bytes: 50_000 })), ...many(30, "S").map(r => ({ ...r, bytes: 20_000 }))];
    renderApp(<Contributors fills={fills(tools)} />);
    const rows = body(), bar = (r: HTMLElement) => r.querySelector<HTMLElement>("[data-testid=ctr-total-bar]")?.style.width;
    expect(bar(rows[0]!)).toBe("100%");
    expect(bar(rows[1]!)).toBe("50%");
    expect(rows.at(-1)!.textContent).toContain("Other (30 tools)");
    expect(bar(rows.at(-1)!)).toBeUndefined();
  });

  it("keeps the scale out of the sort button's name", () => {
    renderApp(<Contributors fills={fills(many(2))} />);
    const btn = screen.getByRole("button", { name: "Typical result: median to 95th percentile (log scale)" });
    expect(btn.querySelector(".ctr-scale")).toBeNull();
    expect(btn.closest("th")!.querySelector(".ctr-scale")).not.toBeNull();
  });

  it("has no Other row for exactly ten", () => {
    renderApp(<Contributors fills={fills(many(10))} />);
    expect(body()).toHaveLength(10);
    expect(screen.queryByText(/^Other/)).toBeNull();
  });

  it("draws the split bar's two shares in bar and text", () => {
    renderApp(<Contributors fills={fills(many(2))} />);
    expect(screen.getByTestId("ctr-main").style.width).toBe("75%");
    expect(screen.getByTestId("ctr-sub").style.width).toBe("25%");
    expect(screen.getByText(/Main thread:/).textContent).toMatch(/750 KB.*75%.*estimate/);
    expect(screen.getByText(/Subagents:/).textContent).toMatch(/250 KB.*25%/);
    expect(screen.getByText(/never entered the main thread's context/)).toBeTruthy();
  });

  it("omits the split bar when both totals are zero", () => {
    renderApp(<Contributors fills={fills(many(2), [], 0, 0)} />);
    expect(screen.queryByTestId("ctr-main")).toBeNull();
  });

  it("draws no range for a null median or 95th percentile, but keeps the 100 KB line", () => {
    renderApp(<Contributors fills={fills([row("A", 50_000), row("B", 40_000, { p50_bytes: null, p95_bytes: null })])} />);
    const [a, b] = body();
    expect(a!.querySelector("[data-testid=ctr-range-bar]")).toBeTruthy();
    expect(b!.querySelector("[data-testid=ctr-range-bar]")).toBeNull();
    expect(b!.querySelector("[data-testid=ctr-mark]")).toBeTruthy();
  });

  it("places values on a log scale", () => {
    expect(logPos(100, 10, 1000) - logPos(10, 10, 1000)).toBeCloseTo(logPos(1000, 10, 1000) - logPos(100, 10, 1000));
    expect(logPos(100_000, 10_000, 1_000_000)).toBeCloseTo(.5);
    expect(logPos(1, 10, 1000)).toBe(0);
    const { lo, hi } = rangeScale([{ p50_bytes: 1_200, p95_bytes: 48_000 }, { p50_bytes: null, p95_bytes: null }]);
    expect(lo).toBe(1_000);
    expect(hi).toBe(RESULT_LARGE_BYTES);
    expect(rangeScale([{ p50_bytes: 500, p95_bytes: 3_000_000 }])).toEqual({ lo: 100, hi: 10_000_000 });
  });

  it("labels estimated tokens as estimates", () => {
    renderApp(<Contributors fills={fills(many(2))} />);
    expect(screen.getAllByText("estimate").length).toBeGreaterThan(2);
  });

  it("names both scales in the headings", () => {
    renderApp(<Contributors fills={fills(many(2))} />);
    expect(screen.getByRole("columnheader", { name: /Total result size/ })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: /Typical result: median to 95th percentile \(log scale\)/ })).toBeTruthy();
  });

  it("opens the tool sheet for a tool, and for an MCP server after the switch", async () => {
    renderApp(<Contributors fills={fills(many(2), many(2, "srv"))} />);
    await userEvent.click(screen.getByRole("button", { name: "T1" }));
    expect(hash().get("tool")).toBe("T1");
    await userEvent.click(screen.getByRole("button", { name: "By MCP server" }));
    expect(screen.getByRole("button", { name: "By MCP server" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "srv2" }));
    expect(hash().get("mcp")).toBe("srv2");
  });

  it("has no switch without an MCP row", () => {
    renderApp(<Contributors fills={fills(many(2))} />);
    expect(screen.queryByRole("button", { name: "By MCP server" })).toBeNull();
  });

  it("says so when the selected list is empty", async () => {
    renderApp(<Contributors fills={fills([], many(1, "srv"))} />);
    expect(screen.getByText("No tool result with a known size in this view.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
