import { describe, expect, it } from "vitest";
import type { ContextOverhead, OverheadItem } from "../../api";
import { when } from "../../format";
import { fold, loadList } from "./overhead";

type LoadList = NonNullable<ReturnType<typeof loadList>>;
type Cat = ContextOverhead["categories"][number];
type Calls = Partial<ContextOverhead["calls"]>;
const snap = (cats: [string, number, Cat["state"]?][], items: OverheadItem[] = [], calls: Calls = {}, over: Partial<ContextOverhead> = {}): ContextOverhead => ({
  ts: "2026-11-15T10:42:41.622Z", session_id: "s1", model: "claude-fable-5-2", version: "2.1.325", window: 1000000, before_view: false,
  categories: cats.map(([name, tokens, state]) => ({ name, tokens, state: state ?? "used" })),
  items, calls: { mcp: [], skill: [], ...calls }, ...over,
});
let next = 100;
const item = (kind: OverheadItem["kind"], name: string | null, tokens: number, o: Partial<OverheadItem> = {}): OverheadItem =>
  ({ seq: next++, kind, name, detail: null, server: null, tokens, ...o });
const cat = (l: LoadList, name: string) => l.categories.find(c => c.name === name)!;
const lines = (l: LoadList) => l.categories.map(c => [c.name, c.fit, c.figure, c.line]);

// The repo's /context fixture (tests/fixtures/claude/context-command.jsonl), its items as the server sends them; made-up calls.
const FIXTURE = snap([["System prompt", 4107], ["System tools", 12790], ["MCP tools", 619], ["MCP server instructions", 979],
  ["MCP tools (deferred)", 81826, "deferred"], ["System tools (deferred)", 20608, "deferred"], ["Custom agents", 480], ["Memory files", 81],
  ["Skills", 9357], ["Messages", 2499], ["Autocompact buffer", 33000, "buffer"], ["Free space", 936088, "free"]], [
  item("mcp_tool", "mcp__caveman__caveman_retrieve", 414, { seq: 13, detail: "caveman", server: "caveman" }),
  item("mcp_tool", "mcp__caveman__caveman_compress", 254, { seq: 12, detail: "caveman", server: "caveman" }),
  item("mcp_tool", "mcp__caveman__caveman_stats", 137, { seq: 14, detail: "caveman", server: "caveman" }),
  item("agent", "caveman:cavecrew-builder", 136, { seq: 16, detail: "plugin" }),
  item("agent", "caveman:cavecrew-investigator", 114, { seq: 17, detail: "plugin" }),
  item("memory_file", "/home/dev/.claude/CLAUDE.md", 81, { seq: 15, detail: "User" }),
  item("skill", "answer-review-feedback", 43, { seq: 18, detail: "userSettings" }),
  item("skill", "attach-media", 40, { seq: 19, detail: "userSettings" }),
  item("skill", "babysit-pr", 39, { seq: 20, detail: "userSettings" }),
], { mcp: [{ server: "caveman", calls: 12 }], skill: [{ name: "babysit-pr", calls: 3 }] });

describe("loadList", () => {
  it("ranks the fixture's categories by their share of what loads before the first prompt, with each one's items", () => {
    const l = loadList(FIXTURE)!;
    expect([l.total, l.summary, l.stale]).toEqual([28413, "What loads before your first prompt · 28.4k tokens", false]);
    expect(l.measured).toBe(`Measured ${when(FIXTURE.ts)} with claude-fable-5-2. Ranked by tokens; each share is of the 28.4k.`);
    // Not Messages, deferred tools, the buffer or free space: the shares are of the seven loaded categories and add up to 1.
    expect(lines(l)).toEqual([
      ["System tools", "none", "12.8k tokens, 45%", null],
      ["Skills", "nested", "9.4k tokens, 33%", "3 skills, median 40 tokens; 9.2k tokens not listed by item"],
      ["System prompt", "none", "4.1k tokens, 14%", null],
      ["MCP server instructions", "none", "979 tokens, 3.4%", null],
      ["MCP tools", "over", "619 tokens, 2.2%", "The 3 tools listed hold 805 tokens, more than the 619 this category loads: some are not loaded before the first prompt, and the snapshot does not say which."],
      ["Custom agents", "nested", "480 tokens, 1.7%", "2 agents, median 125 tokens; 230 tokens not listed by item"],
      ["Memory files", "nested", "81 tokens, 0.3%", "1 memory file"],
    ]);
    expect(l.categories.reduce((a, c) => a + c.share!, 0)).toBeCloseTo(1, 12);
    // One scale, the largest category's tokens; an item's bar never longer than its category's.
    expect(l.categories.map(c => c.bar)).toEqual(l.categories.map(c => c.tokens! / 12790));
    expect(l.categories.flatMap(c => c.items.map(x => x.bar == null || x.bar <= c.bar!))).not.toContain(false);
    // The MCP tools hold more than their category: tokens kept, no bar, grouped under their one server.
    expect(cat(l, "MCP tools").items).toEqual([{ key: "s13", kind: "server", label: "caveman", tokens: 805, bar: null, figure: "805 tokens",
      sub: "called 12 times by Claude Code in this view", toolsLine: "3 tools, median 254 tokens", path: null, open: { kind: "mcp", name: "caveman" }, calls: 12,
      tools: [{ key: "i13", label: "caveman_retrieve", tokens: 414, bar: null, figure: "414 tokens" }, { key: "i12", label: "caveman_compress", tokens: 254, bar: null, figure: "254 tokens" },
        { key: "i14", label: "caveman_stats", tokens: 137, bar: null, figure: "137 tokens" }] }]);
    expect(cat(l, "Skills").items.map(x => [x.key, x.label, x.figure, x.bar, x.sub, x.open, x.calls])).toEqual([
      ["i18", "answer-review-feedback", "43 tokens", 43 / 12790, "userSettings · not called by Claude Code in this view", { kind: "skill", name: "answer-review-feedback" }, 0],
      ["i19", "attach-media", "40 tokens", 40 / 12790, "userSettings · not called by Claude Code in this view", { kind: "skill", name: "attach-media" }, 0],
      ["i20", "babysit-pr", "39 tokens", 39 / 12790, "userSettings · called 3 times by Claude Code in this view", { kind: "skill", name: "babysit-pr" }, 3]]);
    expect(cat(l, "Custom agents").items.map(x => [x.label, x.sub, x.open, x.calls])).toEqual([
      ["caveman:cavecrew-builder", "plugin", null, null], ["caveman:cavecrew-investigator", "plugin", null, null]]);
    expect(cat(l, "Memory files").items.map(x => [x.key, x.label, x.path, x.sub, x.bar, x.open])).toEqual([
      ["i15", "CLAUDE.md", "/home/dev/.claude/CLAUDE.md", "User · /home/dev/.claude", 81 / 12790, null]]);
  });

  it("writes a share that would round to 0% or 100% as less or more, and ties keep the snapshot's order", () => {
    expect(loadList(snap([["System prompt", 1], ["System tools", 2_000_000]]))!.categories.map(c => [c.name, c.figure, c.bar! > 0])).toEqual([
      ["System tools", "2.0M tokens, >99%", true], ["System prompt", "1 token, <0.1%", true]]);
    expect(loadList(snap([["System tools", 500], ["System prompt", 500]]))!.categories.map(c => [c.key, c.figure])).toEqual([
      ["c0", "500 tokens, 50%"], ["c1", "500 tokens, 50%"]]);
    expect(loadList(snap([["Skills", 40]]))!.categories.map(c => [c.figure, c.bar])).toEqual([["40 tokens, 100%", 1]]);
  });

  it.each<[string, OverheadItem[], number, string]>([
    ["one skill", [item("skill", "a", 40)], 40, "1 skill"],
    ["an odd number of skills", [item("skill", "a", 10), item("skill", "b", 40), item("skill", "c", 50)], 100, "3 skills, median 40 tokens"],
    ["an even number", [item("skill", "a", 40), item("skill", "b", 50)], 90, "2 skills, median 45 tokens"],
    ["one token not listed", [item("skill", "a", 39)], 40, "1 skill; 1 token not listed by item"],
    ["one memory file", [item("memory_file", "/a/CLAUDE.md", 900)], 900, "1 memory file"],
    ["memory files", [item("memory_file", "/a/CLAUDE.md", 800), item("memory_file", "/b/CLAUDE.md", 1000)], 1800, "2 memory files, median 900 tokens"],
    ["one agent", [item("agent", "a", 125)], 125, "1 agent"],
    ["agents", [item("agent", "a", 100), item("agent", "b", 150)], 250, "2 agents, median 125 tokens"],
    ["one server, one tool", [item("mcp_tool", "mcp__a__x", 10, { server: "a" })], 10, "1 server, 1 tool"],
    ["one server, no median", [item("mcp_tool", "mcp__a__x", 10, { server: "a" }), item("mcp_tool", "mcp__a__y", 20, { server: "a" }),
      item("mcp_tool", "mcp__a__z", 30, { server: "a" })], 60, "1 server, 3 tools"],
    ["servers, a median of servers", [item("mcp_tool", "mcp__a__x", 1000, { server: "a" }), item("mcp_tool", "mcp__a__y", 200, { server: "a" }),
      item("mcp_tool", "mcp__b__x", 2000, { server: "b" })], 5000, "2 servers, 3 tools, median 1.6k tokens a server; 1.8k tokens not listed by item"],
  ])("counts its items: %s", (_, items, tokens, line) => {
    const name = { mcp_tool: "MCP tools", memory_file: "Memory files", agent: "Custom agents", skill: "Skills" }[items[0]!.kind];
    expect(cat(loadList(snap([[name, tokens]], items))!, name).line).toBe(line);
  });

  it("says when the items hold more than their category, or when it counts none of them", () => {
    // 1,290 and 1,260 both read "1.3k": the line writes them whole.
    const over = loadList(snap([["System prompt", 2000], ["MCP tools", 100], ["Skills", 30], ["Memory files", 1260]], [
      item("mcp_tool", "mcp__a__x", 150, { server: "a" }), item("skill", "a", 20), item("skill", "b", 20),
      item("memory_file", "/a/CLAUDE.md", 650), item("memory_file", "/b/CLAUDE.md", 640)]))!;
    expect(lines(over).slice(1)).toEqual([
      ["Memory files", "over", "1.3k tokens, 37%", "The 2 files listed hold 1,290 tokens, more than the 1,260 this category loads: some are not loaded before the first prompt, and the snapshot does not say which."],
      ["MCP tools", "over", "100 tokens, 2.9%", "The 1 tool listed holds 150 tokens, more than the 100 this category loads: some are not loaded before the first prompt, and the snapshot does not say which."],
      ["Skills", "over", "30 tokens, 0.9%", "The 2 skills listed hold 40 tokens, more than the 30 this category loads: some are not loaded before the first prompt, and the snapshot does not say which."]]);
    expect(over.categories.flatMap(c => c.items.flatMap(x => [x.bar, ...x.tools.map(t => t.bar)]))).toEqual([null, null, null, null, null, null]);
    // A category at 0 or missing (a deferred one of the same name does not count): its items after the ranked ones, in kind order.
    const none = loadList(snap([["System prompt", 100], ["Skills", 0], ["MCP tools", 900, "deferred"]], [item("skill", "a", 40), item("memory_file", "/a/CLAUDE.md", 20),
      item("mcp_tool", "mcp__a__x", 414, { server: "a" }), item("mcp_tool", "mcp__a__y", 391, { server: "a" })]))!;
    expect(none.categories.map(c => [c.key, c.name, c.fit, c.figure, c.tokens, c.share, c.bar, c.line])).toEqual([
      ["c0", "System prompt", "none", "100 tokens, 100%", 100, 1, 1, null],
      ["kmcp_tool", "MCP tools", "uncounted", "not counted", null, null, null, "2 tools listed, 805 tokens; this snapshot counts none of them before the first prompt."],
      ["kmemory_file", "Memory files", "uncounted", "not counted", null, null, null, "1 file listed, 20 tokens; this snapshot counts none of them before the first prompt."],
      ["kskill", "Skills", "uncounted", "not counted", null, null, null, "1 skill listed, 40 tokens; this snapshot counts none of them before the first prompt."]]);
    expect(none.categories.flatMap(c => c.items.map(x => x.bar))).toEqual([null, null, null]);
    // Only uncounted kinds: no total to share, so no shares at all.
    const only = loadList(snap([["Free space", 1000, "free"]], [item("agent", "a", 10)], {}, { model: null }))!;
    expect([only.total, only.summary, only.measured, lines(only)]).toEqual([0, "What loads before your first prompt",
      `Measured ${when(FIXTURE.ts)}. No category of this snapshot loads tokens before the first prompt.`,
      [["Custom agents", "uncounted", "not counted", "1 agent listed, 10 tokens; this snapshot counts none of them before the first prompt."]]]);
  });

  it("groups MCP tools by their server key, named by detail, its calls counted by that key", () => {
    const l = loadList(snap([["MCP tools", 2000]], [
      item("mcp_tool", "mcp__plugin_gh_github__create_issue", 300, { seq: 1, detail: "github", server: "plugin_gh_github" }),
      item("mcp_tool", "mcp__plugin_gh_github__list_prs", 100, { seq: 2, server: "plugin_gh_github" }),
      item("mcp_tool", "search", 200, { seq: 3, detail: "docs", server: "docs" }),
      item("mcp_tool", null, 50, { seq: 4 }),
      item("mcp_tool", "orphan", 50, { seq: 5, detail: "", server: "" }),
      // A user's server that reads "github" too: both add their call key. Its calls are counted by that key.
      item("mcp_tool", "mcp__github__search", 150, { seq: 6, detail: "github", server: "github" }),
    ], { mcp: [{ server: "plugin_gh_github", calls: 1 }, { server: "github", calls: 1234567 }, { server: "absent", calls: 5 }] }))!;
    expect(cat(l, "MCP tools").items.map(x => [x.key, x.label, x.tokens, x.sub, x.open, x.calls, x.toolsLine, x.tools.map(t => [t.key, t.label])])).toEqual([
      ["s1", "github (plugin_gh_github)", 400, "called once by Claude Code in this view", { kind: "mcp", name: "plugin_gh_github" }, 1, "2 tools, median 200 tokens", [["i1", "create_issue"], ["i2", "list_prs"]]],
      ["s3", "docs", 200, "not called by Claude Code in this view", { kind: "mcp", name: "docs" }, 0, "1 tool", [["i3", "search"]]],
      ["s6", "github (github)", 150, "called 1,234,567 times by Claude Code in this view", { kind: "mcp", name: "github" }, 1234567, "1 tool", [["i6", "search"]]],
      ["s5", "Unknown server", 100, "The snapshot names no server, so its calls cannot be counted.", null, null, "2 tools, median 50 tokens", [["i5", "orphan"], ["i4", "Unnamed tool"]]]]);
    expect(cat(l, "MCP tools").line).toBe("4 servers, 6 tools, median 175 tokens a server; 1.2k tokens not listed by item");
  });

  it("keys items by seq, ranks ties by name then seq, and keeps every name as it is", () => {
    const odd = `a|b:"c" 'd'`, long = "x".repeat(300), rtl = "مهارة‏-עברית";
    const l = loadList(snap([["Skills", 100], ["Memory files", 300], ["Custom agents", 100]], [
      item("skill", "a", 10, { seq: 9 }), item("skill", null, 10, { seq: 1, detail: "plugin" }), item("skill", "b", 10, { seq: 2 }), item("skill", "a", 10, { seq: 3 }),
      item("skill", "constructor", 20, { seq: 4 }), item("skill", odd, -5, { seq: 5 }),
      item("memory_file", "/a/x/CLAUDE.md", 50, { seq: 7, detail: "Project" }), item("memory_file", "/a/y/CLAUDE.md", 50, { seq: 8, detail: "Project" }),
      item("memory_file", "C:\\w\\AGENTS.md", 40, { seq: 10 }), item("memory_file", "CLAUDE.md", 30, { seq: 11, detail: "Local" }),
      item("memory_file", "/CLAUDE.md", 20, { seq: 12 }), item("memory_file", null, 10, { seq: 13, detail: "User" }),
      item("agent", long, 30, { seq: 14 }), item("agent", rtl, 20, { seq: 15, detail: "" }), item("agent", null, 10, { seq: 16 }),
    ], { skill: [{ name: "toString", calls: 7 }, { name: "a", calls: 3 }] }))!;
    expect(cat(l, "Skills").items.map(x => [x.key, x.label, x.tokens, x.sub, x.open?.name ?? null, x.calls])).toEqual([
      ["i4", "constructor", 20, "not called by Claude Code in this view", "constructor", 0],
      ["i3", "a", 10, "called 3 times by Claude Code in this view", "a", 3],
      ["i9", "a", 10, "called 3 times by Claude Code in this view", "a", 3],
      ["i2", "b", 10, "not called by Claude Code in this view", "b", 0],
      ["i1", "Unnamed skill", 10, "plugin", null, null],
      ["i5", odd, 0, "not called by Claude Code in this view", odd, 0]]);
    expect(cat(l, "Memory files").items.map(x => [x.key, x.label, x.path, x.sub])).toEqual([
      ["i7", "CLAUDE.md", "/a/x/CLAUDE.md", "Project · /a/x"], ["i8", "CLAUDE.md", "/a/y/CLAUDE.md", "Project · /a/y"],
      ["i10", "AGENTS.md", "C:\\w\\AGENTS.md", "C:\\w"], ["i11", "CLAUDE.md", "CLAUDE.md", "Local"], ["i12", "CLAUDE.md", "/CLAUDE.md", "/"],
      ["i13", "Unnamed file", null, "User"]]);
    expect(cat(l, "Custom agents").items.map(x => [x.label, x.sub])).toEqual([[long, null], [rtl, null], ["Unnamed agent", null]]);
    // A 0-token item has a bar of 0, so no track; every other bar is above 0.
    expect(cat(l, "Skills").items.map(x => x.bar)).toEqual([20 / 300, 10 / 300, 10 / 300, 10 / 300, 10 / 300, 0]);
  });

  it("is null for a snapshot with nothing before the first prompt, and the categories alone without items", () => {
    expect(loadList(snap([["Messages", 900], ["System prompt", 0], ["MCP tools", 7000, "deferred"], ["Free space", 9000, "free"]]))).toBeNull();
    const bare = loadList(snap([["System prompt", 300], ["Skills", 100]], [], {}, { before_view: true, model: "" }))!;
    expect([bare.stale, bare.measured, bare.categories.map(c => [c.fit, c.line, c.items])]).toEqual([true,
      `Measured ${when(FIXTURE.ts)}. Ranked by tokens; each share is of the 400.`, [["none", null, []], ["none", null, []]]]);
  });

  it("writes no NaN, Infinity, undefined or null for odd snapshots", () => {
    const odd: ContextOverhead[] = [
      snap([]), snap([["Skills", 0]], [item("skill", null, 0)]), snap([["Skills", 1]], [item("skill", "a", Number.NaN as number)]),
      snap([["MCP tools", 5]], [item("mcp_tool", null, -1)], { mcp: [{ server: "x", calls: -3 }] }, { ts: "", model: null }),
      snap([["MCP tools", 1e12]], [item("mcp_tool", "mcp__a__b", 1e12, { server: "a" })], { mcp: [{ server: "a", calls: 1e12 }] }),
    ];
    const strings = (v: unknown): string[] => typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(strings) : [];
    const numbers = (v: unknown): number[] => typeof v === "number" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(numbers) : [];
    for (const o of odd) {
      const l = loadList(o);
      for (const s of strings(l)) expect(s).not.toMatch(/NaN|Infinity|undefined|null|–/);
      for (const n of numbers(l)) expect(Number.isFinite(n) && n >= 0).toBe(true);
    }
    expect(loadList(odd[0]!)).toBeNull();
    expect(loadList(odd[3]!)!.measured).toBe("Measured. Ranked by tokens; each share is of the 5.");
    expect(cat(loadList(odd[4]!)!, "MCP tools").items[0]!.sub).toBe("called 1,000,000,000,000 times by Claude Code in this view");
  });
});

describe("fold", () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ tokens: 40 + i }));
  it.each([0, 6])("shows %i rows whole", n => {
    expect(fold(rows(n))).toEqual({ head: rows(n), rest: [], restTokens: 0, more: null, all: null });
  });
  it("folds a seventh row and beyond into one, its tokens the hidden rows' sum", () => {
    expect(fold(rows(7))).toEqual({ head: rows(5), rest: rows(7).slice(5), restTokens: 45 + 46, more: "2 more, 91 tokens", all: "Show all 7" });
    const skills = Array.from({ length: 214 }, () => ({ tokens: 40 }));
    const f = fold(skills);
    expect([f.head.length, f.rest.length, f.restTokens, f.more, f.all]).toEqual([5, 209, 8360, "209 more, 8.4k tokens", "Show all 214"]);
  });
});
