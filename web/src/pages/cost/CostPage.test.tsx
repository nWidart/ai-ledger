import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ModelRow, ProjectRow, SessionsPage, UsagePayload } from "../../api";
import usage from "../../__fixtures__/usage";
import usageAll from "../../__fixtures__/usage-all";
import sessions from "../../__fixtures__/sessions";
import session from "../../__fixtures__/session";
import { mockApi } from "../../components/sheets/testing";
import { dayStamp, download } from "../../components/export";
import { compareText, costDays, planText, thinHistory } from "./cost";
import { CostPage } from "./CostPage";

vi.mock("../../components/export", async orig => ({ ...(await orig<typeof import("../../components/export")>()), download: vi.fn() }));

const at = (hash = "#range=30") => history.replaceState(null, "", "/cost" + hash);
// The day's sessions as the server sends them: costliest on that day first.
const byDay: SessionsPage = { ...sessions, sessions: ["s1", "s3", "s2"].map(id => sessions.sessions.find(s => s.session_id === id)!) };
const serve = (d: UsagePayload) => mockApi({ "/api/usage": () => d, "/api/sessions": q => (q.get("day") ? byDay : sessions), "/api/session": () => session });
const loaded = () => screen.findByRole("heading", { level: 1, name: /estimated cost/ });
const fetched = () => vi.mocked(fetch).mock.calls.map(c => c[0]);
const show = (d: UsagePayload) => { serve(d); at(); render(<CostPage />); return loaded(); };
const insights = () => within(document.getElementById("insights")!);
const drawer = (id: string) => document.getElementById(id) as HTMLDetailsElement;

// Variants of the 30-day fixture for cases it lacks.
const base = usage.by_project[0]!;
const proj = (project: string, cost: number, commits: number): ProjectRow =>
  ({ ...base, project, cost, commits, unpriced: 0, cost_per_commit: commits ? cost / commits : null });
const withProjects = (rows: ProjectRow[]): UsagePayload => ({ ...usage, projects: rows.map(p => p.project!), by_project: rows,
  totals: { ...usage.totals, commits: rows.reduce((a, p) => a + p.commits, 0), cost: rows.reduce((a, p) => a + (p.cost ?? 0), 0) } });
const doubled: UsagePayload = { ...usage, previous: { ...usage.previous!, cost: 7.9 } };

describe("plan context", () => {
  const max = { provider: "claude" as const, label: "Claude Max 20x", monthly: 200 };
  const priced = { ...usage, plans: [max], totals: { ...usage.totals, cost: 840 } };

  it("shows the list-price cost as a multiple of the plan prorated to the view", async () => {
    await show(priced);
    expect(screen.getByText(/You pay about \$200 a month \(Claude Max 20x\); at list prices this period is 4\.2× your plan\./)).toBeTruthy();
  });

  it("is absent when the payload has no plan", async () => {
    await show({ ...priced, plans: [] });
    expect(screen.queryByText(/You pay about/)).toBeNull();
  });

  it("sums two plans, prorates all time, says a multiple below 1 plainly and is silent without a cost", () => {
    const codex = { provider: "codex" as const, label: "ChatGPT Plus", monthly: 20 };
    expect(planText({ ...priced, plans: [max, codex] })).toBe("You pay about $220 a month (Claude Max 20x + ChatGPT Plus); at list prices this period is 3.8× your plans.");
    expect(planText({ ...priced, totals: { ...priced.totals, cost: 120 } })).toContain("0.6× your plan");
    expect(planText({ ...priced, range: 0, daily: [{ ...priced.daily[0]!, day: "2026-09-12" }], end: "2026-11-10" })).toContain("2.1× your plan");
    expect(planText({ ...priced, totals: { ...priced.totals, cost: null } })).toBeNull();
  });
});

describe("cost run rate", () => {
  const rate = { month_cost: 120, daily_avg: 10, days_left: 18, projected: 300 };

  it("says how the month is on pace, as an estimate at list prices", async () => {
    await show({ ...usage, run_rate: rate });
    expect(screen.getByText(/Cost is estimated at API list prices.* On pace for about \$300 this month\./)).toBeTruthy();
  });

  it("says nothing without a projection", async () => {
    await show({ ...usage, run_rate: null });
    expect(screen.queryByText(/On pace/)).toBeNull();
  });
});

describe("cost figures", () => {
  it("compares with the previous period as a multiple from 2x, a percentage below", () => {
    expect(compareText(doubled)).toEqual({ text: "2.0× the previous 30 days", sr: "2.0 times the previous 30 days" });
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
  it("leads a thirty-day view with its cost, the change and both windows with their days with prompts", async () => {
    const lede = await show(doubled);
    expect(lede.textContent).toBe("$16 estimated cost, 2.0× the previous 30 days2.0 times the previous 30 days");
    const windows = document.querySelector(".windows")!.textContent;
    expect(windows).toMatch(/This period Oct 7 – Nov 5, 2026 · 2 of 30 days with prompts/);
    expect(windows).toMatch(/Previous Sep 7 – Oct 6, 2026 · \$7\.90 · 1 of 30 days with prompts/);
    expect(windows).not.toMatch(/thin history/);
    expect(screen.getByRole("img", { name: "Daily cost sparkline: previous 30 days $7.90, last 30 days $16." })).toBeTruthy();
  });

  it("narrows to Codex when picked and records it in the URL", async () => {
    const codex: UsagePayload = { ...usage, source: "codex", previous: null, totals: { ...usage.totals, cost: 2 } };
    mockApi({ "/api/usage": q => (q.get("source") === "codex" ? codex : usage), "/api/sessions": () => sessions, "/api/session": () => session });
    at();
    render(<CostPage />);
    await loaded();
    await userEvent.click(within(screen.getByRole("group", { name: "Source" })).getByRole("button", { name: "Codex" }));
    expect(location.hash).toBe("#range=30&source=codex");
    // The whole page re-renders for the new source; that takes about a second in jsdom, longer while other files run.
    await waitFor(() => expect(document.getElementById("lede")!.textContent).toBe("$2.00 estimated cost"), { timeout: 5000 });
    expect(fetched()).toContain("/api/usage?range=30&source=codex");
  });

  it("names no agent when nothing was used in the range with every source, and the agent when one is picked", async () => {
    const none: UsagePayload = { ...usage, totals: { ...usage.totals, requests: 0 } };
    serve(none);
    at();
    const { unmount } = render(<CostPage />);
    expect((await screen.findByRole("heading", { level: 1, name: /^No / })).textContent).toBe("No agent usage in the last 30 days.");
    unmount();
    serve({ ...none, source: "codex" });
    at("#range=30&source=codex");
    render(<CostPage />);
    expect((await screen.findByRole("heading", { level: 1, name: /^No / })).textContent).toBe("No Codex usage in the last 30 days.");
  });

  it("marks the comparison as resting on thin history", async () => {
    await show({ ...doubled, totals: { ...doubled.totals, active_days: 5 } });
    expect(within(document.querySelector(".windows")!).getByText("thin history")).toBeTruthy();
    expect(screen.getByText(/The previous window has prompts on only 1 day against 5 now/)).toBeTruthy();
  });

  it("shows all time since the first day, without a comparison or What changed", async () => {
    const lede = await show(usageAll);
    expect(lede.textContent).toMatch(/^\$[\d,.]+ estimated cost since \w{3} \d+, \d{4}$/);
    expect(document.getElementById("changed")).toBeNull();
    expect(document.querySelector(".windows")!.textContent).toMatch(/^All time /);
  });

  it("marks a project with no usage before as new, its whole cost an increase", async () => {
    await show(usage);
    const changed = within(document.getElementById("changed")!);
    const foo = changed.getByRole("button", { name: /^foo, new: \+\$16, from \$0 to \$16/ });
    expect(within(foo).getByText("new")).toBeTruthy();
    expect(changed.getByText(/1 project marked new had no usage at all before, worth \$16/)).toBeTruthy();
    await userEvent.click(foo);
    expect(location.hash).toBe("#range=30&inspect=foo");
  });

  it("opens a project from What changed with its change against the previous period", async () => {
    await show(usage);
    await userEvent.click(within(document.getElementById("changed")!).getByRole("button", { name: /^foo, new/ }));
    const dlg = within(document.querySelector("dialog")!);
    await dlg.findByRole("heading", { name: "Change vs the previous 30 days" });
    expect(dlg.getByText("+$16", { exact: false }).textContent).toContain("new");
    expect(dlg.getByRole("img", { name: /^Daily cost sparkline: previous 30 days \$0\.00, last 30 days \$16\./ })).toBeTruthy();
  });

  it("names a cost-per-commit outlier and compares projects on request", async () => {
    await show(withProjects([proj("a", 6, 3), proj("b", 8, 4), proj("c", 10, 5), proj("d", 40, 5)]));
    const card = (await insights().findByText("Cost-per-commit outlier")).closest("article")!;
    expect(card.className).toMatch(/critical/);
    expect(within(card).getByText("d")).toBeTruthy();
    expect(card.textContent).toMatch(/4\.0× the median project \(\$2\.00\) over 5 commits/);
    await userEvent.click(within(card).getByRole("button", { name: "Compare projects" }));
    expect(drawer("d-projcost").open).toBe(true);
    const rows = [...drawer("d-projcost").querySelectorAll("tbody tr")];
    expect(rows.map(r => r.getAttribute("data-v"))).toEqual(["d", "a", "b", "c"]);
    expect(rows[0]!.className).toMatch(/spot/);
    expect(document.activeElement).toBe(within(rows[0] as HTMLElement).getByRole("button", { name: "d" }));
    expect(drawer("d-projcost").querySelector(".proj-note")!.textContent).toMatch(/d: \$8\.00 per commit over 5 commits, 4\.0× the median project with 3\+ commits \(\$2\.00\)/);
    expect(within(drawer("d-projcost")).getByRole("button", { name: /Cost \/ commit/ }).closest("th")!.getAttribute("aria-sort")).toBe("descending");
    await userEvent.click(screen.getByRole("button", { name: "Sort by cost again" }));
    expect(drawer("d-projcost").querySelector(".proj-note")).toBeNull();
    expect([...drawer("d-projcost").querySelectorAll("tbody tr")].map(r => r.getAttribute("data-v"))).toEqual(["d", "c", "b", "a"]);
  });

  it("sorts the project table by any column, no value last either way", async () => {
    await show(withProjects([proj("a", 6, 3), proj("b", 8, 4), proj("idle", 20, 0)]));
    const names = () => [...drawer("d-projcost").querySelectorAll("tbody tr")].map(r => r.getAttribute("data-v"));
    const th = (name: string) => within(drawer("d-projcost")).getByRole("button", { name: new RegExp(name) }).closest("th")!;
    expect(names()).toEqual(["idle", "b", "a"]);
    expect(th("Est. cost").getAttribute("aria-sort")).toBe("descending");
    await userEvent.click(within(th("Cost / commit")).getByRole("button"));
    expect(names()).toEqual(["a", "b", "idle"]); // $2 each, ties keep order; n/a last
    expect(th("Cost / commit").getAttribute("aria-sort")).toBe("descending");
    expect(th("Est. cost").getAttribute("aria-sort")).toBeNull();
    await userEvent.click(within(th("Cost / commit")).getByRole("button"));
    expect(th("Cost / commit").getAttribute("aria-sort")).toBe("ascending");
    expect(names().at(-1)).toBe("idle");
    await userEvent.click(within(th("Project")).getByRole("button"));
    expect(names()).toEqual(["a", "b", "idle"]);
  });

  it("downloads the project table in the order it shows, and copies it tab-separated", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await show(withProjects([proj("a", 6, 3), proj("b", 8, 4), proj("idle", 20, 0)]));
    const d = drawer("d-projcost");
    await userEvent.click(within(within(d).getByRole("button", { name: /Cost \/ commit/ }).closest("th")!).getByRole("button"));
    const names = (t: string, sep: string) => t.split(/\r?\n/).filter(Boolean).slice(1).map(l => l.split(sep)[0]);
    await userEvent.click(within(d).getByRole("button", { name: "Download CSV" }));
    expect(download).toHaveBeenCalledWith(`ai-ledger-cost-projects-${dayStamp()}.csv`, expect.any(String));
    const csv = vi.mocked(download).mock.calls.at(-1)![1];
    expect(csv.split("\r\n")[0]).toBe("Project,Est. cost (USD),Tokens,Cache hit,1h writes,Subagent cost share,Commits,Cost per commit (USD),Cost per prompt (USD)");
    expect(names(csv, ",")).toEqual(["a", "b", "idle"]);
    expect(csv.split("\r\n")[3]!.split(",")[7]).toBe(""); // no commits: cost per commit is empty
    fireEvent.click(within(d).getByRole("button", { name: "Copy" }));
    expect(await within(d).findByRole("button", { name: "Copied" })).toBeTruthy();
    expect(within(d).getByText("Copied to clipboard.")).toBeTruthy();
    const tsv = writeText.mock.calls[0]![0] as string;
    expect(tsv.split("\n")[0]!.split("\t")[0]).toBe("Project");
    expect(names(tsv, "\t")).toEqual(["a", "b", "idle"]);
    await waitFor(() => expect(within(d).getByRole("button", { name: "Copy" })).toBeTruthy(), { timeout: 3000 });
  });

  it("offers no export when the project table has no rows", async () => {
    await show(withProjects([]));
    expect(within(drawer("d-projcost")).queryByRole("button", { name: "Download CSV" })).toBeNull();
  });

  it("downloads the most expensive sessions with their figures", async () => {
    await show(usage);
    const d = drawer("d-top");
    await userEvent.click(within(d).getByRole("button", { name: "Download CSV" }));
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
    const names = () => within(drawer("d-projcost")).getAllByRole("row").slice(1).map(r => r.querySelector(".name")?.textContent);
    it("folds scratch projects into one row with their sums, and expands it", async () => {
      await show(seven());
      const d = within(drawer("d-projcost"));
      expect(names()).toEqual(["r1", "r2", "r3", "Small projects (4) Show 4 small projects"]);
      const bucket = d.getByText("Small projects (4)").closest("tr")!;
      expect(bucket.textContent).toContain("$0.04");
      expect(bucket.querySelectorAll("td")[6]!.textContent).toBe("4");
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
      const d = within(drawer("d-projcost"));
      await userEvent.click(d.getByRole("button", { name: "Est. cost" }));
      expect(names().slice(0, 3)).toEqual(["r3", "r2", "r1"]);
      expect(names()[3]).toMatch(/^Small projects/);
    });
    it("opens for a small selected project", async () => {
      serve({ ...seven(), project: "t2" }); at("#range=30&project=t2"); render(<CostPage />); await loaded();
      expect(within(drawer("d-projcost")).getByRole("button", { name: "Hide small projects" }).getAttribute("aria-expanded")).toBe("true");
      expect(names()).toContain("t2");
    });
    it("does not fold fewer than 3 small projects", async () => {
      await show(withProjects([real("r1", 100), real("r2", 90), real("r3", 80), tiny("t1"), tiny("t2")]));
      expect(names()).toEqual(["r1", "r2", "r3", "t1", "t2"]);
    });
    it("exports every project, folded or not", async () => {
      await show(seven());
      await userEvent.click(within(drawer("d-projcost")).getByRole("button", { name: "Download CSV" }));
      const lines = vi.mocked(download).mock.calls.at(-1)![1].split("\r\n").filter(Boolean).slice(1);
      expect(lines.map(l => l.split(",")[0])).toEqual(["r1", "r2", "r3", "t1", "t2", "t3", "t4"]);
    });
  });

  it("tints against the median of projects big enough to compare, not the scratch ones", async () => {
    const real = (n: string, cost: number) => ({ ...proj(n, cost, 10), prompts: 50 });
    const tiny = (n: string) => ({ ...proj(n, 0.01, 0), prompts: 1, cache_hit_ratio: 0.5 });
    const scratch = Array.from({ length: 10 }, (_, i) => tiny(`t${i}`));
    await show(withProjects([real("r1", 100), real("r2", 100), real("r3", 300), ...scratch]));
    await userEvent.click(within(drawer("d-projcost")).getByRole("button", { name: "Show 10 small projects" }));
    const cell = (p: string, i: number) => drawer("d-projcost").querySelector(`tbody tr[data-v="${p}"]`)!.querySelectorAll("td")[i]!;
    expect(cell("r1", 8).className).not.toMatch(/tone/);
    expect(cell("r3", 8).className).toMatch(/tone worse/); // $6 a prompt against a $2 median
    expect(cell("r3", 7).className).toMatch(/tone worse/); // $30 a commit against $10
    expect(cell("t0", 8).className).not.toMatch(/tone/);
    expect(drawer("d-projcost").querySelector(".tone-key")!.textContent).toMatch(/median of the 3 projects with 2%\+ of cost or 10\+ prompts/);
  });

  it("does not tint when fewer than three projects are big enough", async () => {
    const tiny = (n: string) => ({ ...proj(n, 0.01, 0), prompts: 1 });
    await show(withProjects([{ ...proj("r1", 100, 10), prompts: 50 }, { ...proj("r2", 300, 10), prompts: 50 }, tiny("a"), tiny("b")]));
    expect(drawer("d-projcost").querySelector(".tone-key")).toBeNull();
    expect(drawer("d-projcost").querySelector("td.tone")).toBeNull();
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
    expect(document.querySelector(".windows")!.textContent).toMatch(/Previous Sep 7 – Oct 6, 2026 · – · 1 of 30 days with prompts/);
    const changed = document.getElementById("changed")!;
    expect(changed.querySelector(".hint")!.textContent).toMatch(/^– → \$16\. Each bar/);
    expect(within(changed).getByRole("button", { name: /^foo: –, from – to \$16/ })).toBeTruthy();
  });

  it("leaves What changed out of a one-project view", async () => {
    serve({ ...usage, project: "foo" });
    at("#range=30&project=foo");
    render(<CostPage />);
    await loaded();
    expect(document.getElementById("changed")).toBeNull();
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

  it("remembers the stacking across a remount and filters to an agent from its key", async () => {
    try {
      await show(usage);
      await userEvent.click(screen.getByRole("button", { name: "Agent" }));
      expect(screen.getByRole("img", { name: /^Estimated cost by agent per day/ })).toBeTruthy();
      await userEvent.click(within(document.querySelector(".legend") as HTMLElement).getByRole("button", { name: "Claude Code" }));
      expect(location.hash).toBe("#range=30&source=claude");
      cleanup();
      await show(usage);
      expect(screen.getByRole("button", { name: "Agent" }).getAttribute("aria-pressed")).toBe("true");
      expect(screen.getByRole("img", { name: /^Estimated cost by agent per day/ })).toBeTruthy();
    } finally {
      localStorage.clear();
    }
  });

  it("shows cost per commit as not available for a project with no commits", async () => {
    await show(withProjects([proj("a", 6, 3), proj("idle", 20, 0)]));
    const idle = drawer("d-projcost").querySelector('tbody tr[data-v="idle"]')!;
    expect(idle.querySelectorAll("td")[7]!.textContent).toBe("n/a");
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
    const row = document.querySelector('#where [data-v="foo"]')!;
    expect(within(row as HTMLElement).getByTitle("1 requests from unpriced models").textContent).toBe("+?");
    expect(screen.getByText("unpriced").className).toMatch(/chip warn/);
    expect(document.querySelector('#d-projcost tr[data-v="foo"]')!.textContent).toMatch(/\$16 \+\?/);
  });

  it("says when the user prices file was ignored, and why", async () => {
    await show({ ...usage, prices_file: { ...usage.prices_file, error: "Expecting value: line 1 column 1 (char 0)" } });
    expect(screen.getByText("Prices file ignored:").closest(".banner")!.textContent)
      .toMatch(/ai-ledger\/prices\.json could not be used \(Expecting value: line 1 column 1 \(char 0\)\)\. Packaged prices apply/);
  });

  it("opens the sheets from the spend ledger and Back closes them", async () => {
    await show(usage);
    await userEvent.click(within(document.getElementById("where")!).getByRole("button", { name: /foo/ }));
    expect(location.hash).toBe("#range=30&inspect=foo");
    await screen.findByRole("button", { name: "Filter dashboard to foo" });
  });

  it("selecting a day on the chart lists that day's sessions by cost", async () => {
    await show(usage);
    const chart = screen.getByRole("img", { name: /^Estimated cost by project per day, 30 days, peaking at \$16 on Nov 4, 2026/ });
    act(() => chart.focus());
    fireEvent.keyDown(chart, { key: "End" });
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    expect(screen.getByText("Nov 4, 2026: $16 estimated. 7-day average $2.26")).toBeTruthy();
    fireEvent.keyDown(chart, { key: "Enter" });
    expect(drawer("d-top").open).toBe(true);
    expect(screen.getByText("Active on Nov 4, 2026")).toBeTruthy();
    await waitFor(() => expect(fetched()).toContain("/api/sessions?range=30&day=2026-11-04"));
    // The server costs each session on that day and orders them; the drawer keeps its order and counts them all.
    expect(await within(drawer("d-top")).findByText("3 sessions active on Nov 4, 2026, by their estimated cost on that day. Select a session for details.")).toBeTruthy();
    expect([...drawer("d-top").querySelectorAll("tbody tr")].map(r => r.getAttribute("data-v"))).toEqual(["s1", "s3", "s2"]);
    expect(drawer("d-top").querySelector("summary .c")!.textContent).toBe("3");
    await userEvent.click(screen.getByRole("button", { name: "Show the most expensive sessions on every day" }));
    expect(within(drawer("d-top")).getByText(/The 2 most expensive sessions in this view/)).toBeTruthy();
    // Tokens: one series per kind.
    await userEvent.click(within(screen.getByRole("group", { name: "Chart metric" })).getByRole("button", { name: "Tokens" }));
    expect(screen.getByRole("img", { name: /^Tokens by kind per day/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cache read" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("splits the Tokens and cache drawer by estimated cost, biggest first, with thinking billed as output", async () => {
    await show(usage);
    const rows = [...drawer("d-tokens").querySelectorAll(".by-kind > div")].map(d => d.textContent!);
    expect(rows[0]).toMatch(/^Output \+ thinking\$1063\.3% of \$16 estimated cost/);
    expect(rows[0]).toMatch(/of the tokens are thinking, billed as output/);
    const cr = rows.find(r => r.startsWith("Cache read"))!;
    expect(cr).toMatch(/\$0\.80.*5\.1% of \$16 estimated cost8\.0M tokens, 66\.7% of 12\.0M/);
    expect(rows.some(r => r.startsWith("Thinking"))).toBe(false);
  });

  it("shows an unknown cost by kind as a dash, not $0", async () => {
    const none = { cost: null, cost_input: null, cost_output: null, cost_cache_read: null, cost_cache_5m: null, cost_cache_1h: null };
    await show({ ...usage, totals: { ...usage.totals, ...none } });
    const first = drawer("d-tokens").querySelector(".by-kind > div")!.textContent!;
    expect(first).toMatch(/–cost unknown/);
    expect(drawer("d-tokens").querySelector(".by-kind")!.textContent).not.toMatch(/\$0/);
  });
});
