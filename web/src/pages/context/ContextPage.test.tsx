import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ContextPayload, Tip } from "../../api";
import context from "../../__fixtures__/context";
import session from "../../__fixtures__/session";
import { mockApi } from "../../components/sheets/testing";
import { App } from "../../App";
import { ContextPage } from "./ContextPage";

const fixture: ContextPayload = context;
const serve = (d: ContextPayload) => mockApi({ "/api/context": () => d, "/api/session": () => session });
const show = async (d: ContextPayload = fixture, hash = "#range=0") => {
  const f = serve(d);
  history.replaceState(null, "", "/context" + hash);
  render(<ContextPage />);
  await screen.findByText((_, el) => el?.id === "lede" && !el.textContent!.startsWith("Loading"));
  return f;
};
const drawer = (id: string) => document.getElementById(id) as HTMLDetailsElement;
const hash = () => new URLSearchParams(location.hash.slice(1));
const section = (id: string) => within(document.getElementById(id)!);
const tipCard = (title: string) => within(screen.getByText(title).closest("article") as HTMLElement);
const back = async () => { act(() => history.back()); await new Promise(r => addEventListener("popstate", r, { once: true })); };

describe("ContextPage", () => {
  it("leads with the median start, its share of the window and the sessions that compacted", async () => {
    const f = await show();
    expect(f.mock.calls[0]![0]).toBe("/api/context?range=0");
    expect(document.getElementById("lede")!.textContent).toBe("A typical session starts with 15,000 tokens of context, 4.5% of its window.1 of 7 sessions compacted.");
    expect(screen.getByText(/Nothing is read from/).textContent).toContain("every figure comes from the transcripts");
  });

  it("shows every section, in order, with a heading", async () => {
    await show();
    const heads = ["Tips", "Starting context", "Growth", "What fills context", "Cost"].map(n => screen.getByRole("heading", { level: 2, name: n }));
    for (let i = 1; i < heads.length; i++) expect(heads[i - 1]!.compareDocumentPosition(heads[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Largest tool results" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Sessions where caching broke" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Page sections" })).toBeTruthy();
  });

  it("names no agent in text that covers every source", async () => {
    await show();
    const text = [...document.querySelectorAll("h1, .sub, .hint, h2, h3, .lead-line")].map(e => e.textContent).join("\n");
    // CLAUDE.md names a file, beside AGENTS.md; no agent is named.
    expect(text).not.toMatch(/Claude(?!\.md)/i);
    expect(text).not.toMatch(/Codex/);
  });

  describe("the rebuild notice", () => {
    it("is absent when every figure is filled", async () => {
      await show();
      expect(document.getElementById("rebuild")).toBeNull();
    });
    it("counts the calls with a size and names the command", async () => {
      await show({ ...fixture, coverage: { ...fixture.coverage, calls: 4000, with_bytes: 1000, rebuild_needed: true } });
      const n = document.getElementById("rebuild")!;
      expect(n.textContent).toContain("1,000 of 4,000 tool calls carry a result size");
      expect(n.textContent).toContain("ai-ledger rebuild");
      expect(n.textContent).toContain("app");
      // Figures over the known rows still show.
      expect(screen.getByRole("heading", { level: 2, name: "Cost" })).toBeTruthy();
    });
    it("says when compacted sessions lack their first compaction", async () => {
      await show({ ...fixture, coverage: { ...fixture.coverage, compacted: 4, with_first_compaction: 1, rebuild_needed: true } });
      expect(document.getElementById("rebuild")!.textContent).toContain("1 of 4 compacted sessions record when they first compacted");
    });
  });

  describe("a view with no data", () => {
    it("says no session has a measured start", async () => {
      await show({ ...fixture, project: "nope", range: 7, coverage: { ...fixture.coverage, sessions: 0 }, starting: { ...fixture.starting, sessions: 0, median: null, p10: null, p90: null, window_share: null, by_project: [], trend: [] } }, "#project=nope&range=7");
      expect(document.getElementById("lede")!.textContent).toBe("No agent session in nope with a measured start in the last 7 days.");
      expect(screen.getByText("No session in this view has a measured start.")).toBeTruthy();
    });
    it("names the agent picked", async () => {
      await show({ ...fixture, source: "codex", starting: { ...fixture.starting, median: null } }, "#source=codex");
      expect(document.getElementById("lede")!.textContent).toBe("No Codex session with a measured start yet.");
    });
  });
});

describe("tips", () => {
  it("lists them as cards in the payload's order, each with evidence, advice and a sessions count", async () => {
    await show();
    const cards = [...document.querySelectorAll("#tips article")];
    expect(cards.map(c => c.querySelector(".t")!.textContent)).toEqual(fixture.tips.map(t => t.title));
    const near = tipCard("Sessions reach the limit of the window");
    expect(near.getByText("Highest share of the window").nextElementSibling!.textContent).toBe("85%");
    expect(near.getByText(/Start the next task in a new session/)).toBeTruthy();
    expect(near.getByText("● Act")).toBeTruthy();
    expect(tipCard("Sessions compact repeatedly").getByText("▲ Watch")).toBeTruthy();
    expect(near.getByRole("button", { name: "1 session" })).toBeTruthy();
  });

  it("sets code spans of the advice in code", async () => {
    await show();
    const advice = tipCard("Sessions compact repeatedly").getByText(/Start a new session or/).closest("p")!;
    expect([...advice.querySelectorAll("code")].map(c => c.textContent)).toEqual(["/clear", "/compact"]);
  });

  it("says nothing stands out when no rule fires", async () => {
    await show({ ...fixture, tips: [] });
    expect(screen.getByText(/nothing stands out/i)).toBeTruthy();
    expect(document.querySelector("#tips article")).toBeNull();
  });

  it("opens the sessions of a tip, writing the hash, and Back closes them", async () => {
    await show();
    expect(drawer("d-tip")).toBeNull();
    await userEvent.click(tipCard("Sessions reach the limit of the window").getByRole("button", { name: "1 session" }));
    expect(hash().get("tip")).toBe("near_limit");
    const d = drawer("d-tip");
    expect(d.open).toBe(true);
    expect(within(d).getByRole("heading", { level: 2, name: "Sessions matching Sessions reach the limit of the window" })).toBeTruthy();
    expect(within(d).getByRole("button", { name: "Fix the importer" })).toBeTruthy();
    expect(within(d).getByText("Claude Code")).toBeTruthy();
    await back();
    await waitFor(() => expect(drawer("d-tip")).toBeNull());
    expect(hash().get("tip")).toBeNull();
  });

  it("clears the hash when the list is closed from its summary", async () => {
    await show(fixture, "#range=0&tip=near_limit");
    await waitFor(() => expect(drawer("d-tip").open).toBe(true));
    await userEvent.click(drawer("d-tip").querySelector("summary")!);
    await waitFor(() => expect(drawer("d-tip")).toBeNull());
    expect(hash().get("tip")).toBeNull();
    expect(hash().get("range")).toBe("0");
  });

  it("opens a session sheet from the list", async () => {
    await show(fixture, "#range=0&tip=near_limit");
    await userEvent.click(within(drawer("d-tip")).getByRole("button", { name: "Fix the importer" }));
    expect(hash().get("session")).toBe("f1");
    expect(hash().get("tip")).toBe("near_limit");
    await waitFor(() => expect(document.querySelector("dialog.sheet[open]")).toBeTruthy());
  });

  it("says how many matching sessions are left out", async () => {
    const tip: Tip = { ...fixture.tips[0]!, matched: 25, sessions: Array.from({ length: 20 }, (_, i) => ({ ...fixture.tips[0]!.sessions[0]!, session_id: `s${i}`, title: `Session ${i}` })) };
    await show({ ...fixture, tips: [tip] }, "#range=0&tip=near_limit");
    const d = drawer("d-tip");
    expect(within(d).getAllByRole("button")).toHaveLength(20);
    expect(within(d).getByText("and 5 more.")).toBeTruthy();
    expect(within(screen.getByRole("button", { name: "25 sessions" }).closest("article")!).getByText("Highest share of the window")).toBeTruthy();
  });

  it("shows nothing for a tip the payload does not have", async () => {
    await show(fixture, "#range=0&tip=nope");
    expect(drawer("d-tip")).toBeNull();
    expect(hash().get("tip")).toBe("nope");
  });

  it("shows nothing for a tip that does not fire in this view", async () => {
    await show({ ...fixture, tips: fixture.tips.filter(t => t.id !== "near_limit") }, "#range=0&tip=near_limit");
    expect(drawer("d-tip")).toBeNull();
  });
});

describe("starting context", () => {
  it("lists each project's median, 10th percentile, share of its window and sessions, and the whole view", async () => {
    await show();
    const s = section("starting");
    const row = (name: string) => within(s.getByText(name).closest("tr")!).getAllByRole("cell").map(c => c.textContent);
    expect(row("foo")).toEqual(["foo", "24,000", "20,800", "10% of 200k", "3"]);
    expect(row("codex-app")).toEqual(["codex-app", "15,000", "15,000", "5.8% of 258.4k", "1"]);
    expect(row("Whole view")).toEqual(["Whole view", "15,000", "7,600", "4.5%", "7"]);
    expect(s.getByText(/7 of 7 sessions in this view have a measured start; 7 have a known window/)).toBeTruthy();
  });

  it("shows no figure for a project without a window share", async () => {
    const by = fixture.starting.by_project.map(p => (p.project === "bar" ? { ...p, window: null, window_share: null } : p));
    await show({ ...fixture, starting: { ...fixture.starting, by_project: by } });
    expect(within(section("starting").getByText("bar").closest("tr")!).getAllByRole("cell")[3]!.textContent).toBe("–");
  });

  it("charts the weekly median", async () => {
    await show();
    const s = section("starting"), fig = s.getByRole("figure");
    expect(fig.querySelectorAll("rect")).toHaveLength(2);
    expect(fig.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
    // A screen reader gets every week as a table, not just the two ends.
    const rows = within(s.getByRole("table", { name: /Median starting context per week/ })).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getAllByRole("cell")[1]!.textContent).toBe("7,000");
  });

  it("opens a project's sheet from its row", async () => {
    await show();
    await userEvent.click(section("starting").getByText("foo"));
    expect(hash().get("inspect")).toBe("foo");
  });

  it.each(["starting", "cost"])("opens a project's sheet from its name button in %s with the keyboard", async id => {
    await show();
    section(id).getByRole("button", { name: "foo" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(hash().get("inspect")).toBe("foo");
  });
});

describe("growth", () => {
  it("draws the curve with its text alternative and the added-per-prompt and compaction figures", async () => {
    await show();
    const g = section("growth");
    expect(g.getByRole("img", { name: /Median context at each turn: 15k tokens at turn 1, 30k at turn 2/ })).toBeTruthy();
    const tile = (l: string) => g.getByText(l, { selector: ".vital .l" }).previousElementSibling!.textContent;
    expect(tile("Added per prompt")).toBe("16,000 tokens");
    expect(tile("Before the first compaction")).toBe("5 turns");
    expect(tile("Active time before it")).toBe("5m");
    const foo = within(g.getByText("foo").closest("tr")!).getAllByRole("cell").map(c => c.textContent);
    expect(foo).toEqual(["foo", "3", "33,000", "1", "5", "5m"]);
    expect(within(g.getByText("bar").closest("tr")!).getAllByRole("cell").map(c => c.textContent)).toEqual(["bar", "3", "3,000", "0", "–", "–"]);
  });

  it("says when no session compacted, and shows no medians for it", async () => {
    await show({ ...fixture, coverage: { ...fixture.coverage, compacted: 0, with_first_compaction: 0 },
      growth: { ...fixture.growth, to_compaction: { sessions: 0, turns: null, minutes: null } } });
    const g = section("growth");
    expect(g.getByText(/No session in this view compacted/)).toBeTruthy();
    expect(g.queryByText("Before the first compaction")).toBeNull();
    expect(g.getByText("Added per prompt", { selector: ".vital .l" })).toBeTruthy();
  });

  it("says a compaction has no recorded first one yet", async () => {
    await show({ ...fixture, growth: { ...fixture.growth, to_compaction: { sessions: 0, turns: null, minutes: null } } });
    expect(section("growth").getByText(/1 session compacted, but none has a recorded first compaction yet/)).toBeTruthy();
  });

  it("explains an empty curve", async () => {
    await show({ ...fixture, growth: { ...fixture.growth, curve: [], by_project_curves: [] } });
    expect(section("growth").getByText(/No turn is shared by 5 or more sessions/)).toBeTruthy();
    expect(section("growth").queryByRole("img", { name: /Median context at each turn/ })).toBeNull();
  });

  it("draws a project curve for each the payload holds, which may be fewer than five", async () => {
    const pts = fixture.growth.curve.map(p => ({ ...p, sessions: 6 }));
    await show({ ...fixture, growth: { ...fixture.growth, by_project_curves: [{ project: "foo", sessions: 6, curve: pts }] } });
    expect(document.querySelectorAll("#growth path.curve.proj")).toHaveLength(1);
  });

  it("shows five bars per window, labelled by window size, counts adding up to its sessions", async () => {
    await show();
    const w = section("growth").getByRole("group", { name: "200k window, 5 sessions" });
    expect([...w.querySelectorAll("li")].map(li => li.textContent)).toEqual(["3<25%", "125–50%", "050–75%", "175–90%", "0≥90%"]);
    expect(section("growth").getByRole("group", { name: "2M window, 1 session" })).toBeTruthy();
    expect(section("growth").getByRole("group", { name: "258.4k window, 1 session" })).toBeTruthy();
  });
});

describe("what fills context", () => {
  it("lists the tools and MCP servers with an estimate badge on every token figure", async () => {
    await show();
    const f = section("fills");
    const bash = f.getAllByText("Bash")[0]!.closest("tr")!;
    expect(within(bash).getAllByRole("cell").map(c => c.textContent)).toEqual(["Bash", "2", "250 KB", "250 KB", "250 KB", "≈62,500 estimate"]);
    expect(within(f.getByText("github").closest("tr")!).getAllByRole("cell")[5]!.textContent).toBe("≈250 estimate");
    const badges = [...document.querySelectorAll("#fills .chip.est")];
    expect(badges.length).toBe(fixture.fills.tools.length + fixture.fills.mcp.length + 1);
    for (const b of badges) expect(b.getAttribute("title")).toBe("bytes ÷ 4");
    for (const c of document.querySelectorAll("#fills td:last-child")) expect(c.querySelector(".chip.est")).toBeTruthy();
  });

  it("keeps the subagents' bytes apart from the main thread's", async () => {
    await show();
    const line = section("fills").getByText(/The main thread read/).textContent!;
    expect(line).toBe("The main thread read 373 KB of tool results (≈93,325 estimate). Calls made inside subagent transcripts returned 500 KB more, which never entered the main thread's context.");
  });

  it("opens the sheet of a tool or an MCP server", async () => {
    await show();
    await userEvent.click(section("fills").getByRole("button", { name: "Read" }));
    expect(hash().get("tool")).toBe("Read");
    await userEvent.click(section("fills").getByRole("button", { name: "github" }));
    expect(hash().get("mcp")).toBe("github");
    expect(hash().get("tool")).toBeNull();
  });

  it("lists the largest results with their session, and a session button opens its sheet", async () => {
    await show();
    const d = drawer("d-largest");
    const rows = within(d).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(fixture.fills.largest.length);
    expect(within(rows[0]!).getAllByRole("cell").map(c => c.textContent)).toEqual([
      "Bash", "npm test", "250 KB", "≈62,500 estimate", expect.any(String), "fooClaude Code", "Fix the importer#f1"]);
    expect(within(rows[3]!).getByText("github")).toBeTruthy();
    await userEvent.click(within(rows[0]!).getByRole("button", { name: "Fix the importer" }));
    expect(hash().get("session")).toBe("f1");
    await waitFor(() => expect(document.querySelector("dialog.sheet[open]")).toBeTruthy());
  });

  it("says when no tool result has a known size", async () => {
    await show({ ...fixture, fills: { ...fixture.fills, tools: [], mcp: [], largest: [], main_bytes: 0, subagent_bytes: 0 } });
    expect(section("fills").getByText("No tool result with a known size in this view.")).toBeTruthy();
    expect(section("fills").getByText("No MCP server result with a known size in this view.")).toBeTruthy();
  });
});

describe("cost", () => {
  it("shows the view and each project with its cache reads, long-tier cost and requests, and cache-hit ratio", async () => {
    await show();
    const c = section("cost"), cells = (name: string) => within(c.getByText(name).closest("tr")!).getAllByRole("cell").map(x => x.textContent);
    expect(cells("Whole view")).toEqual(["Whole view", "$2.25", "$0.09", "$1.50", "1", "38%"]);
    expect(cells("foo")).toEqual(["foo", "$2.17", "$0.09", "$1.50", "1", "42%"]);
    // No long-tier request in a priced project is $0, not unknown.
    expect(cells("codex-app")).toEqual(["codex-app", "$0.04", "$0.00", "$0", "0", "0%"]);
  });

  it("reads unknown costs as –, never zero", async () => {
    const none = { cost: null, cache_read_cost: null, long_cost: null, long_requests: 0, cache_hit_ratio: null };
    await show({ ...fixture, cost: { ...fixture.cost, ...none, by_project: fixture.cost.by_project.map(p => ({ ...p, ...none })) } });
    const c = section("cost");
    for (const name of ["Whole view", "foo", "bar"]) expect(within(c.getByText(name).closest("tr")!).getAllByRole("cell").slice(1).map(x => x.textContent)).toEqual(["–", "–", "–", "0", "–"]);
  });

  it("lists the sessions where caching broke, with their causes and uncached tokens", async () => {
    await show();
    const d = drawer("d-breaks");
    expect(d.querySelector("summary .c")!.textContent).toBe("3");
    const first = within(d).getAllByRole("row")[1]!;
    expect(within(first).getAllByRole("cell").map(c => c.textContent)).toEqual(["#f2", "fooClaude Code", "2", "1 model switch, 1 expired", "174,000", "$0.52"]);
    await userEvent.click(within(first).getByRole("button"));
    expect(hash().get("session")).toBe("f2");
  });
});

describe("filters", () => {
  it("offers the automated toggle and keeps the hash's view in the request", async () => {
    const f = await show(fixture, "#project=foo&range=7&source=codex&auto=1");
    expect(f.mock.calls[0]![0]).toBe("/api/context?project=foo&range=7&automated=1&source=codex");
    expect(screen.getByRole("checkbox", { name: /Include automated/ })).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: /Include automated/ }) as HTMLInputElement).checked).toBe(true);
  });

  it("is a route of the app", async () => {
    serve(fixture);
    history.replaceState(null, "", "/context#range=0");
    render(<App />);
    expect(await screen.findByRole("heading", { level: 1, name: /A typical session starts with/ })).toBeTruthy();
    expect(document.title).toBe("Context · AI Ledger");
  });
});
