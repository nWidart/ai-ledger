import { describe, expect, it } from "vitest";
import type { ContextPayload, ErrorsPayload, LimitsPayload } from "../../api";
import errors from "../../__fixtures__/errors";
import limits from "../../__fixtures__/limits";
import { DEFAULT_VIEW } from "../errors/view";
import { compare, filtered, makeModel, rate, sumCalls, TOPN, typeRows } from "../errors/model";
import { contextGrid, errorsBlock, errorsView, limitsBlock } from "./project";

const model = makeModel(errors as ErrorsPayload);
const lim = limits as LimitsPayload;

describe("errorsBlock", () => {
  // The Errors page's default view for the project: what it shows with only project, range and source in the URL.
  it("is the Errors page's own count and type rows for the default view", () => {
    for (const range of [0, 30, 7] as const) {
      const v = { project: "foo", range, source: "" as const }, view = { ...DEFAULT_VIEW, ...v }, f = filtered(model, view);
      const b = errorsBlock(model, v), all = typeRows(model, view, f);
      expect(b.errors).toBe(f.errs.length);
      expect(b.calls).toBe(sumCalls(view, f.calls));
      expect(b.rate).toBe(rate(f.errs.length, sumCalls(view, f.calls)));
      expect(b.cmp).toBe(compare(model, view, f).cmp);
      expect(b.types.map(t => t.row)).toEqual(all.slice(0, TOPN));
      expect(b.types.map(t => [t.cid, t.n, t.delta.text])).toEqual(all.slice(0, TOPN).map(r => [r.cid, r.n, r.delta.text]));
    }
  });

  it("finds errors for the fixture's project over all time, labelled with their category", () => {
    const b = errorsBlock(model, { project: "foo", range: 0, source: "" });
    expect(b.errors).toBeGreaterThan(0);
    expect(b.types.length).toBeLessThanOrEqual(TOPN);
    for (const t of b.types) expect(t.label).toBe(model.cats[t.cid]!.label);
    expect(b.types.reduce((s, t) => s + t.n, 0)).toBeLessThanOrEqual(b.errors);
  });

  it("is empty for a project without errors", () => {
    const b = errorsBlock(model, { project: "nosuchproject", range: 0, source: "" });
    expect(b).toMatchObject({ errors: 0, calls: 0, rate: null, types: [] });
  });

  it("keeps the view's source and range, and Errors' other defaults", () => {
    expect(errorsView({ project: "foo", range: 7, source: "codex" })).toEqual({ ...DEFAULT_VIEW, project: "foo", range: 7, source: "codex" });
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
  it("fills the grid when the peak is over the window", () => {
    const g = contextGrid(ctx(.12, 1.3, { peakMedian: 260000 }))!;
    expect([g.start, g.added, g.free]).toEqual([24, 176, 0]);
    expect(g.rows[2]!.share).toBe(0);
    expect(g.rows[2]!.tokens).toBe(0);
  });
  it("leaves out the free tokens without a known window", () => {
    expect(contextGrid(ctx(.12, .4, { window: null }))!.rows[2]!.tokens).toBeNull();
  });
  it("is null when the start's or peak's share is not known", () => {
    expect(contextGrid(ctx(null, .4))).toBeNull();
    expect(contextGrid(ctx(.1, null))).toBeNull();
  });
});
