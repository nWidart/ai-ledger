import { describe, expect, it } from "vitest";
import palette from "../../__fixtures__/palette";
import sessions from "../../__fixtures__/sessions";
import { EXACT, PREFIX } from "./match";
import { BADGES, MAX_ROWS, PROJECT_PAGE, isFilter, noToolCalls, rowName, suggest, type Chip } from "./suggest";
import { terms } from "./terms";

const data = { palette, sessions: sessions.sessions };
const term = (input: string) => terms(input)[0] ?? { sigil: "" as const, text: "", start: 0, end: 0 };
const rows = (input: string, d: Parameters<typeof suggest>[1] = data) => suggest(term(input), d);
const kinds = (input: string) => new Set(rows(input).map(r => r.kind));
const jd = { palette: { ...palette, projects: [{ name: "jobdesk", sessions: 12 }, ...palette.projects] } };
const own = (input: string, chips: Chip[] = [], path = "/cost", d = jd) => suggest(term(input), d, chips, path).filter(r => r.project);
const proj = (name: string): Chip => ({ kind: "project", value: name, label: name });
const page = (value: string, label: string): Chip => ({ kind: "page", value, label });

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
  it("offers the Project page only when a project chip names one", () => {
    const my = [{ kind: "project", value: "foo", label: "foo" }] as const;
    expect(suggest(term(">proj"), data, my).map(r => [r.kind, r.value, r.label])).toEqual([["page", "/project", "Project"]]);
    expect(suggest(term(">project"), data, my)[0]).toMatchObject({ kind: "page", value: "/project", sigil: ">" });
    expect(rows(">proj").filter(r => r.kind === "page")).toEqual([]);
    expect(rows(">").some(r => r.value === "/project")).toBe(false);
  });
  it("puts an exact match first", () => {
    expect(rows("bash")[0]).toMatchObject({ kind: "tool", value: "Bash", sigil: ">" });
    expect(rows(">errors")[0]).toMatchObject({ kind: "page", value: "/errors" });
    expect(rows(">insights")[0]).toMatchObject({ kind: "page", value: "/insights", label: "Insights" });
    expect(rows(">live")[0]).toMatchObject({ kind: "page", value: "/live", label: "Live" });
    expect(rows(">context")[0]).toMatchObject({ kind: "page", value: "/context", label: "Context" });
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

describe("suggest project pages", () => {
  it("lists a project's page after its filter for bare text, never exact so the name auto-chips as the filter", () => {
    const got = suggest(term("jobdesk"), jd);
    expect(got.slice(0, 2).map(r => r.id)).toEqual(["project:jobdesk", "projectpage:jobdesk"]);
    expect(got[1]).toMatchObject({ kind: "page", value: PROJECT_PAGE, label: "Project", project: "jobdesk", sigil: ">", rank: PREFIX,
      text: "jobdesk · open project page", ranges: [[0, 7]], detail: ["12 sessions"] });
    expect(rowName(got[1]!)).toBe("jobdesk · open project page, 12 sessions");
    expect(own(">jobdesk")[0]!.rank).toBe(EXACT);
  });
  it("lists none under #, nor for empty text", () => {
    expect(own("#job")).toEqual([]);
    expect(own(">")).toEqual([]);
    expect(own("")).toEqual([]);
    expect(rows(">").filter(r => r.kind === "page").length).toBe(7);
  });
  it("lists the three best matching projects, the busiest first among equal matches", () => {
    const many = { palette: { ...palette, projects: [1, 5, 3, 9].map((n, i) => ({ name: `job${i}`, sessions: n })) } };
    expect(own("job", [], "/cost", many).map(r => r.project)).toEqual(["job3", "job1", "job2"]);
  });
  it("stays with the project filtered, and goes where picking it would change nothing", () => {
    expect(own("jobdesk", [proj("jobdesk")]).map(r => r.id)).toEqual(["projectpage:jobdesk"]);
    expect(own("jobdesk", [proj("jobdesk")], PROJECT_PAGE)).toEqual([]);
    expect(own("jobdesk", [proj("jobdesk"), page(PROJECT_PAGE, "Project")])).toEqual([]);
    expect(own("jobdesk", [proj("jobdesk"), page("/errors", "Errors")], PROJECT_PAGE).length).toBe(1);
    expect(own("jobdesk", [proj("jobdesk"), page(PROJECT_PAGE, "Project"), page("/errors", "Errors")]).length).toBe(1);
    expect(own("jobdesk", [proj("foo"), page(PROJECT_PAGE, "Project")]).length).toBe(1);
    expect(own("jobdesk", [proj("foo")], PROJECT_PAGE).length).toBe(1);
  });
  it("leaves out the generic Project row when the chosen project's own row is listed", () => {
    const px = { palette: { ...palette, projects: [{ name: "projx", sessions: 1 }] } };
    const pages = (chips: Chip[]) => suggest(term(">proj"), px, chips, "/cost").filter(r => r.kind === "page").map(r => r.id);
    expect(pages([proj("projx")])).toEqual(["projectpage:projx"]);
    expect(pages([proj("foo")])).toEqual(["projectpage:projx", "page:/project"]);
  });
});
