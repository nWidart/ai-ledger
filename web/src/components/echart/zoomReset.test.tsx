import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { EChart } from "./EChart";
import type { EChartsOption } from "./echarts";
import { zoomSlider } from "./option";
import { drawn } from "./testing";
import type { ChartEnv } from "./tokens";
import { useZoomReset } from "./zoomReset";

const LABEL = "Estimated cost per day, 30 days.";
const MONTH = Array.from({ length: 30 }, (_, i) => `Oct ${i + 1}`);
const month = (env: ChartEnv): EChartsOption => ({
  xAxis: { type: "category", data: MONTH },
  yAxis: { type: "value", max: 10 },
  series: [{ type: "line", data: MONTH.map((_, i) => i % 10), lineStyle: { color: env.color("var(--proj-1)") } }],
  dataZoom: [zoomSlider(env)],
});
const read = (i: number) => `${MONTH[i]}: $${i}.00`;

/** A chart of 30 points with the slider, and its "Show all days" button; `view` changes to end the zoom. */
function Zoomed({ view = "30 days" }: { view?: string }) {
  const { ref, onZoom, button } = useZoomReset();
  return <>
    {button("Show all days")}
    <EChart ref={ref} label={LABEL} height={268} option={month} view={view} points={MONTH.length} read={read} zoom onZoom={onZoom} />
  </>;
}
const box = () => screen.getByRole("group", { name: LABEL });
const showAll = () => screen.queryByRole("button", { name: "Show all days" });

describe("useZoomReset", () => {
  it("shows no button before a zoom", async () => {
    render(<Zoomed />);
    await drawn();
    expect(showAll()).toBeNull();
  });

  it("shows the button once the chart reports a zoom", async () => {
    render(<Zoomed />);
    const chart = await drawn();
    chart.zoomTo(10, 19);
    expect(showAll()!.className).toBe("show-all");
    fireEvent.keyDown(box(), { key: "+" });
    expect(showAll()).toBeTruthy();
  });

  it("shows every point on a press, goes away and focuses the box", async () => {
    render(<Zoomed />);
    const chart = await drawn();
    chart.zoomTo(10, 19);
    await userEvent.click(showAll()!);
    expect(chart.shown).toEqual({ from: 0, to: 29 });
    expect(showAll()).toBeNull();
    expect(document.activeElement).toBe(box());
  });

  it("moves the focus from the button to the box when the zoom ends with no one pressing it", async () => {
    const { rerender } = render(<Zoomed />);
    const chart = await drawn();
    chart.zoomTo(10, 19);
    act(() => showAll()!.focus());
    rerender(<Zoomed view="another view" />);
    expect(chart.shown).toEqual({ from: 0, to: 29 });
    expect(showAll()).toBeNull();
    expect(document.activeElement).toBe(box());
  });
});
