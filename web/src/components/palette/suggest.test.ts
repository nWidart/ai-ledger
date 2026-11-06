import { describe, expect, it } from "vitest";
import palette from "../../__fixtures__/palette";
import sessions from "../../__fixtures__/sessions";
import { BADGES, MAX_ROWS, isFilter, noToolCalls, rowName, suggest } from "./suggest";
import { terms } from "./terms";

const data = { palette, sessions: sessions.sessions };
const term = (input: string) => terms(input)[0] ?? { sigil: "" as const, text: "", start: 0, end: 0 };
const rows = (input: string, d: Parameters<typeof suggest>[1] = data) => suggest(term(input), d);
const kinds = (input: string) => new Set(rows(input).map(r => r.kind));

describe("suggest", () => {
  it("lists only filters after #", () => {
    expect([...kinds("#")].every(k => isFilter(k as never))).toBe(true);
    expect(kinds("#")).toEqual(new Set(["project", "source", "range", "automated"]));
    expect(rows("#co").map(r => r.text)).toEqual(["Codex", "Claude Code"]);
  });
  it("lists everything else after >", () => {
    expect([...kinds(">")].some(k => isFilter(k as never))).toBe(false);
    expect(kinds(">")).toEqual(new Set(["page", "tool", "mcp", "skill", "category", "command"]));
    expect(rows(">").length).toBeLessThanOrEqual(MAX_ROWS);
  });
  it("lists every kind for bare text, each with its badge and sigil", () => {
    const first = (q: string) => { const r = rows(q)[0]!; return [r.kind, BADGES[r.kind], r.sigil]; };
    expect(["foo", "codex", "7d", "automated", "errors", "bash", "srv", "review", "s1", "refresh"].map(first)).toEqual([
      ["project", "Project", "#"], ["source", "Source", "#"], ["range", "Range", "#"], ["automated", "Filter", "#"], ["page", "Page", ">"],
      ["tool", "Tool", ">"], ["mcp", "MCP server", ">"], ["skill", "Skill", ">"], ["session", "Session", ">"], ["command", "Command", ">"]]);
  });
  it("puts an exact match first", () => {
    expect(rows("bash")[0]).toMatchObject({ kind: "tool", value: "Bash", sigil: ">" });
    expect(rows(">errors")[0]).toMatchObject({ kind: "page", value: "/errors" });
    expect(rows("#7d")[0]).toMatchObject({ kind: "range", value: "7", text: "7d" });
    expect(rows("#claude code")[0]).toMatchObject({ kind: "source", value: "claude", text: "Claude Code" });
  });
  it("offers the inspector for a tool after #, and no filter", () => {
    const got = rows("#bash");
    expect(got.map(r => [r.text, r.kind, r.sigil])).toEqual([["Bash · open inspector (>)", "tool", ">"]]);
    expect(rows("#ba").some(r => r.kind === "tool")).toBe(false);
  });
  it("carries calls and failure rate on tool rows", () => {
    const bash = rows(">bash")[0]!;
    expect(bash.detail).toEqual(["3 calls", "33% failed"]);
    expect(rowName(bash)).toBe("Bash, tool, 3 calls, 33% failed");
    expect(rows(">x")[0]).toMatchObject({ kind: "category", detail: ["6 errors", "on Errors"] });
    expect(rows("#foo")[0]).toMatchObject({ kind: "project", detail: ["2 sessions"] });
  });
  it("searches sessions from two characters, never after #", () => {
    expect(rows("s1").some(r => r.kind === "session" && r.value === "s1")).toBe(true);
    expect(rows("s").some(r => r.kind === "session")).toBe(false);
    expect(rows(">fo").some(r => r.kind === "session")).toBe(true);
    expect(rows("#fo").some(r => r.kind === "session")).toBe(false);
  });
  it("leaves out picked chips, and lists no tools for an empty view", () => {
    expect(suggest(term("#"), data, [{ kind: "project", value: "foo", label: "foo" }]).some(r => r.kind === "project")).toBe(false);
    const empty = { ...palette, tools: [], mcp: [], skills: [] };
    expect(suggest(term(">"), { palette: empty }).some(r => r.kind === "tool")).toBe(false);
    expect([noToolCalls(empty), noToolCalls(palette), noToolCalls(undefined)]).toEqual([true, false, false]);
  });
  it("marks the matched characters of the shown text", () => {
    expect(rows(">bas")[0]).toMatchObject({ text: "Bash", ranges: [[0, 3]] });
    expect(rows("#bash")[0]?.ranges).toEqual([[0, 4]]);
  });
});
