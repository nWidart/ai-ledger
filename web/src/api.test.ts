import { describe, expect, it } from "vitest";
import { sessionsUrl, type View } from "./api";

const v: View = { project: "", range: 30, automated: false, source: "" };

describe("sessionsUrl", () => {
  it("sends no sort for an empty list", () => {
    expect(sessionsUrl(v)).toBe("/api/sessions?range=30");
    expect(sessionsUrl(v, { sort: [] })).toBe("/api/sessions?range=30");
  });
  it("sends one key as sort and desc, as before", () => {
    expect(sessionsUrl(v, { sort: [{ key: "cost", desc: true }] })).toBe("/api/sessions?range=30&sort=cost&desc=1");
    expect(sessionsUrl(v, { sort: [{ key: "cost", desc: false }] })).toBe("/api/sessions?range=30&sort=cost");
    expect(sessionsUrl(v, { offset: 100, sort: [{ key: "tokens", desc: true }] })).toBe("/api/sessions?range=30&offset=100&sort=tokens&desc=1");
  });
  it("sends several keys as one list, a leading - for descending", () => {
    expect(sessionsUrl(v, { sort: [{ key: "cost", desc: true }, { key: "prompts", desc: false }] })).toBe("/api/sessions?range=30&sort=-cost%2Cprompts");
    expect(sessionsUrl(v, { near: true, sort: [{ key: "errors", desc: true }, { key: "cost", desc: true }, { key: "first_ts", desc: false }] }))
      .toBe("/api/sessions?range=30&near=1&sort=-errors%2C-cost%2Cfirst_ts");
  });
});
