import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { drawn } from "../../components/echart/testing";
import { StartTrend } from "./StartTrend";

// What the chart draws is startWeeks.test.ts's to test. Here what a user reaches on the fake runtime.
const wk = (week: string, median: number, sessions = 9) => ({ week, median, p25: median * .8, p75: median * 1.3, sessions });
// Nov 2 and Nov 16 with Nov 9 missing, then Nov 23 right after.
const trend = [wk("2026-11-02", 24_000), wk("2026-11-16", 20_000, 2), wk("2026-11-23", 26_000)];

const chart = () => screen.getByRole("group", { name: /^Median starting context/ });
const live = () => document.querySelector("[aria-live]")!.textContent;
const tip = () => screen.getByRole("tooltip");
const key = (k: string) => fireEvent.keyDown(chart(), { key: k });

describe("StartTrend", () => {
  it("reads a week of 2 sessions in the live sentence and the tooltip, and says it rests on few sessions", () => {
    render(<StartTrend view="v" trend={trend} />);
    act(() => chart().focus());
    key("Home");
    key("ArrowRight");
    key("ArrowRight");
    expect(live()).toBe("Week of Nov 16: median 20k tokens (25th to 75th percentile 16k to 26k), 2 sessions, which rests on few sessions");
    expect([...tip().querySelectorAll(".row")].map(r => r.textContent)).toEqual(["Median20k", "25th to 75th percentile16k to 26k", "Sessions2"]);
    expect(within(tip()).getByText("Week of Nov 16")).toBeTruthy();
    expect(within(tip()).getByText("Rests on few sessions")).toBeTruthy();
  });

  it("reads an empty week by its key, and keeps the reading on its week when an earlier week joins", () => {
    const { rerender } = render(<StartTrend view="v" trend={trend} />);
    act(() => chart().focus());
    key("Home");
    key("ArrowRight");
    expect(live()).toBe("Week of Nov 9: no session started.");
    expect(tip().textContent).toBe("Week of Nov 9No session started");
    // An earlier week joins the same view: the reading stays on its week, at its new index.
    rerender(<StartTrend view="v" trend={[wk("2026-10-26", 30_000), ...trend]} />);
    expect(tip().textContent).toBe("Week of Nov 9No session started");
    key("ArrowLeft");
    expect(live()).toBe("Week of Nov 2: median 24k tokens (25th to 75th percentile 19.2k to 31.2k), 9 sessions");
  });

  it("reads the week under the pointer", async () => {
    render(<StartTrend view="v" trend={trend} />);
    const fake = await drawn();
    fake.fire("mousemove", fake.pointAt(3));
    expect(within(tip()).getByText("Week of Nov 23")).toBeTruthy();
  });

  it("lists every week in a table, closed until asked for", () => {
    render(<StartTrend view="v" trend={trend} />);
    expect(screen.queryByRole("table")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show data table" }));
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(within(rows[1]!).getAllByRole("cell")[0]!.textContent).toBe("24k");
  });

  it("reads the only week, and draws nothing for none", () => {
    const { container, rerender } = render(<StartTrend view="v" trend={[wk("2026-11-02", 24_000)]} />);
    expect(chart().getAttribute("aria-label")).toContain("the only week: 24k tokens");
    act(() => chart().focus());
    key("End");
    expect(live()).toBe("Week of Nov 2: median 24k tokens (25th to 75th percentile 19.2k to 31.2k), 9 sessions");
    rerender(<StartTrend view="v" trend={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
