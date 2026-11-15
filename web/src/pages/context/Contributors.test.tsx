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
