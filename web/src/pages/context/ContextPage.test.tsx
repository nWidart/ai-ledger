import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ContextPayload, Tip } from "../../api";
import context from "../../__fixtures__/context";
import session from "../../__fixtures__/session";
import { mockApi } from "../../components/sheets/testing";
import { openDrawer } from "../../components/Drawer";
import { ContextPage } from "./ContextPage";
import { renderApp, renderPage, renderRouter } from "../../testing";

const fixture: ContextPayload = context;
const serve = (d: ContextPayload) => mockApi({ "/api/context": () => d, "/api/session": () => session });
/** The page loaded, with these drawers opened in turn (a closed drawer renders no table; one opens at a time, so the last stays open). */
const show = async (d: ContextPayload = fixture, hash = "?range=0", open: string[] = []) => {
  const f = serve(d);
  history.replaceState(null, "", "/context" + hash);
  renderPage(<ContextPage />);
  await screen.findByText((_, el) => el?.id === "lede" && !el.textContent!.startsWith("Loading"));
  act(() => open.forEach(id => openDrawer(id)));
  return f;
};
const drawer = (id: string) => document.getElementById(id)!;
const isOpen = (id: string) => drawer(id).hasAttribute("data-open");
/** A row's header and data cells, in order. */
const cells = (row: HTMLElement) => [...row.querySelectorAll("th[scope=row], td")].map(c => c.textContent);
/** A project's 90th percentile (the whole view's with no name), as the table prints it. */
const p90 = (name?: string) => (name ? fixture.starting.by_project.find(p => p.project === name)!.p90 : fixture.starting.p90)!.toLocaleString();
const hash = () => new URLSearchParams(location.search.slice(1));
const section = (id: string) => within(document.getElementById(id)!);
const tipCard = (title: string) => within(screen.getByText(title).closest("article") as HTMLElement);
/** The text behind a How measured toggletip, once activated. */
const how = async (what: string) => {
  const b = screen.getByRole("button", { name: `How measured: ${what}` });
  await userEvent.click(b);
  return within(b.parentElement!).getByRole("tooltip").textContent!;
};
const back = async () => { act(() => history.back()); await new Promise(r => addEventListener("popstate", r, { once: true })); };

describe("ContextPage", () => {
  it("leads with the median start and its share of the window; the sessions that compacted are Growth's", async () => {
    const f = await show();
    expect(f.mock.calls[0]![0]).toBe("/api/context?range=0");
    expect(document.getElementById("lede")!.textContent).toBe("A typical session starts with 15,500 tokens of context, 6.5% of its window.");
    expect(screen.getByText(/Every figure comes from the transcripts/)).toBeTruthy();
    expect(await how("context")).toMatch(/first turn, over 12 sessions with a measured start\. Nothing is read from CLAUDE\.md, AGENTS\.md or any configuration file/);
    const tile = section("growth").getByText("Sessions compacted").closest(".vital")!;
    expect(tile.textContent).toMatch(/^2Sessions compactedOf 12 sessions/);
  });

  it("shows every section, in order, with a heading", async () => {
    await show();
    const heads = ["Tips", "Starting context", "Growth", "Window pressure", "What fills context", "Cost"].map(n => screen.getByRole("heading", { level: 2, name: n }));
    expect(screen.getByRole("main")).toBeTruthy();
    for (let i = 1; i < heads.length; i++) expect(heads[i - 1]!.compareDocumentPosition(heads[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // A drawer's title is a heading whose button opens it, never a heading inside a summary.
    expect(screen.getByRole("heading", { level: 2, name: /^Largest tool results/ })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: /^Sessions where caching broke/ })).toBeTruthy();
    expect(document.querySelector("summary h2, summary h3")).toBeNull();
    const nav = screen.getByRole("navigation", { name: "Page sections" });
    expect(nav).toBeTruthy();
    expect(within(nav).getByRole("link", { name: "Pressure" }).getAttribute("href")).toBe("#pressure");
  });

  it("draws every chart from the fixture", async () => {
    await show();
    expect(section("starting").getByRole("table", { name: "Starting context by project" }).querySelectorAll("[data-testid=rng-bar]")).toHaveLength(fixture.starting.by_project.length + 1);
    expect(section("starting").getByRole("group", { name: /Median start/ }).getAttribute("aria-label")).toContain("tokens");
    expect(section("growth").getByRole("group", { name: "Chart measure" })).toBeTruthy();
    expect(section("pressure").getByRole("group", { name: "200k window, 10 sessions, by peak share of the window" })).toBeTruthy();
    expect(section("pressure").getByRole("group", { name: /^Session map: 12 sessions shown/ })).toBeTruthy();
    expect(section("fills").getByText(/Main thread:/).textContent).toContain("509 KB");
    expect(section("cost").getByRole("group", { name: /^Cache use/ })).toBeTruthy();
  });

  it("names its tables, scrolls them in focusable regions and heads rows and columns", async () => {
    await show();
    expect(screen.queryByRole("table", { name: "Tool results by tool" })).toBeNull(); // Contributors holds every row
    expect(screen.queryByRole("table", { name: "Tool results by MCP server" })).toBeNull();
    const drawers: Record<string, string> = { "Largest tool results": "d-largest", "Sessions where caching broke": "d-breaks" };
    for (const name of ["Starting context by project", "Growth by project", "Largest contributors by tool", "Cost by project", "Largest tool results", "Sessions where caching broke"]) {
      if (drawers[name]) act(() => openDrawer(drawers[name]!));
      const table = screen.getByRole("table", { name }), region = screen.getByRole("region", { name });
      expect(region.contains(table)).toBe(true);
      expect(region.tabIndex).toBe(0);
      expect(within(table).getAllByRole("columnheader").every(h => h.getAttribute("scope") === "col")).toBe(true);
      expect(within(table).getAllByRole("rowheader").every(h => h.getAttribute("scope") === "row")).toBe(true);
    }
  });

  it("explains a column behind a toggletip, not a hover title", async () => {
    await show();
    const head = within(screen.getByRole("table", { name: "Cost by project" })).getByRole("columnheader", { name: /^Cache-hit ratio/ });
    expect(head.querySelector("[title]")).toBeNull();
    await userEvent.click(within(head).getByRole("button", { name: "About cache-hit ratio" }));
    expect(within(head).getByRole("tooltip").textContent).toBe("Cache read tokens over all prompt tokens");
    // Only a row with calls that carry no result size has one on its call count.
    const bash = within(screen.getByRole("table", { name: "Largest contributors by tool" })).getByText("Bash").closest("tr")!;
    await userEvent.click(within(bash).getByRole("button", { name: "About calls" }));
    expect(within(bash).getByRole("tooltip").textContent).toBe("1 with a result size");
  });

  it("marks the content busy while loading, with no live region announcing it", async () => {
    mockApi({ "/api/context": () => new Promise(() => {}) as never });
    history.replaceState(null, "", "/context?range=0");
    renderApp(<ContextPage />);
    const main = screen.getByRole("main");
    expect(main.id).toBe("content");
    expect(main.getAttribute("aria-busy")).toBe("true");
    const lede = document.getElementById("lede")!;
    expect(lede.textContent).toBe("Loading context…");
    expect(lede.hasAttribute("aria-live")).toBe(false);
    expect(main.querySelector(".pending")!.hasAttribute("role")).toBe(false);
    expect(main.querySelector("[aria-live]")).toBeNull();
  });

  it("names no agent in text that covers every source", async () => {
    await show();
    const text = [...document.querySelectorAll("h1, .sub, .hint, h2, h3")].map(e => e.textContent).join("\n");
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
      await show({ ...fixture, project: "nope", range: 7, coverage: { ...fixture.coverage, sessions: 0 }, starting: { ...fixture.starting, sessions: 0, median: null, p10: null, p90: null, window_share: null, by_project: [], trend: [] } }, "?project=nope&range=7");
      expect(document.getElementById("lede")!.textContent).toBe("No agent session in nope with a measured start in the last 7 days.");
      expect(screen.getByText("No session in this view has a measured start.")).toBeTruthy();
    });
    it("names the agent picked", async () => {
      await show({ ...fixture, source: "codex", starting: { ...fixture.starting, median: null } }, "?source=codex");
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

  it("shows the tips as compact cards side by side, the rules note behind How measured", async () => {
    await show();
    const cards = [...document.querySelectorAll("#tips article")];
    expect(cards).toHaveLength(fixture.tips.length);
    expect(cards.every(c => c.classList.contains("compact") && !c.classList.contains("primary"))).toBe(true);
    expect(document.querySelector("#tips .insights")!.classList.contains("tip-cards")).toBe(true);
    expect(await how("tips")).toMatch(/nothing is learned or generated/);
  });

  it("opens the sessions of a tip, writing the hash, and Back closes them", async () => {
    await show();
    expect(drawer("d-tip")).toBeNull();
    await userEvent.click(tipCard("Sessions reach the limit of the window").getByRole("button", { name: "1 session" }));
    expect(hash().get("tip")).toBe("near_limit");
    const d = drawer("d-tip");
    expect(isOpen("d-tip")).toBe(true);
    expect(within(d).getByRole("heading", { level: 2, name: /^Sessions matching Sessions reach the limit of the window/ })).toBeTruthy();
    expect(within(d).getByRole("button", { name: "Fix the importer" })).toBeTruthy();
    expect(within(d).getByText("Claude Code")).toBeTruthy();
    const table = within(d).getByRole("table", { name: /^Sessions matching Sessions reach the limit/ });
    expect(within(d).getByRole("region", { name: /^Sessions matching/ }).contains(table)).toBe(true);
    expect(within(table).getAllByRole("columnheader").every(h => h.getAttribute("scope") === "col")).toBe(true);
    expect(within(table).getByRole("rowheader").getAttribute("scope")).toBe("row");
    await back();
    await waitFor(() => expect(drawer("d-tip")).toBeNull());
    expect(hash().get("tip")).toBeNull();
  });

  it("clears the hash when the list is closed from its title", async () => {
    await show(fixture, "?range=0&tip=near_limit");
    await waitFor(() => expect(isOpen("d-tip")).toBe(true));
    await userEvent.click(within(drawer("d-tip")).getByRole("button", { name: /^Sessions matching/ }));
    await waitFor(() => expect(drawer("d-tip")).toBeNull());
    expect(hash().get("tip")).toBeNull();
    expect(hash().get("range")).toBe("0");
  });

  it("opens a session sheet from the list", async () => {
    await show(fixture, "?range=0&tip=near_limit");
    await userEvent.click(within(drawer("d-tip")).getByRole("button", { name: "Fix the importer" }));
    expect(hash().get("session")).toBe("f1");
    expect(hash().get("tip")).toBe("near_limit");
    await waitFor(() => expect(document.querySelector("dialog.sheet[open]")).toBeTruthy());
  });

  it("says how many matching sessions are left out", async () => {
    const tip: Tip = { ...fixture.tips[0]!, matched: 25, sessions: Array.from({ length: 20 }, (_, i) => ({ ...fixture.tips[0]!.sessions[0]!, session_id: `s${i}`, title: `Session ${i}` })) };
    await show({ ...fixture, tips: [tip] }, "?range=0&tip=near_limit");
    const d = drawer("d-tip");
    // Twenty session buttons, beside the drawer's own title button.
    expect(within(d).getAllByRole("button").filter(b => b.classList.contains("cellbtn"))).toHaveLength(20);
    expect(within(d).getByText("and 5 more.")).toBeTruthy();
    expect(within(screen.getByRole("button", { name: "25 sessions" }).closest("article")!).getByText("Highest share of the window")).toBeTruthy();
  });

  it("shows nothing for a tip the payload does not have", async () => {
    await show(fixture, "?range=0&tip=nope");
    expect(drawer("d-tip")).toBeNull();
    expect(hash().get("tip")).toBe("nope");
  });

  it("shows nothing for a tip that does not fire in this view", async () => {
    await show({ ...fixture, tips: fixture.tips.filter(t => t.id !== "near_limit") }, "?range=0&tip=near_limit");
    expect(drawer("d-tip")).toBeNull();
  });
});

describe("starting context", () => {
  it("lists each project's median, 10th and 90th percentile, share of its window and sessions, and the whole view", async () => {
    await show();
    const s = section("starting");
    const row = (name: string) => cells(s.getByText(name).closest("tr")!);
    // The second cell is the range drawing, which has no text.
    expect(row("foo")).toEqual(["foo", "", "24,000", "20,800", p90("foo"), "10% of 200k", "3"]);
    expect(row("codex-app")).toEqual(["codex-app", "", "15,000", "15,000", p90("codex-app"), "5.8% of 258.4k", "1"]);
    expect(row("Whole view")).toEqual(["Whole view", "", "15,500", "8,100", p90(), "6.5%", "12"]);
    expect(await how("starting context")).toMatch(/12 of 12 sessions in this view have a measured start; 12 have a known window/);
  });

  it("shows no figure for a project without a window share", async () => {
    const by = fixture.starting.by_project.map(p => (p.project === "bar" ? { ...p, window: null, window_share: null } : p));
    await show({ ...fixture, starting: { ...fixture.starting, by_project: by } });
    expect(cells(section("starting").getByText("bar").closest("tr")!)[5]).toBe("–");
  });

  it("charts the weekly median under its own heading, every week in a table closed until asked for", async () => {
    await show();
    const s = section("starting");
    expect(s.getByRole("heading", { level: 3, name: "Median start by week" })).toBeTruthy();
    expect(s.getByRole("group", { name: /Median start/ }).querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
    expect(s.queryByRole("table", { name: /per week/i })).toBeNull();
    await userEvent.click(s.getByRole("button", { name: "Show data table" }));
    const rows = within(s.getByRole("table", { name: /per week/i })).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(4);
    expect(cells(rows[0]!)[1]).toBe("7k");
    expect(within(rows[0]!).getByRole("rowheader").getAttribute("scope")).toBe("row");
  });

  it("explains the range in a one-line hint and the 30k mark behind How measured", async () => {
    await show();
    expect(section("starting").getByText(/10th to 90th percentile, median ticked/)).toBeTruthy();
    expect(await how("starting context")).toMatch(/dashed line is the 30k-token mark/);
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
    expect(g.getByRole("group", { name: /Median context at each turn: 15.5k tokens at turn 1, 60k at turn 4/ })).toBeTruthy();
    const tile = (l: string) => g.getByText(l, { selector: ".vital .l" }).previousElementSibling!.textContent;
    expect(tile("Added per prompt")).toBe("20,000 tokens");
    expect(tile("Before the first compaction")).toBe("5 turns");
    expect(tile("Active time before it")).toBe("4m");
    const foo = cells(g.getByText("foo").closest("tr")!);
    expect(foo).toEqual(["foo", "3", "33,000", "1", "5", "5m"]);
    expect(cells(g.getByText("bar").closest("tr")!)).toEqual(["bar", "3", "3,000", "0", "–", "–"]);
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
    expect(section("growth").getByText(/2 sessions compacted, but none has a recorded first compaction yet/)).toBeTruthy();
  });

  it("explains an empty curve", async () => {
    await show({ ...fixture, growth: { ...fixture.growth, curve: [], by_project_curves: [] } });
    expect(section("growth").getByText(/No turn is shared by 5 or more sessions/)).toBeTruthy();
    expect(section("growth").queryByRole("group", { name: /Median context at each turn/ })).toBeNull();
  });

  it("draws a project curve for each the payload holds, which may be fewer than five", async () => {
    const pts = fixture.growth.curve.map(p => ({ ...p, sessions: 6 }));
    await show({ ...fixture, growth: { ...fixture.growth, by_project_curves: [{ project: "foo", sessions: 6, curve: pts, share_curve: [] }] } });
    expect(document.querySelectorAll("#growth path.curve.proj")).toHaveLength(1);
  });

  it("moves the peak fill out of this section, and offers the share of the window", async () => {
    await show();
    expect(section("growth").queryByText("Peak fill by window size")).toBeNull();
    expect(section("growth").queryByRole("group", { name: /window, \d+ sessions?, by peak share/ })).toBeNull();
    expect(section("growth").getByRole("button", { name: "Share of window" })).toBeTruthy();
    expect(await how("growth")).toMatch(/how many sessions each turn rests on/);
  });

  it("lists the projects when no session compacted and the view has two", async () => {
    await show({ ...fixture, coverage: { ...fixture.coverage, compacted: 0, with_first_compaction: 0 },
      growth: { ...fixture.growth, to_compaction: { sessions: 0, turns: null, minutes: null },
        by_project: fixture.growth.by_project.filter(p => p.project === "foo" || p.project === "bar").map(p => ({ ...p, compacted: 0, turns_to_compaction: null, minutes_to_compaction: null })) } });
    const g = section("growth");
    expect(cells(g.getByText("foo").closest("tr")!)).toEqual(["foo", "3", "33,000", "0", "–", "–"]);
    expect(cells(g.getByText("bar").closest("tr")!).slice(3)).toEqual(["0", "–", "–"]);
  });

  it("lists no project table for a view with one project", async () => {
    await show({ ...fixture, growth: { ...fixture.growth, by_project: fixture.growth.by_project.slice(0, 1) } });
    expect(section("growth").queryByRole("table", { name: "Growth by project" })).toBeNull();
  });
});

describe("window pressure", () => {
  it("draws a bar per window size, labelled by size, with a segment per band that has sessions", async () => {
    await show();
    const p = section("pressure");
    const w = p.getByRole("group", { name: "200k window, 10 sessions, by peak share of the window" });
    expect([...w.querySelectorAll("button")].map(b => b.getAttribute("aria-label"))).toEqual([
      "5 sessions (50%) peaked at <25% of the 200k window", "2 sessions (20%) peaked at 25–50% of the 200k window", "2 sessions (20%) peaked at 50–80% of the 200k window",
      "1 session (10%) peaked at 80–90% of the 200k window"]);
    expect(p.getByRole("group", { name: /^2M window, 1 session/ })).toBeTruthy();
    expect(p.getByRole("group", { name: /^258.4k window, 1 session/ })).toBeTruthy();
    expect(await how("window pressure")).toMatch(/12 of 12 sessions have a known window/);
  });

  it("maps every session by its start and peak under its own heading", async () => {
    await show();
    const p = section("pressure");
    expect(p.getByRole("heading", { level: 3, name: "Sessions by start and peak" })).toBeTruthy();
    expect(p.getByText(/^12 sessions\./)).toBeTruthy();
  });

  it("says no session has a known window, and no session is on the map", async () => {
    await show({ ...fixture, growth: { ...fixture.growth, fill: [] }, sessions_map: { total: 0, points: [] } });
    const p = section("pressure");
    expect(p.getByText("No session in this view has a known window.")).toBeTruthy();
    expect(p.getByText(/No session in this view has a measured start, a known window and a peak/)).toBeTruthy();
  });
});

describe("what fills context", () => {
  it("lists the tools and MCP servers once, with calls, the spread, the largest and an estimate badge on every token figure", async () => {
    await show();
    const f = section("fills");
    const tools = within(f.getByRole("table", { name: "Largest contributors by tool" }));
    expect(cells(tools.getByText("Bash").closest("tr")!)).toEqual(["Bash", "2?", "250 KB · ≈62,500 estimate", "median 250 KB · 95th 250 KB", "250 KB"]);
    // The badge is text, not a hover title: How measured says what it means.
    const badges = () => [...document.querySelectorAll("#fills table .chip.est")];
    expect(fixture.fills.tools.length).toBeGreaterThan(10);
    expect(badges()).toHaveLength(11); // the top ten and Other
    await userEvent.click(f.getByRole("button", { name: `Show all ${fixture.fills.tools.length} tools` }));
    expect(badges()).toHaveLength(fixture.fills.tools.length);
    for (const b of badges()) expect(b.hasAttribute("title")).toBe(false);
    expect(await how("what fills context")).toMatch(/the bytes divided by 4, an estimate/);
    await userEvent.click(f.getByRole("button", { name: "By MCP server" }));
    expect(cells(within(f.getByRole("table", { name: "Largest contributors by MCP server" })).getByText("github").closest("tr")!)[2]).toMatch(/≈250 estimate$/);
  });

  it("draws the main thread and the subagents once, as the two parts of one bar", async () => {
    await show();
    const f = section("fills");
    expect(f.getByText(/Main thread:/).textContent).toMatch(/509 KB.*estimate/);
    expect(f.getByText(/Subagents:/).textContent).toContain("500 KB");
    expect(f.getAllByText(/never entered the main thread's context/)).toHaveLength(1);
    expect(f.queryByText(/The main thread read/)).toBeNull();
    expect(f.getByRole("table", { name: "Largest contributors by tool" })).toBeTruthy();
  });

  it("opens the sheet of a tool or an MCP server", async () => {
    await show();
    await userEvent.click(within(section("fills").getByRole("table", { name: "Largest contributors by tool" })).getByRole("button", { name: "Read" }));
    expect(hash().get("tool")).toBe("Read");
    await userEvent.click(section("fills").getByRole("button", { name: "By MCP server" }));
    await userEvent.click(within(section("fills").getByRole("table", { name: "Largest contributors by MCP server" })).getByRole("button", { name: "github" }));
    expect(hash().get("mcp")).toBe("github");
    expect(hash().get("tool")).toBeNull();
  });

  it("lists the largest results with their session, and a session button opens its sheet", async () => {
    await show(fixture, "?range=0", ["d-largest"]);
    const d = drawer("d-largest");
    const rows = within(within(d).getByRole("table", { name: "Largest tool results" })).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(fixture.fills.largest.length);
    expect(cells(rows[0]!)).toEqual([
      "Bash", "npm test", "250 KB", "≈62,500 estimate", expect.any(String), "fooClaude Code", "Fix the importer#f1"]);
    expect(within(rows[2]!).getByText("figma")).toBeTruthy();
    await userEvent.click(within(rows[0]!).getByRole("button", { name: "Fix the importer" }));
    expect(hash().get("session")).toBe("f1");
    await waitFor(() => expect(document.querySelector("dialog.sheet[open]")).toBeTruthy());
  });

  it("says when no tool result has a known size", async () => {
    await show({ ...fixture, fills: { ...fixture.fills, tools: [], mcp: [], largest: [], main_bytes: 0, subagent_bytes: 0 } });
    // Said once, by the contributors; no empty table or second line repeats it.
    expect(section("fills").getAllByText("No tool result with a known size in this view.")).toHaveLength(1);
    expect(section("fills").queryByRole("table")).toBeNull();
  });
});

describe("cost", () => {
  it("shows the view and each project with its cache reads, long-tier cost and requests, and cache-hit ratio", async () => {
    await show();
    const c = section("cost"), row = (name: string) => cells(c.getByText(name).closest("tr")!);
    expect(row("Whole view")).toEqual(["Whole view", "$2.59", "$0.16", "$1.50", "1", "60%"]);
    expect(row("foo")).toEqual(["foo", "$2.17", "$0.09", "$1.50", "1", "42%"]);
    // No long-tier request in a priced project is $0, not unknown.
    expect(row("codex-app")).toEqual(["codex-app", "$0.04", "$0.00", "$0", "0", "0%"]);
  });

  it("charts cache use over time above the per-project table", async () => {
    await show();
    const c = section("cost");
    const chart = c.getByRole("heading", { level: 3, name: "Cache use over time" }), table = c.getByRole("heading", { level: 3, name: "By project" });
    expect(chart.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(c.getByRole("group", { name: /^Cache use/ }).getAttribute("aria-label")).toContain("of prompt tokens read from the cache");
  });

  it("says no request is in the view when the series is empty", async () => {
    await show({ ...fixture, cost: { ...fixture.cost, series: { bucket: "day", rows: [] } } });
    expect(section("cost").getByText("No request in this view.")).toBeTruthy();
  });

  it("reads unknown costs as –, never zero", async () => {
    const none = { cost: null, cache_read_cost: null, long_cost: null, long_requests: 0, cache_hit_ratio: null };
    await show({ ...fixture, cost: { ...fixture.cost, ...none, by_project: fixture.cost.by_project.map(p => ({ ...p, ...none })) } });
    const c = section("cost");
    for (const name of ["Whole view", "foo", "bar"]) expect(cells(c.getByText(name).closest("tr")!).slice(1)).toEqual(["–", "–", "–", "0", "–"]);
  });

  it("lists the sessions where caching broke, with their causes and uncached tokens", async () => {
    await show(fixture, "?range=0", ["d-breaks"]);
    const d = drawer("d-breaks");
    expect(d.querySelector(".drawer-toggle .c")!.textContent).toBe("4");
    const first = within(d).getAllByRole("row")[1]!;
    expect(cells(first)).toEqual(["#f2", "fooClaude Code", "2", "1 model switch, 1 expired", "174,000", "$0.52"]);
    await userEvent.click(within(first).getByRole("button"));
    expect(hash().get("session")).toBe("f2");
  });
});

describe("filters", () => {
  it("offers the automated toggle and keeps the hash's view in the request", async () => {
    const f = await show(fixture, "?project=foo&range=7&source=codex&auto=1");
    expect(f.mock.calls[0]![0]).toBe("/api/context?project=foo&range=7&automated=1&source=codex");
    expect(screen.getByRole("checkbox", { name: /Include automated/ })).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: /Include automated/ }) as HTMLInputElement).checked).toBe(true);
  });

  it("is a route of the app", async () => {
    serve(fixture);
    history.replaceState(null, "", "/context?range=0");
    renderRouter();
    expect(await screen.findByRole("heading", { level: 1, name: /A typical session starts with/ })).toBeTruthy();
    expect(document.title).toBe("Context · AI Ledger");
  });
});
