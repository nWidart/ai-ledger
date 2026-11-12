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
    expect(de!.other).toEqual([{ project: "B", cost: 5 }, { project: "C", cost: 3 }, { project: "D", cost: 1 }, { project: "E", cost: 0.5 }]);
    expect(de!.v["p:"]).toBeCloseTo(9.5);
    expect(de!.v["p:A"]).toBe(10);
  });

  it("names a project with no name as (no project)", () => {
    const [de] = costDays(view([pd(null, 2), pd("B", 1)], 3), [named("A"), other]);
    expect(de!.other).toEqual([{ project: "(no project)", cost: 2 }, { project: "B", cost: 1 }]);
  });

  it("leaves Other's list out when Other is not stacked", () => {
    const [de] = costDays(view([pd("A", 10), pd("B", 5)], 15), [named("A")]);
    expect(de!.other).toBeUndefined();
  });
});
