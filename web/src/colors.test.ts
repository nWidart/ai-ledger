import { describe, expect, it } from "vitest";
import { color, hasHue, setOrder, slotsFor, TOP } from "./colors";

describe("project colors", () => {
  it("keeps a project's hue when projects below it reorder", () => {
    const a = slotsFor(["alpha", "beta", "gamma", "delta", "eps", "zeta", "eta"]);
    const b = slotsFor(["alpha", "beta", "zeta", "eps", "gamma", "delta", "eta"]);
    expect(b.get("alpha")).toBe(a.get("alpha"));
    expect(b.get("beta")).toBe(a.get("beta"));
  });
  it("gives the top projects distinct hues and greys the rest", () => {
    const order = ["p1", "p2", "p3", "p4", "p5", "p6", "p7"];
    const s = slotsFor(order);
    expect(new Set(s.values()).size).toBe(TOP);
    expect(s.has("p7")).toBe(false);
    setOrder(order);
    expect(hasHue("p1")).toBe(true);
    expect(color("p1")).toMatch(/^var\(--proj-[1-6]\)$/);
    expect(color("p7")).toBe("var(--proj-other)");
    expect(color("")).toBe("var(--proj-other)");
    expect(color(null)).toBe("var(--proj-other)");
  });
  it("matches nav.html's hashed slots, stepping on a clash", () => {
    // From nav.html's setOrder: FNV-1a("foo") % 6 = 3, "bar" = 2, "jobdesk" = 3, which steps to 4.
    expect([...slotsFor(["foo", "bar", "jobdesk"])]).toEqual([["foo", 3], ["bar", 2], ["jobdesk", 4]]);
  });
});
