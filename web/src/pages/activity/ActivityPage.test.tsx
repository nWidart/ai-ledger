import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { UsagePayload } from "../../api";
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
import { clearApiCache } from "../../useApi";
import { hookCommand, workDays } from "./work";

const at = (hash = "#range=30") => history.replaceState(null, "", "/usage" + hash);
const serve = (d: UsagePayload) => mockApi({ "/api/usage": () => d, "/api/sessions": () => sessions, "/api/session": () => session });
const attention = () => within(document.getElementById("attention")!);
const loaded = () => screen.findByRole("heading", { level: 1, name: /commit/ });
const fetched = () => vi.mocked(fetch).mock.calls.map(c => c[0]);
const quiet: UsagePayload = { ...usage, totals: { ...usage.totals, error_loops: 0, tests_failed: 0 }, error_loops: [], near_limit: [] };

describe("work per day", () => {
  it("covers the view from its first day with a session, with zeros for idle days", () => {
    const ds = workDays(usage);
    expect(ds.map(r => r.day)).toEqual(["2026-11-04", "2026-11-05"]);
    expect(ds[0]).toEqual({ day: "2026-11-04", sessions: 1, prompts: 2, commits: 1, failed_calls: 6 });
    expect(ds.reduce((a, r) => a + r.commits, 0)).toBe(usage.totals.commits);
    const gap = workDays({ ...usage, daily_work: [{ day: "2026-11-01", sessions: 1, prompts: 1, commits: 0, failed_calls: 0 }, ...usage.daily_work] });
    expect(gap.map(r => r.sessions)).toEqual([1, 0, 0, 1, 1]);
    // A prompt whose session made no request does not start the axis; a view with no session keeps its whole range.
    const orphan = { day: "2026-09-01", sessions: 0, prompts: 1, commits: 0, failed_calls: 0 };
    expect(workDays({ ...usageAll, daily_work: [orphan, ...usageAll.daily_work] })[0]!.day).toBe(usageAll.daily_work.find(r => r.sessions)!.day);
    expect(workDays({ ...usage, daily_work: [] })).toHaveLength(30);
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
    expect(lede.textContent).toBe("1 commit from 3 prompts, in 2 sessions, 2 active days");
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
    expect((await screen.findByRole("heading", { level: 1, name: /^0 commits/ })).textContent).toBe("0 commits from 1 prompt, in 1 session, 1 active day");
    expect(fetched()).toContain("/api/usage?range=30&source=codex");
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
    await userEvent.click(within(item).getByRole("button", { name: "See tools" }));
    expect(first()).toBe("WebFetch");
  });

  it("selecting a day on the work chart lists that day's sessions", async () => {
    serve(usage);
    at();
    render(<ActivityPage />);
    const chart = await screen.findByRole("img", { name: /^Commits and failed tool calls per day, 2 days/ });
    act(() => chart.focus());
    fireEvent.keyDown(chart, { key: "End" });
    expect(screen.getByText("Nov 5, 2026: 0 commits, 1 prompt, 1 session, 0 failed calls")).toBeTruthy();
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    fireEvent.keyDown(chart, { key: "Enter" });
    expect((document.getElementById("d-sessions") as HTMLDetailsElement).open).toBe(true);
    expect(screen.getByText("Active on Nov 4, 2026")).toBeTruthy();
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&day=2026-11-04"));
    // The bars follow the chosen count.
    await userEvent.click(screen.getByRole("button", { name: "Prompts" }));
    expect(screen.getByRole("img", { name: /^Prompts and failed tool calls per day/ })).toBeTruthy();
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
