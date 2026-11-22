import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ModelRow, ProjectRow, SessionsPage, UsagePayload } from "../../api";
import usage from "../../__fixtures__/usage";
import usageAll from "../../__fixtures__/usage-all";
import sources from "../../__fixtures__/usage-sources";
import sessions from "../../__fixtures__/sessions";
import session from "../../__fixtures__/session";
import { openDrawer } from "../../components/Drawer";
import { drawn, fakeECharts } from "../../components/echart/testing";
import { mockApi } from "../../components/sheets/testing";
import { dayStamp, download } from "../../components/export";
import { ingested, renderApp, renderPage } from "../../testing";
import { num, usd } from "../../format";
import { compareText, costDays, thinHistory } from "./cost";
import { CostPage } from "./CostPage";

vi.mock("../../components/export", async orig => ({ ...(await orig<typeof import("../../components/export")>()), download: vi.fn() }));

const at = (hash = "?range=30") => history.replaceState(null, "", "/cost" + hash);
// The day's sessions as the server sends them: costliest on that day first.
const byDay: SessionsPage = { ...sessions, sessions: ["s1", "s3", "s2"].map(id => sessions.sessions.find(s => s.session_id === id)!) };
const serve = (d: UsagePayload) => mockApi({ "/api/usage": () => d, "/api/sessions": q => (q.get("day") ? byDay : sessions), "/api/session": () => session });
/** The daily chart, drawn: the page holds a second chart, the flow, which `drawn()` may return when it is made last. */
const daily = async () => { await drawn(); return fakeECharts.live.find(c => document.getElementById("spend")!.contains(c.dom))!; };
const loaded = () => screen.findByRole("heading", { level: 1, name: /estimated cost/ });
const fetched = () => vi.mocked(fetch).mock.calls.map(c => c[0]);
/** The page loaded, with these drawers opened in turn: a closed drawer renders no table, and a page opens one drawer at a time,
 *  so each has rendered its body (kept, hidden, once closed) and the last stays open. */
const show = async (d: UsagePayload, open = ["d-tokens", "d-top"]) => { serve(d); at(); renderPage(<CostPage />); const lede = await loaded(); act(() => open.forEach(id => openDrawer(id))); return lede; };
/** Whether a drawer is open. */
const isOpen = (id: string) => document.getElementById(id)!.hasAttribute("data-open");
const insights = () => within(document.getElementById("insights")!);
const drawer = (id: string) => document.getElementById(id)!;
/** The project table's section. */
const table = () => document.getElementById("projects")!;
/** The How measured text under the heading, opened first. */
const how = () => {
  const b = screen.getByRole("button", { name: "How measured: cost" });
  if (b.getAttribute("aria-expanded") !== "true") act(() => b.click());
  return b.parentElement!.querySelector(".tt-pop")!.textContent;
};
// A project row's cells: trend, spend, change, cost per commit, cache hit (with a previous period).
const CPC = 3, HIT = 4;

// Variants of the 30-day fixture for cases it lacks; changes are left out, so no project is listed only for its previous period.
const base = usage.by_project[0]!;
const proj = (project: string, cost: number, commits: number): ProjectRow =>
  ({ ...base, project, cost, commits, unpriced: 0, cost_per_commit: commits ? cost / commits : null });
const withProjects = (rows: ProjectRow[]): UsagePayload => ({ ...usage, projects: rows.map(p => p.project!), by_project: rows, changes: [],
  totals: { ...usage.totals, commits: rows.reduce((a, p) => a + p.commits, 0), cost: rows.reduce((a, p) => a + (p.cost ?? 0), 0) } });
const doubled: UsagePayload = { ...usage, previous: { ...usage.previous!, cost: 7.9 } };

describe("plan gauge", () => {
  const max = { provider: "claude" as const, label: "Claude Max 20x", monthly: 200 };
  const rate = (claude: number, codex = 0): UsagePayload["run_rate"] => ({ month_cost: 150 + codex, daily_avg: 10, days_left: 18, projected: claude + codex,
    by_source: [{ source: "claude", month_cost: 150, daily_avg: 10, projected: claude }, ...(codex ? [{ source: "codex" as const, month_cost: codex, daily_avg: 1, projected: codex }] : [])] });
  const gauge = () => screen.getByRole("figure", { name: /^This month/ });

  it("shows the month so far and the pace against the plan, as text, with the multiple", async () => {
    await show({ ...usage, plans: [max], run_rate: rate(840) });
    const g = gauge();
    expect(within(g).getByText("4.2× plan")).toBeTruthy();
    expect(g.textContent).toMatch(/This month vs plan \(\$200\/mo, Claude Max 20x\)/);
    expect(g.textContent).toMatch(/\$150 so far.*on pace for ~\$840.*plan \$200/);
    expect(g.textContent).not.toMatch(/sav/i);
    expect(how()).toMatch(/The plan multiple divides the pace by the plans' monthly price\./);
  });

  it("names the agents it counts when another one spent without a plan", async () => {
    await show({ ...usage, plans: [max], run_rate: rate(400, 30) });
    expect(gauge().textContent).toMatch(/2\.0× plan.*Claude Code use only/);
  });

  it("shows the spend and pace without a plan, and no multiple", async () => {
    await show({ ...usage, plans: [], run_rate: rate(300) });
    expect(gauge().textContent).toMatch(/^This month's pace\$150 so faron pace for ~\$300$/);
    expect(screen.queryByText(/× plan/)).toBeNull();
  });

  it("is absent without a projection", async () => {
    await show({ ...usage, plans: [max], run_rate: null });
    expect(screen.queryByRole("figure", { name: /^This month/ })).toBeNull();
    expect(how()).not.toMatch(/pace/);
  });

  it("stays in the header, beside the heading, while the filters sit in the scope bar", async () => {
    await show({ ...usage, plans: [max], run_rate: rate(840) });
    const header = document.querySelector("main header.top")!;
    expect(header.contains(gauge())).toBe(true);
    expect(header.querySelector(".filters")).toBeNull();
    expect(screen.getByRole("group", { name: "Filters" }).closest(".scopebar")).toBeTruthy();
  });
});

describe("cost figures", () => {
  it("compares with the previous period as a multiple from 2x, a percentage below, and makes no change of a period with no priced cost", () => {
    expect(compareText(doubled)).toEqual({ text: "2.0× the previous 30 days", sr: "2.0 times the previous 30 days" });
    expect(compareText({ ...doubled, totals: { ...doubled.totals, cost: null } })).toEqual({ text: "no priced usage in this period", sr: "no priced usage in this period" });
    expect(compareText({ ...usage, previous: { ...usage.previous!, cost: 12 } })!.text).toBe("+32% vs the previous 30 days");
    expect(compareText(usageAll)).toBeNull();
    // A previous window with requests, all on unpriced models: its cost is unknown, not nothing.
    expect(compareText({ ...usage, previous: { ...usage.previous!, cost: null } })!.text).toBe("no priced usage in the previous 30 days");
    expect(compareText({ ...usage, previous: { ...usage.previous!, cost: null, requests: 0 } })!.text).toBe("nothing in the previous 30 days");
  });

  it("marks a previous window with under half the days with prompts as thin", () => {
    expect(thinHistory(usage)).toBe(false); // 1 day before, 2 now
    expect(thinHistory({ ...usage, totals: { ...usage.totals, active_days: 5 } })).toBe(true);
  });

  it("covers every day of the view and stacks Other under the named projects", () => {
    const ds = costDays(usage, [{ k: "p:", label: "Other", c: "" }]);
    expect(ds).toHaveLength(30);
    expect(ds.at(-2)).toMatchObject({ day: "2026-11-04", cost: 15.8, v: { "p:": 15.8, input: 2000000, text_out: 500000, thinking: 500000 } });
    expect(ds.at(-1)).toMatchObject({ day: "2026-11-05", cost: 0, unpriced: 1 });
  });
});

describe("CostPage", () => {
  it("leads a thirty-day view with its cost and the change, and both windows with their days with prompts under How measured", async () => {
    const lede = await show(doubled);
    expect(lede.textContent).toBe("$16 estimated cost, 2.0× the previous 30 days2.0 times the previous 30 days");
    expect(document.querySelector(".windows")!.textContent).toBe("Oct 7 – Nov 5, 2026 vs Sep 7 – Oct 6, 2026 How measured");
    expect(screen.getByRole("button", { name: "How measured: cost" }).getAttribute("aria-expanded")).toBe("false");
    expect(how()).toMatch(/This period, Oct 7 – Nov 5, 2026: 2 of 30 days with prompts\./);
    expect(how()).toMatch(/Previous period, Sep 7 – Oct 6, 2026: \$7\.90, 1 of 30 days with prompts\./);
    expect(how()).toMatch(/Cost is estimated at API list prices and leaves out unpriced models\./);
    expect(screen.getByRole("button", { name: "How measured: cost" }).parentElement!.querySelector(".tt-pop a")!.getAttribute("href")).toMatch(/concepts\/cost-estimates\/$/);
    expect(screen.queryByRole("img", { name: /Daily cost sparkline/ })).toBeNull();
  });

  it("narrows to Codex when picked and records it in the URL", async () => {
    const codex: UsagePayload = { ...usage, source: "codex", previous: null, totals: { ...usage.totals, cost: 2 } };
    mockApi({ "/api/usage": q => (q.get("source") === "codex" ? codex : usage), "/api/sessions": () => sessions, "/api/session": () => session });
    at();
    renderPage(<CostPage />);
    await loaded();
    await userEvent.click(within(screen.getByRole("group", { name: "Source" })).getByRole("button", { name: "Codex" }));
    expect(location.search).toBe("?range=30&source=codex");
    // The whole page re-renders for the new source; that takes about a second in jsdom, longer while other files run.
    await waitFor(() => expect(document.getElementById("lede")!.textContent).toBe("$2.00 estimated cost"), { timeout: 5000 });
    expect(fetched()).toContain("/api/usage?range=30&source=codex");
  });

  it("names no agent when nothing was used in the range with every source, and the agent when one is picked", async () => {
    const none: UsagePayload = { ...usage, totals: { ...usage.totals, requests: 0 } };
    serve(none);
    at();
    const { unmount } = renderApp(<CostPage />);
    expect((await screen.findByRole("heading", { level: 1, name: /^No / })).textContent).toBe("No agent usage in the last 30 days.");
    unmount();
    serve({ ...none, source: "codex" });
    at("?range=30&source=codex");
    renderApp(<CostPage />);
    expect((await screen.findByRole("heading", { level: 1, name: /^No / })).textContent).toBe("No Codex usage in the last 30 days.");
  });

  it("marks the comparison as resting on thin history", async () => {
    await show({ ...doubled, totals: { ...doubled.totals, active_days: 5 } });
    expect(within(document.querySelector(".windows")!).getByText("thin history")).toBeTruthy();
    expect(how()).toMatch(/fewer than half as many days/);
    expect(within(table()).getByText(/The previous 30 days have prompts on only 1 day against 5 now/)).toBeTruthy();
  });

  it("shows all time since the first day, without a comparison or a change column", async () => {
    const lede = await show(usageAll);
    expect(lede.textContent).toMatch(/^\$[\d,.]+ estimated cost since \w{3} \d+, \d{4}$/);
    expect(document.querySelector(".windows")!.textContent).toMatch(/^All time /);
    expect(within(table()).getAllByRole("columnheader").map(h => h.textContent)).toEqual(["Project", "Trend?", "Spend↓", "Cost / commit", "Cache hit"]);
  });

  it("marks a project with no usage before as new, its whole cost an increase, and lists one used only before", async () => {
    await show(usage);
    const foo = table().querySelector('tbody tr[data-v="foo"]')!;
    expect(foo.querySelector(".chg")!.textContent).toBe("+$16new");
    expect(within(table()).getByText(/1 project marked new/)).toBeTruthy();
    // bar had a request before and none now: listed at $0 with its change.
    const bar = table().querySelector('tbody tr[data-v="bar"]')!;
    expect(bar.querySelector(".spend b")!.textContent).toBe("$0.00");
    expect(bar.querySelector(".chg .d")!.textContent).toBe("−$0.00");
    await userEvent.click(within(foo as HTMLElement).getByRole("button", { name: "foo" }));
    expect(location.search).toBe("?range=30&inspect=foo");
  });

  it("opens a project from the table with its change against the previous period", async () => {
    await show(usage);
    await userEvent.click(within(table()).getByRole("button", { name: "foo" }));
    const dlg = within(document.querySelector("dialog")!);
    await dlg.findByRole("heading", { name: "Change vs the previous 30 days" });
    expect(dlg.getByText("+$16", { exact: false }).textContent).toContain("new");
    expect(dlg.getByRole("img", { name: /^Daily cost sparkline: previous 30 days \$0\.00, last 30 days \$16\./ })).toBeTruthy();
  });

  it("names the project table and keeps a closed drawer's title a heading without rendering its table", async () => {
    await show(usage, []);
    expect(screen.getByRole("heading", { level: 2, name: /^Most expensive sessions/ }).querySelector("button")!.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("table", { name: "Most expensive sessions" })).toBeNull();
    act(() => openDrawer("d-top"));
    for (const name of ["Project spend and change", "Most expensive sessions"]) {
      const t = screen.getByRole("table", { name }), region = screen.getByRole("region", { name });
      expect(region.contains(t)).toBe(true);
      expect(region.tabIndex).toBe(0); // a keyboard user can scroll it
      expect(within(t).getAllByRole("columnheader").every(h => h.getAttribute("scope") === "col")).toBe(true);
    }
    const foo = within(screen.getByRole("table", { name: "Project spend and change" })).getByRole("rowheader", { name: /foo/ });
    expect(foo.getAttribute("scope")).toBe("row");
    expect(within(screen.getByRole("table", { name: "Most expensive sessions" })).getAllByRole("rowheader").length).toBe(usage.top_sessions.length);
  });

  it("names a cost-per-commit outlier and compares projects on request", async () => {
    await show(withProjects([proj("a", 6, 3), proj("b", 8, 4), proj("c", 10, 5), proj("d", 40, 5)]), []);
    const card = (await insights().findByText("Cost-per-commit outlier")).closest("article")!;
    expect(card.className).toMatch(/critical/);
    expect(within(card).getByText("d")).toBeTruthy();
    expect(card.textContent).toMatch(/4\.0× the median project \(\$2\.00\) over 5 commits/);
    await userEvent.click(within(card).getByRole("button", { name: "Compare projects" }));
    const rows = [...table().querySelectorAll("tbody tr")];
    expect(rows.map(r => r.getAttribute("data-v"))).toEqual(["d", "a", "b", "c"]);
    expect(rows[0]!.className).toMatch(/spot/);
    expect(document.activeElement).toBe(within(rows[0] as HTMLElement).getByRole("button", { name: "d" }));
    expect(table().querySelector(".proj-note")!.textContent).toMatch(/d: \$8\.00 per commit over 5 commits, 4\.0× the median project with 3\+ commits \(\$2\.00\)/);
    expect(within(table()).getByRole("button", { name: /Cost \/ commit/ }).closest("th")!.getAttribute("aria-sort")).toBe("descending");
    await userEvent.click(screen.getByRole("button", { name: "Sort by cost again" }));
    expect(table().querySelector(".proj-note")).toBeNull();
    expect(document.activeElement).toBe(within(table()).getByRole("button", { name: "Spend" }));
    expect((await within(table()).findByText("Sorted by spend, highest first")).getAttribute("role")).toBe("status");
    expect([...table().querySelectorAll("tbody tr")].map(r => r.getAttribute("data-v"))).toEqual(["d", "c", "b", "a"]);
  });

  it("says each sort in one polite region, a repeat and a new view's reset too", async () => {
    serve(withProjects([proj("a", 6, 3), proj("b", 8, 4), proj("c", 10, 5), proj("d", 40, 5)]));
    at();
    renderApp(<CostPage />);
    await loaded();
    const status = () => table().querySelectorAll("[role=status]");
    // What the region said: each text it took after being cleared (a screen reader reads a change of text, not a render).
    const said: string[] = [], region = status()[0]!;
    const watch = new MutationObserver(() => { if (region.textContent) said.push(region.textContent); });
    watch.observe(region, { childList: true, characterData: true, subtree: true });
    const step = async (run: () => Promise<void>) => { const n = said.length; await run(); await waitFor(() => expect(said.length).toBe(n + 1)); };
    const compare = async () => userEvent.click(within(insights().getByText("Cost-per-commit outlier").closest("article")!).getByRole("button", { name: "Compare projects" }));
    await insights().findByText("Cost-per-commit outlier");
    try {
      await step(compare);
      await step(compare); // the same sort again is said again
      await step(() => userEvent.click(screen.getByRole("button", { name: "Sort by cost again" })));
      await step(compare);
      await step(() => userEvent.click(screen.getByRole("button", { name: "Sort by cost again" })));
      expect(status()).toHaveLength(1); // the note under Compare projects is not a second region
      await step(() => userEvent.click(within(table()).getByRole("button", { name: "Project" })));
      // A new view resets the sort, and the region says the sort it is now.
      await step(async () => act(() => { history.pushState(null, "", "/cost?range=7"); dispatchEvent(new PopStateEvent("popstate")); }));
      const cpc = "Sorted by cost per commit, highest first", spend = "Sorted by spend, highest first";
      expect(said).toEqual([cpc, cpc, spend, cpc, spend, "Sorted by project, A to Z", spend]);
    } finally { watch.disconnect(); }
  });

  it("sorts the project table by any column, no value last either way", async () => {
    await show(withProjects([proj("a", 6, 3), proj("b", 8, 4), proj("idle", 20, 0)]));
    const names = () => [...table().querySelectorAll("tbody tr")].map(r => r.getAttribute("data-v"));
    const th = (name: string) => within(table()).getByRole("button", { name: new RegExp(name) }).closest("th")!;
    expect(names()).toEqual(["idle", "b", "a"]);
    expect(th("Spend").getAttribute("aria-sort")).toBe("descending");
    await userEvent.click(within(th("Cost / commit")).getByRole("button"));
    expect(names()).toEqual(["a", "b", "idle"]); // $2 each, ties keep order; n/a last
    expect(th("Cost / commit").getAttribute("aria-sort")).toBe("descending");
    expect(th("Spend").getAttribute("aria-sort")).toBeNull();
    await userEvent.click(within(th("Cost / commit")).getByRole("button"));
    expect(th("Cost / commit").getAttribute("aria-sort")).toBe("ascending");
    await waitFor(() => expect(table().querySelector(".sr[role=status]")!.textContent).toBe("Sorted by cost per commit, lowest first"));
    expect(names().at(-1)).toBe("idle");
    await userEvent.click(within(th("Project")).getByRole("button"));
    expect(names()).toEqual(["a", "b", "idle"]);
    await waitFor(() => expect(table().querySelector(".sr[role=status]")!.textContent).toBe("Sorted by project, A to Z"));
    // Every column sorts by keyboard too: Enter on the change header.
    within(th("Change vs prev 30d")).getByRole("button").focus();
    await userEvent.keyboard("{Enter}");
    expect(th("Change vs prev 30d").getAttribute("aria-sort")).toBe("descending");
    await userEvent.click(within(table()).getByRole("button", { name: /^Trend/ }));
    expect(th("^Trend").getAttribute("aria-sort")).toBe("descending");
  });

  it("downloads the project table in the order it shows, and copies it tab-separated", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await show(withProjects([proj("a", 6, 3), proj("b", 8, 4), proj("idle", 20, 0)]));
    const d = table();
    await userEvent.click(within(within(d).getByRole("button", { name: /Cost \/ commit/ }).closest("th")!).getByRole("button"));
    const names = (t: string, sep: string) => t.split(/\r?\n/).filter(Boolean).slice(1).map(l => l.split(sep)[0]);
    await userEvent.click(within(d).getByRole("button", { name: "Download CSV cost projects" }));
    expect(download).toHaveBeenCalledWith(`ai-ledger-cost-projects-${dayStamp()}.csv`, expect.any(String));
    const csv = vi.mocked(download).mock.calls.at(-1)![1];
    expect(csv.split("\r\n")[0]).toBe("Project,Est. cost (USD),Tokens,Cache hit,1h writes,Subagent cost share,Commits,Cost per commit (USD),Cost per prompt (USD),Change vs previous (USD)");
    expect(names(csv, ",")).toEqual(["a", "b", "idle"]);
    expect(csv.split("\r\n")[3]!.split(",")[7]).toBe(""); // no commits: cost per commit is empty
    fireEvent.click(within(d).getByRole("button", { name: "Copy cost projects" }));
    expect(await within(d).findByRole("button", { name: "Copied cost projects" })).toBeTruthy();
    expect(within(d).getByText("Copied to clipboard.")).toBeTruthy();
    const tsv = writeText.mock.calls[0]![0] as string;
    expect(tsv.split("\n")[0]!.split("\t")[0]).toBe("Project");
    expect(names(tsv, "\t")).toEqual(["a", "b", "idle"]);
    await waitFor(() => expect(within(d).getByRole("button", { name: "Copy cost projects" })).toBeTruthy(), { timeout: 3000 });
  });

  it("offers no export when the project table has no rows", async () => {
    await show(withProjects([]));
    expect(within(table()).queryByRole("button", { name: "Download CSV cost projects" })).toBeNull();
  });

  it("downloads the most expensive sessions with their figures", async () => {
    await show(usage);
    const d = drawer("d-top");
    await userEvent.click(within(d).getByRole("button", { name: "Download CSV cost sessions" }));
    expect(download).toHaveBeenLastCalledWith(`ai-ledger-cost-sessions-${dayStamp()}.csv`, expect.any(String));
    const lines = vi.mocked(download).mock.calls.at(-1)![1].split("\r\n").filter(Boolean);
    expect(lines[0]).toBe("Session id,Title,Project,Started,Branch,Active seconds,Prompts,Commits,Cost per commit (USD),Est. cost (USD)");
    expect(lines).toHaveLength(usage.top_sessions.length + 1);
    expect(lines[1]!.split(",")[0]).toBe(usage.top_sessions[0]!.session_id);
  });

  describe("small projects bucket", () => {
    const real = (n: string, cost: number) => ({ ...proj(n, cost, 10), prompts: 50, tokens: 1000 });
    const tiny = (n: string, cost = 0.01) => ({ ...proj(n, cost, 1), prompts: 1, tokens: 10 });
    const seven = () => withProjects([real("r1", 100), real("r2", 90), real("r3", 80), tiny("t1"), tiny("t2"), tiny("t3"), tiny("t4")]);
    const names = () => within(table()).getAllByRole("row").slice(1).map(r => r.querySelector(".name")?.textContent);
    it("folds scratch projects into one row with their sums, and expands it", async () => {
      await show(seven());
      const d = within(table());
      expect(names()).toEqual(["r1", "r2", "r3", "Small projects (4) Show 4 small projects"]);
      const bucket = d.getByText("Small projects (4)").closest("tr")!;
      expect(bucket.querySelector(".spend b")!.textContent).toBe("$0.04");
      const btn = d.getByRole("button", { name: "Show 4 small projects" });
      expect(btn.getAttribute("aria-expanded")).toBe("false");
      await userEvent.click(btn);
      expect(d.getByRole("button", { name: "Hide small projects" }).getAttribute("aria-expanded")).toBe("true");
      expect(names().map(n => n?.slice(0, 2))).toEqual(["r1", "r2", "r3", "Sm", "t1", "t2", "t3", "t4"]);
      await userEvent.click(d.getByRole("button", { name: "Hide small projects" }));
      expect(names()).toHaveLength(4);
      expect(d.getByText("7")).toBeTruthy(); // the count is every project
    });
    it("keeps big projects above the small ones whatever the sort", async () => {
      await show(seven());
      const d = within(table());
      await userEvent.click(d.getByRole("button", { name: "Spend" }));
      expect(names().slice(0, 3)).toEqual(["r3", "r2", "r1"]);
      expect(names()[3]).toMatch(/^Small projects/);
    });
    it("sums the small projects' change, unknown when one of them is", async () => {
      const ch = (project: string, delta: number | null) => ({ project, cost: 0.01, prev_cost: delta == null ? null : 0.01 - delta, delta, new: false });
      await show({ ...seven(), changes: [ch("t1", 0.01), ch("t2", 0.02), ch("t3", 0), ch("t4", 0)] });
      expect(within(table()).getByText("Small projects (4)").closest("tr")!.querySelector(".chg .d")!.textContent).toBe("+$0.03");
      cleanup();
      await show({ ...seven(), changes: [ch("t1", 0.01), ch("t2", null)] });
      expect(within(table()).getByText("Small projects (4)").closest("tr")!.querySelector(".chg .d")!.textContent).toBe("–");
    });
    it("reads a bucket of projects with unknown costs as unknown, not $0", async () => {
      const unknown = (n: string) => ({ ...tiny(n), cost: null, cost_per_commit: null });
      await show(withProjects([real("r1", 100), real("r2", 90), real("r3", 80), unknown("t1"), unknown("t2"), unknown("t3")]));
      const cost = within(table()).getByText("Small projects (3)").closest("tr")!.querySelector(".spend b")!.textContent;
      expect(cost).toBe("–");
    });
    it("exports every project, folded or not", async () => {
      await show(seven());
      await userEvent.click(within(table()).getByRole("button", { name: "Download CSV cost projects" }));
      const lines = vi.mocked(download).mock.calls.at(-1)![1].split("\r\n").filter(Boolean).slice(1);
      expect(lines.map(l => l.split(",")[0])).toEqual(["r1", "r2", "r3", "t1", "t2", "t3", "t4"]);
    });
  });

  it("tints against the median of projects big enough to compare, not the scratch ones", async () => {
    const real = (n: string, cost: number) => ({ ...proj(n, cost, 10), prompts: 50 });
    const tiny = (n: string) => ({ ...proj(n, 0.01, 0), prompts: 1, cache_hit_ratio: 0.5 });
    const scratch = Array.from({ length: 10 }, (_, i) => tiny(`t${i}`));
    await show(withProjects([real("r1", 100), real("r2", 100), real("r3", 300), ...scratch]));
    await userEvent.click(within(table()).getByRole("button", { name: "Show 10 small projects" }));
    const cell = (p: string, i: number) => table().querySelector(`tbody tr[data-v="${p}"]`)!.querySelectorAll("td")[i]!;
    expect(cell("r1", CPC).className).not.toMatch(/tone/);
    expect(cell("r3", CPC).className).toMatch(/tone worse/); // $30 a commit against $10
    expect(cell("t0", HIT).className).not.toMatch(/tone/); // 50% cache hit, but too small to compare
    expect(table().querySelector(".tone-key")!.textContent).toMatch(/median of the 3 projects with 2%\+ of cost or 10\+ prompts/);
  });

  it("does not tint when fewer than three projects are big enough", async () => {
    const tiny = (n: string) => ({ ...proj(n, 0.01, 0), prompts: 1 });
    await show(withProjects([{ ...proj("r1", 100, 10), prompts: 50 }, { ...proj("r2", 300, 10), prompts: 50 }, tiny("a"), tiny("b")]));
    expect(table().querySelector(".tone-key")).toBeNull();
    expect(table().querySelector("td.tone")).toBeNull();
  });

  it("names no cost-per-commit outlier under 2% of spend", async () => {
    await show(withProjects([...["a", "b", "c", "e", "f"].map(n => proj(n, 200, 200)), proj("tiny", 15, 3)])); // $5 a commit against $1, 1.5% of spend
    expect(insights().queryByText("Cost-per-commit outlier")).toBeNull();
    expect(insights().getByText(/No project with 2% or more of the spend costs over twice the median/)).toBeTruthy();
  });

  it("ranks models by their share of cost, under 1% as <1%, the top 8 until Show all", async () => {
    const m = (model: string, cost: number | null, requests: number): ModelRow => ({ model, effort: "(none)", fast: false, requests, tokens: 1, cost });
    const models = [m("cheap-busy", 1, 900), m("dear", 300, 10), m("dust", 0.5, 5), m("free", null, 50),
      ...[1, 2, 3, 4, 5, 6, 7].map(k => m(`mid-${k}`, 20, 1))];
    await show({ ...usage, models });
    const panel = screen.getByRole("heading", { name: "Models and effort" }).closest("section")!;
    const rows = () => [...panel.querySelectorAll(".ledger li")];
    expect(rows().map(r => r.querySelector(".n")!.textContent)).toEqual(["dear", ...[1, 2, 3, 4, 5, 6, 7].map(k => `mid-${k}`)]);
    await userEvent.click(within(panel).getByRole("button", { name: "Show all 11" }));
    expect(rows().slice(-3).map(r => [r.querySelector(".n")!.textContent, r.querySelector(".v")!.textContent])).toEqual([["cheap-busy", "<1%"], ["dust", "<1%"], ["free", "–"]]);
  });

  it("marks fast-mode requests in the models ledger as their own row", async () => {
    const m = (fast: boolean, cost: number): ModelRow => ({ model: "claude-opus-5-5", effort: "high", fast, requests: 1, tokens: 1, cost });
    await show({ ...usage, models: [m(false, 10), m(true, 20)] });
    const panel = screen.getByRole("heading", { name: "Models and effort" }).closest("section")!;
    expect([...panel.querySelectorAll(".ledger li .n")].map(n => n.textContent)).toEqual(["opus-5-5 · high · fast", "opus-5-5 · high"]);
  });

  it("shows an unknown previous cost as unknown, with no change", async () => {
    await show({ ...usage, previous: { ...usage.previous!, cost: null }, changes: [{ project: "foo", cost: 15.8, prev_cost: null, delta: null, new: false }] });
    expect(how()).toMatch(/Previous period, Sep 7 – Oct 6, 2026: –, 1 of 30 days with prompts\./);
    expect(table().querySelector('tbody tr[data-v="foo"] .chg')!.textContent).toBe("–");
  });

  it("follows the cost after the project table to the heading's total, opens a project's sheet from it, and draws two columns for one project", async () => {
    await show(sources, []);
    const flow = document.getElementById("flow")!, total = usd(sources.totals.cost!);
    expect(table().compareDocumentPosition(flow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(flow.compareDocumentPosition(document.querySelector(".split")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent!.startsWith(`${total} estimated cost`)).toBe(true);
    const graph = within(flow).getByRole("group", { name: /^Estimated cost from project to model to token kind/ });
    expect(graph.getAttribute("aria-label")).toContain(`, ${total} in all:`);
    // Enter on a project opens its sheet as the table does: the filter stays.
    act(() => graph.focus());
    fireEvent.keyDown(graph, { key: "ArrowRight" });
    expect(flow.querySelector(".flow-live")!.textContent!.startsWith(`Project foo: ${total}, 100.0% of ${total}`)).toBe(true);
    fireEvent.keyDown(graph, { key: "Enter" });
    expect(location.search).toBe("?range=30&inspect=foo");
    await waitFor(() => expect(document.querySelector("dialog")).toBeTruthy());
    cleanup();
    // One project selected: no project column, from the same payload.
    serve({ ...sources, project: "foo" });
    at("?range=30&project=foo");
    renderApp(<CostPage />);
    await loaded();
    const one = within(document.getElementById("flow")!).getByRole("group", { name: /^Estimated cost on foo from model to token kind/ });
    expect(one.getAttribute("aria-label")).toContain(`, ${total} in all:`);
    expect(one.getAttribute("aria-label")).not.toMatch(/Enter on a project/);
    act(() => one.focus());
    fireEvent.keyDown(one, { key: "ArrowRight" });
    expect(document.querySelector("#flow .flow-live")!.textContent).toMatch(/^Model m-a: /);
    fireEvent.keyDown(one, { key: "Enter" });
    expect(location.search).toBe("?range=30&project=foo");
  });

  it("leaves the project table out of a one-project view", async () => {
    serve({ ...usage, project: "foo" });
    at("?range=30&project=foo");
    renderApp(<CostPage />);
    await loaded();
    expect(document.getElementById("projects")).toBeNull();
  });

  it("keeps the daily chart's zoom, and the focus on Show all days, when an ingest brings newer figures", async () => {
    // What the status watcher does about every minute while a session runs: the usage is fetched again, with today's cost up.
    let served = usage;
    mockApi({ "/api/usage": () => served, "/api/sessions": () => sessions, "/api/session": () => session });
    at();
    const { client } = renderPage(<CostPage />);
    await loaded();
    const chart = await daily();
    chart.zoomTo(5, 14);
    act(() => screen.getByRole("button", { name: "Show all days" }).focus());
    const draws = chart.options.length, status = document.querySelector("#spend .sr")!.textContent;
    served = { ...usage, daily: usage.daily.map(r => (r.day === usage.end ? { ...r, cost: (r.cost ?? 0) + 5 } : r)) };
    await ingested(client);
    await waitFor(() => expect(chart.options.length).toBeGreaterThan(draws)); // the newer figures are drawn
    expect(chart.shown).toEqual({ from: 5, to: 14 });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Show all days" }));
    expect(document.querySelector("#spend .sr")!.textContent).toBe(status);
  });

  it("says when every token kind is hidden and shows them again", async () => {
    localStorage.setItem("claude-usage-metric", JSON.stringify("tokens"));
    localStorage.setItem("claude-usage-hidden", JSON.stringify(["input", "text_out", "thinking", "cache_read", "cache_5m", "cache_1h"]));
    try {
      await show(usage);
      await userEvent.click(screen.getByRole("button", { name: "Show every kind" }));
      expect(screen.queryByText("All token kinds are hidden.")).toBeNull();
      expect(screen.getByRole("button", { name: "Input" }).getAttribute("aria-pressed")).toBe("true");
    } finally {
      localStorage.clear();
    }
  });

  it("remembers the tokens scale across a remount", async () => {
    localStorage.setItem("claude-usage-metric", JSON.stringify("tokens"));
    try {
      await show(usage);
      expect(screen.getByRole("group", { name: /^Tokens by kind per day/ })).toBeTruthy();
      await userEvent.click(within(screen.getByRole("group", { name: "Scale" })).getByRole("button", { name: "Share" }));
      expect(screen.getByRole("group", { name: /^Token share by kind per day/ })).toBeTruthy();
      cleanup();
      await show(usage);
      expect(screen.getByRole("group", { name: /^Token share by kind per day/ })).toBeTruthy();
    } finally {
      localStorage.clear();
    }
  });

  it("remembers the stacking across a remount and filters to an agent from its key", async () => {
    try {
      await show(usage);
      await userEvent.click(screen.getByRole("button", { name: "Agent" }));
      expect(screen.getByRole("group", { name: /^Estimated cost by agent per day/ })).toBeTruthy();
      await userEvent.click(within(document.querySelector(".legend") as HTMLElement).getByRole("button", { name: "Claude Code" }));
      expect(location.search).toBe("?range=30&source=claude");
      cleanup();
      await show(usage);
      expect(screen.getByRole("button", { name: "Agent" }).getAttribute("aria-pressed")).toBe("true");
      expect(screen.getByRole("group", { name: /^Estimated cost by agent per day/ })).toBeTruthy();
    } finally {
      localStorage.clear();
    }
  });

  it("stacks three agents by Agent, each in its own colour, and leaves Grok's reported cost out of the kind shares", async () => {
    try {
      await show(sources);
      await userEvent.click(screen.getByRole("button", { name: "Agent" }));
      expect(screen.getByRole("group", { name: /^Estimated cost by agent per day/ })).toBeTruthy();
      const legend = within(document.querySelector(".legend") as HTMLElement);
      const keys = ["Claude Code", "Codex", "Grok"].map(name => legend.getByRole("button", { name }));
      expect(new Set(keys.map(k => k.querySelector("i, span[style]")?.getAttribute("style"))).size).toBe(3);
      const tokens = drawer("d-tokens");
      expect(tokens.textContent).toContain("is the cost Grok reported, with no split by kind, so it is not in this breakdown.");
      const shares = [...tokens.querySelectorAll(".tp-row .sr")].map(d => Number(/([\d.]+)% of estimated cost/.exec(d.textContent!)![1]));
      expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 0);
      await userEvent.click(legend.getByRole("button", { name: "Grok" }));
      expect(location.search).toBe("?range=30&source=grok");
    } finally {
      localStorage.clear();
    }
  });

  it("shows cost per commit as n/a with no commits, an unknown one as a dash, and names the project-less row", async () => {
    const d = withProjects([proj("a", 6, 3), proj("idle", 20, 0), { ...proj("ghost", 0, 3), cost: null, cost_per_commit: null }, { ...proj("x", 2, 1), project: null }]);
    await show({ ...d, projects: ["a", "idle", "ghost"] }); // the picker lists named projects only
    const rows = table().querySelectorAll("tbody tr");
    expect(table().querySelector('tbody tr[data-v="idle"]')!.querySelectorAll("td")[CPC]!.textContent).toBe("n/a");
    const ghost = table().querySelector('tbody tr[data-v="ghost"]')!;
    expect(ghost.querySelectorAll("td")[CPC]!.textContent).toBe("–");
    expect([...rows].some(r => r.querySelector(".name")!.textContent === "(no project)")).toBe(true);
  });

  it("says cost per commit is not available when nothing was committed", async () => {
    await show(withProjects([proj("idle", 20, 0)]));
    const card = insights().getByText("No commits").closest("article")!;
    expect(within(card).getByText("n/a")).toBeTruthy();
    expect(within(card).getByRole("button", { name: "See cost per prompt" })).toBeTruthy();
  });

  it("names unpriced models and marks their spend with +?", async () => {
    await show(usage);
    const banner = screen.getByText("Unpriced models:").closest(".banner")!.textContent;
    expect(banner).toMatch(/m-unknown \(200 tokens\)/);
    expect(banner).toMatch(/add them to \/Users\/example\/Library\/Application Support\/ai-ledger\/prices\.json/);
    const row = document.querySelector('#projects tr[data-v="foo"]')!;
    const chip = within(row as HTMLElement).getByTitle("1 request from unpriced models");
    expect(chip.querySelector(".sr")!.textContent).toBe("plus an unknown cost for 1 request from unpriced models");
    expect(chip.querySelector("[aria-hidden=true]")!.textContent).toBe("+?");
    expect(screen.getByText("unpriced").className).toMatch(/chip warn/);
    expect(row.querySelector(".spend")!.textContent).toMatch(/\$16 \+\?/);
  });

  it("says when the user prices file was ignored, and why", async () => {
    await show({ ...usage, prices_file: { ...usage.prices_file, error: "Expecting value: line 1 column 1 (char 0)" } });
    expect(screen.getByText("Prices file ignored:").closest(".banner")!.textContent)
      .toMatch(/ai-ledger\/prices\.json could not be used \(Expecting value: line 1 column 1 \(char 0\)\)\. Packaged prices apply/);
  });

  it("selecting a day on the chart lists that day's sessions by cost", async () => {
    await show(usage, []);
    const chart = screen.getByRole("group", { name: /^Estimated cost by project per day, 30 days, peaking at \$16 on Nov 4, 2026/ });
    act(() => chart.focus());
    fireEvent.keyDown(chart, { key: "End" });
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    expect(screen.getByText("Nov 4, 2026: $16 estimated. 7-day average $2.26")).toBeTruthy();
    fireEvent.keyDown(chart, { key: "Enter" });
    expect(isOpen("d-top")).toBe(true);
    expect(screen.getByText("Active on Nov 4, 2026")).toBeTruthy();
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&day=2026-11-04"));
    // The server costs each session on that day and orders them; the drawer keeps its order and counts them all.
    expect(await within(drawer("d-top")).findByText("3 sessions active on Nov 4, 2026, by their estimated cost on that day. Select a session for details.")).toBeTruthy();
    expect([...drawer("d-top").querySelectorAll("tbody tr")].map(r => r.getAttribute("data-v"))).toEqual(["s1", "s3", "s2"]);
    expect(drawer("d-top").querySelector(".drawer-head .c")!.textContent).toBe("3");
    await userEvent.click(screen.getByRole("button", { name: "Show the most expensive sessions on every day" }));
    expect(within(drawer("d-top")).getByText(/The 2 most expensive sessions in this view/)).toBeTruthy();
    // Tokens: one series per kind.
    await userEvent.click(within(screen.getByRole("group", { name: "Chart metric" })).getByRole("button", { name: "Tokens" }));
    expect(screen.getByRole("group", { name: /^Tokens by kind per day/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cache read" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("pairs each billed kind's share of tokens with its share of cost in the Tokens and cache drawer, costliest first", async () => {
    await show(usage);
    const rows = [...drawer("d-tokens").querySelectorAll(".tp-row .sr")].map(d => d.textContent!);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toBe("Output + thinking: 8.3% of tokens, 63.3% of estimated cost");
    expect(rows.find(r => r.startsWith("Cache read"))).toBe("Cache read: 66.7% of tokens, 5.1% of estimated cost");
    expect(rows.some(r => r.startsWith("Cache write 5m") || r.startsWith("Thinking"))).toBe(false);
    // The bars: tokens left, cost right, each as long as its share.
    const read = [...drawer("d-tokens").querySelectorAll(".tp-row")].find(r => r.textContent!.startsWith("Cache read"))!;
    expect(read.querySelector<HTMLElement>(".tp-l i")!.style.width).toMatch(/^66\.6/);
    expect(read.querySelector<HTMLElement>(".tp-r i")!.style.width).toMatch(/^5\.0|^5\.1/);
    expect(within(drawer("d-tokens")).getByText("Cache read is 66.7% of tokens and 5.1% of estimated cost.")).toBeTruthy();
  });

  it("gives the exact tokens and cost of each kind in a data table, with thinking and both cache write lifetimes", async () => {
    await show(usage, ["d-tokens"]);
    await userEvent.click(within(drawer("d-tokens")).getByRole("button", { name: "Show data table" }));
    const table = within(drawer("d-tokens")).getByRole("table", { name: "Tokens and estimated cost by kind" });
    const cells = (name: string) => [...within(table).getByRole("rowheader", { name }).closest("tr")!.querySelectorAll("td")].map(c => c.textContent);
    // Full token counts and dollars to the cent (not 8.0M or $10); shares to one decimal.
    expect(cells("Cache read")).toEqual([num(8000000), "66.7%", "$0.80", "5.1%"]);
    expect(cells("Output + thinking")).toEqual([num(1000100), "8.3%", "$10.00", "63.3%"]);
    expect(cells("Input")).toEqual([num(2000100), "16.7%", "$2.00", "12.7%"]);
    expect(cells("Cache write")).toEqual([num(1000000), "8.3%", "$3.00", "19.0%"]);
    expect(cells("Thinking (in output)")).toEqual([num(500000), "", "", ""]);
    expect(cells("5-minute cache write")).toEqual([num(500000), "", "$1.00", ""]);
    expect(cells("1-hour cache write")).toEqual([num(500000), "", "$2.00", ""]);
    expect(within(table).queryByRole("rowheader", { name: "Cache write 5m" })).toBeNull();
  });

  it("shows an unknown cost by kind as a dash, not $0, with no cost bar", async () => {
    const none = { cost: null, cost_input: null, cost_output: null, cost_cache_read: null, cost_cache_5m: null, cost_cache_1h: null };
    await show({ ...usage, totals: { ...usage.totals, ...none } }, ["d-tokens"]);
    const d = drawer("d-tokens");
    expect(d.querySelector(".tp-row .sr")!.textContent).toMatch(/cost unknown$/);
    expect(d.querySelectorAll(".tp-r i")).toHaveLength(0);
    expect(within(d).getByText(/share of cost is unknown/)).toBeTruthy();
    await userEvent.click(within(d).getByRole("button", { name: "Show data table" }));
    expect(within(d).getByRole("table", { name: "Tokens and estimated cost by kind" }).textContent).not.toMatch(/\$0/);
  });

  it("tells a known zero cost from an unknown one: models priced at zero rates", async () => {
    const free = { cost: 0, cost_input: 0, cost_output: 0, cost_cache_read: 0, cost_cache_5m: 0, cost_cache_1h: 0 };
    await show({ ...usage, totals: { ...usage.totals, ...free } }, ["d-tokens"]);
    const d = drawer("d-tokens");
    expect(within(d).getByText("The priced requests in this view cost $0.00, so no kind has a share of estimated cost.")).toBeTruthy();
    expect(within(d).queryByText(/is priced|unknown/)).toBeNull();
    expect(d.querySelector(".tp-row .sr")!.textContent).toMatch(/0\.0% of estimated cost$/);
    // No fill for a zero share, on either side.
    expect(d.querySelectorAll(".tp-r i")).toHaveLength(0);
    await userEvent.click(within(d).getByRole("button", { name: "Show data table" }));
    const table = within(d).getByRole("table", { name: "Tokens and estimated cost by kind" });
    expect([...within(table).getByRole("rowheader", { name: "Cache read" }).closest("tr")!.querySelectorAll("td")].map(c => c.textContent).slice(2)).toEqual(["$0.00", "0.0%"]);
  });

  it("names the kind with the widest gap even when every gap is small", async () => {
    // Shares of cost close to the shares of tokens (Input 16.7/19, Output 8.3/10, Cache read 66.7/66, Cache write 8.3/5): Cache write's
    // 3.3 points are the widest gap.
    const close = { cost: 10, cost_input: 1.9, cost_output: 1, cost_cache_read: 6.6, cost_cache_5m: .25, cost_cache_1h: .25 };
    await show({ ...usage, totals: { ...usage.totals, ...close } }, ["d-tokens"]);
    expect(within(drawer("d-tokens")).getByText("Cache write is 8.3% of tokens and 5.0% of estimated cost.")).toBeTruthy();
  });

  it("names the costlier kind on a tie, whatever the float rounding of the gaps", async () => {
    // Input 70% of tokens and 60% of cost, Output 30% and 40%: both gaps are 10 points.
    const tie = { tokens: 100, input: 70, output: 30, thinking: 0, cache_read: 0, cache_5m: 0, cache_1h: 0,
      cost: 10, cost_input: 6, cost_output: 4, cost_cache_read: 0, cost_cache_5m: 0, cost_cache_1h: 0 };
    await show({ ...usage, totals: { ...usage.totals, ...tie } }, ["d-tokens"]);
    expect(within(drawer("d-tokens")).getByText("Input is 70.0% of tokens and 60.0% of estimated cost.")).toBeTruthy();
  });
});

describe("daily chart zoom", () => {
  it("leaves the view alone: the heading, the project table and the URL keep 30 days, nothing is fetched, the data table lists them all", async () => {
    await show(usage, []);
    const chart = await daily();
    const heading = screen.getByRole("heading", { level: 1 }).textContent, projects = table().textContent, requests = fetched().length;
    chart.zoomTo(5, 14);
    expect(await screen.findByRole("button", { name: "Show all days" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(heading);
    expect(table().textContent).toBe(projects);
    expect(location.search).toBe("?range=30");
    expect(fetched()).toHaveLength(requests);
    await userEvent.click(within(document.getElementById("spend")!).getByRole("button", { name: "Show data table" }));
    expect(within(screen.getByRole("table", { name: /per day$/ })).getAllByRole("row")).toHaveLength(31);
  });
});
