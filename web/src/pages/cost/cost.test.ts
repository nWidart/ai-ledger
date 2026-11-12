import { describe, expect, it } from "vitest";
import type { UsagePayload } from "../../api";
import { costDays, type Kind } from "./cost";

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

  it("reads a remainder under half a cent as nothing, not a float leftover", () => {
    const [de] = costDays(view([pd("A", 0.3)], 0.1 + 0.2), [named("A"), other]); // 0.1 + 0.2 is 0.30000000000000004
    expect(de!.v["p:"]).toBe(0);
    expect(costDays(view([pd("A", 0.3)], 0.31), [named("A"), other])[0]!.v["p:"]).toBeCloseTo(0.01);
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
