import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ProjectRow, UsagePayload } from "../../api";
import usage from "../../__fixtures__/usage";
import usageAll from "../../__fixtures__/usage-all";
import sessions from "../../__fixtures__/sessions";
import session from "../../__fixtures__/session";
import { mockApi } from "../../components/sheets/testing";
import { compareText, costDays, thinHistory } from "./cost";
import { CostPage } from "./CostPage";

const at = (hash = "#range=30") => history.replaceState(null, "", "/cost" + hash);
const serve = (d: UsagePayload) => mockApi({ "/api/usage": () => d, "/api/sessions": () => sessions, "/api/session": () => session });
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
  totals: { ...usage.totals, commits: rows.reduce((a, p) => a + p.commits, 0) } });
const doubled: UsagePayload = { ...usage, previous: { ...usage.previous!, cost: 7.9 } };

describe("cost figures", () => {
  it("compares with the previous period as a multiple from 2x, a percentage below", () => {
    expect(compareText(doubled)).toEqual({ text: "2.0× the previous 30 days", sr: "2.0 times the previous 30 days" });
    expect(compareText({ ...usage, previous: { ...usage.previous!, cost: 12 } })!.text).toBe("+32% vs the previous 30 days");
    expect(compareText(usageAll)).toBeNull();
  });

  it("marks a previous window with under half the active days as thin", () => {
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
  it("leads a thirty-day view with its cost, the change and both windows with their active days", async () => {
    const lede = await show(doubled);
    expect(lede.textContent).toBe("$16 estimated cost, 2.0× the previous 30 days2.0 times the previous 30 days");
    const windows = document.querySelector(".windows")!.textContent;
    expect(windows).toMatch(/This period Oct 7 – Nov 5, 2026 · 2 active days of 30/);
    expect(windows).toMatch(/Previous Sep 7 – Oct 6, 2026 · \$7\.90 · 1 active day of 30/);
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
    await waitFor(() => expect(document.getElementById("lede")!.textContent).toBe("$2.00 estimated cost"));
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
    expect(screen.getByText(/The previous window has usage on only 1 day against 5 now/)).toBeTruthy();
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
    await userEvent.click(screen.getByRole("button", { name: "Sort by cost again" }));
    expect(drawer("d-projcost").querySelector(".proj-note")).toBeNull();
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
    expect(screen.getByText("Unpriced models:").closest(".banner")!.textContent).toMatch(/m-unknown \(200 tokens\)/);
    const row = document.querySelector('#where [data-v="foo"]')!;
    expect(within(row as HTMLElement).getByTitle("1 requests from unpriced models").textContent).toBe("+?");
    expect(screen.getByText("unpriced").className).toMatch(/chip warn/);
    expect(document.querySelector('#d-projcost tr[data-v="foo"]')!.textContent).toMatch(/\$16 \+\?/);
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
    // The mocked page answers with every session; the drawer lists them by cost, unpriced last.
    expect(await within(drawer("d-top")).findByText(/3 sessions active on Nov 4, 2026, by their estimated cost/)).toBeTruthy();
    expect([...drawer("d-top").querySelectorAll("tbody tr")].map(r => r.getAttribute("data-v"))).toEqual(["s1", "s3", "s2"]);
    await userEvent.click(screen.getByRole("button", { name: "Show the most expensive sessions on every day" }));
    expect(within(drawer("d-top")).getByText(/The 2 most expensive sessions in this view/)).toBeTruthy();
    // Tokens: one series per kind.
    await userEvent.click(screen.getByRole("button", { name: "Tokens" }));
    expect(screen.getByRole("img", { name: /^Tokens by kind per day/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cache read" }).getAttribute("aria-pressed")).toBe("true");
  });
});
