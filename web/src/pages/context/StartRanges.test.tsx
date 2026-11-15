import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContextPayload } from "../../api";
import { setOrder } from "../../colors";
import * as sheets from "../../components/sheets/session";
import { rangeBox, StartRanges } from "./StartRanges";

type Starting = ContextPayload["starting"];
const foo = { project: "foo", sessions: 3, median: 24_000, p10: 20_800, p90: 60_800, window: 200_000, window_share: .12 };
const bar = { project: "bar", sessions: 2, median: 8_500, p10: 8_100, p90: 8_900, window: null, window_share: null };
const starting = (by: Starting["by_project"]): Starting => ({ sessions: 5, median: 20_000, p10: 8_100, p90: 60_800, window_share: .1, by_project: by, trend: [] });
const left = (el: Element) => parseFloat((el as HTMLElement).style.left), width = (el: Element) => parseFloat((el as HTMLElement).style.width);

beforeEach(() => setOrder(["foo", "bar"]));

describe("rangeBox", () => {
  it("is the range as percentages of the scale", () => {
    expect(rangeBox(25, 75, 100)).toEqual({ left: 25, width: 50 });
    expect(rangeBox(10, 10, 100).width).toBeGreaterThan(0);
  });
});

describe("StartRanges", () => {
  it("draws each range from p10 to p90 on one shared scale", () => {
    const { container } = render(<StartRanges starting={starting([foo, bar])} />);
    const bars = container.querySelectorAll("[data-testid=rng-bar]");
    const max = 60_800 * 1.08;
    expect(left(bars[1]!)).toBeCloseTo(20_800 / max * 100, 2);
    expect(width(bars[1]!)).toBeCloseTo((60_800 - 20_800) / max * 100, 2);
    expect(left(bars[2]!)).toBeCloseTo(8_100 / max * 100, 2);
    expect(width(bars[2]!)).toBeLessThan(width(bars[1]!) / 10);
    // Bar 0 is the whole view's, neutral; the project bars take their colours.
    expect((bars[1] as HTMLElement).style.background).toMatch(/--proj-/);
  });

  it("puts the threshold line at 30,000 tokens on every row", () => {
    const { container } = render(<StartRanges starting={starting([foo, bar])} />);
    const marks = container.querySelectorAll("[data-testid=rng-mark]");
    expect(marks).toHaveLength(3);
    marks.forEach(m => expect(left(m)).toBeCloseTo(30_000 / (60_800 * 1.08) * 100, 2));
  });

  it("shows no share for a project with a null window", () => {
    render(<StartRanges starting={starting([foo, bar])} />);
    const row = (n: string) => screen.getByRole("button", { name: n }).closest("tr")!;
    const cells = within(row("bar")).getAllByRole("cell").map(c => c.textContent);
    expect(cells).toContain("–");
    expect(within(row("foo")).getByText(/of 200k/)).toBeTruthy();
    expect(within(row("bar")).queryByText(/ of /)).toBeNull();
  });

  it("has a whole-view row only with more than one project", () => {
    const { rerender } = render(<StartRanges starting={starting([foo, bar])} />);
    expect(screen.getByText("Whole view")).toBeTruthy();
    rerender(<StartRanges starting={starting([foo])} />);
    expect(screen.queryByText("Whole view")).toBeNull();
  });

  it("names its columns and the scale", () => {
    render(<StartRanges starting={starting([foo, bar])} />);
    expect(screen.getAllByRole("columnheader").map(h => h.textContent!.replace(/0dashed.*/, ""))).toEqual(
      ["Project", "10th to 90th percentile", "Median", "10th percentile", "90th percentile", "Share of window", "Sessions"]);
  });

  it("opens the project sheet when a row is selected", async () => {
    const open = vi.spyOn(sheets, "openProjectSheet").mockImplementation(() => {});
    render(<StartRanges starting={starting([foo, bar])} />);
    await userEvent.click(screen.getByRole("button", { name: "foo" }));
    expect(open).toHaveBeenCalledWith("foo");
    open.mockRestore();
  });

  it("says so when no session has a measured start", () => {
    render(<StartRanges starting={starting([])} />);
    expect(screen.getByText("No session in this view has a measured start.")).toBeTruthy();
  });
});
