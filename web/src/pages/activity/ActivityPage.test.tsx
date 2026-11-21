import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DayView, Previous, ProjectRow, UsagePayload } from "../../api";
import { COLUMNS_KEY, resetColumnChoice } from "./sessionColumns";
import usage from "../../__fixtures__/usage";
import usageAll from "../../__fixtures__/usage-all";
import usageCodex from "../../__fixtures__/usage-codex";
import usageSources from "../../__fixtures__/usage-sources";
import sessions from "../../__fixtures__/sessions";
import session from "../../__fixtures__/session";
import tool from "../../__fixtures__/tool";
import palette from "../../__fixtures__/palette";
import { Palette } from "../../components/palette/Palette";
import { openPalette } from "../../components/palette/store";
import { mockApi } from "../../components/sheets/testing";
import { ActivityPage } from "./ActivityPage";
import { setSearch } from "../../url";
import { hookCommand, workDays } from "./work";
import { ingested, prevented, refreshed, renderApp, renderPage } from "../../testing";

const at = (hash = "?range=30") => history.replaceState(null, "", "/usage" + hash);
const serve = (d: UsagePayload) => mockApi({ "/api/usage": () => d, "/api/sessions": () => sessions, "/api/session": () => session });
const attention = () => within(document.getElementById("attention")!);
const loaded = () => screen.findByRole("heading", { level: 1, name: /commit/ });
const fetched = () => vi.mocked(fetch).mock.calls.map(c => c[0]);
const noDay = (day: string, days: 1 | 7 = 1): DayView => ({ day, days, start: day, end: day, by_project: [], tools: [], mcp: [], skills: [], hooks: [], error_loops: [], error_loops_total: 0, failed_tests: [], tests_failed: 0 });
/** The workbench tab that is selected, by its name. */
const selectedTab = () => screen.getAllByRole("tab").find(t => t.getAttribute("aria-selected") === "true")?.textContent;
/** Activates a workbench tab by its name, as a click does. */
const openTab = (name: string) => userEvent.click(screen.getByRole("tab", { name }));
/** The line under the lede: prompts interrupted, turns and tool calls per prompt. */
const interrupted = () => document.getElementById("interrupted")!;
/** The vitals' labels, in order. */
const labels = () => [...document.querySelectorAll("#vitals .vital .l")].map(l => l.firstChild!.textContent);
/** A vital's note. */
const note = (label: string) => vital(label).closest(".vital")!.querySelector(".d")!.textContent;
/** A promise settled from outside, for a request held in flight. */
const held = <T,>() => { let resolve!: (v: T) => void; const p = new Promise<T>(r => { resolve = r; }); return { p, resolve }; };
const paged = (all: { session_id: string }[]) => (q: URLSearchParams) => {
  const from = Number(q.get("offset") ?? 0), to = from + Number(q.get("limit") ?? 100);
  return { total: all.length, offset: from, sessions: all.slice(from, to) };
};
const many = (n: number, name = "Session") => Array.from({ length: n }, (_, k) => ({ ...sessions.sessions[0]!, session_id: `${name}${k}`, title: `${name} ${k}` }));
const quiet: UsagePayload = { ...usage, totals: { ...usage.totals, error_loops: 0, tests_failed: 0 }, error_loops: [], near_limit: [] };
/** All time by week: two weeks with work, to Thursday Nov 5. */
const weekly: UsagePayload = { ...usageAll, work_bucket: "week",
  work: [{ day: "2026-10-26", sessions: 2, prompts: 3, commits: 1, calls: 10, failed_calls: 1 }, { day: "2026-11-02", sessions: 3, prompts: 5, commits: 2, calls: 20, failed_calls: 2 }],
  work_projects: [] };
/** The Sessions panel's live hint. */
const hint = () => document.getElementById("sessions")!.querySelector(".hint [aria-live]")!.textContent;
const lastSessionsUrl = () => fetched().map(String).filter(u => u.startsWith("/api/sessions")).at(-1);

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
    expect(interrupted().textContent).toMatch(/^33\.3% of prompts interrupted \(1 of 3\), up from 0\.0%; /);
    expect(vital("Subagents").textContent).toBe("Subagents, down from 20%");
    expect([vital("Errors per 100 calls"), vital("Test runs passed"), interrupted()].map(worse)).toEqual([true, true, true]);
    expect(worse(vital("Subagents"))).toBe(false);
    // The median session, the active time in all and the thinking are in the Sessions note, without a change of their own.
    expect(note("Sessions")).toMatch(/; median session 5m, 9m active in all, 2s thinking\.$/);
  });

  it("does not mark a move the better way", async () => {
    // Errors down from 80, pass rate up from 25%, interruptions down from 50%; subagent share and session length up.
    serve(prior({ calls: 100, errors: 80, test_runs: 4, tests_passed: 1, prompts: 2, interrupted: 1, tokens: 100_000_000, sub_tokens: 1_000_000, median_session_seconds: 60 }));
    at();
    renderApp(<ActivityPage />);
    await loaded();
    expect(vital("Errors per 100 calls").textContent).toBe("Errors per 100 calls, down from 80.0");
    expect(vital("Test runs passed").textContent).toBe("Test runs passed, up from 25%");
    expect(interrupted().textContent).toMatch(/^33\.3% of prompts interrupted \(1 of 3\), down from 50\.0%; /);
    expect(vital("Subagents").textContent).toBe("Subagents, up from 1%");
    for (const l of ["Errors per 100 calls", "Test runs passed", "Subagents"]) expect(worse(vital(l))).toBe(false);
    expect(worse(interrupted())).toBe(false);
  });

  it("says unchanged for a figure that did not move", async () => {
    serve(prior({ calls: 10, errors: 6, test_runs: 2, tests_passed: 1, prompts: 3, interrupted: 1 }));
    at();
    renderApp(<ActivityPage />);
    await loaded();
    expect(vital("Errors per 100 calls").textContent).toBe("Errors per 100 calls, unchanged");
    expect(vital("Test runs passed").textContent).toBe("Test runs passed, unchanged");
    expect(interrupted().textContent).toMatch(/^33\.3% of prompts interrupted \(1 of 3\), unchanged; /);
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
    expect(note.textContent).toBe("2 active days, down from 3 active days; median session 5m, 9m active in all, 2s thinking.");
  });

  it("shows no change in the All range", async () => {
    serve(usageAll);
    at("?range=0");
    renderApp(<ActivityPage />);
    await loaded();
    expect(document.querySelector("#lede")!.textContent).not.toMatch(change);
    expect(document.getElementById("vitals")!.textContent).not.toMatch(change);
    expect(interrupted().textContent).not.toMatch(change);
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
    const [v, n] = tile("Output speed");
    expect(v).toBe("100 tok/s");
    expect(n).toMatch(/^2\.8h waiting on the model and 50m running tools, in 1 session/);
    expect(vital("Output speed").textContent).toBe("Output speed, down from 150 tok/s");
    expect(worse(vital("Output speed"))).toBe(true);
  });

  it("does not compare with a period that recorded no model time", async () => {
    expect(usage.previous!.output_per_s).toBeNull();
    serve(usage);
    at();
    renderApp(<ActivityPage />);
    await loaded();
    expect(vital("Output speed").textContent).toBe("Output speed");
  });

  it("gives Codex alone a quiet note instead of an Output speed tile, and names no model or tool time", async () => {
    serve(usageCodex);
    at("?range=30&source=codex");
    renderApp(<ActivityPage />);
    await loaded();
    expect(labels()).toEqual(["Sessions", "Errors per 100 calls", "Test runs passed", "Subagents"]);
    expect(document.querySelector("#vitals .vitals-note")!.textContent).toBe("Output speed: Codex transcripts record no model time.");
    expect(document.getElementById("vitals")!.textContent).not.toMatch(/waiting on the model|running tools|n\/a tok/);
  });

  it("names no tool time when the timed sessions state none, as Grok's do", async () => {
    serve({ ...usageSources, totals: { ...usageSources.totals, session_sources: ["grok"] } });
    at("?range=30&source=grok");
    renderApp(<ActivityPage />);
    await loaded();
    expect(usageSources.totals.tool_ms).toBeNull();
    expect(tile("Output speed")).toEqual(["100 tok/s", "1m waiting on the model, in 1 session, which record no tool time."]);
    expect(document.querySelector("#vitals .vitals-note")).toBeNull(); // Grok records model time: not the Codex note
  });

  it("says the tool time is the Claude Code sessions' alone when Grok sessions are timed beside them", async () => {
    serve({ ...usageSources, totals: { ...usageSources.totals, model_ms: 120_000, tool_ms: 30_000, timed_sessions: 2 } });
    at();
    renderApp(<ActivityPage />);
    await loaded();
    expect(tile("Output speed")[1]).toBe("2m waiting on the model, in 2 sessions, and 30s running tools in the Claude Code ones.");
  });

  it("says no session records model time when Claude Code sessions in the view have none", async () => {
    serve({ ...usage, totals: { ...usage.totals, output_per_s: null, timed_sessions: 0, model_ms: 0, tool_ms: 0 } });
    at();
    renderApp(<ActivityPage />);
    await loaded();
    expect(tile("Output speed")).toEqual(["n/a", "No session in this view records model time."]);
    // The thinking recorded still shows, on the Sessions vital.
    expect(note("Sessions")).toMatch(/, 2s thinking\.$/);
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
    expect(labels()).not.toContain("Output speed");
    expect(document.querySelector("#vitals .vitals-note")!.textContent).toBe("Output speed: Codex transcripts record no model time.");
  });

  it("draws the speed trend as a sparkline hidden from assistive technology, from two buckets", async () => {
    serve({ ...usage, speed_trend: [{ day: "2026-11-04", output_per_s: 90, sessions: 1 }, { day: "2026-11-05", output_per_s: 110, sessions: 2 }] });
    at();
    renderApp(<ActivityPage />);
    await loaded();
    const spark = vital("Output speed").closest(".vital")!.querySelector("svg.spark")!;
    expect(spark.getAttribute("aria-hidden")).toBe("true");
    expect(spark.querySelector("polyline")!.getAttribute("points")!.split(" ")).toHaveLength(2);
    cleanup();
    serve(usage); // one bucket: no line
    at();
    renderApp(<ActivityPage />);
    await loaded();
    expect(document.querySelector("#vitals svg.spark")).toBeNull();
  });
});

describe("vitals lead somewhere", () => {
  it("are at most six, each a link or a button", async () => {
    serve(usage);
    at();
    renderApp(<ActivityPage />);
    await loaded();
    const tiles = [...document.querySelectorAll("#vitals .vital")];
    expect(tiles.length).toBeLessThanOrEqual(6);
    expect(tiles.map(t => t.tagName)).toEqual(["BUTTON", "A", "BUTTON", "BUTTON", "BUTTON"]);
  });

  it("open Errors for the same view", async () => {
    serve({ ...usage, project: "foo", source: "claude" });
    at("?range=30&project=foo&source=claude");
    renderApp(<ActivityPage />);
    await loaded();
    const a = vital("Errors per 100 calls").closest("a")!;
    expect(a.getAttribute("href")).toMatch(/^\/errors\?/);
    const q = new URLSearchParams(a.getAttribute("href")!.split("?")[1]);
    expect([q.get("project"), q.get("range"), q.get("source")]).toEqual(["foo", "30", "claude"]);
  });

  it("open the Sessions tab, the failed test runs, Projects by subagent share and Sessions by output speed", async () => {
    serve(usage);
    at("?range=30&tab=tools");
    renderApp(<ActivityPage />);
    await loaded();
    await userEvent.click(vital("Test runs passed").closest("button")!);
    expect(selectedTab()).toBe("Loops and tests");
    expect(location.search).toContain("tab=loops");
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 3, name: /^Failed test runs/ }));
    await userEvent.click(vital("Subagents").closest("button")!);
    expect(selectedTab()).toBe("Projects");
    expect(screen.getByRole("columnheader", { name: /Subagents/ }).getAttribute("aria-sort")).toBe("descending");
    expect(document.activeElement).toBe(screen.getByRole("tabpanel"));
    await userEvent.click(vital("Output speed").closest("button")!);
    expect(selectedTab()).toBe("Sessions");
    expect(location.search).not.toContain("tab=");
    await waitFor(() => expect(fetched().map(String)).toContain("/api/sessions?range=30&sort=output_per_s&desc=1"));
    await userEvent.click(screen.getByRole("tab", { name: "Projects" }));
    await userEvent.click(vital("Sessions").closest("button")!);
    expect(selectedTab()).toBe("Sessions");
    expect(document.activeElement).toBe(screen.getByRole("tabpanel"));
  });

  it("move the focus once: a later tab change does not replay it", async () => {
    serve(usage);
    at();
    renderApp(<ActivityPage />);
    await loaded();
    await userEvent.click(vital("Test runs passed").closest("button")!);
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 3, name: /^Failed test runs/ }));
    await openTab("Projects");
    const loops = screen.getByRole("tab", { name: "Loops and tests" });
    act(() => loops.focus());
    await userEvent.keyboard("{Enter}");
    expect(selectedTab()).toBe("Loops and tests");
    expect(document.activeElement).toBe(loops);
  });
});

describe("workbench tabs", () => {
  it("render only the selected tab's tables, and name every table with row and column headers", async () => {
    serve(usage);
    at();
    renderApp(<ActivityPage />);
    await loaded();
    expect(screen.getByRole("tablist", { name: "Activity detail" })).toBeTruthy();
    expect(screen.getAllByRole("tab").map(t => t.textContent)).toEqual(["Sessions", "Projects", "Tools and MCP", "Loops and tests"]);
    expect(selectedTab()).toBe("Sessions");
    expect(screen.queryByRole("table", { name: "Tools" })).toBeNull();
    // Every tab names a panel; only the selected one holds anything.
    for (const t of screen.getAllByRole("tab")) expect(document.getElementById(t.getAttribute("aria-controls")!)).toBeTruthy();
    const tables: [string, string][] = [["Projects", "Project metrics"], ["Tools and MCP", "Tools"], ["Tools and MCP", "MCP servers"], ["Tools and MCP", "Skills"],
      ["Tools and MCP", "Hooks"], ["Loops and tests", "Error loops"], ["Loops and tests", "Failed test runs"], ["Sessions", "Sessions"]];
    for (const [tab, name] of tables) {
      await openTab(tab);
      const table = await screen.findByRole("table", { name });
      expect(screen.getByRole("region", { name }).tabIndex).toBe(0);
      expect(within(table).getAllByRole("columnheader").every(h => h.getAttribute("scope") === "col")).toBe(true);
      expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(screen.getByRole("tab", { name: tab }).id);
    }
    await openTab("Tools and MCP");
    expect(within(screen.getByRole("table", { name: "Tools" })).getAllByRole("rowheader")[0]!.getAttribute("scope")).toBe("row");
    await openTab("Projects");
    expect(within(screen.getByRole("table", { name: "Project metrics" })).getAllByRole("rowheader").map(h => h.textContent)).toContain("foo");
  });

  it("follow the WAI-ARIA keys: one tab stop, arrows move with wrap, Home and End, Enter activates", async () => {
    serve(usage);
    at();
    renderApp(<ActivityPage />);
    await loaded();
    const tabs = () => screen.getAllByRole("tab");
    expect(tabs().map(t => t.tabIndex)).toEqual([0, -1, -1, -1]);
    act(() => tabs()[0]!.focus());
    await userEvent.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Loops and tests" }));
    // Manual activation: moving the focus selects nothing and writes no URL.
    expect(selectedTab()).toBe("Sessions");
    expect(location.search).not.toContain("tab=");
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(tabs()[0]);
    await userEvent.keyboard("{End}");
    expect(document.activeElement).toBe(tabs()[3]);
    await userEvent.keyboard("{Home}{ArrowRight}");
    expect(document.activeElement).toBe(tabs()[1]);
    expect(tabs().map(t => t.tabIndex)).toEqual([-1, 0, -1, -1]);
    const len = history.length;
    await userEvent.keyboard("{Enter}");
    expect(selectedTab()).toBe("Projects");
    expect(location.search).toBe("?range=30&tab=projects");
    expect(history.length).toBe(len); // written without a history entry
    await userEvent.keyboard("{ArrowRight} ");
    expect(selectedTab()).toBe("Tools and MCP");
    expect(location.search).toContain("tab=tools");
    // Tab leaves the tablist for the selected panel, as on Context.
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("tabpanel"));
    expect(screen.getByRole("tabpanel").tabIndex).toBe(0);
  });

  it("leave keys with Alt, Ctrl, Meta or Shift to the browser, as the work chart does", async () => {
    serve(usage);
    at();
    renderApp(<ActivityPage />);
    await loaded();
    const first = screen.getAllByRole("tab")[0]!;
    act(() => first.focus());
    expect(prevented(first)).toEqual([]);
    expect(document.activeElement).toBe(first);
    const chart = screen.getByRole("group", { name: /^Commits/ });
    expect(prevented(chart)).toEqual([]);
    expect(screen.queryByRole("tooltip")).toBeNull();
    // A modified Escape keeps an open reading, on the chart and anywhere else on the page.
    act(() => chart.focus());
    fireEvent.keyDown(chart, { key: "ArrowRight" });
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.keyDown(chart, { key: "Escape", altKey: true });
    fireEvent.keyDown(document.body, { key: "Escape", ctrlKey: true });
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

});

describe("work panel", () => {
  it("orders the interrupted line, attention, the work chart, the vitals, then the tabs", async () => {
    serve(usage);
    at();
    renderApp(<ActivityPage />);
    await loaded();
    const order = ["interrupted", "attention", "work", "vitals", "workbench"].map(id => document.getElementById(id)!);
    order.slice(1).forEach((el, i) => expect(order[i]!.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy());
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

  it("says the Sessions drawer counts a session by a request in the range", async () => {
    serve(usage);
    at();
    renderApp(<ActivityPage />);
    await loaded();
    const drawer = document.getElementById("sessions")!;
    const how = within(drawer).getByRole("button", { name: "How measured: the session count" });
    await userEvent.click(how);
    expect(within(how.parentElement!).getByRole("tooltip").textContent).toMatch(/A session counts here when it has a request in the range; the Judgments view counts sessions by their start time/);
  });

  it("narrows to Codex when picked, records it in the URL, and reloads an open sessions table", async () => {
    const codex: UsagePayload = { ...usage, source: "codex", totals: { ...usage.totals, commits: 0, prompts: 1, sessions: 1, active_days: 1 } };
    mockApi({ "/api/usage": q => (q.get("source") === "codex" ? codex : usage), "/api/sessions": () => sessions, "/api/session": () => session });
    at();
    renderPage(<ActivityPage />);
    await loaded();
    await openTab("Sessions");
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30"));
    await userEvent.click(within(screen.getByRole("group", { name: "Source" })).getByRole("button", { name: "Codex" }));
    expect(location.search).toBe("?range=30&source=codex");
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&source=codex"));
    expect(fetched()).toContain("/api/usage?range=30&source=codex");
    // The lede counts down from the figure shown before to the new one.
    expect((await screen.findByRole("heading", { level: 1, name: /^0 commits/ })).textContent).toBe("0 commits from 1 prompt, unchanged");
  });

  it("pages the sessions table: Show more appends the next page and focuses its first new row", async () => {
    mockApi({ "/api/usage": () => usage, "/api/sessions": paged(many(250)) });
    at();
    renderApp(<ActivityPage />);
    await loaded();
    const drawer = within(document.getElementById("sessions")!);
    await drawer.findByRole("button", { name: "Session 99" });
    expect(document.querySelectorAll("#sessions tbody tr")).toHaveLength(100);
    expect(hint()).toContain("Showing 100.");
    await userEvent.click(drawer.getByRole("button", { name: "Show more sessions" }));
    await waitFor(() => expect(document.activeElement).toBe(drawer.getByRole("button", { name: "Session 100" })));
    expect(document.querySelectorAll("#sessions tbody tr")).toHaveLength(200);
    expect(fetched().filter(u => String(u).startsWith("/api/sessions"))).toEqual(["/api/sessions?range=30", "/api/sessions?range=30&offset=100"]);
  });

  it("waits 200 ms after typing to search, keeps the rows inert meanwhile, then replaces them", async () => {
    const found = held<unknown>();
    mockApi({ "/api/usage": () => usage, "/api/sessions": q => (q.get("q") ? found.p : { total: 100, offset: 0, sessions: many(100) }) });
    at();
    renderApp(<ActivityPage />);
    await loaded();
    const drawer = within(document.getElementById("sessions")!), tbody = () => document.querySelector("#sessions tbody")!;
    await drawer.findByRole("button", { name: "Session 0" });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      fireEvent.change(drawer.getByRole("searchbox", { name: "Search sessions" }), { target: { value: "needle" } });
      await act(async () => { await vi.advanceTimersByTimeAsync(150); });
      expect(fetched().some(u => String(u).startsWith("/api/sessions") && String(u).includes("q=needle"))).toBe(false);
      await act(async () => { await vi.advanceTimersByTimeAsync(100); });
      await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&q=needle"));
      await waitFor(() => expect(hint()).toBe("Searching for “needle”…"));
      expect(tbody().hasAttribute("inert")).toBe(true);
      expect(drawer.getByRole("button", { name: "Session 0" })).toBeTruthy();
      await act(async () => { found.resolve({ total: 1, offset: 0, sessions: many(1, "Hit") }); await found.p; });
      await waitFor(() => expect(drawer.getByRole("button", { name: "Hit 0" })).toBeTruthy());
    } finally { vi.useRealTimers(); }
    expect(drawer.queryByRole("button", { name: "Session 0" })).toBeNull();
    expect(tbody().hasAttribute("inert")).toBe(false);
    expect(hint()).toMatch(/^1 session match/);
  });

  it("says a search failed, with Retry, and shows no rows of the earlier query", async () => {
    let down = true;
    mockApi({ "/api/usage": () => usage, "/api/sessions": q => (q.get("q") && down ? undefined : { total: 100, offset: 0, sessions: many(100) }) });
    at("?range=30&q=needle");
    renderApp(<ActivityPage />);
    await loaded();
    const drawer = within(document.getElementById("sessions")!);
    expect(await drawer.findByRole("alert")).toBeTruthy();
    expect(drawer.getByRole("alert").textContent).toMatch(/^Could not load sessions \(.+\)\. Retry$/);
    expect(hint()).toBe("Search for “needle” failed.");
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
    const drawer = within(document.getElementById("sessions")!);
    await drawer.findByRole("button", { name: "Session 99" });
    await userEvent.click(drawer.getByRole("button", { name: "Show more sessions" }));
    await waitFor(() => expect(hint()).toMatch(/^Could not load more sessions \(.+\)\. Select Show more to try again\.$/));
    expect(document.querySelectorAll("#sessions tbody tr")).toHaveLength(100);
    down = false;
    await userEvent.click(drawer.getByRole("button", { name: "Show more sessions" }));
    await waitFor(() => expect(document.querySelectorAll("#sessions tbody tr")).toHaveLength(200));
    expect(hint()).toContain("Showing 200.");
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
    mockApi({ "/api/usage": () => ({ ...usage, totals: { ...usage.totals, sessions: 2 + n++ } }), "/api/sessions": paged(many(250)) });
    at();
    const { client } = renderApp(<ActivityPage />);
    await loaded();
    await openTab("Sessions");
    await screen.findByRole("button", { name: "Session 99" });
    await userEvent.click(screen.getByRole("button", { name: "Show more sessions" }));
    const row = await screen.findByRole("button", { name: "Session 150" });
    act(() => row.focus());
    const before = fetched().length;
    ingested(client);
    // One request per loaded page, first page first.
    await waitFor(() => expect(fetched().slice(before).filter(u => String(u).startsWith("/api/sessions"))).toEqual(["/api/sessions?range=30", "/api/sessions?range=30&offset=100"]));
    await waitFor(() => expect(document.querySelector("#sessions tbody")!.getAttribute("aria-busy")).toBeNull());
    expect(document.querySelectorAll("#sessions tbody tr")).toHaveLength(200);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Session 150" }));
    expect(document.querySelector("#sessions tbody")!.hasAttribute("inert")).toBe(false);
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
    expect(selectedTab()).toBe("Loops and tests");
    // The payload carries the newest loops only: the list counts them all and says so.
    const list = document.getElementById("loops")!;
    expect(list.querySelector("h3")!.textContent).toMatch(/Error loops\s*3/);
    expect(document.activeElement).toBe(list.querySelector("h3"));
    expect(within(list).getByText(/Showing the 1 newest of 3\./)).toBeTruthy();
    const sess = [...list.querySelectorAll<HTMLElement>("tbody button[data-session]")];
    expect(sess.length).toBeGreaterThan(0);
    for (const b of sess) expect(b.getAttribute("data-subject")).toBe(`session:${b.dataset.session}`);
    await userEvent.click(attention().getByRole("button", { name: "See it" }));
    expect(selectedTab()).toBe("Sessions");
    expect(screen.getByRole("checkbox", { name: "Near context limit only" })).toHaveProperty("checked", true);
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&near=1"));
  });

  it("sorts sessions on the server, keeps the sort for Show more, and never reorders a page", async () => {
    mockApi({ "/api/usage": () => usage, "/api/sessions": paged(many(250).map((s, k) => ({ ...s, cost: k % 7 }))) });
    at();
    renderApp(<ActivityPage />);
    await loaded();
    await openTab("Sessions");
    const drawer = within(document.getElementById("sessions")!);
    await drawer.findByRole("button", { name: "Session 99" });
    expect(drawer.queryByRole("button", { name: "Project" })).toBeNull();
    const cost = drawer.getByRole("button", { name: "Est. cost" });
    await userEvent.click(cost);
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&sort=cost&desc=1"));
    expect([...document.querySelectorAll("#sessions th[aria-sort]")].map(th => [th.textContent, th.getAttribute("aria-sort")])).toEqual([["Est. cost↓", "descending"]]);
    // The rows keep the server's order: costs 0, 1, 2… are not reordered in the browser.
    await waitFor(() => expect(document.querySelector("#sessions tbody tr button")!.textContent).toBe("Session 0"));
    await userEvent.click(drawer.getByRole("button", { name: "Show more sessions" }));
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&offset=100&sort=cost&desc=1"));
    await userEvent.click(cost);
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&sort=cost"));
    expect(cost.closest("th")!.getAttribute("aria-sort")).toBe("ascending");
    expect(location.search).toBe("?range=30");
  });

  it("shows each session's model time and output speed, a dash for one that records none", async () => {
    serve(usage);
    at();
    renderApp(<ActivityPage />);
    await loaded();
    const body = await waitFor(() => { const b = document.querySelector("#sessions tbody")!; expect(b.querySelectorAll("tr")).toHaveLength(3); return b; });
    const keys = [...document.querySelectorAll<HTMLElement>("#sessions thead th")].map(c => c.dataset.sort), col = (k: string) => keys.indexOf(k);
    expect([col("model_ms"), col("output_per_s")]).toEqual([col("duration_s") + 1, col("duration_s") + 2]);
    const figures = (id: string) => {
      const cells = [...body.querySelectorAll("tr")][sessions.sessions.findIndex(s => s.session_id === id)]!.querySelectorAll(":scope > *");
      return [cells[col("model_ms")]!.textContent, cells[col("output_per_s")]!.textContent];
    };
    expect(figures("s1")).toEqual(["2.8h", "100"]);
    expect(figures("s2")).toEqual(["–", "–"]);
    // The sorted column is marked on its header and every cell, so a narrow screen keeps it shown.
    const sortedCols = () => [...document.querySelectorAll<HTMLElement>("#sessions thead th.sorted")].map(c => c.dataset.sort);
    expect(sortedCols()).toEqual([]);
    await userEvent.click(vital("Output speed").closest("button")!);
    await waitFor(() => expect(sortedCols()).toEqual(["output_per_s"]));
    await waitFor(() => expect([...body.querySelectorAll("tr")].every(r => r.querySelectorAll(":scope > *")[col("output_per_s")]!.classList.contains("sorted"))).toBe(true));
    expect(body.querySelectorAll(".sorted")).toHaveLength(body.querySelectorAll("tr").length);
  });

  it("sends each sortable Sessions column's own key, and the hint says the order", async () => {
    serve(usage);
    at();
    renderApp(<ActivityPage />);
    await loaded();
    const drawer = within(document.getElementById("sessions")!);
    const keys: [string, string, string][] = [["Session", "first_ts", "newest first"], ["Active", "duration_s", "longest active time first"],
      ["Model", "model_ms", "most model time first"], ["Tok/s", "output_per_s", "fastest output first"], ["Prompts", "prompts", "most prompts first"],
      ["Tokens", "tokens", "most tokens first"], ["Est. cost", "cost", "costliest first"],
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

  it("keeps the Sessions sort when new data refreshes the table", async () => {
    let n = 0;
    mockApi({ "/api/usage": () => ({ ...usage, totals: { ...usage.totals, sessions: 2 + n++ } }), "/api/sessions": () => sessions });
    at();
    const { client } = renderApp(<ActivityPage />);
    await loaded();
    await userEvent.click(within(document.getElementById("sessions")!).getByRole("button", { name: "Est. cost" }));
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&sort=cost&desc=1"));
    await waitFor(() => expect(document.querySelector("#sessions tbody")!.getAttribute("aria-busy")).toBeNull());
    ingested(client);
    await waitFor(() => expect(fetched().filter(u => u === "/api/sessions?range=30&sort=cost&desc=1")).toHaveLength(2));
  });

  it("drops a Show more page that answers after the sort changed", async () => {
    const all = many(250), stale = held<unknown>(), page = paged(all);
    mockApi({ "/api/usage": () => usage, "/api/sessions": q => (q.get("offset") ? stale.p : page(q)) });
    at();
    renderApp(<ActivityPage />);
    await loaded();
    const drawer = within(document.getElementById("sessions")!);
    await drawer.findByRole("button", { name: "Session 99" });
    await userEvent.click(drawer.getByRole("button", { name: "Show more sessions" }));
    await userEvent.click(drawer.getByRole("button", { name: "Est. cost" }));
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&sort=cost&desc=1"));
    await waitFor(() => expect(document.querySelector("#sessions tbody")!.getAttribute("aria-busy")).toBeNull());
    await act(async () => { stale.resolve({ total: 250, offset: 100, sessions: many(100, "Stale") }); await stale.p; });
    expect(drawer.queryByRole("button", { name: "Stale 0" })).toBeNull();
    expect(document.querySelectorAll("#sessions tbody tr")).toHaveLength(100);
  });

  it("sorts projects and tools in the browser, projects by sessions first, empty values last", async () => {
    const p0 = usage.by_project[0]!, proj = (project: string, sessions: number, tokens_per_prompt: number | null): ProjectRow => ({ ...p0, project, sessions, tokens_per_prompt });
    serve({ ...usage, by_project: [proj("a", 1, null), proj("b", 5, 10), proj("c", 3, 20)] });
    at();
    renderApp(<ActivityPage />);
    await loaded();
    await openTab("Projects");
    const order = (id: string) => [...document.querySelectorAll(`#${id} tbody tr`)].map(r => r.getAttribute("data-v"));
    const projects = within(document.getElementById("projects")!);
    expect(order("projects")).toEqual(["b", "c", "a"]);
    expect(projects.getByRole("button", { name: "Sessions" }).closest("th")!.getAttribute("aria-sort")).toBe("descending");
    expect(document.getElementById("projects")!.querySelector("thead")!.textContent).not.toMatch(/cost/i);
    await userEvent.click(projects.getByRole("button", { name: "Tokens / prompt" }));
    expect(order("projects")).toEqual(["c", "b", "a"]);
    await userEvent.click(projects.getByRole("button", { name: "Tokens / prompt" }));
    expect(order("projects")).toEqual(["b", "c", "a"]);
    await openTab("Tools and MCP");
    expect(order("tools")).toEqual(usage.tools.map(t => t.tool));
    const failed = within(document.getElementById("tools")!).getByRole("button", { name: "Failed" });
    await userEvent.click(failed);
    expect(order("tools")[0]).toBe("Edit");
    expect(failed.closest("th")!.getAttribute("aria-sort")).toBe("descending");
    await userEvent.click(failed);
    expect(order("tools").at(-1)).toBe("Edit");
    // Only the page and the Sessions tab it opened on asked the server; the sorts asked nothing.
    expect(fetched().filter(u => !String(u).startsWith("/api/usage") && u !== "/api/sessions?range=30")).toEqual([]);
  });

  it("restores the sessions filters from the hash and writes them without new history entries", async () => {
    mockApi({ "/api/usage": () => usage, "/api/sessions": () => sessions, "/api/day": () => noDay("2026-11-04") });
    at("?range=30&day=2026-11-04&q=api&near=1");
    renderApp(<ActivityPage />);
    await loaded();
    await openTab("Sessions");
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&q=api&near=1&day=2026-11-04"));
    const search = screen.getByRole<HTMLInputElement>("searchbox", { name: "Search sessions" });
    expect(search.value).toBe("api");
    expect(screen.getByRole("checkbox", { name: "Near context limit only" })).toHaveProperty("checked", true);
    expect(document.querySelector("#work .daychip")!.textContent).toBe("Nov 4✕");
    expect(screen.getByRole("tabpanel").querySelector(".scope")!.textContent).toMatch(/^Nov 4, 2026 only\./);
    const n = history.length;
    await userEvent.type(search, "x");
    await userEvent.click(screen.getByRole("checkbox", { name: "Near context limit only" }));
    expect(location.search).toBe("?range=30&day=2026-11-04&q=apix");
    expect(history.length).toBe(n);
  });

  it("clears the day when the project, range or source changes", async () => {
    mockApi({ "/api/usage": () => usage, "/api/sessions": () => sessions, "/api/day": () => noDay("2026-11-04") });
    at("?range=30&day=2026-11-04&q=api");
    renderPage(<ActivityPage />);
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
    renderPage(<ActivityPage />);
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

  it("narrows every tab to the selected day: projects, tools, MCP & hooks, error loops and failed tests", async () => {
    const day: DayView = {
      ...noDay("2026-11-04"), tools: [{ tool: "Grep", calls: 2, errors: 0, failure_rate: 0, p50_ms: 10, p95_ms: 20 }],
      mcp: [{ name: "daysrv", calls: 1, errors: 0, failure_rate: 0 }], by_project: [{ ...usage.by_project[0]!, project: "dayproj" }],
      error_loops: [{ ...usage.error_loops[0]!, first_id: "dl1" }], error_loops_total: 7, tests_failed: 0,
    };
    mockApi({ "/api/usage": () => usage, "/api/sessions": () => sessions, "/api/day": () => day });
    at("?range=30&day=2026-11-04");
    renderApp(<ActivityPage />);
    await loaded();
    await openTab("Tools and MCP");
    const tools = () => within(document.getElementById("tools")!), panel = () => within(screen.getByRole("tabpanel"));
    expect(await tools().findByRole("button", { name: "Grep" })).toBeTruthy();
    expect(tools().queryByRole("button", { name: "Edit" })).toBeNull();
    expect(fetched()).toContain("/api/day?range=30&day=2026-11-04");
    expect(panel().getByText(/^Nov 4, 2026 only\./)).toBeTruthy();
    expect(within(document.getElementById("ext")!).getByRole("button", { name: "daysrv" })).toBeTruthy();
    await openTab("Loops and tests");
    const loops = document.getElementById("loops")!;
    expect(loops.querySelector("h3")!.textContent).toMatch(/Error loops\s*7/);
    expect(loops.querySelector("a")!.getAttribute("href")).toContain("ex=dl1");
    expect(within(document.getElementById("tests")!).getByText("No failed test runs on Nov 4, 2026.")).toBeTruthy();
    await openTab("Projects");
    expect(within(document.getElementById("projects")!).getByRole("button", { name: "dayproj" })).toBeTruthy();
    // Attention stays range-wide; the sessions table says which figures are whole-session.
    expect(attention().getByText("1 failed test run")).toBeTruthy();
    await openTab("Sessions");
    await userEvent.click(screen.getByRole("button", { name: "About Peak context" }));
    expect(screen.getByRole("button", { name: "Peak context" }).closest("th")!.querySelector("[role=tooltip]")!.textContent).toMatch(/whole-session/i);
    await openTab("Tools and MCP");
    await userEvent.click(panel().getByRole("button", { name: "Show the whole range" }));
    expect(location.search).toBe("?range=30&tab=tools");
    expect(await tools().findByRole("button", { name: "Edit" })).toBeTruthy();
    expect(tools().queryByRole("button", { name: "Grep" })).toBeNull();
    expect(within(document.getElementById("ext")!).getByRole("button", { name: "srv" })).toBeTruthy();
    expect(screen.getByRole("tabpanel").querySelector(".scope")).toBeNull();
    await openTab("Sessions");
    expect(screen.getByRole("button", { name: "Peak context" }).closest("th")!.getAttribute("title")).toBeNull();
  });

  it("selects a week on the chart by click, narrows the tabs to its seven days, and clears it with the chip or Escape", async () => {
    const week: DayView = { ...noDay("2026-11-02", 7), tools: [{ tool: "Grep", calls: 2, errors: 0, failure_rate: 0, p50_ms: 10, p95_ms: 20 }] };
    // The week's sessions are not the range's: a wrong day or span would list the range's.
    const inWeek = { total: 1, offset: 0, sessions: [{ ...sessions.sessions[0]!, session_id: "wk" }] };
    mockApi({ "/api/usage": () => weekly, "/api/day": () => week,
      "/api/sessions": q => (q.get("day") === "2026-11-02" && q.get("days") === "7" ? inWeek : q.has("day") || q.has("days") ? undefined : sessions) });
    at("?range=0&q=fix&tab=tools");
    renderApp(<ActivityPage />);
    await loaded();
    const chart = screen.getByRole("group", { name: /^Commits per week/ });
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, right: 800, bottom: 216, width: 800, height: 216, x: 0, y: 0, toJSON: () => ({}) });
    const n = history.length;
    fireEvent.click(chart.querySelector(".hit")!, { clientX: 700 }); // the second of two bars: the week of Nov 2
    expect(location.search).toBe("?range=0&tab=tools&week=2026-11-02");
    expect(history.length).toBe(n);
    await waitFor(() => expect(fetched()).toContain("/api/day?range=0&day=2026-11-02&days=7"));
    expect(await within(document.getElementById("tools")!).findByRole("button", { name: "Grep" })).toBeTruthy();
    // The view ends on Thursday Nov 5: the panel names the days it counts.
    expect(screen.getByRole("tabpanel").querySelector(".scope")!.textContent).toMatch(/^Nov 2 – Nov 5, 2026 only\./);
    expect(document.querySelector("#work .daychip")!.textContent).toBe("Week of Nov 2✕");
    // The Sessions tab asks for the week's seven days, costliest first.
    await openTab("Sessions");
    await waitFor(() => expect(fetched().filter(u => String(u).startsWith("/api/sessions?")).at(-1)).toMatch(/[?&]day=2026-11-02&days=7(&|$)/));
    await waitFor(() => expect(hint()).toContain("by their cost on those days"));
    const rows = within(document.getElementById("sessions")!);
    expect(await rows.findByRole("button", { name: "#wk" })).toBeTruthy();
    expect(rows.queryByRole("button", { name: "#s1" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Clear week of Nov 2, 2026" }));
    expect(location.search).toBe("?range=0");
    expect(document.querySelector("#work .daychip")).toBeNull();
    expect(await within(document.getElementById("sessions")!).findByRole("button", { name: "#s1" })).toBeTruthy();
    // By keyboard: Home, Enter selects the first week; Escape clears it.
    act(() => chart.focus());
    fireEvent.keyDown(chart, { key: "Home" });
    fireEvent.keyDown(chart, { key: "Enter" });
    expect(location.search).toBe("?range=0&week=2026-10-26");
    fireEvent.keyDown(chart, { key: "Escape" });
    expect(location.search).toBe("?range=0");
    // A day selection replaces a week one, and back.
    act(() => setSearch({ week: "2026-10-26" }));
    act(() => setSearch({ day: "2026-10-27", week: null }));
    expect(location.search).toBe("?range=0&day=2026-10-27");
  });

  it("takes no pick from the previous view's chart while a new range loads", async () => {
    const wait = held<unknown>();
    mockApi({ "/api/usage": q => (q.get("range") === "30" ? wait.p : weekly), "/api/sessions": () => sessions, "/api/day": () => noDay("2026-11-02", 7) });
    at("?range=0");
    renderApp(<ActivityPage />);
    await loaded();
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, right: 800, bottom: 216, width: 800, height: 216, x: 0, y: 0, toJSON: () => ({}) });
    act(() => setSearch({ range: 30 }));
    await waitFor(() => expect(fetched().map(String)).toContain("/api/usage?range=30"));
    // The all-time weekly chart is still drawn: Enter and a click on it write nothing.
    const chart = screen.getByRole("group", { name: /^Commits per week/ });
    act(() => chart.focus());
    fireEvent.keyDown(chart, { key: "End" });
    fireEvent.keyDown(chart, { key: "Enter" });
    fireEvent.click(chart.querySelector(".hit")!, { clientX: 700 });
    expect(location.search).toBe("?range=30");
    await act(async () => { wait.resolve(usage); await wait.p; });
    await waitFor(() => expect(screen.getByRole("group", { name: /^Commits per day/ })).toBeTruthy());
  });

  it("drops a week the view does not reach, and a day that is not a Monday", async () => {
    mockApi({ "/api/usage": () => usage, "/api/sessions": () => sessions, "/api/day": () => noDay("2026-09-07", 7) });
    at("?range=30&week=2026-09-07"); // the view starts on Oct 7
    renderApp(<ActivityPage />);
    await loaded();
    await waitFor(() => expect(location.search).toBe("?range=30"));
    expect(document.querySelector("#work .daychip")).toBeNull();
    cleanup();
    mockApi({ "/api/usage": () => usage, "/api/sessions": () => sessions });
    at("?range=30&week=2026-11-04");
    renderApp(<ActivityPage />);
    await loaded();
    expect(document.querySelector("#work .daychip")).toBeNull();
    expect(screen.getByRole("tabpanel").querySelector(".scope")).toBeNull();
  });

  it("names the days a week keeps when the view starts inside it", async () => {
    mockApi({ "/api/usage": () => ({ ...usage, work_bucket: "week" }), "/api/sessions": () => sessions, "/api/day": () => noDay("2026-10-05", 7) });
    at("?range=30&week=2026-10-05"); // the view starts on Wednesday Oct 7
    renderApp(<ActivityPage />);
    await loaded();
    expect(screen.getByRole("tabpanel").querySelector(".scope")!.textContent).toMatch(/^Oct 7 – Oct 11, 2026 only\./);
    await openTab("Loops and tests");
    expect(await screen.findByText(/^No failed test runs from Oct 7 to Oct 11, 2026/)).toBeTruthy();
  });

  it("moves the focus to the chart when the panel's own clear removes its button", async () => {
    mockApi({ "/api/usage": () => usage, "/api/sessions": () => sessions, "/api/day": () => noDay("2026-11-04") });
    at("?range=30&day=2026-11-04");
    renderApp(<ActivityPage />);
    await loaded();
    const btn = within(screen.getByRole("tabpanel")).getByRole("button", { name: "Show the whole range" });
    act(() => btn.focus());
    await userEvent.keyboard("{Enter}");
    expect(location.search).toBe("?range=30");
    expect(document.activeElement).toBe(screen.getByRole("group", { name: /^Commits per day/ }));
  });

  it("keeps the selection's figures honest: a vital or attention action reports the range, so it clears the selection", async () => {
    mockApi({ "/api/usage": () => ({ ...usage, work_bucket: "week" }), "/api/sessions": () => sessions, "/api/day": () => noDay("2026-11-02", 7) });
    at("?range=30&week=2026-11-02");
    renderApp(<ActivityPage />);
    await loaded();
    await userEvent.click(vital("Test runs passed").closest("button")!);
    expect(location.search).toBe("?range=30&tab=loops");
    expect(screen.getByRole("heading", { level: 3, name: /^Failed test runs/ }).textContent).not.toMatch(/week|Nov 2/);
    act(() => setSearch({ week: "2026-11-02" }));
    await userEvent.click(attention().getByRole("button", { name: "See tests" }));
    expect(location.search).toBe("?range=30&tab=loops");
  });

  it("keeps the week when a sheet closes with Escape", async () => {
    mockApi({ "/api/usage": () => ({ ...usageAll, work_bucket: "week" }), "/api/sessions": () => sessions, "/api/session": () => session, "/api/day": () => noDay("2026-11-02", 7) });
    at("?range=0&week=2026-11-02");
    renderPage(<ActivityPage />);
    await loaded();
    const row = await within(document.getElementById("sessions")!).findByRole("button", { name: "#s1" });
    await userEvent.click(row);
    expect(location.search).toBe("?range=0&week=2026-11-02&session=s1");
    expect(await within(document.querySelector("dialog")!).findByText("Timeline")).toBeTruthy();
    act(() => { document.querySelector("dialog")!.dispatchEvent(new Event("cancel", { cancelable: true })); });
    await waitFor(() => expect(location.search).toBe("?range=0&week=2026-11-02"));
  });

  it("does not label the range rows as the day while the day loads or after it fails", async () => {
    const wait = held<unknown>();
    let fail = false;
    mockApi({ "/api/usage": () => ({ ...usage, hooks: [] }), "/api/sessions": () => sessions, "/api/day": () => (fail ? undefined : wait.p) });
    at("?range=30&day=2026-11-04");
    renderApp(<ActivityPage />);
    await loaded();
    await openTab("Tools and MCP");
    const tools = within(document.getElementById("tools")!), ext = document.getElementById("ext")!, panel = within(screen.getByRole("tabpanel"));
    expect(panel.getByText(/^Loading Nov 4, 2026…; showing the whole range\./)).toBeTruthy();
    expect(tools.getByRole("button", { name: "Edit" })).toBeTruthy();
    expect(within(ext).getByText("None in this range.")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Nov 4, 2026 only|None on Nov 4/);
    fail = true;
    act(() => setSearch({ day: "2026-11-05" }));
    expect(await panel.findByText(/^Could not load Nov 5, 2026 \(HTTP 404\); showing the whole range\./)).toBeTruthy();
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
    await openTab("Tools and MCP");
    const tools = within(document.getElementById("tools")!);
    expect(await tools.findByRole("button", { name: "Grep" })).toBeTruthy();
    act(() => setSearch({ day: "2026-11-05" }));
    await waitFor(() => expect(tools.queryByRole("button", { name: "Grep" })).toBeNull());
    await act(async () => { second.resolve({ ...noDay("2026-11-05"), tools: [{ ...grep, tool: "Glob" }] }); await second.p; });
    expect(await tools.findByRole("button", { name: "Glob" })).toBeTruthy();
    expect(tools.queryByRole("button", { name: "Grep" })).toBeNull();
  });

  it("heads each row of Error loops and Failed test runs with its session, in the first column, then its time", async () => {
    const t = { id: "t9", session_id: "s1", title: "Fix upload", project: "bar", source: "codex" as const, command: "npm test", ts: "2026-11-04T10:07:00.000Z" };
    serve({ ...usage, totals: { ...usage.totals, tests_failed: 1 }, failed_tests: [t] });
    at("?range=30&tab=loops");
    renderApp(<ActivityPage />);
    await loaded();
    for (const name of ["Error loops", "Failed test runs"]) {
      const table = screen.getByRole("table", { name });
      expect([...table.querySelectorAll("thead th")].slice(0, 2).map(h => h.textContent)).toEqual(["Session", "When"]);
      const rows = [...table.querySelectorAll("tbody tr")];
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        // The row header comes first: it names only the cells after it.
        expect(r.querySelectorAll("th")).toHaveLength(1);
        expect(r.firstElementChild!.matches('th[scope="row"].when.sess')).toBe(true);
        expect(r.children[1]!.matches("td.when")).toBe(true);
      }
    }
    expect(within(screen.getByRole("table", { name: "Failed test runs" })).getByRole("rowheader").textContent).toContain("Fix upload");
  });

  it("opens the failed test runs, each linking to its error", async () => {
    const t = { id: "t9", session_id: "s1", title: "Fix upload", project: "bar", source: "codex" as const, command: "npm test", ts: "2026-11-04T10:07:00.000Z" };
    serve({ ...usage, totals: { ...usage.totals, tests_failed: 4 }, failed_tests: [t] });
    at();
    renderApp(<ActivityPage />);
    await loaded();
    await userEvent.click(attention().getByRole("button", { name: "See tests" }));
    const list = document.getElementById("tests")!;
    expect(selectedTab()).toBe("Loops and tests");
    expect(document.activeElement).toBe(list.querySelector("h3"));
    expect(list.querySelector("h3")!.textContent).toMatch(/Failed test runs\s*4/);
    const row = within(list.querySelector("tbody")!);
    expect(row.getByText("npm test")).toBeTruthy();
    // The session button is the session's subject for the context menu, as every other session link is.
    expect(row.getByRole("button", { name: "Fix upload" }).getAttribute("data-subject")).toBe("session:s1");
    expect(row.getByRole("link", { name: "Open in Errors" }).getAttribute("href")).toBe("/errors?project=bar&range=30&source=codex&ex=t9");
  });

  it("previews the five newest loops and failed runs, and shows all of them in place", async () => {
    const loops = Array.from({ length: 12 }, (_, k) => ({ ...usage.error_loops[0]!, first_id: `l${k}`, tool: `Tool${k}` }));
    const tests = Array.from({ length: 50 }, (_, k) => ({ id: `t${k}`, session_id: "s1", title: null, project: "bar", source: "claude" as const, command: `cmd${k}`, ts: null }));
    serve({ ...usage, totals: { ...usage.totals, error_loops: 12, tests_failed: 60 }, error_loops: loops, failed_tests: tests });
    at("?range=30&tab=loops");
    renderApp(<ActivityPage />);
    await loaded();
    const rows = (id: string) => document.querySelectorAll(`#${id} tbody tr`).length;
    expect([rows("loops"), rows("tests")]).toEqual([5, 5]);
    const all = screen.getByRole("button", { name: "Show all 12" });
    expect(all.getAttribute("aria-expanded")).toBe("false");
    await userEvent.click(all);
    expect(rows("loops")).toBe(12);
    expect(screen.getByRole("button", { name: "Show fewer" }).getAttribute("aria-expanded")).toBe("true");
    // The payload carries the newest 50 of 60: the button and the list say so.
    await userEvent.click(screen.getByRole("button", { name: "Show the 50 newest runs" }));
    expect(rows("tests")).toBe(50);
    expect(within(document.getElementById("tests")!).getByText(/Showing the 50 newest of 60\./)).toBeTruthy();
    expect(document.querySelector("#tests td.when")!.textContent).toBe("–"); // a run with no time
  });

  it("names an error loop's session by its title, with the short id below", async () => {
    const [first, ...rest] = usage.error_loops;
    serve({ ...usage, error_loops: [{ ...first!, title: "Fix flaky upload test" }, ...rest.map(l => ({ ...l, title: null }))] });
    at();
    renderApp(<ActivityPage />);
    await loaded();
    await openTab("Loops and tests");
    const drawer = within(document.getElementById("loops")!);
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
    await openTab("Tools and MCP");
    const item = (await attention().findByText("1 tool")).closest("li")!;
    expect(item.textContent).toMatch(/worst WebFetch \(25%\)/);
    const first = () => document.querySelector("#tools tbody tr :is(th, td)")!.textContent;
    expect(first()).toBe("Edit");
    // A chosen sort gives way to flaky tools first.
    const failed = within(document.getElementById("tools")!).getByRole("button", { name: "Failed" });
    await userEvent.click(failed); await userEvent.click(failed);
    expect(first()).toBe("Skill");
    await userEvent.click(within(item).getByRole("button", { name: "See tools" }));
    expect(first()).toBe("WebFetch");
    expect(document.querySelector("#tools th[aria-sort]")).toBeNull();
  });

  it("selecting a day on the work chart lists that day's sessions", async () => {
    serve(usage);
    at();
    renderApp(<ActivityPage />);
    const chart = await screen.findByRole("group", { name: /^Commits per day, with errors per 100 tool calls on a track below, 2 days/ });
    act(() => chart.focus());
    fireEvent.keyDown(chart, { key: "End" });
    expect(screen.getByText("Nov 5, 2026: 0 commits, 1 prompt, 1 session, 0 failed calls")).toBeTruthy();
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    fireEvent.keyDown(chart, { key: "Enter" });
    expect(selectedTab()).toBe("Sessions");
    expect(document.querySelector("#work .daychip")!.textContent).toBe("Nov 4✕");
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&day=2026-11-04"));
    // The bars follow the chosen count.
    await userEvent.click(within(screen.getByRole("group", { name: "Chart metric" })).getByRole("button", { name: "Prompts" }));
    expect(screen.getByRole("group", { name: /^Prompts per day/ })).toBeTruthy();
  });

  it("opens a tool sheet from the tools drawer, and Escape returns focus to the row", async () => {
    mockApi({ "/api/usage": () => usage, "/api/tool": q => ({ ...tool, kind: q.get("kind"), name: q.get("name") }) });
    at();
    renderPage(<ActivityPage />);
    await loaded();
    await openTab("Tools and MCP");
    const row = document.querySelector<HTMLElement>('#tools tr[data-v="Bash"]')!;
    await userEvent.click(row.querySelector("button")!);
    expect(location.search).toBe("?range=30&tab=tools&tool=Bash");
    const dlg = within(document.querySelector("dialog")!);
    expect(await dlg.findByText("Recent calls")).toBeTruthy();
    // The browser turns Escape on a modal dialog into a cancel event.
    act(() => { document.querySelector("dialog")!.dispatchEvent(new Event("cancel", { cancelable: true })); });
    await waitFor(() => expect(location.search).toBe("?range=30&tab=tools")); // closing goes Back over the entry the sheet pushed
    await waitFor(() => expect(document.activeElement).toBe(within(document.querySelector<HTMLElement>('#tools tr[data-v="Bash"]')!).getByRole("button", { name: "Bash" })));
  });

  it("opens MCP server and skill sheets from the extensions drawer", async () => {
    mockApi({ "/api/usage": () => usage, "/api/tool": q => ({ ...tool, kind: q.get("kind"), name: q.get("name") }) });
    at();
    renderPage(<ActivityPage />);
    await loaded();
    await openTab("Tools and MCP");
    const ext = within(document.getElementById("ext")!);
    await userEvent.click(ext.getByRole("button", { name: "srv" }));
    expect(location.search).toBe("?range=30&tab=tools&mcp=srv");
    expect((await within(document.querySelector("dialog")!).findByRole("heading", { level: 2 })).textContent).toBe("MCP serversrv");
    await userEvent.click(within(document.querySelector("dialog")!).getByRole("button", { name: "Close" }));
    await userEvent.click(ext.getByRole("button", { name: "review" }));
    expect(location.search).toBe("?range=30&tab=tools&skill=review");
  });

  it("opens the palette over an open tool sheet, and Escape leaves the sheet open", async () => {
    mockApi({ "/api/usage": () => usage, "/api/tool": () => tool, "/api/palette": () => palette });
    at("?range=30&tool=Bash");
    renderPage(<><ActivityPage /><Palette /></>);
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

const panel = () => within(document.getElementById("sessions")!);
const head = (key: string) => document.querySelector<HTMLElement>(`#sessions thead th[data-sort="${key}"]`);
/** The page, as a visit opens it, with its sessions listed. */
const visit = async () => {
  serve(usage);
  at();
  renderApp(<ActivityPage />);
  await loaded();
  await waitFor(() => expect(document.querySelectorAll("#sessions tbody tr")).toHaveLength(sessions.sessions.length));
};

describe("Sessions columns", () => {
  beforeEach(() => { resetColumnChoice(); });
  afterEach(() => { vi.unstubAllGlobals(); resetColumnChoice(); });

  /** The Sessions headers on screen, by sort key; Project, which does not sort, as "project". */
  const heads = () => [...document.querySelectorAll<HTMLElement>("#sessions thead th")].map(th => th.dataset.sort ?? th.textContent!.replace(/\?$/, "").toLowerCase());
  const columnsButton = () => panel().getByRole("button", { name: /^Columns/ });
  const list = () => screen.getByRole("dialog", { name: "Columns" });
  const box = (name: string) => within(list()).getByRole<HTMLInputElement>("checkbox", { name });
  const stored = () => { const v = localStorage.getItem(COLUMNS_KEY); return v == null ? null : JSON.parse(v) as unknown; };
  /** A window this many CSS pixels wide, at the default 16px text size: matchMedia answers its max-width queries. */
  const width = (px: number) => vi.stubGlobal("matchMedia", (q: string) => {
    const max = /max-width: ([\d.]+)em/.exec(q);
    return { media: q, matches: !!max && px <= Number(max[1]) * 16, addEventListener() {}, removeEventListener() {} };
  });

  it("lists every column but Session in a dialog the keyboard opens, changes and closes", async () => {
    await visit();
    const btn = columnsButton();
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    act(() => btn.focus());
    await userEvent.keyboard("{Enter}");
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    await waitFor(() => expect(list().contains(document.activeElement)).toBe(true));
    const boxes = within(list()).getAllByRole<HTMLInputElement>("checkbox");
    expect(boxes.map(c => c.closest("label")!.textContent!.trim())).toEqual(["Project", "Active", "Model", "Tok/s", "Prompts", "Tokens", "Est. cost",
      "Peak context", "Failed", "Compactions", "Commits", "Tests"]);
    expect(boxes.every(c => c.checked)).toBe(true);
    for (let i = 0; i < boxes.length && document.activeElement !== box("Tokens"); i++) await userEvent.tab();
    expect(document.activeElement).toBe(box("Tokens"));
    await userEvent.keyboard(" ");
    expect(box("Tokens").checked).toBe(false);
    expect(heads()).not.toContain("tokens");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Columns" })).toBeNull());
    expect(document.activeElement).toBe(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes the list on a click outside it, leaving focus on a control the click lands on", async () => {
    await visit();
    await userEvent.click(columnsButton());
    await waitFor(() => expect(list().contains(document.activeElement)).toBe(true));
    const field = panel().getByRole("searchbox", { name: "Search sessions" });
    await userEvent.click(field);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Columns" })).toBeNull());
    expect(document.activeElement).toBe(field);
    expect(columnsButton().getAttribute("aria-expanded")).toBe("false");
  });

  it("closes the list on a click on nothing focusable, and returns focus to the Columns button", async () => {
    // Base UI returns focus after an outside press only where focus() reads its preventScroll option, as desktop browsers do;
    // jsdom ignores the option, so the test reads it as a browser would.
    const focus = HTMLElement.prototype.focus;
    vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (this: HTMLElement, o?: FocusOptions) { void o?.preventScroll; focus.call(this, o); });
    await visit();
    await userEvent.click(columnsButton());
    await waitFor(() => expect(list().contains(document.activeElement)).toBe(true));
    // Plain text with no focusable ancestor: the work chart's hint.
    const text = document.querySelector<HTMLElement>("#work .hint")!;
    expect(text.closest("[tabindex], a, button, input")).toBeNull();
    await userEvent.click(text);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Columns" })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(columnsButton()));
  });

  it("hides an unticked column at every width, keeps the choice for the next visit, and Reset brings the columns back", async () => {
    await visit();
    await userEvent.click(columnsButton());
    await userEvent.click(box("Compactions"));
    expect(heads()).not.toContain("compactions");
    expect(heads()).toHaveLength(12);
    expect(document.querySelector("#sessions tbody tr")!.children).toHaveLength(12);
    await userEvent.click(box("Commits"));
    expect(stored()).toEqual({ compactions: false, commits: false });
    expect(columnsButton().textContent).toBe("Columns, 2 hidden");
    expect(location.search).toBe("?range=30");
    // The next visit reads the stored choice.
    cleanup();
    resetColumnChoice();
    await visit();
    expect(heads()).not.toContain("compactions");
    expect(heads()).not.toContain("commits");
    await userEvent.click(columnsButton());
    const reset = within(list()).getByRole("button", { name: "Reset columns" });
    await userEvent.click(reset);
    expect(stored()).toBeNull();
    expect(heads()).toHaveLength(13);
    expect(columnsButton().textContent).toBe("Columns");
    expect(document.activeElement).toBe(reset);
    expect(box("Compactions").checked).toBe(true);
  });

  it("leaves a column to the width until the user ticks it, then keeps it at every width", async () => {
    width(390);
    await visit();
    await userEvent.click(columnsButton());
    expect(box("Tokens").checked).toBe(false);
    expect(box("Est. cost").checked).toBe(true);
    await userEvent.click(box("Tokens"));
    expect(box("Tokens").checked).toBe(true);
    expect(stored()).toEqual({ tokens: true });
    const at = heads().indexOf("tokens");
    expect(head("tokens")!.classList.contains("keep")).toBe(true);
    expect([...document.querySelectorAll("#sessions tbody tr")].every(r => r.children[at]!.classList.contains("keep"))).toBe(true);
    // A column the user has not touched still hides by its width.
    expect(head("compactions")!.classList.contains("keep")).toBe(false);
    expect(box("Compactions").checked).toBe(false);
  });

  it("returns a column hidden, then shown, on a wide window to the width rule", async () => {
    await visit();
    await userEvent.click(columnsButton());
    await userEvent.click(box("Active"));
    expect(stored()).toEqual({ duration_s: false });
    await userEvent.click(box("Active"));
    expect(stored()).toBeNull();
    expect(head("duration_s")!.classList.contains("keep")).toBe(false);
  });

  it("keeps a choice for the page view when the browser blocks storage", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    await visit();
    await userEvent.click(columnsButton());
    await userEvent.click(box("Compactions"));
    expect(heads()).not.toContain("compactions");
    expect(box("Compactions").checked).toBe(false);
  });

  it("shows a hidden column while it is sorted, and hiding the sorted column takes it out of the sort", async () => {
    localStorage.setItem(COLUMNS_KEY, JSON.stringify({ output_per_s: false }));
    // A sorted list comes back in another order, so the rows say which list the table shows.
    mockApi({ "/api/usage": () => usage, "/api/sessions": q => q.get("sort") ? { ...sessions, sessions: sessions.sessions.toReversed() } : sessions });
    at();
    renderApp(<ActivityPage />);
    await loaded();
    const first = () => document.querySelector("#sessions tbody tr")?.getAttribute("data-v");
    await waitFor(() => expect(first()).toBe(sessions.sessions[0]!.session_id));
    expect(heads()).not.toContain("output_per_s");
    await userEvent.click(vital("Output speed").closest("button")!);
    await waitFor(() => expect(head("output_per_s")?.getAttribute("aria-sort")).toBe("descending"));
    expect(head("output_per_s")!.classList.contains("sorted")).toBe(true);
    // The sort moves: the choice applies again.
    await userEvent.click(panel().getByRole("button", { name: "Tokens" }));
    await waitFor(() => expect(lastSessionsUrl()).toBe("/api/sessions?range=30&sort=tokens&desc=1"));
    expect(heads()).not.toContain("output_per_s");
    // Unticking the sorted column hides it and leaves the sort.
    await userEvent.click(columnsButton());
    expect(box("Tokens").checked).toBe(true);
    await userEvent.click(box("Tokens"));
    expect(heads()).not.toContain("tokens");
    expect(document.querySelector("#sessions th[aria-sort]")).toBeNull();
    // The list in its own order: the first page asked with no sort (held in the query cache since the visit).
    await waitFor(() => expect(first()).toBe(sessions.sessions[0]!.session_id));
    expect(fetched()).toContain("/api/sessions?range=30");
    await waitFor(() => expect(hint()).toContain("newest first"));
  });
});

describe("Sessions sort by several columns", () => {
  beforeEach(() => { resetColumnChoice(); });
  afterEach(() => { vi.unstubAllGlobals(); resetColumnChoice(); });

  /** A header's sort button, whatever its name says of the sort. */
  const sortButton = (key: string) => head(key)!.querySelector("button")!;
  const several = () => panel().getByRole<HTMLInputElement>("checkbox", { name: "Sort by several columns" });
  /** The sorted headers, by key, in table order, and their marks. */
  const marks = () => [...document.querySelectorAll<HTMLElement>("#sessions thead th.sorted")].map(th => [th.dataset.sort, th.querySelector(".sortmark")!.textContent]);
  /** Whether every row's cell of a column carries the class. */
  const cellsCarry = (key: string, cls: string) => {
    const at = [...document.querySelectorAll<HTMLElement>("#sessions thead th")].indexOf(head(key)!);
    return [...document.querySelectorAll("#sessions tbody tr")].every(r => r.children[at]!.classList.contains(cls));
  };

  it("adds a header to the sort with the box ticked, keeps focus on it, marks each key and says the whole order", async () => {
    await visit();
    expect(several().checked).toBe(false);
    await userEvent.click(panel().getByRole("button", { name: "Est. cost" }));
    await waitFor(() => expect(lastSessionsUrl()).toBe("/api/sessions?range=30&sort=cost&desc=1"));
    await userEvent.click(several());
    const prompts = panel().getByRole("button", { name: "Prompts" });
    act(() => prompts.focus());
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(lastSessionsUrl()).toBe("/api/sessions?range=30&sort=-cost%2C-prompts"));
    expect(document.activeElement).toBe(prompts);
    expect(marks()).toEqual([["prompts", "↓2"], ["cost", "↓1"]]);
    expect([...document.querySelectorAll<HTMLElement>("#sessions th[aria-sort]")].map(th => [th.dataset.sort, th.getAttribute("aria-sort")])).toEqual([["cost", "descending"]]);
    expect(panel().getByRole("button", { name: "Prompts, sort 2 of 2, descending" })).toBe(prompts);
    expect(panel().getByRole("button", { name: "Est. cost, sort 1 of 2" })).toBe(sortButton("cost"));
    await waitFor(() => expect(hint()).toContain(`${sessions.total} sessions, costliest first, then most prompts first.`));
    expect(cellsCarry("cost", "sorted") && cellsCarry("prompts", "sorted")).toBe(true);
    expect(location.search).toBe("?range=30");
  });

  it("adds on a Shift-click with the box unticked, removes on a third press, replaces the third key, and sorts by one column without either", async () => {
    const user = userEvent.setup();
    await visit();
    await user.click(sortButton("cost"));
    await user.keyboard("{Shift>}");
    await user.click(sortButton("errors"));
    await user.keyboard("{/Shift}");
    expect(several().checked).toBe(false);
    await waitFor(() => expect(lastSessionsUrl()).toBe("/api/sessions?range=30&sort=-cost%2C-errors"));
    await waitFor(() => expect(hint()).toContain("costliest first, then most failed calls first."));
    // With the box ticked: a press adds, a second reverses, a third removes, leaving the earlier keys.
    await user.click(several());
    await user.click(sortButton("prompts"));
    await waitFor(() => expect(lastSessionsUrl()).toBe("/api/sessions?range=30&sort=-cost%2C-errors%2C-prompts"));
    await user.click(sortButton("prompts"));
    await waitFor(() => expect(lastSessionsUrl()).toBe("/api/sessions?range=30&sort=-cost%2C-errors%2Cprompts"));
    expect(marks()).toEqual([["prompts", "↑3"], ["cost", "↓1"], ["errors", "↓2"]]);
    await user.click(sortButton("prompts"));
    await waitFor(() => expect(hint()).toContain("costliest first, then most failed calls first."));
    expect(marks()).toEqual([["cost", "↓1"], ["errors", "↓2"]]);
    // At three keys a new one replaces the third; Session sorts as any column.
    await user.click(sortButton("tokens"));
    await user.click(sortButton("first_ts"));
    await waitFor(() => expect(lastSessionsUrl()).toBe("/api/sessions?range=30&sort=-cost%2C-errors%2C-first_ts"));
    expect(marks()).toEqual([["first_ts", "↓3"], ["cost", "↓1"], ["errors", "↓2"]]);
    expect(cellsCarry("first_ts", "sorted")).toBe(true);
    await waitFor(() => expect(hint()).toContain("costliest first, then most failed calls first, then newest first."));
    // Box unticked, no Shift: the column alone.
    await user.click(several());
    await user.click(sortButton("tokens"));
    await waitFor(() => expect(lastSessionsUrl()).toBe("/api/sessions?range=30&sort=tokens&desc=1"));
    expect(marks()).toEqual([["tokens", "↓"]]);
    await waitFor(() => expect(hint()).toContain(`${sessions.total} sessions, most tokens first.`));
  });

  it("clears every key for the near-limit action and a chart day, and the Output speed vital sorts by output speed alone", async () => {
    const user = userEvent.setup();
    const twoKeys = async () => {
      await user.click(several());
      await user.click(sortButton("errors"));
      await user.click(sortButton("cost"));
      await user.click(several());
      await waitFor(() => expect(marks()).toEqual([["cost", "↓2"], ["errors", "↓1"]]));
    };
    await visit();
    await twoKeys();
    await user.click(attention().getByRole("button", { name: "See it" }));
    await waitFor(() => expect(lastSessionsUrl()).toBe("/api/sessions?range=30&near=1"));
    expect(marks()).toEqual([]);
    expect(document.querySelector("#sessions th[aria-sort]")).toBeNull();
    await waitFor(() => expect(hint()).toContain("nearest the limit first"));
    await twoKeys();
    // A sort chosen after the action applies within it.
    await waitFor(() => expect(lastSessionsUrl()).toBe("/api/sessions?range=30&near=1&sort=-errors%2C-cost"));
    const chart = screen.getByRole("group", { name: /^Commits/ });
    act(() => chart.focus());
    fireEvent.keyDown(chart, { key: "End" });
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    fireEvent.keyDown(chart, { key: "Enter" });
    await waitFor(() => expect(lastSessionsUrl()).toBe("/api/sessions?range=30&day=2026-11-04"));
    expect(marks()).toEqual([]);
    expect(document.querySelector("#sessions th[aria-sort]")).toBeNull();
    await waitFor(() => expect(hint()).toContain("by their cost on that day"));
    await twoKeys();
    await user.click(vital("Output speed").closest("button")!);
    await waitFor(() => expect(lastSessionsUrl()).toBe("/api/sessions?range=30&sort=output_per_s&desc=1"));
    expect(marks()).toEqual([["output_per_s", "↓"]]);
  });

  it("keeps every sorted column shown, and unticking a later key's column takes that key alone out of the sort", async () => {
    // A phone: the width hides Tokens and Compactions (opt2) and Commits (opt).
    vi.stubGlobal("matchMedia", (q: string) => ({ media: q, matches: true, addEventListener() {}, removeEventListener() {} }));
    const user = userEvent.setup();
    await visit();
    await user.click(several());
    for (const key of ["tokens", "compactions", "commits"]) await user.click(sortButton(key));
    await waitFor(() => expect(lastSessionsUrl()).toBe("/api/sessions?range=30&sort=-tokens%2C-compactions%2C-commits"));
    for (const key of ["tokens", "compactions", "commits"]) expect(cellsCarry(key, "sorted")).toBe(true);
    await user.click(panel().getByRole("button", { name: /^Columns/ }));
    const list = within(screen.getByRole("dialog", { name: "Columns" }));
    for (const name of ["Tokens", "Compactions", "Commits"]) expect(list.getByRole<HTMLInputElement>("checkbox", { name }).checked).toBe(true);
    await user.click(list.getByRole("checkbox", { name: "Compactions" }));
    expect(document.querySelector('#sessions thead th[data-sort="compactions"]')).toBeNull();
    expect(marks()).toEqual([["tokens", "↓1"], ["commits", "↓2"]]);
    await waitFor(() => expect(lastSessionsUrl()).toBe("/api/sessions?range=30&sort=-tokens%2C-commits"));
    await waitFor(() => expect(hint()).toContain("most tokens first, then most commits first."));
  });

  it("moves focus to the search field when a press takes the focused header's column out of the sort and the width hides it", async () => {
    // A phone: the width hides Tok/s (opt1).
    vi.stubGlobal("matchMedia", (q: string) => ({ media: q, matches: true, addEventListener() {}, removeEventListener() {} }));
    const user = userEvent.setup();
    await visit();
    await user.click(vital("Output speed").closest("button")!);
    await waitFor(() => expect(marks()).toEqual([["output_per_s", "↓"]]));
    await user.click(several());
    const speed = sortButton("output_per_s");
    act(() => speed.focus());
    await user.keyboard("{Enter}");
    await waitFor(() => expect(marks()).toEqual([["output_per_s", "↑"]]));
    expect(document.activeElement).toBe(speed);
    // The second press removes the key: the width hides the column, so focus goes to the search field, not the page.
    await user.keyboard("{Enter}");
    await waitFor(() => expect(marks()).toEqual([]));
    expect(document.activeElement).toBe(panel().getByRole("searchbox", { name: "Search sessions" }));
  });

  it("keeps focus on the pressed header while its column shows", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ media: q, matches: true, addEventListener() {}, removeEventListener() {} }));
    const user = userEvent.setup();
    await visit();
    // One press with the box unticked replaces the sort: the old sorted column may hide, the pressed one shows.
    await user.click(vital("Output speed").closest("button")!);
    await waitFor(() => expect(marks()).toEqual([["output_per_s", "↓"]]));
    const cost = sortButton("cost");
    act(() => cost.focus());
    await user.keyboard("{Enter}");
    await waitFor(() => expect(marks()).toEqual([["cost", "↓"]]));
    expect(document.activeElement).toBe(cost);
    // Removing a key whose column never hides (Est. cost) leaves focus on it.
    await user.click(several());
    act(() => cost.focus());
    await user.keyboard("{Enter}");
    await waitFor(() => expect(marks()).toEqual([["cost", "↑"]]));
    await user.keyboard("{Enter}");
    await waitFor(() => expect(marks()).toEqual([]));
    expect(document.activeElement).toBe(cost);
  });

  it("says the order of every key when no session matches, and nothing of it without keys", async () => {
    mockApi({ "/api/usage": () => usage, "/api/sessions": q => q.get("q") ? { total: 0, offset: 0, sessions: [] } : sessions });
    at();
    renderApp(<ActivityPage />);
    await loaded();
    const user = userEvent.setup();
    await user.type(panel().getByRole("searchbox", { name: "Search sessions" }), "nothing");
    await waitFor(() => expect(hint()).toBe("0 sessions match."));
    await user.click(sortButton("cost"));
    await waitFor(() => expect(hint()).toBe("0 sessions match, costliest first."));
    await user.click(several());
    await user.click(sortButton("prompts"));
    await waitFor(() => expect(hint()).toBe("0 sessions match, costliest first, then most prompts first."));
  });
});
