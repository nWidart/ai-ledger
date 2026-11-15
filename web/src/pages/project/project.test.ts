import { describe, expect, it } from "vitest";
import type { ErrorsPayload, LimitsPayload } from "../../api";
import errors from "../../__fixtures__/errors";
import limits from "../../__fixtures__/limits";
import { DEFAULT_VIEW } from "../errors/view";
import { compare, filtered, makeModel, rate, sumCalls, TOPN, typeRows } from "../errors/model";
import { errorsBlock, errorsView, limitsBlock } from "./project";

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
