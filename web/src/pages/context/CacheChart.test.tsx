import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CacheBucket, ContextPayload } from "../../api";
import { CacheChart, cacheSlots, ratioFloor, stack } from "./CacheChart";

type Series = ContextPayload["cost"]["series"];
const b = (day: string, o: Partial<CacheBucket> = {}): CacheBucket => ({ day, input: 0, cache_read: 0, cache_write: 0, model_switch: 0, expired: 0, other: 0, ...o });
const daily = (...rows: CacheBucket[]): Series => ({ bucket: "day", rows });
const chart = () => screen.getByRole("group", { name: /Cache waste/ });
const key = (k: string) => fireEvent.keyDown(chart(), { key: k });
const readout = () => document.querySelector(".readout")!.textContent;
const h = (el: Element) => Number(el.getAttribute("height"));
const seg = (day: string, c: string) => document.querySelector(`rect[data-day="${day}"][data-seg="${c}"]`);
const reads = () => screen.getByRole("button", { name: "Cache reads" });
/** A day's waste: 900k read from the cache, 60k written to it and 40k sent uncached, a 90% cache-hit ratio. */
const DAY = { cache_read: 900_000, cache_write: 60_000, input: 40_000 };

beforeEach(() => {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, right: 800, bottom: 300, width: 800, height: 300, x: 0, y: 0, toJSON: () => ({}) });
});

describe("cacheSlots", () => {
  it("leaves a day with no row as an empty slot", () => {
    const s = cacheSlots(daily(b("2026-11-01", { input: 1 }), b("2026-11-03", { input: 1 })));
    expect(s.map(x => x.day)).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"]);
    expect(s.map(x => x.row == null)).toEqual([false, true, false]);
  });
  it("steps a week at a time", () => {
    const s = cacheSlots({ bucket: "week", rows: [b("2026-11-02", { input: 1 }), b("2026-11-16", { input: 1 })] });
    expect(s.map(x => x.day)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16"]);
  });
});

describe("ratioFloor", () => {
  it("starts the ratio track at 90%, or lower at the lowest ratio's tenth", () => {
    expect(ratioFloor([.93, .97])).toBe(.9);
    expect(ratioFloor([.62, .97])).toBe(.6);
    expect(ratioFloor([0])).toBe(0);
  });
});

describe("cache chart", () => {
  it("draws the uncached input and the cache writes as the bars, with no cache reads", () => {
    render(<CacheChart series={daily(b("2026-11-01", DAY))} />);
    const i = h(seg("2026-11-01", "seg-input")!), w = h(seg("2026-11-01", "seg-write")!);
    // The segment over the first is 1px shorter: the surface shows between them.
    expect((w + 1) / i).toBeCloseTo(1.5, 1);
    expect(seg("2026-11-01", "seg-read")).toBeNull();
    expect(reads().getAttribute("aria-pressed")).toBe("false");
  });

  it("scales the bars to the waste, not the prompt", () => {
    render(<CacheChart series={daily(b("2026-11-01", DAY), b("2026-11-02", { input: 50_000 }))} />);
    // The tallest waste is 100k; 50k of uncached input is half as tall, whatever the 900k of reads.
    expect(h(seg("2026-11-02", "seg-input")!) / (h(seg("2026-11-01", "seg-input")!) + h(seg("2026-11-01", "seg-write")!) + 1)).toBeCloseTo(.5, 1);
  });

  it("adds the cache reads on top on request, rescaling the bars, and takes them away again", async () => {
    render(<CacheChart series={daily(b("2026-11-01", DAY))} />);
    const before = h(seg("2026-11-01", "seg-input")!);
    await userEvent.click(reads());
    expect(reads().getAttribute("aria-pressed")).toBe("true");
    const r = seg("2026-11-01", "seg-read")!;
    expect(Number(r.getAttribute("y"))).toBeLessThan(Number(seg("2026-11-01", "seg-write")!.getAttribute("y")));
    expect(h(seg("2026-11-01", "seg-input")!)).toBeLessThan(before / 5);
    await userEvent.click(reads());
    expect(seg("2026-11-01", "seg-read")).toBeNull();
    expect(h(seg("2026-11-01", "seg-input")!)).toBeCloseTo(before);
  });

  it("labels the waste track's total with what the bars draw, in each mode", async () => {
    render(<CacheChart series={daily(b("2026-11-01", DAY), b("2026-11-02", DAY))} />);
    const texts = () => [...document.querySelectorAll(".cache-chart svg text")].map(t => t.textContent);
    // Off: the waste, 2 x (40k + 60k). On: every prompt token, 2 x 1M.
    expect(texts()).toContain("Tokens not read from the cache");
    expect(texts()).toContain("200k in this view");
    await userEvent.click(reads());
    expect(texts()).toContain("Prompt tokens");
    expect(texts()).toContain("2M in this view");
    expect(texts()).not.toContain("200k in this view");
  });

  it("marks the bucket being read by an outline, leaving every bar at full strength", () => {
    render(<CacheChart series={daily(b("2026-11-01", DAY), b("2026-11-02", { ...DAY, expired: 1 }))} />);
    key("ArrowRight");
    const on = seg("2026-11-01", "seg-input")!.parentElement!;
    expect(on.classList.contains("on")).toBe(true);
    expect(seg("2026-11-02", "seg-input")!.parentElement!.classList.contains("on")).toBe(false);
    expect(document.querySelectorAll(".cache-chart svg [opacity]")).toHaveLength(0);
    expect(document.querySelector(".cache-chart svg line.cursor")).toBeTruthy();
  });

  it("shortens a track's figure when the plot is too narrow for the title beside it", () => {
    const w = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(260);
    render(<CacheChart series={daily(b("2026-11-01", DAY))} />);
    const texts = [...document.querySelectorAll(".cache-chart svg text")].map(t => t.textContent);
    expect(texts).toContain("100k");
    expect(texts).not.toContain("100k in this view");
    w.mockRestore();
  });

  it("draws a tiny nonzero part at least 2px tall", () => {
    render(<CacheChart series={daily(b("2026-11-01", { input: 1_000_000, cache_write: 10 }))} />);
    expect(h(seg("2026-11-01", "seg-write")!)).toBe(2);
  });

  it("keeps a full stack with thin parts inside its track: the thin parts take their minimum from the tall one", () => {
    // A stack the whole 180px track tall, of one big part and two thin ones: its top stays at the track's top, every part shows.
    const parts = stack([["seg-input", 998], ["seg-write", 1], ["seg-read", 1]], 180, 180 / 1000);
    expect(parts.map(p => p.key)).toEqual(["seg-input", "seg-write", "seg-read"]);
    expect(parts.at(-1)!.y).toBeCloseTo(0);
    for (const p of parts) expect(p.h).toBeGreaterThanOrEqual(2);
    // Bottom first, each part 1px above the last: the surface shows between them.
    parts.slice(1).forEach((p, k) => expect(p.y + p.h + 1).toBeCloseTo(parts[k]!.y));
    expect(parts[0]!.y + parts[0]!.h).toBeCloseTo(180);
    // A zero part takes no room.
    expect(stack([["seg-input", 5], ["seg-write", 0]], 100, 1).map(p => p.key)).toEqual(["seg-input"]);
  });

  it("keeps the busiest day's breaks inside the 48px strip, its thin causes shown", () => {
    render(<CacheChart series={daily(b("2026-11-01", { ...DAY, model_switch: 998, expired: 1, other: 1 }))} />);
    const rects = [...document.querySelectorAll<SVGRectElement>('rect[data-cause][data-day="2026-11-01"]')];
    expect(rects.map(r => r.getAttribute("data-cause"))).toEqual(["model_switch", "expired", "other"]);
    const y = (r: Element) => Number(r.getAttribute("y")), bottom = y(rects[0]!) + h(rects[0]!);
    // The busiest day fills the strip exactly: from its baseline up 48px, no higher.
    expect(bottom - y(rects.at(-1)!)).toBeCloseTo(48);
    for (const r of rects) expect(h(r)).toBeGreaterThanOrEqual(2);
  });

  it("reads a 90% cache-hit ratio, the breaks by cause and the cache reads, with the reads switched off", () => {
    render(<CacheChart series={daily(b("2026-11-01", { ...DAY, model_switch: 2, expired: 1 }))} />);
    act(() => chart().focus());
    key("Home");
    expect(readout()).toBe("Nov 1, 2026: 40k uncached input, 60k cache write, 900k cache read, cache-hit ratio 90%, breaks: 2 model switches, 1 expired");
    const tip = screen.getByRole("tooltip").textContent!;
    expect(tip).toContain("Not from cache100k");
    expect(tip).toContain("Cache read900k");
    expect(tip).toContain("90%");
  });

  it("states the waste and the ratio in its name", () => {
    render(<CacheChart series={daily(b("2026-11-01", { ...DAY, other: 1 }))} />);
    expect(chart().getAttribute("aria-label")).toMatch(/^Cache waste Nov 1, 2026 to Nov 1, 2026: 100k tokens not read from the cache \(40k uncached input, 60k cache write\), 90% of prompt tokens read from the cache, 1 cache break\./);
  });

  it("draws the breaks in the strip by cause", () => {
    render(<CacheChart series={daily(b("2026-11-01", { input: 1, model_switch: 2, expired: 1 }))} />);
    const c = (k: string) => document.querySelector(`rect[data-cause="${k}"]`);
    // The expired segment sits on the model switches, 1px inset.
    expect(h(c("model_switch")!) / (h(c("expired")!) + 1)).toBeCloseTo(2);
    expect(c("other")).toBeNull();
  });

  it("puts the hit ratio on its own track under the breaks, from 90% to 100%", () => {
    const { container } = render(<CacheChart series={daily(b("2026-11-01", { cache_read: 95, input: 5 }), b("2026-11-02", { cache_read: 99, input: 1 }))} />);
    const ticks = [...container.querySelectorAll("text[data-ratio-tick]")].map(t => t.textContent);
    expect(ticks).toEqual(["90%", "100%"]);
    const dots = [...container.querySelectorAll("circle.ratio-dot")].map(d => Number(d.getAttribute("cy")));
    const strip = Math.max(...[...container.querySelectorAll("rect[data-cause], rect[data-seg]")].map(r => Number(r.getAttribute("y")) + h(r)));
    expect(Math.min(...dots)).toBeGreaterThan(strip);
    expect(dots[0]!).toBeGreaterThan(dots[1]!); // 95% sits lower than 99%
  });

  it("keeps a missing day as a slot between the bars either side", () => {
    render(<CacheChart series={daily(b("2026-11-01", { input: 10 }), b("2026-11-03", { input: 10 }))} />);
    const x = (d: string) => Number(seg(d, "seg-input")!.getAttribute("x"));
    // Three slots share the 740px plot (800 less the axis): the bars are two slots apart.
    expect(x("2026-11-03") - x("2026-11-01")).toBeCloseTo(2 * 740 / 3);
    expect(document.querySelector('rect[data-day="2026-11-02"]')).toBeNull();
  });

  it("breaks the ratio line at a day with no request", () => {
    render(<CacheChart series={daily(b("2026-11-01", { cache_read: 9, input: 1 }), b("2026-11-02", { cache_read: 9, input: 1 }), b("2026-11-04", { cache_read: 9, input: 1 }))} />);
    expect(document.querySelector("path.ratio")!.getAttribute("d")!.match(/M/g)).toHaveLength(2);
  });

  it("reads the bucket under the pointer", () => {
    const days = Array.from({ length: 10 }, (_, i) => b(`2026-11-${String(i + 1).padStart(2, "0")}`, { input: 10 }));
    const { container } = render(<CacheChart series={daily(...days)} />);
    // The hit rect is the plot: 740px wide here, ten slots of 74px. The centre of the second slot is 111px in.
    const rect = container.querySelector('svg rect[fill="transparent"]')!;
    rect.getBoundingClientRect = () => ({ left: 52, right: 792, width: 740, top: 0, bottom: 300, height: 300, x: 52, y: 0, toJSON: () => ({}) });
    fireEvent.pointerMove(rect, { clientX: 52 + 111, clientY: 50 });
    expect(readout()).toContain("Nov 2");
    fireEvent.pointerMove(rect, { clientX: 52 + 740 - 5, clientY: 50 });
    expect(readout()).toContain("Nov 10");
  });

  it("labels weekly buckets as weeks", () => {
    render(<CacheChart series={{ bucket: "week", rows: [b("2026-11-02", { input: 10 })] }} />);
    act(() => chart().focus());
    key("Home");
    expect(readout()).toMatch(/^Week of Nov 2, 2026/);
    expect(screen.getByRole("tooltip").textContent).toContain("Week of");
  });

  it("skips empty slots with the arrow keys", () => {
    render(<CacheChart series={daily(b("2026-11-01", { input: 10 }), b("2026-11-04", { input: 20 }))} />);
    act(() => chart().focus());
    key("ArrowRight"); expect(readout()).toContain("Nov 1");
    key("ArrowRight"); expect(readout()).toContain("Nov 4");
    key("ArrowRight"); expect(readout()).toContain("Nov 4");
    key("ArrowLeft"); expect(readout()).toContain("Nov 1");
    key("Escape"); expect(readout()).toBe("");
  });

  it("offers every bucket as a table, cache reads included", async () => {
    render(<CacheChart series={{ bucket: "week", rows: [b("2026-11-02", { ...DAY, expired: 3 })] }} />);
    await userEvent.click(screen.getByRole("button", { name: "Show data table" }));
    const t = screen.getByRole("table", { name: "Cache use by bucket" });
    expect(within(t).getAllByRole("columnheader").map(c => c.textContent)).toEqual(
      ["Week of", "Uncached input", "Cache write", "Cache read", "Cache-hit ratio", "Model switch", "Expired", "Other"]);
    expect(within(t).getAllByRole("row")[1]!.textContent).toBe("Nov 2, 202640k60k900k90%030");
  });

  it("shows only the empty state with no rows", () => {
    const { container } = render(<CacheChart series={daily()} />);
    expect(container.textContent).toBe("No request in this view.");
  });
});
