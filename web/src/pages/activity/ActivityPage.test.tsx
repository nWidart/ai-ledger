import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DayView, Previous, ProjectRow, UsagePayload } from "../../api";
import usage from "../../__fixtures__/usage";
import usageAll from "../../__fixtures__/usage-all";
import sessions from "../../__fixtures__/sessions";
import session from "../../__fixtures__/session";
import tool from "../../__fixtures__/tool";
import palette from "../../__fixtures__/palette";
import { Palette } from "../../components/palette/Palette";
import { openPalette } from "../../components/palette/store";
import { mockApi } from "../../components/sheets/testing";
import { ActivityPage } from "./ActivityPage";
import { setHash } from "../../hash";
import { clearApiCache } from "../../useApi";
import { hookCommand, workDays } from "./work";

const at = (hash = "#range=30") => history.replaceState(null, "", "/usage" + hash);
const serve = (d: UsagePayload) => mockApi({ "/api/usage": () => d, "/api/sessions": () => sessions, "/api/session": () => session });
const attention = () => within(document.getElementById("attention")!);
const loaded = () => screen.findByRole("heading", { level: 1, name: /commit/ });
const fetched = () => vi.mocked(fetch).mock.calls.map(c => c[0]);
const noDay = (day: string): DayView => ({ day, tools: [], mcp: [], skills: [], hooks: [], error_loops: [], error_loops_total: 0 });
const openSessions = () => act(() => { (document.getElementById("d-sessions") as HTMLDetailsElement).open = true; });
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
    render(<ActivityPage />);
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
    render(<ActivityPage />);
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
    render(<ActivityPage />);
    await loaded();
    expect(vital("Errors per 100 calls").textContent).toBe("Errors per 100 calls, unchanged");
    expect(vital("Test runs passed").textContent).toBe("Test runs passed, unchanged");
    expect(vital("Prompts interrupted").textContent).toBe("Prompts interrupted, unchanged");
  });

  it("shows the headline's commits, sessions and active days against the period before", async () => {
    serve(prior({ commits: 4, sessions: 1, active_days: 3 }));
    at();
    render(<ActivityPage />);
    expect((await loaded()).textContent).toBe("1 commit from 3 prompts, down from 4 commits, in 2 sessions, up from 1 session, 2 active days, down from 3 active days");
  });

  it("shows no change in the All range", async () => {
    serve(usageAll);
    at("#range=0");
    render(<ActivityPage />);
    await loaded();
    expect(document.querySelector("#lede")!.textContent).not.toMatch(change);
    expect(document.getElementById("vitals")!.textContent).not.toMatch(change);
  });

  it("shows no change for a figure whose previous period has nothing to divide by", async () => {
    serve(prior({ calls: 0, errors: 0, test_runs: 0, tests_passed: 0, prompts: 0, interrupted: 0, tokens: 0, sub_tokens: 0, median_session_seconds: null }));
    at();
    render(<ActivityPage />);
    await loaded();
    expect(document.getElementById("vitals")!.textContent).not.toMatch(change);
  });
});

describe("automated projects file", () => {
  const bad: UsagePayload = { ...usage, automated_file: { ...usage.automated_file, error: "Expecting value: line 1 column 1 (char 0)" } };

  it("shows a banner with the path and the error, saying the file is ignored", async () => {
    serve(bad);
    at();
    render(<ActivityPage />);
    await loaded();
    const banner = screen.getByRole("alert");
    expect(banner.textContent).toContain(usage.automated_file.path);
    expect(banner.textContent).toContain("Expecting value: line 1 column 1 (char 0)");
    expect(banner.textContent).toMatch(/ignored until it is fixed/);
  });

  it("shows none without an error", async () => {
    serve(usage);
    at();
    render(<ActivityPage />);
    await loaded();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("names the file on the automated toggle", async () => {
    serve(usage);
    at();
    render(<ActivityPage />);
    await loaded();
    expect(document.querySelector("label.chk")!.getAttribute("title")).toContain(usage.automated_file.path);
  });
});

describe("work panel", () => {
  it("puts the hours heatmap on the page and in the section index", async () => {
    serve(usage);
    at();
    render(<ActivityPage />);
    await loaded();
    expect(document.getElementById("hours")).toBeTruthy();
    expect(within(screen.getByRole("navigation", { name: /sections/i })).getByRole("link", { name: "Hours" })).toBeTruthy();
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
    render(<ActivityPage />);
    const lede = await loaded();
    expect(lede.textContent).toBe("1 commit from 3 prompts, up from 0 commits, in 2 sessions, up from 1 session, 2 active days, up from 1 active day");
    const before = document.querySelector(".top")!.textContent! + document.getElementById("attention")!.textContent!;
    expect(before).not.toMatch(/\$|cost/i);
  });

  it("narrows to Codex when picked and records it in the URL", async () => {
    const codex: UsagePayload = { ...usage, source: "codex", totals: { ...usage.totals, commits: 0, prompts: 1, sessions: 1, active_days: 1 } };
    mockApi({ "/api/usage": q => (q.get("source") === "codex" ? codex : usage), "/api/sessions": () => sessions, "/api/session": () => session });
    at();
    render(<ActivityPage />);
    await loaded();
    await userEvent.click(within(screen.getByRole("group", { name: "Source" })).getByRole("button", { name: "Codex" }));
    expect(location.hash).toBe("#range=30&source=codex");
    expect((await screen.findByRole("heading", { level: 1, name: /^0 commits/ })).textContent).toBe("0 commits from 1 prompt, unchanged, in 1 session, unchanged, 1 active day, unchanged");
    expect(fetched()).toContain("/api/usage?range=30&source=codex");
  });

  it("says the Sessions drawer counts a session by a request in the range", async () => {
    serve(usage);
    at();
    render(<ActivityPage />);
    await loaded();
    openSessions();
    expect(screen.getByText(/A session counts here when it has a request in the range/).textContent).toContain("Insights counts sessions by their start time");
  });

  it("reloads an open sessions table when the source changes", async () => {
    mockApi({ "/api/usage": q => (q.get("source") === "codex" ? { ...usage, source: "codex" } : usage), "/api/sessions": () => sessions, "/api/session": () => session });
    at();
    render(<ActivityPage />);
    await loaded();
    act(() => { (document.getElementById("d-sessions") as HTMLDetailsElement).open = true; });
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30"));
    await userEvent.click(within(screen.getByRole("group", { name: "Source" })).getByRole("button", { name: "Codex" }));
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&source=codex"));
  });

  it("reloads an open sessions table when new data arrives", async () => {
    let n = 0;
    mockApi({ "/api/usage": () => ({ ...usage, totals: { ...usage.totals, sessions: 2 + n++ } }), "/api/sessions": () => sessions });
    at();
    render(<ActivityPage />);
    await loaded();
    act(() => { (document.getElementById("d-sessions") as HTMLDetailsElement).open = true; });
    await waitFor(() => expect(fetched().filter(u => u === "/api/sessions?range=30")).toHaveLength(1));
    act(() => clearApiCache());
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&limit=100"));
  });

  it("swaps in new data from a background ingest quietly, and replays the landing only after Refresh", async () => {
    let n = 0;
    mockApi({ "/api/usage": () => ({ ...usage, totals: { ...usage.totals, sessions: 2 + n++ } }), "/api/sessions": () => sessions });
    at();
    const { container } = render(<ActivityPage />);
    await screen.findByRole("heading", { level: 1, name: /in 2 sessions/ });
    const page = container.querySelector(".pg-activity")!, fades = () => page.querySelectorAll(".fade-in").length;
    await waitFor(() => expect(page.classList.contains("grow")).toBe(false), { timeout: 2000 });
    act(() => clearApiCache());
    await screen.findByRole("heading", { level: 1, name: /in 3 sessions/ });
    expect(page.classList.contains("grow")).toBe(false);
    expect(fades()).toBe(0);
    act(() => clearApiCache(true));
    await screen.findByRole("heading", { level: 1, name: /in 4 sessions/ });
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
    render(<ActivityPage />);
    await loaded();
    act(() => { (document.getElementById("d-sessions") as HTMLDetailsElement).open = true; });
    await screen.findByRole("button", { name: "Session 99" });
    await userEvent.click(screen.getByRole("button", { name: "Show more sessions" }));
    const row = await screen.findByRole("button", { name: "Session 150" });
    act(() => row.focus());
    act(() => clearApiCache());
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&limit=200"));
    await waitFor(() => expect(document.querySelector("#d-sessions tbody")!.getAttribute("aria-busy")).toBeNull());
    expect(document.querySelectorAll("#d-sessions tbody tr")).toHaveLength(200);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Session 150" }));
    expect(document.querySelector("#d-sessions tbody")!.hasAttribute("inert")).toBe(false);
  });

  it("names no agent when nothing happened in the range with every source", async () => {
    const none: UsagePayload = { ...usage, totals: { ...usage.totals, requests: 0 } };
    serve(none);
    at();
    render(<ActivityPage />);
    const lede = await screen.findByRole("heading", { level: 1, name: /^No / });
    expect(lede.textContent).toBe("No agent activity in the last 30 days.");
  });

  it("lists error loops and near-limit sessions, each opening its table", async () => {
    serve({ ...usage, totals: { ...usage.totals, error_loops: 3 } });
    at();
    render(<ActivityPage />);
    await loaded();
    const loops = (await attention().findByText("3 error loops")).closest("li")!;
    expect(loops.className).toBe("crit");
    expect(attention().getByText("● Act")).toBeTruthy();
    expect(attention().getByText("1 session").closest("li")!.textContent).toMatch(/reached 80%\+ of the context window/);
    expect(attention().getByText("1 failed test run").closest("li")!.textContent).toMatch(/of 2/);
    await userEvent.click(within(loops).getByRole("button", { name: "See loops" }));
    expect((document.getElementById("d-loops") as HTMLDetailsElement).open).toBe(true);
    // The payload carries the newest loops only: the drawer counts them all and says so.
    const drawer = document.getElementById("d-loops")!;
    expect(drawer.querySelector("summary")!.textContent).toMatch(/Error loops\s*3/);
    expect(within(drawer).getByText(/^Showing the 1 newest of 3\./)).toBeTruthy();
    await userEvent.click(attention().getByRole("button", { name: "See it" }));
    expect((document.getElementById("d-sessions") as HTMLDetailsElement).open).toBe(true);
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
    render(<ActivityPage />);
    await loaded();
    act(() => { (document.getElementById("d-sessions") as HTMLDetailsElement).open = true; });
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
    expect(location.hash).toBe("#range=30");
  });

  it("sends each sortable Sessions column's own key, and the hint says the order", async () => {
    serve(usage);
    at();
    render(<ActivityPage />);
    await loaded();
    openSessions();
    const drawer = within(document.getElementById("d-sessions")!), hint = () => document.querySelector("#d-sessions .hint")!.textContent;
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
    render(<ActivityPage />);
    await loaded();
    openSessions();
    await userEvent.click(within(document.getElementById("d-sessions")!).getByRole("button", { name: "Tokens" }));
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&sort=tokens&desc=1"));
    await userEvent.click(attention().getByRole("button", { name: "See it" }));
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&near=1"));
    expect(document.querySelector("#d-sessions th[aria-sort]")).toBeNull();
    await waitFor(() => expect(document.querySelector("#d-sessions .hint")!.textContent).toContain("nearest the limit first"));
    await userEvent.click(within(document.getElementById("d-sessions")!).getByRole("button", { name: "Tokens" }));
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&near=1&sort=tokens&desc=1"));
    const chart = screen.getByRole("img", { name: /^Commits/ });
    act(() => chart.focus());
    fireEvent.keyDown(chart, { key: "End" });
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    fireEvent.keyDown(chart, { key: "Enter" });
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&day=2026-11-04"));
    expect(document.querySelector("#d-sessions th[aria-sort]")).toBeNull();
    await waitFor(() => expect(document.querySelector("#d-sessions .hint")!.textContent).toContain("by their cost on that day"));
  });

  it("keeps the Sessions sort when new data refreshes the table", async () => {
    let n = 0;
    mockApi({ "/api/usage": () => ({ ...usage, totals: { ...usage.totals, sessions: 2 + n++ } }), "/api/sessions": () => sessions });
    at();
    render(<ActivityPage />);
    await loaded();
    openSessions();
    await userEvent.click(within(document.getElementById("d-sessions")!).getByRole("button", { name: "Est. cost" }));
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&sort=cost&desc=1"));
    await waitFor(() => expect(document.querySelector("#d-sessions tbody")!.getAttribute("aria-busy")).toBeNull());
    act(() => clearApiCache());
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&limit=100&sort=cost&desc=1"));
  });

  it("drops a Show more page that answers after the sort changed", async () => {
    const all = many(250), stale = held<unknown>(), page = paged(all);
    mockApi({ "/api/usage": () => usage, "/api/sessions": q => (q.get("offset") ? stale.p : page(q)) });
    at();
    render(<ActivityPage />);
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
    render(<ActivityPage />);
    await loaded();
    const order = (id: string) => [...document.querySelectorAll(`#${id} tbody tr`)].map(r => r.getAttribute("data-v"));
    const projects = within(document.getElementById("d-projects")!);
    expect(order("d-projects")).toEqual(["b", "c", "a"]);
    expect(projects.getByRole("button", { name: "Sessions" }).closest("th")!.getAttribute("aria-sort")).toBe("descending");
    expect(document.getElementById("d-projects")!.querySelector("thead")!.textContent).not.toMatch(/cost/i);
    await userEvent.click(projects.getByRole("button", { name: "Tokens / prompt" }));
    expect(order("d-projects")).toEqual(["c", "b", "a"]);
    await userEvent.click(projects.getByRole("button", { name: "Tokens / prompt" }));
    expect(order("d-projects")).toEqual(["b", "c", "a"]);
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
    at("#range=30&day=2026-11-04&q=api&near=1");
    render(<ActivityPage />);
    await loaded();
    act(() => { (document.getElementById("d-sessions") as HTMLDetailsElement).open = true; });
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&q=api&near=1&day=2026-11-04"));
    const search = screen.getByRole<HTMLInputElement>("searchbox", { name: "Search sessions" });
    expect(search.value).toBe("api");
    expect(screen.getByRole("checkbox", { name: "Near context limit only" })).toHaveProperty("checked", true);
    expect(screen.getByText("Active on Nov 4, 2026")).toBeTruthy();
    const n = history.length;
    await userEvent.type(search, "x");
    await userEvent.click(screen.getByRole("checkbox", { name: "Near context limit only" }));
    expect(location.hash).toBe("#range=30&day=2026-11-04&q=apix");
    expect(history.length).toBe(n);
  });

  it("clears the day when the project, range or source changes", async () => {
    mockApi({ "/api/usage": () => usage, "/api/sessions": () => sessions, "/api/day": () => noDay("2026-11-04") });
    at("#range=30&day=2026-11-04&q=api");
    render(<ActivityPage />);
    await loaded();
    await userEvent.click(within(screen.getByRole("group", { name: "Time range" })).getByRole("button", { name: "7d" }));
    await waitFor(() => expect(location.hash).toBe("#range=7&q=api"));
    act(() => setHash({ day: "2026-11-04" }));
    await userEvent.click(within(screen.getByRole("group", { name: "Source" })).getByRole("button", { name: "Codex" }));
    await waitFor(() => expect(location.hash).toBe("#range=7&source=codex&q=api"));
    act(() => setHash({ day: "2026-11-04" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Project" }), "foo");
    await waitFor(() => expect(location.hash).toBe("#project=foo&range=7&source=codex&q=api"));
  });

  it("keeps the day on the earlier history entry after a filter change and Back", async () => {
    mockApi({ "/api/usage": () => usage, "/api/sessions": () => sessions, "/api/day": () => noDay("2026-11-04") });
    at("#range=30&day=2026-11-04");
    render(<ActivityPage />);
    await loaded();
    await userEvent.click(within(screen.getByRole("group", { name: "Time range" })).getByRole("button", { name: "7d" }));
    await waitFor(() => expect(location.hash).toBe("#range=7"));
    const days = () => fetched().filter(u => String(u).startsWith("/api/day")).length, n = days();
    act(() => history.back());
    await waitFor(() => expect(location.hash).toMatch(/range=30/));
    await act(async () => {});
    expect(location.hash).toBe("#range=30&day=2026-11-04");
    expect(days()).toBe(n);
  });

  it("narrows tools, MCP & hooks and error loops to the selected day", async () => {
    const day: DayView = {
      day: "2026-11-04", tools: [{ tool: "Grep", calls: 2, errors: 0, failure_rate: 0, p50_ms: 10, p95_ms: 20 }],
      mcp: [{ name: "daysrv", calls: 1, errors: 0, failure_rate: 0 }], skills: [], hooks: [],
      error_loops: [{ ...usage.error_loops[0]!, first_id: "dl1" }], error_loops_total: 7,
    };
    mockApi({ "/api/usage": () => usage, "/api/sessions": () => sessions, "/api/day": () => day });
    at("#range=30&day=2026-11-04");
    render(<ActivityPage />);
    await loaded();
    const tools = within(document.getElementById("d-tools")!);
    expect(await tools.findByRole("button", { name: "Grep" })).toBeTruthy();
    expect(tools.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(fetched()).toContain("/api/day?range=30&day=2026-11-04");
    expect(tools.getByText(/^Nov 4, 2026 only\./)).toBeTruthy();
    expect(within(document.getElementById("d-ext")!).getByRole("button", { name: "daysrv" })).toBeTruthy();
    const loops = document.getElementById("d-loops")!;
    expect(loops.querySelector("summary")!.textContent).toMatch(/Error loops\s*7/);
    expect(loops.querySelector("a")!.getAttribute("href")).toContain("ex=dl1");
    // Projects and attention stay range-wide; the sessions table says which figures are whole-session.
    expect(attention().getByText("1 failed test run")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Peak context" }).closest("th")!.getAttribute("title")).toMatch(/whole-session/i);
    await userEvent.click(tools.getByRole("button", { name: "Show the whole range" }));
    expect(location.hash).toBe("#range=30");
    expect(await tools.findByRole("button", { name: "Edit" })).toBeTruthy();
    expect(tools.queryByRole("button", { name: "Grep" })).toBeNull();
    expect(within(document.getElementById("d-ext")!).getByRole("button", { name: "srv" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Peak context" }).closest("th")!.getAttribute("title")).toBeNull();
  });

  it("does not label the range rows as the day while the day loads or after it fails", async () => {
    const wait = held<unknown>();
    let fail = false;
    mockApi({ "/api/usage": () => ({ ...usage, hooks: [] }), "/api/sessions": () => sessions, "/api/day": () => (fail ? undefined : wait.p) });
    at("#range=30&day=2026-11-04");
    render(<ActivityPage />);
    await loaded();
    const tools = within(document.getElementById("d-tools")!), ext = document.getElementById("d-ext")!;
    expect(tools.getByText(/^Loading Nov 4, 2026…; showing the whole range\./)).toBeTruthy();
    expect(tools.getByRole("button", { name: "Edit" })).toBeTruthy();
    expect(within(ext).getByText("None in this range.")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Nov 4, 2026 only|None on Nov 4/);
    fail = true;
    act(() => setHash({ day: "2026-11-05" }));
    expect(await tools.findByText(/^Could not load Nov 5, 2026 \(HTTP 404\); showing the whole range\./)).toBeTruthy();
    expect(within(ext).getByText("None in this range.")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Nov 5, 2026 only|None on Nov 5/);
  });

  it("drops the earlier day's rows when the day changes", async () => {
    const second = held<unknown>(), grep = { tool: "Grep", calls: 2, errors: 0, failure_rate: 0, p50_ms: 10, p95_ms: 20 };
    mockApi({ "/api/usage": () => usage, "/api/sessions": () => sessions,
      "/api/day": q => (q.get("day") === "2026-11-04" ? { ...noDay("2026-11-04"), tools: [grep] } : second.p) });
    at("#range=30&day=2026-11-04");
    render(<ActivityPage />);
    await loaded();
    const tools = within(document.getElementById("d-tools")!);
    expect(await tools.findByRole("button", { name: "Grep" })).toBeTruthy();
    act(() => setHash({ day: "2026-11-05" }));
    await waitFor(() => expect(tools.queryByRole("button", { name: "Grep" })).toBeNull());
    await act(async () => { second.resolve({ ...noDay("2026-11-05"), tools: [{ ...grep, tool: "Glob" }] }); await second.p; });
    expect(await tools.findByRole("button", { name: "Glob" })).toBeTruthy();
    expect(tools.queryByRole("button", { name: "Grep" })).toBeNull();
  });

  it("treats a day that does not exist as no day", async () => {
    mockApi({ "/api/usage": () => usage, "/api/sessions": () => sessions, "/api/day": () => noDay("2026-02-30") });
    at("#range=30&day=2026-02-30");
    render(<ActivityPage />);
    await loaded();
    openSessions();
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30"));
    expect(fetched().some(u => String(u).startsWith("/api/day") || String(u).includes("day="))).toBe(false);
    expect(screen.queryByText(/^Active on/)).toBeNull();
    expect(within(document.getElementById("d-tools")!).getByRole("button", { name: "Edit" })).toBeTruthy();
  });

  it("shows the range rows and fetches no day without a day", async () => {
    serve(usage);
    at();
    render(<ActivityPage />);
    await loaded();
    expect(within(document.getElementById("d-tools")!).getByRole("button", { name: "Edit" })).toBeTruthy();
    expect(fetched().some(u => String(u).startsWith("/api/day"))).toBe(false);
  });

  it("opens the failed test runs, each linking to its error", async () => {
    const t = { id: "t9", session_id: "s1", title: "Fix upload", project: "bar", source: "codex" as const, command: "npm test", ts: "2026-11-04T10:07:00.000Z" };
    serve({ ...usage, totals: { ...usage.totals, tests_failed: 4 }, failed_tests: [t] });
    at();
    render(<ActivityPage />);
    await loaded();
    await userEvent.click(attention().getByRole("button", { name: "See tests" }));
    const drawer = document.getElementById("d-tests") as HTMLDetailsElement;
    expect(drawer.open).toBe(true);
    expect(drawer.contains(document.activeElement)).toBe(true);
    expect(drawer.querySelector("summary")!.textContent).toMatch(/Failed test runs\s*4/);
    const row = within(drawer.querySelector("tbody")!);
    expect(row.getByText("npm test")).toBeTruthy();
    expect(row.getByRole("button", { name: "Fix upload" })).toBeTruthy();
    expect(row.getByRole("link", { name: "Open in Errors" }).getAttribute("href")).toBe("/errors#project=bar&range=30&source=codex&ex=t9");
    expect(within(screen.getByRole("navigation", { name: "Page sections" })).getByRole("link", { name: "Tests" }).getAttribute("href")).toBe("#d-tests");
  });

  it("lists a failed test run with no time", async () => {
    const t = { id: "t8", session_id: "s2", title: null, project: "bar", source: "claude" as const, command: "npm test", ts: null };
    serve({ ...usage, totals: { ...usage.totals, tests_failed: 1 }, failed_tests: [t] });
    at();
    render(<ActivityPage />);
    await loaded();
    const row = within(document.getElementById("d-tests")!.querySelector("tbody")!);
    expect(row.getByText("npm test")).toBeTruthy();
    expect(row.getByRole("link", { name: "Open in Errors" }).getAttribute("href")).toBe("/errors#project=bar&range=30&source=claude&ex=t8");
    expect(document.querySelector("#d-tests td.when")!.textContent).toBe("–");
  });

  it("names an error loop's session by its title, with the short id below", async () => {
    const [first, ...rest] = usage.error_loops;
    serve({ ...usage, error_loops: [{ ...first!, title: "Fix flaky upload test" }, ...rest.map(l => ({ ...l, title: null }))] });
    at();
    render(<ActivityPage />);
    await loaded();
    const drawer = within(document.getElementById("d-loops")!);
    const cell = drawer.getByRole("button", { name: "Fix flaky upload test" });
    expect(cell.getAttribute("title")).toBe("Fix flaky upload test");
    expect(cell.nextElementSibling!.textContent).toBe("#" + first!.session_id.slice(0, 8));
    await userEvent.click(cell);
    expect(location.hash).toContain("session=" + first!.session_id);
  });

  it("says when nothing needs attention", async () => {
    serve(quiet);
    at();
    render(<ActivityPage />);
    await loaded();
    expect(await attention().findByText("Nothing needs attention")).toBeTruthy();
    expect(attention().getByText(/No error loops, sessions near the context limit, flaky tools or failed tests/)).toBeTruthy();
    expect(attention().getByText("✓ Good")).toBeTruthy();
  });

  it("puts flaky tools first when asked", async () => {
    const flaky = { tool: "WebFetch", calls: 40, errors: 10, p50_ms: 900, p95_ms: 2000, failure_rate: .25 };
    serve({ ...quiet, tools: [...quiet.tools, flaky] });
    at();
    render(<ActivityPage />);
    await loaded();
    const item = (await attention().findByText("1 tool")).closest("li")!;
    expect(item.textContent).toMatch(/worst WebFetch \(25%\)/);
    const first = () => document.querySelector("#d-tools tbody tr td")!.textContent;
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
    render(<ActivityPage />);
    const chart = await screen.findByRole("img", { name: /^Commits and errors per 100 tool calls per day, 2 days/ });
    act(() => chart.focus());
    fireEvent.keyDown(chart, { key: "End" });
    expect(screen.getByText("Nov 5, 2026: 0 commits, 1 prompt, 1 session, 0 failed calls")).toBeTruthy();
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    fireEvent.keyDown(chart, { key: "Enter" });
    expect((document.getElementById("d-sessions") as HTMLDetailsElement).open).toBe(true);
    expect(screen.getByText("Active on Nov 4, 2026")).toBeTruthy();
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&day=2026-11-04"));
    // The bars follow the chosen count.
    await userEvent.click(within(screen.getByRole("group", { name: "Chart metric" })).getByRole("button", { name: "Prompts" }));
    expect(screen.getByRole("img", { name: /^Prompts and errors per 100 tool calls per day/ })).toBeTruthy();
  });

  it("opens a session sheet from the sessions table and closes it again", async () => {
    serve(usage);
    at();
    render(<ActivityPage />);
    await loaded();
    act(() => { (document.getElementById("d-sessions") as HTMLDetailsElement).open = true; });
    const row = await within(document.getElementById("d-sessions")!).findByRole("button", { name: "#s1" });
    await userEvent.click(row);
    expect(location.hash).toBe("#range=30&session=s1");
    const dlg = within(document.querySelector("dialog")!);
    expect(await dlg.findByText("Timeline")).toBeTruthy();
    await userEvent.click(dlg.getByRole("button", { name: "Close" }));
    expect(location.hash).toBe("#range=30");
  });

  it("opens a tool sheet from the tools drawer, and Escape returns focus to the row", async () => {
    mockApi({ "/api/usage": () => usage, "/api/tool": q => ({ ...tool, kind: q.get("kind"), name: q.get("name") }) });
    at();
    render(<ActivityPage />);
    await loaded();
    act(() => { (document.getElementById("d-tools") as HTMLDetailsElement).open = true; });
    const row = document.querySelector<HTMLElement>('#d-tools tr[data-v="Bash"]')!;
    await userEvent.click(row.querySelector("td:last-child")!);
    expect(location.hash).toBe("#range=30&tool=Bash");
    const dlg = within(document.querySelector("dialog")!);
    expect(await dlg.findByText("Recent calls")).toBeTruthy();
    // The browser turns Escape on a modal dialog into a cancel event.
    act(() => { document.querySelector("dialog")!.dispatchEvent(new Event("cancel", { cancelable: true })); });
    await waitFor(() => expect(location.hash).toBe("#range=30")); // closing goes Back over the entry the sheet pushed
    await waitFor(() => expect(document.activeElement).toBe(within(document.querySelector<HTMLElement>('#d-tools tr[data-v="Bash"]')!).getByRole("button", { name: "Bash" })));
  });

  it("opens MCP server and skill sheets from the extensions drawer", async () => {
    mockApi({ "/api/usage": () => usage, "/api/tool": q => ({ ...tool, kind: q.get("kind"), name: q.get("name") }) });
    at();
    render(<ActivityPage />);
    await loaded();
    const ext = within(document.getElementById("d-ext")!);
    await userEvent.click(ext.getByRole("button", { name: "srv" }));
    expect(location.hash).toBe("#range=30&mcp=srv");
    expect((await within(document.querySelector("dialog")!).findByRole("heading", { level: 2 })).textContent).toBe("MCP serversrv");
    await userEvent.click(within(document.querySelector("dialog")!).getByRole("button", { name: "Close" }));
    await userEvent.click(ext.getByRole("button", { name: "review" }));
    expect(location.hash).toBe("#range=30&skill=review");
  });

  it("opens the palette over an open tool sheet, and Escape leaves the sheet open", async () => {
    mockApi({ "/api/usage": () => usage, "/api/tool": () => tool, "/api/palette": () => palette });
    at("#range=30&tool=Bash");
    render(<><ActivityPage /><Palette /></>);
    const sheet = document.querySelector<HTMLDialogElement>("dialog.sheet")!;
    expect(await within(sheet).findByText("Recent calls")).toBeTruthy();
    act(() => { dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, metaKey: true, bubbles: true })); openPalette(); });
    const pal = document.querySelector<HTMLDialogElement>("dialog.palette")!;
    expect([sheet.open, pal.open]).toEqual([true, true]);
    // Both are modal; the palette's showModal() comes later, so it is on top and holds focus.
    expect(pal.contains(document.activeElement)).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect([sheet.open, pal.open, location.hash]).toEqual([true, false, "#range=30&tool=Bash"]);
  });
});
