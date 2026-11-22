import { render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ContextOverhead, OverheadItem } from "../../api";
import { loadList, STALE } from "./overhead";
import { OverheadList } from "./OverheadList";

type OverheadOpener = NonNullable<ComponentProps<typeof OverheadList>["onOpen"]>;

let next = 100;
const item = (kind: OverheadItem["kind"], name: string | null, tokens: number, o: Partial<OverheadItem> = {}): OverheadItem =>
  ({ seq: next++, kind, name, detail: null, server: null, tokens, ...o });
const snap = (cats: [string, number][], items: OverheadItem[] = [], o: Partial<ContextOverhead> = {}): ContextOverhead => ({
  uuid: "u1", ts: "2026-11-15T10:42:41.622Z", session_id: "s1", model: "claude-fable-5-2", version: "2.1.325", window: 1000000, before_view: false,
  categories: cats.map(([name, tokens]) => ({ name, tokens, state: "used" as const })),
  items, calls: { mcp: [], skill: [] }, ...o,
});
// The repo's /context fixture, its server under a plugin's key that differs from its name, plus a tool and a skill with no name.
const caveman = (name: string, tokens: number) => item("mcp_tool", `mcp__plugin_cv_caveman__${name}`, tokens, { detail: "caveman", server: "plugin_cv_caveman" });
const FIXTURE = snap([["System prompt", 4107], ["System tools", 12790], ["MCP tools", 619], ["Custom agents", 480], ["Memory files", 81], ["Skills", 9357]], [
  caveman("retrieve", 414), caveman("compress", 254), caveman("stats", 137), item("mcp_tool", null, 50),
  item("agent", "caveman:cavecrew-builder", 136, { detail: "plugin" }), item("memory_file", "/home/dev/.claude/CLAUDE.md", 81, { detail: "User" }),
  item("skill", "babysit-pr", 39, { detail: "userSettings" }), item("skill", null, 30),
], { calls: { mcp: [{ server: "plugin_cv_caveman", calls: 12 }], skill: [{ name: "babysit-pr", calls: 3 }] } });

/** Renders the list and opens it, as a reader would. */
async function shown(o: ContextOverhead, onOpen?: OverheadOpener) {
  const user = userEvent.setup(), r = render(<OverheadList snapshot={o} onOpen={onOpen} />);
  await user.click(screen.getByText(loadList(o)!.summary));
  return { ...r, user };
}
/** What each row of a list reads, in order: its own row (or the fold row), not the lists under it. */
const rows = (list: HTMLElement) => [...list.children].map(li => (li.querySelector(":scope > div") ?? li).textContent);
const buttons = () => screen.queryAllByRole("button").filter(b => b.tagName === "BUTTON").map(b => b.textContent);
const bars = (el: Element) => el.querySelectorAll("[aria-hidden=true]");

describe("OverheadList", () => {
  it("is closed until asked; opened, a named list of categories in rank order, each row one sentence, its bar decoration", async () => {
    const l = loadList(FIXTURE)!, user = userEvent.setup(), { container } = render(<OverheadList snapshot={FIXTURE} />);
    const summary = screen.getByText(l.summary), details = summary.closest("details")!;
    expect([summary.textContent, details.open]).toEqual(["What loads before your first prompt · 27.4k tokens", false]);
    await user.click(summary);
    expect(details.open).toBe(true);
    screen.getByText(l.measured);
    const cats = screen.getByRole("list", { name: l.summary });
    expect(rows(cats)).toEqual(l.categories.map(c => [c.name, c.figure, c.line].filter(Boolean).join(", ")));
    expect(rows(cats)[0]).toBe("System tools, 12.8k tokens, 47%");
    // Each category's bar is hidden and empty: the figure beside it says it.
    expect([...cats.children].map(li => [...bars(li.firstElementChild!)].map(b => b.textContent))).toEqual(l.categories.map(() => [""]));
    expect(rows(screen.getByRole("list", { name: "Skills" }))).toEqual([
      "babysit-pr, 39 tokens, userSettings · called 3 times by Claude Code in this view", "Unnamed skill, 30 tokens"]);
    // The memory file's folder is in its line, read and seen; its name keeps the full path as a title for the pointer.
    const file = screen.getByText("CLAUDE.md").closest("li")!;
    expect([rows(screen.getByRole("list", { name: "Memory files" })), file.querySelector("[title]")?.getAttribute("title")]).toEqual([
      ["CLAUDE.md, 81 tokens, User · /home/dev/.claude"], "/home/dev/.claude/CLAUDE.md"]);
    // The tools disclosure names its list by the server and its line. Ids come from the model's keys, never from a name.
    within(screen.getByRole("list", { name: "caveman 3 tools, median 254 tokens" })).getByText("retrieve");
    expect([...container.querySelectorAll("[id]")].map(e => e.id).filter(i => /caveman|Skills|babysit|CLAUDE/.test(i))).toEqual([]);
  });

  it("makes a button only of a named server's and a skill's name, opening it by its call key, and none without an opener", async () => {
    const onOpen = vi.fn<OverheadOpener>(), { user, rerender } = await shown(FIXTURE, onOpen);
    // Not the categories, the memory file, the agent, the tools, "Unknown server" or the unnamed skill.
    expect(buttons()).toEqual(["babysit-pr", "caveman"]);
    const server = screen.getByRole("button", { name: "caveman" });
    expect(server.getAttribute("data-subject")).toBe("mcp:plugin_cv_caveman");
    server.focus();
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: "babysit-pr" }));
    expect(onOpen.mock.calls).toEqual([["mcp", "plugin_cv_caveman"], ["skill", "babysit-pr"]]);
    rerender(<OverheadList snapshot={FIXTURE} />);
    // The server's row: its name, tokens and calls, then its tools disclosure (the tools' rows follow inside it).
    expect([buttons(), rows(screen.getByRole("list", { name: "MCP tools" }))[0]!.startsWith(
      "caveman, 805 tokens, called 12 times by Claude Code in this view, 3 tools, median 254 tokens")]).toEqual([[], true]);
    // A new measurement of the same project keeps the list open but folds what was opened in it: the server's tools, though its row keeps its key.
    // It is told by its id: this one has the same session and time.
    const tools = screen.getByText("3 tools, median 254 tokens").closest("details")!, list = screen.getByText(loadList(FIXTURE)!.summary).closest("details")!;
    await user.click(tools.querySelector("summary")!);
    expect(tools.open).toBe(true);
    rerender(<OverheadList snapshot={{ ...FIXTURE, uuid: "u2" }} />);
    expect([screen.getByText("3 tools, median 254 tokens").closest("details")!.open, list.open]).toEqual([false, true]);
  });

  it("folds each list after five rows and back, the focus kept on its one button, each list on its own", async () => {
    const skills = Array.from({ length: 8 }, (_, i) => item("skill", `s${i}`, 80 - i));
    const files = Array.from({ length: 7 }, (_, i) => item("memory_file", `/p${i}/CLAUDE.md`, 70 - i));
    const o = snap([["Skills", 1000], ["Memory files", 900], ["Custom agents", 800]], [...skills, ...files, ...Array.from({ length: 6 }, (_, i) => item("agent", `a${i}`, 10))]);
    const { user, rerender } = await shown(o);
    const list = screen.getByRole("list", { name: "Skills" }), more = within(list).getByRole("button", { name: "Show all 8" });
    expect([rows(list).length, rows(list)[5], more.getAttribute("aria-expanded"), more.getAttribute("aria-controls")]).toEqual([6, "3 more, 222 tokens, Show all 8", "false", list.id]);
    more.focus();
    await user.keyboard("{Enter}");
    expect([rows(list).length, more.textContent, more.getAttribute("aria-expanded"), document.activeElement]).toEqual([9, "Show fewer", "true", more]);
    // The other lists keep their own state; six rows show whole, with no button.
    expect(buttons()).toEqual(["Show fewer", "Show all 7"]);
    within(screen.getByRole("list", { name: "Custom agents" })).getByText("a5");
    // A refetch of the same snapshot keeps it; folding again keeps the focus too.
    rerender(<OverheadList snapshot={structuredClone(o)} />);
    expect(more.textContent).toBe("Show fewer");
    await user.click(more);
    expect([rows(list).length, more.textContent, more.getAttribute("aria-expanded"), document.activeElement]).toEqual([6, "Show all 8", "false", more]);
    // A new snapshot without the expanded list draws whole, every fold closed.
    await user.click(more);
    rerender(<OverheadList snapshot={snap([["Memory files", 900]], files, { uuid: "u2" })} />);
    expect([screen.queryByRole("list", { name: "Skills" }), buttons()]).toEqual([null, ["Show all 7"]]);
  });

  it("draws no bar where the items do not fit, no share where uncounted, and says so for an old snapshot", async () => {
    const o = snap([["System prompt", 500], ["MCP tools", 100], ["Skills", 0]], [
      item("mcp_tool", "mcp__a__x", 150, { server: "a" }), item("skill", "a", 40),
      item("memory_file", "/a/x/CLAUDE.md", 50, { detail: "Project" }), item("memory_file", "/a/y/CLAUDE.md", 50, { detail: "Project" }),
    ], { before_view: true, model: null });
    await shown(o);
    screen.getByText(`${loadList(o)!.measured} ${STALE}`);
    const over = screen.getByRole("list", { name: "MCP tools" });
    expect([bars(screen.getByText("MCP tools").closest("li")!.firstElementChild!).length, bars(over).length]).toEqual([1, 0]);
    // Skills at 0 and Memory files missing: after the ranked ones, "not counted", no share, no bar.
    const skills = screen.getByText("Skills").closest("li")!;
    expect([skills.firstElementChild!.textContent, bars(skills).length]).toEqual([
      "Skills, not counted, 1 skill listed, 40 tokens; this snapshot counts none of them before the first prompt.", 0]);
    expect(rows(screen.getByRole("list", { name: "Memory files" }))).toEqual(["CLAUDE.md, 50 tokens, Project · /a/x", "CLAUDE.md, 50 tokens, Project · /a/y"]);
  });

  it("renders nothing for a snapshot with nothing before the first prompt, and the categories alone without items", () => {
    const { container, rerender } = render(<OverheadList snapshot={snap([["Messages", 900]])} />);
    expect(container.innerHTML).toBe("");
    rerender(<OverheadList snapshot={snap([["System prompt", 300], ["Skills", 100]])} />);
    expect(screen.getAllByRole("list", { hidden: true })).toHaveLength(1);
  });
});
