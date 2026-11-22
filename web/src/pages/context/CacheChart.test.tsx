import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { CacheBucket, ContextPayload } from "../../api";
import type { SeriesOption } from "../../components/echart/echarts";
import { drawn } from "../../components/echart/testing";
import { dayRange } from "../../format";
import { CacheChart } from "./CacheChart";

// The model, the scales, the titles and the drawing are cacheTracks.test.ts's. Here what a user reaches through the component,
// on the fake runtime, which draws nothing: the label, the sentences, the tooltip, the toggle, the zoom, the table.

type Series = ContextPayload["cost"]["series"];
const b = (day: string, o: Partial<CacheBucket> = {}): CacheBucket => ({ day, input: 0, cache_read: 0, cache_write: 0, model_switch: 0, expired: 0, other: 0, ...o });
const daily = (...rows: CacheBucket[]): Series => ({ bucket: "day", rows });
const chart = () => screen.getByRole("group", { name: /^Cache waste/ });
const key = (k: string) => fireEvent.keyDown(chart(), { key: k });
const said = () => document.querySelector(".cache-chart .sr")!.textContent;
const tip = () => screen.queryByRole("tooltip");
const reads = () => screen.getByRole("button", { name: "Cache reads" });
const seriesIds = async () => ((await drawn()).last!.series as SeriesOption[]).map(s => s.id);
/** A day's waste: 900k read from the cache, 60k written to it and 40k sent uncached, a 90% cache-hit ratio. */
const DAY = { cache_read: 900_000, cache_write: 60_000, input: 40_000 };

describe("cache chart", () => {
  it("reads a 90% cache-hit ratio, the breaks by cause and the cache reads, with the reads switched off", () => {
    render(<CacheChart view="v" series={daily(b("2026-11-01", { ...DAY, model_switch: 2, expired: 1 }))} />);
    act(() => chart().focus());
    key("Home");
    expect(said()).toBe("Nov 1, 2026: 40k uncached input, 60k cache write, 900k cache read, cache-hit ratio 90%, breaks: 2 model switches, 1 expired");
    const t = tip()!.textContent!;
    expect(t).toContain("Not from cache100k");
    expect(t).toContain("Cache read900k");
    expect(t).toContain("90%");
  });

  it("states the waste and the ratio in its name, and has no zoom under 14 days", async () => {
    render(<CacheChart view="v" series={daily(b("2026-11-01", { ...DAY, other: 1 }))} />);
    expect(chart().getAttribute("aria-label")).toBe("Cache waste Nov 1, 2026 to Nov 1, 2026: 100k tokens not read from the cache (40k uncached input, "
      + "60k cache write), 90% of prompt tokens read from the cache, 1 cache break. Use the left and right arrow keys to read each day, Escape to dismiss it.");
    expect((await drawn()).last!.dataZoom ?? []).toEqual([]);
    act(() => chart().focus());
    expect(key("+")).toBe(true); // not taken: plus is the browser's
    expect(screen.queryByRole("button", { name: "Show all days" })).toBeNull();
  });

  it("adds the cache reads to the bars on request, and takes them away again", async () => {
    render(<CacheChart view="v" series={daily(b("2026-11-01", DAY))} />);
    const caption = () => document.querySelector(".cache-chart .caption")!.textContent;
    expect(reads().getAttribute("aria-pressed")).toBe("false");
    expect(caption()).toContain("Cache reads are left out of the bars until you turn them on.");
    expect(await seriesIds()).not.toContain("reads-edge");
    await userEvent.click(reads());
    expect(reads().getAttribute("aria-pressed")).toBe("true");
    expect(caption()).not.toContain("Cache reads are left out");
    expect(await seriesIds()).toContain("reads-edge");
    await userEvent.click(reads());
    expect(await seriesIds()).not.toContain("reads-edge");
  });

  it("reads an empty day as no request, by the keys and by the pointer, and keeps the day read through newer figures", async () => {
    const rows = [b("2026-11-03", { input: 10 }), b("2026-11-05", { input: 20 })];
    const { rerender } = render(<CacheChart view="v" series={daily(...rows)} />);
    const fake = await drawn();
    act(() => chart().focus());
    key("Home"); expect(said()).toMatch(/^Nov 3, 2026: /);
    key("ArrowRight");
    expect(said()).toBe("Nov 4, 2026: no request.");
    expect(tip()!.textContent).toBe("Nov 4, 2026No request");
    // Newer figures for the same view add a day before the first: Nov 4 moves to another index and stays read.
    rerender(<CacheChart view="v" series={daily(b("2026-11-01", { input: 5 }), ...rows)} />);
    expect(tip()!.textContent).toBe("Nov 4, 2026No request");
    key("ArrowRight"); expect(said()).toMatch(/^Nov 5, 2026: /);
    key("Escape"); expect(tip()).toBeNull();
    act(() => chart().blur());
    fake.fire("mousemove", fake.pointAt(3)); // Nov 4 of Nov 1 to Nov 5
    expect(tip()!.textContent).toBe("Nov 4, 2026No request");
    fake.fire("mousemove", fake.pointAt(4));
    expect(tip()!.textContent).toMatch(/^Nov 5, 2026Uncached input20/);
  });

  it("labels weekly buckets as weeks", () => {
    render(<CacheChart view="v" series={{ bucket: "week", rows: [b("2026-11-02", { input: 10 })] }} />);
    act(() => chart().focus());
    key("Home");
    expect(said()).toMatch(/^Week of Nov 2, 2026/);
    expect(tip()!.textContent).toContain("Week of");
  });

  it("offers every bucket as a table, cache reads included", async () => {
    render(<CacheChart view="v" series={{ bucket: "week", rows: [b("2026-11-02", { ...DAY, expired: 3 })] }} />);
    await userEvent.click(screen.getByRole("button", { name: "Show data table" }));
    const t = screen.getByRole("table", { name: "Cache use by bucket" });
    expect(within(t).getAllByRole("columnheader").map(c => c.textContent)).toEqual(
      ["Week of", "Uncached input", "Cache write", "Cache read", "Cache-hit ratio", "Model switch", "Expired", "Other"]);
    expect(within(t).getAllByRole("row")[1]!.textContent).toBe("Nov 2, 202640k60k900k90%030");
  });

  it("shows only the empty state with no rows", () => {
    const { container } = render(<CacheChart view="v" series={daily()} />);
    expect(container.textContent).toBe("No request in this view.");
  });
});

describe("cache chart zoom", () => {
  // Thirty days, Oct 7 to Nov 5, each with a request.
  const month = daily(...dayRange("2026-10-07", "2026-11-05").map(d => b(d, DAY)));
  const showAll = () => screen.queryByRole("button", { name: "Show all days" });

  it("zooms by plus around the day read, keeps the zoom through the toggle, and shows every day again from the button", async () => {
    const { rerender } = render(<CacheChart view="v" series={month} />);
    const fake = await drawn();
    expect(fake.last!.dataZoom).toHaveLength(1);
    expect(chart().getAttribute("aria-label")).toMatch(/ Plus and minus zoom\.$/);
    act(() => chart().focus());
    key("Home");
    for (let i = 0; i < 8; i++) key("ArrowRight"); // Oct 15
    key("+");
    expect(fake.shown).toEqual({ from: 4, to: 18 });
    expect(said()).toBe("Showing Oct 11 to Oct 25, 15 of 30 days.");
    await userEvent.click(reads());
    expect(await seriesIds()).toContain("reads-edge");
    expect(fake.shown).toEqual({ from: 4, to: 18 });
    await userEvent.click(screen.getByRole("button", { name: "Show data table" }));
    expect(within(screen.getByRole("table", { name: "Cache use by bucket" })).getAllByRole("row")).toHaveLength(31);
    await userEvent.click(showAll()!);
    expect(fake.shown).toEqual({ from: 0, to: 29 });
    expect(showAll()).toBeNull();
    expect(document.activeElement).toBe(chart());
    expect(said()).toBe("Showing all 30 days.");
    // Another view shows every day.
    fake.zoomTo(4, 13);
    expect(said()).toBe("Showing Oct 11 to Oct 20, 10 of 30 days.");
    rerender(<CacheChart view="w" series={month} />);
    expect((await drawn()).shown).toEqual({ from: 0, to: 29 });
    expect(showAll()).toBeNull();
  });
});
