import { describe, expect, it } from "vitest";
import type { ContextOverhead, ContextPayload, ErrorsPayload, LimitsPayload } from "../../api";
import errors from "../../__fixtures__/errors";
import limits from "../../__fixtures__/limits";
import { DEFAULT_VIEW } from "../errors/view";
import { compare, filtered, makeModel, rate, sumCalls, TOPN, typeRows } from "../errors/model";
import { apportion, contextGrid, errorsBlock, GRID_CELLS, limitsBlock, REST_LABEL, type GridRow } from "./project";

const model = makeModel(errors as ErrorsPayload);
const lim = limits as LimitsPayload;

describe("errorsBlock", () => {
  // The Errors page's default view for the project: what it shows with only project, range and source in the URL.
  it("is the Errors page's own count and type rows, labelled with their category, for the default view", () => {
    for (const [range, source] of [[0, ""], [30, ""], [7, ""], [0, "codex"]] as const) {
      const v = { project: "foo", range, source }, view = { ...DEFAULT_VIEW, ...v }, f = filtered(model, view);
      const b = errorsBlock(model, v), all = typeRows(model, view, f);
      expect(b.errors).toBe(f.errs.length);
      expect(b.calls).toBe(sumCalls(view, f.calls));
      expect(b.rate).toBe(rate(f.errs.length, sumCalls(view, f.calls)));
      expect(b.cmp).toBe(compare(model, view, f).cmp);
      expect(b.types.map(t => t.row)).toEqual(all.slice(0, TOPN));
      expect(b.types.map(t => [t.cid, t.n, t.delta.text])).toEqual(all.slice(0, TOPN).map(r => [r.cid, r.n, r.delta.text]));
      for (const t of b.types) expect(t.label).toBe(model.cats[t.cid]!.label);
    }
    // The fixture's project has errors over all time, and fewer on one source: the rows above compare real counts.
    const all = errorsBlock(model, { project: "foo", range: 0, source: "" }).errors;
    expect(all).toBeGreaterThan(errorsBlock(model, { project: "foo", range: 0, source: "codex" }).errors);
  });
});

describe("limitsBlock", () => {
  it("lists the open windows that name the project, with its share and points", () => {
    const b = limitsBlock(lim, "foo")!;
    const named = lim.windows.filter(w => w.used?.projects.some(p => p.project === "foo"));
    expect(named.length).toBeGreaterThan(0);
    expect(b.windows.map(w => [w.share, w.points])).toEqual(named.map(w => { const r = w.used!.projects.find(p => p.project === "foo")!; return [r.share, r.points]; }));
    expect(b.windows.map(w => w.name)).toEqual(named.map(w => `${w.provider_label} ${w.label}`));
  });

  it("lists a limit's commits per point only when it has a figure", () => {
    expect(limitsBlock(lim, "foo")!.commits).toEqual([]); // the fixture's figures are null
    const withFigure: LimitsPayload = { ...lim, value: { ...lim.value, projects: lim.value.projects.map((p, i) => (i ? p : { ...p, commits: 12, commits_per_point: 0.5 })) } };
    expect(limitsBlock(withFigure, "foo")!.commits).toEqual([{ key: "claude-weekly", name: "Claude Code weekly", commits: 12, points: 522, commitsPerPoint: 0.5 }]);
  });

  it("is null when no window names the project and no limit has a figure for it", () => {
    expect(limitsBlock(lim, "nosuchproject")).toBeNull();
    expect(limitsBlock({ ...lim, windows: [], value: { ...lim.value, projects: [] } }, "foo")).toBeNull();
  });

  it("is a block with only commits when no window names the project", () => {
    const d: LimitsPayload = { ...lim, windows: lim.windows.map(w => ({ ...w, used: null })),
      value: { ...lim.value, projects: lim.value.projects.map(p => ({ ...p, commits_per_point: 1.5 })) } };
    const b = limitsBlock(d, "foo")!;
    expect(b.windows).toEqual([]);
    expect(b.commits).toHaveLength(2);
  });
});

describe("contextGrid", () => {
  const ctx = (start: number | null, peak: number | null, over: { window?: number | null; startMedian?: number | null; peakMedian?: number | null } = {}) => ({
    starting: { sessions: 10, median: over.startMedian ?? 24000, window: over.window === undefined ? 200000 : over.window, window_share: start },
    growth: { peak: { sessions: 12, median: over.peakMedian ?? 80000, window_share: peak } },
  }) as unknown as ContextPayload;

  it("fills 24, 56 and 120 cells for a start of 12% and a peak of 40%", () => {
    const g = contextGrid(ctx(.12, .4))!;
    expect([g.start, g.added, g.free]).toEqual([24, 56, 120]);
    expect(g.rows.map(r => r.tokens)).toEqual([24000, 56000, 120000]);
    expect(g.rows.map(r => Math.round(r.share * 100))).toEqual([12, 28, 60]);
    expect(g.sessions).toBe(12);
  });
  it("fills the grid when the peak is over the window, and leaves out the free tokens without a known window", () => {
    const g = contextGrid(ctx(.12, 1.3, { peakMedian: 260000 }))!;
    expect([g.start, g.added, g.free]).toEqual([24, 176, 0]);
    expect(g.rows[2]!.share).toBe(0);
    expect(g.rows[2]!.tokens).toBe(0);
    expect(contextGrid(ctx(.12, .4, { window: null }))!.rows[2]!.tokens).toBeNull();
  });
  it("is null when the start's or peak's share is not known", () => {
    expect(contextGrid(ctx(null, .4))).toBeNull();
    expect(contextGrid(ctx(.1, null))).toBeNull();
  });
  it("keeps the start whole without a snapshot", () => {
    for (const overhead of [undefined, null]) {
      const g = contextGrid({ ...ctx(.12, .4), overhead } as ContextPayload)!;
      expect(g.overhead).toBeNull();
      expect(g.rows.map(r => [r.key, r.label, r.cells])).toEqual([["start", "Starting context", 24], ["added", "Added by the peak", 56], ["free", "Free space", 120]]);
    }
  });
});

describe("contextGrid with a snapshot", () => {
  type Cat = ContextOverhead["categories"][number];
  const snap = (cats: [string, number, Cat["state"]?][], over: Partial<ContextOverhead> = {}): ContextOverhead => ({
    ts: "2026-11-10T09:30:00Z", session_id: "m1", model: "claude-opus-4-1", version: "2.1.0", window: 200000,
    categories: cats.map(([name, tokens, state]) => ({ name, tokens, state: state ?? "used" })),
    top: { mcp_servers: [], memory_files: [], skills: [] }, ...over,
  });
  // S 40,000 tokens at 20% of a 200k window: 40 starting cells.
  const ctx = (overhead: ContextOverhead, median = 40000, startShare = .2) => ({
    starting: { sessions: 10, median, window: 200000, window_share: startShare },
    growth: { peak: { sessions: 12, median: 100000, window_share: .5 } }, overhead,
  }) as unknown as ContextPayload;
  const scenario = snap([["System prompt", 4000], ["System tools", 12000], ["Skills", 4000], ["Messages", 9000], ["MCP tools", 7000, "deferred"],
    ["Autocompact buffer", 33000, "buffer"], ["Free space", 120000, "free"]]);
  const starts = (rows: GridRow[]) => rows.filter(r => r.key !== "added" && r.key !== "free");

  it("splits the start 10% system prompt, 30% system tools, 10% skills and 50% first prompt and other", () => {
    const g = contextGrid(ctx(scenario))!;
    expect(g.start).toBe(40);
    expect(starts(g.rows).map(r => [r.label, r.tokens, r.cells])).toEqual([
      ["System prompt", 4000, 4], ["System tools", 12000, 12], ["Skills", 4000, 4], [REST_LABEL, 20000, 20]]);
    expect(starts(g.rows).map(r => Math.round(r.share * 1000) / 1000)).toEqual([.02, .06, .02, .1]);
    expect(g.rows.slice(-2).map(r => [r.key, r.cells])).toEqual([["added", 60], ["free", 100]]);
    expect(g.overhead).toEqual({ ts: scenario.ts, model: "claude-opus-4-1", deferred: 7000, overflow: false, top: scenario.top });
    // Each category has its own tone, and the rest its own.
    expect(starts(g.rows).map(r => r.tone)).toEqual(["p0", "p1", "p2", "rest"]);
  });

  it("splits among the categories alone when they exceed the median start", () => {
    const g = contextGrid(ctx(snap([["System prompt", 10000], ["System tools", 30000], ["MCP tools", 10000]])))!;
    expect(g.overhead!.overflow).toBe(true);
    expect(starts(g.rows).map(r => [r.label, r.tokens, r.cells])).toEqual([["System prompt", 10000, 8], ["System tools", 30000, 24], ["MCP tools", 10000, 8]]);
    expect(starts(g.rows).reduce((a, r) => a + r.share, 0)).toBeCloseTo(.2);
  });

  it("rounds so that the parts fill exactly the starting cells", () => {
    for (const [median, share] of [[24000, .12], [31000, .155], [17777, .09]] as const) {
      const g = contextGrid(ctx(snap([["System prompt", 3001], ["System tools", 5003], ["Memory files", 7000], ["Skills", 333]]), median, share))!;
      expect(starts(g.rows).reduce((a, r) => a + r.cells, 0)).toBe(g.start);
      expect(g.rows.reduce((a, r) => a + r.cells, 0)).toBe(GRID_CELLS);
    }
  });

  it("drops the parts with no tokens", () => {
    const g = contextGrid(ctx(snap([["System prompt", 10000], ["Custom agents", 0], ["System tools", 30000]])))!;
    expect(starts(g.rows).map(r => r.label)).toEqual(["System prompt", "System tools"]);
  });
});

describe("apportion", () => {
  it("sums to n, giving the remainder to the largest fractions, a tie to the earlier", () => {
    expect(apportion(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(apportion(7, [1, 2, 4])).toEqual([1, 2, 4]);
    expect(apportion(5, [0.4, 0.6])).toEqual([2, 3]);
    expect(apportion(3, [0, 0])).toEqual([0, 0]);
  });
});
