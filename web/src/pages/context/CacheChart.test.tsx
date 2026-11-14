import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CacheBucket, ContextPayload } from "../../api";
import { CacheChart, cacheSlots } from "./CacheChart";

type Series = ContextPayload["cost"]["series"];
const b = (day: string, o: Partial<CacheBucket> = {}): CacheBucket => ({ day, input: 0, cache_read: 0, cache_write: 0, model_switch: 0, expired: 0, other: 0, ...o });
const daily = (...rows: CacheBucket[]): Series => ({ bucket: "day", rows });
const chart = () => screen.getByRole("group", { name: /Cache use/ });
const key = (k: string) => fireEvent.keyDown(chart(), { key: k });
const readout = () => document.querySelector(".readout")!.textContent;
const h = (el: Element) => Number(el.getAttribute("height"));
const seg = (day: string, c: string) => document.querySelector(`rect[data-day="${day}"][data-seg="${c}"]`)!;

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

describe("cache chart", () => {
  it("sizes a bucket's segments in proportion to its tokens", () => {
    render(<CacheChart series={daily(b("2026-11-01", { cache_read: 900_000, cache_write: 60_000, input: 40_000 }))} />);
    const [r, w, i] = ["seg-read", "seg-write", "seg-input"].map(c => h(seg("2026-11-01", c)));
    expect(r! / w!).toBeCloseTo(15); expect(w! / i!).toBeCloseTo(1.5);
  });

  it("reads a 90% cache-hit ratio and the breaks by cause", () => {
    render(<CacheChart series={daily(b("2026-11-01", { cache_read: 900_000, cache_write: 60_000, input: 40_000, model_switch: 2, expired: 1 }))} />);
    act(() => chart().focus());
    key("Home");
    expect(readout()).toContain("cache-hit ratio 90%");
    expect(readout()).toContain("2 model switches, 1 expired");
    expect(screen.getByRole("tooltip").textContent).toContain("90%");
  });

  it("draws the breaks in the strip by cause", () => {
    render(<CacheChart series={daily(b("2026-11-01", { input: 1, model_switch: 2, expired: 1 }))} />);
    const c = (k: string) => document.querySelector(`rect[data-cause="${k}"]`);
    expect(h(c("model_switch")!) / h(c("expired")!)).toBeCloseTo(2);
    expect(c("other")).toBeNull();
  });

  it("keeps a missing day as a slot between the bars either side", () => {
    render(<CacheChart series={daily(b("2026-11-01", { input: 10 }), b("2026-11-03", { input: 10 }))} />);
    const x = (d: string) => Number(seg(d, "seg-input").getAttribute("x"));
    // Three slots share the 704px plot (800 less the axes): the bars are two slots apart.
    expect(x("2026-11-03") - x("2026-11-01")).toBeCloseTo(2 * 704 / 3);
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

  it("shows only the empty state with no rows", () => {
    const { container } = render(<CacheChart series={daily()} />);
    expect(container.textContent).toBe("No request in this view.");
  });
});
