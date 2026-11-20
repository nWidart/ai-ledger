import { describe, expect, it } from "vitest";
import type { ProjectRow, RunRateSource, UsagePayload } from "../../api";
import usage from "../../__fixtures__/usage";
import { costDays, gaugeFigures, type Kind } from "./cost";
import { projectMedians } from "./insights";
import { foldMatrix, projectMatrix, sortMatrix, type MatrixRow } from "./matrix";

describe("gaugeFigures", () => {
  const src = (source: "claude" | "codex", month_cost: number, projected: number): RunRateSource => ({ source, month_cost, projected, daily_avg: 0 });
  const rate = (...by: RunRateSource[]): UsagePayload["run_rate"] => ({ month_cost: by.reduce((a, s) => a + s.month_cost, 0), daily_avg: 0, days_left: 10,
    projected: by.reduce((a, s) => a + s.projected, 0), by_source: by });
  const max = { provider: "claude" as const, label: "Claude Max 20x", monthly: 200 }, plus = { provider: "codex" as const, label: "ChatGPT Plus", monthly: 20 };

  it("sets the pace against the plan's monthly price", () => {
    expect(gaugeFigures({ run_rate: rate(src("claude", 150, 840)), plans: [max] }))
      .toEqual({ now: 150, pace: 840, plan: { monthly: 200, labels: ["Claude Max 20x"], multiple: 4.2 }, counted: null });
  });

  it("keeps a multiple below 1 and sums two plans", () => {
    const g = gaugeFigures({ run_rate: rate(src("claude", 40, 110), src("codex", 5, 22)), plans: [max, plus] })!;
    expect(g.plan).toEqual({ monthly: 220, labels: ["Claude Max 20x", "ChatGPT Plus"], multiple: 0.6 });
    expect(g.counted).toBeNull();
  });

  it("shows spend and pace with no plan and no multiple without a known plan", () => {
    expect(gaugeFigures({ run_rate: rate(src("claude", 150, 840)), plans: [] })).toEqual({ now: 150, pace: 840, plan: null, counted: null });
  });

  it("counts only the agents a plan covers, and names them when another one spent", () => {
    const g = gaugeFigures({ run_rate: rate(src("claude", 900, 2000), src("codex", 10, 20)), plans: [plus] })!;
    expect([g.now, g.pace, g.plan!.multiple, g.counted]).toEqual([10, 20, 1, ["codex"]]);
    // The covered agent spent nothing this month: the whole view, no plan.
    expect(gaugeFigures({ run_rate: rate(src("claude", 900, 2000)), plans: [plus] })).toEqual({ now: 900, pace: 2000, plan: null, counted: null });
  });

  it("is absent without a run rate", () => {
    expect(gaugeFigures({ run_rate: null, plans: [max] })).toBeNull();
  });
});

describe("project matrix", () => {
  const base = usage.by_project[0]!;
  const p = (project: string, cost: number | null, extra: Partial<ProjectRow> = {}): ProjectRow =>
    ({ ...base, project, cost, commits: 4, cost_per_commit: cost == null ? null : cost / 4, prompts: 20, unpriced: 0, ...extra });
  const ch = (project: string, cost: number | null, prev_cost: number | null, isNew = false) =>
    ({ project, cost, prev_cost, delta: cost == null || prev_cost == null ? null : cost - prev_cost, new: isNew });
  const d = (rows: ProjectRow[], changes: ReturnType<typeof ch>[]) => ({ ...usage, by_project: rows, changes,
    totals: { ...usage.totals, cost: rows.reduce((a, r) => a + (r.cost ?? 0), 0) },
    daily_projects: [{ day: "2026-11-04", project: "a", cost: 3, tokens: 1 }, { day: "2026-10-08", project: "a", cost: 1, tokens: 1 }] });
  const names = (rs: MatrixRow[]) => rs.map(r => r.project);

  it("joins spend, change and the daily trend, and lists a project used only before at $0", () => {
    const rs = projectMatrix(d([p("a", 60), p("b", 40)], [ch("a", 60, 20), ch("b", 40, 0, true), ch("old", 0, 30)]));
    expect(names(rs)).toEqual(["a", "b", "old"]);
    expect(rs[0]).toMatchObject({ cost: 60, share: 0.6, prev: 20, delta: 40, isNew: false, recent: 3 });
    expect(rs[0]!.trend).toHaveLength(30);
    expect(rs[0]!.trend.at(-2)).toBe(3);
    expect(rs[1]!.isNew).toBe(true);
    expect(rs[2]).toMatchObject({ p: null, cost: 0, delta: -30, cpc: null, hit: null });
  });

  it("sorts by every column, rows without a value last either way", () => {
    const rs = projectMatrix(d([p("a", 60), p("b", 40, { commits: 0, cost_per_commit: null }), p("c", null)], [ch("a", 60, 20), ch("b", 40, 50), ch("c", null, 5)]));
    expect(names(sortMatrix(rs, { key: "cost", desc: true }))).toEqual(["a", "b", "c"]);
    expect(names(sortMatrix(rs, { key: "delta", desc: true }))).toEqual(["a", "b", "c"]);
    expect(names(sortMatrix(rs, { key: "delta", desc: false }))).toEqual(["b", "a", "c"]);
    expect(names(sortMatrix(rs, { key: "cpc", desc: false }))).toEqual(["a", "b", "c"]);
    expect(names(sortMatrix(rs, { key: "trend", desc: true }))[0]).toBe("a");
    expect(names(sortMatrix(rs, { key: "project", desc: true }))).toEqual(["c", "b", "a"]);
  });

  it("folds 3+ small projects under the big ones, but never a large change", () => {
    const tiny = (n: string) => p(n, 0.01, { prompts: 1 });
    const rows = [p("r1", 100), p("r2", 90), p("r3", 80), tiny("t1"), tiny("t2"), tiny("t3")];
    const fold = (changes: ReturnType<typeof ch>[]) => {
      const x = d(rows, changes), rs = sortMatrix(projectMatrix(x), { key: "cost", desc: true });
      const f = foldMatrix(rs, projectMedians(x.by_project).big, x.totals.cost ?? 0);
      return [names(f.head), names(f.small)];
    };
    expect(fold([])).toEqual([["r1", "r2", "r3"], ["t1", "t2", "t3"]]);
    // A project gone since the previous period, worth 10% of this one's cost, stays above the fold.
    expect(fold([ch("gone", 0, 27)])).toEqual([["r1", "r2", "r3", "gone"], ["t1", "t2", "t3"]]);
    // Two small projects do not fold.
    const x = d(rows.slice(0, 5), []);
    expect(foldMatrix(projectMatrix(x), projectMedians(x.by_project).big, 270).small).toEqual([]);
  });
});

const day = "2026-11-04";
const pd = (project: string | null, cost: number): UsagePayload["daily_projects"][number] => ({ day, project, cost, tokens: 1 });
const view = (rows: UsagePayload["daily_projects"], cost: number) =>
  ({ start: day, end: day, daily: [{ day, cost, unpriced: 0 } as UsagePayload["daily"][number]], daily_projects: rows });
const named = (project: string): Kind => ({ k: "p:" + project, label: project, c: "", project });
const other: Kind = { k: "p:", label: "Other", c: "" };

describe("costDays", () => {
  it("lists the projects inside Other, costliest first, and sums them into Other", () => {
    const rows = [pd("A", 10), pd("B", 5), pd("C", 3), pd("D", 1), pd("E", 0.5), pd("F", 0)];
    const [de] = costDays(view(rows, 19.5), [named("A"), other]);
    expect(de!.other).toEqual([{ name: "B", cost: 5 }, { name: "C", cost: 3 }, { name: "D", cost: 1 }, { name: "E", cost: 0.5 }]);
    expect(de!.v["p:"]).toBeCloseTo(9.5);
    expect(de!.v["p:A"]).toBe(10);
  });

  it("names a project with no name as (no project)", () => {
    const [de] = costDays(view([pd(null, 2), pd("B", 1)], 3), [named("A"), other]);
    expect(de!.other).toEqual([{ name: "(no project)", cost: 2 }, { name: "B", cost: 1 }]);
  });

  it("reads a float leftover as nothing but keeps a real sub-cent remainder", () => {
    const [de] = costDays(view([pd("A", 0.3)], 0.1 + 0.2), [named("A"), other]); // 0.1 + 0.2 is 0.30000000000000004
    expect(de!.v["p:"]).toBe(0);
    expect(costDays(view([pd("A", 0.3)], 0.31), [named("A"), other])[0]!.v["p:"]).toBeCloseTo(0.01);
    expect(costDays(view([], 0.004), [named("A"), other])[0]!.v["p:"]).toBeCloseTo(0.004);
  });

  it("names the models inside Other without the claude- prefix, as the legend does", () => {
    const md = (model: string, cost: number) => ({ day, model, cost } as UsagePayload["daily_models"][number]);
    const [de] = costDays({ ...view([], 6), daily_models: [md("claude-opus-4-7", 5), md("claude-haiku-4-5-20251001", 1)] },
      [{ k: "m:claude-opus-4-7", label: "opus-4-7", c: "" }, { k: "m:", label: "Other", c: "" }], "model");
    expect(de!.other).toEqual([{ name: "haiku-4-5-20251001", cost: 1 }]);
  });

  it("leaves Other's list out when Other is not stacked", () => {
    const [de] = costDays(view([pd("A", 10), pd("B", 5)], 15), [named("A")]);
    expect(de!.other).toBeUndefined();
  });
});
