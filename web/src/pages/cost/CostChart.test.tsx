import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UsagePayload } from "../../api";
import usage from "../../__fixtures__/usage";
import { setOrder } from "../../colors";
import { dayRange, usd } from "../../format";
import { CostChart } from "./CostChart";

const day = "2026-11-04";
const base = usage.by_project[0]!;
const proj = (project: string, cost: number) => ({ ...base, project, cost, unpriced: 0 });
const pd = (project: string, cost: number) => ({ day, project, cost, tokens: 1 });
// A owns a hue and is named; B to E are Other, with B the costliest.
const d: UsagePayload = { ...usage, start: day, end: day, range: 1, project: "", daily: [{ ...usage.daily[0]!, day, cost: 19.5, unpriced: 0 }],
  daily_projects: [pd("A", 10), pd("B", 5), pd("C", 3), pd("D", 1), pd("E", 0.5)],
  by_project: [proj("A", 10), proj("B", 5), proj("C", 3), proj("D", 1), proj("E", 0.5)] };

const chart = () => screen.getByRole("img", { name: /Estimated cost by project/ });
const open = () => {
  render(<CostChart d={d} metric="cost" onMetric={() => {}} hidden={[]} onHidden={() => {}} onProject={() => {}} onDay={() => {}} />);
  act(() => chart().focus());
  fireEvent.keyDown(chart(), { key: "Home" });
};

beforeEach(() => {
  // The plot reads its size from the svg; jsdom lays nothing out.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, right: 800, bottom: 240, width: 800, height: 240, x: 0, y: 0, toJSON: () => ({}) });
  setOrder(["A"]);
});
afterEach(() => setOrder([]));

describe("cost tooltip: Other's projects", () => {
  it("lists the top three under Other, then + 1 more", () => {
    open();
    const rows = [...screen.getByRole("tooltip").querySelectorAll(".row.sub")].map(r => r.textContent);
    expect(rows).toEqual([`B${usd(5)}`, `C${usd(3)}`, `D${usd(1)}`, "+ 1 more"]);
  });

  it("reads the same list in the screen-reader text", () => {
    open();
    expect(document.querySelector(".sr")!.textContent).toContain(`Other (4) ${usd(9.5)} (B ${usd(5)}, C ${usd(3)}, D ${usd(1)}, and 1 more)`);
  });
});

describe("cost chart: today so far", () => {
  // 20 days ending today ($1 a day, today $40): the average covers complete days only.
  const days = dayRange("2026-10-16", "2026-11-04");
  const long: UsagePayload = { ...d, start: days[0]!, end: days.at(-1)!, range: 20,
    daily: days.map((x, i) => ({ ...usage.daily[0]!, day: x, cost: i === 19 ? 40 : 1, unpriced: 0 })),
    daily_projects: days.map((x, i) => ({ day: x, project: "A", cost: i === 19 ? 40 : 1, tokens: 1 })), by_project: [proj("A", 59)] };
  const show = (data = long) => render(<CostChart d={data} metric="cost" onMetric={() => {}} hidden={[]} onHidden={() => {}} onProject={() => {}} onDay={() => {}} />);

  it("hatches only today's bar and keys it in the legend", () => {
    show();
    expect(document.querySelectorAll(".partial")).toHaveLength(1);
    expect(document.querySelector(".partial")!.getAttribute("fill")).toBe("url(#partial-day)");
    expect(screen.getByText("Today so far")).toBeTruthy();
  });

  it("labels today 'so far' in the tooltip and the screen-reader text, and yesterday not", () => {
    show();
    act(() => chart().focus());
    fireEvent.keyDown(chart(), { key: "End" });
    expect(screen.getByRole("tooltip").textContent).toContain("so far");
    expect(document.querySelector(".sr")!.textContent).toContain("so far");
    fireEvent.keyDown(chart(), { key: "ArrowLeft" });
    expect(document.querySelector(".sr")!.textContent).not.toContain("so far");
  });

  it("leaves today out of the average: the line ends yesterday and has no point for today", () => {
    show();
    act(() => chart().focus());
    fireEvent.keyDown(chart(), { key: "End" });
    expect(document.querySelector(".sr")!.textContent).not.toContain("7-day average");
    fireEvent.keyDown(chart(), { key: "ArrowLeft" });
    expect(document.querySelector(".sr")!.textContent).toContain(`7-day average ${usd(1)}`); // not dragged up by today's $40
    const line = document.querySelectorAll("svg path[stroke='var(--text-primary)']")[0]!.getAttribute("d")!;
    expect(line.split("L")).toHaveLength(13); // the 7th to the 19th day
  });
});
