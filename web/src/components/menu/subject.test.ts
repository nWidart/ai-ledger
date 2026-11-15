import { describe, expect, it } from "vitest";
import { subjectAttrs, subjectElement, subjectOf } from "./subject";

describe("subject marks", () => {
  it("round-trips a value with a colon", () => {
    const el = document.createElement("tr");
    el.setAttribute("data-subject", subjectAttrs("tool", "mcp__x:y")["data-subject"]!);
    expect(subjectOf(el)).toEqual({ kind: "tool", value: "mcp__x:y" });
  });
  it("marks nothing for an empty value", () => {
    expect(subjectAttrs("project", "")).toEqual({});
    expect(subjectAttrs("project", null)).toEqual({});
  });
  it("finds the nearest marked ancestor", () => {
    const outer = document.createElement("div"), inner = document.createElement("tr"), cell = document.createElement("td");
    outer.setAttribute("data-subject", "project:a");
    inner.setAttribute("data-subject", "session:s1");
    inner.append(cell); outer.append(inner);
    expect(subjectElement(cell)).toBe(inner);
  });
  it("lets an inline project name yield to the row around it", () => {
    const row = document.createElement("tr"), name = document.createElement("span");
    row.setAttribute("data-subject", "session:s1");
    for (const [k, v] of Object.entries(subjectAttrs("project", "a", true))) name.setAttribute(k, v);
    row.append(name);
    expect(subjectElement(name)).toBe(row);
    const alone = document.createElement("span");
    for (const [k, v] of Object.entries(subjectAttrs("project", "a", true))) alone.setAttribute(k, v);
    expect(subjectElement(alone)).toBe(alone);
  });
  it("ignores an unknown kind", () => {
    const el = document.createElement("div");
    el.setAttribute("data-subject", "day:2026-01-01");
    expect(subjectElement(el)).toBeNull();
  });
});
