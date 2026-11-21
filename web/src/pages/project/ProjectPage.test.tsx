import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ContextOverhead, ContextPayload, ErrorsPayload, InsightsPayload, LimitsPayload, LivePayload, UsagePayload } from "../../api";
import context from "../../__fixtures__/context";
import errors from "../../__fixtures__/errors";
import insights from "../../__fixtures__/insights";
import empty from "../../__fixtures__/insights-empty";
import limits from "../../__fixtures__/limits";
import live from "../../__fixtures__/live";
import session from "../../__fixtures__/session";
import usage from "../../__fixtures__/usage";
import usageAll from "../../__fixtures__/usage-all";
import { noFacets } from "../../components/facets";
import { ProjectSheet } from "../../components/sheets/ProjectSheet";
import { mockApi } from "../../components/sheets/testing";
import { big, num, usd } from "../../format";
import { refreshed, renderApp, renderPage } from "../../testing";
import { setSearch } from "../../url";
import { ProjectPage } from "./ProjectPage";

/** The fixture with the fields the grid reads (until the fixtures are regenerated): the peak's share of the window, null for none. */
const withGrid = (c: unknown, peakShare: number | null) => { const d = c as ContextPayload;
  return { ...d, starting: { ...d.starting, window: d.starting.window ?? 200000 }, growth: { ...d.growth, peak: { sessions: 11, median: 80000, window_share: peakShare } } } as ContextPayload; };
const foo = (d: UsagePayload): UsagePayload => ({ ...d, project: "foo" });
const base = { usage: foo(usage), errors: errors as ErrorsPayload, context: withGrid(context, null) as ContextPayload, insights: insights as InsightsPayload,
  limits: limits as LimitsPayload, live: { ...live, sessions: live.sessions.slice(0, 2) } as LivePayload };
type Payloads = { [K in keyof typeof base]?: (typeof base)[K] | null };
/** The API with these payloads in place of the fixtures; null answers 404. */
const serve = (over: Payloads = {}) => {
  const p = { ...base, ...over };
  return mockApi({
    "/api/usage": () => p.usage ?? undefined, "/api/errors": () => p.errors ?? undefined, "/api/context": () => p.context ?? undefined,
    "/api/insights": () => p.insights ?? undefined, "/api/limits": () => p.limits ?? undefined, "/api/live": () => p.live ?? undefined,
    "/api/session": () => session,
  });
};
const open = (over: Payloads = {}, search = "?project=foo&range=30") => {
  const f = serve(over);
  history.replaceState(null, "", "/project" + search);
  return { f, ...renderPage(<ProjectPage />) };
};
const loaded = () => screen.findByRole("heading", { level: 1, name: "foo" });
const block = (name: RegExp | string) => screen.getByRole("region", { name });
const facts = (el: HTMLElement) => [...el.querySelectorAll(".facts > div")].map(x => x.textContent);

describe("ProjectPage", () => {
  it("heads the page with the project and asks each payload for it", async () => {
    const { f } = open();
    await loaded();
    expect(document.getElementById("content")).not.toBeNull();
    await screen.findByRole("region", { name: "Plan limits" });
    const urls = f.mock.calls.map(c => c[0] as string);
    for (const u of ["/api/usage?project=foo&range=30", "/api/context?project=foo&range=30", "/api/insights?project=foo&range=30", "/api/limits?project=foo&range=30"]) expect(urls).toContain(u);
    expect(urls).toContain("/api/errors");
    expect(urls.some(u => u.startsWith("/api/live?project=foo"))).toBe(true);
    for (const name of ["Activity", "Cost", "Sessions", "Errors", "Context", "Session judgments", "Plan limits"]) expect(block(name)).toBeTruthy();
  });

  it("links every block to its page with the shared view", async () => {
    open({}, "?project=foo&range=7&source=claude&auto=1");
    await loaded();
    await screen.findByRole("region", { name: "Plan limits" });
    const link = (name: string) => within(block(name)).getByRole("link", { name: /^Open in/ }).getAttribute("href");
    expect(link("Activity")).toBe("/usage?project=foo&range=7&source=claude&auto=1");
    expect(link("Cost")).toBe("/cost?project=foo&range=7&source=claude&auto=1");
    expect(link("Context")).toBe("/context?project=foo&range=7&source=claude&auto=1");
    expect(link("Session judgments")).toBe("/usage?project=foo&range=7&source=claude&auto=1&view=judgments"); // Activity's Judgments view
    expect(within(block("Session judgments")).getByRole("link", { name: "Open in Judgments" })).toBeTruthy();
    expect(link("Plan limits")).toBe("/limits?project=foo&range=7&source=claude&auto=1");
    expect(link("Errors")).toBe("/errors?project=foo&range=7&source=claude");
  });

  it("offers no Judgments link with the source on Codex alone, and says why in its place, as Activity's switch does", async () => {
    open({}, "?project=foo&range=7&source=codex");
    await loaded();
    const judged = within(block("Session judgments"));
    expect(judged.queryByRole("link", { name: /^Open in/ })).toBeNull();
    expect(judged.getByText("Codex writes no facets: /insights judges Claude Code sessions only.")).toBeTruthy();
    expect(within(block("Activity")).getByRole("link", { name: /^Open in/ }).getAttribute("href")).toBe("/usage?project=foo&range=7&source=codex");
  });

  it("offers no Judgments link with the source on Grok alone, says Grok writes no facets, and asks for none", async () => {
    const { f } = open({}, "?project=foo&range=7&source=grok");
    await loaded();
    const judged = within(block("Session judgments"));
    expect(judged.queryByRole("link", { name: /^Open in/ })).toBeNull();
    expect(judged.getByText("Grok writes no facets: /insights judges Claude Code sessions only.")).toBeTruthy();
    expect(f.mock.calls.map(c => c[0] as string).filter(u => u.startsWith("/api/insights"))).toEqual([]);
  });

  it("asks for no judgments with the source on Codex alone, and shows none kept from another source", async () => {
    const { f } = open({}, "?project=foo&range=7");
    await loaded();
    expect(await within(block("Session judgments")).findByText(/analysed/)).toBeTruthy();
    await act(async () => { setSearch({ source: "codex" }); });
    await waitFor(() => expect(within(block("Session judgments")).getByText(noFacets("codex"))).toBeTruthy());
    const judged = block("Session judgments");
    expect(judged.querySelector(".blk-lede")).toBeNull();
    expect(within(judged).queryByText("Loading…")).toBeNull();
    expect(judged.getAttribute("aria-busy")).toBeNull();
    const urls = f.mock.calls.map(c => c[0] as string);
    expect(urls.filter(u => u.startsWith("/api/insights") && u.includes("source=codex"))).toEqual([]);
  });

  it("lists the Context payload's projects in the scope bar when usage has not answered", async () => {
    open({ usage: null, limits: null, insights: null, context: { ...withGrid(context, null), projects: ["foo", "ctxonly"] } });
    await loaded();
    await within(block("Context")).findByText("median starting context, tokens");
    await userEvent.click(document.getElementById("fProject")!);
    expect(screen.getAllByRole("option").map(o => o.textContent)).toContain("ctxonly");
  });

  describe("layout", () => {
    const ids = (col: Element) => [...col.querySelectorAll(":scope > section")].map(s => s.id);

    it("puts Activity, Cost and Context in the left column, and Errors, Plan limits, Sessions and Session judgments in the right", async () => {
      open();
      await loaded();
      await screen.findByRole("region", { name: "Plan limits" });
      const cols = document.querySelectorAll(".pg-project .cols > .col");
      expect(cols).toHaveLength(2);
      expect(ids(cols[0]!)).toEqual(["activity", "cost", "context"]);
      expect(ids(cols[1]!)).toEqual(["errors", "limits", "sessions", "insights"]);
      // The heading and the filters sit above the columns.
      expect(document.querySelector(".pg-project > header")!.contains(screen.getByRole("heading", { level: 1 }))).toBe(true);
    });

    it("has no Project tab to repeat: the page is not in the navigation", async () => {
      open();
      await loaded();
      expect(screen.queryByRole("link", { name: "Project" })).toBeNull();
    });
  });

  describe("activity", () => {
    const labels = (el: Element) => [...el.querySelectorAll(".facts .l")].map(x => x.textContent);

    it("shows eight figures of the project's activity, none of them the project sheet's", async () => {
      const t = usage.totals;
      open();
      await loaded();
      const blk = await screen.findByRole("region", { name: "Activity" });
      await within(blk).findByText("median session");
      expect(labels(blk)).toEqual(["prompts", "commits", "active days", `requests, ${num(t.main_requests)} from the main thread`, "median session",
        "estimated cost per prompt", "turns per prompt", "of prompts interrupted"]);
      const v = [...blk.querySelectorAll(".facts .v")].map(x => x.textContent);
      expect(v.slice(0, 4)).toEqual([num(t.prompts), num(t.commits), num(t.active_days), num(t.requests)]);
      expect(v[5]).toBe(usd(t.cost_per_prompt));
      cleanup();
      renderApp(<ProjectSheet name="foo" d={foo(usage)} retry={() => {}} range={30} source="" pageProject="foo" onSession={() => {}} />);
      const sheet = labels(document.body);
      expect(labels(blk).filter(l => sheet.includes(l))).toEqual([]);
    });

    it("reads a figure the store cannot give as n/a", async () => {
      const none = { ...usage.totals, median_session_seconds: null, cost_per_prompt: null, turns_per_prompt: null, interruption_rate: null };
      open({ usage: foo({ ...usage, totals: none } as UsagePayload) });
      await loaded();
      const blk = await screen.findByRole("region", { name: "Activity" });
      await within(blk).findByText("median session");
      expect([...blk.querySelectorAll(".facts .v")].slice(4).map(x => x.textContent)).toEqual(["n/a", "n/a", "n/a", "n/a"]);
    });

    it("says how many sessions are active and links to Live, and says nothing at none", async () => {
      open();
      await loaded();
      const link = await within(block("Activity")).findByRole("link", { name: "2 sessions active now" });
      expect(link.getAttribute("href")).toBe("/live?project=foo&range=30");
      cleanup();
      open({ live: { ...live, sessions: [] } as LivePayload });
      await loaded();
      await within(block("Activity")).findByText("median session");
      expect(screen.queryByText(/active now/)).toBeNull();
    });

    it("says the sessions active now could not load, with Retry, when Live fails alone", async () => {
      const { f } = open({ live: null });
      await loaded();
      const note = await within(block("Activity")).findByText(/Could not load the sessions active now/);
      expect(within(block("Activity")).getByText("median session")).toBeTruthy();
      expect(within(block("Activity")).queryByRole("alert")).toBeNull();
      const answer = f.getMockImplementation()!;
      let done!: () => void;
      // The retried request waits, then answers with two sessions.
      f.mockImplementation((input: string) => (String(input).startsWith("/api/live")
        ? new Promise<Response>(r => { done = () => r({ ok: true, status: 200, json: () => Promise.resolve(base.live) } as Response); })
        : answer(input)));
      const asked = () => f.mock.calls.filter(c => String(c[0]).startsWith("/api/live")).length, before = asked();
      await userEvent.click(within(note).getByRole("button", { name: "Retry" }));
      await waitFor(() => expect(asked()).toBeGreaterThan(before));
      // While it is under way: a plain line, no live region, and focus on the line, not lost with the button.
      const line = within(block("Activity")).getByText("Checking for active sessions…");
      expect(line.closest("[aria-live], [role=status]")).toBeNull();
      expect(document.activeElement).toBe(line);
      act(() => done());
      const link = await within(block("Activity")).findByRole("link", { name: "2 sessions active now" });
      expect(document.activeElement).toBe(link.parentElement);
    });

    it("says it is checking for active sessions while Live has not answered, not that there are none", async () => {
      const f = serve(), answer = f.getMockImplementation()!;
      f.mockImplementation((input: string) => (String(input).startsWith("/api/live") ? new Promise<Response>(() => {}) : answer(input)));
      history.replaceState(null, "", "/project?project=foo&range=30");
      renderApp(<ProjectPage />);
      await within(block("Activity")).findByText("median session");
      expect(within(block("Activity")).getByText("Checking for active sessions…")).toBeTruthy();
      expect(block("Activity").getAttribute("aria-busy")).toBe("true");
    });
  });

  describe("cost and sessions", () => {
    it("shows the change against the previous period and the models by estimated cost", async () => {
      open();
      await loaded();
      const cost = await within(await screen.findByRole("region", { name: "Cost" })).findByText(/Change vs the previous 30 days/);
      expect(cost).toBeTruthy();
      expect(within(block("Cost")).getByText("Models by estimated cost")).toBeTruthy();
    });

    it("shows no change for all time, and the estimated cost in its place", async () => {
      open({ usage: foo(usageAll) }, "?project=foo&range=0");
      await loaded();
      await within(block("Cost")).findByText("Models by estimated cost");
      expect(within(block("Cost")).queryByText(/Change vs/)).toBeNull();
      expect(within(block("Cost")).getByText("est. cost, all time")).toBeTruthy();
    });

    it("sets each token kind's share of tokens beside its share of cost", async () => {
      open();
      await loaded();
      const list = await within(block("Cost")).findByRole("list", { name: "Share of tokens beside share of estimated cost, by kind" });
      const rows = [...list.querySelectorAll(".sr")].map(r => r.textContent);
      expect(rows).toHaveLength(4);
      expect(rows).toContain("Cache read: 66.7% of tokens, 5.1% of estimated cost");
    });

    it("opens a session's sheet from the list", async () => {
      open();
      await loaded();
      const table = await within(block("Sessions")).findByRole("table", { name: "Most expensive sessions" });
      await userEvent.click(table.querySelector<HTMLElement>("tbody .cellbtn")!);
      await waitFor(() => expect(location.search).toContain("session=s1"));
      expect(await screen.findByRole("dialog")).toBeTruthy();
    });
  });

  describe("errors", () => {
    it("lists the top types with a link to Errors on each", async () => {
      open({}, "?project=foo&range=0");
      await loaded();
      const table = await within(block("Errors")).findByRole("table", { name: "Top error types" });
      const rows = within(table).getAllByRole("row").slice(1);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.length).toBeLessThanOrEqual(5);
      const a = within(rows[0]!).getByRole("link");
      expect(a.getAttribute("href")).toMatch(/^\/errors\?project=foo&range=0&cat=/);
    });

    it("explains a type's change in a toggletip, as Errors does, with no hover title", async () => {
      open({}, "?project=foo&range=0");
      await loaded();
      const table = await within(block("Errors")).findByRole("table", { name: "Top error types" });
      const cells = [...table.querySelectorAll("tbody td:last-child")];
      expect(cells.length).toBeGreaterThan(0);
      for (const c of cells) expect(c.getAttribute("title")).toBeNull();
      const tips = within(table).queryAllByRole("button", { name: /^Change: / });
      // Every change with an explanation is a toggletip; one without one is plain text.
      expect(tips.length).toBe(cells.filter(c => c.querySelector(".tt")).length);
      expect(tips.length).toBeGreaterThan(0);
      await userEvent.click(tips[0]!);
      expect((await screen.findByRole("tooltip")).textContent).toBeTruthy();
    });

    it("says it counts automated sessions when the page leaves them out", async () => {
      open({}, "?project=foo&range=0");
      await loaded();
      expect(await within(block("Errors")).findByText(/counts automated sessions too/)).toBeTruthy();
      cleanup();
      open({}, "?project=foo&range=0&auto=1");
      await loaded();
      await within(block("Errors")).findByRole("table", { name: "Top error types" });
      expect(within(block("Errors")).queryByText(/counts automated sessions too/)).toBeNull();
    });

    it("says there are no errors for a project without any", async () => {
      open({}, "?project=nosuch&range=0");
      await screen.findByRole("heading", { level: 1, name: "nosuch" });
      expect(await within(block("Errors")).findByText("No errors in this view.")).toBeTruthy();
      expect(within(block("Errors")).queryByRole("table")).toBeNull();
    });
  });

  describe("context", () => {
    it("shows the starting context and its share of the window, and reads a missing figure as n/a", async () => {
      open();
      await loaded();
      const c = await within(block("Context")).findByText("median starting context, tokens");
      expect(c.previousElementSibling!.textContent).toBe(big(context.starting.median));
      cleanup();
      const none = withGrid({ ...context, starting: { ...context.starting, median: null, window_share: null }, growth: { ...context.growth, added_per_prompt: null, to_compaction: { ...context.growth.to_compaction, turns: null } } }, null);
      open({ context: none });
      await loaded();
      await within(block("Context")).findByText("median starting context, tokens");
      expect(facts(block("Context")).slice(0, 4).map(t => t!.startsWith("n/a"))).toEqual([true, true, true, true]);
    });

    const typical = (peakShare: number | null) => withGrid({ ...context, starting: { ...context.starting, sessions: 9, median: 24000, window: 200000, window_share: .12 } }, peakShare);

    it("draws the grid of a typical session above the facts, with a legend in text", async () => {
      open({ context: typical(.4) });
      await loaded();
      const blk = block("Context");
      await within(blk).findByRole("img", { name: /12% starting context, 28% added by the peak, 60% free/ });
      expect(blk.querySelectorAll(".cg-cells .cg-cell").length).toBe(200);
      expect(blk.querySelectorAll(".cg-cells .cg-start").length).toBe(24);
      expect(blk.querySelectorAll(".cg-cells .cg-added").length).toBe(56);
      expect(blk.querySelectorAll(".cg-cells .cg-free").length).toBe(120);
      expect(within(blk).getByText("Typical session · 200k window")).toBeTruthy();
      expect(within(blk).getByText("median of 11 sessions")).toBeTruthy();
      const items = [...blk.querySelectorAll(".cg-legend li")].map(li => li.textContent);
      expect(items[0]).toContain(`Starting context${big(24000)} tokens (12%)`);
      expect(items[0]).toContain("System prompt, tools, memory and first prompt together");
      expect(items[1]).toContain(`Added by the peak${big(56000)} tokens (28%)`);
      expect(items[2]).toContain(`Free space${big(120000)} tokens (60%)`);
    });

    it("shows no grid when the peak's share of the window is not known", async () => {
      open({ context: typical(null) });
      await loaded();
      await within(block("Context")).findByText("median starting context, tokens");
      expect(block("Context").querySelector(".ctx-grid")).toBeNull();
    });

    // A start of 40,000 tokens at 20% of a 200k window: 40 starting cells, split 4 / 12 / 4 / 20.
    const snapshot: ContextOverhead = {
      ts: "2026-11-10T09:30:00Z", session_id: "m1", model: "claude-opus-4-1", version: "2.1.0", window: 200000,
      categories: [{ name: "System prompt", tokens: 4000, state: "used" }, { name: "System tools", tokens: 12000, state: "used" },
        { name: "Skills", tokens: 4000, state: "used" }, { name: "Messages", tokens: 900, state: "used" }, { name: "MCP tools", tokens: 7000, state: "deferred" },
        { name: "Free space", tokens: 150000, state: "free" }],
      top: { mcp_servers: [{ name: "github", tokens: 5200 }], memory_files: [{ name: "/Users/me/foo/CLAUDE.md", tokens: 1800 }], skills: [] },
    };
    const measured = (overhead: ContextOverhead | null, median = 40000) =>
      ({ ...withGrid({ ...context, starting: { ...context.starting, sessions: 9, median, window: 200000, window_share: median / 200000 } }, .4), overhead }) as ContextPayload;

    it("splits the starting cells by the snapshot, with its date, model, deferred tools and largest items", async () => {
      open({ context: measured(snapshot) });
      await loaded();
      const blk = block("Context");
      await within(blk).findByRole("img", { name: /20% starting context \(System prompt 2\.0%, System tools 6\.0%, Skills 2\.0%, First prompt and other 10%\), 20% added by the peak, 60% free/ });
      expect([".cg-p0", ".cg-p1", ".cg-p2", ".cg-rest", ".cg-start"].map(c => blk.querySelectorAll(".cg-cells " + c).length)).toEqual([4, 12, 4, 20, 0]);
      const items = [...blk.querySelectorAll(".cg-legend li")].map(li => li.textContent);
      expect(items.slice(0, 4)).toEqual([`System prompt${big(4000)} tokens (2.0%)`, `System tools${big(12000)} tokens (6.0%)`, `Skills${big(4000)} tokens (2.0%)`,
        `First prompt and other${big(20000)} tokens (10%)`]);
      expect(items[4]).toContain("Added by the peak");
      expect(blk.textContent).not.toContain("transcripts do not split them");
      expect(within(blk).getByText(/^Overhead measured .* with claude-opus-4-1/).textContent).toContain(`${big(7000)} deferred tokens of tools are not loaded`);
      const details = within(blk).getByText("Largest overhead items").closest("details")!;
      expect(within(details).getByText("MCP servers")).toBeTruthy();
      expect(within(details).getByText("github").nextElementSibling!.textContent).toBe(`${big(5200)} tokens`);
      expect(within(details).getByText("CLAUDE.md").getAttribute("title")).toBe("/Users/me/foo/CLAUDE.md");
      expect(within(details).queryByText("Skills")).toBeNull();
    });

    it("says so when the snapshot is larger than the median start", async () => {
      open({ context: measured(snapshot, 16000) });
      await loaded();
      const blk = block("Context");
      await within(blk).findByText(/The measured overhead is larger than the median start/);
      expect(within(blk).queryByText("First prompt and other")).toBeNull();
    });

    /** The API with Measure now: the context payload answers `ctx` (changed by the run), the run answers `run()`. */
    const withMeasure = (run: (init: RequestInit) => Promise<Response>, before: ContextPayload, after: ContextPayload) => {
      let ctx = before;
      const inner = serve({ context: before });
      const f = vi.fn((input: string, init?: RequestInit) => {
        if (input === "/api/context/measure") return run(init!).then(r => { if (r.ok) ctx = after; return r; });
        if (input.startsWith("/api/context?")) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(ctx) } as Response);
        return inner(input);
      });
      vi.stubGlobal("fetch", f);
      history.replaceState(null, "", "/project?project=foo&range=30");
      renderApp(<ProjectPage />);
      return f;
    };
    const answer = (status: number, body: unknown) => ({ ok: status < 400, status, json: () => Promise.resolve(body) }) as Response;

    it("measures the project now, says it is busy, then shows the new snapshot", async () => {
      let done!: (r: Response) => void;
      const f = withMeasure(() => new Promise<Response>(r => { done = r; }), measured(null), measured(snapshot));
      await loaded();
      const blk = block("Context");
      const button = await within(blk).findByRole("button", { name: "Measure now" });
      expect(document.getElementById(button.getAttribute("aria-describedby")!)!.textContent)
        .toBe(`Runs claude -p "/context" in the project's latest folder. Starts its MCP servers and hooks like a new session; calls no model.`);
      expect(blk.textContent).toContain("transcripts do not split them");
      await userEvent.click(button);
      const busy = within(blk).getByRole("button", { name: "Measuring…" });
      expect(busy.getAttribute("aria-disabled")).toBe("true");
      expect(busy.getAttribute("aria-busy")).toBe("true");
      await userEvent.click(busy);
      const posts = f.mock.calls.filter(c => c[0] === "/api/context/measure");
      expect(posts).toHaveLength(1);
      expect(posts[0]![1]).toMatchObject({ method: "POST", body: JSON.stringify({ project: "foo" }) });
      done(answer(200, { session_id: "m1", project: "foo", cwd: "/Users/me/foo", model: "claude-opus-4-1" }));
      await within(blk).findByRole("button", { name: "Measure now" });
      expect(within(blk).getByText(/^Overhead measured/)).toBeTruthy();
      expect(blk.querySelectorAll(".cg-cells .cg-p1").length).toBe(12);
    });

    it("says why a run failed and keeps the figures", async () => {
      withMeasure(() => Promise.resolve(answer(503, { error: "Claude Code was not found on the app's PATH." })), measured(null), measured(snapshot));
      await loaded();
      const blk = block("Context");
      await userEvent.click(await within(blk).findByRole("button", { name: "Measure now" }));
      expect((await within(blk).findByRole("alert")).textContent).toContain("Claude Code was not found on the app's PATH.");
      expect(within(blk).getByText("median starting context, tokens")).toBeTruthy();
      expect(blk.querySelectorAll(".cg-cells .cg-start").length).toBe(40);
      expect(within(blk).getByRole("button", { name: "Measure now" }).getAttribute("aria-disabled")).toBeNull();
    });

    it("offers Measure now from a snapshot when the project has no request in the view", async () => {
      const none = { ...foo(usage), totals: { ...usage.totals, requests: 0, sessions: 0 }, daily_sources: [] } as UsagePayload;
      open({ usage: none, context: measured(snapshot) });
      await loaded();
      await screen.findByText(/No use of foo in this view/);
      const blk = block("Context");
      expect(await within(blk).findByRole("button", { name: "Measure now" })).toBeTruthy();
      expect(within(blk).getByText(/^Overhead measured/)).toBeTruthy();
    });

    it("shows what the snapshot measured when no session in the view gives a share of the window", async () => {
      // No request in the range: the starting and peak shares are null, so there is no grid, but the snapshot is the project's latest.
      const none = { ...foo(usage), totals: { ...usage.totals, requests: 0, sessions: 0 }, daily_sources: [] } as UsagePayload;
      const empty = { ...withGrid({ ...context, starting: { ...context.starting, sessions: 0, median: null, window_share: null } }, null), overhead: snapshot } as ContextPayload;
      open({ usage: none, context: empty });
      await loaded();
      const blk = block("Context");
      await within(blk).findByRole("button", { name: "Measure now" });
      expect(blk.querySelector(".cg-cells")).toBeNull();
      expect(within(blk).getByText("Measured overhead · 200k window")).toBeTruthy();
      expect(within(blk).getByText(/^Overhead measured .* with claude-opus-4-1/).textContent).toContain(`${big(7000)} deferred tokens of tools are not loaded`);
      const items = [...blk.querySelectorAll(".cg-legend li")].map(li => li.textContent);
      expect(items).toEqual([`System prompt${big(4000)} tokens (2.0%)`, `System tools${big(12000)} tokens (6.0%)`, `Skills${big(4000)} tokens (2.0%)`]);
      expect(within(blk).getByText("Largest overhead items")).toBeTruthy();
    });

    it("offers no Measure now without Claude Code sessions or a snapshot", async () => {
      open({ usage: { ...foo(usage), daily_sources: [{ day: "2026-11-04", source: "codex", cost: 1 }] }, context: measured(null) });
      await loaded();
      await within(block("Context")).findByText("median starting context, tokens");
      expect(within(block("Context")).queryByRole("button", { name: "Measure now" })).toBeNull();
    });
  });

  describe("insights", () => {
    it("shows the analysed count, the outcomes and the model-judged tag", async () => {
      open();
      await loaded();
      const b = block("Session judgments");
      expect(await within(b).findByText(/1 of 3/)).toBeTruthy();
      expect(within(b).getByText("model-judged")).toBeTruthy();
      expect(within(b).getByText("Fully achieved")).toBeTruthy();
    });

    it("says nothing is analysed in one line, with no outcomes", async () => {
      open({ insights: empty as InsightsPayload });
      await loaded();
      expect(await within(block("Session judgments")).findByText(/No session is analysed/)).toBeTruthy();
      expect(within(block("Session judgments")).queryByText("Outcomes")).toBeNull();
    });
  });

  describe("limits", () => {
    it("shows the project's share of the open windows that name it", async () => {
      open();
      await loaded();
      const b = await screen.findByRole("region", { name: "Plan limits" });
      expect(await within(b).findByText("Claude Code weekly")).toBeTruthy();
      expect(within(b).getAllByText("100%").length).toBeGreaterThan(0);
    });

    it("is left out when no window names the project and no limit has a figure", async () => {
      open({}, "?project=nosuch&range=30");
      await screen.findByRole("heading", { level: 1, name: "nosuch" });
      await within(block("Activity")).findByText("median session");
      await waitFor(() => expect(screen.queryByRole("region", { name: "Plan limits" })).toBeNull());
    });
  });

  describe("limits while loading", () => {
    it("draws nothing for the block until its request answers", async () => {
      const f = serve();
      const answer = f.getMockImplementation()!;
      f.mockImplementation((input: string) => (String(input).startsWith("/api/limits") ? new Promise<Response>(() => {}) : answer(input)));
      history.replaceState(null, "", "/project?project=foo&range=30");
      renderApp(<ProjectPage />);
      await loaded();
      await within(block("Activity")).findByText("median session");
      expect(f.mock.calls.some(c => String(c[0]).startsWith("/api/limits"))).toBe(true);
      expect(screen.queryByRole("region", { name: "Plan limits" })).toBeNull();
    });

    it("shows the error with Retry when the request fails", async () => {
      open({ limits: null });
      await loaded();
      const b = await screen.findByRole("region", { name: "Plan limits" });
      expect(await within(b).findByRole("button", { name: "Retry" })).toBeTruthy();
    });
  });

  describe("loading each block on its own", () => {
    it("leaves the other blocks drawn when one request fails, and retries just that one", async () => {
      const { f } = open({ insights: null });
      await loaded();
      const b = await screen.findByRole("region", { name: "Session judgments" });
      const alert = await within(b).findByRole("alert");
      expect(alert.textContent).toMatch(/Could not load session judgments/);
      expect(within(alert).getByRole("link", { name: "Troubleshooting, Troubleshooting and FAQ documentation, opens in a new tab" }).getAttribute("href"))
        .toBe("https://nwidart.github.io/ai-ledger/reference/troubleshooting/");
      expect(await within(block("Activity")).findByText("median session")).toBeTruthy();
      expect(within(block("Context")).queryByRole("alert")).toBeNull();
      await within(block("Context")).findByText("median starting context, tokens");
      const asked = () => f.mock.calls.filter(c => String(c[0]).startsWith("/api/insights")).length;
      const before = asked();
      await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));
      await waitFor(() => expect(asked()).toBeGreaterThan(before));
    });

    it("shows a failing usage request in the blocks that read it, and the others still draw", async () => {
      open({ usage: null });
      await loaded();
      await waitFor(() => expect(within(block("Activity")).getByRole("alert")).toBeTruthy());
      expect(within(block("Cost")).getByRole("alert")).toBeTruthy();
      expect(within(block("Sessions")).getByRole("alert")).toBeTruthy();
      expect(await within(block("Session judgments")).findByText(/1 of 3/)).toBeTruthy();
      await within(block("Context")).findByText("median starting context, tokens");
      expect(within(block("Context")).queryByRole("alert")).toBeNull();
      expect(await within(block("Errors")).findByRole("table", { name: "Top error types" })).toBeTruthy();
      expect(await within(block("Plan limits")).findByText("Claude Code weekly")).toBeTruthy();
      expect(screen.queryByText(/No use of foo/)).toBeNull();
    });

    it("fails the Errors block alone when its request fails", async () => {
      open({ errors: null });
      await loaded();
      expect(await within(block("Errors")).findByRole("alert")).toBeTruthy();
      expect(await within(block("Activity")).findByText("median session")).toBeTruthy();
      expect(within(block("Activity")).queryByRole("alert")).toBeNull();
      expect(within(block("Session judgments")).queryByRole("alert")).toBeNull();
    });

    /** The API with one path that never answers. */
    const hang = (path: string) => {
      const f = serve(), answer = f.getMockImplementation()!;
      f.mockImplementation((input: string) => (String(input).startsWith(path) ? new Promise<Response>(() => {}) : answer(input)));
      history.replaceState(null, "", "/project?project=foo&range=30");
      renderApp(<ProjectPage />);
    };

    it("shows the heading and every block at once, with a slow usage request loading in its own blocks only", async () => {
      hang("/api/usage");
      // No placeholder: the heading is there before any request answers. The filters are the shell's scope bar.
      expect(screen.getByRole("heading", { level: 1, name: "foo" })).toBeTruthy();
      expect(document.querySelector("main .filters")).toBeNull();
      expect(within(block("Activity")).getByText("Loading…")).toBeTruthy();
      expect(within(block("Cost")).getByText("Loading…")).toBeTruthy();
      expect(await within(block("Errors")).findByRole("table", { name: "Top error types" })).toBeTruthy();
      expect(await within(block("Session judgments")).findByText(/1 of 3/)).toBeTruthy();
      await within(block("Context")).findByText("median starting context, tokens");
      expect(screen.queryByText(/No use of foo/)).toBeNull();
      // Busy is each block's: the ones that read usage (Context for a line), not the page, and the loading line is no live region.
      const busy = (name: string) => block(name).getAttribute("aria-busy");
      for (const name of ["Activity", "Cost", "Sessions", "Context"]) expect(busy(name)).toBe("true");
      for (const name of ["Errors", "Session judgments"]) expect(busy(name)).toBeNull();
      expect(document.getElementById("content")!.getAttribute("aria-busy")).toBeNull();
      expect(within(block("Activity")).queryByRole("status")).toBeNull();
    });

    it("keeps the figures through a slow range change, dimming the blocks that read usage only", async () => {
      const f = serve(), answer = f.getMockImplementation()!;
      f.mockImplementation((input: string) => (String(input).startsWith("/api/usage?project=foo&range=7") ? new Promise<Response>(() => {}) : answer(input)));
      history.replaceState(null, "", "/project?project=foo&range=30");
      renderApp(<ProjectPage />);
      await within(block("Activity")).findByText("median session");
      await within(block("Context")).findByText("median starting context, tokens");
      await within(block("Session judgments")).findByText(/1 of 3/);
      act(() => { history.pushState(null, "", "/project?project=foo&range=7"); });
      // The earlier figures stay, then dim once the request takes over 150 ms; Context reads usage for a line, so it dims too.
      const dimmed = (name: string) => block(name).classList.contains("loading");
      await waitFor(() => expect(dimmed("Activity")).toBe(true));
      for (const name of ["Activity", "Cost", "Sessions", "Context"]) expect(dimmed(name)).toBe(true);
      expect(within(block("Activity")).getByText("median session")).toBeTruthy();
      expect(within(block("Activity")).queryByText("Loading…")).toBeNull();
      for (const name of ["Errors", "Session judgments"]) expect(dimmed(name)).toBe(false);
    });

    it("drops the figures of the project just left, even while the new one loads", async () => {
      const f = serve(), answer = f.getMockImplementation()!;
      f.mockImplementation((input: string) => (String(input).startsWith("/api/usage?project=bar") ? new Promise<Response>(() => {}) : answer(input)));
      history.replaceState(null, "", "/project?project=foo&range=30");
      renderApp(<ProjectPage />);
      await within(block("Activity")).findByText("median session");
      act(() => { history.pushState(null, "", "/project?project=bar&range=30"); });
      await screen.findByRole("heading", { level: 1, name: "bar" });
      expect(within(block("Activity")).getByText("Loading…")).toBeTruthy();
      expect(within(block("Activity")).queryByText("median session")).toBeNull();
    });

    it("after Refresh, moves only the blocks whose data changed", async () => {
      let n = 0;
      const f = serve(), answer = f.getMockImplementation()!;
      // Each usage answer is new; every other answer is the same object, so its blocks keep their data.
      f.mockImplementation((input: string) => (String(input).startsWith("/api/usage")
        ? Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(foo({ ...usage, totals: { ...usage.totals, prompts: 100 + n++ } })) } as Response)
        : answer(input)));
      history.replaceState(null, "", "/project?project=foo&range=30");
      const { client } = renderApp(<ProjectPage />);
      await within(block("Activity")).findByText(num(100));
      await within(block("Errors")).findByRole("table", { name: "Top error types" });
      await within(block("Session judgments")).findByText(/1 of 3/);
      refreshed(client);
      await within(block("Activity")).findByText(num(101));
      for (const name of ["Activity", "Cost", "Sessions"]) expect(block(name).classList.contains("fade-in")).toBe(true);
      for (const name of ["Errors", "Session judgments"]) expect(block(name).classList.contains("fade-in")).toBe(false);
      expect(document.getElementById("content")!.classList.contains("grow")).toBe(false);
    });

    it("says a slow errors request is loading, and draws the other blocks", async () => {
      hang("/api/errors");
      expect(within(block("Errors")).getByText("Loading…")).toBeTruthy();
      expect(await within(block("Activity")).findByText("median session")).toBeTruthy();
      expect(within(block("Errors")).getByText("Loading…")).toBeTruthy();
    });
  });

  describe("no use in the view", () => {
    const none = { ...foo(usage), totals: { ...usage.totals, requests: 0, sessions: 0 } } as UsagePayload;

    it("says so above the blocks, keeps the heading and the filters, and the usage blocks say they have no request", async () => {
      open({ usage: none });
      await loaded();
      expect(await screen.findByText(/No use of foo in this view/)).toBeTruthy();
      expect(screen.getByRole("group", { name: "Filters" })).toBeTruthy();
      for (const name of ["Activity", "Cost", "Sessions"]) expect(within(block(name)).getByText("No requests in this view.")).toBeTruthy();
      expect(block("Activity").querySelector(".facts")).toBeNull();
    });

    it("still shows a failed Errors request with Retry", async () => {
      const { f } = open({ usage: none, errors: null });
      await loaded();
      await screen.findByText(/No use of foo in this view/);
      const alert = await within(block("Errors")).findByRole("alert");
      expect(alert.textContent).toMatch(/Could not load errors/);
      const asked = () => f.mock.calls.filter(c => c[0] === "/api/errors").length, before = asked();
      await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));
      await waitFor(() => expect(asked()).toBeGreaterThan(before));
    });
  });

  it("hosts the sheets: a session in the URL opens its sheet over the page", async () => {
    open({}, "?project=foo&range=30&session=s1");
    await loaded();
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });
});
