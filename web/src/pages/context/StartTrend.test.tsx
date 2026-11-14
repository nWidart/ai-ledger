import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { dayLabel } from "../../format";
import { readWeek, StartTrend } from "./StartTrend";

const wk = (week: string, median: number, sessions = 9) => ({ week, median, p25: median * .8, p75: median * 1.3, sessions });
// Nov 2 and Nov 16 with Nov 9 missing, then Nov 23 right after.
const trend = [wk("2026-11-02", 24_000), wk("2026-11-16", 20_000, 2), wk("2026-11-23", 26_000)];

describe("StartTrend", () => {
  it("places weeks by date and leaves a gap for a missing week", () => {
    const { container } = render(<StartTrend trend={trend} />);
    const cx = [...container.querySelectorAll("circle.dot")].map(c => +c.getAttribute("cx")!);
    expect(cx).toHaveLength(3);
    expect((cx[1]! - cx[0]!) / (cx[2]! - cx[1]!)).toBeCloseTo(2, 5);
  });

  it("marks a week of 2 sessions and names it in the readout", () => {
    const { container } = render(<StartTrend trend={trend} />);
    expect(container.querySelectorAll("circle.dot.few")).toHaveLength(1);
    const chart = screen.getByRole("group");
    fireEvent.keyDown(chart, { key: "ArrowRight" });
    fireEvent.keyDown(chart, { key: "ArrowRight" });
    const text = document.querySelector(".readout")!.textContent!;
    expect(text).toBe(readWeek(trend[1]!));
    expect(text).toContain(`Week of ${dayLabel("2026-11-16")}: median 20k tokens (25th to 75th percentile 16k to 26k), 2 sessions`);
    expect(text).toContain("rests on few sessions");
  });

  it("steps with the arrow keys, Home and End, and clears with Escape", () => {
    render(<StartTrend trend={trend} />);
    const chart = screen.getByRole("group"), out = () => document.querySelector(".readout")!.textContent;
    fireEvent.keyDown(chart, { key: "End" });
    expect(out()).toBe(readWeek(trend[2]!));
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    expect(out()).toBe(readWeek(trend[1]!));
    fireEvent.keyDown(chart, { key: "Home" });
    expect(out()).toBe(readWeek(trend[0]!));
    expect(out()).not.toContain("few sessions");
    fireEvent.keyDown(chart, { key: "Escape" });
    expect(out()).toBe("");
  });

  it("draws a band, a halo under the median, the 30k line, and states first and last medians", () => {
    const { container } = render(<StartTrend trend={trend} />);
    expect(container.querySelectorAll("path.band")).toHaveLength(1);
    expect(container.querySelectorAll("path.trend-line")).toHaveLength(2);
    expect(container.querySelector("g.threshold")).not.toBeNull();
    const label = screen.getByRole("group").getAttribute("aria-label")!;
    expect(label).toContain("24k tokens");
    expect(label).toContain("26k");
  });

  it("reads the week under the pointer", () => {
    const { container } = render(<StartTrend trend={trend} />);
    const rect = container.querySelector("svg rect")!;
    rect.getBoundingClientRect = () => ({ left: 52, right: 786, width: 734, top: 10, bottom: 154, height: 144, x: 52, y: 10, toJSON: () => ({}) });
    fireEvent.pointerMove(rect, { clientX: 52 + 734 });
    expect(document.querySelector(".readout")!.textContent).toBe(readWeek(trend[2]!));
  });

  it("lists every week in a table, closed until asked for", () => {
    render(<StartTrend trend={trend} />);
    expect(screen.queryByRole("table")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show data table" }));
    expect(screen.getAllByRole("row")).toHaveLength(4);
  });

  it("draws one dot and no line for one week, and nothing for none", () => {
    const { container, rerender } = render(<StartTrend trend={[wk("2026-11-02", 24_000)]} />);
    expect(container.querySelectorAll("circle.dot")).toHaveLength(1);
    expect(container.querySelector("path.trend-line")).toBeNull();
    rerender(<StartTrend trend={[]} />);
    expect(container.querySelector("svg")).toBeNull();
  });
});
