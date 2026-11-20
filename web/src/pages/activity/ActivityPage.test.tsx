import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DayView, Previous, ProjectRow, UsagePayload } from "../../api";
import usage from "../../__fixtures__/usage";
import usageAll from "../../__fixtures__/usage-all";
import usageCodex from "../../__fixtures__/usage-codex";
import sessions from "../../__fixtures__/sessions";
import session from "../../__fixtures__/session";
import tool from "../../__fixtures__/tool";
import palette from "../../__fixtures__/palette";
import { openDrawer } from "../../components/Drawer";
import { Palette } from "../../components/palette/Palette";
import { openPalette } from "../../components/palette/store";
import { mockApi } from "../../components/sheets/testing";
import { ActivityPage } from "./ActivityPage";
import { setSearch } from "../../url";
import { hookCommand, workDays } from "./work";
import { ingested, refreshed, renderApp } from "../../testing";
import { queries } from "../../queries";

const REFRESHED_STATUS = { ingesting: false, last_ingest: null, last_stats: null, error: null, last_change: null, counts: {}, interval: 60, project_order: [] };

const at = (hash = "?range=30") => history.replaceState(null, "", "/usage" + hash);
const serve = (d: UsagePayload) => mockApi({ "/api/usage": () => d, "/api/sessions": () => sessions, "/api/session": () => session });
const attention = () => within(document.getElementById("attention")!);
const loaded = () => screen.findByRole("heading", { level: 1, name: /commit/ });
const fetched = () => vi.mocked(fetch).mock.calls.map(c => c[0]);
const noDay = (day: string): DayView => ({ day, tools: [], mcp: [], skills: [], hooks: [], error_loops: [], error_loops_total: 0 });
/** Whether a drawer is open: its title button says so. */
const isOpen = (id: string) => document.getElementById(id)!.hasAttribute("data-open");
const openSessions = () => act(() => { openDrawer("d-sessions"); });
/** A promise settled from outside, for a request held in flight. */
const held = <T,>() => { let resolve!: (v: T) => void; const p = new Promise<T>(r => { resolve = r; }); return { p, resolve }; };
const paged = (all: { session_id: string }[]) => (q: URLSearchParams) => {
  const from = Number(q.get("offset") ?? 0), to = from + Number(q.get("limit") ?? 100);
  return { total: all.length, offset: from, sessions: all.slice(from, to) };
};
const many = (n: number, name = "Session") => Array.from({ length: n }, (_, k) => ({ ...sessions.sessions[0]!, session_id: `${name}${k}`, title: `${name} ${k}` }));
const quiet: UsagePayload = { ...usage, totals: { ...usage.totals, error_loops: 0, tests_failed: 0 }, error_loops: [], near_limit: [] };

describe("work per day", () => {
  it("covers the view from its first day with a session, with zeros for idle days", () => {
    const ds = workDays(usage);
    expect(ds.map(r => r.day)).toEqual(["2026-11-04", "2026-11-05"]);
    expect(ds[0]).toEqual({ day: "2026-11-04", sessions: 1, prompts: 2, commits: 1, calls: 10, failed_calls: 6 });
    expect(ds.reduce((a, r) => a + r.commits, 0)).toBe(usage.totals.commits);
    const gap = workDays({ ...usage, daily_work: [{ day: "2026-11-01", sessions: 1, prompts: 1, commits: 0, calls: 0, failed_calls: 0 }, ...usage.daily_work] });
    expect(gap.map(r => r.sessions)).toEqual([1, 0, 0, 1, 1]);
    // A prompt whose session made no request does not start the axis; a view with no session keeps its whole range.
    const orphan = { day: "2026-09-01", sessions: 0, prompts: 1, commits: 0, calls: 0, failed_calls: 0 };
    expect(workDays({ ...usageAll, daily_work: [orphan, ...usageAll.daily_work] })[0]!.day).toBe(usageAll.daily_work.find(r => r.sessions)!.day);
    expect(workDays({ ...usage, daily_work: [] })).toHaveLength(30);
  });
});

/** The page with the previous period's figures replaced; the current ones are the fixture's. */
const prior = (p: Partial<Previous> | null): UsagePayload => ({ ...usage, previous: p && { ...usage.previous, ...p } });
const vital = (label: string) => within(document.getElementById("vitals")!).getByText(label);
const worse = (el: HTMLElement) => !!el.querySelector(".bad");
const change = /(up|down) from|unchanged|NaN|Infinity/;

describe("change against the previous period", () => {
  // Now: 60 errors per 100 calls, 1 of 2 test runs passed (50%), 1 of 3 prompts interrupted (33.3%), 8.3% of tokens from
  // subagents, median session 4.5 minutes.
  const before = { calls: 100, errors: 4, test_runs: 4, tests_passed: 3, prompts: 4, interrupted: 0, tokens: 100_000_000, sub_tokens: 20_000_000, median_session_seconds: 600 };

  it("shows each tile's figure the previous period, and marks errors up, pass rate down and interruptions up as worse", async () => {
    serve(prior(before));
    at();
    renderApp(<ActivityPage />);
    await loaded();
    expect(vital("Errors per 100 calls").textContent).toBe("Errors per 100 calls, up from 4.0");
    expect(vital("Test runs passed").textContent).toBe("Test runs passed, down from 75%");
    expect(vital("Prompts interrupted").textContent).toBe("Prompts interrupted, up from 0.0%");
    expect(vital("Subagents").textContent).toBe("Subagents, down from 20%");
    expect(vital("Median session").textContent).toBe("Median session, down from 10m");
    expect([vital("Errors per 100 calls"), vital("Test runs passed"), vital("Prompts interrupted")].map(worse)).toEqual([true, true, true]);
    expect([vital("Subagents"), vital("Median session")].map(worse)).toEqual([false, false]);
  });

  it("does not mark a move the better way", async () => {
    // Errors down from 80, pass rate up from 25%, interruptions down from 50%; subagent share and session length up.
    serve(prior({ calls: 100, errors: 80, test_runs: 4, tests_passed: 1, prompts: 2, interrupted: 1, tokens: 100_000_000, sub_tokens: 1_000_000, median_session_seconds: 60 }));
    at();
    renderApp(<ActivityPage />);
    await loaded();
    expect(vital("Errors per 100 calls").textContent).toBe("Errors per 100 calls, down from 80.0");
    expect(vital("Test runs passed").textContent).toBe("Test runs passed, up from 25%");
    expect(vital("Prompts interrupted").textContent).toBe("Prompts interrupted, down from 50.0%");
    expect(vital("Subagents").textContent).toBe("Subagents, up from 1%");
    expect(vital("Median session").textContent).toBe("Median session, up from 1m");
    for (const l of ["Errors per 100 calls", "Test runs passed", "Prompts interrupted", "Subagents", "Median session"]) expect(worse(vital(l))).toBe(false);
  });

  it("says unchanged for a figure that did not move", async () => {
    serve(prior({ calls: 10, errors: 6, test_runs: 2, tests_passed: 1, prompts: 3, interrupted: 1 }));
    at();
    renderApp(<ActivityPage />);
    await loaded();
    expect(vital("Errors per 100 calls").textContent).toBe("Errors per 100 calls, unchanged");
    expect(vital("Test runs passed").textContent).toBe("Test runs passed, unchanged");
    expect(vital("Prompts interrupted").textContent).toBe("Prompts interrupted, unchanged");
  });

  it("shows the headline's commits, sessions and active days against the period before", async () => {
    serve(prior({ commits: 4, sessions: 1, active_days: 3 }));
    at();
    renderApp(<ActivityPage />);
    expect((await loaded()).textContent).toBe("1 commit from 3 prompts, down from 4 commits");
    const [v, note] = [vital("Sessions").closest(".vital")!.querySelector(".v")!, vital("Sessions").closest(".vital")!.querySelector(".d")!];
    expect(v.textContent).toBe("2");
    expect(vital("Sessions").textContent).toBe("Sessions, up from 1 session");
    expect(worse(vital("Sessions"))).toBe(false);
    expect(note.textContent).toBe("2 active days, down from 3 active days.");
  });

  it("shows no change in the All range", async () => {
    serve(usageAll);
    at("?range=0");
    renderApp(<ActivityPage />);
    await loaded();
    expect(document.querySelector("#lede")!.textContent).not.toMatch(change);
    expect(document.getElementById("vitals")!.textContent).not.toMatch(change);
  });

  it("shows no change for a figure whose previous period has nothing to divide by", async () => {
    serve(prior({ calls: 0, errors: 0, test_runs: 0, tests_passed: 0, prompts: 0, interrupted: 0, tokens: 0, sub_tokens: 0, median_session_seconds: null }));
    at();
    renderApp(<ActivityPage />);
    await loaded();
    // Sessions, the first tile, is a count, not a ratio: it compares with the period before whatever that held.
    const ratios = [...document.querySelectorAll("#vitals .vital")].slice(1);
    expect(ratios.map(t => t.textContent).join(" ")).not.toMatch(change);
  });
});

describe("model time and output speed", () => {
  /** A vital's figure and note. */
  const tile = (label: string) => { const el = vital(label).closest(".vital")!; return [el.querySelector(".v")!.textContent, el.querySelector(".d")!.textContent]; };

  it("adds the model and tool time to the session note and shows output speed against the period before, a fall as worse", async () => {
    // One timed session: 10,000 s of model time, 3,000 s of tool time, 1M output tokens (100 tok/s).
    serve(prior({ output_per_s: 150 }));
    at();
    renderApp(<ActivityPage />);
    await loaded();
    expect(tile("Median session")[1]).toMatch(/ in all; 2\.8h waiting on the model and 50m running tools\.$/);
    expect(tile("Output speed")).toEqual(["100 tok/s", "Output tokens per second of model time, in 1 session."]);
    expect(vital("Output speed").textContent).toBe("Output speed, down from 150 tok/s");
    expect(worse(vital("Output speed"))).toBe(true);
  });

  it("does not mark a rise as worse", async () => {
    serve(prior({ output_per_s: 50 }));
    at();
    renderApp(<ActivityPage />);
    await loaded();
    expect(vital("Output speed").textContent).toBe("Output speed, up from 50 tok/s");
    expect(worse(vital("Output speed"))).toBe(false);
  });

  it("does not compare with a period that recorded no model time", async () => {
    expect(usage.previous!.output_per_s).toBeNull();
    serve(usage);
    at();
    renderApp(<ActivityPage />);
    await loaded();
    expect(vital("Output speed").textContent).toBe("Output speed");
  });

  it("reads not available, with the reason, and names no model or tool time when no session records model time", async () => {
    serve(usageCodex);
    at("?range=30&source=codex");
    renderApp(<ActivityPage />);
    await loaded();
    expect(tile("Output speed")).toEqual(["n/a", "Codex transcripts record no model time."]);
    expect(tile("Median session")[1]).toMatch(/ in all\.$/);
    expect(document.getElementById("vitals")!.textContent).not.toMatch(/waiting on the model|running tools/);
  });

  it("says no session records model time when Claude Code sessions in the view have none", async () => {
    serve({ ...usage, totals: { ...usage.totals, output_per_s: null, timed_sessions: 0 } });
    at();
    renderApp(<ActivityPage />);
    await loaded();
    expect(tile("Output speed")).toEqual(["n/a", "No session in this view records model time."]);
  });

  // The reason follows the view's sessions, not its priced requests: an unpriced Claude Code model adds no cost row by source.
  it("does not blame Codex on All sources when the Claude Code sessions are unpriced", async () => {
    serve({ ...usage, totals: { ...usage.totals, output_per_s: null, timed_sessions: 0, session_sources: ["claude", "codex"] },
      daily_sources: [{ day: "2026-11-04", source: "codex", cost: 1 }] });
    at();
    renderApp(<ActivityPage />);
    await loaded();
    expect(tile("Output speed")).toEqual(["n/a", "No session in this view records model time."]);
  });

  it("names Codex on All sources when every session in the view is a Codex one", async () => {
    serve({ ...usage, totals: { ...usage.totals, output_per_s: null, timed_sessions: 0, session_sources: ["codex"] }, daily_sources: [] });
    at();
    renderApp(<ActivityPage />);
    await loaded();
    expect(tile("Output speed")).toEqual(["n/a", "Codex transcripts record no model time."]);
  });
});

describe("drawer tables", () => {
  it("renders none while closed, and names every table with row and column headers once open", async () => {
    serve(usage);
    at();
    renderApp(<ActivityPage />);
    await loaded();
    expect(screen.getByRole("heading", { level: 2, name: /^Tools/ })).toBeTruthy();
    expect(screen.queryByRole("table", { name: "Tools" })).toBeNull();
    // One drawer opens at a time: each table is read while its drawer is the open one.
    const tables: [string, string][] = [["Project metrics", "d-projects"], ["Tools", "d-tools"], ["Error loops", "d-loops"], ["Failed test runs", "d-tests"],
      ["Sessions", "d-sessions"], ["MCP servers", "d-ext"], ["Skills", "d-ext"], ["Hooks", "d-ext"]];
    for (const [name, id] of tables) {
      act(() => openDrawer(id));
      const table = await screen.findByRole("table", { name });
      expect(screen.getByRole("region", { name }).tabIndex).toBe(0);
      expect(within(table).getAllByRole("columnheader").every(h => h.getAttribute("scope") === "col")).toBe(true);
    }
    act(() => openDrawer("d-tools"));
    expect(within(screen.getByRole("table", { name: "Tools" })).getAllByRole("rowheader")[0]!.getAttribute("scope")).toBe("row");
    act(() => openDrawer("d-projects"));
    expect(within(screen.getByRole("table", { name: "Project metrics" })).getAllByRole("rowheader").map(h => h.textContent)).toContain("foo");
  });

  it("explains the Sessions columns behind toggletips beside their sort buttons", async () => {
    serve(usage);
    at();
    renderApp(<ActivityPage />);
    await loaded();
    openSessions();
    const head = within(await screen.findByRole("table", { name: "Sessions" })).getByRole("columnheader", { name: /^Tests/ });
    expect(head.hasAttribute("title")).toBe(false);
    await userEvent.click(within(head).getByRole("button", { name: "About Tests" }));
    expect(within(head).getByRole("tooltip").textContent).toBe("Test and build runs: passed of run");
  });
});

describe("automated projects file", () => {
  // The warning and the path come from the status poll, not from the page (App.test.tsx covers the warning on every page).
  it("names the file on the automated toggle, from the status the nav polls", async () => {
    serve(usage);
    at();
    const { client } = renderApp(<ActivityPage />);
    await loaded();
    act(() => { client.setQueryData(queries.status.queryKey, { ...REFRESHED_STATUS, automated_file: usage.automated_file }); });
    const tip = screen.getByRole("button", { name: "About automated sessions" });
    await userEvent.click(tip);
    expect(tip.getAttribute("aria-expanded")).toBe("true");
    expect(within(screen.getByRole("group", { name: "Filters" })).getByRole("tooltip").textContent).toContain(usage.automated_file.path);
  });
});

describe("work panel", () => {
  it("keeps the hours heatmap in a closed drawer, listed in the section index", async () => {
    serve(usage);
    at();
    renderApp(<ActivityPage />);
    await loaded();
    expect(document.getElementById("hours")).toBeNull();
    await userEvent.click(within(screen.getByRole("navigation", { name: /sections/i })).getByRole("link", { name: "Hours" }));
    expect(screen.getByRole("button", { name: "Prompts by hour" }).getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById("hours")).toBeTruthy();
  });

  it("puts the work chart before the vitals", async () => {
    serve(usage);
    at();
    renderApp(<ActivityPage />);
    await loaded();
    const order = ["attention", "work", "vitals"].map(id => document.getElementById(id)!);
    expect(order[0]!.compareDocumentPosition(order[1]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(order[1]!.compareDocumentPosition(order[2]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("hook names", () => {
  it("keep the end of each path and drop quotes and a closing || true", () => {
    expect(hookCommand('node "/home/u/.claude/hooks/format-on-save.cjs" post-edit || true')).toBe("node format-on-save.cjs post-edit");
    expect(hookCommand("'/home/u/.local/bin/runner' hook run --script '/opt/lib/node_modules/x/dist/stop-hook.js'"))
      .toBe("runner hook run --script stop-hook.js");
    expect(hookCommand("notify-done")).toBe("notify-done");
  });
});

describe("ActivityPage", () => {
  it("leads with the work done and no cost figure before the attention summary", async () => {
    serve(usage);
    at();
    renderApp(<ActivityPage />);
    const lede = await loaded();
    expect(lede.textContent).toBe("1 commit from 3 prompts, up from 0 commits");
    const before = document.querySelector(".top")!.textContent! + document.getElementById("attention")!.textContent!;
    expect(before).not.toMatch(/\$|cost/i);
  });

  it("narrows to Codex when picked and records it in the URL", async () => {
    const codex: UsagePayload = { ...usage, source: "codex", totals: { ...usage.totals, commits: 0, prompts: 1, sessions: 1, active_days: 1 } };
    mockApi({ "/api/usage": q => (q.get("source") === "codex" ? codex : usage), "/api/sessions": () => sessions, "/api/session": () => session });
    at();
    renderApp(<ActivityPage />);
    await loaded();
    await userEvent.click(within(screen.getByRole("group", { name: "Source" })).getByRole("button", { name: "Codex" }));
    expect(location.search).toBe("?range=30&source=codex");
    expect((await screen.findByRole("heading", { level: 1, name: /^0 commits/ })).textContent).toBe("0 commits from 1 prompt, unchanged");
    expect(fetched()).toContain("/api/usage?range=30&source=codex");
  });

  it("says the Sessions drawer counts a session by a request in the range", async () => {
    serve(usage);
    at();
    renderApp(<ActivityPage />);
    await loaded();
    openSessions();
    const drawer = document.getElementById("d-sessions")!;
    const how = within(drawer).getByRole("button", { name: "How measured: the session count" });
    await userEvent.click(how);
    expect(within(how.parentElement!).getByRole("tooltip").textContent).toMatch(/A session counts here when it has a request in the range.*Insights counts sessions by their start time/);
  });

  it("reloads an open sessions table when the source changes", async () => {
    mockApi({ "/api/usage": q => (q.get("source") === "codex" ? { ...usage, source: "codex" } : usage), "/api/sessions": () => sessions, "/api/session": () => session });
    at();
    renderApp(<ActivityPage />);
    await loaded();
    act(() => { openDrawer("d-sessions"); });
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30"));
    await userEvent.click(within(screen.getByRole("group", { name: "Source" })).getByRole("button", { name: "Codex" }));
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&source=codex"));
  });

  it("reloads an open sessions table when new data arrives", async () => {
    let n = 0;
    mockApi({ "/api/usage": () => ({ ...usage, totals: { ...usage.totals, sessions: 2 + n++ } }), "/api/sessions": () => sessions });
    at();
    const { client } = renderApp(<ActivityPage />);
    await loaded();
    act(() => { openDrawer("d-sessions"); });
    await waitFor(() => expect(fetched().filter(u => u === "/api/sessions?range=30")).toHaveLength(1));
    ingested(client);
    // The first page again: the loaded pages are refetched, not one request sized to the rows.
    await waitFor(() => expect(fetched().filter(u => u === "/api/sessions?range=30")).toHaveLength(2));
  });

  it("pages the sessions table: Show more appends the next page and focuses its first new row", async () => {
    mockApi({ "/api/usage": () => usage, "/api/sessions": paged(many(250)) });
    at();
    renderApp(<ActivityPage />);
    await loaded();
    openSessions();
    const drawer = within(document.getElementById("d-sessions")!);
    await drawer.findByRole("button", { name: "Session 99" });
    expect(document.querySelectorAll("#d-sessions tbody tr")).toHaveLength(100);
    expect(document.querySelector("#d-sessions .hint [aria-live]")!.textContent).toContain("Showing 100.");
    await userEvent.click(drawer.getByRole("button", { name: "Show more sessions" }));
    await waitFor(() => expect(document.activeElement).toBe(drawer.getByRole("button", { name: "Session 100" })));
    expect(document.querySelectorAll("#d-sessions tbody tr")).toHaveLength(200);
    expect(fetched().filter(u => String(u).startsWith("/api/sessions"))).toEqual(["/api/sessions?range=30", "/api/sessions?range=30&offset=100"]);
  });

  it("waits 200 ms after typing to search, keeps the rows inert meanwhile, then replaces them", async () => {
    const found = held<unknown>();
    mockApi({ "/api/usage": () => usage, "/api/sessions": q => (q.get("q") ? found.p : { total: 100, offset: 0, sessions: many(100) }) });
    at();
    renderApp(<ActivityPage />);
    await loaded();
    openSessions();
    const drawer = within(document.getElementById("d-sessions")!), tbody = () => document.querySelector("#d-sessions tbody")!;
    await drawer.findByRole("button", { name: "Session 0" });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      fireEvent.change(drawer.getByRole("searchbox", { name: "Search sessions" }), { target: { value: "needle" } });
      await act(async () => { await vi.advanceTimersByTimeAsync(150); });
      expect(fetched().some(u => String(u).startsWith("/api/sessions") && String(u).includes("q=needle"))).toBe(false);
      await act(async () => { await vi.advanceTimersByTimeAsync(100); });
      await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&q=needle"));
      await waitFor(() => expect(document.querySelector("#d-sessions .hint [aria-live]")!.textContent).toBe("Searching for “needle”…"));
      expect(tbody().hasAttribute("inert")).toBe(true);
      expect(drawer.getByRole("button", { name: "Session 0" })).toBeTruthy();
      await act(async () => { found.resolve({ total: 1, offset: 0, sessions: many(1, "Hit") }); await found.p; });
      await waitFor(() => expect(drawer.getByRole("button", { name: "Hit 0" })).toBeTruthy());
    } finally { vi.useRealTimers(); }
    expect(drawer.queryByRole("button", { name: "Session 0" })).toBeNull();
    expect(tbody().hasAttribute("inert")).toBe(false);
    expect(document.querySelector("#d-sessions .hint [aria-live]")!.textContent).toMatch(/^1 session match/);
  });

  it("says a search failed, with Retry, and shows no rows of the earlier query", async () => {
    let down = true;
    mockApi({ "/api/usage": () => usage, "/api/sessions": q => (q.get("q") && down ? undefined : { total: 100, offset: 0, sessions: many(100) }) });
    at("?range=30&q=needle");
    renderApp(<ActivityPage />);
    await loaded();
    openSessions();
    const drawer = within(document.getElementById("d-sessions")!);
    expect(await drawer.findByRole("alert")).toBeTruthy();
    expect(drawer.getByRole("alert").textContent).toMatch(/^Could not load sessions \(.+\)\. Retry$/);
    expect(document.querySelector("#d-sessions .hint [aria-live]")!.textContent).toBe("Search for “needle” failed.");
    expect(drawer.queryByRole("button", { name: "Session 0" })).toBeNull();
    down = false;
    await userEvent.click(drawer.getByRole("button", { name: "Retry" }));
    expect(await drawer.findByRole("button", { name: "Session 0" })).toBeTruthy();
    expect(drawer.queryByRole("alert")).toBeNull();
  });

  it("keeps the rows and says so when Show more fails, and appends on the next try", async () => {
    let down = true;
    const page = paged(many(250));
    mockApi({ "/api/usage": () => usage, "/api/sessions": q => (q.get("offset") && down ? undefined : page(q)) });
    at();
    renderApp(<ActivityPage />);
    await loaded();
    openSessions();
    const drawer = within(document.getElementById("d-sessions")!);
    await drawer.findByRole("button", { name: "Session 99" });
    await userEvent.click(drawer.getByRole("button", { name: "Show more sessions" }));
    await waitFor(() => expect(document.querySelector("#d-sessions .hint [aria-live]")!.textContent).toMatch(/^Could not load more sessions \(.+\)\. Select Show more to try again\.$/));
    expect(document.querySelectorAll("#d-sessions tbody tr")).toHaveLength(100);
    down = false;
    await userEvent.click(drawer.getByRole("button", { name: "Show more sessions" }));
    await waitFor(() => expect(document.querySelectorAll("#d-sessions tbody tr")).toHaveLength(200));
    expect(document.querySelector("#d-sessions .hint [aria-live]")!.textContent).toContain("Showing 200.");
  });

  it("swaps in new data from a background ingest quietly, and replays the landing only after Refresh", async () => {
    let n = 0;
    mockApi({ "/api/usage": () => ({ ...usage, totals: { ...usage.totals, sessions: 2 + n++ } }), "/api/sessions": () => sessions });
    at();
    const { container, client } = renderApp(<ActivityPage />);
    await waitFor(() => expect(document.querySelector("#vitals .vital .v")?.textContent).toBe("2")); // the Sessions vital
    const page = container.querySelector(".pg-activity")!, fades = () => page.querySelectorAll(".fade-in").length;
    await waitFor(() => expect(page.classList.contains("grow")).toBe(false), { timeout: 2000 });
    ingested(client);
    await waitFor(() => expect(document.querySelector("#vitals .vital .v")?.textContent).toBe("3")); // the Sessions vital
    expect(page.classList.contains("grow")).toBe(false);
    expect(fades()).toBe(0);
    refreshed(client);
    await waitFor(() => expect(document.querySelector("#vitals .vital .v")?.textContent).toBe("4")); // the Sessions vital
    expect(page.classList.contains("grow")).toBe(true);
    expect(fades()).toBeGreaterThan(0);
  });

  it("keeps an open, paged sessions table and its focus when new data arrives", async () => {
    let n = 0;
    const all = Array.from({ length: 250 }, (_, k) => ({ ...sessions.sessions[0], session_id: `x${k}`, title: `Session ${k}` }));
    const page = (q: URLSearchParams) => {
      const from = Number(q.get("offset") ?? 0), to = from + Number(q.get("limit") ?? 100);
      return { total: all.length, offset: from, sessions: all.slice(from, to) };
    };
    mockApi({ "/api/usage": () => ({ ...usage, totals: { ...usage.totals, sessions: 2 + n++ } }), "/api/sessions": page });
    at();
    const { client } = renderApp(<ActivityPage />);
    await loaded();
    act(() => { openDrawer("d-sessions"); });
    await screen.findByRole("button", { name: "Session 99" });
    await userEvent.click(screen.getByRole("button", { name: "Show more sessions" }));
    const row = await screen.findByRole("button", { name: "Session 150" });
    act(() => row.focus());
    const before = fetched().length;
    ingested(client);
    // One request per loaded page, first page first.
    await waitFor(() => expect(fetched().slice(before).filter(u => String(u).startsWith("/api/sessions"))).toEqual(["/api/sessions?range=30", "/api/sessions?range=30&offset=100"]));
    await waitFor(() => expect(document.querySelector("#d-sessions tbody")!.getAttribute("aria-busy")).toBeNull());
    expect(document.querySelectorAll("#d-sessions tbody tr")).toHaveLength(200);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Session 150" }));
    expect(document.querySelector("#d-sessions tbody")!.hasAttribute("inert")).toBe(false);
  });

  it("names no agent when nothing happened in the range with every source", async () => {
    const none: UsagePayload = { ...usage, totals: { ...usage.totals, requests: 0 } };
    serve(none);
    at();
    renderApp(<ActivityPage />);
    const lede = await screen.findByRole("heading", { level: 1, name: /^No / });
    expect(lede.textContent).toBe("No agent activity in the last 30 days.");
  });

  it("lists error loops and near-limit sessions, each opening its table", async () => {
    serve({ ...usage, totals: { ...usage.totals, error_loops: 3 } });
    at();
    renderApp(<ActivityPage />);
    await loaded();
    const loops = (await attention().findByText("3 error loops")).closest("li")!;
    expect(loops.className).toBe("crit");
    expect(attention().getByText("● Act")).toBeTruthy();
    expect(attention().getByText("1 session").closest("li")!.textContent).toMatch(/reached 80%\+ of the context window/);
    expect(attention().getByText("1 failed test run").closest("li")!.textContent).toMatch(/of 2/);
    await userEvent.click(within(loops).getByRole("button", { name: "See loops" }));
    expect(isOpen("d-loops")).toBe(true);
    // The payload carries the newest loops only: the drawer counts them all and says so.
    const drawer = document.getElementById("d-loops")!;
    expect(drawer.querySelector("h2")!.textContent).toMatch(/Error loops\s*3/);
    expect(within(drawer).getByText(/^Showing the 1 newest of 3\./)).toBeTruthy();
    await userEvent.click(attention().getByRole("button", { name: "See it" }));
    expect(isOpen("d-sessions")).toBe(true);
    expect(screen.getByRole("checkbox", { name: "Near context limit only" })).toHaveProperty("checked", true);
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&near=1"));
  });

  it("sorts sessions on the server, keeps the sort for Show more, and never reorders a page", async () => {
    const all = Array.from({ length: 250 }, (_, k) => ({ ...sessions.sessions[0], session_id: `x${k}`, title: `Session ${k}`, cost: k % 7 }));
    const page = (q: URLSearchParams) => {
      const from = Number(q.get("offset") ?? 0), to = from + Number(q.get("limit") ?? 100);
      return { total: all.length, offset: from, sessions: all.slice(from, to) };
    };
    mockApi({ "/api/usage": () => usage, "/api/sessions": page });
    at();
    renderApp(<ActivityPage />);
    await loaded();
    act(() => { openDrawer("d-sessions"); });
    const drawer = within(document.getElementById("d-sessions")!);
    await drawer.findByRole("button", { name: "Session 99" });
    expect(drawer.queryByRole("button", { name: "Project" })).toBeNull();
    const cost = drawer.getByRole("button", { name: "Est. cost" });
    await userEvent.click(cost);
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&sort=cost&desc=1"));
    expect([...document.querySelectorAll("#d-sessions th[aria-sort]")].map(th => [th.textContent, th.getAttribute("aria-sort")])).toEqual([["Est. cost↓", "descending"]]);
    // The rows keep the server's order: costs 0, 1, 2… are not reordered in the browser.
    await waitFor(() => expect(document.querySelector("#d-sessions tbody tr button")!.textContent).toBe("Session 0"));
    await userEvent.click(drawer.getByRole("button", { name: "Show more sessions" }));
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&offset=100&sort=cost&desc=1"));
    await userEvent.click(cost);
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&sort=cost"));
    expect(cost.closest("th")!.getAttribute("aria-sort")).toBe("ascending");
    expect(location.search).toBe("?range=30");
  });

  it("sends each sortable Sessions column's own key, and the hint says the order", async () => {
    serve(usage);
    at();
    renderApp(<ActivityPage />);
    await loaded();
    openSessions();
    const drawer = within(document.getElementById("d-sessions")!), hint = () => document.querySelector("#d-sessions .hint [aria-live]")!.textContent;
    const keys: [string, string, string][] = [["Session", "first_ts", "newest first"], ["Active", "duration_s", "longest active time first"],
      ["Prompts", "prompts", "most prompts first"], ["Tokens", "tokens", "most tokens first"], ["Est. cost", "cost", "costliest first"],
      ["Peak context", "peak_context", "largest peak context first"], ["Failed", "errors", "most failed calls first"],
      ["Compactions", "compactions", "most compactions first"], ["Commits", "commits", "most commits first"], ["Tests", "tests_failed", "most failed test runs first"]];
    for (const [label, key, order] of keys) {
      await userEvent.click(drawer.getByRole("button", { name: label }));
      await waitFor(() => expect(fetched()).toContain(`/api/sessions?range=30&sort=${key}&desc=1`));
      await waitFor(() => expect(hint()).toContain(order));
    }
    await userEvent.click(drawer.getByRole("button", { name: "Tests" }));
    await waitFor(() => expect(hint()).toContain("fewest failed test runs first"));
  });

  it("drops the Sessions sort for the near-limit and day actions", async () => {
    serve(usage);
    at();
    renderApp(<ActivityPage />);
    await loaded();
    openSessions();
    await userEvent.click(within(document.getElementById("d-sessions")!).getByRole("button", { name: "Tokens" }));
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&sort=tokens&desc=1"));
    await userEvent.click(attention().getByRole("button", { name: "See it" }));
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&near=1"));
    expect(document.querySelector("#d-sessions th[aria-sort]")).toBeNull();
    await waitFor(() => expect(document.querySelector("#d-sessions .hint [aria-live]")!.textContent).toContain("nearest the limit first"));
    await userEvent.click(within(document.getElementById("d-sessions")!).getByRole("button", { name: "Tokens" }));
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&near=1&sort=tokens&desc=1"));
    const chart = screen.getByRole("group", { name: /^Commits/ });
    act(() => chart.focus());
    fireEvent.keyDown(chart, { key: "End" });
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    fireEvent.keyDown(chart, { key: "Enter" });
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&day=2026-11-04"));
    expect(document.querySelector("#d-sessions th[aria-sort]")).toBeNull();
    await waitFor(() => expect(document.querySelector("#d-sessions .hint [aria-live]")!.textContent).toContain("by their cost on that day"));
  });

  it("keeps the Sessions sort when new data refreshes the table", async () => {
    let n = 0;
    mockApi({ "/api/usage": () => ({ ...usage, totals: { ...usage.totals, sessions: 2 + n++ } }), "/api/sessions": () => sessions });
    at();
    const { client } = renderApp(<ActivityPage />);
    await loaded();
    openSessions();
    await userEvent.click(within(document.getElementById("d-sessions")!).getByRole("button", { name: "Est. cost" }));
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&sort=cost&desc=1"));
    await waitFor(() => expect(document.querySelector("#d-sessions tbody")!.getAttribute("aria-busy")).toBeNull());
    ingested(client);
    await waitFor(() => expect(fetched().filter(u => u === "/api/sessions?range=30&sort=cost&desc=1")).toHaveLength(2));
  });

  it("drops a Show more page that answers after the sort changed", async () => {
    const all = many(250), stale = held<unknown>(), page = paged(all);
    mockApi({ "/api/usage": () => usage, "/api/sessions": q => (q.get("offset") ? stale.p : page(q)) });
    at();
    renderApp(<ActivityPage />);
    await loaded();
    openSessions();
    const drawer = within(document.getElementById("d-sessions")!);
    await drawer.findByRole("button", { name: "Session 99" });
    await userEvent.click(drawer.getByRole("button", { name: "Show more sessions" }));
    await userEvent.click(drawer.getByRole("button", { name: "Est. cost" }));
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&sort=cost&desc=1"));
    await waitFor(() => expect(document.querySelector("#d-sessions tbody")!.getAttribute("aria-busy")).toBeNull());
    await act(async () => { stale.resolve({ total: 250, offset: 100, sessions: many(100, "Stale") }); await stale.p; });
    expect(drawer.queryByRole("button", { name: "Stale 0" })).toBeNull();
    expect(document.querySelectorAll("#d-sessions tbody tr")).toHaveLength(100);
  });

  it("sorts projects and tools in the browser, projects by sessions first, empty values last", async () => {
    const p0 = usage.by_project[0]!, proj = (project: string, sessions: number, tokens_per_prompt: number | null): ProjectRow => ({ ...p0, project, sessions, tokens_per_prompt });
    serve({ ...usage, by_project: [proj("a", 1, null), proj("b", 5, 10), proj("c", 3, 20)] });
    at();
    renderApp(<ActivityPage />);
    await loaded();
    act(() => { openDrawer("d-projects"); });
    const order = (id: string) => [...document.querySelectorAll(`#${id} tbody tr`)].map(r => r.getAttribute("data-v"));
    const projects = within(document.getElementById("d-projects")!);
    expect(order("d-projects")).toEqual(["b", "c", "a"]);
    expect(projects.getByRole("button", { name: "Sessions" }).closest("th")!.getAttribute("aria-sort")).toBe("descending");
    expect(document.getElementById("d-projects")!.querySelector("thead")!.textContent).not.toMatch(/cost/i);
    await userEvent.click(projects.getByRole("button", { name: "Tokens / prompt" }));
    expect(order("d-projects")).toEqual(["c", "b", "a"]);
    await userEvent.click(projects.getByRole("button", { name: "Tokens / prompt" }));
    expect(order("d-projects")).toEqual(["b", "c", "a"]);
    act(() => { openDrawer("d-tools"); });
    expect(order("d-tools")).toEqual(usage.tools.map(t => t.tool));
    const failed = within(document.getElementById("d-tools")!).getByRole("button", { name: "Failed" });
    await userEvent.click(failed);
    expect(order("d-tools")[0]).toBe("Edit");
    expect(failed.closest("th")!.getAttribute("aria-sort")).toBe("descending");
    await userEvent.click(failed);
    expect(order("d-tools").at(-1)).toBe("Edit");
    expect(fetched().filter(u => !String(u).startsWith("/api/usage"))).toEqual([]);
  });

  it("restores the sessions filters from the hash and writes them without new history entries", async () => {
    mockApi({ "/api/usage": () => usage, "/api/sessions": () => sessions, "/api/day": () => noDay("2026-11-04") });
    at("?range=30&day=2026-11-04&q=api&near=1");
    renderApp(<ActivityPage />);
    await loaded();
    act(() => { openDrawer("d-sessions"); });
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&q=api&near=1&day=2026-11-04"));
    const search = screen.getByRole<HTMLInputElement>("searchbox", { name: "Search sessions" });
    expect(search.value).toBe("api");
    expect(screen.getByRole("checkbox", { name: "Near context limit only" })).toHaveProperty("checked", true);
    expect(screen.getByText("Active on Nov 4, 2026")).toBeTruthy();
    const n = history.length;
    await userEvent.type(search, "x");
    await userEvent.click(screen.getByRole("checkbox", { name: "Near context limit only" }));
    expect(location.search).toBe("?range=30&day=2026-11-04&q=apix");
    expect(history.length).toBe(n);
  });

  it("clears the day when the project, range or source changes", async () => {
    mockApi({ "/api/usage": () => usage, "/api/sessions": () => sessions, "/api/day": () => noDay("2026-11-04") });
    at("?range=30&day=2026-11-04&q=api");
    renderApp(<ActivityPage />);
    await loaded();
    await userEvent.click(within(screen.getByRole("group", { name: "Time range" })).getByRole("button", { name: "7d" }));
    await waitFor(() => expect(location.search).toBe("?range=7&q=api"));
    act(() => setSearch({ day: "2026-11-04" }));
    await userEvent.click(within(screen.getByRole("group", { name: "Source" })).getByRole("button", { name: "Codex" }));
    await waitFor(() => expect(location.search).toBe("?range=7&source=codex&q=api"));
    act(() => setSearch({ day: "2026-11-04" }));
    await userEvent.click(screen.getByRole("combobox", { name: "Project" }));
    await userEvent.click(screen.getByRole("option", { name: "foo" }));
    await waitFor(() => expect(location.search).toBe("?project=foo&range=7&source=codex&q=api"));
  });

  it("keeps the day on the earlier history entry after a filter change and Back", async () => {
    mockApi({ "/api/usage": () => usage, "/api/sessions": () => sessions, "/api/day": () => noDay("2026-11-04") });
    at("?range=30&day=2026-11-04");
    renderApp(<ActivityPage />);
    await loaded();
    await userEvent.click(within(screen.getByRole("group", { name: "Time range" })).getByRole("button", { name: "7d" }));
    await waitFor(() => expect(location.search).toBe("?range=7"));
    const days = () => fetched().filter(u => String(u).startsWith("/api/day")).length, n = days();
    act(() => history.back());
    await waitFor(() => expect(location.search).toMatch(/range=30/));
    await act(async () => {});
    expect(location.search).toBe("?range=30&day=2026-11-04");
    expect(days()).toBe(n);
  });

  it("narrows tools, MCP & hooks and error loops to the selected day", async () => {
    const day: DayView = {
      day: "2026-11-04", tools: [{ tool: "Grep", calls: 2, errors: 0, failure_rate: 0, p50_ms: 10, p95_ms: 20 }],
      mcp: [{ name: "daysrv", calls: 1, errors: 0, failure_rate: 0 }], skills: [], hooks: [],
      error_loops: [{ ...usage.error_loops[0]!, first_id: "dl1" }], error_loops_total: 7,
    };
    mockApi({ "/api/usage": () => usage, "/api/sessions": () => sessions, "/api/day": () => day });
    at("?range=30&day=2026-11-04");
    renderApp(<ActivityPage />);
    await loaded();
    act(() => { openDrawer("d-tools"); });
    const tools = within(document.getElementById("d-tools")!);
    expect(await tools.findByRole("button", { name: "Grep" })).toBeTruthy();
    expect(tools.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(fetched()).toContain("/api/day?range=30&day=2026-11-04");
    expect(tools.getByText(/^Nov 4, 2026 only\./)).toBeTruthy();
    act(() => { openDrawer("d-ext"); });
    expect(within(document.getElementById("d-ext")!).getByRole("button", { name: "daysrv" })).toBeTruthy();
    act(() => { openDrawer("d-loops"); });
    const loops = document.getElementById("d-loops")!;
    expect(loops.querySelector("h2")!.textContent).toMatch(/Error loops\s*7/);
    expect(loops.querySelector("a")!.getAttribute("href")).toContain("ex=dl1");
    // Projects and attention stay range-wide; the sessions table says which figures are whole-session.
    expect(attention().getByText("1 failed test run")).toBeTruthy();
    act(() => { openDrawer("d-sessions"); });
    await userEvent.click(screen.getByRole("button", { name: "About Peak context" }));
    expect(screen.getByRole("button", { name: "Peak context" }).closest("th")!.querySelector("[role=tooltip]")!.textContent).toMatch(/whole-session/i);
    act(() => { openDrawer("d-tools"); });
    await userEvent.click(tools.getByRole("button", { name: "Show the whole range" }));
    expect(location.search).toBe("?range=30");
    expect(await tools.findByRole("button", { name: "Edit" })).toBeTruthy();
    expect(tools.queryByRole("button", { name: "Grep" })).toBeNull();
    act(() => { openDrawer("d-ext"); });
    expect(within(document.getElementById("d-ext")!).getByRole("button", { name: "srv" })).toBeTruthy();
    act(() => { openDrawer("d-sessions"); });
    expect(screen.getByRole("button", { name: "Peak context" }).closest("th")!.getAttribute("title")).toBeNull();
  });

  it("does not label the range rows as the day while the day loads or after it fails", async () => {
    const wait = held<unknown>();
    let fail = false;
    mockApi({ "/api/usage": () => ({ ...usage, hooks: [] }), "/api/sessions": () => sessions, "/api/day": () => (fail ? undefined : wait.p) });
    at("?range=30&day=2026-11-04");
    renderApp(<ActivityPage />);
    await loaded();
    act(() => { openDrawer("d-ext"); openDrawer("d-tools"); }); // both bodies render; the tools stay open
    const tools = within(document.getElementById("d-tools")!), ext = document.getElementById("d-ext")!;
    expect(tools.getByText(/^Loading Nov 4, 2026…; showing the whole range\./)).toBeTruthy();
    expect(tools.getByRole("button", { name: "Edit" })).toBeTruthy();
    expect(within(ext).getByText("None in this range.")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Nov 4, 2026 only|None on Nov 4/);
    fail = true;
    act(() => setSearch({ day: "2026-11-05" }));
    expect(await tools.findByText(/^Could not load Nov 5, 2026 \(HTTP 404\); showing the whole range\./)).toBeTruthy();
    expect(within(ext).getByText("None in this range.")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Nov 5, 2026 only|None on Nov 5/);
  });

  it("drops the earlier day's rows when the day changes", async () => {
    const second = held<unknown>(), grep = { tool: "Grep", calls: 2, errors: 0, failure_rate: 0, p50_ms: 10, p95_ms: 20 };
    mockApi({ "/api/usage": () => usage, "/api/sessions": () => sessions,
      "/api/day": q => (q.get("day") === "2026-11-04" ? { ...noDay("2026-11-04"), tools: [grep] } : second.p) });
    at("?range=30&day=2026-11-04");
    renderApp(<ActivityPage />);
    await loaded();
    act(() => { openDrawer("d-tools"); });
    const tools = within(document.getElementById("d-tools")!);
    expect(await tools.findByRole("button", { name: "Grep" })).toBeTruthy();
    act(() => setSearch({ day: "2026-11-05" }));
    await waitFor(() => expect(tools.queryByRole("button", { name: "Grep" })).toBeNull());
    await act(async () => { second.resolve({ ...noDay("2026-11-05"), tools: [{ ...grep, tool: "Glob" }] }); await second.p; });
    expect(await tools.findByRole("button", { name: "Glob" })).toBeTruthy();
    expect(tools.queryByRole("button", { name: "Grep" })).toBeNull();
  });

  it("treats a day that does not exist as no day", async () => {
    mockApi({ "/api/usage": () => usage, "/api/sessions": () => sessions, "/api/day": () => noDay("2026-02-30") });
    at("?range=30&day=2026-02-30");
    renderApp(<ActivityPage />);
    await loaded();
    openSessions();
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30"));
    expect(fetched().some(u => String(u).startsWith("/api/day") || String(u).includes("day="))).toBe(false);
    expect(screen.queryByText(/^Active on/)).toBeNull();
    act(() => { openDrawer("d-tools"); });
    expect(within(document.getElementById("d-tools")!).getByRole("button", { name: "Edit" })).toBeTruthy();
  });

  it("shows the range rows and fetches no day without a day", async () => {
    serve(usage);
    at();
    renderApp(<ActivityPage />);
    await loaded();
    act(() => { openDrawer("d-tools"); });
    expect(within(document.getElementById("d-tools")!).getByRole("button", { name: "Edit" })).toBeTruthy();
    expect(fetched().some(u => String(u).startsWith("/api/day"))).toBe(false);
  });

  it("opens the failed test runs, each linking to its error", async () => {
    const t = { id: "t9", session_id: "s1", title: "Fix upload", project: "bar", source: "codex" as const, command: "npm test", ts: "2026-11-04T10:07:00.000Z" };
    serve({ ...usage, totals: { ...usage.totals, tests_failed: 4 }, failed_tests: [t] });
    at();
    renderApp(<ActivityPage />);
    await loaded();
    await userEvent.click(attention().getByRole("button", { name: "See tests" }));
    const drawer = document.getElementById("d-tests")!;
    expect(isOpen("d-tests")).toBe(true);
    expect(drawer.contains(document.activeElement)).toBe(true);
    expect(drawer.querySelector("h2")!.textContent).toMatch(/Failed test runs\s*4/);
    const row = within(drawer.querySelector("tbody")!);
    expect(row.getByText("npm test")).toBeTruthy();
    expect(row.getByRole("button", { name: "Fix upload" })).toBeTruthy();
    expect(row.getByRole("link", { name: "Open in Errors" }).getAttribute("href")).toBe("/errors?project=bar&range=30&source=codex&ex=t9");
    expect(within(screen.getByRole("navigation", { name: "Page sections" })).getByRole("link", { name: "Tests" }).getAttribute("href")).toBe("#d-tests");
  });

  it("lists a failed test run with no time", async () => {
    const t = { id: "t8", session_id: "s2", title: null, project: "bar", source: "claude" as const, command: "npm test", ts: null };
    serve({ ...usage, totals: { ...usage.totals, tests_failed: 1 }, failed_tests: [t] });
    at();
    renderApp(<ActivityPage />);
    await loaded();
    act(() => { openDrawer("d-tests"); });
    const row = within(document.getElementById("d-tests")!.querySelector("tbody")!);
    expect(row.getByText("npm test")).toBeTruthy();
    expect(row.getByRole("link", { name: "Open in Errors" }).getAttribute("href")).toBe("/errors?project=bar&range=30&source=claude&ex=t8");
    expect(document.querySelector("#d-tests td.when")!.textContent).toBe("–");
  });

  it("names an error loop's session by its title, with the short id below", async () => {
    const [first, ...rest] = usage.error_loops;
    serve({ ...usage, error_loops: [{ ...first!, title: "Fix flaky upload test" }, ...rest.map(l => ({ ...l, title: null }))] });
    at();
    renderApp(<ActivityPage />);
    await loaded();
    act(() => { openDrawer("d-loops"); });
    const drawer = within(document.getElementById("d-loops")!);
    const cell = drawer.getByRole("button", { name: "Fix flaky upload test" });
    expect(cell.getAttribute("title")).toBe("Fix flaky upload test");
    expect(cell.nextElementSibling!.textContent).toBe("#" + first!.session_id.slice(0, 8));
    await userEvent.click(cell);
    expect(location.search).toContain("session=" + first!.session_id);
  });

  it("says when nothing needs attention", async () => {
    serve(quiet);
    at();
    renderApp(<ActivityPage />);
    await loaded();
    expect(await attention().findByText("Nothing needs attention")).toBeTruthy();
    expect(attention().getByText(/No error loops, sessions near the context limit, flaky tools or failed tests/)).toBeTruthy();
    expect(attention().getByText("✓ Good")).toBeTruthy();
  });

  it("puts flaky tools first when asked", async () => {
    const flaky = { tool: "WebFetch", calls: 40, errors: 10, p50_ms: 900, p95_ms: 2000, failure_rate: .25 };
    serve({ ...quiet, tools: [...quiet.tools, flaky] });
    at();
    renderApp(<ActivityPage />);
    await loaded();
    act(() => { openDrawer("d-tools"); });
    const item = (await attention().findByText("1 tool")).closest("li")!;
    expect(item.textContent).toMatch(/worst WebFetch \(25%\)/);
    const first = () => document.querySelector("#d-tools tbody tr :is(th, td)")!.textContent;
    expect(first()).toBe("Edit");
    // A chosen sort gives way to flaky tools first.
    const failed = within(document.getElementById("d-tools")!).getByRole("button", { name: "Failed" });
    await userEvent.click(failed); await userEvent.click(failed);
    expect(first()).toBe("Skill");
    await userEvent.click(within(item).getByRole("button", { name: "See tools" }));
    expect(first()).toBe("WebFetch");
    expect(document.querySelector("#d-tools th[aria-sort]")).toBeNull();
  });

  it("selecting a day on the work chart lists that day's sessions", async () => {
    serve(usage);
    at();
    renderApp(<ActivityPage />);
    const chart = await screen.findByRole("group", { name: /^Commits and errors per 100 tool calls per day, 2 days/ });
    act(() => chart.focus());
    fireEvent.keyDown(chart, { key: "End" });
    expect(screen.getByText("Nov 5, 2026: 0 commits, 1 prompt, 1 session, 0 failed calls")).toBeTruthy();
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    fireEvent.keyDown(chart, { key: "Enter" });
    expect(isOpen("d-sessions")).toBe(true);
    expect(screen.getByText("Active on Nov 4, 2026")).toBeTruthy();
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&day=2026-11-04"));
    // The bars follow the chosen count.
    await userEvent.click(within(screen.getByRole("group", { name: "Chart metric" })).getByRole("button", { name: "Prompts" }));
    expect(screen.getByRole("group", { name: /^Prompts and errors per 100 tool calls per day/ })).toBeTruthy();
  });

  it("opens a session sheet from the sessions table and closes it again", async () => {
    serve(usage);
    at();
    renderApp(<ActivityPage />);
    await loaded();
    act(() => { openDrawer("d-sessions"); });
    const row = await within(document.getElementById("d-sessions")!).findByRole("button", { name: "#s1" });
    await userEvent.click(row);
    expect(location.search).toBe("?range=30&session=s1");
    const dlg = within(document.querySelector("dialog")!);
    expect(await dlg.findByText("Timeline")).toBeTruthy();
    await userEvent.click(dlg.getByRole("button", { name: "Close" }));
    expect(location.search).toBe("?range=30");
  });

  it("opens a tool sheet from the tools drawer, and Escape returns focus to the row", async () => {
    mockApi({ "/api/usage": () => usage, "/api/tool": q => ({ ...tool, kind: q.get("kind"), name: q.get("name") }) });
    at();
    renderApp(<ActivityPage />);
    await loaded();
    act(() => { openDrawer("d-tools"); });
    const row = document.querySelector<HTMLElement>('#d-tools tr[data-v="Bash"]')!;
    await userEvent.click(row.querySelector("button")!);
    expect(location.search).toBe("?range=30&tool=Bash");
    const dlg = within(document.querySelector("dialog")!);
    expect(await dlg.findByText("Recent calls")).toBeTruthy();
    // The browser turns Escape on a modal dialog into a cancel event.
    act(() => { document.querySelector("dialog")!.dispatchEvent(new Event("cancel", { cancelable: true })); });
    await waitFor(() => expect(location.search).toBe("?range=30")); // closing goes Back over the entry the sheet pushed
    await waitFor(() => expect(document.activeElement).toBe(within(document.querySelector<HTMLElement>('#d-tools tr[data-v="Bash"]')!).getByRole("button", { name: "Bash" })));
  });

  it("opens MCP server and skill sheets from the extensions drawer", async () => {
    mockApi({ "/api/usage": () => usage, "/api/tool": q => ({ ...tool, kind: q.get("kind"), name: q.get("name") }) });
    at();
    renderApp(<ActivityPage />);
    await loaded();
    act(() => { openDrawer("d-ext"); });
    const ext = within(document.getElementById("d-ext")!);
    await userEvent.click(ext.getByRole("button", { name: "srv" }));
    expect(location.search).toBe("?range=30&mcp=srv");
    expect((await within(document.querySelector("dialog")!).findByRole("heading", { level: 2 })).textContent).toBe("MCP serversrv");
    await userEvent.click(within(document.querySelector("dialog")!).getByRole("button", { name: "Close" }));
    await userEvent.click(ext.getByRole("button", { name: "review" }));
    expect(location.search).toBe("?range=30&skill=review");
  });

  it("opens the palette over an open tool sheet, and Escape leaves the sheet open", async () => {
    mockApi({ "/api/usage": () => usage, "/api/tool": () => tool, "/api/palette": () => palette });
    at("?range=30&tool=Bash");
    renderApp(<><ActivityPage /><Palette /></>);
    const sheet = document.querySelector<HTMLDialogElement>("dialog.sheet")!;
    expect(await within(sheet).findByText("Recent calls")).toBeTruthy();
    act(() => { dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, metaKey: true, bubbles: true })); openPalette(); });
    const pal = document.querySelector<HTMLDialogElement>("dialog.palette")!;
    expect([sheet.open, pal.open]).toEqual([true, true]);
    // Both are modal; the palette's showModal() comes later, so it is on top and holds focus.
    expect(pal.contains(document.activeElement)).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect([sheet.open, pal.open, location.search]).toEqual([true, false, "?range=30&tool=Bash"]);
  });
});
